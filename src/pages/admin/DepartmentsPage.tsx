import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Network, Pencil, Plus, Trash2 } from "lucide-react";
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
import { orgService, type DepartmentRow } from "@/services/org/orgService";

type FormState = {
  id?: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
};

const EMPTY: FormState = { name: "", code: "", description: "", isActive: true };

/** Admin/HR department directory backed by the departments table. */
export function DepartmentsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DepartmentRow | null>(null);

  const list = useQuery({
    queryKey: ["departments"],
    queryFn: () => orgService.listDepartments(),
  });

  const save = useMutation({
    mutationFn: (state: FormState) =>
      orgService.saveDepartment({
        ...(state.id ? { id: state.id } : {}),
        name: state.name,
        code: state.code,
        description: state.description,
        isActive: state.isActive,
      }),
    onSuccess: async () => {
      toast.success("Department saved");
      setForm(null);
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
      await queryClient.invalidateQueries({ queryKey: ["job-positions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => orgService.deleteDepartment(id),
    onSuccess: async () => {
      toast.success("Department removed");
      setPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = list.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Organise employees into departments used across hiring, payroll and reporting."
        actions={
          <Button onClick={() => setForm({ ...EMPTY })}>
            <Plus aria-hidden="true" className="mr-2 size-4" /> Department
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
                title="Departments unavailable"
                description="We could not load the department list."
                onRetry={() => void list.refetch()}
              />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No departments configured yet."
                description="Add your first department so employees, positions and reports can be grouped."
                action={
                  <Button size="sm" onClick={() => setForm({ ...EMPTY })}>
                    <Network aria-hidden="true" className="mr-2 size-4" /> Add department
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead className="text-right">Employees</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground">{row.code ?? "—"}</TableCell>
                      <TableCell className="hidden max-w-72 truncate text-muted-foreground md:table-cell">
                        {row.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">{row.headcount}</TableCell>
                      <TableCell>
                        <Badge variant={row.is_active ? "secondary" : "outline"}>
                          {row.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${row.name}`}
                          onClick={() =>
                            setForm({
                              id: row.id,
                              name: row.name,
                              code: row.code ?? "",
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
                          aria-label={`Remove ${row.name}`}
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
            <DialogTitle>{form?.id ? "Edit department" : "New department"}</DialogTitle>
            <DialogDescription>
              Departments appear as options on employee records and job positions.
            </DialogDescription>
          </DialogHeader>

          {form ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (form.name.trim().length < 2) {
                  toast.error("Enter a department name of at least 2 characters.");
                  return;
                }
                save.mutate(form);
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="department-name">Name</Label>
                <Input
                  id="department-name"
                  value={form.name}
                  required
                  maxLength={120}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department-code">Code (optional)</Label>
                <Input
                  id="department-code"
                  value={form.code}
                  maxLength={20}
                  onChange={(event) => setForm({ ...form, code: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department-description">Description (optional)</Label>
                <Textarea
                  id="department-description"
                  value={form.description}
                  maxLength={400}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <Label htmlFor="department-active" className="cursor-pointer">
                  Active
                </Label>
                <Switch
                  id="department-active"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save department"}
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
            <DialogTitle>Remove {pendingDelete?.name}?</DialogTitle>
            <DialogDescription>
              Employees keep their records; they are simply no longer linked to this department.
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
              {remove.isPending ? "Removing…" : "Remove department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
