import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Bell,
  BellRing,
  BellOff,
  Camera,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { adminGetEmployees, adminGetLocations, adminGetVisits } from "@/lib/admin.functions";
import type { VisitWithRefs, LocationWithStats, EmployeeWithAssignments } from "@/lib/dvr-types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface AdminNotification {
  id: string;
  type: "visit" | "location_request" | "new_employee";
  title: string;
  subtitle: string;
  timestamp: string; // ISO string
  read: boolean;
  data: {
    visitId?: string | undefined;
    employeeName?: string | undefined;
    employeeId?: string | undefined;
    locationName?: string | undefined;
    purpose?: string | undefined;
    distance?: number | undefined;
    isVerified?: boolean | undefined;
    status?: string | undefined;
    address?: string | undefined;
  };
}

// Web Audio API Synthesizer for notifications chime
function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    // Play a friendly two-tone chime (587.33Hz D5 -> 880Hz A5)
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.36);
  } catch (e) {
    // AudioContext might be blocked until user interacts with document
    console.debug("Audio chime skipped:", e);
  }
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "recently";
  const now = Date.now();
  const past = new Date(dateStr).getTime();
  const diffSec = Math.max(0, Math.floor((now - past) / 1000));

  if (diffSec < 45) return "Just now";
  if (diffSec < 90) return "1 min ago";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export function useAdminNotifications() {
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("dvr_admin_read_notification_ids");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("dvr_admin_notification_sound");
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });

  // Keep a set of known visit IDs to detect brand new submissions
  const initialMountRef = useRef(true);
  const knownVisitIdsRef = useRef<Set<string>>(new Set());

  const { data: visits } = useQuery({
    queryKey: ["admin-visits", {}],
    queryFn: () => adminGetVisits({ data: {} }),
    refetchInterval: 4_000,
  });

  const { data: locations } = useQuery({
    queryKey: ["admin-locations"],
    queryFn: () => adminGetLocations({}),
    refetchInterval: 6_000,
  });

  const { data: employees } = useQuery({
    queryKey: ["admin-employees"],
    queryFn: () => adminGetEmployees({}),
    refetchInterval: 8_000,
  });

  // Construct dynamic list of notifications
  const notifications: AdminNotification[] = useMemo(() => {
    const list: AdminNotification[] = [];

    // 1. Visits notifications
    for (const v of visits ?? []) {
      const empName = v.employee?.name || "Field Employee";
      const empId = v.employee?.employee_id || "MEH101";
      const locName = v.location?.location_name || v.location?.company_name || "Client Office";
      const isVerified = v.status === "verified" || (typeof v.distance === "number" && v.distance <= 100);

      list.push({
        id: `visit_${v.id}`,
        type: "visit",
        title: `DVR Visit: ${empName} (${empId})`,
        subtitle: `${v.visit_purpose || "Client Visit"} @ ${locName}`,
        timestamp: v.created_at || (v.visit_date ? `${v.visit_date}T${v.visit_time || "12:00:00"}` : new Date().toISOString()),
        read: readIds.has(`visit_${v.id}`),
        data: {
          visitId: v.id,
          employeeName: empName,
          employeeId: empId,
          locationName: locName,
          purpose: v.visit_purpose,
          distance: typeof v.distance === "number" ? Math.round(v.distance) : undefined,
          isVerified,
          status: v.status,
          address: v.location?.address,
        },
      });
    }

    // 2. Pending location requests
    for (const loc of (locations ?? []).filter((l) => l.status === "pending")) {
      list.push({
        id: `loc_${loc.id}`,
        type: "location_request",
        title: `Office Request: ${loc.location_name}`,
        subtitle: `Pending verification · ${loc.address || "Jaipur"}`,
        timestamp: loc.created_at || new Date().toISOString(),
        read: readIds.has(`loc_${loc.id}`),
        data: {
          locationName: loc.location_name,
          address: loc.address,
          status: "pending",
        },
      });
    }

    // 3. New employees
    for (const emp of employees ?? []) {
      if (emp.employee_id !== "MEH000" && emp.role !== "admin") {
        list.push({
          id: `emp_${emp.id}`,
          type: "new_employee",
          title: `Field Staff: ${emp.name}`,
          subtitle: `ID: ${emp.employee_id || "MEH101"} · ${emp.email || "Registered"}`,
          timestamp: emp.created_at || new Date().toISOString(),
          read: readIds.has(`emp_${emp.id}`),
          data: {
            employeeName: emp.name,
            employeeId: emp.employee_id,
          },
        });
      }
    }

    // Sort newest first
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return list;
  }, [visits, locations, employees, readIds]);

  // Live Toast & Sound Trigger on new visit submission
  useEffect(() => {
    if (!visits || visits.length === 0) return;

    if (initialMountRef.current) {
      // First load: seed the known visit IDs
      visits.forEach((v) => knownVisitIdsRef.current.add(v.id));
      initialMountRef.current = false;
      return;
    }

    // Check for newly arrived visits
    const newVisits = visits.filter((v) => !knownVisitIdsRef.current.has(v.id));
    if (newVisits.length > 0) {
      newVisits.forEach((v) => {
        knownVisitIdsRef.current.add(v.id);
        const empName = v.employee?.name || "Employee";
        const empId = v.employee?.employee_id || "MEH101";
        const locName = v.location?.location_name || "Office";
        const purpose = v.visit_purpose || "Consultation";
        const isVerified = v.status === "verified" || (typeof v.distance === "number" && v.distance <= 100);

        if (soundEnabled) {
          playNotificationChime();
        }

        toast.custom(
          (t) => (
            <div
              className={cn(
                "flex w-full items-start gap-3 rounded-2xl border bg-card p-4 shadow-xl backdrop-blur-md transition-all",
                isVerified
                  ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 via-card to-card ring-1 ring-emerald-500/20"
                  : "border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-card to-card ring-1 ring-amber-500/20",
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-white shadow-md",
                  isVerified
                    ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20"
                    : "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/20",
                )}
              >
                <Camera className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-bold text-foreground">
                    🔔 New DVR Visit Submitted!
                  </p>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Just now
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <strong className="text-foreground">{empName}</strong> ({empId}) logged{" "}
                  <span className="text-primary font-medium">{purpose}</span> @{" "}
                  <strong>{locName}</strong>
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                      isVerified
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {isVerified ? (
                      <>
                        <ShieldCheck className="h-3 w-3" /> GPS Verified
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="h-3 w-3" /> {v.distance ? `${Math.round(v.distance)}m away` : "Pending"}
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          ),
          { duration: 6000 },
        );
      });
    }
  }, [visits, soundEnabled]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem("dvr_admin_notification_sound", String(next));
    } catch {}
    if (next) {
      playNotificationChime();
      toast.success("🔔 Audio chime enabled for new visit submissions");
    } else {
      toast.info("🔕 Audio chime muted");
    }
  };

  const markAsRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem("dvr_admin_read_notification_ids", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const markAllAsRead = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
    try {
      localStorage.setItem("dvr_admin_read_notification_ids", JSON.stringify(Array.from(allIds)));
    } catch {}
    toast.success("All notifications marked as read");
  };

  const clearAllNotifications = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
    try {
      localStorage.setItem("dvr_admin_read_notification_ids", JSON.stringify(Array.from(allIds)));
    } catch {}
    toast.success("Notification history cleared");
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    soundEnabled,
    toggleSound,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
  };
}

