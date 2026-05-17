# -*- coding: utf-8 -*-
"""Fonctions financières : CRF et TRI."""

from typing import Optional, List

try:
    import numpy_financial as npf
    HAS_NPF = True
except ImportError:
    HAS_NPF = False


def get_crf(r: float, n: int) -> float:
    """Capital Recovery Factor — annualise un CAPEX sur n ans au taux r."""
    if r == 0:
        return 1 / n
    return (r * (1 + r) ** n) / ((1 + r) ** n - 1)


def calculate_irr(cash_flows: List[float]) -> Optional[float]:
    """TRI via numpy_financial si disponible, sinon bissection."""
    if HAS_NPF:
        val = npf.irr(cash_flows)
        if val != val:  # nan check
            return None
        return round(float(val) * 100, 2)

    def npv(rate):
        return sum(cf / (1 + rate) ** i for i, cf in enumerate(cash_flows))

    low, high = -0.9, 1.0
    if npv(low) * npv(high) > 0:
        return None
    for _ in range(60):
        mid = (low + high) / 2
        if npv(mid) > 0:
            low = mid
        else:
            high = mid
    return round(mid * 100, 2)
