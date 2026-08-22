import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { orgService, type JobPositionRow } from "@/services/org/orgService";

const NONE = "__none__";

type FormState = {
  id?: string;
  title: string;
  departmentId: string;
  description: string;
  isActive: boolean;
};

const EMPTY: FormState = { title: "", departmentId: NONE, description: "", isActive: true };

/** Admin/HR job position catalogue backed by the job_positions table. */
export function JobPositionsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<JobPositionRow | null>(null);

  const list = useQuery({
    queryKey: ["job-positions"],
    queryFn: () => orgService.listPositions(),
  });

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: () => orgService.listDepartments(),
  });

  const save = useMutation({
    mutationFn: (state: FormState) =>
      orgService.savePosition({
        ...(state.id ? { id: state.id } : {}),
        title: state.title,
        ...(state.departmentId !== NONE ? { departmentId: state.departmentId } : {}),
        description: state.description,
        isActive: state.isActive,
      }),
    onSuccess: async () => {
      toast.success("Job position saved");
      setForm(null);
      await queryClient.invalidateQueries({ queryKey: ["job-positions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => orgService.deletePosition(id),
    onSuccess: async () => {
      toast.success("Job position removed");
      setPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["job-positions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = list.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job positions"
        description="Define the roles employees can be assigned to across each department."
        actions={
          <Button onClick={() => setForm({ ...EMPTY })}>
            <Plus aria-hidden="true" className="mr-2 size-4" /> Job position
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {list.isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : list.isError ? (
            <div className="p-4">
              <ErrorState
                title="Job positions unavailable"
                description="We could not load the job position list."
                onRetry={() => void list.refetch()}
              />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No job positions configured yet."
                description="Create positions so employee records and payroll reporting stay consistent."
                action={
                  <Button size="sm" onClick={() => setForm({ ...EMPTY })}>
                    <Briefcase aria-hidden="true" className="mr-2 size-4" /> Add position
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Position</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.title}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.departments?.name ?? "—"}
                      </TableCell>
                      <TableCell className="hidden max-w-72 truncate text-muted-foreground md:table-cell">
                        {row.description ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.is_active ? "secondary" : "outline"}>
                          {row.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${row.title}`}
                          onClick={() =>
                            setForm({
                              id: row.id,
                              title: row.title,
                              departmentId: row.department_id ?? NONE,
                              description: row.description ?? "",
                              isActive: row.is_active,
                            })
                          }
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${row.title}`}
                          className="text-destructive"
                          onClick={() => setPendingDelete(row)}
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
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

      <Dialog open={form !== null} onOpenChange={(open) => (!open ? setForm(null) : undefined)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit job position" : "New job position"}</DialogTitle>
            <DialogDescription>
              Positions can optionally belong to a department for reporting.
            </DialogDescription>
          </DialogHeader>

          {form ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (form.title.trim().length < 2) {
                  toast.error("Enter a position title of at least 2 characters.");
                  return;
                }
                save.mutate(form);
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="position-title">Title</Label>
                <Input
                  id="position-title"
                  value={form.title}
                  required
                  maxLength={120}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="position-department">Department</Label>
                <Select
                  value={form.departmentId}
                  onValueChange={(value) => setForm({ ...form, departmentId: value })}
                >
                  <SelectTrigger id="position-department">
                    <SelectValue placeholder="No department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No department</SelectItem>
                    {(departments.data ?? []).map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="position-description">Description (optional)</Label>
                <Textarea
                  id="position-description"
                  value={form.description}
                  maxLength={400}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <Label htmlFor="position-active" className="cursor-pointer">
                  Active
                </Label>
                <Switch
                  id="position-active"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save position"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => (!open ? setPendingDelete(null) : undefined)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {pendingDelete?.title}?</DialogTitle>
            <DialogDescription>
              Employee records are not deleted; they simply lose the link to this position.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
            >
              {remove.isPending ? "Removing…" : "Remove position"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
