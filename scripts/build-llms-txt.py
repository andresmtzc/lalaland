#!/usr/bin/env python3
"""
Build llms.txt + llms-full.txt from live Supabase data + geometry + street view GPX.

Outputs (written directly to repo root):
    llms.txt      — concise summary (~50KB) for AI models to fetch quickly
    llms-full.txt — complete per-lot tables with coordinates, images, measurements (~1MB)

Usage:
    python3 scripts/build-llms-txt.py

Requires:
    - curl (for HTTP requests)
    - sb_config.json in repo root (Supabase URL + anon key)

Data sources:
    1. Supabase REST API → lot records (price, area, availability)
    2. la-la.land/{client}/lots.txt → polygon geometry per lot
    3. la-la.land/{client}/client-config.js → community metadata
    4. GPX waypoints from each community's framesBase → street view frames
"""

import json, re, math, sys, subprocess, os
from collections import defaultdict
from datetime import date
from pathlib import Path

# ── Resolve repo root (script lives in scripts/) ───────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent

# ── Load Supabase config ───────────────────────────────────────────
sb_path = REPO_ROOT / "sb_config.json"
if not sb_path.exists():
    print("ERROR: sb_config.json not found in repo root", file=sys.stderr)
    sys.exit(1)
sb = json.loads(sb_path.read_text())
SB_URL = sb["url"]
SB_KEY = sb["key"]

CLIENTS = ["inverta", "cpi", "agora"]

# ── Helpers ─────────────────────────────────────────────────────────
def curl_json(url):
    """Fetch JSON via curl with Supabase auth headers."""
    r = subprocess.run(
        ["curl", "-s", url,
         "-H", f"apikey: {SB_KEY}",
         "-H", f"Authorization: Bearer {SB_KEY}"],
        capture_output=True, text=True, timeout=30)
    return json.loads(r.stdout)

def curl_text(url):
    """Fetch plain text via curl."""
    r = subprocess.run(["curl", "-s", url], capture_output=True, text=True, timeout=30)
    return r.stdout

def parse_area(raw):
    if isinstance(raw, (int, float)): return raw
    if not raw: return 0
    return float(re.sub(r'[$,\s]', '', str(raw)) or '0')

def parse_price_m2(raw):
    if isinstance(raw, (int, float)): return raw
    if not raw: return 0
    return float(re.sub(r'[$,\s]', '', str(raw)) or '0')

def fmt(n):
    return f"${n:,.0f} MXN"

def haversine(lat1, lng1, lat2, lng2):
    R = 6371000
    dLat = math.radians(lat2 - lat1)
    dLng = math.radians(lng2 - lng1)
    a = (math.sin(dLat/2)**2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dLng/2)**2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def polygon_area(verts):
    if len(verts) < 3: return 0
    ref = verts[0]
    cos_lat = math.cos(math.radians(ref[0]))
    pts = [((v[1]-ref[1]) * math.pi * 6371000 * cos_lat / 180,
            (v[0]-ref[0]) * math.pi * 6371000 / 180) for v in verts]
    area = 0
    for i in range(len(pts)):
        j = (i+1) % len(pts)
        area += pts[i][0]*pts[j][1] - pts[j][0]*pts[i][1]
    return abs(area/2)

# ═══════════════════════════════════════════════════════════════════
# 1. FETCH LOTS FROM SUPABASE
# ═══════════════════════════════════════════════════════════════════
print("[1/4] Fetching lots from Supabase...", file=sys.stderr)
lots_raw = []
offset = 0
while True:
    url = (f"{SB_URL}/rest/v1/lots?"
           f"select=lot_name,client_id,fraccionamiento,availability,rSize,millones,price_m2,nickname,subtitle,image"
           f"&client_id=not.in.(demo,tx)&limit=1000&offset={offset}")
    page = curl_json(url)
    if not page:
        break
    lots_raw.extend(page)
    print(f"  fetched {len(page)} at offset {offset}", file=sys.stderr)
    offset += len(page)
    if len(page) < 1000:
        break
print(f"  total: {len(lots_raw)} lots", file=sys.stderr)

