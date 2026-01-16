SPX Market Maker Greek Exposures
Build and Deploy Guide (GitHub +

Render + Vercel)
Step-by-step implementation blueprint • Generated 2026-01-09

What you are building (non-negotiables)
A full-stack SPX “Market Maker Greek Exposures” application that pulls live SPX spot and
the SPX options chain from Tradier, computes GEX/DEX/VEX/CEX exposures and
interpretation metadata, serves results via a backend API, and visualizes them in a
frontend heatmap with a moving SPX spot line and regime labels. Tradier secrets must
remain backend-only.
• Backend: FastAPI (Python 3.11+) deployed on Render.
• Frontend: React + TypeScript + Vite deployed on Vercel.
• Data source: Tradier API (spot quote + options chain).
• Outputs: per-strike and aggregated exposures (GEX/DEX/VEX/CEX) plus regime signs
(+/-/o), regime codes (G/D/V/C), classification labels, and pattern flags.
• Security: Tradier token stored only as backend environment variable; never exposed to
frontend.
Architecture overview
• Frontend (browser) polls Backend API on a user-selected interval.
• Backend calls Tradier using a bearer token stored on Render.
• Backend computes greeks and exposures, aggregates by strike/expiry, then computes
interpretation fields.
• Frontend visualizes heatmap + spot line, plus regime legend and terrain table.

Page 2

1) Prerequisites and access
Developer must have:
• GitHub access (push rights) to the repo.
• Render access (create services, set environment variables).
• Vercel access (create project, set environment variables).
• Tradier API access token from the owner.
• Local tools: Git, Python 3.11+, Node 18+.
Verify local toolchain:
git --version
python --version
node --version
npm --version

2) GitHub repository and monorepo setup
Repo name (recommended):
spx-mm-greeks
Clone it locally:
git clone https://github.com/<USER_OR_ORG>/spx-mm-greeks.git
cd spx-mm-greeks
Create the monorepo structure:
mkdir backend frontend
touch README.md .gitignore
Root .gitignore must include:
# env files
.env
**/.env
# python
__pycache__/
*.pyc
.venv/
venv/
.pytest_cache/
# node
node_modules/
dist/

3) Backend (FastAPI) - implementation details
Required backend folder structure:

Page 3

backend/
main.py
config.py
models.py
tradier_client.py
greeks.py
exposures.py
interpretation.py
requirements.txt
.env.example
tests/
test_greeks.py
test_exposures.py
requirements.txt (minimum)
fastapi
uvicorn[standard]
httpx
pydantic
numpy
python-dotenv
cachetools
pytest
Environment variables
Commit this file:
backend/.env.example
TRADIER_TOKEN=
RISK_FREE_RATE=0.045
DIVIDEND_YIELD=0
CACHE_TTL_SECONDS=2
ALLOWED_ORIGINS=http://localhost:5173
Create this locally (do NOT commit):
backend/.env
TRADIER_TOKEN=<PASTE_USER_TOKEN_HERE>
RISK_FREE_RATE=0.045
DIVIDEND_YIELD=0
CACHE_TTL_SECONDS=2
ALLOWED_ORIGINS=http://localhost:5173
Tradier integration requirements
• All Tradier requests must include headers: Authorization: Bearer and Accept:
application/json.
• Implement client functions: get_spx_quote(), get_spx_expirations(),
get_spx_chain(expiration).
• Defensive parsing: missing open_interest -> 0; missing IV -> skip or estimate (log
skipped count).
• If Tradier does not provide greeks, compute using Black-Scholes.

Page 4

Caching and rate-limit friendliness
• Implement TTL caching for spot quote, expirations list, and chains by expiration (default
1-3 seconds).
• Prevent concurrent recomputations with a lock/single-flight pattern.
• Frontend should be able to poll frequently without hammering Tradier because backend
serves cached results within TTL.

