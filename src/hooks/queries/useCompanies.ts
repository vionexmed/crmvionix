import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "@/lib/api/companies";
import { useOrg } from "@/hooks/useOrg";
import type { Database } from "@/integrations/supabase/types";

type CompanyInsert = Database["public"]["Tables"]["companies"]["Insert"];
type CompanyUpdate = Database["public"]["Tables"]["companies"]["Update"];

export const companiesKeys = {
  all: (orgId: string) => ["companies", orgId] as const,
};

export function useCompanies() {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: companiesKeys.all(orgId ?? ""),
    queryFn: () => companiesApi.list(orgId!),
    enabled: !!orgId,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  const { orgId } = useOrg();
  return useMutation({
    mutationFn: (company: CompanyInsert) => companiesApi.create(company),
    onSuccess: () => qc.invalidateQueries({ queryKey: companiesKeys.all(orgId ?? "") }),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  const { orgId } = useOrg();
  return useMutation({
    mutationFn: ({ id, company }: { id: string; company: CompanyUpdate }) =>
      companiesApi.update(id, company),
    onSuccess: () => qc.invalidateQueries({ queryKey: companiesKeys.all(orgId ?? "") }),
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  const { orgId } = useOrg();
  return useMutation({
    mutationFn: (id: string) => companiesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: companiesKeys.all(orgId ?? "") }),
  });
}
