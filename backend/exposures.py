from typing import Dict, List, Tuple, Optional
from collections import defaultdict
import numpy as np
from backend.models import Exposures, OptionContract, Greeks, StrikeData, Regime
from backend.greeks import calculate_greeks, calculate_time_to_expiration

def calculate_contract_exposures(
    contract: OptionContract,
    spot_price: float,
    risk_free_rate: float,
    dividend_yield: float,
    log_skipped: bool = True
) -> Tuple[Exposures, Greeks]:

    # Calculate time to expiration
    T = calculate_time_to_expiration(contract.expiration_date)

    # Use provided Greeks with validation and defaults for missing values
    delta = contract.delta if contract.delta is not None else 0.0
    gamma = contract.gamma if contract.gamma is not None else 0.0
    theta = contract.theta if contract.theta is not None else 0.0
    vega = contract.vega if contract.vega is not None else 0.0

    # Validate and clamp Greeks to reasonable ranges, handle NaN/inf
    def validate_greek(value, min_val, max_val, default=0.0):
        if value is None or np.isnan(value) or np.isinf(value):
            return default
        return max(min_val, min(max_val, value))

    delta = validate_greek(delta, -5.0, 5.0)
    gamma = validate_greek(gamma, -1.0, 1.0)
    theta = validate_greek(theta, -10.0, 10.0)
    vega = validate_greek(vega, -10.0, 10.0)

    # If we have at least basic Greeks, use them with defaults for missing ones
    if abs(delta) > 0.001 or abs(gamma) > 0.0001:  # More meaningful threshold
        # Convert theta to charm (dDelta/dt per year), with validation
        charm = validate_greek(-theta / 365.25 if abs(theta) > 0.001 else 0.0, -10.0, 10.0)

        # Estimate vanna from vega and gamma, with validation
        vanna_estimate = vega * 0.1 if abs(vega) > 0.001 else (gamma * np.sqrt(T) if T > 0 else 0.0)
        vanna = validate_greek(vanna_estimate, -10.0, 10.0)

        greeks = Greeks(
            delta=delta,
            gamma=gamma,
            vanna=vanna,
            charm=charm
        )
    else:
        # Fall back to Black-Scholes calculation with validated IV
        if contract.implied_volatility is None:
            if log_skipped:
                print(f"DEBUG: Skipping contract {contract.symbol}@{contract.strike} - missing IV, using 0.20 default")
            sigma = 0.20
        elif not (0 < contract.implied_volatility < 5.0):
            if log_skipped:
                print(f"DEBUG: Invalid IV {contract.implied_volatility} for {contract.symbol}@{contract.strike}, using 0.20 default")
            sigma = 0.20
        else:
            sigma = contract.implied_volatility

        try:
            greeks = calculate_greeks(
                S=spot_price,
                K=contract.strike,
                T=T,
                r=risk_free_rate,
                q=dividend_yield,
                sigma=sigma,
                option_type=contract.option_type
            )

            # Validate Black-Scholes results too
            greeks.delta = validate_greek(greeks.delta, -5.0, 5.0)
            greeks.gamma = validate_greek(greeks.gamma, -1.0, 1.0)
            greeks.vanna = validate_greek(greeks.vanna, -10.0, 10.0)
            greeks.charm = validate_greek(greeks.charm, -10.0, 10.0)

        except Exception:
            # If Black-Scholes fails, return safe defaults
            greeks = Greeks(delta=0.0, gamma=0.0, vanna=0.0, charm=0.0)

    # Calculate exposures using MM sign convention: MM exposure = -OI * greek
    open_interest = contract.open_interest or 0

    # Calculate exposures with overflow protection and validation
    def calculate_safe_exposure(greek_value, multiplier):
        try:
            # Validate inputs
            if not isinstance(open_interest, (int, float)) or not isinstance(greek_value, (int, float)) or not isinstance(multiplier, (int, float)):
                return 0.0

            if open_interest < 0 or not np.isfinite(open_interest):
                return 0.0

            if not np.isfinite(greek_value):
                return 0.0

            if not np.isfinite(multiplier) or multiplier <= 0:
                return 0.0

            # Calculate with market maker sign convention: MM = -OI
            raw_value = -open_interest * greek_value * multiplier

            # Validate result
            if np.isnan(raw_value) or np.isinf(raw_value):
                return 0.0

            return raw_value
        except (OverflowError, ValueError, TypeError):
            return 0.0

    gex = calculate_safe_exposure(greeks.gamma, (spot_price ** 2) * 100)
    dex = calculate_safe_exposure(greeks.delta, spot_price * 100)
    vex = calculate_safe_exposure(greeks.vanna, spot_price * 100)
    cex = calculate_safe_exposure(greeks.charm, spot_price * 100)

    exposures = Exposures(
        gex=gex,
        dex=dex,
        vex=vex,
        cex=cex
    )

    return exposures, greeks

