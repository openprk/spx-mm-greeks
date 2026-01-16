import pytest
import numpy as np
from backend.greeks import calculate_greeks, calculate_time_to_expiration
from backend.models import Greeks


class TestGreeks:
    """Test Black-Scholes Greeks calculations"""

    def test_call_option_greeks(self):
        """Test Greeks calculation for call option"""
        greeks = calculate_greeks(
            S=100, K=100, T=1, r=0.05, q=0, sigma=0.2, option_type="call"
        )

        assert isinstance(greeks, Greeks)
        assert greeks.delta > 0  # Call delta should be positive
        assert greeks.gamma > 0  # Gamma should be positive
        assert greeks.vanna != 0
        assert greeks.charm != 0

    def test_put_option_greeks(self):
        """Test Greeks calculation for put option"""
        greeks = calculate_greeks(
            S=100, K=100, T=1, r=0.05, q=0, sigma=0.2, option_type="put"
        )

        assert isinstance(greeks, Greeks)
        assert greeks.delta < 0  # Put delta should be negative
        assert greeks.gamma > 0  # Gamma should be positive
        assert greeks.vanna != 0
        assert greeks.charm != 0

    def test_edge_cases(self):
        """Test edge cases"""
        # Zero time to expiration
        greeks = calculate_greeks(S=100, K=100, T=0, r=0.05, q=0, sigma=0.2, option_type="call")
        assert greeks.delta == 0
        assert greeks.gamma == 0

        # Zero volatility
        greeks = calculate_greeks(S=100, K=100, T=1, r=0.05, q=0, sigma=0, option_type="call")
        assert greeks.delta == 0
        assert greeks.gamma == 0

    def test_invalid_option_type(self):
        """Test invalid option type raises error"""
        with pytest.raises(ValueError):
            calculate_greeks(S=100, K=100, T=1, r=0.05, q=0, sigma=0.2, option_type="invalid")


class TestTimeCalculations:
    """Test time to expiration calculations"""

    def test_future_date(self):
        """Test calculation for future date"""
        # This test might be flaky depending on current date
        # For now, just test that it returns a float
        result = calculate_time_to_expiration("2025-12-31")
        assert isinstance(result, float)
        assert result >= 0

    def test_invalid_date(self):
        """Test invalid date returns 0"""
        result = calculate_time_to_expiration("invalid-date")
        assert result == 0.0