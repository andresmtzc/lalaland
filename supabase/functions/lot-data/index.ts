// Supabase Edge Function: lot-data
// Public JSON API for lot data — designed for LLM consumption, crawlers, and integrations.
//
// GET /lot-data?client_id=inverta&community=barcelona&availability=Available&min_price=300000&max_price=800000&limit=25&offset=0
// GET /lot-data?lot_name=lotinverta10-01    (single lot detail mode)
// GET /lot-data?stats=true&client_id=inverta  (inventory stats mode)
//
// Deploy with: supabase functions deploy lot-data

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

// DB stores formatted strings — parse them into real numbers
// "4,098" → 4098
function parseArea(raw: any): number {
  if (typeof raw === 'number') return raw
  if (!raw) return 0
  return parseFloat(String(raw).replace(/[$,\s]/g, '')) || 0
}
// "$10.25" means 10.25 million MXN → 10,250,000
function parsePrice(raw: any): number {
  if (typeof raw === 'number') return raw
  if (!raw) return 0
  const num = parseFloat(String(raw).replace(/[$,\s]/g, '')) || 0
  return Math.round(num * 1_000_000)
}
// "2,500" → 2500
function parsePriceM2(raw: any): number {
  if (typeof raw === 'number') return raw
  if (!raw) return 0
  return parseFloat(String(raw).replace(/[$,\s]/g, '')) || 0
}

// Paginated fetch (Supabase caps at 1000 rows)
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const params = url.searchParams

    // ── Single lot detail mode ────────────────────────────────────
    const lotName = params.get('lot_name')
    if (lotName) {
      const { data, error } = await supabase
        .from('lots')
        .select('lot_name, client_id, fraccionamiento, availability, rSize, millones, price_m2, nickname, subtitle, image')
        .eq('lot_name', lotName)
        .maybeSingle()

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
      }
      if (!data) {
        return new Response(JSON.stringify({ error: 'Lot not found' }), { status: 404, headers: corsHeaders })
      }

      return new Response(JSON.stringify({
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
        view_on_map: `https://la-la.land/${data.client_id}/index.html?lot=${data.lot_name}`,
      }), { headers: corsHeaders })
    }

    // ── Stats mode ────────────────────────────────────────────────
    if (params.get('stats') === 'true') {
      let query = supabase.from('lots').select('availability, rSize, millones, fraccionamiento, client_id')

      const clientId = params.get('client_id')
      const community = params.get('community')
      if (clientId) query = query.eq('client_id', clientId)
      if (community) query = query.ilike('fraccionamiento', `%${community}%`)

      const allLots = await fetchAll(query)

      const stats: any = { total_lots: allLots.length, by_availability: {}, price_mxn: { min: 0, max: 0, avg: 0 }, area_m2: { min: 0, max: 0, avg: 0 }, communities: [] }
      let pMin = Infinity, pMax = -Infinity, pSum = 0, pCnt = 0
      let aMin = Infinity, aMax = -Infinity, aSum = 0, aCnt = 0
      const comms = new Set<string>()

      for (const lot of allLots) {
        const av = lot.availability || 'Available'
        stats.by_availability[av] = (stats.by_availability[av] || 0) + 1
        const price = parsePrice(lot.millones)
        if (price > 0) { if (price < pMin) pMin = price; if (price > pMax) pMax = price; pSum += price; pCnt++ }
        const area = parseArea(lot.rSize)
        if (area > 0) { if (area < aMin) aMin = area; if (area > aMax) aMax = area; aSum += area; aCnt++ }
        if (lot.fraccionamiento) comms.add(lot.fraccionamiento)
      }

      stats.price_mxn = { min: pMin === Infinity ? 0 : pMin, max: pMax === -Infinity ? 0 : pMax, avg: pCnt ? Math.round(pSum / pCnt) : 0 }
      stats.area_m2 = { min: aMin === Infinity ? 0 : aMin, max: aMax === -Infinity ? 0 : aMax, avg: aCnt ? Math.round(aSum / aCnt) : 0 }
      stats.communities = [...comms].sort()

      return new Response(JSON.stringify(stats), { headers: corsHeaders })
    }

    // ── Search mode (default) ─────────────────────────────────────
    // Price/area are formatted strings in DB, so fetch all matching rows
    // and filter/sort in memory
    let query = supabase.from('lots')
      .select('lot_name, client_id, fraccionamiento, availability, rSize, millones, price_m2, nickname, subtitle')

    const clientId = params.get('client_id')
    const community = params.get('community')
    const availability = params.get('availability')
    const minPrice = params.get('min_price') ? parseFloat(params.get('min_price')!) : null
    const maxPrice = params.get('max_price') ? parseFloat(params.get('max_price')!) : null
    const minArea = params.get('min_area') ? parseFloat(params.get('min_area')!) : null
    const maxArea = params.get('max_area') ? parseFloat(params.get('max_area')!) : null
    const limit = Math.min(parseInt(params.get('limit') || '25'), 100)
    const offset = parseInt(params.get('offset') || '0')

    if (clientId) query = query.eq('client_id', clientId)
    if (community) query = query.ilike('fraccionamiento', `%${community}%`)
    if (availability) query = query.eq('availability', availability)

    const allRows = await fetchAll(query)

    // Parse, filter, sort
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
    }))

    if (minPrice) lots = lots.filter(l => l.price_mxn >= minPrice)
    if (maxPrice) lots = lots.filter(l => l.price_mxn <= maxPrice)
    if (minArea) lots = lots.filter(l => l.area_m2 >= minArea)
    if (maxArea) lots = lots.filter(l => l.area_m2 <= maxArea)

    lots.sort((a: any, b: any) => a.price_mxn - b.price_mxn)

    const page = lots.slice(offset, offset + limit)

    return new Response(JSON.stringify({ total_matching: lots.length, showing: page.length, offset, limit, lots: page }), { headers: corsHeaders })

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders })
  }
})
