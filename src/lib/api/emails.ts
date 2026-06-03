import { supabase } from "@/integrations/supabase/client";

export type Email = {
  id: string;
  org_id: string;
  user_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  company_id: string | null;
  direction: string;
  subject: string | null;
  body_html: string | null;
  from_email: string | null;
  to_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  status: string;
  open_count: number;
  click_count: number;
  last_opened_at: string | null;
  last_clicked_at: string | null;
  thread_id: string | null;
  message_id: string | null;
  provider: string | null;
  is_read: boolean;
  snoozed_until: string | null;
  is_archived: boolean;
  is_starred?: boolean;
  is_spam?: boolean;
  is_trashed?: boolean;
  importance?: string | null;
  sent_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  attachments?: Array<{ filename: string; mime_type: string; size: number; attachment_id: string }>;
};

export type InboxContact = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
  status: string | null;
  org_id: string;
};

export const emailsApi = {
  list: async (orgId: string): Promise<Email[]> => {
    const { data, error } = await supabase
      .from("emails")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data as Email[]) ?? [];
  },

  update: async (id: string, patch: Partial<Email>): Promise<void> => {
    const { error } = await supabase.from("emails").update(patch as any).eq("id", id);
    if (error) throw error;
  },

  deleteById: async (id: string): Promise<void> => {
    const { error } = await supabase.from("emails").delete().eq("id", id);
    if (error) throw error;
  },

  batchUpdate: async (ids: string[], patch: Partial<Email>): Promise<void> => {
    const { error } = await supabase.from("emails").update(patch as any).in("id", ids);
    if (error) throw error;
  },
};

export const inboxContactsApi = {
  list: async (orgId: string): Promise<InboxContact[]> => {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email, avatar_url, status, org_id")
      .eq("org_id", orgId);
    if (error) throw error;
    return (data as InboxContact[]) ?? [];
  },
};
