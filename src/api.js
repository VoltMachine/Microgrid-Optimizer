import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/',
  timeout: 420_000, // 7 min — couvre le pire cas 8760h (météo 60s + solve 300s)
  headers: { 'Content-Type': 'application/json' },
});

export async function optimizeMicrogrid({ params, load, lat, lon }) {
  const payload = {
    params,
    load: load ?? [],
    wind_1kw: [],
    hydro_1kw: [],
    lat,
    lon,
  };
  const { data } = await client.post('/api/optimize', payload);
  return data;
}

export async function simulateMicrogrid({ params, load, lat, lon, caps }) {
  const payload = {
    params,
    load: load ?? [],
    wind_1kw: [],
    hydro_1kw: [],
    lat,
    lon,
    solar_kw: caps.solar_kw ?? 0,
    solar_inv_kw: caps.solar_inv_kw ?? 0,
    wind_kw: caps.wind_kw ?? 0,
    hydro_kw: caps.hydro_kw ?? 0,
    bess_kwh: caps.bess_kwh ?? 0,
    bess_kw: caps.bess_kw ?? 0,
    gas_kw: caps.gas_kw ?? 0,
    hp_kw: caps.hp_kw ?? 0,
    boiler_kw: caps.boiler_kw ?? 0,
    tes_kwh: caps.tes_kwh ?? 0,
    grid_kw: caps.grid_kw ?? 0,
  };
  const { data } = await client.post('/api/simulate', payload);
  return data;
}
