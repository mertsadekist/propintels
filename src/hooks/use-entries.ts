import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()).then((d) => d.data ?? []);

interface UseEntriesOptions {
  projectId: string;
  sourceType?: string;
  propertyType?: string;
  page?: number;
}

export function useEntries({ projectId, sourceType, propertyType, page = 1 }: UseEntriesOptions) {
  const params = new URLSearchParams();
  if (sourceType) params.set("sourceType", sourceType);
  if (propertyType) params.set("propertyType", propertyType);
  params.set("page", String(page));

  const { data, isLoading, mutate } = useSWR(
    `/api/projects/${projectId}/entries?${params.toString()}`,
    fetcher
  );

  return { entries: data ?? [], isLoading, mutate };
}
