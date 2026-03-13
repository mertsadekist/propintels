import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { z } from "zod";

const bodySchema = z.object({
  url: z.string().url().refine(
    (u) => u.includes("propertyfinder.ae"),
    "URL must be from propertyfinder.ae"
  ),
});

interface ParsedListing {
  externalId: string;
  reference: string | null;
  title: string;
  propertyType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqft: number | null;
  askPrice: number | null;
  locationLabel: string;      // short location (community name)
  fullLocation: string;       // full hierarchy e.g. "Business Bay, Dubai"
  isFeatured: boolean;
  isVerified: boolean;
  isSuperAgent: boolean;
  furnished: string | null;   // "YES" | "NO" | "SEMI_FURNISHED"
  completionStatus: string | null; // "completed" | "off_plan"
  listedDate: string | null;  // ISO date string
}

// Map PropertyFinder property type slugs to our enum values
function mapPropertyType(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s.includes("apartment") || s.includes("flat")) return "APARTMENT";
  if (s.includes("penthouse")) return "PENTHOUSE";
  if (s.includes("duplex")) return "DUPLEX";
  if (s.includes("townhouse")) return "TOWNHOUSE";
  if (s.includes("villa")) return "VILLA";
  if (s.includes("office")) return "OFFICE";
  if (s.includes("retail") || s.includes("shop")) return "RETAIL";
  if (s.includes("warehouse") || s.includes("storage")) return "WAREHOUSE";
  if (s.includes("land") || s.includes("plot")) return "LAND";
  return "OTHER";
}

// Try to convert area to sqft if in sqm
function toSqft(value: number, unit?: string): number {
  if (!unit) return value; // assume sqft
  const u = unit.toLowerCase();
  if (u.includes("sqm") || u.includes("m²") || u === "m2") {
    return Math.round(value * 10.7639);
  }
  return value; // sqft or unknown → return as-is
}

// Recursively search for the listings array in the JSON tree
function findListingsArray(obj: unknown, depth = 0): unknown[] | null {
  if (depth > 10 || !obj || typeof obj !== "object") return null;

  if (Array.isArray(obj)) {
    if (
      obj.length > 0 &&
      typeof obj[0] === "object" &&
      obj[0] !== null &&
      ("price" in obj[0] || "asking_price" in obj[0] || "sale_price" in obj[0]) &&
      (
        "area" in obj[0] || "size" in obj[0] || "property_size" in obj[0] ||
        "bedrooms" in obj[0] || "rooms" in obj[0] || "baths" in obj[0] ||
        "bathrooms" in obj[0] || "property_type" in obj[0]
      )
    ) {
      return obj as unknown[];
    }
    return null;
  }

  const record = obj as Record<string, unknown>;
  const knownPaths = [
    "hits", "properties", "results", "listings", "data",
    "items", "search_result", "searchResult", "propertyList",
    "cards", "props", "pageProps", "initialState", "initialProps",
  ];

  for (const key of knownPaths) {
    if (key in record) {
      const found = findListingsArray(record[key], depth + 1);
      if (found) return found;
    }
  }

  // Deep search all keys
  for (const key of Object.keys(record)) {
    if (key === "__N_SSP" || key === "__N_SSG" || key === "buildId") continue;
    const found = findListingsArray(record[key], depth + 1);
    if (found) return found;
  }

  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractArea(val: unknown, unitHint?: unknown): number | null {
  if (!val) return null;
  if (typeof val === "object") {
    const o = val as Record<string, unknown>;
    const v = typeof o.value === "number" ? o.value
      : typeof o.value === "string" ? parseFloat(o.value)
      : typeof o.area === "number" ? o.area
      : null;
    if (v === null || isNaN(v as number)) return null;
    const unit = String(o.unit ?? o.unit_en ?? unitHint ?? "");
    return Math.round(toSqft(v as number, unit));
  }
  if (typeof val === "number") {
    return Math.round(toSqft(val, String(unitHint ?? "")));
  }
  if (typeof val === "string") {
    const n = parseFloat(val);
    if (!isNaN(n)) return Math.round(toSqft(n, String(unitHint ?? "")));
  }
  return null;
}

function extractInt(v: unknown): number | null {
  if (typeof v === "number") return isNaN(v) ? null : Math.round(v);
  if (typeof v === "string") { const n = parseInt(v, 10); return isNaN(n) ? null : n; }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.value === "number") return Math.round(o.value);
    if (typeof o.value === "string") { const n = parseInt(o.value, 10); return isNaN(n) ? null : n; }
    if (typeof o.slug === "string") { const n = parseInt(o.slug, 10); return isNaN(n) ? null : n; }
    if (typeof o.label === "string") { const n = parseInt(o.label, 10); return isNaN(n) ? null : n; }
  }
  return null;
}

