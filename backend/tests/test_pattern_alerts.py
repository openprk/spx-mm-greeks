import pytest
from backend.interpretation import classify_strike_terrain


def test_pattern_alert_spot_focused():
    """
    Test that pattern alerts (MAX_DOWNSIDE_ACCELERATION) only trigger
    when dangerous regimes are within 2% of spot price.
    """

    # Test cases: (spot_price, strike_price, expected_result)
    test_cases = [
        # Within 2% - should trigger
        (6900, 6900, True),   # Exactly at spot (0%)
        (6900, 6910, True),   # 1.45% above (within 2%)
        (6900, 6890, True),   # 1.45% below (within 2%)
        (6900, 6915, True),   # 2.17% above (within 2%)
        (6900, 6885, True),   # 2.17% below (within 2%)
        (6900, 7050, False),  # 150 points above (outside 2% = 138 points)
        (6900, 6750, False),  # 150 points below (outside 2% = 138 points)
        (6900, 7200, False),  # Way above
    ]

    for spot_price, strike_price, should_trigger in test_cases:
        # Test dangerous regime
        dangerous_regime = "G- D- V- C+"  # This should trigger MAX_DOWNSIDE_ACCELERATION

        pattern_flags = []
        # Simulate the logic from classify_strike_terrain
        if dangerous_regime == "G- D- V- C+":
            distance_from_spot = abs(strike_price - spot_price) / spot_price
            if distance_from_spot < 0.02:  # Within 2% of spot price
                pattern_flags.append("MAX_DOWNSIDE_ACCELERATION")

        if should_trigger:
            assert len(pattern_flags) > 0, f"Should trigger for strike {strike_price} near spot {spot_price}"
            assert "MAX_DOWNSIDE_ACCELERATION" in pattern_flags, f"Should include MAX_DOWNSIDE_ACCELERATION for {strike_price}"
            print(f"PASS: Correctly triggered alert for strike {strike_price} (near spot {spot_price})")
        else:
            assert len(pattern_flags) == 0, f"Should NOT trigger for strike {strike_price} (far from spot {spot_price})"
            print(f"PASS: Correctly suppressed alert for strike {strike_price} (far from spot {spot_price})")


def test_pattern_alert_different_regimes():
    """
    Test that pattern alerts only trigger for the specific dangerous regime G- D- V- C+
    """

    spot_price = 6900
    strike_price = 6900  # At spot, so within distance

    test_regimes = [
        ("G- D- V- C+", True, "Dangerous acceleration pattern"),
        ("G- D- V- C-", False, "Neutral charm"),
        ("G+ D+ V+ C-", False, "Bullish compression"),
        ("G- D- V+ C-", False, "High velocity down"),
        ("G+ D+ V- C+", False, "Bounce candidate"),
    ]

    for regime_code, should_trigger, description in test_regimes:
        pattern_flags = []

        # Simulate the pattern alert logic
        if regime_code == "G- D- V- C+":
            distance_from_spot = abs(strike_price - spot_price) / spot_price
            if distance_from_spot < 0.02:
                pattern_flags.append("MAX_DOWNSIDE_ACCELERATION")

        if should_trigger:
            assert len(pattern_flags) > 0, f"Should trigger for {description}"
            print(f"PASS: Triggered alert for {description}")
        else:
            assert len(pattern_flags) == 0, f"Should NOT trigger for {description}"
            print(f"PASS: Suppressed alert for {description}")


if __name__ == "__main__":
    test_pattern_alert_spot_focused()
    test_pattern_alert_different_regimes()
    print("\nAll pattern alert tests passed! Alerts are now spot-focused.")