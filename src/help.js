// ═══════════════════════════════════════════════════════════════════════════
// Aide contextuelle — chaque entrée explique le paramètre + les hypothèses
// utilisées pour la valeur par défaut. Affiché par <HelpTip /> au survol du "?".
// ═══════════════════════════════════════════════════════════════════════════

export const HELP = {
  // ── Site & Localisation ────────────────────────────────────────────────
  location:
    "Coordonnées GPS du site. Les profils PV (PVGIS) et vent (Open-Meteo) sont récupérés automatiquement pour cette position. Cliquez sur la carte ou glissez le marqueur pour positionner.",
  latitude: "Latitude du site en degrés décimaux (ex. 48.85 pour Paris).",
  longitude: "Longitude du site en degrés décimaux (ex. 2.35 pour Paris).",

  // ── Usages ─────────────────────────────────────────────────────────────
  num_homes:
    "Nombre d'unités raccordées au microgrid (foyers, logements, bureaux). Le profil de charge résidentiel normalisé est multiplié par num_homes × peak_per_home pour reconstituer la demande totale 24h.",
  peak_per_home:
    "Puissance crête par unité, en kW. Hypothèses typiques : foyer FR ≈ 2-6 kW, bureau ≈ 2-5 kW, industriel léger ≈ 10-50 kW.",
  seasonality:
    "Surconsommation hivernale appliquée mois par mois : ×(1+S) en jan/déc, ×(1+0.7S) en nov, ×(1+0.5S) en mars, ×(1+0.2S) en avril, ×1 le reste de l'année. Conforme au profil résidentiel français.",
  commercial_power:
    "Puissance commerce/tertiaire ajoutée en journée (8h-18h uniquement). S'ajoute à la charge résidentielle. 0 kW = pas d'activité tertiaire sur site.",

  // ── Solaire ─────────────────────────────────────────────────────────────
  solar_capex:
    "Coût d'investissement panneaux + structure + main d'œuvre, par kWc installé. Hors onduleur. Hypothèse 2024 : 600 €/kWc en moyenne marché EU pour installations <500 kWc.",
  solar_lifetime:
    "Durée de vie économique du module PV. Garantie constructeur typique : 25 ans (perte ≤20% sur la période). Utilisé dans le CRF pour annualiser le CAPEX.",
  solar_degradation:
    "Perte de performance annuelle du module. Hypothèse : 0.5 %/an pour modules récents (Tier 1). Cumulé sur 25 ans : ~12 % de perte de production.",
  solar_inverter_capex:
    "Coût onduleur AC, par kW. Hypothèse : 150 €/kW. À renouveler tous les solar_inverter_lifetime ans (généralement 1 fois sur l'horizon 25 ans).",
  solar_inverter_lifetime:
    "Durée de vie de l'onduleur AC, plus courte que les panneaux. Typique : 10 ans → un remplacement à mi-cycle PV.",

  // ── Éolien ──────────────────────────────────────────────────────────────
  wind_capex:
    "Coût total éolienne onshore par kW. Hypothèse 2024 : 1500 €/kW pour <500 kW (petit éolien). Grandes turbines : 1200 €/kW.",
  wind_lifetime:
    "Durée de vie économique de la turbine. Typique : 20 ans (renouvellement non modélisé sur 25 ans).",

  // ── Hydro ───────────────────────────────────────────────────────────────
  hydro_capex:
    "Coût d'installation petite hydroélectrique, par kW. Très variable selon site (génie civil). Hypothèse : 2500 €/kW (moyenne micro-hydro EU).",
  hydro_flow:
    "Coefficient de disponibilité du débit hydraulique. 1.0 = débit nominal toute l'année, 0.5 = moitié du temps utilisable, 0 = pas d'hydro disponible. Multiplie la production sur les 288 heures.",
  hydro_lifetime:
    "Durée de vie d'une turbine hydraulique. Très long terme : 30+ ans typique. Génie civil souvent >50 ans.",

  // ── Batterie BESS ───────────────────────────────────────────────────────
  bess_capex:
    "Coût total cellules + BMS + thermique, hors onduleur, par kWh stocké. Lithium-ion 2024 : ~300 €/kWh. Tendance prix : -10%/an.",
  bess_inverter_capex:
    "Onduleur bidirectionnel pour la batterie, par kW de puissance. Hypothèse : 150 €/kW. Détermine la puissance max de charge/décharge.",
  bess_lifetime:
    "Durée de vie économique de la batterie. Hypothèse : 10 ans → un remplacement à mi-horizon dans le calcul de cashflow.",
  bess_inverter_lifetime:
    "Durée de vie onduleur batterie. Identique à l'onduleur PV : 10 ans typique.",
  bess_cycle_cost:
    "Coût d'usure marginal facturé à chaque kWh déchargé. Hypothèse : 0.05 €/kWh, équivalent à ~6 000 cycles à 300 €/kWh CAPEX. Décourage les cycles inutiles dans le LP.",
  eff_ch:
    "Rendement de charge AC→DC. Lithium-ion : 0.95 (95 %). Plomb-acide : 0.85. Round-trip = eff_ch × eff_dis ≈ 0.90.",
  eff_dis:
    "Rendement de décharge DC→AC. Lithium-ion : 0.95. Round-trip avec eff_ch : ~90 % d'énergie récupérable.",
  min_soc:
    "État de charge minimum maintenu pour préserver la durée de vie. Recommandé : 20 % pour Li-ion. 0 % = stress maximal, vie raccourcie. La capacité utile est ainsi (1 - min_soc) × cap_b.",

  // ── Flexibilité & VE ───────────────────────────────────────────────────
  max_flex:
    "Part de la charge déplaçable dans la journée (Demand Response / Load-Shifting). 10 % = 10 % de chaque heure peut être avancée OU retardée. La somme journalière est strictement conservée (pas de réduction nette de conso).",
  num_evs:
    "Nombre de véhicules électriques connectés au microgrid. Capacité fixe 50 kWh/véh. Charge entre 18h et 7h, décharge journalière de 10 kWh (commute matin).",
  v2g_enabled:
    "Vehicle-to-Grid : autorise les VE à réinjecter dans le microgrid pendant les heures connectées (18h-7h). Crée une batterie virtuelle additionnelle de num_evs × 50 kWh.",

  // ── Thermique ──────────────────────────────────────────────────────────
  thermal_ratio:
    "Demande thermique = ratio × demande électrique. 0 = pas de besoin thermique. 0.5 = demi-journée de chauffage. 1.0 = autant de chaleur que d'électricité (logement chauffé électriquement reconverti).",
  hp_capex:
    "Coût pompe à chaleur installée, par kW de puissance thermique délivrée. Hypothèse : 800 €/kW pour PAC air-eau résidentiel. Géothermie : 1500-2500 €/kW.",
  cop_hp:
    "Coefficient de Performance — kWh chaleur produit / kWh élec consommé. PAC air-eau moderne : 3-3.5 (3.0 par défaut). Géothermie : 4-5. À température basse : ~2.",
  hp_lifetime:
    "Durée de vie de la pompe à chaleur. Hypothèse : 15 ans. Maintenance régulière du compresseur requise.",
  tes_capex:
    "Coût ballon thermique d'eau chaude (TES), par kWh stocké. Hypothèse : 50 €/kWh (ballon 200-300 L = 10-15 kWh).",
  tes_lifetime:
    "Durée de vie du ballon thermique. Hypothèse : 20 ans. Inox bien entretenu.",
  boiler_capex:
    "Coût chaudière gaz par kW thermique installé. Hypothèse : 150 €/kW pour chaudière condensation moderne.",
  boiler_eff:
    "Rendement de la chaudière : kWh chaleur utile / kWh PCI gaz consommé. Condensation moderne : 0.90-0.95. Ancienne génération : 0.70-0.85.",
  boiler_lifetime:
    "Durée de vie économique de la chaudière. Hypothèse : 15 ans. Entretien annuel obligatoire.",

  // ── Moteur Gaz ─────────────────────────────────────────────────────────
  gas_fuel:
    "Prix unitaire du gaz, en €/kWh PCI (Pouvoir Calorifique Inférieur). Hypothèse 2024 : 0.20 €/kWh PCI hors taxes. Prix très volatil (geopol).",
  gas_lifetime:
    "Durée de vie économique du moteur gaz. Hypothèse : 15 ans. Maintenance régulière (filtre, huile) à prévoir.",
  ramp_limit_kw:
    "Variation max de puissance par heure du moteur gaz. 0 = pas de contrainte (LP idéal). Moteur réel : 50-200 kW/h selon technologie.",

  // ── Réseau ─────────────────────────────────────────────────────────────
  grid_connected:
    "Microgrid connecté au réseau public. Permet l'achat/vente d'électricité. Si décoché : autonomie totale (les déficits éventuels deviennent du délestage à VOLL €/kWh).",
  use_spot_market:
    "Utilise les prix spot horaires (24 valeurs synthétiques calquées sur EPEX) au lieu des tarifs HC/HP fixes. Nécessite d'être connecté au réseau. Si activé, les prix HP/HC/vente sont ignorés.",
  grid_peak_price:
    "Tarif d'achat heures pleines (8h-20h). Hypothèse 2024 : 0.25 €/kWh TTC pour client pro EDF Tarif Bleu. Ignoré si marché spot activé.",
  grid_offpeak_price:
    "Tarif d'achat heures creuses (0h-8h et 20h-24h). Hypothèse : 0.12 €/kWh TTC. Ignoré si marché spot activé.",
  grid_sell_price:
    "Prix de revente du surplus PV. Hypothèse FR : 0.10 €/kWh (moyenne tarif Obligation d'Achat). Ignoré si marché spot activé (alors prix spot - 0.02 €).",
  demand_charge:
    "Abonnement réseau lié à la puissance souscrite. Hypothèse : 10 €/kW/mois pour BT/HTA pro. La souscription optimale est calculée par le LP (variable max_grid).",
  cable_capex:
    "Coût du raccordement HTA, par kW de puissance crête de l'installation. Forfait initial unique. Hypothèse : 150 €/kW peak (ENEDIS bridé / sur-mesure variable).",

  // ── Hypothèses Financières ─────────────────────────────────────────────
  discount_rate:
    "Taux d'actualisation pour la VAN (WACC du projet). 5 % = projet faiblement risqué (collectivité, garantie d'État). 8-10 % = capital privé. Plus le taux est élevé, plus la VAN diminue.",
  grid_inflation:
    "Inflation annuelle composée appliquée au prix du réseau sur 25 ans. Hypothèse : 4 %/an (tendance long terme tarif réglementé FR).",
  gas_inflation:
    "Inflation gaz. Plus volatile que le réseau électrique. Hypothèse conservatrice : 2 %/an base.",
  om_inflation:
    "Inflation des coûts d'Opération & Maintenance (2 % du CAPEX/an). Hypothèse : 2 %/an (alignée sur cible BCE).",
  voll:
    "Value Of Lost Load — pénalité économique du délestage involontaire (€/kWh non livré). Standard FR : 5 €/kWh résidentiel, 26 €/kWh moyenne EU. Industrie sensible : 50+ €/kWh.",

  // ── Modélisation ───────────────────────────────────────────────────────
  p90_mode:
    "Scénario pessimiste P90 : réduit la production renouvelable de 15 % (couverture probabiliste 90 %) et augmente la charge de 10 %. Permet de dimensionner pour des conditions défavorables, garantit la résilience.",
  forecast_error:
    "Bruit blanc ±X % appliqué uniformément aux profils PV/vent. 0 % = profils nominaux. 20 % = forte incertitude. Utilisé pour stresser le dispatch (test robustesse).",
  run_sensitivity:
    "Active l'analyse Tornado : exécute jusqu'à 16 optimisations supplémentaires (±20 % sur 8 paramètres clés). Coût : +5-10s de calcul. Utile pour identifier les leviers de rentabilité.",
  max_annual_co2_t:
    "Plafond LP sur les émissions annuelles de CO₂ (en tonnes). 0 = pas de contrainte. Si activé, le LP intègre la contrainte pulp.lpSum(emissions) ≤ max et peut rendre le problème infaisable.",
  n1_reserve:
    "Contrainte de réserve N-1 : pour chaque heure, la capacité de réserve (batterie + groupe gaz + réseau) doit pouvoir compenser la perte du plus gros producteur (solaire, éolien, hydro ou gaz). Garantit la couverture de la charge en cas de défaillance d'un équipement. Dimensionne la batterie et le backup pour la résilience.",

  // ── Boutons / Actions ──────────────────────────────────────────────────
  btn_run:
    "Lance l'optimisation linéaire (solveur CBC). Calcule le dimensionnement optimal de tous les actifs et la trajectoire 25 ans (cashflow + carbone). Durée typique : 1-10 secondes selon l'analyse de sensibilité.",
  btn_reset:
    "Restaure tous les paramètres, la localisation et les toggles d'inclusion à leur valeur par défaut.",
  btn_csv:
    "Télécharge un fichier CSV multi-sections : KPIs, capacités, OPEX, cashflow 25 ans, données horaires (288h × 17 séries ou 8760h × 17 séries), sensibilité et paramètres en entrée. Encoding UTF-8 BOM pour Excel.",
  btn_pdf:
    "Génère un rapport PDF formaté : page de garde avec localisation, paramètres groupés par catégorie, et capture des graphiques. Le bilan énergétique est exporté en vue annuelle (288h consécutives ou 8760h).",
  btn_sidebar:
    "Masque ou affiche la barre latérale de configuration pour gagner de la place sur le dashboard.",
  btn_theme:
    "Bascule entre mode clair et sombre. Le mode clair est privilégié par défaut.",
  btn_month:
    "Sélectionne la vue temporelle du Bilan énergétique horaire : moyenne annuelle, année entière (288h ou 8760h consécutives) ou un mois précis.",
  btn_8760h:
    "Active la résolution 8760h : le solveur optimise chaque heure réelle d'une année complète (PVGIS + Open-Meteo 2020) au lieu des 12 jours-types (288h). LP uniquement (pas de MILP). Calcul plus long (~10-60s).",
  btn_stochastic:
    "Analyse P90 multi-années (M5) : chaque année NASA POWER réelle (2013–2022) devient un scénario météo indépendant. L'optimiseur tourne ~10 fois (une par année), produisant une distribution réelle des KPIs (P10/P50/P90). Remplace le P90 forfaitaire. Temps de calcul : ~30s en 288h, ~80s en 672h, ~10 min en 8760h.",
  btn_extreme_events:
    "Stress-test événements extrêmes (M6) : scanne les 8760h de 2020 pour détecter les pires séquences de dark doldrums (vent faible + soleil faible), vague de froid (T° < −5°C + charge thermique élevée) et canicule (T° > 30°C + fort soleil). Analyse la résilience du système sur chaque séquence (couverture, délestage, backup). Nécessite la résolution 8760h. ~2 min de calcul.",

  // ── Toggles spécifiques ────────────────────────────────────────────────
  include_solar:
    "Inclut le solaire dans la modélisation. Décocher pour exclure le PV du LP (CAPEX saturé à 1e6 → le solveur retourne 0 kWc installé).",
  include_wind:
    "Inclut l'éolien dans la modélisation. Décocher pour l'exclure (CAPEX saturé).",
  include_hydro:
    "Inclut l'hydroélectrique. Décocher pour l'exclure (hydro_flow = 0 → disponibilité nulle).",
  include_battery:
    "Inclut le stockage batterie. Décocher pour exclure le BESS (CAPEX saturé).",
  include_gas:
    "Inclut le moteur gaz comme génération de secours. Décocher = gas_fuel saturé à 1000 €/kWh (LP préfère le délestage).",
  include_hp:
    "Inclut une pompe à chaleur pour la production de chaleur. Décocher = CAPEX saturé.",
  include_boiler:
    "Inclut une chaudière gaz pour la production de chaleur. Décocher = CAPEX saturé.",
};
