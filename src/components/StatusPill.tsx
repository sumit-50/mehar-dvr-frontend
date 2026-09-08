export function StatusPill({ status }: { status: string }) {
  const cls =
    status === "verified"
      ? "bg-success/15 text-success"
      : status === "rejected"
        ? "bg-destructive/10 text-destructive"
        : "bg-primary/10 text-primary";
  return (
    <span className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${cls}`}>
      {status}
    </span>
  );
}
