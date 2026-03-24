import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/auth.config";
import { redirect } from "next/navigation";
import { PropertyMixPage } from "@/components/admin/analytics/property-mix-page";

export const metadata = { title: "Property Mix — Analytics" };

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!session.user.roles.includes("ADMIN") && !session.user.roles.includes("MANAGER")) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Property Mix</h1>
        <p className="text-sm text-gray-500 mt-1">
          Transaction breakdown by property type, Ready vs Off-Plan, and Residential vs Commercial
        </p>
      </div>
      <PropertyMixPage />
    </div>
  );
}
