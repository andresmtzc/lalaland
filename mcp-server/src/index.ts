#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// ── Supabase setup ─────────────────────────────────────────────────
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://jmoxbhodpvnlmtihcwvt.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";

let supabase: SupabaseClient;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    if (!SUPABASE_ANON_KEY) {
      throw new Error(
        "SUPABASE_ANON_KEY is required. Set it as an environment variable."
      );
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabase;
}

// ── Clients / communities metadata ─────────────────────────────────
// This is a lightweight mirror of what's in each client-config.js
// so the MCP server can answer "what clients/communities exist?"
// without needing to parse JS files.
const CLIENTS: Record<
  string,
  {
    name: string;
    communities: { id: string; name: string; center: [number, number] }[];
  }
> = {
  inverta: {
    name: "Inverta",
    communities: [
      { id: "barcelona", name: "Barcelona", center: [-96.0903, 19.0725] },
      { id: "marsella", name: "Marsella", center: [-96.0785, 19.0647] },
      {
        id: "sierra-alta",
        name: "Sierra Alta",
        center: [-96.0614, 19.0583],
      },
      {
        id: "sierra-baja",
        name: "Sierra Baja",
        center: [-96.065, 19.0536],
      },
      { id: "cortezia", name: "Cortezia", center: [-96.0675, 19.0575] },
      { id: "ebano", name: "Ébano", center: [-96.0691, 19.0549] },
      { id: "verdalia", name: "Verdalia", center: [-96.0719, 19.055] },
      { id: "frondia", name: "Frondia", center: [-96.0748, 19.056] },
      { id: "almaterra", name: "Almaterra", center: [-96.0639, 19.0525] },
    ],
  },
  cpi: {
    name: "CPI",
    communities: [
      { id: "senterra", name: "Senterra", center: [-100.1534, 25.4255] },
    ],
  },
  agora: {
    name: "Agora",
    communities: [
      {
        id: "amani-pietra",
        name: "Amani Pietra",
        center: [-100.189895, 25.428123],
      },
      {
        id: "amani-aqua",
        name: "Amani Aqua",
        center: [-100.179293, 25.436671],
      },
      {
        id: "cañadas-vergel",
        name: "Cañadas Vergel",
        center: [-100.178178, 25.441325],
      },
    ],
  },
};

// ── Helpers: parse formatted DB strings into numbers ───────────────
// "4,098" → 4098  |  "$10.25" → 10250000  |  "2,500" → 2500
function parseArea(raw: any): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  return parseFloat(String(raw).replace(/[$,\s]/g, "")) || 0;
}
function parsePrice(raw: any): number {
  // millones is stored like "$10.25" meaning 10.25 million MXN → 10,250,000
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  const num = parseFloat(String(raw).replace(/[$,\s]/g, "")) || 0;
  return Math.round(num * 1_000_000);
}
function parsePriceM2(raw: any): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  return parseFloat(String(raw).replace(/[$,\s]/g, "")) || 0;
}

// ── Helper: paginated Supabase fetch ───────────────────────────────
async function fetchAllLots(query: any): Promise<any[]> {
  // Supabase caps at 1000 rows per request.  Paginate transparently.
  const PAGE = 1000;
  let all: any[] = [];
  let offset = 0;
  let done = false;

  while (!done) {
    const { data, error } = await (query as any).range(
      offset,
      offset + PAGE - 1
    );
    if (error) throw new Error(`Supabase query error: ${error.message}`);
    if (!data || data.length === 0) {
      done = true;
    } else {
      all = all.concat(data);
      if (data.length < PAGE) done = true;
      offset += PAGE;
    }
  }
  return all;
}

// ── MCP Server ─────────────────────────────────────────────────────
const server = new McpServer({
  name: "lalaland-lots",
  version: "1.0.0",
  description:
    "La-La Land real estate lot database. Search and query lots across multiple developments in Mexico. " +
    "Covers residential lots with pricing, availability, area, and location data.",
});

