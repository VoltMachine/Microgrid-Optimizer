"""Tests unitaires — optimizer_engine.py (fonctions pures sans solver LP)."""

import pytest
from backend.models.schemas import EcoParams
from backend.services.optimizer_engine import (
    _build_load_profiles,
    calc_baseline_opex,
    _carbon_balance,
)
from backend.utils.helpers import RES_288


class TestBuildLoadProfiles:
    """Construction des profils 288h avec saisonnalité, P90, charge commerciale."""

    def test_flat_pass_through_no_seasonality_or_p90(self):
        p = EcoParams()
        p.economic.seasonality = 0.0        # pas de saisonnalité
        p.economic.p90_mode = False
        p.economic.commercial_power = 0.0
        p.thermal.thermal_ratio = 0.0

        l_src = [1.0] * 24
        full, therm, comm = _build_load_profiles(p, l_src, RES_288)

        assert len(full) == 288
        assert all(v == pytest.approx(1.0) for v in full)
        assert all(v == pytest.approx(0.0) for v in therm)
        assert all(v == pytest.approx(0.0) for v in comm)

    def test_seasonality_winter_boost(self):
        p = EcoParams()
        p.economic.seasonality = 0.30
        p.economic.p90_mode = False
        p.economic.commercial_power = 0.0
        p.thermal.thermal_ratio = 0.0

        l_src = [1.0] * 24
        full, _, _ = _build_load_profiles(p, l_src, RES_288)

        # Janvier (t=0..23) → mult = 1+0.3 = 1.3
        assert full[0] == pytest.approx(1.3)
        # Mai (t=4*24..5*24-1, m=4) → mult = 1.0 (pas de boost été)
        assert full[4 * 24] == pytest.approx(1.0)

    def test_p90_mode_increases_load(self):
        p = EcoParams()
        p.economic.seasonality = 0.0
        p.economic.p90_mode = True     # +10 %
        p.economic.commercial_power = 0.0
        p.thermal.thermal_ratio = 0.0

        l_src = [1.0] * 24
        full, _, _ = _build_load_profiles(p, l_src, RES_288)

        assert full[0] == pytest.approx(1.10)

    def test_commercial_power_injected_daytime_only(self):
        p = EcoParams()
        p.economic.seasonality = 0.0
        p.economic.p90_mode = False
        p.economic.commercial_power = 5.0
        p.thermal.thermal_ratio = 0.0

        l_src = [1.0] * 24
        full, _, comm = _build_load_profiles(p, l_src, RES_288)

        # Jour (8h-18h) → +5 kW commerce
        assert comm[8] == pytest.approx(5.0)
        assert full[8] == pytest.approx(1.0 + 5.0)
        # Nuit → pas de commerce
        assert comm[0] == pytest.approx(0.0)
        assert full[0] == pytest.approx(1.0)

    def test_thermal_ratio_splits_load(self):
        p = EcoParams()
        p.economic.seasonality = 0.0
        p.economic.p90_mode = False
        p.economic.commercial_power = 0.0
        p.thermal.thermal_ratio = 0.30    # 30 % thermique

        l_src = [10.0] * 24
        full, therm, _ = _build_load_profiles(p, l_src, RES_288)

        assert full[0] == pytest.approx(10.0)
        assert therm[0] == pytest.approx(3.0)

    def test_negative_load_clamped_to_zero(self):
        p = EcoParams()
        p.economic.seasonality = 0.0
        p.economic.p90_mode = False
        p.economic.commercial_power = 0.0
        p.thermal.thermal_ratio = 0.0

        full, _, _ = _build_load_profiles(p, [-5.0], RES_288)
        assert all(v >= 0.0 for v in full)


