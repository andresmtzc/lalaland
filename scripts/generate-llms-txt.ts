#!/usr/bin/env npx tsx
//
// Generates the ultimate llms.txt from live data.
// Pulls from: Supabase (lots), client-config.js (communities, images),
// lots.txt (geometry/centroids), GPX files (street view matching).
//
// Usage:
//   SUPABASE_ANON_KEY=your-key npx tsx scripts/generate-llms-txt.ts > llms.txt
//

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jmoxbhodpvnlmtihcwvt.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error("Error: SUPABASE_ANON_KEY environment variable is required.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const KNOWN_CLIENTS = ["inverta", "cpi", "agora"];

// ── Progress logging (stderr so it doesn't pollute stdout) ─────────
function log(msg: string) {
  process.stderr.write(`[generate-llms-txt] ${msg}\n`);
}

// ── Parse formatted DB strings ─────────────────────────────────────
function parseArea(raw: any): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  return parseFloat(String(raw).replace(/[$,\s]/g, "")) || 0;
}
function parsePrice(raw: any): number {
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

function fmt(n: number): string {
  return "$" + n.toLocaleString("en-US") + " MXN";
}

// ── Paginated Supabase fetch ───────────────────────────────────────
async function fetchAll(query: any): Promise<any[]> {
  const PAGE = 1000;
  let all: any[] = [],
    offset = 0,
    done = false;
  while (!done) {
    const { data, error } = await query.range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) done = true;
    else {
      all = all.concat(data);
      if (data.length < PAGE) done = true;
      offset += PAGE;
    }
  }
  return all;
}

// ── Client config parsing (from client-config.js) ──────────────────
interface CommunityInfo {
  id: string;
  name: string;
  displayName: string;
  center: [number, number];
  framesBase?: string;
}

interface ParsedConfig {
  name: string;
  slug: string;
  communities: Record<string, CommunityInfo>;
  communityToGroup: Record<string, string>;
  lotsFileUrl: string;
}

