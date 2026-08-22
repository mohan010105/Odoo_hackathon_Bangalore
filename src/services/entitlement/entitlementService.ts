import { getMyEntitlementHistory } from "@/lib/profile.functions";
import type { Database } from "@/integrations/supabase/types";

export type EntitlementChange = Database["public"]["Tables"]["entitlement_changes"]["Row"];

export const entitlementService = {
  async getMyHistory(): Promise<EntitlementChange[]> {
    const data = await getMyEntitlementHistory({});
    return (data ?? []) as EntitlementChange[];
  },
};
