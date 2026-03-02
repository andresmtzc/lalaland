// Supabase Edge Function: llms-txt
// Dynamically generates /llms.txt from live lot data in the database.
// Every request returns the current inventory — no manual updates needed.
//
// Endpoints:
//   GET /llms-txt          → concise index (llms.txt format)
//   GET /llms-txt?full=true → full inventory with every lot listed
//
// Deploy with: supabase functions deploy llms-txt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'public, max-age=3600', // crawlers can cache for 1 hour
}

// ── Parse formatted DB strings into numbers ────────────────────────
function parseArea(raw: any): number {
  if (typeof raw === 'number') return raw
  if (!raw) return 0
  return parseFloat(String(raw).replace(/[$,\s]/g, '')) || 0
}
function parsePrice(raw: any): number {
  if (typeof raw === 'number') return raw
  if (!raw) return 0
  const num = parseFloat(String(raw).replace(/[$,\s]/g, '')) || 0
  return Math.round(num * 1_000_000)
}
function parsePriceM2(raw: any): number {
  if (typeof raw === 'number') return raw
  if (!raw) return 0
  return parseFloat(String(raw).replace(/[$,\s]/g, '')) || 0
}

function formatMXN(n: number): string {
  return '$' + n.toLocaleString('en-US') + ' MXN'
}

// ── Paginated Supabase fetch ───────────────────────────────────────
async function fetchAll(query: any): Promise<any[]> {
  const PAGE = 1000
  let all: any[] = [], offset = 0, done = false
  while (!done) {
    const { data, error } = await query.range(offset, offset + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) { done = true } else {
      all = all.concat(data)
      if (data.length < PAGE) done = true
      offset += PAGE
    }
  }
  return all
}

// ── Group lots by client → community ───────────────────────────────
interface Lot {
  lot_name: string
  client_id: string
  community: string
  availability: string
  area_m2: number
  price_mxn: number
  price_per_m2: number
  nickname: string | null
  subtitle: string | null
  image: string | null
}

function groupLots(lots: Lot[]): Map<string, Map<string, Lot[]>> {
  const grouped = new Map<string, Map<string, Lot[]>>()
  for (const lot of lots) {
    if (!grouped.has(lot.client_id)) grouped.set(lot.client_id, new Map())
    const clientMap = grouped.get(lot.client_id)!
    if (!clientMap.has(lot.community)) clientMap.set(lot.community, [])
    clientMap.get(lot.community)!.push(lot)
  }
  return grouped
}

// ── Client display names ───────────────────────────────────────────
const CLIENT_NAMES: Record<string, string> = {
  inverta: 'Inverta Desarrollos',
  cpi: 'CPI Desarrollos',
  agora: 'Ágora Desarrollos',
}

// ── Build the llms.txt (concise index) ─────────────────────────────
function buildIndex(lots: Lot[]): string {
  const available = lots.filter(l => l.availability === 'Available' || l.availability === 'Featured')
  const grouped = groupLots(available)

  const today = new Date().toISOString().split('T')[0]

  let out = `# La-La Land — Terrenos Residenciales en Mérida, Yucatán, México

> La-La Land is a real estate platform selling residential lots (terrenos) across
> premium developments (fraccionamientos) in and around Mérida, Yucatán, Mexico.
> All lots are for building homes. Prices are in Mexican Pesos (MXN).
> This data is generated live from the database and reflects current availability.
> Last generated: ${today}

## How to interpret this data

- **Prices** are in Mexican Pesos (MXN). Example: $485,000 MXN ≈ $27,000 USD (approximate).
- **Area** is in square meters (m²). Typical residential lots range from 150m² to 500m².
- **Price per m²** tells you the cost efficiency of a lot.
- **Availability**: "Available" = for sale now, "Featured" = premium/promoted lot for sale.
- Each lot has a unique ID like "lotinverta10-01" that can be used to view it on an interactive map.
- To view any lot on the map: https://la-la.land/{client_id}/index.html?lot={lot_name}
- To see lot images: https://la-la.land/{client_id}/pdf/{community}/{lot_name}_map.jpg
- For full lot details via API: https://jmoxbhodpvnlmtihcwvt.supabase.co/functions/v1/lot-data?lot_name={lot_name}

## Inventory Summary

- **Total lots for sale:** ${available.length}
`

  for (const [clientId, communities] of grouped) {
    const clientName = CLIENT_NAMES[clientId] || clientId
    let clientTotal = 0
    for (const [, lotsInComm] of communities) clientTotal += lotsInComm.length

    out += `\n### ${clientName} (${clientTotal} lots available)\n`

    for (const [community, lotsInComm] of communities) {
      const sorted = lotsInComm.sort((a, b) => a.price_mxn - b.price_mxn)
      const minPrice = sorted[0].price_mxn
      const maxPrice = sorted[sorted.length - 1].price_mxn
      const minArea = Math.min(...sorted.map(l => l.area_m2))
      const maxArea = Math.max(...sorted.map(l => l.area_m2))

      out += `\n**${community}** — ${lotsInComm.length} lots available\n`
      out += `- Price range: ${formatMXN(minPrice)} to ${formatMXN(maxPrice)}\n`
      out += `- Area range: ${minArea}m² to ${maxArea}m²\n`
      out += `- View on map: https://la-la.land/${clientId}/index.html\n`
      out += `- Full lot list: https://jmoxbhodpvnlmtihcwvt.supabase.co/functions/v1/llms-txt?full=true&client_id=${clientId}&community=${community}\n`
    }
  }

  return out
}

