# Client Configuration System

## 🎯 Quick Start

### What is this?

A centralized configuration system that eliminates hardcoded client-specific values (names, coordinates, logos, etc.) from your codebase. When you get a new client, simply update the config file instead of searching through thousands of lines of code.

### Files Created

1. **`client-config.js`** - The main configuration file containing all client settings
2. **`CLIENT-CONFIG-GUIDE.md`** - Comprehensive guide to using the config system
3. **`IMPLEMENTATION-EXAMPLES.md`** - Before/after code examples for migration
4. **`CONFIG-README.md`** - This file (quick reference)

## 🚀 For New Clients (3 Steps)

1. **Add your client config** to `client-config.js`:
   ```javascript
   const CLIENT_CONFIGS = {
     inverta: { /* existing */ },

     yourclient: {
       name: 'YOUR CLIENT',
       displayName: 'Your Client - La-La Land',
       defaultCommunity: 'phase1',
       // ... copy structure from inverta and modify
     }
   };
   ```

2. **Update the client identifier** in `index-beta.html`:
   ```html
   <script src="client-config.js"></script>
   <script>
     const CURRENT_CLIENT = 'yourclient';  // ← Change this
     const CONFIG = getClientConfig(CURRENT_CLIENT);
   </script>
   ```

3. **Test everything** - All values will now load from your config!

## 📋 What's Configurable?

Everything client-specific:

### Branding
- Company name & display name
- Main logo & community logos
- Colors & fonts
- Favicon

### Map Settings
- Mapbox token URL
- Initial center & zoom
- Aerial image overlay
- Map style

### Communities/Developments
- Names & display names
- Coordinates (center points)
- Zoom levels
- Position in menus

### Data Sources
- Lots file URL
- 360° frames directory
- Any other data URLs

### Contact Info
- WhatsApp number
- CTA messages
- Payment info messages
- UTM tracking parameters

### Naming Conventions
- Lot ID prefixes (e.g., "lotinverta", "lotinvertap")
- Share URL format
- Share text template

## 🔧 Current Implementation Status

### ✅ Created
- [x] Configuration file structure
- [x] Helper functions for common tasks
- [x] Documentation and examples
- [x] Configuration for Inverta (current client)

### ⚠️ Next Steps (To Implement)
- [ ] Update `index-beta.html` to load and use config
- [ ] Replace hardcoded values with config references
- [ ] Test all features with config system
- [ ] Verify community switching works
- [ ] Test share URLs generate correctly
- [ ] Verify WhatsApp links work

## 📖 Documentation

### Quick Reference

| Need to... | See... |
|------------|--------|
| Understand the system | `CLIENT-CONFIG-GUIDE.md` |
| Add a new client | `CLIENT-CONFIG-GUIDE.md` → "Adding a New Client" |
| Replace hardcoded values | `IMPLEMENTATION-EXAMPLES.md` |
| Find specific examples | `IMPLEMENTATION-EXAMPLES.md` → Table of Contents |
| Troubleshoot issues | `CLIENT-CONFIG-GUIDE.md` → "Troubleshooting" |

### Helper Functions

```javascript
// Get config object
const config = getClientConfig('inverta');

// Get community logo URL
const logoUrl = getCommunityLogo('inverta', 'marsella');

// Get community data
const community = getCommunityByFracc('inverta', 'barcelona');

// Get all communities (for menus)
const allCommunities = getAllCommunities('inverta');

// Build share URL
const url = buildShareUrl('inverta', '10-1', 'marsella', 20, 12);

// Build share text
const text = buildShareText('inverta', '10-1', 'Marsella');

// Extract lot number
const lotNum = extractLotNumber('inverta', 'lotinverta10-1');
```

## 🔍 Where Values Are Used

### In `index-beta.html`, replace:

| Hardcoded Value | Config Reference | Used For |
|-----------------|------------------|----------|
| `'INVERTA'` | `CONFIG.name` | Headers, fallback text |
| `'INVERTA - La-La Land'` | `CONFIG.displayName` | Page title |
| `'marsella'` | `CONFIG.defaultCommunity` | Default fallback |
| `'https://la-la.land/inverta/inverta.svg'` | `CONFIG.branding.mainLogo` | Main logo |
| `'https://la-la.land/inverta/lots.txt'` | `CONFIG.data.lotsFile` | Data source |
| `'https://la-la.land/inverta/frames/'` | `CONFIG.data.framesBase` | 360° images |
| `'https://la-la.land/mapbox.txt'` | `CONFIG.mapbox.tokenUrl` | Mapbox token |
| `[-96.038183, 19.047528]` | `CONFIG.mapbox.initialView.center` | Initial map |
| `16.4` | `CONFIG.mapbox.initialView.zoom` | Initial zoom |
| `'5218185261819'` | `CONFIG.contact.whatsapp.number` | WhatsApp link |

