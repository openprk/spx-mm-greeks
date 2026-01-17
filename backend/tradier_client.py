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
                    "timestamp": str(quote.get("trade_date") or "")  # Ensure string
                }
            else:
                raise ValueError("Invalid SPX quote response from Tradier")

    async def get_spx_expirations(self) -> list:
        """Get available SPX options expiration dates"""
        url = f"{self.base_url}/markets/options/expirations"
        params = {"symbol": "SPX", "includeAllRoots": "true", "strikes": "false"}

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            data = response.json()

            if "expirations" in data and "date" in data["expirations"]:
                dates = data["expirations"]["date"]
                # Ensure we return a list of strings
                if isinstance(dates, list):
                    return dates
                else:
                    return [dates]
            else:
                raise ValueError("Invalid expirations response from Tradier")

    async def get_spx_chain(self, expiration: str) -> dict:
        """Get SPX options chain for specific expiration date"""
        url = f"{self.base_url}/markets/options/chains"
        params = {
            "symbol": "SPX",
            "expiration": expiration,
            "greeks": "true"  # Request greeks data
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            data = response.json()

            # Debug logging
            if "options" in data and "option" in data["options"]:
                options = data["options"]["option"]
                if isinstance(options, list):
                    print(f"🔍 Tradier returned {len(options)} options for {expiration}")
                else:
                    print(f"🔍 Tradier returned 1 option for {expiration}")
            else:
                print(f"🔍 Tradier returned no options for {expiration}")

            if "options" in data and "option" in data["options"]:
                options = data["options"]["option"]
                # Ensure we return a list of options
                if isinstance(options, list):
                    return {"options": options}
                else:
                    return {"options": [options]}
            else:
                return {"options": []}  # Return empty list if no options found