def aggregate_by_strike(
    contracts: List[OptionContract],
    spot_price: float,
    risk_free_rate: float,
    dividend_yield: float
) -> Dict[float, Dict]:

    print(f"🔍 aggregate_by_strike called with {len(contracts)} contracts")
    strike_data = defaultdict(lambda: {
        "gex": 0.0, "dex": 0.0, "vex": 0.0, "cex": 0.0,
        "call_oi": 0, "put_oi": 0,
        "contracts": []
    })

    for contract in contracts:
        exposures, greeks = calculate_contract_exposures(
            contract, spot_price, risk_free_rate, dividend_yield
        )

        strike = contract.strike
        strike_data[strike]["gex"] += exposures.gex
        strike_data[strike]["dex"] += exposures.dex
        strike_data[strike]["vex"] += exposures.vex
        strike_data[strike]["cex"] += exposures.cex

        if contract.option_type.lower() == "call":
            strike_data[strike]["call_oi"] += contract.open_interest or 0
        else:
            strike_data[strike]["put_oi"] += contract.open_interest or 0

        strike_data[strike]["contracts"].append({
            "contract": contract,
            "exposures": exposures,
            "greeks": greeks
        })

    return dict(strike_data)


def aggregate_by_strike_with_logging(
    contracts: List[OptionContract],
    spot_price: float,
    risk_free_rate: float = 0.045,
    dividend_yield: float = 0.0
) -> Dict[float, Dict]:
    """
    Aggregate exposures by strike with logging for skipped contracts.
    Returns aggregated data and logs count of skipped contracts.
    """
    skipped_count = 0
    processed_count = 0

    strike_data = defaultdict(lambda: {
        "gex": 0.0, "dex": 0.0, "vex": 0.0, "cex": 0.0,
        "call_oi": 0, "put_oi": 0,
        "contracts": []
    })

    for contract in contracts:
        try:
            exposures, greeks = calculate_contract_exposures(
                contract, spot_price, risk_free_rate, dividend_yield, log_skipped=False
            )

            # Check if contract was effectively skipped (all exposures are 0)
            if (abs(exposures.gex) < 1e-10 and abs(exposures.dex) < 1e-10 and
                abs(exposures.vex) < 1e-10 and abs(exposures.cex) < 1e-10):
                skipped_count += 1
                continue

            processed_count += 1

        except Exception as e:
            print(f"ERROR: Failed to calculate exposures for contract {contract.symbol}@{contract.strike}: {e}")
            skipped_count += 1
            continue

        strike = contract.strike
        strike_data[strike]["gex"] += exposures.gex
        strike_data[strike]["dex"] += exposures.dex
        strike_data[strike]["vex"] += exposures.vex
        strike_data[strike]["cex"] += exposures.cex

        if contract.option_type.lower() == "call":
            strike_data[strike]["call_oi"] += contract.open_interest or 0
        else:
            strike_data[strike]["put_oi"] += contract.open_interest or 0

        strike_data[strike]["contracts"].append({
            "contract": contract,
            "exposures": exposures,
            "greeks": greeks
        })

    total_contracts = len(contracts)
    print(f"DEBUG: Processed {processed_count}/{total_contracts} contracts, skipped {skipped_count}")

    return dict(strike_data)

def aggregate_all_expirations(
    strike_aggregations: Dict[float, Dict]
) -> Dict:

    total = {"gex": 0.0, "dex": 0.0, "vex": 0.0, "cex": 0.0}

    for strike_data in strike_aggregations.values():
        total["gex"] += strike_data["gex"]
        total["dex"] += strike_data["dex"]
        total["vex"] += strike_data["vex"]
        total["cex"] += strike_data["cex"]

    return total

def calculate_neutral_threshold(values: List[float], epsilon: float = 0.05) -> float:

    if not values:
        return epsilon

    abs_values = [abs(v) for v in values]
    median_abs = np.median(abs_values)
    return max(epsilon, 0.05 * median_abs)

def classify_regime(value: float, neutral_threshold: float) -> str:

    if abs(value) < neutral_threshold:
        return "o"
    return "+" if value > 0 else "-"