import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { z } from "zod";

const ALLOWED_BAYUT_HOSTS = new Set([
  "www.bayut.com",
  "bayut.com",
]);

const bodySchema = z.object({
  url: z.string().url().refine(
    (u) => {
      try {
        const parsed = new URL(u);
        return (
          ALLOWED_BAYUT_HOSTS.has(parsed.hostname) &&
          (parsed.protocol === "https:" || parsed.protocol === "http:")
        );
      } catch {
        return false;
      }
    },
    "URL must be from bayut.com"
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
  locationLabel: string;
  fullLocation: string;
  isFeatured: boolean;
  isVerified: boolean;
  isSuperAgent: boolean;
  furnished: string | null;
  completionStatus: string | null;
  listedDate: string | null;
}

// Map Bayut property type names to our enum values
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

// Convert area to sqft if needed
function toSqft(value: number, unit?: string): number {
  if (!unit) return value;
  const u = unit.toLowerCase();
  if (u.includes("sqm") || u.includes("m²") || u === "m2" || u === "sq. m.") {
    return Math.round(value * 10.7639);
  }
  return value;
}

// Recursively search for the listings array in the JSON tree
function findListingsArray(obj: unknown, depth = 0): unknown[] | null {
  if (depth > 12 || !obj || typeof obj !== "object") return null;

  if (Array.isArray(obj)) {
    if (
      obj.length > 0 &&
      typeof obj[0] === "object" &&
      obj[0] !== null &&
      (
        "price" in obj[0] ||
        "rentPerYear" in obj[0] ||
        "rentPerMonth" in obj[0]
      ) &&
      (
        "area" in obj[0] ||
        "rooms" in obj[0] ||
        "baths" in obj[0] ||
        "type" in obj[0] ||
        "externalID" in obj[0]
      )
    ) {
      return obj as unknown[];
    }
    return null;
  }

  const record = obj as Record<string, unknown>;

  // Bayut-specific keys first
  const knownPaths = [
    "hits", "properties", "results", "listings", "data",
    "items", "search_result", "searchResult", "propertyList",
    "cards", "props", "pageProps", "initialState", "initialProps",
    "searchResults", "propertyListings", "propertiesCount",
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
    const v =
      typeof o.value === "number" ? o.value :
      typeof o.value === "string" ? parseFloat(o.value) :
      typeof o.area === "number" ? o.area :
      null;
    if (v === null || isNaN(v as number)) return null;
    const unit = String(o.unit ?? o.unit_en ?? o.measurementUnit ?? unitHint ?? "");
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

// Parse a single Bayut listing object into ParsedListing
function parseHit(hit: Record<string, unknown>): ParsedListing | null {
  try {
    // ── Price ─────────────────────────────────────────────────────────────────
    // Bayut uses: price (sale), rentPerYear, rentPerMonth
    let price: number | null = null;
    const priceFields = ["price", "rentPerYear", "rentPerMonth", "asking_price", "sale_price"];
    for (const field of priceFields) {
      if (typeof hit[field] === "number") { price = hit[field] as number; break; }
      if (typeof hit[field] === "string") {
        const n = parseFloat(hit[field] as string);
        if (!isNaN(n)) { price = n; break; }
      }
      if (hit[field] && typeof hit[field] === "object") {
        const o = hit[field] as Record<string, unknown>;
        if (typeof o.value === "number") { price = o.value; break; }
      }
    }

    // ── Area ─────────────────────────────────────────────────────────────────
    // Bayut: area: { value: number, unit: "Sq. Ft." }
    const areaSqft: number | null =
      extractArea(hit.area) ??
      extractArea(hit.size, hit.size_unit) ??
      extractArea(hit.property_size) ??
      extractArea(hit.floorArea) ??
      null;

    // ── Bedrooms ──────────────────────────────────────────────────────────────
    // Bayut: rooms (integer)
    const bedrooms: number | null =
      extractInt(hit.rooms) ??
      extractInt(hit.bedrooms) ??
      extractInt(hit.beds) ??
      extractInt(hit.noOfBedrooms) ??
      null;

    // ── Bathrooms ─────────────────────────────────────────────────────────────
    // Bayut: baths (integer)
    const bathrooms: number | null =
      extractInt(hit.baths) ??
      extractInt(hit.bathrooms) ??
      extractInt(hit.noOfBathrooms) ??
      null;

    // ── Property type ─────────────────────────────────────────────────────────
    // Bayut: type: { nameEn: "Apartment", ... }
    let rawType = "OTHER";
    if (hit.type) {
      const pt = hit.type as Record<string, unknown>;
      rawType = String(pt.nameEn ?? pt.name ?? pt.slug ?? pt);
    } else if (typeof hit.property_type === "string") {
      rawType = hit.property_type;
    } else if (hit.property_type) {
      const pt = hit.property_type as Record<string, unknown>;
      rawType = String(pt.nameEn ?? pt.slug ?? pt.name_en ?? pt.name ?? "OTHER");
    } else if (typeof hit.category === "string") {
      rawType = hit.category;
    }

    // ── Location ──────────────────────────────────────────────────────────────
    // Bayut: location: [{ name: "Dubai", ... }, { name: "Al Jaddaf", ... }, { name: "Binghatti Avenue", ... }]
    let locationLabel = "";
    let fullLocation = "";

    if (Array.isArray(hit.location) && hit.location.length > 0) {
      const locs = hit.location as Array<Record<string, unknown>>;
      // Last element = most specific (building/community)
      const last = locs[locs.length - 1];
      locationLabel = String(last.name ?? last.nameEn ?? last.name_en ?? "");
      // Full hierarchy joined
      const parts = locs
        .map((l) => String(l.name ?? l.nameEn ?? l.name_en ?? ""))
        .filter(Boolean);
      fullLocation = parts.join(", ");
    } else if (hit.location && typeof hit.location === "object") {
      const loc = hit.location as Record<string, unknown>;
      locationLabel = String(loc.name ?? loc.nameEn ?? loc.name_en ?? "");
      fullLocation = String(loc.fullName ?? loc.full_name ?? locationLabel);
    } else if (typeof hit.community === "string") {
      locationLabel = hit.community;
      fullLocation = hit.community;
    }

    // ── Title ─────────────────────────────────────────────────────────────────
    const title = String(hit.title ?? hit.name ?? hit.headline ?? "");

    // ── Reference ─────────────────────────────────────────────────────────────
    // Bayut: referenceNumber
    const reference =
      typeof hit.referenceNumber === "string" ? hit.referenceNumber :
      typeof hit.reference === "string" ? hit.reference :
      null;

    // ── External ID ───────────────────────────────────────────────────────────
    // Bayut: externalID (string), id (number)
    const id =
      typeof hit.externalID === "string" ? hit.externalID :
      typeof hit.externalId === "string" ? hit.externalId :
      typeof hit.id === "string" || typeof hit.id === "number" ? String(hit.id) :
      String(Math.random());

    // ── Listed date ───────────────────────────────────────────────────────────
    // Bayut: addedOn (unix timestamp or ISO), publishedAt, createdAt
    let listedDate: string | null = null;
    const dateFields = ["addedOn", "publishedAt", "published_at", "listed_date", "createdAt", "created_at"];
    for (const field of dateFields) {
      if (typeof hit[field] === "string" && hit[field]) {
        listedDate = hit[field] as string;
        break;
      }
      if (typeof hit[field] === "number") {
        // Unix timestamp → ISO string
        listedDate = new Date((hit[field] as number) * 1000).toISOString();
        break;
      }
    }

    // ── Furnished ─────────────────────────────────────────────────────────────
    // Bayut: furnishingStatus: "furnished" | "unfurnished" | "partly-furnished"
    const furnished =
      typeof hit.furnishingStatus === "string" ? hit.furnishingStatus.toUpperCase() :
      typeof hit.furnished === "string" ? hit.furnished :
      null;

    // ── Completion status ─────────────────────────────────────────────────────
    // Bayut: completionDetails: { completionStatus: "completed" | "under_construction" }
    let completionStatus: string | null = null;
    if (hit.completionDetails && typeof hit.completionDetails === "object") {
      const cd = hit.completionDetails as Record<string, unknown>;
      completionStatus = typeof cd.completionStatus === "string" ? cd.completionStatus : null;
    } else if (typeof hit.completionStatus === "string") {
      completionStatus = hit.completionStatus;
    } else if (typeof hit.completion_status === "string") {
      completionStatus = hit.completion_status;
    }

    // ── Verified ──────────────────────────────────────────────────────────────
    // Bayut: verifiedListings, isTrueCheck
    const isVerified =
      hit.isTrueCheck === true ||
      hit.is_verified === true ||
      hit.verified === true;

    // ── isFeatured / AD ───────────────────────────────────────────────────────
    // Bayut: product: "featured" | "premium" | "superhot" | "hot" | "default"
    const productStr = typeof hit.product === "string" ? hit.product.toLowerCase() : "";
    const isFeatured =
      productStr === "featured" ||
      productStr === "premium" ||
      productStr === "superhot" ||
      productStr === "hot" ||
      hit.featured === true ||
      hit.isFeatured === true ||
      hit.promoted === true ||
      hit.is_featured === true;

    // Need at least a price to be useful
    if (!price) return null;

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
      isSuperAgent: false,
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
        Referer: "https://www.bayut.com/",
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (res.status === 403 || res.status === 429 || res.status === 503) {
      return NextResponse.json({
        blocked: true, listings: [], total: 0,
        message: "تم حجب الطلب من قبل Bayut (Cloudflare). حاول مرة أخرى لاحقاً أو أدخل البيانات يدوياً.",
      });
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: { code: "FETCH_ERROR", message: `HTTP ${res.status} من Bayut` } },
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

  // Cloudflare / bot protection check
  if (
    html.includes("cf-browser-verification") ||
    html.includes("cf_chl_") ||
    html.includes("Just a moment") ||
    html.includes("Enable JavaScript and cookies") ||
    (html.length < 5000 && !html.includes("__NEXT_DATA__"))
  ) {
    return NextResponse.json({
      blocked: true, listings: [], total: 0,
      message: "تم حجب الطلب من قبل Bayut (Cloudflare). حاول مرة أخرى لاحقاً أو أدخل البيانات يدوياً.",
    });
  }

  // ── Attempt 1: extract __NEXT_DATA__ (Next.js SSR) ──────────────────────────
  let nextData: unknown = null;
  const nextDataMatch = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/
  );
  if (nextDataMatch?.[1]) {
    try { nextData = JSON.parse(nextDataMatch[1]); } catch { /* ignore */ }
  }

  // ── Attempt 2: scan all <script> tags for large JSON blobs ──────────────────
  if (!nextData) {
    const scriptTagRegex = /<script[^>]*>(\{[\s\S]*?\})<\/script>/g;
    let scriptMatch: RegExpExecArray | null;
    while ((scriptMatch = scriptTagRegex.exec(html)) !== null) {
      const text = scriptMatch[1].trim();
      if (text.length > 2000) {
        try {
          const candidate = JSON.parse(text);
          const arr = findListingsArray(candidate);
          if (arr && arr.length > 0) { nextData = candidate; break; }
        } catch { /* skip */ }
      }
    }
  }

  if (!nextData) {
    return NextResponse.json({
      blocked: false, listings: [], total: 0,
      message: "لم يتم العثور على بيانات مهيكلة في الصفحة. ربما تغيرت بنية الموقع أو الصفحة محمية بـ JavaScript.",
    });
  }

  const hitsArray = findListingsArray(nextData);
  if (!hitsArray || hitsArray.length === 0) {
    return NextResponse.json({
      blocked: false, listings: [], total: 0,
      message: "لم يتم العثور على عقارات في هذه الصفحة. تأكد أن الرابط يؤدي إلى صفحة نتائج بحث وليس صفحة تفاصيل عقار.",
    });
  }

  // In development, expose first raw hit for debugging
  const debugFirstHit =
    process.env.NODE_ENV === "development" && hitsArray[0]
      ? (hitsArray[0] as Record<string, unknown>)
      : undefined;

  const listings: ParsedListing[] = [];
  for (const hit of hitsArray) {
    if (hit && typeof hit === "object") {
      const parsedListing = parseHit(hit as Record<string, unknown>);
      if (parsedListing) listings.push(parsedListing);
    }
  }

  return NextResponse.json({
    blocked: false,
    listings,
    total: listings.length,
    ...(debugFirstHit ? { _debug_first_hit: debugFirstHit } : {}),
  });
}
