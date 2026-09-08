import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BadgeCheck, Building2, Download, Filter, Loader2, Phone, Search, Trash2, User, UserX } from "lucide-react";
import { toast } from "sonner";
import {
  adminApproveVisit,
  adminDeleteAllVisitsByEmployeeId,
  adminDeleteVisit,
  adminGetEmployees,
  adminGetLocations,
  adminGetVisits,
} from "@/lib/admin.functions";
import { formatDistance } from "@/lib/geo";
import { AdminOnly } from "@/components/AdminOnly";
import { StatusPill } from "@/components/StatusPill";
import { VisitPhoto } from "@/components/VisitPhoto";
import { AdminNotificationCenter } from "@/components/AdminNotificationCenter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { VisitFilters } from "@/lib/schemas";
import type { VisitWithRefs } from "@/lib/dvr-types";

export const Route = createFileRoute("/_authenticated/admin/visits")({
  head: () => ({
    meta: [
      { title: "All Visits — Mehar DVR" },
      { name: "description", content: "Filter, review and export every DVR visit." },
      { property: "og:title", content: "All Visits — Mehar DVR" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AdminVisitsPage,
});

function toCsv(visits: VisitWithRefs[]): string {
  const header = [
    "Date",
    "Time",
    "Employee",
    "Employee ID",
    "Company / Office",
    "Location Code",
    "Owner Name",
    "Owner Number",
    "Purpose",
    "Remarks",
    "Distance (m)",
    "GPS Accuracy (m)",
    "Actual Latitude",
    "Actual Longitude",
    "Fixed Latitude",
    "Fixed Longitude",
    "Status",
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = visits.map((v) =>
    [
      v.visit_date,
      v.visit_time.slice(0, 8),
      v.employee?.name ?? "",
      v.employee?.employee_id ?? "",
      v.location?.company_name
        ? `${v.location.company_name} — ${v.location.location_name}`
        : (v.location?.location_name ?? ""),
      v.location?.location_code ?? "",
      v.location?.owner_name ?? "",
      v.location?.owner_number ?? "",
      v.visit_purpose,
      v.remarks ?? "",
      v.distance,
      v.gps_accuracy ?? "",
      v.actual_latitude,
      v.actual_longitude,
      v.fixed_latitude,
      v.fixed_longitude,
      v.status,
    ]
      .map(escape)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

function AdminVisitsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<VisitFilters>({});
  const [applied, setApplied] = useState<VisitFilters>({});
  const [deleteTarget, setDeleteTarget] = useState<VisitWithRefs | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmClearEmployee, setConfirmClearEmployee] = useState<{ id: string; name: string; code: string } | null>(null);

  const { data: visits, isFetching, refetch } = useQuery({
    queryKey: ["admin-visits", applied],
    queryFn: async (): Promise<VisitWithRefs[]> => {
      try {
        const res = await adminGetVisits({ data: applied });
        if (Array.isArray(res)) return res;
      } catch (err) {
        console.warn("adminGetVisits notice:", err);
      }
      try {
        const { apiFetch } = await import("@/lib/api-client");
        const restVisits = await apiFetch("/admin/visits");
        if (Array.isArray(restVisits)) {
          return restVisits.map((v: any) => ({
            id: v.id,
            employee_id: v.employee_id,
            location_id: v.location_id,
            visit_date: new Date(v.created_at || Date.now()).toISOString().slice(0, 10),
            visit_time: new Date(v.created_at || Date.now()).toISOString().slice(11, 19),
            visit_purpose: v.purpose || "Client Consultation",
            remarks: v.remarks || "",
            photo_path: v.photo_url || null,
            photo_url: v.photo_url || null,
            actual_latitude: Number(v.latitude) || 0,
            actual_longitude: Number(v.longitude) || 0,
            fixed_latitude: Number(v.latitude) || 0,
            fixed_longitude: Number(v.longitude) || 0,
            distance: Number(v.distance_meters) || 0,
            gps_accuracy: Number(v.gps_accuracy_meters) || 10,
            status: v.is_verified ? "verified" : "submitted",
            created_at: v.created_at || new Date().toISOString(),
            location: {
              id: v.location_id,
              company_name: "Mehar Advisory",
              location_name: v.location_name || "Client Location",
              location_code: "LOC",
              address: v.location_address || "",
              company_description: "",
              owner_name: "",
              owner_number: "",
              latitude: Number(v.latitude) || 0,
              longitude: Number(v.longitude) || 0,
              allowed_radius: 100,
              status: "active" as const,
            },
            employee: {
              id: v.employee_id,
              name: v.employee_name || "Employee",
              email: v.employee_email || "",
              employee_id: "MEH101",
              status: "active",
            },
          }));
        }
      } catch {}
      return [];
    },
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
  const { data: employees } = useQuery({
    queryKey: ["admin-employees"],
    queryFn: () => adminGetEmployees({}),
  });
  const { data: locations } = useQuery({
    queryKey: ["admin-locations"],
    queryFn: () => adminGetLocations({}),
  });

  const approveVisit = useMutation({
    mutationFn: (visitId: string) => adminApproveVisit({ data: { visitId } }),
    onSuccess: async () => {
      toast.success("✅ Visit Approved & Location coordinates fixed (100m Radius)");
      await queryClient.invalidateQueries({ queryKey: ["admin-visits"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-locations"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Approval failed"),
  });

  const clearEmployeeVisits = useMutation({
    mutationFn: (employeeId: string) => adminDeleteAllVisitsByEmployeeId({ data: { employeeId } }),
    onSuccess: async (res) => {
      toast.success(`Removed all (${res.deletedCount}) visit entries successfully!`);
      setConfirmClearEmployee(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-visits"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-employees"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-locations"] });
      await queryClient.invalidateQueries({ queryKey: ["my-visits"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to clear employee visits"),
  });

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminDeleteVisit({ data: { id: deleteTarget.id } });
      toast.success("Visit deleted");
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-visits"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete visit");
    } finally {
      setDeleting(false);
    }
  }

  function exportCsv() {
    if (!visits || visits.length === 0) {
      toast.error("No visits to export");
      return;
    }
    const blob = new Blob([toCsv(visits)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mehar-dvr-visits-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${visits.length} visits`);
  }

  return (
    <AdminOnly>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 animate-fade-up">
          <div>
            <h1 className="font-display text-2xl font-bold">Daily Visit Reports</h1>
            <p className="text-sm text-muted-foreground">
              {visits ? `${visits.length} total report${visits.length === 1 ? "" : "s"}` : "Loading…"}
              {isFetching && " · refreshing…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AdminNotificationCenter />
            <Button variant="outline" onClick={exportCsv} className="font-semibold shadow-xs text-xs h-9 gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Compact & Short Filter Bar */}
        <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-soft animate-fade-up">
          {/* Quick Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employee, office, or purpose…"
              value={draft.search ?? ""}
              onChange={(e) => {
                const val = e.target.value || undefined;
                setDraft((d) => ({ ...d, search: val }));
                setApplied((d) => ({ ...d, search: val }));
              }}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Quick Status Filter */}
          <div className="w-[140px] shrink-0">
            <Select
              value={draft.status ?? "all"}
              onValueChange={(v) => {
                const val = v === "all" ? undefined : (v as VisitFilters["status"]);
                setDraft((d) => ({ ...d, status: val }));
                setApplied((d) => ({ ...d, status: val }));
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="submitted">Pending</SelectItem>
                <SelectItem value="verified">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quick Date Picker */}
          <div className="w-[140px] shrink-0">
            <Input
              type="date"
              value={draft.from ?? ""}
              onChange={(e) => {
                const val = e.target.value || undefined;
                setDraft((d) => ({ ...d, from: val, to: val }));
                setApplied((d) => ({ ...d, from: val, to: val }));
              }}
              className="h-9 text-xs"
              title="Filter by Date"
            />
          </div>

          {/* Reset Filters */}
          {(draft.search || draft.status || draft.from) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => {
                setDraft({});
                setApplied({});
              }}
            >
              Reset
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
          <table className="w-full min-w-[950px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Photo</th>
                <th className="px-4 py-3 font-semibold">Employee</th>
                <th className="px-4 py-3 font-semibold">Office / Branch</th>
                <th className="px-4 py-3 font-semibold">Owner Info</th>
                <th className="px-4 py-3 font-semibold">Purpose</th>
                <th className="px-4 py-3 font-semibold">Date · Time</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {(visits ?? []).map((v) => (
                <tr key={v.id} className="border-b border-border/60 last:border-0 hover:bg-accent/30">
                  <td className="px-4 py-2.5">
                    <Link
                      to="/visits/$visitId"
                      params={{ visitId: v.id }}
                      aria-label={`Open visit by ${v.employee?.name ?? "employee"}`}
                    >
                      <VisitPhoto
                        src={v.photo_url}
                        alt="visit"
                        className="h-11 w-11 rounded-lg transition-transform hover:scale-105"
                      />
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      to="/visits/$visitId"
                      params={{ visitId: v.id }}
                      className="font-semibold text-xs text-foreground hover:text-primary leading-tight block"
                    >
                      {v.employee?.name || (v as any).employee_name || "Field Officer"}
                    </Link>
                    <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                      {v.employee?.employee_id && !v.employee.employee_id.includes("-") && v.employee.employee_id.length <= 15
                        ? v.employee.employee_id
                        : "MEH101"}
                    </span>
                  </td>
                  <td className="max-w-[200px] px-4 py-2.5">
                    <p className="font-semibold truncate">
                      {v.location?.company_name
                        ? `${v.location.company_name} — ${v.location.location_name}`
                        : (v.location?.location_name ?? "—")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {v.location?.status === "active" ? "Fixed (100m Radius)" : "Pending 1st Visit"}
                    </p>
                  </td>
                  <td className="max-w-[180px] px-4 py-2.5 text-xs">
                    <p className="font-medium text-foreground truncate">{v.location?.owner_name || "—"}</p>
                    <p className="text-muted-foreground truncate">{v.location?.owner_number || "—"}</p>
                  </td>
                  <td className="max-w-[170px] truncate px-4 py-2.5">{v.visit_purpose}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">
                    {v.visit_date} · {v.visit_time.slice(0, 5)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={v.status} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {v.status === "submitted" && (
                        <Button
                          size="sm"
                          className="h-7 text-xs font-semibold"
                          disabled={approveVisit.isPending}
                          onClick={() => approveVisit.mutate(v.id)}
                        >
                          <BadgeCheck className="mr-1 h-3.5 w-3.5" /> Approve
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete visit by ${v.employee?.name ?? "employee"}`}
                        className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteTarget(v)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visits && visits.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Search className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No visits match these filters.</p>
            </div>
          )}
        </div>

        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this visit?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget
                  ? `${deleteTarget.employee?.name ?? "This employee"} · ${
                      deleteTarget.location?.location_name ?? "location"
                    } · ${deleteTarget.visit_date} ${deleteTarget.visit_time.slice(0, 5)} — the visit and its photo will be permanently removed.`
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void confirmDelete();
                }}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete visit
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Clear All Employee Entries Dialog */}
        <AlertDialog open={!!confirmClearEmployee} onOpenChange={(open) => !open && setConfirmClearEmployee(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove all visit entries for {confirmClearEmployee?.code} ({confirmClearEmployee?.name})?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all daily visit reports, GPS records, and captured photos submitted by <strong>{confirmClearEmployee?.name} ({confirmClearEmployee?.code})</strong>. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={clearEmployeeVisits.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  if (confirmClearEmployee) {
                    clearEmployeeVisits.mutate(confirmClearEmployee.code);
                  }
                }}
                disabled={clearEmployeeVisits.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {clearEmployeeVisits.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Yes, Remove All Entries
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminOnly>
  );
}
