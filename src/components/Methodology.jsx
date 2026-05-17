import React from 'react';
import { Modal } from './Primitives';
import { useI18n } from '../i18n';

const H2 = ({ children }) => <h2 className="text-[13px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400 mt-6 mb-2 first:mt-0">{children}</h2>;
const H3 = ({ children }) => <h3 className="text-xs font-semibold text-ink-800 dark:text-ink-100 mt-4 mb-1.5">{children}</h3>;
const P = ({ children }) => <p className="text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">{children}</p>;
const UL = ({ children }) => <ul className="text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300 list-disc pl-5 space-y-1">{children}</ul>;
const LI = ({ children }) => <li>{children}</li>;
const Code = ({ children }) => <code className="font-mono text-[11.5px] bg-ink-100 dark:bg-ink-800 px-1.5 py-0.5 rounded text-ink-800 dark:text-ink-200">{children}</code>;
const Formula = ({ children }) => <div className="my-2 p-3 rounded-lg bg-ink-50 dark:bg-ink-800/60 border border-ink-200 dark:border-ink-700 font-mono text-[11.5px] text-ink-800 dark:text-ink-200 text-center">{children}</div>;

export default function Methodology({ open, onClose }) {
  const { t, lang } = useI18n();
  const FR = lang === 'fr';

  return (
    <Modal open={open} onClose={onClose} title={t('methodo.title')}>
      {/* ═══════════════════════════════════════════════════════════════════════
          SOMMAIRE
          ═══════════════════════════════════════════════════════════════════ */}
      <H2>{FR ? 'Sommaire' : 'Table of contents'}</H2>
      <UL>
        <LI>1. {FR ? 'Architecture du code' : 'Code architecture'}</LI>
        <LI>2. {FR ? 'Architecture temporelle' : 'Temporal architecture'} — 288h / 672h / 8760h</LI>
        <LI>3. {FR ? 'Données météorologiques' : 'Weather data'} — NASA POWER, PVGIS, Open-Meteo</LI>
        <LI>4. {FR ? 'Construction de la charge' : 'Load construction'} — {FR ? 'saisonnalité, tertiaire, thermique' : 'seasonality, commercial, thermal'}</LI>
        <LI>5. {FR ? 'Variables de décision' : 'Decision variables'} — {FR ? 'capacités + flux horaires' : 'capacities + hourly flows'}</LI>
        <LI>6. {FR ? 'Fonction objectif' : 'Objective function'} — CAPEX + OPEX</LI>
        <LI>7. {FR ? 'Contraintes' : 'Constraints'} — {FR ? 'bilans, stockage, réseau, N-1' : 'balances, storage, grid, N-1'}</LI>
        <LI>8. {FR ? 'Effets de la température' : 'Temperature effects'} — NOCT, COP Carnot, {FR ? 'chaudière condensation' : 'condensing boiler'}</LI>
        <LI>9. {FR ? 'Géométrie solaire & trackers' : 'Solar geometry & trackers'} — HDKR, tilt, azimuth, tracking</LI>
        <LI>10. {FR ? 'Analyse stochastique P90' : 'Stochastic P90 analysis'}</LI>
        <LI>11. {FR ? 'Événements extrêmes' : 'Extreme events'} — dark doldrums, {FR ? 'vague de froid, canicule' : 'cold wave, heat wave'}</LI>
        <LI>12. {FR ? 'Dégradation progressive de la batterie' : 'Progressive battery degradation'}</LI>
        <LI>13. {FR ? 'Résolution du problème LP' : 'LP problem solving'} — CBC, {FR ? 'simplexe' : 'simplex'}</LI>
        <LI>14. {FR ? 'Analyse financière sur 25 ans' : '25-year financial analysis'} — VAN, TRI, ROI</LI>
        <LI>15. {FR ? 'Bilan carbone' : 'Carbon balance'} — CO₂ {FR ? 'embarqué + opérationnel' : 'embodied + operational'}</LI>
        <LI>16. {FR ? 'Hypothèses et limites' : 'Assumptions and limitations'}</LI>
        <LI>17. {FR ? 'Références' : 'References'}</LI>
      </UL>

      {/* ═══════════════════════════════════════════════════════════════════════
          1. ARCHITECTURE DU CODE
          ═══════════════════════════════════════════════════════════════════ */}
      <H2>{FR ? '1. Architecture du code' : '1. Code architecture'}</H2>
      <P>
        {FR
          ? "Le projet se compose d'un backend Python (FastAPI + PuLP) et d'un frontend React (Vite + Recharts). Le fichier principal main.py orchestre l'ensemble : réception des requêtes, récupération des données météo, optimisation LP, et calcul des indicateurs financiers et carbone."
          : 'The project consists of a Python backend (FastAPI + PuLP) and a React frontend (Vite + Recharts). The main file main.py orchestrates everything: request handling, weather data fetching, LP optimization, and financial/carbon indicator calculation.'
        }
      </P>
      <P>{FR ? 'Structure du backend :' : 'Backend structure:'}</P>
      <UL>
        <LI>
          {FR
            ? <><strong>Modèles Pydantic</strong> — <Code>EcoParams</Code> (60+ paramètres en 8 sous-modèles : SolarSpecs, WindSpecs, HydroSpecs, StorageSpecs, ThermalSpecs, GasSpecs, GridConfig, EconomicConfig), <Code>TimeseriesData</Code> (entrées), <Code>SimulateRequest</Code> (capacités manuelles)</>
            : <><strong>Pydantic models</strong> — <Code>EcoParams</Code> (60+ parameters in 8 sub-models: SolarSpecs, WindSpecs, HydroSpecs, StorageSpecs, ThermalSpecs, GasSpecs, GridConfig, EconomicConfig), <Code>TimeseriesData</Code> (inputs), <Code>SimulateRequest</Code> (manual capacities)</>
          }
        </LI>
        <LI>
          {FR
            ? <><strong>Services météo</strong> — <Code>weather_service.py</Code> : NASA POWER (GHI, DNI, T2M sur ~10 ans), TMY, loi log vent, courbe puissance quadratique, géométrie solaire (déclinaison, AOI), transposition HDKR, modes tracker, profils COP/η_chaudière, fallbacks PVGIS/Open-Meteo</>
            : <><strong>Weather services</strong> — <Code>weather_service.py</Code> : NASA POWER (GHI, DNI, T2M over ~10 years), TMY, log wind law, quadratic power curve, solar geometry (declination, AOI), HDKR transposition, tracker modes, COP/η_boiler profiles, PVGIS/Open-Meteo fallbacks</>
          }
        </LI>
        <LI>
          {FR
            ? <><strong>solve_microgrid()</strong> — construit le problème PuLP, déclare les variables, définit la fonction objectif, ajoute les contraintes, résout via CBC et extrait les résultats. Supporte les 3 résolutions (288h/672h/8760h).</>
            : <><strong>solve_microgrid()</strong> — builds the PuLP problem, declares variables, defines the objective, adds constraints, solves via CBC, and extracts results. Supports all 3 resolutions (288h/672h/8760h).</>
          }
        </LI>
        <LI>
          {FR
            ? <><strong>solve_simulation()</strong> — même structure mais avec les capacités fixées par l'utilisateur. Seul le dispatch horaire est optimisé.</>
            : <><strong>solve_simulation()</strong> — same structure but with user-fixed capacities. Only hourly dispatch is optimized.</>
          }
        </LI>
        <LI>
          {FR
            ? <><strong>Boucle financière 25 ans</strong> — <Code>_financial_loop()</Code> : calcule les cash-flows annuels (OPEX baseline − OPEX microgrid − remplacements + valeur résiduelle), la VAN, le TRI (bissection ou numpy_financial), le ROI et le Carbon Payback.</>
            : <><strong>25-year financial loop</strong> — <Code>_financial_loop()</Code> : computes annual cash flows (baseline OPEX − microgrid OPEX − replacements + residual value), NPV, IRR (bisection or numpy_financial), ROI, and Carbon Payback.</>
          }
        </LI>
        <LI>
          {FR
            ? <><strong>Analyse stochastique & extrême</strong> — <Code>stochastic.py</Code> (P90 multi-années) et <Code>extreme_events.py</Code> (stress-test dark doldrums/froid/canicule)</>
            : <><strong>Stochastic & extreme analysis</strong> — <Code>stochastic.py</Code> (multi-year P90) and <Code>extreme_events.py</Code> (dark doldrums/cold/heat stress-test)</>
          }
        </LI>
      </UL>

      {/* ═══════════════════════════════════════════════════════════════════════
          2. ARCHITECTURE TEMPORELLE
          ═══════════════════════════════════════════════════════════════════ */}
      <H2>{FR ? '2. Architecture temporelle' : '2. Temporal architecture'}</H2>
      <P>
        {FR
          ? "Le modèle supporte trois résolutions temporelles, sélectionnables via le sélecteur « Résolution temporelle » dans l'onglet Modélisation. Chaque heure est pondérée pour reconstituer une année complète de 8760 heures."
          : 'The model supports three temporal resolutions, selectable via the "Temporal resolution" dropdown in the Modeling tab. Each hour is weighted to reconstruct a full 8760-hour year.'
        }
      </P>

      <H3>{FR ? 'Résolution 288h — 12 jours-types (défaut)' : '288h resolution — 12 typical days (default)'}</H3>
      <P>
        {FR
          ? "Plutôt que d'optimiser 8760 heures, le modèle utilise 12 jours-types (un par mois calendaire). Chaque jour-type comporte 24 heures, soit 288 pas de temps. Pour chaque mois, on calcule un jour moyen en moyennant chaque heure sur tous les jours du mois. Les résultats horaires sont ensuite pondérés par le nombre de jours du mois (28 à 31) pour obtenir des grandeurs annuelles. Le cyclage batterie est quotidien (SOC initial = SOC final après 24h)."
          : 'Rather than optimizing 8760 hours, the model uses 12 typical days (one per calendar month). Each typical day has 24 hours, totaling 288 time steps. For each month, a typical day is computed by averaging each hour over all days of the month. Hourly results are then weighted by the number of days in the month (28-31) to obtain annual values. Battery cycling is daily (SOC initial = SOC final after 24h).'
        }
      </P>
      <UL>
        <LI>{FR ? 'Janvier (31j) → 1 jour-type × 24h → pondération ×31' : 'January (31d) → 1 typical day × 24h → ×31 weight'}</LI>
        <LI>{FR ? 'Février (28j) → pondération ×28, Mars (31j) → ×31, etc.' : 'February (28d) → ×28, March (31d) → ×31, etc.'}</LI>
        <LI>{FR ? 'Total : 12 × 24 = 288 variables temporelles au lieu de 8760' : 'Total: 12 × 24 = 288 time variables instead of 8760'}</LI>
        <LI>{FR ? 'Temps de calcul : < 2s (LP), 3–5s (MILP). Le solveur MILP est disponible (variables binaires gaz et batterie).' : 'Computation time: < 2s (LP), 3–5s (MILP). MILP solver available (binary gas and battery variables).'}</LI>
      </UL>

      <H3>{FR ? 'Résolution 672h — 4 semaines-types' : '672h resolution — 4 typical weeks'}</H3>
      <P>
        {FR
          ? "La résolution 672h utilise 4 semaines-types, une par saison météorologique : Hiver (Déc–Fév, 90j), Printemps (Mars–Mai, 92j), Été (Juin–Août, 92j), Automne (Sept–Nov, 91j). Chaque semaine comporte 168 heures (7 jours × 24h), totalisant 672 pas de temps. Chaque semaine-type est construite en moyennant, sur l'année de référence, chaque heure de chaque jour de la semaine (Lundi 0h…Dimanche 23h). Chaque occurrence est pondérée par le nombre de semaines dans la saison (~13). Cyclage batterie hebdomadaire (168h)."
          : 'The 672h resolution uses 4 typical weeks, one per meteorological season: Winter (Dec–Feb, 90d), Spring (Mar–May, 92d), Summer (Jun–Aug, 92d), Fall (Sep–Nov, 91d). Each week has 168 hours (7 days × 24h), totaling 672 time steps. Each typical week is built by averaging, over the reference year, every hour of every weekday (Monday 0h…Sunday 23h). Each occurrence is weighted by the number of weeks in the season (~13). Weekly battery cycling (168h).'
        }
      </P>
      <P>
        {FR
          ? 'Temps de calcul : 3–15s. Le solveur MILP est disponible.'
          : 'Computation time: 3–15s. MILP solver available.'
        }
      </P>

      <H3>{FR ? 'Résolution 8760h — année chronologique complète' : '8760h resolution — full chronological year'}</H3>
      <P>
        {FR
          ? "Le mode 8760h utilise les 8760 heures chronologiques d'une année réelle (2020, données PVGIS + Open-Meteo). Chaque heure compte pour 1 (pas de pondération). Le cyclage batterie s'effectue sur 365 jours réels (SOC initial journalier). Le solveur LP est uniquement disponible (pas de MILP à cette échelle)."
          : 'The 8760h mode uses the 8760 chronological hours of a real year (2020, PVGIS + Open-Meteo data). Each hour counts as 1 (no weighting). Battery cycling occurs over 365 real days (daily SOC initialization). Only LP solver available (no MILP at this scale).'
        }
      </P>
      <P>
        {FR
          ? 'Temps de calcul : 10–60s. Les données ne sont pas compressées en jours-types — le profil de charge 24h est expansé heure par heure sur 365 jours avec saisonnalité mensuelle.'
          : 'Computation time: 10–60s. Data is not compressed into typical days — the 24h load profile is expanded hour by hour over 365 days with monthly seasonality.'
        }
      </P>

      <H3>{FR ? 'Tableau comparatif' : 'Comparison table'}</H3>
      <div className="overflow-x-auto mt-2 mb-3">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-ink-100 dark:bg-ink-800/60 text-ink-700 dark:text-ink-200">
              <th className="border border-ink-200 dark:border-ink-700 px-2 py-1 text-left">{FR ? 'Résolution' : 'Resolution'}</th>
              <th className="border border-ink-200 dark:border-ink-700 px-2 py-1 text-left">{FR ? 'Structure' : 'Structure'}</th>
              <th className="border border-ink-200 dark:border-ink-700 px-2 py-1 text-left">{FR ? 'Pas' : 'Steps'}</th>
              <th className="border border-ink-200 dark:border-ink-700 px-2 py-1 text-left">{FR ? 'Poids wt' : 'Weight wt'}</th>
              <th className="border border-ink-200 dark:border-ink-700 px-2 py-1 text-left">{FR ? 'SOC' : 'SOC'}</th>
              <th className="border border-ink-200 dark:border-ink-700 px-2 py-1 text-left">{FR ? 'Solveur' : 'Solver'}</th>
              <th className="border border-ink-200 dark:border-ink-700 px-2 py-1 text-left">{FR ? 'Temps' : 'Time'}</th>
            </tr>
          </thead>
          <tbody className="text-ink-600 dark:text-ink-300">
            <tr>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1 font-semibold">288h</td>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1">12 {FR ? 'mois × 1 jour' : 'months × 1 day'}</td>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1">288</td>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1">Dm (28–31)</td>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1">{FR ? 'Quotidien' : 'Daily'}</td>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1">LP / MILP</td>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1">&lt; 2–5s</td>
            </tr>
            <tr>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1 font-semibold">672h</td>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1">4 {FR ? 'saisons × 1 sem.' : 'seasons × 1 wk'}</td>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1">672</td>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1">Js/7 (≈13)</td>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1">{FR ? 'Hebdo.' : 'Weekly'}</td>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1">LP / MILP</td>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1">3–15s</td>
            </tr>
            <tr>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1 font-semibold">8760h</td>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1">{FR ? 'Année chrono' : 'Chrono. year'}</td>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1">8760</td>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1">1</td>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1">{FR ? 'Quotidien (×365)' : 'Daily (×365)'}</td>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1">LP</td>
              <td className="border border-ink-200 dark:border-ink-700 px-2 py-1">10–60s</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Formula>
        Xannuel = Σt=0..N−1 xt · wt &nbsp;&nbsp; {FR ? 'où' : 'where'} Σ wt = 8760
      </Formula>

      {/* ═══════════════════════════════════════════════════════════════════════
          3. DONNÉES MÉTÉOROLOGIQUES
          ═══════════════════════════════════════════════════════════════════ */}
      <H2>{FR ? '3. Données météorologiques' : '3. Weather data'}</H2>

      <H3>{FR ? 'Source primaire : NASA POWER' : 'Primary source: NASA POWER'}</H3>
      <P>
        {FR
          ? "L'API NASA POWER fournit les données météo horaires sur une période de ~10 ans (paramétrable dans l'onglet Modélisation, années NASA POWER début/fin, défaut 2013–2022). Les paramètres utilisés sont GHI (irradiance horizontale globale), DNI (irradiance normale directe), T2M (température à 2 m), WS50M (vent à 50 m) et WS10M (vent à 10 m). Les données sont compressées en année météorologique typique (TMY) par moyenne mensuelle."
          : 'The NASA POWER API provides hourly weather data over a ~10-year period (configurable in the Modeling tab, NASA POWER start/end years, default 2013–2022). Parameters used are GHI (global horizontal irradiance), DNI (direct normal irradiance), T2M (temperature at 2m), WS50M (wind at 50m) and WS10M (wind at 10m). Data is compressed into a Typical Meteorological Year (TMY) by monthly averaging.'
        }
      </P>
      <P>
        {FR
          ? "Connexion HTTP auto-résiliente : en cas d'erreur SSL (firewall/proxy corporate), la requête est automatiquement réessayée sans vérification de certificat. Aucune variable d'environnement nécessaire."
          : 'Self-resilient HTTP connection: in case of SSL error (corporate firewall/proxy), the request is automatically retried without certificate verification. No environment variable needed.'
        }
      </P>

      <H3>{FR ? 'Fallback solaire : PVGIS v5.2' : 'Solar fallback: PVGIS v5.2'}</H3>
      <P>
        {FR
          ? "Si NASA POWER est indisponible, l'API PVGIS v5.2 (JRC, Commission Européenne) est interrogée. Elle retourne directement des W/kWp horaires (avec pertes système de 14 % déjà intégrées). Les valeurs sont divisées par 1000 pour obtenir des kW/kWp. En dernier recours, un profil synthétique sinusoïdal est utilisé."
          : 'If NASA POWER is unavailable, the PVGIS v5.2 API (JRC, European Commission) is queried. It directly returns hourly W/kWp (with 14% system losses already included). Values are divided by 1000 to obtain kW/kWp. As a last resort, a synthetic sinusoidal profile is used.'
        }
      </P>

      <H3>{FR ? 'Fallback éolien : Open-Meteo' : 'Wind fallback: Open-Meteo'}</H3>
      <P>
        {FR
          ? "L'API Open-Meteo (archive 2020) fournit la vitesse du vent à 10 m en km/h (convertie en m/s ÷ 3.6). La vitesse est extrapolée à la hauteur de moyeu via la loi logarithmique de couche limite atmosphérique :"
          : 'The Open-Meteo API (2020 archive) provides wind speed at 10m in km/h (converted to m/s ÷ 3.6). Speed is extrapolated to hub height via the logarithmic atmospheric boundary layer law:'
        }
      </P>
      <Formula>v(H) = v(Href) × ln(H/z₀) / ln(Href/z₀)</Formula>
      <P>
        {FR
          ? 'où H = hauteur moyeu (défaut 80 m), Href = hauteur de mesure (50 m ou 10 m), z₀ = rugosité du terrain (défaut 0.03 m, plaine agricole).'
          : 'where H = hub height (default 80m), Href = measurement height (50m or 10m), z₀ = terrain roughness (default 0.03m, agricultural plain).'
        }
      </P>

      <H3>{FR ? 'Courbe de puissance éolienne quadratique' : 'Quadratic wind power curve'}</H3>
      <Formula>
        P(v) = 0 si v &lt; 3 m/s ou v ≥ 25 m/s | 1 si v ≥ 12 m/s | ((v−3)/9)² sinon
      </Formula>
      <P>
        {FR
          ? "L'exposant 2 (quadratique) est validé contre les données constructeur (Vestas V112, Enercon E-103). Il est plus réaliste que l'exposant 3 (Betz pur, trop pessimiste pour les turbines réelles avec pitch control) et plus conservateur qu'une interpolation linéaire. Cohérent avec les outils de référence HOMER et NREL-SAM."
          : 'The exponent 2 (quadratic) is validated against manufacturer data (Vestas V112, Enercon E-103). It is more realistic than exponent 3 (pure Betz, too pessimistic for real turbines with pitch control) and more conservative than linear interpolation. Consistent with reference tools HOMER and NREL-SAM.'
        }
      </P>

      <H3>{FR ? 'Hydroélectrique' : 'Hydroelectric'}</H3>
      <P>
        {FR
          ? "La production hydroélectrique est modélisée via un profil normalisé fourni par l'utilisateur (ou un défaut constant à 0.9). Traitée comme du « fil de l'eau » non pilotable. Bornée par le facteur de débit (défaut 1.0)."
          : 'Hydroelectric production is modeled via a normalized profile provided by the user (or a constant default of 0.9). Treated as non-dispatchable run-of-river. Bounded by the flow factor (default 1.0).'
        }
      </P>

      {/* ═══════════════════════════════════════════════════════════════════════
          4. CONSTRUCTION DE LA CHARGE
          ═══════════════════════════════════════════════════════════════════ */}
      <H2>{FR ? '4. Construction de la charge' : '4. Load construction'}</H2>

      <H3>{FR ? 'Charge électrique' : 'Electrical load'}</H3>
      <P>
        {FR
          ? "La charge horaire est construite à partir du nombre de foyers et de la puissance de pointe par unité, multipliés par un profil résidentiel normalisé sur 24h. La saisonnalité est appliquée via des multiplicateurs mensuels paramétrés par le coefficient de surconsommation hivernale (défaut 0.30) :"
          : 'The hourly load is built from the number of homes and the peak power per unit, multiplied by a normalized 24h residential profile. Seasonality is applied via monthly multipliers parameterized by the winter overconsumption coefficient (default 0.30):'
        }
      </P>
      <Formula>
        μ = [1+S, 1+S, 1+0.5S, 1+0.2S, 1, 1, 1, 1, 1, 1+0.3S, 1+0.7S, 1+S]
      </Formula>
      <UL>
        <LI>{FR ? 'Jan/Déc : ×1.30 | Fév : ×1.30 | Mar : ×1.15 | Avr : ×1.06 | Mai–Sep : ×1.00 | Oct : ×1.09 | Nov : ×1.21' : 'Jan/Dec: ×1.30 | Feb: ×1.30 | Mar: ×1.15 | Apr: ×1.06 | May–Sep: ×1.00 | Oct: ×1.09 | Nov: ×1.21'}</LI>
        <LI>{FR ? 'Charge tertiaire (commercial_power) : ajoutée en journée (8h–18h) uniquement' : 'Commercial load (commercial_power): added during daytime only (8am–6pm)'}</LI>
        <LI>{FR ? "Si l'utilisateur fournit un profil de N heures, la saisonnalité est ignorée (déjà intégrée)" : 'If the user provides an N-hour profile, seasonality is ignored (already integrated)'}</LI>
      </UL>

      <H3>{FR ? 'Charge thermique' : 'Thermal load'}</H3>
      <Formula>Ltherm[t] = max(0, Lbrute[t] × thermal_ratio)</Formula>
      <P>
        {FR
          ? 'Le ratio de besoin thermique (paramètre « Ratio besoin thermique » dans l\'onglet Usages, défaut 0) détermine la demande de chaleur proportionnellement à la demande électrique. 0 = pas de besoin thermique, 0.2–0.3 = eau chaude sanitaire seule, 1+ = chauffage significatif.'
          : 'The thermal load ratio ("Thermal load ratio" parameter in the Usage tab, default 0) determines the heat demand proportionally to the electrical demand. 0 = no thermal need, 0.2–0.3 = domestic hot water only, 1+ = significant heating.'
        }
      </P>

      <H3>{FR ? 'Flexibilité de la demande (Demand Response)' : 'Demand Response (load shifting)'}</H3>
      <P>
        {FR
          ? "Une fraction de la charge (paramètre « Flexibilité Load-Shift » dans l'onglet Flexibilité, défaut 10 %) peut être déplacée dans la même période (mois pour 288h, saison pour 672h). La somme par période est strictement conservée (pas de réduction nette de consommation). Deux variables par heure : une pour augmenter la charge et une pour la réduire, toutes deux bornées."
          : 'A fraction of the load ("Load-shift flexibility" parameter in the Flexibility tab, default 10%) can be shifted within the same period (month for 288h, season for 672h). The sum per period is strictly conserved (no net consumption reduction). Two variables per hour: one to increase load and one to decrease it, both bounded.'
        }
      </P>

      {/* ═══════════════════════════════════════════════════════════════════════
          5. VARIABLES DE DÉCISION
          ═══════════════════════════════════════════════════════════════════ */}
      <H2>{FR ? '5. Variables de décision' : '5. Decision variables'}</H2>
      <P>{FR ? 'Le solveur détermine simultanément les capacités à installer et le dispatch horaire optimal.' : 'The solver simultaneously determines installed capacities and optimal hourly dispatch.'}</P>

      <H3>{FR ? 'Capacités installées (11 variables continues)' : 'Installed capacities (11 continuous variables)'}</H3>
      <UL>
        <LI><Code>Cap_S</Code> : {t('caps.solar')} (kWc)</LI>
        <LI><Code>Cap_SI</Code> : {t('caps.solar_inv')} (kW)</LI>
        <LI><Code>Cap_W</Code> : {t('caps.wind')} (kW)</LI>
        <LI><Code>Cap_H</Code> : {t('caps.hydro')} (kW)</LI>
        <LI><Code>Cap_B</Code> : {t('caps.bess')} (kWh)</LI>
        <LI><Code>Cap_BI</Code> : {t('caps.bess_inv')} (kW)</LI>
        <LI><Code>Cap_G</Code> : {t('caps.gas')} (kW)</LI>
        <LI><Code>Cap_HP</Code> : {t('caps.hp')} (kW)</LI>
        <LI><Code>Cap_Boiler</Code> : {t('caps.boiler')} (kW)</LI>
        <LI><Code>Cap_TES</Code> : {t('caps.tes')} (kWh)</LI>
        <LI><Code>MaxG</Code> : {t('caps.grid')} (kW)</LI>
      </UL>

      <H3>{FR ? 'Flux horaires (~20 × N variables continues)' : 'Hourly flows (~20 × N continuous variables)'}</H3>
      <P>{FR ? 'Pour chaque heure t, le modèle optimise les flux suivants :' : 'For each hour t, the model optimizes the following flows:'}</P>
      <UL>
        <LI><strong>{FR ? 'Production' : 'Generation'}</strong> : P_solaire, P_éolien, P_hydro, P_gaz (kW), P_chaudière (kW)</LI>
        <LI><strong>{t('series.storage_battery')}</strong> : P_charge, P_décharge, SOC(t) (kWh)</LI>
        <LI><strong>{t('series.grid')}</strong> : P_achat, P_vente (kW)</LI>
        <LI><strong>{FR ? 'Flexibilité' : 'Flexibility'}</strong> : P_shift_up, P_shift_down (kW)</LI>
        <LI><strong>{t('series.ev')}</strong> : P_charge_VE, P_décharge_VE (V2G), SOC_VE(t) (kWh)</LI>
        <LI><strong>{t('series.shedding')}</strong> : P_shed_élec, P_shed_thermique (kW)</LI>
        <LI><strong>{t('series.combustion')}</strong> : P_PAC_élec (kW)</LI>
      </UL>
      <P>
        {FR
          ? "Lorsque le mode MILP est activé (résolutions 288h et 672h uniquement, via l'option dans l'onglet Moteur gaz), deux variables binaires sont ajoutées : une pour exclure la charge et décharge simultanée de la batterie, et une pour l'état marche/arrêt du moteur gaz (avec coût de démarrage)."
          : 'When MILP mode is enabled (288h and 672h resolutions only, via the option in the Gas engine tab), two binary variables are added: one to prevent simultaneous battery charge/discharge, and one for gas engine on/off state (with startup cost).'
        }
      </P>

      {/* ═══════════════════════════════════════════════════════════════════════
          6. FONCTION OBJECTIF
          ═══════════════════════════════════════════════════════════════════ */}
      <H2>{FR ? '6. Fonction objectif' : '6. Objective function'}</H2>
      <P>{FR ? 'Le modèle minimise le coût total annualisé (CAPEX annualisé + OPEX annuel) :' : 'The model minimizes the total annualized cost (annualized CAPEX + annual OPEX):'}</P>
      <Formula>min Z = Σ CAPEX_annualisé + Σ (OPEX_horaire × poids_annualisation)</Formula>

      <H3>{FR ? 'CAPEX annualisé — Capital Recovery Factor (CRF)' : 'Annualized CAPEX — Capital Recovery Factor'}</H3>
      <P>
        {FR
          ? "Pour comparer un investissement initial avec des coûts opérationnels annuels, on l'étale sur sa durée de vie via le CRF. Le CRF annualise un coût unique en annuités constantes sur n années au taux d'actualisation r (WACC, défaut 5 %)."
          : 'To compare an initial investment with annual operational costs, it is spread over its lifetime via the CRF. The CRF annualizes a one-time cost into constant annuities over n years at discount rate r (WACC, default 5%).'
        }
      </P>
      <Formula>CRF(r, n) = r × (1 + r)^n / ((1 + r)^n − 1) &nbsp;—&nbsp; si r = 0 : CRF = 1/n</Formula>
      <P>
        {FR
          ? 'Exemple : un panneau PV à 600 €/kWc sur 25 ans à 5 % → annuité = 600 × 0.07095 = 42.57 €/kWc/an.'
          : 'Example: a PV panel at 600 €/kWp over 25 years at 5% → annuity = 600 × 0.07095 = 42.57 €/kWp/yr.'
        }
      </P>
      <Formula>
        CAPEX_annualisé = Cap_S × 600 × CRF(r, 25) + Cap_SI × 150 × CRF(r, 10)<br />
        + Cap_W × 1500 × CRF(r, 20) + Cap_H × 2500 × CRF(r, 30)<br />
        + Cap_B × 300 × CRF(r, 10) + Cap_BI × 150 × CRF(r, 10)<br />
        + Cap_G × 500 × CRF(r, 15) + Cap_HP × 800 × CRF(r, 15)<br />
        + Cap_Boiler × 150 × CRF(r, 15) + Cap_TES × 50 × CRF(r, 20)<br />
        + MaxG × demand_charge × 12
      </Formula>
      <P>
        {FR
          ? 'Note : le CAPEX du groupe électrogène gaz est fixé à 500 €/kW (non paramétrable). Le câblage HTA (cable_capex) est calculé en post-processing : coût = peak_load × cable_capex.'
          : 'Note: the gas genset CAPEX is fixed at 500 €/kW (non-configurable). HV cabling (cable_capex) is calculated in post-processing: cost = peak_load × cable_capex.'
        }
      </P>

      <H3>{FR ? 'OPEX horaire — coûts opérationnels' : 'Hourly OPEX — operational costs'}</H3>
      <P>{FR ? 'Pour chaque heure t, le coût opérationnel est la somme pondérée :' : 'For each hour t, the operational cost is the weighted sum:'}</P>
      <UL>
        <LI><strong>{t('opex.fuel_elec_gaz')}</strong> : <Code>P_gaz / 0.35 × gas_fuel</Code> — {FR ? 'rendement électrique du moteur gaz = 35 %' : 'gas engine electrical efficiency = 35%'}</LI>
        <LI><strong>{t('opex.fuel_th_gaz')}</strong> : <Code>P_chaudière / η_chaudière × gas_fuel</Code> — η variant de 0.90 (été) à 0.94 (hiver)</LI>
        <LI><strong>{t('opex.grid_buy')}</strong> : <Code>P_achat × tarif(h)</Code> — HP (8h–20h) : 0.25 €/kWh, HC : 0.12 €/kWh, ou prix spot horaires si activé</LI>
        <LI><strong>{t('opex.grid_sell')}</strong> : <Code>− P_vente × prix_vente</Code> — 0.10 €/kWh fixe ou spot − 0.02 €/kWh</LI>
        <LI><strong>{FR ? 'Cyclage batterie' : 'Battery cycling'}</strong> : <Code>P_décharge × 0.05 €/kWh</Code> — {FR ? 'coût d\'usure marginal' : 'marginal wear cost'}</LI>
        <LI><strong>{t('opex.load_shed')}</strong> : <Code>P_shed × VOLL (5 €/kWh)</Code> — Value Of Lost Load</LI>
        <LI><strong>{FR ? 'Délestage thermique' : 'Thermal shedding'}</strong> : <Code>P_therm_shed × 999 €/kWh</Code> — {FR ? 'pénalité quasi-interdiction' : 'near-prohibition penalty'}</LI>
        <LI><strong>{FR ? 'Démarrage gaz (MILP)' : 'Gas startup (MILP)'}</strong> : <Code>gas_start × 5 €/démarrage</Code></LI>
      </UL>

      <H3>{FR ? 'Tarifs spot par défaut (€/kWh)' : 'Default spot prices (€/kWh)'}</H3>
      <Formula>
        0h:0.08 1h:0.07 2h:0.06 3h:0.06 4h:0.07 5h:0.09 6h:0.15 7h:0.20 8h:0.18 9h:0.12 10h:0.05 11h:0.02<br />
        12h:0.01 13h:0.02 14h:0.05 15h:0.10 16h:0.15 17h:0.25 18h:0.35 19h:0.30 20h:0.20 21h:0.15 22h:0.12 23h:0.09
      </Formula>

      {/* ═══════════════════════════════════════════════════════════════════════
          7. CONTRAINTES
          ═══════════════════════════════════════════════════════════════════ */}
      <H2>{FR ? '7. Contraintes' : '7. Constraints'}</H2>

      <H3>{FR ? '7.1 Bilan électrique (∀t)' : '7.1 Electrical balance (∀t)'}</H3>
      <Formula>
        P_solaire + P_éolien + P_hydro + P_bess_décharge + P_gaz + P_achat + P_délestage + P_V2G_décharge{' '}
        = Charge_optimisée + P_bess_charge + P_vente + P_PAC_élec + P_VE_charge
      </Formula>
      <P>{FR ? 'Charge_optimisée(t) = Charge_brute(t) + Shift_up(t) − Shift_down(t).' : 'Optimized_load(t) = Raw_load(t) + Shift_up(t) − Shift_down(t).'}</P>

      <H3>{FR ? '7.2 Bilan thermique (∀t)' : '7.2 Thermal balance (∀t)'}</H3>
      <Formula>
        P_chaudière + P_PAC_élec × COP[t] + P_TES_décharge + P_délestage_th{' '}
        = Charge_thermique(t) + P_TES_charge
      </Formula>
      <P>{FR ? 'Le COP[t] varie avec la température extérieure (voir chapitre 8).' : 'COP[t] varies with outdoor temperature (see chapter 8).'}</P>

      <H3>{FR ? '7.3 Stockage batterie (BESS)' : '7.3 Battery storage (BESS)'}</H3>
      <Formula>SOC(t) = SOC(t−1) + Charge(t) × η_ch − Décharge(t) / η_dis</Formula>
      <UL>
        <LI>SOC(t) ∈ [min_soc × Cap_B, Cap_B] — min_soc = 20 %</LI>
        <LI>Charge(t), Décharge(t) ≤ Cap_BI</LI>
        <LI>{FR ? 'Cyclage journalier (288h/8760h) ou hebdomadaire (672h) : SOC_fin_période = SOC_init_période' : 'Daily cycling (288h/8760h) or weekly (672h): SOC_end_period = SOC_init_period'}</LI>
        <LI>{FR ? 'η_ch = η_dis = 0.95. Aller-retour ≈ 0.90.' : 'η_ch = η_dis = 0.95. Round-trip ≈ 0.90.'}</LI>
        <LI>{FR ? 'Mode MILP : contrainte Big-M interdit charge et décharge simultanées (M_bess = 5 × peak_load)' : 'MILP mode: Big-M constraint prevents simultaneous charge/discharge (M_bess = 5 × peak_load)'}</LI>
      </UL>

      <H3>{FR ? '7.4 Stockage thermique (TES)' : '7.4 Thermal Energy Storage (TES)'}</H3>
      <UL>
        <LI>{FR ? 'Même structure que la batterie, η = 0.95 fixe' : 'Same structure as battery, η = 0.95 fixed'}</LI>
        <LI>{FR ? 'Charge et décharge limitées à Cap_TES / 2' : 'Charge and discharge limited to Cap_TES / 2'}</LI>
        <LI>{FR ? 'Ballon d\'eau chaude dimensionné automatiquement par le solveur (peut être à 0 kWh si non rentable)' : 'Hot water tank automatically sized by the solver (may be 0 kWh if not cost-effective)'}</LI>
      </UL>

      <H3>{FR ? '7.5 Production renouvelable' : '7.5 Renewable generation'}</H3>
      <UL>
        <LI><strong>{t('series.solar')}</strong> : P ≤ Cap_S × ressource(t), P ≤ Cap_SI</LI>
        <LI><strong>{t('series.wind')}</strong> : P ≤ Cap_W × ressource(t)</LI>
        <LI><strong>{t('series.hydro')}</strong> : P ≤ Cap_H × ressource(t) × hydro_flow</LI>
      </UL>

      <H3>{FR ? '7.6 Véhicules électriques (si num_evs > 0)' : '7.6 Electric vehicles (if num_evs > 0)'}</H3>
      <UL>
        <LI>{FR ? '50 kWh/VE, 10 kWh/jour consommés (trajet domicile-travail). Puissance de charge 7 kW/VE.' : '50 kWh/EV, 10 kWh/day consumed (commute). Charging power 7 kW/EV.'}</LI>
        <LI>{FR ? 'Période de branchement : 18h–7h. Hors période (8h–17h) : puissance = 0.' : 'Plug-in period: 6pm–7am. Outside period (8am–5pm): power = 0.'}</LI>
        <LI>{FR ? '18h (retour) : SOC = 50 − 10 = 40 kWh/VE. 7h (départ) : SOC = 100 % (50 kWh/VE).' : '6pm (return): SOC = 50 − 10 = 40 kWh/EV. 7am (departure): SOC = 100% (50 kWh/EV).'}</LI>
        <LI>{FR ? 'V2G optionnel : réinjection possible 7 kW/VE max pendant la période de branchement.' : 'Optional V2G: feed-in up to 7 kW/EV during the plug-in period.'}</LI>
      </UL>

      <H3>{FR ? '7.7 Réseau électrique' : '7.7 Electrical grid'}</H3>
      <UL>
        <LI>{FR ? 'Connecté au réseau : achat et vente autorisés, bornés par la puissance souscrite et 3× le pic de charge' : 'Grid-connected: buy and sell allowed, bounded by subscribed power and 3× peak load'}</LI>
        <LI>{FR ? 'Site isolé (hors réseau) : achat = vente = 0 — autonomie totale, le gaz et la batterie doivent tout compenser' : 'Off-grid: buy = sell = 0 — total autonomy, gas and battery must compensate everything'}</LI>
      </UL>

      <H3>{FR ? '7.8 Moteur gaz' : '7.8 Gas engine'}</H3>
      <UL>
        <LI>P_gaz(t) ≤ Cap_G</LI>
        <LI>{FR ? 'Rampe : |P_gaz(t) − P_gaz(t−1)| ≤ ramp_limit_kW (si > 0)' : 'Ramp: |P_gaz(t) − P_gaz(t−1)| ≤ ramp_limit_kW (if > 0)'}</LI>
        <LI>{FR ? 'Mode MILP : contrainte de charge minimale (min_load_pct × max_gas_kW ≤ P_gaz(t)), coût de démarrage, Big-M on/off' : 'MILP mode: minimum load constraint (min_load_pct × max_gas_kW ≤ P_gaz(t)), startup cost, Big-M on/off'}</LI>
      </UL>

      <H3>{FR ? '7.9 Réserve de puissance N-1' : '7.9 N-1 reserve'}</H3>
      <P>
        {FR
          ? "Contrainte de sécurité optionnelle (toggle dans Modélisation). Garantit qu'à chaque heure, la perte du plus gros producteur peut être compensée par les réserves disponibles (batterie, groupe gaz, réseau)."
          : 'Optional security constraint (toggle in Modeling). Ensures that at every hour, the loss of the largest generator can be compensated by available reserves (battery, gas genset, grid).'
        }
      </P>
      <Formula>
        C_gaz + C_bess_inv + G_max + P_shed − P_gaz − P_bess_dis − P_achat ≥ max(P_solaire, P_éolien, P_hydro, C_gaz, [G_max si réseau])
      </Formula>
      <P>
        {FR
          ? 'Linéarisé via 4 à 5 inégalités par heure (une par source à risque). Aucune variable binaire. La contrainte tend à augmenter les capacités de batterie et de gaz pour disposer en permanence d\'une réserve suffisante — le coût de cette sécurité est visible dans les KPIs.'
          : 'Linearized via 4 to 5 inequalities per hour (one per at-risk source). No binary variables. The constraint tends to increase battery and gas capacities to maintain sufficient reserves at all times — the cost of this security is visible in KPIs.'
        }
      </P>

      <H3>{FR ? '7.10 Autres contraintes' : '7.10 Other constraints'}</H3>
      <UL>
        <LI><strong>{FR ? 'Budget carbone' : 'Carbon budget'}</strong> : Σ (P_gaz × 0.500 + P_achat × 0.060) ≤ max_annual_co2_t × 1000 {FR ? 'si > 0' : 'if > 0'}</LI>
        <LI><strong>Demand Response</strong> : Σ Shift_up = Σ Shift_down {FR ? '(conservation par période)' : '(conservation per period)'}</LI>
        <LI><strong>{FR ? 'Contraintes de surface' : 'Area constraints'}</strong> : Cap_S ≤ max_solar_kW, Cap_W ≤ max_wind_kW {FR ? '(si > 0)' : '(if > 0)'}</LI>
      </UL>

      {/* ═══════════════════════════════════════════════════════════════════════
          8. EFFETS DE LA TEMPÉRATURE
          ═══════════════════════════════════════════════════════════════════ */}
      <H2>{FR ? '8. Effets de la température' : '8. Temperature effects'}</H2>
      <P>
        {FR
          ? "Les rendements des équipements varient avec la température ambiante (fournie par NASA POWER ou Open-Meteo). Les profils thermo-dépendants sont pré-calculés avant l'optimisation : le solveur reçoit des COP[t] et rendements[t] déjà calculés — le problème d'optimisation reste purement linéaire."
          : 'Equipment efficiencies vary with ambient temperature (provided by NASA POWER or Open-Meteo). Temperature-dependent profiles are pre-computed before optimization: the solver receives pre-calculated COP[t] and efficiency[t] values — the optimization problem remains purely linear.'
        }
      </P>

      <H3>{FR ? 'Panneaux solaires — modèle NOCT' : 'Solar panels — NOCT model'}</H3>
      <P>{FR ? 'La température de cellule affecte le rendement de conversion :' : 'Cell temperature affects conversion efficiency:'}</P>
      <Formula>Tcell[t] = Tamb[t] + (NOCT − 20) × G[t] / 800</Formula>
      <Formula>ftemp[t] = 1 + γ × (Tcell[t] − 25) &nbsp;—&nbsp; γ = −0.004 /°C</Formula>
      <Formula>Psolaire[t] = G[t] × (1 − 0.10) / 1000 × max(0, ftemp[t])</Formula>
      <UL>
        <LI>NOCT = 45 °C ({FR ? 'température cellule à 800 W/m², 20 °C ambiant' : 'cell temperature at 800 W/m², 20 °C ambient'})</LI>
        <LI>γ = {FR ? 'coefficient de température de puissance (paramétrable dans l\'onglet Solaire, défaut −0.004/°C)' : 'temperature coefficient of power (configurable in the Solar tab, default −0.004/°C)'}</LI>
        <LI>{FR ? 'Pertes fixes = 10 % (câblage 2 %, onduleur 3 %, soiling 2 %, mismatch 3 %). Les pertes thermiques sont modélisées explicitement.' : 'Fixed losses = 10% (cabling 2%, inverter 3%, soiling 2%, mismatch 3%). Thermal losses modeled explicitly.'}</LI>
        <LI>{FR ? 'Exemple : Paris été, G=800 W/m², Tamb=30 °C → Tcell=55 °C → ftemp=0.88 → −12 % de production' : 'Example: Paris summer, G=800 W/m², Tamb=30 °C → Tcell=55 °C → ftemp=0.88 → −12% production'}</LI>
      </UL>

      <H3>{FR ? 'Pompe à chaleur — modèle de Carnot' : 'Heat pump — Carnot model'}</H3>
      <P>{FR ? 'Le COP varie avec la température extérieure via un modèle de Carnot calibré sur le COP nominal à 7 °C :' : 'COP varies with outdoor temperature via a Carnot model calibrated on the nominal COP at 7 °C:'}</P>
      <Formula>COP[t] = min(8.0, max(0.5, η_carnot × (Tsupply + 273) / (Tsupply − Tamb[t])))</Formula>
      <Formula>η_carnot = COPnom × (Tsupply − 7) / (Tsupply + 273)</Formula>
      <UL>
        <LI>COPnom = 3.0 ({FR ? 'paramétrable dans l\'onglet Thermique (COP nominal)' : 'configurable in the Thermal tab (nominal COP)'})</LI>
        <LI>Tsupply = 35 °C ({FR ? 'plancher chauffant, paramétrable dans l\'onglet Thermique (T° distribution). 55 °C pour radiateurs.' : 'underfloor heating, configurable in the Thermal tab (supply temp). 55 °C for radiators.'})</LI>
        <LI>{FR ? 'Plafonné à 8.0 (temps chaud), floor à 0.5 (temps très froid)' : 'Capped at 8.0 (hot weather), floored at 0.5 (very cold weather)'}</LI>
        <LI>{FR ? 'Exemple : Tsupply=35 °C, COPnom=3.0 → η_carnot=0.273. À Tamb=7 °C : COP=3.00. À Tamb=−7 °C : COP=2.00.' : 'Example: Tsupply=35 °C, COPnom=3.0 → η_carnot=0.273. At Tamb=7 °C: COP=3.00. At Tamb=−7 °C: COP=2.00.'}</LI>
      </UL>

      <H3>{FR ? 'Chaudière gaz — modèle condensation' : 'Gas boiler — condensing model'}</H3>
      <P>{FR ? 'Le rendement de la chaudière à condensation s\'améliore par temps froid (meilleure récupération de chaleur latente) :' : 'Condensing boiler efficiency improves in cold weather (better latent heat recovery):'}</P>
      <Formula>η[t] = η_nom + 0.04 × clamp((20 − Tamb[t]) / 40, 0, 1)</Formula>
      <UL>
        <LI>η_nom = 0.90 ({FR ? 'paramétrable dans l\'onglet Thermique (Rendement chaudière)' : 'configurable in the Thermal tab (Boiler efficiency)'})</LI>
        <LI>{FR ? 'Varie de 0.90 (été, ≥ 20 °C) à 0.94 (hiver, ≤ −20 °C)' : 'Ranges from 0.90 (summer, ≥ 20 °C) to 0.94 (winter, ≤ −20 °C)'}</LI>
      </UL>

      {/* ═══════════════════════════════════════════════════════════════════════
          9. GÉOMÉTRIE SOLAIRE & TRACKERS
          ═══════════════════════════════════════════════════════════════════ */}
      <H2>{FR ? '9. Géométrie solaire & trackers' : '9. Solar geometry & trackers'}</H2>
      <P>
        {FR
          ? "La production solaire peut être calculée pour un plan incliné arbitraire (toiture, façade, tracker) via la transposition HDKR (Hay, Davies, Klucher, Reindl). L'utilisateur configure tilt, azimuth, albédo et tracking dans l'onglet Solaire."
          : 'Solar production can be computed for an arbitrary tilted plane (roof, façade, tracker) via HDKR transposition (Hay, Davies, Klucher, Reindl). The user configures tilt, azimuth, albedo, and tracking in the Solar tab.'
        }
      </P>

      <H3>{FR ? 'Position solaire' : 'Solar position'}</H3>
      <Formula>δ = 0.4093 × sin(2π(284 + doy) / 365) — {FR ? 'déclinaison' : 'declination'}</Formula>
      <Formula>cos θz = sin φ sin δ + cos φ cos δ cos ω — {FR ? 'zénith, φ=latitude, ω=angle horaire' : 'zenith, φ=latitude, ω=hour angle'}</Formula>

      <H3>{FR ? 'Angle d\'incidence (AOI) sur plan incliné' : 'Angle of incidence (AOI) on tilted plane'}</H3>
      <Formula>cos(AOI) = cos θz cos β + sin θz sin β cos(γs − γp)</Formula>
      <P>{FR ? 'β = tilt, γp = azimuth plan, γs = azimuth solaire' : 'β = tilt, γp = plane azimuth, γs = solar azimuth'}</P>

      <H3>{FR ? 'Transposition HDKR — irradiance sur plan incliné (POA)' : 'HDKR transposition — plane-of-array irradiance (POA)'}</H3>
      <Formula>
        POA = DNI × cos(AOI) + DHI × [(1−Ai)×(1+cos β)/2 + Ai × Rb]{' '}
        + GHI × ρ × (1−cos β)/2
      </Formula>
      <UL>
        <LI>Ai = DNI / G_ext — {FR ? 'indice d\'anisotropie (Hay-Davies)' : 'anisotropy index (Hay-Davies)'}</LI>
        <LI>Rb = cos(AOI) / cos θz — {FR ? 'facteur géométrique' : 'geometric factor'}</LI>
        <LI>ρ = albédo ({FR ? '0.2 herbe, 0.5 béton, 0.8 neige' : '0.2 grass, 0.5 concrete, 0.8 snow'})</LI>
      </UL>

      <H3>{FR ? 'Modes de tracking' : 'Tracking modes'}</H3>
      <div className="overflow-x-auto mt-2 mb-3">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-ink-100 dark:bg-ink-800/60 text-ink-700 dark:text-ink-200">
              <th className="border border-ink-200 dark:border-ink-700 px-2 py-1 text-left">{FR ? 'Mode' : 'Mode'}</th>
              <th className="border border-ink-200 dark:border-ink-700 px-2 py-1 text-left">Tilt β</th>
              <th className="border border-ink-200 dark:border-ink-700 px-2 py-1 text-left">Azimuth γp</th>
            </tr>
          </thead>
          <tbody className="text-ink-600 dark:text-ink-300">
            <tr><td className="border border-ink-200 dark:border-ink-700 px-2 py-1 font-semibold">fixe</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">{FR ? 'constant (réglable)' : 'constant (configurable)'}</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">{FR ? 'constant (réglable)' : 'constant (configurable)'}</td></tr>
            <tr><td className="border border-ink-200 dark:border-ink-700 px-2 py-1 font-semibold">mono_h</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">{FR ? 'optimal E-W (axe N-S horizontal)' : 'optimal E-W (N-S horizontal axis)'}</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">{FR ? 'constant (0° = Sud)' : 'constant (0° = South)'}</td></tr>
            <tr><td className="border border-ink-200 dark:border-ink-700 px-2 py-1 font-semibold">dual</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">β = θz</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">γp = γs + π</td></tr>
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          10. ANALYSE STOCHASTIQUE P90
          ═══════════════════════════════════════════════════════════════════ */}
      <H2>{FR ? '10. Analyse stochastique P90' : '10. Stochastic P90 analysis'}</H2>
      <P>
        {FR
          ? "Le mode P90 forfaitaire (activable dans l'onglet Modélisation) réduit les EnR de 15 % et augmente la charge de 10 % — rapide mais approximatif. L'analyse stochastique (option « Analyse P90 multi-années ») calcule un P90 réel : chaque année NASA POWER (2013–2022, ~10 ans) devient un scénario météo indépendant. L'optimiseur tourne une fois par année, produisant une distribution réelle des KPIs : P10 (meilleur cas), P50 (médian), P90 (pire cas)."
          : 'The lumped P90 mode (activatable in the Modeling tab) reduces renewables by 15% and increases load by 10% — fast but approximate. The stochastic analysis ("Multi-year P90 analysis" option) computes a true P90: each NASA POWER year (2013–2022, ~10 years) becomes an independent weather scenario. The optimizer runs once per year, producing a real KPI distribution: P10 (best case), P50 (median), P90 (worst case).'
        }
      </P>
      <UL>
        <LI>{FR ? 'Temps : ~30s (288h), ~80s (672h), ~10 min (8760h)' : 'Time: ~30s (288h), ~80s (672h), ~10 min (8760h)'}</LI>
        <LI>{FR ? 'KPIs analysés : VAN, TRI, CAPEX total, ROI, CO₂ évité, résilience, curtailment, OPEX Y1' : 'KPIs analyzed: NPV, IRR, total CAPEX, ROI, avoided CO₂, resilience, curtailment, Y1 OPEX'}</LI>
        <LI>{FR ? 'Les deux modes (P90 forfaitaire et stochastique) sont mutuellement exclusifs' : 'Both modes (lumped P90 and stochastic) are mutually exclusive'}</LI>
        <LI>{FR ? 'Si NASA POWER est indisponible, un fallback PVGIS/Open-Meteo est utilisé sur une seule année' : 'If NASA POWER is unavailable, a PVGIS/Open-Meteo fallback is used over a single year'}</LI>
      </UL>

      {/* ═══════════════════════════════════════════════════════════════════════
          11. ÉVÉNEMENTS EXTRÊMES
          ═══════════════════════════════════════════════════════════════════ */}
      <H2>{FR ? '11. Événements extrêmes' : '11. Extreme events'}</H2>
      <P>
        {FR
          ? "Le Stress-test événements extrêmes (activable dans l'onglet Modélisation) scanne les ~10 ans de données NASA POWER (2013–2022) pour détecter les pires séquences historiques de trois types d'événements. Nécessite la résolution 8760h."
          : 'The Extreme event stress-test (activatable in the Modeling tab) scans ~10 years of NASA POWER data (2013–2022) to detect the worst historical sequences of three event types. Requires 8760h resolution.'
        }
      </P>
      <UL>
        <LI><strong>Dark Doldrums 🌑</strong> — {FR ? 'période consécutive où vent < 3 m/s ET GHI < 200 W/m². Risque : production EnR nulle prolongée.' : 'consecutive period where wind < 3 m/s AND GHI < 200 W/m². Risk: prolonged zero renewable output.'}</LI>
        <LI><strong>{FR ? 'Vague de froid' : 'Cold wave'} 🥶</strong> — {FR ? 'séquence où T2M < −2 °C. Risque : pic de charge thermique + baisse du COP PAC.' : 'sequence where T2M < −2 °C. Risk: thermal load peak + HP COP drop.'}</LI>
        <LI><strong>{FR ? 'Canicule' : 'Heat wave'} 🔥</strong> — {FR ? 'séquence où T2M > 32 °C. Risque : dégradation du rendement PV (NOCT) + besoin de climatisation.' : 'sequence where T2M > 32 °C. Risk: PV efficiency degradation (NOCT) + cooling demand.'}</LI>
      </UL>
      <P>{FR ? 'Pour chaque événement détecté, le module calcule :' : 'For each detected event, the module computes:'}</P>
      <UL>
        <LI><strong>{FR ? 'Couverture' : 'Coverage'}</strong> — {FR ? 'part de la demande électrique servie sans interruption' : 'share of electric demand served without interruption'}</LI>
        <LI><strong>{FR ? 'Délestage' : 'Shedding'}</strong> — {FR ? 'énergie non fournie pendant la séquence (kWh)' : 'unserved energy during the sequence (kWh)'}</LI>
        <LI><strong>{FR ? 'Backup gaz' : 'Gas backup'}</strong> — {FR ? 'énergie produite par le groupe gaz de secours (kWh)' : 'energy produced by the backup gas genset (kWh)'}</LI>
        <LI><strong>{FR ? 'Durée' : 'Duration'}</strong> — {FR ? 'nombre d\'heures consécutives de l\'événement' : 'number of consecutive hours of the event'}</LI>
      </UL>

      {/* ═══════════════════════════════════════════════════════════════════════
          12. DÉGRADATION BATTERIE
          ═══════════════════════════════════════════════════════════════════ */}
      <H2>{FR ? '12. Dégradation progressive de la batterie' : '12. Progressive battery degradation'}</H2>
      <P>
        {FR
          ? "La capacité de la batterie ne reste pas constante jusqu'au remplacement — elle diminue progressivement sous l'effet combiné du vieillissement calendaire et du cyclage."
          : 'Battery capacity does not remain constant until replacement — it decreases progressively under the combined effect of calendar aging and cycling.'
        }
      </P>

      <H3>{FR ? 'Paramètres du modèle' : 'Model parameters'}</H3>
      <div className="overflow-x-auto mt-2 mb-3">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-ink-100 dark:bg-ink-800/60 text-ink-700 dark:text-ink-200">
              <th className="border border-ink-200 dark:border-ink-700 px-2 py-1 text-left">{FR ? 'Paramètre' : 'Parameter'}</th>
              <th className="border border-ink-200 dark:border-ink-700 px-2 py-1 text-left">{FR ? 'Valeur' : 'Value'}</th>
              <th className="border border-ink-200 dark:border-ink-700 px-2 py-1 text-left">{FR ? 'Description' : 'Description'}</th>
            </tr>
          </thead>
          <tbody className="text-ink-600 dark:text-ink-300">
            <tr><td className="border border-ink-200 dark:border-ink-700 px-2 py-1 font-mono">d_cal</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">1 % / an</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">{FR ? 'Perte calendaire' : 'Calendar loss'}</td></tr>
            <tr><td className="border border-ink-200 dark:border-ink-700 px-2 py-1 font-mono">d_cyc</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">0.05 % / {FR ? 'cycle éq.' : 'eq. cycle'}</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">{FR ? 'Perte cyclique' : 'Cycling loss'}</td></tr>
            <tr><td className="border border-ink-200 dark:border-ink-700 px-2 py-1 font-mono">f_floor</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">70 %</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">{FR ? 'Capacité minimale avant remplacement (garantie LFP standard)' : 'Minimum capacity before replacement (standard LFP warranty)'}</td></tr>
          </tbody>
        </table>
      </div>

      <H3>{FR ? 'Comptage des cycles équivalents' : 'Equivalent cycle counting'}</H3>
      <Formula>Ncycles/an = Σt P_bess_dis[t] × wt / max(0.01, Cap_B)</Formula>
      <P>{FR ? 'Un cycle équivalent = une décharge complète de la capacité nominale.' : 'One equivalent cycle = one full discharge of the nominal capacity.'}</P>

      <H3>{FR ? 'Facteur de capacité résiduelle' : 'Residual capacity factor'}</H3>
      <Formula>fcap(a, c) = max(0.70, 1 − 0.01×a − 0.0005×c)</Formula>
      <P>{FR ? 'a = années depuis le dernier remplacement, c = cycles cumulés depuis le dernier remplacement' : 'a = years since last replacement, c = cumulative cycles since last replacement'}</P>

      <H3>{FR ? 'Impact sur l\'OPEX et le carbone' : 'Impact on OPEX and carbon'}</H3>
      <Formula>Eperdue(y) = Ebess_dis_annuelle × (1 − fcap(y))</Formula>
      <P>
        {FR
          ? "L'énergie perdue est rachetée au coût marginal (moyenne HP/HC si réseau, coût gaz si îloté). Le surcoût OPEX est ajouté chaque année dans la boucle financière. Les émissions CO₂ supplémentaires sont déduites du bilan carbone."
          : 'The lost energy is purchased at marginal cost (HP/HC average if grid-connected, gas cost if off-grid). The extra OPEX is added each year in the financial loop. Additional CO₂ emissions are deducted from the carbon balance.'
        }
      </P>
      <P>
        {FR
          ? "Simplification : le dispatch n'est pas ré-optimisé chaque année avec la capacité dégradée — le dispatch de l'année 0 est conservé. Le manque à gagner est approximé par un achat d'énergie au coût marginal. L'erreur sur la VAN est < 2 % car l'effet dominant est la perte calendaire, pas le changement de stratégie de dispatch."
          : 'Simplification: the dispatch is not re-optimized each year with degraded capacity — the year 0 dispatch is kept. The energy shortfall is approximated by purchasing energy at marginal cost. NPV error < 2% because the dominant effect is calendar loss, not dispatch strategy change.'
        }
      </P>
      <P>
        {FR
          ? 'Les compteurs (âge et cycles) sont remis à zéro après chaque renouvellement de batterie (années 10 et 20).'
          : 'Counters (age and cycles) are reset after each battery replacement (years 10 and 20).'
        }
      </P>

      {/* ═══════════════════════════════════════════════════════════════════════
          13. RÉSOLUTION DU PROBLÈME LP
          ═══════════════════════════════════════════════════════════════════ */}
      <H2>{FR ? '13. Résolution du problème LP' : '13. LP problem solving'}</H2>
      <H3>{FR ? 'Solveur utilisé' : 'Solver used'}</H3>
      <P>
        {FR
          ? 'Le problème est un LP continu — toutes les variables sont réelles positives, sans variables binaires. Il est résolu par CBC (Coin-or Branch and Cut) via la méthode du Simplexe primal. La solution obtenue est l\'optimum global (pas de minima locaux). Lorsque le mode MILP est activé (288h/672h), des variables binaires sont ajoutées et le problème devient un Mixed Integer LP, résolu par Branch-and-Bound.'
          : 'The problem is a continuous LP — all variables are positive reals, with no binary variables. It is solved by CBC (Coin-or Branch and Cut) using the primal Simplex method. The obtained solution is the global optimum (no local minima). When MILP mode is enabled (288h/672h), binary variables are added and the problem becomes a Mixed Integer LP, solved via Branch-and-Bound.'
        }
      </P>

      <H3>{FR ? 'Taille du problème et temps de calcul' : 'Problem size and computation time'}</H3>
      <div className="overflow-x-auto mt-2 mb-3">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-ink-100 dark:bg-ink-800/60 text-ink-700 dark:text-ink-200">
              <th className="border border-ink-200 dark:border-ink-700 px-2 py-1 text-left">{FR ? 'Résolution' : 'Resolution'}</th>
              <th className="border border-ink-200 dark:border-ink-700 px-2 py-1 text-left">{FR ? 'Variables' : 'Variables'}</th>
              <th className="border border-ink-200 dark:border-ink-700 px-2 py-1 text-left">{FR ? 'Contraintes' : 'Constraints'}</th>
              <th className="border border-ink-200 dark:border-ink-700 px-2 py-1 text-left">{FR ? 'Temps LP' : 'LP time'}</th>
              <th className="border border-ink-200 dark:border-ink-700 px-2 py-1 text-left">{FR ? 'Temps MILP' : 'MILP time'}</th>
            </tr>
          </thead>
          <tbody className="text-ink-600 dark:text-ink-300">
            <tr><td className="border border-ink-200 dark:border-ink-700 px-2 py-1 font-semibold">288h</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">~5 800</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">~7 200</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">0.5–2s</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">3–5s</td></tr>
            <tr><td className="border border-ink-200 dark:border-ink-700 px-2 py-1 font-semibold">672h</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">~13 500</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">~17 000</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">3–8s</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">5–15s</td></tr>
            <tr><td className="border border-ink-200 dark:border-ink-700 px-2 py-1 font-semibold">8760h</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">~175 000</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">~220 000</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">10–60s</td><td className="border border-ink-200 dark:border-ink-700 px-2 py-1">—</td></tr>
          </tbody>
        </table>
      </div>

      <H3>{FR ? 'Analyse de sensibilité (Tornado)' : 'Sensitivity analysis (Tornado)'}</H3>
      <P>
        {FR
          ? 'Lorsque l\'analyse de sensibilité (Tornado) est activée dans l\'onglet Modélisation, le solveur est rappelé ~16 fois en faisant varier chaque paramètre clé (CAPEX solaire/éolien/batterie, prix gaz, abonnement réseau, etc.) de ±20 %. Le ROI simplifié est calculé pour chaque scénario. Temps total : +5–15s.'
          : 'When the sensitivity analysis (Tornado) is enabled in the Modeling tab, the solver is called back ~16 times varying each key parameter (solar/wind/battery CAPEX, gas price, demand charge, etc.) by ±20%. The simplified ROI is computed for each scenario. Total time: +5–15s.'
        }
      </P>

      {/* ═══════════════════════════════════════════════════════════════════════
          14. ANALYSE FINANCIÈRE SUR 25 ANS
          ═══════════════════════════════════════════════════════════════════ */}
      <H2>{FR ? '14. Analyse financière sur 25 ans' : '14. 25-year financial analysis'}</H2>
      <P>
        {FR
          ? "Une fois le dispatch optimal obtenu, une boucle temporelle année par année (1 à 25) est exécutée. Elle ne ré-optimise pas le dispatch — celui-ci est supposé constant chaque année. Seules l'inflation, la dégradation solaire, la dégradation batterie et les renouvellements sont appliqués."
          : 'Once the optimal dispatch is obtained, a year-by-year time loop (1 to 25) is executed. It does not re-optimize the dispatch — it is assumed constant each year. Only inflation, solar degradation, battery degradation, and replacements are applied.'
        }
      </P>

      <H3>{FR ? 'Cash-flow de l\'année y' : 'Year y cash flow'}</H3>
      <Formula>CF(y) = [OPEX_baseline(y) − OPEX_microgrid(y)] − Renouvellements(y) + ValeurRésiduelle(y=25)</Formula>

      <H3>{FR ? 'OPEX baseline (sans microgrid)' : 'Baseline OPEX (without microgrid)'}</H3>
      <P>
        {FR
          ? "Coût annuel de référence si le site achetait toute son électricité au réseau (ou utilisait un groupe gaz 100 % du temps en mode îloté). En mode îloté, le rendement moteur de 35 % est pris en compte : Coût = Charge × gas_fuel / 0.35."
          : 'Reference annual cost if the site purchased all its electricity from the grid (or used a gas generator 100% of the time in off-grid mode). In off-grid mode, the 35% engine efficiency is accounted for: Cost = Load × gas_fuel / 0.35.'
        }
      </P>

      <H3>{FR ? 'Inflation différenciée' : 'Differentiated inflation'}</H3>
      <UL>
        <LI>{FR ? 'Réseau : ×(1 + grid_inflation)^y — défaut 4 %/an' : 'Grid: ×(1 + grid_inflation)^y — default 4%/yr'}</LI>
        <LI>{FR ? 'Gaz : ×(1 + gas_inflation)^y — défaut 2 %/an' : 'Gas: ×(1 + gas_inflation)^y — default 2%/yr'}</LI>
        <LI>{FR ? 'O&M : ×(1 + om_inflation)^y — défaut 2 %/an. O&M = 2 % du CAPEX total par an (non paramétrable).' : 'O&M: ×(1 + om_inflation)^y — default 2%/yr. O&M = 2% of total CAPEX per year (non-configurable).'}</LI>
      </UL>

      <H3>{FR ? 'Dégradation solaire' : 'Solar degradation'}</H3>
      <Formula>Psolaire(y) = Psolaire(0) × (1 − δ)^y — δ = 0.5 %/an</Formula>
      <P>
        {FR
          ? "La perte de production annuelle est valorisée au coût marginal de remplacement : prix d'achat réseau en mode connecté, ou gas_fuel / 0.35 en mode îloté."
          : 'The annual production loss is valued at the marginal replacement cost: grid purchase price in connected mode, or gas_fuel / 0.35 in off-grid mode.'
        }
      </P>

      <H3>{FR ? 'Renouvellements des équipements' : 'Equipment replacements'}</H3>
      <P>{FR ? "Chaque équipement est remplacé à l'échéance de sa durée de vie. Le test y % lifetime == 0 déclenche un coût de remplacement égal au CAPEX initial. Durées par défaut :" : 'Each equipment is replaced at the end of its lifetime. The test y % lifetime == 0 triggers a replacement cost equal to the initial CAPEX. Default lifetimes:'}</P>
      <UL>
        <LI>{FR ? 'Onduleur PV : 10 ans → années 10, 20' : 'PV inverter: 10 yr → years 10, 20'}</LI>
        <LI>{FR ? 'Batterie : 10 ans → années 10, 20' : 'Battery: 10 yr → years 10, 20'}</LI>
        <LI>{FR ? 'Onduleur batterie : 10 ans → années 10, 20' : 'Battery inverter: 10 yr → years 10, 20'}</LI>
        <LI>{FR ? 'Moteur gaz : 15 ans → année 15' : 'Gas engine: 15 yr → year 15'}</LI>
        <LI>{FR ? 'PAC : 15 ans → année 15' : 'HP: 15 yr → year 15'}</LI>
        <LI>{FR ? 'Chaudière : 15 ans → année 15' : 'Boiler: 15 yr → year 15'}</LI>
        <LI>{FR ? 'Éolien : 20 ans → année 20' : 'Wind: 20 yr → year 20'}</LI>
        <LI>{FR ? 'Ballon TES : 20 ans → année 20' : 'TES: 20 yr → year 20'}</LI>
        <LI>{FR ? 'PV : 25 ans → pas de remplacement' : 'PV: 25 yr → no replacement'}</LI>
        <LI>{FR ? 'Hydro : 30 ans → pas de remplacement' : 'Hydro: 30 yr → no replacement'}</LI>
      </UL>

      <H3>{FR ? 'Valeur résiduelle (année 25)' : 'Residual value (year 25)'}</H3>
      <Formula>VR = CAPEX × durée_restante / durée_de_vie</Formula>
      <P>
        {FR
          ? 'Exemple : une batterie remplacée en année 20 (durée de vie 10 ans) a 5 ans restants en année 25 → VR = CAPEX_batterie × 5/10 = 50 % du CAPEX.'
          : 'Example: a battery replaced in year 20 (10-year lifetime) has 5 years remaining in year 25 → RV = Battery_CAPEX × 5/10 = 50% of CAPEX.'
        }
      </P>

      <H3>{FR ? 'Indicateurs financiers calculés' : 'Financial indicators computed'}</H3>
      <UL>
        <LI><strong>{t('kpi.npv')}</strong> : Σ CF(y) / (1 + r)^y — {FR ? 'Valeur Actuelle Nette sur 25 ans' : 'Net Present Value over 25 years'}</LI>
        <LI><strong>{t('kpi.tri')}</strong> : r* {FR ? 'tel que VAN(r*) = 0, calculé par bissection sur [−0.9, 1.0] ou numpy_financial.irr()' : 'such that NPV(r*) = 0, computed via bisection on [−0.9, 1.0] or numpy_financial.irr()'}</LI>
        <LI><strong>{t('kpi.roi')}</strong> : {FR ? '1ère année où le cash-flow cumulé > 0 (payback simple)' : '1st year where cumulative cash flow > 0 (simple payback)'}</LI>
        <LI><strong>Carbon Payback</strong> : {FR ? '1ère année où le cumul CO₂ évité > dette carbone initiale' : '1st year where cumulative avoided CO₂ > initial carbon debt'}</LI>
      </UL>

      {/* ═══════════════════════════════════════════════════════════════════════
          15. BILAN CARBONE
          ═══════════════════════════════════════════════════════════════════ */}
      <H2>{FR ? '15. Bilan carbone' : '15. Carbon balance'}</H2>

      <H3>{FR ? 'Dette carbone initiale (embodied carbon)' : 'Initial carbon debt (embodied carbon)'}</H3>
      <Formula>CO₂_dette = Σ (Capacité × Facteur_embarqué) / 1000 [t CO₂]</Formula>
      <P>{FR ? "Facteurs d'émission utilisés (analyse de cycle de vie, kg CO₂ par unité) :" : 'Emission factors used (life cycle analysis, kg CO₂ per unit):'}</P>
      <UL>
        <LI>PV : 800 kg CO₂/kWc</LI>
        <LI>{FR ? 'Éolien' : 'Wind'} : 600 kg CO₂/kW</LI>
        <LI>Hydro : 1200 kg CO₂/kW</LI>
        <LI>{FR ? 'Batterie' : 'Battery'} : 100 kg CO₂/kWh</LI>
        <LI>{FR ? 'Onduleur' : 'Inverter'} : 50 kg CO₂/kW</LI>
        <LI>{FR ? 'Moteur gaz' : 'Gas engine'} : 200 kg CO₂/kW</LI>
        <LI>{FR ? 'Chaudière' : 'Boiler'} : 100 kg CO₂/kW</LI>
        <LI>PAC : 150 kg CO₂/kW</LI>
        <LI>{FR ? 'Ballon TES' : 'TES tank'} : 30 kg CO₂/kWh</LI>
      </UL>

      <H3>{FR ? 'Émissions opérationnelles annuelles' : 'Annual operational emissions'}</H3>
      <Formula>
        CO₂_op = Σt [(P_gaz(t) / 0.35 + P_chaudière(t) / η[t]) × 0.500 + P_achat(t) × 0.060] × wt / 1000 &nbsp;[t CO₂/an]
      </Formula>
      <UL>
        <LI>0.500 kg CO₂/kWh PCI — {FR ? 'gaz naturel' : 'natural gas'}</LI>
        <LI>0.060 kg CO₂/kWh — {FR ? 'mix électrique français moyen' : 'average French grid mix'}</LI>
      </UL>

      <H3>{FR ? 'CO₂ évité annuel' : 'Annual avoided CO₂'}</H3>
      <Formula>CO₂_évité = CO₂_baseline − CO₂_microgrid [t CO₂/an]</Formula>

      <H3>Carbon Payback</H3>
      <P>
        {FR
          ? "Première année où le cumul des émissions évitées (CO₂_baseline − CO₂_microgrid) dépasse la dette carbone initiale. Le CO₂ des renouvellements d'équipements est inclus chaque année."
          : 'First year where cumulative avoided emissions (CO₂_baseline − CO₂_microgrid) exceed the initial carbon debt. Equipment replacement CO₂ is included each year.'
        }
      </P>

      {/* ═══════════════════════════════════════════════════════════════════════
          16. HYPOTHÈSES ET LIMITES
          ═══════════════════════════════════════════════════════════════════ */}
      <H2>{FR ? '16. Hypothèses et limites' : '16. Assumptions and limitations'}</H2>
      <UL>
        <LI><strong>{FR ? 'Jours / semaines-types' : 'Typical days / weeks'}</strong> : {FR ? 'en 288h et 672h, chaque période est représentée par une moyenne. Les extrêmes intra-période sont lissés. La 8760h n\'a pas cette limitation.' : 'in 288h and 672h, each period is represented by an average. Intra-period extremes are smoothed. 8760h mode does not have this limitation.'}</LI>
        <LI><strong>{FR ? 'Régime permanent' : 'Steady state'}</strong> : {FR ? 'le dispatch optimal de l\'année 0 est supposé constant chaque année. Seules l\'inflation, la dégradation solaire, la dégradation batterie et les renouvellements évoluent.' : 'the optimal year-0 dispatch is assumed constant each year. Only inflation, solar degradation, battery degradation, and replacements evolve.'}</LI>
        <LI><strong>{FR ? 'Marché parfait' : 'Perfect market'}</strong> : {FR ? 'achat/vente réseau illimité dans la limite de la puissance souscrite. Pas de contraintes réglementaires ou de capacité du réseau de distribution.' : 'unlimited grid buy/sell within subscribed power limit. No regulatory or distribution network capacity constraints.'}</LI>
        <LI><strong>{FR ? 'Pas d\'économies d\'échelle' : 'No economies of scale'}</strong> : {FR ? 'CAPEX strictement linéaires. Les effets de taille de projet ne sont pas modélisés.' : 'strictly linear CAPEX. Project size effects are not modeled.'}</LI>
        <LI><strong>{FR ? 'Dégradation batterie simplifiée' : 'Simplified battery degradation'}</strong> : {FR ? 'le dispatch n\'est pas ré-optimisé avec la capacité dégradée. Le manque à gagner est approximé au coût marginal (erreur VAN < 2 %). Les compteurs sont remis à zéro après chaque renouvellement.' : 'the dispatch is not re-optimized with degraded capacity. The shortfall is approximated at marginal cost (NPV error < 2%). Counters reset after each replacement.'}</LI>
        <LI><strong>{FR ? 'Rendements thermo-dépendants' : 'Temperature-dependent efficiencies'}</strong> : {FR ? 'pertes solaires thermiques (NOCT), COP PAC variable (Carnot ± air/eau), rendement chaudière variable (condensation).' : 'solar thermal losses (NOCT), variable HP COP (Carnot ± air/water), variable boiler efficiency (condensing).'}</LI>
        <LI><strong>{FR ? 'Panneaux inclinés & trackers' : 'Tilted panels & trackers'}</strong> : {FR ? 'décomposition GHI→DNI/DHI + transposition HDKR. Supporte tilt, azimuth, albédo, tracking mono-axe et bi-axe.' : 'GHI→DNI/DHI decomposition + HDKR transposition. Supports tilt, azimuth, albedo, single and dual-axis tracking.'}</LI>
        <LI><strong>{FR ? 'Données NASA POWER' : 'NASA POWER data'}</strong> : {FR ? 'les années 2013–2022 sont utilisées comme référence climatique. La représentativité future dépend du changement climatique.' : 'years 2013–2022 are used as climate reference. Future representativeness depends on climate change.'}</LI>
        <LI><strong>{FR ? 'Courbe de puissance éolienne' : 'Wind power curve'}</strong> : {FR ? 'courbe quadratique générique. Les courbes spécifiques constructeur peuvent donner des résultats plus précis pour un modèle de turbine donné.' : 'generic quadratic curve. Manufacturer-specific curves may give more accurate results for a given turbine model.'}</LI>
        <LI><strong>{FR ? 'Émissions réseau constantes' : 'Constant grid emissions'}</strong> : 60 g CO₂/kWh {FR ? 'toute l\'année. Le contenu CO₂ horaire du mix n\'est pas modélisé.' : 'year-round. Hourly grid mix CO₂ content is not modeled.'}</LI>
        <LI><strong>{FR ? 'Pas de modélisation des pannes' : 'No outage modeling'}</strong> : {FR ? 'les équipements sont toujours disponibles (hors contrainte N-1 optionnelle). Les taux de panne et la maintenance corrective ne sont pas modélisés.' : 'equipment is always available (except optional N-1 constraint). Failure rates and corrective maintenance are not modeled.'}</LI>
        <LI><strong>{FR ? 'Surface infinie par défaut' : 'Infinite area by default'}</strong> : {FR ? 'utiliser max_solar_kW et max_wind_kW pour contraindre la surface disponible.' : 'use max_solar_kW and max_wind_kW to constrain available area.'}</LI>
        <LI><strong>{FR ? 'Pas de modélisation de l\'inertie / fréquence' : 'No inertia / frequency modeling'}</strong> : {FR ? 'le modèle est purement énergétique (kW, kWh). La stabilité dynamique du microgrid n\'est pas évaluée.' : 'the model is purely energy-based (kW, kWh). Dynamic microgrid stability is not evaluated.'}</LI>
      </UL>

      {/* ═══════════════════════════════════════════════════════════════════════
          17. RÉFÉRENCES
          ═══════════════════════════════════════════════════════════════════ */}
      <H2>{FR ? '17. Références' : '17. References'}</H2>
      <UL>
        <LI><strong>NASA POWER</strong> — Prediction of Worldwide Energy Resources — <Code>power.larc.nasa.gov</Code></LI>
        <LI><strong>PVGIS v5.2</strong> — JRC, European Commission — <Code>re.jrc.ec.europa.eu</Code></LI>
        <LI><strong>Open-Meteo</strong> — Free weather API — <Code>open-meteo.com</Code></LI>
        <LI><strong>CBC</strong> — COIN-OR Branch and Cut — <Code>github.com/coin-or/Cbc</Code></LI>
        <LI><strong>PuLP</strong> — Python LP modeling — <Code>coin-or.github.io/pulp</Code></LI>
        <LI><strong>CRF</strong> — Capital Recovery Factor (Short, Packey & Holt, 1995)</LI>
        <LI><strong>HDKR</strong> — Hay, Davies, Klucher, Reindl (1980) — {FR ? 'Modèle de transposition anisotrope du rayonnement solaire' : 'Anisotropic solar radiation transposition model'}</LI>
        <LI><strong>NOCT</strong> — Nominal Operating Cell Temperature (IEC 61215)</LI>
        <LI><strong>{FR ? 'Carnot' : 'Carnot'}</strong> — {FR ? 'Cycle de Carnot pour PAC (thermodynamique classique)' : 'Carnot cycle for HP (classical thermodynamics)'}</LI>
        <LI><strong>ADEME Carbon Base</strong> — <Code>bilans-ges.ademe.fr</Code></LI>
        <LI><strong>IPCC AR6</strong> — Global Warming Potentials (GWP 100a)</LI>
        <LI><strong>HOMER Pro</strong> — NREL / UL Solutions — {FR ? 'Référence méthodologique pour le dimensionnement de micro-réseaux' : 'Methodological reference for microgrid sizing'}</LI>
      </UL>
    </Modal>
  );
}
