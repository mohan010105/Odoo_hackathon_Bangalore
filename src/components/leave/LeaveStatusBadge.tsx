import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "warning" | "success" | "destructive" | "neutral" }
> = {
  PENDING: { label: "Pending", variant: "warning" },
  APPROVED: { label: "Approved", variant: "success" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "neutral" },
};

export function LeaveStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "neutral" };
  return (
    <Badge variant={config.variant} className="text-xs font-semibold">
      {config.label}
    </Badge>
  );
}
