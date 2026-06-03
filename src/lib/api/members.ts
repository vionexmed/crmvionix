import { supabase } from "@/integrations/supabase/client";
import { TABLES } from "@/lib/constants";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const membersApi = {
  list: async (orgId: string): Promise<Profile[]> => {
    const { data, error } = await supabase.from(TABLES.PROFILES).select("*").eq("org_id", orgId);
    if (error) throw error;
    return data;
  },
};
