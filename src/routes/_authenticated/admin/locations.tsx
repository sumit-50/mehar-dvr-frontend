import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Navigation, Pencil, Plus, RefreshCw, Search, Sparkles, Trash2 } from "lucide-react";
import {
  adminApproveLocation,
  adminDeleteLocation,
  adminGetLocations,
  adminRejectLocation,
  adminSetLocationStatus,
  adminUpsertLocation,
} from "@/lib/admin.functions";
import { searchPlaces, type PlaceSearchResult } from "@/lib/dvr.functions";
import { locationSchema, type LocationInput } from "@/lib/schemas";
import { DEFAULT_RADIUS_METERS, fetchLiveAddress } from "@/lib/geo";
import { AdminOnly } from "@/components/AdminOnly";
import { LocationMap } from "@/components/LocationMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { LocationWithStats } from "@/lib/dvr-types";

export const Route = createFileRoute("/_authenticated/admin/locations")({
  head: () => ({
    meta: [
      { title: "Manage Locations — Mehar DVR" },
      { name: "description", content: "Add, edit and deactivate fixed visit locations." },
      { property: "og:title", content: "Manage Locations — Mehar DVR" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AdminLocationsPage,
});

interface FormState {
  id?: string;
  company_name: string;
  location_name: string;
  location_code: string;
  address: string;
  company_description: string;
  owner_name: string;
  owner_number: string;
  latitude: string;
  longitude: string;
  allowed_radius: string;
  status: "active" | "inactive";
}

const emptyForm: FormState = {
  company_name: "",
  location_name: "",
  location_code: "",
  address: "",
  company_description: "",
  owner_name: "",
  owner_number: "",
  latitude: "26.8910",
  longitude: "75.7730",
  allowed_radius: String(DEFAULT_RADIUS_METERS),
  status: "active",
};

function AdminLocationsPage() {
  const queryClient = useQueryClient();
  const { data: locations, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-locations"],
    queryFn: async (): Promise<LocationWithStats[]> => {
      const locMap = new Map<string, LocationWithStats>();

      try {
        const res = await adminGetLocations({});
        if (Array.isArray(res)) {
          for (const l of res) {
            if (l?.id) locMap.set(l.id, l);
          }
        }
      } catch (err) {
        console.warn("adminGetLocations notice:", err);
      }

      try {
        const { apiFetch } = await import("@/lib/api-client");
        const restLocs = await apiFetch("/admin/locations");
        if (Array.isArray(restLocs)) {
          for (const r of restLocs) {
            if (r?.id && !locMap.has(r.id)) {
              locMap.set(r.id, {
                id: r.id,
                company_name: "Mehar Advisory",
                location_name: r.name,
                location_code: (r.name || "LOC").slice(0, 6).toUpperCase(),
                address: r.address || "—",
                company_description: "",
                owner_name: "",
                owner_number: "",
                latitude: Number(r.latitude) || 26.8910,
                longitude: Number(r.longitude) || 75.7730,
                allowed_radius: Number(r.radius_meters) || 100,
                status: r.is_active ? "active" : "inactive",
                submitted_by: null,
                created_by: r.created_by || null,
                created_at: r.created_at || new Date().toISOString(),
                updated_at: r.updated_at || new Date().toISOString(),
                total_visits: 0,
              });
            }
          }
        }
      } catch (restErr) {
        console.warn("REST /admin/locations notice:", restErr);
      }

      return Array.from(locMap.values());
    },
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LocationWithStats | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([]);
  const [fetchingLiveGps, setFetchingLiveGps] = useState(false);

  const fetchLiveDeviceGps = (customForm?: FormState) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setFetchingLiveGps(true);

    const applyCoords = async (pos: GeolocationPosition) => {
      setFetchingLiveGps(false);
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const latStr = lat.toFixed(6);
      const lngStr = lng.toFixed(6);
      let liveAddr = "";
      try {
        liveAddr = await fetchLiveAddress(lat, lng);
      } catch {}

      setForm((prev) => {
        const current = prev || customForm || { ...emptyForm };
        return {
          ...current,
          latitude: latStr,
          longitude: lngStr,
          address: liveAddr || current.address || "Live Location",
        };
      });
      toast.success(`📍 Precise GPS fetched: ${latStr}, ${lngStr} (±${Math.round(pos.coords.accuracy)}m)`);
    };

    navigator.geolocation.getCurrentPosition(
      applyCoords,
      (err) => {
        console.warn("[Locations] High accuracy GPS notice, retrying with standard:", err);
        navigator.geolocation.getCurrentPosition(
          applyCoords,
          (fallbackErr) => {
            setFetchingLiveGps(false);
            toast.error(`GPS Error: ${fallbackErr.message || err.message}. Please allow location access.`);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
        );
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 5000 }
    );
  };

  const searchAmazonPlaces = async (query: string) => {
    if (!query || query.trim().length < 2) return;
    setIsSearchingPlaces(true);
    try {
      const results = await searchPlaces({
        data: {
          query: query.trim(),
          biasLat: 26.9124,
          biasLng: 75.7873,
        },
      });
      setPlaceResults(results || []);
    } catch (e: any) {
      console.warn("[Admin Place Search]", e);
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-locations"] }),
      queryClient.invalidateQueries({ queryKey: ["office-options"] }),
      queryClient.invalidateQueries({ queryKey: ["my-locations"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-employees"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-visits"] }),
    ]);
  };

  const approve = useMutation({
    mutationFn: (id: string) => adminApproveLocation({ data: { id } }),
    onSuccess: async () => {
      toast.success("Location approved & fixed under 100m radius");
      await invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Approval failed"),
  });

  const reject = useMutation({
    mutationFn: (id: string) => adminRejectLocation({ data: { id } }),
    onSuccess: async () => {
      toast.success("Location request rejected");
      await invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Rejection failed"),
  });

  const save = useMutation({
    mutationFn: (payload: LocationInput) => adminUpsertLocation({ data: payload }),
    onSuccess: async () => {
      toast.success("Location saved");
      setForm(null);
      await invalidate();
    },
    onError: (err) => setFormError(err instanceof Error ? err.message : "Save failed"),
  });

  const setStatus = useMutation({
    mutationFn: (vars: { id: string; status: "active" | "inactive" }) =>
      adminSetLocationStatus({ data: vars }),
    onSuccess: async () => {
      toast.success("Status updated");
      await invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => adminDeleteLocation({ data: { id } }),
    onSuccess: async () => {
      toast.success("Location deleted");
      setPendingDelete(null);
      await invalidate();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setPendingDelete(null);
    },
  });

  function openEdit(loc: LocationWithStats) {
    setFormError(null);
    setForm({
      id: loc.id,
      company_name: loc.company_name || "",
      location_name: loc.location_name,
      location_code: loc.location_code,
      address: loc.address,
      company_description: loc.company_description || "",
      owner_name: loc.owner_name || "",
      owner_number: loc.owner_number || "",
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
      allowed_radius: String(loc.allowed_radius),
      status: loc.status === "inactive" ? "inactive" : "active",
    });
  }

  function submitForm() {
    if (!form) return;
    setFormError(null);
    const candidate = {
      id: form.id,
      company_name: form.company_name,
      location_name: form.location_name,
      location_code: form.location_code,
      address: form.address,
      company_description: form.company_description,
      owner_name: form.owner_name,
      owner_number: form.owner_number,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      allowed_radius: Number(form.allowed_radius),
      status: form.status,
    };
    const parsed = locationSchema.safeParse(candidate);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    save.mutate(parsed.data);
  }

  const formLat = Number(form?.latitude);
  const formLng = Number(form?.longitude);
  const formHasCoords = Number.isFinite(formLat) && Number.isFinite(formLng);

  const pendingList = (locations ?? []).filter((l) => l.status === "pending");
  const approvedList = (locations ?? []).filter((l) => l.status !== "pending");

  return (
    <AdminOnly>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 animate-fade-up">
          <div>
            <h1 className="font-display text-2xl font-bold">Locations</h1>
            <p className="text-sm text-muted-foreground">
              {(locations ?? []).length} total locations · {(approvedList).length} active/fixed
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetch();
                toast.success("Locations refreshed!");
              }}
              disabled={isFetching}
              className="font-semibold text-xs h-9 gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-primary" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={() => {
                setFormError(null);
                const fresh = { ...emptyForm };
                setForm(fresh);
                fetchLiveDeviceGps(fresh);
              }}
              className="font-semibold text-xs h-9 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Add Location
            </Button>
          </div>
        </div>

        {/* Pending Employee Submissions Awaiting Admin Approval */}
        {pendingList.length > 0 && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 shadow-soft animate-fade-up">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Office Location Requests ({pendingList.length})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Employee submitted these office GPS & details. Review and approve to permanently fix the location under 100m radius.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {pendingList.map((loc) => (
                <div
                  key={loc.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-foreground text-sm">
                          {loc.company_name ? `${loc.company_name} — ` : ""}{loc.location_name}
                        </p>
                        <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          Pending GPS Approval
                        </span>
                      </div>
                      <p>
                        <strong className="text-foreground">Captured GPS:</strong> {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                    <Button
                      size="sm"
                      className="flex-1 font-semibold"
                      disabled={approve.isPending}
                      onClick={() => approve.mutate(loc.id)}
                    >
                      {approve.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                      Approve & Fix (100m)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      disabled={reject.isPending}
                      onClick={() => reject.mutate(loc.id)}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Company & Office</th>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Coordinates</th>
                <th className="px-4 py-3 font-semibold">Radius</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Visits</th>
                <th className="px-4 py-3 font-semibold">Active</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(locations ?? []).map((loc) => (
                <tr key={loc.id} className="border-b border-border/60 last:border-0">
                  <td className="max-w-[240px] px-4 py-3">
                    <p className="truncate font-semibold">
                      {loc.company_name ? `${loc.company_name} — ${loc.location_name}` : loc.location_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {loc.owner_name
                        ? `Owner: ${loc.owner_name} ${loc.owner_number ? `(${loc.owner_number})` : ""}`
                        : loc.address || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{loc.location_code}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                  </td>
                  <td className="px-4 py-3">{loc.allowed_radius} m</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={loc.status === "active" ? "default" : "outline"}
                      className={
                        loc.status === "active"
                          ? "bg-success/15 text-success border-success/30"
                          : loc.status === "pending"
                            ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                            : "text-muted-foreground"
                      }
                    >
                      {loc.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{loc.total_visits}</td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={loc.status === "active"}
                      onCheckedChange={(on) =>
                        setStatus.mutate({ id: loc.id, status: on ? "active" : "inactive" })
                      }
                      aria-label={`Toggle ${loc.location_name}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(loc)} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setPendingDelete(loc)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {locations && locations.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No locations yet — add your first fixed location.
            </p>
          )}
        </div>

        {/* Add / edit dialog */}
        <Dialog
          open={form !== null}
          onOpenChange={(open) => {
            if (!open) {
              setForm(null);
              setPlaceResults([]);
              setPlaceQuery("");
            }
          }}
        >
          <DialogContent className="max-h-[92vh] overflow-y-auto overflow-x-hidden w-full max-w-[95vw] sm:max-w-2xl md:max-w-3xl p-5 sm:p-7 rounded-2xl shadow-xl box-border">
            <DialogHeader className="pr-6">
              <DialogTitle className="font-display text-xl font-bold">{form?.id ? "Edit Office / Location" : "Add Office / Location"}</DialogTitle>
            </DialogHeader>
            {form && (
              <div className="space-y-4">
                {/* Live GPS Auto-Detection Hero Banner */}
                <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-card p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 font-bold text-white shadow-md shadow-emerald-500/20">
                      <Navigation className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        Live GPS Auto-Detection
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                          Live Device GPS
                        </span>
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Only enter Office/Company Name. Click below to fetch your real live coordinates automatically.
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => fetchLiveDeviceGps(form)}
                    disabled={fetchingLiveGps}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 shrink-0 gap-1.5 h-9"
                  >
                    {fetchingLiveGps ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Navigation className="h-4 w-4" />
                    )}
                    {fetchingLiveGps ? "Fetching Live GPS..." : "📍 Fetch My Live Location"}
                  </Button>
                </div>

                {/* Quick Presets for Company */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Quick Company Presets</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { name: "MAPL", code: "MAPL-JPR", loc: "Jaipur" },
                      { name: "SRK Group of Hospitals", code: "SRK-HOSP-JPR", loc: "Jaipur" },
                      { name: "Mehar Advisory", code: "MEH-HQ", loc: "Head Office" },
                      { name: "HDFC Bank", code: "HDFC-JPR", loc: "Vaishali Nagar" },
                    ].map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setForm({
                            ...form,
                            company_name: preset.name,
                            location_name: form.location_name || preset.loc,
                            location_code: form.location_code || preset.code,
                          });
                        }}
                        className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                      >
                        + {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amazon Location Places Search Box */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2.5">
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
                        className="pr-8 bg-background h-9 text-xs"
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
                      className="font-semibold gap-1 shrink-0 h-9"
                    >
                      <Search className="h-3.5 w-3.5" /> Search
                    </Button>
                  </div>

                  {/* Search Suggestions */}
                  {placeResults.length > 0 && (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg border border-border bg-background p-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
                        Amazon Location Matches ({placeResults.length}):
                      </p>
                      {placeResults.map((r, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const comp = r.label.split(",")[0] || "";
                            const cleanCode = comp.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || "OFF";
                            setForm({
                              ...form,
                              company_name: comp,
                              location_name: r.label.split(",")[1]?.trim() || comp,
                              location_code: form.location_code || `${cleanCode}-JPR`,
                              address: r.address || r.label,
                              latitude: r.latitude.toFixed(6),
                              longitude: r.longitude.toFixed(6),
                            });
                            setPlaceResults([]);
                            toast.success(`Selected: ${r.label}`);
                          }}
                          className="w-full text-left p-2 rounded-lg hover:bg-accent/80 transition-colors flex items-start gap-2 text-xs border border-transparent hover:border-border"
                        >
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground truncate">{r.label}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{r.address}</p>
                            <span className="text-[10px] font-mono text-primary/80">
                              GPS: {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="loc-comp">Company / Org Name</Label>
                    <Input
                      id="loc-comp"
                      value={form.company_name}
                      onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                      placeholder="e.g. MAPL or SRK Group of Hospitals"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="loc-name">Office / Branch Name</Label>
                    <Input
                      id="loc-name"
                      value={form.location_name}
                      onChange={(e) => setForm({ ...form, location_name: e.target.value })}
                      placeholder="e.g. Jaipur or Swej Farm Branch"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="loc-code">Office Code</Label>
                    <Input
                      id="loc-code"
                      value={form.location_code}
                      onChange={(e) => setForm({ ...form, location_code: e.target.value.toUpperCase() })}
                      placeholder="e.g. MAPL-JPR or SRK-MAX-JPR"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="loc-address">Address</Label>
                    <Input
                      id="loc-address"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="Street, area, city (e.g. Jaipur)"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="loc-owner-name">Owner / Contact Name</Label>
                    <Input
                      id="loc-owner-name"
                      value={form.owner_name}
                      onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                      placeholder="e.g. Mehar Advisory"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="loc-owner-number">Owner / Contact Number</Label>
                    <Input
                      id="loc-owner-number"
                      value={form.owner_number}
                      onChange={(e) => setForm({ ...form, owner_number: e.target.value })}
                      placeholder="e.g. 9829012345"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="loc-desc">Company Description</Label>
                  <Input
                    id="loc-desc"
                    value={form.company_description}
                    onChange={(e) => setForm({ ...form, company_description: e.target.value })}
                    placeholder="e.g. Financial advisory, consulting & client visit center"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="loc-lat">Latitude</Label>
                    <Input
                      id="loc-lat"
                      inputMode="decimal"
                      value={form.latitude}
                      onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="loc-lng">Longitude</Label>
                    <Input
                      id="loc-lng"
                      inputMode="decimal"
                      value={form.longitude}
                      onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5 sm:col-span-1">
                    <Label htmlFor="loc-radius">Radius (m)</Label>
                    <Input
                      id="loc-radius"
                      type="number"
                      min={10}
                      max={5000}
                      value={form.allowed_radius}
                      onChange={(e) => setForm({ ...form, allowed_radius: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> Click the map to set the fixed coordinates
                  </p>
                  <LocationMap
                    className="h-64 w-full"
                    center={formHasCoords ? [formLat, formLng] : undefined}
                    zoom={form.id ? 15 : 12}
                    onPick={(lat, lng) =>
                      setForm({ ...form, latitude: lat.toFixed(6), longitude: lng.toFixed(6) })
                    }
                    markers={
                      formHasCoords
                        ? [
                            {
                              id: "picked",
                              lat: formLat,
                              lng: formLng,
                              title: form.location_name || "New location",
                              tone: "primary",
                              label: "F",
                            },
                          ]
                        : []
                    }
                    circles={
                      formHasCoords
                        ? [
                            {
                              id: "radius",
                              lat: formLat,
                              lng: formLng,
                              radius: Number(form.allowed_radius) || DEFAULT_RADIUS_METERS,
                              tone: "primary",
                            },
                          ]
                        : []
                    }
                  />
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={form.status === "active"}
                    onCheckedChange={(on) => setForm({ ...form, status: on ? "active" : "inactive" })}
                  />
                  Active (employees can select in dropdown & submit visits)
                </label>

                {formError && (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {formError}
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setForm(null)}>
                    Cancel
                  </Button>
                  <Button onClick={submitForm} disabled={save.isPending} className="font-semibold">
                    {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save office
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {pendingDelete?.location_name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the location and any associated test visit records. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => pendingDelete && del.mutate(pendingDelete.id)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminOnly>
  );
}
