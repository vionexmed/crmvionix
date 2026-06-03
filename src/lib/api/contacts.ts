import { supabase } from "@/integrations/supabase/client";
import { TABLES, DEFAULT_PAGE_SIZE } from "@/lib/constants";
import type { Database } from "@/integrations/supabase/types";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];
type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];
type ContactUpdate = Database["public"]["Tables"]["contacts"]["Update"];
type ContactStatus = Database["public"]["Enums"]["contact_status"];

export const PAGE_SIZE = DEFAULT_PAGE_SIZE;

export interface ContactListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  ownerId?: string;
  companyId?: string;
  createdFrom?: string;
  createdTo?: string;
  sortKey?: "name" | "email" | "status" | "created_at" | "title";
  sortDir?: "asc" | "desc";
}

export interface ContactListResult {
  data: Contact[];
  count: number;
}

export const contactsApi = {
  list: async (orgId: string, params: ContactListParams = {}): Promise<ContactListResult> => {
    const {
      page = 0,
      pageSize = PAGE_SIZE,
      search,
      status,
      ownerId,
      companyId,
      createdFrom,
      createdTo,
      sortKey = "created_at",
      sortDir = "desc",
    } = params;

    let query = supabase
      .from(TABLES.CONTACTS)
      .select("*", { count: "exact" })
      .eq("org_id", orgId)
      .neq("status", "lead");

    if (status && status !== "all") query = query.eq("status", status);
    if (ownerId && ownerId !== "all") query = query.eq("owner_id", ownerId);
    if (companyId && companyId !== "all") query = query.eq("company_id", companyId);
    if (createdFrom) query = query.gte("created_at", createdFrom);
    if (createdTo) query = query.lte("created_at", createdTo);
    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const ascending = sortDir === "asc";
    if (sortKey === "name") {
      query = query.order("first_name", { ascending }).order("last_name", { ascending });
    } else {
      query = query.order(sortKey, { ascending });
    }

    const from = page * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data ?? [], count: count ?? 0 };
  },

  create: async (contact: ContactInsert): Promise<Contact> => {
    const { data, error } = await supabase.from(TABLES.CONTACTS).insert(contact).select().single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, contact: ContactUpdate): Promise<Contact> => {
    const { data, error } = await supabase
      .from("contacts")
      .update(contact)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  deleteMany: async (ids: string[]): Promise<void> => {
    const { error } = await supabase.from(TABLES.CONTACTS).delete().in("id", ids);
    if (error) throw error;
  },

  updateStatus: async (ids: string[], status: ContactStatus): Promise<void> => {
    const { error } = await supabase.from(TABLES.CONTACTS).update({ status }).in("id", ids);
    if (error) throw error;
  },

  updateOwner: async (id: string, ownerId: string | null): Promise<void> => {
    const { error } = await supabase.from(TABLES.CONTACTS).update({ owner_id: ownerId }).eq("id", id);
    if (error) throw error;
  },

  listLeads: async (orgId: string): Promise<Contact[]> => {
    const { data, error } = await supabase
      .from(TABLES.CONTACTS)
      .select("*, companies:companies(name)")
      .eq("org_id", orgId)
      .eq("status", "lead")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
};
