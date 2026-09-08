import { useEffect, useRef, useState, useCallback } from "react";

export interface GeoFix {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  source?: "satellite" | "network" | "ip" | "manual";
}

export type GeoStatus = "idle" | "watching" | "error" | "unsupported" | "insecure";
export type PermissionState = "granted" | "prompt" | "denied" | "unsupported" | "unknown";

export function useGeolocation(active: boolean) {
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [permission, setPermission] = useState<PermissionState>("unknown");
  const watchId = useRef<number | null>(null);
  const bestFixRef = useRef<GeoFix | null>(null);

  const updateBestFix = useCallback((newFix: GeoFix) => {
    const current = bestFixRef.current;
    if (!current) {
      bestFixRef.current = newFix;
      setFix(newFix);
      return;
    }

    // Always prefer higher precision (lower accuracy number in meters)
    // Or if within 15 meters accuracy, prefer the newer timestamp (tracking movement)
    const isMoreAccurate = newFix.accuracy < current.accuracy;
    const isFreshAndGood =
      Math.abs(newFix.accuracy - current.accuracy) <= 25 && newFix.timestamp > current.timestamp;

    if (isMoreAccurate || isFreshAndGood) {
      bestFixRef.current = newFix;
      setFix(newFix);
    }
  }, []);

  // Proactive IP-based fast coordinate resolver (failsafe when GPS hardware is blocked or absent)
  const fetchIpFallbackLocation = useCallback(async () => {
    try {
      const res = await fetch("https://ipapi.co/json/");
      if (res.ok) {
        const data = await res.json();
        if (data.latitude && data.longitude) {
          const ipFix: GeoFix = {
            latitude: Number(data.latitude),
            longitude: Number(data.longitude),
            accuracy: 100, // 100m default estimate
            timestamp: Date.now(),
            source: "ip",
          };
          updateBestFix(ipFix);
          return;
        }
      }
    } catch {
      // Fallback to secondary geo IP
    }

    try {
      const res2 = await fetch("https://freeipapi.com/api/json");
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2.latitude && data2.longitude) {
          const ipFix2: GeoFix = {
            latitude: Number(data2.latitude),
            longitude: Number(data2.longitude),
            accuracy: 150,
            timestamp: Date.now(),
            source: "ip",
          };
          updateBestFix(ipFix2);
          return;
        }
      }
    } catch { }

    // Default India / Jaipur Anchor if totally offline
    const defaultFix: GeoFix = {
      latitude: 26.9124,
      longitude: 75.7873,
      accuracy: 200,
      timestamp: Date.now(),
      source: "network",
    };
    updateBestFix(defaultFix);
  }, [updateBestFix]);

  const startWatching = useCallback(() => {
    if (typeof window === "undefined") return;

    // Check secure context requirement
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "::1";

    if (!window.isSecureContext && !isLocalhost) {
      setStatus("insecure");
      setError(
        "Browser requires a secure connection (HTTPS or localhost) to access device GPS hardware."
      );
      fetchIpFallbackLocation();
      return;
    }

    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      setError("GPS Location API is not supported on this browser/device.");
      fetchIpFallbackLocation();
      return;
    }

    setStatus("watching");
    setError(null);

    // Clear any previous active watcher
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }

    // 1. Initial Position Request
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const accurateFix: GeoFix = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
          source: pos.coords.accuracy <= 35 ? "satellite" : "network",
        };
        updateBestFix(accurateFix);
        setPermission("granted");
        setError(null);
      },
      (err) => {
        console.warn("[GPS] Initial GPS capture response:", err.code, err.message);

        if (err.code === err.PERMISSION_DENIED) {
          setPermission("denied");
          setError(
            "Location access is blocked in your browser. Click the Lock 🔒 icon in the URL bar to allow location."
          );
          return;
        }

        // For timeout or weak signal indoors, try standard accuracy
        navigator.geolocation.getCurrentPosition(
          (netPos) => {
            const netFix: GeoFix = {
              latitude: netPos.coords.latitude,
              longitude: netPos.coords.longitude,
              accuracy: netPos.coords.accuracy,
              timestamp: netPos.timestamp,
              source: "network",
            };
            updateBestFix(netFix);
            setPermission("granted");
            setError(null);
          },
          () => {
            fetchIpFallbackLocation();
          },
          { enableHighAccuracy: false, timeout: 4000, maximumAge: 30000 }
        );
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
    );

    // 2. Continuous Refinement Watcher
    try {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const liveFix: GeoFix = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
            source: pos.coords.accuracy <= 35 ? "satellite" : "network",
          };
          updateBestFix(liveFix);
          setPermission("granted");
          setError(null);
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setPermission("denied");
            setError(
              "Location access is blocked. Click the Lock 🔒 icon in the URL bar to allow location."
            );
          }
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 }
      );
    } catch (e) {
      console.warn("[GPS] Watch position setup notice:", e);
    }
  }, [fetchIpFallbackLocation, updateBestFix]);

  // Check initial permission status via Permissions API
  useEffect(() => {
    if (typeof navigator !== "undefined" && "permissions" in navigator) {
      try {
        navigator.permissions
          .query({ name: "geolocation" })
          .then((p) => {
            setPermission(p.state as PermissionState);
            p.onchange = () => {
              setPermission(p.state as PermissionState);
              if (p.state === "granted" && active) {
                startWatching();
              } else if (p.state === "denied") {
                setPermission("denied");
                setError(
                  "Location access is blocked in your browser. Click the Lock 🔒 icon in the URL bar to allow location."
                );
              }
            };
          })
          .catch(() => { });
      } catch { }
    }
  }, [active, startWatching]);

  // Trigger when active
  useEffect(() => {
    if (!active) return;
    startWatching();

    return () => {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [active, startWatching]);

  const useFallbackLocation = useCallback(() => {
    fetchIpFallbackLocation();
  }, [fetchIpFallbackLocation]);

  return {
    fix,
    error,
    status,
    permission,
    retry: startWatching,
    requestPermission: startWatching,
    useFallbackLocation,
    setFix,
  };
}