class TestCalcBaselineOpex:
    """OPEX annuel de référence sans microgrid."""

    def test_grid_connected_tou_pricing(self):
        p = EcoParams()
        p.grid.connected = True
        p.grid.use_spot_market = False

        # 1 kW constant sur 24h → 1 × 31 × 12 = 372 kWh/an pour janvier
        # Plus les 11 autres mois
        full_load = [1.0] * 288
        opex = calc_baseline_opex(p, full_load)

        assert opex > 0

    def test_grid_connected_spot_market(self):
        p = EcoParams()
        p.grid.connected = True
        p.grid.use_spot_market = True

        full_load = [1.0] * 288
        opex_spot = calc_baseline_opex(p, full_load)

        assert opex_spot > 0

    def test_offgrid_uses_gas_price(self):
        p = EcoParams()
        p.grid.connected = False

        full_load = [1.0] * 288
        opex = calc_baseline_opex(p, full_load)

        assert opex > 0  # coût gaz pur

    def test_demand_charge_included_when_connected(self):
        p = EcoParams()
        p.grid.connected = True
        p.grid.demand_charge = 10.0
        p.grid.use_spot_market = False

        # Pic = 5.0 kW → abo = 5.0 × 10 × 12 = 600 €/an
        full_load = [1.0] * 287 + [5.0]
        opex = calc_baseline_opex(p, full_load)

        assert opex >= 600.0


class TestCarbonBalance:
    """Bilan carbone : dette embarquée + émissions annuelles."""

    def test_zero_capacity_only_grid(self):
        p = EcoParams()
        p.grid.connected = True

        caps = {"solar": 0, "wind": 0, "hydro": 0, "bess": 0,
                "solar_inv": 0, "bess_inv": 0, "gas": 0,
                "boiler": 0, "hp": 0, "tes": 0}

        # raw_load = 1 kW × 288h, pondéré par DAYS_M
        h_base = {
            "raw_load":     [1.0] * 288,
            "gas_gen":      [0.0] * 288,
            "gas_th_gen":   [0.0] * 288,
            "grid_buy":     [1.0] * 288,  # tout acheté au réseau
        }

        dette, baseline, microgrid, avoided = _carbon_balance(p, caps, h_base)

        assert dette == pytest.approx(0.0)   # pas de capacités → pas de dette
        assert baseline > 0                   # CO₂ réseau > 0
        assert microgrid > 0                  # émissions du réseau = baseline
        assert avoided == pytest.approx(baseline - microgrid)

    def test_embodied_carbon_scales_with_capacity(self):
        p = EcoParams()
        p.grid.connected = True

        caps = {"solar": 50, "wind": 0, "hydro": 0, "bess": 0,
                "solar_inv": 40, "bess_inv": 0, "gas": 0,
                "boiler": 0, "hp": 0, "tes": 0}

        # Solar embodied = 800 kg/kW, inverter embodied = 50 kg/kW
        # expected = (50 × 800 + 40 × 50) / 1000 = (40000 + 2000) / 1000 = 42 t
        expected = (50 * 800 + 40 * 50) / 1000

        h_base = {
            "raw_load":   [1.0] * 288,
            "gas_gen":    [0.0] * 288,
            "gas_th_gen": [0.0] * 288,
            "grid_buy":   [1.0] * 288,
        }

        dette, _, _, _ = _carbon_balance(p, caps, h_base)
        assert dette == pytest.approx(expected)

    def test_offgrid_baseline_uses_gas_emissions(self):
        p = EcoParams()
        p.grid.connected = False

        caps = {"solar": 0, "wind": 0, "hydro": 0, "bess": 0,
                "solar_inv": 0, "bess_inv": 0, "gas": 0,
                "boiler": 0, "hp": 0, "tes": 0}

        h_base = {
            "raw_load":   [1.0] * 288,
            "gas_gen":    [0.0] * 288,
            "gas_th_gen": [0.0] * 288,
            "grid_buy":   [0.0] * 288,
        }

        _, baseline, _, _ = _carbon_balance(p, caps, h_base)
        assert baseline > 0  # CO₂ issu du gaz (proxy baseline)
