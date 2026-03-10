import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()).then((d) => d.data ?? []);

export function useLinks(projectId: string) {
  const { data, isLoading, mutate } = useSWR(
    `/api/projects/${projectId}/links`,
    fetcher
  );

  return { links: data ?? [], isLoading, mutate };
}
