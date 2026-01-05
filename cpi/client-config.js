/**
 * ===== CLIENT CONFIGURATION FILE =====
 *
 * This file contains all client-specific naming conventions, coordinates,
 * logos, and settings. When onboarding a new client, simply duplicate this
 * file and update the values below.
 *
 * Usage:
 * 1. Set CURRENT_CLIENT in index-beta.html to match the config key
 * 2. All client-specific values will be loaded from this configuration
 */

const CLIENT_CONFIGS = {

  // ===== INVERTA CLIENT CONFIGURATION =====
  cpi: {

    // ----- BASIC INFO -----
    name: 'CPI',
    displayName: 'CPI - La-La Land',
    slug: 'cpi', // URL path slug (e.g., /inverta/)
    defaultCommunity: 'senterra',

    // ----- BRANDING -----
    branding: {
      mainLogo: 'https://la-la.land/cpi/cpi.png',
      mainLogoAlt: 'Logo',
      favicon: 'favicon.ico',
    },

    // ----- COMMUNITY LOGOS -----
    // Maps community groups to their respective logos
    communityLogos: {
      'senterra': {
        // For marsella & barcelona
        url: 'https://la-la.land/cpi/senterra.png', // Original for index.html
        cardLogoUrl: 'https://la-la.land/inverta/lomasmediterraneo_black.png', // Black version for cards
        communities: ['senterra']
      }
    },

    // ----- MAPBOX SETTINGS -----
    mapbox: {
      tokenUrl: 'https://la-la.land/mapbox.txt',
      style: 'mapbox://styles/andresmtzc/cmgpy4sy8005101qo65pf7ve2',

      // Initial map view (can be overridden by default community)
      initialView: {
        center: [-99.944337, 25.14729], // Senterra center
        zoom: 14.4
      }
    },

    // ----- AERIAL/SATELLITE IMAGES -----
    aerialImages: [
      {
        url: 'https://la-la.land/cpi/cpiearth.png',
        layerId: 'drone-satellite-layer-1',
        sourceId: 'drone-satellite-1',
        message: "Cargamos la imágen aérea más actual — (abril 2025)",
        bounds: [
[-99.957455, 25.153182],
[-99.937867, 25.153182],
[-99.937867, 25.142425],
[-99.957455, 25.142425]
        ]
      }
    ],

    // ----- COMMUNITIES/DEVELOPMENTS -----
    // Each community has center coordinates, zoom level, and display info
    communities: {

      senterra: {
        id: 'senterra',
        name: 'Senterra',
        displayName: 'Senterra',
        fracc: 'senterra',
        center: [-99.948236, 25.147828],
        zoom: 14.4,
        position: 0, // Position in community selector
        // Alternative reference for search menu:
        searchMenuId: 'positionOne'
      }



    },

    // ----- DATA SOURCES -----
    data: {
      lotsFile: 'https://la-la.land/cpi/lots.txt',
      framesBase: 'https://la-la.land/cpi/frames/'
    },

    // ----- LOT NAMING CONVENTIONS -----
    // Prefixes used in lot IDs
    lotPrefixes: {
      standard: 'lotcpi1-',  // e.g., lotinverta10-1
      premium: 'lotcpip1-',  // e.g., lotinvertap10-1
      base: 'cpi1-'          // Used in some contexts
    },

    // ----- CONTACT & CTA -----
    contact: {
      whatsapp: {
        number: '5218185261819',
        defaultMessage: '¿Tienes dudas? ¡Chatea con nosotros por WhatsApp!',
        // UTM parameters for tracking
        utmSource: 'website',
        utmMedium: 'toaster',
        utmCampaign: 'lead_generation'
      },

      // Bank account info message (displayed in modals)
      paymentMessage: '(se te proporcionarán las cuentas bancarias oficiales de CPI a través de WhatsApp).'
    },

    // ----- SHARE SETTINGS -----
    share: {
      // Template for share URLs: /{slug}/lot/{community}-{lotNumber}.html
      urlTemplate: '/{slug}/lot/{communitySlug}-{lotNumber}.html',
      // Template for share text
      textTemplate: 'Te comparto el Lote {lotNumber} de {community} - {name}'
    },

    // ----- TOASTER MESSAGES -----
    toaster: {
      aerialImageLoaded: 'Loaded most recent aerial image (March 2025)'
    },

    // ----- COLORS -----
    // All colors used throughout the site for easy customization
    colors: {
      // Primary brand colors
      primary: '#9ea516',        // Orange - main CTA and accent color
      primaryLight: '#ff6b6b',   // Coral - view cone outlines
      cream: '#fcfaf3',          // Cream/Beige - backgrounds and button text

      // Text colors
      textDark: '#1a1a1a',       // Almost black - primary text
      textMedium: '#333',        // Dark gray - secondary elements
      textLight: '#8a8880',      // Grayish - tertiary text, labels
      textTan: '#b18d69',        // Tan - superscript, units
      textBrown: '#a17345',      // Brown - headings, special text

      // Neutral colors
      black: '#000',             // Pure black - rare use cases
      white: '#fff',             // White - backgrounds, strokes
      offWhite: '#fffdf8',       // Off-white - subtle backgrounds
      creamLight: '#f2efe4',     // Light cream - backgrounds
      grayLightest: '#ddd',      // Lightest gray - subtle borders
      grayVeryLight: '#f0f0f0',  // Very light gray - subtle backgrounds
      grayVeryLight2: '#f3f3f3', // Another very light gray variant
      grayLight: '#e0e0e0',      // Light gray - dividers, borders
      grayLight2: '#c0c0c0',     // Light gray alt - borders
      gray777: '#777',           // Medium-light gray - FAQ sources
      gray666: '#666',           // Medium gray - text
      gray555: '#555',           // Medium-dark gray - text
      gray444: '#444',           // Dark gray - text
      grayMedium: '#888',        // Medium gray - icons, inactive elements
      grayMediumAlt: '#a0a0a0',  // Medium gray alt - UI elements
      grayDark: '#525252',       // Dark gray - commission displays
      grayDark2: '#323232',      // Darker gray - backgrounds
      grayDark3: '#2a2a2a',      // Very dark gray - backgrounds

      // Status & feedback colors
      success: '#43bea9',        // Teal - sold lots, positive changes
      error: '#f44336',          // Red - errors, delete actions
      info: '#4285F4',           // Blue - tracks, info elements
      infoLight: '#f0f7ff',      // Light blue - info backgrounds
      whatsapp: '#25d366',       // WhatsApp green - contact buttons
      cyan: '#22d3ee',           // Cyan - accent elements
      brown: '#8B4513',          // Brown - lot markers without images
      brownAlt: '#8a5f38',       // Brown alt - UI elements
      tan: '#ac8f5f',            // Tan - UI elements
      tanLight: '#a9a698',       // Light tan - backgrounds
      tanLight2: '#d8cbbc',      // Very light tan - backgrounds

      // Overlay & transparency colors
      overlayDark: 'rgba(0,0,0,.92)',      // Very dark overlay - viewers
      overlayMedium: 'rgba(0,0,0,.45)',    // Medium overlay - gradients
      overlayLight: 'rgba(0,0,0,.35)',     // Light overlay - gradients
      overlaySubtle: 'rgba(0,0,0,0.40)',   // Subtle overlay - backgrounds
      overlaySoft: 'rgba(0,0,0,0.3)',      // Soft overlay
      overlayFaint: 'rgba(0,0,0,0.1)',     // Faint overlay
      overlayHover: 'rgba(0,0,0,0.15)',    // Hover darkening - works with any color
      transparent: 'rgba(0,0,0,0)',        // Fully transparent
      textHalo: 'rgba(0,0,0,0.6)',         // Semi-transparent black - text halos for labels

      // Primary color variations with alpha
      primaryFull: 'rgba(255,132,0,1)',      // Primary solid
      primaryFaint: 'rgba(255, 132, 0, 0.1)',  // Primary very light
      primaryPale: 'rgba(255, 132, 0, 0.05)',  // Primary extremely light

      // Success color variations
      successPale: 'rgba(67, 190, 169, 0.05)', // Success extremely light

      // Gray color variations
      grayDarkPale: 'rgba(82, 82, 82, 0.05)',  // Dark gray extremely light

      // Map & GIS colors
      lotMarkerDefault: '#8B4513',     // Brown - default lot marker
      lotMarkerSelected: '#ff8400',    // Orange - selected lot
      lotMarkerWithImage: 'rgba(52, 168, 83, 0)', // Transparent green
      viewConeFill: '#ff8400',         // Orange - view cone fill
      viewConeStroke: '#ff6b6b',       // Coral - view cone outline
      lotBorderHighlight: '#ff8400',   // Orange - lot borders
      gpsMarker: '#1a73e8',            // Blue - GPS location
      gpsMarkerBg: '#1a73e826',        // Blue transparent - GPS background

      // Debug colors (not typically used in production)
      debugGreen: '#00ff00',           // Pure green - debugging
      debugYellow: '#ffff00'           // Pure yellow - debugging
    },

    // ----- MISCELLANEOUS -----
    misc: {
      // Font family for the site
      fontFamily: 'Barlow Condensed',

      // Default CTA message
      ctaMessage: '¡Fácil, rápido y sin complicaciones!',
      ctaColor: '#ff8400' // DEPRECATED: Use colors.primary instead
    }

  }

  // ===== ADD NEW CLIENTS BELOW =====
  //
  // Example for a new client:
  //
  // newclient: {
  //   name: 'NEWCLIENT',
  //   displayName: 'New Client - La-La Land',
  //   defaultCommunity: 'phase1',
  //
  //   branding: {
  //     mainLogo: 'https://la-la.land/newclient/logo.svg',
  //     mainLogoAlt: 'New Client Logo',
  //     favicon: 'favicon.ico',
  //   },
  //
  //   ... (copy and modify structure from inverta)
  // }

};

