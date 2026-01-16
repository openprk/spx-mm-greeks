from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import List, Optional
import asyncio
from cachetools import TTLCache

from backend.config import settings
from backend.tradier_client import TradierClient
from backend.models import (
    HealthResponse, SpotResponse, ConfigResponse,
    ExposuresResponse, ExposuresMatrixResponse, StrikeData, OptionContract,
    StrikeMatrixDetail
)
from backend.exposures import aggregate_by_strike_with_logging, aggregate_all_expirations
from backend.interpretation import (
    classify_exposure_regime, determine_conductivity,
    classify_strike_terrain, analyze_vix_regime, generate_aggregate_notes
)

# Initialize FastAPI app
app = FastAPI(
    title="SPX Market Maker Greeks API",
    description="Real-time SPX options exposures and regime analysis",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins.split(","),
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Initialize clients and caches
tradier_client = TradierClient()

# TTL caches for API responses
spot_cache = TTLCache(maxsize=1, ttl=settings.cache_ttl_seconds)
expirations_cache = TTLCache(maxsize=1, ttl=settings.cache_ttl_seconds)
chain_cache = TTLCache(maxsize=10, ttl=settings.cache_ttl_seconds)  # Cache chains by expiration

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version="1.0.0"
    )

@app.get("/api/config", response_model=ConfigResponse)
async def get_config():
    """Get current configuration values"""
    return ConfigResponse(
        neutral_threshold_method="0.05 * median(abs(values))",
        cache_ttl_seconds=settings.cache_ttl_seconds,
        default_vix_regime="FALLING"
    )

@app.get("/api/spot", response_model=SpotResponse)
async def get_spot():
    """Get current SPX spot quote"""
    cache_key = "spot"

    if cache_key in spot_cache:
        return spot_cache[cache_key]

    try:
        spot_data = await tradier_client.get_spx_quote()
        response = SpotResponse(**spot_data)
        spot_cache[cache_key] = response
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch SPX quote: {str(e)}")

