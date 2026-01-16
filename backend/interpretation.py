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
    strike: float
) -> Tuple[str, List[str]]:

    pattern_flags = []

    # Maximum downside acceleration pattern
    if regime_code == "G- D- V- C+":
        pattern_flags.append("MAX_DOWNSIDE_ACCELERATION")

    # Terrain mapping based on regime codes
    terrain_map = {
        "G+ D+ V+ C-": "CEILING/MAGNET — Extreme compression + directional buying support. Pin behavior expected.",
        "G- D- V- C+": "ACCELERATION ZONE (DOWN) — All directional Greeks aligned bearish. No support structure.",
        "G- D- V+ C-": "HIGH-VELOCITY DOWN — Momentum amplified, but VEX provides vol-spike cushion. Trapped longs above.",
        "G+ D+ V- C+": "BOUNCE CANDIDATE — Compression + buying pressure + vol-spike cushion. Reversal setup zone.",
        "G- D- V+ C-": "CONDITIONAL VOID — Accelerates down, BUT vol spike triggers MM buying (V+ override).",
        "G+ D+ V- C+": "STRUCTURAL SUPPORT — Strong compression + aggressive MM buying. High-probability floor.",
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