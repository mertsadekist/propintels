import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/auth.config";
import { redirect } from "next/navigation";
import { DealSegmentsPage } from "@/components/admin/analytics/deal-segments-page";

export const metadata = { title: "Deal Segments — Analytics" };

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!session.user.roles.includes("ADMIN") && !session.user.roles.includes("MANAGER")) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Deal Segments</h1>
        <p className="text-sm text-gray-500 mt-1">
          Price tier distribution, luxury market share, bedroom × bracket breakdown, and monthly segment trends
        </p>
      </div>
      <DealSegmentsPage />
    </div>
  );
}
