import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { businessDate } from "@/lib/attendance/rules";
import { formatDays, formatLeaveDate } from "@/lib/leave/rules";
import { employeeService } from "@/services/employee/employeeService";
import { leaveService, type LeaveAllocationRow } from "@/services/leave/leaveService";

const PAGE_SIZE = 25;
const ALL = "ALL";

type AllocationDraft = {
  allocationId?: string;
  employeeId: string;
  leaveTypeId: string;
  allocatedDays: string;
  validFrom: string;
  validTo: string;
};

type TypeDraft = {
  id?: string;
  code: string;
  name: string;
  description: string;
  requiresAttachment: boolean;
  isPaid: boolean;
  isActive: boolean;
};

/** HR management of leave allocations and leave policies. */
export function AdminLeaveBalancesPage() {
  const queryClient = useQueryClient();
  const year = businessDate().slice(0, 4);

  const [search, setSearch] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState(ALL);
  const [page, setPage] = useState(0);

  const [allocationDraft, setAllocationDraft] = useState<AllocationDraft | null>(null);
  const [typeDraft, setTypeDraft] = useState<TypeDraft | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const filters = useMemo(
    () => ({
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(leaveTypeId !== ALL ? { leaveTypeId } : {}),
      page,
      pageSize: PAGE_SIZE,
    }),
    [search, leaveTypeId, page],
  );

  const allocations = useQuery({
    queryKey: ["leave-allocations", filters],
    queryFn: () => leaveService.listAllocations(filters),
  });

  const types = useQuery({
    queryKey: ["leave-types", "all"],
    queryFn: () => leaveService.listTypes(true),
  });

  const employees = useQuery({
    queryKey: ["employees", "allocation-picker"],
    queryFn: () => employeeService.listEmployees({}),
    enabled: !!allocationDraft,
  });

  const newAllocation = (): AllocationDraft => ({
    employeeId: "",
    leaveTypeId: "",
    allocatedDays: "0",
    validFrom: `${year}-01-01`,
    validTo: `${year}-12-31`,
  });

  const editAllocation = (row: LeaveAllocationRow): AllocationDraft => ({
    allocationId: row.id,
    employeeId: row.employee_id,
    leaveTypeId: row.leave_type_id,
    allocatedDays: String(row.allocated_days),
    validFrom: row.valid_from,
    validTo: row.valid_to,
  });

  const saveAllocation = async () => {
    if (!allocationDraft) return;
    setDialogError(null);

    const days = Number(allocationDraft.allocatedDays);
    if (!allocationDraft.employeeId || !allocationDraft.leaveTypeId) {
      setDialogError("Choose an employee and a leave type.");
      return;
    }
    if (!Number.isFinite(days) || days < 0) {
      setDialogError("Enter a valid number of days.");
      return;
    }

    setIsSaving(true);
    try {
      await leaveService.saveAllocation({
        ...(allocationDraft.allocationId ? { allocationId: allocationDraft.allocationId } : {}),
        employeeId: allocationDraft.employeeId,
        leaveTypeId: allocationDraft.leaveTypeId,
        allocatedDays: days,
        validFrom: allocationDraft.validFrom,
        validTo: allocationDraft.validTo,
      });
      toast.success("Allocation saved");
      setAllocationDraft(null);
      void queryClient.invalidateQueries({ queryKey: ["leave-allocations"] });
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "We could not save the allocation.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveType = async () => {
    if (!typeDraft) return;
    setDialogError(null);
    setIsSaving(true);
    try {
      await leaveService.saveType({
        ...(typeDraft.id ? { id: typeDraft.id } : {}),
        code: typeDraft.code.trim().toUpperCase(),
        name: typeDraft.name.trim(),
        ...(typeDraft.description.trim() ? { description: typeDraft.description.trim() } : {}),
        requiresAttachment: typeDraft.requiresAttachment,
        isPaid: typeDraft.isPaid,
        isActive: typeDraft.isActive,
      });
      toast.success("Leave policy saved");
      setTypeDraft(null);
      void queryClient.invalidateQueries({ queryKey: ["leave-types"] });
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "We could not save the leave policy.");
    } finally {
      setIsSaving(false);
    }
  };

  const total = allocations.data?.total ?? 0;
  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE) - 1, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Leave allocations & policies"
        description="Allocate leave per employee and manage the leave types available to them."
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/leave">Approval queue</Link>
          </Button>
        }
      />

      <Tabs defaultValue="allocations">
        <TabsList>
          <TabsTrigger value="allocations">Allocations</TabsTrigger>
          <TabsTrigger value="types">Leave types</TabsTrigger>
        </TabsList>

        <TabsContent value="allocations" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
              <div>
                <CardTitle className="font-display text-base">Employee allocations</CardTitle>
                <CardDescription>
                  Remaining days are calculated by the system from allocated and used days.
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  setAllocationDraft(newAllocation());
                  setDialogError(null);
                }}
              >
                Allocate leave
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="allocation-search">Search</Label>
                  <Input
                    id="allocation-search"
                    placeholder="Name, login ID or department"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(0);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="allocation-type">Leave type</Label>
                  <Select
                    value={leaveTypeId}
                    onValueChange={(value) => {
                      setLeaveTypeId(value);
                      setPage(0);
                    }}
                  >
                    <SelectTrigger id="allocation-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All types</SelectItem>
                      {(types.data ?? []).map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {allocations.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  We could not load the allocations.
                </p>
              ) : allocations.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading allocations…</p>
              ) : (allocations.data?.rows.length ?? 0) === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                  No allocations yet. Allocate leave so employees can request time off.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Leave type</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Allocated</TableHead>
                        <TableHead className="text-right">Used</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(allocations.data?.rows ?? []).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Link
                              to="/admin/employees/$employeeId/leave"
                              params={{ employeeId: row.employee_id }}
                              className="font-medium text-primary underline"
                            >
                              {row.employees?.first_name} {row.employees?.last_name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {row.employees?.login_id}
                            </p>
                          </TableCell>
                          <TableCell>{row.leave_types?.name ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatLeaveDate(row.valid_from)} – {formatLeaveDate(row.valid_to)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatDays(row.allocated_days)}
                          </TableCell>
                          <TableCell className="text-right">{formatDays(row.used_days)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatDays(row.remaining_days)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAllocationDraft(editAllocation(row));
                                setDialogError(null);
                              }}
                            >
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {total > PAGE_SIZE ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page + 1} of {lastPage + 1} · {total} allocations
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((value) => Math.max(value - 1, 0))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= lastPage}
                      onClick={() => setPage((value) => Math.min(value + 1, lastPage))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
              <div>
                <CardTitle className="font-display text-base">Leave types</CardTitle>
                <CardDescription>
                  Types are deactivated rather than deleted, so past requests keep their history.
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  setTypeDraft({
                    code: "",
                    name: "",
                    description: "",
                    requiresAttachment: false,
                    isPaid: true,
                    isActive: true,
                  });
                  setDialogError(null);
                }}
              >
                Add leave type
              </Button>
            </CardHeader>
            <CardContent>
              {types.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  We could not load the leave types.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Rules</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(types.data ?? []).map((type) => (
                        <TableRow key={type.id}>
                          <TableCell className="font-mono text-xs">{type.code}</TableCell>
                          <TableCell className="font-medium">{type.name}</TableCell>
                          <TableCell className="max-w-64 text-sm text-muted-foreground">
                            {type.description ?? "—"}
                          </TableCell>
                          <TableCell className="space-x-1">
                            <Badge variant="outline">{type.is_paid ? "Paid" : "Unpaid"}</Badge>
                            {type.requires_attachment ? (
                              <Badge variant="outline">Document required</Badge>
                            ) : null}
                            {type.is_active === false ? (
                              <Badge variant="outline">Inactive</Badge>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setTypeDraft({
                                  id: type.id,
                                  code: type.code,
                                  name: type.name,
                                  description: type.description ?? "",
                                  requiresAttachment: type.requires_attachment,
                                  isPaid: type.is_paid,
                                  isActive: type.is_active !== false,
                                });
                                setDialogError(null);
                              }}
                            >
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!allocationDraft}
        onOpenChange={(open) => (open ? null : setAllocationDraft(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {allocationDraft?.allocationId ? "Edit allocation" : "Allocate leave"}
            </DialogTitle>
            <DialogDescription>
              Allocated days cannot be lowered below the days already used.
            </DialogDescription>
          </DialogHeader>

          {allocationDraft ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="allocation-employee">Employee</Label>
                <Select
                  value={allocationDraft.employeeId}
                  onValueChange={(value) =>
                    setAllocationDraft({ ...allocationDraft, employeeId: value })
                  }
                  disabled={!!allocationDraft.allocationId}
                >
                  <SelectTrigger id="allocation-employee">
                    <SelectValue
                      placeholder={employees.isLoading ? "Loading…" : "Choose an employee"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(employees.data ?? []).map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.firstName} {employee.lastName} · {employee.employeeId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="allocation-leave-type">Leave type</Label>
                <Select
                  value={allocationDraft.leaveTypeId}
                  onValueChange={(value) =>
                    setAllocationDraft({ ...allocationDraft, leaveTypeId: value })
                  }
                  disabled={!!allocationDraft.allocationId}
                >
                  <SelectTrigger id="allocation-leave-type">
                    <SelectValue placeholder="Choose a leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {(types.data ?? [])
                      .filter((type) => type.is_active !== false)
                      .map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="allocation-days">Allocated days</Label>
                <Input
                  id="allocation-days"
                  type="number"
                  min={0}
                  step={0.5}
                  value={allocationDraft.allocatedDays}
                  onChange={(event) =>
                    setAllocationDraft({ ...allocationDraft, allocatedDays: event.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="allocation-from">Valid from</Label>
                <Input
                  id="allocation-from"
                  type="date"
                  value={allocationDraft.validFrom}
                  onChange={(event) =>
                    setAllocationDraft({ ...allocationDraft, validFrom: event.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="allocation-to">Valid to</Label>
                <Input
                  id="allocation-to"
                  type="date"
                  min={allocationDraft.validFrom}
                  value={allocationDraft.validTo}
                  onChange={(event) =>
                    setAllocationDraft({ ...allocationDraft, validTo: event.target.value })
                  }
                />
              </div>

              {dialogError ? (
                <p role="alert" className="text-sm text-destructive sm:col-span-2">
                  {dialogError}
                </p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAllocationDraft(null)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={saveAllocation} disabled={isSaving}>
              {isSaving ? "Saving…" : "Save allocation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!typeDraft} onOpenChange={(open) => (open ? null : setTypeDraft(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {typeDraft?.id ? "Edit leave type" : "Add leave type"}
            </DialogTitle>
            <DialogDescription>
              Codes are unique and used across allocations and requests.
            </DialogDescription>
          </DialogHeader>

          {typeDraft ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type-code">Code</Label>
                <Input
                  id="type-code"
                  value={typeDraft.code}
                  onChange={(event) => setTypeDraft({ ...typeDraft, code: event.target.value })}
                  placeholder="ANNUAL"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type-name">Name</Label>
                <Input
                  id="type-name"
                  value={typeDraft.name}
                  onChange={(event) => setTypeDraft({ ...typeDraft, name: event.target.value })}
                  placeholder="Annual leave"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="type-description">Description</Label>
                <Textarea
                  id="type-description"
                  rows={2}
                  maxLength={300}
                  value={typeDraft.description}
                  onChange={(event) =>
                    setTypeDraft({ ...typeDraft, description: event.target.value })
                  }
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={typeDraft.requiresAttachment}
                  onCheckedChange={(checked) =>
                    setTypeDraft({ ...typeDraft, requiresAttachment: checked === true })
                  }
                />
                Requires supporting document
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={typeDraft.isPaid}
                  onCheckedChange={(checked) =>
                    setTypeDraft({ ...typeDraft, isPaid: checked === true })
                  }
                />
                Paid leave
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <Checkbox
                  checked={typeDraft.isActive}
                  onCheckedChange={(checked) =>
                    setTypeDraft({ ...typeDraft, isActive: checked === true })
                  }
                />
                Active — employees can request this leave type
              </label>

              {dialogError ? (
                <p role="alert" className="text-sm text-destructive sm:col-span-2">
                  {dialogError}
                </p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeDraft(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={saveType} disabled={isSaving}>
              {isSaving ? "Saving…" : "Save leave type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
