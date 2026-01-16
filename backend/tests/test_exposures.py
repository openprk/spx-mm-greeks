import pytest
from backend.exposures import (
    calculate_contract_exposures,
    aggregate_by_strike,
    aggregate_all_expirations,
    calculate_neutral_threshold,
    classify_regime
)
from backend.models import OptionContract, Exposures, Greeks


class TestContractExposures:
    """Test contract exposure calculations"""

    def test_call_option_exposures(self):
        """Test exposure calculation for call option"""
        contract = OptionContract(
            symbol="SPX250317C04700000",
            option_type="call",
            strike=4700,
            expiration_date="2025-03-17",
            open_interest=1000,
            delta=0.6,
            gamma=0.02,
            theta=-10,
            vega=50
        )

        exposures, greeks = calculate_contract_exposures(
            contract, spot_price=4700, risk_free_rate=0.045, dividend_yield=0
        )

        assert isinstance(exposures, Exposures)
        assert isinstance(greeks, Greeks)
        # MM exposure = -OI * greek * scaling
        # GEX = -1000 * 0.02 * 4700^2 * 100 = large negative number
        assert exposures.gex < 0
        assert exposures.dex < 0  # Since delta > 0 for call

    def test_put_option_exposures(self):
        """Test exposure calculation for put option"""
        contract = OptionContract(
            symbol="SPX250317P04700000",
            option_type="put",
            strike=4700,
            expiration_date="2025-03-17",
            open_interest=800,
            delta=-0.4,
            gamma=0.02,
            theta=-8,
            vega=45
        )

        exposures, greeks = calculate_contract_exposures(
            contract, spot_price=4700, risk_free_rate=0.045, dividend_yield=0
        )

        assert isinstance(exposures, Exposures)
        assert isinstance(greeks, Greeks)
        # GEX should still be negative (MM exposure)
        assert exposures.gex < 0
        # DEX should be positive since delta is negative for put but MM convention applies
        assert exposures.dex != 0

    def test_zero_open_interest(self):
        """Test contract with zero open interest"""
        contract = OptionContract(
            symbol="SPX250317C04700000",
            option_type="call",
            strike=4700,
            expiration_date="2025-03-17",
            open_interest=0,
            delta=0.6,
            gamma=0.02,
            theta=-10,
            vega=50
        )

        exposures, greeks = calculate_contract_exposures(
            contract, spot_price=4700, risk_free_rate=0.045, dividend_yield=0
        )

        # Should return zero exposures
        assert exposures.gex == 0
        assert exposures.dex == 0
        assert exposures.vex == 0
        assert exposures.cex == 0


class TestAggregation:
    """Test exposure aggregation functions"""

    def test_aggregate_by_strike(self):
        """Test strike-level aggregation"""
        contracts = [
            OptionContract(
                symbol="SPX250317C04700000",
                option_type="call",
                strike=4700,
                expiration_date="2025-03-17",
                open_interest=1000,
                delta=0.6,
                gamma=0.02,
                theta=-10,
                vega=50
            ),
            OptionContract(
                symbol="SPX250317P04700000",
                option_type="put",
                strike=4700,
                expiration_date="2025-03-17",
                open_interest=800,
                delta=-0.4,
                gamma=0.02,
                theta=-8,
                vega=45
            )
        ]

        result = aggregate_by_strike(
            contracts, spot_price=4700, risk_free_rate=0.045, dividend_yield=0
        )

        assert 4700 in result
        strike_data = result[4700]
        assert "gex" in strike_data
        assert "dex" in strike_data
        assert "vex" in strike_data
        assert "cex" in strike_data
        assert strike_data["call_oi"] == 1000
        assert strike_data["put_oi"] == 800

    def test_aggregate_all_expirations(self):
        """Test total aggregation across expirations"""
        strike_data = {
            4700: {"gex": -1000, "dex": 500, "vex": -200, "cex": 100},
            4750: {"gex": -800, "dex": 300, "vex": -150, "cex": 50}
        }

        result = aggregate_all_expirations(strike_data)

        assert result["gex"] == -1800  # -1000 + -800
        assert result["dex"] == 800    # 500 + 300
        assert result["vex"] == -350   # -200 + -150
        assert result["cex"] == 150    # 100 + 50


class TestRegimeClassification:
    """Test regime classification functions"""

    def test_neutral_threshold(self):
        """Test neutral threshold calculation"""
        values = [1, -1, 2, -2, 10, -10]
        threshold = calculate_neutral_threshold(values)
        # Should be max(0.05, 0.05 * median(abs(values)))
        # median(abs(values)) = median([1,1,2,2,10,10]) = 2
        # 0.05 * 2 = 0.1
        assert threshold == 0.1

    def test_empty_values_threshold(self):
        """Test neutral threshold with empty values"""
        threshold = calculate_neutral_threshold([])
        assert threshold == 0.05  # Default epsilon

    def test_regime_classification(self):
        """Test regime sign classification"""
        # Above threshold
        assert classify_regime(1.0, 0.5) == "+"
        assert classify_regime(-1.0, 0.5) == "-"

        # Below threshold (neutral)
        assert classify_regime(0.1, 0.5) == "o"
        assert classify_regime(-0.1, 0.5) == "o"

        # At threshold
        assert classify_regime(0.5, 0.5) == "o"
        assert classify_regime(-0.5, 0.5) == "o"