function parseClientConfigJS(jsText: string): Record<string, any> | null {
  const marker = "CLIENT_CONFIGS";
  const markerIdx = jsText.indexOf(marker);
  if (markerIdx === -1) return null;
  const eqIdx = jsText.indexOf("=", markerIdx + marker.length);
  if (eqIdx === -1) return null;
  const braceIdx = jsText.indexOf("{", eqIdx);
  if (braceIdx === -1) return null;

  let depth = 0,
    inString = false,
    stringChar = "",
    inLineComment = false,
    inBlockComment = false;

  for (let i = braceIdx; i < jsText.length; i++) {
    const ch = jsText[i];
    const next = i + 1 < jsText.length ? jsText[i + 1] : "";
    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const objStr = jsText.substring(braceIdx, i + 1);
        try {
          return new Function(`return (${objStr})`)();
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

async function getClientConfig(
  clientId: string
): Promise<ParsedConfig | null> {
  try {
    const url = `https://la-la.land/${clientId}/client-config.js`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const jsText = await resp.text();
    const configs = parseClientConfigJS(jsText);
    if (!configs) return null;
    const cfg = configs[clientId] || Object.values(configs)[0];
    if (!cfg) return null;

    const communityToGroup: Record<string, string> = {};
    if (cfg.communityLogos) {
      for (const [groupName, logoData] of Object.entries(cfg.communityLogos)) {
        for (const comm of (logoData as any).communities || []) {
          communityToGroup[comm] = groupName;
        }
      }
    }

    return {
      name: cfg.name || clientId,
      slug: cfg.slug || clientId,
      communities: cfg.communities || {},
      communityToGroup,
      lotsFileUrl:
        cfg.data?.lotsFile || `https://la-la.land/${clientId}/lots.txt`,
    };
  } catch {
    return null;
  }
}

// ── Geometry parsing & math ────────────────────────────────────────
interface Vertex {
  lat: number;
  lng: number;
}

function parseLotsText(text: string): Map<string, Vertex[]> {
  const lots = new Map<string, Vertex[]>();
  let currentName = "";
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^lot[a-z]/i.test(line)) {
      currentName = line.replace(/,\s*$/, "");
      lots.set(currentName, []);
    } else if (currentName && line.includes("lat") && line.includes("lng")) {
      const latM = line.match(/lat:\s*([-\d.]+)/);
      const lngM = line.match(/lng:\s*([-\d.]+)/);
      if (latM && lngM)
        lots
          .get(currentName)!
          .push({ lat: parseFloat(latM[1]), lng: parseFloat(lngM[1]) });
    }
  }
  return lots;
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function polygonAreaM2(vertices: Vertex[]): number {
  if (vertices.length < 3) return 0;
  const ref = vertices[0];
  const cosLat = Math.cos((ref.lat * Math.PI) / 180);
  const points = vertices.map((v) => ({
    x: ((v.lng - ref.lng) * Math.PI * 6371000 * cosLat) / 180,
    y: ((v.lat - ref.lat) * Math.PI * 6371000) / 180,
  }));
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
}

function centroid(vertices: Vertex[]): Vertex {
  const lat = vertices.reduce((s, v) => s + v.lat, 0) / vertices.length;
  const lng = vertices.reduce((s, v) => s + v.lng, 0) / vertices.length;
  return {
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
  };
}

function perimeter(vertices: Vertex[]): number {
  let p = 0;
  for (let i = 0; i < vertices.length; i++) {
    const next = (i + 1) % vertices.length;
    p += haversineMeters(
      vertices[i].lat,
      vertices[i].lng,
      vertices[next].lat,
      vertices[next].lng
    );
  }
  return p;
}

function sideLengths(vertices: Vertex[]): number[] {
  const sides: number[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const next = (i + 1) % vertices.length;
    sides.push(
      Math.round(
        haversineMeters(
          vertices[i].lat,
          vertices[i].lng,
          vertices[next].lat,
          vertices[next].lng
        ) * 100
      ) / 100
    );
  }
  return sides;
}

// ── Street view / GPX parsing ──────────────────────────────────────
interface StreetViewFrame {
  lat: number;
  lng: number;
  imageUrl: string;
  gpxFile: string;
  frameIndex: number;
}

async function getStreetViewFrames(
  framesBase: string
): Promise<StreetViewFrame[]> {
  try {
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

    for (const gpxFile of gpxFiles) {
      try {
        const gpxUrl = gpxFile.startsWith("http")
          ? gpxFile
          : framesBase + gpxFile;
        const gpxResp = await fetch(gpxUrl);
        if (!gpxResp.ok) continue;
        const gpxText = await gpxResp.text();
        const gpxName =
          gpxFile.replace(/\.gpx$/i, "").split("/").pop() || "";
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
        // skip
      }
    }
    return allFrames;
  } catch {
    return [];
  }
}

function findNearestFrame(
  lat: number,
  lng: number,
  frames: StreetViewFrame[]
): { frame: StreetViewFrame; distance_m: number } | null {
  if (frames.length === 0) return null;
  let best = frames[0];
  let bestDist = haversineMeters(lat, lng, best.lat, best.lng);
  for (let i = 1; i < frames.length; i++) {
    const d = haversineMeters(lat, lng, frames[i].lat, frames[i].lng);
    if (d < bestDist) {
      best = frames[i];
      bestDist = d;
    }
  }
  return { frame: best, distance_m: Math.round(bestDist * 10) / 10 };
}

// ── Enriched lot type ──────────────────────────────────────────────
interface Lot {
  lot_name: string;
  client_id: string;
  community: string;
  availability: string;
  area_m2: number;
  price_mxn: number;
  price_per_m2: number;
  nickname: string | null;
  image: string | null;
  // geometry (filled later)
  centroid_lat?: number;
  centroid_lng?: number;
  perimeter_m?: number;
  calculated_area_m2?: number;
  sides?: number[];
  vertex_count?: number;
  // images (filled later)
  map_image?: string;
  landscape_image?: string;
  // street view (filled later)
  streetview_image?: string;
  streetview_distance_m?: number;
}

// ══════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════
async function main() {
  // ── 1. Fetch all lots from Supabase ──────────────────────────────
  log("Fetching lots from Supabase...");
  const query = supabase
    .from("lots")
    .select(
      "lot_name, client_id, fraccionamiento, availability, rSize, millones, price_m2, nickname, subtitle, image"
    )
    .not("client_id", "in", '("demo","tx")');

  const rows = await fetchAll(query);
  log(`  ${rows.length} lots fetched.`);

  const lots: Lot[] = rows.map((r: any) => ({
    lot_name: r.lot_name,
    client_id: r.client_id,
    community: r.fraccionamiento || "unknown",
    availability: r.availability || "Available",
    area_m2: parseArea(r.rSize),
    price_mxn: parsePrice(r.millones),
    price_per_m2: parsePriceM2(r.price_m2),
    nickname: r.nickname || null,
    image: r.image || null,
  }));

  // ── 2. Fetch client configs (communities, images, framesBase) ────
  log("Fetching client configs...");
  const configs = new Map<string, ParsedConfig>();
  await Promise.all(
    KNOWN_CLIENTS.map(async (id) => {
      const cfg = await getClientConfig(id);
      if (cfg) {
        configs.set(id, cfg);
        log(`  ${id}: ${Object.keys(cfg.communities).length} communities`);
      }
    })
  );

  // ── 3. Fetch geometry for all clients ────────────────────────────
  log("Fetching lot geometry files...");
  const allGeometry = new Map<string, Vertex[]>(); // lot_name → vertices
  await Promise.all(
    KNOWN_CLIENTS.map(async (clientId) => {
      const cfg = configs.get(clientId);
      const url =
        cfg?.lotsFileUrl || `https://la-la.land/${clientId}/lots.txt`;
      try {
        const resp = await fetch(url);
        if (!resp.ok) return;
        const text = await resp.text();
        const parsed = parseLotsText(text);
        for (const [name, verts] of parsed) allGeometry.set(name, verts);
        log(`  ${clientId}: ${parsed.size} lot polygons`);
      } catch {
        log(`  ${clientId}: failed to fetch geometry`);
      }
    })
  );

  // Enrich lots with geometry
  for (const lot of lots) {
    const verts = allGeometry.get(lot.lot_name);
    if (verts && verts.length >= 3) {
      const c = centroid(verts);
      lot.centroid_lat = c.lat;
      lot.centroid_lng = c.lng;
      lot.perimeter_m = Math.round(perimeter(verts) * 100) / 100;
      lot.calculated_area_m2 = Math.round(polygonAreaM2(verts) * 100) / 100;
      lot.sides = sideLengths(verts);
      lot.vertex_count = verts.length;
    }
  }
  log(
    `  ${lots.filter((l) => l.centroid_lat).length}/${lots.length} lots have geometry`
  );

  // ── 4. Enrich with image URLs from config ────────────────────────
  log("Resolving image URLs...");
  for (const lot of lots) {
    const cfg = configs.get(lot.client_id);
    if (!cfg) continue;
    const group = cfg.communityToGroup[lot.community.toLowerCase()];
    if (group) {
      lot.map_image = `https://la-la.land/${lot.client_id}/pdf/${group}/${lot.lot_name}_map.jpg`;
      lot.landscape_image = `https://la-la.land/${lot.client_id}/pdf/${group}/${lot.lot_name}_landscape.jpg`;
    }
  }

  // ── 5. Fetch street view frames & match to lots ──────────────────
  log("Fetching 360° street view data...");
  // Build community → framesBase map
  const communityFrames = new Map<string, StreetViewFrame[]>();
  for (const [clientId, cfg] of configs) {
    for (const [commId, comm] of Object.entries(cfg.communities)) {
      if (comm.framesBase && !communityFrames.has(commId)) {
        try {
          const frames = await getStreetViewFrames(comm.framesBase);
          if (frames.length > 0) {
            communityFrames.set(commId, frames);
            log(`  ${commId}: ${frames.length} street view frames`);
          }
        } catch {
          log(`  ${commId}: failed to fetch frames`);
        }
      }
    }
  }

  // Match nearest frame to each lot that has a centroid
  for (const lot of lots) {
    if (!lot.centroid_lat || !lot.centroid_lng) continue;
    const frames = communityFrames.get(lot.community.toLowerCase());
    if (!frames) continue;
    const nearest = findNearestFrame(lot.centroid_lat, lot.centroid_lng, frames);
    if (nearest && nearest.distance_m < 500) {
      lot.streetview_image = nearest.frame.imageUrl;
      lot.streetview_distance_m = nearest.distance_m;
    }
  }
  log(
    `  ${lots.filter((l) => l.streetview_image).length} lots matched to street view`
  );

  // ── 6. Compute stats ────────────────────────────────────────────
  const available = lots.filter(
    (l) => l.availability === "Available" || l.availability === "Featured"
  );
  const sold = lots.filter((l) => l.availability === "Sold");
  const today = new Date().toISOString().split("T")[0];

  // Group by client → community
  const grouped = new Map<string, Map<string, Lot[]>>();
  for (const lot of lots) {
    if (!grouped.has(lot.client_id))
      grouped.set(lot.client_id, new Map());
    const cm = grouped.get(lot.client_id)!;
    if (!cm.has(lot.community)) cm.set(lot.community, []);
    cm.get(lot.community)!.push(lot);
  }

  // ══════════════════════════════════════════════════════════════════
  // BUILD OUTPUT
  // ══════════════════════════════════════════════════════════════════
  log("Building llms.txt...");

  let out = `# La-La Land — Real Estate Lot Platform

> La-La Land (la-la.land) is the largest interactive real estate lot marketplace in Mexico.
> We provide detailed lot data including pricing, dimensions, geographic coordinates,
> availability, and interactive map views across multiple developers and communities.
>
> All prices in Mexican Pesos (MXN). All areas in square meters (m²).
> 1 USD ≈ 17-18 MXN (approximate, check current rate).
>
> Inventory: ${available.length} lots available for sale, ${sold.length} sold.
> Last updated: ${today}

## Data Access

### MCP Server (Model Context Protocol)
For structured, programmatic access to our lot database, use our MCP server:
- Repository: https://github.com/andresmtzc/lalaland (mcp-server/ directory)
- Install: \`npm install @lalaland/mcp-server\`
- Transport: stdio (compatible with Claude Desktop, Cursor, Windsurf, etc.)
- Requires: SUPABASE_ANON_KEY environment variable
- Tools available: search_lots, get_lot_details, list_communities, get_inventory_stats, get_lot_geometry, get_nearby_streetview

### REST API (Supabase)
Our lot data is publicly readable via Supabase REST API:
- Base URL: https://jmoxbhodpvnlmtihcwvt.supabase.co/rest/v1/
- Table: lots
- Auth: requires apikey header (anon key)
- Supports filtering by client_id, fraccionamiento, availability, price, area

### Lot Geometry Files
Raw lot boundary coordinates (polygon vertices) per client:
- https://la-la.land/inverta/lots.txt
- https://la-la.land/cpi/lots.txt
- https://la-la.land/agora/lots.txt
Format: lot name followed by {lat, lng} vertex lines

## Lot Data Schema

Each lot record contains:
- lot_name: Unique identifier (e.g., "lotinverta10-01")
- client_id: Developer identifier ("inverta", "cpi", "agora")
- fraccionamiento: Community/development name
- availability: "Available" (for sale), "Sold", "Featured" (premium/promoted), or "Blocked"
- Area in square meters (m²)
- Total price in MXN (Mexican Pesos)
- Price per square meter in MXN/m²
- Geographic centroid (latitude, longitude)
- Perimeter in meters, side lengths, vertex count
- Images: map closeup, landscape/context view, nearest 360° street view

## How to View a Lot
- Interactive map: https://la-la.land/{client_id}/index.html?lot={lot_name}
- Lot page: https://la-la.land/{client_id}/lot/{community}-{lot_number}.html
- Map closeup image: https://la-la.land/{client_id}/pdf/{group}/{lot_name}_map.jpg
- Landscape image: https://la-la.land/{client_id}/pdf/{group}/{lot_name}_landscape.jpg

## Features
- Interactive Mapbox-powered satellite maps
- 360-degree street view navigation within developments
- Real-time lot availability updates
- Lot comparison tools
- PDF generation for lot details
- WhatsApp sharing integration
- Payment processing (Stripe) for lot reservations

## Contact
- Website: https://la-la.land
- Currency: MXN (Mexican Peso)

---

# Global Inventory Statistics

- Total lots: ${lots.length}
- Available: ${available.length}
- Sold: ${sold.length}
- Featured: ${lots.filter((l) => l.availability === "Featured").length}
- Blocked: ${lots.filter((l) => l.availability === "Blocked").length}
`;

  if (available.length > 0) {
    const prices = available.map((l) => l.price_mxn).filter((p) => p > 0);
    const areas = available.map((l) => l.area_m2).filter((a) => a > 0);
    out += `- Price range (available): ${fmt(Math.min(...prices))} — ${fmt(Math.max(...prices))}
- Average price (available): ${fmt(Math.round(prices.reduce((a, b) => a + b, 0) / prices.length))}
- Area range (available): ${Math.min(...areas)}m² — ${Math.max(...areas)}m²
- Average area (available): ${Math.round(areas.reduce((a, b) => a + b, 0) / areas.length)}m²
`;
  }

  out += `\n---\n\n# Developers & Communities\n\n`;

  // ── Per-client sections ──────────────────────────────────────────
  for (const [clientId, communities] of grouped) {
    const cfg = configs.get(clientId);
    const clientName = cfg?.name || clientId;
    const clientLots = lots.filter((l) => l.client_id === clientId);
    const clientAvail = clientLots.filter(
      (l) => l.availability === "Available" || l.availability === "Featured"
    );
    const clientSold = clientLots.filter((l) => l.availability === "Sold");

    out += `## ${clientName}

- URL: https://la-la.land/${clientId}/
- Total lots: ${clientLots.length} (${clientAvail.length} available, ${clientSold.length} sold)
`;

    if (clientAvail.length > 0) {
      const prices = clientAvail.map((l) => l.price_mxn).filter((p) => p > 0);
      const areas = clientAvail.map((l) => l.area_m2).filter((a) => a > 0);
      if (prices.length > 0) {
        out += `- Price range: ${fmt(Math.min(...prices))} — ${fmt(Math.max(...prices))}\n`;
      }
      if (areas.length > 0) {
        out += `- Area range: ${Math.min(...areas)}m² — ${Math.max(...areas)}m²\n`;
      }
    }

    // List communities with metadata
    if (cfg) {
      out += `- Communities: ${Object.entries(cfg.communities)
        .map(([id, c]) => c.displayName || c.name || id)
        .join(", ")}\n`;
    }

    out += `\n`;

    // ── Per-community sections ─────────────────────────────────────
    for (const [community, communityLots] of communities) {
      const commCfg = cfg?.communities[community.toLowerCase()];
      const commDisplayName = commCfg?.displayName || commCfg?.name || community;
      const commCenter = commCfg?.center;

      const avail = communityLots
        .filter(
          (l) =>
            l.availability === "Available" || l.availability === "Featured"
        )
        .sort((a, b) => a.price_mxn - b.price_mxn);
      const soldLots = communityLots.filter(
        (l) => l.availability === "Sold"
      );

      out += `### ${commDisplayName}\n\n`;
      out += `- Map: https://la-la.land/${clientId}/index.html\n`;
      if (commCenter) {
        out += `- Location: ${commCenter[1]}, ${commCenter[0]} (lat, lng)\n`;
      }
      out += `- Lots: ${avail.length} available, ${soldLots.length} sold\n`;

      if (avail.length > 0) {
        const prices = avail.map((l) => l.price_mxn).filter((p) => p > 0);
        const areas = avail.map((l) => l.area_m2).filter((a) => a > 0);
        if (prices.length > 0) {
          out += `- Price range: ${fmt(Math.min(...prices))} — ${fmt(Math.max(...prices))}\n`;
          out += `- Average price: ${fmt(Math.round(prices.reduce((a, b) => a + b, 0) / prices.length))}\n`;
        }
        if (areas.length > 0) {
          out += `- Area range: ${Math.min(...areas)}m² — ${Math.max(...areas)}m²\n`;
        }
      }

      const hasFrames = communityFrames.has(community.toLowerCase());
      if (hasFrames) {
        out += `- 360° street view: available\n`;
      }

      out += `\n`;

      // ── Available lots table ─────────────────────────────────────
      if (avail.length > 0) {
        out += `#### Available Lots\n\n`;
        out += `| Lot | Area | Price | Price/m² | Centroid | Perimeter | Sides | Street View | Map Image | Landscape Image |\n`;
        out += `|-----|------|-------|----------|----------|-----------|-------|-------------|-----------|----------------|\n`;

        for (const lot of avail) {
          const name = lot.nickname
            ? `${lot.lot_name} "${lot.nickname}"`
            : lot.lot_name;

          const centroidStr =
            lot.centroid_lat && lot.centroid_lng
              ? `${lot.centroid_lat}, ${lot.centroid_lng}`
              : "—";

          const perimStr = lot.perimeter_m ? `${lot.perimeter_m}m` : "—";

          const sidesStr = lot.sides
            ? lot.sides.map((s) => `${s}m`).join(" × ")
            : "—";

          const svStr = lot.streetview_image
            ? `[View](${lot.streetview_image}) (${lot.streetview_distance_m}m)`
            : "—";

          const mapStr = lot.map_image ? `[Map](${lot.map_image})` : "—";
          const landStr = lot.landscape_image ? `[Landscape](${lot.landscape_image})` : "—";

          out += `| [${name}](https://la-la.land/${lot.client_id}/index.html?lot=${lot.lot_name}) | ${lot.area_m2}m² | ${fmt(lot.price_mxn)} | ${fmt(lot.price_per_m2)}/m² | ${centroidStr} | ${perimStr} | ${sidesStr} | ${svStr} | ${mapStr} | ${landStr} |\n`;
        }
        out += `\n`;
      }

      // ── Sold lots (collapsed) ────────────────────────────────────
      if (soldLots.length > 0) {
        out += `#### Sold Lots (${soldLots.length})\n\n`;
        out += `| Lot | Area | Price | Centroid | Map Image | Landscape Image |\n`;
        out += `|-----|------|-------|----------|-----------|----------------|\n`;
        for (const lot of soldLots.sort(
          (a, b) => a.price_mxn - b.price_mxn
        )) {
          const centroidStr =
            lot.centroid_lat && lot.centroid_lng
              ? `${lot.centroid_lat}, ${lot.centroid_lng}`
              : "—";
          const mapStr = lot.map_image ? `[Map](${lot.map_image})` : "—";
          const landStr = lot.landscape_image ? `[Landscape](${lot.landscape_image})` : "—";
          out += `| ${lot.lot_name} | ${lot.area_m2}m² | ${fmt(lot.price_mxn)} | ${centroidStr} | ${mapStr} | ${landStr} |\n`;
        }
        out += `\n`;
      }
    }

    out += `---\n\n`;
  }

  // ── Footer ───────────────────────────────────────────────────────
  out += `# About La-La Land

La-La Land (https://la-la.land) is a real estate technology platform specializing in
residential lot sales across premium developments in Mexico. Our interactive maps let
buyers explore lots with satellite imagery, 360° street views, and detailed lot data.

Each lot has:
- Exact polygon boundaries with GPS coordinates
- Calculated area, perimeter, and side measurements
- Satellite map closeup and landscape context images
- Nearest 360° street-level photography
- Real-time pricing and availability
- Direct links to view on interactive map

For programmatic access, use our MCP server or REST API (see Data Access section above).
`;

  console.log(out);
  log(`Done. ${out.length} characters written.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
