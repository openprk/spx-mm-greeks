from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class OptionContract(BaseModel):
    """Represents a single option contract"""
    symbol: str
    option_type: str  # "call" or "put"
    strike: float
    expiration_date: str
    bid: float = 0.0
    ask: float = 0.0
    last: float = 0.0
    volume: int = 0
    open_interest: int = 0
    implied_volatility: Optional[float] = None
    delta: Optional[float] = None
    gamma: Optional[float] = None
    theta: Optional[float] = None
    vega: Optional[float] = None
    rho: Optional[float] = None

class Greeks(BaseModel):
    """Calculated Greeks for an option"""
    delta: float
    gamma: float
    vanna: float  # dDelta/dSigma
    charm: float  # dDelta/dt (per year)

class Exposures(BaseModel):
    """Exposure calculations for a contract or aggregation"""
    gex: float  # Gamma Exposure
    dex: float  # Delta Exposure
    vex: float  # Vanna Exposure
    cex: float  # Charm Exposure

class Regime(BaseModel):
    """Regime classification for exposures"""
    g: str  # "+" or "-" or "o"
    d: str  # "+" or "-" or "o"
    v: str  # "+" or "-" or "o"
    c: str  # "+" or "-" or "o"

class StrikeData(BaseModel):
    """Data for a specific strike"""
    strike: float
    gex: float
    dex: float
    vex: float
    cex: float
    regime: Regime
    regime_code: str
    classification: str
    pattern_flags: List[str]
    call_oi: int
    put_oi: int
    meta: Dict[str, Any]

class AggregateData(BaseModel):
    """Aggregated data across strikes/expirations"""
    gex: float
    dex: float
    vex: float
    cex: float
    regime: Regime
    regime_code: str
    conductivity: str
    notes: str

class ExposuresResponse(BaseModel):
    """API response for exposures endpoint"""
    timestamp: str
    spot: float
    expiration: str
    aggregate: AggregateData
    vix_regime_used: str
    strikes: List[StrikeData]

class StrikeMatrixDetail(BaseModel):
    """Detailed information for a strike in matrix context"""
    regime_code: str
    classification: str
    pattern_flags: List[str]
    gex: float
    dex: float
    vex: float
    cex: float
    call_oi: int
    put_oi: int

class ExposuresMatrixResponse(BaseModel):
    """API response for exposures matrix endpoint"""
    timestamp: str
    spot: float
    metric: str  # "GEX", "DEX", "VEX", "CEX"
    x_expirations: List[str]
    y_strikes: List[float]
    z: List[List[float]]
    strike_details: Dict[str, StrikeMatrixDetail]  # Key: strike as string, Value: details
    vix_regime_used: str
    vix_warning: Optional[str] = None

class ConfigResponse(BaseModel):
    """API response for config endpoint"""
    neutral_threshold_method: str
    cache_ttl_seconds: int
    default_vix_regime: str

class SpotResponse(BaseModel):
    """API response for spot endpoint"""
    symbol: str
    last: float
    bid: float
    ask: float
    volume: int
    timestamp: str

class HealthResponse(BaseModel):
    """API response for health endpoint"""
    status: str = "healthy"
    timestamp: str
    version: str = "1.0.0"