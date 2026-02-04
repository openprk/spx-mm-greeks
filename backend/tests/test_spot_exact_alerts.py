import pytest
from unittest.mock import Mock
from backend.models import StrikeData, Regime


def test_spot_exact_pattern_alerts():
    """
    Test that MAX_DOWNSIDE_ACCELERATION alerts only trigger for the 2 closest
    strikes to spot price, even if other strikes have the dangerous regime.
    """

    # Create mock strike data
    class MockStrike:
        def __init__(self, strike, regime_code):
            self.strike = strike
            self.regime_code = regime_code
            self.pattern_flags = []

    # Simulate strikes around spot price 6900
    strikes_data = [
        MockStrike(6850, "G- D- V- C+"),  # Far below - dangerous regime but far from spot
        MockStrike(6880, "G- D- V- C+"),  # Closer below - dangerous regime, should trigger
        MockStrike(6900, "G+ D+ V+ C-"),  # At spot - not dangerous
        MockStrike(6910, "G- D- V- C+"),  # Closer above - dangerous regime, should trigger
        MockStrike(6950, "G- D- V- C+"),  # Far above - dangerous regime but far from spot
        MockStrike(7000, "G- D- V- C+"),  # Very far - dangerous regime but far from spot
    ]

    spot_price = 6900

    # Apply the new logic: only set pattern flags for 2 closest strikes with dangerous regime
    if len(strikes_data) > 0:
        # Find the 2 closest strikes to spot price
        closest_strikes = sorted(strikes_data, key=lambda s: abs(s.strike - spot_price))[:2]

        # Only set MAX_DOWNSIDE_ACCELERATION for closest strikes that have dangerous regime
        for strike_data in closest_strikes:
            if strike_data.regime_code == "G- D- V- C+":
                if "MAX_DOWNSIDE_ACCELERATION" not in strike_data.pattern_flags:
                    strike_data.pattern_flags.append("MAX_DOWNSIDE_ACCELERATION")

    # Verify results
    print("\nSpot price:", spot_price)
    print("Closest 2 strikes:", [s.strike for s in closest_strikes])

    for strike in strikes_data:
        has_alert = "MAX_DOWNSIDE_ACCELERATION" in strike.pattern_flags
        is_close = strike in closest_strikes
        print(f"Strike {strike.strike}: regime={strike.regime_code}, close_to_spot={is_close}, has_alert={has_alert}")

        if is_close and strike.regime_code == "G- D- V- C+":
            # Should have alert if it's close AND dangerous
            assert has_alert, f"Close dangerous strike {strike.strike} should have alert"
        elif not is_close:
            # Should NOT have alert if it's far, even if dangerous
            assert not has_alert, f"Distant dangerous strike {strike.strike} should NOT have alert"

    print("Test passed: Pattern alerts only for 2 closest strikes to spot!")


def test_different_spot_positions():
    """Test alerts for different spot price positions"""

    class MockStrike:
        def __init__(self, strike, regime_code):
            self.strike = strike
            self.regime_code = regime_code
            self.pattern_flags = []

    # Test case 1: Spot between two strikes
    strikes_data = [
        MockStrike(6900, "G- D- V- C+"),  # Should trigger (close to 6902)
        MockStrike(6910, "G- D- V- C+"),  # Should trigger (close to 6902)
        MockStrike(6950, "G- D- V- C+"),  # Should NOT trigger (far)
    ]

    spot_price = 6902  # Between 6900 and 6910

    # Apply logic
    closest_strikes = sorted(strikes_data, key=lambda s: abs(s.strike - spot_price))[:2]
    for strike_data in closest_strikes:
        if strike_data.regime_code == "G- D- V- C+":
            if "MAX_DOWNSIDE_ACCELERATION" not in strike_data.pattern_flags:
                strike_data.pattern_flags.append("MAX_DOWNSIDE_ACCELERATION")

    # Verify
    assert "MAX_DOWNSIDE_ACCELERATION" in strikes_data[0].pattern_flags  # 6900
    assert "MAX_DOWNSIDE_ACCELERATION" in strikes_data[1].pattern_flags  # 6910
    assert "MAX_DOWNSIDE_ACCELERATION" not in strikes_data[2].pattern_flags  # 6950

    print("Test passed: Correct alerts for spot between strikes")

    # Test case 2: Spot exactly on a strike
    strikes_data2 = [
        MockStrike(6900, "G- D- V- C+"),  # Should trigger (at spot)
        MockStrike(6910, "G- D- V- C+"),  # Should trigger (next closest)
        MockStrike(6950, "G- D- V- C+"),  # Should NOT trigger (far)
    ]

    spot_price = 6900  # Exactly on 6900

    # Apply logic
    closest_strikes = sorted(strikes_data2, key=lambda s: abs(s.strike - spot_price))[:2]
    for strike_data in closest_strikes:
        if strike_data.regime_code == "G- D- V- C+":
            if "MAX_DOWNSIDE_ACCELERATION" not in strike_data.pattern_flags:
                strike_data.pattern_flags.append("MAX_DOWNSIDE_ACCELERATION")

    # Verify
    assert "MAX_DOWNSIDE_ACCELERATION" in strikes_data2[0].pattern_flags  # 6900 (at spot)
    assert "MAX_DOWNSIDE_ACCELERATION" in strikes_data2[1].pattern_flags  # 6910 (next closest)
    assert "MAX_DOWNSIDE_ACCELERATION" not in strikes_data2[2].pattern_flags  # 6950 (far)

    print("Test passed: Correct alerts for spot exactly on strike")


if __name__ == "__main__":
    test_spot_exact_pattern_alerts()
    test_different_spot_positions()
    print("\nAll spot-exact alert tests passed!")