Page 5
4) Greeks and exposure calculations (math core)
Inputs per option contract:
• S = SPX spot price
• K = strike
• T = time to expiration in years
• r = risk-free rate (env RISK_FREE_RATE)
• q = dividend yield (env DIVIDEND_YIELD, default 0)
• sigma = implied volatility as a decimal (e.g., 0.20)
Greeks required:
• delta
• gamma
• vanna = dDelta/dSigma
• charm = dDelta/dt (per year)
Exposure definitions (must use exactly these scalings):
• Contract multiplier = 100.
• Dealer/MM sign convention: MM exposure = -OI * (greek scaling).
• GEX_i = -OI * gamma_i * S^2 * 100
• DEX_i = -OI * delta_i * S * 100
• VEX_i = -OI * vanna_i * S * 100
• CEX_i = -OI * charm_i * S * 100
Aggregation rules:
• Aggregate by strike: sum calls and puts at each strike.
• Aggregate by expiry: sum across strikes for a given expiration date.
• Aggregate ALL: sum across all expirations.
5) Interpretation and regime classification
(required)
Legend and regime symbols
• Shorthand: G/D/V/C = GEX/DEX/VEX/CEX.
• Each greek gets a regime sign at strike-level and aggregate-level: '+' positive, '-'
negative, 'o' neutral.
• Regime code format: 'G{+|-|o} D{+|-|o} V{+|-|o} C{+|-|o}'.
Neutral threshold rule

Page 6

• neutral_threshold = max(epsilon, 0.05 * median(abs(values))).
• If abs(value) < neutral_threshold -> 'o'. Otherwise '+' if value > 0 else '-'.
• Expose defaults via GET /api/config.
Core principle (GEX amplifier)
• Negative GEX amplifies momentum in either direction.
• GEX describes amplifier magnitude; DEX/VEX/CEX help determine direction and drift.
• Aggregate analysis: DEX primary direction, VEX conditional on VIX direction, CEX
time-decay drift.
• Unanimous alignment across DEX+VEX+CEX => maximum pressure; mixed signals =>
chop/range.
RALLY-CONDUCIVE vs SELL-OFF-CONDUCIVE (aggregate)
• RALLY-CONDUCIVE ideal: GEX -, DEX -, VEX - with VIX falling, CEX -.
• SELL-OFF-CONDUCIVE ideal: GEX -, DEX +, VEX + with VIX rising, CEX +.
• Nuance: Negative VEX can cushion sell-offs when VIX is rising (delta drops -> MMs buy).
• UI must provide VIX regime toggle: RISING, FALLING, AUTO.
Strike-level terrain mapping
• "G+ D+ V+ C-" => "CEILING/MAGNET — Extreme compression + directional buying
support. Pin behavior expected."
• "G- D- V- C+" => "ACCELERATION ZONE (DOWN) — All directional Greeks aligned
bearish. No support structure."
• "G- D- V+ C-" => "HIGH-VELOCITY DOWN — Momentum amplified, but VEX provides
vol-spike cushion. Trapped longs above."
• "G+ D+ V- C+" => "BOUNCE CANDIDATE — Compression + buying pressure +
vol-spike cushion. Reversal setup zone."
• "G- D- V+ C-" => "CONDITIONAL VOID — Accelerates down, BUT vol spike triggers MM
buying (V+ override)."
• "G+ D+ V- C+" => "STRUCTURAL SUPPORT — Strong compression + aggressive MM
buying. High-probability floor."
If duplicates exist, normalize to one canonical mapping table and document precedence. If
ambiguous, implement deterministic rule engine using GEX/DEX/VEX/CEX meanings and
VIX regime.
Pattern recognition alert flag
• If regime code is exactly "G- D- V- C+", set pattern_flags =
["MAX_DOWNSIDE_ACCELERATION"] and highlight in UI.

