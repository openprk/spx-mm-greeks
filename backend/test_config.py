#!/usr/bin/env python3
"""Test script to verify config loading"""

import os
print("Current working directory:", os.getcwd())
print("Env file exists:", os.path.exists(".env"))

from config import settings

print("Tradier Token:", settings.tradier_token)
print("Token Length:", len(settings.tradier_token))
print("Is Placeholder:", settings.tradier_token == "placeholder_token")
print("Risk Free Rate:", settings.risk_free_rate)