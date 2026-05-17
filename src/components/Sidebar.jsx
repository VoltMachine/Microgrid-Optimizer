import React, { useState } from 'react';
import {
  Sun, Wind, Droplets, BatteryCharging, Car, Flame, Thermometer,
  Coins, Zap, MapPin, RotateCcw, Play, Sliders, Users, Boxes,
  Fuel, ShieldCheck, Activity, Clock, Leaf,
} from 'lucide-react';
import {
  Accordion, ParamControl, Toggle, SelectField, SectionTitle, Spinner,
  Tabs, TabPanel, IncludeBanner, HelpTip, Tooltip,
} from './Primitives';
import MapPicker from './MapPicker';
import { useI18n } from '../i18n';

// ═══════════════════════════════════════════════════════════════════════════
// HELP — explications + hypothèses pour chaque paramètre
// ═══════════════════════════════════════════════════════════════════════════
const HELP = {
  lat: 'Latitude GPS du site. Détermine l\'irradiance PV (récupérée via PVGIS) et le profil de vent (via Open-Meteo). En cas d\'échec API, des profils types sont utilisés.',
  lon: 'Longitude GPS du site. Cliquez sur la carte ou glissez le marqueur pour modifier la position.',

  num_homes: 'Nombre d\'unités résidentielles raccordées au microgrid (foyers, bureaux, etc.). Multiplie le profil de charge journalier normalisé.',
  peak_per_home: 'Puissance crête appelable par unité. Charge horaire = nb unités × peak/unité × profil normalisé. Hypothèse : 1.5-3 kW pour un foyer standard, 2 kW par défaut.',
  seasonality: 'Surconsommation hivernale appliquée à la charge totale. ×(1+S) en jan./déc., ×(1+0.7S) en novembre, ×(1+0.5S) en mars. Hypothèse : 30 % pour un site avec chauffage électrique, ~5 % sinon.',
  commercial_power: 'Charge tertiaire ajoutée en journée (8h-18h) — commerces, bureaux. S\'ajoute au profil résidentiel et impacte directement le pic d\'appel.',
  thermal_ratio: 'Rapport demande chaleur / demande électrique. 0 = pas de besoin thermique. 0.2-0.3 = tertiaire avec ECS uniquement. 1+ = chauffage thermique majeur.',

  solar_capex: 'Coût d\'investissement total des modules PV par kWc installé : panneaux, structure, câblage DC, installation. Hypothèse 2025 : 600 €/kWc pour PV en toiture résidentielle/tertiaire.',
  solar_lifetime: 'Durée de vie économique du module PV. Détermine l\'annuité CAPEX. Hypothèse : 25 ans (garantie panneau standard).',
  solar_degradation: 'Perte de performance annuelle linéaire du module. Typiquement 0.5 %/an pour silicium cristallin moderne. Modélise la dégradation UV + thermique.',
  solar_inverter_capex: 'Coût de l\'onduleur de couplage AC par kW. Convertit le DC du panneau en AC. Hypothèse : 150 €/kW.',
  solar_inverter_lifetime: 'Durée de vie de l\'onduleur PV. Plus courte que les modules → un renouvellement à mi-vie est intégré. Hypothèse : 10 ans.',
  max_solar_kw: 'Puissance PV maximale installable (contrainte de surface). 1 kWc ≈ 5-6 m² de toiture. Défaut : 200 kWc. Mettre à 0 pour désactiver la limite.',
  solar_temp_coeff: 'Coefficient de température de puissance du module PV (γ). Typ. −0.003 à −0.005/°C. Laissez −0.004 pour silicium standard.',
  solar_tilt: 'Inclinaison des panneaux. 0° = à plat, 30° = toiture standard, 90° = façade (BIPV).',
  solar_azimuth: 'Orientation. 0° = Sud, −90° = Est, 90° = Ouest (convention PVGIS).',
  solar_albedo: 'Albédo du sol : réflexion. 0.2 = herbe, 0.5 = béton, 0.8 = neige.',
  solar_tracking: 'Mode de suivi solaire. Fixe / mono-axe horizontal / bi-axe.',

  wind_capex: 'Coût total d\'une turbine éolienne par kW installé : mât, génératrice, fondations, raccordement. Hypothèse : 1500 €/kW pour onshore petite/moyenne échelle.',
  wind_lifetime: 'Durée de vie d\'une turbine éolienne. Hypothèse : 20-25 ans (limite par fatigue mécanique).',
  max_wind_kw: 'Puissance éolienne maximale installable (contrainte de terrain / réglementation). Une petite éolienne = 5-20 kW, une moyenne = 100-500 kW. Défaut : 200 kW. Mettre à 0 pour désactiver la limite.',

  hydro_capex: 'Coût d\'une turbine hydraulique par kW. Très variable selon le site (chute, débit). Hypothèse : 2500 €/kW pour pico/petite hydro.',
  hydro_flow: 'Multiplicateur sur la disponibilité hydraulique annuelle. 1.0 = nominal. Permet de simuler une saison sèche (<1) ou humide (>1).',
  hydro_lifetime: 'Durée de vie d\'une turbine hydraulique. Souvent supérieure à 30 ans avec maintenance régulière.',
  max_hydro_kw: "Puissance hydroélectrique maximale installable — dépend du débit de la rivière et de la hauteur de chute. Contrairement au solaire et à l'éolien, le potentiel hydro est strictement limité par la ressource. 0 = pas de limite (peu réaliste).",

  bess_capex: 'Coût des cellules Li-ion par kWh de capacité utile, hors onduleur. Hypothèse 2025 : 300 €/kWh (LFP en pack industriel).',
  bess_inverter_capex: 'Coût de l\'onduleur batterie (PCS) bidirectionnel par kW. Détermine le ratio Puissance/Énergie de la batterie.',
  bess_cycle_cost: 'Coût d\'usure marginal par kWh déchargé. Pénalise les cycles inutiles dans l\'objectif. Calibré sur la dégradation calendaire+cyclique.',
  eff_ch: 'Rendement de charge (kWh stockés / kWh injectés). Pertes thermiques et électriques. Hypothèse : 0.95 pour Li-ion.',
  eff_dis: 'Rendement de décharge (kWh restitués / kWh stockés). Hypothèse : 0.95. Aller-retour ≈ η_ch × η_dis ≈ 0.90.',
  min_soc: 'État de charge minimum (en fraction). Préserve la durée de vie en évitant les décharges profondes. 0.20 = 20 % de capacité toujours réservée.',
  bess_lifetime: 'Durée de vie économique de la batterie. Hypothèse : 10 ans (LFP) à 80 % de la capacité initiale. Renouvelée à chaque échéance dans le bilan 25 ans.',

  max_flex: 'Part de la charge horaire déplaçable dans la même journée (Demand Response). Le LP peut avancer ou retarder cette fraction. Hypothèse : 10 % avec asservissement smart, 0 % sans pilotage.',
  num_evs: 'Nombre de véhicules électriques raccordés au site. Modèle simplifié : 50 kWh/véh, charge entre 18h-7h, départ avec batterie pleine à 7h.',
  v2g_enabled: 'Vehicle-to-Grid : autorise les VE à réinjecter de l\'énergie dans le microgrid pendant la nuit. Augmente la flexibilité, mais accélère la dégradation de la batterie VE.',

  hp_capex: 'Coût d\'une pompe à chaleur air/eau par kW thermique restitué. Hypothèse : 800 €/kWth (PAC industrielle/collectif).',
  cop_hp: 'Coefficient de Performance — kWh chaleur produits par kWh électrique consommé. Air/eau standard : 3.0. Géothermie : 4-5. Varie avec la T° extérieure.',
  hp_lifetime: 'Durée de vie d\'une pompe à chaleur. Hypothèse : 15 ans (compresseur + échangeurs).',
  tes_capex: 'Coût d\'un ballon de stockage thermique par kWh capacité. Hypothèse : 50 €/kWh (eau pressurisée + isolation).',
  tes_lifetime: 'Durée de vie d\'un ballon thermique. Hypothèse : 20 ans.',
  boiler_capex: 'Coût d\'une chaudière à condensation par kW thermique. Hypothèse : 150 €/kW.',
  boiler_eff: 'Rendement PCI de la chaudière. Hypothèse : 0.90 pour condensation gaz moderne. ~0.80 pour chaudière classique.',
  boiler_lifetime: 'Durée de vie d\'une chaudière. Hypothèse : 15 ans.',

  gas_fuel: 'Prix unitaire du gaz naturel par kWh PCI consommé. Source : tarif fournisseur gaz. Hypothèse 2025 : 0.20 €/kWh PCI pour gaz industriel.',
  ramp_limit_kw: 'Limite la variation horaire de la puissance du moteur gaz. 0 = pas de contrainte (montée/descente instantanée). Réaliste : 30-50 % Pnom/h.',
  gas_lifetime: 'Durée de vie d\'un groupe électrogène gaz. Hypothèse : 15 ans (mode peaker), plus long si base load.',

  grid_connected: 'Le microgrid est-il connecté au réseau public ? Si non : autonomie totale (îloté), pas d\'achat ni de vente — moteur gaz et batterie doivent compenser tous les écarts.',
  use_spot_market: 'Utilise les prix spot horaires (24 valeurs typiques) au lieu des tarifs HC/HP fixes. Reflète mieux la volatilité réelle du marché. Nécessite d\'être connecté au réseau.',
  grid_peak_price: 'Tarif d\'achat heures pleines du fournisseur (8h-20h). Hypothèse : 0.25 €/kWh (TURPE + fourniture professionnel).',
  grid_offpeak_price: 'Tarif d\'achat heures creuses (20h-8h). Hypothèse : 0.12 €/kWh.',
  grid_sell_price: 'Tarif d\'injection sur le réseau public — revente du surplus. Hypothèse : 0.10 €/kWh (tarif Obligation d\'Achat moyen).',
  demand_charge: 'Abonnement mensuel par kW souscrit. Le LP minimise la souscription en lissant les pics. Hypothèse : 10 €/kW/mois (TURPE C5).',
  cable_capex: 'Coût du raccordement HTA, proportionnel à la puissance crête du site. Hypothèse : 150 €/kW peak.',

  discount_rate: 'Coût moyen pondéré du capital (WACC). Utilisé pour calculer la VAN et le LCOE annualisé. Hypothèse : 5 % pour un projet d\'efficacité énergétique.',
  grid_inflation: 'Taux d\'augmentation annuel des tarifs électricité. Hypothèse : 4 %/an (intermédiaire entre inflation générale et tendance historique).',
  gas_inflation: 'Taux d\'augmentation annuel du prix du gaz. Hypothèse : 2 %/an (moins volatile sur le long terme).',
  om_inflation: 'Taux d\'augmentation annuel des coûts d\'exploitation et maintenance. Hypothèse : 2 %/an (aligné sur l\'inflation générale).',
  voll: 'Value Of Lost Load — pénalité par kWh non fourni en cas de défaillance. Hypothèse : 5 €/kWh pour tertiaire/résidentiel. Industries critiques : >50 €/kWh.',

  p90_mode: "P90 forfaitaire : réduit les EnR de 15 % et augmente la charge de 10 %. Rapide (0s) mais moins précis que l'analyse stochastique. Les deux modes sont exclusifs — activer l'un désactive l'autre.",
  stochastic: 'Analyse P90 réelle (M5) : chaque année NASA POWER (2013–2022) devient un scénario météo indépendant. ~10 runs → distribution P10/P50/P90 des KPIs. ~30s (288h) / ~80s (672h) / ~10 min (8760h). Remplace le P90 forfaitaire.',
  run_sensitivity: 'Lance ~16 optimisations supplémentaires en faisant varier ±20 % chaque paramètre clé. Alimente le diagramme Tornado. Ajoute 5-10 s au calcul.',
  forecast_error: 'Bruit blanc multiplicatif appliqué aux profils PV/vent. Modélise l\'incertitude de prévision météo. 0 = profils déterministes.',
  max_annual_co2_t: 'Plafond annuel d\'émissions CO₂ (en tonnes). Si > 0, le LP doit respecter cette contrainte (peut rendre le problème infaisable). 0 = pas de contrainte (mode pure économique).',
  n1_reserve: "Contrainte N-1 : garantit que le microgrid peut couvrir la charge même si le plus gros producteur tombe (solaire, éolien, hydro ou groupe gaz). La capacité de réserve (batterie + groupe gaz + réseau) doit pouvoir remplacer le plus gros apport horaire. Dimensionne la batterie et le backup pour la résilience.",

  include_solar: 'Désactivé : le solveur n\'installera pas de PV (cap = 0). Réactiver pour intégrer le solaire au dimensionnement.',
  include_wind: 'Désactivé : le solveur n\'installera pas d\'éolien.',
  include_hydro: 'Désactivé : pas de turbine hydraulique.',
  include_battery: 'Désactivé : pas de batterie BESS, le LP devra gérer les écarts via gaz/réseau/délestage.',
  include_hp: 'Désactivé : pas de pompe à chaleur. La demande thermique sera servie uniquement par chaudière + ballon.',
  include_boiler: 'Désactivé : pas de chaudière gaz. La chaleur viendra uniquement de la PAC + ballon.',
  include_gas: 'Désactivé : pas de moteur gaz. Le LP préférera les renouvelables, la batterie ou le réseau.',

  run: 'Lance l\'optimisation linéaire (CBC). Durée typique : 1-3 s. Avec l\'analyse de sensibilité activée : ~10 s supplémentaires (~16 résolutions).',
  reset: 'Remet tous les paramètres aux valeurs par défaut et réinitialise les inclusions de sources.',
};

