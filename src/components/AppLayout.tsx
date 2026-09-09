import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  MapPin,
  Menu,
  UserRound,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getSessionInfo } from "@/lib/dvr.functions";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AdminNotificationCenter } from "@/components/AdminNotificationCenter";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/mehar-logo.png.asset.json";

const logoUrl = logoAsset.url;

const employeeNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/visit", label: "Start Visit", icon: Camera },
  { to: "/history", label: "History", icon: History },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

const adminNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/locations", label: "Locations", icon: MapPin },
  { to: "/admin/visits", label: "All Visits", icon: ClipboardList },
  { to: "/admin/map", label: "Live Map", icon: MapIcon },
  { to: "/admin/employees", label: "Users", icon: Users },
] as const;

function initials(name?: string | null): string {
  if (!name || !name.trim()) return "E";
  const parts = name.trim().split(" ").filter(Boolean);
  const first = parts[0];
  if (!first) return "E";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const second = parts[1];
  return ((first[0] ?? "") + (second?.[0] ?? "")).toUpperCase() || "E";
}

function UserAvatar({
  url,
  name,
  className,
}: {
  url?: string | null | undefined;
  name?: string | null | undefined;
  className?: string;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={`${name ?? "User"} profile photo`}
        className={cn("shrink-0 rounded-full object-cover ring-1 ring-border", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary ring-1 ring-border",
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}

export function AppLayout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: () => getSessionInfo(),
  });

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

  const rawCandidateName =
    session?.profile?.name && session.profile.name !== "Employee" && session.profile.name !== "Mehar User"
      ? session.profile.name
      : localName || session?.profile?.name;

  const resolvedName = isAdmin ? "Yogendra (Admin)" : (rawCandidateName || "Employee");

  const rawEmpId = (session?.profile?.employee_id || localId || "").trim().toUpperCase();
  let resolvedEmpId = rawEmpId;
  if (!resolvedEmpId || resolvedEmpId === "MEH000" || resolvedEmpId === "MEH-ADM-001") {
    resolvedEmpId = isAdmin ? "MEHADM001" : "MEH101";
  }

  const activeAvatarUrl = session?.avatarUrl || session?.profile?.avatar_url || localAvatar || null;

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    localStorage.removeItem("dvr_token");
    localStorage.removeItem("dvr_token_type");
    localStorage.removeItem("token");
    localStorage.removeItem("dvr_user_id");
    localStorage.removeItem("dvr_user_name");
    localStorage.removeItem("dvr_user_email");
    localStorage.removeItem("dvr_user_phone");
    localStorage.removeItem("dvr_user_role");
    localStorage.removeItem("dvr_user_avatar");
    sessionStorage.removeItem("mehar_alive");
    sessionStorage.clear();
    toast.success("Signed out successfully");
    navigate({ to: "/auth", replace: true });
  }

  const nav = isAdmin ? adminNav : employeeNav;

  const navLink = (
    item: (typeof adminNav)[number] | (typeof employeeNav)[number],
    onClick?: () => void,
  ) => (
    <Link
      key={item.to}
      to={item.to}
      onClick={onClick}
      activeOptions={{ exact: item.to === "/dashboard" }}
      className="group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-foreground"
      activeProps={{
        className:
          "bg-primary/10 text-primary font-semibold border border-primary/20 shadow-xs",
      }}
    >
      <item.icon className="h-4.5 w-4.5 shrink-0 transition-transform group-hover:scale-110" />
      <span className="flex-1">{item.label}</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-sidebar-border bg-sidebar flex-col md:flex shadow-soft">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4 bg-white">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-100 bg-white shadow-xs p-1">
            <img
              src={logoUrl}
              alt="Mehar DVR logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <p className="font-display text-sm font-extrabold text-slate-900 leading-tight">Mehar DVR</p>
            <p className="text-[10px] font-black tracking-wider text-blue-600 uppercase leading-tight mt-0.5">PORTAL</p>
          </div>
        </div>

        {/* Section title */}
        <div className="px-6 pt-4 pb-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {isAdmin ? "Super Admin Panel" : "Navigation"}
          </p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-1">{nav.map((item) => navLink(item))}</nav>

        {/* User Card & Sign out Footer */}
        <div className="border-t border-sidebar-border/80 p-3.5 bg-gradient-to-b from-transparent to-muted/30">
          {isAdmin ? (
            <Link
              to="/profile"
              className="group mb-2.5 flex items-center gap-3 rounded-2xl border border-border/80 bg-card/90 p-3 shadow-sm backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-soft"
              title="View & edit profile"
            >
              <div className="relative shrink-0">
                <UserAvatar
                  url={activeAvatarUrl}
                  name={resolvedName}
                  className="h-10 w-10 text-xs"
                />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                  {resolvedName}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="rounded-md bg-blue-600/15 border border-blue-600/30 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                    Super Admin
                  </span>
                  <span className="truncate text-[10px] font-mono text-muted-foreground font-semibold">
                    {resolvedEmpId}
                  </span>
                </div>
              </div>
            </Link>
          ) : (
            <Link
              to="/profile"
              className="group mb-2.5 flex items-center gap-3 rounded-2xl border border-border/80 bg-card/90 p-3 shadow-sm backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-soft"
            >
              <div className="relative shrink-0">
                <UserAvatar
                  url={activeAvatarUrl}
                  name={resolvedName}
                  className="h-10 w-10 text-xs"
                />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                  {resolvedName}
                </p>
                <p className="truncate text-[10px] font-mono text-muted-foreground mt-0.5">
                  {resolvedEmpId} · Field Staff
                </p>
              </div>
            </Link>
          )}

          <button
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-transparent px-3 py-2 text-xs font-semibold text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area: properly responsive across Mobile, Tablet, and Desktop */}
      <div className="flex min-h-screen flex-col md:pl-72">
        {/* Mobile top bar with notch & safe-area spacing */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/80 bg-card/95 px-4 pt-safe pb-3 backdrop-blur md:hidden shadow-xs">
          <div className="flex items-center gap-2.5">
            <img
              src={logoUrl}
              alt="Mehar DVR logo"
              className="h-8 w-8 rounded-full bg-white object-contain p-0.5 ring-1 ring-border"
            />
            <div>
              <p className="font-display text-sm font-bold leading-none">MEHAR DVR</p>
              <p className="text-[10px] text-muted-foreground">Daily Visit Report</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && <AdminNotificationCenter className="h-8.5 w-8.5" />}
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-destructive cursor-pointer"
            >
              <LogOut className="h-5 w-5" />
            </button>
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <button aria-label="Menu" className="rounded-lg p-2 text-muted-foreground hover:bg-accent cursor-pointer">
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-4 pt-safe">
                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="mb-4 flex items-center gap-3 rounded-lg px-1 py-1 transition-colors hover:bg-accent"
                >
                  <UserAvatar
                    url={activeAvatarUrl}
                    name={resolvedName}
                    className="h-10 w-10 text-sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{resolvedName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {resolvedEmpId} {isAdmin ? "· Admin" : "· Field Staff"}
                    </p>
                  </div>
                </Link>
                <nav className="space-y-1">{nav.map((item) => navLink(item, () => setMenuOpen(false)))}</nav>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Content with responsive padding - full width without huge side blanks */}
        <main className="w-full flex-1 px-3.5 sm:px-5 lg:px-6 pb-24 pt-3 sm:pt-5 md:py-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav with safe-area spacing */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-slate-200/90 bg-white/95 backdrop-blur-lg pb-safe pt-1.5 md:hidden shadow-lg">
        {nav.slice(0, 5).map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/dashboard" }}
            className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] font-semibold text-slate-500 transition-all hover:text-sky-600 outline-none focus:outline-none focus-visible:outline-none select-none"
            activeProps={{ className: "text-sky-600 font-extrabold" }}
          >
            <item.icon className="h-4.5 w-4.5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
