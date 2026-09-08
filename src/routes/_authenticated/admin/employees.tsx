import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Plus, RefreshCw, Trash2, UserPlus, Users, Calculator, ShieldCheck } from "lucide-react";
import {
  adminClearAllFieldEmployees,
  adminCreateEmployee,
  adminDeleteEmployee,
  adminGetEmployees,
  adminGetLocations,
  adminSetAssignments,
  adminSetEmployeeRole,
  adminSetEmployeeStatus,
} from "@/lib/admin.functions";
import { formatEmployeePrefix } from "@/lib/dvr.functions";
import { apiFetch } from "@/lib/api-client";
import { employeeSchema, type EmployeeInput } from "@/lib/schemas";
import { AdminOnly } from "@/components/AdminOnly";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { EmployeeWithAssignments } from "@/lib/dvr-types";

export const Route = createFileRoute("/_authenticated/admin/employees")({
  head: () => ({
    meta: [
      { title: "User Management — Mehar DVR" },
      { name: "description", content: "Create users, manage roles, assign locations and manage portal access." },
      { property: "og:title", content: "User Management — Mehar DVR" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AdminEmployeesPage,
});

const emptyEmployee = { name: "", email: "", employeeId: "", phone: "", password: "", role: "employee" };

function AdminEmployeesPage() {
  const queryClient = useQueryClient();
  const { data: employees, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-employees"],
    queryFn: async (): Promise<EmployeeWithAssignments[]> => {
      const userMap = new Map<string, EmployeeWithAssignments>();

      // Super Admin default record
      const defaultAdmin: EmployeeWithAssignments = {
        id: "00000000-0000-0000-0000-000000000001",
        name: "Yogendra (Admin)",
        email: "admin@meharadvisory.com",
        employee_id: "MEHADM001",
        phone: null,
        avatar_url: null,
        status: "active",
        role: "admin",
        roles: ["admin"],
        location_ids: [],
        total_visits: 0,
        created_at: new Date().toISOString(),
      };
      userMap.set("MEHADM001", defaultAdmin);

      // 1. Fetch live registered users directly from REST backend
      try {
        const restUsers = await apiFetch("/auth/users");
        if (Array.isArray(restUsers) && restUsers.length > 0) {
          for (const u of restUsers) {
            const isAdm = u.role === "admin" || u.employee_id === "MEH000" || u.employee_id === "MEH-ADM-001" || u.employee_id === "MEHADM001" || u.email?.toLowerCase().includes("admin");
            let empId = (u.employee_id || "").trim().toUpperCase().replace(/-/g, "");
            if (!empId || empId === "MEH000" || empId === "MEHADM001") {
              empId = isAdm ? "MEHADM001" : `${formatEmployeePrefix(u.full_name || u.name)}101`;
            }
            const key = (empId || u.email || "").toUpperCase();
            const cleanPhone = (u.phone && u.phone !== "9876543210" && u.phone !== "null" && u.phone !== "undefined") ? u.phone : null;

            userMap.set(key, {
              id: u.id || "u-" + key,
              name: u.full_name || u.name || "Employee",
              email: u.email,
              employee_id: empId,
              phone: cleanPhone,
              avatar_url: null,
              status: u.is_active ? "active" : "inactive",
              role: u.role || (isAdm ? "admin" : "employee"),
              roles: isAdm ? ["admin"] : ["employee"],
              location_ids: [],
              total_visits: 0,
              created_at: u.created_at || new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.warn("REST /auth/users fetch notice:", err);
      }

      // 2. Merge server functions profiles & assignments
      try {
        const serverEmployees = await adminGetEmployees({});
        if (Array.isArray(serverEmployees)) {
          for (const se of serverEmployees) {
            const key = (se.employee_id || se.email || "").toUpperCase();
            if (!userMap.has(key)) {
              userMap.set(key, se);
            } else {
              const existing = userMap.get(key)!;
              if (se.location_ids?.length) existing.location_ids = se.location_ids;
              if (se.total_visits) existing.total_visits = se.total_visits;
              if (se.avatar_url) existing.avatar_url = se.avatar_url;
            }
          }
        }
      } catch (err) {
        console.warn("adminGetEmployees notice:", err);
      }

      return Array.from(userMap.values());
    },
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
  const { data: locations } = useQuery({
    queryKey: ["admin-locations"],
    queryFn: () => adminGetLocations({}),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ ...emptyEmployee });
  const [createError, setCreateError] = useState<string | null>(null);

  const [assignFor, setAssignFor] = useState<EmployeeWithAssignments | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<EmployeeWithAssignments | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-employees"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-visits"] });
  };

  const create = useMutation({
    mutationFn: async (payload: EmployeeInput) => {
      try {
        await apiFetch("/auth/register", {
          method: "POST",
          body: {
            name: payload.name,
            full_name: payload.name,
            email: payload.email,
            phone: payload.phone,
            employee_id: payload.employeeId,
            password: payload.password,
            role: payload.role || "employee",
          },
        });
      } catch (restErr) {
        console.warn("REST create user notice:", restErr);
      }
      return adminCreateEmployee({ data: payload });
    },
    onSuccess: async () => {
      toast.success("User created successfully — they can now sign in.");
      setCreateOpen(false);
      setCreateForm({ ...emptyEmployee });
      await invalidate();
    },
    onError: (err) => setCreateError(err instanceof Error ? err.message : "Create failed"),
  });

  const setStatus = useMutation({
    mutationFn: (vars: { id: string; status: "active" | "inactive" }) =>
      adminSetEmployeeStatus({ data: vars }),
    onSuccess: async () => {
      toast.success("User status updated");
      await invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed"),
  });

  const deleteEmployeeMut = useMutation({
    mutationFn: (vars: { id: string; employeeId?: string }) =>
      adminDeleteEmployee({ data: vars }),
    onSuccess: async () => {
      toast.success("Employee ID deleted successfully from database.");
      setDeleteTarget(null);
      await invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
  });

  const clearAllEmployeesMut = useMutation({
    mutationFn: () => adminClearAllFieldEmployees({}),
    onSuccess: async () => {
      toast.success("All Field Employee IDs deleted successfully from database.");
      setShowClearAllConfirm(false);
      await invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Clear failed"),
  });

  const saveAssignments = useMutation({
    mutationFn: (vars: { employeeId: string; locationIds: string[] }) =>
      adminSetAssignments({ data: vars }),
    onSuccess: async () => {
      toast.success("Assignments saved");
      setAssignFor(null);
      await invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Save failed"),
  });

  function submitCreate() {
    setCreateError(null);
    const parsed = employeeSchema.safeParse(createForm);
    if (!parsed.success) {
      setCreateError(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    create.mutate(parsed.data);
  }

  function openAssign(emp: EmployeeWithAssignments) {
    setAssignFor(emp);
    setChecked(new Set(emp.location_ids ?? []));
  }

  const [filterRole, setFilterRole] = useState<"all" | "admin" | "accountant" | "employee">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");

  const setRoleMut = useMutation({
    mutationFn: (vars: { id: string; employeeId?: string; role: "admin" | "accountant" | "employee" }) =>
      adminSetEmployeeRole({ data: vars }),
    onSuccess: async (_, vars) => {
      toast.success(`Role updated to ${vars.role}`);
      await invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Role update failed"),
  });

  const allEmployees = employees ?? [];
  const adminCount = allEmployees.filter((e) => e.roles?.includes("admin") || e.role === "admin").length;
  const accountantCount = allEmployees.filter((e) => e.roles?.includes("accountant") || e.role === "accountant").length;
  const employeeCount = allEmployees.filter((e) => !e.roles?.includes("admin") && !e.roles?.includes("accountant") && e.role !== "admin" && e.role !== "accountant").length;
  const activeCount = allEmployees.filter((e) => e.status === "active").length;

  const filteredEmployees = allEmployees.filter((e) => {
    const isAdm = e.roles?.includes("admin") || e.role === "admin";
    const isAcc = e.roles?.includes("accountant") || e.role === "accountant";
    const isEmp = !isAdm && !isAcc;

    if (filterRole === "admin" && !isAdm) return false;
    if (filterRole === "accountant" && !isAcc) return false;
    if (filterRole === "employee" && !isEmp) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const matchName = e.name?.toLowerCase().includes(q);
      const matchEmail = e.email?.toLowerCase().includes(q);
      const matchId = e.employee_id?.toLowerCase().includes(q);
      const matchPhone = e.phone?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchId && !matchPhone) return false;
    }
    return true;
  });

  return (
    <AdminOnly>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 animate-fade-up">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <Users className="h-7 w-7 text-primary" />
              Users & Roles
            </h1>
            <p className="text-sm text-muted-foreground">
              Directory of {allEmployees.length} registered accounts ({employeeCount} Field Staff · {accountantCount} Accountants · {adminCount} Admins)
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {employeeCount > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowClearAllConfirm(true)}
                className="font-semibold text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive text-xs h-9"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete All Field IDs
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetch();
                toast.success("User list refreshed!");
              }}
              disabled={isFetching}
              className="font-semibold text-xs h-9 gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-primary" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
              className="font-semibold shadow-lift text-xs h-9"
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Add New User
            </Button>
          </div>
        </div>

        {/* Breakdown Metric Stat Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 animate-fade-up">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Users</p>
            <p className="mt-1 font-display text-2xl font-bold">{allEmployees.length}</p>
            <p className="text-xs text-muted-foreground">All database users</p>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Field Employees</p>
            <p className="mt-1 font-display text-2xl font-bold text-primary">{employeeCount}</p>
            <p className="text-xs text-muted-foreground">Visiting field staff</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Accountants</p>
            <p className="mt-1 font-display text-2xl font-bold text-amber-600 dark:text-amber-400">{accountantCount}</p>
            <p className="text-xs text-muted-foreground">Financial & DVR review</p>
          </div>
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-400">Admin Accounts</p>
            <p className="mt-1 font-display text-2xl font-bold text-purple-600 dark:text-purple-400">{adminCount}</p>
            <p className="text-xs text-muted-foreground">Super admin control</p>
          </div>
          <div className="rounded-2xl border border-success/20 bg-success/5 p-4 shadow-soft col-span-2 sm:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-success">Active Now</p>
            <p className="mt-1 font-display text-2xl font-bold text-success">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Login permitted</p>
          </div>
        </div>

        {/* Search Bar & View Mode Switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-fade-up">
          <div className="relative flex-1 max-w-md">
            <Input
              type="text"
              placeholder="Search by Name, Employee ID, Mobile, or Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 text-xs rounded-xl bg-card border-border"
            />
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
            {/* Filter Pills */}
            <div className="flex rounded-xl bg-muted p-1 border border-border/50 text-xs">
              <button
                type="button"
                onClick={() => setFilterRole("all")}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  filterRole === "all" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({allEmployees.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterRole("employee")}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  filterRole === "employee" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Employees ({employeeCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterRole("accountant")}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  filterRole === "accountant" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Accountants ({accountantCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterRole("admin")}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  filterRole === "admin" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Admins ({adminCount})
              </button>
            </div>

            {/* View Switcher */}
            <div className="flex rounded-xl bg-muted p-1 border border-border/50 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  viewMode === "table" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  viewMode === "cards" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Cards
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-border p-12 text-center text-muted-foreground bg-card shadow-soft flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="font-semibold text-sm">Loading users from database...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground bg-card/40">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/60 mb-2" />
            <p className="font-semibold text-sm">No registered users found</p>
            <p className="text-xs mt-1">Try adjusting your search terms or filter selection.</p>
          </div>
        ) : viewMode === "table" ? (
          /* TABLE VIEW */
          <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden animate-fade-up">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Employee ID</th>
                    <th className="py-3 px-4">Mobile Number</th>
                    <th className="py-3 px-4">Email Address</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Assigned Locations</th>
                    <th className="py-3 px-4">Login Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredEmployees.map((emp) => {
                    const isAdmin = emp.roles?.includes("admin") || emp.role === "admin";
                    const isAccountant = emp.roles?.includes("accountant") || emp.role === "accountant";
                    const currentRole = isAdmin ? "admin" : isAccountant ? "accountant" : "employee";

                    return (
                      <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs shrink-0">
                              {(emp.name?.charAt(0) || "U").toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-foreground truncate">{emp.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-primary">
                          {emp.employee_id || "—"}
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          {emp.phone ? `+91 ${emp.phone}` : <span className="text-muted-foreground italic">Not provided</span>}
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground">
                          {emp.email}
                        </td>
                        <td className="py-3.5 px-4">
                          <select
                            value={currentRole}
                            disabled={setRoleMut.isPending}
                            onChange={(e) => {
                              const newRole = e.target.value as "admin" | "accountant" | "employee";
                              setRoleMut.mutate({ id: emp.id, employeeId: emp.employee_id, role: newRole });
                            }}
                            className={`rounded-lg px-2 py-1 text-xs font-semibold border cursor-pointer transition-colors ${
                              isAdmin
                                ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
                                : isAccountant
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                : "bg-primary/15 text-primary border-primary/30"
                            }`}
                          >
                            <option value="employee">Field Staff</option>
                            <option value="accountant">Accountant</option>
                            <option value="admin">Super Admin</option>
                          </select>
                        </td>
                        <td className="py-3.5 px-4">
                          {isAdmin || isAccountant ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-muted-foreground">
                              <MapPin className="h-3 w-3 text-primary" />
                              Global Access (All)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-muted-foreground">
                              <MapPin className="h-3 w-3 text-primary" />
                              {(emp.location_ids ?? []).length} Location(s)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            {!isAdmin ? (
                              <Switch
                                checked={emp.status === "active"}
                                onCheckedChange={(on) =>
                                  setStatus.mutate({ id: emp.id, status: on ? "active" : "inactive" })
                                }
                                aria-label={`Toggle ${emp.name}`}
                              />
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                                Always Active
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isAdmin ? (
                              <>
                                {!isAccountant && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs font-semibold px-2.5"
                                    onClick={() => openAssign(emp)}
                                  >
                                    Assign Locations
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive shrink-0"
                                  title="Delete user account"
                                  onClick={() => setDeleteTarget(emp)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : (
                              <span className="text-[11px] font-semibold text-muted-foreground italic px-2">
                                System Master Admin
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* CARDS VIEW */
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 animate-fade-up">
            {filteredEmployees.map((emp) => {
              const isAdmin = emp.roles?.includes("admin") || emp.role === "admin";
              const isAccountant = emp.roles?.includes("accountant") || emp.role === "accountant";
              const currentRole = isAdmin ? "admin" : isAccountant ? "accountant" : "employee";

              return (
                <div key={emp.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-bold">{emp.name}</p>
                      <p className="font-mono text-xs text-primary font-semibold">
                        ID: {emp.employee_id}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5 items-center">
                      <select
                        value={currentRole}
                        disabled={setRoleMut.isPending}
                        onChange={(e) => {
                          const newRole = e.target.value as "admin" | "accountant" | "employee";
                          setRoleMut.mutate({ id: emp.id, employeeId: emp.employee_id, role: newRole });
                        }}
                        className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold border cursor-pointer ${
                          isAdmin
                            ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
                            : isAccountant
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                            : "bg-primary/15 text-primary border-primary/30"
                        }`}
                      >
                        <option value="employee">Field Staff</option>
                        <option value="accountant">Accountant</option>
                        <option value="admin">Super Admin</option>
                      </select>
                      <Badge
                        className={
                          emp.status === "active"
                            ? "bg-success/15 text-success hover:bg-success/15"
                            : "bg-muted text-muted-foreground hover:bg-muted"
                        }
                      >
                        {emp.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="truncate">
                      <strong className="text-foreground">Email:</strong> {emp.email}
                    </p>
                    {emp.phone && (
                      <p>
                        <strong className="text-foreground">Phone:</strong> +91 {emp.phone}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      {isAdmin || isAccountant ? (
                        <strong className="text-foreground">Global Access (All Locations)</strong>
                      ) : (
                        <span><strong>{(emp.location_ids ?? []).length}</strong> locations · <strong>{emp.total_visits ?? 0}</strong> visits</span>
                      )}
                    </span>
                    {!isAdmin ? (
                      <Switch
                        checked={emp.status === "active"}
                        onCheckedChange={(on) =>
                          setStatus.mutate({ id: emp.id, status: on ? "active" : "inactive" })
                        }
                        aria-label={`Toggle ${emp.name}`}
                      />
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                        Always Active
                      </span>
                    )}
                  </div>

                  {!isAdmin && (
                    <div className="flex items-center gap-2 pt-1">
                      {!isAccountant && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 font-semibold text-xs"
                          onClick={() => openAssign(emp)}
                        >
                          Assign locations ({(emp.location_ids ?? []).length})
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="px-2.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive shrink-0 ml-auto"
                        title="Delete this User from Database"
                        onClick={() => setDeleteTarget(emp)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Create user dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="emp-name">Full name</Label>
                <Input
                  id="emp-name"
                  value={createForm.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setCreateForm((prev) => ({ ...prev, name: newName }));
                    if (newName.trim()) {
                      apiFetch(`/auth/next-employee-id?name=${encodeURIComponent(newName)}`)
                        .then((res) => {
                          if (res?.nextId) {
                            setCreateForm((prev) => ({ ...prev, employeeId: res.nextId }));
                          }
                        })
                        .catch(() => {});
                    }
                  }}
                  placeholder="Rakesh Meena"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="emp-id">Employee ID</Label>
                  <Input
                    id="emp-id"
                    value={createForm.employeeId}
                    onChange={(e) => setCreateForm({ ...createForm, employeeId: e.target.value.toUpperCase() })}
                    placeholder="MEHRS101"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emp-phone">Phone (optional)</Label>
                  <Input
                    id="emp-phone"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    placeholder="9876543210 (Optional)"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emp-email">Email</Label>
                <Input
                  id="emp-email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="employee@meharadvisory.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emp-role">Role</Label>
                <div className="flex gap-4 pt-1 flex-wrap">
                  <label className="flex items-center gap-2 text-sm cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="role"
                      value="employee"
                      checked={createForm.role === "employee"}
                      onChange={() => setCreateForm({ ...createForm, role: "employee" })}
                      className="accent-primary"
                    />
                    Field Employee
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="role"
                      value="accountant"
                      checked={createForm.role === "accountant"}
                      onChange={() => setCreateForm({ ...createForm, role: "accountant" })}
                      className="accent-amber-500"
                    />
                    Accountant
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="role"
                      value="admin"
                      checked={createForm.role === "admin"}
                      onChange={() => setCreateForm({ ...createForm, role: "admin" })}
                      className="accent-purple-500"
                    />
                    Admin
                  </label>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emp-password">Temporary Password</Label>
                <Input
                  id="emp-password"
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Minimum 8 characters"
                />
                <p className="text-xs text-muted-foreground">
                  Share this password with the user — they can sign in with Employee ID + password.
                </p>
              </div>
              {createError && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {createError}
                </p>
              )}
              <Button className="w-full font-semibold" onClick={submitCreate} disabled={create.isPending}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create User
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Assign locations dialog */}
        <Dialog open={assignFor !== null} onOpenChange={(open) => !open && setAssignFor(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Assign locations — {assignFor?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-1">
              <div className="mb-2 flex justify-between text-xs">
                <span className="text-muted-foreground">{checked.size} selected</span>
                <button
                  className="font-medium text-primary hover:underline"
                  onClick={() => setChecked(new Set((locations ?? []).map((l) => l.id)))}
                >
                  Select all
                </button>
              </div>
              {(locations ?? []).map((loc) => (
                <label
                  key={loc.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50"
                >
                  <Checkbox
                    checked={checked.has(loc.id)}
                    onCheckedChange={(on) => {
                      const next = new Set(checked);
                      if (on) next.add(loc.id);
                      else next.delete(loc.id);
                      setChecked(next);
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{loc.location_name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {loc.location_code}
                      {loc.status !== "active" ? " · inactive" : ""}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <Button
              className="mt-3 w-full font-semibold"
              disabled={saveAssignments.isPending}
              onClick={() =>
                assignFor &&
                saveAssignments.mutate({ employeeId: assignFor.id, locationIds: [...checked] })
              }
            >
              {saveAssignments.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save assignments
            </Button>
          </DialogContent>
        </Dialog>

        {/* Single Employee Delete Confirmation Dialog */}
        <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Employee ID?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently delete <strong>{deleteTarget?.name}</strong> (ID: {deleteTarget?.employee_id}) from the database? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold"
                disabled={deleteEmployeeMut.isPending}
                onClick={() => {
                  if (deleteTarget) {
                    deleteEmployeeMut.mutate({ id: deleteTarget.id, employeeId: deleteTarget.employee_id });
                  }
                }}
              >
                {deleteEmployeeMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Permanently Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Clear All Field Employees Confirmation Dialog */}
        <AlertDialog open={showClearAllConfirm} onOpenChange={setShowClearAllConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete All Field Employee IDs?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>ALL {employeeCount} Field Employee accounts</strong> from the database? Super Admin (MEH000) will be preserved.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold"
                disabled={clearAllEmployeesMut.isPending}
                onClick={() => clearAllEmployeesMut.mutate()}
              >
                {clearAllEmployeesMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete All Field IDs
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminOnly>
  );
}
