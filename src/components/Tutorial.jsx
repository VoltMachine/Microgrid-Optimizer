import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Zap, MapPin, Sun, BatteryCharging, Coins, Sliders,
  Play, BarChart3, Lightbulb, ChevronRight, ChevronLeft,
  Thermometer, ShieldCheck,
} from 'lucide-react';
import { useI18n } from '../i18n';

function buildSteps(t, FR) {
  return [
    {
      icon: Zap,
      title: FR ? 'Bienvenue sur Microgrid Optimizer' : 'Welcome to Microgrid Optimizer',
      body: (
        <>
          <p>{FR
            ? "Un microgrid (ou micro-réseau) est un système électrique capable de produire, stocker et distribuer de l'énergie localement, soit en autonomie complète, soit connecté au réseau public. Il peut intégrer des panneaux solaires, des éoliennes, des batteries, un groupe gaz, une pompe à chaleur, etc."
            : 'A microgrid is an electrical system that can generate, store and distribute energy locally, either fully autonomous or connected to the public grid. It can include solar panels, wind turbines, batteries, a gas genset, a heat pump, and more.'}
          </p>
          <p className="mt-2">{FR
            ? "Cet outil dimensionne votre microgrid en calculant le meilleur équilibre économique de votre système — CAPEX, OPEX, CO₂ — sur un horizon de 25 ans, via un solveur d'optimisation linéaire."
            : 'This tool sizes your microgrid by finding the best economic balance for your system — CAPEX, OPEX, CO₂ — over a 25-year horizon, via a linear programming solver.'}
          </p>
          <p className="mt-2 font-medium text-brand-600 dark:text-brand-400">{FR
            ? 'Prêt à dimensionner votre premier microgrid ?'
            : 'Ready to size your first microgrid?'}
          </p>
        </>
      ),
    },
    {
      icon: Sliders,
      title: FR ? '1. Deux modes de travail' : '1. Two work modes',
      body: (
        <>
          <p>{FR
            ? 'Tout en haut de la barre latérale, un toggle vous permet de basculer entre deux modes de travail.'
            : 'At the very top of the sidebar, a toggle lets you switch between two work modes.'}
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li>{FR
              ? "Optimisation — le solveur trouve les capacités idéales de chaque équipement pour minimiser le coût total. Vous donnez les contraintes (budget, surface, coûts), il calcule le dimensionnement et le dispatch optimal. C'est le mode par défaut."
              : 'Optimization — the solver finds ideal equipment capacities to minimize total cost. You give it constraints (budget, area, costs), it computes optimal sizing and dispatch. The default mode.'}
            </li>
            <li>{FR
              ? "Paramétrage personnel — vous fixez vous-même les capacités (kW de PV, kWh de batterie…) et le solveur optimise le dispatch horaire. Il vous renvoie aussi tous les indicateurs financiers (VAN, TRI, ROI) et le bilan carbone. Pratique pour vérifier un devis ou comparer deux scénarios."
              : 'Custom sizing — you set capacities yourself (PV kW, battery kWh…) and the solver optimizes hourly dispatch. It also returns all financial indicators (NPV, IRR, ROI) and the carbon balance. Useful to validate a quote or compare two scenarios.'}
            </li>
          </ul>
        </>
      ),
    },
    {
      icon: MapPin,
      title: FR ? '2. Localisation et météo' : '2. Location and weather',
      body: (
        <>
          <p>{FR
            ? 'Placez le marqueur sur la carte ou saisissez vos coordonnées GPS. De cette position découlent trois données :'
            : 'Place the marker on the map or type your GPS coordinates. Three things come from this:'}
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>{FR ? 'Le gisement solaire (NASA POWER, avec PVGIS en secours)' : 'Solar resource (NASA POWER, with PVGIS as backup)'}</li>
            <li>{FR ? 'Le régime de vent (NASA POWER, avec Open-Meteo en secours)' : 'Wind regime (NASA POWER, with Open-Meteo as backup)'}</li>
            <li>{FR ? 'La température horaire — qui influence le rendement des panneaux et de la PAC' : 'Hourly temperature — which influences panel and heat pump efficiency'}</li>
          </ul>
        </>
      ),
    },
    {
      icon: Thermometer,
      title: FR ? '3. Usages et demande' : '3. Usage and demand',
      body: (
        <>
          <p>{FR
            ? "L'onglet Usages & Demande décrit la consommation du site : nombre de foyers, puissance de pointe par foyer, surconsommation hivernale, charge tertiaire en journée, et part thermique si vous avez besoin de chaleur."
            : 'The Usage & Demand tab describes site consumption: number of homes, peak power per home, winter overconsumption, daytime commercial load, and thermal share if you need heat.'}
          </p>
          <p className="mt-2">{FR
            ? "Juste en dessous, Flexibilité & VE permet d'ajouter du load-shifting (déplacer de la consommation dans la journée) et des véhicules électriques avec charge nocturne. Le V2G (vehicle-to-grid) est aussi paramétrable."
            : 'Right below, Flexibility & EVs lets you add load-shifting (moving consumption around the day) and electric vehicles with overnight charging. V2G (vehicle-to-grid) is also configurable.'}
          </p>
        </>
      ),
    },
    {
      icon: Sun,
      title: FR ? '4. Production renouvelable' : '4. Renewable generation',
      body: (
        <>
          <p>{FR
            ? "Solaire, éolien, hydro — chaque source a son onglet dans la section Énergies renouvelables. Un bouton bleu en haut de chaque onglet permet d'inclure ou d'exclure la source de l'optimisation."
            : 'Solar, wind, hydro — each source has its own tab under Renewable energy. A blue button at the top of each tab lets you include or exclude the source from the optimization.'}
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>{FR
              ? "Solaire : CAPEX, durée de vie, dégradation, coefficient de température. Vous pouvez aussi régler l'inclinaison, l'orientation, l'albédo et le type de tracking (fixe, 1 axe, 2 axes)."
              : 'Solar: CAPEX, lifetime, degradation, temperature coefficient. You can also set tilt, azimuth, albedo and tracking type (fixed, 1-axis, 2-axis).'}
            </li>
            <li>{FR
              ? 'Éolien : CAPEX, durée de vie. La vitesse du vent est récupérée automatiquement depuis les données NASA POWER pour votre localisation.'
              : 'Wind: CAPEX, lifetime. Wind speed is automatically retrieved from NASA POWER data for your location.'}
            </li>
            <li>{FR
              ? 'Hydro : CAPEX, durée de vie, facteur de débit, et puissance maximale installable (fonction du débit de votre cours d\'eau).'
              : 'Hydro: CAPEX, lifetime, flow factor, and maximum installable power (based on your watercourse flow).'}
            </li>
          </ul>
        </>
      ),
    },
    {
      icon: BatteryCharging,
      title: FR ? '5. Stockage, chaleur et backup' : '5. Storage, heat and backup',
      body: (
        <>
          <ul className="list-disc pl-5 space-y-2">
            <li>{FR
              ? "Stockage batterie — la batterie lisse la production intermittente et permet de l'arbitrage tarifaire (charger quand l'électricité est bon marché, décharger quand elle est chère). CAPEX au kWh, rendement charge/décharge, SOC minimum."
              : 'Battery storage — smooths intermittent production and enables price arbitrage (charge when electricity is cheap, discharge when expensive). CAPEX per kWh, charge/discharge efficiency, min SOC.'}
            </li>
            <li>{FR
              ? 'Production de chaleur — pompe à chaleur (son COP varie avec la température extérieure), chaudière gaz à condensation, et ballon de stockage thermique.'
              : 'Heat production — heat pump (its COP varies with outdoor temperature), condensing gas boiler, and thermal storage tank.'}
            </li>
            <li>{FR
              ? "Moteur gaz — le groupe électrogène de secours. Vous réglez le prix du gaz, la durée de vie, et la limite de rampe (variation max de puissance par heure)."
              : "Gas engine — the backup genset. You set the gas price, lifetime, and ramp limit (max power variation per hour)."}
            </li>
          </ul>
        </>
      ),
    },
    {
      icon: Coins,
      title: FR ? '6. Réseau et finance' : '6. Grid and finance',
      body: (
        <>
          <p>{FR
            ? "Réseau & Tarification : connecté (achat/vente) ou isolé (autonomie totale). Tarifs HP/HC ou marché spot horaire. Prix de revente configurable."
            : 'Grid & Pricing: connected (buy/sell) or off-grid (full autonomy). Peak/off-peak tariffs or hourly spot market. Configurable sell price.'}
          </p>
          <p className="mt-2">{FR
            ? "Hypothèses financières : taux d'actualisation (WACC, 5 %), inflations différenciées (réseau +4 %/an, gaz +2 %, O&M +2 %), valeur de la perte de charge (VOLL, 5 €/kWh)."
            : 'Financial assumptions: discount rate (WACC, 5%), differentiated inflations (grid +4%/yr, gas +2%, O&M +2%), value of lost load (VOLL, 5 €/kWh).'}
          </p>
        </>
      ),
    },
    {
      icon: ShieldCheck,
      title: FR ? '7. Modélisation avancée' : '7. Advanced modeling',
      body: (
        <>
          <p>{FR
            ? "L'onglet Modélisation rassemble les options avancées en trois sections :"
            : 'The Modeling tab groups advanced options in three sections:'}
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li>{FR
              ? 'Résolution temporelle — 288h (12 jours-types, rapide), 672h (4 semaines-types) ou 8760h (année complète, plus lent mais plus fidèle).'
              : 'Temporal resolution — 288h (12 typical days, fast), 672h (4 typical weeks) or 8760h (full year, slower but more accurate).'}
            </li>
            <li>{FR
              ? 'Risque & Sensibilité — mode P90, analyse stochastique sur ~10 ans de météo, stress-test événements extrêmes (dark doldrums, vague de froid, canicule), contrainte N-1 (que se passe-t-il si le plus gros producteur tombe ?) et Tornado de sensibilité (±20 % sur chaque paramètre).'
              : 'Risk & Sensitivity — P90 mode, stochastic analysis over ~10 weather years, extreme event stress-test (dark doldrums, cold wave, heat wave), N-1 reserve (what if the largest generator fails?), and sensitivity Tornado (±20% on each parameter).'}
            </li>
            <li>{FR
              ? 'Budget carbone — plafond annuel de CO₂. Laissez à 0 pour un mode purement économique.'
              : 'Carbon budget — annual CO₂ cap. Leave at 0 for pure economic mode.'}
            </li>
          </ul>
        </>
      ),
    },
    {
      icon: Play,
      title: FR ? '8. Lancement' : '8. Launch',
      body: (
        <>
          <p>{FR
            ? "Le bouton bleu en bas de la barre latérale lance le solveur CBC. En 288h, le résultat arrive en moins de deux secondes."
            : 'The blue button at the bottom of the sidebar fires the CBC solver. In 288h mode, results land in under two seconds.'}
          </p>
          <p className="mt-2">{FR
            ? 'En 8760h avec analyse stochastique, vous avez le temps de vous faire un café. En 8760h en incluant les événements extrêmes, vous avez le temps de le boire.'
            : 'In 8760h with stochastic analysis, you have time to grab a coffee. In 8760h including extreme events, you have time to drink it.'}
          </p>
        </>
      ),
    },
    {
      icon: BarChart3,
      title: FR ? '9. Résultats' : '9. Results',
      body: (
        <>
          <p>{FR ? 'Une fois le calcul terminé, le dashboard affiche :' : 'Once the calculation is done, the dashboard shows:'}</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>{FR ? 'La rangée de KPIs — CAPEX, VAN, TRI, ROI, CO₂ évité, résilience' : 'The KPI row — CAPEX, NPV, IRR, ROI, CO₂ avoided, resilience'}</li>
            <li>{FR ? 'Le bilan énergétique horaire — le graphique principal. Cliquez les pastilles pour masquer une série, utilisez les boutons Jour/Semaine/Mois et les flèches pour naviguer. Les séries inutilisées sont masquées automatiquement.' : 'The hourly energy balance — the main chart. Click chips to toggle series, use Day/Week/Month buttons and arrows to navigate. Unused series are auto-hidden.'}</li>
            <li>{FR ? 'Les courbes de cash-flow et de carbone cumulé sur 25 ans' : 'The 25-year cumulative cashflow and carbon curves'}</li>
            <li>{FR ? 'Le donut de répartition des coûts annuels (OPEX)' : 'The annual cost breakdown donut (OPEX)'}</li>
            <li>{FR ? 'Le tableau des capacités optimales — ou votre propre dimensionnement en mode paramétrage' : 'The optimal capacities table — or your own sizing in custom sizing mode'}</li>
          </ul>
        </>
      ),
    },
    {
      icon: Lightbulb,
      title: FR ? '10. Astuces' : '10. Tips',
      body: (
        <>
          <ul className="list-disc pl-5 space-y-2">
            <li>{FR
              ? 'Vous pouvez zoomer dans le bilan énergétique avec les presets Jour / Semaine / Mois et les flèches de navigation.'
              : 'You can zoom into the energy balance with the Day / Week / Month presets and navigation arrows.'}
            </li>
            <li>{FR
              ? 'Vous pouvez exporter tous les résultats en CSV (données complètes) ou en PDF (rapport formaté).'
              : 'You can export all results as CSV (full data) or PDF (formatted report).'}
            </li>
            <li>{FR
              ? "Le mode sombre est là pour les longues sessions, le sélecteur FR/EN pour changer de langue, et « Comment ça marche ? » pour creuser la théorie."
              : 'Dark mode is there for long sessions, the FR/EN selector to switch language, and « How it works? » to dig into the theory.'}
            </li>
            <li>{FR
              ? 'Vous pouvez retrouver ce tutoriel à tout moment depuis le bouton Tutoriel dans la barre du haut.'
              : 'You can replay this tutorial anytime from the Tutorial button in the top bar.'}
            </li>
          </ul>
        </>
      ),
    },
  ];
}

