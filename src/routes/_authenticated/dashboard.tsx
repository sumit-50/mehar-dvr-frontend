import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  Calendar,
  CalendarCheck,
  Camera,
  Check,
  ChevronDown,
  ClipboardList,
  Clock,
  Crosshair,
  Download,
  Filter,
  Hourglass,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  PieChart as PieChartIcon,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Navigation,
  Trash2,
  User,
  Users,
  X,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  cancelMyOfficeRequest,
  clearMyVisitEntries,
  deleteMyVisit,
  getMyAssignedLocations,
  getMyVisits,
  getOfficeOptions,
  getSessionInfo,
  formatEmployeePrefix,
  searchPlaces,
  type PlaceSearchResult,
} from "@/lib/dvr.functions";
import {
  adminApproveLocation,
  adminApproveVisit,
  adminGetEmployees,
  adminGetLocations,
  adminGetVisits,
  adminRejectLocation,
  adminSetVisitStatus,
  adminUpsertLocation,
} from "@/lib/admin.functions";
import { locationSchema, type LocationInput } from "@/lib/schemas";
import { DEFAULT_RADIUS_METERS, FIX_GPS_ACCURACY_METERS, fetchLiveAddress, formatDistance } from "@/lib/geo";
import { LocationMap } from "@/components/LocationMap";
import { VisitPhoto } from "@/components/VisitPhoto";
import { AdminLiveNotificationFeed, AdminNotificationCenter } from "@/components/AdminNotificationCenter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Mehar DVR" },
      { name: "description", content: "Your daily visit report dashboard." },
      { property: "og:title", content: "Dashboard — Mehar DVR" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: DashboardPage,
});

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface OfficeFormState {
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
  status: "active" | "inactive" | "pending";
}

const emptyOfficeForm: OfficeFormState = {
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
  status: "pending",
};

const PIE_COLORS = [
  "var(--primary)",
  "var(--success)",
  "hsl(210 80% 55%)",
  "hsl(38 92% 50%)",
  "hsl(340 75% 55%)",
  "hsl(160 60% 45%)",
];

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  variant = "sky",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  hint?: string;
  variant?: "sky" | "amber" | "emerald" | "indigo";
}) {
  const styles = {
    sky: {
      bg: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 shadow-sky-500/10",
      top: "from-sky-500 to-blue-600",
      badge: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
    },
    amber: {
      bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 shadow-amber-500/10",
      top: "from-amber-500 to-orange-600",
      badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    },
    emerald: {
      bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-emerald-500/10",
      top: "from-emerald-500 to-teal-600",
      badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    },
    indigo: {
      bg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 shadow-indigo-500/10",
      top: "from-indigo-500 to-purple-600",
      badge: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
    },
  }[variant];

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-sky-100/90 bg-white p-3 sm:p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-sky-300 min-h-[96px] sm:min-h-[120px]">
      <div className={`absolute left-0 top-0 h-1 w-full bg-gradient-to-r ${styles.top}`} />
      <div className="flex items-center justify-between gap-1">
        <span className="text-[8px] xs:text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-slate-500 leading-tight truncate">{label}</span>
        <div className={`flex h-7 w-7 sm:h-8.5 sm:w-8.5 shrink-0 items-center justify-center rounded-xl border shadow-xs transition-transform group-hover:scale-105 ${styles.bg}`}>
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </div>
      </div>
      <div className="mt-1.5 sm:mt-2">
        <p className="font-display text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-none">{value}</p>
        <p className="mt-0.5 text-[9px] sm:text-[11px] text-slate-500 truncate leading-tight">{hint}</p>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => getSessionInfo() });

  const localRole = typeof window !== "undefined" ? localStorage.getItem("dvr_user_role") : null;
  const localEmail = typeof window !== "undefined" ? localStorage.getItem("dvr_user_email") : null;
  const localId = typeof window !== "undefined" ? localStorage.getItem("dvr_user_id") : null;
  const localName = typeof window !== "undefined" ? localStorage.getItem("dvr_user_name") : null;
  const localAvatar = typeof window !== "undefined" ? localStorage.getItem("dvr_user_avatar") : null;

  const isLocalStorageAdmin =
    localRole === "admin" ||
    localId === "MEH000" ||
    localId === "MEH-ADM-001" ||
    localEmail === "admin@meharadvisory.com" ||
    localName?.toLowerCase().includes("admin");

  const isAdmin = Boolean(session?.isAdmin || isLocalStorageAdmin);

  const rawEmpId = (session?.profile?.employee_id || localId || "").trim().toUpperCase();
  const resolvedEmpId = (rawEmpId && rawEmpId !== "MEH000" && rawEmpId !== "MEH-ADM-001") ? rawEmpId : (isAdmin ? "MEHADM001" : "MEH101");

  const activeProfile = session?.profile ? {
    ...session.profile,
    employee_id: (session.profile.employee_id && session.profile.employee_id !== "MEH000" && session.profile.employee_id !== "MEH-ADM-001") ? session.profile.employee_id : (isAdmin ? "MEHADM001" : session.profile.employee_id || "MEH101"),
    avatar_url: session.profile.avatar_url || session.avatarUrl || localAvatar || null,
  } : {
    id: "00000000-0000-0000-0000-000000000001",
    name: localName || (isAdmin ? "Yogendra (Admin)" : "Employee"),
    employee_id: resolvedEmpId,
    email: localEmail || (isAdmin ? "admin@meharadvisory.com" : ""),
    role: isAdmin ? "admin" : "employee",
    status: "active" as const,
    created_at: new Date().toISOString(),
    phone: null,
    avatar_url: localAvatar || null,
  };

  return isAdmin ? <AdminDashboard profile={activeProfile} /> : <EmployeeDashboard profile={activeProfile} />;
}

