from typing import Dict, List, Tuple, Optional
import numpy as np
from backend.models import Regime, AggregateData
from backend.exposures import calculate_neutral_threshold, classify_regime

def classify_exposure_regime(
    gex: float, dex: float, vex: float, cex: float,
    all_values: List[float],
    epsilon: float = 0.05
) -> Tuple[Regime, str]:

    neutral_threshold = calculate_neutral_threshold(all_values, epsilon)

    regime = Regime(
        g=classify_regime(gex, neutral_threshold),
        d=classify_regime(dex, neutral_threshold),
        v=classify_regime(vex, neutral_threshold),
        c=classify_regime(cex, neutral_threshold)
    )

    regime_code = f"G{regime.g} D{regime.d} V{regime.v} C{regime.c}"

    return regime, regime_code

def determine_market_alerts(
    regime: Regime,
    regime_code: str,
    vix_regime: str = "AUTO",
    spot_price: float = 0,
    key_strikes: List[float] = None,
    mode: str = "ALL"
) -> List[str]:
    """
    Generate intelligent, contextual market alerts based on regime + spot price combinations.
    Alerts change meaning based on market conditions and positioning - not just proximity.
    """
    if key_strikes is None:
        key_strikes = []

    alerts = []

    # Analyze regime characteristics for intelligent alerting
    g, d, v, c = regime.g, regime.d, regime.v, regime.c

    # Determine market momentum and risk context
    is_bullish_momentum = (g == "+" and d == "+" and c == "-")  # Compression + buying
    is_bearish_momentum = (g == "-" and d == "-" and c == "+")  # Acceleration bearish
    is_high_volatility = (g == "-" and v == "+")  # Negative GEX + positive VEX
    is_low_volatility = (g == "+" and v == "-")  # Positive GEX + negative VEX
    is_time_decay_critical = (c == "+" or c == "-")  # Charm has significant impact

    # Context-aware alerts based on regime + spot price positioning
    if key_strikes and spot_price > 0:
        # Find nearest strikes above and below current price
        strikes_above = [s for s in key_strikes if s > spot_price]
        strikes_below = [s for s in key_strikes if s < spot_price]

        # RESISTANCE LEVEL ALERTS - Context matters!
        if strikes_above:
            nearest_resistance = min(strikes_above)
            distance_to_resistance = (nearest_resistance - spot_price) / spot_price

            if distance_to_resistance < 0.01:  # Within 1% of resistance
                if is_bullish_momentum:
                    if distance_to_resistance < 0.002:  # Very close
                        alerts.append("BULLISH_BREAKOUT_IMMINENT")
                    else:
                        alerts.append("COMPRESSION_TEST_OF_RESISTANCE")
                elif is_bearish_momentum:
                    alerts.append("BEARISH_RESISTANCE_REJECTION_LIKELY")
                elif is_high_volatility:
                    alerts.append("VOLATILE_RESISTANCE_PIN_RISK")
                else:
                    alerts.append("NEUTRAL_RESISTANCE_APPROACH")

        # SUPPORT LEVEL ALERTS - Context matters!
        if strikes_below:
            nearest_support = max(strikes_below)
            distance_to_support = (spot_price - nearest_support) / spot_price

            if distance_to_support < 0.01:  # Within 1% of support
                if is_bearish_momentum:
                    if distance_to_support < 0.002:  # Very close
                        alerts.append("BEARISH_BREAKDOWN_IMMINENT")
                    else:
                        alerts.append("ACCELERATION_TEST_OF_SUPPORT")
                elif is_bullish_momentum:
                    alerts.append("BULLISH_SUPPORT_DEFENSE_STRONG")
                elif is_high_volatility:
                    alerts.append("VOLATILE_SUPPORT_PIN_RISK")
                else:
                    alerts.append("NEUTRAL_SUPPORT_APPROACH")

    # REGIME-SPECIFIC PATTERN ALERTS (from MD files)
    if regime_code == "G- D- V- C+":
        alerts.append("MAX_DOWNSIDE_ACCELERATION")
        # Additional context for this dangerous pattern
        if mode == "0DTE":
            alerts.append("EXTREME_0DTE_RISK_SETUP")

    elif regime_code == "G+ D+ V+ C-":
        alerts.append("COMPRESSION_PIN_SETUP")
        if mode == "0DTE":
            alerts.append("HIGH_PROBABILITY_0DTE_PIN")

    elif regime_code == "G- D- V+ C-":
        alerts.append("VOL_CUSHION_TRAP_ACTIVE")
        alerts.append("MOMENTUM_WITH_VOLATILITY_BUFFER")

    elif regime_code == "G+ D+ V- C+":
        alerts.append("BOUNCE_CANDIDATE_ACTIVE")
        alerts.append("REVERSAL_SETUP_FAVORABLE")

    # VIX REGIME CONTEXT (when available)
    if vix_regime == "RISING" and is_high_volatility:
        alerts.append("VIX_SPIKE_AMPLIFYING_VOLATILITY")
    elif vix_regime == "FALLING" and is_bullish_momentum:
        alerts.append("VIX_CALM_SUPPORTING_UPSIDE")

    # 0DTE-SPECIFIC CONTEXT
    if mode == "0DTE":
        alerts.append("TRADING_0DTE_SESSION")

        # Time-based risk escalation for 0DTE
        from datetime import datetime
        now = datetime.now()
        hour = now.hour

        if hour < 10:
            alerts.append("EARLY_0DTE_LOW_RISK_PERIOD")
        elif hour > 15:
            alerts.append("LATE_0DTE_HIGH_RISK_PERIOD")
            if is_time_decay_critical:
                alerts.append("CRITICAL_TIME_DECAY_WINDOW")
        else:
            alerts.append("MID_0DTE_ACTIVE_PERIOD")

        # 0DTE-specific regime warnings
        if is_high_volatility and (is_bearish_momentum or is_bullish_momentum):
            alerts.append("0DTE_EXTREME_REGIME_RISK")

    # HIGH-RISK COMBINATIONS
    if is_bearish_momentum and is_high_volatility and mode == "0DTE":
        alerts.append("MAX_RISK_0DTE_SETUP")

    if is_bullish_momentum and is_time_decay_critical and distance_to_resistance < 0.005:
        alerts.append("TIME_DECAY_BREAKOUT_OPPORTUNITY")

    return alerts

