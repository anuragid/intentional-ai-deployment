/**
 * Shared Tooltip Component
 * Reusable tooltip for all visualizations
 */

export class Tooltip {
  constructor(options = {}) {
    this.container = options.container || document.body;
    this.offsetX = options.offsetX || 15;
    this.offsetY = options.offsetY || -10;
    this.className = options.className || 'viz-tooltip';

    this.element = null;
    this.visible = false;
    this.currentTarget = null;

    this.init();
  }

  init() {
    // Create tooltip element if it doesn't exist
    this.element = document.createElement('div');
    this.element.className = this.className;
    this.element.setAttribute('role', 'tooltip');
    this.element.setAttribute('aria-hidden', 'true');
    this.container.appendChild(this.element);

    // Bind methods
    this.handleMouseMove = this.handleMouseMove.bind(this);
  }

  /**
   * Show tooltip with content
   * @param {MouseEvent} event
   * @param {Object} data - { title, description, type }
   */
  show(event, data) {
    if (!data) return;

    // Build content
    let html = '';
    if (data.title) {
      html += `<h4>${data.title}</h4>`;
    }
    if (data.description) {
      html += `<p>${data.description}</p>`;
    }

    this.element.innerHTML = html;

    // Apply type-specific styling
    this.element.className = this.className;
    if (data.type) {
      this.element.classList.add(`${this.className}--${data.type}`);
    }

    // Position and show
    this.updatePosition(event);
    this.element.classList.add(`${this.className}--visible`);
    this.element.setAttribute('aria-hidden', 'false');
    this.visible = true;

    // Track mouse movement
    document.addEventListener('mousemove', this.handleMouseMove);
  }

  /**
   * Hide tooltip
   */
  hide() {
    this.element.classList.remove(`${this.className}--visible`);
    this.element.setAttribute('aria-hidden', 'true');
    this.visible = false;

    document.removeEventListener('mousemove', this.handleMouseMove);
  }

  /**
   * Update tooltip position
   * @param {MouseEvent} event
   */
  updatePosition(event) {
    const rect = this.container.getBoundingClientRect();
    const tooltipRect = this.element.getBoundingClientRect();

    let x = event.clientX - rect.left + this.offsetX;
    let y = event.clientY - rect.top + this.offsetY;

    // Keep tooltip within container bounds
    const maxX = rect.width - tooltipRect.width - 10;
    const maxY = rect.height - tooltipRect.height - 10;

    x = Math.min(Math.max(10, x), maxX);
    y = Math.min(Math.max(10, y), maxY);

    // If tooltip would appear above viewport, show below cursor
    if (y < 0) {
      y = event.clientY - rect.top + 20;
    }

    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
  }

  /**
   * Handle mouse movement while tooltip is visible
   * @param {MouseEvent} event
   */
  handleMouseMove(event) {
    if (this.visible) {
      this.updatePosition(event);
    }
  }

  /**
   * Set tooltip content without showing
   * @param {Object} data
   */
  setContent(data) {
    let html = '';
    if (data.title) {
      html += `<h4>${data.title}</h4>`;
    }
    if (data.description) {
      html += `<p>${data.description}</p>`;
    }
    this.element.innerHTML = html;

    if (data.type) {
      this.element.className = `${this.className} ${this.className}--${data.type}`;
    }
  }

  /**
   * Destroy tooltip
   */
  destroy() {
    document.removeEventListener('mousemove', this.handleMouseMove);
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

/**
 * Create a tooltip manager that handles multiple elements
 * @param {Object} options
 * @returns {Object} Manager with attach/detach methods
 */
export function createTooltipManager(options = {}) {
  const tooltip = new Tooltip(options);
  const attachedElements = new Map();

  return {
    /**
     * Attach tooltip behavior to an element
     * @param {HTMLElement} element
     * @param {Object|Function} data - Static data or function that returns data
     */
    attach(element, data) {
      const handlers = {
        mouseenter: (e) => {
          const tooltipData = typeof data === 'function' ? data(element, e) : data;
          tooltip.show(e, tooltipData);
        },
        mouseleave: () => {
          tooltip.hide();
        }
      };

      element.addEventListener('mouseenter', handlers.mouseenter);
      element.addEventListener('mouseleave', handlers.mouseleave);

      attachedElements.set(element, handlers);
    },

    /**
     * Detach tooltip behavior from an element
     * @param {HTMLElement} element
     */
    detach(element) {
      const handlers = attachedElements.get(element);
      if (handlers) {
        element.removeEventListener('mouseenter', handlers.mouseenter);
        element.removeEventListener('mouseleave', handlers.mouseleave);
        attachedElements.delete(element);
      }
    },

    /**
     * Show tooltip programmatically
     */
    show: (event, data) => tooltip.show(event, data),

    /**
     * Hide tooltip programmatically
     */
    hide: () => tooltip.hide(),

    /**
     * Destroy manager and tooltip
     */
    destroy() {
      attachedElements.forEach((handlers, element) => {
        element.removeEventListener('mouseenter', handlers.mouseenter);
        element.removeEventListener('mouseleave', handlers.mouseleave);
      });
      attachedElements.clear();
      tooltip.destroy();
    }
  };
}

export default Tooltip;