@app.get("/api/expirations")
async def get_expirations():
    """Get available SPX options expiration dates"""
    cache_key = "expirations"

    if cache_key in expirations_cache:
        return {"expirations": expirations_cache[cache_key]}

    try:
        expirations = await tradier_client.get_spx_expirations()
        expirations_cache[cache_key] = expirations
        return {"expirations": expirations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch expirations: {str(e)}")

@app.get("/api/exposures", response_model=ExposuresResponse)
async def get_exposures(
    expiration: str = Query(..., description="Expiration date (YYYY-MM-DD) or 'ALL'"),
    vix_regime: str = Query("AUTO", description="VIX regime: RISING, FALLING, AUTO")
):
    """Get exposures data for specified expiration"""

    # Validate VIX regime
    if vix_regime not in ["RISING", "FALLING", "AUTO"]:
        raise HTTPException(status_code=400, detail="vix_regime must be RISING, FALLING, or AUTO")

    # Handle VIX regime - if AUTO and no VIX data available, default to FALLING
    vix_regime_used = vix_regime
    vix_warning = None

    if vix_regime == "AUTO":
        # For now, we don't fetch VIX data, so default to FALLING with warning
        vix_regime_used = "FALLING"
        vix_warning = "AUTO regime used without VIX data available - defaulting to FALLING"

    try:
        # Get spot price
        spot_response = await get_spot()
        spot_price = spot_response.last

        # Get data based on expiration
        if expiration == "ALL":
            # Get all expirations
            exp_response = await get_expirations()
            all_expirations = exp_response["expirations"]

            # Aggregate data across all expirations
            all_strike_data = {}
            for exp_date in all_expirations[:5]:  # Limit to first 5 expirations for performance
                try:
                    chain_data = await get_chain_data(exp_date, spot_price)
                    exp_strikes = aggregate_by_strike_with_logging(
                        chain_data,
                        spot_price,
                        settings.risk_free_rate,
                        settings.dividend_yield
                    )

                    # Merge with existing data
                    for strike, data in exp_strikes.items():
                        if strike not in all_strike_data:
                            all_strike_data[strike] = data.copy()
                        else:
                            # Aggregate across expirations
                            for key in ["gex", "dex", "vex", "cex"]:
                                all_strike_data[strike][key] += data[key]
                            all_strike_data[strike]["call_oi"] += data["call_oi"]
                            all_strike_data[strike]["put_oi"] += data["put_oi"]

                except Exception as e:
                    continue  # Skip failed expirations

            strike_aggregations = all_strike_data
        else:
            # Single expiration
            chain_data = await get_chain_data(expiration, spot_price)
            print(f"🔍 Chain data for {expiration}: {len(chain_data)} contracts")
            strike_aggregations = aggregate_by_strike_with_logging(
                chain_data,
                spot_price,
                settings.risk_free_rate,
                settings.dividend_yield
            )
            print(f"🔍 Strike aggregations for {expiration}: {len(strike_aggregations)} strikes")

        # Convert to StrikeData objects
        strikes_data = []
        all_exposure_values = []


        for strike, data in strike_aggregations.items():
            # Collect all exposure values for neutral threshold calculation
            all_exposure_values.extend([data["gex"], data["dex"], data["vex"], data["cex"]])

            # Classify regime
            regime, regime_code = classify_exposure_regime(
                data["gex"], data["dex"], data["vex"], data["cex"],
                all_exposure_values
            )

            # Classify terrain
            classification, pattern_flags = classify_strike_terrain(
                regime_code, spot_price, strike
            )

            strike_data = StrikeData(
                strike=strike,
                gex=data["gex"],
                dex=data["dex"],
                vex=data["vex"],
                cex=data["cex"],
                regime=regime,
                regime_code=regime_code,
                classification=classification,
                pattern_flags=pattern_flags,
                call_oi=data["call_oi"],
                put_oi=data["put_oi"],
                meta={
                    "iv_call": 0.0,  # Would be populated from contract data
                    "iv_put": 0.0,   # Would be populated from contract data
                    "t_years": 0.0,  # Would be populated from contract data
                    "r": settings.risk_free_rate,
                    "q": settings.dividend_yield
                }
            )
            strikes_data.append(strike_data)

        # Calculate aggregate data from strike_aggregations
        if len(strikes_data) > 0:
            aggregate_exposures = aggregate_all_expirations(strike_aggregations)
            agg_regime, agg_regime_code = classify_exposure_regime(
                aggregate_exposures["gex"], aggregate_exposures["dex"],
                aggregate_exposures["vex"], aggregate_exposures["cex"],
                all_exposure_values
            )

            conductivity, notes = determine_conductivity(agg_regime, vix_regime_used)

            aggregate_data = {
                "gex": aggregate_exposures["gex"],
                "dex": aggregate_exposures["dex"],
                "vex": aggregate_exposures["vex"],
                "cex": aggregate_exposures["cex"],
                "regime": agg_regime,
                "regime_code": agg_regime_code,
                "conductivity": conductivity,
                "notes": notes
            }
        else:
            # No real market data available
            raise HTTPException(
                status_code=503,
                detail="No options market data available. Unable to calculate Greek exposures."
            )

        response = {
            "timestamp": datetime.now().isoformat(),
            "spot": spot_price,
            "expiration": expiration,
            "aggregate": aggregate_data,
            "vix_regime_used": vix_regime_used,
            "strikes": strikes_data
        }

        if vix_warning:
            response["vix_warning"] = vix_warning

        return response

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"EXPOSURES ERROR: {str(e)}")
        print(f"TRACEBACK: {error_details}")
        raise HTTPException(status_code=500, detail=f"Failed to calculate exposures: {str(e)}")

