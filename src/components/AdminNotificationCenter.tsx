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
import { getMyVisits } from "@/lib/dvr.functions";
import { apiFetch } from "@/lib/api-client";
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

  const [clearedIds, setClearedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("dvr_admin_cleared_notification_ids");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [clearedBefore, setClearedBefore] = useState<number>(() => {
    try {
      const stored = localStorage.getItem("dvr_admin_cleared_before_timestamp");
      return stored ? Number(stored) : 0;
    } catch {
      return 0;
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

  const localRole = typeof window !== "undefined" ? localStorage.getItem("dvr_user_role") : null;
  const localEmail = typeof window !== "undefined" ? localStorage.getItem("dvr_user_email") : null;
  const localId = typeof window !== "undefined" ? localStorage.getItem("dvr_user_id") : null;
  const localName = typeof window !== "undefined" ? localStorage.getItem("dvr_user_name") : null;

  const isAdmin: boolean = Boolean(
    localRole === "admin" ||
    localId === "MEH000" ||
    localId === "MEH-ADM-001" ||
    localEmail === "admin@meharadvisory.com" ||
    (localName && localName.toLowerCase().includes("admin"))
  );

  const { data: adminVisits } = useQuery<any[]>({
    queryKey: ["admin-visits", {}],
    queryFn: async () => {
      try {
        const res = await apiFetch<any[]>("/admin/visits");
        if (Array.isArray(res) && res.length > 0) return res;
      } catch {}
      try {
        return (await adminGetVisits({ data: {} })) as any[];
      } catch {}
      return [];
    },
    enabled: isAdmin,
    refetchInterval: isAdmin ? 4000 : false,
  });

  const { data: employeeVisits } = useQuery<any[]>({
    queryKey: ["my-visits", {}],
    queryFn: async () => {
      try {
        return (await getMyVisits({ data: {} })) as any[];
      } catch {
        return [];
      }
    },
    enabled: !isAdmin,
    refetchInterval: !isAdmin ? 6000 : false,
  });

  const visits: any[] = Array.isArray(isAdmin ? adminVisits : employeeVisits)
    ? ((isAdmin ? adminVisits : employeeVisits) as any[])
    : [];

  const { data: locations = [] } = useQuery<any[]>({
    queryKey: ["admin-locations"],
    queryFn: async () => {
      try {
        const res = await apiFetch<any[]>("/admin/locations");
        if (Array.isArray(res) && res.length > 0) return res;
      } catch {}
      try {
        return (await adminGetLocations({})) as any[];
      } catch {}
      return [];
    },
    enabled: isAdmin,
    refetchInterval: isAdmin ? 6000 : false,
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["admin-employees"],
    queryFn: async () => {
      try {
        const res = await apiFetch<any[]>("/admin/employees");
        if (Array.isArray(res) && res.length > 0) return res;
      } catch {}
      try {
        return (await adminGetEmployees({})) as any[];
      } catch {}
      return [];
    },
    enabled: isAdmin,
    refetchInterval: isAdmin ? 8000 : false,
  });

  // Construct dynamic list of notifications - EXCLUSIVELY REAL DVR VISITS
  const notifications: AdminNotification[] = useMemo(() => {
    const list: AdminNotification[] = [];

    const isCleared = (id: string, ts?: string | null) => {
      if (clearedIds.has(id)) return true;
      if (clearedBefore > 0 && ts) {
        const time = new Date(ts).getTime();
        if (!isNaN(time) && time <= clearedBefore) return true;
      }
      return false;
    };

    // Only genuine DVR Visits notifications
    for (const v of visits) {
      const id = `visit_${v.id}`;
      const timestamp = v.created_at || (v.visit_date ? `${v.visit_date}T${v.visit_time || "12:00:00"}` : new Date().toISOString());
      if (isCleared(id, timestamp)) continue;

      const empName = v.employee?.name || v.employee_name || v.emp_name || "Field Employee";
      const empId = v.employee?.employee_id || v.employee_code || v.emp_code || "MEH101";
      const locName = v.location?.location_name || v.location?.name || v.location_name || v.loc_name || "Client Office";
      const purpose = v.visit_purpose || v.purpose || "Client Visit";
      const isVerified = v.status === "verified" || (typeof v.distance === "number" && v.distance <= 100);

      list.push({
        id,
        type: "visit",
        title: `DVR Visit: ${empName} (${empId})`,
        subtitle: `${purpose} @ ${locName}`,
        timestamp,
        read: readIds.has(id),
        data: {
          visitId: v.id,
          employeeName: empName,
          employeeId: empId,
          locationName: locName,
          purpose,
          distance: typeof v.distance === "number" ? Math.round(v.distance) : undefined,
          isVerified,
          status: v.status,
          address: v.location?.address || v.location_address || v.loc_address,
        },
      });
    }

    // Sort newest first
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return list;
  }, [visits, readIds, clearedIds, clearedBefore]);

  // Live Toast & Sound Trigger on new visit submission
  useEffect(() => {
    if (!visits || visits.length === 0) return;

    if (initialMountRef.current) {
      // First load: seed the known visit IDs
      visits.forEach((v: any) => knownVisitIdsRef.current.add(v.id));
      initialMountRef.current = false;
      return;
    }

    // Check for newly arrived visits
    const newVisits = visits.filter((v: any) => !knownVisitIdsRef.current.has(v.id));
    if (newVisits.length > 0) {
      newVisits.forEach((v: any) => {
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
          () => (
            <div
              className={cn(
                "flex w-full items-start gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-md transition-all",
                isVerified
                  ? "border-emerald-500/30 bg-gradient-to-r from-emerald-50 via-white to-white ring-1 ring-emerald-500/20 text-slate-800"
                  : "border-amber-500/30 bg-gradient-to-r from-amber-50 via-white to-white ring-1 ring-amber-500/20 text-slate-800",
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-bold text-white shadow-md",
                  isVerified
                    ? "bg-gradient-to-tr from-emerald-500 to-teal-500 shadow-emerald-500/20"
                    : "bg-gradient-to-tr from-amber-500 to-orange-500 shadow-amber-500/20",
                )}
              >
                <Camera className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-black text-slate-900">
                    🔔 New DVR Visit Submitted!
                  </p>
                  <span className="text-[10px] font-medium text-slate-400">
                    Just now
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-600 font-medium">
                  <strong className="text-slate-900">{empName}</strong> ({empId}) logged{" "}
                  <span className="text-sky-600 font-bold">{purpose}</span> @{" "}
                  <strong className="text-slate-900">{locName}</strong>
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-2xs",
                      isVerified
                        ? "bg-emerald-100/80 text-emerald-800 border border-emerald-200"
                        : "bg-amber-100/80 text-amber-800 border border-amber-200",
                    )}
                  >
                    {isVerified ? (
                      <>
                        <ShieldCheck className="h-3 w-3 text-emerald-600" /> GPS Verified
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="h-3 w-3 text-amber-600" /> {typeof v?.distance === "number" ? `${Math.round(v.distance)}m away` : "Unverified"}
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          ),
          { duration: 5000 },
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

  const dismissNotification = (id: string) => {
    setClearedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem("dvr_admin_cleared_notification_ids", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
    toast.success("Notification dismissed");
  };

  const clearAllNotifications = () => {
    const now = Date.now();
    const currentIds = notifications.map((n) => n.id);
    setClearedBefore(now);
    setClearedIds((prev) => {
      const next = new Set([...prev, ...currentIds]);
      try {
        localStorage.setItem("dvr_admin_cleared_notification_ids", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
    try {
      localStorage.setItem("dvr_admin_cleared_before_timestamp", String(now));
    } catch {}
    toast.success("Notification feed cleared");
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    soundEnabled,
    toggleSound,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAllNotifications,
  };
}

export function AdminNotificationCenter({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "verified" | "warning">("all");

  const {
    notifications,
    unreadCount,
    soundEnabled,
    toggleSound,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAllNotifications,
  } = useAdminNotifications();

  const filtered = useMemo(() => {
    if (activeTab === "verified") return notifications.filter((n) => n.data.isVerified);
    if (activeTab === "warning") return notifications.filter((n) => !n.data.isVerified);
    return notifications;
  }, [notifications, activeTab]);

  const handleNotificationClick = (item: AdminNotification) => {
    markAsRead(item.id);
    setOpen(false);
    navigate({ to: "/admin/visits" });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications (${unreadCount} unread)`}
          className={cn(
            "relative flex h-8 w-8 sm:h-8.5 sm:w-8.5 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-600 shadow-xs backdrop-blur-sm transition-all duration-200 hover:border-sky-300 hover:bg-sky-50/50 hover:text-sky-600 focus-visible:outline-hidden cursor-pointer",
            unreadCount > 0 && "border-slate-200 text-slate-700",
            className,
          )}
        >
          {unreadCount > 0 ? (
            <div className="relative">
              <Bell className="h-4 w-4 text-slate-600" />
            </div>
          ) : (
            <Bell className="h-4 w-4 text-slate-500 hover:text-sky-600 transition-colors" />
          )}

          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[8.5px] font-black text-white shadow-xs ring-2 ring-white bg-[#00c58e]",
              )}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[calc(100vw-24px)] max-w-[360px] sm:w-[380px] p-0 rounded-2xl border border-slate-100 bg-white/98 backdrop-blur-xl shadow-xl overflow-hidden z-50 animate-in fade-in-50 zoom-in-95 duration-150"
        sideOffset={8}
      >
        {/* Header */}
        <div className="border-b border-slate-100 bg-gradient-to-r from-sky-50/70 via-slate-50/50 to-white px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 font-bold text-white shadow-xs">
                <Bell className="h-3.5 w-3.5" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-1.5 ring-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight truncate">
                    Notifications
                  </h4>
                  {unreadCount > 0 ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500 px-1.5 py-0.2 text-[9px] font-black text-white shrink-0">
                      {unreadCount} NEW
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-sky-100 px-1.5 py-0.2 text-[9px] font-bold text-sky-700 shrink-0">
                      Up to date
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 truncate leading-tight">
                  Live field employee visit activity
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                className={cn(
                  "flex h-6.5 w-6.5 items-center justify-center rounded-lg border transition-all cursor-pointer",
                  soundEnabled
                    ? "border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100"
                    : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50",
                )}
                title={soundEnabled ? "Mute alert chimes" : "Enable alert chimes"}
                onClick={toggleSound}
              >
                {soundEnabled ? (
                  <Volume2 className="h-3 w-3" />
                ) : (
                  <VolumeX className="h-3 w-3" />
                )}
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200/70 px-2 py-1 text-[10px] font-bold text-sky-700 transition-all cursor-pointer shadow-2xs"
                  onClick={markAllAsRead}
                >
                  <CheckCheck className="h-3 w-3 text-sky-600" />
                  <span>Mark read</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="p-1.5 bg-slate-50/60 border-b border-slate-100">
          <div className="grid grid-cols-3 gap-1 p-0.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
            {[
              { id: "all", label: "All Visits", count: notifications.length },
              { id: "verified", label: "GPS Verified", count: notifications.filter((n) => n.data.isVerified).length },
              { id: "warning", label: "Warning", count: notifications.filter((n) => !n.data.isVerified).length },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer",
                    isActive
                      ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50",
                  )}
                >
                  <span className="truncate">{tab.label}</span>
                  <span
                    className={cn(
                      "flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[8.5px] font-black leading-none shrink-0",
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notification List */}
        <ScrollArea className="h-[280px] p-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 shadow-2xs mb-2 border border-sky-100">
                <Sparkles className="h-5 w-5 text-sky-500" />
              </div>
              <p className="text-xs font-bold text-slate-800">No visits recorded</p>
              <p className="text-[10.5px] text-slate-400 mt-0.5 max-w-[200px]">
                New employee visit check-ins will show here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((item) => {
                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={cn(
                      "group relative flex items-start gap-2.5 rounded-xl p-2.5 text-left transition-all duration-150 cursor-pointer border",
                      !item.read
                        ? "bg-sky-50/70 border-sky-200/80 shadow-2xs hover:border-sky-300 hover:bg-sky-50"
                        : "bg-white border-slate-100 hover:bg-slate-50/80 hover:border-slate-200",
                    )}
                  >
                    {/* Unread Accent Bar */}
                    {!item.read && (
                      <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-sky-500" />
                    )}

                    {/* Left Icon */}
                    <div
                      className={cn(
                        "flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg text-white shadow-2xs",
                        item.data.isVerified
                          ? "bg-gradient-to-tr from-emerald-500 to-teal-500"
                          : "bg-gradient-to-tr from-amber-500 to-orange-500",
                      )}
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <p
                          className={cn(
                            "text-[11px] leading-snug truncate",
                            !item.read ? "font-extrabold text-slate-900" : "font-bold text-slate-700",
                          )}
                        >
                          {item.title}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[9.5px] font-medium text-slate-400">
                            {timeAgo(item.timestamp)}
                          </span>
                          <button
                            type="button"
                            title="Dismiss"
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissNotification(item.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-[10.5px] text-slate-500 truncate leading-snug font-medium">
                        {item.subtitle}
                      </p>

                      {/* Extra Badges */}
                      <div className="pt-0.5 flex flex-wrap items-center gap-1">
                        {item.data.isVerified ? (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700">
                            <ShieldCheck className="h-2.5 w-2.5 text-emerald-600" /> 100m GPS Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 text-[9px] font-bold text-amber-700">
                            <ShieldAlert className="h-2.5 w-2.5 text-amber-600" />{" "}
                            {typeof item.data.distance === "number" ? `${item.data.distance}m away` : "Unverified"}
                          </span>
                        )}
                        {item.data.employeeId && (
                          <span className="inline-flex items-center rounded-md bg-sky-50 border border-sky-100 px-1 py-0.2 text-[9px] font-mono font-bold text-sky-700">
                            {item.data.employeeId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-[10.5px] font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 h-7 px-2 rounded-lg transition-all"
            onClick={clearAllNotifications}
          >
            <Trash2 className="h-3 w-3 mr-1 text-slate-400" /> Clear feed
          </Button>

          <button
            type="button"
            className="inline-flex items-center gap-1 text-[10.5px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200/70 rounded-lg px-2.5 py-1 shadow-2xs transition-all cursor-pointer"
            onClick={() => {
              setOpen(false);
              navigate({ to: "/admin/visits" });
            }}
          >
            <span>View all visits</span>
            <ExternalLink className="h-3 w-3" />
          </button>
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
    dismissNotification,
    clearAllNotifications,
  } = useAdminNotifications();

  const [activeTab, setActiveTab] = useState<"all" | "verified" | "warning">("all");

  const filtered = useMemo(() => {
    if (activeTab === "verified") return notifications.filter((n) => n.data.isVerified);
    if (activeTab === "warning") return notifications.filter((n) => !n.data.isVerified);
    return notifications.slice(0, 15);
  }, [notifications, activeTab]);

  return (
    <div className={cn("overflow-hidden rounded-[28px] border border-sky-100/90 bg-white shadow-[0_10px_35px_rgba(14,165,233,0.08)] p-4 sm:p-5 transition-all", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-500 to-sky-400 font-bold text-white shadow-md shadow-sky-500/25">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm sm:text-base font-extrabold text-slate-900">
                Live DVR Visit Submissions & Alerts
              </h3>
              {unreadCount > 0 && (
                <Badge className="bg-gradient-to-r from-red-500 to-rose-500 text-white font-bold border-0 animate-pulse text-[10px] sm:text-xs">
                  {unreadCount} Unread
                </Badge>
              )}
            </div>
            <p className="text-[11px] sm:text-xs font-medium text-slate-500 mt-0.5">
              Instant alerts whenever a field employee logs a visit check-in
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSound}
            className={cn(
              "rounded-xl text-xs font-bold gap-1.5 h-8 border transition-all",
              soundEnabled
                ? "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                : "border-slate-200 text-slate-500 hover:bg-slate-50",
            )}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="h-3.5 w-3.5 text-sky-600" /> Sound: ON
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5 text-slate-400" /> Sound: OFF
              </>
            )}
          </Button>

          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={markAllAsRead}
              className="rounded-xl text-xs font-bold gap-1.5 h-8 bg-sky-100/70 hover:bg-sky-100 text-sky-700 border border-sky-200/60"
            >
              <CheckCheck className="h-3.5 w-3.5 text-sky-600" /> Mark All Read
            </Button>
          )}

          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllNotifications}
              className="rounded-xl text-xs font-bold gap-1.5 h-8 text-slate-500 hover:text-rose-600 hover:bg-rose-50"
              title="Clear all live notifications"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear Feed
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: "all", label: "All Visits", count: notifications.length },
          { id: "verified", label: "GPS Verified", count: notifications.filter((n) => n.data.isVerified).length },
          { id: "warning", label: "Warning / Far", count: notifications.filter((n) => !n.data.isVerified).length },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "rounded-xl px-3 sm:px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
                isActive
                  ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-sm shadow-sky-500/25"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900",
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] font-black",
                  isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700",
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="mt-3.5 space-y-2 max-h-[340px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center">
            <div className="h-10 w-10 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center mb-2">
              <Sparkles className="h-5 w-5 text-sky-500" />
            </div>
            <span className="font-bold text-slate-800">All caught up!</span>
            <span className="text-[11px] text-slate-400 mt-0.5">No live visit submissions recorded in this feed.</span>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                markAsRead(item.id);
                navigate({ to: "/admin/visits" });
              }}
              className={cn(
                "group flex items-center justify-between gap-3 rounded-2xl border p-3 transition-all duration-200 cursor-pointer",
                !item.read
                  ? "border-sky-200 bg-gradient-to-r from-sky-50/70 to-white hover:border-sky-300 hover:shadow-sm"
                  : "border-slate-100 bg-white hover:bg-slate-50/80 hover:border-slate-200",
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white font-bold text-xs shadow-xs",
                    item.data.isVerified ? "bg-gradient-to-tr from-emerald-500 to-teal-500" : "bg-gradient-to-tr from-amber-500 to-orange-500",
                  )}
                >
                  <Camera className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn("truncate text-xs font-bold", !item.read ? "text-slate-900 font-extrabold" : "text-slate-700")}>
                      {item.title}
                    </p>
                    {!item.read && (
                      <span className="rounded-full bg-sky-100 border border-sky-200 px-1.5 py-0.2 text-[9px] font-bold text-sky-700">
                        New
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-slate-500 mt-0.5">
                    {item.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {item.data.isVerified && (
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">
                    <ShieldCheck className="h-3 w-3" /> Verified
                  </span>
                )}
                <span className="text-[10px] font-medium text-slate-400">
                  {timeAgo(item.timestamp)}
                </span>
                <button
                  type="button"
                  title="Dismiss"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissNotification(item.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
