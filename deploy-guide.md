MASTER BUILD & DEPLOY GUIDE
Project: SPX Market Maker Greek Exposures (GEX/DEX/VEX/CEX) + Regime Interpretation +
Heatmap UI
Hosting: GitHub (code), Render (backend), Vercel (frontend)
Data Source: Tradier API (spot + options chain)
Non-negotiables:
● Tradier token stays server-only (backend env var)
● Frontend shows heatmap + moving SPX spot line + interpretation rules
● Backend returns both exposures and interpretation metadata (regime signs, codes,
classification, flags)

1) High-level architecture (what talks to what)
Components
1. Backend API (FastAPI / Python)
○ Talks to Tradier (authenticated)
○ Pulls live SPX quote + options chain
○ Computes greeks and exposures
○ Computes interpretation metadata
○ Serves JSON endpoints to frontend
2. Frontend UI (React + TypeScript + Vite)
○ Never talks to Tradier directly
○ Calls backend endpoints on a refresh interval

○ Renders:
■ Heatmap (exposure intensity)
■ Moving horizontal spot line
■ Tooltips with regime info
■ “Conductivity” card and terrain table

3. Deploy
○ Backend deployed as a Render Web Service
○ Frontend deployed as a Vercel project

Data flow
Frontend → Backend (polling) → Tradier
Backend → Frontend (JSON)

2) Prerequisites & access (developer must confirm)
Required accounts/logins
● GitHub (repo access + push permissions)
● Render (create service + manage env vars)
● Vercel (create project + env vars)
● Tradier token (provided by you)

Required local tools
● Git
● Python 3.11+

● Node 18+
● A terminal
● (Recommended) Cursor or VS Code

Verify toolchain locally
git --version
python --version
node --version
npm --version

3) Repository creation & setup (GitHub)
3.1 Create repo
● Name: spx-mm-greeks
● Private: recommended
● Default branch: main

3.2 Clone locally
git clone https://github.com/<USER_OR_ORG>/spx-mm-greeks.git
cd spx-mm-greeks

3.3 Create monorepo structure (exact)
mkdir backend frontend
touch README.md .gitignore

3.4 Root .gitignore (must include secrets)
Put this into .gitignore:

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

4) Backend implementation (FastAPI)
4.1 Backend folder structure (exact)
Create these files inside /backend:
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

4.2 requirements.txt (minimum)

backend/requirements.txt:
● fastapi
● uvicorn[standard]
● httpx
● pydantic
● numpy
● python-dotenv
● cachetools
● pytest

4.3 Environment files
backend/.env.example (commit this):
TRADIER_TOKEN=
RISK_FREE_RATE=0.045
DIVIDEND_YIELD=0
CACHE_TTL_SECONDS=2
ALLOWED_ORIGINS=http://localhost:5173

backend/.env (DO NOT COMMIT; used locally):
TRADIER_TOKEN=<PASTE_USER_TOKEN_HERE>
RISK_FREE_RATE=0.045
DIVIDEND_YIELD=0
CACHE_TTL_SECONDS=2
ALLOWED_ORIGINS=http://localhost:5173

5) Tradier integration (backend)

5.1 Tradier requirements
● Auth header:
○ Authorization: Bearer <TRADIER_TOKEN>
● Accept header:
○ Accept: application/json

5.2 Client implementation rules
In tradier_client.py, implement:
● get_spx_quote() -> spot (float)
● get_spx_expirations() -> list[str] (YYYY-MM-DD)
● get_spx_chain(expiration: str) -> list[OptionContract]
● Defensive parsing:
○ missing open_interest? treat as 0
○ missing IV? skip or estimate (log skipped count)
○ missing greeks? compute via Black-Scholes

5.3 Caching rules (required)
Use TTL cache:
● Default TTL: CACHE_TTL_SECONDS env var
● Cache:
○ spot quote
○ expirations list

○ chain per expiration
● Prevent multiple concurrent refreshes:
○ Use an asyncio lock or “single flight” pattern so only 1 refresh happens at a time

6) Greeks and exposures (math core)
6.1 Inputs
For each option:
● S = SPX spot
● K = strike
● T = time to expiration in years
● r = risk-free rate (env RISK_FREE_RATE)
● q = dividend yield (env DIVIDEND_YIELD, default 0)
● σ = implied volatility (decimal, ex 0.20)

6.2 Must compute these greeks
● delta
● gamma
● vanna
● charm

Definition requirements:
● vanna = ∂Δ / ∂σ

● charm = ∂Δ / ∂t (per YEAR)

