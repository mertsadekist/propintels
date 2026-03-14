import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowLeft, Phone, Mail, Building } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ValuationResultCard } from "@/components/admin/leads/valuation-result-card";
import { ProjectValuationCard } from "@/components/admin/leads/project-valuation-card";
import { SpecialistAssessmentCard } from "@/components/admin/leads/specialist-assessment-card";
import { LeadStatusSelector } from "@/components/admin/leads/lead-status-selector";
import { AssignAgentSection } from "@/components/admin/leads/assign-agent-section";
import { ReportDownloadButton } from "@/components/admin/leads/report-download-button";
import { RevalueButton } from "@/components/admin/leads/revalue-button";
import { formatCurrency } from "@/lib/utils";
import type { ValuationSnapshot } from "@/valuation/types";

async function getLead(leadId: string) {
  const cookieStore = cookies();
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/leads/${leadId}`,
    {
      cache: "no-store",
      headers: { cookie: cookieStore.toString() },
    }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.data;
}

export default async function LeadDetailPage({
  params,
}: {
  params: { leadId: string };
}) {
  const lead = await getLead(params.leadId);
  if (!lead) notFound();

  const result = lead.valuationResult;
  const areaSqft = Number(lead.areaSqft);

  // Parse the project valuation snapshot stored as JSON
  const projectSnapshot: ValuationSnapshot | null =
    result?.projectValuationData
      ? (result.projectValuationData as ValuationSnapshot)
      : null;

  return (
    <div className="max-w-6xl">
      {/* Back */}
      <Link
        href="/admin/leads"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Leads
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lead.fullName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {lead.project?.name} · Submitted{" "}
            {new Date(lead.createdAt).toLocaleDateString("en-AE")}
          </p>
        </div>
        <ReportDownloadButton leadId={lead.id} reports={lead.reports ?? []} />
      </div>

      {/* ── Triple Valuation Section ── */}
      {result && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Valuation Summary
            </h2>
            <RevalueButton leadId={lead.id} />
          </div>

          {/* 3 cards in a row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 1. Area Valuation */}
            <ValuationResultCard result={result} areaSqft={areaSqft} />

            {/* 2. Project Valuation */}
            <ProjectValuationCard snapshot={projectSnapshot} />

            {/* 3. Specialist Assessment */}
            <SpecialistAssessmentCard
              leadId={lead.id}
              areaSqft={areaSqft}
              assessment={lead.specialistAssessment ?? null}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: property details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Property Details */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Property Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                {[
                  { label: "Property Type", value: lead.propertyType },
                  { label: "Bedrooms", value: lead.bedrooms ?? "—" },
                  { label: "Bathrooms", value: lead.bathrooms ?? "—" },
                  { label: "Area", value: `${areaSqft.toLocaleString()} sqft` },
                  { label: "Asking Price", value: formatCurrency(Number(lead.clientPrice)) },
                  {
                    label: "Ask PSF",
                    value: `${Math.round(Number(lead.clientPrice) / areaSqft).toLocaleString()} AED/sqft`,
                  },
                  { label: "Unit Type", value: lead.unitType ?? "—" },
                  { label: "Category", value: lead.category ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="font-medium text-gray-900 mt-0.5">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Right column: CRM actions */}
        <div className="space-y-4">
          {/* Contact Info */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-gray-400" />
                <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">
                  {lead.phone}
                </a>
              </div>
              {lead.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">
                    {lead.email}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Building className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">{lead.project?.name}</span>
              </div>
            </CardContent>
          </Card>

          {/* Lead Status */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Lead Status</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadStatusSelector
                leadId={lead.id}
                currentStatus={lead.status}
              />
            </CardContent>
          </Card>

          {/* Assigned Agent */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Assigned Agent</CardTitle>
            </CardHeader>
            <CardContent>
              <AssignAgentSection
                leadId={lead.id}
                currentAgent={lead.assignedAgent}
              />
            </CardContent>
          </Card>

          {/* Source Link */}
          {lead.link && (
            <Card className="border border-gray-200">
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500">Source Link</p>
                <p className="text-sm font-medium text-gray-700 mt-1">
                  {lead.link.label ?? `Link ${lead.link.id.slice(-6)}`}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
