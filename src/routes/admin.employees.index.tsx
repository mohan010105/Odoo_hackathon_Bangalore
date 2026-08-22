import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { EmployeesPage } from "@/pages/admin/EmployeesPage";

/** Header search sends a term here so the filtered directory is shareable. */
const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/admin/employees/")({
  validateSearch: (search) => searchSchema.parse(search),
  component: EmployeesPage,
});
