from typing import Dict, List, Tuple, Optional
import numpy as np
from backend.models import Regime, AggregateData
from backend.utils import calculate_neutral_threshold, classify_regime

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
) -> List[dict]:
    """
    Generate consolidated market alerts with structured data.
    Returns core alert types with parameters instead of 35+ specific strings.
    """
    if key_strikes is None:
        key_strikes = []

    alerts = []

    # Analyze regime characteristics
    g, d, v, c = regime.g, regime.d, regime.v, regime.c
    is_bullish_momentum = (g == "+" and d == "+" and c == "-")
    is_bearish_momentum = (g == "-" and d == "-" and c == "+")
    is_high_volatility = (g == "-" and v == "+")
    is_low_volatility = (g == "+" and v == "-")

    # 1. LEVEL_APPROACHING (support/resistance)
    if key_strikes and spot_price > 0:
        strikes_above = [s for s in key_strikes if s > spot_price]
        strikes_below = [s for s in key_strikes if s < spot_price]

        # Check resistance levels
        if strikes_above:
            nearest_resistance = min(strikes_above)
            distance_pct = ((nearest_resistance - spot_price) / spot_price) * 100

            if distance_pct < 1.0:  # Within 1% of resistance
                regime_context = "bullish" if is_bullish_momentum else "bearish" if is_bearish_momentum else "neutral"
                if is_high_volatility:
                    regime_context = "volatile"

                alerts.append({
                    "type": "LEVEL_APPROACHING",
                    "side": "resistance",
                    "distance_pct": round(distance_pct, 2),
                    "distance_points": round(nearest_resistance - spot_price, 1),
                    "strike": nearest_resistance,
                    "regime_context": regime_context
                })

        # Check support levels
        if strikes_below:
            nearest_support = max(strikes_below)
            distance_pct = ((spot_price - nearest_support) / spot_price) * 100

            if distance_pct < 1.0:  # Within 1% of support
                regime_context = "bearish" if is_bearish_momentum else "bullish" if is_bullish_momentum else "neutral"
                if is_high_volatility:
                    regime_context = "volatile"

                alerts.append({
                    "type": "LEVEL_APPROACHING",
                    "side": "support",
                    "distance_pct": round(distance_pct, 2),
                    "distance_points": round(spot_price - nearest_support, 1),
                    "strike": nearest_support,
                    "regime_context": regime_context
                })

    # 2. SPOT_PATTERN_CRITICAL (regime-specific dangerous patterns)
    if regime_code == "G- D- V- C+":
        alerts.append({
            "type": "SPOT_PATTERN_CRITICAL",
            "pattern": "max_acceleration",
            "description": "Maximum downside acceleration - extreme bearish momentum"
        })
    elif regime_code == "G+ D+ V+ C-":
        alerts.append({
            "type": "SPOT_PATTERN_CRITICAL",
            "pattern": "compression_pin",
            "description": "Compression pin setup - potential price magnet"
        })

    # 3. VOL_REGIME (high/low volatility)
    if is_high_volatility:
        alerts.append({
            "type": "VOL_REGIME",
            "level": "high",
            "description": "Negative GEX + Positive VEX = High volatility regime"
        })
    elif is_low_volatility:
        alerts.append({
            "type": "VOL_REGIME",
            "level": "low",
            "description": "Positive GEX + Negative VEX = Low volatility regime"
        })

    # 4. 0DTE_SESSION_STATUS (only for 0DTE mode)
    if mode == "0DTE":
        from datetime import datetime
        now = datetime.now()
        hour = now.hour

        if hour < 10:
            session_phase = "early"
            risk_level = "low"
        elif hour > 15:
            session_phase = "late"
            risk_level = "high"
        else:
            session_phase = "mid"
            risk_level = "normal"

        # Increase risk if high volatility regime
        if is_high_volatility:
            risk_level = "extreme"

        alerts.append({
            "type": "0DTE_SESSION_STATUS",
            "session_phase": session_phase,
            "risk_level": risk_level,
            "description": f"0DTE session {session_phase} with {risk_level} risk"
        })

    # 5. STRIKE_EXTREMES (only for extreme thresholds)
    # Placeholder for future implementation - would check for strikes with
    # extreme GEX values beyond normal thresholds

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
    # Pattern flags will be set later in main.py only for strikes closest to spot
    # This ensures alerts only trigger for where price is currently located

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