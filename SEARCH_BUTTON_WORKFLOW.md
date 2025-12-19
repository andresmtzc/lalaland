# Search Button Design Workflow

## Overview
This workflow allows you to design the community search button in `search.html` and apply those settings to `/inverta/index.html`.

---

## Step-by-Step Guide

### 1. Design in search.html
1. Open `search.html` in your browser
2. Use the sliders and controls to design your button:
   - **Main Dots Settings**: count, radius, size, rotation, animation delay
   - **Mini-Dots Settings**: enable/disable, count, radius, size, rotation
   - **Show/Hide Controls**: toggle individual dots and mini-dots
3. Click the center button to preview the animation

### 2. Export Configuration
1. Scroll down to the **"Export Configuration"** section
2. Click **"📋 Copy Configuration JSON"**
3. The JSON will be automatically copied to your clipboard
4. It will also display on screen for reference

### 3. Update client-config.js
1. Open `/inverta/client-config.js`
2. Find the `searchButton` section (around line 269)
3. **Replace** the entire `searchButton` object with your exported JSON
4. Save the file

Example:
```javascript
searchButton: {
  // Paste your exported JSON here
  mainDots: {
    count: 8,
    radius: 120,  // Your custom values
    size: 48,
    // ... etc
  },
  // ... rest of config
}
```

### 4. ✅ Already Applied!

The configuration is **automatically applied** when the page loads!

In `inverta/index.html` (line ~63), this code runs on every page load:
```javascript
// Apply search button settings to CSS variables
if (CONFIG.searchButton) {
  applySearchButtonToCSS(CURRENT_CLIENT);
}
```

So whenever you update the config and refresh the page, your new design is automatically loaded!

---

## What Gets Configured

### CSS (Automatic via CSS Variables)
The following CSS variables are set automatically from config:
- `--btn` - Center button size
- `--orbit-radius` - Main dots orbit radius (number)
- `--orbit-diam` - Orbit diameter (calculated: radius × 2)
- `--dot` - Main dot size
- `--rotate-deg` - Rotation angle
- `--mini-orbit-radius` - Mini-dots orbit radius
- `--mini-dot` - Mini-dot size

### Existing Functionality Preserved ✅
**All existing button functionality still works:**
- Location navigation (flying to communities)
- Button animations and transitions
- Hover effects
- Mobile responsiveness
- All existing CSS classes in `styles.css`

The only thing that changes is the **design values** (sizes, positions) now come from the config instead of being hardcoded.

### JavaScript (Read from Config)
Your existing JavaScript in `inverta/index.html` can read from the config:

```javascript
const btnConfig = getSearchButtonConfig(CURRENT_CLIENT);

if (btnConfig) {
  // Use btnConfig.mainDots.count
  // Use btnConfig.mainDots.animationDelay
  // Use btnConfig.mainDots.visibility
  // etc.
}
```

---

## Example Usage

### Complete Integration Example:

```javascript
// In your inverta/index.html, early in the script:
(function() {
  const CURRENT_CLIENT = 'inverta';

  // Apply color variables
  applyColorsToCSS(CURRENT_CLIENT);

  // Apply search button variables
  applySearchButtonToCSS(CURRENT_CLIENT);

  // Get the config for use in JS
  const btnConfig = getSearchButtonConfig(CURRENT_CLIENT);

  // Now use btnConfig to set up your menu
  setupCommunitySearchMenu(btnConfig);
})();
```

---

## File Structure

```
lalaland/
├── search.html                    # Design tool (standalone)
├── inverta/
│   ├── index.html                 # Production site
│   └── client-config.js          # Configuration storage
└── SEARCH_BUTTON_WORKFLOW.md     # This file
```

---

## Notes

- **CSS**: All styling is handled via CSS variables, no CSS changes needed
- **HTML**: The button HTML structure remains the same
- **JS**: Existing JavaScript logic remains unchanged, just reads from config
- **Colors**: Continue using `var(--color-*)` CSS variables for colors
- **Design Changes**: Any time you want to redesign, just repeat steps 1-3

---

## Troubleshooting

**Button not updating?**
- Make sure `applySearchButtonToCSS(CURRENT_CLIENT)` is called
- Check browser console for any errors
- Verify the JSON was pasted correctly in client-config.js

**JSON format errors?**
- Ensure proper comma placement in client-config.js
- Use a JSON validator if needed
- The exported JSON should be valid - just paste it directly

**Want to reset?**
- Go back to search.html with default values
- Export and replace again