// ── Labels techniques (pas de HELP, juste l'affichage) ──
const solarPVhelp = 'Puissance crête des modules PV installés. 1 kWc ≈ 5-6 m² de toiture.';
const solarInvHelp = 'Puissance nominale de l\'onduleur AC. 0 = automatique (égale à la puissance PV).';
const solarDegHelp = 'Perte de performance annuelle des modules (0.5 %/an typique).';
const solarAmortPVHelp = 'Durée de vie économique des modules PV.';
const solarAmortInvHelp = 'Durée de vie de l\'onduleur. Détermine les renouvellements.';
const windPowerHelp = 'Puissance nominale de l\'éolienne installée.';
const hydroPowerHelp = 'Puissance de la turbine hydraulique.';
const bessCapHelp = 'Capacité énergétique utile de la batterie.';
const bessInvHelp = 'Puissance de l\'onduleur batterie (PCS).';
const bessAmortBattHelp = 'Durée de vie des cellules. Détermine les renouvellements.';
const bessAmortInvHelp = 'Durée de vie de l\'onduleur batterie.';
const gasPowerHelp = 'Puissance du groupe électrogène gaz.';
const gasRampHelp = 'Variation max de puissance par heure. 0 = pas de limite.';
const hpPowerHelp = 'Puissance électrique de la pompe à chaleur.';
const boilerPowerHelp = 'Puissance thermique de la chaudière gaz.';
const tesCapHelp = 'Capacité du ballon de stockage thermique.';
const gridSubHelp = 'Puissance de soutirage souscrite auprès du gestionnaire réseau.';
const spotIgnored = '↳ Tarifs ignorés : prix spot horaires utilisés pour l\'achat et la vente.';
const tesAutoNote = 'Le ballon d\'eau chaude est dimensionné automatiquement par le solveur (jamais "exclu", peut être à 0 kWh si non rentable).';

