# Dot & Mini-Dot Mapping Guide

## Overview

The search button supports two-level navigation:
1. **Main Dots** - Can be labels (groups) or direct community links
2. **Mini-Dots** - Appear under main dots, always link to communities

---

## Visual Reference

```
        Position 0 (Top)
              ↑
              |
    7 ←───────┼───────→ 1
    (TopLeft) │    (TopRight)
              │
    6 ←───────●───────→ 2
    (Left)  Center   (Right)
              │
    5 ←───────┼───────→ 3
 (BottomLeft) │  (BottomRight)
              |
              ↓
        Position 4 (Bottom)
```

**Positions go clockwise: 0=Top, 1=TopRight, 2=Right, 3=BottomRight, 4=Bottom, 5=BottomLeft, 6=Left, 7=TopLeft**

---

## Configuration

### In `client-config.js` → `searchButton` section:

```javascript
searchButton: {
  // ... other settings ...

  // MAIN DOT MAPPING
  dotMapping: {
    0: null,                // Empty
    1: 'Mediterráneo',      // Label (will have mini-dots)
    2: 'marsella',          // Direct community link
    3: null,
    4: null,
    5: null,
    6: 'Punto Lomas',       // Label (will have mini-dots)
    7: null
  },

  // MINI-DOT MAPPING (under each main dot)
  miniDotMapping: {
    1: {  // Mini-dots for position 1 (Mediterráneo)
      0: 'marsella',      // Top mini-dot
      2: 'barcelona',     // Right mini-dot
      // Other positions empty
    },
    6: {  // Mini-dots for position 6 (Punto Lomas)
      0: 'sierraalta',    // Top mini-dot
      2: 'sierrabaja',    // Right mini-dot
    }
  }
}
```

---

## How It Works

### Option 1: Direct Community Link
```javascript
dotMapping: {
  2: 'marsella'  // Community ID from CONFIG.communities
}
```
- Clicking this dot **immediately navigates** to Marsella
- No mini-dots appear

### Option 2: Label with Mini-Dots
```javascript
dotMapping: {
  1: 'Mediterráneo'  // Not a community ID = it's a label
},
miniDotMapping: {
  1: {  // Must match the dot position
    0: 'marsella',
    2: 'barcelona'
  }
}
```
- Clicking the main dot **shows/hides mini-dots**
- Clicking a mini-dot **navigates** to that community

### Option 3: Empty Position
```javascript
dotMapping: {
  0: null  // Nothing at this position
}
```
- Position remains empty

---

## Step-by-Step Setup

### 1. Design Your Layout
Open `search.html` and experiment with:
- Number of main dots
- Number of mini-dots per main dot
- Sizes, spacing, rotation
- Show/hide specific dots

### 2. Export Configuration
Click "📋 Copy Configuration JSON"

### 3. Update Config
Paste into `client-config.js` → `searchButton`

### 4. Map Communities

**For direct links:**
```javascript
dotMapping: {
  2: 'marsella'  // Use community ID
}
```

**For grouped navigation:**
```javascript
dotMapping: {
  1: 'My Group Label'  // Any text
},
miniDotMapping: {
  1: {
    0: 'marsella',
    2: 'barcelona'
  }
}
```

### 5. Refresh & Test
Open your site and test the navigation!

---

## Tips

### Position Numbering
- Both main dots and mini-dots use **0-7 positions**
- Both go **clockwise starting at top**
- Position 0 = 12 o'clock

### Community IDs
Must match exactly what's in `CONFIG.communities`:
- ✅ `'marsella'` (lowercase, matches config)
- ❌ `'Marsella'` (won't match)
- ❌ `'marseille'` (typo)

### Labels vs Community IDs
The code checks if `dotMapping[i]` exists in `CONFIG.communities`:
- If **found** → Direct navigation
- If **not found** → Treated as a label, shows mini-dots

### Mini-Dot Colors
Currently mini-dots use blue (`#60a5fa`). To customize:
Edit `styles.css` → `.mini-community-option { background: ... }`

---

## Example Configurations

### Example 1: All Direct Links
```javascript
dotMapping: {
  0: 'marsella',
  2: 'barcelona',
  4: 'sierraalta',
  6: 'sierrabaja'
},
miniDotMapping: {}  // No mini-dots needed
```

### Example 2: Grouped by Region
```javascript
dotMapping: {
  1: 'Mediterráneo',
  6: 'Punto Lomas'
},
miniDotMapping: {
  1: { 0: 'marsella', 2: 'barcelona' },
  6: { 0: 'sierraalta', 2: 'sierrabaja' }
}
```

### Example 3: Mixed
```javascript
dotMapping: {
  0: 'marsella',        // Direct link at top
  2: 'All Properties',  // Label at right
  4: 'barcelona'        // Direct link at bottom
},
miniDotMapping: {
  2: {  // Mini-dots for "All Properties"
    0: 'sierraalta',
    2: 'sierrabaja',
    4: 'marsella',
    6: 'barcelona'
  }
}
```

---

## Troubleshooting

**Dot not appearing?**
- Check that `dotMapping[position]` is not `null`
- Verify community ID matches exactly

**Mini-dots not showing?**
- Make sure the main dot is a **label** (not a community ID)
- Check `miniDotMapping[mainDotPosition]` exists
- Verify mini-dot community IDs are correct

**Navigation not working?**
- Check browser console for errors
- Verify community has `center` and `zoom` in CONFIG
- Test with `console.log(CONFIG.communities.marsella)`

**Wrong position?**
Remember: 0=Top, going clockwise. Count carefully!

---

## Quick Reference

```
Position Guide (looking at the circle):
         0
    7         1
  6     ●     2
    5         3
         4

Community IDs (current):
- marsella
- barcelona
- sierraalta
- sierrabaja
```
