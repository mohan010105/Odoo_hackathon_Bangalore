import { odooClient } from "./odooClient";

/**
 * Model-specific Odoo adapters. Each one maps a Dayflow HR concern onto an
 * Odoo model server-side, so the rest of the app never references Odoo model
 * names or credentials.
 */

export const odooEmployeeService = {
  list: (limit?: number) => odooClient.fetch("employees", limit),
};

export const odooAttendanceService = {
  list: (limit?: number) => odooClient.fetch("attendance", limit),
};

export const odooLeaveService = {
  list: (limit?: number) => odooClient.fetch("leave", limit),
};

export const odooPayrollService = {
  list: (limit?: number) => odooClient.fetch("payroll", limit),
};

export { odooClient };
