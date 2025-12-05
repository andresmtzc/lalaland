# Configuration Implementation Examples

This document shows specific before/after examples of how to replace hardcoded values with config variables.

## Table of Contents
1. [Setup](#setup)
2. [Page Title](#page-title)
3. [Logos](#logos)
4. [Default Community](#default-community)
5. [Header Text](#header-text)
6. [Communities Object](#communities-object)
7. [Mapbox Initialization](#mapbox-initialization)
8. [Aerial Image](#aerial-image)
9. [Community Logo Switching](#community-logo-switching)
10. [Data Sources](#data-sources)
11. [Lot Naming](#lot-naming)
12. [WhatsApp Contact](#whatsapp-contact)
13. [Share Functionality](#share-functionality)
14. [Payment Message](#payment-message)

---

## Setup

Add this to the `<head>` section of index-beta.html, **AFTER** the existing script tags but **BEFORE** any code that uses the config:

```html
<!-- Load client configuration -->
<script src="client-config.js"></script>
<script>
  // Set current client and get config
  const CURRENT_CLIENT = 'inverta';
  const CONFIG = getClientConfig(CURRENT_CLIENT);

  // Log for debugging
  console.log('🔧 Loaded config for:', CONFIG.name);
</script>
```

---

## Page Title

### Before:
```html
<title>INVERTA - La-La Land</title>
```

### After:
```html
<title id="pageTitle">Loading...</title>
<script>
  // Set title from config after DOM loads
  if (CONFIG) {
    document.title = CONFIG.displayName;
  }
</script>
```

Or inline in head:
```html
<script>
  if (CONFIG) {
    document.write('<title>' + CONFIG.displayName + '</title>');
  }
</script>
```

---

## Logos

### Main Logo

#### Before:
```html
<div class="logoinv-wrapper">
  <a href="#" onclick="event.preventDefault(); window.location.reload(true);" title="Reload Site">
    <img src="https://la-la.land/inverta/inverta.svg" alt="Logo">
  </a>
</div>
```

#### After:
```html
<div class="logoinv-wrapper">
  <a href="#" onclick="event.preventDefault(); window.location.reload(true);" title="Reload Site">
    <img id="mainClientLogo" src="" alt="">
  </a>
</div>
<script>
  // Set logo from config
  const mainLogo = document.getElementById('mainClientLogo');
  if (mainLogo && CONFIG) {
    mainLogo.src = CONFIG.branding.mainLogo;
    mainLogo.alt = CONFIG.branding.mainLogoAlt;
  }
</script>
```

### Community Logo (Initial)

#### Before:
```html
<div class="community-logo-wrapper" id="communityLogo">
  <img id="communityLogoImg" src="https://la-la.land/inverta/lomasmediterraneo.svg" alt="Community Logo">
</div>
```

#### After:
```html
<div class="community-logo-wrapper" id="communityLogo">
  <img id="communityLogoImg" src="" alt="Community Logo">
</div>
<script>
  // Set initial community logo (for default community)
  const communityLogoImg = document.getElementById('communityLogoImg');
  if (communityLogoImg && CONFIG) {
    const defaultLogo = getCommunityLogo(CURRENT_CLIENT, CONFIG.defaultCommunity);
    communityLogoImg.src = defaultLogo;
  }
</script>
```

---

## Default Community

### Before:
```javascript
// Reset modal.dataset.fracc from baseLots
if (baseLots && baseLots.length > 0 && baseLots[0].fraccionamiento) {
  modal.dataset.fracc = baseLots[0].fraccionamiento;
} else {
  modal.dataset.fracc = 'marsella'; // Default fallback
}
```

### After:
```javascript
// Reset modal.dataset.fracc from baseLots
if (baseLots && baseLots.length > 0 && baseLots[0].fraccionamiento) {
  modal.dataset.fracc = baseLots[0].fraccionamiento;
} else {
  modal.dataset.fracc = CONFIG.defaultCommunity; // Default fallback from config
}
```

### Another Example:

#### Before:
```javascript
const currentFracc = modal?.dataset?.fracc || 'marsella';
```

#### After:
```javascript
const currentFracc = modal?.dataset?.fracc || CONFIG.defaultCommunity;
```

---

## Header Text

### Before:
```html
<div class="header-title">
  <span id="headerFracc">INVERTA</span>
  <span class="header-lot-number" id="headerLotNumber"></span>
</div>
```

```javascript
if (headerFraccEl) {
  headerFraccEl.textContent = currentFracc ? currentFracc.toUpperCase() : 'INVERTA';
}
```

### After:
```html
<div class="header-title">
  <span id="headerFracc"></span>
  <span class="header-lot-number" id="headerLotNumber"></span>
</div>
<script>
  // Set initial header from config
  const headerFracc = document.getElementById('headerFracc');
  if (headerFracc && CONFIG) {
    headerFracc.textContent = CONFIG.name;
  }
</script>
```

```javascript
if (headerFraccEl) {
  headerFraccEl.textContent = currentFracc ? currentFracc.toUpperCase() : CONFIG.name;
}
```

---

## Communities Object

### Before:
```javascript
const communities = {
  'barcelona': {
    center: [-96.035272, 19.046439],
    zoom: 16.2,
    fracc: 'barcelona',
    name: 'Barcelona'
  },
  'marsella': {
    center: [-96.038183, 19.047528],
    zoom: 16.4,
    fracc: 'marsella',
    name: 'Marsella'
  },
  'sierraalta': {
    center: [-96.090267, 19.072525],
    zoom: 15.9,
    fracc: 'sierraalta',
    name: 'SierraAlta'
  },
  'sierrabaja': {
    center: [-96.091717, 19.074769],
    zoom: 16.7,
    fracc: 'sierrabaja',
    name: 'SierraBaja'
  }
};
```

### After:
```javascript
// Build communities object from config
const communities = {};
Object.keys(CONFIG.communities).forEach(key => {
  const comm = CONFIG.communities[key];
  communities[comm.fracc] = {
    center: comm.center,
    zoom: comm.zoom,
    fracc: comm.fracc,
    name: comm.name
  };
});

// Or even simpler - use config directly:
const communities = CONFIG.communities;
```

### For Search Menu Array:

#### Before:
```javascript
const communities = [
  {
    id: 'positionFour',
    label: 'Barcelona',
    center: [-96.035272, 19.046439],
    zoom: 16.2,
    fracc: 'barcelona',
    position: 2
  },
  {
    id: 'positionThree',
    label: 'Marsella',
    center: [-96.038183, 19.047528],
    zoom: 16.4,
    fracc: 'marsella',
    position: 1
  },
  // etc...
];
```

#### After:
```javascript
// Use helper function to get all communities
const communities = getAllCommunities(CURRENT_CLIENT);

// Or build manually from config:
const communities = Object.values(CONFIG.communities).map(comm => ({
  id: comm.searchMenuId,
  label: comm.displayName,
  center: comm.center,
  zoom: comm.zoom,
  fracc: comm.fracc,
  position: comm.position
}));
```

---

## Mapbox Initialization

### Before:
```javascript
fetch('https://la-la.land/mapbox.txt')
  .then(r => r.text())
  .then(token => {
    mapboxgl.accessToken = token.trim();

    const m = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-96.038183, 19.047528], // center
      zoom: 16.4 // Marsella
    });
  });
```

### After:
```javascript
fetch(CONFIG.mapbox.tokenUrl)
  .then(r => r.text())
  .then(token => {
    mapboxgl.accessToken = token.trim();

    const m = new mapboxgl.Map({
      container: 'map',
      style: CONFIG.mapbox.style,
      center: CONFIG.mapbox.initialView.center,
      zoom: CONFIG.mapbox.initialView.zoom
    });
  });
```

---

## Aerial Image

### Before:
```javascript
function addCustomImage(map) {
  const config = {
    url: 'https://la-la.land/inverta/invertaearth.png',
    layerId: 'drone-satellite-layer',
    sourceId: 'drone-satellite',
    message: "Cargamos la imágen aérea más actual — (noviembre 2025)",
    bounds: [
      [-96.041238, 19.0556],
      [-96.031988, 19.055425],
      [-96.032264, 19.042404],
      [-96.041515, 19.04258],
    ]
  };

  // ... rest of function
}
```

### After:
```javascript
function addCustomImage(map) {
  // Use config from global CONFIG object
  const config = {
    url: CONFIG.aerialImage.url,
    layerId: CONFIG.aerialImage.layerId,
    sourceId: CONFIG.aerialImage.sourceId,
    message: CONFIG.aerialImage.message,
    bounds: CONFIG.aerialImage.bounds
  };

  // ... rest of function
}

// Or even simpler:
function addCustomImage(map) {
  const config = CONFIG.aerialImage;
  // ... rest of function
}
```

---

## Community Logo Switching

### Before:
```javascript
function updateCommunityLogo() {
  const currentFracc = (modal.dataset.fracc || '').trim().toLowerCase();

  if (currentFracc === 'marsella' || currentFracc === 'barcelona') {
    communityLogoImg.src = 'https://la-la.land/inverta/lomasmediterraneo.svg';
  } else if (currentFracc === 'sierraalta' || currentFracc === 'sierrabaja') {
    communityLogoImg.src = 'https://la-la.land/inverta/puntolomas.svg';
  }
}
```

### After:
```javascript
function updateCommunityLogo() {
  const currentFracc = (modal.dataset.fracc || '').trim().toLowerCase();

  // Use helper function to get correct logo
  const logoUrl = getCommunityLogo(CURRENT_CLIENT, currentFracc);
  if (logoUrl) {
    communityLogoImg.src = logoUrl;
  }
}
```

---

## Data Sources

### Lots File

#### Before:
```javascript
return fetch('https://la-la.land/inverta/lots.txt')
  .then(r => r.text())
  .then(txt => {
    lotData = parseLots(txt);
  });
```

#### After:
```javascript
return fetch(CONFIG.data.lotsFile)
  .then(r => r.text())
  .then(txt => {
    lotData = parseLots(txt);
  });
```

### Frames Base

#### Before:
```javascript
const FRAMES_BASE = 'https://la-la.land/inverta/frames/';
```

#### After:
```javascript
const FRAMES_BASE = CONFIG.data.framesBase;
```

---

## Lot Naming

### Before:
```javascript
function extractLotNumber(lotName) {
  return lotName
    .replace(/^lotinverta/i, '')
    .replace(/^lot/i, '')
    .replace(/^inverta/i, '')
    .replace(/^p/i, '');
}
```

### After:
```javascript
function extractLotNumber(lotName) {
  // Use helper function from config
  return extractLotNumber(CURRENT_CLIENT, lotName);
}

// Or if you need custom logic:
function extractLotNumber(lotName) {
  let clean = lotName;

  // Remove all prefixes from config
  Object.values(CONFIG.lotPrefixes).forEach(prefix => {
    const regex = new RegExp(`^${prefix}`, 'i');
    clean = clean.replace(regex, '');
  });

  // Remove generic 'lot' prefix
  clean = clean.replace(/^lot/i, '');

  // Remove 'p' for premium
  clean = clean.replace(/^p/i, '');

  return clean;
}
```

### Missing Lots Analysis

#### Before:
```javascript
const missingInverta = missingLots.filter(name =>
  /^lotinverta(10|11|12|13|14|15|16|17)-/.test(name) && !name.includes('lotinvertap')
);
const missingInvertap = missingLots.filter(name =>
  /^lotinvertap(10|11|12|13|14|15|16|17)-/.test(name)
);
```

#### After:
```javascript
const standardPrefix = CONFIG.lotPrefixes.standard;
const premiumPrefix = CONFIG.lotPrefixes.premium;

const missingStandard = missingLots.filter(name => {
  const regex = new RegExp(`^${standardPrefix}(10|11|12|13|14|15|16|17)-`);
  return regex.test(name) && !name.includes(premiumPrefix);
});

const missingPremium = missingLots.filter(name => {
  const regex = new RegExp(`^${premiumPrefix}(10|11|12|13|14|15|16|17)-`);
  return regex.test(name);
});
```

---

## WhatsApp Contact

### Before:
```html
<a href="https://wa.me/5218185261819"
   target="_blank"
   id="ctaToaster"
   class="hidden"
   data-utm-source="website"
   data-utm-medium="toaster"
   data-utm-campaign="lead_generation">
  ¿Tienes dudas? ¡Chatea con nosotros por WhatsApp!
</a>
```

### After:
```html
<a id="ctaToaster"
   target="_blank"
   class="hidden">
</a>
<script>
  // Set WhatsApp link from config
  const ctaToaster = document.getElementById('ctaToaster');
  if (ctaToaster && CONFIG) {
    const wa = CONFIG.contact.whatsapp;
    ctaToaster.href = `https://wa.me/${wa.number}`;
    ctaToaster.dataset.utmSource = wa.utmSource;
    ctaToaster.dataset.utmMedium = wa.utmMedium;
    ctaToaster.dataset.utmCampaign = wa.utmCampaign;
    ctaToaster.textContent = wa.defaultMessage;
  }
</script>
```

---

## Share Functionality

### Before:
```javascript
const shareUrl = `${window.location.origin}/inverta/lot/${communitySlug}-${lotNumber}.html?a=${downPaymentPercent}&m=${installments}`;
const shareText = `Te comparto el Lote ${lotNumber} de ${communityCapitalized} - Inverta`;
```

### After:
```javascript
// Use helper functions
const shareUrl = buildShareUrl(
  CURRENT_CLIENT,
  lotNumber,
  communitySlug,
  downPaymentPercent,
  installments
);

const shareText = buildShareText(
  CURRENT_CLIENT,
  lotNumber,
  communityCapitalized
);
```

---

## Payment Message

### Before:
```html
<p>
  (se te proporcionarán las cuentas bancarias oficiales de INVERTA a través de WhatsApp).
  <br>
  <span style="color: #ff8400; font-weight: 600;">¡Fácil, rápido y sin complicaciones!</span>
</p>
```

### After:
```html
<p id="paymentInfo"></p>
<script>
  const paymentInfo = document.getElementById('paymentInfo');
  if (paymentInfo && CONFIG) {
    paymentInfo.innerHTML = `
      ${CONFIG.contact.paymentMessage}
      <br>
      <span style="color: ${CONFIG.misc.ctaColor}; font-weight: 600;">
        ${CONFIG.misc.ctaMessage}
      </span>
    `;
  }
</script>
```

---

## Complete Example: getCurrentFraccCenter

### Before:
```javascript
function getCurrentFraccCenter() {
  const communities = window.communities || {
    'barcelona': { center: [-96.035272, 19.046439], zoom: 16.2 },
    'marsella': { center: [-96.038183, 19.047528], zoom: 16.4 },
    'sierraalta': { center: [-96.090267, 19.072525], zoom: 15.9 },
    'sierrabaja': { center: [-96.091717, 19.074769], zoom: 16.7 }
  };

  const modal = document.getElementById('lotModal');
  let currentFracc = (modal?.dataset.fracc || 'marsella').trim().toLowerCase();

  return communities[currentFracc]?.center || communities['marsella'].center;
}
```

### After:
```javascript
function getCurrentFraccCenter() {
  const communities = window.communities || CONFIG.communities;

  const modal = document.getElementById('lotModal');
  let currentFracc = (modal?.dataset.fracc || CONFIG.defaultCommunity).trim().toLowerCase();

  const defaultComm = CONFIG.communities[CONFIG.defaultCommunity];
  return communities[currentFracc]?.center || defaultComm.center;
}
```

---

## Complete Example: getCurrentFraccZoom

### Before:
```javascript
function getCurrentFraccZoom() {
  const modal = document.getElementById('lotModal');
  let currentFracc = (modal?.dataset.fracc || '').trim().toLowerCase();

  const zooms = {
    'barcelona': 16.2,
    'marsella': 16.4,
    'sierraalta': 15.9,
    'sierrabaja': 16.7
  };

  if (!currentFracc && window.map) {
    const center = map.getCenter();
    const communities = {
      'barcelona': { center: [-96.035272, 19.046439] },
      'marsella': { center: [-96.038183, 19.047528] },
      'sierraalta': { center: [-96.090267, 19.072525] },
      'sierrabaja': { center: [-96.091717, 19.074769] }
    };

    let closestFracc = 'marsella';
    let closestDistance = Infinity;

    // Find closest
    for (const [fracc, data] of Object.entries(communities)) {
      const distance = Math.sqrt(
        Math.pow(center.lng - data.center[0], 2) +
        Math.pow(center.lat - data.center[1], 2)
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closestFracc = fracc;
      }
    }

    currentFracc = closestFracc;
  }

  return zooms[currentFracc] || zooms['marsella'];
}
```

### After:
```javascript
function getCurrentFraccZoom() {
  const modal = document.getElementById('lotModal');
  let currentFracc = (modal?.dataset.fracc || '').trim().toLowerCase();

  // Build zooms object from config
  const zooms = {};
  Object.keys(CONFIG.communities).forEach(key => {
    const comm = CONFIG.communities[key];
    zooms[comm.fracc] = comm.zoom;
  });

  if (!currentFracc && window.map) {
    const center = map.getCenter();

    let closestFracc = CONFIG.defaultCommunity;
    let closestDistance = Infinity;

    // Find closest community
    for (const [key, comm] of Object.entries(CONFIG.communities)) {
      const distance = Math.sqrt(
        Math.pow(center.lng - comm.center[0], 2) +
        Math.pow(center.lat - comm.center[1], 2)
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closestFracc = comm.fracc;
      }
    }

    currentFracc = closestFracc;
  }

  const defaultZoom = CONFIG.communities[CONFIG.defaultCommunity].zoom;
  return zooms[currentFracc] || defaultZoom;
}
```

---

## Quick Migration Checklist

Use this checklist when converting a hardcoded file to use config:

- [ ] Add `<script src="client-config.js"></script>` to head
- [ ] Add `const CURRENT_CLIENT = 'clientname';`
- [ ] Add `const CONFIG = getClientConfig(CURRENT_CLIENT);`
- [ ] Replace page title with `CONFIG.displayName`
- [ ] Replace logo sources with `CONFIG.branding.mainLogo`
- [ ] Replace all `'marsella'` defaults with `CONFIG.defaultCommunity`
- [ ] Replace all `'INVERTA'` text with `CONFIG.name`
- [ ] Replace communities object with `CONFIG.communities`
- [ ] Replace mapbox token URL with `CONFIG.mapbox.tokenUrl`
- [ ] Replace map initial view with `CONFIG.mapbox.initialView`
- [ ] Replace aerial image config with `CONFIG.aerialImage`
- [ ] Replace lots file URL with `CONFIG.data.lotsFile`
- [ ] Replace frames base with `CONFIG.data.framesBase`
- [ ] Replace WhatsApp number with `CONFIG.contact.whatsapp.number`
- [ ] Replace share URL generation with `buildShareUrl()`
- [ ] Replace share text with `buildShareText()`
- [ ] Replace lot number extraction with `extractLotNumber()`
- [ ] Replace community logo logic with `getCommunityLogo()`
- [ ] Test all features thoroughly!

---

## Performance Considerations

### Caching Config Values

If you're using config values frequently in loops or performance-critical code, cache them:

```javascript
// At top of your script
const DEFAULT_COMMUNITY = CONFIG.defaultCommunity;
const CLIENT_NAME = CONFIG.name;
const LOTS_FILE_URL = CONFIG.data.lotsFile;

// Then use cached values
if (!fracc) {
  fracc = DEFAULT_COMMUNITY;
}
```

### Lazy Loading

For large configs, consider lazy loading:

```javascript
let _config = null;

function getConfig() {
  if (!_config) {
    _config = getClientConfig(CURRENT_CLIENT);
  }
  return _config;
}
```

---

## Debugging Tips

Add console logs to verify config is loading:

```javascript
console.log('🔧 Client Config Loaded:', CONFIG);
console.log('📍 Default Community:', CONFIG.defaultCommunity);
console.log('🏘️ Communities:', Object.keys(CONFIG.communities));
console.log('🎨 Main Logo:', CONFIG.branding.mainLogo);
```

Check for null config:

```javascript
if (!CONFIG) {
  console.error('❌ CONFIG not loaded! Check CURRENT_CLIENT value.');
}
```

Validate community exists:

```javascript
function getCommunity(fraccName) {
  const comm = CONFIG.communities[fraccName];
  if (!comm) {
    console.warn(`⚠️ Community not found: ${fraccName}`);
    return CONFIG.communities[CONFIG.defaultCommunity];
  }
  return comm;
}
```