// ===== HELPER FUNCTIONS =====

/**
 * Get the current client configuration
 * @param {string} clientName - The client identifier (e.g., 'inverta')
 * @returns {object} Client configuration object
 */
function getClientConfig(clientName) {
  const config = CLIENT_CONFIGS[clientName];
  if (!config) {
    console.error(`❌ Client config not found for: ${clientName}`);
    return null;
  }
  return config;
}

/**
 * Get community logo URL based on current fracc/community
 * @param {string} clientName - The client identifier
 * @param {string} fraccName - The fraccionamiento/community name
 * @param {boolean} forCard - If true, returns cardLogoUrl (black version), otherwise returns url (original)
 * @returns {string} Logo URL
 */
function getCommunityLogo(clientName, fraccName, forCard = false) {
  const config = getClientConfig(clientName);
  if (!config) return null;

  const fracc = fraccName.toLowerCase().trim();

  // Search through community logo groups
  for (const [groupName, logoData] of Object.entries(config.communityLogos)) {
    if (logoData.communities.includes(fracc)) {
      return forCard ? (logoData.cardLogoUrl || logoData.url) : logoData.url;
    }
  }

  // Return first logo as default
  const firstLogo = Object.values(config.communityLogos)[0];
  if (!firstLogo) return null;
  return forCard ? (firstLogo.cardLogoUrl || firstLogo.url) : firstLogo.url;
}

