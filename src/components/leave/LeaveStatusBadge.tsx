import { Badge } from "@/components/ui/badge";

const VARIANT: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-accent/15 text-accent-foreground" },
  APPROVED: { label: "Approved", className: "bg-primary/15 text-primary" },
  REJECTED: { label: "Rejected", className: "bg-destructive/15 text-destructive" },
  CANCELLED: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

export function LeaveStatusBadge({ status }: { status: string }) {
  const config = VARIANT[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