@app.get("/api/exposures_matrix", response_model=ExposuresMatrixResponse)
async def get_exposures_matrix(
    metric: str = Query(..., description="Metric: GEX, DEX, VEX, CEX"),
    expiration: str = Query("ALL", description="Expiration date or 'ALL'"),
    vix_regime: str = Query("AUTO", description="VIX regime: RISING, FALLING, AUTO")
):
    """Get exposures matrix for heatmap visualization across multiple expirations"""

    if metric not in ["GEX", "DEX", "VEX", "CEX"]:
        raise HTTPException(status_code=400, detail="metric must be GEX, DEX, VEX, or CEX")

    if expiration != "ALL":
        raise HTTPException(status_code=400, detail="Matrix endpoint only supports expiration=ALL")

    # Validate VIX regime
    if vix_regime not in ["RISING", "FALLING", "AUTO"]:
        raise HTTPException(status_code=400, detail="vix_regime must be RISING, FALLING, or AUTO")

    # Handle VIX regime - if AUTO and no VIX data available, default to FALLING
    vix_regime_used = vix_regime
    vix_warning = None

    if vix_regime == "AUTO":
        # For now, we don't fetch VIX data, so default to FALLING with warning
        vix_regime_used = "FALLING"
        vix_warning = "AUTO regime used without VIX data available - defaulting to FALLING"

    try:
        # Get spot price
        spot_response = await get_spot()
        spot_price = spot_response.last

        # Get all available expirations
        exp_response = await get_expirations()
        all_expirations = exp_response["expirations"][:8]  # Limit to 8 expirations for performance

        print(f"📊 Building enhanced matrix for {len(all_expirations)} expirations with metric {metric}")

        # Collect data for each expiration
        expiration_data = {}
        all_strikes = set()
        strike_details_map = {}  # Collect detailed strike information

        for exp in all_expirations:
            try:
                # Get exposure data for this specific expiration
                exp_data = await get_exposures(exp, vix_regime)

                # Store strike -> exposure mapping for this expiration
                strike_exposures = {}
                for strike_data in exp_data["strikes"]:
                    strike = strike_data.strike
                    exposure_value = getattr(strike_data, metric.lower())
                    strike_exposures[strike] = exposure_value
                    all_strikes.add(strike)

                    # Collect detailed strike information (from first expiration that has this strike)
                    if str(strike) not in strike_details_map:
                        strike_details_map[str(strike)] = StrikeMatrixDetail(
                            regime_code=strike_data.regime_code,
                            classification=strike_data.classification,
                            pattern_flags=strike_data.pattern_flags,
                            gex=strike_data.gex,
                            dex=strike_data.dex,
                            vex=strike_data.vex,
                            cex=strike_data.cex,
                            call_oi=strike_data.call_oi,
                            put_oi=strike_data.put_oi
                        )

                expiration_data[exp] = strike_exposures
                print(f"✅ Loaded {len(strike_exposures)} strikes for {exp}")

            except Exception as e:
                print(f"⚠️ Failed to get data for {exp}: {e}")
                # Continue with other expirations

        # Create common strike set (sorted)
        common_strikes = sorted(list(all_strikes))[:25]  # Limit strikes for performance
        print(f"🎯 Using {len(common_strikes)} common strikes across {len(expiration_data)} expirations")

        # Build matrix: rows = expirations, columns = strikes
        matrix_data = []
        for exp in all_expirations:
            if exp in expiration_data:
                row = []
                for strike in common_strikes:
                    # Get exposure value for this expiration + strike combination
                    value = expiration_data[exp].get(strike, 0.0)
                    row.append(value)
                matrix_data.append(row)
            else:
                # Fill with zeros if no data for this expiration
                matrix_data.append([0.0] * len(common_strikes))

        print(f"📈 Generated {len(matrix_data)}×{len(common_strikes)} matrix with detailed strike info")

        return ExposuresMatrixResponse(
            timestamp=datetime.now().isoformat(),
            spot=spot_price,
            metric=metric,
            x_expirations=all_expirations,
            y_strikes=common_strikes,
            z=matrix_data,
            strike_details=strike_details_map,
            vix_regime_used=vix_regime_used,
            vix_warning=vix_warning
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate matrix: {str(e)}")

async def get_chain_data(expiration: str, spot_price: float = None) -> List:
    """Helper function to get cached chain data"""
    cache_key = f"chain_{expiration}"

    if cache_key in chain_cache:
        return chain_cache[cache_key]

    try:
        chain_data = await tradier_client.get_spx_chain(expiration)
        options = chain_data.get("options", [])

        # Filter options to strikes within 30% of spot price for performance
        if spot_price is not None:
            original_count = len(options)
            options = [
                opt for opt in options
                if spot_price * 0.7 <= float(opt.get("strike", 0)) <= spot_price * 1.3
            ]
            print(f"📊 Filtered {original_count} options to {len(options)} relevant strikes (±30% of spot: {spot_price * 0.7:.0f}-{spot_price * 1.3:.0f})")

            # Debug: show first available option
            if options:
                print(f"🔍 Sample option: {options[0]}")

        # Convert to OptionContract objects
        contracts = []
        for opt in options:
            try:
                # Extract Greeks from nested structure
                greeks = opt.get("greeks", {})
                contract = OptionContract(
                    symbol=opt.get("symbol", ""),
                    option_type=opt.get("option_type", "call" if "C" in opt.get("symbol", "") else "put"),
                    strike=float(opt.get("strike", 0)),
                    expiration_date=expiration,
                    bid=float(opt.get("bid", 0) or 0),
                    ask=float(opt.get("ask", 0) or 0),
                    last=float(opt.get("last", 0) or 0),
                    volume=int(opt.get("volume", 0) or 0),
                    open_interest=int(opt.get("open_interest", 0) or 0),
                    implied_volatility=greeks.get("mid_iv") or greeks.get("smv_vol"),
                    delta=greeks.get("delta"),
                    gamma=greeks.get("gamma"),
                    theta=greeks.get("theta"),
                    vega=greeks.get("vega")
                )
                contracts.append(contract)
            except Exception as e:
                print(f"❌ Failed to create contract for {opt.get('symbol', 'unknown')}: {e}")
                continue

        print(f"📦 Created {len(contracts)} OptionContract objects from {len(options)} options")

        chain_cache[cache_key] = contracts
        return contracts

    except Exception as e:
        return []  # Return empty list on error

@app.get("/api/debug")
async def debug_info():
    """Debug endpoint to check configuration"""
    return {
        "token_loaded": settings.tradier_token[:10] + "..." if settings.tradier_token != "placeholder_token" else "placeholder_token",
        "token_length": len(settings.tradier_token),
        "is_placeholder": settings.tradier_token == "placeholder_token"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)