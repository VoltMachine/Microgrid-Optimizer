"""Tests unitaires — finance_utils.py (fonctions pures)."""

import pytest
from backend.services.finance_utils import get_crf, calculate_irr


class TestGetCRF:
    """Capital Recovery Factor — annualise un CAPEX."""

    def test_zero_rate_returns_inverse_period(self):
        # CRF = 1/n quand r=0
        assert get_crf(0.0, 25) == pytest.approx(1 / 25)
        assert get_crf(0.0, 10) == pytest.approx(0.1)
        assert get_crf(0.0, 1) == pytest.approx(1.0)

    def test_positive_rate(self):
        # r=5%, n=25 ans → CRF ≈ 0.07095
        assert get_crf(0.05, 25) == pytest.approx(0.07095, rel=1e-4)

    def test_high_rate(self):
        # r=15%, n=10 ans
        assert get_crf(0.15, 10) == pytest.approx(0.199252, rel=1e-6)

    def test_one_year_equals_one_plus_rate(self):
        # CRF = r + 1 quand n=1 (récupération intégrale + rendement)
        val = get_crf(0.07, 1)
        assert val == pytest.approx(1.07)

    def test_very_long_period_approaches_rate(self):
        # CRF → r quand n→∞
        crf = get_crf(0.05, 1000)
        assert crf == pytest.approx(0.05, rel=0.01)


class TestCalculateIRR:
    """Taux de Rentabilité Interne."""

    def test_simple_investment(self):
        # Investissement 100 → retour 110 un an plus tard → TRI = 10 %
        irr = calculate_irr([-100, 110])
        assert irr == pytest.approx(10.0, rel=1e-2)

    def test_zero_return(self):
        irr = calculate_irr([-100, 100])
        assert irr is not None
        assert irr == pytest.approx(0.0, abs=1e-6)

    def test_all_negative_returns_none(self):
        irr = calculate_irr([-100, -50, -20])
        assert irr is None

    def test_all_positive_returns_none(self):
        irr = calculate_irr([100, 50, 20])
        assert irr is None

    def test_multi_period(self):
        # -100, +40, +40, +40 → TRI ≈ 9.7% via bissection
        irr = calculate_irr([-100, 40, 40, 40])
        assert irr is not None
        # La bissection doit trouver ~9.7%
        assert 9.0 < irr < 10.0

    def test_empty_list_returns_none(self):
        # npv vide → division par zéro dans bissection → None
        irr = calculate_irr([])
        # Peut planter ou retourner None selon l'implémentation
        assert irr is None or irr == 0.0
