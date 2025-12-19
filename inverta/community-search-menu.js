/**
 * Community Search Menu - Interactive Circular Menu
 * Reads configuration from client-config.js
 * Usage: Call initCommunitySearchMenu(containerId, clientName, onCommunitySelect)
 */

(function(window) {
  'use strict';

  /**
   * Initialize the community search menu
   * @param {string} containerId - ID of the container element
   * @param {string} clientName - Client identifier (e.g., 'inverta')
   * @param {function} onCommunitySelect - Callback when community is selected (receives community object)
   */
  window.initCommunitySearchMenu = function(containerId, clientName, onCommunitySelect) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`❌ Container not found: ${containerId}`);
      return;
    }

    // Get menu configuration from client config
    const menuConfig = getCommunitySearchMenu(clientName);
    if (!menuConfig) {
      console.error(`❌ Menu configuration not found for client: ${clientName}`);
      return;
    }

    // Apply CSS variables from config
    const root = document.documentElement;
    root.style.setProperty('--csm-orbit-radius', menuConfig.radius);
    root.style.setProperty('--csm-dot', menuConfig.size + 'px');
    root.style.setProperty('--csm-btn', menuConfig.centerSize + 'px');
    root.style.setProperty('--csm-mini-orbit-radius', menuConfig.miniDots.radius);
    root.style.setProperty('--csm-mini-dot', menuConfig.miniDots.size + 'px');
    root.style.setProperty('--csm-rotate-deg', menuConfig.rotation + 'deg');

    // Remove old search button completely
    const oldBtn = document.getElementById('communitySearchBtn');
    if (oldBtn) {
      oldBtn.remove();
    }

    // Build menu HTML with new center button
    container.innerHTML = `
      <div class="community-search-stage">
        <div class="csm-rotator">
          <!-- Dots will be injected here -->
        </div>
        <button class="csm-center-btn" id="csmCenterBtn">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke-width="2" stroke-linecap="round" fill="none"/>
          </svg>
        </button>
      </div>
    `;

    const rotator = container.querySelector('.csm-rotator');
    const centerBtn = container.querySelector('#csmCenterBtn');
    const stage = container.querySelector('.community-search-stage');

    console.log('🔍 Menu elements:', {
      rotator: !!rotator,
      centerBtn: !!centerBtn,
      stage: !!stage
    });

    if (!centerBtn) {
      console.error('❌ Center button not found in container!');
      return;
    }

    let dots = [];
    let menuActive = false;

    // Build dots
    function buildDots() {
      const count = menuConfig.count;
      const radius = menuConfig.radius;
      const cx = stage.clientWidth / 2;
      const cy = stage.clientHeight / 2;

      for (let i = 0; i < count; i++) {
        // Skip if dot is hidden
        if (menuConfig.dotVisibility[i] === false) continue;

        const dotContainer = document.createElement('div');
        dotContainer.className = 'csm-dot-container';

        const dot = document.createElement('button');
        dot.className = 'csm-dot';
        dot.textContent = menuConfig.dotLabels[i] || (i + 1).toString();

        // Position dot
        const angle = (2 * Math.PI * i) / count;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        dotContainer.style.left = x + 'px';
        dotContainer.style.top = y + 'px';

        dotContainer.appendChild(dot);
        rotator.appendChild(dotContainer);

        const dotData = {
          el: dot,
          container: dotContainer,
          index: i,
          miniDots: [],
          miniRing: null,
          miniDotsActive: false
        };

        // Build mini-dots if enabled for this dot
        if (menuConfig.miniDots.enabled && menuConfig.miniDotsVisibility[i] !== false) {
          buildMiniDots(dotData);
        }

        // Click handler for main dot
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          if (menuActive) {
            if (dotData.miniDots.length > 0) {
              // Toggle mini-dots
              toggleMiniDotsForDot(dotData);
            } else {
              // Navigate to community
              const community = getCommunityByDotIndex(clientName, i);
              if (community && onCommunitySelect) {
                onCommunitySelect(community);
                closeMenu();
              }
            }
          }
        });

        dots.push(dotData);
      }

      applyAnimationDelays();
    }

    // Build mini-dots for a parent dot
    function buildMiniDots(dotData) {
      const miniCount = menuConfig.miniDots.count;
      const miniRadius = menuConfig.miniDots.radius;
      const miniRotation = menuConfig.miniDots.rotation;
      const shouldMirror = menuConfig.miniDotsMirror[dotData.index] || false;
      const effectiveRotation = shouldMirror ? -miniRotation : miniRotation;

      const ring = document.createElement('div');
      ring.className = 'csm-mini-dots-ring';
      ring.style.width = (miniRadius * 2) + 'px';
      ring.style.height = (miniRadius * 2) + 'px';

      for (let j = 0; j < miniCount; j++) {
        // Skip if mini-dot is hidden
        if (menuConfig.individualMiniVisibility[dotData.index] &&
            menuConfig.individualMiniVisibility[dotData.index][j] === false) {
          continue;
        }

        const miniContainer = document.createElement('div');
        miniContainer.className = 'csm-mini-dot-container';

        const miniDot = document.createElement('button');
        miniDot.className = 'csm-mini-dot';
        miniDot.textContent = menuConfig.miniDotLabels[dotData.index][j] || (j + 1).toString();

        // Position mini-dot
        const baseAngle = (2 * Math.PI * j) / miniCount;
        const angle = baseAngle + (effectiveRotation * Math.PI / 180);
        const x = miniRadius + miniRadius * Math.cos(angle);
        const y = miniRadius + miniRadius * Math.sin(angle);
        miniContainer.style.left = x + 'px';
        miniContainer.style.top = y + 'px';

        miniContainer.appendChild(miniDot);
        ring.appendChild(miniContainer);

        // Click handler for mini-dot
        miniDot.addEventListener('click', (e) => {
          e.stopPropagation();
          // Handle mini-dot click - navigate to sub-community or phase
          console.log(`Mini-dot clicked: ${menuConfig.dotLabels[dotData.index]} - ${menuConfig.miniDotLabels[dotData.index][j]}`);
          // You can add custom logic here
          if (onCommunitySelect) {
            const community = getCommunityByDotIndex(clientName, dotData.index);
            if (community) {
              onCommunitySelect(community, j); // Pass mini-dot index as second parameter
              closeMenu();
            }
          }
        });

        dotData.miniDots.push({ el: miniDot, container: miniContainer, index: j });
      }

      dotData.container.appendChild(ring);
      dotData.miniRing = ring;
      applyMiniAnimationDelays(dotData);
    }

    // Apply animation delays to main dots
    function applyAnimationDelays() {
      const delay = menuConfig.animationDelay;
      let visibleIndex = 0;

      dots.forEach((dotData) => {
        if (menuConfig.dotVisibility[dotData.index] !== false) {
          dotData.el.style.animationDelay = (visibleIndex * delay) + 'ms';
          visibleIndex++;
        } else {
          dotData.el.style.animationDelay = '0ms';
        }
      });
    }

    // Apply animation delays to mini-dots (instant simultaneous appearance)
    function applyMiniAnimationDelays(dotData) {
      dotData.miniDots.forEach(({ el }) => {
        el.style.animationDelay = '0ms'; // Instant simultaneous pop
      });
    }

    // Toggle mini-dots for a specific dot
    function toggleMiniDotsForDot(dotData) {
      if (!dotData.miniDots.length) return;

      dotData.miniDotsActive = !dotData.miniDotsActive;

      if (dotData.miniDotsActive) {
        // Hide main dot, show mini-dots (transformation effect)
        dotData.el.classList.add('hidden');
        dotData.miniDots.forEach(({ el }) => {
          el.classList.add('visible');
        });
      } else {
        // Show main dot, hide mini-dots
        dotData.el.classList.remove('hidden');
        dotData.miniDots.forEach(({ el }) => {
          el.classList.remove('visible');
        });
      }
    }

    // Open menu
    function openMenu() {
      menuActive = true;
      rotator.classList.add('csm-menu-active');
      dots.forEach((dotData) => {
        if (menuConfig.dotVisibility[dotData.index] !== false) {
          dotData.el.classList.add('visible');
        }
      });
    }

    // Close menu
    function closeMenu() {
      menuActive = false;
      rotator.classList.remove('csm-menu-active');
      dots.forEach((dotData) => {
        dotData.el.classList.remove('visible');
        dotData.el.classList.remove('hidden');
        // Hide all mini-dots
        if (dotData.miniDotsActive) {
          dotData.miniDots.forEach(({ el }) => {
            el.classList.remove('visible');
          });
          dotData.miniDotsActive = false;
        }
      });
    }

    // Toggle menu
    function toggleMenu() {
      console.log('🎯 toggleMenu called, menuActive:', menuActive);
      if (menuActive) {
        closeMenu();
      } else {
        openMenu();
      }
    }

    // Center button click handler
    console.log('📍 Attaching click handler to button');
    centerBtn.addEventListener('click', (e) => {
      console.log('🖱️ Button clicked!', e);
      toggleMenu();
    });

    // Build the menu
    buildDots();

    // Handle window resize
    window.addEventListener('resize', () => {
      // Rebuild dots on resize to recalculate positions
      rotator.innerHTML = '';
      dots = [];
      buildDots();
    });

    console.log('✅ Community search menu initialized');

    // Return public API
    return {
      open: openMenu,
      close: closeMenu,
      toggle: toggleMenu
    };
  };

})(window);