export function AdminNotificationCenter({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "visits" | "locations" | "employees">("all");

  const {
    notifications,
    unreadCount,
    soundEnabled,
    toggleSound,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
  } = useAdminNotifications();

  const filtered = useMemo(() => {
    if (activeTab === "visits") return notifications.filter((n) => n.type === "visit");
    if (activeTab === "locations") return notifications.filter((n) => n.type === "location_request");
    if (activeTab === "employees") return notifications.filter((n) => n.type === "new_employee");
    return notifications;
  }, [notifications, activeTab]);

  const handleNotificationClick = (item: AdminNotification) => {
    markAsRead(item.id);
    setOpen(false);
    if (item.type === "visit") {
      navigate({ to: "/admin/visits" });
    } else if (item.type === "location_request") {
      navigate({ to: "/admin/locations" });
    } else if (item.type === "new_employee") {
      navigate({ to: "/admin/employees" });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications (${unreadCount} unread)`}
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-card text-foreground shadow-xs transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5 focus-visible:outline-hidden cursor-pointer",
            unreadCount > 0 && "ring-2 ring-emerald-500/30 border-emerald-500/40 bg-emerald-500/5",
            className,
          )}
        >
          {unreadCount > 0 ? (
            <BellRing className="h-5 w-5 text-emerald-600 dark:text-emerald-400 animate-bounce-short" />
          ) : (
            <Bell className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          )}

          <span
            className={cn(
              "absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-white shadow-sm ring-2 ring-background",
              unreadCount > 0
                ? "bg-red-600 shadow-red-500/30 animate-pulse"
                : "bg-emerald-600 shadow-emerald-500/20",
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[380px] sm:w-[420px] p-0 rounded-3xl border border-border/90 bg-card shadow-2xl overflow-hidden"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-4 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="font-display text-sm font-bold tracking-tight text-foreground">
                  Super Admin Alerts
                </h4>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="h-4.5 px-1.5 text-[10px] font-bold uppercase tracking-wider">
                    {unreadCount} New
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Real-time field employee submissions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
              title={soundEnabled ? "Mute audio alerts" : "Enable audio alerts"}
              onClick={toggleSound}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs font-semibold text-primary hover:text-primary/80"
                onClick={markAllAsRead}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex border-b border-border/60 bg-card px-3 py-2 gap-1.5">
          {[
            { id: "all", label: "All", count: notifications.length },
            { id: "visits", label: "DVR Visits", count: notifications.filter((n) => n.type === "visit").length },
            { id: "locations", label: "Locations", count: notifications.filter((n) => n.type === "location_request").length },
            { id: "employees", label: "Staff", count: notifications.filter((n) => n.type === "new_employee").length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 rounded-xl py-1 px-2 text-[11px] font-semibold transition-all text-center cursor-pointer",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tab.label}
              <span className={cn("ml-1 text-[9px] opacity-80", activeTab === tab.id ? "text-white" : "text-muted-foreground")}>
                ({tab.count})
              </span>
            </button>
          ))}
        </div>

        {/* Notification List */}
        <ScrollArea className="h-[380px] px-2 py-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground/60 mb-3">
                <Bell className="h-6 w-6" />
              </div>
              <p className="text-xs font-semibold text-foreground">No notifications found</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                New visits & activities will automatically appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((item) => {
                const isVisit = item.type === "visit";
                const isLoc = item.type === "location_request";
                const isEmp = item.type === "new_employee";

                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={cn(
                      "group relative flex items-start gap-3 rounded-2xl p-3 text-left transition-all cursor-pointer border",
                      !item.read
                        ? "bg-primary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/30"
                        : "bg-card border-border/50 hover:bg-accent/60 hover:border-border",
                    )}
                  >
                    {/* Unread indicator pill */}
                    {!item.read && (
                      <span className="absolute left-1.5 top-3.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                    )}

                    {/* Icon */}
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-xs ml-1.5",
                        isVisit && (item.data.isVerified ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-gradient-to-br from-amber-500 to-orange-600"),
                        isLoc && "bg-gradient-to-br from-blue-500 to-indigo-600",
                        isEmp && "bg-gradient-to-br from-purple-500 to-pink-600",
                      )}
                    >
                      {isVisit && <Camera className="h-4.5 w-4.5" />}
                      {isLoc && <MapPin className="h-4.5 w-4.5" />}
                      {isEmp && <UserPlus className="h-4.5 w-4.5" />}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className={cn("truncate text-xs font-bold text-foreground", !item.read && "text-primary font-black")}>
                          {item.title}
                        </p>
                        <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                          {timeAgo(item.timestamp)}
                        </span>
                      </div>

                      <p className="truncate text-xs text-muted-foreground mt-0.5 font-medium">
                        {item.subtitle}
                      </p>

                      {/* Extra Badges / Details */}
                      {isVisit && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {item.data.isVerified ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                              <ShieldCheck className="h-2.5 w-2.5" /> 100m GPS Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                              <ShieldAlert className="h-2.5 w-2.5" />{" "}
                              {typeof item.data.distance === "number" ? `${item.data.distance}m away` : "Unverified"}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {item.data.employeeId}
                          </span>
                        </div>
                      )}

                      {isLoc && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                          <Clock className="h-3 w-3" /> Awaiting Admin Geofence Approval
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/70 bg-muted/30 px-4 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="text-[11px] font-medium text-muted-foreground hover:text-destructive h-7 px-2"
            onClick={clearAllNotifications}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Clear feed
          </Button>

          <Button
            variant="link"
            size="sm"
            className="text-[11px] font-bold text-primary h-7 px-2"
            onClick={() => {
              setOpen(false);
              navigate({ to: "/admin/visits" });
            }}
          >
            View all visits <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AdminLiveNotificationFeed({ className }: { className?: string }) {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    soundEnabled,
    toggleSound,
    markAsRead,
    markAllAsRead,
  } = useAdminNotifications();

  const [activeTab, setActiveTab] = useState<"all" | "visits" | "locations">("all");

  const filtered = useMemo(() => {
    if (activeTab === "visits") return notifications.filter((n) => n.type === "visit");
    if (activeTab === "locations") return notifications.filter((n) => n.type === "location_request");
    return notifications.slice(0, 15);
  }, [notifications, activeTab]);

  return (
    <div className={cn("overflow-hidden rounded-3xl border border-border/80 bg-card p-5 shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 font-bold text-white shadow-md shadow-blue-500/20">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-bold text-foreground">
                Live Employee Activity & Notifications
              </h3>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="animate-pulse">
                  {unreadCount} Unread
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Instant alerts whenever a field employee submits a DVR visit or requests an office
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSound}
            className="rounded-xl text-xs font-semibold gap-1.5 h-8.5"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="h-3.5 w-3.5 text-emerald-500" /> Sound: ON
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5 text-muted-foreground" /> Sound: OFF
              </>
            )}
          </Button>

          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={markAllAsRead}
              className="rounded-xl text-xs font-semibold gap-1.5 h-8.5"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-2">
        {[
          { id: "all", label: "All Activity", count: notifications.length },
          { id: "visits", label: "DVR Visits", count: notifications.filter((n) => n.type === "visit").length },
          { id: "locations", label: "Location Requests", count: notifications.filter((n) => n.type === "location_request").length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* List */}
      <div className="mt-3.5 space-y-2 max-h-[340px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No live activity recorded yet.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                markAsRead(item.id);
                if (item.type === "visit") navigate({ to: "/admin/visits" });
                else if (item.type === "location_request") navigate({ to: "/admin/locations" });
              }}
              className={cn(
                "group flex items-center justify-between gap-3 rounded-2xl border p-3 transition-all cursor-pointer",
                !item.read
                  ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
                  : "border-border/60 bg-card hover:bg-accent/50",
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white font-bold text-xs shadow-xs",
                    item.type === "visit" && (item.data.isVerified ? "bg-emerald-600" : "bg-amber-600"),
                    item.type === "location_request" && "bg-blue-600",
                    item.type === "new_employee" && "bg-purple-600",
                  )}
                >
                  {item.type === "visit" ? <Camera className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn("truncate text-xs font-bold", !item.read ? "text-primary" : "text-foreground")}>
                      {item.title}
                    </p>
                    {!item.read && (
                      <span className="rounded-full bg-primary/20 px-1.5 py-0.2 text-[9px] font-bold text-primary">
                        New
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                    {item.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {item.type === "visit" && item.data.isVerified && (
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                    <ShieldCheck className="h-3 w-3" /> Verified
                  </span>
                )}
                <span className="text-[10px] font-medium text-muted-foreground">
                  {timeAgo(item.timestamp)}
                </span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
