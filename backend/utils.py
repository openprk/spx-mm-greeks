"""Utility functions for SPX analysis"""

from typing import List
import numpy as np


def calculate_neutral_threshold(values: List[float], epsilon: float = 0.05) -> float:
    """
    Calculate neutral threshold based on median absolute deviation.
    Used for determining when exposures are neutral vs directional.
    """
    if not values:
        return epsilon

    abs_values = [abs(v) for v in values]
    median_abs = np.median(abs_values)
    return max(epsilon, 0.05 * median_abs)


def classify_regime(value: float, neutral_threshold: float) -> str:
    """
    Classify a value as neutral (o), positive (+), or negative (-)
    based on the neutral threshold.
    """
    if abs(value) < neutral_threshold:
        return "o"
    return "+" if value > 0 else "-"