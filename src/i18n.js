import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// ───────────────────────────────────────────────────────────────────────────
// Dictionnaire de traductions FR / EN
// ───────────────────────────────────────────────────────────────────────────
const DICT = {
  // ── Header ────────────────────────────────────────────────────────────
  'header.title':                  { fr: 'Tableau de bord',                 en: 'Dashboard' },
  'header.subtitle':               { fr: 'Dimensionnement & dispatch optimal sur 25 ans', en: 'Optimal sizing & dispatch over 25 years' },
  'header.export.csv':             { fr: 'Exporte tous les résultats au format CSV : KPIs, capacités, OPEX, cashflow & carbone 25 ans, données horaires (288h ou 8760h), sensibilité, paramètres en entrée.', en: 'Exports all results as CSV: KPIs, capacities, OPEX, 25-year cashflow & carbon, hourly data (288h or 8760h), sensitivity, input parameters.' },
  'header.export.pdf':             { fr: 'Génère un rapport PDF : page 1 = localisation, pages suivantes = paramètres en entrée, puis chaque graphique avec son titre.', en: 'Generates a PDF report: page 1 = location, following pages = input parameters by category, then each chart with its title.' },
  'header.tutorial':               { fr: 'Tutoriel',                       en: 'Tutorial' },
  'header.how_it_works':           { fr: 'Comment ça marche ?',        en: 'How it works ?' },
  'header.code_python':            { fr: 'Code Python',                    en: 'Python Code' },
  'header.toggle_sidebar_hide':    { fr: 'Masquer la barre latérale pour afficher les résultats en plein écran.', en: 'Hide sidebar to display results in full screen.' },
  'header.toggle_sidebar_show':    { fr: 'Afficher la barre latérale de configuration.', en: 'Show configuration sidebar.' },
  'header.toggle_dark':            { fr: 'Passer en mode clair (fond blanc).', en: 'Switch to light mode (white background).' },
  'header.toggle_light':           { fr: 'Passer en mode sombre (fond foncé).', en: 'Switch to dark mode (dark background).' },
  'header.lang':                   { fr: 'Français',                       en: 'English' },
  'header.lang.next':              { fr: 'English',                        en: 'Français' },
  'header.lang.tooltip':           { fr: 'Passer en anglais.',             en: 'Switch to French.' },

  // ── Sidebar — Mode ────────────────────────────────────────────────────
  'sidebar.mode':                  { fr: 'Mode',                           en: 'Mode' },
  'sidebar.mode.optimize':         { fr: 'Optimisation',                   en: 'Optimization' },
  'sidebar.mode.simulate':         { fr: 'Paramétrage',                    en: 'Custom sizing' },
  'sidebar.mode.simulate.hint':    { fr: 'Les capacités sont fixées manuellement. Le solveur optimise uniquement le dispatch horaire.', en: 'Capacities are set manually. The solver only optimizes hourly dispatch.' },
  'sidebar.sources.active':        { fr: 'sources actives',                en: 'active sources' },
  'sidebar.sources.dispatch':      { fr: 'Dispatch 25 ans',                en: '25-year dispatch' },

  // ── Sidebar — Sections ────────────────────────────────────────────────
  'sidebar.section.site':          { fr: 'Site',                           en: 'Site' },
  'sidebar.section.demand':        { fr: 'Demande',                        en: 'Demand' },
  'sidebar.section.production':    { fr: 'Production',                     en: 'Generation' },
  'sidebar.section.manual_caps':   { fr: 'Capacités manuelles',            en: 'Manual capacities' },
  'sidebar.section.thermal_gas':   { fr: 'Thermique & Gaz',                en: 'Thermal & Gas' },
  'sidebar.section.economy':       { fr: 'Économie',                       en: 'Economics' },
  'sidebar.section.modeling':      { fr: 'Modélisation',                   en: 'Modeling' },

  // ── Sidebar — Accordion titles ────────────────────────────────────────
  'sidebar.accord.location':       { fr: 'Localisation',                   en: 'Location' },
  'sidebar.accord.usage':          { fr: 'Usages & Demande',               en: 'Usage & Demand' },
  'sidebar.accord.renewables':     { fr: 'Énergies renouvelables',         en: 'Renewable energy' },
  'sidebar.accord.battery':        { fr: 'Stockage batterie',              en: 'Battery storage' },
  'sidebar.accord.flex':           { fr: 'Flexibilité & VE',               en: 'Flexibility & EVs' },
  'sidebar.accord.heat':           { fr: 'Production de chaleur',          en: 'Heat production' },
  'sidebar.accord.gas_engine':     { fr: 'Moteur gaz (groupe)',            en: 'Gas engine (genset)' },
  'sidebar.accord.grid':           { fr: 'Réseau & Tarification',          en: 'Grid & Pricing' },
  'sidebar.accord.finance':        { fr: 'Hypothèses financières',         en: 'Financial assumptions' },
  'sidebar.accord.resolution':     { fr: 'Résolution temporelle',          en: 'Temporal resolution' },
  'sidebar.accord.risk':           { fr: 'Risque & Sensibilité',           en: 'Risk & Sensitivity' },
  'sidebar.accord.carbon':         { fr: 'Budget carbone',                 en: 'Carbon budget' },

  // ── Sidebar — Manual capacity accordions ──────────────────────────────
  'sidebar.manual.solar':          { fr: 'Solaire & Onduleur',             en: 'Solar & Inverter' },
  'sidebar.manual.wind':           { fr: 'Éolien',                         en: 'Wind' },
  'sidebar.manual.hydro':          { fr: 'Hydro',                          en: 'Hydro' },
  'sidebar.manual.battery':        { fr: 'Batterie (BESS)',                en: 'Battery (BESS)' },
  'sidebar.manual.gas':            { fr: 'Moteur gaz',                     en: 'Gas engine' },
  'sidebar.manual.thermal':        { fr: 'Thermique',                      en: 'Thermal' },
  'sidebar.manual.grid':           { fr: 'Réseau',                         en: 'Grid' },

  // ── Sidebar — Param labels ────────────────────────────────────────────
  'param.num_homes':               { fr: 'Nb foyers / unités',             en: 'Nb homes / units' },
  'param.peak_per_home':           { fr: 'Puissance max / unité',          en: 'Peak power / unit' },
  'param.seasonality':             { fr: 'Surconsommation hiver',          en: 'Winter overconsumption' },
  'param.commercial_power':        { fr: 'Commerces (8h-18h)',             en: 'Commercial load (8am-6pm)' },
  'param.thermal_ratio':           { fr: 'Ratio besoin thermique',         en: 'Thermal load ratio' },
  'param.estimated_peak':          { fr: 'Pic estimé total',               en: 'Estimated total peak' },

  'param.solar_capex':             { fr: 'CAPEX Panneaux',                 en: 'PV CAPEX' },
  'param.solar_lifetime':          { fr: 'Amortissement',                  en: 'Lifetime' },
  'param.solar_degradation':       { fr: 'Dégradation',                    en: 'Degradation' },
  'param.solar_inverter_capex':    { fr: 'CAPEX Onduleur AC',              en: 'Inverter CAPEX' },
  'param.solar_inverter_lifetime': { fr: 'Amort. Onduleur',                en: 'Inverter lifetime' },
  'param.max_solar_kw':            { fr: 'Solaire maximum (surface)',      en: 'Max solar (area)' },
  'param.solar_pv_power':          { fr: 'Puissance PV',                   en: 'PV power' },
  'param.solar_inv_power':         { fr: 'Puissance onduleur',             en: 'Inverter power' },
  'param.solar_deg':               { fr: 'Dégradation PV',                 en: 'PV degradation' },
  'param.solar_amort_pv':          { fr: 'Amort. PV',                      en: 'PV lifetime' },
  'param.solar_amort_inv':         { fr: 'Amort. Onduleur',                en: 'Inverter lifetime' },

  'param.wind_capex':              { fr: 'CAPEX Éolienne',                 en: 'Wind CAPEX' },
  'param.wind_lifetime':           { fr: 'Amortissement',                  en: 'Lifetime' },
  'param.max_wind_kw':             { fr: 'Éolien maximum (terrain)',       en: 'Max wind (land)' },
  'param.wind_power':              { fr: 'Puissance éolienne',             en: 'Wind power' },

  'param.hydro_capex':             { fr: 'CAPEX Turbine',                  en: 'Turbine CAPEX' },
  'param.hydro_flow':              { fr: 'Débit disponible',               en: 'Available flow' },
  'param.hydro_lifetime':          { fr: 'Amortissement',                  en: 'Lifetime' },
  'param.max_hydro_kw':            { fr: 'Hydro maximum (débit réel)',     en: 'Max hydro (real flow)' },
  'help.max_hydro_kw':             { fr: "Puissance hydroélectrique maximale installable — dépend du débit de la rivière et de la hauteur de chute du site. Contrairement au solaire et à l'éolien, le potentiel hydro est strictement limité par la ressource. 0 = pas de limite (peu réaliste).", en: 'Maximum installable hydro power — depends on the river flow and head at the site. Unlike solar and wind, hydro potential is strictly limited by the resource. 0 = no limit (unrealistic).' },
  'param.hydro_power':             { fr: 'Puissance hydraulique',          en: 'Hydro power' },

  'param.bess_capex':              { fr: 'CAPEX Cellule',                  en: 'Cell CAPEX' },
  'param.bess_inverter_capex':     { fr: 'CAPEX Onduleur',                 en: 'Inverter CAPEX' },
  'param.bess_cycle_cost':         { fr: 'Coût de cyclage',                en: 'Cycle cost' },
  'param.eff_ch':                  { fr: 'η charge',                       en: 'η charge' },
  'param.eff_dis':                 { fr: 'η décharge',                     en: 'η discharge' },
  'param.min_soc':                 { fr: 'SOC minimum',                    en: 'Min SOC' },
  'param.bess_lifetime':           { fr: 'Durée de vie',                   en: 'Lifetime' },
  'param.bess_inverter_lifetime':  { fr: 'Amort. Onduleur',                en: 'Inverter lifetime' },
  'param.bess_capacity':           { fr: 'Capacité batterie',              en: 'Battery capacity' },
  'param.bess_inv_power':          { fr: 'Puissance onduleur',             en: 'Inverter power' },
  'param.bess_amort_batt':         { fr: 'Amort. Batterie',                en: 'Battery lifetime' },
  'param.bess_amort_inv':          { fr: 'Amort. Onduleur',                en: 'Inverter lifetime' },

  'param.max_flex':                { fr: 'Flexibilité Load-Shift',         en: 'Load-shift flexibility' },
  'param.num_evs':                 { fr: 'Nombre de VE',                   en: 'Number of EVs' },
  'param.v2g_enabled':             { fr: 'V2G — batterie sur roues',       en: 'V2G — battery on wheels' },

  'param.hp_capex':                { fr: 'CAPEX PAC',                      en: 'Heat pump CAPEX' },
  'param.cop_hp':                  { fr: 'COP',                            en: 'COP' },
  'param.hp_lifetime':             { fr: 'Durée de vie',                   en: 'Lifetime' },
  'param.tes_capex':               { fr: 'CAPEX Ballon',                   en: 'TES CAPEX' },
  'param.tes_lifetime':            { fr: 'Durée de vie',                   en: 'Lifetime' },
  'param.boiler_capex':            { fr: 'CAPEX Chaudière',                en: 'Boiler CAPEX' },
  'param.boiler_eff':              { fr: 'Rendement',                      en: 'Efficiency' },
  'param.boiler_lifetime':         { fr: 'Durée de vie',                   en: 'Lifetime' },
  'param.hp_power':                { fr: 'Puissance PAC',                  en: 'HP power' },
  'param.hp_cop':                  { fr: 'COP',                            en: 'COP' },
  'param.hp_amort':                { fr: 'Amort. PAC',                     en: 'HP lifetime' },
  'param.boiler_power':            { fr: 'Puissance chaudière',            en: 'Boiler power' },
  'param.boiler_rendement':        { fr: 'Rendement',                      en: 'Efficiency' },
  'param.boiler_amort':            { fr: 'Amort. Chaud.',                  en: 'Boiler lifetime' },
  'param.tes_capacity':            { fr: 'Ballon TES',                     en: 'TES capacity' },
  'param.tes_amort':               { fr: 'Amort. Ballon',                  en: 'TES lifetime' },

  'param.gas_fuel':                { fr: 'Prix du gaz',                    en: 'Gas price' },
  'param.ramp_limit_kw':           { fr: 'Limite de rampe',                en: 'Ramp limit' },
  'param.gas_lifetime':            { fr: 'Durée de vie',                   en: 'Lifetime' },
  'param.gas_power':               { fr: 'Puissance groupe gaz',           en: 'Gas genset power' },
  'param.gas_rampe':               { fr: 'Limite de rampe',                en: 'Ramp limit' },

  'param.grid_connected':          { fr: 'Connecté au réseau',             en: 'Grid-connected' },
  'param.use_spot_market':         { fr: 'Marché spot horaire',            en: 'Spot market' },
  'param.grid_peak_price':         { fr: 'Prix achat HP',                  en: 'Peak buy price' },
  'param.grid_offpeak_price':      { fr: 'Prix achat HC',                  en: 'Off-peak buy price' },
  'param.grid_sell_price':         { fr: 'Prix vente',                     en: 'Sell price' },
  'param.demand_charge':           { fr: 'Abonnement (€/kW)',              en: 'Demand charge (€/kW)' },
  'param.cable_capex':             { fr: 'Câblage HTA',                    en: 'HV cabling' },
  'param.grid_subscription':       { fr: 'Souscription réseau',            en: 'Grid subscription' },
  'param.grid_subscription_opt':   { fr: 'Souscription réseau',            en: 'Grid subscription' },

  'param.discount_rate':           { fr: "Taux d'actualisation (WACC)",    en: 'Discount rate (WACC)' },
  'param.grid_inflation':          { fr: 'Inflation Réseau',               en: 'Grid inflation' },
  'param.gas_inflation':           { fr: 'Inflation Gaz',                  en: 'Gas inflation' },
  'param.om_inflation':            { fr: 'Inflation O&M',                  en: 'O&M inflation' },
  'param.voll':                    { fr: 'VOLL (délestage)',               en: 'VOLL (load shedding)' },

  'param.p90_mode':                { fr: 'Mode P90 (pessimiste)',          en: 'P90 mode (conservative)' },
  'param.run_sensitivity':         { fr: 'Tornado de sensibilité',         en: 'Sensitivity tornado' },
  'param.forecast_error':          { fr: 'Bruit Météo (forecast error)',   en: 'Weather noise (forecast error)' },
  'param.max_annual_co2_t':        { fr: 'Budget carbone',                 en: 'Carbon budget' },

  // ── Sidebar — Include banners ─────────────────────────────────────────
  'include.enabled':               { fr: 'Inclure',                        en: 'Include' },
  'include.disabled':              { fr: 'exclu — paramètres ignorés',     en: 'excluded — parameters ignored' },
  'include.solar':                 { fr: 'le solaire',                     en: 'solar' },
  'include.wind':                  { fr: "l'éolien",                       en: 'wind' },
  'include.hydro':                 { fr: "l'hydro",                        en: 'hydro' },
  'include.disabled_solar':        { fr: 'Solaire exclu — paramètres ignorés', en: 'Solar excluded — parameters ignored' },
  'include.disabled_wind':         { fr: 'Éolien exclu — paramètres ignorés',  en: 'Wind excluded — parameters ignored' },
  'include.disabled_hydro':        { fr: 'Hydro exclu — paramètres ignorés',   en: 'Hydro excluded — parameters ignored' },
  'include.battery':               { fr: 'la batterie',                    en: 'battery' },
  'include.hp':                    { fr: 'la pompe à chaleur',             en: 'heat pump' },
  'include.boiler':                { fr: 'la chaudière',                   en: 'boiler' },
  'include.gas':                   { fr: 'le moteur gaz',                  en: 'gas engine' },
  'include.off':                   { fr: 'Désactivé :',                    en: 'Disabled:' },
  'include.reactivate':            { fr: 'Réactiver pour intégrer',        en: 'Re-enable to include' },

  // ── Sidebar — Demand Response / EV ────────────────────────────────────
  'flex.dr_label':                 { fr: 'Demand Response',                en: 'Demand Response' },
  'flex.ev_fleet':                 { fr: 'Flotte VE',                      en: 'EV fleet' },

  // ── Sidebar — TES note ────────────────────────────────────────────────
  'tes.auto_note':                 { fr: "Le ballon d'eau chaude est dimensionné automatiquement par le solveur (jamais \"exclu\", peut être à 0 kWh si non rentable).", en: 'The thermal energy storage is automatically sized by the solver (never "excluded", may be 0 kWh if not cost-effective).' },

  // ── Sidebar — Badges ──────────────────────────────────────────────────
  'badge.none':                    { fr: 'Aucune',                         en: 'None' },
  'badge.off':                     { fr: 'OFF',                            en: 'OFF' },
  'badge.on':                      { fr: 'ON',                             en: 'ON' },
  'badge.bess':                    { fr: 'BESS',                           en: 'BESS' },

  // ── Sidebar — Buttons ─────────────────────────────────────────────────
  'button.run_optimize':           { fr: "Lancer l'optimisation",          en: 'Run optimization' },
  'button.run_simulate':           { fr: 'Lancer la simulation',           en: 'Run simulation' },
  'button.optimizing':             { fr: 'Optimisation...',                en: 'Optimizing...' },
  'button.simulating':             { fr: 'Simulation...',                  en: 'Simulating...' },
  'button.reset':                  { fr: 'Réinitialiser',                  en: 'Reset' },

  // ── Sidebar — Spot market note ────────────────────────────────────────
  'spot.ignored':                  { fr: '↳ Tarifs ignorés : prix spot horaires utilisés pour l\'achat et la vente.', en: '↳ Prices ignored: hourly spot prices used for buy and sell.' },

  // ── Welcome view ──────────────────────────────────────────────────────
  'welcome.optimize_title':        { fr: 'Prêt à optimiser votre microgrid', en: 'Ready to optimize your microgrid' },
  'welcome.optimize_desc':         { fr: "Configurez les usages, sélectionnez les sources d'énergie à inclure, et ajustez les paramètres économiques dans la barre latérale. Le solveur linéaire dimensionne ensuite tous les actifs sur 12 jours-types et calcule la rentabilité sur 25 ans.", en: 'Configure usage, select energy sources to include, and adjust economic parameters in the sidebar. The linear solver then sizes all assets over 12 typical days and computes 25-year profitability.' },
  'welcome.simulate_title':        { fr: 'Prêt à simuler votre microgrid', en: 'Ready to simulate your microgrid' },
  'welcome.simulate_desc':         { fr: 'Configurez vos usages, saisissez les capacités de chaque équipement dans la section « Capacités manuelles », et ajustez les hypothèses économiques. Le solveur simule le dispatch horaire optimal et calcule la rentabilité sur 25 ans avec votre dimensionnement.', en: 'Configure your usage, enter each equipment capacity in the « Manual capacities » section, and adjust economic assumptions. The solver simulates optimal hourly dispatch and computes 25-year profitability with your sizing.' },

  // ── Error view ────────────────────────────────────────────────────────
  'error.title':                   { fr: 'Optimisation impossible',        en: 'Optimization failed' },
  'error.check_backend':           { fr: 'Vérifiez que le backend FastAPI tourne sur', en: 'Check that the FastAPI backend is running on' },
  'error.run_uvicorn':             { fr: 'depuis le dossier du backend',   en: 'from the backend folder' },

  // ── Loading ───────────────────────────────────────────────────────────
  'loading.message':               { fr: 'Le solveur CBC travaille — 288 heures × 25 ans...', en: 'CBC solver is working — 288 hours × 25 years...' },
  'loading.message_8760h':         { fr: 'Le solveur CBC travaille — 8760 heures × 25 ans...', en: 'CBC solver is working — 8760 hours × 25 years...' },
  'loading.message_672h':          { fr: 'Le solveur CBC travaille — 672 heures × 25 ans...', en: 'CBC solver is working — 672 hours × 25 years...' },

  // ── KPIs ───────────────────────────────────────────────────────────────
  'kpi.section_title':             { fr: 'Indicateurs clés',               en: 'Key indicators' },
  'kpi.section_hint_optimize':     { fr: "Vue d'ensemble · Année 1 → Horizon 25 ans", en: 'Overview · Year 1 → 25-year horizon' },
  'kpi.section_hint_simulate':     { fr: 'Paramétrage personnel · Capacités fixées manuellement', en: 'Custom sizing · Manually set capacities' },
  'kpi.sim_badge':                 { fr: ' · Simulation',                  en: ' · Simulation' },
  'kpi.capex':                     { fr: 'CAPEX total',                    en: 'Total CAPEX' },
  'kpi.capex_sub':                 { fr: 'Investissement initial',         en: 'Initial investment' },
  'kpi.roi':                       { fr: 'ROI',                            en: 'ROI' },
  'kpi.roi_sub':                   { fr: 'Payback simple',                 en: 'Simple payback' },
  'kpi.npv':                       { fr: 'VAN 25 ans',                     en: 'NPV 25 years' },
  'kpi.tri':                       { fr: 'TRI',                            en: 'IRR' },
  'kpi.tri_sub':                   { fr: 'Taux de rentabilité interne',    en: 'Internal Rate of Return' },
  'kpi.co2':                       { fr: 'CO₂ évité/an',                   en: 'CO₂ avoided/yr' },
  'kpi.co2_sub':                   { fr: 'Carbon PB · ',                   en: 'Carbon PB · ' },
  'kpi.resilience':                { fr: 'Résilience',                     en: 'Resilience' },
  'kpi.resilience_sub':            { fr: 'Curtailment · ',                 en: 'Curtailment · ' },

  // ── Charts — Energy balance ───────────────────────────────────────────
  'chart.energy.title':            { fr: 'Bilan énergétique horaire',      en: 'Hourly energy balance' },
  'chart.energy.subtitle_288h':    { fr: '288h consécutives — 1 jour-type / mois', en: '288 consecutive hours — 1 typical day / month' },
  'chart.energy.subtitle_8760h':   { fr: '8760h consécutives — année chronologique complète', en: '8760 consecutive hours — full chronological year' },
  'chart.energy.subtitle_672h':    { fr: '672h consécutives — 4 semaines-types (1 / saison)', en: '672 consecutive hours — 4 typical weeks (1 / season)' },
  'chart.energy.subtitle_avg':     { fr: 'Moyenne sur les 12 mois (24h)',  en: 'Average over 12 months (24h)' },
  'chart.energy.subtitle_month':   { fr: 'Jour-type',                      en: 'Typical day' },
  'chart.energy.xlabel_288h':      { fr: 'Mois (288h consécutives)',       en: 'Month (288 consecutive hours)' },
  'chart.energy.xlabel_8760h':     { fr: 'Mois (8760h consécutives)',      en: 'Month (8760 consecutive hours)' },
  'chart.energy.xlabel_672h':      { fr: 'Saison (672h consécutives)',       en: 'Season (672 consecutive hours)' },
  'chart.energy.xlabel_24h':       { fr: 'Heure de la journée',            en: 'Hour of day' },
  'chart.energy.ylabel':           { fr: 'Puissance (kW)',                 en: 'Power (kW)' },
  'chart.energy.legend_title':     { fr: 'Séries affichées',               en: 'Displayed series' },
  'chart.energy.show_all':         { fr: 'Tout afficher',                  en: 'Show all' },
  'chart.energy.hide_all':         { fr: 'Tout masquer',                   en: 'Hide all' },
  'chart.energy.hint':             { fr: 'Production empilée vers le haut · Consommations (charge batt., charge VE, PAC élec, vente réseau) vers le bas. Cliquez les pastilles pour masquer une série.', en: 'Stacked generation upward · Consumption (batt. charge, EV charge, HP elec, grid export) downward. Click chips to toggle a series.' },
  'chart.energy.auto_hide_hint':    { fr: 'Séries inutilisées masquées automatiquement. Réactivez-les dans la légende.', en: 'Unused series auto-hidden. Re-enable in the legend.' },
  'chart.energy.zoom_presets':      { fr: 'Zoom rapide',                     en: 'Quick zoom' },
  'chart.energy.zoom_day':          { fr: 'Jour',                            en: 'Day' },
  'chart.energy.zoom_week':         { fr: 'Semaine',                         en: 'Week' },
  'chart.energy.zoom_month':        { fr: 'Mois',                            en: 'Month' },
  'chart.energy.zoom_year':         { fr: 'Année',                           en: 'Year' },
  'chart.energy.zoom_all':          { fr: 'Tout',                            en: 'All' },
  'chart.energy.zoom_prev':         { fr: 'Préc.',                          en: 'Prev' },
  'chart.energy.zoom_next':         { fr: 'Suiv.',                          en: 'Next' },

  // ── Charts — Series labels ────────────────────────────────────────────
  'series.prod_renewable':         { fr: 'Production renouvelable',        en: 'Renewable generation' },
  'series.solar':                  { fr: 'Solaire',                        en: 'Solar' },
  'series.wind':                   { fr: 'Éolien',                         en: 'Wind' },
  'series.hydro':                  { fr: 'Hydro',                          en: 'Hydro' },
  'series.storage_battery':        { fr: 'Stockage batterie',              en: 'Battery storage' },
  'series.bess_dis':               { fr: 'Batt. décharge',                 en: 'Batt. discharge' },
  'series.bess_ch':                { fr: 'Batt. charge',                   en: 'Batt. charge' },
  'series.grid':                   { fr: 'Réseau',                         en: 'Grid' },
  'series.grid_buy':               { fr: 'Achat réseau',                   en: 'Grid import' },
  'series.grid_sell':              { fr: 'Vente réseau',                   en: 'Grid export' },
  'series.ev':                     { fr: 'Véhicules électriques',          en: 'Electric vehicles' },
  'series.ev_discharge':           { fr: 'V2G (VE→Grid)',                  en: 'V2G (EV→Grid)' },
  'series.ev_charge':              { fr: 'Charge VE',                      en: 'EV charging' },
  'series.combustion':             { fr: 'Combustion & Thermique',         en: 'Combustion & Thermal' },
  'series.gas_gen':                { fr: 'Moteur Gaz',                     en: 'Gas engine' },
  'series.gas_th_gen':             { fr: 'Chaudière Gaz',                  en: 'Gas boiler' },
  'series.hp_elec':                { fr: 'PAC (élec)',                     en: 'HP (electric)' },
  'series.shedding':               { fr: 'Délestage',                      en: 'Load shedding' },
  'series.load_shed':              { fr: 'Délestage élec.',                en: 'Elec. shedding' },
  'series.therm_shed':             { fr: 'Délestage therm.',               en: 'Therm. shedding' },
  'series.demand':                 { fr: 'Demande',                        en: 'Demand' },
  'series.home_load':              { fr: 'Foyers',                         en: 'Households' },
  'series.comm_load':              { fr: 'Commerces',                      en: 'Commercial' },
  'series.raw_load':               { fr: 'Demande totale',                 en: 'Total demand' },
  'series.optimized_load':         { fr: 'Demande après DR',               en: 'Demand after DR' },

  // ── Charts — Cashflow / Carbon ────────────────────────────────────────
  'chart.cashflow.title':          { fr: 'Cash-flow cumulé · 25 ans',      en: 'Cumulative cash-flow · 25 years' },
  'chart.cashflow.subtitle':       { fr: 'Flux nets actualisables',        en: 'Discountable net flows' },
  'chart.cashflow.ylabel':         { fr: 'Cashflow cumulé (€)',            en: 'Cumulative cashflow (€)' },
  'chart.carbon.title':            { fr: 'Dette carbone · 25 ans',         en: 'Carbon debt · 25 years' },
  'chart.carbon.subtitle':         { fr: 'Embarqué + opérationnel',        en: 'Embodied + operational' },
  'chart.carbon.ylabel':           { fr: 'CO₂ cumulé (t)',                 en: 'Cumulative CO₂ (t)' },
  'chart.year_label':              { fr: 'Année',                           en: 'Year' },

  // ── Charts — OPEX Donut ────────────────────────────────────────────────
  'opex.title':                    { fr: 'Répartition OPEX (Année 1)',     en: 'OPEX breakdown (Year 1)' },
  'opex.total':                    { fr: 'OPEX/an',                        en: 'OPEX/yr' },
  'opex.fuel_elec_gaz':            { fr: 'Gaz · Élec',                     en: 'Gas · Electric' },
  'opex.fuel_th_gaz':              { fr: 'Gaz · Chaleur',                  en: 'Gas · Heat' },
  'opex.grid_buy':                 { fr: 'Achat réseau',                   en: 'Grid import' },
  'opex.grid_sell':                { fr: 'Revente réseau',                 en: 'Grid export revenue' },
  'opex.om':                       { fr: 'O&M',                            en: 'O&M' },
  'opex.demand_charge':            { fr: 'Abonnement',                     en: 'Demand charge' },
  'opex.load_shed':                { fr: 'Délestage',                      en: 'Load shedding' },
  'opex.revenue':                  { fr: 'Revenus revente',                en: 'Export revenue' },

  // ── Charts — Tornado ──────────────────────────────────────────────────
  'tornado.title':                 { fr: 'Analyse de sensibilité (Tornado)', en: 'Sensitivity analysis (Tornado)' },
  'tornado.subtitle':              { fr: "Impact d'une variation ±20% des paramètres actifs sur le ROI", en: 'Impact of ±20% variation of active parameters on ROI' },
  'tornado.low_label':             { fr: '−20% (ROI plus court ←)',        en: '−20% (shorter ROI ←)' },
  'tornado.high_label':            { fr: '+20% (ROI plus long →)',         en: '+20% (longer ROI →)' },
  'tornado.reference':             { fr: 'Référence : ROI = ',             en: 'Reference: ROI = ' },
  'tornado.empty':                 { fr: "Aucun paramètre pertinent à analyser : activez au moins une source d'énergie sensible (PV, Éolien, Batterie, Gaz) pour voir l'analyse de sensibilité.", en: 'No relevant parameters to analyze: enable at least one significant energy source (PV, Wind, Battery, Gas) to see the sensitivity analysis.' },
  'tornado.xlabel':                { fr: 'Δ ROI (années) — relatif à la référence', en: 'Δ ROI (years) — relative to reference' },

  // ── Capacities table ──────────────────────────────────────────────────
  'caps.title':                    { fr: 'Capacités optimales',             en: 'Optimal capacities' },
  'caps.subtitle':                 { fr: 'Dimensionnement suggéré par le solveur', en: 'Sizing suggested by the solver' },
  'caps.solar':                    { fr: 'Solaire',                        en: 'Solar' },
  'caps.wind':                     { fr: 'Éolien',                         en: 'Wind' },
  'caps.hydro':                    { fr: 'Hydro',                          en: 'Hydro' },
  'caps.bess':                     { fr: 'Batterie',                       en: 'Battery' },
  'caps.bess_inv':                 { fr: 'Onduleur Batt.',                 en: 'Batt. inverter' },
  'caps.solar_inv':                { fr: 'Onduleur Solaire',               en: 'Solar inverter' },
  'caps.gas':                      { fr: 'Moteur Gaz',                     en: 'Gas engine' },
  'caps.boiler':                   { fr: 'Chaudière Gaz',                  en: 'Gas boiler' },
  'caps.hp':                       { fr: 'Pompe à Chaleur',                en: 'Heat pump' },
  'caps.tes':                      { fr: 'Ballon Thermique',               en: 'Thermal storage' },
  'caps.grid':                     { fr: 'Souscription Réseau',            en: 'Grid subscription' },
  'caps.grid_sub':                 { fr: 'Puissance souscrite optimale',   en: 'Optimal subscribed power' },

  // ── Map ────────────────────────────────────────────────────────────────
  'map.hint':                      { fr: 'Cliquez sur la carte ou glissez le marqueur pour positionner le site.', en: 'Click the map or drag the marker to position the site.' },

  // ── Select ─────────────────────────────────────────────────────────────
  'select.year_all':               { fr: 'Année entière (288h)',           en: 'Full year (288h)' },
  'select.year_all_8760h':         { fr: 'Année entière (8760h)',          en: 'Full year (8760h)' },
  'select.year_all_672h':          { fr: 'Année entière (672h)',           en: 'Full year (672h)' },
  'select.year_avg':               { fr: '∅ Moyenne annuelle',             en: '∅ Annual average' },

  // ── Language selector ──────────────────────────────────────────────────
  'lang.selector.title':           { fr: 'Choisissez votre langue',        en: 'Choose your language' },
  'lang.selector.subtitle':        { fr: 'Vous pourrez la modifier à tout moment.', en: 'You can change it at any time.' },
  'lang.selector.confirm':         { fr: 'Continuer en',                   en: 'Continue in' },

  // ── Tutorial ───────────────────────────────────────────────────────────
  'tuto.step1.title':              { fr: 'Bienvenue sur Microgrid Optimizer', en: 'Welcome to Microgrid Optimizer' },
  'tuto.step1.p1':                 { fr: 'Cet outil vous permet de <strong>dimensionner et simuler un microgrid</strong> — un système énergétique local combinant panneaux solaires, éoliennes, batteries, groupes gaz, pompes à chaleur et plus encore.', en: 'This tool lets you <strong>size and simulate a microgrid</strong> — a local energy system combining solar panels, wind turbines, batteries, gas generators, heat pumps, and more.' },
  'tuto.step1.p2':                 { fr: 'Deux modes sont disponibles, accessibles via le toggle en haut de la barre latérale.', en: 'Two modes are available, accessible via the toggle at the top of the sidebar.' },
  'tuto.step2.title':              { fr: 'Mode Optimisation',               en: 'Optimization mode' },
  'tuto.step2.p1':                 { fr: 'Le solveur <strong>dimensionne automatiquement</strong> tous les équipements au coût minimum. Vous indiquez :', en: 'The solver <strong>automatically sizes</strong> all equipment at minimum cost. You provide:' },
  'tuto.step2.li1':                { fr: 'Le nombre de foyers et leur consommation', en: 'Number of households and their consumption' },
  'tuto.step2.li2':                { fr: "Les sources d'énergie à inclure (solaire, éolien, batterie...)", en: 'Energy sources to include (solar, wind, battery...)' },
  'tuto.step2.li3':                { fr: 'Les coûts (CAPEX, prix du gaz, tarifs réseau)', en: 'Costs (CAPEX, gas price, grid tariffs)' },
  'tuto.step2.p2':                 { fr: 'Le LP calcule les <strong>capacités optimales</strong> et le dispatch horaire qui minimise le coût total sur 25 ans.', en: 'The LP computes <strong>optimal capacities</strong> and hourly dispatch that minimizes total cost over 25 years.' },
  'tuto.step3.title':              { fr: 'Mode Paramétrage personnel',      en: 'Custom sizing mode' },
  'tuto.step3.p1':                 { fr: 'Vous <strong>fixez vous-même les capacités</strong> (kW de PV, kWh de batterie, etc.) dans la section « Capacités manuelles ».', en: 'You <strong>set the capacities yourself</strong> (PV kW, battery kWh, etc.) in the « Manual capacities » section.' },
  'tuto.step3.p2':                 { fr: 'Le solveur optimise uniquement le <strong>dispatch horaire</strong> (quand charger/décharger, quand acheter/vendre) et calcule la rentabilité de <em>votre</em> dimensionnement.', en: 'The solver only optimizes <strong>hourly dispatch</strong> (when to charge/discharge, when to buy/sell) and computes the profitability of <em>your</em> sizing.' },
  'tuto.step3.p3':                 { fr: 'Idéal pour vérifier un avant-projet ou comparer des scénarios.', en: 'Ideal for verifying a preliminary design or comparing scenarios.' },
  'tuto.step4.title':              { fr: 'Configurez vos paramètres',       en: 'Configure your parameters' },
  'tuto.step4.p1':                 { fr: 'La barre latérale gauche contient tous les réglages :', en: 'The left sidebar contains all settings:' },
  'tuto.step4.li1':                { fr: '<strong>Site</strong> : position GPS → météo réelle (PVGIS, Open-Meteo)', en: '<strong>Site</strong>: GPS position → real weather (PVGIS, Open-Meteo)' },
  'tuto.step4.li2':                { fr: '<strong>Demande</strong> : foyers, commerces, saisonnalité, besoin thermique', en: '<strong>Demand</strong>: households, commercial, seasonality, thermal needs' },
  'tuto.step4.li3':                { fr: '<strong>Production</strong> : CAPEX, durée de vie, contraintes de surface', en: '<strong>Generation</strong>: CAPEX, lifetime, area constraints' },
  'tuto.step4.li4':                { fr: '<strong>Stockage, Thermique, Gaz</strong> : paramètres techniques et économiques', en: '<strong>Storage, Thermal, Gas</strong>: technical and economic parameters' },
  'tuto.step4.li5':                { fr: '<strong>Réseau</strong> : tarifs, spot market, abonnement', en: '<strong>Grid</strong>: tariffs, spot market, demand charge' },
  'tuto.step4.li6':                { fr: '<strong>Hypothèses financières</strong> : WACC, inflations', en: '<strong>Financial assumptions</strong>: WACC, inflations' },
  'tuto.step4.p2':                 { fr: 'Survolez chaque <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-ink-200 dark:bg-ink-700 text-[9px] font-bold">?</span> pour une explication détaillée.', en: 'Hover over each <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-ink-200 dark:bg-ink-700 text-[9px] font-bold">?</span> for a detailed explanation.' },
  'tuto.step5.title':              { fr: 'Lancez et explorez',              en: 'Run and explore' },
  'tuto.step5.p1':                 { fr: "Cliquez sur <strong>« Lancer l'optimisation »</strong> (ou « Lancer la simulation »). Le solveur CBC travaille 1 à 3 secondes.", en: 'Click <strong>« Run optimization »</strong> (or « Run simulation »). The CBC solver works for 1–3 seconds.' },
  'tuto.step5.p2':                 { fr: "Les résultats s'affichent :",    en: 'Results are displayed:' },
  'tuto.step5.li1':                { fr: '<strong>KPIs</strong> : CAPEX, VAN, TRI, ROI, CO₂ évité, résilience', en: '<strong>KPIs</strong>: CAPEX, NPV, IRR, ROI, avoided CO₂, resilience' },
  'tuto.step5.li2':                { fr: '<strong>Bilan énergétique</strong> : graphique 288h interactif (cochez/décochez les séries)', en: '<strong>Energy balance</strong>: interactive 288h chart (toggle series on/off)' },
  'tuto.step5.li3':                { fr: '<strong>Cash-flows & Carbone</strong> : trajectoires sur 25 ans', en: '<strong>Cash flows & Carbon</strong>: 25-year trajectories' },
  'tuto.step5.li4':                { fr: '<strong>OPEX Donut</strong> : répartition des coûts annuels', en: '<strong>OPEX Donut</strong>: annual cost breakdown' },
  'tuto.step5.li5':                { fr: '<strong>Capacités</strong> : dimensionnement optimal', en: '<strong>Capacities</strong>: optimal sizing' },
  'tuto.step5.li6':                { fr: '<strong>Tornado</strong> : sensibilité du ROI à ±20 %', en: '<strong>Tornado</strong>: ROI sensitivity to ±20%' },
  'tuto.step6.title':              { fr: 'Astuces',                         en: 'Tips' },
  'tuto.step6.li1':                { fr: 'Le graphique énergétique est interactif : <strong>cliquez les pastilles</strong> pour masquer/afficher une série.', en: 'The energy chart is interactive: <strong>click the chips</strong> to hide/show a series.' },
  'tuto.step6.li2':                { fr: 'Passez la <strong>souris</strong> sur le graphique pour voir les valeurs exactes heure par heure.', en: '<strong>Hover</strong> over the chart to see exact values hour by hour.' },
  'tuto.step6.li3':                { fr: 'Le sélecteur en haut à droite permet de visualiser <strong>un mois spécifique</strong> ou la moyenne annuelle.', en: 'The selector at top right lets you view a <strong>specific month</strong> or the annual average.' },
  'tuto.step6.li4':                { fr: 'Exportez les résultats en <strong>CSV</strong> ou <strong>PDF</strong> via les boutons en haut.', en: 'Export results as <strong>CSV</strong> or <strong>PDF</strong> via the top buttons.' },
  'tuto.step6.li5':                { fr: 'Le bouton <strong>« Comment ça marche ? »</strong> détaille tout l\'algorithme.', en: 'The <strong>« How it works ? »</strong> button details the entire algorithm.' },
  'tuto.step6.li6':                { fr: 'Activez <strong>max_solar_kW</strong> pour limiter le PV à la surface réelle de votre toiture.', en: 'Enable <strong>max_solar_kW</strong> to limit PV to your actual roof area.' },
  'tuto.skip':                     { fr: 'Passer le tutoriel',              en: 'Skip tutorial' },
  'tuto.prev':                     { fr: 'Précédent',                       en: 'Previous' },
  'tuto.next':                     { fr: 'Suivant',                         en: 'Next' },
  'tuto.start':                    { fr: 'Commencer',                       en: 'Get started' },
  'tuto.step':                     { fr: 'Étape',                           en: 'Step' },

  // ── Methodology ────────────────────────────────────────────────────────
  'methodo.title':                 { fr: 'Comment ça marche ?',             en: 'How it works ?' },
  'methodo.p1':                    { fr: 'Le modèle repose sur une <strong>programmation linéaire continue (LP)</strong> résolue via le solveur open-source <strong>CBC</strong> (Coin-or Branch and Cut), interfacé par la bibliothèque Python <strong>PuLP</strong>. Toutes les variables sont réelles — il n\'y a pas de variables binaires ou entières, ce qui garantit une résolution rapide et un optimum global.', en: 'The model is based on <strong>continuous linear programming (LP)</strong> solved via the open-source <strong>CBC</strong> solver (Coin-or Branch and Cut), interfaced by the <strong>PuLP</strong> Python library. All variables are real — there are no binary or integer variables, ensuring fast resolution and a global optimum.' },

  // ── Code modal ────────────────────────────────────────────────────────
  'code.title':                    { fr: "Algorithme d'optimisation énergétique", en: 'Power Optimization Algorithm' },
  'code.loading':                  { fr: 'Chargement du code source...',    en: 'Loading source code...' },
  'code.error':                    { fr: 'Backend inaccessible — lancez uvicorn main:app', en: 'Backend unreachable — run uvicorn main:app' },

  // ── Methodology — sections ────────────────────────────────────────────
  'methodo.h2_archi':              { fr: '1. Architecture du modèle',       en: '1. Model architecture' },
  'methodo.h3_why288':             { fr: 'Jours-types : pourquoi 288 heures ?', en: 'Typical days: why 288 hours?' },
  'methodo.why288_p1':             { fr: "Plutôt que d'optimiser 8760 heures (une année complète), le modèle utilise <strong>12 jours-types</strong> (un par mois calendaire). Chaque jour-type comporte 24 heures, soit <strong>288 pas de temps</strong>.", en: 'Rather than optimizing 8760 hours (a full year), the model uses <strong>12 typical days</strong> (one per calendar month). Each typical day has 24 hours, i.e. <strong>288 time steps</strong>.' },
  'methodo.why288_p2':             { fr: "Pour chaque mois, on calcule un « jour moyen » en moyennant chaque heure sur tous les jours du mois. Par exemple, le jour-type de janvier est la moyenne des 31 jours de janvier à chaque heure (0h, 1h, ..., 23h). Les résultats horaires sont ensuite pondérés par le nombre de jours du mois (28 à 31) pour obtenir des grandeurs annuelles.", en: 'For each month, a "typical day" is computed by averaging each hour over all days of the month. For example, the January typical day is the average of the 31 January days at each hour (0h, 1h, ..., 23h). Hourly results are then weighted by the number of days in the month (28–31) to obtain annual values.' },
  'methodo.why288_li1':            { fr: 'Janvier (31j) → 1 jour-type × 24h → pondération ×31 pour annualiser', en: 'January (31d) → 1 typical day × 24h → ×31 weight for annualization' },
  'methodo.why288_li2':            { fr: 'Février (28j) → pondération ×28', en: 'February (28d) → ×28 weight' },
  'methodo.why288_li3':            { fr: 'Mars (31j) → ×31, Avril (30j) → ×30, etc.', en: 'March (31d) → ×31, April (30d) → ×30, etc.' },
  'methodo.why288_li4':            { fr: 'Total : 12 × 24 = 288 variables temporelles au lieu de 8760', en: 'Total: 12 × 24 = 288 time variables instead of 8760' },
  'methodo.why288_p3':             { fr: 'Cette approche capture les <strong>variations saisonnières</strong> (ensoleillement, vent, demande de chauffage) tout en restant soluble en une fraction de seconde.', en: 'This approach captures <strong>seasonal variations</strong> (sunshine, wind, heating demand) while remaining solvable in a fraction of a second.' },
  'methodo.h3_8760':               { fr: 'Résolution 8760h : année complète',  en: '8760h resolution: full year' },
  'methodo.8760_p1':               { fr: "Le mode 8760h <strong>remplace les 12 jours-types par les 8760 heures chronologiques</strong> d'une année réelle (2020). Chaque heure est traitée individuellement, sans pondération mensuelle.", en: "The 8760h mode <strong>replaces the 12 typical days with the 8760 chronological hours</strong> of a real year (2020). Each hour is processed individually, without monthly weighting." },
  'methodo.8760_p2':               { fr: "Les données solaires (PVGIS) et éoliennes (Open-Meteo) sont récupérées en <strong>8760h brutes</strong>, sans compression en jours-types. Le profil de charge 24h est expansé heure par heure sur l'année avec la saisonnalité mensuelle.", en: "Solar (PVGIS) and wind (Open-Meteo) data is fetched as <strong>raw 8760h</strong>, without compression into typical days. The 24h load profile is expanded hour by hour over the year with monthly seasonality." },
  'methodo.8760_p3':               { fr: "Le solveur LP optimise <strong>8760 pas de temps simultanément</strong> (contre 288 en mode jours-types). Le cyclage batterie s'effectue sur <strong>365 jours réels</strong> (charge/décharge quotidienne). Le temps de calcul est d'environ <strong>10 à 60 secondes</strong> selon la complexité. Le mode MILP (variables binaires) n'est pas disponible en 8760h.", en: "The LP solver optimizes <strong>8760 time steps simultaneously</strong> (vs. 288 in typical-day mode). Battery cycling occurs over <strong>365 real days</strong> (daily charge/discharge). Computation time is approximately <strong>10–60 seconds</strong> depending on complexity. MILP mode (binary variables) is not available in 8760h." },
  'methodo.h3_weather':            { fr: 'Données météorologiques',         en: 'Weather data' },
  'methodo.weather_li1':           { fr: "<strong>Solaire</strong> : API PVGIS v5.2 (Joint Research Centre, Commission Européenne). Récupère l'irradiance horaire 2020 à la latitude/longitude du site, calcule la production d'1 kWc avec 14 % de pertes système, puis construit 12 jours-types par moyenne mensuelle. En cas d'échec API : profil sinusoïdal par défaut.", en: '<strong>Solar</strong>: PVGIS v5.2 API (Joint Research Centre, European Commission). Fetches 2020 hourly irradiance at the site lat/lon, computes 1 kWp production with 14% system losses, then builds 12 typical days by monthly averaging. On API failure: default sinusoidal profile.' },
  'methodo.weather_li2':           { fr: "<strong>Éolien</strong> : API Open-Meteo (archive 2020). Récupère la vitesse du vent à 10 m, la convertit en facteur de charge via une courbe puissance simplifiée : 0 en dessous de 3 m/s, 1 au-dessus de 12 m/s, linéaire entre les deux. Puis moyenne mensuelle par heure.", en: '<strong>Wind</strong>: Open-Meteo API (2020 archive). Fetches 10 m wind speed, converts to capacity factor via a simplified power curve: 0 below 3 m/s, 1 above 12 m/s, linear in between. Then monthly averaging by hour.' },
  'methodo.weather_li3':           { fr: "<strong>Hydro</strong> : profil saisi par l'utilisateur ou défaut constant à 0.9 (90 % de disponibilité).", en: '<strong>Hydro</strong>: user-supplied profile or default constant 0.9 (90% availability).' },
  'methodo.h3_season':             { fr: 'Saisonnalité de la demande',      en: 'Demand seasonality' },
  'methodo.season_p1':             { fr: 'Un coefficient multiplicateur mensuel est appliqué à la charge électrique pour refléter la surconsommation hivernale (chauffage, éclairage). Avec le paramètre <Code>S = 0.30</Code> :', en: 'A monthly multiplier is applied to the electrical load to reflect winter overconsumption (heating, lighting). With parameter <Code>S = 0.30</Code>:' },
  'methodo.season_formula':        { fr: 'Jan/Déc : ×1.30 | Fév : ×1.30 | Mar : ×1.15 | Avr : ×1.06 | Mai–Sep : ×1.00 | Oct : ×1.09 | Nov : ×1.21', en: 'Jan/Dec: ×1.30 | Feb: ×1.30 | Mar: ×1.15 | Apr: ×1.06 | May–Sep: ×1.00 | Oct: ×1.09 | Nov: ×1.21' },
  'methodo.season_p2':             { fr: "Si l'utilisateur fournit un profil de charge de 288h, la saisonnalité est ignorée (déjà intégrée).", en: 'If the user provides a 288h load profile, seasonality is ignored (already integrated).' },
  'methodo.h2_vars':               { fr: '2. Variables de décision',        en: '2. Decision variables' },
  'methodo.vars_intro':            { fr: 'Le solveur détermine simultanément les <strong>capacités à installer</strong> et le <strong>dispatch horaire</strong> optimal :', en: 'The solver simultaneously determines the <strong>capacities to install</strong> and the optimal <strong>hourly dispatch</strong>:' },
  'methodo.h3_caps':               { fr: 'Capacités installées (11 variables continues)', en: 'Installed capacities (11 continuous variables)' },
  'methodo.h3_flows':              { fr: 'Flux horaires (288h × ~20 variables)', en: 'Hourly flows (288h × ~20 variables)' },
  'methodo.flows_intro':           { fr: 'Pour chaque heure <Code>t ∈ [0, 287]</Code> (ou <Code>[0, 8759]</Code> en mode 8760h), le modèle optimise :', en: 'For each hour <Code>t ∈ [0, 287]</Code> (or <Code>[0, 8759]</Code> in 8760h mode), the model optimizes:' },
  'methodo.flows_8760':            { fr: 'En mode 8760h, les 288 variables horaires sont remplacées par 8760 variables continues. Le solveur LP optimise le dispatch sur chaque heure réelle de l\'année.', en: 'In 8760h mode, the 288 hourly variables are replaced by 8760 continuous variables. The LP solver optimizes dispatch for every real hour of the year.' },
  'methodo.h2_obj':                { fr: '3. Fonction objectif',            en: '3. Objective function' },
  'methodo.obj_intro':             { fr: 'Le modèle minimise le <strong>coût total annualisé</strong> (CAPEX + OPEX) :', en: 'The model minimizes the <strong>total annualized cost</strong> (CAPEX + OPEX):' },
  'methodo.h3_crf':                { fr: 'CAPEX annualisé — Capital Recovery Factor', en: 'Annualized CAPEX — Capital Recovery Factor' },
  'methodo.crf_p1':                { fr: 'Pour comparer un investissement initial (CAPEX) avec des coûts opérationnels annuels, on l\'étale sur sa durée de vie via le <strong>CRF</strong> :', en: 'To compare an initial investment (CAPEX) with annual operational costs, it is spread over its lifetime via the <strong>CRF</strong>:' },
  'methodo.crf_p2':                { fr: "Où <Code>r</Code> est le taux d'actualisation (WACC, défaut 5 %) et <Code>n</Code> la durée de vie économique de l'équipement. Exemple : un panneau PV à 600 €/kWc sur 25 ans à 5 % donne une annuité de 600 × 0.07095 = <strong>42.57 €/kWc/an</strong>.", en: 'Where <Code>r</Code> is the discount rate (WACC, default 5%) and <Code>n</Code> is the economic lifetime of the equipment. Example: a PV panel at 600 €/kWp over 25 years at 5% gives an annuity of 600 × 0.07095 = <strong>42.57 €/kWp/yr</strong>.' },
  'methodo.h3_opex':               { fr: 'OPEX horaire — coûts opérationnels', en: 'Hourly OPEX — operational costs' },
  'methodo.opex_gas_elec':         { fr: 'Rendement moteur gaz 35 % — pour 1 kWh élec, il faut brûler 2.86 kWh de gaz primaire.', en: 'Gas engine efficiency 35% — for 1 kWh of electricity, 2.86 kWh of primary gas must be burned.' },
  'methodo.opex_gas_th':           { fr: 'Rendement chaudière par défaut 90 %.', en: 'Default boiler efficiency 90%.' },
  'methodo.opex_intro':            { fr: 'Pour chaque heure <Code>t</Code>, le coût opérationnel est :', en: 'For each hour <Code>t</Code>, the operational cost is:' },
  'methodo.h2_constraints':        { fr: '4. Contraintes',                  en: '4. Constraints' },
  'methodo.h3_elec':               { fr: '4.1 Bilan électrique (∀t ∈ [0, 287])', en: '4.1 Electrical balance (∀t ∈ [0, 287])' },
  'methodo.elec_p1':               { fr: 'La somme des injections est égale à la somme des soutirages à chaque heure :', en: 'The sum of injections equals the sum of withdrawals at each hour:' },
  'methodo.elec_p2':               { fr: 'La <strong>Charge_optimisée</strong> est la charge brute ajustée du load-shifting (Demand Response) : <Code>Charge(t) = Charge_brute(t) + Shift_up(t) − Shift_down(t)</Code>.', en: '<strong>Optimized_load</strong> is the raw load adjusted for load-shifting (Demand Response): <Code>Load(t) = Raw_load(t) + Shift_up(t) − Shift_down(t)</Code>.' },
  'methodo.h3_thermal':            { fr: '4.2 Bilan thermique (∀t)',        en: '4.2 Thermal balance (∀t)' },
  'methodo.thermal_p1':            { fr: 'La charge thermique est dérivée de la charge électrique : <Code>Charge_th(t) = Charge_élec(t) × thermal_ratio</Code>. Le COP (Coefficient de Performance) convertit la consommation électrique de la PAC en chaleur restituée.', en: 'Thermal load is derived from electrical load: <Code>Heat_load(t) = Elec_load(t) × thermal_ratio</Code>. The COP (Coefficient of Performance) converts HP electricity consumption into delivered heat.' },
  'methodo.h3_bess':               { fr: '4.3 Stockage batterie',           en: '4.3 Battery storage' },
  'methodo.bess_p1':               { fr: "L'état de charge (SOC) évolue selon :", en: 'The state of charge (SOC) evolves according to:' },
  'methodo.h3_tes':                { fr: '4.4 Ballon thermique (TES)',      en: '4.4 Thermal Energy Storage (TES)' },
  'methodo.tes_p1':                { fr: 'Même structure que la batterie, avec un rendement fixe de 95 %. Charge et décharge limitées à <Code>Cap_TES / 2</Code>.', en: 'Same structure as the battery, with a fixed efficiency of 95%. Charge and discharge limited to <Code>Cap_TES / 2</Code>.' },
  'methodo.h3_re':                 { fr: '4.5 Production renouvelable',     en: '4.5 Renewable generation' },
  'methodo.h3_ev':                 { fr: '4.6 Véhicules électriques',       en: '4.6 Electric vehicles' },
  'methodo.ev_p1':                 { fr: 'Modèle simplifié de flotte captive (véhicules de service ou résidents) :', en: 'Simplified captive fleet model (service or resident vehicles):' },
  'methodo.h3_grid':               { fr: '4.7 Réseau électrique',           en: '4.7 Electrical grid' },
  'methodo.h3_other':              { fr: '4.8 Contraintes supplémentaires', en: '4.8 Additional constraints' },
  'methodo.h2_solve':              { fr: '5. Résolution du problème LP',    en: '5. LP problem solving' },
  'methodo.h3_solver':             { fr: 'Solveur utilisé',                 en: 'Solver used' },
  'methodo.solver_p1':             { fr: 'Le problème est un <strong>LP continu</strong> — toutes les variables sont réelles positives, sans variables binaires. Il est résolu par <strong>CBC</strong> (Coin-or Branch and Cut) via la méthode du <strong>Simplexe primal</strong>. La solution obtenue est l\'optimum global (pas de minima locaux).', en: 'The problem is a <strong>continuous LP</strong> — all variables are positive reals, with no binary variables. It is solved by <strong>CBC</strong> (Coin-or Branch and Cut) using the <strong>primal Simplex</strong> method. The obtained solution is the global optimum (no local minima).' },
  'methodo.h3_size':               { fr: 'Taille du problème',              en: 'Problem size' },
  'methodo.h3_sensi':              { fr: 'Mode Analyse de sensibilité (Tornado)', en: 'Sensitivity analysis mode (Tornado)' },
  'methodo.sensi_p1':             { fr: 'Si activé, le solveur est rappelé <strong>12 à 16 fois</strong> en faisant varier chaque paramètre clé (CAPEX solaire/éolien/batterie, prix gaz, abonnement réseau, etc.) de <strong>±20 %</strong>. Le ROI simplifié (CAPEX / savings_année_1) est calculé pour chaque scénario. Les résultats alimentent le diagramme Tornado. Temps total : ~5–15 secondes.', en: 'If enabled, the solver is called back <strong>12 to 16 times</strong> varying each key parameter (solar/wind/battery CAPEX, gas price, grid demand charge, etc.) by <strong>±20%</strong>. The simplified ROI (CAPEX / year_1_savings) is computed for each scenario. Results feed the Tornado chart. Total time: ~5–15 seconds.' },
  'methodo.h2_finance':            { fr: '6. Analyse financière sur 25 ans', en: '6. 25-year financial analysis' },
  'methodo.finance_p1':            { fr: "Une fois le dispatch optimal obtenu, une <strong>boucle temporelle année par année</strong> (1 à 25) est exécutée. Elle ne ré-optimise pas le dispatch — celui-ci est supposé constant chaque année.", en: 'Once the optimal dispatch is obtained, a <strong>year-by-year time loop</strong> (1 to 25) is executed. It does not re-optimize the dispatch — it is assumed constant each year.' },
  'methodo.h3_cf':                 { fr: "Cash-flow de l'année y",          en: 'Year y cash flow' },
  'methodo.h3_baseline':           { fr: 'OPEX baseline (sans microgrid)',  en: 'Baseline OPEX (without microgrid)' },
  'methodo.baseline_p1':           { fr: 'Coût annuel de référence si le site achetait toute son électricité au réseau (ou utilisait un groupe gaz 100 % du temps en mode îloté). En mode îloté, le rendement moteur de 35 % est pris en compte : <Code>Coût = Charge × gas_fuel / 0.35</Code>.', en: 'Reference annual cost if the site purchased all its electricity from the grid (or used a gas generator 100% of the time in off-grid mode). In off-grid mode, the 35% engine efficiency is accounted for: <Code>Cost = Load × gas_fuel / 0.35</Code>.' },
  'methodo.h3_inflation':          { fr: 'Inflation différenciée',          en: 'Differentiated inflation' },
  'methodo.h3_degrad':             { fr: 'Dégradation solaire',             en: 'Solar degradation' },
  'methodo.degrad_p1':             { fr: "La perte de production annuelle est valorisée au <strong>coût marginal de remplacement</strong> : prix d'achat réseau en mode connecté, ou <Code>gas_fuel / 0.35</Code> en mode îloté (car l'énergie manquante doit être produite par le groupe gaz).", en: 'The annual production loss is valued at the <strong>marginal replacement cost</strong>: grid purchase price in connected mode, or <Code>gas_fuel / 0.35</Code> in off-grid mode (since the missing energy must be produced by the gas generator).' },
  'methodo.h3_replace':            { fr: 'Renouvellements des équipements', en: 'Equipment replacements' },
  'methodo.replace_p1':            { fr: "Chaque équipement est remplacé à l'échéance de sa durée de vie. Le test <Code>y % lifetime == 0</Code> déclenche un coût de remplacement égal au CAPEX initial (en euros courants). Les durées par défaut :", en: 'Each equipment is replaced at the end of its lifetime. The test <Code>y % lifetime == 0</Code> triggers a replacement cost equal to the initial CAPEX (in current euros). Default lifetimes:' },
  'methodo.h3_residual':           { fr: 'Valeur résiduelle (année 25)',    en: 'Residual value (year 25)' },
  'methodo.residual_p1':           { fr: "Tout équipement ayant une durée de vie restante en année 25 est valorisé au prorata :", en: 'Any equipment with remaining lifetime in year 25 is valued pro rata:' },
  'methodo.residual_p2':           { fr: 'Exemple : une batterie remplacée en année 20 (durée de vie 10 ans) a 5 ans restants en année 25 → VR = CAPEX_batterie × 5/10 = 50 % du CAPEX.', en: 'Example: a battery replaced in year 20 (10-year lifetime) has 5 years remaining in year 25 → RV = Battery_CAPEX × 5/10 = 50% of CAPEX.' },
  'methodo.h3_kpis':               { fr: 'Indicateurs financiers',          en: 'Financial indicators' },
  'methodo.h2_carbon':             { fr: '7. Bilan carbone',                en: '7. Carbon balance' },
  'methodo.h3_embodied':           { fr: 'Dette carbone initiale (embodied carbon)', en: 'Initial carbon debt (embodied carbon)' },
  'methodo.embodied_p1':           { fr: "Facteurs d'émission utilisés (analyse de cycle de vie, kg CO₂ par unité) :", en: 'Emission factors used (life cycle analysis, kg CO₂ per unit):' },
  'methodo.h3_operational':        { fr: 'Émissions opérationnelles annuelles', en: 'Annual operational emissions' },
  'methodo.operational_p1':        { fr: 'avec :',                          en: 'where:' },
  'methodo.h3_carbon_pb':          { fr: 'Carbon Payback',                  en: 'Carbon payback' },
  'methodo.carbon_pb_p1':          { fr: 'Première année où le cumul des émissions évitées (CO₂_baseline − CO₂_microgrid) dépasse la dette carbone initiale. Le CO₂ des renouvellements d\'équipements est inclus.', en: 'First year where cumulative avoided emissions (CO₂_baseline − CO₂_microgrid) exceed the initial carbon debt. Equipment replacement CO₂ is included.' },
  'methodo.h2_assumptions':        { fr: '8. Hypothèses et limites',        en: '8. Assumptions and limitations' },
  'methodo.h2_references':         { fr: '9. Références',                   en: '9. References' },

  // ── Help tooltips ─────────────────────────────────────────────────────
  'help.lat':                      { fr: "Latitude GPS du site. Détermine l'irradiance PV (récupérée via PVGIS) et le profil de vent (via Open-Meteo). En cas d'échec API, des profils types sont utilisés.", en: 'GPS latitude of the site. Determines PV irradiance (fetched via PVGIS) and wind profile (via Open-Meteo). On API failure, default profiles are used.' },
  'help.lon':                      { fr: 'Longitude GPS du site. Cliquez sur la carte ou glissez le marqueur pour modifier la position.', en: 'GPS longitude of the site. Click the map or drag the marker to change the position.' },
  'help.num_homes':                { fr: "Nombre d'unités résidentielles raccordées au microgrid (foyers, bureaux, etc.). Multiplie le profil de charge journalier normalisé.", en: 'Number of residential units connected to the microgrid (households, offices, etc.). Multiplies the normalized daily load profile.' },
  'help.peak_per_home':            { fr: "Puissance crête appelable par unité. Charge horaire = nb unités × peak/unité × profil normalisé. Hypothèse : 1.5-3 kW pour un foyer standard, 2 kW par défaut.", en: 'Peak power per unit. Hourly load = nb units × peak/unit × normalized profile. Assumption: 1.5–3 kW per standard household, 2 kW default.' },
  'help.seasonality':              { fr: "Surconsommation hivernale appliquée à la charge totale. ×(1+S) en jan./déc., ×(1+0.7S) en novembre, ×(1+0.5S) en mars. Hypothèse : 30 % pour un site avec chauffage électrique, ~5 % sinon.", en: 'Winter overconsumption applied to total load. ×(1+S) in Jan/Dec, ×(1+0.7S) in November, ×(1+0.5S) in March. Assumption: 30% for a site with electric heating, ~5% otherwise.' },
  'help.commercial_power':         { fr: "Charge tertiaire ajoutée en journée (8h-18h) — commerces, bureaux. S'ajoute au profil résidentiel et impacte directement le pic d'appel.", en: 'Commercial load added during daytime (8am-6pm) — shops, offices. Added to the residential profile and directly impacts peak demand.' },
  'help.thermal_ratio':            { fr: "Rapport demande chaleur / demande électrique. 0 = pas de besoin thermique. 0.2-0.3 = tertiaire avec ECS uniquement. 1+ = chauffage thermique majeur.", en: 'Heat demand / electrical demand ratio. 0 = no thermal need. 0.2–0.3 = commercial with DHW only. 1+ = major thermal heating.' },
  'help.solar_capex':              { fr: "Coût d'investissement total des modules PV par kWc installé : panneaux, structure, câblage DC, installation. Hypothèse 2025 : 600 €/kWc pour PV en toiture résidentielle/tertiaire.", en: 'Total investment cost of PV modules per kWp installed: panels, structure, DC cabling, installation. 2025 assumption: 600 €/kWp for residential/commercial rooftop PV.' },
  'help.solar_lifetime':           { fr: "Durée de vie économique du module PV. Détermine l'annuité CAPEX. Hypothèse : 25 ans (garantie panneau standard).", en: 'Economic lifetime of the PV module. Determines the CAPEX annuity. Assumption: 25 years (standard panel warranty).' },
  'help.solar_degradation':        { fr: "Perte de performance annuelle linéaire du module. Typiquement 0.5 %/an pour silicium cristallin moderne. Modélise la dégradation UV + thermique.", en: 'Annual linear performance loss of the module. Typically 0.5%/yr for modern crystalline silicon. Models UV + thermal degradation.' },
  'help.solar_inverter_capex':     { fr: "Coût de l'onduleur de couplage AC par kW. Convertit le DC du panneau en AC. Hypothèse : 150 €/kW.", en: 'Cost of the AC coupling inverter per kW. Converts panel DC to AC. Assumption: 150 €/kW.' },
  'help.solar_inverter_lifetime':  { fr: "Durée de vie de l'onduleur PV. Plus courte que les modules → un renouvellement à mi-vie est intégré. Hypothèse : 10 ans.", en: 'PV inverter lifetime. Shorter than modules → a mid-life replacement is integrated. Assumption: 10 years.' },
  'help.max_solar_kw':             { fr: "Puissance PV maximale installable (contrainte de surface). 1 kWc ≈ 5-6 m² de toiture. Défaut : 200 kWc. Mettre à 0 pour désactiver la limite.", en: 'Maximum installable PV power (area constraint). 1 kWp ≈ 5–6 m² of roof area. Default: 200 kWp. Set to 0 to disable the limit.' },
  'help.solar_temp_coeff':         { fr: "Coefficient de température de puissance du module PV (γ). Typ. −0.003 à −0.005/°C. ∼−0.4%/°C.", en: "PV module power temperature coefficient (γ). Typ. −0.003 to −0.005/°C. ∼−0.4%/°C." },
  'help.solar_tilt':               { fr: "Inclinaison des panneaux par rapport à l'horizontale. 0° = à plat, 30° = toiture standard, 90° = façade (BIPV). L'optimum à Paris est ∼35°.", en: "Panel tilt from horizontal. 0° = flat, 30° = standard roof, 90° = façade (BIPV). Optimum at Paris ∼35°." },
  'help.solar_azimuth':            { fr: "Orientation des panneaux. Convention PVGIS : 0° = Sud, −90° = Est, 90° = Ouest. Une toiture plein sud = 0°.", en: "Panel azimuth. PVGIS convention: 0° = South, −90° = East, 90° = West. South-facing roof = 0°." },
  'help.solar_albedo':             { fr: "Albédo du sol : fraction du rayonnement réfléchi vers les panneaux. 0.2 = sol/herbe, 0.5 = béton clair, 0.8 = neige fraîche.", en: "Ground albedo: reflected radiation fraction. 0.2 = ground/grass, 0.5 = light concrete, 0.8 = fresh snow." },
  'help.solar_tracking':           { fr: "Mode de suivi solaire. Fixe : inclinaison/orientation constantes. Mono-axe : axe N-S horizontal, suit E→W. Bi-axe : toujours face au soleil.", en: "Solar tracking mode. Fixed: constant tilt/azimuth. Single-axis: horizontal N-S axis, tracks E→W. Dual-axis: always faces the sun." },
  'param.solar_temp_coeff':        { fr: 'Coeff. température γ',          en: 'Temp. coefficient γ' },
  'param.solar_tilt':              { fr: 'Inclinaison',                   en: 'Tilt angle' },
  'param.solar_azimuth':           { fr: 'Orientation',                   en: 'Azimuth' },
  'param.solar_albedo':            { fr: 'Albédo sol',                    en: 'Ground albedo' },
  'param.solar_tracking':          { fr: 'Tracking',                      en: 'Tracking' },
  'tracking.fixed':                { fr: 'Fixe',                          en: 'Fixed' },
  'tracking.mono_h':               { fr: 'Mono-axe horiz. (E→W)',        en: 'Horizontal single-axis (E→W)' },
  'tracking.dual':                 { fr: 'Bi-axe (face au soleil)',       en: 'Dual-axis (sun-facing)' },
  'help.wind_capex':               { fr: "Coût total d'une turbine éolienne par kW installé : mât, génératrice, fondations, raccordement. Hypothèse : 1500 €/kW pour onshore petite/moyenne échelle.", en: 'Total cost of a wind turbine per kW installed: mast, generator, foundations, connection. Assumption: 1500 €/kW for small/medium-scale onshore.' },
  'help.wind_lifetime':            { fr: "Durée de vie d'une turbine éolienne. Hypothèse : 20-25 ans (limite par fatigue mécanique).", en: 'Wind turbine lifetime. Assumption: 20–25 years (mechanical fatigue limit).' },
  'help.max_wind_kw':              { fr: "Puissance éolienne maximale installable (contrainte de terrain / réglementation). Une petite éolienne = 5-20 kW, une moyenne = 100-500 kW. Défaut : 200 kW. Mettre à 0 pour désactiver la limite.", en: 'Maximum installable wind power (land/regulatory constraint). Small turbine = 5–20 kW, medium = 100–500 kW. Default: 200 kW. Set to 0 to disable the limit.' },
  'help.hydro_capex':              { fr: "Coût d'une turbine hydraulique par kW. Très variable selon le site (chute, débit). Hypothèse : 2500 €/kW pour pico/petite hydro.", en: 'Cost of a hydro turbine per kW. Highly site-dependent (head, flow). Assumption: 2500 €/kW for pico/small hydro.' },
  'help.hydro_flow':              { fr: "Multiplicateur sur la disponibilité hydraulique annuelle. 1.0 = nominal. Permet de simuler une saison sèche (<1) ou humide (>1).", en: 'Multiplier on annual hydro availability. 1.0 = nominal. Allows simulating a dry (<1) or wet (>1) season.' },
  'help.hydro_lifetime':           { fr: "Durée de vie d'une turbine hydraulique. Souvent supérieure à 30 ans avec maintenance régulière.", en: 'Hydro turbine lifetime. Often over 30 years with regular maintenance.' },
  'help.bess_capex':               { fr: "Coût des cellules Li-ion par kWh de capacité utile, hors onduleur. Hypothèse 2025 : 300 €/kWh (LFP en pack industriel).", en: 'Cost of Li-ion cells per kWh of usable capacity, excluding inverter. 2025 assumption: 300 €/kWh (LFP in industrial pack).' },
  'help.bess_inverter_capex':      { fr: "Coût de l'onduleur batterie (PCS) bidirectionnel par kW. Détermine le ratio Puissance/Énergie de la batterie.", en: 'Cost of the bidirectional battery inverter (PCS) per kW. Determines the Power/Energy ratio of the battery.' },
  'help.bess_cycle_cost':          { fr: "Coût d'usure marginal par kWh déchargé. Pénalise les cycles inutiles dans l'objectif. Calibré sur la dégradation calendaire+cyclique.", en: 'Marginal wear cost per kWh discharged. Penalizes unnecessary cycles in the objective. Calibrated on calendar + cyclic degradation.' },
  'help.eff_ch':                   { fr: 'Rendement de charge (kWh stockés / kWh injectés). Pertes thermiques et électriques. Hypothèse : 0.95 pour Li-ion.', en: 'Charge efficiency (kWh stored / kWh injected). Thermal and electrical losses. Assumption: 0.95 for Li-ion.' },
  'help.eff_dis':                  { fr: 'Rendement de décharge (kWh restitués / kWh stockés). Hypothèse : 0.95. Aller-retour ≈ η_ch × η_dis ≈ 0.90.', en: 'Discharge efficiency (kWh returned / kWh stored). Assumption: 0.95. Round-trip ≈ η_ch × η_dis ≈ 0.90.' },
  'help.min_soc':                  { fr: "État de charge minimum (en fraction). Préserve la durée de vie en évitant les décharges profondes. 0.20 = 20 % de capacité toujours réservée.", en: 'Minimum state of charge (fraction). Preserves lifespan by avoiding deep discharges. 0.20 = 20% of capacity always reserved.' },
  'help.bess_lifetime':            { fr: "Durée de vie économique de la batterie. Hypothèse : 10 ans (LFP) à 80 % de la capacité initiale. Renouvelée à chaque échéance dans le bilan 25 ans.", en: 'Economic battery lifetime. Assumption: 10 years (LFP) at 80% of initial capacity. Replaced at each maturity in the 25-year balance.' },
  'help.max_flex':                 { fr: "Part de la charge horaire déplaçable dans la même journée (Demand Response). Le LP peut avancer ou retarder cette fraction. Hypothèse : 10 % avec asservissement smart, 0 % sans pilotage.", en: 'Share of hourly load that can be shifted within the same day (Demand Response). The LP can advance or delay this fraction. Assumption: 10% with smart control, 0% without.' },
  'help.num_evs':                  { fr: "Nombre de véhicules électriques raccordés au site. Modèle simplifié : 50 kWh/véh, charge entre 18h-7h, départ avec batterie pleine à 7h.", en: 'Number of EVs connected to the site. Simplified model: 50 kWh/EV, charging between 6pm–7am, departure with full battery at 7am.' },
  'help.v2g_enabled':              { fr: "Vehicle-to-Grid : autorise les VE à réinjecter de l'énergie dans le microgrid pendant la nuit. Augmente la flexibilité, mais accélère la dégradation de la batterie VE.", en: 'Vehicle-to-Grid: allows EVs to feed energy back into the microgrid at night. Increases flexibility but accelerates EV battery degradation.' },
  'help.hp_capex':                 { fr: "Coût d'une pompe à chaleur air/eau par kW thermique restitué. Hypothèse : 800 €/kWth (PAC industrielle/collectif).", en: 'Cost of an air-to-water heat pump per kW of thermal output. Assumption: 800 €/kWth (industrial/collective HP).' },
  'help.cop_hp':                   { fr: "COP nominal de la PAC à +7°C extérieur. Le COP réel varie avec la T° ambiante via un modèle de Carnot (M3). Air/eau standard : 3.0. Géothermie : 4-5.", en: 'Nominal HP COP at +7°C outdoor. Actual COP varies with ambient temperature via a Carnot model (M3). Standard air/water: 3.0. Geothermal: 4–5.' },
  'help.hp_supply_temp':           { fr: "Température de distribution du circuit de chauffage. Plancher chauffant : 35°C. Radiateurs : 55°C. Une T° plus basse améliore significativement le COP.", en: "Heating circuit supply temperature. Underfloor heating: 35°C. Radiators: 55°C. Lower temperatures significantly improve COP." },
  'param.hp_supply_temp':          { fr: 'T° distribution',               en: 'Supply temp.' },
  'help.hp_lifetime':              { fr: "Durée de vie d'une pompe à chaleur. Hypothèse : 15 ans (compresseur + échangeurs).", en: 'Heat pump lifetime. Assumption: 15 years (compressor + heat exchangers).' },
  'help.tes_capex':                { fr: "Coût d'un ballon de stockage thermique par kWh capacité. Hypothèse : 50 €/kWh (eau pressurisée + isolation).", en: 'Cost of a thermal storage tank per kWh capacity. Assumption: 50 €/kWh (pressurized water + insulation).' },
  'help.tes_lifetime':             { fr: "Durée de vie d'un ballon thermique. Hypothèse : 20 ans.", en: 'Thermal storage tank lifetime. Assumption: 20 years.' },
  'help.boiler_capex':             { fr: "Coût d'une chaudière à condensation par kW thermique. Hypothèse : 150 €/kW.", en: 'Cost of a condensing boiler per kW thermal. Assumption: 150 €/kW.' },
  'help.boiler_eff':               { fr: "Rendement PCI de la chaudière. Hypothèse : 0.90 pour condensation gaz moderne. ~0.80 pour chaudière classique.", en: 'Boiler LHV efficiency. Assumption: 0.90 for modern condensing gas. ~0.80 for standard boiler.' },
  'help.boiler_lifetime':          { fr: "Durée de vie d'une chaudière. Hypothèse : 15 ans.", en: 'Boiler lifetime. Assumption: 15 years.' },
  'help.gas_fuel':                 { fr: "Prix unitaire du gaz naturel par kWh PCI consommé. Source : tarif fournisseur gaz. Hypothèse 2025 : 0.20 €/kWh PCI pour gaz industriel.", en: 'Unit price of natural gas per kWh LHV consumed. Source: gas supplier tariff. 2025 assumption: 0.20 €/kWh LHV for industrial gas.' },
  'help.ramp_limit_kw':            { fr: "Limite la variation horaire de la puissance du moteur gaz. 0 = pas de contrainte (montée/descente instantanée). Réaliste : 30-50 % Pnom/h.", en: 'Limits the hourly variation of gas engine power. 0 = no constraint (instantaneous ramp). Realistic: 30–50% Pnom/h.' },
  'help.gas_lifetime':             { fr: "Durée de vie d'un groupe électrogène gaz. Hypothèse : 15 ans (mode peaker), plus long si base load.", en: 'Gas genset lifetime. Assumption: 15 years (peaker mode), longer if base load.' },
  'help.grid_connected':           { fr: "Le microgrid est-il connecté au réseau public ? Si non : autonomie totale (îloté), pas d'achat ni de vente — moteur gaz et batterie doivent compenser tous les écarts.", en: 'Is the microgrid connected to the public grid? If not: full autonomy (off-grid), no buying or selling — gas engine and battery must compensate all imbalances.' },
  'help.use_spot_market':          { fr: "Utilise les prix spot horaires (24 valeurs typiques) au lieu des tarifs HC/HP fixes. Reflète mieux la volatilité réelle du marché. Nécessite d'être connecté au réseau.", en: 'Uses hourly spot prices (24 typical values) instead of fixed peak/off-peak tariffs. Better reflects real market volatility. Requires grid connection.' },
  'help.grid_peak_price':          { fr: "Tarif d'achat heures pleines du fournisseur (8h-20h). Hypothèse : 0.25 €/kWh (TURPE + fourniture professionnel).", en: 'Peak-hour purchase tariff (8am-8pm). Assumption: 0.25 €/kWh (TURPE + professional supply).' },
  'help.grid_offpeak_price':       { fr: "Tarif d'achat heures creuses (20h-8h). Hypothèse : 0.12 €/kWh.", en: 'Off-peak purchase tariff (8pm-8am). Assumption: 0.12 €/kWh.' },
  'help.grid_sell_price':          { fr: "Tarif d'injection sur le réseau public — revente du surplus. Hypothèse : 0.10 €/kWh (tarif Obligation d'Achat moyen).", en: 'Feed-in tariff to the public grid — surplus sale. Assumption: 0.10 €/kWh (average Feed-in Tariff).' },
  'help.demand_charge':            { fr: "Abonnement mensuel par kW souscrit. Le LP minimise la souscription en lissant les pics. Hypothèse : 10 €/kW/mois (TURPE C5).", en: 'Monthly subscription per kW subscribed. The LP minimizes subscription by smoothing peaks. Assumption: 10 €/kW/month (TURPE C5).' },
  'help.cable_capex':              { fr: 'Coût du raccordement HTA, proportionnel à la puissance crête du site. Hypothèse : 150 €/kW peak.', en: 'HV connection cost, proportional to site peak power. Assumption: 150 €/kW peak.' },
  'help.discount_rate':            { fr: "Coût moyen pondéré du capital (WACC). Utilisé pour calculer la VAN et le LCOE annualisé. Hypothèse : 5 % pour un projet d'efficacité énergétique.", en: 'Weighted Average Cost of Capital (WACC). Used to compute NPV and annualized LCOE. Assumption: 5% for an energy efficiency project.' },
  'help.grid_inflation':           { fr: "Taux d'augmentation annuel des tarifs électricité. Hypothèse : 4 %/an (intermédiaire entre inflation générale et tendance historique).", en: 'Annual increase rate of electricity tariffs. Assumption: 4%/yr (between general inflation and historical trend).' },
  'help.gas_inflation':            { fr: "Taux d'augmentation annuel du prix du gaz. Hypothèse : 2 %/an (moins volatile sur le long terme).", en: 'Annual increase rate of gas price. Assumption: 2%/yr (less volatile in the long term).' },
  'help.om_inflation':             { fr: "Taux d'augmentation annuel des coûts d'exploitation et maintenance. Hypothèse : 2 %/an (aligné sur l'inflation générale).", en: 'Annual increase rate of O&M costs. Assumption: 2%/yr (aligned with general inflation).' },
  'help.voll':                     { fr: 'Value Of Lost Load — pénalité par kWh non fourni en cas de défaillance. Hypothèse : 5 €/kWh pour tertiaire/résidentiel. Industries critiques : >50 €/kWh.', en: 'Value Of Lost Load — penalty per kWh not supplied in case of failure. Assumption: 5 €/kWh for commercial/residential. Critical industries: >50 €/kWh.' },
  'help.p90_mode':                 { fr: "P90 forfaitaire : réduit les EnR de 15 % et augmente la charge de 10 %. Rapide (0s) mais moins précis que l'analyse stochastique (données réelles NASA). Les deux modes sont exclusifs.", en: "Flat P90 factor: reduces renewables by 15% and increases load by 10%. Fast (0s) but less precise than stochastic analysis (real NASA data). The two modes are mutually exclusive." },
  'help.run_sensitivity':          { fr: 'Lance ~16 optimisations supplémentaires en faisant varier ±20 % chaque paramètre clé. Alimente le diagramme Tornado. Ajoute 5-10 s au calcul.', en: 'Runs ~16 additional optimizations varying each key parameter by ±20%. Feeds the Tornado chart. Adds 5–10 s to calculation time.' },
  'help.forecast_error':           { fr: "Bruit blanc multiplicatif appliqué aux profils PV/vent. Modélise l'incertitude de prévision météo. 0 = profils déterministes.", en: 'Multiplicative white noise applied to PV/wind profiles. Models weather forecast uncertainty. 0 = deterministic profiles.' },
  'help.use_8760h':                { fr: "Résolution 8760h : utilise une année complète de 8760 heures chronologiques au lieu des 12 jours-types (288h). LP uniquement (pas de MILP). Les données météo proviennent de PVGIS et Open-Meteo pour l'année 2020. Calcul plus long (~10-60 s).", en: "8760h resolution: uses a full year of 8760 chronological hours instead of 12 typical days (288h). LP only (no MILP). Weather data from PVGIS and Open-Meteo for year 2020. Longer computation (~10–60 s)." },
  'param.use_8760h':               { fr: 'Résolution 8760h (année complète)',  en: '8760h resolution (full year)' },
  'param.resolution':              { fr: 'Résolution',                    en: 'Resolution' },
  'resolution.288h':               { fr: '288h — 12 jours-types',         en: '288h — 12 typical days' },
  'resolution.672h':               { fr: '672h — 4 semaines-types',       en: '672h — 4 typical weeks' },
  'resolution.8760h':              { fr: '8760h — année complète',        en: '8760h — full year' },
  'help.resolution':               { fr: "Résolution temporelle du modèle. 288h : 12 jours-types (1 par mois), rapide, MILP dispo. 672h : 4 semaines-types (1 par saison), capture les cycles semaine/week-end, MILP dispo. 8760h : année chronologique complète, LP uniquement.", en: "Model temporal resolution. 288h: 12 typical days (1/month), fast, MILP available. 672h: 4 typical weeks (1/season), captures weekday/weekend cycles, MILP available. 8760h: full chronological year, LP only." },
  'param.stochastic':              { fr: 'Analyse P90 multi-années',     en: 'Multi-year P90 analysis' },
  'help.stochastic':               { fr: "Analyse P90 réelle : chaque année NASA POWER (2013–2022) = 1 scénario météo. L'optimiseur tourne ~10× → distribution P10/P50/P90 des KPIs. Temps de calcul : ~30s (288h) / ~80s (672h) / ⚠ ~10 min (8760h). Remplace le P90 forfaitaire (×0.85).", en: "True P90 analysis: each NASA POWER year (2013–2022) = 1 weather scenario. Optimizer runs ~10× → P10/P50/P90 KPI distribution. Computation time: ~30s (288h) / ~80s (672h) / ⚠ ~10 min (8760h). Replaces the flat P90 factor (×0.85)." },
  'stochastic.time_288h':          { fr: '~30s en 288h',                 en: '~30s in 288h' },
  'stochastic.time_672h':          { fr: '~80s en 672h',                 en: '~80s in 672h' },
  'stochastic.time_8760h':         { fr: '⚠ ~10 min en 8760h',          en: '⚠ ~10 min in 8760h' },
  'stochastic.no_data':            { fr: 'Données NASA insuffisantes — analyse stochastique impossible.', en: 'Insufficient NASA data — stochastic analysis unavailable.' },
  'kpi.stochastic_title':          { fr: 'Distribution P90 multi-années', en: 'Multi-year P90 distribution' },
  'param.extreme_events':          { fr: 'Stress-test év. extrêmes',     en: 'Extreme event stress-test' },
  'help.extreme_events':           { fr: "Détecte les pires séquences météo dans l'année 2020 (dark doldrums, vague de froid, canicule) et analyse la résilience du système sur ces séquences. Nécessite la résolution 8760h. ~2 min de calcul supplémentaires.", en: "Detects worst weather sequences in 2020 (dark doldrums, cold wave, heat wave) and analyzes system resilience on these sequences. Requires 8760h resolution. ~2 min extra computation." },
  'param.n1_reserve':              { fr: 'Contrainte N-1',                en: 'N-1 reserve' },
  'help.n1_reserve':               { fr: "Garantit que le microgrid peut couvrir la charge même en cas de perte du plus gros producteur (solaire, éolien, hydro ou groupe gaz). Dimensionne la batterie et le backup pour assurer la résilience. Ajoute ~4 contraintes/heure au LP.", en: "Ensures the microgrid can cover the load even if the largest generator fails (solar, wind, hydro, or gas genset). Sizes battery and backup for resilience. Adds ~4 constraints/hour to the LP." },
  'extreme.title':                 { fr: 'Matrice de résilience — Événements extrêmes', en: 'Resilience matrix — Extreme events' },
  'extreme.subtitle':              { fr: 'Pires séquences historiques détectées', en: 'Worst historical sequences detected' },
  'extreme.duration':              { fr: 'Durée',                        en: 'Duration' },
  'extreme.coverage':              { fr: 'Couverture',                   en: 'Coverage' },
  'extreme.shed':                  { fr: 'Délestage',                    en: 'Shedding' },
  'extreme.backup':                { fr: 'Backup gaz',                   en: 'Gas backup' },
  'extreme.not_detected':          { fr: 'Aucun événement détecté — les 10 années analysées ne contiennent pas de séquence extrême à cette localisation.', en: 'No event detected — the 10 analyzed years contain no extreme sequence at this location.' },
  'extreme.requires_8760h':        { fr: 'Nécessite la résolution 8760h. Passez en 8760h dans Modélisation.', en: 'Requires 8760h resolution. Switch to 8760h in Modeling.' },
  'extreme.help_coverage':         { fr: 'Part de la demande électrique couverte pendant la séquence (sans délestage).', en: 'Share of electric demand covered during the sequence (without shedding).' },
  'extreme.help_shed':             { fr: 'Énergie non servie (délestage) pendant la séquence extrême.', en: 'Unserved energy (load shedding) during the extreme sequence.' },
  'extreme.help_backup':           { fr: 'Énergie produite par le groupe gaz de secours pendant la séquence.', en: 'Energy produced by the gas backup generator during the sequence.' },
  'extreme.help_duration':         { fr: 'Nombre d\'heures consécutives où les conditions extrêmes persistent.', en: 'Number of consecutive hours where extreme conditions persist.' },
  'extreme.no_event_title':        { fr: 'Aucune séquence extrême détectée', en: 'No extreme sequence detected' },
  'extreme.no_event_desc':         { fr: 'Sur les {years} années analysées ({days} jours), aucun événement extrême (dark doldrums, vague de froid, canicule) n\'a été détecté à cette localisation. Le climat est favorable.', en: 'Over {years} analyzed years ({days} days), no extreme event (dark doldrums, cold wave, heat wave) was detected at this location. The climate is favorable.' },
  'extreme.legend_title':          { fr: 'Interprétation des indicateurs', en: 'How to read the indicators' },
  'help.max_annual_co2_t':         { fr: "Plafond annuel d'émissions CO₂ (en tonnes). Si > 0, le LP doit respecter cette contrainte (peut rendre le problème infaisable). 0 = pas de contrainte (mode pure économique).", en: 'Annual CO₂ emission cap (in tons). If > 0, the LP must satisfy this constraint (may make the problem infeasible). 0 = no constraint (pure economic mode).' },
  'help.include_solar':            { fr: "Désactivé : le solveur n'installera pas de PV (cap = 0). Réactiver pour intégrer le solaire au dimensionnement.", en: 'Disabled: the solver will not install PV (cap = 0). Re-enable to include solar in the sizing.' },
  'help.include_wind':             { fr: "Désactivé : le solveur n'installera pas d'éolien.", en: 'Disabled: the solver will not install wind.' },
  'help.include_hydro':            { fr: "Désactivé : pas de turbine hydraulique.", en: 'Disabled: no hydro turbine.' },
  'help.include_battery':          { fr: "Désactivé : pas de batterie BESS, le LP devra gérer les écarts via gaz/réseau/délestage.", en: 'Disabled: no BESS battery, the LP will have to manage imbalances via gas/grid/shedding.' },
  'help.include_hp':               { fr: 'Désactivé : pas de pompe à chaleur. La demande thermique sera servie uniquement par chaudière + ballon.', en: 'Disabled: no heat pump. Thermal demand will be served only by boiler + TES.' },
  'help.include_boiler':           { fr: 'Désactivé : pas de chaudière gaz. La chaleur viendra uniquement de la PAC + ballon.', en: 'Disabled: no gas boiler. Heat will come only from HP + TES.' },
  'help.include_gas':              { fr: "Désactivé : pas de moteur gaz. Le LP préférera les renouvelables, la batterie ou le réseau.", en: 'Disabled: no gas engine. The LP will prefer renewables, battery, or the grid.' },
  'help.run':                      { fr: "Lance l'optimisation linéaire (CBC). Durée typique : 1-3 s. Avec l'analyse de sensibilité activée : ~10 s supplémentaires (~16 résolutions).", en: 'Runs the linear optimization (CBC). Typical duration: 1–3 s. With sensitivity analysis enabled: ~10 s additional (~16 resolutions).' },
  'help.reset':                    { fr: 'Remet tous les paramètres aux valeurs par défaut et réinitialise les inclusions de sources.', en: 'Resets all parameters to default values and reinitializes source inclusions.' },

  // ── Unités ────────────────────────────────────────────────────────────
  'unit.year':                     { fr: 'an',                             en: 'yr' },
  'unit.years':                    { fr: 'ans',                            en: 'yrs' },
  'unit.veh':                      { fr: 'véh.',                           en: 'veh.' },
  'unit.per_month':                { fr: '/mois',                          en: '/mo' },
  'unit.pct_yr':                   { fr: '%/an',                           en: '%/yr' },

  // ── Status pill ───────────────────────────────────────────────────────
  'status.waiting':                { fr: 'En attente — configurez les paramètres puis lancez.', en: 'Waiting — configure parameters then run.' },
  'status.success':                { fr: 'Optimisation terminée',          en: 'Optimization complete' },
  'status.error':                  { fr: 'Erreur',                         en: 'Error' },

  // ── Include banner ────────────────────────────────────────────────────
  'include.in_modeling':           { fr: 'dans la modélisation',           en: 'in the modeling' },
};

