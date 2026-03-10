import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((d) => ({ data: d.data ?? [], total: d.meta?.total ?? 0 }));

interface UseLeadsOptions {
  status?: string;
  projectId?: string;
  assignedAgentId?: string;
  search?: string;
  page?: number;
}

export function useLeads(options: UseLeadsOptions = {}) {
  const { status, projectId, assignedAgentId, search, page = 1 } = options;
  const params = new URLSearchParams();

  if (status) params.set("status", status);
  if (projectId) params.set("projectId", projectId);
  if (assignedAgentId) params.set("assignedAgentId", assignedAgentId);
  if (search) params.set("search", search);
  params.set("page", String(page));

  const { data, isLoading, mutate } = useSWR(
    `/api/leads?${params.toString()}`,
    fetcher
  );

  return {
    leads: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    mutate,
  };
}
