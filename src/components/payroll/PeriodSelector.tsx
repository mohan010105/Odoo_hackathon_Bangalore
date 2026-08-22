import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MONTH_NAMES, selectableYears, type PayrollPeriod } from "@/lib/payroll/rules";

/** Month + year picker. Payroll always runs on whole calendar months. */
export function PeriodSelector({
  period,
  onChange,
  idPrefix = "payroll",
}: {
  period: PayrollPeriod;
  onChange: (period: PayrollPeriod) => void;
  idPrefix?: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-month`}>Month</Label>
        <Select
          value={String(period.month)}
          onValueChange={(value) => onChange({ ...period, month: Number(value) })}
        >
          <SelectTrigger id={`${idPrefix}-month`} className="w-[150px]">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((name, index) => (
              <SelectItem key={name} value={String(index + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-year`}>Year</Label>
        <Select
          value={String(period.year)}
          onValueChange={(value) => onChange({ ...period, year: Number(value) })}
        >
          <SelectTrigger id={`${idPrefix}-year`} className="w-[120px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {selectableYears().map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