/**
 * Get community data by fracc name
 * @param {string} clientName - The client identifier
 * @param {string} fraccName - The fraccionamiento/community name
 * @returns {object} Community configuration object
 */
function getCommunityByFracc(clientName, fraccName) {
  const config = getClientConfig(clientName);
  if (!config) return null;

  const fracc = fraccName.toLowerCase().trim();
  return config.communities[fracc] || null;
}

/**
 * Get all communities as array (useful for search menus)
 * @param {string} clientName - The client identifier
 * @returns {array} Array of community objects with all properties
 */
function getAllCommunities(clientName) {
  const config = getClientConfig(clientName);
  if (!config) return [];

  return Object.values(config.communities).map(comm => ({
    id: comm.searchMenuId || comm.id,
    label: comm.displayName,
    center: comm.center,
    zoom: comm.zoom,
    fracc: comm.fracc,
    position: comm.position
  }));
}

/**
 * Build share URL for a lot
 * @param {string} clientName - The client identifier
 * @param {string} lotNumber - The lot number
 * @param {string} communitySlug - The community slug
 * @param {number} downPayment - Down payment percentage
 * @param {number} installments - Number of installments
 * @returns {string} Complete share URL
 */
function buildShareUrl(clientName, lotNumber, communitySlug, downPayment, installments) {
  const config = getClientConfig(clientName);
  if (!config) return '';

  const path = config.share.urlTemplate
    .replace('{communitySlug}', communitySlug)
    .replace('{lotNumber}', lotNumber);

  return `${window.location.origin}${path}?a=${downPayment}&m=${installments}`;
}