const TUTORIAL_KEY = 'microgrid_tutorial_seen';

export function useTutorial() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(TUTORIAL_KEY);
    if (!seen) {
      const timer = setTimeout(() => setShow(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(TUTORIAL_KEY, '1');
    setShow(false);
  };

  return { show, dismiss };
}

export default function Tutorial({ open, onClose }) {
  const { t, lang } = useI18n();
  const FR = lang === 'fr';
  const STEPS = useMemo(() => buildSteps(t, FR), [t, FR]);

  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const Icon = current.icon;

  const handleClose = () => {
    setStep(0);
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={handleClose}>
      <div className="absolute inset-0 bg-ink-900/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl mx-4 rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="flex gap-1 px-6 pt-5 pb-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-brand-500' : 'bg-ink-200 dark:bg-ink-700'}`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-[55vh] overflow-y-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="grid place-items-center h-10 w-10 rounded-xl bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 shrink-0">
              <Icon size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ink-400 dark:text-ink-500">
                {FR ? 'Étape' : 'Step'} {step + 1} / {STEPS.length}
              </p>
              <h2 className="text-base font-bold text-ink-900 dark:text-ink-50">
                {current.title}
              </h2>
            </div>
          </div>
          <div className="text-[13px] leading-relaxed text-ink-600 dark:text-ink-300">
            {current.body}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-ink-200 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-900/50">
          <button
            onClick={handleClose}
            className="text-xs font-medium text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition-colors"
          >
            {FR ? 'Passer le tutoriel' : 'Skip tutorial'}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={isFirst}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-xl border border-ink-200 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-800 text-xs font-medium transition-colors disabled:opacity-30"
            >
              <ChevronLeft size={14} /> {FR ? 'Précédent' : 'Previous'}
            </button>
            <button
              onClick={() => isLast ? handleClose() : setStep(step + 1)}
              className="inline-flex items-center gap-1 h-9 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors"
            >
              {isLast ? (FR ? 'C\'est parti !' : 'Let\'s go!') : (FR ? 'Suivant' : 'Next')}
              {!isLast && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
