import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "neutral" | "warning" | "info" | "success" }
> = {
  DRAFT: { label: "Draft", variant: "neutral" },
  GENERATED: { label: "Generated", variant: "warning" },
  PROCESSED: { label: "Processed", variant: "info" },
  PAID: { label: "Paid", variant: "success" },
};

export function PayrollStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "neutral" };
  return (
    <Badge variant={config.variant} className="text-xs font-semibold">
      {config.label}
    </Badge>
  );
}
