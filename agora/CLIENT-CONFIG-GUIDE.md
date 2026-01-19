# Client Configuration System Guide

## Overview

This configuration system centralizes all client-specific variables (names, coordinates, logos, etc.) into a single file. When onboarding a new client, you only need to update the config file instead of searching through the entire codebase.

## Quick Start

### For New Clients

1. **Copy the config template** in `client-config.js`
2. **Add your client** to the `CLIENT_CONFIGS` object
3. **Update `index-beta.html`** to load the new client:
   ```javascript
   const CURRENT_CLIENT = 'yournewclient';
   ```
4. **Test** the implementation

### For Existing Inverta Updates

Simply edit the values in the `inverta` section of `client-config.js`.

## Configuration Structure

### Basic Info
```javascript
name: 'CLIENTNAME',              // Used in headers, displays
displayName: 'Client - La-La Land', // Browser title
defaultCommunity: 'phase1',      // Which community loads first
```

### Branding
```javascript
branding: {
  mainLogo: 'https://...',       // Main client logo
  mainLogoAlt: 'Alt text',
  favicon: 'favicon.ico',
}
```

### Community Logos
Maps community groups to their logos:
```javascript
communityLogos: {
  'groupname': {
    url: 'https://...',
    communities: ['comm1', 'comm2']  // Which communities use this logo
  }
}
```

### Mapbox Settings
```javascript
mapbox: {
  tokenUrl: 'https://...',       // Where to fetch token
  style: 'mapbox://styles/...',  // Map style
  initialView: {
    center: [-100.123, 25.456],  // [lng, lat]
    zoom: 16.4
  }
}
```

### Aerial Image Overlay
```javascript
aerialImage: {
  url: 'https://...',
  layerId: 'custom-layer-id',
  sourceId: 'custom-source-id',
  message: 'Display message',
  bounds: [                      // [lng, lat] corners
    [-100.123, 25.456],          // Bottom-left
    [-100.120, 25.458],          // Top-right
    ...
  ]
}
```

### Communities/Developments
Each property/phase has its own config:
```javascript
communities: {
  communityname: {
    id: 'communityname',
    name: 'Display Name',
    displayName: 'Full Name',
    fracc: 'fraccionamiento_id',
    center: [-100.123, 25.456],  // Map center
    zoom: 16.2,                   // Zoom level
    position: 1,                  // Sort order
    searchMenuId: 'positionOne'   // Menu identifier
  }
}
```

### Data Sources
```javascript
data: {
  lotsFile: 'https://.../lots.txt',
  framesBase: 'https://.../frames/'
}
```

### Lot Naming
Define prefixes used in lot identifiers:
```javascript
lotPrefixes: {
  standard: 'lotclient',   // e.g., lotclient10-1
  premium: 'lotclientp',   // e.g., lotclientp10-1
  base: 'client'
}
```

### Contact & CTA
```javascript
contact: {
  whatsapp: {
    number: '1234567890',
    defaultMessage: 'Chat with us!',
    utmSource: 'website',
    utmMedium: 'toaster',
    utmCampaign: 'lead_generation'
  },
  paymentMessage: 'Payment instructions...'
}
```

### Share Settings
```javascript
share: {
  urlTemplate: '/client/lot/{communitySlug}-{lotNumber}.html',
  textTemplate: 'Check out Lot {lotNumber} in {community}'
}
```

## Helper Functions

### `getClientConfig(clientName)`
Returns the full config object for a client.
```javascript
const config = getClientConfig('inverta');
console.log(config.name); // 'INVERTA'
```

### `getCommunityLogo(clientName, fraccName)`
Gets the correct logo for a community.
```javascript
const logoUrl = getCommunityLogo('inverta', 'marsella');
// Returns: 'https://la-la.land/inverta/lomasmediterraneo.svg'
```

### `getCommunityByFracc(clientName, fraccName)`
Gets full community data.
```javascript
const comm = getCommunityByFracc('inverta', 'barcelona');
console.log(comm.center); // [-96.035272, 19.046439]
console.log(comm.zoom);   // 16.2
```

### `getAllCommunities(clientName)`
Returns array of all communities (for search menus).
```javascript
const communities = getAllCommunities('inverta');
// Returns array with id, label, center, zoom, fracc, position
```