Page 7
6) Backend API contract (endpoints and payloads)
• GET /api/health
• GET /api/spot
• GET /api/expirations
• GET /api/config
• GET /api/exposures?expiration=ALL|YYYY-MM-DD&vix;_regime=RISING|FALLING|AUTO
• GET
/api/exposures_matrix?metric=GEX|DEX|VEX|CEX&expiration;=ALL&vix;_regime=...
Exposures endpoint schema example:
{
"timestamp": "...",
"spot": 6921.46,
"expiration": "ALL",
"aggregate": {
"gex": ..., "dex": ..., "vex": ..., "cex": ...,
"regime": {"g":"-","d":"-","v":"-","c":"-"},
"regime_code": "G- D- V- C-",
"conductivity": "RALLY-CONDUCIVE",
"notes": "Short explanation"
},
"vix_regime_used": "FALLING",
"strikes": [
{
"strike": 6900,
"gex": ..., "dex": ..., "vex": ..., "cex": ...,
"regime": {"g":"-","d":"+","v":"o","c":"-"},
"regime_code": "G- D+ V o C-",
"classification": "...",
"pattern_flags": [],
"call_oi": ..., "put_oi": ...,
"meta": {"iv_call":...,"iv_put":...,"t_years":...,"r":...,"q":...}
}
]
}
Matrix endpoint schema example:
{
"timestamp": "...",
"spot": 6921.46,
"metric": "GEX",
"x_expirations": ["2026-01-08", "2026-01-10"],
"y_strikes": [6700, 6750, 6800],
"z": [[...],[...],[...]]
}

Page 8
7) Frontend (React + Vite + Plotly) - implementation
details
Environment
frontend/.env.example
VITE_API_BASE_URL=http://localhost:8000
Frontend must include:
• Controls: expiration (ALL + dates), metric (GEX/DEX/VEX/CEX), refresh, VIX regime
toggle.
• Heatmap: Plotly heatmap with diverging scale centered at 0.
• Overlay: moving spot line at y=spot with label.
• Tooltips include strike, expiry, gex/dex/vex/cex, regime_code, classification,
pattern_flags.
• Legend panel explaining G/D/V/C and +/-/o, plus GEX amplifier principle.
• Conductivity card showing aggregate regime and label.
• Terrain table showing nearby strikes and top walls, highlighting flags.
Polling behavior:
• If expiration=ALL: fetch /api/exposures_matrix for heatmap values; optionally fetch
/api/exposures for metadata panels.
• If single expiration: fetch /api/exposures and render as heat-strip.
• Use AbortController to cancel in-flight fetch when user changes controls.

Page 9

8) Local run, commit, and push
Backend local run:
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
Frontend local run:
cd frontend
npm install
npm run dev
Commit and push:
git add .
git commit -m "Build SPX MM greeks app"
git push origin main

9) Deploy backend on Render (exact settings)
• Service type: Web Service (Python)
• Branch: main
• Root Directory: backend
• Build Command: pip install -r requirements.txt
• Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
Render environment variables:
• TRADIER_TOKEN (required secret)
• RISK_FREE_RATE=0.045 (optional)
• DIVIDEND_YIELD=0 (optional)
• CACHE_TTL_SECONDS=2
• ALLOWED_ORIGINS=http://localhost:5173 (later add Vercel domain)
Render validation URLs:
• https:///api/health
• https:///api/exposures?expiration=ALL&vix;_regime=FALLING
10) Deploy frontend on Vercel (exact settings)
• Project: Import GitHub repo
• Root Directory: frontend
• Environment variable: VITE_API_BASE_URL=https://

