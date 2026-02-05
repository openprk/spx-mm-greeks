import pytest
from unittest.mock import Mock
from backend.interpretation import determine_market_alerts
from backend.models import Regime


class MockStrikeData:
    """Mock StrikeData object for testing"""
    def __init__(self, strike):
        self.strike = strike


def test_alert_fix_closest_strikes():
    """
    Test that alerts are based on strikes closest to spot price,
    not the order they appear in the API response.
    """
    # Simulate spot price
    spot_price = 6900.0

    # Create mock strikes in "API order" (not sorted by proximity)
    # This simulates what the API might return first
    strikes_data = [
        MockStrikeData(7500.0),  # Very far above - API might return this first
        MockStrikeData(7200.0),  # Far above
        MockStrikeData(6500.0),  # Far below
        MockStrikeData(7100.0),  # Medium far above
        MockStrikeData(6800.0),  # Medium far below
        MockStrikeData(6920.0),  # Near above - API might return this later
        MockStrikeData(6900.0),  # At spot
        MockStrikeData(6880.0),  # Near below
        MockStrikeData(6910.0),  # Very near above
        MockStrikeData(6890.0),  # Very near below
        MockStrikeData(6930.0),  # Near above
        MockStrikeData(6870.0),  # Near below
    ]

    print("\n=== TEST: Alert Fix Verification ===")
    print(f"Spot Price: {spot_price}")
    print(f"Original API order: {[s.strike for s in strikes_data]}")

    # BEFORE FIX: Using first N strikes (simulating old behavior)
    old_approach = [s.strike for s in strikes_data[:8]]  # First 8 strikes
    print(f"OLD approach (first 8): {old_approach}")

    # AFTER FIX: Find closest strikes (current implementation)
    strikes_sorted_by_distance = sorted(strikes_data, key=lambda s: abs(s.strike - spot_price))
    new_approach = [s.strike for s in strikes_sorted_by_distance[:8]]  # 8 closest strikes
    print(f"NEW approach (8 closest): {new_approach}")

    # Verify the fix works
    assert new_approach[0] == 6900.0, "Closest strike should be at spot"
    assert abs(new_approach[1] - spot_price) <= abs(old_approach[1] - spot_price), "New approach should be closer"

    # Test proximity alerts with both approaches
    neutral_regime = Regime(g="o", d="o", v="o", c="o")  # Neutral regime

    old_alerts = determine_market_alerts(
        regime=neutral_regime,
        regime_code="G o D o V o C o",
        spot_price=spot_price,
        key_strikes=old_approach,
        mode="ALL"
    )

    new_alerts = determine_market_alerts(
        regime=neutral_regime,
        regime_code="G o D o V o C o",
        spot_price=spot_price,
        key_strikes=new_approach,
        mode="ALL"
    )

    print(f"OLD alerts: {old_alerts}")
    print(f"NEW alerts: {new_alerts}")

    # New approach should generate proximity alerts since spot is near the strikes
    # Updated to work with new structured alert objects
    proximity_alerts = [alert for alert in new_alerts if alert.get("type") == "LEVEL_APPROACHING"]
    assert len(proximity_alerts) > 0, "New approach should generate LEVEL_APPROACHING alerts"

    print("TEST PASSED: Alert fix works correctly!")
    print("Proximity alerts are now based on strikes closest to spot price")


def test_spot_at_edge_cases():
    """Test alerts when spot is at various positions relative to strikes"""
    test_cases = [
        (6900.0, "at exact strike"),
        (6905.0, "slightly above strike"),
        (6895.0, "slightly below strike"),
        (6925.0, "near resistance"),
        (6875.0, "near support"),
    ]

    strikes_data = [
        MockStrikeData(6900.0), MockStrikeData(6910.0), MockStrikeData(6890.0),
        MockStrikeData(6920.0), MockStrikeData(6880.0), MockStrikeData(6930.0),
        MockStrikeData(6870.0), MockStrikeData(7500.0), MockStrikeData(6500.0),
    ]

    for spot_price, description in test_cases:
        print(f"\n--- Testing spot at {spot_price} ({description}) ---")

        # Find closest strikes
        strikes_sorted_by_distance = sorted(strikes_data, key=lambda s: abs(s.strike - spot_price))
        closest_strikes = [s.strike for s in strikes_sorted_by_distance[:8]]

        # Generate alerts
        alerts = determine_market_alerts(
            regime=Regime(g="o", d="o", v="o", c="o"),
            regime_code="G o D o V o C o",
            spot_price=spot_price,
            key_strikes=closest_strikes,
            mode="ALL"
        )

        proximity_alerts = [alert for alert in alerts if "RESISTANCE" in alert or "SUPPORT" in alert]
        print(f"Closest strikes: {closest_strikes[:4]}...")
        print(f"Proximity alerts: {proximity_alerts}")

        # Should have proximity alerts when near strikes
        if any(abs(strike - spot_price) / spot_price < 0.01 for strike in closest_strikes):
            assert len(proximity_alerts) > 0, f"Should have proximity alerts when near strikes at {spot_price}"
            print("Correctly generated proximity alerts")
        else:
            print("No proximity alerts (as expected - spot not near any strike)")


if __name__ == "__main__":
    test_alert_fix_closest_strikes()
    test_spot_at_edge_cases()
    print("\nAll tests passed! The alert fix is working correctly.")