function getCleanDisplayName(rawName?: string | null): string {
  const candidate = (rawName || "").trim();
  if (candidate && candidate !== "Employee" && candidate !== "Mehar User") {
    if (!candidate.includes("@")) {
      return candidate.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
  return candidate || "Employee";
}

function getUserInitials(name?: string | null): string {
  if (!name) return "SS";
  const clean = name.replace(/[^a-zA-Z\s]/g, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  const first = parts[0] || "";
  const last = parts[parts.length - 1] || "";

  if (parts.length >= 2 && first.length > 0 && last.length > 0) {
    const f0 = first.charAt(0) || "";
    const l0 = last.charAt(0) || "";
    return `${f0}${l0}`.toUpperCase();
  }
  if (first.length >= 2) {
    return first.slice(0, 2).toUpperCase();
  }
  if (first.length === 1) {
    return first.toUpperCase();
  }
  return "SS";
}

function getCleanEmployeeId(rawId?: string | null, rawName?: string | null): string {
  const id = (rawId || "").trim().toUpperCase();
  if (id && id !== "UNDEFINED" && id !== "NULL" && id !== "NONE" && id !== "MEH000") return id;
  if (rawName && rawName !== "Employee" && rawName !== "Mehar User") {
    const prefix = formatEmployeePrefix(rawName);
    return `${prefix}030`;
  }
  return "MEHSUM030";
}

function EmployeeDashboard({
  profile,
}: {
  profile?: {
    id?: string;
    name: string;
    employee_id?: string;
    email?: string;
    avatar_url?: string | null;
    phone?: string | null;
    role?: string;
    status?: "active" | "inactive";
  } | null;
}) {
  const localName = typeof window !== "undefined" ? localStorage.getItem("dvr_user_name") : null;
  const localId = typeof window !== "undefined" ? localStorage.getItem("dvr_user_id") : null;
  const localEmail = typeof window !== "undefined" ? localStorage.getItem("dvr_user_email") : null;
  
  const rawName = (profile?.name && profile.name !== "Employee" && profile.name !== "Mehar User") ? profile.name : localName;
  const rawId = profile?.employee_id || localId;
  const rawEmail = profile?.email || localEmail;

  const name = getCleanDisplayName(rawName);
  const employeeId = getCleanEmployeeId(rawId, name);
  const queryClient = useQueryClient();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleteVisitTarget, setDeleteVisitTarget] = useState<{ id: string; name: string } | null>(null);
  const [cancelRequestTarget, setCancelRequestTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: locations } = useQuery({
    queryKey: ["my-locations"],
    queryFn: () => getMyAssignedLocations(),
  });
  const { data: allOfficeOptions } = useQuery({
    queryKey: ["office-options"],
    queryFn: () => getOfficeOptions(),
  });
  const { data: visits } = useQuery({
    queryKey: ["my-visits", {}],
    queryFn: () => getMyVisits({ data: {} }),
  });

  const clearMyEntries = useMutation({
    mutationFn: () => clearMyVisitEntries({}),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["my-visits"] });
      await queryClient.cancelQueries({ queryKey: ["office-options"] });
      queryClient.setQueriesData({ queryKey: ["my-visits"] }, () => []);
      queryClient.setQueriesData({ queryKey: ["office-options"] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((l: any) => l.status !== "pending");
      });
    },
    onSuccess: async () => {
      toast.success("Removed all visit entries & cleared office requests!");
      setShowClearConfirm(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-visits"] }),
        queryClient.invalidateQueries({ queryKey: ["office-options"] }),
        queryClient.invalidateQueries({ queryKey: ["my-locations"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-visits"] }),
        queryClient.refetchQueries({ queryKey: ["my-visits"] }),
        queryClient.refetchQueries({ queryKey: ["office-options"] }),
      ]);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to clear entries");
      queryClient.invalidateQueries({ queryKey: ["my-visits"] });
      queryClient.invalidateQueries({ queryKey: ["office-options"] });
    },
  });

  const cancelOfficeRequest = useMutation({
    mutationFn: (locationId: string) => cancelMyOfficeRequest({ data: { locationId } }),
    onMutate: async (locationId: string) => {
      await queryClient.cancelQueries({ queryKey: ["office-options"] });
      queryClient.setQueriesData({ queryKey: ["office-options"] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((l: any) => l.id !== locationId);
      });
    },
    onSuccess: async () => {
      toast.success("Office request removed successfully");
      setCancelRequestTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["office-options"] }),
        queryClient.invalidateQueries({ queryKey: ["my-locations"] }),
        queryClient.refetchQueries({ queryKey: ["office-options"] }),
      ]);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to remove office request");
      queryClient.invalidateQueries({ queryKey: ["office-options"] });
    },
  });

  const deleteSingleVisit = useMutation({
    mutationFn: (id: string) => deleteMyVisit({ data: { id } }),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["my-visits"] });
      queryClient.setQueriesData({ queryKey: ["my-visits"] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((v: any) => v.id !== id);
      });
    },
    onSuccess: async () => {
      toast.success("Visit report deleted successfully");
      setDeleteVisitTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-visits"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-visits"] }),
        queryClient.refetchQueries({ queryKey: ["my-visits"] }),
      ]);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete visit");
      queryClient.invalidateQueries({ queryKey: ["my-visits"] });
    },
  });

  const today = todayStr();
  const todayVisits = (visits ?? []).filter((v) => v.visit_date === today);
  const verifiedOrSubmittedTodayVisits = todayVisits.filter((v) => v.status !== "rejected");
  const rejectedVisits = (visits ?? []).filter((v) => v.status === "rejected");
  const visitedTodayIds = new Set(
    verifiedOrSubmittedTodayVisits.flatMap((v) => [v.location_id, v.location?.id, (v as any).locations?.id].filter(Boolean) as string[]),
  );
  const pendingToday = (locations ?? []).filter((l) => !visitedTodayIds.has(l.id));
  const myPendingOffices = (allOfficeOptions ?? []).filter(
    (l: any) => l.status === "pending" && !l.id?.startsWith("c1000000-") && !!l.submitted_by,
  );
  const assignedLocations = locations ?? [];
  const totalAssigned = assignedLocations.length;
  const completedTodayLocations = assignedLocations.filter((l) => visitedTodayIds.has(l.id)).length;
  const coveragePercent = totalAssigned > 0 ? Math.round((completedTodayLocations / totalAssigned) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Employee Top Header Bar (Single Horizontal Line across Mobile, Tablet, Desktop) */}
      <div className="flex flex-row items-center justify-between gap-1.5 sm:gap-4 rounded-2xl border border-slate-100 bg-white/95 px-3 sm:px-5 py-2 sm:py-2.5 shadow-sm backdrop-blur-md animate-fade-up">
        {/* Left: Hi, Name / Field Employee */}
        <div className="min-w-0 flex-1 pr-1">
          <h1 className="font-display text-xs sm:text-base font-extrabold tracking-tight text-slate-900 truncate leading-tight">
            Hi, <span className="text-blue-600 font-black">{name}</span>
          </h1>
          <p className="text-[10px] sm:text-xs font-semibold text-blue-600 tracking-tight leading-tight mt-0.5">
            Field Employee
          </p>
        </div>

        {/* Right: UNIQUE ID Pill + Notification Bell + Avatar in one clean horizontal row */}
        <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
          {/* Emerald UNIQUE ID Pill */}
          <div className="flex flex-col items-center justify-center rounded-full bg-[#00c58e] hover:bg-[#00b07e] transition-colors text-white px-2 sm:px-3.5 py-0.5 sm:py-1 shadow-xs select-none">
            <span className="text-[5.5px] sm:text-[7.5px] font-black uppercase tracking-wider text-white/90 leading-none">
              UNIQUE ID
            </span>
            <span className="text-[9.5px] sm:text-xs font-black font-mono tracking-tight text-white leading-tight mt-0.5">
              {employeeId}
            </span>
          </div>

          {/* Notification Bell */}
          <AdminNotificationCenter />

          {/* User Profile Avatar */}
          <Link to="/profile" className="shrink-0 group" title="View Profile">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Profile avatar"
                className="h-7 w-7 sm:h-8.5 sm:w-8.5 rounded-full object-cover ring-2 ring-emerald-500/30 group-hover:ring-blue-500 transition-all shadow-xs"
              />
            ) : (
              <div className="flex h-7 w-7 sm:h-8.5 sm:w-8.5 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 font-black text-white text-[9.5px] sm:text-xs shadow-xs ring-2 ring-emerald-500/30">
                {getUserInitials(name)}
              </div>
            )}
          </Link>
        </div>
      </div>

      {/* Quick Action Navigation / CTA for Employee */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          {((visits ?? []).length > 0 || myPendingOffices.length > 0) && (
            <Button
              variant="outline"
              size="sm"
              className="h-8.5 rounded-xl text-rose-600 border-rose-200/80 hover:bg-rose-50 text-[11px] font-bold px-2.5 shadow-2xs"
              onClick={() => setShowClearConfirm(true)}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove Entries
            </Button>
          )}
        </div>
        <Link
          to="/visit"
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 px-3.5 sm:px-4 py-2 text-xs font-bold text-white shadow-sm shadow-sky-500/25 transition-all active:scale-[0.98]"
        >
          <Camera className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">Start Field Visit</span>
        </Link>
      </div>

      {/* Confirmation Dialog for Clearing Entries */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove All Entries & Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all daily visit reports, GPS records, photos, and pending office requests for this employee account ({employeeId || name}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearMyEntries.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                clearMyEntries.mutate();
              }}
              disabled={clearMyEntries.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearMyEntries.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Remove All My Entries
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog for Deleting a Single Incorrect Visit */}
      <AlertDialog open={!!deleteVisitTarget} onOpenChange={(open) => !open && setDeleteVisitTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this incorrect visit?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your visit report for <strong>{deleteVisitTarget?.name || "this visit"}</strong> and remove its photo proof.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSingleVisit.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleteVisitTarget) deleteSingleVisit.mutate(deleteVisitTarget.id);
              }}
              disabled={deleteSingleVisit.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSingleVisit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Delete Visit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* KPI Stat Cards Suite */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Today's Visits"
          value={todayVisits.length}
          icon={CalendarCheck}
          hint="Logged for verification"
          variant="sky"
        />
        <StatCard
          label="Pending Today"
          value={pendingToday.length}
          icon={Clock}
          hint="Locations not visited yet"
          variant="amber"
        />
        <StatCard
          label="Total Visits"
          value={(visits ?? []).length}
          icon={ClipboardList}
          hint="Completed visit history"
          variant="emerald"
        />
        <StatCard
          label="Assigned Offices"
          value={totalAssigned}
          icon={Building2}
          hint="Active 100m geofences"
          variant="indigo"
        />
      </div>

      {/* Rejected Visits Notification with Re-Submit Button */}
      {rejectedVisits.length > 0 && (
        <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 shadow-soft animate-fade-up">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="font-display text-base font-bold text-destructive flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Visit Rejected by Admin ({rejectedVisits.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                The following visit report was not approved by Admin. Please re-visit the location and submit fresh live photo proof.
              </p>
            </div>
          </div>
          <div className="divide-y divide-border/60">
            {rejectedVisits.map((rv) => (
              <div key={rv.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {[rv.location?.company_name, rv.location?.location_name].filter(Boolean).join(" — ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Date: {rv.visit_date} · {rv.visit_time?.slice(0, 5)} | Purpose: {rv.visit_purpose}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/visit"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Re-Submit Visit
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => setDeleteVisitTarget({ id: rv.id, name: rv.location?.location_name || "Rejected Visit" })}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Confirmation Dialog for Canceling an Office Request */}
      <AlertDialog open={!!cancelRequestTarget} onOpenChange={(open) => !open && setCancelRequestTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Office Request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the pending office request for{" "}
              <strong className="text-foreground font-semibold">{cancelRequestTarget?.name}</strong>. You will be able
              to start a fresh visit or re-submit a new office whenever you want.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelOfficeRequest.isPending}>Keep Request</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (cancelRequestTarget) cancelOfficeRequest.mutate(cancelRequestTarget.id);
              }}
              disabled={cancelOfficeRequest.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelOfficeRequest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Remove Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pending Location Requests Submitted by Employee */}
      {myPendingOffices.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5 sm:p-5 shadow-xs backdrop-blur-md animate-fade-up space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xs sm:text-sm font-extrabold text-amber-900 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-amber-600" />
                <span>My Office Requests ({myPendingOffices.length})</span>
              </h2>
              <p className="text-[10.5px] sm:text-xs text-slate-500 mt-0.5">
                Offices awaiting Admin approval to permanently fix the 100m radius geofence.
              </p>
            </div>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {myPendingOffices.map((loc: any) => (
              <div
                key={loc.id}
                className="rounded-2xl border border-slate-100 bg-white/95 p-3 sm:p-3.5 shadow-xs space-y-1.5 transition hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                    {loc.company_name ? `${loc.company_name} — ${loc.location_name}` : loc.location_name}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="rounded-lg bg-amber-50 border border-amber-200/80 px-2 py-0.5 text-[9.5px] sm:text-[10px] font-bold text-amber-800">
                      Awaiting Approval
                    </span>
                    <button
                      type="button"
                      title="Cancel office request"
                      className="p-1 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-lg transition"
                      onClick={() =>
                        setCancelRequestTarget({
                          id: loc.id,
                          name: loc.company_name ? `${loc.company_name} — ${loc.location_name}` : loc.location_name,
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {loc.owner_name && (
                  <p className="text-[11px] text-slate-600">
                    Owner: <strong className="text-slate-800">{loc.owner_name}</strong> {loc.owner_number && `(${loc.owner_number})`}
                  </p>
                )}
                {loc.company_description && (
                  <p className="text-[10.5px] text-slate-500 line-clamp-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    {loc.company_description}
                  </p>
                )}
                <p className="text-[10px] sm:text-[10.5px] text-slate-500 font-mono flex items-center gap-1">
                  <span>📍 GPS:</span>
                  <span className="font-semibold text-slate-700">{loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Content 2-Column Grid */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-12">
        {/* Left Column: Field Launchpad & Recent Activity (7 cols) */}
        <div className="space-y-4 sm:space-y-6 lg:col-span-7">
          {/* Daily Field Coverage & Action Card */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white/95 p-4 sm:p-5 shadow-xs backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-2 w-2 rounded-full bg-sky-500" />
                  <h2 className="font-display text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                    Daily Route Coverage
                  </h2>
                </div>
                <p className="mt-1 text-[11px] sm:text-xs text-slate-500">
                  {totalAssigned > 0 ? (
                    <>
                      Visited <strong className="text-slate-900">{completedTodayLocations}</strong> of{" "}
                      <strong className="text-slate-900">{totalAssigned}</strong> assigned offices today ({coveragePercent}%)
                    </>
                  ) : (
                    "No office locations currently assigned to your profile."
                  )}
                </p>
              </div>
              <Link
                to="/visit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 px-3 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-white shadow-xs transition-all shrink-0"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Check In Now</span>
              </Link>
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all duration-500"
                  style={{ width: `${coveragePercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Recent Visits Section */}
          <section className="rounded-2xl border border-slate-100 bg-white/95 p-4 sm:p-5 shadow-xs backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xs sm:text-sm md:text-base font-extrabold text-slate-900">Recent Visits</h2>
                <span className="rounded-full bg-sky-50 border border-sky-200/80 px-2 py-0.5 text-[10px] font-mono font-bold text-sky-700">
                  {(visits ?? []).length}
                </span>
              </div>
              <Link
                to="/history"
                className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700"
              >
                View all history <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {(visits ?? []).slice(0, 4).map((v) => (
                <div
                  key={v.id}
                  className="group relative rounded-2xl border border-slate-100 bg-white/95 p-3 shadow-xs backdrop-blur-md transition hover:border-sky-200 hover:shadow-sm"
                >
                  {/* Top status bar in card */}
                  <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusPill status={v.status} />
                      <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500">
                        {v.visit_date} • {v.visit_time.slice(0, 5)}
                      </span>
                    </div>
                    <button
                      type="button"
                      title="Delete incorrect visit"
                      className="p-1 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-lg transition"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteVisitTarget({
                          id: v.id,
                          name: v.location?.location_name || "Office Visit",
                        });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <Link
                    to="/visits/$visitId"
                    params={{ visitId: v.id }}
                    className="flex items-start gap-3 min-w-0"
                  >
                    <VisitPhoto
                      src={v.photo_url}
                      alt={v.location?.location_name ?? "Visit"}
                      className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-xl object-cover ring-1 ring-slate-200 shadow-2xs"
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-slate-900 text-xs sm:text-sm leading-snug group-hover:text-sky-600 transition-colors line-clamp-2">
                          {v.location?.company_name
                            ? `${v.location.company_name} — ${v.location.location_name}`
                            : (v.location?.location_name ?? "Office Visit")}
                        </p>
                        {employeeId && (
                          <span className="rounded bg-sky-50 border border-sky-200/80 px-1.5 py-0.2 text-[9.5px] font-mono font-bold text-sky-700">
                            {employeeId}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Purpose: <strong className="text-slate-800">{v.visit_purpose}</strong>
                      </p>
                      <p className="text-[10.5px] sm:text-[11px] text-slate-500 flex items-center gap-1">
                        <span>📍</span>
                        <span className="font-semibold text-slate-700">{formatDistance(v.distance)}</span>
                        <span>from office</span>
                      </p>
                    </div>
                  </Link>
                </div>
              ))}

              {(visits ?? []).length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 p-6 text-center bg-slate-50/50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-600 mb-2">
                    <Camera className="h-5 w-5" />
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900">No visits logged today yet</p>
                  <p className="mt-0.5 max-w-sm text-[11px] text-slate-500">
                    When you arrive at an assigned client office, click below to take a live GPS photo.
                  </p>
                  <Link
                    to="/visit"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs"
                  >
                    <Camera className="h-3.5 w-3.5" /> Start Field Visit
                  </Link>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Assigned Locations & Compliance Guidelines (5 cols) */}
        <div className="space-y-4 sm:space-y-6 lg:col-span-5">
          {/* Assigned Locations Hub */}
          <section className="rounded-2xl border border-slate-100 bg-white/95 p-4 sm:p-5 shadow-xs backdrop-blur-md">
            <div className="flex items-center justify-between mb-0.5">
              <h2 className="font-display text-xs sm:text-sm md:text-base font-extrabold text-slate-900">Assigned Locations</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-600">
                {totalAssigned}
              </span>
            </div>
            <p className="mb-3 text-[11px] sm:text-xs text-slate-500">
              Official geofenced locations assigned to your profile.
            </p>

            <div className="space-y-2">
              {assignedLocations.map((l) => {
                const done = visitedTodayIds.has(l.id);
                return (
                  <div
                    key={l.id}
                    className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-100 p-2.5 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {l.company_name ? `${l.company_name} — ${l.location_name}` : l.location_name}
                      </p>
                      <p className="text-[10.5px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <span className="font-mono text-[10px]">{l.location_code}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-sky-700 font-semibold">
                          <Crosshair className="h-2.5 w-2.5" /> {l.allowed_radius}m radius
                        </span>
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {done ? (
                        <span className="rounded-full bg-emerald-100 border border-emerald-300/80 px-2 py-0.5 text-[9.5px] font-bold text-emerald-800">
                          Visited ✓
                        </span>
                      ) : (
                        <Link
                          to="/visit"
                          className="inline-flex items-center gap-1 rounded-lg bg-sky-50 border border-sky-200/80 px-2 py-0.5 text-[10px] font-bold text-sky-700 hover:bg-sky-100 transition-all"
                        >
                          Check In <ArrowRight className="h-2.5 w-2.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}

              {assignedLocations.length === 0 && (
                <div className="py-5 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  No locations assigned yet — please contact your admin.
                </div>
              )}
            </div>
          </section>

          {/* DVR Field Compliance Card */}
          <section className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50/80 to-sky-50/40 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center gap-1.5 mb-2.5">
              <ShieldCheck className="h-4 w-4 text-sky-600" />
              <h3 className="font-display text-xs sm:text-sm font-extrabold text-slate-900">Field DVR Verification Rules</h3>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-white/90 p-2.5 shadow-2xs">
                <Crosshair className="h-3.5 w-3.5 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-800 text-[11px] sm:text-xs">100m GPS Geofence</p>
                  <p className="text-[10px] sm:text-[10.5px] text-slate-500">You must stand within 100 meters of the office location point to submit proof.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-white/90 p-2.5 shadow-2xs">
                <Camera className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-800 text-[11px] sm:text-xs">Live Camera Only</p>
                  <p className="text-[10px] sm:text-[10.5px] text-slate-500">Gallery photos are disabled. Photos must be taken live on-site through the camera.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-white/90 p-2.5 shadow-2xs">
                <BadgeCheck className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-800 text-[11px] sm:text-xs">Automatic Watermarking</p>
                  <p className="text-[10px] sm:text-[10.5px] text-slate-500">Timestamp, employee ID, coordinates & office name are irreversibly stamped onto the photo.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "verified"
      ? "bg-success/15 text-success"
      : status === "rejected"
        ? "bg-destructive/10 text-destructive"
        : "bg-primary/10 text-primary";
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${cls}`}>{status}</span>;
}

function AdminDashboard({
  profile,
}: {
  profile?: {
    id?: string;
    name: string;
    employee_id?: string;
    email?: string;
    avatar_url?: string | null;
    phone?: string | null;
    role?: string;
    status?: "active" | "inactive";
  } | null;
}) {
  const [officeForm, setOfficeForm] = useState<OfficeFormState | null>(null);
  const [officeFormError, setOfficeFormError] = useState<string | null>(null);
  const [fetchingGps, setFetchingGps] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([]);

  const searchAmazonPlaces = async (query: string) => {
    setIsSearchingPlaces(true);
    try {
      const results = await searchPlaces({
        data: {
          query: (query || "Jaipur").trim(),
          biasLat: 26.9124,
          biasLng: 75.7873,
        },
      });
      setPlaceResults(results || []);
    } catch (e: any) {
      console.warn("[Dashboard Place Search]", e);
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  const { data: visits } = useQuery({
    queryKey: ["admin-visits", {}],
    queryFn: () => adminGetVisits({ data: {} }),
    refetchInterval: 5_000,
  });
  const { data: locations } = useQuery({
    queryKey: ["admin-locations"],
    queryFn: () => adminGetLocations({}),
    refetchInterval: 5_000,
  });
  const { data: employees } = useQuery({
    queryKey: ["admin-employees"],
    queryFn: () => adminGetEmployees({}),
    refetchInterval: 10_000,
  });

  const queryClient = useQueryClient();
  const pendingLocations = (locations ?? []).filter((l) => l.status === "pending");
  const pendingVisits = (visits ?? []).filter((v) => v.status === "submitted");

  // ---------- Powerful Super Admin DVR Filters ----------
  const [datePreset, setDatePreset] = useState<"today" | "week" | "month" | "all" | "custom">("today");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [filterEmployeeId, setFilterEmployeeId] = useState("all");
  const [filterLocationId, setFilterLocationId] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "verified" | "submitted" | "rejected">("all");
  const [filterPurpose, setFilterPurpose] = useState<string>("all");
  const [filterVerification, setFilterVerification] = useState<"all" | "verified_100m" | "out_of_range">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Date boundaries
  const now = new Date();
  const todayStrVal = now.toISOString().slice(0, 10);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);
  const monthStartStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const allVisits = visits ?? [];

  // Filtered visits computation
  const filteredVisits = allVisits.filter((v) => {
    // 1. Date Filter
    if (datePreset === "today") {
      if (v.visit_date !== todayStrVal) return false;
    } else if (datePreset === "week") {
      if (!v.visit_date || v.visit_date < weekAgoStr || v.visit_date > todayStrVal) return false;
    } else if (datePreset === "month") {
      if (!v.visit_date || v.visit_date < monthStartStr || v.visit_date > todayStrVal) return false;
    } else if (datePreset === "custom") {
      if (customFromDate && (!v.visit_date || v.visit_date < customFromDate)) return false;
      if (customToDate && (!v.visit_date || v.visit_date > customToDate)) return false;
    }

    // 2. Employee Filter
    if (filterEmployeeId !== "all") {
      const matchEmp =
        v.employee_id === filterEmployeeId ||
        (v.employee as any)?.id === filterEmployeeId ||
        (v.employee?.employee_id && v.employee.employee_id.toUpperCase() === filterEmployeeId.toUpperCase()) ||
        (v.employee?.email && v.employee.email.toLowerCase() === filterEmployeeId.toLowerCase());
      if (!matchEmp) return false;
    }

    // 3. Location Filter
    if (filterLocationId !== "all") {
      const matchLoc = v.location_id === filterLocationId || v.location?.id === filterLocationId;
      if (!matchLoc) return false;
    }

    // 4. Status Filter
    if (filterStatus !== "all") {
      if (v.status !== filterStatus) return false;
    }

    // 5. Purpose Filter
    if (filterPurpose !== "all") {
      if (v.visit_purpose !== filterPurpose) return false;
    }

    // 6. Verification (GPS Geofence) Filter
    if (filterVerification === "verified_100m") {
      if (v.distance > 100) return false;
    } else if (filterVerification === "out_of_range") {
      if (v.distance <= 100) return false;
    }

    // 7. Instant Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchEmpName = (v.employee?.name || "").toLowerCase().includes(q);
      const matchEmpId = (v.employee?.employee_id || "").toLowerCase().includes(q);
      const matchLocName = (v.location?.location_name || "").toLowerCase().includes(q);
      const matchCompName = (v.location?.company_name || "").toLowerCase().includes(q);
      const matchPurpose = (v.visit_purpose || "").toLowerCase().includes(q);
      const matchRemarks = (v.remarks || "").toLowerCase().includes(q);
      const matchOwner = (v.location?.owner_name || "").toLowerCase().includes(q);
      const matchPhone = (v.location?.owner_number || "").toLowerCase().includes(q);

      if (!matchEmpName && !matchEmpId && !matchLocName && !matchCompName && !matchPurpose && !matchRemarks && !matchOwner && !matchPhone) {
        return false;
      }
    }

    return true;
  });

  const activeFilterCount =
    (datePreset !== "today" ? 1 : 0) +
    (filterEmployeeId !== "all" ? 1 : 0) +
    (filterLocationId !== "all" ? 1 : 0) +
    (filterStatus !== "all" ? 1 : 0) +
    (filterPurpose !== "all" ? 1 : 0) +
    (filterVerification !== "all" ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  const resetAllFilters = () => {
    setDatePreset("today");
    setCustomFromDate("");
    setCustomToDate("");
    setFilterEmployeeId("all");
    setFilterLocationId("all");
    setFilterStatus("all");
    setFilterPurpose("all");
    setFilterVerification("all");
    setSearchQuery("");
    toast.success("Filters reset to Today's view");
  };

  const exportFilteredCsv = () => {
    if (filteredVisits.length === 0) {
      toast.error("No visits match the current filters to export");
      return;
    }
    const headers = [
      "Visit ID",
      "Date",
      "Time",
      "Employee Name",
      "Employee ID",
      "Office Location",
      "Company",
      "Purpose",
      "Distance (m)",
      "Status",
      "Remarks",
      "Live GPS Lat",
      "Live GPS Lng",
    ];
    const rows = filteredVisits.map((v) => [
      v.id,
      v.visit_date,
      v.visit_time?.slice(0, 8) || "",
      `"${(v.employee?.name || "Employee").replace(/"/g, '""')}"`,
      v.employee?.employee_id || "",
      `"${(v.location?.location_name || "").replace(/"/g, '""')}"`,
      `"${(v.location?.company_name || "").replace(/"/g, '""')}"`,
      `"${(v.visit_purpose || "").replace(/"/g, '""')}"`,
      v.distance,
      v.status,
      `"${(v.remarks || "").replace(/"/g, '""')}"`,
      v.actual_latitude,
      v.actual_longitude,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `mehar_dvr_filtered_${datePreset}_${todayStrVal}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredVisits.length} filtered visit records as CSV.`);
  };

  const invalidateData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-locations"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-visits"] }),
      queryClient.invalidateQueries({ queryKey: ["office-options"] }),
      queryClient.invalidateQueries({ queryKey: ["my-locations"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-employees"] }),
      queryClient.invalidateQueries({ queryKey: ["my-visits"] }),
    ]);
  };

  const saveOffice = useMutation({
    mutationFn: (payload: LocationInput) => adminUpsertLocation({ data: payload }),
    onSuccess: async () => {
      toast.success("✅ Office location saved & fixed with 100m radius!");
      setOfficeForm(null);
      setOfficeFormError(null);
      await invalidateData();
    },
    onError: (err) => setOfficeFormError(err instanceof Error ? err.message : "Save failed"),
  });

  const fetchDeviceGps = (customForm?: OfficeFormState) => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setFetchingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setFetchingGps(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const latStr = lat.toFixed(6);
        const lngStr = lng.toFixed(6);
        let liveAddr = "";
        try {
          liveAddr = await fetchLiveAddress(lat, lng);
        } catch {}

        setOfficeForm((prev) => {
          const current = prev || customForm || { ...emptyOfficeForm };
          return {
            ...current,
            latitude: latStr,
            longitude: lngStr,
            address: current.address || liveAddr || "Live Location",
          };
        });
        toast.success(`📍 Live GPS captured: ${latStr}, ${lngStr} (±${Math.round(pos.coords.accuracy)}m accuracy)`);
      },
      (err) => {
        setFetchingGps(false);
        toast.error(`GPS Error: ${err.message}. Please allow location access.`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const submitOfficeForm = () => {
    if (!officeForm) return;
    setOfficeFormError(null);

    const name = officeForm.location_name.trim();
    if (!name || name.length < 2) {
      setOfficeFormError("Please enter an office name (minimum 2 characters)");
      return;
    }

    const cleanCode = name
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 4)
      .toUpperCase() || "OFF";
    const generatedCode = `MEH-${cleanCode}-${Math.floor(1000 + Math.random() * 9000)}`;

    const formLat = Number(officeForm.latitude);
    const formLng = Number(officeForm.longitude);
    const finalLat = Number.isFinite(formLat) && formLat !== 0 ? formLat : 26.8910;
    const finalLng = Number.isFinite(formLng) && formLng !== 0 ? formLng : 75.7730;

    const candidate = {
      id: officeForm.id,
      company_name: officeForm.company_name.trim() || "Mehar Advisory",
      location_name: name,
      location_code: generatedCode,
      address: officeForm.address.trim() || "—",
      company_description: officeForm.company_description || "",
      owner_name: officeForm.owner_name || "",
      owner_number: officeForm.owner_number || "",
      latitude: finalLat,
      longitude: finalLng,
      allowed_radius: 100,
      status: "pending" as const,
    };
    const parsed = locationSchema.safeParse(candidate);
    if (!parsed.success) {
      setOfficeFormError(parsed.error.issues[0]?.message ?? "Please enter a valid Office Name");
      return;
    }
    saveOffice.mutate(parsed.data);
  };

  const approveVisit = useMutation({
    mutationFn: (visitId: string) => adminApproveVisit({ data: { visitId } }),
    onSuccess: async () => {
      toast.success("✅ Visit Approved! Location coordinates fixed with 100m radius.");
      await invalidateData();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Approve failed"),
  });

  const rejectVisit = useMutation({
    mutationFn: (id: string) => adminSetVisitStatus({ data: { id, status: "rejected" } }),
    onSuccess: async () => {
      toast.success("Visit report rejected");
      await invalidateData();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Reject failed"),
  });

  const approveLocation = useMutation({
    mutationFn: (id: string) => adminApproveLocation({ data: { id } }),
    onSuccess: async () => {
      toast.success("Location approved — now selectable with 100m radius");
      await invalidateData();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Approve failed"),
  });
  const rejectLocation = useMutation({
    mutationFn: (id: string) => adminRejectLocation({ data: { id } }),
    onSuccess: async () => {
      toast.success("Location request rejected");
      await invalidateData();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Reject failed"),
  });

  const today = todayStr();
  const todayVisits = (visits ?? []).filter((v) => v.visit_date === today);
  const todayCount = todayVisits.length;
  const activeLocations = (locations ?? []).filter((l) => l.status === "active").length;

  // Visit tracker: group today's visits per employee (newest first)
  const visitsByEmployee = new Map<string, typeof todayVisits>();
  for (const v of todayVisits) {
    const list = visitsByEmployee.get(v.employee_id) ?? [];
    list.push(v);
    visitsByEmployee.set(v.employee_id, list);
  }
  const trackerRows = (employees ?? [])
    .filter((e) => !(e.roles?.includes("admin") || e.role === "admin" || e.email?.toLowerCase().includes("admin") || e.employee_id === "MEH000" || e.employee_id === "MEHADM001"))
    .map((e) => ({
      employee: e,
      todayVisits: (visitsByEmployee.get(e.id) ?? []).slice().sort((a, b) => (b.visit_time || "").localeCompare(a.visit_time || "")),
    }))
    .sort((a, b) => b.todayVisits.length - a.todayVisits.length || (a.employee?.name || "").localeCompare(b.employee?.name || ""));

  // Chart data — visits per day for the last 7 days
  const dailyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return {
      day: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      visits: (visits ?? []).filter((v) => v.visit_date === key).length,
    };
  });

  // Chart data — all branches combined into one total share
  const totalVisits = (visits ?? []).length;
  const combinedData = totalVisits > 0 ? [{ name: "All Branches Combined", value: totalVisits }] : [];

  const formLat = Number(officeForm?.latitude);
  const formLng = Number(officeForm?.longitude);
  const formHasCoords = Number.isFinite(formLat) && Number.isFinite(formLng);

  return (
    <div className="space-y-6">
      {/* Super Admin Top Header Bar (Single Horizontal Line across Mobile, Tablet, Desktop) */}
      <div className="flex flex-row items-center justify-between gap-1.5 sm:gap-4 rounded-2xl border border-slate-100 bg-white/95 px-3 sm:px-5 py-2 sm:py-2.5 shadow-sm backdrop-blur-md animate-fade-up">
        {/* Left: Hi, Yogendra / Super Admin */}
        <div className="min-w-0 flex-1 pr-1">
          <h1 className="font-display text-xs sm:text-base font-extrabold tracking-tight text-slate-900 truncate leading-tight">
            Hi, <span className="text-blue-600 font-black">{profile?.name ? profile.name.replace(/ \(Admin\)/i, "").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Yogendra"}</span>
          </h1>
          <p className="text-[10px] sm:text-xs font-semibold text-blue-600 tracking-tight leading-tight mt-0.5">
            Super Admin
          </p>
        </div>

        {/* Right: UNIQUE ID Pill + Notification Bell + Avatar in one clean horizontal row */}
        <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
          {/* Emerald UNIQUE ID Pill */}
          <div className="flex flex-col items-center justify-center rounded-full bg-[#00c58e] hover:bg-[#00b07e] transition-colors text-white px-2 sm:px-3.5 py-0.5 sm:py-1 shadow-xs select-none">
            <span className="text-[5.5px] sm:text-[7.5px] font-black uppercase tracking-wider text-white/90 leading-none">
              UNIQUE ID
            </span>
            <span className="text-[9.5px] sm:text-xs font-black font-mono tracking-tight text-white leading-tight mt-0.5">
              {(profile?.employee_id && profile.employee_id !== "MEH000") ? profile.employee_id : "MEH-ADM-001"}
            </span>
          </div>

          {/* Notification Bell */}
          <AdminNotificationCenter />

          {/* User Profile Avatar */}
          <Link to="/profile" className="shrink-0 group" title="View Profile">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Profile avatar"
                className="h-7 w-7 sm:h-8.5 sm:w-8.5 rounded-full object-cover ring-2 ring-emerald-500/30 group-hover:ring-blue-500 transition-all shadow-xs"
              />
            ) : (
              <div className="flex h-7 w-7 sm:h-8.5 sm:w-8.5 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 font-black text-white text-[9.5px] sm:text-xs shadow-xs ring-2 ring-emerald-500/30">
                {getUserInitials(profile?.name || "Yogendra")}
              </div>
            )}
          </Link>
        </div>
      </div>

      {/* Quick Action Navigation - 3-button & 2-button horizontal pairs on Mobile, single row on Desktop */}
      <div className="space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5">
        {/* Row 1 on mobile (3 buttons pair across horizontal line) */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 sm:contents">
          <Button
            onClick={() => {
              setOfficeFormError(null);
              const fresh = { ...emptyOfficeForm };
              setOfficeForm(fresh);
              fetchDeviceGps(fresh);
            }}
            className="w-full sm:w-auto font-extrabold text-[11px] sm:text-xs h-9 px-1.5 sm:px-4 gap-1 sm:gap-1.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-sm shadow-sky-500/20 cursor-pointer justify-center"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate hidden xs:inline sm:inline">Add Office</span>
            <span className="truncate inline xs:hidden sm:hidden">Office</span>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto font-extrabold text-[11px] sm:text-xs h-9 px-1.5 sm:px-4 gap-1 sm:gap-1.5 rounded-2xl border-sky-100 bg-white/95 text-slate-700 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200 shadow-2xs cursor-pointer justify-center">
            <Link to="/admin/employees">
              <Users className="h-3.5 w-3.5 text-sky-600 shrink-0" />
              <span className="truncate">Users</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto font-extrabold text-[11px] sm:text-xs h-9 px-1.5 sm:px-4 gap-1 sm:gap-1.5 rounded-2xl border-sky-100 bg-white/95 text-slate-700 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200 shadow-2xs cursor-pointer justify-center">
            <Link to="/admin/locations">
              <MapPin className="h-3.5 w-3.5 text-sky-600 shrink-0" />
              <span className="truncate">Offices</span>
            </Link>
          </Button>
        </div>

        {/* Row 2 on mobile (2 buttons pair across horizontal line) */}
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 sm:contents">
          <Button asChild variant="outline" className="w-full sm:w-auto font-extrabold text-[11px] sm:text-xs h-9 px-3 sm:px-4 gap-1.5 rounded-2xl border-sky-100 bg-white/95 text-slate-700 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200 shadow-2xs cursor-pointer justify-center">
            <Link to="/admin/visits">
              <ClipboardList className="h-3.5 w-3.5 text-sky-600 shrink-0" />
              <span className="truncate">Reports</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto font-extrabold text-[11px] sm:text-xs h-9 px-3 sm:px-4 gap-1.5 rounded-2xl border-sky-100 bg-white/95 text-slate-700 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200 shadow-2xs cursor-pointer justify-center">
            <Link to="/admin/map">
              <Navigation className="h-3.5 w-3.5 text-sky-600 shrink-0" />
              <span className="truncate">Live Map</span>
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Visits Today"
          value={todayCount}
          icon={CalendarCheck}
          hint="Logged by field team today"
          variant="sky"
        />
        <StatCard
          label="Pending Approvals"
          value={pendingVisits.length}
          icon={Hourglass}
          hint={pendingVisits.length > 0 ? "Requires Admin verification" : "All caught up"}
          variant="amber"
        />
        <StatCard
          label="Active Locations"
          value={activeLocations}
          icon={MapPin}
          hint={
            pendingLocations.length > 0
              ? `${pendingLocations.length} awaiting approval`
              : `of ${(locations ?? []).length} total`
          }
          variant="indigo"
        />
        <StatCard
          label="Employees"
          value={(employees ?? []).length}
          icon={Users}
          hint="Registered field workforce"
          variant="emerald"
        />
      </div>

      {/* Super Admin Real-Time Live Activity & Submission Notifications Feed */}
      <AdminLiveNotificationFeed className="animate-fade-up" />

      {/* PENDING VISIT REPORTS AWAITING ADMIN APPROVAL */}
      {pendingVisits.length > 0 && (
        <section className="rounded-2xl border border-primary/40 bg-primary/5 p-5 shadow-soft animate-fade-up">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lift">
                <ShieldCheck className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-foreground">
                  Daily Visit Reports Awaiting Admin Approval ({pendingVisits.length})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Verify the live GPS coordinates & owner details below. Clicking <strong>APPROVE</strong> fixes the office location with a 100-meter radius.
                </p>
              </div>
            </div>
            <Link
              to="/admin/visits"
              className="text-xs font-semibold text-primary hover:underline hidden sm:inline-flex items-center gap-1"
            >
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {pendingVisits.map((v) => (
              <div
                key={v.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3"
              >
                <div className="flex items-start gap-3">
                  <Link to="/visits/$visitId" params={{ visitId: v.id }}>
                    <VisitPhoto
                      src={v.photo_url}
                      alt={v.location?.location_name ?? "Visit"}
                      className="h-16 w-16 shrink-0 rounded-lg border border-border transition-transform hover:scale-105"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {v.location?.company_name
                          ? `${v.location.company_name} — ${v.location.location_name}`
                          : (v.location?.location_name ?? "Office Visit")}
                      </p>
                      <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 shrink-0">
                        Pending
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                      Visitor: <strong>{v.employee?.name || "Employee"}</strong> ({v.employee?.employee_id})
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      Purpose: {v.visit_purpose}
                    </p>
                  </div>
                </div>

                {/* Owner details */}
                <div className="rounded-lg bg-muted/40 p-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Owner:</span>
                    <span className="font-semibold text-foreground">{v.location?.owner_name || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Mobile:</span>
                    <span className="font-semibold text-foreground">{v.location?.owner_number || "—"}</span>
                  </div>
                  {v.location?.company_description && (
                    <p className="text-muted-foreground text-[11px] pt-1 border-t border-border/60 line-clamp-2">
                      {v.location.company_description}
                    </p>
                  )}
                  <p className="text-[10px] font-mono text-muted-foreground pt-0.5">
                    Live GPS: {v.actual_latitude.toFixed(5)}, {v.actual_longitude.toFixed(5)} (±{Math.round(v.gps_accuracy ?? 0)}m)
                  </p>
                </div>

                {/* Approval Action Buttons */}
                <div className="flex items-center justify-between pt-1 gap-2">
                  <Link
                    to="/visits/$visitId"
                    params={{ visitId: v.id }}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    View Details
                  </Link>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-8 text-xs font-semibold shadow-lift"
                      disabled={approveVisit.isPending || rejectVisit.isPending}
                      onClick={() => approveVisit.mutate(v.id)}
                    >
                      {approveVisit.isPending ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                      )}
                      APPROVE (100m Fix)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                      disabled={approveVisit.isPending || rejectVisit.isPending}
                      onClick={() => rejectVisit.mutate(v.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {pendingLocations.length > 0 && (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 shadow-soft">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
              <Hourglass className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold">
                Pending Location Requests ({pendingLocations.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Employee-submitted offices — approve to make them fixed selectable locations.
              </p>
            </div>
          </div>
          <div className="space-y-2.5">
            {pendingLocations.map((loc) => (
              <div
                key={loc.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3.5"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {loc.company_name ? `${loc.company_name} — ${loc.location_name}` : loc.location_name}
                  </p>
                  {loc.company_description && (
                    <p className="truncate text-xs text-muted-foreground">
                      {loc.company_description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Owner: {loc.owner_name || "—"} · {loc.owner_number || "—"} · GPS{" "}
                    {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    className="font-semibold shadow-lift"
                    disabled={approveLocation.isPending || rejectLocation.isPending}
                    onClick={() => approveLocation.mutate(loc.id)}
                  >
                    {approveLocation.isPending && approveLocation.variables === loc.id ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    disabled={approveLocation.isPending || rejectLocation.isPending}
                    onClick={() => rejectLocation.mutate(loc.id)}
                  >
                    {rejectLocation.isPending && rejectLocation.variables === loc.id ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft lg:col-span-3">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold">Visits — Last 7 Days</h2>
              <p className="text-xs text-muted-foreground">Daily DVR submissions trend</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(value) => [`${value} visit${Number(value) === 1 ? "" : "s"}`, "Visits"]}
                />
                <Bar dataKey="visits" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft lg:col-span-2">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <PieChartIcon className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold">All Branches Combined</h2>
              <p className="text-xs text-muted-foreground">Total visits across every branch</p>
            </div>
          </div>
          {combinedData.length > 0 ? (
            <div className="relative h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={combinedData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={86}
                    startAngle={90}
                    endAngle={450}
                    stroke="var(--card)"
                    strokeWidth={2}
                  >
                    <Cell fill="var(--primary)" />
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(value, name) => [`${value} visit${Number(value) === 1 ? "" : "s"}`, name]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="font-display text-3xl font-bold">{totalVisits}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Visits</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground border border-border/80 shadow-xs mb-3">
                <PieChartIcon className="h-6 w-6 opacity-60" />
              </div>
              <p className="font-semibold text-sm text-foreground">No Visit Data Yet</p>
              <p className="text-xs text-muted-foreground max-w-xs mt-0.5">
                Visit share will dynamically appear as field employees check-in at assigned branches.
              </p>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-base font-bold">Today's Visit Tracker</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-semibold text-success">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Live
            </span>
          </div>
          <Link to="/admin/map" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            View Live Map <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="space-y-2.5">
          {trackerRows.map(({ employee, todayVisits: empVisits }) => (
            <div key={employee.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/80 bg-card p-3.5 shadow-xs transition-all hover:bg-muted/30">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  empVisits.length > 0 ? "bg-success/15 text-success border border-success/30" : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                <Activity className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-[130px]">
                <p className="text-sm font-bold text-foreground">{employee.name}</p>
                <p className="text-xs font-mono text-muted-foreground">{employee.employee_id}</p>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {empVisits.map((v) => (
                  <Link
                    key={v.id}
                    to="/visits/$visitId"
                    params={{ visitId: v.id }}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-[11px] font-medium text-primary transition hover:bg-primary/20"
                  >
                    <MapPin className="h-3 w-3" />
                    {v.location?.location_name ?? "Location"} · {v.visit_time.slice(0, 5)}
                  </Link>
                ))}
                {empVisits.length === 0 && (
                  <span className="text-xs text-muted-foreground">No visits recorded yet today</span>
                )}
              </div>
              {empVisits.length > 0 ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-semibold text-success">
                  <Clock className="h-3 w-3" /> Last {empVisits[0]?.visit_time.slice(0, 5)}
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  Not started
                </span>
              )}
            </div>
          ))}
          {trackerRows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center rounded-2xl border border-dashed border-border bg-muted/20">
              <Users className="h-8 w-8 text-muted-foreground/60 mb-2" />
              <p className="font-semibold text-sm text-foreground">No Field Employees Registered</p>
              <p className="text-xs text-muted-foreground max-w-xs mt-0.5 mb-3">
                Create employee accounts in User Management to begin live GPS visit tracking.
              </p>
              <Button asChild size="sm" className="font-semibold text-xs gap-1.5">
                <Link to="/admin/employees">
                  <Plus className="h-3.5 w-3.5" /> Add Field Employee
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ---------- 📅 Super Admin Streamlined DVR Reports & History Explorer ---------- */}
      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-soft space-y-4 animate-fade-up">
        {/* Section Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold shadow-xs">
              <SlidersHorizontal className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base sm:text-lg font-bold text-foreground">
                  DVR Visit Reports
                </h2>
                <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] font-bold text-primary">
                  {filteredVisits.length} {filteredVisits.length === 1 ? "Record" : "Records"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Live field check-in explorer & GPS verification logs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetAllFilters}
                className="text-xs font-semibold h-8 gap-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset ({activeFilterCount})
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={exportFilteredCsv}
              className="text-xs font-semibold h-8 gap-1.5 shadow-xs border-border rounded-xl"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              Export CSV
            </Button>

            <Link
              to="/admin/visits"
              className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-all h-8"
            >
              All Reports <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Compact Modern Filter Toolbar */}
        <div className="rounded-2xl border border-border/80 bg-muted/20 p-3 sm:p-3.5 space-y-2.5">
          {/* Row 1: Segmented Date Pills + Quick Search + View Mode */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
            {/* Date Preset Segmented Control */}
            <div className="inline-flex items-center p-1 rounded-xl bg-card border border-border shadow-2xs gap-0.5 overflow-x-auto max-w-full">
              {[
                { id: "today" as const, label: "Today", count: allVisits.filter((v) => v.visit_date === todayStrVal).length },
                { id: "week" as const, label: "7 Days", count: allVisits.filter((v) => v.visit_date && v.visit_date >= weekAgoStr && v.visit_date <= todayStrVal).length },
                { id: "month" as const, label: "30 Days", count: allVisits.filter((v) => v.visit_date && v.visit_date >= monthStartStr && v.visit_date <= todayStrVal).length },
                { id: "all" as const, label: "All", count: allVisits.length },
                { id: "custom" as const, label: "Custom ▾", count: undefined },
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setDatePreset(preset.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    datePreset === preset.id
                      ? "bg-primary text-primary-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  {preset.label}
                  {typeof preset.count === "number" ? ` (${preset.count})` : ""}
                </button>
              ))}
            </div>

            {/* Quick Search & View Toggle */}
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search staff, branch, purpose..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-7 h-8.5 text-xs rounded-xl bg-card border-border"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* View Switch */}
              <div className="flex items-center gap-0.5 rounded-xl bg-card p-0.5 border border-border shadow-2xs shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    viewMode === "table" ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Table View"
                >
                  Table
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    viewMode === "cards" ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Cards View"
                >
                  Cards
                </button>
              </div>
            </div>
          </div>

          {/* Custom Date Pickers Drawer (Smooth toggle) */}
          {datePreset === "custom" && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-card border border-primary/30 animate-fade-up flex-wrap">
              <span className="text-xs font-semibold text-muted-foreground">From:</span>
              <Input
                type="date"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                className="h-7.5 text-xs w-36 bg-background rounded-lg"
              />
              <span className="text-xs font-semibold text-muted-foreground">To:</span>
              <Input
                type="date"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                className="h-7.5 text-xs w-36 bg-background rounded-lg"
              />
              {(customFromDate || customToDate) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCustomFromDate("");
                    setCustomToDate("");
                  }}
                  className="h-7.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear Range
                </Button>
              )}
            </div>
          )}

          {/* Row 2: Compact Filter Dropdowns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {/* Employee Filter */}
            <div className="relative">
              <select
                value={filterEmployeeId}
                onChange={(e) => setFilterEmployeeId(e.target.value)}
                className="w-full h-8.5 rounded-xl border border-border bg-card px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs truncate cursor-pointer"
              >
                <option value="all">👤 All Staff ({trackerRows.length})</option>
                {trackerRows.map(({ employee: e }) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.employee_id})
                  </option>
                ))}
              </select>
            </div>

            {/* Location Filter */}
            <div className="relative">
              <select
                value={filterLocationId}
                onChange={(e) => setFilterLocationId(e.target.value)}
                className="w-full h-8.5 rounded-xl border border-border bg-card px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs truncate cursor-pointer"
              >
                <option value="all">📍 All Offices ({(locations ?? []).length})</option>
                {(locations ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.location_name} {l.company_name ? `(${l.company_name})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full h-8.5 rounded-xl border border-border bg-card px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
              >
                <option value="all">🏷️ All Statuses</option>
                <option value="verified">Verified ✓</option>
                <option value="submitted">Pending ⏳</option>
                <option value="rejected">Rejected ✕</option>
              </select>
            </div>

            {/* Purpose Filter */}
            <div className="relative">
              <select
                value={filterPurpose}
                onChange={(e) => setFilterPurpose(e.target.value)}
                className="w-full h-8.5 rounded-xl border border-border bg-card px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs truncate cursor-pointer"
              >
                <option value="all">📋 All Purposes</option>
                <option value="Client Consultation">Client Consultation</option>
                <option value="Physical Meeting">Physical Meeting</option>
                <option value="Inspection / Audit">Inspection / Audit</option>
                <option value="Delivery / Collection">Delivery / Collection</option>
                <option value="Routine Follow-up">Routine Follow-up</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* GPS Range Filter */}
            <div className="relative col-span-2 sm:col-span-1">
              <select
                value={filterVerification}
                onChange={(e) => setFilterVerification(e.target.value as any)}
                className="w-full h-8.5 rounded-xl border border-border bg-card px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
              >
                <option value="all">🎯 All Radii</option>
                <option value="verified_100m">≤ 100m (Valid)</option>
                <option value="out_of_range">&gt; 100m (Flagged)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filtered Visits Display (Table View) */}
        {filteredVisits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center rounded-2xl border border-dashed border-border bg-muted/10 my-2">
            <ClipboardList className="h-9 w-9 text-muted-foreground/60 mb-2" />
            <p className="font-semibold text-sm text-foreground">No Visit Reports Found</p>
            <p className="text-xs text-muted-foreground max-w-sm mt-0.5 mb-3">
              No DVR reports matched your selected filter criteria. Try expanding your date range or clearing filters.
            </p>
            <Button size="sm" variant="outline" onClick={resetAllFilters} className="text-xs gap-1.5 font-semibold rounded-xl">
              <RotateCcw className="h-3.5 w-3.5" /> Reset Filters
            </Button>
          </div>
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-xs">
            <table className="w-full min-w-[850px] text-sm text-left">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="py-2.5 px-3.5">Photo</th>
                  <th className="py-2.5 px-3.5">Employee</th>
                  <th className="py-2.5 px-3.5">Office / Branch</th>
                  <th className="py-2.5 px-3.5">Purpose & Notes</th>
                  <th className="py-2.5 px-3.5">Date & Time</th>
                  <th className="py-2.5 px-3.5">GPS Distance</th>
                  <th className="py-2.5 px-3.5">Status</th>
                  <th className="py-2.5 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredVisits.map((v) => {
                  const empMatch = (employees ?? []).find(
                    (e) => e.id === v.employee_id || e.employee_id === v.employee_id
                  );
                  const empName = empMatch?.name || v.employee?.name || (v as any).employee_name || "Field Officer";
                  let empCode = empMatch?.employee_id || v.employee?.employee_id || (v as any).employee_code || "";
                  if (!empCode || empCode === "—" || empCode.includes("-") || empCode.length > 15) {
                    empCode = "MEH101";
                  }

                  return (
                    <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3.5">
                        <VisitPhoto
                          src={v.photo_url}
                          alt="visit"
                          className="h-10 w-10 rounded-xl border border-border shadow-xs object-cover"
                        />
                      </td>
                      <td className="py-2.5 px-3.5">
                        <p className="font-semibold text-xs text-foreground hover:text-primary transition-colors leading-tight">
                          {empName}
                        </p>
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                          {empCode}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 max-w-[190px]">
                        <p className="font-semibold text-xs text-foreground truncate">
                          {v.location?.location_name || "Client Office"}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {v.location?.company_name || v.location?.address || "Jaipur"}
                        </p>
                      </td>
                      <td className="py-2.5 px-3.5 max-w-[170px]">
                        <span className="text-xs text-foreground font-medium truncate block leading-tight">
                          {v.visit_purpose}
                        </span>
                        {v.remarks ? (
                          <span className="text-[11px] text-muted-foreground truncate block mt-0.5 italic">
                            "{v.remarks}"
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        <span className="font-medium text-foreground">{v.visit_date}</span>
                        <p className="text-[11px] font-mono">{v.visit_time.slice(0, 5)}</p>
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            v.distance <= 100
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          <Crosshair className="h-2.5 w-2.5" />
                          {formatDistance(v.distance)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <StatusPill status={v.status} />
                      </td>
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to="/visits/$visitId"
                            params={{ visitId: v.id }}
                            className="inline-flex items-center rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent transition-colors shadow-2xs"
                          >
                            Details
                          </Link>
                          {v.status === "submitted" && (
                            <Button
                              size="sm"
                              className="h-7 text-xs font-semibold px-2 rounded-lg"
                              disabled={approveVisit.isPending}
                              onClick={() => approveVisit.mutate(v.id)}
                            >
                              <Check className="h-3 w-3 mr-1" /> Approve
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Cards View */
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredVisits.map((v) => {
              const empMatch = (employees ?? []).find(
                (e) => e.id === v.employee_id || e.employee_id === v.employee_id
              );
              const empName = empMatch?.name || v.employee?.name || (v as any).employee_name || "Field Officer";
              let empCode = empMatch?.employee_id || v.employee?.employee_id || (v as any).employee_code || "";
              if (!empCode || empCode === "—" || empCode.includes("-") || empCode.length > 15) {
                empCode = "MEH101";
              }

              return (
                <div
                  key={v.id}
                  className="rounded-2xl border border-border bg-card p-3.5 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-start gap-2.5">
                      <VisitPhoto
                        src={v.photo_url}
                        alt="visit"
                        className="h-12 w-12 rounded-xl border border-border shadow-xs shrink-0 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-bold text-foreground truncate text-xs">
                            {empName}
                          </p>
                          <StatusPill status={v.status} />
                        </div>
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                          {empCode}
                        </span>
                        <p className="text-xs font-semibold text-primary truncate mt-1">
                          {v.location?.location_name || "Client Office"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 text-xs space-y-1 bg-muted/40 rounded-xl p-2.5 text-muted-foreground">
                      <p><strong className="text-foreground">Purpose:</strong> {v.visit_purpose}</p>
                      <p><strong className="text-foreground">Time:</strong> {v.visit_date} at {v.visit_time.slice(0, 5)}</p>
                      <p className="flex items-center gap-1.5">
                        <strong className="text-foreground">GPS:</strong>
                        <span className={v.distance <= 100 ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                          {formatDistance(v.distance)} from office
                        </span>
                      </p>
                      {v.remarks && <p className="truncate"><strong className="text-foreground">Remarks:</strong> {v.remarks}</p>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border/60">
                    <Link
                      to="/visits/$visitId"
                      params={{ visitId: v.id }}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      View Details →
                    </Link>
                    {v.status === "submitted" && (
                      <Button
                        size="sm"
                        className="h-7 text-xs font-semibold rounded-lg"
                        disabled={approveVisit.isPending}
                        onClick={() => approveVisit.mutate(v.id)}
                      >
                        <Check className="h-3 w-3 mr-1" /> Approve
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Add Office Dialog (With Amazon Location Place Finder) */}
      <Dialog
        open={officeForm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setOfficeForm(null);
            setPlaceResults([]);
            setPlaceQuery("");
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-28px)] max-w-lg sm:max-w-xl max-h-[85vh] overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 rounded-3xl border border-sky-100/90 bg-white/98 shadow-2xl backdrop-blur-xl box-border">
          <DialogHeader className="mb-2 pr-7 text-left space-y-0.5">
            <div className="inline-flex items-center gap-1 text-[9.5px] font-extrabold uppercase tracking-wider text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200/70 w-fit">
              <Sparkles className="h-2.5 w-2.5 text-amber-500 shrink-0" />
              <span>Amazon Place Finder</span>
            </div>
            <DialogTitle className="font-display text-sm sm:text-base font-extrabold text-slate-900 leading-tight pt-0.5">Add Office to Dropdown</DialogTitle>
          </DialogHeader>
          {officeForm && (
            <div className="space-y-3 pt-0.5">
              {/* Live GPS Auto-Detection Hero Banner */}
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/60 p-3 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 font-bold text-white shadow-xs">
                    <Navigation className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-[11px] sm:text-xs font-bold text-slate-900 flex items-center gap-1.5 leading-tight">
                      Live GPS Auto-Detection
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[8.5px] font-bold text-emerald-700">
                        Device GPS
                      </span>
                    </h4>
                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      Fetch live GPS coordinates automatically.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => fetchDeviceGps(officeForm)}
                  disabled={fetchingGps}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs shrink-0 gap-1 h-8 px-2.5 rounded-xl w-full sm:w-auto justify-center"
                >
                  {fetchingGps ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Navigation className="h-3.5 w-3.5" />
                  )}
                  {fetchingGps ? "Fetching GPS..." : "📍 Fetch Live Location"}
                </Button>
              </div>

              {/* Amazon Location Places Search Box */}
              <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-2.5 sm:p-3 space-y-2">
                <Label className="text-[10px] sm:text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Search className="h-3 w-3 text-sky-600 shrink-0" />
                  <span>Search Place or Landmark</span>
                </Label>
                <div className="flex gap-1.5">
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
                      className="pr-8 bg-background h-10 text-xs"
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
                    className="font-semibold gap-1 shrink-0 h-10"
                  >
                    <Search className="h-3.5 w-3.5" /> Search
                  </Button>
                </div>

                {/* Search Suggestions with 1-Click Add */}
                {placeResults.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto rounded-xl border border-border bg-background p-2.5 shadow-inner">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 flex items-center justify-between">
                      <span>Amazon Location Matches ({placeResults.length}):</span>
                      <span className="text-primary font-normal">Click to auto-fill</span>
                    </p>
                    {placeResults.map((r, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setOfficeForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  company_name: r.label.split(",")[0] || prev.company_name,
                                  location_name: r.label.split(",")[1]?.trim() || r.label.split(",")[0] || prev.location_name,
                                  address: r.address || r.label,
                                  latitude: r.latitude.toFixed(6),
                                  longitude: r.longitude.toFixed(6),
                                }
                              : prev,
                          );
                          setPlaceResults([]);
                          toast.success(`Selected: ${r.label}`);
                        }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-accent/80 transition-colors flex items-start gap-2.5 text-xs border border-border/60 bg-card shadow-xs group"
                      >
                        <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{r.label}</p>
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

              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Radio className="h-3.5 w-3.5 text-primary animate-pulse" />
                  1st Visit Live GPS Automation
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  When an employee visits this office, live GPS will be watermarked on their report and fixed with a <strong>100m radius</strong> upon approval.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="dash-loc-name" className="text-xs font-semibold text-foreground">
                    Office / Branch Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="dash-loc-name"
                    value={officeForm.location_name}
                    onChange={(e) => setOfficeForm({ ...officeForm, location_name: e.target.value })}
                    placeholder="e.g. Digital Smart Technology - Jaipur Branch"
                    className="h-10 text-xs"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dash-loc-comp" className="text-xs font-semibold text-foreground">
                    Company / Organization Name
                  </Label>
                  <Input
                    id="dash-loc-comp"
                    value={officeForm.company_name}
                    onChange={(e) => setOfficeForm({ ...officeForm, company_name: e.target.value })}
                    placeholder="e.g. Digital Smart Technology ltd"
                    className="h-10 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dash-loc-addr" className="text-xs font-semibold text-foreground">
                    Full Street Address
                  </Label>
                  <Input
                    id="dash-loc-addr"
                    value={officeForm.address}
                    onChange={(e) => setOfficeForm({ ...officeForm, address: e.target.value })}
                    placeholder="e.g. Malviya Nagar / Tonk Road, Jaipur, Rajasthan 302017"
                    className="h-10 text-xs"
                  />
                </div>
              </div>

              {officeFormError && (
                <div className="rounded-lg bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
                  {officeFormError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setOfficeForm(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={saveOffice.isPending}
                  onClick={submitOfficeForm}
                  className="font-semibold shadow-lift gap-1.5"
                >
                  {saveOffice.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add Office to Dropdown
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