/**
 * Build share text for a lot
 * @param {string} clientName - The client identifier
 * @param {string} lotNumber - The lot number
 * @param {string} communityName - The community display name
 * @returns {string} Share text
 */
function buildShareText(clientName, lotNumber, communityName) {
  const config = getClientConfig(clientName);
  if (!config) return '';

  return config.share.textTemplate
    .replace('{lotNumber}', lotNumber)
    .replace('{community}', communityName);
}

/**
 * Extract lot number from lot name based on client prefixes
 * @param {string} clientName - The client identifier
 * @param {string} lotName - The full lot name (e.g., 'lotinverta10-1')
 * @returns {string} Clean lot number
 */
function extractLotNumber(clientName, lotName) {
  const config = getClientConfig(clientName);
  if (!config) return lotName;

  let cleanName = lotName;
  const prefixes = config.lotPrefixes;

  // Remove all known prefixes
  for (const prefix of Object.values(prefixes)) {
    const regex = new RegExp(`^${prefix}`, 'i');
    cleanName = cleanName.replace(regex, '');
  }

  // Also remove 'lot' prefix if still present
  cleanName = cleanName.replace(/^lot/i, '');

  // Remove 'p' suffix for premium lots
  cleanName = cleanName.replace(/^p/i, '');

  return cleanName;
}

/**
 * Get a color value from client configuration
 * @param {string} clientName - The client identifier
 * @param {string} colorKey - The color key (e.g., 'primary', 'textDark', 'success')
 * @returns {string} Color hex code or rgba value
 */
function getColor(clientName, colorKey) {
  const config = getClientConfig(clientName);
  if (!config || !config.colors) return '#000000';
  return config.colors[colorKey] || '#000000';
}

/**
 * Apply colors from config to CSS custom properties (CSS variables)
 * Call this function early in your page load to make colors available as CSS variables
 * @param {string} clientName - The client identifier
 */
function applyColorsToCSS(clientName) {
  const config = getClientConfig(clientName);
  if (!config || !config.colors) return;

  const root = document.documentElement;
  for (const [key, value] of Object.entries(config.colors)) {
    root.style.setProperty(`--color-${key}`, value);
  }

  console.log('✅ Colors applied to CSS variables');
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CLIENT_CONFIGS,
    getClientConfig,
    getCommunityLogo,
    getCommunityByFracc,
    getAllCommunities,
    buildShareUrl,
    buildShareText,
    extractLotNumber,
    getColor,
    applyColorsToCSS
  };
}