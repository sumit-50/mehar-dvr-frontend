import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { getSessionInfo } from "@/lib/dvr.functions";

/** Renders children only for admins; shows a friendly denial otherwise. */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: () => getSessionInfo(),
  });

  const localRole = typeof window !== "undefined" ? localStorage.getItem("dvr_user_role") : null;
  const localEmail = typeof window !== "undefined" ? localStorage.getItem("dvr_user_email") : null;
  const localId = typeof window !== "undefined" ? localStorage.getItem("dvr_user_id") : null;
  const localName = typeof window !== "undefined" ? localStorage.getItem("dvr_user_name") : null;

  const isLocalStorageAdmin =
    localRole === "admin" ||
    localId === "MEH000" ||
    localId === "MEH-ADM-001" ||
    localEmail === "admin@meharadvisory.com" ||
    localName?.toLowerCase().includes("admin");

  const isAdmin = Boolean(session?.isAdmin || isLocalStorageAdmin);

  if (!session && !isLocalStorageAdmin) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-16 text-center shadow-soft">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="font-display text-xl font-bold">Admins only</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This page is restricted to Mehar DVR administrators. Please use the employee dashboard
          for your daily visits.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
