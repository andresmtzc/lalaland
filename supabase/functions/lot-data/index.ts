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

      const client = data.client_id
      const num = data.lot_name.replace(/^lot[a-z]+/i, '').replace(/^p/i, '')
      const comm = (data.fraccionamiento || '').toLowerCase()

      return new Response(JSON.stringify({
        lot_name: data.lot_name,
        client: data.client_id,
        community: data.fraccionamiento,
        availability: data.availability,
        area_m2: data.rSize,
        price_mxn: data.millones,
        price_per_m2: data.price_m2,
        nickname: data.nickname || null,
        subtitle: data.subtitle || null,
        image: data.image || null,
        view_on_map: `https://la-la.land/${client}/lot/${comm}-${num}.html`,
      }), { headers: corsHeaders })
    }

    // ── Stats mode ────────────────────────────────────────────────
    if (params.get('stats') === 'true') {
      let query = supabase.from('lots').select('availability, rSize, millones, fraccionamiento, client_id')

      const clientId = params.get('client_id')
      const community = params.get('community')
      if (clientId) query = query.eq('client_id', clientId)
      if (community) query = query.ilike('fraccionamiento', `%${community}%`)

      // Paginate to get all
      const PAGE = 1000
      let allLots: any[] = []
      let offset = 0
      let done = false
      while (!done) {
        const { data, error } = await query.range(offset, offset + PAGE - 1)
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
        if (!data || data.length === 0) { done = true } else {
          allLots = allLots.concat(data)
          if (data.length < PAGE) done = true
          offset += PAGE
        }
      }

      const stats: any = { total_lots: allLots.length, by_availability: {}, price_mxn: { min: 0, max: 0, avg: 0 }, area_m2: { min: 0, max: 0, avg: 0 }, communities: [] }
      let pMin = Infinity, pMax = -Infinity, pSum = 0, pCnt = 0
      let aMin = Infinity, aMax = -Infinity, aSum = 0, aCnt = 0
      const comms = new Set<string>()

      for (const lot of allLots) {
        const av = lot.availability || 'Available'
        stats.by_availability[av] = (stats.by_availability[av] || 0) + 1
        if (lot.millones > 0) { if (lot.millones < pMin) pMin = lot.millones; if (lot.millones > pMax) pMax = lot.millones; pSum += lot.millones; pCnt++ }
        if (lot.rSize > 0) { if (lot.rSize < aMin) aMin = lot.rSize; if (lot.rSize > aMax) aMax = lot.rSize; aSum += lot.rSize; aCnt++ }
        if (lot.fraccionamiento) comms.add(lot.fraccionamiento)
      }

      stats.price_mxn = { min: pMin === Infinity ? 0 : pMin, max: pMax === -Infinity ? 0 : pMax, avg: pCnt ? Math.round(pSum / pCnt) : 0 }
      stats.area_m2 = { min: aMin === Infinity ? 0 : aMin, max: aMax === -Infinity ? 0 : aMax, avg: aCnt ? Math.round(aSum / aCnt) : 0 }
      stats.communities = [...comms].sort()

      return new Response(JSON.stringify(stats), { headers: corsHeaders })
    }

    // ── Search mode (default) ─────────────────────────────────────
    let query = supabase.from('lots')
      .select('lot_name, client_id, fraccionamiento, availability, rSize, millones, price_m2, nickname, subtitle')

    const clientId = params.get('client_id')
    const community = params.get('community')
    const availability = params.get('availability')
    const minPrice = params.get('min_price')
    const maxPrice = params.get('max_price')
    const minArea = params.get('min_area')
    const maxArea = params.get('max_area')
    const limit = Math.min(parseInt(params.get('limit') || '25'), 100)
    const offset = parseInt(params.get('offset') || '0')

    if (clientId) query = query.eq('client_id', clientId)
    if (community) query = query.ilike('fraccionamiento', `%${community}%`)
    if (availability) query = query.eq('availability', availability)
    if (minPrice) query = query.gte('millones', parseFloat(minPrice))
    if (maxPrice) query = query.lte('millones', parseFloat(maxPrice))
    if (minArea) query = query.gte('rSize', parseFloat(minArea))
    if (maxArea) query = query.lte('rSize', parseFloat(maxArea))

    query = query.order('millones', { ascending: true }).range(offset, offset + limit - 1)

    const { data, error } = await query
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })

    const lots = (data || []).map((row: any) => ({
      lot_name: row.lot_name,
      client: row.client_id,
      community: row.fraccionamiento,
      availability: row.availability,
      area_m2: row.rSize,
      price_mxn: row.millones,
      price_per_m2: row.price_m2,
      nickname: row.nickname || null,
      subtitle: row.subtitle || null,
    }))

    return new Response(JSON.stringify({ count: lots.length, offset, limit, lots }), { headers: corsHeaders })

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders })
  }
})
