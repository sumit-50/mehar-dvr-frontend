/**
 * Shared geo + domain constants for Mehar DVR (client and server safe).
 */

export const VISIT_PURPOSES = [
  "Customer Meeting",
  "Document Collection",
  "Document Submission",
  "Bank Visit",
  "RTO Visit",
  "Dealer Visit",
  "Broker Visit",
  "Payment Follow-up",
  "Loan Case Follow-up",
  "Verification",
  "Collection Visit",
  "Office Work",
  "Other",
] as const;

export type VisitPurpose = (typeof VISIT_PURPOSES)[number];

export function isKnownPurpose(purpose: string): purpose is VisitPurpose {
  return (VISIT_PURPOSES as readonly string[]).includes(purpose);
}

export const MAX_GPS_ACCURACY_METERS = 500;
/** Required accuracy while an office location is being fixed for admin approval. */
export const FIX_GPS_ACCURACY_METERS = 500;
export const DEFAULT_RADIUS_METERS = 100;

/** Haversine distance in meters between two lat/lng points. */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatAccuracy(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return "—";
  return `±${Math.round(meters)} m`;
}

export function formatCoord(value: number): string {
  return value.toFixed(6);
}

import { apiFetch } from "./api-client";

const addressCache = new Map<string, string>();

/** Reverse-geocodes live GPS coordinates to physical street, landmark, area, city address using backend AWS Location Service & fallbacks */
export async function fetchLiveAddress(lat: number, lng: number): Promise<string> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (addressCache.has(key)) return addressCache.get(key)!;

  // 1. Primary: Backend Amazon Location Service Live Reverse Geocoding
  try {
    const res = await apiFetch<{ success: boolean; address?: string }>("/dvr/places/reverse-geocode", {
      method: "POST",
      body: { lat, lng },
    });
    if (res?.address) {
      addressCache.set(key, res.address);
      return res.address;
    }
  } catch (e) {
    console.warn("[Backend Reverse Geocode notice]", e);
  }

  // 2. High-speed BigDataCloud Locality Engine (Detailed India & International locality & landmarks)
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    if (res.ok) {
      const json = await res.json();
      const parts = [
        json.localityInfo?.informative?.[0]?.name || json.locality || "",
        json.localityInfo?.administrative?.[3]?.name || json.locality || "",
        json.city || json.localityInfo?.administrative?.[2]?.name || "",
        json.principalSubdivision || "",
        json.postcode || "",
      ].filter(Boolean);

      const uniqueParts: string[] = [];
      for (const p of parts) {
        if (!uniqueParts.some((u) => u.toLowerCase() === p.toLowerCase())) {
          uniqueParts.push(p);
        }
      }

      if (uniqueParts.length >= 2) {
        const addr = uniqueParts.join(", ");
        addressCache.set(key, addr);
        return addr;
      }
    }
  } catch (e) {
    console.warn("[DVR] BigDataCloud geocode notice:", e);
  }

  // 2. Secondary: OpenStreetMap detailed street & building level reverse geocoder
  try {
    const res2 = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "MeharDVR-FieldVisits/1.0",
        },
      }
    );
    if (res2.ok) {
      const json2 = await res2.json();
      const addr = json2.address || {};
      const road = addr.building || addr.house_name || addr.road || addr.street || addr.amenity || addr.shop || "";
      const neighbourhood = addr.neighbourhood || addr.suburb || addr.residential || addr.commercial || "";
      const city = addr.city || addr.town || addr.village || addr.county || "Jaipur";
      const state = addr.state || "Rajasthan";
      const postcode = addr.postcode || "";

      const parts2 = [road, neighbourhood, city, state, postcode].filter(Boolean);
      const resolved = parts2.join(", ") || (json2.display_name ? String(json2.display_name).slice(0, 100) : "");
      if (resolved) {
        addressCache.set(key, resolved);
        return resolved;
      }
    }
  } catch (e) {
    console.warn("[DVR] Nominatim geocode fallback notice:", e);
  }

  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}
