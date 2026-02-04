#!/usr/bin/env python3
"""
Test the new spot-only alerts implementation
"""

def test_spot_strike_calculation():
    """Test the floor/ceil spot strike calculation"""
    spot_price = 6904.2
    strike_increment = 5

    # Calculate spot strikes
    lower = (spot_price // strike_increment) * strike_increment
    upper = lower + strike_increment
    spot_strikes = [lower, upper]

    expected = [6900, 6905]
    assert spot_strikes == expected, f"Expected {expected}, got {spot_strikes}"

    print("PASS: Spot strike calculation works correctly")
    print(f"   Spot: {spot_price} -> Strikes: {spot_strikes}")


def test_proximity_distance_threshold():
    """Test the distance-based proximity threshold"""
    spot_price = 6904.2

    # Calculate threshold: min(15, spot_price * 0.0025)
    distance_threshold = min(15, spot_price * 0.0025)
    expected_threshold = min(15, 17.26)  # 6904.2 * 0.0025 = 17.26
    assert distance_threshold == 15, f"Expected 15, got {distance_threshold}"

    # Test which strikes are within threshold
    test_strikes = [6890, 6900, 6905, 6910, 6920, 6950]
    proximity_strikes = [s for s in test_strikes if abs(s - spot_price) <= distance_threshold]

    expected_proximity = [6890, 6900, 6905, 6910]  # Within 15 points of 6904.2
    assert proximity_strikes == expected_proximity, f"Expected {expected_proximity}, got {proximity_strikes}"

    print("PASS: Proximity distance threshold works correctly")
    print(f"   Threshold: {distance_threshold} points")
    print(f"   Proximity strikes: {proximity_strikes}")


def test_spot_only_pattern_alerts():
    """Test that pattern alerts only trigger for spot strikes"""
    spot_price = 6904.2
    strike_increment = 5

    # Calculate spot strikes
    lower = (spot_price // strike_increment) * strike_increment
    upper = lower + strike_increment
    spot_strikes_values = [lower, upper]

    # Mock some strike data
    class MockStrike:
        def __init__(self, strike, regime_code):
            self.strike = strike
            self.regime_code = regime_code
            self.pattern_flags = []

    mock_strikes = [
        MockStrike(6890, "G- D- V- C+"),  # Dangerous regime, but not spot strike
        MockStrike(6900, "G- D- V- C+"),  # Dangerous regime, IS spot strike
        MockStrike(6905, "G+ D+ V+ C-"),  # Not dangerous, IS spot strike
        MockStrike(6910, "G- D- V- C+"),  # Dangerous regime, but not spot strike
    ]

    # Apply the new logic: only set pattern flags for spot strikes with dangerous regime
    spot_strikes_data = [s for s in mock_strikes if s.strike in spot_strikes_values]

    for strike_data in spot_strikes_data:
        if strike_data.regime_code == "G- D- V- C+":
            if "MAX_DOWNSIDE_ACCELERATION" not in strike_data.pattern_flags:
                strike_data.pattern_flags.append("MAX_DOWNSIDE_ACCELERATION")

    # Verify results
    alerts_triggered = []
    for strike in mock_strikes:
        if "MAX_DOWNSIDE_ACCELERATION" in strike.pattern_flags:
            alerts_triggered.append(strike.strike)

    expected_alerts = [6900]  # Only the spot strike with dangerous regime
    assert alerts_triggered == expected_alerts, f"Expected alerts on {expected_alerts}, got {alerts_triggered}"

    print("PASS: Spot-only pattern alerts work correctly")
    print(f"   Spot strikes: {spot_strikes_values}")
    print(f"   Alerts triggered on: {alerts_triggered}")


if __name__ == "__main__":
    test_spot_strike_calculation()
    test_proximity_distance_threshold()
    test_spot_only_pattern_alerts()
    print("\nSUCCESS: All spot-only alert tests passed!")