import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";

import { PageHeader } from "@/components/common/PageHeader";
import { LeaveBalanceCards } from "@/components/leave/LeaveBalanceCards";
import { LeaveRequestsTable } from "@/components/leave/LeaveRequestsTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { leaveService } from "@/services/leave/leaveService";

/** Admin view of one employee's leave balances and complete request history. */
export function AdminEmployeeLeavePage() {
  const { employeeId } = useParams({ from: "/admin/employees/$employeeId_/leave" });

  const history = useQuery({
    queryKey: ["employee-leave-history", employeeId],
    queryFn: () => leaveService.employeeHistory(employeeId),
  });

  const employee = history.data?.employee;
  const name = employee ? `${employee.first_name} ${employee.last_name}` : "Employee";

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${name} · leave`}
        description={
          employee
            ? `${employee.login_id}${employee.department ? ` · ${employee.department}` : ""}`
            : "Leave balances and history."
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/admin/employees/$employeeId" params={{ employeeId }}>
                Employee profile
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/leave/balances">Allocations</Link>
            </Button>
          </>
        }
      />

      {history.isError ? (
        <p role="alert" className="text-sm text-destructive">
          We could not load this employee&apos;s leave history.
        </p>
      ) : null}

      <section className="space-y-3" aria-labelledby="employee-balance-heading">
        <h2 id="employee-balance-heading" className="font-display text-lg font-semibold">
          Balances
        </h2>
        <LeaveBalanceCards balances={history.data?.balances} isLoading={history.isLoading} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Request history</CardTitle>
          <CardDescription>Every request, including cancelled and rejected ones.</CardDescription>
        </CardHeader>
        <CardContent>
          <LeaveRequestsTable
            requests={history.data?.requests}
            isLoading={history.isLoading}
            emptyMessage="This employee has not requested leave yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}
