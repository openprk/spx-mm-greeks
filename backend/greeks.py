import numpy as np
from scipy.stats import norm
from backend.models import Greeks

def calculate_greeks(
    S: float,      # Spot price
    K: float,      # Strike price
    T: float,      # Time to expiration in years
    r: float,      # Risk-free rate
    q: float,      # Dividend yield
    sigma: float,  # Implied volatility (decimal)
    option_type: str  # "call" or "put"
) -> Greeks:

    # Handle edge cases
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return Greeks(delta=0.0, gamma=0.0, vanna=0.0, charm=0.0)

    # Calculate d1 and d2 (Black-Scholes parameters)
    d1 = (np.log(S / K) + (r - q + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)

    # Calculate N(d1), N(d2), n(d1), n(d2)
    N_d1 = norm.cdf(d1)
    N_d2 = norm.cdf(d2)
    n_d1 = norm.pdf(d1)

    # Calculate Greeks based on option type
    if option_type.lower() == "call":
        # Call option Greeks
        delta = np.exp(-q * T) * N_d1
        gamma = np.exp(-q * T) * n_d1 / (S * sigma * np.sqrt(T))

        # Vanna: dDelta/dSigma = d/dSigma[exp(-qT)N(d1)]
        vanna = np.exp(-q * T) * n_d1 * np.sqrt(T)

        # Charm: dDelta/dt = d/dt[exp(-qT)N(d1)]
        # Simplified version (per year)
        charm = -np.exp(-q * T) * n_d1 * (
            q + (r - q) * d1 / (sigma * np.sqrt(T)) - d2 * sigma / (2 * np.sqrt(T))
        )

    elif option_type.lower() == "put":
        # Put option Greeks
        delta = -np.exp(-q * T) * norm.cdf(-d1)
        gamma = np.exp(-q * T) * n_d1 / (S * sigma * np.sqrt(T))

        # Vanna for put
        vanna = -np.exp(-q * T) * n_d1 * np.sqrt(T)

        # Charm for put
        charm = -np.exp(-q * T) * n_d1 * (
            q + (r - q) * d1 / (sigma * np.sqrt(T)) - d2 * sigma / (2 * np.sqrt(T))
        )

    else:
        raise ValueError("option_type must be 'call' or 'put'")

    return Greeks(
        delta=float(delta),
        gamma=float(gamma),
        vanna=float(vanna),
        charm=float(charm)
    )

def calculate_time_to_expiration(expiration_date: str) -> float:
    try:
        exp_date = datetime.strptime(expiration_date, "%Y-%m-%d")
        now = datetime.now()
        time_diff = exp_date - now
        return max(0, time_diff.total_seconds() / (365.25 * 24 * 3600))  # Convert to years
    except ValueError:
        return 0.0

# Import here to avoid circular imports
from datetime import datetime