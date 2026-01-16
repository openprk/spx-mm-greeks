// API Response Types based on backend specification

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
}

export interface SpotResponse {
  symbol: string;
  last: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: string;
}

export interface ExpirationsResponse {
  timestamp: string;
  expirations: string[];
}

export interface ConfigResponse {
  neutral_threshold_method: string;
  cache_ttl_seconds: number;
  default_vix_regime: string;
}

export interface Regime {
  g: string; // "+" | "-" | "o"
  d: string; // "+" | "-" | "o"
  v: string; // "+" | "-" | "o"
  c: string; // "+" | "-" | "o"
}

export interface AggregateData {
  gex: number;
  dex: number;
  vex: number;
  cex: number;
  regime: Regime;
  regime_code: string;
  conductivity: string;
  notes: string;
}

export interface StrikeData {
  strike: number;
  gex: number;
  dex: number;
  vex: number;
  cex: number;
  regime: Regime;
  regime_code: string;
  classification: string;
  pattern_flags: string[];
  call_oi: number;
  put_oi: number;
  meta: {
    iv_call?: number;
    iv_put?: number;
    t_years?: number;
    r?: number;
    q?: number;
  };
}

export interface ExposuresResponse {
  timestamp: string;
  spot: number;
  expiration: string;
  aggregate: AggregateData;
  vix_regime_used: string;
  strikes: StrikeData[];
}

export interface StrikeMatrixDetail {
  regime_code: string;
  classification: string;
  pattern_flags: string[];
  gex: number;
  dex: number;
  vex: number;
  cex: number;
  call_oi: number;
  put_oi: number;
}

export interface ExposuresMatrixResponse {
  timestamp: string;
  spot: number;
  metric: string;
  x_expirations: string[];
  y_strikes: number[];
  z: number[][];
  strike_details: Record<string, StrikeMatrixDetail>;
  vix_regime_used: string;
  vix_warning?: string;
}

// Frontend-specific types
export interface ApiError {
  message: string;
  status?: number;
}

export type MetricType = 'GEX' | 'DEX' | 'VEX' | 'CEX';
export type VixRegimeType = 'RISING' | 'FALLING' | 'AUTO';