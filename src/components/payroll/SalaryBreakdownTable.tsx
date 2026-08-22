import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { calculationBasisLabel, formatMoney, type ComponentLine } from "@/lib/payroll/rules";

/**
 * Shared earnings / deductions table. Amounts always come from the server —
 * this component only formats them.
 */
export function SalaryBreakdownTable({
  basicSalary,
  earnings,
  deductions,
  grossEarnings,
  totalDeductions,
  netSalary,
  currency = "INR",
}: {
  basicSalary: number;
  earnings: ComponentLine[];
  deductions: ComponentLine[];
  grossEarnings: number;
  totalDeductions: number;
  netSalary: number;
  currency?: string;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="earnings-heading" className="space-y-2">
        <h3 id="earnings-heading" className="font-display text-sm font-semibold text-foreground">
          Earnings
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Component</TableHead>
              <TableHead>Basis</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Basic salary</TableCell>
              <TableCell className="text-muted-foreground">Fixed amount</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(basicSalary, currency)}
              </TableCell>
            </TableRow>
            {earnings.map((line) => (
              <TableRow key={`earning-${line.code}`}>
                <TableCell>{line.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {calculationBasisLabel(line.method, line.value)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(line.amount, currency)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40 font-medium">
              <TableCell colSpan={2}>Gross earnings</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(grossEarnings, currency)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>

      <section aria-labelledby="deductions-heading" className="space-y-2">
        <h3 id="deductions-heading" className="font-display text-sm font-semibold text-foreground">
          Deductions
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Component</TableHead>
              <TableHead>Basis</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deductions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-sm text-muted-foreground">
                  No deductions configured.
                </TableCell>
              </TableRow>
            ) : (
              deductions.map((line) => (
                <TableRow key={`deduction-${line.code}`}>
                  <TableCell>{line.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {calculationBasisLabel(line.method, line.value)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(line.amount, currency)}
                  </TableCell>
                </TableRow>
              ))
            )}
            <TableRow className="bg-muted/40 font-medium">
              <TableCell colSpan={2}>Total deductions</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(totalDeductions, currency)}
              </TableCell>
            </TableRow>
            <TableRow className="bg-primary/10 font-semibold">
              <TableCell colSpan={2}>Net salary</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(netSalary, currency)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
