import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  tone?: "primary" | "success" | "danger" | "muted";
  label?: string;
  draggable?: boolean;
}

export interface MapCircle {
  id: string;
  lat: number;
  lng: number;
  radius: number;
  tone?: "primary" | "success" | "danger" | "muted";
}

export type TileTheme = "osm" | "dark" | "voyager";

interface LocationMapProps {
  markers?: MapMarker[];
  circles?: MapCircle[];
  onPick?: (lat: number, lng: number) => void;
  className?: string;
  style?: React.CSSProperties;
  center?: [number, number] | undefined;
  zoom?: number;
  fit?: boolean;
  tileTheme?: TileTheme;
  interactive?: boolean;
  showControls?: boolean;
}

const TONE_COLOR: Record<string, string> = {
  primary: "#0284c7",
  success: "#059669",
  danger: "#e11d48",
  muted: "#64748b",
};

const TILE_URLS: Record<TileTheme, { url: string; attribution: string }> = {
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  voyager: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};

export function LocationMap({
  markers = [],
  circles = [],
  onPick,
  className,
  style,
  center = [26.905, 75.79],
  zoom = 12,
  fit = false,
  tileTheme = "osm",
  interactive = true,
  showControls = true,
}: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const propsRef = useRef({ markers, circles, fit });
  propsRef.current = { markers, circles, fit };

  // Create map once
  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = await import("leaflet");
      if (disposed || !containerRef.current || mapRef.current) return;
      
      const mapOptions: any = {
        scrollWheelZoom: interactive,
        dragging: interactive,
        touchZoom: interactive,
        doubleClickZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
        zoomControl: showControls,
        attributionControl: showControls,
      };

      const map = L.map(containerRef.current, mapOptions).setView(center, zoom);

      const tileConfig = TILE_URLS[tileTheme] ?? TILE_URLS["osm"];
      L.tileLayer(tileConfig.url, {
        attribution: tileConfig.attribution,
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map);

      layerRef.current = L.layerGroup().addTo(map);
      if (interactive) {
        map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
          onPickRef.current?.(e.latlng.lat, e.latlng.lng);
        });
      }
      leafletRef.current = L;
      mapRef.current = map;
      renderLayers();
      setTimeout(() => map.invalidateSize(), 150);
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderLayers() {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    const { markers: ms, circles: cs, fit: shouldFit } = propsRef.current;

    for (const c of cs) {
      const color = TONE_COLOR[c.tone ?? "primary"];
      L.circle([c.lat, c.lng], {
        radius: c.radius,
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.1,
      }).addTo(layer);
    }
    for (const m of ms) {
      const color = TONE_COLOR[m.tone ?? "primary"];
      const icon = L.divIcon({
        className: "",
        html: `<div class="dvr-pin" style="background:${color}"><span>${m.label ?? ""}</span></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 28],
        popupAnchor: [0, -26],
      });
      const marker = L.marker([m.lat, m.lng], {
        icon,
        draggable: !!m.draggable,
      }).addTo(layer);

      if (m.draggable) {
        marker.on("dragend", (e: any) => {
          const latlng = e.target.getLatLng();
          onPickRef.current?.(latlng.lat, latlng.lng);
        });
      }

      const sub = m.subtitle ? `<div style="font-size:12px;color:#64748b;margin-top:2px">${m.subtitle}</div>` : "";
      marker.bindPopup(
        `<div style="font-family:Manrope,sans-serif;min-width:160px"><div style="font-weight:700;font-size:13px">${m.title}</div>${sub}</div>`,
      );
    }

    // Draw connecting line & live distance badge between points if exactly 2 markers exist
    const m0 = ms[0];
    const m1 = ms[1];
    if (ms.length === 2 && m0 && m1) {
      const lineCoords: [number, number][] = [
        [m0.lat, m0.lng],
        [m1.lat, m1.lng],
      ];

      // Calculate distance & midpoint
      const midLat = (m0.lat + m1.lat) / 2;
      const midLng = (m0.lng + m1.lng) / 2;

      // Haversine distance in meters
      const R = 6371000;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const dLat = toRad(m1.lat - m0.lat);
      const dLon = toRad(m1.lng - m0.lng);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(m0.lat)) * Math.cos(toRad(m1.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const distMeters = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
      const distText = distMeters < 1000 ? `${distMeters} m` : `${(distMeters / 1000).toFixed(2)} km`;

      const poly = L.polyline(lineCoords, {
        color: "#0284c7",
        weight: 3.5,
        dashArray: "6, 8",
        opacity: 0.9,
      }).addTo(layer);

      poly.bindTooltip(`Distance: ${distText}`, { permanent: false, direction: "top" });

      // Floating On-Map Distance Badge right in the middle of the line
      const distBadgeIcon = L.divIcon({
        className: "custom-distance-badge",
        html: `<div style="
          background: #0f172a;
          color: #38bdf8;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
          font-weight: 800;
          padding: 3px 9px;
          border-radius: 9999px;
          border: 2px solid #38bdf8;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          white-space: nowrap;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: default;
        ">📏 ${distText}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      L.marker([midLat, midLng], { icon: distBadgeIcon, interactive: false }).addTo(layer);
    }

    if (shouldFit && (ms.length > 0 || cs.length > 0)) {
      const points: Array<[number, number]> = [
        ...ms.map((m) => [m.lat, m.lng] as [number, number]),
        ...cs.map((c) => [c.lat, c.lng] as [number, number]),
      ];
      if (points.length === 1) {
        map.setView(points[0], 15);
      } else if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points).pad(0.25));
      }
    }
  }

  // Re-render layers when data changes
  useEffect(() => {
    renderLayers();
  });

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ minHeight: 280, borderRadius: "var(--radius-xl)", overflow: "hidden", ...style }}
    />
  );
}
