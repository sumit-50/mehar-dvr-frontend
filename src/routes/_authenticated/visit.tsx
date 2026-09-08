import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  ChevronDown,
  Info,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Plus,
  RefreshCw,
  Satellite,
  Search,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import {
  getMyVisits,
  getOfficeOptions,
  getSessionInfo,
  searchPlaces,
  submitLocationRequest,
  submitOfficeGps,
  submitVisit,
  updatePendingOfficeDetails,
  type PlaceSearchResult,
} from "@/lib/dvr.functions";
import {
  FIX_GPS_ACCURACY_METERS,
  MAX_GPS_ACCURACY_METERS,
  VISIT_PURPOSES,
  fetchLiveAddress,
  formatAccuracy,
  formatDistance,
  haversineMeters,
  isKnownPurpose,
} from "@/lib/geo";
import { useGeolocation, type GeoFix } from "@/hooks/use-geolocation";
import { CameraCapture } from "@/components/CameraCapture";
import { LocationMap } from "@/components/LocationMap";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { stampPhotoWithWatermark, type WatermarkData } from "@/lib/watermark";

export const Route = createFileRoute("/_authenticated/visit")({
  head: () => ({
    meta: [
      { title: "Start Visit — Mehar DVR" },
      { name: "description", content: "Record a GPS-verified field visit with live photo proof." },
      { property: "og:title", content: "Start Visit — Mehar DVR" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: VisitPage,
});

const STEPS = ["Location & GPS", "Office Details & Photo", "Purpose & Submit"] as const;

interface CapturedPhoto {
  rawDataUrl: string;
  takenAt: number;
  latitude: number;
  longitude: number;
  accuracy: number;
  distanceMeters: number;
}

function VisitPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);

  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => getSessionInfo() });
  const { data: locations, isLoading: loadingLocations } = useQuery({
    queryKey: ["office-options"],
    queryFn: () => getOfficeOptions(),
  });

  const activeLocations = useMemo(
    () => (locations ?? []).filter((l) => l.status === "active"),
    [locations],
  );
  const pendingLocations = useMemo(
    () => (locations ?? []).filter((l) => l.status === "pending"),
    [locations],
  );

  const { fix: geoFix, error: geoError, status: geoStatus, permission: geoPermission, retry: retryGps, useFallbackLocation } = useGeolocation(true);
  // Pure genuine device hardware GPS only (anti-cheat: employee cannot manually fake or shift pin)
  const fix = geoFix;

  const [liveAddress, setLiveAddress] = useState<string>("");

  useEffect(() => {
    if (!fix) return;
    let active = true;
    fetchLiveAddress(fix.latitude, fix.longitude).then((addr) => {
      if (active && addr) {
        setLiveAddress(addr);
      }
    });
    return () => {
      active = false;
    };
  }, [fix?.latitude, fix?.longitude]);

  const { data: myVisits } = useQuery({
    queryKey: ["my-visits", {}],
    queryFn: () => getMyVisits({ data: {} }),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Selected location
  const selected = (locations ?? []).find((l) => l.id === selectedId) ?? null;

  // Check if this employee has ever had an approved visit to this location
  const hasPriorVerifiedVisit = useMemo(() => {
    if (!selectedId || !myVisits) return false;
    return myVisits.some(
      (v) => (v.location_id === selectedId || (v as any).location?.id === selectedId) && v.status === "verified",
    );
  }, [selectedId, myVisits]);

  // Determine if this is an approved location (with 100m fixed radius) or first visit by this employee
  const isApprovedOffice = selected?.status === "active";
  const isFirstVisit = !selected || selected.status !== "active" || !hasPriorVerifiedVisit;

  // Office details state for manual entry on first visit or review on approved office
  const [officeDetails, setOfficeDetails] = useState({
    description: "",
    ownerName: "",
    ownerNumber: "",
  });

  // Prepopulate office details from selected location (only for approved office) or reset for manual entry
  useEffect(() => {
    if (selected && isApprovedOffice) {
      setOfficeDetails({
        description: selected.company_description || "",
        ownerName: selected.owner_name || "",
        ownerNumber: selected.owner_number || "",
      });
    } else {
      setOfficeDetails({
        description: "",
        ownerName: "",
        ownerNumber: "",
      });
    }
  }, [selected?.id, isApprovedOffice]);

  const distance = useMemo(() => {
    if (!selected || !fix) return null;
    return haversineMeters(selected.latitude, selected.longitude, fix.latitude, fix.longitude);
  }, [selected, fix]);

  const effectiveMaxAccuracy = MAX_GPS_ACCURACY_METERS;
  const accuracyOk = !!fix && fix.accuracy <= effectiveMaxAccuracy;
  const radiusLimit = selected?.allowed_radius ?? 100;
  const distanceOk = isApprovedOffice && distance != null && distance <= radiusLimit;

  const canContinueStep1 =
    !!selected &&
    accuracyOk &&
    (isFirstVisit || distanceOk);

  const effectiveOwnerNumber = officeDetails.ownerNumber || selected?.owner_number || "";
  const effectiveOwnerName = officeDetails.ownerName || selected?.owner_name || "";
  const effectiveDescription = officeDetails.description || selected?.company_description || "";
  const digitsOnly = effectiveOwnerNumber.replace(/\D/g, "");

  const hasValidOfficeDetails =
    effectiveDescription.trim().length >= 2 &&
    effectiveOwnerName.trim().length >= 2 &&
    digitsOnly.length >= 10;

  const [purpose, setPurpose] = useState("");
  const [customPurpose, setCustomPurpose] = useState("");
  const [remarks, setRemarks] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);

  /** Why camera shutter is locked; null = photo allowed */
  const blockReason = useMemo(() => {
    if (!selected) return "Select an office/branch first";
    if (!fix) return "Waiting for live phone GPS signal";
    if (!accuracyOk)
      return `GPS accuracy is low (${formatAccuracy(fix.accuracy)} — need ±${effectiveMaxAccuracy} m or better)`;
    if (isApprovedOffice && distance == null) return "Calculating distance from approved office";
    if (isApprovedOffice && !distanceOk)
      return `Location not matched — you are ${formatDistance(distance!)} from ${selected.location_name} (must be within ${radiusLimit} m of approved location)`;
    if (isFirstVisit) {
      if (effectiveDescription.trim().length < 2) return "Enter Office Description for first visit";
      if (effectiveOwnerName.trim().length < 2) return "Enter Owner Name for first visit";
      if (digitsOnly.length < 10) return "Enter valid 10-digit Owner Mobile Number for first visit";
    }
    return null;
  }, [selected, fix, accuracyOk, isApprovedOffice, isFirstVisit, distance, distanceOk, radiusLimit, effectiveDescription, effectiveOwnerName, digitsOnly]);

  // Amazon Place Finder & Add Office State
  const [addOfficeOpen, setAddOfficeOpen] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([]);
  const [newOffice, setNewOffice] = useState({
    companyName: "",
    officeName: "",
    address: "",
    ownerName: "",
    ownerNumber: "",
    companyDescription: "",
    latitude: 26.9124,
    longitude: 75.7873,
  });

  const searchAmazonPlaces = async (query: string) => {
    if (!query || query.trim().length < 2) return;
    setIsSearchingPlaces(true);
    try {
      const results = await searchPlaces({
        data: {
          query: query.trim(),
          biasLat: fix?.latitude ?? 26.9124,
          biasLng: fix?.longitude ?? 75.7873,
        },
      });
      setPlaceResults(results || []);
    } catch (e: any) {
      console.warn("[Place Search]", e);
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  const createLocation = useMutation({
    mutationFn: async () => {
      if (!newOffice.companyName.trim()) throw new Error("Company Name is required");
      if (!newOffice.officeName.trim()) throw new Error("Office/Branch Name is required");
      if (!newOffice.companyDescription.trim()) throw new Error("Office Description is required");
      if (!newOffice.ownerName.trim()) throw new Error("Owner Name is required");
      if (newOffice.ownerNumber.replace(/\D/g, "").length < 10) throw new Error("Valid 10-digit mobile number is required");

      const res = await submitLocationRequest({
        data: {
          companyName: newOffice.companyName.trim(),
          officeName: newOffice.officeName.trim(),
          companyDescription: newOffice.companyDescription.trim(),
          ownerName: newOffice.ownerName.trim(),
          ownerNumber: newOffice.ownerNumber.trim(),
          latitude: newOffice.latitude || fix?.latitude || 26.9124,
          longitude: newOffice.longitude || fix?.longitude || 75.7873,
          gpsAccuracy: fix?.accuracy || 15,
        },
      });
      return res;
    },
    onSuccess: async (data) => {
      toast.success("Office added successfully! Selected for visit.");
      await queryClient.invalidateQueries({ queryKey: ["office-options"] });
      setSelectedId(data.id);
      setAddOfficeOpen(false);
      setPlaceResults([]);
      setPlaceQuery("");
      setNewOffice({
        companyName: "",
        officeName: "",
        address: "",
        ownerName: "",
        ownerNumber: "",
        companyDescription: "",
        latitude: 26.9124,
        longitude: 75.7873,
      });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add office");
    },
  });

  const finalPurpose = purpose === "Other" ? customPurpose.trim() : purpose;

  // Submit visit mutation
  const submit = useMutation({
    mutationFn: async () => {
      if (!selected || !photo) throw new Error("Missing office or photo proof");
      const when = new Date(photo.takenAt);
      const employeeName = session?.profile?.name || "Employee";
      const employeeId = session?.profile?.employee_id || "MEH001";

      const watermark: WatermarkData = {
        locationName: [selected.company_name, selected.location_name].filter(Boolean).join(" — "),
        address: liveAddress || selected.address || "",
        purpose: finalPurpose || "—",
        employeeName,
        employeeId,
        dateStr: when.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        timeStr: when.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        distanceMeters: photo.distanceMeters,
        accuracyMeters: photo.accuracy,
        latitude: photo.latitude,
        longitude: photo.longitude,
        fixedLatitude: isFirstVisit ? photo.latitude : selected.latitude,
        fixedLongitude: isFirstVisit ? photo.longitude : selected.longitude,
      };

      const stampedPhoto = await stampPhotoWithWatermark(photo.rawDataUrl, watermark);

      return submitVisit({
        data: {
          locationId: selected.id,
          purpose,
          customPurpose: purpose === "Other" ? customPurpose.trim() : undefined,
          remarks: remarks.trim() || undefined,
          ownerName: officeDetails.ownerName.trim() || undefined,
          ownerNumber: officeDetails.ownerNumber.trim() || undefined,
          companyDescription: officeDetails.description.trim() || undefined,
          actualLatitude: photo.latitude,
          actualLongitude: photo.longitude,
          gpsAccuracy: photo.accuracy,
          photo: stampedPhoto,
        },
      });
    },
    onSuccess: async () => {
      if (isFirstVisit) {
        toast.success("✅ First visit submitted! Report sent to Admin Sir for verification & location approval.");
      } else {
        toast.success("✅ Daily Visit Report submitted successfully!");
      }
      await queryClient.invalidateQueries({ queryKey: ["my-visits"] });
      await queryClient.invalidateQueries({ queryKey: ["my-locations"] });
      await queryClient.invalidateQueries({ queryKey: ["office-options"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-visits"] });
      await queryClient.invalidateQueries();
      setStep(0);
      setSelectedId(null);
      setPhoto(null);
      setPurpose("");
      setCustomPurpose("");
      setRemarks("");
      setOfficeDetails({ description: "", ownerName: "", ownerNumber: "" });
      window.scrollTo({ top: 0, behavior: "smooth" });
      navigate({ to: "/dashboard" });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not submit visit");
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="animate-fade-up">
        <h1 className="font-display text-2xl font-bold">Mehar DVR — Daily Visit Report</h1>
        <p className="text-sm text-muted-foreground">
          START → Select Office/Branch → Live GPS Verification → Daily Visit Report
        </p>
      </div>

      {/* Step Indicator */}
      <ol className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                i < step
                  ? "bg-success text-success-foreground"
                  : i === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </span>
            <span
              className={cn(
                "hidden text-xs font-semibold sm:block",
                i === step ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>

      {/* Step 0: Location & GPS Selection */}
      {step === 0 && (
        <section className="space-y-4 animate-fade-up">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                1. Select Office / Branch
              </h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddOfficeOpen(true)}
                className="h-8 text-xs font-semibold gap-1.5 border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Office / Amazon Place Finder</span>
                <Sparkles className="h-3 w-3 text-amber-500" />
              </Button>
            </div>

            {/* Office Dropdown */}
            <Select
              value={selectedId ?? ""}
              onValueChange={(v) => {
                if (v === "__ADD_NEW__") {
                  setAddOfficeOpen(true);
                  return;
                }
                setSelectedId(v);
                retryGps();
                const chosen = (locations ?? []).find((l) => l.id === v);
                const name = chosen
                  ? [chosen.company_name, chosen.location_name].filter(Boolean).join(" — ")
                  : "Office";
                toast.info(`Selected: ${name}`);
                setPhoto(null);
              }}
            >
              <SelectTrigger className="h-12 text-sm font-medium">
                <SelectValue placeholder="Select the Office / Branch you are visiting…" />
              </SelectTrigger>
              <SelectContent>
                <div className="p-1 border-b border-border">
                  <button
                    type="button"
                    onClick={() => setAddOfficeOpen(true)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>➕ Add New Office (Amazon Place Finder)</span>
                  </button>
                </div>

                {activeLocations.length > 0 && (
                  <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Approved Offices (100m Radius Fixed)
                  </div>
                )}
                {activeLocations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.company_name ? `${loc.company_name} — ${loc.location_name}` : loc.location_name}
                  </SelectItem>
                ))}

                {pendingLocations.length > 0 && (
                  <div className="mt-2 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Pending 1st Visit Approval
                  </div>
                )}
                {pendingLocations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.company_name ? `${loc.company_name} — ${loc.location_name}` : loc.location_name} (First Visit)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {loadingLocations && <div className="mt-3 h-10 animate-pulse rounded-xl bg-muted" />}

            {/* Prompt to select office if not selected */}
            {!selected && (
              <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  👆 Select your assigned Office / Branch from the dropdown above to capture your live GPS coordinates.
                </p>
              </div>
            )}

            {/* Live Phone GPS Status Bar after selecting office */}
            {selected && (
              <div className="mt-4">
                {!fix ? (
                  <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-5 text-center shadow-soft animate-fade-up">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift">
                      <Navigation className="h-6 w-6 animate-pulse" />
                    </div>
                    <h3 className="text-base font-bold font-display text-foreground">
                      {geoPermission === "denied" ? "Location Access Blocked" : "Live GPS Permission Needed"}
                    </h3>
                    <p className="mx-auto mt-1.5 max-w-md text-xs text-muted-foreground leading-relaxed">
                      {geoError ||
                        "To verify genuine field visits, Mehar DVR requires real-time device GPS access. Click the button below to allow location access."}
                    </p>

                    {geoPermission === "denied" && (
                      <div className="mx-auto mt-3 max-w-md rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-left text-xs text-amber-900 dark:text-amber-200">
                        <p className="font-bold flex items-center gap-1.5 mb-1 text-amber-800 dark:text-amber-300">
                          <span>🔒</span> How to enable Location in Browser:
                        </p>
                        <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                          <li>Click the <strong>Lock / Tune icon 🔒</strong> next to the website URL at the top of your browser.</li>
                          <li>Find <strong>Location</strong> and set it to <strong>Allow</strong>.</li>
                          <li>Tap the <strong>Retry GPS Access</strong> button below or refresh the page.</li>
                        </ol>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap justify-center items-center gap-2.5">
                      <Button
                        size="default"
                        onClick={() => {
                          retryGps();
                          toast.info("Requesting live satellite GPS…", { duration: 2500 });
                        }}
                        className="font-bold shadow-lift bg-primary hover:bg-primary/90 text-primary-foreground px-5 h-10 gap-2 text-xs"
                      >
                        <Navigation className="h-4 w-4" />
                        {geoPermission === "denied" ? "Retry GPS Access" : "Allow Live Location Access"}
                      </Button>
                      <Button
                        size="default"
                        variant="outline"
                        onClick={() => {
                          useFallbackLocation();
                          toast.success("Using estimated network location coordinates.");
                        }}
                        className="font-semibold px-4 h-10 gap-2 text-xs border-border"
                      >
                        <MapPin className="h-4 w-4 text-primary" />
                        Use Estimated Location (Continue)
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm shadow-soft animate-fade-up">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Navigation className="h-4 w-4 text-primary shrink-0" />
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-success flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Live Satellite GPS:
                          </span>
                          <span className="text-xs font-mono text-foreground font-semibold">
                            {fix.latitude.toFixed(6)}, {fix.longitude.toFixed(6)} ({formatAccuracy(fix.accuracy)})
                          </span>
                          {accuracyOk ? (
                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              ✓ Location Verified ({formatAccuracy(fix.accuracy)})
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 animate-pulse">
                              ⏳ Refining Signal (Needs ≤ {effectiveMaxAccuracy}m)…
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          retryGps();
                          toast.info("Re-locking high-precision satellite GPS…");
                        }}
                        className="h-7 text-xs font-semibold gap-1"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Refresh GPS
                      </Button>
                    </div>

                    {!accuracyOk && (
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                        🛰️ <strong>Waiting for Signal Lock:</strong> Current accuracy is {formatAccuracy(fix.accuracy)}. Required accuracy is within ±{effectiveMaxAccuracy}m to verify your physical visit.
                      </p>
                    )}

                    {liveAddress && (
                      <p className="text-xs text-foreground font-medium flex items-center gap-1.5 pt-1 border-t border-success/20">
                        <MapPin className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="font-semibold text-amber-800 dark:text-amber-300">Exact Location:</span>
                        <span className="text-muted-foreground">{liveAddress}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Approved Office Live GPS Comparison (Future Visit Flow) */}
            {selected && isApprovedOffice && fix && distance != null && (
              <div
                className={cn(
                  "mt-4 rounded-xl border p-4 text-sm transition-all",
                  distanceOk
                    ? "border-success/40 bg-success/10 text-foreground"
                    : "border-destructive/40 bg-destructive/10 text-destructive",
                )}
              >
                {distanceOk ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-success flex items-center gap-1.5">
                      <CheckCircle2 className="h-4.5 w-4.5 text-success" />
                      Approved Office Recognized (Within 100m Radius)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Live GPS is <strong>{formatDistance(distance)}</strong> from the fixed office location (allowed {radiusLimit}m). Previously saved owner & office details will be automatically loaded.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="font-semibold text-destructive flex items-center gap-1.5">
                      <AlertCircle className="h-4.5 w-4.5 text-destructive" />
                      Outside 100-Meter Radius
                    </p>
                    <p className="text-xs text-destructive/90">
                      You are <strong>{formatDistance(distance)}</strong> away from {[selected.company_name, selected.location_name].filter(Boolean).join(" — ")}. Daily visit reports are only allowed within {radiusLimit} meters of the approved location.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* First Visit to Office Banner (First Visit Flow) */}
            {selected && isFirstVisit && fix && (
              <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm animate-fade-up">
                <p className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Satellite className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                  First Visit to this Office — Live Location Captured
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  📍 <strong>Note:</strong> Location is <strong>NOT fixed yet</strong>. You will manually enter the Owner Name, Owner Mobile Number, and Office Description on the next step. Once submitted, Admin Sir will review and approve the fixed location with a 100-meter radius.
                </p>
              </div>
            )}
          </div>

          {/* Map View */}
          {selected && (
            <div id="location-map-card" className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Navigation className="h-3.5 w-3.5 text-primary" />
                    Live Satellite GPS: {fix ? `${fix.latitude.toFixed(6)}, ${fix.longitude.toFixed(6)}` : "Acquiring GPS…"} (±{fix ? Math.round(fix.accuracy) : 0}m)
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    🔒 <strong>Anti-Cheat Active:</strong> Location is locked strictly to your device's live satellite GPS chip.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs font-semibold"
                  onClick={() => {
                    retryGps();
                    toast.info("Updating live satellite signal…");
                  }}
                >
                  <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh GPS
                </Button>
              </div>

              {/* 2-Point Location Legend & HUD */}
              <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    🏢
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      Point 1: Destination Visit Office
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {[selected.company_name, selected.location_name].filter(Boolean).join(" — ")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 p-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                    📍
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      Point 2: Your Exact Live Location
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {fix ? `${fix.latitude.toFixed(5)}, ${fix.longitude.toFixed(5)} (${formatAccuracy(fix.accuracy)})` : "Acquiring GPS…"}
                    </p>
                  </div>
                </div>
              </div>

              <LocationMap
                className="h-72 w-full rounded-xl overflow-hidden border border-border"
                fit
                center={fix ? [fix.latitude, fix.longitude] : [selected.latitude, selected.longitude]}
                zoom={16}
                markers={[
                  // Point 1: Destination Office Location
                  {
                    id: "destination-office",
                    lat: selected.latitude,
                    lng: selected.longitude,
                    title: `🏢 Destination: ${[selected.company_name, selected.location_name].filter(Boolean).join(" — ")}`,
                    subtitle: isApprovedOffice ? `Approved Fixed Office (${radiusLimit}m Geo-fence)` : "Proposed Visit Destination",
                    tone: "primary" as const,
                    label: "🏢",
                  },
                  // Point 2: Exact Live GPS Position of Employee
                  ...(fix
                    ? [
                        {
                          id: "my-exact-location",
                          lat: fix.latitude,
                          lng: fix.longitude,
                          title: "📍 You: Exact Live GPS Location",
                          subtitle: `Satellite Accuracy: ${formatAccuracy(fix.accuracy)} ${distance != null ? `• ${formatDistance(distance)} from destination` : ""}`,
                          tone: isFirstVisit || distanceOk ? ("success" as const) : ("danger" as const),
                          label: "You",
                          draggable: false,
                        },
                      ]
                    : []),
                ]}
                circles={[
                  // 100-Meter Geo-Fence Circle around Destination Office
                  {
                    id: "destination-geofence",
                    lat: selected.latitude,
                    lng: selected.longitude,
                    radius: radiusLimit,
                    tone: isApprovedOffice ? "primary" : "muted",
                  },
                ]}
              />

              {/* Distance summary below map */}
              {distance != null && (
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    📏 <strong>Direct Distance:</strong>{" "}
                    <span className="font-semibold text-foreground">{formatDistance(distance)}</span> from destination point
                  </span>
                  {isApprovedOffice && (
                    <span className={cn("font-bold px-2 py-0.5 rounded-full text-[11px]", distanceOk ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-destructive/15 text-destructive")}>
                      {distanceOk ? "✓ Inside 100m zone" : `⚠️ Outside ${radiusLimit}m zone`}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Continue Button */}
          <div className="flex justify-end">
            <Button
              size="lg"
              disabled={!canContinueStep1}
              onClick={() => setStep(1)}
              className="font-semibold shadow-lift"
            >
              Continue to Step 2 <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {/* Step 1: Office Details & Photo Proof */}
      {step === 1 && selected && (
        <section className="space-y-4 animate-fade-up">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-bold flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                2. Office Details & Photo Proof
              </h2>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  !isFirstVisit
                    ? "bg-success/15 text-success border border-success/30"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30",
                )}
              >
                {!isFirstVisit ? "Approved Office (100m Radius)" : "1st Visit (Requires Admin Approval)"}
              </span>
            </div>

            {/* Selected Office Summary */}
            <div className="mb-4 flex items-start gap-3 rounded-xl bg-accent/60 px-4 py-3 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="font-semibold">
                  {[selected.company_name, selected.location_name].filter(Boolean).join(" — ")}
                </p>
                {selected.address && (
                  <p className="text-xs text-muted-foreground">{selected.address}</p>
                )}
                {isApprovedOffice && distance != null && (
                  <p className="mt-0.5 text-[11px] text-success font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Matched within 100m radius ({formatDistance(distance)} from approved location)
                  </p>
                )}
                {isFirstVisit && (
                  <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1">
                    <Satellite className="h-3.5 w-3.5" /> First-time visit: Captured live GPS will be sent to Admin Sir for 100m radius approval.
                  </p>
                )}
              </div>
            </div>

            {/* Office Details Form */}
            <div className="mb-4 space-y-3.5 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-primary" />
                    {isFirstVisit ? "Office & Owner Details (Enter for 1st Visit Setup)" : "Office & Owner Information (Approved Record)"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isFirstVisit
                      ? "Please enter the Owner Name, Owner Mobile Number, and Office Description for Admin Sir's review."
                      : "These verified details are saved in the system from the initial approval."}
                  </p>
                </div>
              </div>

              {isFirstVisit ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="pd-desc" className="text-xs font-semibold">
                      Office Description <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="pd-desc"
                      rows={3}
                      value={officeDetails.description}
                      onChange={(e) => setOfficeDetails({ ...officeDetails, description: e.target.value })}
                      placeholder="e.g. Branch office providing loan consultations and customer document verification."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pd-owner" className="text-xs font-semibold">
                      Owner / Contact Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="pd-owner"
                      maxLength={80}
                      value={officeDetails.ownerName}
                      onChange={(e) => setOfficeDetails({ ...officeDetails, ownerName: e.target.value })}
                      placeholder="e.g. Dr. R. K. Sharma / Branch Head"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pd-number" className="text-xs font-semibold">
                      Owner Mobile Number (10 digits) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="pd-number"
                      maxLength={15}
                      value={officeDetails.ownerNumber}
                      onChange={(e) => setOfficeDetails({ ...officeDetails, ownerNumber: e.target.value })}
                      placeholder="e.g. 9829012345"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border/80 bg-accent/40 p-3.5 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">Verified Owner:</span>
                    <span className="font-semibold text-foreground">{selected.owner_name || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">Contact Number:</span>
                    <span className="font-semibold text-foreground">{selected.owner_number || "—"}</span>
                  </div>
                  {selected.company_description && (
                    <div className="pt-1.5 border-t border-border/60">
                      <span className="text-muted-foreground">Description: </span>
                      <span className="text-foreground font-medium">{selected.company_description}</span>
                    </div>
                  )}
                </div>
              )}

              {isFirstVisit && !hasValidOfficeDetails && (
                <div className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Please fill Owner Name, 10-digit Mobile Number, and Office Description before opening camera.</span>
                </div>
              )}
            </div>

            {/* Photo Capture Section */}
            {photo ? (
              <div className="space-y-3">
                <img
                  src={photo.rawDataUrl}
                  alt="Captured visit proof"
                  className="w-full rounded-xl border border-border"
                />
                <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  Photo captured at{" "}
                  {new Date(photo.takenAt).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                  . GPS watermark with coordinates will be permanently embedded.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCameraOpen(true)}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Retake Photo
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (blockReason) {
                    toast.error(blockReason);
                    return;
                  }
                  setCameraOpen(true);
                }}
                className={cn(
                  "flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition",
                  !blockReason
                    ? "border-primary/40 bg-primary/5 hover:bg-primary/10 cursor-pointer"
                    : "border-muted-foreground/30 bg-muted/30 opacity-70 cursor-not-allowed",
                )}
              >
                <div
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full shadow-lift",
                    !blockReason ? "bg-primary text-primary-foreground" : "bg-muted-foreground/30 text-muted-foreground",
                  )}
                >
                  <Camera className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {!blockReason ? "Open Camera & Click Photo" : "Camera Locked"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {!blockReason ? "Capture live photo proof of your visit" : blockReason}
                  </p>
                </div>
              </button>
            )}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" size="lg" onClick={() => setStep(0)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Step 1
            </Button>
            <Button
              size="lg"
              disabled={!photo || (isFirstVisit && !hasValidOfficeDetails)}
              onClick={() => setStep(2)}
              className="font-semibold shadow-lift"
            >
              Continue to Step 3 <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {/* Step 2: Purpose & Submit */}
      {step === 2 && selected && (
        <section className="space-y-4 animate-fade-up">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="mb-4 font-display text-base font-bold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              3. Complete Daily Visit Report
            </h2>

            {/* Visit Summary Card */}
            <div className="mb-4 flex items-start gap-3 rounded-xl bg-accent/60 px-4 py-3 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="font-semibold">
                  {[selected.company_name, selected.location_name].filter(Boolean).join(" — ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Owner: {officeDetails.ownerName || selected.owner_name} ({officeDetails.ownerNumber || selected.owner_number})
                </p>
                {photo && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground font-mono">
                    Live GPS: {photo.latitude.toFixed(5)}, {photo.longitude.toFixed(5)} (±{Math.round(photo.accuracy)}m)
                  </p>
                )}
              </div>
            </div>

            {photo && (
              <img
                src={photo.rawDataUrl}
                alt="Captured visit proof"
                className="mb-4 max-h-48 rounded-xl border border-border object-cover"
              />
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="purpose" className="text-xs font-semibold">
                  Visit Purpose <span className="text-destructive">*</span>
                </Label>
                <Select value={purpose} onValueChange={setPurpose}>
                  <SelectTrigger id="purpose">
                    <SelectValue placeholder="Select purpose of this visit…" />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIT_PURPOSES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {purpose === "Other" && (
                <div className="space-y-1.5 animate-fade-up">
                  <Label htmlFor="custom-purpose" className="text-xs font-semibold">
                    Describe Purpose <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="custom-purpose"
                    value={customPurpose}
                    onChange={(e) => setCustomPurpose(e.target.value)}
                    placeholder="e.g. Document collection, manager meeting, etc."
                    maxLength={120}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="remarks" className="text-xs font-semibold">Remarks (Optional)</Label>
                <Textarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Notes about discussion, next follow-up, etc."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
            <Navigation className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
            Submitting as <strong>{session?.profile?.name || "Employee"}</strong> ({session?.profile?.employee_id || "MEH001"})
            at <strong>{[selected.company_name, selected.location_name].filter(Boolean).join(" — ")}</strong>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" size="lg" onClick={() => setStep(1)} disabled={submit.isPending}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Step 2
            </Button>
            <Button
              size="lg"
              className="font-semibold shadow-lift"
              disabled={submit.isPending || !finalPurpose}
              onClick={() => {
                if (!finalPurpose) {
                  toast.error("Please select or enter a visit purpose");
                  return;
                }
                submit.mutate();
              }}
            >
              {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Visit Report
            </Button>
          </div>
        </section>
      )}

      {/* Camera Capture Modal */}
      {cameraOpen && selected && (
        <CameraCapture
          live={{
            locationName: [selected.company_name, selected.location_name].filter(Boolean).join(" — "),
            address: liveAddress || selected.address || undefined,
            latitude: fix?.latitude,
            longitude: fix?.longitude,
            isFirstVisit,
            distanceMeters: distance,
            accuracyMeters: fix?.accuracy ?? null,
            hasFix: !!fix,
            blockReason,
          }}
          onClose={() => setCameraOpen(false)}
          onCaptured={(_blob, dataUrl) => {
            if (!fix) return;
            setPhoto({
              rawDataUrl: dataUrl,
              takenAt: Date.now(),
              latitude: fix.latitude,
              longitude: fix.longitude,
              accuracy: fix.accuracy,
              distanceMeters: distance ?? 0,
            });
            setCameraOpen(false);
          }}
        />
      )}
      {/* Amazon Location Place Finder & Add Office Modal */}
      <Dialog
        open={addOfficeOpen}
        onOpenChange={(open) => {
          setAddOfficeOpen(open);
          if (!open) {
            setPlaceResults([]);
            setPlaceQuery("");
          }
        }}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-2xl md:max-w-3xl w-full max-h-[90vh] overflow-y-auto overflow-x-hidden p-5 sm:p-7 rounded-2xl shadow-xl box-border">
          <DialogHeader className="mb-3 pr-6">
            <div className="flex items-center gap-1.5 text-primary text-xs font-bold uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>Amazon Location Service Place Finder</span>
            </div>
            <DialogTitle className="font-display text-xl font-bold text-foreground">
              Add New Office / Client Location
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Search by company name, landmark, or address to automatically pinpoint GPS coordinates.
            </p>
          </DialogHeader>

          {/* Amazon Place Search Bar */}
          <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-primary" />
              Search Place / Landmark with Amazon Location Service
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={placeQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPlaceQuery(val);
                    if (val.trim().length >= 1) {
                      searchAmazonPlaces(val);
                    } else {
                      setPlaceResults([]);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchAmazonPlaces(placeQuery);
                    }
                  }}
                  placeholder="Type e.g. Digital Smart Technology, WTP, Tonk Road, Sodala…"
                  className="pr-8 bg-background"
                  autoFocus
                />
                {isSearchingPlaces && (
                  <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => searchAmazonPlaces(placeQuery)}
                disabled={isSearchingPlaces}
                className="font-semibold gap-1 shrink-0"
              >
                <Search className="h-3.5 w-3.5" /> Search
              </Button>
            </div>

            {/* Quick Live GPS Fill Button */}
            {fix && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewOffice((prev) => ({
                    ...prev,
                    latitude: fix.latitude,
                    longitude: fix.longitude,
                    address: liveAddress || prev.address || "Live On-Site GPS Location",
                  }));
                  toast.success(`📍 Filled current GPS coordinates: ${fix.latitude.toFixed(5)}, ${fix.longitude.toFixed(5)}`);
                }}
                className="w-full text-xs font-semibold gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>📍 Pin My Current Live GPS ({fix.latitude.toFixed(4)}, {fix.longitude.toFixed(4)})</span>
              </Button>
            )}

            {/* Search Suggestions List with 1-Click Add & Select */}
            {placeResults.length > 0 && (
              <div className="mt-3 space-y-2 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-3 shadow-inner">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 flex items-center justify-between">
                  <span>Amazon Location Matches ({placeResults.length}):</span>
                  <span className="text-[10px] text-primary font-normal">Click any place to add to visit list</span>
                </p>
                {placeResults.map((r, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl hover:bg-accent/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border border-border/60 bg-background shadow-xs group"
                  >
                    <div className="min-w-0 flex-1 flex items-start gap-2.5">
                      <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-foreground text-sm leading-tight group-hover:text-primary transition-colors">
                          {r.label.split(",")[0]}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.address || r.label}</p>
                        <span className="inline-block mt-1 text-[10px] font-mono text-primary/90 bg-primary/10 px-2 py-0.5 rounded-md">
                          📍 GPS: {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={async () => {
                        const compName = r.label.split(",")[0] || r.label;
                        const offName = r.label.split(",")[1]?.trim() || "Main Branch";
                        try {
                          const res = await submitLocationRequest({
                            data: {
                              companyName: compName,
                              officeName: offName,
                              companyDescription: `Amazon Place Finder verified: ${r.label}`,
                              ownerName: "Verified Location",
                              ownerNumber: "",
                              latitude: r.latitude,
                              longitude: r.longitude,
                              gpsAccuracy: fix?.accuracy || 10,
                            },
                          });
                          await queryClient.invalidateQueries({ queryKey: ["office-options"] });
                          await queryClient.invalidateQueries({ queryKey: ["locations"] });
                          if (res?.id) {
                            setSelectedId(res.id);
                          }
                          toast.success(`📍 Added & Selected: ${compName}`);
                          setAddOfficeOpen(false);
                        } catch (err: any) {
                          toast.error(err.message || "Added location to visit list.");
                          setAddOfficeOpen(false);
                        }
                      }}
                      className="font-bold text-xs gap-1.5 shrink-0 shadow-xs"
                    >
                      <Plus className="h-3.5 w-3.5" /> Select & Add Office
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
