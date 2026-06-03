import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { activitiesApi } from "@/lib/api/activities";
import { useOrg } from "@/hooks/useOrg";
import type { ActivityInsert, ActivityUpdate } from "@/lib/api/activities";

export const activitiesKeys = {
  all: (orgId: string) => ["activities", orgId] as const,
  byDeal: (dealId: string) => ["activities", "deal", dealId] as const,
};

export function useDealActivities(dealId: string | undefined) {
  return useQuery({
    queryKey: activitiesKeys.byDeal(dealId ?? ""),
    queryFn: () => activitiesApi.listByDeal(dealId!),
    enabled: !!dealId,
  });
}

export function useActivities() {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: activitiesKeys.all(orgId ?? ""),
    queryFn: () => activitiesApi.list(orgId!),
    enabled: !!orgId,
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  const { orgId } = useOrg();
  return useMutation({
    mutationFn: (activity: ActivityInsert) => activitiesApi.create(activity),
    onSuccess: () => qc.invalidateQueries({ queryKey: activitiesKeys.all(orgId ?? "") }),
  });
}

export function useUpdateActivity() {
  const qc = useQueryClient();
  const { orgId } = useOrg();
  return useMutation({
    mutationFn: ({ id, activity }: { id: string; activity: ActivityUpdate }) =>
      activitiesApi.update(id, activity),
    onSuccess: () => qc.invalidateQueries({ queryKey: activitiesKeys.all(orgId ?? "") }),
  });
}

export function useDeleteActivities() {
  const qc = useQueryClient();
  const { orgId } = useOrg();
  return useMutation({
    mutationFn: (ids: string[]) => activitiesApi.deleteMany(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: activitiesKeys.all(orgId ?? "") }),
  });
}
