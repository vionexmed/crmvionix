import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { emailsApi, inboxContactsApi } from "@/lib/api/emails";
import type { Email } from "@/lib/api/emails";
import { useOrg } from "@/hooks/useOrg";

export const emailsKeys = {
  all: (orgId: string) => ["emails", orgId] as const,
  contacts: (orgId: string) => ["inbox-contacts", orgId] as const,
};

export function useEmails() {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: emailsKeys.all(orgId ?? ""),
    queryFn: () => emailsApi.list(orgId!),
    enabled: !!orgId,
  });
}

export function useInboxContacts() {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: emailsKeys.contacts(orgId ?? ""),
    queryFn: () => inboxContactsApi.list(orgId!),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateEmail() {
  const qc = useQueryClient();
  const { orgId } = useOrg();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Email> }) =>
      emailsApi.update(id, patch),
    onMutate: async ({ id, patch }) => {
      if (!orgId) return;
      const key = emailsKeys.all(orgId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Email[]>(key);
      qc.setQueryData<Email[]>(key, (old) =>
        old ? old.map((e) => (e.id === id ? { ...e, ...patch } : e)) : old
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (orgId && ctx?.previous) {
        qc.setQueryData(emailsKeys.all(orgId), ctx.previous);
      }
    },
    onSettled: () => {
      if (orgId) qc.invalidateQueries({ queryKey: emailsKeys.all(orgId) });
    },
  });
}

export function useDeleteEmail() {
  const qc = useQueryClient();
  const { orgId } = useOrg();
  return useMutation({
    mutationFn: (id: string) => emailsApi.deleteById(id),
    onMutate: async (id) => {
      if (!orgId) return;
      const key = emailsKeys.all(orgId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Email[]>(key);
      qc.setQueryData<Email[]>(key, (old) => old?.filter((e) => e.id !== id));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (orgId && ctx?.previous) {
        qc.setQueryData(emailsKeys.all(orgId), ctx.previous);
      }
    },
    onSettled: () => {
      if (orgId) qc.invalidateQueries({ queryKey: emailsKeys.all(orgId) });
    },
  });
}

export function useBatchUpdateEmails() {
  const qc = useQueryClient();
  const { orgId } = useOrg();
  return useMutation({
    mutationFn: ({ ids, patch }: { ids: string[]; patch: Partial<Email> }) =>
      emailsApi.batchUpdate(ids, patch),
    onMutate: async ({ ids, patch }) => {
      if (!orgId) return;
      const key = emailsKeys.all(orgId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Email[]>(key);
      qc.setQueryData<Email[]>(key, (old) =>
        old ? old.map((e) => (ids.includes(e.id) ? { ...e, ...patch } : e)) : old
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (orgId && ctx?.previous) {
        qc.setQueryData(emailsKeys.all(orgId), ctx.previous);
      }
    },
    onSettled: () => {
      if (orgId) qc.invalidateQueries({ queryKey: emailsKeys.all(orgId) });
    },
  });
}
