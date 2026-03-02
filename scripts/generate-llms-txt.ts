#!/usr/bin/env npx tsx
//
// Generates llms.txt from live Supabase lot data.
//
// Usage:
//   SUPABASE_ANON_KEY=your-key npx tsx scripts/generate-llms-txt.ts
//
// Output: writes llms.txt to stdout. Redirect to a file:
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

// ── Paginated fetch ────────────────────────────────────────────────
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

// ── Client metadata ────────────────────────────────────────────────
const CLIENTS: Record<string, { name: string; location: string }> = {
  inverta: { name: "Inverta Desarrollos", location: "Mérida, Yucatán, Mexico" },
  cpi: { name: "CPI Desarrollos", location: "Mérida, Yucatán, Mexico" },
  agora: { name: "Ágora Desarrollos", location: "Mérida, Yucatán, Mexico" },
};

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  const query = supabase
    .from("lots")
    .select(
      "lot_name, client_id, fraccionamiento, availability, rSize, millones, price_m2, nickname, subtitle, image"
    )
    .not("client_id", "in", '("demo","tx")');

  const rows = await fetchAll(query);

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
  }

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

  // Group by client → community
  const grouped = new Map<string, Map<string, Lot[]>>();
  for (const lot of lots) {
    if (!grouped.has(lot.client_id)) grouped.set(lot.client_id, new Map());
    const cm = grouped.get(lot.client_id)!;
    if (!cm.has(lot.community)) cm.set(lot.community, []);
    cm.get(lot.community)!.push(lot);
  }

  const today = new Date().toISOString().split("T")[0];
  const available = lots.filter(
    (l) => l.availability === "Available" || l.availability === "Featured"
  );
  const sold = lots.filter((l) => l.availability === "Sold");

  // ── Build output ─────────────────────────────────────────────────
  let out = `# La-La Land — Real Estate Lot Platform

> La-La Land (la-la.land) is the largest interactive real estate lot marketplace in Mexico.
> We provide detailed lot data including pricing, dimensions, geographic coordinates,
> availability, and interactive map views across multiple developers and communities.
> All prices in Mexican Pesos (MXN). All areas in square meters (m²).
>
> Inventory: ${available.length} lots available, ${sold.length} sold. Updated: ${today}

## Data Access

### MCP Server (Model Context Protocol)
For structured, programmatic access to our lot database, use our MCP server:
- Repository: https://github.com/andresmtzc/lalaland (mcp-server/ directory)
- Install: \`npm install @lalaland/mcp-server\`
- Transport: stdio (compatible with Claude Desktop, Cursor, Windsurf, etc.)
- Requires: SUPABASE_ANON_KEY environment variable

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
- availability: "Available", "Sold", "Featured", or "Blocked"
- rSize: Area in square meters (m²)
- millones: Total price in MXN (Mexican Pesos)
- price_m2: Price per square meter in MXN
- nickname: Optional display name
- image: Optional image URL

## Individual Lot Pages
Each lot has a shareable page with Open Graph metadata:
- Pattern: https://la-la.land/{client}/lot/{community}-{lot_number}.html
- Example: https://la-la.land/inverta/lot/barcelona-24-21.html

## Features
- Interactive Mapbox-powered satellite maps
- 360-degree street view navigation
- Real-time lot availability updates
- Lot comparison tools
- PDF generation for lot details
- WhatsApp sharing integration

## Contact
- Website: https://la-la.land
- Currency: MXN (Mexican Peso)

---

# Full Lot Inventory

`;

  for (const [clientId, communities] of grouped) {
    const meta = CLIENTS[clientId] || { name: clientId, location: "Mexico" };
    const clientLots = lots.filter((l) => l.client_id === clientId);
    const clientAvail = clientLots.filter(
      (l) => l.availability === "Available" || l.availability === "Featured"
    );

    out += `## ${meta.name}\n`;
    out += `- Location: ${meta.location}\n`;
    out += `- URL: https://la-la.land/${clientId}/\n`;
    out += `- Total lots: ${clientLots.length} (${clientAvail.length} available)\n\n`;

    for (const [community, communityLots] of communities) {
      const avail = communityLots
        .filter(
          (l) => l.availability === "Available" || l.availability === "Featured"
        )
        .sort((a, b) => a.price_mxn - b.price_mxn);

      const soldLots = communityLots.filter(
        (l) => l.availability === "Sold"
      );

      out += `### ${community}\n`;
      out += `Map: https://la-la.land/${clientId}/index.html\n`;
      out += `${avail.length} available, ${soldLots.length} sold\n\n`;

      if (avail.length > 0) {
        const minP = avail[0].price_mxn;
        const maxP = avail[avail.length - 1].price_mxn;
        const minA = Math.min(...avail.map((l) => l.area_m2));
        const maxA = Math.max(...avail.map((l) => l.area_m2));
        out += `Price range: ${fmt(minP)} — ${fmt(maxP)}\n`;
        out += `Area range: ${minA}m² — ${maxA}m²\n\n`;

        out += `| Lot | Area | Price | Price/m² | Status |\n`;
        out += `|-----|------|-------|----------|--------|\n`;

        for (const lot of avail) {
          const name = lot.nickname
            ? `${lot.lot_name} "${lot.nickname}"`
            : lot.lot_name;
          out += `| [${name}](https://la-la.land/${clientId}/index.html?lot=${lot.lot_name}) | ${lot.area_m2}m² | ${fmt(lot.price_mxn)} | ${fmt(lot.price_per_m2)}/m² | ${lot.availability} |\n`;
        }
        out += `\n`;
      }

      if (soldLots.length > 0) {
        out += `<details>\n<summary>${soldLots.length} sold lots</summary>\n\n`;
        out += `| Lot | Area | Price | Status |\n`;
        out += `|-----|------|-------|--------|\n`;
        for (const lot of soldLots.sort((a, b) => a.price_mxn - b.price_mxn)) {
          out += `| ${lot.lot_name} | ${lot.area_m2}m² | ${fmt(lot.price_mxn)} | Sold |\n`;
        }
        out += `\n</details>\n\n`;
      }
    }

    out += `---\n\n`;
  }

  console.log(out);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
