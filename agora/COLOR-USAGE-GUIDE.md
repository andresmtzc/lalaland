# Color Configuration Usage Guide

This guide shows how to use colors defined in `client-config.js` instead of hardcoded hex values.

## Overview

All colors are now centralized in the `colors` section of `client-config.js`. This makes it easy to:
- Rebrand the site by changing colors in one place
- Maintain consistent colors across the entire application
- Quickly customize for different clients

## Available Colors

See `client-config.js` for the complete list of available colors including:
- `primary` - Main CTA and accent color (#ff8400)
- `cream` - Background and button text (#fcfaf3)
- `textDark`, `textMedium`, `textLight` - Text colors
- `success`, `error`, `info` - Status colors
- And many more...

## Usage Methods

### Method 1: Using CSS Variables (Recommended)

Apply colors as CSS variables once during page load:

```javascript
// In your page initialization (add to index.html after CONFIG is loaded)
applyColorsToCSS(CURRENT_CLIENT);
```

Then use in CSS or inline styles:

```html
<!-- In HTML inline styles -->
<div style="color: var(--color-primary); background: var(--color-cream);">
  Hello World
</div>

<!-- In CSS (if you have a stylesheet) -->
<style>
  .my-button {
    background-color: var(--color-primary);
    color: var(--color-cream);
  }
</style>
```

### Method 2: Using getColor() Function

Get individual colors in JavaScript:

```javascript
// Get a single color
const primaryColor = getColor(CURRENT_CLIENT, 'primary');

// Use in inline styles
element.style.backgroundColor = getColor(CURRENT_CLIENT, 'primary');
element.style.color = getColor(CURRENT_CLIENT, 'cream');

// Use in dynamic content
const html = `<div style="color: ${CONFIG.colors.primary};">Text</div>`;
```

### Method 3: Direct Access via CONFIG Object

Since CONFIG is global, you can access colors directly:

```javascript
// Direct access (after CONFIG is loaded)
const primaryColor = CONFIG.colors.primary;
const textColor = CONFIG.colors.textDark;

// Use in template strings
const button = `
  <button style="background: ${CONFIG.colors.primary}; color: ${CONFIG.colors.cream};">
    Click Me
  </button>
`;
```

## Migration Examples

### Before (Hardcoded):
```javascript
element.style.backgroundColor = '#ff8400';
```

### After (Using Config):
```javascript
element.style.backgroundColor = CONFIG.colors.primary;
```

---

### Before (Hardcoded):
```html
<div style="color: #8a8880;">Loading...</div>
```

### After (Using CSS Variable):
```html
<div style="color: var(--color-textLight);">Loading...</div>
```

---

### Before (Hardcoded):
```javascript
map.addLayer({
  id: 'view-cone-fill',
  type: 'fill',
  paint: { 'fill-color': '#ff8400', 'fill-opacity': 0.5 }
});
```

### After (Using Config):
```javascript
map.addLayer({
  id: 'view-cone-fill',
  type: 'fill',
  paint: { 'fill-color': CONFIG.colors.viewConeFill, 'fill-opacity': 0.5 }
});
```

## Implementation Steps

1. **Add initialization** - In `index.html`, after CONFIG is loaded, add:
   ```javascript
   // Apply colors to CSS variables (right after CONFIG is loaded)
   if (CONFIG && CONFIG.colors) {
     applyColorsToCSS(CURRENT_CLIENT);
   }
   ```

2. **Replace hardcoded colors** - Update your code gradually:
   - For new code: Always use `CONFIG.colors.colorKey` or `var(--color-colorKey)`
   - For existing code: Replace hardcoded hex values as you encounter them

3. **Test thoroughly** - Verify colors appear correctly across all pages and components

## Color Categories

### Primary Brand
- `primary` - Main orange (#ff8400)
- `primaryLight` - Coral (#ff6b6b)
- `cream` - Cream/Beige (#fcfaf3)

### Text
- `textDark` - Primary text (#1a1a1a)
- `textMedium` - Secondary text (#333)
- `textLight` - Tertiary text (#8a8880)
- `textTan` - Units/superscript (#b18d69)
- `textBrown` - Special headings (#a17345)

### Neutrals
- `white` (#fff)
- `grayLight` (#e0e0e0)
- `grayVeryLight` (#f0f0f0)
- `grayMedium` (#888)
- `grayDark` (#525252)

### Status
- `success` - Teal (#43bea9)
- `error` - Red (#f44336)
- `info` - Blue (#4285F4)

### Map/GIS
- `lotMarkerDefault`, `lotMarkerSelected`, etc.
- `viewConeFill`, `viewConeStroke`
- `gpsMarker`, `gpsMarkerBg`

## Tips

- Use descriptive color names (e.g., `primary`) rather than hex codes for better readability
- CSS variables work in most modern browsers and are the cleanest approach
- For Mapbox styles, use `CONFIG.colors.colorKey` directly in the paint properties
- When creating new components, always reference the color config
