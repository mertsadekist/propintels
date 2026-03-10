import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { Database, Link2, ArrowLeft } from "lucide-react";

async function getProject(projectId: string) {
  const cookieStore = cookies();
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/projects/${projectId}`,
    {
      cache: "no-store",
      headers: { cookie: cookieStore.toString() },
    }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.data;
}

export default async function ProjectDetailPage({
  params,
}: {
  params: { projectId: string };
}) {
  const project = await getProject(params.projectId);
  if (!project) notFound();

  return (
    <div>
      {/* Back link */}
      <Link
        href="/admin/projects"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Projects
      </Link>

      <PageHeader
        title={project.name}
        description={project.location ?? "No location specified"}
        action={
          <div className="flex gap-2">
            <Badge variant={project.isActive ? "default" : "secondary"}>
              {project.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        }
      />

      {/* Stats row */}
      <div className="flex gap-6 mb-6 text-sm text-gray-500">
        <span>{project._count?.entries ?? 0} comparable entries</span>
        <span>{project._count?.leads ?? 0} leads</span>
        <span>{project._count?.links ?? 0} valuation links</span>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries">
            <Database className="h-3.5 w-3.5 mr-1.5" />
            Entries
          </TabsTrigger>
          <TabsTrigger value="links">
            <Link2 className="h-3.5 w-3.5 mr-1.5" />
            Valuation Links
          </TabsTrigger>
        </TabsList>
        <TabsContent value="entries" className="mt-4">
          <div className="flex justify-end mb-4">
            <Link href={`/admin/projects/${params.projectId}/entries`}>
              <Button size="sm">Manage Entries</Button>
            </Link>
          </div>
          <p className="text-sm text-gray-500">
            {project._count?.entries ?? 0} comparable entries in this project.
          </p>
        </TabsContent>
        <TabsContent value="links" className="mt-4">
          <div className="flex justify-end mb-4">
            <Link href={`/admin/projects/${params.projectId}/links`}>
              <Button size="sm">Manage Links</Button>
            </Link>
          </div>
          <p className="text-sm text-gray-500">
            {project._count?.links ?? 0} valuation links created.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
