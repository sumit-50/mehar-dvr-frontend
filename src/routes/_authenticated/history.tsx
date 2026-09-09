import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Filter, History, Loader2, Search, Trash2 } from "lucide-react";
import { clearMyVisitEntries, deleteMyVisit, getMyAssignedLocations, getMyVisits } from "@/lib/dvr.functions";
import { formatDistance } from "@/lib/geo";
import { StatusPill } from "@/components/StatusPill";
import { VisitPhoto } from "@/components/VisitPhoto";
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

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Visit History — Mehar DVR" },
      { name: "description", content: "Your complete GPS-verified visit history." },
      { property: "og:title", content: "Visit History — Mehar DVR" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<VisitFilters>({});
  const [applied, setApplied] = useState<VisitFilters>({});
  const [deleteVisitTarget, setDeleteVisitTarget] = useState<{ id: string; name: string } | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  const { data: visits, isFetching } = useQuery({
    queryKey: ["my-visits", applied],
    queryFn: () => getMyVisits({ data: applied }),
  });
  const { data: _locations } = useQuery({
    queryKey: ["my-locations"],
    queryFn: () => getMyAssignedLocations(),
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

  const clearAllMutation = useMutation({
    mutationFn: () => clearMyVisitEntries({}),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["my-visits"] });
      queryClient.setQueriesData({ queryKey: ["my-visits"] }, () => []);
    },
    onSuccess: async () => {
      toast.success("Removed all visit entries!");
      setShowClearAllConfirm(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-visits"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-visits"] }),
        queryClient.invalidateQueries({ queryKey: ["office-options"] }),
        queryClient.invalidateQueries({ queryKey: ["my-locations"] }),
        queryClient.refetchQueries({ queryKey: ["my-visits"] }),
      ]);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to clear entries");
      queryClient.invalidateQueries({ queryKey: ["my-visits"] });
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-3.5 sm:space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 animate-fade-up">
        <div>
          <h1 className="font-display text-base sm:text-xl font-extrabold text-slate-900 leading-tight">
            Visit History
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            {visits ? `${visits.length} visit${visits.length === 1 ? "" : "s"} recorded` : "Loading…"}
            {isFetching && " · refreshing…"}
          </p>
        </div>
        {(visits ?? []).length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-[11px] font-bold text-destructive border-destructive/30 hover:bg-destructive/10 rounded-xl"
            onClick={() => setShowClearAllConfirm(true)}
          >
            <Trash2 className="mr-1 h-3 w-3" /> Remove All
          </Button>
        )}
      </div>

      {/* Confirmation Dialog for Clearing All Entries */}
      <AlertDialog open={showClearAllConfirm} onOpenChange={setShowClearAllConfirm}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove All My Visit Entries?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your daily visit reports, GPS records, photos, and pending location requests.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearAllMutation.isPending} className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                clearAllMutation.mutate();
              }}
              disabled={clearAllMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
            >
              {clearAllMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Remove All Entries
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Compact & Responsive Filter Bar */}
      <div className="space-y-2 rounded-2xl border border-slate-100 bg-white/95 p-3 shadow-xs backdrop-blur-md animate-fade-up">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search office, company, or purpose…"
            value={draft.search ?? ""}
            onChange={(e) => {
              const val = e.target.value || undefined;
              setDraft((d) => ({ ...d, search: val }));
              setApplied((d) => ({ ...d, search: val }));
            }}
            className="pl-8.5 h-8.5 text-xs bg-slate-50/60 border-slate-200 rounded-xl"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select
            value={draft.status ?? "all"}
            onValueChange={(v) => {
              const val = v === "all" ? undefined : (v as VisitFilters["status"]);
              setDraft((d) => ({ ...d, status: val }));
              setApplied((d) => ({ ...d, status: val }));
            }}
          >
            <SelectTrigger className="h-8.5 text-xs bg-slate-50/60 border-slate-200 rounded-xl">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
              <SelectItem value="submitted" className="text-xs">Pending</SelectItem>
              <SelectItem value="verified" className="text-xs">Verified</SelectItem>
              <SelectItem value="rejected" className="text-xs">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={draft.from ?? ""}
            onChange={(e) => {
              const val = e.target.value || undefined;
              setDraft((d) => ({ ...d, from: val, to: val }));
              setApplied((d) => ({ ...d, from: val, to: val }));
            }}
            className="h-8.5 text-xs bg-slate-50/60 border-slate-200 rounded-xl"
            title="Filter by Date"
          />
        </div>

        {(draft.search || draft.status || draft.from) && (
          <div className="flex justify-end pt-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10.5px] font-bold text-slate-500 hover:text-slate-900"
              onClick={() => {
                setDraft({});
                setApplied({});
              }}
            >
              Reset Filters
            </Button>
          </div>
        )}
      </div>

      {/* Results List */}
      <div className="space-y-2.5">
        {(visits ?? []).map((v) => (
          <div
            key={v.id}
            className="group relative rounded-2xl border border-slate-100 bg-white/95 p-3 sm:p-3.5 shadow-xs backdrop-blur-md transition hover:border-sky-200 hover:shadow-sm"
          >
            {/* Top header row: Status Pill + Date/Time + Delete action */}
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusPill status={v.status} />
                <span className="text-[10.5px] sm:text-[11px] font-semibold text-slate-500">
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

            {/* Main body: Photo + Details */}
            <Link
              to="/visits/$visitId"
              params={{ visitId: v.id }}
              className="flex items-start gap-3 min-w-0"
            >
              <div className="relative shrink-0">
                <VisitPhoto
                  src={v.photo_url}
                  alt={v.location?.location_name ?? "Visit photo"}
                  className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-xl object-cover ring-1 ring-slate-200 shadow-2xs"
                />
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-bold text-slate-900 text-xs sm:text-sm leading-snug group-hover:text-sky-600 transition-colors line-clamp-2">
                    {v.location?.company_name
                      ? `${v.location.company_name} — ${v.location.location_name}`
                      : (v.location?.location_name ?? "Office Visit")}
                  </p>
                  {v.employee?.employee_id && (
                    <span className="rounded bg-sky-50 border border-sky-200/80 px-1.5 py-0.2 text-[9.5px] font-mono font-bold text-sky-700">
                      {v.employee.employee_id}
                    </span>
                  )}
                </div>

                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10.5px] font-medium max-w-full truncate">
                  <span className="text-slate-500">Purpose:</span>
                  <span className="font-bold truncate">{v.visit_purpose}</span>
                </div>

                <p className="text-[10.5px] sm:text-[11px] text-slate-500 flex items-center gap-1">
                  <span>📍</span>
                  <span className="font-semibold text-slate-700">{formatDistance(v.distance)}</span>
                  <span>from office</span>
                </p>
              </div>
            </Link>
          </div>
        ))}

        {visits && visits.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white/60 py-12 text-center shadow-xs">
            <Search className="h-6 w-6 text-slate-400" />
            <p className="text-xs text-slate-500">No visits match these filters.</p>
          </div>
        )}

        {!visits && (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        )}
      </div>

      {visits && visits.length > 0 && (
        <p className="flex items-center gap-1.5 text-[10.5px] sm:text-xs text-slate-400 px-1">
          <History className="h-3 w-3" /> Photos are stored securely and watermarked with live GPS coordinates.
        </p>
      )}

      {/* Confirmation Dialog for Deleting a Single Incorrect Visit */}
      <AlertDialog open={!!deleteVisitTarget} onOpenChange={(open) => !open && setDeleteVisitTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this incorrect visit?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your visit report for <strong>{deleteVisitTarget?.name || "this visit"}</strong> and remove its photo proof.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSingleVisit.isPending} className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleteVisitTarget) deleteSingleVisit.mutate(deleteVisitTarget.id);
              }}
              disabled={deleteSingleVisit.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
            >
              {deleteSingleVisit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Delete Visit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

