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
  inverta: {

    // ----- BASIC INFO -----
    name: 'INVERTA',
    displayName: 'INVERTA - La-La Land',
    slug: 'inverta', // URL path slug (e.g., /inverta/)
    defaultCommunity: 'marsella',

    // ----- BRANDING -----
    branding: {
      mainLogo: 'https://la-la.land/inverta/inverta.svg',
      mainLogoAlt: 'Logo',
      favicon: 'favicon.ico',
    },

    // ----- COMMUNITY LOGOS -----
    // Maps community groups to their respective logos
    communityLogos: {
      'mediterraneo': {
        // For marsella & barcelona
        url: 'https://la-la.land/inverta/lomasmediterraneo.svg',
        communities: ['marsella', 'barcelona']
      },
      'puntolomas': {
        // For sierraalta & sierrabaja
        url: 'https://la-la.land/inverta/puntolomas.svg',
        communities: ['sierraalta', 'sierrabaja']
      }
    },

    // ----- MAPBOX SETTINGS -----
    mapbox: {
      tokenUrl: 'https://la-la.land/mapbox.txt',
      style: 'mapbox://styles/mapbox/satellite-streets-v12',

      // Initial map view (can be overridden by default community)
      initialView: {
        center: [-96.038183, 19.047528], // Marsella center
        zoom: 16.4
      }
    },

    // ----- AERIAL/SATELLITE IMAGE -----
    aerialImage: {
      url: 'https://la-la.land/inverta/invertaearth.png',
      layerId: 'drone-satellite-layer',
      sourceId: 'drone-satellite',
      message: "Cargamos la imágen aérea más actual — (noviembre 2025)",
      bounds: [
        [-96.041238, 19.0556],
        [-96.031988, 19.055425],
        [-96.032264, 19.042404],
        [-96.041515, 19.04258]
      ]
    },

    // ----- COMMUNITIES/DEVELOPMENTS -----
    // Each community has center coordinates, zoom level, and display info
    communities: {

      barcelona: {
        id: 'barcelona',
        name: 'Barcelona',
        displayName: 'Barcelona',
        fracc: 'barcelona',
        center: [-96.035272, 19.046439],
        zoom: 16.2,
        position: 2, // Position in community selector
        // Alternative reference for search menu:
        searchMenuId: 'positionFour'
      },

      marsella: {
        id: 'marsella',
        name: 'Marsella',
        displayName: 'Marsella',
        fracc: 'marsella',
        center: [-96.038183, 19.047528],
        zoom: 16.4,
        position: 1,
        searchMenuId: 'positionThree'
      },

      sierraalta: {
        id: 'sierraalta',
        name: 'Sierra Alta',
        displayName: 'Sierra Alta',
        fracc: 'sierraalta',
        center: [-96.090267, 19.072525],
        zoom: 15.9,
        position: 7,
        searchMenuId: 'positionTwo'
      },

      sierrabaja: {
        id: 'sierrabaja',
        name: 'Sierra Baja',
        displayName: 'Sierra Baja',
        fracc: 'sierrabaja',
        center: [-96.091717, 19.074769],
        zoom: 16.7,
        position: 6,
        searchMenuId: 'positionOne'
      }

    },

    // ----- DATA SOURCES -----
    data: {
      lotsFile: 'https://la-la.land/inverta/lots.txt',
      framesBase: 'https://la-la.land/inverta/frames/'
    },

    // ----- LOT NAMING CONVENTIONS -----
    // Prefixes used in lot IDs
    lotPrefixes: {
      standard: 'lotinverta',  // e.g., lotinverta10-1
      premium: 'lotinvertap',  // e.g., lotinvertap10-1
      base: 'inverta'          // Used in some contexts
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
      paymentMessage: '(se te proporcionarán las cuentas bancarias oficiales de INVERTA a través de WhatsApp).'
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

    // ----- MISCELLANEOUS -----
    misc: {
      // Font family for the site
      fontFamily: 'Barlow Condensed',

      // Default CTA message
      ctaMessage: '¡Fácil, rápido y sin complicaciones!',
      ctaColor: '#ff8400'
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
 * @returns {string} Logo URL
 */
function getCommunityLogo(clientName, fraccName) {
  const config = getClientConfig(clientName);
  if (!config) return null;

  const fracc = fraccName.toLowerCase().trim();

  // Search through community logo groups
  for (const [groupName, logoData] of Object.entries(config.communityLogos)) {
    if (logoData.communities.includes(fracc)) {
      return logoData.url;
    }
  }

  // Return first logo as default
  const firstLogo = Object.values(config.communityLogos)[0];
  return firstLogo ? firstLogo.url : null;
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
    extractLotNumber
  };
}