6.3 Exposures per option (MUST use these)
Contract multiplier = 100
MM sign convention: assume dealers/MM are short customer positioning → multiply by -OI
Per option i:
● GEX_i = -OI * gamma_i * S^2 * 100
● DEX_i = -OI * delta_i * S * 100
● VEX_i = -OI * vanna_i * S * 100
● CEX_i = -OI * charm_i * S * 100

6.4 Aggregation
Aggregate per strike:
● Sum calls + puts exposures at that strike
Also aggregate:
● Per expiry
● ALL expiries combined

7) Interpretation & regime classification (required)
7.1 Regime sign ( + / - / o )
For each greek value at a scope (strike-level and aggregate-level):
● Determine “neutral threshold”:
○ threshold = max(eps, 0.05 * median(abs(values)))

● If abs(value) < threshold → "o"
● else value > 0 → "+"
● else → "-"

Format regime code:
● "G{sign} D{sign} V{sign} C{sign}"
Example:
● "G- D- V- C+"

7.2 Core principle (GEX amplifier)
● Negative GEX = momentum amplifier in either direction
● Direction depends on DEX / VEX / CEX alignment

7.3 Aggregate conductivity label
Compute per expiry and ALL:
RALLY-CONDUCIVE
● GEX negative
● DEX negative
● VEX negative AND VIX falling
● CEX negative

SELL-OFF-CONDUCIVE
● GEX negative
● DEX positive
● VEX positive AND VIX rising

● CEX positive

Otherwise:
● MIXED/CHOP

7.4 VIX regime toggle
Backend must accept:
● vix_regime=RISING|FALLING|AUTO
If AUTO not implemented (no VIX fetch), backend should:
● treat AUTO as FALLING by default OR return a clear warning field

7.5 Strike-level mapping to classification label
Backend must compute a classification string from regime code.
Minimum support for these canonical labels:
1. "G+ D+ V+ C-"
"CEILING/MAGNET — Extreme compression + directional buying
support. Pin behavior expected."
2. "G- D- V- C+"
"ACCELERATION ZONE (DOWN) — All directional Greeks aligned
bearish. No support structure."
3. "G- D- V+ C-"
"HIGH-VELOCITY DOWN — Momentum amplified, but VEX provides
vol-spike cushion. Trapped longs above."
4. "G+ D+ V- C+"
"BOUNCE CANDIDATE — Compression + buying pressure + vol-spike
cushion. Reversal setup zone."
5. "G- D- V+ C-"
"CONDITIONAL VOID — Accelerates down, BUT vol spike triggers MM

buying (V+ override)."
6. "G+ D+ V- C+"
"STRUCTURAL SUPPORT — Strong compression + aggressive MM buying.
High-probability floor."

If duplicates exist, developer must normalize to one mapping table and document the
precedence rules.
7.6 Pattern recognition alert flag
If strike regime code equals:
● "G- D- V- C+"
then add:
● pattern_flags: ["MAX_DOWNSIDE_ACCELERATION"]

8) Backend API contract (exact endpoints + payloads)
8.1 Required endpoints
1. GET /api/health

{"status":"ok"}

2. GET /api/spot

{"timestamp":"...","spot":6921.46}

3. GET /api/expirations

{"timestamp":"...","expirations":["2026-01-08","2026-01-10",...]}

4. GET /api/config
Must return thresholds + defaults:

{
"neutral_threshold_method":"0.05 * median(abs(values))",
"cache_ttl_seconds":2,
"default_vix_regime":"FALLING"
}

5. GET
/api/exposures?expiration=ALL|YYYY-MM-DD&vix_regime=RISING|FALLIN
G|AUTO
Return:

{
"timestamp":"...",
"spot":6921.46,
"expiration":"ALL",
"aggregate":{
"gex":...,"dex":...,"vex":...,"cex":...,
"regime":{"g":"-","d":"-","v":"-","c":"-"},
"regime_code":"G- D- V- C-",
"conductivity":"RALLY-CONDUCIVE",
"notes":"..."
},
"vix_regime_used":"FALLING",
"strikes":[
{
"strike":6900,
"gex":...,"dex":...,"vex":...,"cex":...,
"regime":{"g":"-","d":"+","v":"o","c":"-"},
"regime_code":"G- D+ V o C-",
"classification":"...",
"pattern_flags":[],
"call_oi":...,"put_oi":...,
"meta":{"iv_call":...,"iv_put":...,"t_years":...,"r":...,"q":...}
}
]
}

6. GET
/api/exposures_matrix?metric=GEX|DEX|VEX|CEX&expiration=ALL&vix_r
egime=...
Return a heatmap-ready matrix:

