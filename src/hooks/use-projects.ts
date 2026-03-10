import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()).then((d) => d.data ?? []);

export function useProjects({ search }: { search?: string } = {}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);

  const { data, isLoading, mutate } = useSWR(
    `/api/projects?${params.toString()}`,
    fetcher
  );

  return { projects: data ?? [], isLoading, mutate };
}