// Parse a single hit object into ParsedListing
function parseHit(hit: Record<string, unknown>): ParsedListing | null {
  try {
    // ── Price ────────────────────────────────────────────────────────────────
    let price: number | null = null;
    if (typeof hit.price === "number") price = hit.price;
    else if (typeof hit.price === "string") { const n = parseFloat(hit.price); if (!isNaN(n)) price = n; }
    else if (hit.price && typeof hit.price === "object" && "value" in (hit.price as object)) {
      price = Number((hit.price as Record<string, unknown>).value);
    } else if (typeof hit.asking_price === "number") price = hit.asking_price;
    else if (typeof hit.asking_price === "string") { const n = parseFloat(hit.asking_price); if (!isNaN(n)) price = n; }
    else if (typeof hit.sale_price === "number") price = hit.sale_price;
    else if (hit.sale_price && typeof hit.sale_price === "object" && "value" in (hit.sale_price as object)) {
      price = Number((hit.sale_price as Record<string, unknown>).value);
    }

    // ── Area ─────────────────────────────────────────────────────────────────
    const areaSqft: number | null =
      extractArea(hit.size, hit.size_unit) ??
      extractArea(hit.area, hit.area_unit) ??
      extractArea(hit.property_size, hit.property_size_unit) ??
      extractArea(hit.floor_area, hit.floor_area_unit) ??
      extractArea(hit.gross_area) ??
      null;

    // ── Bedrooms ──────────────────────────────────────────────────────────────
    const bedrooms: number | null =
      extractInt(hit.rooms) ??
      extractInt(hit.bedrooms) ??
      extractInt(hit.bedrooms_value) ??
      extractInt(hit.beds) ??
      extractInt(hit.num_bedrooms) ??
      null;

    // ── Bathrooms ─────────────────────────────────────────────────────────────
    const bathrooms: number | null =
      extractInt(hit.baths) ??
      extractInt(hit.bathrooms) ??
      extractInt(hit.bathrooms_value) ??
      extractInt(hit.num_bathrooms) ??
      null;

    // ── Property type ────────────────────────────────────────────────────
    let rawType = "OTHER";
    if (hit.property_type) {
      const pt = hit.property_type as Record<string, unknown>;
      rawType = String(pt.slug ?? pt.name_en ?? pt.name ?? pt);
    } else if (typeof hit.type === "string") {
      rawType = hit.type;
    } else if (typeof hit.category === "string") {
      rawType = hit.category;
    }

    // ── Location — short label (community) ───────────────────────────────
    let locationLabel = "";
    if (hit.location) {
      const loc = hit.location as Record<string, unknown>;
      locationLabel = String(loc.name_en ?? loc.name ?? loc.title ?? "");
    } else if (typeof hit.community === "string") {
      locationLabel = hit.community;
    } else if (typeof hit.sub_community === "string") {
      locationLabel = hit.sub_community;
    }

    // ── Full location hierarchy from location_tree ────────────────────────
    let fullLocation = locationLabel;
    if (Array.isArray(hit.location_tree) && hit.location_tree.length > 0) {
      const parts = (hit.location_tree as Array<Record<string, unknown>>)
        .map((l) => String(l.name_en ?? l.name ?? ""))
        .filter(Boolean);
      if (parts.length > 0) fullLocation = parts.join(", ");
    } else if (hit.location) {
      const loc = hit.location as Record<string, unknown>;
      const full = String(loc.full_name ?? "");
      if (full) fullLocation = full;
    }

    // ── Title ─────────────────────────────────────────────────────────────
    const title = String(hit.title ?? hit.name ?? hit.headline ?? "");

    // ── Reference number ─────────────────────────────────────────────────
    const reference = typeof hit.reference === "string" ? hit.reference : null;

    // ── Listed date ───────────────────────────────────────────────────────
    const listedDate =
      typeof hit.listed_date === "string" ? hit.listed_date :
      typeof hit.created_at === "string" ? hit.created_at :
      typeof hit.published_at === "string" ? hit.published_at : null;

    // ── Status badges ─────────────────────────────────────────────────────
    const isVerified = hit.is_verified === true;
    const isSuperAgent = hit.is_super_agent === true;

    // ── Furnished & completion ────────────────────────────────────────────
    const furnished = typeof hit.furnished === "string" ? hit.furnished : null;
    const completionStatus = typeof hit.completion_status === "string" ? hit.completion_status : null;

    // ── Is featured / AD ─────────────────────────────────────────────────
    const isFeatured =
      hit.is_featured === true ||
      hit.featured === true ||
      hit.promoted === true ||
      (hit.product_label &&
        typeof hit.product_label === "object" &&
        "is_featured" in (hit.product_label as object) &&
        (hit.product_label as Record<string, unknown>).is_featured === true);

    // Need at least a price to be useful
    if (!price) return null;

    const id =
      typeof hit.id === "string" || typeof hit.id === "number"
        ? String(hit.id)
        : String(Math.random());

    return {
      externalId: id,
      reference,
      title,
      propertyType: mapPropertyType(rawType),
      bedrooms,
      bathrooms,
      areaSqft,
      askPrice: price,
      locationLabel,
      fullLocation,
      isFeatured: Boolean(isFeatured),
      isVerified,
      isSuperAgent,
      furnished,
      completionStatus,
      listedDate,
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const { error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } },
      { status: 400 }
    );
  }

  const { url } = parsed.data;

  // Fetch with browser-like headers
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status === 403 || res.status === 429 || res.status === 503) {
      return NextResponse.json({
        blocked: true, listings: [], total: 0,
        message: "تم حجب الطلب من قبل PropertyFinder (Cloudflare). حاول مرة أخرى لاحقاً أو أدخل البيانات يدوياً.",
      });
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: { code: "FETCH_ERROR", message: `HTTP ${res.status} من PropertyFinder` } },
        { status: 502 }
      );
    }

    html = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: { code: "FETCH_ERROR", message: `فشل الاتصال: ${msg}` } },
      { status: 502 }
    );
  }

  // Cloudflare challenge check
  if (
    html.includes("cf-browser-verification") ||
    html.includes("cf_chl_") ||
    html.includes("Just a moment") ||
    html.includes("Enable JavaScript and cookies") ||
    (html.length < 5000 && !html.includes("__NEXT_DATA__"))
  ) {
    return NextResponse.json({
      blocked: true, listings: [], total: 0,
      message: "تم حجب الطلب من قبل PropertyFinder (Cloudflare). حاول مرة أخرى لاحقاً أو أدخل البيانات يدوياً.",
    });
  }

  // Extract __NEXT_DATA__
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
  if (!match || !match[1]) {
    return NextResponse.json({
      blocked: false, listings: [], total: 0,
      message: "لم يتم العثور على بيانات مهيكلة في الصفحة. ربما تغيرت بنية الموقع.",
    });
  }

  let nextData: unknown;
  try {
    nextData = JSON.parse(match[1]);
  } catch {
    return NextResponse.json({
      blocked: false, listings: [], total: 0,
      message: "فشل تحليل بيانات الصفحة (JSON parse error).",
    });
  }

  const hitsArray = findListingsArray(nextData);
  if (!hitsArray || hitsArray.length === 0) {
    return NextResponse.json({
      blocked: false, listings: [], total: 0,
      message: "لم يتم العثور على عقارات في هذه الصفحة.",
    });
  }

  // In development, expose first raw hit for debugging missing fields
  const debugFirstHit =
    process.env.NODE_ENV === "development" && hitsArray[0]
      ? (hitsArray[0] as Record<string, unknown>)
      : undefined;

  const listings: ParsedListing[] = [];
  for (const hit of hitsArray) {
    if (hit && typeof hit === "object") {
      const parsed = parseHit(hit as Record<string, unknown>);
      if (parsed) listings.push(parsed);
    }
  }

  return NextResponse.json({
    blocked: false,
    listings,
    total: listings.length,
    ...(debugFirstHit ? { _debug_first_hit: debugFirstHit } : {}),
  });
}
