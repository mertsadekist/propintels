import Link from "next/link";
import { Palette, Sliders, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";

const SETTINGS_SECTIONS = [
  {
    href: "/admin/settings/branding",
    icon: Palette,
    title: "Branding",
    description: "Company name, colors, logo, and disclaimer for PDF reports",
  },
  {
    href: "/admin/settings/valuation-rules",
    icon: Sliders,
    title: "Valuation Rules",
    description: "Area tolerance, outlier method, minimum comps, verdict thresholds",
  },
];

export default function SettingsPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" description="Configure platform-wide settings" />
      <div className="space-y-3">
        {SETTINGS_SECTIONS.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="border border-gray-200 hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer">
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-gray-100 rounded-lg">
                    <section.icon className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{section.title}</div>
                    <div className="text-sm text-gray-500">{section.description}</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
