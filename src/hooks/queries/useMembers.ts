import { useQuery } from "@tanstack/react-query";
import { membersApi } from "@/lib/api/members";
import { useOrg } from "@/hooks/useOrg";

export const membersKeys = {
  all: (orgId: string) => ["members", orgId] as const,
};

export function useMembers() {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: membersKeys.all(orgId ?? ""),
    queryFn: () => membersApi.list(orgId!),
    enabled: !!orgId,
  });
}
