import {
  deleteDepartment,
  deleteJobPosition,
  getEmployeePrivateInfo,
  getMyPrivateInfo,
  listDepartments,
  listJobPositions,
  saveDepartment,
  saveEmployeePrivateInfo,
  saveJobPosition,
  type DepartmentInput,
  type EmployeePrivateInfoInput,
  type JobPositionInput,
} from "@/lib/org.functions";

export type DepartmentRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  headcount: number;
};

export type JobPositionRow = {
  id: string;
  title: string;
  department_id: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  departments: { id: string; name: string } | null;
};

/**
 * Organisation structure boundary. The UI never touches Supabase directly, so
 * the same rules apply whether a screen or a future Odoo sync calls in.
 */
export const orgService = {
  listDepartments: (includeInactive = true) =>
    listDepartments({ data: { includeInactive } }) as Promise<DepartmentRow[]>,
  saveDepartment: (input: DepartmentInput) => saveDepartment({ data: input }),
  deleteDepartment: (id: string) => deleteDepartment({ data: { id } }),

  listPositions: (options?: { includeInactive?: boolean; departmentId?: string }) =>
    listJobPositions({
      data: {
        includeInactive: options?.includeInactive ?? true,
        ...(options?.departmentId ? { departmentId: options.departmentId } : {}),
      },
    }) as Promise<JobPositionRow[]>,
  savePosition: (input: JobPositionInput) => saveJobPosition({ data: input }),
  deletePosition: (id: string) => deleteJobPosition({ data: { id } }),

  privateInfo: (employeeId: string) => getEmployeePrivateInfo({ data: { employeeId } }),
  myPrivateInfo: () => getMyPrivateInfo(),
  savePrivateInfo: (input: EmployeePrivateInfoInput) => saveEmployeePrivateInfo({ data: input }),
};