export default function Sidebar({
  params, setParams, enabled, setEnabled, location, setLocation,
  darkMode, onRun, onReset, loading,
  mode, setMode, manualCaps, setManualCaps,
}) {
  const { t } = useI18n();
  const set = (k, v) => setParams((p) => {
    if (!k.includes('.')) return { ...p, [k]: v };
    const keys = k.split('.');
    const next = { ...p };
    let obj = next;
    for (let i = 0; i < keys.length - 1; i++) {
      obj[keys[i]] = { ...obj[keys[i]] };
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = v;
    return next;
  });
  const setEnable = (k, v) => setEnabled((e) => ({ ...e, [k]: v }));
  const setCap = (k, v) => setManualCaps((c) => ({ ...c, [k]: v }));

  const [renewTab, setRenewTab] = useState('solar');
  const [thermTab, setThermTab] = useState('hp');

  const enabledCount = Object.values(enabled).filter(Boolean).length;

  return (
    <aside className="w-[380px] shrink-0 h-screen sticky top-0 border-r border-ink-200/70 dark:border-ink-800 bg-white/60 dark:bg-ink-900/60 backdrop-blur flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-ink-200/70 dark:border-ink-800">
        <div className="flex items-center gap-2.5">
          <div className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">
            <Zap size={18} />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-bold tracking-tight">Microgrid Optimizer</h1>
            <p className="text-[10px] text-ink-500 dark:text-ink-400">
              {enabledCount} / 7 {t('sidebar.sources.active')} · {t('sidebar.sources.dispatch')}
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* ─────────────── MODE ─────────────── */}
        <SectionTitle>{t('sidebar.mode')}</SectionTitle>
        <div className="flex rounded-xl bg-ink-100 dark:bg-ink-800 p-1 gap-1">
          <button
            onClick={() => setMode('optimize')}
            className={
              'flex-1 text-xs font-medium py-1.5 rounded-lg transition-all ' +
              (mode === 'optimize'
                ? 'bg-white dark:bg-ink-700 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-ink-500 dark:text-ink-400 hover:text-ink-700')
            }
          >
            {t('sidebar.mode.optimize')}
          </button>
          <button
            onClick={() => setMode('simulate')}
            className={
              'flex-1 text-xs font-medium py-1.5 rounded-lg transition-all ' +
              (mode === 'simulate'
                ? 'bg-white dark:bg-ink-700 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-ink-500 dark:text-ink-400 hover:text-ink-700')
            }
          >
            {t('sidebar.mode.simulate')}
          </button>
        </div>
        {mode === 'simulate' && (
          <p className="text-[10px] text-ink-500 dark:text-ink-400 italic px-1">
            {t('sidebar.mode.simulate.hint')}
          </p>
        )}

        {/* ─────────────── LOCALISATION ─────────────── */}
        <SectionTitle>{t('sidebar.section.site')}</SectionTitle>
        <Accordion title={t('sidebar.accord.location')} icon={MapPin} defaultOpen>
          <MapPicker location={location} onChange={setLocation} darkMode={darkMode} />
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div>
              <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-500 dark:text-ink-400">
                Latitude <HelpTip>{t('help.lat')}</HelpTip>
              </label>
              <input
                type="number" step="0.01" value={location.lat}
                onChange={(e) => setLocation({ ...location, lat: +e.target.value })}
                className="mt-1 w-full bg-ink-50 dark:bg-ink-800/60 border border-ink-200 dark:border-ink-700 rounded-md px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-500 dark:text-ink-400">
                Longitude <HelpTip>{t('help.lon')}</HelpTip>
              </label>
              <input
                type="number" step="0.01" value={location.lon}
                onChange={(e) => setLocation({ ...location, lon: +e.target.value })}
                className="mt-1 w-full bg-ink-50 dark:bg-ink-800/60 border border-ink-200 dark:border-ink-700 rounded-md px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
          <p className="mt-2 text-[10px] text-ink-500 dark:text-ink-400">
            {t('map.hint')}
          </p>
        </Accordion>

        {/* ─────────────── USAGES ─────────────── */}
        <SectionTitle>{t('sidebar.section.demand')}</SectionTitle>
        <Accordion title={t('sidebar.accord.usage')} icon={Users} defaultOpen
                   badge={`${params.num_homes} u. · ${(params.num_homes * params.peak_per_home).toFixed(0)} kW`}>
          <ParamControl
            label={t('param.num_homes')}
            value={params.num_homes}
            onChange={(v) => set('num_homes', Math.round(+v))}
            min={1} max={500} step={1} unit="u."
            help={t('help.num_homes')}
          />
          <ParamControl
            label={t('param.peak_per_home')}
            value={params.peak_per_home}
            onChange={(v) => set('peak_per_home', +(+v).toFixed(2))}
            min={0.5} max={20} step={0.5} unit="kW"
            help={t('help.peak_per_home')}
          />
          <div className="border-t border-ink-200/60 dark:border-ink-800 my-2" />
          <ParamControl
            label={t('param.seasonality')}
            value={params.economic.seasonality}
            onChange={(v) => set('economic.seasonality', v)}
            min={0} max={1} step={0.05} unit="%" asPercent
            help={t('help.seasonality')}
          />
          <ParamControl
            label={t('param.commercial_power')}
            value={params.economic.commercial_power}
            onChange={(v) => set('economic.commercial_power', v)}
            min={0} max={500} step={5} unit="kW"
            help={t('help.commercial_power')}
          />
          <div className="border-t border-ink-200/60 dark:border-ink-800 my-2" />
          <ParamControl
            label={t('param.thermal_ratio')}
            value={params.thermal.thermal_ratio}
            onChange={(v) => set('thermal.thermal_ratio', +(+v).toFixed(2))}
            min={0} max={2} step={0.05} unit="× élec"
            help={t('help.thermal_ratio')}
          />
          <div className="px-3 py-2 mt-2 bg-ink-50 dark:bg-ink-800/40 rounded-lg text-[11px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-ink-500 dark:text-ink-400">{t('param.estimated_peak')}</span>
              <span className="font-mono font-semibold text-brand-600 dark:text-brand-400">
                ≈ {(params.num_homes * params.peak_per_home + params.economic.commercial_power).toFixed(0)} kW
              </span>
            </div>
          </div>
        </Accordion>

        {/* ─────────────── ÉNERGIES RENOUVELABLES ─────────────── */}
        {mode !== 'simulate' && (
        <>
        <SectionTitle>{t('sidebar.section.production')}</SectionTitle>
        <Accordion title={t('sidebar.accord.renewables')} icon={Sun} defaultOpen
                   badge={[enabled.solar && 'PV', enabled.wind && t('series.wind'), enabled.hydro && t('series.hydro')]
                            .filter(Boolean).join(' · ') || t('badge.none')}>
          <Tabs
            value={renewTab}
            onChange={setRenewTab}
            tabs={[
              { value: 'solar', label: t('series.solar'), icon: Sun, indicator: enabled.solar },
              { value: 'wind',  label: t('series.wind'),  icon: Wind, indicator: enabled.wind },
              { value: 'hydro', label: t('series.hydro'), icon: Droplets, indicator: enabled.hydro },
            ]}
          />

          <TabPanel value="solar" current={renewTab}>
            <IncludeBanner
              enabled={enabled.solar}
              onToggle={(v) => setEnable('solar', v)}
              label={t('include.solar')}
              disabledLabel={t('include.disabled_solar')}
              help={t('help.include_solar')}
            />
            <fieldset disabled={!enabled.solar} className={enabled.solar ? '' : 'opacity-50'}>
              <div className="space-y-3">
                <ParamControl label={t('param.solar_capex')}
                              value={params.solar.capex} onChange={(v) => set('solar.capex', v)}
                              min={200} max={2000} step={50} unit="€/kWc"
                              help={t('help.solar_capex')} />
                <ParamControl label={t('param.solar_lifetime')}
                              value={params.solar.lifetime} onChange={(v) => set('solar.lifetime', Math.round(+v))}
                              min={10} max={40} step={1} unit="ans"
                              help={t('help.solar_lifetime')} />
                <ParamControl label={t('param.solar_degradation')}
                              value={params.solar.degradation} onChange={(v) => set('solar.degradation', v)}
                              min={0} max={0.02} step={0.001} unit="%/an" asPercent
                              help={t('help.solar_degradation')} />
                <ParamControl label={t('param.solar_temp_coeff')}
                              value={params.solar.temp_coeff} onChange={(v) => set('solar.temp_coeff', +(+v).toFixed(4))}
                              min={-0.008} max={-0.001} step={0.001} unit="/°C"
                              help={t('help.solar_temp_coeff')} />
                <div className="border-t border-ink-200/60 dark:border-ink-800 mt-3 pt-3" />
                <ParamControl label={t('param.solar_tilt')}
                              value={params.solar.tilt} onChange={(v) => set('solar.tilt', Math.round(+v))}
                              min={0} max={90} step={5} unit="°"
                              help={t('help.solar_tilt')} />
                <ParamControl label={t('param.solar_azimuth')}
                              value={params.solar.azimuth} onChange={(v) => set('solar.azimuth', Math.round(+v))}
                              min={-90} max={90} step={5} unit="°"
                              help={t('help.solar_azimuth')} />
                <ParamControl label={t('param.solar_albedo')}
                              value={params.solar.albedo} onChange={(v) => set('solar.albedo', +(+v).toFixed(1))}
                              min={0.1} max={0.9} step={0.1} unit=""
                              help={t('help.solar_albedo')} />
                <SelectField
                              label={t('param.solar_tracking')}
                              value={params.solar.tracking || 'fixed'}
                              onChange={(v) => set('solar.tracking', v)}
                              options={[
                                { value: 'fixed', label: t('tracking.fixed') },
                                { value: 'mono_h', label: t('tracking.mono_h') },
                                { value: 'dual', label: t('tracking.dual') },
                              ]}
                              help={t('help.solar_tracking')} />
                <div className="border-t border-ink-200/60 dark:border-ink-800" />
                <ParamControl label={t('param.solar_inverter_capex')}
                              value={params.solar.inverter_capex} onChange={(v) => set('solar.inverter_capex', v)}
                              min={50} max={500} step={10} unit="€/kW"
                              help={t('help.solar_inverter_capex')} />
                <ParamControl label={t('param.solar_inverter_lifetime')}
                              value={params.solar.inverter_lifetime} onChange={(v) => set('solar.inverter_lifetime', Math.round(+v))}
                              min={5} max={20} step={1} unit="ans"
                              help={t('help.solar_inverter_lifetime')} />
                <div className="border-t border-ink-200/60 dark:border-ink-800" />
                <ParamControl label={t('param.max_solar_kw')}
                              value={params.solar.max_kw} onChange={(v) => set('solar.max_kw', v)}
                              min={0} max={5000} step={10} unit="kWc"
                              help={t('help.max_solar_kw')} />
              </div>
            </fieldset>
          </TabPanel>

          <TabPanel value="wind" current={renewTab}>
            <IncludeBanner
              enabled={enabled.wind}
              onToggle={(v) => setEnable('wind', v)}
              label={t('include.wind')}
              disabledLabel={t('include.disabled_wind')}
              help={t('help.include_wind')}
            />
            <fieldset disabled={!enabled.wind} className={enabled.wind ? '' : 'opacity-50'}>
              <div className="space-y-3">
                <ParamControl label={t('param.wind_capex')}
                              value={params.wind.capex} onChange={(v) => set('wind.capex', v)}
                              min={500} max={4000} step={50} unit="€/kW"
                              help={t('help.wind_capex')} />
                <ParamControl label={t('param.wind_lifetime')}
                              value={params.wind.lifetime} onChange={(v) => set('wind.lifetime', Math.round(+v))}
                              min={10} max={30} step={1} unit="ans"
                              help={t('help.wind_lifetime')} />
                <div className="border-t border-ink-200/60 dark:border-ink-800" />
                <ParamControl label={t('param.max_wind_kw')}
                              value={params.wind.max_kw} onChange={(v) => set('wind.max_kw', v)}
                              min={0} max={10000} step={50} unit="kW"
                              help={t('help.max_wind_kw')} />
              </div>
            </fieldset>
          </TabPanel>

          <TabPanel value="hydro" current={renewTab}>
            <IncludeBanner
              enabled={enabled.hydro}
              onToggle={(v) => setEnable('hydro', v)}
              label={t('include.hydro')}
              disabledLabel={t('include.disabled_hydro')}
              help={t('help.include_hydro')}
            />
            <fieldset disabled={!enabled.hydro} className={enabled.hydro ? '' : 'opacity-50'}>
              <div className="space-y-3">
                <ParamControl label={t('param.hydro_capex')}
                              value={params.hydro.capex} onChange={(v) => set('hydro.capex', v)}
                              min={500} max={6000} step={100} unit="€/kW"
                              help={t('help.hydro_capex')} />
                <ParamControl label={t('param.hydro_flow')}
                              value={params.hydro.flow} onChange={(v) => set('hydro.flow', +(+v).toFixed(2))}
                              min={0} max={2} step={0.05} unit="×"
                              help={t('help.hydro_flow')} />
                <ParamControl label={t('param.hydro_lifetime')}
                              value={params.hydro.lifetime} onChange={(v) => set('hydro.lifetime', Math.round(+v))}
                              min={20} max={50} step={1} unit="ans"
                              help={t('help.hydro_lifetime')} />
                <div className="border-t border-ink-200/60 dark:border-ink-800 mt-3 pt-3" />
                <ParamControl label={t('param.max_hydro_kw')}
                              value={params.hydro.max_kw} onChange={(v) => set('hydro.max_kw', v)}
                              min={0} max={10000} step={10} unit="kW"
                              help={t('help.max_hydro_kw')} />
              </div>
            </fieldset>
          </TabPanel>
        </Accordion>
        </>
        )}

        {/* ─────────────── CAPACITÉS MANUELLES (mode simulation) ─────────────── */}
        {mode === 'simulate' && (
          <>
            <SectionTitle>{t('sidebar.section.manual_caps')}</SectionTitle>
            <Accordion title={t('sidebar.manual.solar')} icon={Sun} defaultOpen>
              <ParamControl label={t('param.solar_pv_power')}
                            value={manualCaps.solar_kw} onChange={(v) => setCap('solar_kw', v)}
                            min={0} max={5000} step={5} unit="kWc"
                            help={solarPVhelp} />
              <div className="mt-3">
                <ParamControl label={t('param.solar_inv_power')}
                              value={manualCaps.solar_inv_kw} onChange={(v) => setCap('solar_inv_kw', v)}
                              min={0} max={5000} step={5} unit="kW"
                              help={solarInvHelp} />
              </div>
              <div className="border-t border-ink-200/60 dark:border-ink-800 mt-3 pt-3">
                <ParamControl label={t('param.solar_deg')}
                              value={params.solar.degradation} onChange={(v) => set('solar.degradation', v)}
                              min={0} max={0.02} step={0.001} unit="%/an" asPercent
                              help={solarDegHelp} />
                <div className="mt-3">
                  <ParamControl label={t('param.solar_amort_pv')}
                                value={params.solar.lifetime} onChange={(v) => set('solar.lifetime', Math.round(+v))}
                                min={10} max={40} step={1} unit="ans"
                                help={solarAmortPVHelp} />
                </div>
                <div className="mt-3">
                  <ParamControl label={t('param.solar_amort_inv')}
                                value={params.solar.inverter_lifetime} onChange={(v) => set('solar.inverter_lifetime', Math.round(+v))}
                                min={5} max={20} step={1} unit="ans"
                                help={solarAmortInvHelp} />
                </div>
              </div>
            </Accordion>

            <Accordion title={t('sidebar.manual.wind')} icon={Wind}>
              <ParamControl label={t('param.wind_power')}
                            value={manualCaps.wind_kw} onChange={(v) => setCap('wind_kw', v)}
                            min={0} max={10000} step={10} unit="kW"
                            help={windPowerHelp} />
              <div className="mt-3">
                <ParamControl label={t('param.wind_lifetime')}
                              value={params.wind.lifetime} onChange={(v) => set('wind.lifetime', Math.round(+v))}
                              min={10} max={30} step={1} unit="ans"
                              help={t('help.wind_lifetime')} />
              </div>
            </Accordion>

            <Accordion title={t('sidebar.manual.hydro')} icon={Droplets}>
              <ParamControl label={t('param.hydro_power')}
                            value={manualCaps.hydro_kw} onChange={(v) => setCap('hydro_kw', v)}
                            min={0} max={5000} step={10} unit="kW"
                            help={hydroPowerHelp} />
              <div className="mt-3">
                <ParamControl label={t('param.hydro_flow')}
                              value={params.hydro.flow} onChange={(v) => set('hydro.flow', +(+v).toFixed(2))}
                              min={0} max={2} step={0.05} unit="×"
                              help={t('help.hydro_flow')} />
              </div>
              <div className="mt-3">
                <ParamControl label={t('param.hydro_lifetime')}
                              value={params.hydro.lifetime} onChange={(v) => set('hydro.lifetime', Math.round(+v))}
                              min={20} max={50} step={1} unit="ans"
                              help={t('help.hydro_lifetime')} />
              </div>
            </Accordion>

            <Accordion title={t('sidebar.manual.battery')} icon={BatteryCharging}>
              <ParamControl label={t('param.bess_capacity')}
                            value={manualCaps.bess_kwh} onChange={(v) => setCap('bess_kwh', v)}
                            min={0} max={10000} step={10} unit="kWh"
                            help={bessCapHelp} />
              <div className="mt-3">
                <ParamControl label={t('param.bess_inv_power')}
                              value={manualCaps.bess_kw} onChange={(v) => setCap('bess_kw', v)}
                              min={0} max={5000} step={5} unit="kW"
                              help={bessInvHelp} />
              </div>
              <div className="border-t border-ink-200/60 dark:border-ink-800 mt-3 pt-3">
                <ParamControl label={t('param.bess_amort_batt')}
                              value={params.storage.lifetime} onChange={(v) => set('storage.lifetime', Math.round(+v))}
                              min={5} max={20} step={1} unit="ans"
                              help={bessAmortBattHelp} />
              </div>
              <div className="mt-3">
                <ParamControl label={t('param.bess_amort_inv')}
                              value={params.storage.inverter_lifetime} onChange={(v) => set('storage.inverter_lifetime', Math.round(+v))}
                              min={5} max={20} step={1} unit="ans"
                              help={bessAmortInvHelp} />
              </div>
            </Accordion>

            <Accordion title={t('sidebar.manual.gas')} icon={Fuel}>
              <ParamControl label={t('param.gas_power')}
                            value={manualCaps.gas_kw} onChange={(v) => setCap('gas_kw', v)}
                            min={0} max={5000} step={10} unit="kW"
                            help={gasPowerHelp} />
              <div className="mt-3">
                <ParamControl label={t('param.gas_fuel')}
                              value={params.gas.fuel_price} onChange={(v) => set('gas.fuel_price', +(+v).toFixed(3))}
                              min={0.02} max={0.5} step={0.005} unit="€/kWh"
                              help={t('help.gas_fuel')} />
              </div>
              <div className="mt-3">
                <ParamControl label={t('param.gas_rampe')}
                              value={params.gas.ramp_limit_kw} onChange={(v) => set('gas.ramp_limit_kw', v)}
                              min={0} max={500} step={5} unit="kW/h"
                              help={gasRampHelp} />
              </div>
              <div className="mt-3">
                <ParamControl label={t('param.gas_lifetime')}
                              value={params.gas.lifetime} onChange={(v) => set('gas.lifetime', Math.round(+v))}
                              min={10} max={25} step={1} unit="ans"
                              help={t('help.gas_lifetime')} />
              </div>
            </Accordion>

            <Accordion title={t('sidebar.manual.thermal')} icon={Thermometer}>
              <ParamControl label={t('param.hp_power')}
                            value={manualCaps.hp_kw} onChange={(v) => setCap('hp_kw', v)}
                            min={0} max={5000} step={5} unit="kW"
                            help={hpPowerHelp} />
              <div className="mt-3">
                <ParamControl label={t('param.hp_cop')}
                              value={params.thermal.hp.cop} onChange={(v) => set('thermal.hp.cop', +(+v).toFixed(1))}
                              min={1.5} max={5} step={0.1} unit=""
                              help={t('help.cop_hp')} />
              </div>
              <div className="mt-3">
                <ParamControl label={t('param.hp_amort')}
                              value={params.thermal.hp.lifetime} onChange={(v) => set('thermal.hp.lifetime', Math.round(+v))}
                              min={10} max={25} step={1} unit="ans"
                              help={t('help.hp_lifetime')} />
              </div>
              <div className="border-t border-ink-200/60 dark:border-ink-800 mt-3 pt-3">
                <ParamControl label={t('param.boiler_power')}
                              value={manualCaps.boiler_kw} onChange={(v) => setCap('boiler_kw', v)}
                              min={0} max={5000} step={10} unit="kW"
                              help={boilerPowerHelp} />
                <div className="mt-3">
                  <ParamControl label={t('param.boiler_rendement')}
                                value={params.thermal.boiler.eff} onChange={(v) => set('thermal.boiler.eff', +(+v).toFixed(2))}
                                min={0.7} max={1} step={0.01} unit="η"
                                help={t('help.boiler_eff')} />
                </div>
                <div className="mt-3">
                  <ParamControl label={t('param.boiler_amort')}
                                value={params.thermal.boiler.lifetime} onChange={(v) => set('thermal.boiler.lifetime', Math.round(+v))}
                                min={10} max={25} step={1} unit="ans"
                                help={t('help.boiler_lifetime')} />
                </div>
              </div>
              <div className="border-t border-ink-200/60 dark:border-ink-800 mt-3 pt-3">
                <ParamControl label={t('param.tes_capacity')}
                              value={manualCaps.tes_kwh} onChange={(v) => setCap('tes_kwh', v)}
                              min={0} max={5000} step={10} unit="kWh"
                              help={tesCapHelp} />
                <div className="mt-3">
                  <ParamControl label={t('param.tes_amort')}
                                value={params.thermal.tes.lifetime} onChange={(v) => set('thermal.tes.lifetime', Math.round(+v))}
                                min={10} max={30} step={1} unit="ans"
                                help={t('help.tes_lifetime')} />
                </div>
              </div>
            </Accordion>

            <Accordion title={t('sidebar.manual.grid')} icon={Zap}>
              <ParamControl label={t('param.grid_subscription_opt')}
                            value={manualCaps.grid_kw} onChange={(v) => setCap('grid_kw', v)}
                            min={0} max={10000} step={5} unit="kW"
                            help={gridSubHelp} />
            </Accordion>
          </>
        )}

        {/* ─────────────── STOCKAGE BATTERIE ─────────────── */}
        {mode !== 'simulate' && (
        <Accordion title={t('sidebar.accord.battery')} icon={BatteryCharging}
                   badge={enabled.battery ? t('badge.bess') : t('badge.off')}>
          <IncludeBanner
            enabled={enabled.battery}
            onToggle={(v) => setEnable('battery', v)}
            label={t('include.battery')}
            help={t('help.include_battery')}
          />
          <fieldset disabled={!enabled.battery} className={enabled.battery ? 'mt-3 space-y-3' : 'mt-3 space-y-3 opacity-50'}>
            <ParamControl label={t('param.bess_capex')}
                          value={params.storage.capex} onChange={(v) => set('storage.capex', v)}
                          min={100} max={1000} step={10} unit="€/kWh"
                          help={t('help.bess_capex')} />
            <ParamControl label={t('param.bess_inverter_capex')}
                          value={params.storage.inverter_capex} onChange={(v) => set('storage.inverter_capex', v)}
                          min={50} max={500} step={10} unit="€/kW"
                          help={t('help.bess_inverter_capex')} />
            <ParamControl label={t('param.bess_cycle_cost')}
                          value={params.storage.cycle_cost} onChange={(v) => set('storage.cycle_cost', +(+v).toFixed(3))}
                          min={0} max={0.2} step={0.005} unit="€/kWh"
                          help={t('help.bess_cycle_cost')} />
            <div className="mt-3">
              <ParamControl label={t('param.eff_ch')}
                            value={params.storage.eff_ch} onChange={(v) => set('storage.eff_ch', +(+v).toFixed(2))}
                            min={0.7} max={1} step={0.01} unit=""
                            help={t('help.eff_ch')} />
            </div>
            <div className="mt-3">
              <ParamControl label={t('param.eff_dis')}
                            value={params.storage.eff_dis} onChange={(v) => set('storage.eff_dis', +(+v).toFixed(2))}
                            min={0.7} max={1} step={0.01} unit=""
                            help={t('help.eff_dis')} />
            </div>
            <ParamControl label={t('param.min_soc')}
                          value={params.storage.min_soc} onChange={(v) => set('storage.min_soc', +(+v).toFixed(2))}
                          min={0} max={0.5} step={0.01} unit=""
                          help={t('help.min_soc')} />
            <ParamControl label={t('param.bess_lifetime')}
                          value={params.storage.lifetime} onChange={(v) => set('storage.lifetime', Math.round(+v))}
                          min={5} max={20} step={1} unit="ans"
                          help={t('help.bess_lifetime')} />
          </fieldset>
        </Accordion>
        )}

        {/* ─────────────── FLEXIBILITÉ ─────────────── */}
        <Accordion title={t('sidebar.accord.flex')} icon={Activity}
                   badge={`DR ${(params.economic.max_flex * 100).toFixed(0)}%${params.economic.num_evs ? ` · ${params.economic.num_evs} VE` : ''}`}>
          <div>
            <h4 className="text-[10px] font-semibold tracking-wider uppercase text-ink-500 dark:text-ink-400 mb-2">
              {t('flex.dr_label')}
            </h4>
            <ParamControl
              label={t('param.max_flex')}
              value={params.economic.max_flex}
              onChange={(v) => set('economic.max_flex', v)}
              min={0} max={0.5} step={0.01} unit="%" asPercent
              help={t('help.max_flex')}
            />
          </div>

          <div className="border-t border-ink-200/60 dark:border-ink-800 pt-3 mt-3">
            <h4 className="text-[10px] font-semibold tracking-wider uppercase text-ink-500 dark:text-ink-400 mb-2">
              {t('flex.ev_fleet')}
            </h4>
            <ParamControl
              label={t('param.num_evs')}
              value={params.economic.num_evs}
              onChange={(v) => set('economic.num_evs', Math.round(+v))}
              min={0} max={50} step={1} unit="véh."
              help={t('help.num_evs')}
            />
            <Toggle
              label={t('param.v2g_enabled')}
              checked={params.economic.v2g_enabled}
              onChange={(v) => set('economic.v2g_enabled', v)}
              icon={Car}
              help={t('help.v2g_enabled')}
            />
          </div>
        </Accordion>

        {/* ─────────────── THERMIQUE & GAZ ─────────────── */}
        {mode !== 'simulate' && (
        <>
        <SectionTitle>{t('sidebar.section.thermal_gas')}</SectionTitle>
        <Accordion title={t('sidebar.accord.heat')} icon={Thermometer}
                   badge={[enabled.hp && 'PAC', enabled.boiler && 'Chaud.']
                            .filter(Boolean).join(' · ') || t('badge.none')}>
          <Tabs
            value={thermTab}
            onChange={setThermTab}
            tabs={[
              { value: 'hp',     label: 'PAC',      icon: Thermometer, indicator: enabled.hp },
              { value: 'tes',    label: t('caps.tes'),   icon: Boxes },
              { value: 'boiler', label: t('series.gas_th_gen'),icon: Flame, indicator: enabled.boiler },
            ]}
          />

          <TabPanel value="hp" current={thermTab}>
            <IncludeBanner
              enabled={enabled.hp}
              onToggle={(v) => setEnable('hp', v)}
              label={t('include.hp')}
              help={t('help.include_hp')}
            />
            <fieldset disabled={!enabled.hp} className={enabled.hp ? '' : 'opacity-50'}>
              <div className="space-y-3">
                <ParamControl label={t('param.hp_capex')}
                              value={params.thermal.hp.capex} onChange={(v) => set('thermal.hp.capex', v)}
                              min={200} max={2000} step={50} unit="€/kW"
                              help={t('help.hp_capex')} />
                <ParamControl label={t('param.cop_hp')}
                              value={params.thermal.hp.cop} onChange={(v) => set('thermal.hp.cop', +(+v).toFixed(1))}
                              min={1.5} max={5} step={0.1} unit=""
                              help={t('help.cop_hp')} />
                <ParamControl label={t('param.hp_supply_temp')}
                              value={params.thermal.hp.supply_temp} onChange={(v) => set('thermal.hp.supply_temp', Math.round(+v))}
                              min={25} max={65} step={5} unit="°C"
                              help={t('help.hp_supply_temp')} />
                <ParamControl label={t('param.hp_lifetime')}
                              value={params.thermal.hp.lifetime} onChange={(v) => set('thermal.hp.lifetime', Math.round(+v))}
                              min={10} max={25} step={1} unit="ans"
                              help={t('help.hp_lifetime')} />
              </div>
            </fieldset>
          </TabPanel>

          <TabPanel value="tes" current={thermTab}>
            <p className="text-[11px] text-ink-500 dark:text-ink-400 mb-2">
              {tesAutoNote}
            </p>
            <ParamControl label={t('param.tes_capex')}
                          value={params.thermal.tes.capex} onChange={(v) => set('thermal.tes.capex', v)}
                          min={20} max={300} step={5} unit="€/kWh"
                          help={t('help.tes_capex')} />
            <ParamControl label={t('param.tes_lifetime')}
                          value={params.thermal.tes.lifetime} onChange={(v) => set('thermal.tes.lifetime', Math.round(+v))}
                          min={10} max={30} step={1} unit="ans"
                          help={t('help.tes_lifetime')} />
          </TabPanel>

          <TabPanel value="boiler" current={thermTab}>
            <IncludeBanner
              enabled={enabled.boiler}
              onToggle={(v) => setEnable('boiler', v)}
              label={t('include.boiler')}
              help={t('help.include_boiler')}
            />
            <fieldset disabled={!enabled.boiler} className={enabled.boiler ? '' : 'opacity-50'}>
              <div className="space-y-3">
                <ParamControl label={t('param.boiler_capex')}
                              value={params.thermal.boiler.capex} onChange={(v) => set('thermal.boiler.capex', v)}
                              min={50} max={500} step={10} unit="€/kW"
                              help={t('help.boiler_capex')} />
                <ParamControl label={t('param.boiler_eff')}
                              value={params.thermal.boiler.eff} onChange={(v) => set('thermal.boiler.eff', +(+v).toFixed(2))}
                              min={0.7} max={1} step={0.01} unit="η"
                              help={t('help.boiler_eff')} />
              </div>
            </fieldset>
          </TabPanel>
        </Accordion>

        {/* ─────────────── MOTEUR GAZ ─────────────── */}
        <Accordion title={t('sidebar.accord.gas_engine')} icon={Fuel}
                   badge={enabled.gas ? t('badge.on') : t('badge.off')}>
          <IncludeBanner
            enabled={enabled.gas}
            onToggle={(v) => setEnable('gas', v)}
            label={t('include.gas')}
            help={t('help.include_gas')}
          />
          <fieldset disabled={!enabled.gas} className={enabled.gas ? 'mt-3 space-y-3' : 'mt-3 space-y-3 opacity-50'}>
            <ParamControl label={t('param.gas_fuel')}
                          value={params.gas.fuel_price} onChange={(v) => set('gas.fuel_price', +(+v).toFixed(3))}
                          min={0.02} max={0.5} step={0.005} unit="€/kWh PCI"
                          help={t('help.gas_fuel')} />
            <ParamControl label={t('param.ramp_limit_kw')}
                          value={params.gas.ramp_limit_kw} onChange={(v) => set('gas.ramp_limit_kw', v)}
                          min={0} max={500} step={5} unit="kW/h"
                          help={t('help.ramp_limit_kw')} />
            <ParamControl label={t('param.gas_lifetime')}
                          value={params.gas.lifetime} onChange={(v) => set('gas.lifetime', Math.round(+v))}
                          min={10} max={25} step={1} unit="ans"
                          help={t('help.gas_lifetime')} />
          </fieldset>
        </Accordion>
        </>
        )}

        {/* ─────────────── ÉCONOMIE & RÉSEAU ─────────────── */}
        <SectionTitle>{t('sidebar.section.economy')}</SectionTitle>
        <Accordion title={t('sidebar.accord.grid')} icon={Coins}>
          <Toggle
            label={t('param.grid_connected')}
            checked={params.grid.connected}
            onChange={(v) => {
              set('grid.connected', v);
              if (!v) set('grid.use_spot_market', false);
            }}
            icon={Zap}
            help={t('help.grid_connected')}
          />
          <Toggle
            label={t('param.use_spot_market')}
            checked={params.grid.use_spot_market}
            onChange={(v) => set('grid.use_spot_market', v)}
            disabled={!params.grid.connected}
            help={params.grid.connected
              ? HELP.use_spot_market
              : "Nécessite d'être connecté au réseau pour activer le marché spot."}
          />
          <fieldset
            disabled={!params.grid.connected || params.grid.use_spot_market}
            className={
              'space-y-3 mt-3 ' +
              (!params.grid.connected || params.grid.use_spot_market ? 'opacity-50' : '')
            }
          >
            {params.grid.use_spot_market && (
              <p className="text-[10px] text-ink-500 dark:text-ink-400 italic px-1">
                {spotIgnored}
              </p>
            )}
            <ParamControl label={t('param.grid_peak_price')}
                          value={params.grid.peak_price} onChange={(v) => set('grid.peak_price', +(+v).toFixed(3))}
                          min={0.05} max={1} step={0.01} unit="€/kWh"
                          help={t('help.grid_peak_price')} />
            <ParamControl label={t('param.grid_offpeak_price')}
                          value={params.grid.offpeak_price} onChange={(v) => set('grid.offpeak_price', +(+v).toFixed(3))}
                          min={0.02} max={0.5} step={0.005} unit="€/kWh"
                          help={t('help.grid_offpeak_price')} />
            <ParamControl label={t('param.grid_sell_price')}
                          value={params.grid.sell_price} onChange={(v) => set('grid.sell_price', +(+v).toFixed(3))}
                          min={0} max={0.3} step={0.005} unit="€/kWh"
                          help={t('help.grid_sell_price')} />
            <ParamControl label={t('param.demand_charge')}
                          value={params.grid.demand_charge} onChange={(v) => set('grid.demand_charge', v)}
                          min={0} max={50} step={1} unit="/mois"
                          help={t('help.demand_charge')} />
            <ParamControl label={t('param.cable_capex')}
                          value={params.economic.cable_capex} onChange={(v) => set('economic.cable_capex', v)}
                          min={0} max={500} step={10} unit="€/kW peak"
                          help={t('help.cable_capex')} />
          </fieldset>
        </Accordion>

        <Accordion title={t('sidebar.accord.finance')} icon={Sliders}>
          <ParamControl label={t('param.discount_rate')}
                        value={params.economic.discount_rate} onChange={(v) => set('economic.discount_rate', v)}
                        min={0} max={0.15} step={0.005} unit="%" asPercent
                        help={t('help.discount_rate')} />
          <ParamControl label={t('param.grid_inflation')}
                        value={params.economic.grid_inflation} onChange={(v) => set('economic.grid_inflation', v)}
                        min={0} max={0.10} step={0.005} unit="%/an" asPercent
                        help={t('help.grid_inflation')} />
          <ParamControl label={t('param.gas_inflation')}
                        value={params.economic.gas_inflation} onChange={(v) => set('economic.gas_inflation', v)}
                        min={0} max={0.10} step={0.005} unit="%/an" asPercent
                        help={t('help.gas_inflation')} />
          <ParamControl label={t('param.om_inflation')}
                        value={params.economic.om_inflation} onChange={(v) => set('economic.om_inflation', v)}
                        min={0} max={0.10} step={0.005} unit="%/an" asPercent
                        help={t('help.om_inflation')} />
          <ParamControl label={t('param.voll')}
                        value={params.economic.voll} onChange={(v) => set('economic.voll', v)}
                        min={0.5} max={20} step={0.5} unit="€/kWh"
                        help={t('help.voll')} />
        </Accordion>

        {/* ─────────────── MODÉLISATION ─────────────── */}
        <SectionTitle>{t('sidebar.section.modeling')}</SectionTitle>

        {/* Résolution temporelle */}
        <Accordion title={t('sidebar.accord.resolution')} icon={Clock}>
          <SelectField
            label={t('param.resolution')}
            value={params.economic.resolution || '288h'}
            onChange={(v) => set('economic.resolution', v)}
            options={[
              { value: '288h', label: t('resolution.288h') },
              { value: '672h', label: t('resolution.672h') },
              { value: '8760h', label: t('resolution.8760h') },
            ]}
            help={t('help.resolution')}
          />
        </Accordion>

        {/* Risque & Sensibilité */}
        <Accordion title={t('sidebar.accord.risk')} icon={ShieldCheck}>
          <Toggle
            label={t('param.p90_mode')}
            checked={params.economic.p90_mode}
            onChange={(v) => {
              set('economic.p90_mode', v);
              if (v) set('economic.stochastic', false);
            }}
            help={t('help.p90_mode')}
            disabled={params.economic.stochastic}
          />
          <Toggle
            label={t('param.stochastic')}
            checked={params.economic.stochastic}
            onChange={(v) => {
              set('economic.stochastic', v);
              if (v) set('economic.p90_mode', false);
            }}
            help={t('help.stochastic')}
            disabled={params.economic.p90_mode}
          />
          {params.economic.stochastic && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 ml-1">
              {params.economic.resolution === '8760h'
                ? t('stochastic.time_8760h')
                : params.economic.resolution === '672h'
                  ? t('stochastic.time_672h')
                  : t('stochastic.time_288h')}
            </p>
          )}
          <Toggle
            label={t('param.extreme_events')}
            checked={params.economic.extreme_events}
            onChange={(v) => set('economic.extreme_events', v)}
            help={t('help.extreme_events')}
            disabled={params.economic.resolution !== '8760h'}
          />
          {params.economic.extreme_events && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 ml-1">
              ~2 min (8760h)
            </p>
          )}
          {params.economic.extreme_events && params.economic.resolution !== '8760h' && (
            <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 ml-1">
              {t('extreme.requires_8760h')}
            </p>
          )}
          <Toggle
            label={t('param.n1_reserve')}
            checked={params.economic.n1_reserve}
            onChange={(v) => set('economic.n1_reserve', v)}
            icon={ShieldCheck}
            help={t('help.n1_reserve')}
          />
          <Toggle
            label={t('param.run_sensitivity')}
            checked={params.economic.run_sensitivity}
            onChange={(v) => set('economic.run_sensitivity', v)}
            help={t('help.run_sensitivity')}
          />
          <ParamControl
            label={t('param.forecast_error')}
            value={params.economic.forecast_error}
            onChange={(v) => set('economic.forecast_error', v)}
            min={0} max={0.5} step={0.05} unit="%" asPercent
            help={t('help.forecast_error')}
          />
        </Accordion>

        {/* Budget carbone */}
        <Accordion title={t('sidebar.accord.carbon')} icon={Leaf}>
          <ParamControl
            label={t('param.max_annual_co2_t')}
            value={params.economic.max_annual_co2_t}
            onChange={(v) => set('economic.max_annual_co2_t', v)}
            min={0} max={5000} step={50} unit="t CO₂/an"
            help={t('help.max_annual_co2_t')}
          />
        </Accordion>
      </div>

      {/* Footer actions */}
      <div className="border-t border-ink-200/70 dark:border-ink-800 p-4 bg-white/80 dark:bg-ink-900/80 backdrop-blur space-y-2">
        <button
          onClick={onRun}
          disabled={loading}
          className="relative w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-brand-600/60 text-white text-sm font-semibold shadow-glow transition-colors"
        >
          {loading ? (
            <><Spinner size={14} /> {mode === 'simulate' ? t('button.simulating') : t('button.optimizing')}</>
          ) : (
            <><Play size={14} /> {mode === 'simulate' ? t('button.run_simulate') : t('button.run_optimize')}</>
          )}
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80">
            <HelpTip>{HELP.run}</HelpTip>
          </span>
        </button>
        <button
          onClick={onReset}
          className="relative w-full inline-flex items-center justify-center gap-2 h-9 rounded-xl border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800/60 text-xs font-medium text-ink-600 dark:text-ink-300 transition-colors"
        >
          <RotateCcw size={12} /> {t('button.reset')}
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <HelpTip>{HELP.reset}</HelpTip>
          </span>
        </button>
      </div>
    </aside>
  );
}