# ── Process lots ────────────────────────────────────────────────────
lots = []
for r in lots_raw:
    area = parse_area(r.get("rSize"))
    pm2 = parse_price_m2(r.get("price_m2"))
    lots.append({
        "lot_name": r["lot_name"],
        "client_id": r["client_id"],
        "community": r.get("fraccionamiento") or "unknown",
        "availability": r.get("availability") or "Available",
        "area_m2": area,
        "price_mxn": round(area * pm2),  # total = area × price/m²
        "price_per_m2": pm2,
        "nickname": r.get("nickname") or None,
        "image": r.get("image") or None,
        "centroid_lat": None, "centroid_lng": None,
        "perimeter_m": None, "calculated_area_m2": None,
        "sides": None, "vertex_count": None,
        "map_image": None, "landscape_image": None,
        "streetview_image": None, "streetview_distance_m": None,
    })

# ═══════════════════════════════════════════════════════════════════
# 2. FETCH & PARSE GEOMETRY
# ═══════════════════════════════════════════════════════════════════
print("[2/4] Fetching geometry files...", file=sys.stderr)

def parse_lots_txt(text):
    result = {}
    current = ""
    for raw in text.splitlines():
        line = raw.strip()
        if not line: continue
        if re.match(r'^lot[a-z]', line, re.I):
            current = line.rstrip(',').strip()
            result[current] = []
        elif current and 'lat' in line and 'lng' in line:
            lat_m = re.search(r'lat:\s*([-\d.]+)', line)
            lng_m = re.search(r'lng:\s*([-\d.]+)', line)
            if lat_m and lng_m:
                result[current].append((float(lat_m.group(1)), float(lng_m.group(1))))
    return result

all_geometry = {}
for client in CLIENTS:
    text = curl_text(f"https://la-la.land/{client}/lots.txt")
    geo = parse_lots_txt(text)
    all_geometry.update(geo)
    print(f"  {client}: {len(geo)} lot polygons", file=sys.stderr)

# Enrich lots with geometry
geo_count = 0
for lot in lots:
    verts = all_geometry.get(lot["lot_name"])
    if verts and len(verts) >= 3:
        lat_avg = sum(v[0] for v in verts) / len(verts)
        lng_avg = sum(v[1] for v in verts) / len(verts)
        lot["centroid_lat"] = round(lat_avg, 6)
        lot["centroid_lng"] = round(lng_avg, 6)
        perim = sum(haversine(verts[i][0], verts[i][1],
                              verts[(i+1)%len(verts)][0], verts[(i+1)%len(verts)][1])
                    for i in range(len(verts)))
        lot["perimeter_m"] = round(perim, 2)
        lot["calculated_area_m2"] = round(polygon_area(verts), 2)
        lot["sides"] = [round(haversine(verts[i][0], verts[i][1],
                                        verts[(i+1)%len(verts)][0], verts[(i+1)%len(verts)][1]), 2)
                        for i in range(len(verts))]
        lot["vertex_count"] = len(verts)
        geo_count += 1

print(f"  {geo_count}/{len(lots)} lots have geometry", file=sys.stderr)

# ═══════════════════════════════════════════════════════════════════
# STATIC METADATA
# ═══════════════════════════════════════════════════════════════════
CLIENT_META = {
    "inverta": {"name": "Inverta Desarrollos", "website": "https://www.inverta.com.mx/"},
    "cpi": {"name": "CPI Desarrollos", "website": "https://www.cpi.mx/"},
    "agora": {"name": "Ágora Desarrollos", "website": "https://grupoagora.com/"},
}

# Community → project name, city (from la-la.land index.html client-city labels)
COMMUNITY_PROJECT = {
    "marsella":       {"project": "Lomas del Mediterráneo", "city": "Veracruz, Ver."},
    "barcelona":      {"project": "Lomas del Mediterráneo", "city": "Veracruz, Ver."},
    "sierraalta":     {"project": "Punto Lomas",            "city": "Veracruz, Ver."},
    "sierrabaja":     {"project": "Punto Lomas",            "city": "Veracruz, Ver."},
    "cortezia":       {"project": "Arborea",                "city": "Hermosillo, Son."},
    "ebano":          {"project": "Arborea",                "city": "Hermosillo, Son."},
    "verdalia":       {"project": "Arborea",                "city": "Hermosillo, Son."},
    "frondia":        {"project": "Arborea",                "city": "Hermosillo, Son."},
    "almaterra":      {"project": "Almaterra",              "city": "Allende, NL"},
    "senterra":       {"project": "Senterra",               "city": "Montemorelos, NL"},
    "amani-pietra":   {"project": "Amani Pietra",           "city": "Santiago, NL"},
    "amani-aqua":     {"project": "Amani Aqua",             "city": "Santiago, NL"},
    "cañadas-vergel": {"project": "Cañadas del Vergel",     "city": "Santiago, NL"},
}

