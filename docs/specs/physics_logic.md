# Microgrid Optimization Engine — Documentation Technique

**Version** : 4.2
**Date** : 2026-05-17
**Fichiers de référence** : `backend/services/weather_service.py`, `backend/services/optimizer_engine.py` (288h/672h), `backend/services/optimizer_8760.py` (8760h), `backend/services/finance_utils.py`, `backend/utils/helpers.py` (ResolutionConfig)

---

## Table des Matières

1. [Architecture Temporelle](#1-architecture-temporelle)
2. [Modèle Éolien](#2-modèle-éolien)
3. [Modèle Solaire](#3-modèle-solaire)
4. [Modèle Hydroélectrique](#4-modèle-hydroélectrique)
5. [Construction de la Charge](#5-construction-de-la-charge)
6. [Coeur de l'Optimiseur (MILP/LP)](#6-coeur-de-loptimiseur-milplp)
   - [6.1 Variables de Décision](#61-variables-de-décision)
   - [6.2 Fonction Objectif](#62-fonction-objectif)
   - [6.3 Contraintes par Période](#63-contraintes-par-période)
   - [6.4 Contraintes Horaires](#64-contraintes-horaires)
   - [6.5 Extensions MILP](#65-extensions-milp)
7. [Indicateurs Financiers](#7-indicateurs-financiers)
8. [Bilan Carbone](#8-bilan-carbone)
9. [Constantes Physiques](#9-constantes-physiques)

---

## 1. Architecture Temporelle

Le modèle supporte **trois résolutions temporelles**, sélectionnées via `EconomicConfig.resolution` (`"288h"`, `"672h"`, `"8760h"`). L'annualisation est gérée par la classe `ResolutionConfig` (`helpers.py`) qui fournit `n_hours`, `weight(t)`, `period_of(t)`, et `season_multipliers(S)`.

| Résolution | Structure | Pas de temps | Poids $w_t$ | SOC |
|-----------|-----------|-------------|-------------|-----|
| **288h** (défaut) | 12 mois × 1 jour-type × 24h | 288 | $D_m = [31, 28, ..., 31]$ | Quotidien (24h) |
| **672h** | 4 saisons × 1 semaine-type × 24h × 7j | 672 | $J_s / 7$ où $J_s \in \{90, 92, 92, 91\}$ | Hebdomadaire (168h) |
| **8760h** | Année chronologique complète (2020) | 8760 | 1 (chaque heure = 1) | Quotidien (24h, 365 jours) |

Formules généralisées — pour l'heure $t$, la période $p = \text{period\_of}(t)$ et le poids d'annualisation $w_t = \text{weight}(t)$ :

$$X_{\text{annuel}} = \sum_{t=0}^{N-1} x_t \cdot w_t \quad \text{où } \sum_{t=0}^{N-1} w_t = 8760$$

---

## 2. Modèle Éolien

### 2.1 Source de Données

| Source | Paramètre | Hauteur référence | Utilisation |
|--------|-----------|-------------------|-------------|
| NASA POWER | `WS50M` | 50 m | Primaire (TMY sur 10 ans) |
| NASA POWER | `WS10M` | 10 m | Repli si WS50M indisponible |
| Open-Meteo | `wind_speed_10m` | 10 m | Fallback si NASA indisponible |

La vitesse Open-Meteo est convertie de km/h en m/s : $v = v_{km/h} / 3.6$

### 2.2 Loi Logarithmique d'Extrapolation

La vitesse du vent à la hauteur de moyeu $H$ est extrapolée depuis la hauteur de référence $H_{ref}$ via la **loi logarithmique de couche limite atmosphérique** :

$$v(H) = v(H_{ref}) \cdot \frac{\ln(H / z_0)}{\ln(H_{ref} / z_0)}$$

Où :
- $H$ : hauteur de moyeu (défaut : `hub_height = 80 m`)
- $H_{ref}$ : hauteur de mesure NASA (50 m ou 10 m)
- $z_0$ : longueur de rugosité du terrain (défaut : `roughness_length = 0.03 m`)

**Valeurs typiques de $z_0$** :

| Terrain | $z_0$ (m) |
|---------|-----------|
| Mer / lac | 0.0002 |
| Plaine agricole | 0.03 |
| Bocage | 0.10 |
| Périurbain | 0.25 |
| Urbain / forêt | 1.0 |

**Sécurité numérique** : $z_0$ est borné à $\max(z_0, 10^{-4})$. Si $H_{ref} \leq z_0$ ou $H \leq z_0$, on retourne $v_{ref}$ sans extrapolation.

### 2.3 Courbe de Puissance Quadratique

La puissance normalisée d'une éolienne (en kW/kW installé) suit une courbe de puissance quadratique entre la vitesse de démarrage et la vitesse nominale :

$$P(v) = \begin{cases}
0 & \text{si } v < v_{\text{cut-in}} \text{ ou } v \geq v_{\text{cut-out}} \\
1 & \text{si } v \geq v_{\text{rated}} \\
\left( \dfrac{v - v_{\text{cut-in}}}{v_{\text{rated}} - v_{\text{cut-in}}} \right)^2 & \text{sinon}
\end{cases}$$

**Paramètres** (constants, représentatifs d'une turbine commerciale standard) :

| Paramètre | Valeur |
|-----------|--------|
| $v_{\text{cut-in}}$ | 3.0 m/s |
| $v_{\text{rated}}$ | 12.0 m/s |
| $v_{\text{cut-out}}$ | 25.0 m/s |

**Justification de l'exposant 2 :** Bien que la puissance disponible dans le vent suive une loi de Betz en $v^3$, le coefficient de puissance $C_p$ d'une turbine réelle varie avec la vitesse : faible à bas régime (décrochage aérodynamique), optimal vers 8–10 m/s, puis réduit avant le nominal (pitch control). La courbe effective résultante est bien mieux approximée par un exposant 2 que par un exposant 3. Cet exposant est validé contre les données constructeur (Vestas V112, Enercon E-103) et cohérent avec les outils de référence (HOMER, NREL-SAM en mode générique). L'ancienne interpolation linéaire (V3) était trop optimiste ; l'exposant 3 pur était trop pessimiste.

### 2.4 Chaîne de Traitement Complète

```
NASA POWER WS50M (50m) / WS10M (10m)
    ↓  wind_hub_extrapolate(v, H_ref, H_hub, z_0)
Vitesse à hauteur de moyeu
    ↓  wind_power_curve(v)
Puissance normalisée [0, 1] kW/kW
    ↓  × cap_w dans l'optimiseur
Production éolienne horaire (kW)
```

---

## 3. Modèle Solaire

### 3.1 Source de Données

| Source | Paramètre | Unité | Utilisation |
|--------|-----------|-------|-------------|
| NASA POWER | `ALLSKY_SFC_SW_DWN` + `T2M` | W/m² + °C | Primaire (TMY sur 10 ans, un seul appel) |
| PVGIS v5.2 | `seriescalc` | W/kWp | Fallback solaire |
| Open-Meteo | `temperature_2m` | °C | Fallback température |

### 3.2 Conversion Irradiance → Puissance (avec dérating thermique NOCT)

L'irradiance horizontale $G$ (W/m²) et la température ambiante $T_{\text{amb}}$ (°C) sont converties via le modèle NOCT (Nominal Operating Cell Temperature) :

**Étape 1 — Température cellule** :

$$T_{\text{cell}}[t] = T_{\text{amb}}[t] + (\text{NOCT} - 20) \cdot \frac{G[t]}{G_{\text{NOCT}}}$$

**Étape 2 — Facteur de dérating thermique** :

$$f_{\text{temp}}[t] = 1 + \gamma \cdot (T_{\text{cell}}[t] - T_{\text{STC}})$$

**Étape 3 — Puissance normalisée** :

$$P_{\text{solaire}}[t] = G[t] \cdot \frac{1 - L_{\text{fixes}}}{1000} \cdot \max(0, f_{\text{temp}}[t])$$

Où :
- $L_{\text{fixes}} = 0.10$ (pertes fixes : câblage 2%, onduleur 3%, soiling 2%, mismatch 3% — les pertes thermiques sont modélisées explicitement)
- $\text{NOCT} = 45$ °C (température cellule à 800 W/m², 20°C ambiant, vent 1 m/s)
- $G_{\text{NOCT}} = 800$ W/m² (irradiance de référence NOCT)
- $T_{\text{STC}} = 25$ °C (température de référence STC)
- $\gamma = -0.004$ /°C (`solar.temp_coeff`) — coefficient de température de puissance

> **Exemple** : Paris été, $G = 800$ W/m², $T_{\text{amb}} = 30$°C → $T_{\text{cell}} = 30 + 25 \times 800/800 = 55$°C → $f_{\text{temp}} = 1 - 0.004 \times 30 = 0.88$. La production est réduite de ~12% par rapport à une cellule à 25°C.

> **Note :** le rendement module $\eta$ n'intervient **pas**. Le kWc encapsule déjà le rendement : 1 kWc produit 1 kW DC sous 1000 W/m² quelle que soit l'efficacité.

**Constante de conversion effective** (hors température) :

$$K_{\text{conv}} = \frac{0.90}{1000} = 9.0 \times 10^{-4} \text{ kW/kWp par W/m²}$$

Dans l'optimiseur, la production solaire est bornée par :
- La ressource : $p_{\text{s_ac}}[t] \leq C_s \cdot P_{\text{solaire}}(t)$
- L'onduleur : $p_{\text{s_ac}}[t] \leq C_{s,\text{inv}}$

### 3.3 Dégradation Annuelle

La production solaire se dégrade linéairement chaque année dans la boucle financière :

$$P_{\text{solaire, an } y} = P_{\text{solaire, an } 0} \cdot (1 - \delta)^y$$

Où $\delta = 0.005$ (0.5%/an, défaut `solar_degradation`). La perte de production est valorisée au coût marginal évité (prix de l'électricité réseau ou coût du gaz évité).

### 3.4 Profil de Fallback (PVGIS)

Si NASA POWER est indisponible, l'API PVGIS v5.2 est interrogée :
```
GET https://re.jrc.ec.europa.eu/api/v5_2/seriescalc
    ?lat={lat}&lon={lon}&startyear=2020&endyear=2020
    &pvcalculation=1&peakpower=1&loss=14&outputformat=json
```
PVGIS retourne directement des W/kWp (avec pertes = 14% déjà intégrées). Les valeurs sont divisées par 1000 pour obtenir des kW/kWp.

Si PVGIS échoue également, un profil synthétique sinusoïdal est utilisé comme dernier recours.

### 3.5 Géométrie Solaire & Transposition sur Plan Incliné (M4)

La production solaire peut être calculée pour un plan incliné arbitraire (toiture, tracker, façade) via la transposition HDKR.

**Position solaire** (zenith $\theta_z$, azimuth $\gamma_s$, 0=Nord) :

$$\delta = 0.4093 \cdot \sin\left(\frac{2\pi(284 + doy)}{365}\right) \quad \text{(déclinaison)}$$

$$\cos\theta_z = \sin\phi\sin\delta + \cos\phi\cos\delta\cos\omega \quad \text{(zénith)}$$

Où $\phi$ = latitude, $\omega$ = angle horaire (15°/h depuis midi solaire), $doy$ = jour de l'année.

**Angle d'incidence (AOI)** sur un plan de tilt $\beta$ et azimuth $\gamma_p$ :

$$\cos(AOI) = \cos\theta_z\cos\beta + \sin\theta_z\sin\beta\cos(\gamma_s - \gamma_p)$$

**Transposition HDKR** — irradiance sur plan incliné (POA, W/m²) :

$$POA = DNI \cdot \cos(AOI) + DHI \cdot \left[(1-A_i)\frac{1+\cos\beta}{2} + A_i \cdot R_b\right] + GHI \cdot \rho \cdot \frac{1-\cos\beta}{2}$$

Où :
- $A_i = DNI / G_{ext}$ : indice d'anisotropie (Hay-Davies)
- $R_b = \cos(AOI) / \cos\theta_z$ : facteur de forme géométrique
- $\rho$ : albédo du sol (0.2 herbe, 0.5 béton, 0.8 neige)
- $G_{ext} = G_{SC} \cdot (1 + 0.033\cos(2\pi \cdot 172/365)) \cdot \cos\theta_z$ : irradiance extraterrestre

**Modes de tracking** :

| Mode | Tilt $\beta$ | Azimuth $\gamma_p$ |
|------|-------------|-------------------|
| `fixed` | constant (`solar.tilt`) | constant (`solar.azimuth`) |
| `mono_h` | optimal E-W (axe N-S horizontal) | constant (0° = Sud) |
| `dual` | $\beta = \theta_z$ (face au soleil) | $\gamma_p = \gamma_s + \pi$ |

---

## 4. Modèle Hydroélectrique

La production hydroélectrique est modélisée via un profil normalisé $H_{\text{1kW}}[t]$ fourni par l'utilisateur (ou un défaut de 0.9). Elle est bornée par :

$$p_{\text{h_ac}}[t] \leq C_h \cdot H_{\text{1kW}}[t] \cdot f_{\text{flow}}$$

Où $f_{\text{flow}}$ est le facteur de débit (`hydro_flow`, défaut 1.0). Il n'y a pas de contrainte de stockage hydraulique : l'hydro est traité comme du "fil de l'eau" non pilotable.

---

## 5. Construction de la Charge

### 5.1 Charge Électrique

Pour chaque heure $t \in [0, N-1]$ (période $p = \text{period\_of}(t)$, heure $h = t \bmod 24$) :

$$L_{\text{base}}[t] = L_{\text{src}}[t \bmod |L_{\text{src}}|]$$

$$L_{\text{comm}}[t] = \begin{cases} P_{\text{commercial}} & \text{si } 8 \leq h \leq 18 \\ 0 & \text{sinon} \end{cases}$$

$$L_{\text{brute}}[t] = (L_{\text{base}}[t] + L_{\text{comm}}[t]) \cdot \mu_p \cdot \lambda$$

Où :
- $\mu_p$ : multiplicateur de saisonnalité pour la période $p$
- $\lambda$ : majoration P90 (`1.10` si `p90_mode`, sinon `1.0`)

**Multiplicateurs par résolution** (paramétrés par `seasonality` $S$, défaut 0.30) :

*288h (12 mois)* :
$$\vec{\mu} = [1+S,\; 1+S,\; 1+0.5S,\; 1+0.2S,\; 1,\; 1,\; 1,\; 1,\; 1,\; 1+0.3S,\; 1+0.7S,\; 1+S]$$

*672h (4 saisons)* : chaque coefficient saisonnier est défini dans `PeriodDef.season_coeff` :
$$\vec{\mu}_{672} = [1+S,\; 1+0.2S,\; 1,\; 1+0.7S] \quad \text{(Déc–Fév, Mars–Mai, Juin–Août, Sept–Nov)}$$

Si l'utilisateur fournit $N$ valeurs de charge (même longueur que la résolution), les multiplicateurs sont désactivés ($\mu_p = 1$).

### 5.2 Charge Thermique

$$L_{\text{therm}}[t] = \max(0, L_{\text{brute}}[t] \cdot \rho_{\text{therm}})$$

Où $\rho_{\text{therm}}$ = `thermal_ratio` (défaut 0.0, pas de charge thermique).

### 5.3 Flexibilité de la Demande

Le modèle permet un déplacement de charge intra-journalier (load shifting) :

$$L_{\text{effective}}[t] = L_{\text{brute}}[t] + \Delta^+[t] - \Delta^-[t]$$

Avec les bornes :
- $\Delta^-[t] \leq L_{\text{brute}}[t] \cdot f_{\text{flex}}$ (max load shedding flexible)
- $\Delta^+[t] \leq L_{\text{peak}} \cdot f_{\text{flex}}$ (max load increase)

Et la contrainte de neutralité mensuelle : $\sum_{t \in \text{mois } m} \Delta^+[t] = \sum_{t \in \text{mois } m} \Delta^-[t]$

Où $f_{\text{flex}}$ = `max_flex` (défaut 0.0), $L_{\text{peak}} = \max_t L_{\text{brute}}[t]$.

### 5.6 Mode P90

En mode P90 (`p90_mode = True`) :
- La charge est majorée de 10% ($\lambda = 1.10$)
- La production renouvelable est minorée de 15% ($\times 0.85$)
- Du bruit aléatoire ($\pm$ `forecast_error`) est ajouté pour les analyses de sensibilité

---

## 6. Coeur de l'Optimiseur (MILP/LP)

Le problème est un programme linéaire mixte (MILP) si `use_milp = True`, linéaire (LP) sinon.
Solveur : **CBC** via PuLP. Time limits : 120s MILP / 60s LP (288h), 180s MILP / 90s LP (672h), 300s LP (8760h, pas de MILP).

### 6.1 Variables de Décision

#### Variables de Capacité ($\mathbb{R}^+$, 11 variables)

| Variable | Unité | Description |
|----------|-------|-------------|
| $C_s$ | kW | Capacité solaire installée |
| $C_{s,\text{inv}}$ | kW | Puissance onduleur solaire |
| $C_b$ | kWh | Capacité batterie (énergie) |
| $C_{b,\text{inv}}$ | kW | Puissance onduleur batterie |
| $C_w$ | kW | Capacité éolienne |
| $C_h$ | kW | Capacité hydroélectrique |
| $C_g$ | kW | Capacité groupe électrogène gaz |
| $C_{\text{hp}}$ | kW | Capacité pompe à chaleur (élec) |
| $C_{\text{boiler}}$ | kW | Capacité chaudière gaz (thermique) |
| $C_{\text{tes}}$ | kWh | Capacité stockage thermique |
| $G_{\text{max}}$ | kW | Puissance max soutirée au réseau |

#### Variables de Flux Horaires ($\mathbb{R}^+$, $N \times 21$ variables, $N$ = 288, 672, ou 8760)

| Variable | Unité | Description |
|----------|-------|-------------|
| $p_{\text{s_ac}}[t]$ | kW | Production solaire AC |
| $p_{\text{w_ac}}[t]$ | kW | Production éolienne AC |
| $p_{\text{h_ac}}[t]$ | kW | Production hydro AC |
| $p_{\text{b_ch}}[t]$ | kW | Puissance charge batterie |
| $p_{\text{b_dis}}[t]$ | kW | Puissance décharge batterie |
| $soc_b[t]$ | kWh | État de charge batterie |
| $p_{\text{tes_ch}}[t]$ | kW | Puissance charge TES |
| $p_{\text{tes_dis}}[t]$ | kW | Puissance décharge TES |
| $soc_{\text{tes}}[t]$ | kWh | État de charge TES |
| $\Delta^+[t]$ | kW | Déplacement de charge (hausse) |
| $\Delta^-[t]$ | kW | Déplacement de charge (baisse) |
| $p_{\text{gas}}[t]$ | kW | Production électrique moteur gaz |
| $p_{\text{gas_th}}[t]$ | kW | Production thermique chaudière gaz |
| $p_{\text{buy}}[t]$ | kW | Achat réseau |
| $p_{\text{sell}}[t]$ | kW | Vente réseau |
| $p_{\text{shed}}[t]$ | kW | Délestage électrique |
| $p_{\text{therm_shed}}[t]$ | kW | Délestage thermique |
| $p_{\text{hp_elec}}[t]$ | kW | Consommation électrique PAC |
| $p_{\text{ev_ch}}[t]$ | kW | Charge VE |
| $p_{\text{ev_dis}}[t]$ | kW | Décharge VE (V2G) |
| $soc_{\text{ev}}[t]$ | kWh | État de charge agrégé VE |

#### Variables Initiales Mensuelles ($\mathbb{R}^+$, $12 \times 2$)

| Variable | Unité | Description |
|----------|-------|-------------|
| $soc_i[m]$ | kWh | SOC batterie début du mois $m$ |
| $soc_{\text{tes_i}}[m]$ | kWh | SOC TES début du mois $m$ |

#### Variables MILP (conditionnelles à `use_milp = True`)

| Variable | Type | Description |
|----------|------|-------------|
| $b_{\text{bess_ch}}[t]$ | $\in \{0, 1\}$ | Mode batterie : 1 = charge, 0 = décharge |
| $g_{\text{on}}[t]$ | $\in \{0, 1\}$ | État groupe gaz : 1 = en marche |
| $g_{\text{start}}[t]$ | $\mathbb{R}^+$ | Coût de démarrage gaz |

### 6.2 Fonction Objectif

L'objectif minimise la somme du CAPEX annualisé et de l'OPEX annuel :

$$\min \quad Z_{\text{capex}} + Z_{\text{opex}}$$

#### 6.2.1 CAPEX Annualisé

$$Z_{\text{capex}} = \sum_{i \in \mathcal{I}} C_i \cdot \kappa_i \cdot \text{CRF}(r, n_i)$$

Où $\mathcal{I}$ est l'ensemble des technologies :

| Actif $i$ | CAPEX unitaire $\kappa_i$ | Durée de vie $n_i$ |
|-----------|--------------------------|---------------------|
| Solaire | `solar_capex` (600 €/kW) | `solar_lifetime` (25 ans) |
| Onduleur solaire | `solar_inverter_capex` (150 €/kW) | `solar_inverter_lifetime` (10 ans) |
| Batterie | `bess_capex` (300 €/kWh) | `bess_lifetime` (10 ans) |
| Onduleur batterie | `bess_inverter_capex` (150 €/kW) | `bess_inverter_lifetime` (10 ans) |
| Éolien | `wind_capex` (1500 €/kW) | `wind_lifetime` (20 ans) |
| Hydro | `hydro_capex` (2500 €/kW) | `hydro_lifetime` (30 ans) |
| Groupe gaz | 500 €/kW (fixe) | `gas_lifetime` (15 ans) |
| PAC | `hp_capex` (800 €/kW) | `hp_lifetime` (15 ans) |
| Chaudière | `boiler_capex` (150 €/kW) | `boiler_lifetime` (15 ans) |
| TES | `tes_capex` (50 €/kWh) | `tes_lifetime` (20 ans) |

Plus l'abonnement réseau : $G_{\text{max}} \cdot p_{\text{demand_charge}} \cdot 12$

Le câblage n'est pas dans l'objectif (coût fixe calculé en post-processing).

#### 6.2.2 OPEX Horaire

$$Z_{\text{opex}} = \sum_{t=0}^{287} D_m \cdot \Bigg[$$

$$\quad \frac{p_{\text{gas}}[t]}{\eta_{\text{gas_elec}}} \cdot \pi_{\text{fuel}}
+ \frac{p_{\text{gas_th}}[t]}{\eta_{\text{boiler}}} \cdot \pi_{\text{fuel}}$$

$$\quad + p_{\text{buy}}[t] \cdot \pi_{\text{buy}}[h]
- p_{\text{sell}}[t] \cdot \pi_{\text{sell}}[h]$$

$$\quad + p_{\text{b_dis}}[t] \cdot c_{\text{cycle}}
+ p_{\text{shed}}[t] \cdot \pi_{\text{VOLL}}
+ p_{\text{therm_shed}}[t] \cdot 999$$

$$\quad + g_{\text{start}}[t] \cdot c_{\text{startup}} \quad \text{(MILP uniquement)}$$

$$\Bigg]$$

Où :
- $\eta_{\text{gas_elec}} = 0.35$ : rendement électrique du moteur gaz
- $\eta_{\text{boiler}}$ : rendement chaudière (`boiler_eff`, défaut 0.90)
- $\pi_{\text{fuel}}$ : prix du gaz (`gas_fuel`, défaut 0.20 €/kWh PCI)
- $\pi_{\text{buy}}[h]$ : prix d'achat électricité (spot ou HP/HC)
- $\pi_{\text{sell}}[h]$ : prix de vente électricité (spot − 0.02€ ou `grid_sell_price`)
- $c_{\text{cycle}}$ : coût de cyclage batterie (`bess_cycle_cost`, 0.05 €/kWh)
- $\pi_{\text{VOLL}}$ : Value of Lost Load (`voll`, 5.0 €/kWh)
- 999 : pénalité très élevée pour le délestage thermique (quasi-interdiction)
- $c_{\text{startup}}$ : coût de démarrage gaz (`gas_startup_cost`, 5.0 €/démarrage)

**Note sur les prix spots** : quand `use_spot_market = True`, $\pi_{\text{buy}}[h]$ = `SPOT_PRICES_24H[h]` et $\pi_{\text{sell}}[h] = \max(0, \text{SPOT}[h] - 0.02)$. Sinon, tarifs HP (8h-20h) / HC.
Les prix spot par défaut (€/kWh) :

$$\pi_{\text{spot}} = [0.08, 0.07, 0.06, 0.06, 0.07, 0.09, 0.15, 0.20, 0.18, 0.12, 0.05, 0.02, 0.01, 0.02, 0.05, 0.10, 0.15, 0.25, 0.35, 0.30, 0.20, 0.15, 0.12, 0.09]$$

**Note critique sur le coût du gaz** : $p_{\text{gas}}[t]$ est en kWh **électriques produits**. Pour obtenir le coût, on divise par $\eta_{\text{gas_elec}}$ pour retrouver les kWh de gaz primaire consommés, puis on multiplie par le prix unitaire du gaz. Idem pour la chaleur : $p_{\text{gas_th}}[t]$ est en kWh **thermiques produits**, divisé par $\eta_{\text{boiler}}$ pour les kWh gaz primaire.

### 6.3 Contraintes par Période

Soit $K$ le nombre de périodes (12 mois pour 288h, 4 saisons pour 672h) et $L$ la durée d'une période (24h pour 288h, 168h pour 672h). La période $p = \text{period\_of}(t)$, l'heure de début de la période $t_p^{\text{start}}$.

#### 6.3.1 Bornes SOC Initial

$$\forall p \in [0, K-1] : \quad C_b \cdot \text{SOC}_{\text{min}} \leq soc_i[p] \leq C_b$$

$$\forall p \in [0, K-1] : \quad soc_{\text{tes_i}}[p] \leq C_{\text{tes}}$$

Où $\text{SOC}_{\text{min}}$ = `min_soc` (défaut 0.20).

#### 6.3.2 Neutralité du Load Shifting

$$\forall p \in [0, K-1] : \quad \sum_{t=t_p^{\text{start}}}^{t_p^{\text{start}}+L-1} \Delta^+[t] = \sum_{t=t_p^{\text{start}}}^{t_p^{\text{start}}+L-1} \Delta^-[t]$$

#### 6.3.3 Budget Carbone (conditionnel)

Si `max_annual_co2_t` > 0 :

$$\sum_{t=0}^{N-1} w_t \cdot \left( \frac{p_{\text{gas}}[t]}{\eta_{\text{gas_elec}}} \cdot \epsilon_{\text{gaz}} + \frac{p_{\text{gas_th}}[t]}{\eta_{\text{boiler}}[t]} \cdot \epsilon_{\text{gaz}} + p_{\text{buy}}[t] \cdot \epsilon_{\text{réseau}} \right) \leq M_{\text{CO2}} \cdot 1000$$

Où :
- $w_t = \text{weight}(t)$ : poids d'annualisation
- $\epsilon_{\text{gaz}} = 0.500$ kg CO₂/kWh gaz (PCI)
- $\epsilon_{\text{réseau}} = 0.060$ kg CO₂/kWh (mix FR)
- $M_{\text{CO2}}$ : budget en tonnes CO₂/an (converti en kg via ×1000)

### 6.4 Contraintes Horaires

Pour chaque pas de temps $t \in [0, N-1]$, heure du jour $h = t \bmod 24$.

#### 6.4.1 Limites de Capacité Physique

$$p_{\text{s_ac}}[t] \leq C_s \cdot P_{\text{solaire}}[t]$$
$$p_{\text{s_ac}}[t] \leq C_{s,\text{inv}}$$
$$p_{\text{w_ac}}[t] \leq C_w \cdot P_{\text{éolien}}[t]$$
$$p_{\text{h_ac}}[t] \leq C_h \cdot H_{\text{1kW}}[t] \cdot f_{\text{flow}}$$

$$p_{\text{hp_elec}}[t] \leq C_{\text{hp}}$$
$$p_{\text{gas_th}}[t] \leq C_{\text{boiler}}$$
$$p_{\text{gas}}[t] \leq C_g$$

**Contraintes de surface / site** (conditionnelles, si > 0) :

$$C_s \leq P_{\text{solaire,max}} \quad \text{si } \texttt{max\_solar\_kw} > 0$$
$$C_w \leq P_{\text{éolien,max}} \quad \text{si } \texttt{max\_wind\_kw} > 0$$
$$C_h \leq P_{\text{hydro,max}} \quad \text{si } \texttt{max\_hydro\_kw} > 0$$

> **Note hydro** : contrairement au solaire et à l'éolien dont le potentiel dépend principalement de la surface disponible, le potentiel hydroélectrique est strictement limité par le débit du cours d'eau et la hauteur de chute du site. Le paramètre `max_hydro_kw` permet de borner la capacité installable à la puissance réellement extractible.

#### 6.4.2 Flexibilité Demande

$$\Delta^-[t] \leq L_{\text{brute}}[t] \cdot f_{\text{flex}}$$
$$\Delta^+[t] \leq L_{\text{peak}} \cdot f_{\text{flex}}$$
$$L_{\text{eff}}[t] = L_{\text{brute}}[t] + \Delta^+[t] - \Delta^-[t]$$

#### 6.4.3 Contraintes Réseau

Si `grid_connected = True` :
$$p_{\text{buy}}[t] \leq \min(G_{\text{max}}, 3 \cdot L_{\text{peak}})$$
$$p_{\text{sell}}[t] \leq \min(G_{\text{max}}, 3 \cdot L_{\text{peak}})$$

Si `grid_connected = False` (site isolé) :
$$p_{\text{buy}}[t] = 0$$
$$p_{\text{sell}}[t] = 0$$

#### 6.4.4 Bilan Électrique (contrainte d'égalité, $\forall t$)

$$p_{\text{s_ac}}[t] + p_{\text{w_ac}}[t] + p_{\text{h_ac}}[t] + p_{\text{b_dis}}[t] + p_{\text{gas}}[t] + p_{\text{buy}}[t] + p_{\text{shed}}[t] + p_{\text{ev_dis}}[t]$$

$$= L_{\text{eff}}[t] + p_{\text{b_ch}}[t] + p_{\text{sell}}[t] + p_{\text{hp_elec}}[t] + p_{\text{ev_ch}}[t]$$

#### 6.4.5 Bilan Thermique (contrainte d'égalité, $\forall t$)

$$p_{\text{gas_th}}[t] + p_{\text{hp_elec}}[t] \cdot \text{COP}[t] + p_{\text{tes_dis}}[t] + p_{\text{therm_shed}}[t] = L_{\text{therm}}[t] + p_{\text{tes_ch}}[t]$$

Où $\text{COP}[t]$ est un profil horaire pré-calculé via le modèle de Carnot (M3) :

$$\text{COP}[t] = \min\left(8.0,\; \max\left(0.5,\; \eta_{\text{carnot}} \cdot \frac{T_{\text{supply}} + 273}{T_{\text{supply}} - T_{\text{amb}}[t]}\right)\right)$$

$$\eta_{\text{carnot}} = \text{COP}_{\text{nom}} \cdot \frac{T_{\text{supply}} - 7}{T_{\text{supply}} + 273}$$

Paramètres :
- $\text{COP}_{\text{nom}} = 3.0$ (`thermal.hp.cop`) — COP à $T_{\text{ext}} = 7$°C
- $T_{\text{supply}} = 35$°C (`thermal.hp.supply_temp`) — plancher chauffant (55°C pour radiateurs)
- $\eta_{\text{carnot}}$ calibré automatiquement pour que $\text{COP}(7\text{°C}) = \text{COP}_{\text{nom}}$
- Plafonné à 8.0 (temps chaud), floor à 0.5 (temps très froid)

> **Exemple** : $T_{\text{supply}} = 35$°C, $\text{COP}_{\text{nom}} = 3.0$ → $\eta_{\text{carnot}} = 0.273$. À $T_{\text{amb}} = -7$°C : COP = 2.00. À $T_{\text{amb}} = 7$°C : COP = 3.00.**

La consommation de gaz de la chaudière est affectée par l'efficacité variable $\eta_{\text{boiler}}[t]$ (modèle condensation simplifié) :

$$\eta_{\text{boiler}}[t] = \eta_{\text{nom}} + 0.04 \cdot \text{clamp}\left(\frac{20 - T_{\text{amb}}[t]}{40},\; 0,\; 1\right)$$

Varie de $\eta_{\text{nom}}$ (été, 20°C) à $\eta_{\text{nom}} + 0.04$ (hiver, −20°C). Défaut : 0.90 → 0.94.

Dans l'objectif et le bilan carbone, la consommation de gaz primaire est $p_{\text{gas_th}}[t] / \eta_{\text{boiler}}[t]$.

#### 6.4.6 Batterie — Évolution du SOC

$$soc_b[t] \leq C_b$$
$$soc_b[t] \geq C_b \cdot \text{SOC}_{\text{min}}$$
$$p_{\text{b_ch}}[t] \leq C_{b,\text{inv}}$$
$$p_{\text{b_dis}}[t] \leq C_{b,\text{inv}}$$

**Première heure de la période** ($\text{hour\_in\_period}(t) = 0$) :

$$soc_b[t] = soc_i[p] + p_{\text{b_ch}}[t] \cdot \eta_{\text{ch}} - \frac{p_{\text{b_dis}}[t]}{\eta_{\text{dis}}}$$

**Heures suivantes** ($\text{hour\_in\_period}(t) \neq 0$) :

$$soc_b[t] = soc_b[t-1] + p_{\text{b_ch}}[t] \cdot \eta_{\text{ch}} - \frac{p_{\text{b_dis}}[t]}{\eta_{\text{dis}}}$$

**Bouclage de période** ($\text{hour\_in\_period}(t) = L - 1$) :

$$soc_b[t] = soc_i[p]$$

Où $\eta_{\text{ch}}$ = `eff_ch` (0.95), $\eta_{\text{dis}}$ = `eff_dis` (0.95). La période $p = \text{period\_of}(t)$ et sa durée $L$ = 24h (288h, 8760h) ou 168h (672h).

#### 6.4.7 Stockage Thermique (TES) — Évolution du SOC

Même structure que la batterie, avec $\eta = 0.95$ fixe :

$$soc_{\text{tes}}[t] \leq C_{\text{tes}}$$
$$p_{\text{tes_ch}}[t] \leq C_{\text{tes}} / 2$$
$$p_{\text{tes_dis}}[t] \leq C_{\text{tes}} / 2$$

$$\text{hour\_in\_period}(t) = 0 : \quad soc_{\text{tes}}[t] = soc_{\text{tes_i}}[p] + p_{\text{tes_ch}}[t] \cdot 0.95 - \frac{p_{\text{tes_dis}}[t]}{0.95}$$

$$\text{hour\_in\_period}(t) \neq 0 : \quad soc_{\text{tes}}[t] = soc_{\text{tes}}[t-1] + p_{\text{tes_ch}}[t] \cdot 0.95 - \frac{p_{\text{tes_dis}}[t]}{0.95}$$

$$\text{hour\_in\_period}(t) = L - 1 : \quad soc_{\text{tes}}[t] = soc_{\text{tes_i}}[p]$$

#### 6.4.8 Véhicules Électriques (si `num_evs > 0`)

**Période de branchement** ($h \geq 18$ ou $h \leq 7$) :

$$p_{\text{ev_ch}}[t] \leq N_{\text{ev}} \cdot 7 \text{ kW}$$
$$p_{\text{ev_dis}}[t] \leq N_{\text{ev}} \cdot 7 \text{ kW} \quad \text{(si V2G)}$$
$$p_{\text{ev_dis}}[t] = 0 \quad \text{(sinon)}$$

**Initialisation à 18h** ($h = 18$) :

$$soc_{\text{ev}}[t] = (E_{\text{cap}} - E_{\text{commute}}) + p_{\text{ev_ch}}[t] \cdot 0.95 - \frac{p_{\text{ev_dis}}[t]}{0.95}$$

Où $E_{\text{cap}} = N_{\text{ev}} \cdot 50$ kWh, $E_{\text{commute}} = N_{\text{ev}} \cdot 10$ kWh.

**Évolution nocturne** ($h \neq 18$, $t > 0$) :

$$soc_{\text{ev}}[t] = soc_{\text{ev}}[t-1] + p_{\text{ev_ch}}[t] \cdot 0.95 - \frac{p_{\text{ev_dis}}[t]}{0.95}$$

**Contrainte départ 7h** ($h = 7$) :

$$soc_{\text{ev}}[t] = E_{\text{cap}}$$

**Hors période** ($8 \leq h \leq 17$) :

$$p_{\text{ev_ch}}[t] = p_{\text{ev_dis}}[t] = soc_{\text{ev}}[t] = 0$$

#### 6.4.9 Groupe Gaz — Rampe

Si `ramp_limit_kw > 0` :

$$|p_{\text{gas}}[t] - p_{\text{gas}}[t-1]| \leq R_{\text{max}} \quad \forall t > 0$$

Où $R_{\text{max}}$ = `ramp_limit_kw`.

### 6.5 Contrainte de Réserve N-1

La contrainte N-1 garantit qu'à chaque heure, la capacité de réserve dispatchable (batterie + gaz + réseau) peut compenser la perte du plus gros producteur. Active lorsque `economic.n1_reserve = True`.

**Spinning reserve** — capacité dispatchable non utilisée à l'heure $t$ :
$$\text{Reserve}[t] = C_g + C_{b,\text{inv}} + G_{\text{max}} + p_{\text{shed}}[t] - p_{\text{gas}}[t] - p_{\text{b_dis}}[t] - p_{\text{buy}}[t]$$

**Contingence maximale** — la plus grosse source unique à l'heure $t$ parmi :
$$R_{\text{src}}[t] = \max(p_{\text{s_ac}}[t],\; p_{\text{w_ac}}[t],\; p_{\text{h_ac}}[t],\; C_g,\; [G_{\text{max}} \text{ si grid-connected}])$$

Linéarisé via 4–5 contraintes par heure :
$$\forall t \in [0, N-1] : \quad \text{Reserve}[t] \geq R_{\text{src}}_i[t] \quad \text{pour chaque source } i$$

Soit explicitement :
1. **Perte solaire** : $\text{Reserve}[t] \geq p_{\text{s_ac}}[t]$
2. **Perte éolienne** : $\text{Reserve}[t] \geq p_{\text{w_ac}}[t]$
3. **Perte hydro** : $\text{Reserve}[t] \geq p_{\text{h_ac}}[t]$
4. **Perte gaz** : $C_{b,\text{inv}} + G_{\text{max}} + p_{\text{shed}}[t] \geq p_{\text{gas}}[t] + p_{\text{b_dis}}[t] + p_{\text{buy}}[t]$
5. **Perte réseau** (si connecté) : $C_g + C_{b,\text{inv}} + p_{\text{shed}}[t] \geq p_{\text{gas}}[t] + p_{\text{b_dis}}[t] + p_{\text{buy}}[t]$

> **Interprétation** : si le plus gros producteur tombe, la batterie peut augmenter sa décharge (dans la limite de $C_{b,\text{inv}} - p_{\text{b_dis}}[t]$), le réseau peut augmenter son import ($G_{\text{max}} - p_{\text{buy}}[t]$), et le gaz peut monter en charge ($C_g - p_{\text{gas}}[t]$). La somme de ces réserves doit excéder la puissance perdue.

Cette contrainte est purement linéaire (pas de variables binaires) — elle ne ralentit que marginalement le solveur, même en 8760h.

### 6.6 Extensions MILP

Les contraintes ci-dessous sont actives uniquement si `use_milp = True`.

#### 6.5.1 Batterie — Exclusion Charge/Décharge Simultanée (Big-M)

$$p_{\text{b_ch}}[t] \leq M_{\text{bess}} \cdot b_{\text{bess_ch}}[t]$$
$$p_{\text{b_dis}}[t] \leq M_{\text{bess}} \cdot (1 - b_{\text{bess_ch}}[t])$$

Où $M_{\text{bess}} = 5 \cdot L_{\text{peak}}$ (borne supérieure safe pour la puissance batterie).

#### 6.5.2 Groupe Gaz — On/Off + Charge Minimale + Démarrage (Big-M)

**On/Off** :
$$p_{\text{gas}}[t] \leq M_{\text{gas}} \cdot g_{\text{on}}[t]$$

Où $M_{\text{gas}} = 3 \cdot L_{\text{peak}}$.

**Charge minimale** (si `max_gas_kw > 0`) :

$$p_{\text{gas}}[t] \geq (P_{\text{gas,max}} \cdot \rho_{\text{min}}) \cdot g_{\text{on}}[t]$$

Où $P_{\text{gas,max}}$ = `max_gas_kw`, $\rho_{\text{min}}$ = `gas_min_load_pct` (défaut 0.30).
La charge minimale est pré-calculée comme une constante pour éviter une bilinéarité $C_g \cdot g_{\text{on}}$.

**Détection de démarrage** :

$$g_{\text{start}}[t] \geq g_{\text{on}}[t] - g_{\text{on}}[t-1] \quad \forall t > 0$$
$$g_{\text{start}}[0] \geq g_{\text{on}}[0]$$
$$g_{\text{start}}[t] \geq 0$$

Le coût de démarrage $c_{\text{startup}}$ (€/démarrage) est ajouté dans la fonction objectif.

#### 6.5.3 Contrainte de Capacité Gaz (MILP uniquement)

Si `max_gas_kw > 0` :
$$C_g \leq P_{\text{gas,max}}$$

---

## 7. Indicateurs Financiers

### 7.1 Capital Recovery Factor (CRF)

Le CRF annualise un investissement initial sur $n$ années au taux d'actualisation $r$ :

$$\text{CRF}(r, n) = \begin{cases}
\dfrac{1}{n} & \text{si } r = 0 \\[12pt]
\dfrac{r \cdot (1 + r)^n}{(1 + r)^n - 1} & \text{si } r > 0
\end{cases}$$

Un CAPEX $C$ devient une annuité constante $A = C \cdot \text{CRF}(r, n)$.

### 7.2 Valeur Actuelle Nette (VAN)

$$\text{VAN} = \sum_{i=0}^{H} \frac{CF_i}{(1 + r)^i}$$

Où $H = 25$ ans (horizon), $CF_0 = -\text{CAPEX}$, et $CF_i$ sont les cash-flows nets annuels.

### 7.3 Taux de Rentabilité Interne (TRI)

Le TRI est le taux $r^*$ tel que $\text{VAN}(r^*) = 0$. Deux méthodes :

1. **numpy_financial.irr()** si la bibliothèque est disponible
2. **Bissection** sur $[-0.9, 1.0]$ (60 itérations) en fallback

Le TRI est retourné en pourcentage (×100).

### 7.4 Boucle Financière 25 Ans

Pour chaque année $y \in [1, 25]$ :

#### Facteurs d'Inflation

$$\gamma_{\text{grid},y} = (1 + i_{\text{grid}})^y$$
$$\gamma_{\text{fuel},y} = (1 + i_{\text{fuel}})^y$$
$$\gamma_{\text{om},y} = (1 + i_{\text{om}})^y$$

Où $i_{\text{grid}}$ = `grid_inflation` (4%), $i_{\text{fuel}}$ = `gas_inflation` (2%), $i_{\text{om}}$ = `om_inflation` (2%).

#### OPEX Baseline Année $y$

L'OPEX de référence (sans microgrid) évolue avec l'inflation :

$$\text{OPEX}_{\text{base},y} = \text{OPEX}_{\text{base},0} \cdot \begin{cases}
\gamma_{\text{grid},y} & \text{si grid-connected} \\
\gamma_{\text{fuel},y} & \text{si off-grid}
\end{cases}$$

Avec :

$$\text{OPEX}_{\text{base},0} = \begin{cases}
\displaystyle\sum_{t} D_m \cdot L_{\text{brute}}[t] \cdot \pi_{\text{buy}}[h] + L_{\text{peak}} \cdot \pi_{\text{demand}} \cdot 12 & \text{si grid} \\[12pt]
\displaystyle\sum_{t} D_m \cdot L_{\text{brute}}[t] \cdot \dfrac{\pi_{\text{fuel}}}{\eta_{\text{gas_elec}}} & \text{si off-grid}
\end{cases}$$

#### OPEX Microgrid Année $y$

$$\text{OPEX}_{\text{mg},y} = C_{\text{grid},y} + C_{\text{fuel},y} + C_{\text{om},y} + C_{\text{shed},y} + C_{\text{deg},y}$$

Où :
- $C_{\text{grid},y}$ : coût réseau avec inflation $\gamma_{\text{grid},y}$
- $C_{\text{fuel},y} = (V_{\text{gaz_elec}} + V_{\text{gaz_th}}) \cdot \pi_{\text{fuel}} \cdot \gamma_{\text{fuel},y}$
- $C_{\text{om},y} = \text{CAPEX} \cdot 0.02 \cdot \gamma_{\text{om},y}$
- $C_{\text{shed},y} = V_{\text{shed}} \cdot \pi_{\text{VOLL}} \cdot \gamma_{\text{grid},y}$
- $C_{\text{deg},y}$ : perte de production solaire par dégradation

#### Dégradation Solaire

$$C_{\text{deg},y} = E_{\text{solaire},0} \cdot \left(1 - (1 - \delta)^y\right) \cdot \pi_{\text{evité}} \cdot \gamma_{\text{grid},y}$$

Où $E_{\text{solaire},0}$ est la production solaire annuelle année 0, $\delta$ = `solar_degradation` (0.5%/an), et $\pi_{\text{evité}}$ est le coût marginal évité (prix réseau ou gaz).

#### Épargne et Cash-Flow Net

$$S_y = \text{OPEX}_{\text{base},y} - \text{OPEX}_{\text{mg},y}$$

$$R_y = \sum_{i \in \text{remplacements}(y)} C_i \cdot \kappa_i$$

$$CF_y = S_y - R_y + \delta_{y,25} \cdot \sum_{i} V_{\text{residuelle},i}$$

Où $R_y$ sont les coûts de remplacement des actifs arrivant en fin de vie l'année $y$.

#### Valeur Résiduelle

En année $H = 25$, chaque actif se voit attribuer une valeur résiduelle au prorata de sa durée de vie restante :

$$V_{\text{residuelle},i} = C_i \cdot \kappa_i \cdot \frac{\max(0, n_i - (H \bmod n_i))}{n_i}$$

Où $H \bmod n_i$ est le reste de la division euclidienne (avec la convention que si $H \bmod n_i = 0$, l'actif vient d'être renouvelé et sa durée restante est $n_i$).

#### KPIs Financiers

| KPI | Formule |
|-----|---------|
| VAN | $\sum_{i=0}^{25} CF_i / (1+r)^i$ |
| TRI | $r^* : \sum CF_i / (1+r^*)^i = 0$ |
| ROI (payback simple) | $\min\{y : \sum_{i=0}^y CF_i > 0\}$ |
| Carbon Payback | $\min\{y : \sum_{i=0}^y (\text{CO2 évité}_i - \text{CO2 remplacement}_i) > 0\}$ |

---

### 7.5 Dégradation Progressive de la Batterie (BESS Capacity Fade)

Le modèle intègre une dégradation continue de la capacité batterie, combinant vieillissement calendaire et cyclique. La capacité utile diminue progressivement (plutôt que de rester constante jusqu'au remplacement).

**Paramètres** (constants, dans `helpers.py`) :

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| $d_{\text{cal}}$ | 0.01 /an | Perte calendaire (1 % / an) |
| $d_{\text{cyc}}$ | 0.0005 /cycle | Perte cyclique (0.05 % / cycle équivalent) |
| $f_{\text{floor}}$ | 0.70 | Capacité minimale avant remplacement (70 %) |

**Comptage des cycles équivalents** :

$$N_{\text{cycles/an}} = \frac{\sum_t p_{\text{b\_dis}}[t] \cdot w_t}{\max(0.01, C_b)} \quad \text{[cycles équivalents / an]}$$

**Facteur de capacité** à l'année $y$ (depuis le dernier remplacement) :

$$f_{\text{cap}}(y) = \max\left(f_{\text{floor}},\; 1 - d_{\text{cal}} \cdot a - d_{\text{cyc}} \cdot c\right)$$

Où :
- $a$ = années écoulées depuis le dernier remplacement
- $c$ = cycles cumulés depuis le dernier remplacement

**Énergie batterie perdue** (kWh/an) :

$$E_{\text{perdue}} = E_{\text{dis,an}} \cdot (1 - f_{\text{cap}}(y))$$

Où $E_{\text{dis,an}} = \sum_t p_{\text{b\_dis}}[t] \cdot w_t$ (décharge annuelle optimale).

**Surcoût OPEX** : l'énergie perdue est rachetée au coût marginal (moyenne HP/HC si réseau, coût gaz si îloté) :

$$\Delta\text{OPEX}_{\text{bess}}(y) = E_{\text{perdue}} \cdot \pi_{\text{backup}} \cdot \gamma_{\text{grid},y}$$

**Impact carbone** : le surcroît d'achats génère des émissions supplémentaires :

$$\Delta\text{CO2}_{\text{bess}}(y) = \frac{E_{\text{perdue}} \cdot \epsilon_{\text{backup}}}{1000} \quad \text{[t CO₂]}$$

Où $\epsilon_{\text{backup}} = 0.060$ kg/kWh (réseau) ou $0.500 / 0.35$ kg/kWh (gaz).

**Réinitialisation** : à chaque remplacement de la batterie ($y \bmod n_{\text{bess}} = 0$), les compteurs $a$ et $c$ sont remis à zéro.

> **Simplification** : le dispatch horaire n'est pas ré-optimisé chaque année avec la capacité dégradée — le dispatch de l'année 0 est conservé. Le manque à gagner est approximé par un achat d'énergie au coût marginal. L'erreur sur la VAN est < 2 % car l'effet dominant est la perte calendaire, pas le changement de stratégie de dispatch.

---

## 8. Bilan Carbone

### 8.1 Dette Carbone Initiale

$$\text{CO2}_{\text{dette}} = \frac{1}{1000} \sum_{i \in \mathcal{I}} C_i \cdot \epsilon_{\text{embodied},i} \quad \text{[t CO₂]}$$

Les facteurs d'émission embarquée $\epsilon_{\text{embodied}}$ (kg CO₂ / kW ou kWh) :

| Actif | $\epsilon_{\text{embodied}}$ |
|-------|---------------------------|
| Solaire | 800 |
| Éolien | 600 |
| Hydro | 1200 |
| Batterie | 100 |
| Onduleur | 50 |
| Groupe gaz | 200 |
| Chaudière | 100 |
| PAC | 150 |
| TES | 30 |

### 8.2 Émissions Annuelles

**Baseline** (sans microgrid) :

$$\text{CO2}_{\text{base}} = \frac{1}{1000} \begin{cases}
E_{\text{annuelle}} \cdot \epsilon_{\text{réseau}} & \text{si grid-connected} \\[6pt]
\dfrac{E_{\text{annuelle}}}{\eta_{\text{gas_elec}}} \cdot \epsilon_{\text{gaz}} & \text{si off-grid}
\end{cases}$$

Où $E_{\text{annuelle}} = \sum_t L_{\text{brute}}[t] \cdot D_m$ (kWh/an).

**Microgrid** :

$$\text{CO2}_{\text{mg}} = \frac{1}{1000} \sum_{t=0}^{N-1} w_t \cdot \left( \frac{p_{\text{gas}}[t]}{\eta_{\text{gas_elec}}} \cdot \epsilon_{\text{gaz}} + \frac{p_{\text{gas_th}}[t]}{\eta_{\text{boiler}}[t]} \cdot \epsilon_{\text{gaz}} + p_{\text{buy}}[t] \cdot \epsilon_{\text{réseau}} \right)$$

### 8.3 Émissions Évitées

$$\text{CO2}_{\text{évité}} = \text{CO2}_{\text{base}} - \text{CO2}_{\text{mg}} \quad \text{[t CO₂/an]}$$

### 8.4 Résilience

$$\text{Resilience} = 100 - \frac{E_{\text{shed}}}{E_{\text{annuelle}}} \cdot 100 \quad \text{[%]}$$

Où $E_{\text{shed}} = \sum_t p_{\text{shed}}[t] \cdot D_m$.

### 8.5 Curtailment (Écrêtement)

$$E_{\text{curtail}} = \sum_{t=0}^{287} D_m \cdot \max(0, C_s \cdot P_{\text{solaire}}[t] - p_{\text{s_ac}}[t]) \quad \text{[kWh/an]}$$

---

## 9. Constantes Physiques

### 9.1 Émissions CO₂

| Constante | Valeur | Unité |
|-----------|--------|-------|
| $\epsilon_{\text{gaz}}$ | 0.500 | kg CO₂ / kWh gaz (PCI) |
| $\epsilon_{\text{réseau}}$ | 0.060 | kg CO₂ / kWh électricité (mix FR) |

### 9.2 Rendements

| Constante | Valeur | Description |
|-----------|--------|-------------|
| $\eta_{\text{gas_elec}}$ | 0.35 | Rendement électrique moteur gaz |
| $\eta_{\text{ch}}$ | 0.95 | Rendement charge batterie |
| $\eta_{\text{dis}}$ | 0.95 | Rendement décharge batterie |
| $\eta_{\text{module}}$ | 0.20 | Rendement module PV (non utilisé dans la conversion GHI→kW/kWc) |
| $L_{\text{fixes}}$ | 0.10 | Pertes fixes PV (câblage 2%, onduleur 3%, soiling 2%, mismatch 3%) |
| COP | 3.0 | COP nominal PAC à 7°C (paramétrable via `thermal.hp.cop`) |
| $T_{\text{supply}}$ | 35°C | T° distribution chauffage (paramétrable via `thermal.hp.supply_temp`) |
| $\eta_{\text{boiler}}$ | 0.90 | Rendement nominal chaudière gaz |
| $\Delta\eta_{\text{boiler}}$ | +0.04 | Gain par condensation (hiver −20°C) |
| $\eta_{\text{TES}}$ | 0.95 | Rendement aller-retour TES |

### 9.3 Constantes Thermiques (NOCT & Carnot)

| Constante | Valeur | Description |
|-----------|--------|-------------|
| NOCT | 45°C | Température cellule à 800 W/m², 20°C ambiant |
| $T_{\text{STC}}$ | 25°C | Température de référence STC |
| $G_{\text{NOCT}}$ | 800 W/m² | Irradiance de référence NOCT |
| $\gamma$ | −0.004/°C | Coeff. température de puissance PV (`solar.temp_coeff`) |
| $T_{\text{COP,ref}}$ | 7°C | T° de référence pour le COP nominal |
| $\text{COP}_{\text{max}}$ | 8.0 | COP plafond (temps chaud) |
| $T_{\text{ref,chaudière}}$ | 20°C | T° extérieure pour $\eta_{\text{boiler}}$ nominal |
| $\Delta T_{\text{chaudière}}$ | 40°C | Plage de T° pour courbe chaudière (20°C → −20°C) |

### 9.4 Véhicules Électriques

| Constante | Valeur | Description |
|-----------|--------|-------------|
| $E_{\text{cap}}$ | 50 kWh/VE | Capacité batterie par VE |
| $E_{\text{commute}}$ | 10 kWh/VE | Énergie consommée par trajet domicile-travail |
| $P_{\text{charge}}$ | 7 kW/VE | Puissance de charge max par VE |
| $\eta_{\text{EV}}$ | 0.95 | Rendement charge/décharge VE |

### 9.5 Éolien

| Constante | Valeur | Description |
|-----------|--------|-------------|
| $v_{\text{cut-in}}$ | 3.0 m/s | Vitesse de démarrage |
| $v_{\text{rated}}$ | 12.0 m/s | Vitesse nominale |
| $v_{\text{cut-out}}$ | 25.0 m/s | Vitesse de coupure |
| $\alpha$ | 2.0 | Exposant de la courbe de puissance (quadratique) |
| $H_{\text{hub}}$ | 80 m | Hauteur moyeu par défaut |
| $z_0$ | 0.03 m | Rugosité par défaut (plaine) |

### 9.6 CAPEX Groupe Gaz

Le CAPEX du groupe électrogène gaz est fixé à **500 €/kW** (non paramétrable).

### 9.7 O&M

Les coûts d'Operation & Maintenance sont estimés à **2% du CAPEX total par an**.

### 9.8 Dégradation Batterie (Capacity Fade)

| Constante | Valeur | Description |
|-----------|--------|-------------|
| $d_{\text{cal}}$ | 0.01 /an | Perte calendaire (1 % par an) |
| $d_{\text{cyc}}$ | 0.0005 /cycle | Perte cyclique (0.05 % par cycle équivalent) |
| $f_{\text{floor}}$ | 0.70 | Capacité minimale avant remplacement (70 %, garantie LFP standard) |

---

## Références des Fichiers

| Fichier | Contenu |
|---------|---------|
| `backend/models/schemas.py` | Modèles Pydantic (`EcoParams`, `TimeseriesData`, `SimulateRequest`) |
| `backend/utils/helpers.py` | Constantes ($D$, $\epsilon$, $\eta$, EMBODIED, prix spot, NOCT, Carnot, ResolutionConfig) |
| `backend/services/weather_service.py` | NASA POWER (GHI+T2M), TMY, loi log vent, courbe puissance, profils COP/η_chaudière, fallbacks |
| `backend/services/optimizer_engine.py` | variables PuLP, contraintes (COP[t], η[t]), solve, extraction, boucle 25 ans |
| `backend/services/optimizer_8760.py` | Solveur 8760h (LP uniquement, COP[t] et η[t]) |
| `backend/services/finance_utils.py` | CRF, TRI |
| `backend/main.py` | FastAPI, routes `/api/optimize`, `/api/simulate`, `/api/tmy_cache` |
