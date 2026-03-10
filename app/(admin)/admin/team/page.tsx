"use client";

import { useState } from "react";
import { Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { InviteUserDialog } from "@/components/admin/team/invite-user-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((d) => d.data ?? []);

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  MANAGER: "bg-blue-100 text-blue-700",
  AGENT: "bg-green-100 text-green-700",
  VIEWER: "bg-gray-100 text-gray-600",
};

export default function TeamPage() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const { data: users, isLoading, mutate } = useSWR("/api/team", fetcher);

  async function toggleUserStatus(userId: string, currentStatus: string) {
    const newStatus = currentStatus === "ACTIVE" ? "DISABLED" : "ACTIVE";
    const res = await fetch(`/api/team/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      toast.success(`User ${newStatus === "ACTIVE" ? "activated" : "deactivated"}`);
      mutate();
    }
  }

  const headers = ["Name", "Email", "Roles", "Status", "Last Login", "Actions"];

  return (
    <div>
      <PageHeader
        title="Team"
        description="Manage users and their access roles"
        action={
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        }
      />

      {!isLoading && (!users || users.length === 0) ? (
        <EmptyState
          icon={User}
          title="No team members yet"
          description="Add users to give them access to the platform."
          action={<Button onClick={() => setInviteOpen(true)}>Add First User</Button>}
        />
      ) : (
        <DataTable headers={headers} isLoading={isLoading}>
          {(users ?? []).map((user: UserRow) => (
            <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50 text-sm">
              <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
              <td className="px-4 py-3 text-gray-500">{user.email}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1 flex-wrap">
                  {user.roles.map((r) => (
                    <span key={r.role.code} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      ROLE_COLORS[r.role.code] ?? "bg-gray-100 text-gray-600"
                    }`}>
                      {r.role.name}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge variant={user.status === "ACTIVE" ? "default" : "secondary"}>
                  {user.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-gray-400 text-xs">
                {user.lastLoginAt
                  ? new Date(user.lastLoginAt).toLocaleDateString("en-AE")
                  : "Never"}
              </td>
              <td className="px-4 py-3">
                <Button
                  size="sm"
                  variant="ghost"
                  className={`h-7 text-xs ${user.status === "ACTIVE" ? "text-red-500 hover:text-red-700" : "text-green-600 hover:text-green-700"}`}
                  onClick={() => toggleUserStatus(user.id, user.status)}
                >
                  {user.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} onSuccess={mutate} />
    </div>
  );
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  status: string;
  lastLoginAt?: string | null;
  roles: Array<{ role: { code: string; name: string } }>;
}