### `buildShareUrl(clientName, lotNumber, communitySlug, downPayment, installments)`
Creates share URLs.
```javascript
const url = buildShareUrl('inverta', '10-1', 'marsella', 20, 12);
// Returns: 'https://la-la.land/inverta/lot/marsella-10-1.html?a=20&m=12'
```

### `buildShareText(clientName, lotNumber, communityName)`
Creates share text.
```javascript
const text = buildShareText('inverta', '10-1', 'Marsella');
// Returns: 'Te comparto el Lote 10-1 de Marsella - Inverta'
```

### `extractLotNumber(clientName, lotName)`
Extracts clean lot number from prefixed name.
```javascript
const lotNum = extractLotNumber('inverta', 'lotinverta10-1');
// Returns: '10-1'
```

## Implementation in index-beta.html

### Step 1: Load the config file
Add this in the `<head>` section:
```html
<script src="client-config.js"></script>
```

### Step 2: Set the current client
```javascript
const CURRENT_CLIENT = 'inverta';
const CONFIG = getClientConfig(CURRENT_CLIENT);
```

### Step 3: Replace hardcoded values

#### Example: Page Title
**Before:**
```html
<title>INVERTA - La-La Land</title>
```

**After:**
```html
<title id="pageTitle">Loading...</title>
<script>
  document.getElementById('pageTitle').textContent = CONFIG.displayName;
</script>
```

#### Example: Logo
**Before:**
```html
<img src="https://la-la.land/inverta/inverta.svg" alt="Logo">
```

**After:**
```html
<img id="mainLogo" src="" alt="">
<script>
  const logo = document.getElementById('mainLogo');
  logo.src = CONFIG.branding.mainLogo;
  logo.alt = CONFIG.branding.mainLogoAlt;
</script>
```

#### Example: Communities Object
**Before:**
```javascript
const communities = {
  'marsella': {
    center: [-96.038183, 19.047528],
    zoom: 16.4,
    // ...
  }
};
```

**After:**
```javascript
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
```

Or simply:
```javascript
const communities = CONFIG.communities;
```

#### Example: Default Fallback
**Before:**
```javascript
modal.dataset.fracc = 'marsella'; // Default fallback
```

**After:**
```javascript
modal.dataset.fracc = CONFIG.defaultCommunity;
```

#### Example: Mapbox Initialization
**Before:**
```javascript
fetch('https://la-la.land/mapbox.txt')
  .then(r => r.text())
  .then(token => {
    mapboxgl.accessToken = token.trim();
    const m = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-96.038183, 19.047528],
      zoom: 16.4
    });
  });
```

**After:**
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

## Adding a New Client

### Example: Adding "Desarrollos XYZ"

1. **Add config to `client-config.js`:**

```javascript
const CLIENT_CONFIGS = {

  inverta: { /* existing config */ },

  // NEW CLIENT
  desarrollosxyz: {
    name: 'DESARROLLOS XYZ',
    displayName: 'Desarrollos XYZ - La-La Land',
    defaultCommunity: 'fase1',

    branding: {
      mainLogo: 'https://la-la.land/xyz/logo.svg',
      mainLogoAlt: 'Desarrollos XYZ',
      favicon: 'xyz-favicon.ico',
    },

    communityLogos: {
      'principal': {
        url: 'https://la-la.land/xyz/desarrollo.svg',
        communities: ['fase1', 'fase2']
      }
    },

    mapbox: {
      tokenUrl: 'https://la-la.land/mapbox.txt',
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      initialView: {
        center: [-99.123456, 20.654321],
        zoom: 15.5
      }
    },

    aerialImage: {
      url: 'https://la-la.land/xyz/aerial.png',
      layerId: 'xyz-satellite-layer',
      sourceId: 'xyz-satellite',
      message: "Imagen aérea actualizada - marzo 2025",
      bounds: [
        [-99.125, 20.650],
        [-99.120, 20.660]
      ]
    },

    communities: {
      fase1: {
        id: 'fase1',
        name: 'Fase 1',
        displayName: 'Fase 1',
        fracc: 'fase1',
        center: [-99.123, 20.655],
        zoom: 16.0,
        position: 1,
        searchMenuId: 'positionOne'
      },
      fase2: {
        id: 'fase2',
        name: 'Fase 2',
        displayName: 'Fase 2',
        fracc: 'fase2',
        center: [-99.124, 20.656],
        zoom: 16.0,
        position: 2,
        searchMenuId: 'positionTwo'
      }
    },

    data: {
      lotsFile: 'https://la-la.land/xyz/lots.txt',
      framesBase: 'https://la-la.land/xyz/frames/'
    },

    lotPrefixes: {
      standard: 'lotxyz',
      premium: 'lotxyzp',
      base: 'xyz'
    },

    contact: {
      whatsapp: {
        number: '5219876543210',
        defaultMessage: '¿Necesitas información? ¡Contáctanos!',
        utmSource: 'website',
        utmMedium: 'toaster',
        utmCampaign: 'lead_generation'
      },
      paymentMessage: '(información de pago se proporcionará por WhatsApp)'
    },

    share: {
      urlTemplate: '/xyz/lot/{communitySlug}-{lotNumber}.html',
      textTemplate: 'Mira el Lote {lotNumber} en {community} - Desarrollos XYZ'
    },

    toaster: {
      aerialImageLoaded: 'Imagen aérea cargada (marzo 2025)'
    },

    misc: {
      fontFamily: 'Barlow Condensed',
      ctaMessage: '¡Invierte hoy!',
      ctaColor: '#0066cc'
    }
  }

};
```

