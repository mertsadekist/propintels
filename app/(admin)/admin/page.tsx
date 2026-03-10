import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/auth.config";
import { redirect } from "next/navigation";
import { DashboardKPIs } from "@/components/admin/dashboard-kpis";

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isManager =
    session.user.roles.includes("ADMIN") || session.user.roles.includes("MANAGER");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back, {session.user.name}
        </p>
      </div>

      {isManager ? (
        <DashboardKPIs />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">
            Welcome to IST Valuation Platform. Navigate using the sidebar to access your projects and leads.
          </p>
        </div>
      )}
    </div>
  );
}