## 🎨 Configuration Structure

```javascript
{
  name: 'CLIENT',
  displayName: 'Client - La-La Land',
  defaultCommunity: 'default',

  branding: {
    mainLogo: 'url',
    mainLogoAlt: 'alt text',
    favicon: 'favicon.ico'
  },

  communityLogos: {
    'group': {
      url: 'url',
      communities: ['comm1', 'comm2']
    }
  },

  mapbox: {
    tokenUrl: 'url',
    style: 'mapbox://...',
    initialView: {
      center: [lng, lat],
      zoom: 16
    }
  },

  aerialImage: {
    url: 'url',
    layerId: 'id',
    sourceId: 'id',
    message: 'text',
    bounds: [[lng,lat], ...]
  },

  communities: {
    communityname: {
      id: 'id',
      name: 'Name',
      displayName: 'Display Name',
      fracc: 'fracc_id',
      center: [lng, lat],
      zoom: 16,
      position: 1,
      searchMenuId: 'menuId'
    }
  },

  data: {
    lotsFile: 'url',
    framesBase: 'url'
  },

  lotPrefixes: {
    standard: 'lotclient',
    premium: 'lotclientp',
    base: 'client'
  },

  contact: {
    whatsapp: {
      number: '1234567890',
      defaultMessage: 'text',
      utmSource: 'source',
      utmMedium: 'medium',
      utmCampaign: 'campaign'
    },
    paymentMessage: 'text'
  },

  share: {
    urlTemplate: '/client/lot/{communitySlug}-{lotNumber}.html',
    textTemplate: 'Share {lotNumber} in {community}'
  },

  toaster: {
    aerialImageLoaded: 'message'
  },

  misc: {
    fontFamily: 'Font Name',
    ctaMessage: 'text',
    ctaColor: '#color'
  }
}
```

## 🧪 Testing Checklist

After implementing config in index-beta.html:

- [ ] Page loads without errors
- [ ] Page title is correct
- [ ] Main logo displays
- [ ] Map initializes at correct location
- [ ] Aerial image overlay appears
- [ ] Community selector shows all communities
- [ ] Community logos switch correctly
- [ ] Clicking communities centers map correctly
- [ ] Default fallbacks work (close modal, reload page)
- [ ] WhatsApp link uses correct number
- [ ] Share URLs generate correctly
- [ ] Lot data loads
- [ ] 360° viewer works
- [ ] All text shows client name correctly

## 🐛 Common Issues

### Config not loading
```javascript
// Check console for errors
console.log('CONFIG:', CONFIG);

// Verify client name matches
console.log('Keys:', Object.keys(CLIENT_CONFIGS));
```

### Wrong values showing
- Hard refresh browser (Ctrl+Shift+R)
- Check that `CURRENT_CLIENT` matches config key
- Verify you're using `CONFIG.path` not hardcoded values

### Communities not working
- Check `fracc` values match your lot data
- Verify coordinates are [longitude, latitude] (not reversed)
- Ensure `defaultCommunity` exists in `communities` object

## 💡 Examples

### Example: Barcelona Community Config
```javascript
barcelona: {
  id: 'barcelona',
  name: 'Barcelona',
  displayName: 'Barcelona',
  fracc: 'barcelona',
  center: [-96.035272, 19.046439],
  zoom: 16.2,
  position: 2,
  searchMenuId: 'positionFour'
}
```

### Example: Using in Code
```javascript
// Before
const center = [-96.035272, 19.046439];
const zoom = 16.2;

// After
const community = CONFIG.communities.barcelona;
const center = community.center;
const zoom = community.zoom;
```

## 📞 Support

For questions or issues:
1. Check `CLIENT-CONFIG-GUIDE.md` for detailed info
2. Check `IMPLEMENTATION-EXAMPLES.md` for code examples
3. Search for similar patterns in existing code
4. Add console.logs to debug config loading

## 🎯 Benefits

✅ **Single source of truth** - All client data in one place
✅ **Easy onboarding** - Copy config, change values, done
✅ **No more searching** - Update config, not code
✅ **Consistency** - Same structure for all clients
✅ **Maintainability** - Changes in one place
✅ **Scalability** - Add unlimited clients easily

## 📝 Next Actions

1. Review the configuration in `client-config.js`
2. Start implementing in `index-beta.html` using examples from `IMPLEMENTATION-EXAMPLES.md`
3. Test each section as you implement it
4. Use the testing checklist to verify everything works
5. Once working for Inverta, duplicate for your next client!

---

**Ready to implement?** Start with `IMPLEMENTATION-EXAMPLES.md` for step-by-step code changes!
