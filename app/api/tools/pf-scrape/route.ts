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
  title: string;
  propertyType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqft: number | null;
  askPrice: number | null;
  locationLabel: string;
  isFeatured: boolean;
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
// Returns the first array that looks like a property listing array
function findListingsArray(obj: unknown, depth = 0): unknown[] | null {
  if (depth > 8 || !obj || typeof obj !== "object") return null;

  if (Array.isArray(obj)) {
    // Check if this looks like a listings array
    if (
      obj.length > 0 &&
      typeof obj[0] === "object" &&
      obj[0] !== null &&
      ("price" in obj[0] || "asking_price" in obj[0]) &&
      ("area" in obj[0] || "size" in obj[0] || "property_size" in obj[0])
    ) {
      return obj as unknown[];
    }
    return null;
  }

  // Known paths in PropertyFinder's Next.js data
  const record = obj as Record<string, unknown>;
  const knownPaths = [
    "hits",
    "properties",
    "results",
    "listings",
    "data",
    "items",
    "search_result",
    "searchResult",
    "propertyList",
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

// Parse a single hit object into ParsedListing
function parseHit(hit: Record<string, unknown>): ParsedListing | null {
  try {
    // Extract price (multiple possible field names)
    let price: number | null = null;
    if (typeof hit.price === "number") price = hit.price;
    else if (typeof hit.asking_price === "number") price = hit.asking_price;
    else if (hit.price && typeof hit.price === "object" && "value" in (hit.price as object)) {
      price = Number((hit.price as Record<string, unknown>).value);
    }

    // Extract area — supports both object {value, unit} and plain number
    let areaSqft: number | null = null;
    if (hit.area && typeof hit.area === "object") {
      const areaObj = hit.area as Record<string, unknown>;
      if (typeof areaObj.value === "number") {
        areaSqft = Math.round(toSqft(areaObj.value, String(areaObj.unit ?? "")));
      }
    } else if (hit.size && typeof hit.size === "object") {
      // PropertyFinder actual structure: size: { value: 687, unit: "sqft" }
      const sizeObj = hit.size as Record<string, unknown>;
      if (typeof sizeObj.value === "number") {
        areaSqft = Math.round(toSqft(sizeObj.value, String(sizeObj.unit ?? "")));
      }
    } else if (typeof hit.size === "number") {
      areaSqft = Math.round(toSqft(hit.size, String(hit.size_unit ?? "")));
    } else if (typeof hit.property_size === "number") {
      areaSqft = Math.round(toSqft(hit.property_size, String(hit.property_size_unit ?? "")));
    } else if (typeof hit.area === "number") {
      areaSqft = hit.area;
    }

    // Extract bedrooms — PropertyFinder returns strings e.g. "2", "0" (studio)
    let bedrooms: number | null = null;
    if (typeof hit.rooms === "number") bedrooms = hit.rooms;
    else if (typeof hit.rooms === "string") { const v = parseInt(hit.rooms, 10); if (!isNaN(v)) bedrooms = v; }
    else if (typeof hit.bedrooms === "number") bedrooms = hit.bedrooms;
    else if (typeof hit.bedrooms === "string") { const v = parseInt(hit.bedrooms, 10); if (!isNaN(v)) bedrooms = v; }
    else if (typeof hit.beds === "number") bedrooms = hit.beds;
    else if (typeof hit.beds === "string") { const v = parseInt(hit.beds, 10); if (!isNaN(v)) bedrooms = v; }

    // Extract bathrooms — PropertyFinder returns strings e.g. "1", "2"
    let bathrooms: number | null = null;
    if (typeof hit.baths === "number") bathrooms = hit.baths;
    else if (typeof hit.baths === "string") { const v = parseInt(hit.baths, 10); if (!isNaN(v)) bathrooms = v; }
    else if (typeof hit.bathrooms === "number") bathrooms = hit.bathrooms;
    else if (typeof hit.bathrooms === "string") { const v = parseInt(hit.bathrooms, 10); if (!isNaN(v)) bathrooms = v; }

    // Extract property type
    let rawType = "OTHER";
    if (hit.property_type) {
      const pt = hit.property_type as Record<string, unknown>;
      rawType = String(pt.slug ?? pt.name_en ?? pt.name ?? pt);
    } else if (typeof hit.type === "string") {
      rawType = hit.type;
    } else if (typeof hit.category === "string") {
      rawType = hit.category;
    }

    // Extract location
    let locationLabel = "";
    if (hit.location) {
      const loc = hit.location as Record<string, unknown>;
      locationLabel = String(loc.name_en ?? loc.name ?? loc.title ?? "");
    } else if (typeof hit.community === "string") {
      locationLabel = hit.community;
    } else if (typeof hit.sub_community === "string") {
      locationLabel = hit.sub_community;
    }

    // Extract title
    const title = String(hit.title ?? hit.name ?? hit.headline ?? "");

    // Is featured / AD
    const isFeatured =
      hit.is_featured === true ||
      hit.featured === true ||
      hit.promoted === true ||
      (hit.product_label &&
        typeof hit.product_label === "object" &&
        "is_featured" in (hit.product_label as object) &&
        (hit.product_label as Record<string, unknown>).is_featured === true);

    // Need at least a price or area to be useful
    if (!price && !areaSqft) return null;

    const id =
      typeof hit.id === "string" || typeof hit.id === "number"
        ? String(hit.id)
        : String(Math.random());

    return {
      externalId: id,
      title,
      propertyType: mapPropertyType(rawType),
      bedrooms,
      bathrooms,
      areaSqft,
      askPrice: price,
      locationLabel,
      isFeatured: Boolean(isFeatured),
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

  // Fetch the PropertyFinder page with browser-like headers
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
      // 15 second timeout
      signal: AbortSignal.timeout(15_000),
    });

    // Cloudflare / bot detection check
    if (res.status === 403 || res.status === 429 || res.status === 503) {
      return NextResponse.json({
        blocked: true,
        listings: [],
        total: 0,
        message:
          "تم حجب الطلب من قبل PropertyFinder (Cloudflare). حاول مرة أخرى لاحقاً أو أدخل البيانات يدوياً.",
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

  // Check if response looks like a Cloudflare challenge
  if (
    html.includes("cf-browser-verification") ||
    html.includes("cf_chl_") ||
    html.includes("Just a moment") ||
    html.includes("Enable JavaScript and cookies") ||
    (html.length < 5000 && !html.includes("__NEXT_DATA__"))
  ) {
    return NextResponse.json({
      blocked: true,
      listings: [],
      total: 0,
      message:
        "تم حجب الطلب من قبل PropertyFinder (Cloudflare). حاول مرة أخرى لاحقاً أو أدخل البيانات يدوياً.",
    });
  }

  // Extract __NEXT_DATA__ JSON
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
  if (!match || !match[1]) {
    return NextResponse.json({
      blocked: false,
      listings: [],
      total: 0,
      message: "لم يتم العثور على بيانات مهيكلة في الصفحة. ربما تغيرت بنية الموقع.",
    });
  }

  let nextData: unknown;
  try {
    nextData = JSON.parse(match[1]);
  } catch {
    return NextResponse.json({
      blocked: false,
      listings: [],
      total: 0,
      message: "فشل تحليل بيانات الصفحة (JSON parse error).",
    });
  }

  // Find listings array in the data
  const hitsArray = findListingsArray(nextData);
  if (!hitsArray || hitsArray.length === 0) {
    return NextResponse.json({
      blocked: false,
      listings: [],
      total: 0,
      message: "لم يتم العثور على عقارات في هذه الصفحة.",
    });
  }

  // Parse each hit
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
  });
}