def determine_conductivity(
    regime: Regime,
    vix_regime: str = "AUTO"
) -> Tuple[str, str]:

    # GEX amplifier principle: Negative GEX amplifies momentum
    # Primary direction from DEX, conditional on VIX for VEX, time-decay drift from CEX

    g, d, v, c = regime.g, regime.d, regime.v, regime.c

    # Ideal rally-conducive: GEX -, DEX -, VEX - with VIX falling, CEX -
    # Ideal sell-off-conducive: GEX -, DEX +, VEX + with VIX rising, CEX +

    if g == '-':
        if d == '-' and v == '-' and c == '-':
            # Strong bearish alignment - potential rally setup
            if vix_regime in ["FALLING", "AUTO"]:
                return "RALLY-CONDUCIVE", "Strong bearish alignment with supportive VIX regime. Momentum amplification likely to accelerate rallies."
            else:
                return "MIXED", "Bearish alignment but VIX rising creates uncertainty. Watch for volatility spike cushioning."

        elif d == '+' and v == '+' and c == '+':
            # Strong bullish alignment - potential sell-off setup
            if vix_regime in ["RISING", "AUTO"]:
                return "SELL-OFF-CONDUCIVE", "Strong bullish alignment with rising VIX. Momentum amplification likely to accelerate sell-offs."
            else:
                return "MIXED", "Bullish alignment but VIX falling creates uncertainty. VEX cushion may protect upside."

        elif d == '-' and v == '+' and c == '-':
            # Conditional void - accelerates down but VEX cushions vol spikes
            return "CONDITIONAL_VOID", "Accelerates downside momentum but VEX provides cushion during volatility spikes. High-probability floor formation zone."

        elif d == '+' and v == '-' and c == '+':
            # Bounce candidate - compression + buying pressure + vol cushion
            return "BOUNCE_CANDIDATE", "Strong compression with buying pressure and volatility cushion. Potential reversal setup zone."

        elif d == '-' and v == '-' and c == '+':
            # Acceleration zone down - extreme bearish alignment, no support structure
            return "ACCELERATION_DOWN", "Extreme bearish alignment with negative GEX amplification. Maximum downward momentum acceleration expected."

    elif g == '+':
        if d == '+' and v == '+' and c == '-':
            # Ceiling/magnet - extreme compression + directional buying support
            return "CEILING_MAGNET", "Extreme compression with strong directional buying support. Pin behavior expected at this level."

        elif d == '+' and v == '-' and c == '+':
            # Structural support - strong compression + aggressive MM buying
            return "STRUCTURAL_SUPPORT", "Strong compression with aggressive market maker buying. High-probability support level."

    # Default mixed/chop case
    return "MIXED_CHOP", "No clear directional alignment across exposures. Expect range-bound or choppy conditions."

