import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  Clock,
  Crosshair,
  Expand,
  FileText,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  PhoneCall,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { deleteMyVisit, getSessionInfo, getVisitById } from "@/lib/dvr.functions";
import { adminApproveVisit, adminSetVisitStatus } from "@/lib/admin.functions";
import { formatAccuracy, formatCoord, formatDistance } from "@/lib/geo";
import { LocationMap } from "@/components/LocationMap";
import { StatusPill } from "@/components/StatusPill";
import { VisitPhoto } from "@/components/VisitPhoto";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/visits/$visitId")({
  head: () => ({
    meta: [
      { title: "Visit Detail & Verification — Mehar DVR" },
      { name: "description", content: "Full GPS-verified visit report with photo proof and verification." },
      { property: "og:title", content: "Visit Detail & Verification — Mehar DVR" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: VisitDetailPage,
});

function InfoItem({
  icon: Icon,
  label,
  value,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-2.5 border-b border-border/60 last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
          <p className="text-xs font-semibold text-foreground truncate">{value}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function VisitDetailPage() {
  const { visitId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [photoOpen, setPhotoOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => getSessionInfo() });
  const { data: visit, error } = useQuery({
    queryKey: ["visit", visitId],
    queryFn: () => getVisitById({ data: { id: visitId } }),
    retry: false,
  });

  // Admin Approve Visit Mutation (Locks fixed GPS & creates 100m radius)
  const approveVisit = useMutation({
    mutationFn: () => adminApproveVisit({ data: { visitId } }),
    onSuccess: async () => {
      toast.success("✅ Visit Approved! Location permanently fixed with 100m radius.");
      await queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Approval failed"),
  });

  const setStatus = useMutation({
    mutationFn: (status: "submitted" | "verified" | "rejected") =>
      adminSetVisitStatus({ data: { id: visitId, status } }),
    onSuccess: async () => {
      toast.success("Visit status updated");
      await queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed"),
  });

  // Delete this incorrect visit
  const deleteVisitMutation = useMutation({
    mutationFn: () => deleteMyVisit({ data: { id: visitId } }),
    onSuccess: async () => {
      toast.success("Visit report deleted successfully");
      await queryClient.invalidateQueries({ queryKey: ["my-visits"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-visits"] });
      await queryClient.invalidateQueries();
      navigate({ to: session?.isAdmin ? "/admin/visits" : "/dashboard" });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete visit"),
  });

  if (error) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-soft animate-fade-up">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success shadow-soft">
          <BadgeCheck className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold font-display text-foreground">Visit Recorded Successfully</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your GPS-verified visit report with photo watermark has been recorded.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild variant="outline" size="lg" className="font-semibold">
            <Link to="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Link>
          </Button>
          <Button asChild size="lg" className="font-semibold shadow-lift">
            <Link to="/visit">
              <Navigation className="mr-2 h-4 w-4" /> Start Another Visit
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-14 w-full rounded-2xl bg-muted" />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="h-96 rounded-2xl bg-muted" />
          <div className="h-96 rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  const isLocationFixed = visit.location?.status === "active" || visit.status === "verified";
  const locationTitle = visit.location?.company_name
    ? `${visit.location.company_name} — ${visit.location.location_name}`
    : (visit.location?.location_name ?? "Office Visit");

  return (
    <div className="mx-auto max-w-6xl space-y-5 animate-fade-up pb-10">
      {/* 1. Header Bar with Clean Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-9 font-semibold">
            <Link to={session?.isAdmin ? "/admin/visits" : "/dashboard"}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {session?.isAdmin ? "All Visits" : "Dashboard"}
            </Link>
          </Button>
          <div className="h-4 w-px bg-border mx-1" />
          <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary font-mono">
            {visit.location?.location_code ?? "DVR"}
          </span>
          <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">
            {visit.visit_purpose}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteConfirmOpen(true)}
            className="h-9 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete Visit
          </Button>
          <Button asChild size="sm" className="h-9 font-semibold shadow-lift">
            <Link to="/visit">
              <Navigation className="mr-1.5 h-3.5 w-3.5" /> Start New Visit
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. Main Title & Status Hero */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={visit.status} />
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide",
                isLocationFixed
                  ? "bg-success/15 text-success border border-success/30"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30",
              )}
            >
              {isLocationFixed ? "● 100m Radius Fixed" : "● 1st Visit (Pending Fix)"}
            </span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground mt-1">
            {locationTitle}
          </h1>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <span>Visit on <strong>{visit.visit_date}</strong> at {visit.visit_time.slice(0, 8)}</span>
            <span>·</span>
            <span>Recorded by <strong>{visit.employee?.name || "Employee"}</strong> ({visit.employee?.employee_id || "MEH"})</span>
          </p>
        </div>

        {/* Quick Admin Actions inside Hero */}
        {session?.isAdmin && visit.status === "submitted" && (
          <div className="flex flex-wrap items-center gap-2 bg-muted/40 p-2.5 rounded-xl border border-border">
            <Button
              size="sm"
              className="font-bold shadow-lift bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={approveVisit.isPending}
              onClick={() => approveVisit.mutate()}
            >
              {approveVisit.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <BadgeCheck className="mr-1.5 h-4 w-4" />
              )}
              Approve (Fix 100m)
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/40 hover:bg-destructive/10"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate("rejected")}
            >
              <XCircle className="mr-1.5 h-4 w-4" /> Reject
            </Button>
          </div>
        )}
      </div>

      {/* 3. Main 2-Column Responsive Layout */}
      <div className="grid gap-5 lg:grid-cols-12 items-start">
        {/* Left Column (Visual Verification: Photo & Map) - 7 cols */}
        <div className="space-y-5 lg:col-span-7">
          {/* Photo Proof Card */}
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
              <span className="text-xs font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Live Camera Proof & Embedded GPS Watermark
              </span>
              {visit.photo_url && (
                <button
                  type="button"
                  onClick={() => setPhotoOpen(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Expand className="h-3.5 w-3.5" /> Full Size
                </button>
              )}
            </div>

            <div className="relative group bg-black/90">
              <VisitPhoto
                src={visit.photo_url}
                alt={`Watermarked proof photo at ${visit.location?.location_name}`}
                className="aspect-[4/3] w-full object-contain"
              />
            </div>
          </section>

          {/* Location Map Card */}
          <section className="rounded-2xl border border-border bg-card p-4 shadow-soft space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                GPS Verification Map
              </span>
              <span className="font-mono text-xs font-semibold text-muted-foreground">
                Pin: {formatCoord(visit.actual_latitude)}, {formatCoord(visit.actual_longitude)} ({formatAccuracy(visit.gps_accuracy)})
              </span>
            </div>

            <LocationMap
              className="h-72 w-full"
              fit
              markers={[
                {
                  id: "actual",
                  lat: visit.actual_latitude,
                  lng: visit.actual_longitude,
                  title: "📍 Point 2: Staff Captured Live GPS",
                  subtitle: `Accuracy: ${formatAccuracy(visit.gps_accuracy)}`,
                  tone: visit.status === "verified" || visit.distance <= 100 ? "success" : "danger",
                  label: "📍",
                },
                ...(isLocationFixed
                  ? [
                      {
                        id: "fixed",
                        lat: visit.fixed_latitude,
                        lng: visit.fixed_longitude,
                        title: `🏢 Point 1: ${visit.location?.location_name || "Office Destination"} (Fixed)`,
                        subtitle: `Allowed radius 100m`,
                        tone: "primary" as const,
                        label: "🏢",
                      },
                    ]
                  : []),
              ]}
              circles={[
                {
                  id: "radius",
                  lat: isLocationFixed ? visit.fixed_latitude : visit.actual_latitude,
                  lng: isLocationFixed ? visit.fixed_longitude : visit.actual_longitude,
                  radius: 100,
                  tone: "primary",
                },
              ]}
            />
          </section>
        </div>

        {/* Right Column (Complete Visit Intelligence) - 5 cols */}
        <div className="space-y-5 lg:col-span-5">
          {/* Office & Owner Verification Card */}
          <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 pb-2 border-b border-border">
              <Building2 className="h-4 w-4 text-primary" />
              Office & Owner Details
            </h3>

            <div className="divide-y divide-border/60">
              <InfoItem
                icon={User}
                label="Owner / Contact Person"
                value={visit.location?.owner_name || "—"}
              />

              <InfoItem
                icon={Phone}
                label="Owner Contact Number"
                value={visit.location?.owner_number || "—"}
                action={
                  visit.location?.owner_number ? (
                    <a
                      href={`tel:${visit.location.owner_number}`}
                      className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary hover:bg-primary/20"
                    >
                      <PhoneCall className="h-3 w-3" /> Call
                    </a>
                  ) : null
                }
              />

              <InfoItem
                icon={Building2}
                label="Office / Branch"
                value={visit.location?.location_name || "—"}
              />

              {visit.location?.company_description && (
                <div className="pt-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Office Description</p>
                  <p className="text-xs text-foreground bg-muted/40 p-2.5 rounded-lg border border-border leading-relaxed">
                    {visit.location.company_description}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Visit & Audit Metadata Card */}
          <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 pb-2 border-b border-border">
              <FileText className="h-4 w-4 text-primary" />
              Visit Verification Log
            </h3>

            <div className="divide-y divide-border/60">
              <InfoItem
                icon={User}
                label="Visiting Employee"
                value={visit.employee ? `${visit.employee.name} (${visit.employee.employee_id})` : "—"}
              />

              <InfoItem
                icon={MapPin}
                label="Purpose of Visit"
                value={visit.visit_purpose}
              />

              <InfoItem
                icon={CalendarDays}
                label="Date & Time"
                value={`${visit.visit_date} · ${visit.visit_time.slice(0, 8)} IST`}
              />

              <InfoItem
                icon={Crosshair}
                label="Satellite GPS Accuracy"
                value={formatAccuracy(visit.gps_accuracy)}
              />

              <InfoItem
                icon={Navigation}
                label="Distance from Fixed Office"
                value={isLocationFixed ? formatDistance(visit.distance) : "1st Visit (Pending Verification)"}
              />

              <InfoItem
                icon={Clock}
                label="Report Submitted At"
                value={new Date(visit.created_at).toLocaleString("en-IN")}
              />
            </div>
          </section>

          {/* Employee Remarks */}
          {visit.remarks && (
            <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                Employee Remarks / Notes
              </p>
              <div className="rounded-lg bg-muted/30 border border-border p-3 text-xs text-foreground leading-relaxed">
                {visit.remarks}
              </div>
            </section>
          )}

          {/* Admin Status Reset (if already decided) */}
          {session?.isAdmin && visit.status !== "submitted" && (
            <section className="rounded-2xl border border-border bg-card p-4 shadow-soft flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-foreground">Change Status</p>
                <p className="text-[11px] text-muted-foreground">Admin can re-open or adjust verification.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate("submitted")}
                className="text-xs h-8"
              >
                Reset to Submitted
              </Button>
            </section>
          )}
        </div>
      </div>

      {/* Full-size Photo Viewer Modal */}
      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent className="max-w-5xl border-none bg-black/95 p-2 shadow-none [&>button]:text-white">
          <DialogTitle className="sr-only">
            Visit Photo Proof — {visit.location?.location_name}
          </DialogTitle>
          {visit.photo_url && (
            <img
              src={visit.photo_url}
              alt={`Full-size watermarked proof photo at ${visit.location?.location_name}`}
              className="max-h-[88vh] w-full rounded-xl object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Deleting Visit */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Delete this incorrect visit?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this visit report for <strong>{visit.location?.location_name || "this office"}</strong> ({visit.visit_date} at {visit.visit_time.slice(0, 5)}) along with its photo proof. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteVisitMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteVisitMutation.mutate();
              }}
              disabled={deleteVisitMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteVisitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
