"""Tests unitaires — weather_service.py (fonctions pures)."""

import pytest
from backend.services.weather_service import wind_power_curve, wind_hub_extrapolate


class TestWindPowerCurve:
    """Courbe de puissance quadratique exposant 2."""

    # ── Seuils critiques ─────────────────────────────────────────────────
    def test_below_cut_in_returns_zero(self):
        assert wind_power_curve(0.0) == 0.0
        assert wind_power_curve(2.999) == 0.0
        assert wind_power_curve(-1.0) == 0.0  # pas de garde négatif → < CUT_IN

    def test_at_cut_in_returns_zero(self):
        assert wind_power_curve(3.0) == 0.0  # strictement < CUT_IN

    def test_at_rated_returns_one(self):
        assert wind_power_curve(12.0) == 1.0

    def test_at_cut_out_returns_zero(self):
        assert wind_power_curve(25.0) == 0.0  # >= CUT_OUT

    def test_above_cut_out_returns_zero(self):
        assert wind_power_curve(30.0) == 0.0
        assert wind_power_curve(100.0) == 0.0

    # ── Région quadratique ───────────────────────────────────────────────
    def test_midpoint(self):
        # v = 7.5 → ((7.5-3)/(12-3))² = (4.5/9)² = 0.25
        assert wind_power_curve(7.5) == pytest.approx(0.25)

    def test_one_third_ramp(self):
        # v = 6.0 → ((6-3)/9)² = (1/3)² = 1/9 ≈ 0.1111
        assert wind_power_curve(6.0) == pytest.approx(1 / 9)

    def test_quadratic_monotonic(self):
        assert wind_power_curve(6.0) < wind_power_curve(9.0) < wind_power_curve(11.0)

    # ── Région rated → cut-out ───────────────────────────────────────────
    def test_between_rated_and_cut_out_returns_one(self):
        assert wind_power_curve(15.0) == 1.0
        assert wind_power_curve(24.999) == 1.0


class TestWindHubExtrapolate:
    """Loi logarithmique d'extrapolation au moyeu."""

    def test_same_height_returns_ref(self):
        assert wind_hub_extrapolate(5.0, 50.0, 50.0, 0.03) == pytest.approx(5.0)

    def test_higher_hub_increases_speed(self):
        result = wind_hub_extrapolate(5.0, 10.0, 80.0, 0.03)
        assert result > 5.0

    def test_lower_hub_decreases_speed(self):
        result = wind_hub_extrapolate(8.0, 80.0, 10.0, 0.03)
        assert result < 8.0

    def test_roughness_effect(self):
        # z0 élevé → plus de cisaillement → ratio v(hub)/v(ref) plus grand
        # (le vent à 10m est plus freiné par le relief → extrapolation + forte)
        smooth = wind_hub_extrapolate(5.0, 10.0, 80.0, 0.0002)  # mer
        rough  = wind_hub_extrapolate(5.0, 10.0, 80.0, 0.10)    # bocage
        assert rough > smooth  # ratio d'extrapolation plus fort sur terrain rugueux