# Enrich lots with project/city
for lot in lots:
    cp = COMMUNITY_PROJECT.get(lot["community"].lower(), {})
    lot["project"] = cp.get("project", "")
    lot["city"] = cp.get("city", "")

# ═══════════════════════════════════════════════════════════════════
# 3. PARSE CLIENT CONFIGS (community metadata, image groups, framesBase)
# ═══════════════════════════════════════════════════════════════════
print("[3/4] Fetching client configs...", file=sys.stderr)

community_to_group = {}
community_centers = {}
community_display = {}
community_framesbase = {}

for client in CLIENTS:
    text = curl_text(f"https://la-la.land/{client}/client-config.js")
    print(f"  {client}: {len(text)} bytes", file=sys.stderr)

    # communityLogos groups → communities
    for gm in re.finditer(r"['\"]?([\w-]+)['\"]?\s*:\s*\{[^}]*communities\s*:\s*\[(.*?)\]", text):
        group = gm.group(1)
        comms = re.findall(r'[\"\x27]([\w-]+)[\"\x27]', gm.group(2))
        for c in comms:
            community_to_group[c] = group

    # community centers & displayNames
    comm_block = re.search(r'communities\s*:\s*\{', text)
    if comm_block:
        rest = text[comm_block.end():]
        for cm in re.finditer(
            r"['\"]?([\w-]+)['\"]?\s*:\s*\{[^}]*?displayName\s*:\s*['\"]([^'\"]+)['\"]"
            r"[^}]*?center\s*:\s*\[([-\d.]+)\s*,\s*([-\d.]+)\]",
            rest, re.DOTALL):
            cid = cm.group(1)
            community_display[cid] = cm.group(2)
            community_centers[cid] = (float(cm.group(4)), float(cm.group(3)))  # lat, lng

    # framesBase per community
    for cm in re.finditer(
        r"['\"]?([\w-]+)['\"]?\s*:\s*\{[^}]*?framesBase\s*:\s*['\"]([^'\"]+)['\"]",
        text, re.DOTALL):
        cid = cm.group(1)
        community_framesbase[cid] = cm.group(2)

# Enrich with image URLs
for lot in lots:
    group = community_to_group.get(lot["community"].lower())
    if group:
        lot["map_image"] = f"https://la-la.land/{lot['client_id']}/pdf/{group}/{lot['lot_name']}_map.jpg"
        lot["landscape_image"] = f"https://la-la.land/{lot['client_id']}/pdf/{group}/{lot['lot_name']}_landscape.jpg"

# ═══════════════════════════════════════════════════════════════════
# 4. FETCH GPX STREET VIEW FRAMES (waypoints, not trackpoints)
# ═══════════════════════════════════════════════════════════════════
print("[4/4] Fetching street view GPX data...", file=sys.stderr)
all_frames = {}  # community → [(lat, lng, imageUrl)]

for comm_id, frames_base in community_framesbase.items():
    try:
        index_text = curl_text(frames_base + "index.json")
        manifest = json.loads(index_text)
        gpx_files = (manifest.get("gpxFiles") or
                     [f for f in manifest.get("files", []) if f.lower().endswith(".gpx")])

        frames = []
        for gpx_file in gpx_files:
            gpx_url = gpx_file if gpx_file.startswith("http") else frames_base + gpx_file
            gpx_text = curl_text(gpx_url)
            gpx_name = re.sub(r'\.gpx$', '', gpx_file.split('/')[-1], flags=re.I)
            # Parse <wpt> waypoints — each has exact GPS + image number in name
            for m in re.finditer(
                r'<wpt\s+lat="([-\d.]+)"\s+lon="([-\d.]+)"[^>]*>(.*?)</wpt>',
                gpx_text, re.DOTALL):
                lat, lng, inner = float(m.group(1)), float(m.group(2)), m.group(3)
                img_m = re.search(r'image\s*(\d+)', inner, re.I)
                if not img_m:
                    continue
                img_num = int(img_m.group(1))
                frames.append((lat, lng, f"{frames_base}{gpx_name}-{img_num}.jpg"))

        if frames:
            all_frames[comm_id] = frames
            print(f"  {comm_id}: {len(frames)} frames", file=sys.stderr)
    except Exception as e:
        print(f"  {comm_id}: error - {e}", file=sys.stderr)