def classify_strike_terrain(
    regime_code: str,
    spot_price: float,
    strike: float,
    gex: float = 0,
    dex: float = 0,
    vex: float = 0,
    cex: float = 0
) -> Tuple[str, List[str]]:

    pattern_flags = []

    # Guide-compliant strike-level alerts (only the specified one)
    # Only trigger pattern alerts for strikes near spot price (Roberto requirement)
    if regime_code == "G- D- V- C+":
        distance_from_spot = abs(strike - spot_price) / spot_price
        if distance_from_spot < 0.02:  # Within 2% of spot price
            pattern_flags.append("MAX_DOWNSIDE_ACCELERATION")

    # Terrain mapping based on regime codes
    # Note: Guide specifies normalization of duplicates to one canonical mapping
    # Precedence for "G- D- V+ C-": "HIGH-VELOCITY DOWN" chosen as it appears first in guide
    # Precedence for "G+ D+ V- C+": "BOUNCE CANDIDATE" chosen as it appears first in guide
    terrain_map = {
        # Core terrain classifications (exactly as specified in guide)
        "G+ D+ V+ C-": "CEILING/MAGNET — Extreme compression + directional buying support. Pin behavior expected.",
        "G- D- V- C+": "ACCELERATION ZONE (DOWN) — All directional Greeks aligned bearish. No support structure.",
        "G- D- V+ C-": "HIGH-VELOCITY DOWN — Momentum amplified, but VEX provides vol-spike cushion. Trapped longs above.",
        "G+ D+ V- C+": "BOUNCE CANDIDATE — Compression + buying pressure + vol-spike cushion. Reversal setup zone.",
    }

    classification = terrain_map.get(regime_code, "NEUTRAL — No significant terrain features identified.")

    # Add positional context
    distance_from_spot = abs(strike - spot_price) / spot_price
    if distance_from_spot < 0.01:  # Within 1% of spot
        classification += " (AT-THE-MONEY)"
    elif strike > spot_price:
        classification += " (OUT-OF-THE-MONEY CALL)"
    else:
        classification += " (OUT-OF-THE-MONEY PUT)"

    return classification, pattern_flags

def analyze_vix_regime(vix_value: Optional[float] = None) -> str:
    # Simplified logic - in production would compare to moving averages/trends
    if vix_value is None:
        return "AUTO"

    # Rough thresholds - would be calibrated with historical data
    if vix_value > 20:
        return "RISING"
    elif vix_value < 15:
        return "FALLING"
    else:
        return "AUTO"

def generate_aggregate_notes(
    conductivity: str,
    regime_code: str,
    spot_price: float
) -> str:

    base_notes = {
        "RALLY-CONDUCIVE": f"SPX {spot_price:.0f} shows rally-conducive setup. Negative GEX will amplify upward momentum, especially if VIX falls.",
        "SELL-OFF-CONDUCIVE": f"SPX {spot_price:.0f} shows sell-off-conducive setup. Negative GEX will amplify downward momentum, especially if VIX rises.",
        "CONDITIONAL_VOID": f"SPX {spot_price:.0f} in conditional void zone. Accelerates downside but cushions volatility spikes.",
        "MIXED_CHOP": f"SPX {spot_price:.0f} shows mixed signals. Expect choppy/range conditions with no clear directional bias.",
        "CEILING_MAGNET": f"SPX {spot_price:.0f} at potential ceiling. Extreme compression may lead to pin behavior.",
        "STRUCTURAL_SUPPORT": f"SPX {spot_price:.0f} at structural support. Strong MM buying likely to defend this level."
    }

    return base_notes.get(conductivity, f"SPX {spot_price:.0f} - {conductivity} conditions identified.")