// ───────────────────────────────────────────────────────────────────────────
// Helper : traduction des unités
// ───────────────────────────────────────────────────────────────────────────
const UNIT_MAP = {
  'ans':    'unit.years',
  'an':     'unit.year',
  'véh.':   'unit.veh',
  '/mois':  'unit.per_month',
  '%/an':   'unit.pct_yr',
  '€/kW peak': 'unit.kw_peak',
};

export function tUnit(unit, t) {
  if (!unit) return unit;
  const key = UNIT_MAP[unit];
  return key ? t(key) : unit;
}

// ───────────────────────────────────────────────────────────────────────────
// Contexte
// ───────────────────────────────────────────────────────────────────────────
const I18nContext = createContext();

const LANGS = ['fr', 'en'];
const STORAGE_KEY = 'microgrid_lang';

function detectLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LANGS.includes(stored)) return stored;
  } catch (_) {}
  const nav = (navigator.language || '').toLowerCase();
  return nav.startsWith('fr') ? 'fr' : 'en';
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectLang);
  const [hasChosen, setHasChosen] = useState(() => {
    try { return !!localStorage.getItem(STORAGE_KEY); } catch (_) { return false; }
  });

  const setLang = useCallback((l) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch (_) {}
    setHasChosen(true);
  }, []);

  const t = useCallback((key) => {
    const entry = DICT[key];
    if (!entry) return key;
    return entry[lang] ?? entry['en'] ?? key;
  }, [lang]);

  return (
    React.createElement(I18nContext.Provider, { value: { lang, setLang, t, hasChosen } }, children)
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export { DICT };
