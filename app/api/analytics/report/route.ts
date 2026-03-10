import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { settingsRepo } from "@/db/repositories/settings.repo";
import { buildMarketReportHtml } from "@/pdf/templates/market-report.template";
import type { MarketReportData, MarketReportFilters } from "@/pdf/templates/market-report.template";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  try {
    const body = await request.json();
    const filters: MarketReportFilters = {
      area: body.area || undefined,
      propertyType: body.propertyType || undefined,
      bedrooms: body.bedrooms !== undefined ? Number(body.bedrooms) : undefined,
      dateFrom: body.dateFrom || undefined,
      dateTo: body.dateTo || undefined,
      category: body.category || undefined,
    };

    // Fetch analytics data by calling the market API internally (forwards session cookie)
    const sp = new URLSearchParams();
    if (filters.area) sp.set("area", filters.area);
    if (filters.propertyType) sp.set("propertyType", filters.propertyType);
    if (filters.bedrooms !== undefined) sp.set("bedrooms", String(filters.bedrooms));
    if (filters.dateFrom) sp.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) sp.set("dateTo", filters.dateTo);
    if (filters.category) sp.set("category", filters.category);

    const baseUrl = process.env.NEXTAUTH_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
    const cookies = request.headers.get("cookie") ?? "";

    const analyticsRes = await fetch(`${baseUrl}/api/analytics/market?${sp.toString()}`, {
      headers: { cookie: cookies },
    });

    if (!analyticsRes.ok) {
      return NextResponse.json(
        { error: { code: "FETCH_ERROR", message: "Failed to fetch analytics data" } },
        { status: 500 }
      );
    }

    const analyticsJson = await analyticsRes.json();
    const analyticsData = analyticsJson.data as Omit<MarketReportData, "filters">;

    const reportData: MarketReportData = { ...analyticsData, filters };

    const branding = await settingsRepo.getBranding();
    const b = branding as Record<string, unknown>;
    const brandingConfig = {
      companyName: (b.companyName as string) ?? "IST Valuation",
      primaryColor: (b.primaryColor as string) ?? "#1e3a5f",
      accentColor: (b.accentColor as string) ?? "#2563eb",
      disclaimer: (b.disclaimer as string) ?? undefined,
    };

    const html = buildMarketReportHtml(reportData, brandingConfig);

    // Dynamic import of puppeteer-based generator to avoid bundling issues
    const { generatePdfFromHtml } = await import("@/pdf/generatePdf");
    const { buffer } = await generatePdfFromHtml(html);

    const filterParts: string[] = [];
    if (filters.area) filterParts.push(filters.area.toLowerCase().replace(/\s+/g, "-"));
    if (filters.propertyType) filterParts.push(filters.propertyType.toLowerCase());
    const fileName = `market-report${filterParts.length > 0 ? `-${filterParts.join("-")}` : ""}-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    console.error("[analytics/report] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
  }
}
