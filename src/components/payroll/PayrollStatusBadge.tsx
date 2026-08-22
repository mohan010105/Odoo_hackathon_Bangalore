import { Badge } from "@/components/ui/badge";

const VARIANT: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground" },
  GENERATED: { label: "Generated", className: "bg-accent/15 text-accent-foreground" },
  PROCESSED: { label: "Processed", className: "bg-primary/15 text-primary" },
  PAID: { label: "Paid", className: "bg-primary text-primary-foreground" },
};

export function PayrollStatusBadge({ status }: { status: string }) {
  const config = VARIANT[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