// ── Build the full listing (every lot) ─────────────────────────────
function buildFull(lots: Lot[], clientFilter?: string, communityFilter?: string): string {
  let filtered = lots
  if (clientFilter) filtered = filtered.filter(l => l.client_id === clientFilter)
  if (communityFilter) filtered = filtered.filter(l => l.community.toLowerCase().includes(communityFilter.toLowerCase()))

  const available = filtered.filter(l => l.availability === 'Available' || l.availability === 'Featured')
  const sold = filtered.filter(l => l.availability === 'Sold')
  const grouped = groupLots(filtered)

  const today = new Date().toISOString().split('T')[0]

  let out = `# La-La Land — Full Lot Inventory

> Complete lot-by-lot listing of all real estate lots in Mérida, Yucatán, Mexico.
> Prices in Mexican Pesos (MXN). Areas in square meters (m²).
> ${available.length} lots available for sale. ${sold.length} lots sold.
> Live data as of: ${today}
`

  for (const [clientId, communities] of grouped) {
    const clientName = CLIENT_NAMES[clientId] || clientId
    out += `\n---\n\n## ${clientName}\n`

    for (const [community, lotsInComm] of communities) {
      out += `\n### ${community}\n\n`

      const byStatus = new Map<string, Lot[]>()
      for (const lot of lotsInComm) {
        const status = lot.availability
        if (!byStatus.has(status)) byStatus.set(status, [])
        byStatus.get(status)!.push(lot)
      }

      // Show available lots first, then sold
      for (const status of ['Available', 'Featured', 'Sold', 'Blocked']) {
        const statusLots = byStatus.get(status)
        if (!statusLots || statusLots.length === 0) continue

        const sorted = statusLots.sort((a, b) => a.price_mxn - b.price_mxn)

        out += `**${status}** (${sorted.length} lots):\n\n`

        for (const lot of sorted) {
          out += `- **${lot.lot_name}**`
          if (lot.nickname) out += ` "${lot.nickname}"`
          out += `: ${lot.area_m2}m², ${formatMXN(lot.price_mxn)}`
          if (lot.price_per_m2 > 0) out += ` (${formatMXN(lot.price_per_m2)}/m²)`
          out += ` — ${lot.availability}`
          out += `\n  Map: https://la-la.land/${clientId}/index.html?lot=${lot.lot_name}`
          if (lot.image) out += `\n  Image: ${lot.image}`
          else out += `\n  Image: https://la-la.land/${clientId}/pdf/${community}/${lot.lot_name}_map.jpg`
          out += '\n'
        }
        out += '\n'
      }
    }
  }

  out += `---

## About La-La Land

La-La Land (https://la-la.land) is a real estate technology platform specializing in
residential lot sales across premium developments in Mérida, Yucatán, Mexico.
Developments are located in fast-growing areas around Mérida including Conkal, Umán,
and surrounding municipalities.

Contact and inquiries can be directed through the interactive map on each development's page.
`

  return out
}

// ── Main handler ───────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const isFull = url.searchParams.get('full') === 'true'
    const clientFilter = url.searchParams.get('client_id') || undefined
    const communityFilter = url.searchParams.get('community') || undefined

    // Fetch all lots (excluding demo/test clients)
    let query = supabase
      .from('lots')
      .select('lot_name, client_id, fraccionamiento, availability, rSize, millones, price_m2, nickname, subtitle, image')
      .not('client_id', 'in', '("demo","tx")')

    const allRows = await fetchAll(query)

    const lots: Lot[] = allRows.map((row: any) => ({
      lot_name: row.lot_name,
      client_id: row.client_id,
      community: row.fraccionamiento || 'unknown',
      availability: row.availability || 'Available',
      area_m2: parseArea(row.rSize),
      price_mxn: parsePrice(row.millones),
      price_per_m2: parsePriceM2(row.price_m2),
      nickname: row.nickname || null,
      subtitle: row.subtitle || null,
      image: row.image || null,
    }))

    const body = isFull
      ? buildFull(lots, clientFilter, communityFilter)
      : buildIndex(lots)

    return new Response(body, { headers })

  } catch (err) {
    return new Response(`Error generating llms.txt: ${(err as Error).message}`, {
      status: 500,
      headers,
    })
  }
})
