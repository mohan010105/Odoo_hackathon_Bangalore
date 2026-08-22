import { useQuery } from "@tanstack/react-query";

import { ChangePasswordCard } from "@/components/profile/ChangePasswordCard";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { employeeService } from "@/services/employee/employeeService";

export function EmployeeProfilePage() {
  const record = useQuery({
    queryKey: ["my-employee-record"],
    queryFn: () => employeeService.getMyRecord(),
  });

  const employee = record.data;

  return (
    <div className="space-y-6">
      <ProfileForm
        title="My profile"
        description="Keep your picture and contact details up to date."
        canEditName={false}
        readOnlyDetails={[
          { label: "Login ID", value: employee?.employeeId ?? "" },
          { label: "Department", value: employee?.department ?? "" },
          { label: "Position", value: employee?.designation ?? "" },
          { label: "Joining date", value: employee?.joiningDate ?? "" },
          { label: "Status", value: employee?.status ?? "" },
        ]}
      />
      <ChangePasswordCard />
    </div>
  );
}