Page 10
After Vercel deploy: update Render ALLOWED_ORIGINS to include the Vercel domain and
redeploy.
11) Common issues and fixes
• Render cannot find requirements.txt: Root Directory must be backend.
• Render 500 errors: ensure app = FastAPI() exists in backend/main.py and Start
Command uses uvicorn main:app.
• CORS errors in browser: include Vercel domain in ALLOWED_ORIGINS and redeploy
backend.
• Empty heatmap: handle missing IV/greeks/OI in chain; compute missing greeks; skip
invalid contracts safely.
• Rate limits: increase cache TTL and reduce polling rate.
Definitions sheet (market + technical terms)
SPX: The S&P; 500 Index options market (cash-settled, commonly treated as
European-style).
Spot price (S): Current price of the underlying index used in option pricing and scaling
exposures.
Options chain: The list of option contracts (calls and puts) across strikes and expirations
with fields like IV, open interest, bid/ask, etc.
Strike (K): The price level that defines an option contract’s payoff.
Expiration: The date/time when an option contract expires.
0DTE: “Zero Days To Expiration” options expiring today; greeks and hedging flows can
change rapidly.
Call option: Option that benefits from underlying price rising (relative to strike).
Put option: Option that benefits from underlying price falling (relative to strike).
Implied volatility (IV, sigma): The volatility input implied by market prices; used in
Black-Scholes.
Open interest (OI): Number of outstanding contracts; used here as a proxy for position
size.
Contract multiplier: Scaling factor per option contract (commonly 100).
Market maker (MM) / Dealer: Liquidity provider that may hedge option exposures in the
underlying.
Dealer sign convention (MM = -OI): Simplifying assumption that dealer exposure is the
opposite side of customer OI; used to estimate hedging pressures.
Greeks: Sensitivities of option value (or delta) to changes in underlying price, volatility,
and time.

Page 11
Delta (Delta): Sensitivity of option price to a $1 move in the underlying; directional
exposure.
Gamma (Gamma): Sensitivity of delta to a $1 move in underlying; delta’s rate of change.
Vanna: Sensitivity of delta to volatility changes (dDelta/dSigma).
Charm: Sensitivity of delta to time decay (dDelta/dt); here measured per year.
Risk-free rate (r): Interest rate used in option pricing.
Dividend yield (q): Carry/dividend yield used in option pricing; often approximated as 0 in
short-horizon models.
Time to expiration (T): Time remaining until expiration measured in years.
GEX (Gamma Exposure): Aggregated gamma-based exposure scaled to notional terms
(here: -OI * gamma * S^2 * 100).
DEX (Delta Exposure): Aggregated delta-based exposure scaled to notional terms (here:
-OI * delta * S * 100).
VEX (Vanna Exposure): Aggregated vanna-based exposure scaled to notional terms (here:
-OI * vanna * S * 100).
CEX (Charm Exposure): Aggregated charm-based exposure scaled to notional terms (here:
-OI * charm * S * 100).
Aggregation: Summing exposures across contracts to get per-strike, per-expiry, or
all-expiry totals.
Regime sign (+/-/o): Discrete classification of a value as positive, negative, or neutral
(near zero).
Neutral threshold / neutral band: A rule-defined near-zero region where values are treated
as neutral.
Regime code: Combined string of regime signs for G/D/V/C, e.g., “G- D+ V o C-”.
Conductivity: Aggregate label describing whether conditions are rally-conducive,
sell-off-conducive, or mixed.
Rally-conducive: A rule-defined configuration implying maximum buying pressure /
supportive hedging behavior.
Sell-off-conducive: A rule-defined configuration implying maximum selling pressure /
bearish hedging behavior.
Mixed/Chop: No clean alignment across greeks; tends toward range/uncertainty in this
framework.
GEX amplifier principle: Negative GEX amplifies momentum in either direction; other
greeks help determine direction and structure.
Terrain: Strike-by-strike map of exposures and regime classifications used to interpret
support/resistance/void zones.
Heatmap: Color-encoded grid visualization where intensity represents exposure
magnitude.

Page 12

Spot line: Overlay line on the heatmap representing current SPX spot level.
Tooltip: Hover UI element showing detailed values and metadata for a heatmap cell/strike.
CORS: Server configuration that allows a frontend domain (origin) to call the backend API
in a browser.
Environment variables: Secret or configurable values stored outside code (e.g.,
TRADIER_TOKEN, API base URL).
Polling: Frontend repeatedly requests updated data on a timer.
TTL cache: Time-to-live cache that stores results for a short period to reduce API calls.
Rate limit: API restriction on request frequency; caching helps avoid hitting limits.
Render Web Service: Hosted backend service on Render that runs the FastAPI app.
Vercel Project: Hosted frontend app on Vercel (static + serverless build pipeline).
Build command: Command run by the host to install dependencies and build artifacts.
Start command: Command run by the host to start the backend server.
Monorepo: Single repository containing multiple subprojects (backend and frontend).