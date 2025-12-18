/**
 * Universal Embed Loader for Visualizations
 * Allows embedding visualizations into any webpage via iframe or direct injection
 */

(function() {
  'use strict';

  const VISUALIZATIONS = {
    'complementarity-view': {
      path: '/visualizations/complementarity-view/',
      defaultWidth: '100%',
      defaultHeight: '700px',
      aspectRatio: 16 / 9
    },
    'four-rungs': {
      path: '/visualizations/four-rungs/',
      defaultWidth: '100%',
      defaultHeight: '800px',
      aspectRatio: 4 / 3
    },
    'friction-spectrum': {
      path: '/visualizations/friction-spectrum/',
      defaultWidth: '100%',
      defaultHeight: '600px',
      aspectRatio: 16 / 10
    },
    'collaboration-framework': {
      path: '/visualizations/collaboration-framework/',
      defaultWidth: '100%',
      defaultHeight: '700px',
      aspectRatio: 1
    },
    'pace-layers': {
      path: '/visualizations/pace-layers/',
      defaultWidth: '100%',
      defaultHeight: '700px',
      aspectRatio: 16 / 9
    },
    'information-asymmetry': {
      path: '/visualizations/information-asymmetry/',
      defaultWidth: '100%',
      defaultHeight: '700px',
      aspectRatio: 1
    }
  };

  /**
   * Get the base URL for the visualization library
   */
  function getBaseUrl() {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].src;
      if (src.includes('loader.js')) {
        return src.replace('/embed/loader.js', '');
      }
    }
    return '';
  }

  /**
   * Create an iframe embed
   */
  function createIframeEmbed(vizId, container, options = {}) {
    const viz = VISUALIZATIONS[vizId];
    if (!viz) {
      console.error(`Unknown visualization: ${vizId}`);
      return null;
    }

    const baseUrl = options.baseUrl || getBaseUrl();
    const width = options.width || viz.defaultWidth;
    const height = options.height || viz.defaultHeight;

    const iframe = document.createElement('iframe');
    iframe.src = `${baseUrl}${viz.path}index.html`;
    iframe.style.width = width;
    iframe.style.height = height;
    iframe.style.border = 'none';
    iframe.style.borderRadius = options.borderRadius || '12px';
    iframe.style.overflow = 'hidden';
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('title', `${vizId} visualization`);

    if (typeof container === 'string') {
      container = document.querySelector(container);
    }

    if (container) {
      container.appendChild(iframe);
    }

    return iframe;
  }

  /**
   * Auto-initialize embeds from data attributes
   * Usage: <div data-viz-embed="complementarity-view" data-viz-width="100%" data-viz-height="600px"></div>
   */
  function autoInit() {
    const embedContainers = document.querySelectorAll('[data-viz-embed]');

    embedContainers.forEach(container => {
      const vizId = container.dataset.vizEmbed;
      const options = {
        width: container.dataset.vizWidth,
        height: container.dataset.vizHeight,
        borderRadius: container.dataset.vizBorderRadius
      };

      createIframeEmbed(vizId, container, options);
    });
  }

  /**
   * Manual embed API
   */
  window.HumanAIViz = {
    embed: createIframeEmbed,
    visualizations: Object.keys(VISUALIZATIONS),
    getConfig: (vizId) => VISUALIZATIONS[vizId],

    // Initialize all embeds with data attributes
    init: autoInit
  };

  // Auto-init on DOMContentLoaded if script has data-auto-init
  const currentScript = document.currentScript;
  if (currentScript && currentScript.hasAttribute('data-auto-init')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoInit);
    } else {
      autoInit();
    }
  }

})();