{
"timestamp":"...",
"spot":6921.46,
"metric":"GEX",
"x_expirations":["2026-01-08","2026-01-10",...],
"y_strikes":[6700,6750,...],
"z":[[...],[...],...]
}

8.2 CORS
● Must allow:
○ http://localhost:5173
○ Vercel deployed domain(s)
● Configure via env ALLOWED_ORIGINS CSV list

9) Backend local run + test procedure
9.1 Create venv, install, run
cd backend

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

9.2 Validate endpoints locally
Open:
● http://localhost:8000/api/health
● http://localhost:8000/api/spot
● http://localhost:8000/api/expirations
● http://localhost:8000/api/exposures?expiration=ALL&vix_regime=FAL
LING

9.3 Run tests
pytest -q

10) Frontend implementation (React + Vite)
10.1 Create Vite app in /frontend
From repo root:
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npm install react-plotly.js plotly.js

10.2 Frontend environment
frontend/.env.example:

VITE_API_BASE_URL=http://localhost:8000

frontend/.env (local):
VITE_API_BASE_URL=http://localhost:8000

10.3 UI must include these features
Controls
● Expiration dropdown (ALL + each expiration)
● Metric dropdown (GEX, DEX, VEX, CEX)
● Refresh dropdown (0.5s, 1s, 2s)
● VIX regime toggle (RISING/FALLING/AUTO)

Heatmap
● Plotly heatmap:
○ x = expirations if ALL
○ y = strikes
○ z = selected metric exposure
● Color scale diverging centered at 0
● Add horizontal spot line y=spot
● Smooth update animation (Plotly react update)

Tooltips
Must show:
● strike, expiry
● gex/dex/vex/cex

● regime_code
● classification
● pattern_flags

Legend Panel
Must show:
● G/D/V/C = GEX/DEX/VEX/CEX
○ / - / o meaning
● “GEX amplifier principle” short explanation

Conductivity Card
● Shows aggregate regime signs + label (RALLY / SELL-OFF / MIXED)
● Shows explanation string
● Shows vix_regime_used

Terrain Table
● Sorted strikes within ±200 points of spot
● Also show top absolute exposures (“walls”)
● Highlight strikes with MAX_DOWNSIDE_ACCELERATION

10.4 Frontend polling logic
● Use setInterval based on refresh rate
● Cancel previous fetch on changes (AbortController)
● If expiration=ALL:
○ call /api/exposures_matrix for z

○ optionally call /api/exposures?expiration=ALL for metadata
● If single expiration:
○ call /api/exposures?expiration=<date> and render as a 1-column
heat-strip

10.5 Frontend local run
cd frontend
npm run dev

Open:
● http://localhost:5173

11) Push to GitHub
From repo root:
git add .
git commit -m "Build backend + frontend for SPX MM greek exposures"
git push origin main

12) Deploy Backend on Render (exact settings)
Render → New → Web Service → select repo.
Set:
● Language: Python 3
● Branch: main
● Root Directory: backend

● Build Command: pip install -r requirements.txt
● Start Command:

uvicorn main:app --host 0.0.0.0 --port $PORT

Env vars in Render:
● TRADIER_TOKEN = (secret)
● RISK_FREE_RATE = 0.045
● DIVIDEND_YIELD = 0
● CACHE_TTL_SECONDS = 2
● ALLOWED_ORIGINS = http://localhost:5173

Deploy.
After deploy, test:
● https://<render-url>/api/health
● https://<render-url>/api/exposures?expiration=ALL&vix_regime=FALL
ING

13) Deploy Frontend on Vercel (exact settings)
Vercel → New Project → import repo.
Set:
● Root Directory: frontend

Add env var:

● VITE_API_BASE_URL = https://<render-backend-url>

Deploy.
After deploy:
● open Vercel URL
● verify heatmap loads
● verify spot line moves
● verify tooltips show classification/regime

Then update Render CORS:
● add your Vercel URL to ALLOWED_ORIGINS env var
Example:

ALLOWED_ORIGINS=http://localhost:5173,https://yourapp.vercel.app

Redeploy Render.

14) Final verification checklist (must complete)
Security:
● Confirm Tradier token never appears in browser devtools/network
● Confirm frontend only calls backend

Functional:
● Spot updates
● Heatmap updates

● Expiration dropdown changes data
● Conductivity label changes when vix_regime toggled
● Pattern flags show badge

Performance:
● Polling stable at 1–2s
● Cache prevents Tradier rate limit issues

