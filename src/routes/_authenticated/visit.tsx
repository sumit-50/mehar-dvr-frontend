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
import { cn, formatErrorMessage } from "@/lib/utils";
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
      toast.error(formatErrorMessage(err));
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
      toast.error(formatErrorMessage(err));
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-3.5 sm:space-y-4">
      {/* Header */}
      <div className="animate-fade-up">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-100 text-sky-700 text-[10px] sm:text-[11px] font-bold mb-1">
          <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
          <span>Mehar DVR Portal</span>
        </div>
        <h1 className="font-display text-base sm:text-xl font-extrabold text-slate-900 leading-tight">
          Daily Field Visit Report
        </h1>
        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
          Step-by-step GPS verification and client visit logging
        </p>
      </div>

      {/* Modern Stepper Indicator */}
      <div className="rounded-2xl border border-slate-100 bg-white/95 p-2.5 sm:p-3 shadow-xs">
        <div className="flex items-center justify-between gap-1 sm:gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1 flex items-center gap-1.5 sm:gap-2">
              <div
                className={cn(
                  "flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full text-[10.5px] sm:text-xs font-bold transition-all",
                  i < step
                    ? "bg-emerald-600 text-white shadow-xs"
                    : i === step
                      ? "bg-sky-600 text-white shadow-xs ring-2 ring-sky-200"
                      : "bg-slate-100 text-slate-400 border border-slate-200",
                )}
              >
                {i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] sm:text-xs font-semibold truncate",
                  i === step
                    ? "text-slate-900 font-bold"
                    : i < step
                      ? "text-emerald-700 font-medium"
                      : "text-slate-400",
                )}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-[2px] flex-1 mx-0.5 sm:mx-1 rounded-full",
                    i < step ? "bg-emerald-500" : "bg-slate-200",
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 0: Location & GPS Selection */}
      {step === 0 && (
        <section className="space-y-3 sm:space-y-3.5 animate-fade-up">
          <div className="rounded-2xl border border-slate-100 bg-white/95 p-3.5 sm:p-4 shadow-xs backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xs sm:text-sm font-extrabold flex items-center gap-1.5 text-slate-900 leading-tight">
                <Building2 className="h-4 w-4 text-sky-600 shrink-0" />
                <span>1. Select Office / Branch</span>
              </h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddOfficeOpen(true)}
                className="h-7.5 px-2.5 text-[10.5px] sm:text-xs font-bold gap-1 rounded-xl border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100/80 shadow-xs"
              >
                <Plus className="h-3 w-3" />
                <span>Add Office</span>
                <Sparkles className="h-2.5 w-2.5 text-amber-500 shrink-0" />
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
              <SelectTrigger className="h-10 text-xs sm:text-sm font-medium rounded-xl border-slate-200 bg-slate-50/50">
                <SelectValue placeholder="Choose visiting Office / Branch…" />
              </SelectTrigger>
              <SelectContent className="max-h-64 rounded-xl">
                <div className="p-1 border-b border-border">
                  <button
                    type="button"
                    onClick={() => setAddOfficeOpen(true)}
                    className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>➕ Add New Office (Amazon Place Finder)</span>
                  </button>
                </div>

                {activeLocations.length > 0 && (
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Approved Offices (100m Radius Fixed)
                  </div>
                )}
                {activeLocations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id} className="text-xs">
                    {loc.company_name ? `${loc.company_name} — ${loc.location_name}` : loc.location_name}
                  </SelectItem>
                ))}

                {pendingLocations.length > 0 && (
                  <div className="mt-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-600">
                    Pending 1st Visit Approval
                  </div>
                )}
                {pendingLocations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id} className="text-xs">
                    {loc.company_name ? `${loc.company_name} — ${loc.location_name}` : loc.location_name} (First Visit)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {loadingLocations && <div className="h-9 animate-pulse rounded-xl bg-slate-100" />}

            {/* Prompt to select office if not selected */}
            {!selected && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3 text-center">
                <p className="text-[11px] sm:text-xs text-slate-500">
                  👆 Select your assigned Office / Branch above to activate live GPS check.
                </p>
              </div>
            )}

            {/* Live Phone GPS Status Bar after selecting office */}
            {selected && (
              <div className="space-y-2.5 pt-1">
                {!fix ? (
                  <div className="rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/50 p-4 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-sky-600 text-white shadow-xs">
                      <Navigation className="h-5 w-5 animate-pulse" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                      {geoPermission === "denied" ? "Location Access Blocked" : "Live GPS Permission Needed"}
                    </h3>
                    <p className="mx-auto mt-1 max-w-md text-[11px] text-slate-500 leading-relaxed">
                      {geoError ||
                        "To verify genuine field visits, Mehar DVR requires real-time device GPS access."}
                    </p>

                    <div className="mt-3 flex flex-wrap justify-center items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          retryGps();
                          toast.info("Requesting live satellite GPS…", { duration: 2500 });
                        }}
                        className="font-bold shadow-xs bg-sky-600 hover:bg-sky-700 text-white px-3.5 h-8.5 gap-1.5 text-xs rounded-xl"
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        {geoPermission === "denied" ? "Retry GPS Access" : "Allow Live GPS"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          useFallbackLocation();
                          toast.success("Using estimated network location coordinates.");
                        }}
                        className="font-semibold px-3 h-8.5 gap-1.5 text-xs border-slate-200 rounded-xl"
                      >
                        <MapPin className="h-3.5 w-3.5 text-sky-600" />
                        Use Estimated Location
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Navigation className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="font-bold text-emerald-800 text-[11px] sm:text-xs">
                          Live Satellite GPS:
                        </span>
                        <span className="font-mono text-[10.5px] sm:text-xs text-slate-700 font-semibold">
                          {fix.latitude.toFixed(5)}, {fix.longitude.toFixed(5)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {accuracyOk ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9.5px] sm:text-[10px] font-bold text-emerald-800 border border-emerald-300/60">
                            ✓ ±{Math.round(fix.accuracy)}m Accuracy
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9.5px] sm:text-[10px] font-bold text-amber-800 border border-amber-300 animate-pulse">
                            ⏳ Refining (±{Math.round(fix.accuracy)}m)…
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            retryGps();
                            toast.info("Re-locking high-precision GPS…");
                          }}
                          className="h-6 px-1.5 text-[10px] font-bold text-slate-600 hover:text-slate-900"
                        >
                          <RefreshCw className="h-2.5 w-2.5 mr-1" /> Refresh
                        </Button>
                      </div>
                    </div>

                    {liveAddress && (
                      <p className="text-[10.5px] sm:text-xs text-slate-600 font-medium flex items-center gap-1 pt-1 border-t border-emerald-200/60 truncate">
                        <MapPin className="h-3 w-3 text-amber-600 shrink-0" />
                        <span className="font-bold text-slate-800 shrink-0">Resolved:</span>
                        <span className="truncate">{liveAddress}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Distance & First Visit Status Banners */}
            {selected && isApprovedOffice && fix && distance != null && (
              <div
                className={cn(
                  "rounded-xl border p-3 text-xs transition-all",
                  distanceOk
                    ? "border-emerald-200 bg-emerald-50/70 text-slate-800"
                    : "border-rose-200 bg-rose-50/70 text-rose-800",
                )}
              >
                {distanceOk ? (
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-emerald-800 text-xs sm:text-sm">
                        Approved Office Recognized (Within 100m)
                      </p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Live GPS is <strong>{formatDistance(distance)}</strong> from office location. Previously approved owner details will be loaded.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-rose-800 text-xs sm:text-sm">
                        Outside 100-Meter Radius
                      </p>
                      <p className="text-[11px] text-rose-700 mt-0.5">
                        You are <strong>{formatDistance(distance)}</strong> away. Daily visit reports are only allowed within {radiusLimit}m.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selected && isFirstVisit && fix && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs animate-fade-up">
                <div className="flex items-start gap-2">
                  <Satellite className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-900 text-xs sm:text-sm">
                      First Visit to this Office — Live GPS Captured
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      📍 You will enter owner & office details on Step 2. Admin will review and lock the 100m fixed radius.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Map View */}
          {selected && (
            <div id="location-map-card" className="rounded-2xl border border-slate-100 bg-white/95 p-3.5 sm:p-4 shadow-xs">
              <div className="mb-2.5 flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-900 flex items-center gap-1.5 text-[11px] sm:text-xs">
                  <Navigation className="h-3.5 w-3.5 text-sky-600" />
                  Satellite Map Radar
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10.5px] font-bold rounded-lg border-slate-200"
                  onClick={() => {
                    retryGps();
                    toast.info("Updating live satellite signal…");
                  }}
                >
                  <RefreshCw className="mr-1 h-2.5 w-2.5" /> Refresh
                </Button>
              </div>

              {/* 2-Point Legend */}
              <div className="mb-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                <div className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50/50 p-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[10px] font-bold text-white">
                    🏢
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-[10.5px] sm:text-xs truncate">
                      Point 1: Visit Destination
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {[selected.company_name, selected.location_name].filter(Boolean).join(" — ")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                    📍
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-[10.5px] sm:text-xs truncate">
                      Point 2: Your Live Location
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {fix ? `${fix.latitude.toFixed(5)}, ${fix.longitude.toFixed(5)}` : "Acquiring GPS…"}
                    </p>
                  </div>
                </div>
              </div>

              <LocationMap
                className="h-60 sm:h-72 w-full rounded-xl overflow-hidden border border-slate-200"
                fit
                center={fix ? [fix.latitude, fix.longitude] : [selected.latitude, selected.longitude]}
                zoom={16}
                markers={[
                  {
                    id: "destination-office",
                    lat: selected.latitude,
                    lng: selected.longitude,
                    title: `🏢 ${[selected.company_name, selected.location_name].filter(Boolean).join(" — ")}`,
                    subtitle: isApprovedOffice ? `Approved Fixed Office (${radiusLimit}m Geo-fence)` : "Proposed Visit Destination",
                    tone: "primary" as const,
                    label: "🏢",
                  },
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
                  {
                    id: "destination-geofence",
                    lat: selected.latitude,
                    lng: selected.longitude,
                    radius: radiusLimit,
                    tone: isApprovedOffice ? "primary" : "muted",
                  },
                ]}
              />

              {distance != null && (
                <div className="mt-2 flex items-center justify-between text-xs px-1">
                  <span className="text-slate-500 text-[10.5px] sm:text-xs">
                    📏 Distance: <strong className="text-slate-800">{formatDistance(distance)}</strong>
                  </span>
                  {isApprovedOffice && (
                    <span className={cn("font-bold px-2 py-0.5 rounded-full text-[10px]", distanceOk ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800")}>
                      {distanceOk ? "✓ Inside 100m" : `⚠️ Outside ${radiusLimit}m`}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Continue to Step 2 Button */}
          <div className="flex justify-end pt-1">
            <Button
              size="default"
              disabled={!canContinueStep1}
              onClick={() => setStep(1)}
              className="h-10 px-5 text-xs sm:text-sm font-bold rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-xs"
            >
              Continue to Step 2 <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {/* Step 1: Office Details & Photo Proof */}
      {step === 1 && selected && (
        <section className="space-y-3 sm:space-y-3.5 animate-fade-up">
          <div className="rounded-2xl border border-slate-100 bg-white/95 p-3.5 sm:p-5 shadow-xs backdrop-blur-md space-y-3">
            {/* Header with Title and Status Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-0.5">
              <h2 className="font-display text-xs sm:text-sm md:text-base font-extrabold flex items-center gap-1.5 text-slate-900 leading-tight">
                <Camera className="h-4 w-4 text-sky-600 shrink-0" />
                <span>2. Office Details & Photo Proof</span>
              </h2>
              <span
                className={cn(
                  "w-fit rounded-lg px-2 py-0.5 text-[9.5px] sm:text-[10.5px] font-bold shrink-0",
                  !isFirstVisit
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                    : "bg-amber-50 text-amber-800 border border-amber-200/80",
                )}
              >
                {!isFirstVisit ? "✓ Approved Office" : "⚡ 1st Visit (Requires Admin Approval)"}
              </span>
            </div>

            {/* Selected Office Info Tile */}
            <div className="rounded-xl bg-sky-50/70 border border-sky-100 p-3 text-xs space-y-1">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-xs sm:text-sm">
                    {[selected.company_name, selected.location_name].filter(Boolean).join(" — ")}
                  </p>
                  {selected.address && (
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{selected.address}</p>
                  )}
                </div>
              </div>
              {isApprovedOffice && distance != null && (
                <p className="text-[10.5px] text-emerald-700 font-semibold flex items-center gap-1 pl-5">
                  <CheckCircle2 className="h-3 w-3" /> Matched within 100m radius ({formatDistance(distance)} from approved location)
                </p>
              )}
              {isFirstVisit && (
                <p className="text-[10.5px] text-amber-800 font-semibold flex items-center gap-1 pl-5">
                  <Satellite className="h-3 w-3" /> First-time visit: Captured live GPS will be sent to Admin Sir for 100m radius approval.
                </p>
              )}
            </div>

            {/* Office Details Form */}
            <div className="space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:p-3.5">
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                  {isFirstVisit ? "Office & Owner Details (Enter for 1st Visit Setup)" : "Office & Owner Information (Approved Record)"}
                </p>
                <p className="text-[10.5px] sm:text-xs text-slate-500 mt-0.5">
                  {isFirstVisit
                    ? "Please enter Owner Name, 10-digit Mobile Number, and Description for Admin Sir's review."
                    : "Verified details loaded from official approval record."}
                </p>
              </div>

              {isFirstVisit ? (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="pd-desc" className="text-[11px] sm:text-xs font-bold text-slate-700">
                      Office Description <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="pd-desc"
                      rows={2}
                      value={officeDetails.description}
                      onChange={(e) => setOfficeDetails({ ...officeDetails, description: e.target.value })}
                      placeholder="e.g. Branch office providing loan consultations and document verification."
                      className="text-xs bg-white rounded-xl border-slate-200 min-h-[56px]"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="pd-owner" className="text-[11px] sm:text-xs font-bold text-slate-700">
                      Owner / Contact Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="pd-owner"
                      maxLength={80}
                      value={officeDetails.ownerName}
                      onChange={(e) => setOfficeDetails({ ...officeDetails, ownerName: e.target.value })}
                      placeholder="e.g. Dr. R. K. Sharma / Branch Head"
                      className="h-8.5 text-xs bg-white rounded-xl border-slate-200"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="pd-number" className="text-[11px] sm:text-xs font-bold text-slate-700">
                      Owner Mobile Number (10 digits) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="pd-number"
                      maxLength={15}
                      value={officeDetails.ownerNumber}
                      onChange={(e) => setOfficeDetails({ ...officeDetails, ownerNumber: e.target.value })}
                      placeholder="e.g. 9829012345"
                      className="h-8.5 text-xs bg-white rounded-xl border-slate-200"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200/80 bg-white p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Verified Owner:</span>
                    <span className="font-bold text-slate-800">{selected.owner_name || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Contact Number:</span>
                    <span className="font-bold text-slate-800">{selected.owner_number || "—"}</span>
                  </div>
                  {selected.company_description && (
                    <div className="pt-1.5 border-t border-slate-100">
                      <span className="text-slate-500">Description: </span>
                      <span className="text-slate-800 font-medium">{selected.company_description}</span>
                    </div>
                  )}
                </div>
              )}

              {isFirstVisit && !hasValidOfficeDetails && (
                <div className="rounded-xl bg-amber-50 p-2.5 text-[11px] text-amber-800 border border-amber-200/80 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>Please fill Owner Name, 10-digit Mobile Number, and Description before opening camera.</span>
                </div>
              )}
            </div>

            {/* Photo Capture Section */}
            {photo ? (
              <div className="space-y-2">
                <img
                  src={photo.rawDataUrl}
                  alt="Captured visit proof"
                  className="w-full rounded-2xl border border-slate-200 object-cover max-h-60"
                />
                <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-1.5 text-[10.5px] sm:text-xs text-slate-600 border border-slate-100">
                  <span>
                    ✓ Photo captured at{" "}
                    <strong>
                      {new Date(photo.takenAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </strong>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-[11px] rounded-lg font-bold border-slate-200"
                    onClick={() => setCameraOpen(true)}
                  >
                    <RefreshCw className="mr-1 h-3 w-3" /> Retake
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
                  "flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-5 sm:py-6 text-center transition",
                  !blockReason
                    ? "border-sky-300 bg-sky-50/40 hover:bg-sky-50/80 cursor-pointer"
                    : "border-slate-200 bg-slate-50/50 opacity-70 cursor-not-allowed",
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full shadow-xs",
                    !blockReason ? "bg-gradient-to-br from-sky-500 to-blue-600 text-white" : "bg-slate-200 text-slate-400",
                  )}
                >
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900">
                    {!blockReason ? "Open Camera & Click Photo" : "Camera Locked"}
                  </p>
                  <p className="mt-0.5 text-[10.5px] sm:text-xs text-slate-500">
                    {!blockReason ? "Capture live photo proof with on-site GPS watermark" : blockReason}
                  </p>
                </div>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(0)}
              className="h-9 px-3.5 text-xs font-bold rounded-xl border-slate-200"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
            </Button>
            <Button
              size="sm"
              disabled={!photo || (isFirstVisit && !hasValidOfficeDetails)}
              onClick={() => setStep(2)}
              className="h-9 px-4 text-xs font-bold rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-xs"
            >
              Continue to Step 3 <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </section>
      )}

      {/* Step 2: Purpose & Submit */}
      {step === 2 && selected && (
        <section className="space-y-3 sm:space-y-3.5 animate-fade-up">
          <div className="rounded-2xl border border-slate-100 bg-white/95 p-3.5 sm:p-5 shadow-xs backdrop-blur-md space-y-3">
            <h2 className="font-display text-xs sm:text-sm md:text-base font-extrabold flex items-center gap-1.5 text-slate-900 leading-tight">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>3. Complete Daily Visit Report</span>
            </h2>

            {/* Visit Summary Card */}
            <div className="flex items-start gap-2.5 rounded-xl bg-sky-50/70 border border-sky-100 p-3 text-xs">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
              <div className="min-w-0">
                <p className="font-bold text-slate-900 text-xs sm:text-sm">
                  {[selected.company_name, selected.location_name].filter(Boolean).join(" — ")}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Owner: <strong>{officeDetails.ownerName || selected.owner_name}</strong> ({officeDetails.ownerNumber || selected.owner_number})
                </p>
                {photo && (
                  <p className="mt-0.5 text-[10.5px] text-slate-600 font-mono">
                    Live GPS: {photo.latitude.toFixed(5)}, {photo.longitude.toFixed(5)} (±{Math.round(photo.accuracy)}m)
                  </p>
                )}
              </div>
            </div>

            {photo && (
              <img
                src={photo.rawDataUrl}
                alt="Captured visit proof"
                className="max-h-44 w-full rounded-xl border border-slate-200 object-cover"
              />
            )}

            <div className="space-y-2.5">
              <div className="space-y-1">
                <Label htmlFor="purpose" className="text-[11px] sm:text-xs font-bold text-slate-700">
                  Visit Purpose <span className="text-destructive">*</span>
                </Label>
                <Select value={purpose} onValueChange={setPurpose}>
                  <SelectTrigger id="purpose" className="h-9 text-xs bg-white rounded-xl border-slate-200">
                    <SelectValue placeholder="Select purpose of this visit…" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {VISIT_PURPOSES.map((p) => (
                      <SelectItem key={p} value={p} className="text-xs">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {purpose === "Other" && (
                <div className="space-y-1 animate-fade-up">
                  <Label htmlFor="custom-purpose" className="text-[11px] sm:text-xs font-bold text-slate-700">
                    Describe Purpose <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="custom-purpose"
                    value={customPurpose}
                    onChange={(e) => setCustomPurpose(e.target.value)}
                    placeholder="e.g. Document collection, manager meeting, etc."
                    maxLength={120}
                    className="h-8.5 text-xs bg-white rounded-xl border-slate-200"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="remarks" className="text-[11px] sm:text-xs font-bold text-slate-700">
                  Remarks (Optional)
                </Label>
                <Textarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Notes about discussion, client feedback, next follow-up…"
                  rows={2}
                  className="text-xs bg-white rounded-xl border-slate-200 min-h-[56px]"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2 text-[11px] sm:text-xs text-slate-600">
            <Navigation className="mr-1.5 inline h-3.5 w-3.5 text-sky-600" />
            Submitting as <strong>{session?.profile?.name || "Employee"}</strong> ({session?.profile?.employee_id || "MEH001"})
            at <strong>{[selected.company_name, selected.location_name].filter(Boolean).join(" — ")}</strong>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(1)}
              disabled={submit.isPending}
              className="h-9 px-3.5 text-xs font-bold rounded-xl border-slate-200"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Step 2
            </Button>
            <Button
              size="sm"
              className="h-9 px-4 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-xs"
              disabled={submit.isPending || !finalPurpose}
              onClick={() => {
                if (!finalPurpose) {
                  toast.error("Please select or enter a visit purpose");
                  return;
                }
                submit.mutate();
              }}
            >
              {submit.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Submit Visit Report 🚀
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
        <DialogContent className="w-[calc(100vw-28px)] max-w-lg sm:max-w-xl max-h-[85vh] overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 rounded-3xl border border-sky-100/90 bg-white/98 shadow-2xl backdrop-blur-xl box-border">
          <DialogHeader className="mb-2.5 pr-7 text-left space-y-0.5">
            <div className="inline-flex items-center gap-1 text-[9.5px] font-extrabold uppercase tracking-wider text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200/70 w-fit">
              <Sparkles className="h-2.5 w-2.5 text-amber-500 shrink-0" />
              <span>Amazon Place Finder</span>
            </div>
            <DialogTitle className="font-display text-sm sm:text-base font-extrabold text-slate-900 leading-tight pt-0.5">
              Add New Office / Client Location
            </DialogTitle>
            <p className="text-[10.5px] sm:text-xs text-slate-500 leading-tight">
              Search name or pin GPS to register client office.
            </p>
          </DialogHeader>

          {/* Amazon Place Search Bar */}
          <div className="space-y-2 rounded-2xl border border-sky-100 bg-sky-50/40 p-2.5 sm:p-3">
            <Label className="text-[10px] sm:text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <Search className="h-3 w-3 text-sky-600 shrink-0" />
              <span>Search Place or Landmark</span>
            </Label>
            <div className="flex gap-1.5">
              <div className="relative flex-1 min-w-0">
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
                  placeholder="Search company, landmark, area…"
                  className="pr-7 bg-white h-8 text-xs rounded-xl border-slate-200"
                  autoFocus
                />
                {isSearchingPlaces && (
                  <Loader2 className="absolute right-2 top-2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => searchAmazonPlaces(placeQuery)}
                disabled={isSearchingPlaces}
                className="font-bold gap-1 shrink-0 h-8 px-2.5 text-[11px] rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-xs"
              >
                <Search className="h-3 w-3" /> Search
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
                className="w-full text-[10.5px] sm:text-xs font-bold gap-1.5 border-emerald-500/30 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 py-1.5 px-2.5 h-auto rounded-xl flex items-center justify-between"
              >
                <div className="flex items-center gap-1 truncate">
                  <Navigation className="h-3 w-3 text-emerald-600 shrink-0" />
                  <span className="truncate">Pin Live GPS</span>
                </div>
                <span className="font-mono text-[9.5px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-md shrink-0">
                  {fix.latitude.toFixed(4)}, {fix.longitude.toFixed(4)}
                </span>
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
                          toast.error(formatErrorMessage(err));
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
