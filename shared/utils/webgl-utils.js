/**
 * WebGL Utilities
 * Helpers for WebGL rendering, shaders, and effects
 */

/**
 * Create a WebGL context with fallback
 * @param {HTMLCanvasElement} canvas
 * @param {Object} options - Context options
 * @returns {WebGLRenderingContext|WebGL2RenderingContext|null}
 */
export function createWebGLContext(canvas, options = {}) {
  const contextOptions = {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    ...options
  };

  let gl = canvas.getContext('webgl2', contextOptions);
  if (!gl) {
    gl = canvas.getContext('webgl', contextOptions) ||
         canvas.getContext('experimental-webgl', contextOptions);
  }

  if (!gl) {
    console.error('WebGL not supported');
    return null;
  }

  return gl;
}

/**
 * Compile a shader
 * @param {WebGLRenderingContext} gl
 * @param {string} source - Shader source code
 * @param {number} type - gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
 * @returns {WebGLShader|null}
 */
export function compileShader(gl, source, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

/**
 * Create a shader program
 * @param {WebGLRenderingContext} gl
 * @param {string} vertexSource
 * @param {string} fragmentSource
 * @returns {WebGLProgram|null}
 */
export function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = compileShader(gl, vertexSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);

  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  // Clean up shaders after linking
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return program;
}

/**
 * Create a buffer
 * @param {WebGLRenderingContext} gl
 * @param {Float32Array|Uint16Array} data
 * @param {number} type - gl.ARRAY_BUFFER or gl.ELEMENT_ARRAY_BUFFER
 * @returns {WebGLBuffer}
 */
export function createBuffer(gl, data, type = gl.ARRAY_BUFFER) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(type, buffer);
  gl.bufferData(type, data, gl.STATIC_DRAW);
  return buffer;
}

/**
 * Resize canvas to display size
 * @param {HTMLCanvasElement} canvas
 * @param {number} pixelRatio - Device pixel ratio
 * @returns {boolean} True if canvas was resized
 */
export function resizeCanvas(canvas, pixelRatio = window.devicePixelRatio || 1) {
  const displayWidth = Math.floor(canvas.clientWidth * pixelRatio);
  const displayHeight = Math.floor(canvas.clientHeight * pixelRatio);

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    return true;
  }

  return false;
}

/**
 * Get uniform locations for a program
 * @param {WebGLRenderingContext} gl
 * @param {WebGLProgram} program
 * @param {string[]} names
 * @returns {Object} Map of uniform names to locations
 */
export function getUniformLocations(gl, program, names) {
  const locations = {};
  names.forEach(name => {
    locations[name] = gl.getUniformLocation(program, name);
  });
  return locations;
}

/**
 * Get attribute locations for a program
 * @param {WebGLRenderingContext} gl
 * @param {WebGLProgram} program
 * @param {string[]} names
 * @returns {Object} Map of attribute names to locations
 */
export function getAttributeLocations(gl, program, names) {
  const locations = {};
  names.forEach(name => {
    locations[name] = gl.getAttribLocation(program, name);
  });
  return locations;
}

/**
 * Create a fullscreen quad (two triangles)
 * @returns {Float32Array} Position data
 */
export function createFullscreenQuad() {
  return new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1
  ]);
}

/**
 * Common vertex shader for fullscreen effects
 */
export const fullscreenVertexShader = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

/**
 * Spotlight/cone light fragment shader
 */
export const spotlightFragmentShader = `
  precision highp float;

  varying vec2 v_uv;

  uniform vec2 u_resolution;
  uniform vec2 u_lightPosition;
  uniform float u_lightRadius;
  uniform float u_lightIntensity;
  uniform float u_lightAngle;
  uniform float u_lightSoftness;
  uniform vec3 u_lightColor;
  uniform float u_time;

  // Noise function for subtle variation
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec2 uv = v_uv;
    vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);

    // Calculate distance from light source
    vec2 lightPos = u_lightPosition;
    vec2 toLight = (uv - lightPos) * aspect;

    // Cone shape - wider at bottom, narrower at top
    float verticalDist = uv.y - lightPos.y;
    float coneWidth = u_lightRadius * (1.0 - verticalDist * u_lightAngle);
    coneWidth = max(coneWidth, 0.01);

    // Distance within cone
    float horizontalDist = abs(toLight.x);
    float coneFalloff = smoothstep(coneWidth, coneWidth * u_lightSoftness, horizontalDist);

    // Vertical falloff
    float verticalFalloff = smoothstep(0.0, 0.8, -verticalDist);
    verticalFalloff *= smoothstep(1.0, 0.2, -verticalDist);

    // Combine
    float light = coneFalloff * verticalFalloff * u_lightIntensity;

    // Add subtle noise/dust particles
    float dustNoise = noise(uv * 100.0 + u_time * 0.5) * 0.15;
    float dust = dustNoise * light * smoothstep(0.0, 0.3, light);

    // Final color
    vec3 color = u_lightColor * (light + dust);

    // Add subtle glow at the edges of the light cone
    float edgeGlow = smoothstep(coneWidth * 1.2, coneWidth * 0.8, horizontalDist);
    edgeGlow *= smoothstep(coneWidth * 0.8, coneWidth * 1.0, horizontalDist);
    edgeGlow *= verticalFalloff * 0.3;
    color += u_lightColor * edgeGlow;

    gl_FragColor = vec4(color, light * 0.8 + dust);
  }
`;

/**
 * Particle system class for floating data points
 */
export class ParticleSystem {
  constructor(gl, count, bounds) {
    this.gl = gl;
    this.count = count;
    this.bounds = bounds;
    this.particles = [];

    this.init();
  }

  init() {
    for (let i = 0; i < this.count; i++) {
      this.particles.push({
        x: Math.random() * this.bounds.width + this.bounds.x,
        y: Math.random() * this.bounds.height + this.bounds.y,
        vx: (Math.random() - 0.5) * 0.001,
        vy: (Math.random() - 0.5) * 0.001,
        size: Math.random() * 3 + 2,
        alpha: Math.random() * 0.5 + 0.3,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  update(deltaTime) {
    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around bounds
      if (p.x < this.bounds.x) p.x = this.bounds.x + this.bounds.width;
      if (p.x > this.bounds.x + this.bounds.width) p.x = this.bounds.x;
      if (p.y < this.bounds.y) p.y = this.bounds.y + this.bounds.height;
      if (p.y > this.bounds.y + this.bounds.height) p.y = this.bounds.y;

      // Subtle floating motion
      p.phase += deltaTime * 2;
      p.floatOffset = Math.sin(p.phase) * 0.005;
    });
  }

  getPositions() {
    return this.particles.map(p => ({
      x: p.x,
      y: p.y + (p.floatOffset || 0),
      size: p.size,
      alpha: p.alpha
    }));
  }
}

/**
 * Color utilities
 */
export const colors = {
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : null;
  },

  rgbToVec3(hex) {
    const rgb = this.hexToRgb(hex);
    return rgb ? [rgb.r, rgb.g, rgb.b] : [1, 1, 1];
  }
};
