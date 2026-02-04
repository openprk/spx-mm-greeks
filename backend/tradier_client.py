import httpx
from backend.config import settings

class TradierClient:
    def __init__(self):
        self.base_url = "https://api.tradier.com/v1"
        self.headers = {
            "Authorization": f"Bearer {settings.tradier_token}",
            "Accept": "application/json"
        }

    async def get_spx_quote(self) -> dict:
        """Get current SPX spot quote"""
        url = f"{self.base_url}/markets/quotes"
        params = {"symbols": "SPX"}

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            data = response.json()

            if "quotes" in data and "quote" in data["quotes"]:
                quote = data["quotes"]["quote"]
                return {
                    "symbol": quote["symbol"],
                    "last": quote["last"],
                    "bid": quote.get("bid") or 0,  # Handle None values
                    "ask": quote.get("ask") or 0,  # Handle None values
                    "volume": quote.get("volume") or 0,
                    "timestamp": str(quote.get("trade_date") or ""),  # Ensure string
                    "trade_date": quote.get("trade_date") or 0  # Raw trade_date for data integrity checks
                }
            else:
                raise ValueError("Invalid SPX quote response from Tradier")

    async def get_spxw_quote(self) -> dict:
        """Get current SPXW spot quote (weekly options index)"""
        url = f"{self.base_url}/markets/quotes"
        params = {"symbols": "SPXW"}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self.headers, params=params)
                response.raise_for_status()
                data = response.json()

                if "quotes" in data and "quote" in data["quotes"]:
                    quote = data["quotes"]["quote"]
                    return {
                        "symbol": quote["symbol"],
                        "last": quote["last"],
                        "bid": quote.get("bid") or 0,
                        "ask": quote.get("ask") or 0,
                        "volume": quote.get("volume") or 0,
                        "timestamp": str(quote.get("trade_date") or ""),
                        "trade_date": quote.get("trade_date") or 0,  # Raw trade_date for data integrity checks
                    }
                else:
                    # Fallback to SPX quote if SPXW not available
                    print("🔥 SPXW quote not available, falling back to SPX")
                    return await self.get_spx_quote()
        except Exception as e:
            print(f"🔥 SPXW quote API error: {e}, falling back to SPX")
            return await self.get_spx_quote()

    async def get_spx_expirations(self) -> list:
        """Get available SPX options expiration dates"""
        url = f"{self.base_url}/markets/options/expirations"
        params = {"symbol": "SPX", "includeAllRoots": "true", "strikes": "false"}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self.headers, params=params)
                response.raise_for_status()
                data = response.json()

                if "expirations" in data and "date" in data["expirations"]:
                    dates = data["expirations"]["date"]
                    if dates is None:
                        print(f"📅 Tradier returned null dates")
                        raise Exception("No expiration data available")
                    # Ensure we return a list of strings
                    if isinstance(dates, list):
                        print(f"📅 Tradier returned {len(dates)} expiration dates")
                        return dates
                    else:
                        print(f"📅 Tradier returned 1 expiration date")
                        return [dates]
                else:
                    print(f"📅 Tradier returned no expirations")
                    raise Exception("No expiration data available")
        except Exception as e:
            print(f"📅 API error getting expirations: {e}")
            raise Exception(f"Tradier API unavailable: {e}")

    async def get_spxw_expirations(self) -> list:
        """Get available SPXW options expiration dates (weekly options)"""
        url = f"{self.base_url}/markets/options/expirations"
        params = {"symbol": "SPXW", "includeAllRoots": "true", "strikes": "false"}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self.headers, params=params)
                response.raise_for_status()
                data = response.json()

                if "expirations" in data and "date" in data["expirations"]:
                    dates = data["expirations"]["date"]
                    if dates is None:
                        print(f"📅 SPXW: Tradier returned null dates")
                        # Fallback to SPX expirations if SPXW fails
                        print(f"📅 Falling back to SPX expirations for SPXW request")
                        return await self.get_spx_expirations()
                    # Ensure we return a list of strings
                    if isinstance(dates, list):
                        print(f"📅 SPXW: Tradier returned {len(dates)} expiration dates")
                        return dates
                    else:
                        print(f"📅 SPXW: Tradier returned 1 expiration date")
                        return [dates]
                else:
                    print(f"📅 SPXW: Tradier returned no expirations")
                    # Fallback to SPX expirations if SPXW fails
                    print(f"📅 Falling back to SPX expirations for SPXW request")
                    return await self.get_spx_expirations()
        except Exception as e:
            print(f"📅 SPXW API error getting expirations: {e}")
            # Fallback to SPX expirations
            print(f"📅 Falling back to SPX expirations due to SPXW API error")
            return await self.get_spx_expirations()

    async def get_spx_chain(self, expiration: str) -> dict:
        """Get SPX options chain for specific expiration date"""
        url = f"{self.base_url}/markets/options/chains"
        params = {
            "symbol": "SPX",
            "expiration": expiration,
            "greeks": "true"  # Request greeks data
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self.headers, params=params)
                response.raise_for_status()
                data = response.json()

                # Debug logging
                if "options" in data and "option" in data["options"]:
                    options = data["options"]["option"]
                    if options is None:
                        print(f"🔍 Tradier returned null options for {expiration}")
                        raise Exception("No options data available")
                    if isinstance(options, list):
                        if len(options) > 0:
                            print(f"🔍 Tradier returned {len(options)} options for {expiration}")
                            return {"options": options}
                        else:
                            print(f"🔍 Tradier returned empty options list for {expiration}")
                            raise Exception("No options data available")
                    else:
                        print(f"🔍 Tradier returned 1 option for {expiration}")
                        return {"options": [options]}
                else:
                    print(f"🔍 Tradier returned no options for {expiration}")
                    raise Exception("No options data available")
        except Exception as e:
            print(f"🔍 API error for {expiration}: {e}")
            raise Exception(f"Tradier API unavailable: {e}")

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self.headers, params=params)
                response.raise_for_status()
                data = response.json()

                # Debug logging
                if "options" in data and "option" in data["options"]:
                    options = data["options"]["option"]
                    if isinstance(options, list):
                        if len(options) > 0:
                            print(f"🔍 Tradier returned {len(options)} options for {expiration}")
                            return {"options": options}
                        else:
                            print(f"🔍 Tradier returned empty options list for {expiration}")
                            raise Exception("No options data available")
                    else:
                        print(f"🔍 Tradier returned 1 option for {expiration}")
                        return {"options": [options]}
                else:
                    print(f"🔍 Tradier returned no options for {expiration}")
                    raise Exception("No options data available")
        except Exception as e:
            print(f"🔍 API error for {expiration}: {e}")
            raise Exception(f"Tradier API unavailable: {e}")


    async def get_market_clock(self) -> dict:
        """Get current market clock status"""
        url = f"{self.base_url}/markets/clock"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=self.headers)
            response.raise_for_status()
            data = response.json()

            return data

    async def get_market_calendar(self, month: int, year: int) -> dict:
        """Get market calendar for specific month/year"""
        url = f"{self.base_url}/markets/calendar"
        params = {"month": month, "year": year}

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()

            try:
                data = response.json()
            except Exception as e:
                raise ValueError(f"Failed to parse JSON response: {e}")

            # Validate response structure - Tradier sometimes returns error strings
            if not isinstance(data, dict):
                raise ValueError(f"Invalid API response: expected dict, got {type(data).__name__}: {data}")

            if "calendar" not in data:
                raise ValueError(f"Invalid API response structure - missing 'calendar' key: {data}")

            if "days" not in data["calendar"]:
                raise ValueError(f"Invalid API response structure - missing 'days' in calendar: {data}")

            return data

    async def get_spxw_chain(self, expiration: str) -> dict:
        """Get SPXW options chain for specific expiration date (weekly options)"""
        url = f"{self.base_url}/markets/options/chains"
        params = {
            "symbol": "SPXW",  # Use SPXW symbol for weekly options
            "expiration": expiration,
            "greeks": "true"  # Request greeks data
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self.headers, params=params)
                response.raise_for_status()
                data = response.json()

                # Debug logging
                if "options" in data and "option" in data["options"]:
                    options = data["options"]["option"]
                    if options is None:
                        print(f"🔥 SPXW: Tradier returned null options for {expiration}")
                        raise Exception("No options data available")
                    if isinstance(options, list):
                        if len(options) > 0:
                            print(f"🔥 SPXW: Tradier returned {len(options)} options for {expiration}")
                            return {"options": options}
                        else:
                            print(f"🔥 SPXW: Tradier returned empty options list for {expiration}")
                            return {"options": []}
                    else:
                        # Single option returned
                        print(f"🔥 SPXW: Tradier returned 1 option for {expiration}")
                        return {"options": [options]}
                else:
                    print(f"🔥 SPXW: Unexpected response structure for {expiration}")
                    print(f"🔥 Response keys: {list(data.keys()) if isinstance(data, dict) else 'non-dict'}")
                    return {"options": []}

        except Exception as e:
            print(f"🔥 SPXW API error for {expiration}: {e}")
            # Fallback: try SPX data if SPXW fails (for development/testing)
            print(f"🔥 Falling back to SPX data for SPXW request on {expiration}")
            return await self.get_spx_chain(expiration)

    def _get_mock_spxw_data(self, expiration: str) -> dict:
        """Generate mock SPXW options data for development/testing"""
        import random
        from datetime import datetime

        # Create mock strikes around SPX 6900
        base_strikes = [6850, 6900, 6925, 6950, 6975, 7000, 7025, 7050]
        mock_options = []

        for strike in base_strikes:
            # Create call and put for each strike
            for option_type in ["call", "put"]:
                mock_options.append({
                    "symbol": f"SPXW{expiration.replace('-', '')[:6]}{option_type[0].upper()}{strike:08d}",
                    "description": f"SPXW {expiration} ${strike} {option_type.capitalize()}",
                    "exch": "C",
                    "type": "option",
                    "last": round(random.uniform(0.5, 50), 2) if random.random() > 0.3 else None,
                    "change": round(random.uniform(-5, 5), 2) if random.random() > 0.5 else None,
                    "volume": random.randint(0, 1000),
                    "open": round(random.uniform(strike * 0.01, strike * 0.05), 2) if random.random() > 0.7 else None,
                    "high": round(random.uniform(strike * 0.01, strike * 0.06), 2) if random.random() > 0.6 else None,
                    "low": round(random.uniform(strike * 0.005, strike * 0.04), 2) if random.random() > 0.6 else None,
                    "close": round(random.uniform(strike * 0.01, strike * 0.05), 2) if random.random() > 0.8 else None,
                    "bid": round(random.uniform(strike * 0.005, strike * 0.03), 2),
                    "ask": round(random.uniform(strike * 0.01, strike * 0.04), 2),
                    "underlying": "SPX",
                    "strike": float(strike),
                    "greeks": {
                        "delta": round(random.uniform(-0.8, 0.8), 4),
                        "gamma": round(random.uniform(0.0001, 0.01), 6),
                        "theta": round(random.uniform(-0.1, -0.001), 4),
                        "vega": round(random.uniform(0.001, 0.1), 4),
                        "rho": round(random.uniform(-0.5, 0.5), 4),
                        "phi": round(random.uniform(-1, 1), 4),
                        "bid_iv": round(random.uniform(0.1, 0.5), 4),
                        "mid_iv": round(random.uniform(0.15, 0.55), 4),
                        "ask_iv": round(random.uniform(0.2, 0.6), 4),
                        "smv_vol": round(random.uniform(0.1, 0.8), 4),
                        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    },
                    "change_percentage": round(random.uniform(-20, 20), 2) if random.random() > 0.5 else None,
                    "average_volume": random.randint(0, 5000),
                    "last_volume": random.randint(0, 500),
                    "trade_date": int(datetime.now().timestamp()),  # Unix timestamp in seconds
                    "prevclose": round(random.uniform(strike * 0.01, strike * 0.05), 2) if random.random() > 0.7 else None,
                    "week_52_high": round(strike * 1.1, 2),
                    "week_52_low": round(strike * 0.9, 2),
                    "bidsize": random.randint(1, 50),
                    "bidexch": "C",
                    "bid_date": int(datetime.now().timestamp()),  # Unix timestamp in seconds
                    "asksize": random.randint(1, 50),
                    "askexch": "C",
                    "ask_date": int(datetime.now().timestamp()),  # Unix timestamp in seconds
                    "open_interest": random.randint(0, 10000),
                    "contract_size": 100,
                    "expiration_date": expiration,
                    "expiration_type": "weeklys",
                    "option_type": option_type,
                    "root_symbol": "SPXW"
                })

        print(f"🔥 SPXW: Generated {len(mock_options)} mock options for {expiration}")
        return {"options": mock_options}  # Return empty list if no options found