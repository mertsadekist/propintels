import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/auth.config";
import { redirect } from "next/navigation";
import { AreaComparisonPageWrapper } from "@/components/admin/analytics/area-comparison-page";

export const metadata = { title: "Area Comparison — Analytics" };

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!session.user.roles.includes("ADMIN") && !session.user.roles.includes("MANAGER")) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Area Comparison</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sortable, paginated area ranking — transaction vs listing price gap
        </p>
      </div>
      <AreaComparisonPageWrapper />
    </div>
  );
}