2. **Update `index-beta.html`:**
```javascript
const CURRENT_CLIENT = 'desarrollosxyz';
```

3. **Done!** All client-specific values will now load from the config.

## Common Variables Reference

Here's where each config value is typically used:

| Config Path | Usage | Example in Code |
|-------------|-------|-----------------|
| `name` | Headers, fallback displays | `headerFracc.textContent = CONFIG.name` |
| `displayName` | Browser title | `<title>` tag |
| `defaultCommunity` | Fallback when no community set | `modal.dataset.fracc = CONFIG.defaultCommunity` |
| `branding.mainLogo` | Main logo image | `<img src="CONFIG.branding.mainLogo">` |
| `communityLogos` | Community-specific logos | `getCommunityLogo(CLIENT, fracc)` |
| `mapbox.tokenUrl` | Mapbox token fetch | `fetch(CONFIG.mapbox.tokenUrl)` |
| `mapbox.initialView` | Initial map position | `center: CONFIG.mapbox.initialView.center` |
| `aerialImage` | Custom overlay image | Used in `addCustomImage()` function |
| `communities` | All community data | Building search menus, navigation |
| `data.lotsFile` | Lot data source | `fetch(CONFIG.data.lotsFile)` |
| `data.framesBase` | 360° image frames | `const FRAMES_BASE = CONFIG.data.framesBase` |
| `lotPrefixes` | Lot ID parsing | `extractLotNumber()` function |
| `contact.whatsapp.number` | WhatsApp links | `https://wa.me/${CONFIG.contact.whatsapp.number}` |
| `share.urlTemplate` | Share URL generation | `buildShareUrl()` function |

## Testing Checklist

After setting up a new client, verify:

- [ ] Page title shows correct client name
- [ ] Main logo loads correctly
- [ ] Map initializes at correct location
- [ ] Aerial image overlay appears in correct position
- [ ] Community selector shows all communities
- [ ] Community logos switch correctly
- [ ] WhatsApp link uses correct number
- [ ] Share URLs generate correctly
- [ ] Lot data loads from correct file
- [ ] 360° frames load from correct directory
- [ ] Default fallbacks use configured values

## Troubleshooting

### Config not loading
- Ensure `client-config.js` is loaded before your main script
- Check browser console for errors
- Verify `CURRENT_CLIENT` matches a key in `CLIENT_CONFIGS`

### Wrong values appearing
- Check that you're using `CONFIG.path.to.value` not hardcoded values
- Ensure config file is saved
- Hard refresh browser (Ctrl+Shift+R)

### Communities not showing
- Verify `communities` object structure matches expected format
- Check that `fracc` values match your lot data
- Ensure `position` values are unique

## Best Practices

1. **Always use config values** - Never hardcode client-specific data
2. **Test thoroughly** - Check all features after updating config
3. **Document changes** - Comment why specific values are set
4. **Validate coordinates** - Double-check lat/lng are correct
5. **Use meaningful IDs** - Name communities clearly
6. **Keep structure consistent** - Follow the same pattern for all clients

## Future Enhancements

Possible improvements to this system:

- Multiple config files (one per client)
- JSON format for easier editing
- Config validation/linting
- Admin UI for editing configs
- Dynamic config loading based on URL
- Config versioning/history