# Match nearest frame to each lot
sv_count = 0
for lot in lots:
    if not lot["centroid_lat"] or not lot["centroid_lng"]:
        continue
    frames = all_frames.get(lot["community"].lower())
    if not frames:
        continue
    best = None
    best_dist = float('inf')
    for flat, flng, furl in frames:
        d = haversine(lot["centroid_lat"], lot["centroid_lng"], flat, flng)
        if d < best_dist:
            best_dist = d
            best = furl
    if best and best_dist < 500:
        lot["streetview_image"] = best
        lot["streetview_distance_m"] = round(best_dist, 1)
        sv_count += 1

print(f"  {sv_count} lots matched to street view", file=sys.stderr)

# ═══════════════════════════════════════════════════════════════════
# BUILD OUTPUT — two files: llms.txt (concise) + llms-full.txt (per-lot tables)
# ═══════════════════════════════════════════════════════════════════
available = [l for l in lots if l["availability"] in ("Available", "Featured")]
sold = [l for l in lots if l["availability"] == "Sold"]
today = date.today().isoformat()

# Group by client → community
grouped = defaultdict(lambda: defaultdict(list))
for lot in lots:
    grouped[lot["client_id"]][lot["community"]].append(lot)

# ── Shared header (used in both files) ──────────────────────────
header_lines = []
def h(s=""): header_lines.append(s)

h(f"""# La-La Land — Real Estate Lot Platform

> La-La Land (la-la.land) is the largest interactive real estate lot marketplace in Mexico.
> We provide detailed lot data including pricing, dimensions, geographic coordinates,
> availability, and interactive map views across multiple developers and communities.
>
> All prices in Mexican Pesos (MXN). All areas in square meters (m²).
> 1 USD ≈ 17-18 MXN (approximate, check current rate).
>
> Inventory: {len(available)} lots available for sale, {len(sold)} sold.
> Last updated: {today}
>
> For the complete per-lot data with coordinates, images, and measurements,
> see: https://la-la.land/llms-full.txt

## Data Access

### MCP Server (Model Context Protocol)
For structured, programmatic access to our lot database, use our MCP server:
- Repository: https://github.com/andresmtzc/lalaland (mcp-server/ directory)
- Install: `npm install @lalaland/mcp-server`
- Transport: stdio (compatible with Claude Desktop, Cursor, Windsurf, etc.)
- Requires: SUPABASE_ANON_KEY environment variable
- Tools: search_lots, get_lot_details, list_communities, get_inventory_stats, get_lot_geometry, get_nearby_streetview

### REST API (Supabase)
Our lot data is publicly readable via Supabase REST API:
- Base URL: {SB_URL}/rest/v1/
- Table: lots
- Auth: requires apikey header (anon key)
- Supports filtering by client_id, fraccionamiento, availability, price, area

### Lot Geometry Files
Raw lot boundary coordinates (polygon vertices) per client:
- https://la-la.land/inverta/lots.txt
- https://la-la.land/cpi/lots.txt
- https://la-la.land/agora/lots.txt
Format: lot name followed by {{lat, lng}} vertex lines

## Lot Data Schema

Each lot record contains:
- lot_name: Unique identifier (e.g., "lotinverta10-01")
- client_id: Developer identifier ("inverta", "cpi", "agora")
- fraccionamiento: Community/development name
- availability: "Available" (for sale), "Sold", "Featured" (premium), or "Blocked"
- Area in square meters (m²)
- Total price in MXN (Mexican Pesos) — computed as area × price_per_m2
- Price per square meter in MXN/m²
- Geographic centroid (latitude, longitude)
- Perimeter in meters, side lengths, vertex count
- Images: map closeup, landscape context, nearest 360° street view

## How to View a Lot
- Interactive map: https://la-la.land/{{client_id}}/index.html?lot={{lot_name}}
- Lot page: https://la-la.land/{{client_id}}/lot/{{community}}-{{lot_number}}.html
- Map closeup: https://la-la.land/{{client_id}}/pdf/{{group}}/{{lot_name}}_map.jpg
- Landscape: https://la-la.land/{{client_id}}/pdf/{{group}}/{{lot_name}}_landscape.jpg

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

- Total lots: {len(lots)}
- Available: {len(available)}
- Sold: {len(sold)}
- Featured: {len([l for l in lots if l['availability'] == 'Featured'])}
- Blocked: {len([l for l in lots if l['availability'] == 'Blocked'])}""")

