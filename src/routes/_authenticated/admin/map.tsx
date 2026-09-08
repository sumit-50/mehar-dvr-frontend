import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, MapPin, Users } from "lucide-react";
import { adminGetLocations, adminGetVisits } from "@/lib/admin.functions";
import { AdminOnly } from "@/components/AdminOnly";
import { LocationMap, type MapCircle, type MapMarker } from "@/components/LocationMap";

export const Route = createFileRoute("/_authenticated/admin/map")({
  head: () => ({
    meta: [
      { title: "Locations Map — Mehar DVR" },
      { name: "description", content: "Live map of all fixed locations and today's verified visits." },
      { property: "og:title", content: "Locations Map — Mehar DVR" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AdminMapPage,
});

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function AdminMapPage() {
  const { data: locations } = useQuery({
    queryKey: ["admin-locations"],
    queryFn: () => adminGetLocations({}),
  });
  const { data: todayVisits } = useQuery({
    queryKey: ["admin-visits", { from: todayStr() }],
    queryFn: () => adminGetVisits({ data: { from: todayStr() } }),
  });

  const activeLocations = (locations ?? []).filter((l) => l.status === "active");
  const uniqueEmployeesToday = new Set((todayVisits ?? []).map((v) => v.employee_id)).size;

  const markers: MapMarker[] = [
    ...activeLocations.map((l) => ({
      id: `loc-${l.id}`,
      lat: l.latitude,
      lng: l.longitude,
      title: l.location_name,
      subtitle: `${l.location_code} · radius ${l.allowed_radius} m`,
      tone: "primary" as const,
      label: "F",
    })),
    ...(todayVisits ?? []).map((v) => ({
      id: `visit-${v.id}`,
      lat: v.actual_latitude,
      lng: v.actual_longitude,
      title: `${v.employee?.name ?? "Employee"} — ${v.location?.location_name ?? ""}`,
      subtitle: `${v.visit_time.slice(0, 5)} · ${v.visit_purpose}`,
      tone: "success" as const,
      label: "V",
    })),
  ];
  const circles: MapCircle[] = activeLocations.map((l) => ({
    id: `circle-${l.id}`,
    lat: l.latitude,
    lng: l.longitude,
    radius: l.allowed_radius,
    tone: "primary" as const,
  }));

  return (
    <AdminOnly>
      <div className="space-y-5">
        <div className="animate-fade-up">
          <h1 className="font-display text-2xl font-bold">Locations Map</h1>
          <p className="text-sm text-muted-foreground">
            Blue pins are fixed locations with their allowed radius; green pins are today's visits.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Active locations
            </p>
            <p className="mt-1 font-display text-2xl font-bold">{activeLocations.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CalendarCheck className="h-3.5 w-3.5" /> Visits today
            </p>
            <p className="mt-1 font-display text-2xl font-bold">{(todayVisits ?? []).length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Field today
            </p>
            <p className="mt-1 font-display text-2xl font-bold">{uniqueEmployeesToday}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <LocationMap className="h-[60vh] min-h-[420px] w-full" fit markers={markers} circles={circles} />
        </div>
      </div>
    </AdminOnly>
  );
}
