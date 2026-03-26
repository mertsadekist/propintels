import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { z } from "zod";

const ALLOWED_DUBIZZLE_HOSTS = new Set([
  "dubai.dubizzle.com",
  "www.dubizzle.com",
  "dubizzle.com",
]);

const bodySchema = z.object({
  url: z.string().url().refine(
    (u) => {
      try {
        const parsed = new URL(u);
        return (
          ALLOWED_DUBIZZLE_HOSTS.has(parsed.hostname) &&
          (parsed.protocol === "https:" || parsed.protocol === "http:")
        );
      } catch {
        return false;
      }
    },
    "URL must be from dubizzle.com"
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

// Map Dubizzle category names/slugs to our enum values
function mapPropertyType(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s.includes("apartment") || s.includes("flat") || s === "apartments") return "APARTMENT";
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

// Dubizzle stores area in square metres — always convert to sqft
function sqmToSqft(sqm: number): number {
  return Math.round(sqm * 10.7639);
}

function extractInt(v: unknown): number | null {
  if (typeof v === "number") return isNaN(v) ? null : Math.round(v);
  if (typeof v === "string") { const n = parseInt(v, 10); return isNaN(n) ? null : n; }
  return null;
}

// Recursively search for the listings (hits) array in the JSON tree
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
        "area"       in obj[0] ||
        "rooms"      in obj[0] ||
        "baths"      in obj[0] ||
        "externalID" in obj[0] ||
        "category"   in obj[0]
      )
    ) {
      return obj as unknown[];
    }
    return null;
  }

  const record = obj as Record<string, unknown>;

  // Known keys — Dubizzle-specific paths first
  const knownPaths = [
    "hits", "algolia", "content",
    "properties", "results", "listings", "data",
    "items", "searchResult", "searchResults",
    "propertyList", "cards",
    "props", "pageProps", "initialState",
  ];

  for (const key of knownPaths) {
    if (key in record) {
      const found = findListingsArray(record[key], depth + 1);
      if (found) return found;
    }
  }

  // Fallback: deep-search all remaining keys
  for (const key of Object.keys(record)) {
    if (key === "__N_SSP" || key === "__N_SSG" || key === "buildId") continue;
    const found = findListingsArray(record[key], depth + 1);
    if (found) return found;
  }

  return null;
}

