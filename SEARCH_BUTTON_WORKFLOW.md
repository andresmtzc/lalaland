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

### 4. Apply to inverta/index.html

The configuration will automatically be applied via CSS variables. You need to call this function early in your page:

```javascript
// After CONFIG is loaded
applySearchButtonToCSS(CURRENT_CLIENT);
```

This should be called alongside:
```javascript
applyColorsToCSS(CURRENT_CLIENT);
```

---

## What Gets Configured

### CSS (Automatic via CSS Variables)
The following CSS variables are set automatically:
- `--btn` - Center button size
- `--orbit-radius` - Main dots orbit radius
- `--dot` - Main dot size
- `--rotate-deg` - Rotation angle
- `--mini-orbit-radius` - Mini-dots orbit radius
- `--mini-dot` - Mini-dot size

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
