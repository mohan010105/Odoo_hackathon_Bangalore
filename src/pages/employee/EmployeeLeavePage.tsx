import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { LeaveBalanceCards } from "@/components/leave/LeaveBalanceCards";
import { LeaveRequestForm } from "@/components/leave/LeaveRequestForm";
import { LeaveCalendar } from "@/components/leave/LeaveCalendar";
import { LeaveRequestsTable } from "@/components/leave/LeaveRequestsTable";
import { EntitlementHistoryView } from "@/components/employee/EntitlementHistoryView";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { leaveService } from "@/services/leave/leaveService";

/** Employee time-off portal: balances, a request form and full history. */
export function EmployeeLeavePage() {
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const balances = useQuery({
    queryKey: ["my-leave-balance"],
    queryFn: () => leaveService.myBalance(),
  });

  const requests = useQuery({
    queryKey: ["my-leave-requests"],
    queryFn: () => leaveService.listMine(),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-leave-balance"] });
    void queryClient.invalidateQueries({ queryKey: ["my-leave-requests"] });
  };

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await leaveService.cancel(id);
      toast.success("Request cancelled");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not cancel that request.");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Leave"
        description="Check your balance, request time off and follow every decision."
      />

      <section className="space-y-3" aria-labelledby="leave-balance-heading">
        <h2 id="leave-balance-heading" className="font-display text-lg font-semibold">
          Your balance
        </h2>
        <LeaveBalanceCards balances={balances.data} isLoading={balances.isLoading} />
        {balances.isError ? (
          <p role="alert" className="text-sm text-destructive">
            We could not load your leave balance.
          </p>
        ) : null}
      </section>

      <LeaveRequestForm balances={balances.data} onSubmitted={refresh} />

      <LeaveCalendar requests={requests.data} isLoading={requests.isLoading} />



      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Your requests</CardTitle>
          <CardDescription>
            Pending requests can be cancelled. Decided requests stay here as history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.isError ? (
            <p role="alert" className="text-sm text-destructive">
              We could not load your leave requests.
            </p>
          ) : (
            <LeaveRequestsTable
              requests={requests.data}
              isLoading={requests.isLoading}
              onCancel={handleCancel}
              cancellingId={cancellingId}
              emptyMessage="You have not requested leave yet."
            />
          )}
        </CardContent>
      </Card>

      <EntitlementHistoryView
        filterType="LEAVE_ALLOCATION"
        title="Leave allocation history"
        description="Record of your annual leave allocations and quota adjustments."
      />
    </div>
  );
}