// ── Tool: search_lots ──────────────────────────────────────────────
server.tool(
  "search_lots",
  "Search for real estate lots with filters. Returns lot name, area (m²), price (MXN), " +
    "price per m², availability status, and community. Prices in the DB are stored as " +
    "millions of MXN (e.g. '$10.25' = $10,250,000 MXN). Use this to answer questions like " +
    '"find lots under 500000 MXN", "available lots in Barcelona", "lots bigger than 200m²".',
  {
    client_id: z
      .enum(["inverta", "cpi", "agora"])
      .optional()
      .describe(
        "Filter by client/developer. Options: inverta, cpi, agora. Omit to search all."
      ),
    community: z
      .string()
      .optional()
      .describe(
        "Filter by community/fraccionamiento name (e.g. 'barcelona', 'senterra', 'amani-pietra')"
      ),
    availability: z
      .enum(["Available", "Sold", "Featured", "Blocked"])
      .optional()
      .describe("Filter by availability status. Default: returns all."),
    min_price: z
      .number()
      .optional()
      .describe("Minimum total price in MXN (e.g. 300000 for $300K)"),
    max_price: z
      .number()
      .optional()
      .describe("Maximum total price in MXN (e.g. 800000 for $800K)"),
    min_area: z
      .number()
      .optional()
      .describe("Minimum lot area in square meters"),
    max_area: z
      .number()
      .optional()
      .describe("Maximum lot area in square meters"),
    limit: z
      .number()
      .optional()
      .default(25)
      .describe("Max results to return (default 25, max 100)"),
    offset: z
      .number()
      .optional()
      .default(0)
      .describe("Offset for pagination"),
  },
  async (params) => {
    const sb = getSupabase();
    // Fetch from Supabase with server-side filters that work on strings
    let query = sb
      .from("lots")
      .select(
        "lot_name, client_id, fraccionamiento, availability, rSize, millones, price_m2, nickname, subtitle"
      );

    if (params.client_id) query = query.eq("client_id", params.client_id);
    if (params.community)
      query = query.ilike("fraccionamiento", `%${params.community}%`);
    if (params.availability)
      query = query.eq("availability", params.availability);

    // Price/area are formatted strings in DB, so we fetch all and filter in memory
    const allRows = await fetchAllLots(query);

    // Parse, filter by price/area, sort by price ascending
    let lots = allRows.map((row: any) => ({
      lot_name: row.lot_name,
      client: row.client_id,
      community: row.fraccionamiento,
      availability: row.availability,
      area_m2: parseArea(row.rSize),
      price_mxn: parsePrice(row.millones),
      price_per_m2: parsePriceM2(row.price_m2),
      nickname: row.nickname || null,
      subtitle: row.subtitle || null,
    }));

    if (params.min_price) lots = lots.filter((l) => l.price_mxn >= params.min_price!);
    if (params.max_price) lots = lots.filter((l) => l.price_mxn <= params.max_price!);
    if (params.min_area) lots = lots.filter((l) => l.area_m2 >= params.min_area!);
    if (params.max_area) lots = lots.filter((l) => l.area_m2 <= params.max_area!);

    lots.sort((a, b) => a.price_mxn - b.price_mxn);

    const cap = Math.min(params.limit ?? 25, 100);
    const start = params.offset ?? 0;
    const page = lots.slice(start, start + cap);

    if (page.length === 0) {
      return {
        content: [
          { type: "text", text: "No lots found matching the given filters." },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { total_matching: lots.length, showing: page.length, offset: start, lots: page },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ── Lot image helpers ──────────────────────────────────────────────
// Maps community (fraccionamiento) → PDF subfolder for lot images
// inverta: barcelona/marsella → mediterraneo, sierraalta/sierrabaja → puntolomas,
//          cortezia/ebano/verdalia/frondia → arborea, almaterra → almaterra
// cpi: flat (no subfolder)
// agora: mediterraneo / puntolomas (but no images yet)
const COMMUNITY_TO_PDF_FOLDER: Record<string, string> = {
  // inverta
  barcelona: "mediterraneo",
  marsella: "mediterraneo",
  sierraalta: "puntolomas",
  sierrabaja: "puntolomas",
  cortezia: "arborea",
  ebano: "arborea",
  verdalia: "arborea",
  frondia: "arborea",
  almaterra: "almaterra",
  // agora
  "amani-pietra": "mediterraneo",
  "amani-aqua": "puntolomas",
  "cañadas-vergel": "puntolomas",
};

function getLotImageUrls(
  lotName: string,
  clientId: string,
  community: string
): { map_image: string | null; landscape_image: string | null } {
  const comm = community.toLowerCase();

  if (clientId === "cpi") {
    // CPI has flat structure: /cpi/pdf/{lot_name}_map.jpg
    return {
      map_image: `https://la-la.land/cpi/pdf/${lotName}_map.jpg`,
      landscape_image: `https://la-la.land/cpi/pdf/${lotName}_landscape.jpg`,
    };
  }

  const folder = COMMUNITY_TO_PDF_FOLDER[comm];
  if (!folder) return { map_image: null, landscape_image: null };

  return {
    map_image: `https://la-la.land/${clientId}/pdf/${folder}/${lotName}_map.jpg`,
    landscape_image: `https://la-la.land/${clientId}/pdf/${folder}/${lotName}_landscape.jpg`,
  };
}

// ── Tool: get_lot_details ──────────────────────────────────────────
server.tool(
  "get_lot_details",
  "Get full details for a specific lot by its lot_name. Returns area, price, " +
    "availability, community, images (map closeup and landscape context), " +
    "and a link to view it on the interactive map.",
  {
    lot_name: z
      .string()
      .describe(
        "The lot identifier (e.g. 'lotinverta10-01', 'lotcpi1-03', 'lotagorac31-25')"
      ),
  },
  async (params) => {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("lots")
      .select(
        "lot_name, client_id, fraccionamiento, availability, rSize, millones, price_m2, nickname, subtitle, image"
      )
      .eq("lot_name", params.lot_name)
      .maybeSingle();

    if (error)
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    if (!data)
      return {
        content: [
          {
            type: "text",
            text: `Lot "${params.lot_name}" not found.`,
          },
        ],
      };

    // Build links
    const mapUrl = `https://la-la.land/${data.client_id}/index.html?lot=${data.lot_name}`;
    const lotImages = getLotImageUrls(
      data.lot_name,
      data.client_id,
      data.fraccionamiento || ""
    );

    const result = {
      lot_name: data.lot_name,
      client: data.client_id,
      community: data.fraccionamiento,
      availability: data.availability,
      area_m2: parseArea(data.rSize),
      price_mxn: parsePrice(data.millones),
      price_per_m2: parsePriceM2(data.price_m2),
      nickname: data.nickname || null,
      subtitle: data.subtitle || null,
      image: data.image || null,
      map_image: lotImages.map_image,
      landscape_image: lotImages.landscape_image,
      view_on_map: mapUrl,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── Tool: list_communities ─────────────────────────────────────────
server.tool(
  "list_communities",
  "List all available communities/developments (fraccionamientos) and their clients. " +
    "Use this to discover what communities exist before searching lots.",
  {
    client_id: z
      .enum(["inverta", "cpi", "agora"])
      .optional()
      .describe("Filter by client. Omit to list all."),
  },
  async (params) => {
    const entries = params.client_id
      ? { [params.client_id]: CLIENTS[params.client_id] }
      : CLIENTS;

    const result = Object.entries(entries).map(([id, client]) => ({
      client_id: id,
      client_name: client.name,
      communities: client.communities.map((c) => ({
        id: c.id,
        name: c.name,
        center_lng: c.center[0],
        center_lat: c.center[1],
      })),
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── Tool: get_inventory_stats ──────────────────────────────────────
server.tool(
  "get_inventory_stats",
  "Get inventory statistics: total lots, available, sold, price ranges, and area ranges. " +
    "Use this to answer high-level questions like 'how many lots are available?' or " +
    "'what's the price range in Barcelona?'.",
  {
    client_id: z
      .enum(["inverta", "cpi", "agora"])
      .optional()
      .describe("Filter by client. Omit for global stats."),
    community: z
      .string()
      .optional()
      .describe("Filter by community/fraccionamiento name"),
  },
  async (params) => {
    const sb = getSupabase();
    let query = sb
      .from("lots")
      .select("availability, rSize, millones, fraccionamiento, client_id");

    if (params.client_id) query = query.eq("client_id", params.client_id);
    if (params.community)
      query = query.ilike("fraccionamiento", `%${params.community}%`);

    const allLots = await fetchAllLots(query);

    const stats = {
      total_lots: allLots.length,
      by_availability: {} as Record<string, number>,
      price_mxn: { min: Infinity, max: -Infinity, avg: 0 },
      area_m2: { min: Infinity, max: -Infinity, avg: 0 },
      communities: [] as string[],
    };

    let priceSum = 0;
    let priceCount = 0;
    let areaSum = 0;
    let areaCount = 0;
    const communitySet = new Set<string>();

    for (const lot of allLots) {
      const avail = lot.availability || "Available";
      stats.by_availability[avail] = (stats.by_availability[avail] || 0) + 1;

      const price = parsePrice(lot.millones);
      if (price > 0) {
        if (price < stats.price_mxn.min) stats.price_mxn.min = price;
        if (price > stats.price_mxn.max) stats.price_mxn.max = price;
        priceSum += price;
        priceCount++;
      }

      const area = parseArea(lot.rSize);
      if (area > 0) {
        if (area < stats.area_m2.min) stats.area_m2.min = area;
        if (area > stats.area_m2.max) stats.area_m2.max = area;
        areaSum += area;
        areaCount++;
      }

      if (lot.fraccionamiento) communitySet.add(lot.fraccionamiento);
    }

    stats.price_mxn.avg = priceCount > 0 ? Math.round(priceSum / priceCount) : 0;
    stats.area_m2.avg = areaCount > 0 ? Math.round(areaSum / areaCount) : 0;

    if (stats.price_mxn.min === Infinity) stats.price_mxn.min = 0;
    if (stats.price_mxn.max === -Infinity) stats.price_mxn.max = 0;
    if (stats.area_m2.min === Infinity) stats.area_m2.min = 0;
    if (stats.area_m2.max === -Infinity) stats.area_m2.max = 0;

    stats.communities = [...communitySet].sort();

    return {
      content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
    };
  }
);

// ── Geometry helpers ───────────────────────────────────────────────
// Haversine distance between two [lat,lng] points, returns meters
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Shoelace formula for polygon area in m² (approximate, works well for small polygons)
function polygonAreaM2(vertices: { lat: number; lng: number }[]): number {
  if (vertices.length < 3) return 0;
  // Convert to local meters using first vertex as origin
  const ref = vertices[0];
  const cosLat = Math.cos((ref.lat * Math.PI) / 180);
  const points = vertices.map((v) => ({
    x: ((v.lng - ref.lng) * Math.PI * 6371000 * cosLat) / 180,
    y: ((v.lat - ref.lat) * Math.PI * 6371000) / 180,
  }));
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
}

// Parse lots.txt content into a map of lot_name → vertices
function parseLotsText(
  text: string
): Map<string, { lat: number; lng: number }[]> {
  const lots = new Map<string, { lat: number; lng: number }[]>();
  let currentName = "";
  const lines = text.split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // If line starts with "lot" it's a lot name
    if (/^lot[a-z]/i.test(line)) {
      currentName = line.replace(/,\s*$/, "");
      lots.set(currentName, []);
    } else if (currentName && line.includes("lat") && line.includes("lng")) {
      // Parse "{ lat: 19.047808, lng: -96.037221},"
      const latMatch = line.match(/lat:\s*([-\d.]+)/);
      const lngMatch = line.match(/lng:\s*([-\d.]+)/);
      if (latMatch && lngMatch) {
        lots.get(currentName)!.push({
          lat: parseFloat(latMatch[1]),
          lng: parseFloat(lngMatch[1]),
        });
      }
    }
  }
  return lots;
}

// Cache for fetched lots.txt files (client_id → parsed map)
const lotsTextCache = new Map<
  string,
  { data: Map<string, { lat: number; lng: number }[]>; fetchedAt: number }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const LOTS_TEXT_URLS: Record<string, string> = {
  inverta: "https://la-la.land/inverta/lots.txt",
  cpi: "https://la-la.land/cpi/lots.txt",
  agora: "https://la-la.land/agora/lots.txt",
};

async function getLotsTextForClient(
  clientId: string
): Promise<Map<string, { lat: number; lng: number }[]>> {
  const cached = lotsTextCache.get(clientId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.data;

  const url = LOTS_TEXT_URLS[clientId];
  if (!url) return new Map();

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch lots.txt for ${clientId}: ${resp.status}`);
  const text = await resp.text();
  const parsed = parseLotsText(text);
  lotsTextCache.set(clientId, { data: parsed, fetchedAt: Date.now() });
  return parsed;
}

// Determine which client a lot_name belongs to
function clientForLotName(lotName: string): string | null {
  if (lotName.startsWith("lotinverta")) return "inverta";
  if (lotName.startsWith("lotcpi")) return "cpi";
  if (lotName.startsWith("lotagora")) return "agora";
  return null;
}

// ── Tool: get_lot_geometry ─────────────────────────────────────────
server.tool(
  "get_lot_geometry",
  "Get the exact geographic shape of a lot: vertex coordinates (lat/lng), side lengths in meters, " +
    "calculated area, perimeter, and centroid. Use this to answer questions about lot dimensions, " +
    "shape, orientation, or geographic position.",
  {
    lot_name: z
      .string()
      .describe(
        "The lot identifier (e.g. 'lotinverta10-01', 'lotcpi1-03', 'lotagorac31-25')"
      ),
  },
  async (params) => {
    const clientId = clientForLotName(params.lot_name);
    if (!clientId) {
      return {
        content: [
          {
            type: "text",
            text: `Cannot determine client for lot "${params.lot_name}". Expected prefix: lotinverta, lotcpi, or lotagora.`,
          },
        ],
      };
    }

    let lotsMap: Map<string, { lat: number; lng: number }[]>;
    try {
      lotsMap = await getLotsTextForClient(clientId);
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error fetching geometry data: ${err.message}` }],
      };
    }

    const vertices = lotsMap.get(params.lot_name);
    if (!vertices || vertices.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `Lot "${params.lot_name}" not found in geometry data.`,
          },
        ],
      };
    }

    // Calculate side lengths
    const sides: { from: number; to: number; length_m: number }[] = [];
    let perimeter = 0;
    for (let i = 0; i < vertices.length; i++) {
      const next = (i + 1) % vertices.length;
      const len = haversineMeters(
        vertices[i].lat,
        vertices[i].lng,
        vertices[next].lat,
        vertices[next].lng
      );
      sides.push({
        from: i + 1,
        to: next + 1,
        length_m: Math.round(len * 100) / 100,
      });
      perimeter += len;
    }

    // Calculate area and centroid
    const area = polygonAreaM2(vertices);
    const centroid = {
      lat:
        Math.round(
          (vertices.reduce((s, v) => s + v.lat, 0) / vertices.length) * 1e6
        ) / 1e6,
      lng:
        Math.round(
          (vertices.reduce((s, v) => s + v.lng, 0) / vertices.length) * 1e6
        ) / 1e6,
    };

    const result = {
      lot_name: params.lot_name,
      client: clientId,
      vertex_count: vertices.length,
      vertices: vertices.map((v, i) => ({
        index: i + 1,
        lat: v.lat,
        lng: v.lng,
      })),
      sides: sides,
      perimeter_m: Math.round(perimeter * 100) / 100,
      calculated_area_m2: Math.round(area * 100) / 100,
      centroid,
      view_on_map: `https://la-la.land/${clientId}/index.html?lot=${params.lot_name}`,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── Street view / 360 imagery helpers ──────────────────────────────

// Community → framesBase URL mapping (from client-config.js files)
const FRAMES_BASE: Record<string, string> = {
  // inverta communities
  barcelona: "https://andresmtzc.github.io/barcelona/frames/",
  marsella: "https://andresmtzc.github.io/marsella/frames/",
  sierraalta: "https://andresmtzc.github.io/sierraalta/frames/",
  sierrabaja: "https://andresmtzc.github.io/geepeeX/sierrabaja/frames/",
  cortezia: "https://andresmtzc.github.io/geepeeX/cortezia/frames/",
  ebano: "https://andresmtzc.github.io/geepeeX/ebano/frames/",
  verdalia: "https://andresmtzc.github.io/geepeeX/verdalia/frames/",
  frondia: "https://andresmtzc.github.io/geepeeX/frondia/frames/",
  almaterra: "https://andresmtzc.github.io/geepeeX/almaterra/frames/",
  // cpi
  senterra: "https://andresmtzc.github.io/geepeeX/senterra/frames/",
  // agora
  "amani-pietra": "https://andresmtzc.github.io/geepeeX/pietra/frames/",
  "amani-aqua": "https://andresmtzc.github.io/aqua/frames/",
  "cañadas-vergel": "https://andresmtzc.github.io/geepeeX/canadas/frames/",
};

interface StreetViewFrame {
  lat: number;
  lng: number;
  imageUrl: string;
  gpxFile: string;
  frameIndex: number;
}

// Cache for parsed street view frames (framesBase → frames[])
const streetViewCache = new Map<
  string,
  { data: StreetViewFrame[]; fetchedAt: number }
>();

async function getStreetViewFrames(
  framesBase: string
): Promise<StreetViewFrame[]> {
  const cached = streetViewCache.get(framesBase);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.data;

  // 1. Fetch index.json to discover GPX files
  const indexResp = await fetch(framesBase + "index.json");
  if (!indexResp.ok) return [];
  const manifest = await indexResp.json();

  const gpxFiles: string[] =
    manifest.gpxFiles?.length > 0
      ? manifest.gpxFiles
      : (manifest.files || []).filter((f: string) =>
          f.toLowerCase().endsWith(".gpx")
        );

  const allFrames: StreetViewFrame[] = [];

  // 2. Fetch each GPX and parse trackpoints
  for (const gpxFile of gpxFiles) {
    try {
      const gpxUrl = gpxFile.startsWith("http")
        ? gpxFile
        : framesBase + gpxFile;
      const gpxResp = await fetch(gpxUrl);
      if (!gpxResp.ok) continue;
      const gpxText = await gpxResp.text();

      // Parse trackpoints from GPX XML
      const gpxName = gpxFile.replace(/\.gpx$/i, "").split("/").pop() || "";
      const trkptRegex =
        /<trkpt\s+lat="([-\d.]+)"\s+lon="([-\d.]+)"/g;
      let match: RegExpExecArray | null;
      let idx = 1;
      while ((match = trkptRegex.exec(gpxText)) !== null) {
        allFrames.push({
          lat: parseFloat(match[1]),
          lng: parseFloat(match[2]),
          imageUrl: `${framesBase}${gpxName}-${idx}.jpg`,
          gpxFile: gpxName,
          frameIndex: idx,
        });
        idx++;
      }
    } catch {
      // Skip failing GPX files
    }
  }

  streetViewCache.set(framesBase, { data: allFrames, fetchedAt: Date.now() });
  return allFrames;
}

// ── Tool: get_nearby_streetview ────────────────────────────────────
server.tool(
  "get_nearby_streetview",
  "Find the closest 360° street view images near a lot or geographic point. " +
    "Returns image URLs and distances. Use this to show what a lot or area looks like.",
  {
    lot_name: z
      .string()
      .optional()
      .describe(
        "Lot identifier — will use its centroid as the search point. " +
          "Either lot_name or lat+lng must be provided."
      ),
    lat: z.number().optional().describe("Latitude of the search point"),
    lng: z.number().optional().describe("Longitude of the search point"),
    community: z
      .string()
      .optional()
      .describe(
        "Community name to search in (e.g. 'barcelona', 'senterra'). " +
          "Required if using lat/lng instead of lot_name."
      ),
    max_results: z
      .number()
      .optional()
      .default(3)
      .describe("Number of nearest frames to return (default 3, max 10)"),
  },
  async (params) => {
    let searchLat: number;
    let searchLng: number;
    let communityId: string | undefined = params.community?.toLowerCase();

    // Resolve lot_name to centroid + community
    if (params.lot_name) {
      const clientId = clientForLotName(params.lot_name);
      if (!clientId) {
        return {
          content: [
            { type: "text", text: `Unknown lot prefix: "${params.lot_name}"` },
          ],
        };
      }

      // Get centroid from lots.txt
      const lotsMap = await getLotsTextForClient(clientId);
      const vertices = lotsMap.get(params.lot_name);
      if (!vertices || vertices.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `Lot "${params.lot_name}" not found in geometry data.`,
            },
          ],
        };
      }
      searchLat =
        vertices.reduce((s, v) => s + v.lat, 0) / vertices.length;
      searchLng =
        vertices.reduce((s, v) => s + v.lng, 0) / vertices.length;

      // Get community from DB if not provided
      if (!communityId) {
        try {
          const sb = getSupabase();
          const { data: lotRow } = await sb
            .from("lots")
            .select("fraccionamiento")
            .eq("lot_name", params.lot_name)
            .maybeSingle();
          if (lotRow?.fraccionamiento) {
            communityId = lotRow.fraccionamiento.toLowerCase();
          }
        } catch { /* will fail gracefully below */ }
      }
    } else if (params.lat != null && params.lng != null) {
      searchLat = params.lat;
      searchLng = params.lng;
    } else {
      return {
        content: [
          {
            type: "text",
            text: "Provide either lot_name or both lat and lng.",
          },
        ],
      };
    }

    if (!communityId) {
      return {
        content: [
          {
            type: "text",
            text: "Could not determine community. Provide the 'community' parameter.",
          },
        ],
      };
    }

    const framesBase = FRAMES_BASE[communityId];
    if (!framesBase) {
      return {
        content: [
          {
            type: "text",
            text: `No street view data available for community "${communityId}". ` +
              `Available: ${Object.keys(FRAMES_BASE).join(", ")}`,
          },
        ],
      };
    }

    let frames: StreetViewFrame[];
    try {
      frames = await getStreetViewFrames(framesBase);
    } catch (err: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching street view data: ${err.message}`,
          },
        ],
      };
    }

    if (frames.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No street view frames found for "${communityId}".`,
          },
        ],
      };
    }

    // Find nearest frames by haversine distance
    const withDistance = frames.map((f) => ({
      ...f,
      distance_m: haversineMeters(searchLat, searchLng, f.lat, f.lng),
    }));
    withDistance.sort((a, b) => a.distance_m - b.distance_m);

    const cap = Math.min(params.max_results ?? 3, 10);
    const nearest = withDistance.slice(0, cap);

    const result = {
      search_point: {
        lat: Math.round(searchLat * 1e6) / 1e6,
        lng: Math.round(searchLng * 1e6) / 1e6,
      },
      community: communityId,
      nearest_frames: nearest.map((f) => ({
        image_url: f.imageUrl,
        lat: f.lat,
        lng: f.lng,
        distance_m: Math.round(f.distance_m * 10) / 10,
        gpx_track: f.gpxFile,
        frame_index: f.frameIndex,
      })),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── Start ──────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("La-La Land MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
