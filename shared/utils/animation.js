/**
 * Animation Utilities
 * Shared easing functions and animation helpers
 */

// Easing functions
export const easing = {
  // Standard easings
  linear: t => t,

  // Quad
  easeInQuad: t => t * t,
  easeOutQuad: t => t * (2 - t),
  easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

  // Cubic
  easeInCubic: t => t * t * t,
  easeOutCubic: t => (--t) * t * t + 1,
  easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

  // Quart
  easeInQuart: t => t * t * t * t,
  easeOutQuart: t => 1 - (--t) * t * t * t,
  easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,

  // Expo
  easeInExpo: t => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
  easeOutExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeInOutExpo: t => {
    if (t === 0 || t === 1) return t;
    if (t < 0.5) return Math.pow(2, 20 * t - 10) / 2;
    return (2 - Math.pow(2, -20 * t + 10)) / 2;
  },

  // Elastic
  easeOutElastic: t => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },

  // Back
  easeOutBack: t => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },

  // Bounce
  easeOutBounce: t => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
};

/**
 * Animate a value over time
 * @param {Object} options
 * @param {number} options.from - Start value
 * @param {number} options.to - End value
 * @param {number} options.duration - Duration in ms
 * @param {Function} options.easing - Easing function
 * @param {Function} options.onUpdate - Called each frame with current value
 * @param {Function} options.onComplete - Called when animation completes
 * @returns {Function} Cancel function
 */
export function animate({ from, to, duration, easing: easeFn = easing.easeOutQuart, onUpdate, onComplete }) {
  const startTime = performance.now();
  let animationId;

  function tick(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeFn(progress);
    const currentValue = from + (to - from) * easedProgress;

    onUpdate(currentValue, progress);

    if (progress < 1) {
      animationId = requestAnimationFrame(tick);
    } else if (onComplete) {
      onComplete();
    }
  }

  animationId = requestAnimationFrame(tick);

  return () => cancelAnimationFrame(animationId);
}

/**
 * Animate multiple values simultaneously
 * @param {Object} options
 * @param {Object} options.from - Object with start values
 * @param {Object} options.to - Object with end values
 * @param {number} options.duration - Duration in ms
 * @param {Function} options.easing - Easing function
 * @param {Function} options.onUpdate - Called each frame with current values object
 * @param {Function} options.onComplete - Called when animation completes
 * @returns {Function} Cancel function
 */
export function animateMultiple({ from, to, duration, easing: easeFn = easing.easeOutQuart, onUpdate, onComplete }) {
  const startTime = performance.now();
  const keys = Object.keys(from);
  let animationId;

  function tick(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeFn(progress);

    const currentValues = {};
    keys.forEach(key => {
      currentValues[key] = from[key] + (to[key] - from[key]) * easedProgress;
    });

    onUpdate(currentValues, progress);

    if (progress < 1) {
      animationId = requestAnimationFrame(tick);
    } else if (onComplete) {
      onComplete();
    }
  }

  animationId = requestAnimationFrame(tick);

  return () => cancelAnimationFrame(animationId);
}

/**
 * Create a spring animation
 * @param {Object} options
 * @param {number} options.from - Start value
 * @param {number} options.to - End value
 * @param {number} options.stiffness - Spring stiffness (default: 100)
 * @param {number} options.damping - Damping ratio (default: 10)
 * @param {number} options.mass - Mass (default: 1)
 * @param {Function} options.onUpdate - Called each frame
 * @param {Function} options.onComplete - Called when settled
 * @returns {Function} Cancel function
 */
export function spring({ from, to, stiffness = 100, damping = 10, mass = 1, onUpdate, onComplete }) {
  let position = from;
  let velocity = 0;
  let animationId;
  const precision = 0.01;

  function tick() {
    const displacement = position - to;
    const springForce = -stiffness * displacement;
    const dampingForce = -damping * velocity;
    const acceleration = (springForce + dampingForce) / mass;

    velocity += acceleration * (1 / 60);
    position += velocity * (1 / 60);

    onUpdate(position);

    if (Math.abs(velocity) > precision || Math.abs(displacement) > precision) {
      animationId = requestAnimationFrame(tick);
    } else {
      position = to;
      onUpdate(position);
      if (onComplete) onComplete();
    }
  }

  animationId = requestAnimationFrame(tick);

  return () => cancelAnimationFrame(animationId);
}

/**
 * Lerp (linear interpolation)
 */
export function lerp(start, end, t) {
  return start + (end - start) * t;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Map a value from one range to another
 */
export function mapRange(value, inMin, inMax, outMin, outMax) {
  return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
}

/**
 * Staggered animation helper
 * @param {number} count - Number of items
 * @param {number} staggerDelay - Delay between each item in ms
 * @param {Function} callback - Called for each item with index and delay
 */
export function stagger(count, staggerDelay, callback) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => callback(i), i * staggerDelay);
  }
}

/**
 * Request animation frame loop with delta time
 * @param {Function} callback - Called each frame with deltaTime
 * @returns {Function} Stop function
 */
export function createLoop(callback) {
  let lastTime = performance.now();
  let animationId;
  let running = true;

  function tick(currentTime) {
    if (!running) return;

    const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
    lastTime = currentTime;

    callback(deltaTime, currentTime);

    animationId = requestAnimationFrame(tick);
  }

  animationId = requestAnimationFrame(tick);

  return () => {
    running = false;
    cancelAnimationFrame(animationId);
  };
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}