DEFINITIONS SHEET (market + technical
terms)
Market / options terms
SPX: S&P 500 Index options (cash-settled, European-style).
Spot price (S): Current price of the underlying index (SPX).
Options chain: List of all option contracts (calls/puts) with strikes/expirations and fields like IV,
OI, last, bid/ask.
Strike (K): The price level at which an option’s payoff is defined.
Expiration: Date/time the option contract ends.
0DTE: “Zero Days To Expiration” options expiring today (very sensitive to flows/greeks).
Call option: Gains value when underlying rises above strike.
Put option: Gains value when underlying falls below strike.
Implied volatility (IV, σ): Market-implied volatility used in option pricing (input to
Black-Scholes).
Open interest (OI): Number of outstanding option contracts (position size proxy).
Contract multiplier: SPX options are typically 100x per contract (1 option controls 100 “units”
of notional).
Market maker (MM) / Dealer: Liquidity provider that often hedges option exposures
dynamically.
Dealer positioning assumption: The simplifying assumption dealers are on the opposite side
of customers; often modeled as “MM = -OI”.
VIX: Volatility index (proxy for SPX implied volatility direction).
VIX rising/falling: Used to interpret vanna-related hedging direction.

Greeks (risk sensitivities)
Greeks: Derivatives (sensitivities) of option price (or delta) with respect to inputs.
Delta (Δ): Sensitivity of option price to a $1 move in underlying. Also directional exposure.
Gamma (Γ): Sensitivity of delta to a $1 move in underlying (delta “acceleration”).
Vanna: Sensitivity of delta to volatility changes: ∂Δ/∂σ.
Charm: Sensitivity of delta to time decay: ∂Δ/∂t (per year in this spec).
Risk-free rate (r): Interest rate used in option pricing.
Dividend yield (q): Carry/dividend yield; for SPX commonly approximated as 0 for simplicity in
short-horizon models.
Time to expiry (T): Time until expiration measured in years (e.g., 1 day ≈ 1/365).
Exposure metrics (your app outputs)
GEX (Gamma Exposure): Aggregated gamma scaled to notional terms (here: -OI * Γ * S2 *
100).
DEX (Delta Exposure): Aggregated delta scaled to notional (here: -OI * Δ * S * 100).
VEX (Vanna Exposure): Aggregated vanna scaled to notional (here: -OI * vanna * S * 100).
CEX (Charm Exposure): Aggregated charm scaled to notional (here: -OI * charm * S * 100).
Per strike: Values computed and summed for all contracts sharing the same strike price.
Per expiry: Values summed across strikes for a single expiration date.
ALL expiries: Values summed across every expiration date available.
Regime / interpretation terms
Regime sign (+/−/o): Discrete classification of a greek exposure as positive, negative, or
neutral.
Neutral band (o): A near-zero zone defined by a threshold; values smaller than this are treated
as neutral.
Regime code: Combined string of signs for G/D/V/C, e.g., “G- D+ V o C-”.
Conductivity: Aggregate label describing whether flows/hedging are more “rally-conducive” or
“sell-off-conducive.”
Rally-conducive: The configuration that implies maximum MM buying pressure given the rule
set.
Sell-off-conducive: The configuration that implies maximum MM selling pressure given the
rule set.
Mixed/Chop: No clean alignment → more range-bound/uncertain behavior.
GEX amplifier principle: Negative GEX increases trend strength; direction is determined by
other greeks.
Terrain: The strike-by-strike map of regimes/classifications (“where support/resistance/void
zones are”).
Pin / Magnet: Tendency for price to hover around a strike region due to hedging/positioning
effects.

Acceleration zone: Zone where aligned signals suggest fast directional movement.
Vol cushion: Configuration where volatility effects cause hedging that dampens sell-offs
(context-dependent).
Pattern flag: Explicit tag for high-risk/high-probability configurations (example:
MAX_DOWNSIDE_ACCELERATION).
Technical / deployment terms
Backend: Server-side application (FastAPI) that fetches Tradier data and computes outputs.
Frontend: Browser UI (React) that visualizes backend output.
API: Application Programming Interface; HTTP endpoints returning JSON.
JSON: Data format used for responses.
CORS: Cross-Origin Resource Sharing; server setting allowing frontend domain to call
backend.
Environment variables (env vars): Secure configuration values stored outside code (tokens,
URLs).
Render Web Service: Hosted backend service on Render.
Vercel Project: Hosted frontend app on Vercel.
Build command: Command Render/Vercel runs to install dependencies/compile app.
Start command: Command Render runs to start the backend server.
Polling: Frontend repeatedly requests updates on a timer.
TTL cache: “Time-to-live” cache; saves results temporarily to reduce API calls.
Rate limit: API’s max allowed request frequency; caching helps avoid hitting limits.
Monorepo: Single repository containing multiple subprojects (backend + frontend).