// ── Extract window.state JSON from HTML ──────────────────────────────────────
function extractWindowState(html: string): unknown | null {
  // Dubizzle (same platform as Bayut) embeds data as: window.state={...};
  const marker = "window.state=";
  const idx = html.indexOf(marker);
  if (idx === -1) return null;

  const jsonStart = idx + marker.length;
  const scriptEnd = html.indexOf("</script>", jsonStart);
  if (scriptEnd === -1) return null;

  let jsonStr = html.slice(jsonStart, scriptEnd).trim();
  // Strip trailing semicolon
  if (jsonStr.endsWith(";")) jsonStr = jsonStr.slice(0, -1);

  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

// ── Parse a single Dubizzle listing hit ─────────────────────────────────────
function parseHit(hit: Record<string, unknown>): ParsedListing | null {
  try {
    // ── Price ────────────────────────────────────────────────────────────────
    let price: number | null = null;
    for (const field of ["price", "rentPerYear", "rentPerMonth", "asking_price"]) {
      if (typeof hit[field] === "number") { price = hit[field] as number; break; }
      if (typeof hit[field] === "string") {
        const n = parseFloat(hit[field] as string);
        if (!isNaN(n)) { price = n; break; }
      }
    }
    if (!price) return null;

    // ── Area (sqm → sqft) ────────────────────────────────────────────────────
    let areaSqft: number | null = null;
    if (typeof hit.area === "number" && !isNaN(hit.area) && hit.area > 0) {
      areaSqft = sqmToSqft(hit.area);
    } else if (typeof hit.area === "string") {
      const n = parseFloat(hit.area);
      if (!isNaN(n) && n > 0) areaSqft = sqmToSqft(n);
    }

    // ── Bedrooms ─────────────────────────────────────────────────────────────
    const bedrooms: number | null =
      extractInt(hit.rooms) ??
      extractInt(hit.bedrooms) ??
      extractInt(hit.beds) ??
      null;

    // ── Bathrooms ────────────────────────────────────────────────────────────
    const bathrooms: number | null =
      extractInt(hit.baths) ??
      extractInt(hit.bathrooms) ??
      null;

    // ── Property type — from category array ───────────────────────────────────
    let rawType = "OTHER";
    if (Array.isArray(hit.category) && hit.category.length > 0) {
      const cats = hit.category as Array<Record<string, unknown>>;
      const deepest = cats.reduce((prev, cur) =>
        (Number(cur.level) ?? 0) > (Number(prev.level) ?? 0) ? cur : prev
      );
      rawType = String(deepest.nameSingular ?? deepest.name ?? deepest.slug ?? "OTHER");
    }

    // ── Location ─────────────────────────────────────────────────────────────
    let locationLabel = "";
    let fullLocation = "";

    if (Array.isArray(hit.location) && hit.location.length > 0) {
      const locs = (hit.location as Array<Record<string, unknown>>)
        .filter((l) => Number(l.level) > 0)  // skip "UAE" country level
        .map((l) => String(l.name ?? ""))
        .filter(Boolean);

      if (locs.length > 0) {
        locationLabel = locs[locs.length - 1];
        fullLocation  = locs.join(", ");
      }
    }

    // ── Title ─────────────────────────────────────────────────────────────────
    const title = String(hit.title ?? hit.name ?? "");

    // ── Reference ────────────────────────────────────────────────────────────
    const reference =
      typeof hit.referenceNumber === "string" ? hit.referenceNumber :
      typeof hit.reference === "string" ? hit.reference :
      null;

    // ── External ID ──────────────────────────────────────────────────────────
    const id =
      typeof hit.externalID === "string" ? hit.externalID :
      typeof hit.externalId === "string" ? hit.externalId :
      typeof hit.objectID   === "string" ? hit.objectID :
      typeof hit.id === "string" || typeof hit.id === "number" ? String(hit.id) :
      String(Math.random());

    // ── Listed date ───────────────────────────────────────────────────────────
    let listedDate: string | null = null;
    for (const field of ["createdAt", "addedOn", "publishedAt", "published_at", "listed_date"]) {
      if (typeof hit[field] === "number") {
        listedDate = new Date((hit[field] as number) * 1000).toISOString();
        break;
      }
      if (typeof hit[field] === "string" && hit[field]) {
        listedDate = hit[field] as string;
        break;
      }
    }

    // ── Furnished ─────────────────────────────────────────────────────────────
    const furnished =
      typeof hit.furnishingStatus === "string"
        ? hit.furnishingStatus.toUpperCase().replace("-", "_")
        : null;

    // ── Completion status ─────────────────────────────────────────────────────
    const completionStatus =
      typeof hit.completionStatus === "string" ? hit.completionStatus :
      null;

    // ── Verified ──────────────────────────────────────────────────────────────
    const isVerified =
      hit.isVerified === true ||
      hit.isTrueCheck === true ||
      (hit.verification &&
        typeof hit.verification === "object" &&
        (hit.verification as Record<string, unknown>).status === "verified");

    // ── isFeatured / AD ───────────────────────────────────────────────────────
    // Dubizzle: product: "superhot" | "hot" | "featured" | "premium" | "default"
    const productStr = typeof hit.product === "string" ? hit.product.toLowerCase() : "";
    const isFeatured =
      productStr === "superhot"   ||
      productStr === "hot"        ||
      productStr === "featured"   ||
      productStr === "premium"    ||
      hit.featured    === true    ||
      hit.isFeatured  === true    ||
      hit.promoted    === true;

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
      isVerified: Boolean(isVerified),
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

  // ── Fetch page ────────────────────────────────────────────────────────────
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language":   "en-US,en;q=0.9",
        "Accept-Encoding":   "gzip, deflate, br",
        "Cache-Control":     "no-cache",
        Pragma:              "no-cache",
        "Sec-Fetch-Dest":    "document",
        "Sec-Fetch-Mode":    "navigate",
        "Sec-Fetch-Site":    "none",
        "Upgrade-Insecure-Requests": "1",
        Referer:             "https://dubai.dubizzle.com/",
      },
      signal: AbortSignal.timeout(25_000),
    });

    if (res.status === 403 || res.status === 429 || res.status === 503) {
      return NextResponse.json({
        blocked: true, listings: [], total: 0,
        message: "Request blocked by Dubizzle. Please try again later or enter data manually.",
      });
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: { code: "FETCH_ERROR", message: `HTTP ${res.status} from Dubizzle` } },
        { status: 502 }
      );
    }

    html = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: { code: "FETCH_ERROR", message: `Connection failed: ${msg}` } },
      { status: 502 }
    );
  }

  // ── Bot / Incapsula check ─────────────────────────────────────────────────
  if (
    html.includes("_Incapsula_Resource") ||
    html.includes("incapsula incident") ||
    html.includes("Request unsuccessful") ||
    html.includes("visitorId") ||
    html.includes("cf-browser-verification") ||
    html.includes("cf_chl_") ||
    html.includes("Just a moment") ||
    html.includes("Enable JavaScript and cookies") ||
    html.length < 5000
  ) {
    return NextResponse.json({
      blocked: true, listings: [], total: 0,
      message: "Request blocked by Dubizzle (Incapsula). Please try again later or enter data manually.",
    });
  }

  // ── Attempt 1: window.state (same platform as Bayut) ─────────────────────
  let stateData: unknown = extractWindowState(html);

  // ── Attempt 2: __NEXT_DATA__ fallback ────────────────────────────────────
  if (!stateData) {
    const m = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/
    );
    if (m?.[1]) {
      try { stateData = JSON.parse(m[1]); } catch { /* ignore */ }
    }
  }

  // ── Attempt 3: any large inline JSON blob ─────────────────────────────────
  if (!stateData) {
    const scriptTagRe = /<script[^>]*>([\s\S]*?)<\/script>/g;
    let sm: RegExpExecArray | null;
    while ((sm = scriptTagRe.exec(html)) !== null) {
      const text = sm[1].trim();
      if (text.length > 10_000 && text.startsWith("{")) {
        try {
          const candidate = JSON.parse(text);
          const arr = findListingsArray(candidate);
          if (arr && arr.length > 0) { stateData = candidate; break; }
        } catch { /* skip */ }
      }
    }
  }

  if (!stateData) {
    return NextResponse.json({
      blocked: false, listings: [], total: 0,
      message:
        "No structured data found on the page. Dubizzle may have changed their page structure or the page is protected by JavaScript rendering.",
    });
  }

  const hitsArray = findListingsArray(stateData);
  if (!hitsArray || hitsArray.length === 0) {
    return NextResponse.json({
      blocked: false, listings: [], total: 0,
      message:
        "No listings found on this page. Make sure the URL leads to a search results page (not a single property detail page).",
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
      const listing = parseHit(hit as Record<string, unknown>);
      if (listing) listings.push(listing);
    }
  }

  if (listings.length === 0) {
    return NextResponse.json({
      blocked: false, listings: [], total: 0,
      message: "Data was found on the page but no valid listings could be parsed. Please check the URL and try again.",
    });
  }

  return NextResponse.json({
    blocked: false,
    listings,
    total: listings.length,
    ...(debugFirstHit ? { _debug_first_hit: debugFirstHit } : {}),
  });
}
