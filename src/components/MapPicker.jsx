import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ───────────────────────────────────────────────────────────────────────────
// Marker stylé émeraude (SVG inline → divIcon, contourne les soucis bundler)
// ───────────────────────────────────────────────────────────────────────────
const PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 24 30" fill="none">
  <defs>
    <filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="rgba(0,0,0,0.4)"/>
    </filter>
  </defs>
  <path d="M12 0C5.4 0 0 5.4 0 12c0 8.8 12 18 12 18s12-9.2 12-18C24 5.4 18.6 0 12 0z"
        fill="#2563eb" stroke="white" stroke-width="2" filter="url(#pinShadow)"/>
  <circle cx="12" cy="12" r="4.2" fill="white"/>
</svg>
`;

const emeraldIcon = L.divIcon({
  html: PIN_SVG,
  className: 'cust-marker',
  iconSize: [34, 42],
  iconAnchor: [17, 42],
});

// ───────────────────────────────────────────────────────────────────────────
// Helpers internes
// ───────────────────────────────────────────────────────────────────────────
function ClickHandler({ onLocationChange }) {
  useMapEvents({
    click(e) {
      onLocationChange({ lat: +e.latlng.lat.toFixed(4), lon: +e.latlng.lng.toFixed(4) });
    },
  });
  return null;
}

function ExternalSync({ location }) {
  const map = useMap();
  useEffect(() => {
    map.setView([location.lat, location.lon], map.getZoom(), { animate: true });
  }, [location.lat, location.lon, map]);
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// Composant principal
// ───────────────────────────────────────────────────────────────────────────
export default function MapPicker({ location, onChange, darkMode }) {
  const tileUrl = darkMode
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  return (
    <div className="rounded-xl overflow-hidden border border-ink-200 dark:border-ink-700 shadow-card relative">
      <MapContainer
        center={[location.lat, location.lon]}
        zoom={4}
        scrollWheelZoom
        style={{ height: 200, width: '100%', background: darkMode ? '#0f172a' : '#f1f5f9' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap'
          url={tileUrl}
          subdomains="abcd"
          maxZoom={19}
        />
        <Marker
          position={[location.lat, location.lon]}
          icon={emeraldIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const m = e.target.getLatLng();
              onChange({ lat: +m.lat.toFixed(4), lon: +m.lng.toFixed(4) });
            },
          }}
        />
        <ClickHandler onLocationChange={onChange} />
        <ExternalSync location={location} />
      </MapContainer>

      {/* Légende coordonnées */}
      <div className="absolute bottom-2 left-2 z-[400] flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/90 dark:bg-ink-900/90 backdrop-blur border border-ink-200/60 dark:border-ink-700 shadow-sm pointer-events-none">
        <span className="text-[10px] font-mono text-ink-700 dark:text-ink-200">
          {location.lat.toFixed(2)}°, {location.lon.toFixed(2)}°
        </span>
      </div>
    </div>
  );
}