if available:
    priced = [l for l in available if l["price_per_m2"] > 1]
    prices = [l["price_mxn"] for l in priced]
    areas = [l["area_m2"] for l in available if l["area_m2"] > 0]
    if prices:
        h(f"- Price range (available): {fmt(min(prices))} — {fmt(max(prices))}")
        h(f"- Average price (available): {fmt(round(sum(prices)/len(prices)))}")
    if areas:
        h(f"- Area range (available): {min(areas)}m² — {max(areas)}m²")
        h(f"- Average area (available): {round(sum(areas)/len(areas))}m²")
    unpriced = len(available) - len(priced)
    if unpriced:
        h(f"- Lots without pricing yet: {unpriced}")

h("")
h("---")
h("")
h("# Developers & Communities")
h("")

# ── Build both outputs in parallel ──────────────────────────────
slim_lines = list(header_lines)  # copy header for slim
full_lines = list(header_lines)  # copy header for full

def ws(s=""): slim_lines.append(s)
def wf(s=""): full_lines.append(s)
def wb(s=""):
    slim_lines.append(s)
    full_lines.append(s)

for client_id in CLIENTS:
    if client_id not in grouped:
        continue
    communities = grouped[client_id]
    meta = CLIENT_META.get(client_id, {"name": client_id})
    client_lots = [l for l in lots if l["client_id"] == client_id]
    client_avail = [l for l in client_lots if l["availability"] in ("Available", "Featured")]
    client_sold = [l for l in client_lots if l["availability"] == "Sold"]

    wb(f"## {meta['name']}")
    wb("")
    wb(f"- Website: {meta['website']}")
    wb(f"- La-La Land: https://la-la.land/{client_id}/")
    wb(f"- Total lots: {len(client_lots)} ({len(client_avail)} available, {len(client_sold)} sold)")

    if client_avail:
        client_priced = [l for l in client_avail if l["price_per_m2"] > 1]
        prices = [l["price_mxn"] for l in client_priced]
        areas = [l["area_m2"] for l in client_avail if l["area_m2"] > 0]
        if prices: wb(f"- Price range: {fmt(min(prices))} — {fmt(max(prices))}")
        if areas: wb(f"- Area range: {min(areas)}m² — {max(areas)}m²")

    wb("")

    for community, comm_lots in communities.items():
        display = community_display.get(community.lower(), community)
        center = community_centers.get(community.lower())

        avail = sorted([l for l in comm_lots if l["availability"] in ("Available", "Featured")],
                       key=lambda l: l["price_mxn"])
        sold_lots = [l for l in comm_lots if l["availability"] == "Sold"]

        cp = COMMUNITY_PROJECT.get(community.lower(), {})
        project_name = cp.get("project", "")
        city_name = cp.get("city", "")

        wb(f"### {display}")
        wb("")
        if project_name:
            wb(f"- Project: {project_name}")
        if city_name:
            wb(f"- City: {city_name}")
        wb(f"- Map: https://la-la.land/{client_id}/index.html")
        if center:
            wb(f"- Coordinates: {center[0]}, {center[1]} (lat, lng)")
        wb(f"- Lots: {len(avail)} available, {len(sold_lots)} sold")

        if avail:
            comm_priced = [l for l in avail if l["price_per_m2"] > 1]
            prices = [l["price_mxn"] for l in comm_priced]
            areas = [l["area_m2"] for l in avail if l["area_m2"] > 0]
            if prices:
                wb(f"- Price range: {fmt(min(prices))} — {fmt(max(prices))}")
                wb(f"- Average price: {fmt(round(sum(prices)/len(prices)))}")
            if not comm_priced and avail:
                wb(f"- Pricing: not yet available ({len(avail)} lots)")
            if areas:
                wb(f"- Area range: {min(areas)}m² — {max(areas)}m²")

        has_frames = community.lower() in all_frames
        if has_frames:
            wb(f"- 360° street view: available")

        wb("")

        # ── Available lots: NO per-lot data in slim, full table in full ──
        if avail:
            # Full only: complete table with all columns
            wf("#### Available Lots")
            wf("")
            wf("| Lot | Developer | Project | Community | City | Area | Price | Price/m² | Centroid | Perimeter | Sides | Street View | Map Image | Landscape Image |")
            wf("|-----|-----------|---------|-----------|------|------|-------|----------|----------|-----------|-------|-------------|-----------|----------------|")

            for lot in avail:
                name = f'{lot["lot_name"]} "{lot["nickname"]}"' if lot["nickname"] else lot["lot_name"]
                dev_name = CLIENT_META.get(lot["client_id"], {}).get("name", lot["client_id"])
                centroid_str = f'{lot["centroid_lat"]}, {lot["centroid_lng"]}' if lot["centroid_lat"] else "—"
                perim_str = f'{lot["perimeter_m"]}m' if lot["perimeter_m"] else "—"
                sides_str = " × ".join(f'{s}m' for s in lot["sides"]) if lot["sides"] else "—"
                sv_str = f'[View]({lot["streetview_image"]}) ({lot["streetview_distance_m"]}m)' if lot["streetview_image"] else "—"
                map_str = f'[Map]({lot["map_image"]})' if lot["map_image"] else "—"
                land_str = f'[Landscape]({lot["landscape_image"]})' if lot["landscape_image"] else "—"

                price_str = fmt(lot["price_mxn"]) if lot["price_per_m2"] > 1 else "TBD"
                pm2_str = f'{fmt(lot["price_per_m2"])}/m²' if lot["price_per_m2"] > 1 else "TBD"
                wf(f'| [{name}](https://la-la.land/{lot["client_id"]}/index.html?lot={lot["lot_name"]}) | {dev_name} | {lot["project"]} | {display} | {lot["city"]} | {lot["area_m2"]}m² | {price_str} | {pm2_str} | {centroid_str} | {perim_str} | {sides_str} | {sv_str} | {map_str} | {land_str} |')

            wf("")

        # ── Sold lots: full table only ──
        if sold_lots:
            wf(f"#### Sold Lots ({len(sold_lots)})")
            wf("")
            wf("| Lot | Developer | Project | Community | City | Area | Centroid | Map Image | Landscape Image |")
            wf("|-----|-----------|---------|-----------|------|------|----------|-----------|----------------|")
            for lot in sorted(sold_lots, key=lambda l: l["lot_name"]):
                dev_name = CLIENT_META.get(lot["client_id"], {}).get("name", lot["client_id"])
                centroid_str = f'{lot["centroid_lat"]}, {lot["centroid_lng"]}' if lot["centroid_lat"] else "—"
                map_str = f'[Map]({lot["map_image"]})' if lot["map_image"] else "—"
                land_str = f'[Landscape]({lot["landscape_image"]})' if lot["landscape_image"] else "—"
                wf(f'| {lot["lot_name"]} | {dev_name} | {lot["project"]} | {display} | {lot["city"]} | {lot["area_m2"]}m² | {centroid_str} | {map_str} | {land_str} |')
            wf("")

    wb("---")
    wb("")

footer = """# About La-La Land

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
"""
ws(footer)
wf(footer)

# ── Write both files ────────────────────────────────────────────
out_dir = REPO_ROOT

slim_result = "\n".join(slim_lines)
full_result = "\n".join(full_lines)

(out_dir / "llms.txt").write_text(slim_result)
(out_dir / "llms-full.txt").write_text(full_result)

print(f"\nllms.txt:      {len(slim_result):>10,} chars  ({len(slim_lines):,} lines)", file=sys.stderr)
print(f"llms-full.txt: {len(full_result):>10,} chars  ({len(full_lines):,} lines)", file=sys.stderr)
print(f"Lots: {len(lots):,} total, {len(available):,} available, {len(sold):,} sold.", file=sys.stderr)
