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
  const { data: locations } = useQuery({
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 animate-fade-up">
        <div>
          <h1 className="font-display text-2xl font-bold">Visit History</h1>
          <p className="text-sm text-muted-foreground">
            {visits ? `${visits.length} visit${visits.length === 1 ? "" : "s"} found` : "Loading…"}
            {isFetching && " · refreshing…"}
          </p>
        </div>
        {(visits ?? []).length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/10 text-xs font-semibold"
            onClick={() => setShowClearAllConfirm(true)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove All My Entries
          </Button>
        )}
      </div>

      {/* Confirmation Dialog for Clearing All Entries */}
      <AlertDialog open={showClearAllConfirm} onOpenChange={setShowClearAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove All My Visit Entries?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your daily visit reports, GPS records, photos, and pending location requests.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearAllMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                clearAllMutation.mutate();
              }}
              disabled={clearAllMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearAllMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Remove All My Entries
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Compact Filter Bar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-soft animate-fade-up">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search office or purpose…"
            value={draft.search ?? ""}
            onChange={(e) => {
              const val = e.target.value || undefined;
              setDraft((d) => ({ ...d, search: val }));
              setApplied((d) => ({ ...d, search: val }));
            }}
            className="pl-9 h-9 text-xs"
          />
        </div>

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
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

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

      {/* Results */}
      <div className="space-y-3">
        {(visits ?? []).map((v) => (
          <div
            key={v.id}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-3 shadow-soft transition hover:bg-accent/40"
          >
            <Link
              to="/visits/$visitId"
              params={{ visitId: v.id }}
              className="flex items-center gap-4 min-w-0 flex-1"
            >
              <VisitPhoto
                src={v.photo_url}
                alt={v.location?.location_name ?? "Visit photo"}
                className="h-20 w-20 shrink-0 rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="truncate text-sm font-bold group-hover:text-primary">
                      {v.location?.company_name
                        ? `${v.location.company_name} — ${v.location.location_name}`
                        : (v.location?.location_name ?? "Office Visit")}
                    </p>
                    {v.employee?.employee_id && (
                      <span className="rounded bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[11px] font-mono font-bold text-primary">
                        {v.employee.employee_id}
                      </span>
                    )}
                  </div>
                </div>
                <p className="truncate text-sm text-muted-foreground">{v.visit_purpose}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {v.visit_date} · {v.visit_time.slice(0, 5)} · {formatDistance(v.distance)} from fixed point
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-2 shrink-0">
              <StatusPill status={v.status} />
              <button
                type="button"
                title="Delete incorrect visit"
                className="p-2 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteVisitTarget({
                    id: v.id,
                    name: v.location?.location_name || "Office Visit",
                  });
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {visits && visits.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card py-14 text-center shadow-soft">
            <Search className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No visits match these filters.</p>
          </div>
        )}
        {!visits && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        )}
      </div>

      {visits && visits.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <History className="h-3.5 w-3.5" /> Photos are stored securely and watermarked permanently.
        </p>
      )}

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
    </div>
  );
}

