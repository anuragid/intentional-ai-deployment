// ============================================================
// The Friction Spectrum — Membrane Permeability
// ============================================================
// A stream of particles flows through progressively denser
// membranes. The concept is legible from the overview alone:
// open flow → visible boundary → selective filter → impermeable.
// ============================================================

// ============================================================
// Configuration
// ============================================================
const CONFIG = {
    colors: {
        bg: 0x08080c,
        seamless: 0x22d3ee,
        visible: 0x60a5fa,
        gated: 0xfbbf24,
        humanOnly: 0x8b5cf6,
        particleAI: 0x22d3ee,
        particleTagged: 0x8ab8d4,
        humanGlow: 0xffd700,
    },
    layout: {
        zoneCenters: { seamless: -9, visible: -3, gated: 3, humanOnly: 9 },
        zoneBoundaries: [-6, 0, 6],
    },
    particles: {
        count: 80,
        countLowFi: 40,
        size: 0.08,
    },
};

// ============================================================
// Zone Data
// ============================================================
const ZONES = [
    {
        id: 'seamless',
        title: 'Seamless',
        stakes: 'Low Consequence, Routine',
        subtitle: 'No membrane. Open flow.',
        description: 'Zero friction. AI output flows freely, indistinguishable from human work. Information moves without interruption or inspection. This is the right choice when stakes are low and speed matters most.',
        examples: 'Auto-formatting text, spell-check corrections, content recommendations, basic routing, smart sorting',
        quote: null,
        quoteAttr: null,
        color: CONFIG.colors.seamless,
        colorHex: '#22d3ee',
        center: CONFIG.layout.zoneCenters.seamless,
        membrane: { density: 0.03, poreScale: 2.0, poreOpen: 1.0 },
    },
    {
        id: 'visible',
        title: 'Visible',
        stakes: 'Learning Contexts',
        subtitle: 'The Beautiful Seam',
        description: 'The boundary between human and AI is visible \u2014 you can see, inspect, and learn from what AI contributed. The seam is shown deliberately. This preserves evaluation capacity and supports learning.',
        examples: 'AI-assisted writing with tracked suggestions, code completion with diff highlighting, design tools showing AI-generated options, research summaries with source attribution',
        quote: 'Make sure users are aware they\u2019re interacting with AI at each stage. Put in friction so people know where the seams are.',
        quoteAttr: 'Liz Danzico, Microsoft AI',
        color: CONFIG.colors.visible,
        colorHex: '#60a5fa',
        center: CONFIG.layout.zoneCenters.visible,
        membrane: { density: 0.35, poreScale: 4.0, poreOpen: 1.0 },
    },
    {
        id: 'gated',
        title: 'Gated',
        stakes: 'High Stakes',
        subtitle: 'Approval Required',
        description: 'AI contributes, but output pauses for human review and approval before proceeding. The gate opens only when a human decides it should. Flow is deliberately interrupted to create space for judgment.',
        examples: 'Medical diagnosis review, legal document approval, financial transaction authorization, hiring decisions, safety-critical system changes',
        quote: 'People are deploying AI like it\u2019s an IT deployment when it\u2019s really a design process.',
        quoteAttr: 'Kelly Franznick, Blink UX',
        color: CONFIG.colors.gated,
        colorHex: '#fbbf24',
        center: CONFIG.layout.zoneCenters.gated,
        membrane: { density: 0.7, poreScale: 2.5, poreOpen: 1.0 },
    },
    {
        id: 'human-only',
        title: 'Human-Only',
        stakes: 'Protected Domains',
        subtitle: 'The Impermeable Boundary',
        description: 'Human decides. AI may inform, but doesn\u2019t act. Some boundaries exist not because AI can\u2019t cross them, but because we choose to protect what\u2019s behind them. These are the decisions that define who we are.',
        examples: 'Ethical judgments, constitutional and rights decisions, organizational values and purpose-setting, relationship and care decisions',
        quote: 'We need to be the curators. As humans, we need to be the curators.',
        quoteAttr: 'Donna Flynn, Steelcase',
        color: CONFIG.colors.humanOnly,
        colorHex: '#8b5cf6',
        center: CONFIG.layout.zoneCenters.humanOnly,
        membrane: { density: 1.0, poreScale: 3.0, poreOpen: 0.0 },
    },
];

// ============================================================
// Camera Presets
// ============================================================
const CAMERA_PRESETS = {
    overview:      { position: { x: 0, y: 6, z: 22 },  target: { x: 0,  y: 1.5, z: 0 } },
    seamless:      { position: { x: -9, y: 4, z: 10 }, target: { x: -9, y: 1.5, z: 0 } },
    visible:       { position: { x: -3, y: 4, z: 10 }, target: { x: -3, y: 1.5, z: 0 } },
    gated:         { position: { x: 3, y: 4, z: 10 },  target: { x: 3,  y: 1.5, z: 0 } },
    'human-only':  { position: { x: 9, y: 4, z: 10 },  target: { x: 9,  y: 1.5, z: 0 } },
};

// ============================================================
// Globals
// ============================================================
let scene, camera, renderer, controls;
let particles = [];
var zoneObjects = {};
var poreOpenValue = { value: 1.0 };
let gateTimeline = null;

const mouse = { x: 0, y: 0 };
const mouseClient = { x: 0, y: 0 };
let hoveredZone = null;
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Pre-allocated objects for animation loop (avoid GC pressure)
const _raycaster = new THREE.Raycaster();
const _mouseVec2 = new THREE.Vector2();
const _labelPos = new THREE.Vector3();
const _aiColor = new THREE.Color(CONFIG.colors.particleAI);
const _taggedColor = new THREE.Color(CONFIG.colors.particleTagged);
const _gatedColor = new THREE.Color(CONFIG.colors.gated);
const _humanOnlyColor = new THREE.Color(CONFIG.colors.humanOnly);

// ============================================================
// Performance Mode
// ============================================================
const PerformanceMode = {
    isLowFi: false,
    detect: function() {
        var isMobile = /Android|webOS|iPhone|iPad/.test(navigator.userAgent);
        var hasLowCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
        this.isLowFi = isMobile || hasLowCores;
    },
};

// ============================================================
// State Manager
// ============================================================
const StateManager = {
    focusedZone: null,
    currentView: 'overview',
    lastInteractionTime: Date.now(),
    setFocusedZone: function(zoneId) {
        this.focusedZone = zoneId;
        this.recordInteraction();
    },
    recordInteraction: function() {
        this.lastInteractionTime = Date.now();
    },
    isIdle: function() {
        return Date.now() - this.lastInteractionTime > 30000;
    },
};

// ============================================================
// Audio Manager
// ============================================================
const AudioManager = {
    ctx: null,
    enabled: false,
    droneOsc: null,
    droneGain: null,
    init: function() {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* silent */ }
    },
    toggle: function() {
        if (!this.ctx) this.init();
        this.enabled = !this.enabled;
        var btn = document.getElementById('audio-toggle');
        if (btn) btn.textContent = this.enabled ? 'Sound On' : 'Sound Off';
        if (this.enabled) { this.startDrone(); } else { this.stopDrone(); }
    },
    startDrone: function() {
        if (!this.ctx || this.droneOsc) return;
        this.droneOsc = this.ctx.createOscillator();
        this.droneGain = this.ctx.createGain();
        this.droneOsc.type = 'sine';
        this.droneOsc.frequency.value = 55;
        this.droneGain.gain.value = 0;
        this.droneOsc.connect(this.droneGain);
        this.droneGain.connect(this.ctx.destination);
        this.droneOsc.start();
        this.droneGain.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 1);
    },
    stopDrone: function() {
        var self = this;
        if (this.droneGain) {
            this.droneGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
            setTimeout(function() {
                if (self.droneOsc) { self.droneOsc.stop(); self.droneOsc = null; }
                self.droneGain = null;
            }, 600);
        }
    },
    playNote: function(freq, duration) {
        if (!this.enabled || !this.ctx) return;
        var osc = this.ctx.createOscillator();
        var gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        gain.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
        setTimeout(function() { osc.stop(); }, duration * 1000 + 100);
    },
};

// ============================================================
// GLSL: Simplex Noise
// ============================================================
var SIMPLEX_NOISE_GLSL = [
    'vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }',
    'vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }',
    'vec3 permute(vec3 x) { return mod289v3(((x*34.0)+1.0)*x); }',
    'float snoise(vec2 v) {',
    '  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);',
    '  vec2 i = floor(v + dot(v, C.yy));',
    '  vec2 x0 = v - i + dot(i, C.xx);',
    '  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);',
    '  vec4 x12 = x0.xyxy + C.xxzz;',
    '  x12.xy -= i1;',
    '  i = mod289v2(i);',
    '  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));',
    '  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);',
    '  m = m*m; m = m*m;',
    '  vec3 x_ = 2.0 * fract(p * C.www) - 1.0;',
    '  vec3 h = abs(x_) - 0.5;',
    '  vec3 ox = floor(x_ + 0.5);',
    '  vec3 a0 = x_ - ox;',
    '  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);',
    '  vec3 g;',
    '  g.x = a0.x * x0.x + h.x * x0.y;',
    '  g.yz = a0.yz * x12.xz + h.yz * x12.yw;',
    '  return 130.0 * dot(m, g);',
    '}',
].join('\n');

// ============================================================
// GLSL: Membrane Vertex Shader
// ============================================================
var MEMBRANE_VERTEX = [
    'uniform float time;',
    'varying vec2 vUv;',
    'varying vec3 vNormal_w;',
    'varying vec3 vWorldPosition;',
    'void main() {',
    '  vUv = uv;',
    '  vNormal_w = normalize(mat3(modelMatrix) * normal);',
    '  vec3 pos = position;',
    '  pos.z += sin(pos.y * 3.0 + time * 0.5) * 0.06;',
    '  pos.z += cos(pos.x * 2.5 + time * 0.3) * 0.04;',
    '  vec4 worldPos = modelMatrix * vec4(pos, 1.0);',
    '  vWorldPosition = worldPos.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * worldPos;',
    '}',
].join('\n');

// ============================================================
// GLSL: Membrane Fragment Shader
// ============================================================
var MEMBRANE_FRAGMENT = SIMPLEX_NOISE_GLSL + '\n' + [
    'uniform float time;',
    'uniform float density;',
    'uniform float poreScale;',
    'uniform vec3 baseColor;',
    'uniform float poreOpen;',
    'varying vec2 vUv;',
    'varying vec3 vNormal_w;',
    'varying vec3 vWorldPosition;',
    '',
    'void main() {',
    '  float n = snoise(vUv * poreScale + time * 0.08) * 0.5 + 0.5;',
    '  float n2 = snoise(vUv * poreScale * 2.3 + time * 0.05 + 5.0) * 0.5 + 0.5;',
    '  n = n * 0.7 + n2 * 0.3;',
    '',
    '  float openThreshold = (1.0 - density) * poreOpen;',
    '  float isMembrane = smoothstep(openThreshold - 0.08, openThreshold + 0.08, n);',
    '  float alpha = isMembrane * density * 0.65;',
    '',
    '  float borderDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));',
    '  float edgeFade = smoothstep(0.0, 0.08, borderDist);',
    '  alpha *= edgeFade;',
    '',
    '  vec3 viewDir = normalize(cameraPosition - vWorldPosition);',
    '  float NdotV = abs(dot(normalize(vNormal_w), viewDir));',
    '  float fresnel = pow(1.0 - NdotV, 3.0);',
    '',
    '  float edgeGlow = (1.0 - smoothstep(0.0, 0.15, borderDist)) * density;',
    '  float glow = (edgeGlow * 0.3 + fresnel * 0.2) * density;',
    '',
    '  float pulse = sin(time * 0.8) * 0.04;',
    '',
    '  float poreEdge = smoothstep(openThreshold - 0.12, openThreshold - 0.04, n)',
    '                 * (1.0 - smoothstep(openThreshold + 0.04, openThreshold + 0.12, n));',
    '  float poreHighlight = poreEdge * 0.3 * poreOpen;',
    '',
    '  float ghostShimmer = density < 0.1 ? sin(time * 1.5 + vUv.y * 6.0) * 0.06 : 0.0;',
    '',
    '  vec3 color = baseColor * (1.0 + pulse + glow + poreHighlight);',
    '  float finalAlpha = max(alpha, glow * 0.5) + poreHighlight * 0.2 + ghostShimmer;',
    '  finalAlpha = clamp(finalAlpha, 0.0, 1.0);',
    '',
    '  gl_FragColor = vec4(color, finalAlpha);',
    '}',
].join('\n');

// ============================================================
// GLSL: Ground Plane
// ============================================================
var GROUND_VERTEX = [
    'varying vec3 vWorldPosition;',
    'void main() {',
    '  vec4 worldPos = modelMatrix * vec4(position, 1.0);',
    '  vWorldPosition = worldPos.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * worldPos;',
    '}',
].join('\n');

var GROUND_FRAGMENT = [
    'varying vec3 vWorldPosition;',
    'void main() {',
    '  vec3 base = vec3(0.031, 0.031, 0.047);',
    '  vec3 gc = vec3(0.0);',
    '  float d1 = length(vWorldPosition.xz - vec2(-9.0, 0.0));',
    '  gc += vec3(0.133, 0.827, 0.933) * exp(-d1*d1 / 12.0) * 0.12;',
    '  float d2 = length(vWorldPosition.xz - vec2(-3.0, 0.0));',
    '  gc += vec3(0.376, 0.647, 0.98) * exp(-d2*d2 / 12.0) * 0.12;',
    '  float d3 = length(vWorldPosition.xz - vec2(3.0, 0.0));',
    '  gc += vec3(0.984, 0.749, 0.141) * exp(-d3*d3 / 12.0) * 0.12;',
    '  float d4 = length(vWorldPosition.xz - vec2(9.0, 0.0));',
    '  gc += vec3(0.545, 0.361, 0.965) * exp(-d4*d4 / 12.0) * 0.15;',
    '  gl_FragColor = vec4(base + gc, 1.0);',
    '}',
].join('\n');

// ============================================================
// Init
// ============================================================
function init() {
    PerformanceMode.detect();

    var canvas = document.getElementById('canvas');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.colors.bg);
    scene.fog = new THREE.Fog(CONFIG.colors.bg, 15, 40);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 12, 30);
    camera.lookAt(0, 1.5, 0);

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !PerformanceMode.isLowFi });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 6;
    controls.maxDistance = 35;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.target.set(0, 1.5, 0);

    setupLighting();
    createGround();
    createAllZones();
    createParticleSystem();
    initGateCycle();
    setupEvents();
    animate();

    setTimeout(playIntro, 100);
}

// ============================================================
// Lighting
// ============================================================
function setupLighting() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));
    scene.add(new THREE.HemisphereLight(0x1a1a2e, 0x08080c, 0.2));
}

// ============================================================
// Ground Plane
// ============================================================
function createGround() {
    var geo = new THREE.PlaneGeometry(40, 20, 1, 1);
    var mat = new THREE.ShaderMaterial({
        vertexShader: GROUND_VERTEX,
        fragmentShader: GROUND_FRAGMENT,
        side: THREE.DoubleSide,
    });
    var ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    scene.add(ground);

    // Zone boundary lines
    CONFIG.layout.zoneBoundaries.forEach(function(x) {
        var lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x, -0.49, -5),
            new THREE.Vector3(x, -0.49, 5),
        ]);
        var lineMat = new THREE.LineBasicMaterial({ color: 0xf5f0e8, transparent: true, opacity: 0.06 });
        scene.add(new THREE.Line(lineGeo, lineMat));
    });
}

// ============================================================
// Create One Zone Membrane
// ============================================================
function createMembrane(zone) {
    var group = new THREE.Group();
    var params = zone.membrane;
    var zoneColor = new THREE.Color(zone.color);
    var geo = new THREE.PlaneGeometry(5, 5, 32, 32);

    function makeMaterial(d, ps, po) {
        return new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                density: { value: d },
                poreScale: { value: ps },
                baseColor: { value: zoneColor.clone() },
                poreOpen: { value: po },
            },
            vertexShader: MEMBRANE_VERTEX,
            fragmentShader: MEMBRANE_FRAGMENT,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
    }

    var mat = makeMaterial(params.density, params.poreScale, params.poreOpen);
    var membrane = new THREE.Mesh(geo, mat);
    membrane.rotation.y = Math.PI / 2;
    membrane.position.set(zone.center, 2.5, 0);
    group.add(membrane);

    // Gated: second parallel plane for visual thickness
    var membrane2 = null;
    var mat2 = null;
    if (zone.id === 'gated') {
        mat2 = makeMaterial(params.density * 0.6, params.poreScale * 1.2, params.poreOpen);
        membrane2 = new THREE.Mesh(geo.clone(), mat2);
        membrane2.rotation.y = Math.PI / 2;
        membrane2.position.set(zone.center + 0.3, 2.5, 0);
        group.add(membrane2);
    }

    // Per-membrane point light (behind membrane)
    var light = new THREE.PointLight(zone.color, 0.4, 8);
    light.position.set(zone.center + 1, 2.5, 0);
    group.add(light);

    // Human-Only: warm golden glow beyond
    if (zone.id === 'human-only') {
        var warmLight = new THREE.PointLight(CONFIG.colors.humanGlow, 0.6, 10);
        warmLight.position.set(zone.center + 3, 3, 0);
        group.add(warmLight);

        // Soft golden orb beyond the wall
        var orbGeo = new THREE.SphereGeometry(1.2, 24, 24);
        var orbMat = new THREE.MeshBasicMaterial({
            color: CONFIG.colors.humanGlow,
            transparent: true,
            opacity: 0.08,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        var orb = new THREE.Mesh(orbGeo, orbMat);
        orb.position.set(zone.center + 3, 2.8, 0);
        group.add(orb);
    }

    // Gated: status indicator sphere
    var indicator = null;
    if (zone.id === 'gated') {
        var indGeo = new THREE.SphereGeometry(0.1, 12, 12);
        var indMat = new THREE.MeshBasicMaterial({
            color: 0x34d399,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        indicator = new THREE.Mesh(indGeo, indMat);
        indicator.position.set(zone.center, 5.3, 0);
        group.add(indicator);
    }

    // Invisible click target
    var clickGeo = new THREE.PlaneGeometry(5.5, 5.5);
    var clickMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    var clickTarget = new THREE.Mesh(clickGeo, clickMat);
    clickTarget.position.set(zone.center, 2.5, 0);
    clickTarget.userData.zoneId = zone.id;
    group.add(clickTarget);

    scene.add(group);

    return {
        group: group,
        membrane: membrane,
        membrane2: membrane2,
        light: light,
        clickTarget: clickTarget,
        material: mat,
        material2: mat2,
        indicator: indicator,
    };
}

// ============================================================
// Create All Zones
// ============================================================
function createAllZones() {
    ZONES.forEach(function(zone) {
        zoneObjects[zone.id] = createMembrane(zone);
    });
}

// ============================================================
// Particle System
// ============================================================
function createParticleSystem() {
    var count = PerformanceMode.isLowFi ? CONFIG.particles.countLowFi : CONFIG.particles.count;
    var geo = new THREE.SphereGeometry(CONFIG.particles.size, 8, 8);

    for (var i = 0; i < count; i++) {
        var mat = new THREE.MeshBasicMaterial({
            color: CONFIG.colors.particleAI,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        var particle = new THREE.Mesh(geo, mat);
        particle.userData = {
            baseSpeed: 1.5 + Math.random() * 1.5,
            phase: Math.random() * Math.PI * 2,
            yOffset: 0,
            zOffset: 0,
            isTagged: false,
            isStopped: false,
            fadeOutTimer: 0,
            flashTimer: 0,
            gatedFlashed: false,
        };
        resetParticle(particle, -14 + Math.random() * 28);
        scene.add(particle);
        particles.push(particle);
    }
}

function resetParticle(particle, startX) {
    var x = startX !== undefined ? startX : -14 - Math.random() * 3;
    var y = (Math.random() - 0.5) * 3 + 2.5;
    var z = (Math.random() - 0.5) * 2.5;
    particle.position.set(x, y, z);
    particle.userData.isTagged = false;
    particle.userData.isStopped = false;
    particle.userData.fadeOutTimer = 0;
    particle.userData.flashTimer = 0;
    particle.userData.gatedFlashed = false;
    particle.userData.yOffset = y;
    particle.userData.zOffset = z;
    particle.material.color.set(CONFIG.colors.particleAI);
    particle.material.opacity = 0.7;
    particle.scale.setScalar(1.0);
}

// ============================================================
// Gate Cycle (pore open/close animation)
// ============================================================
function initGateCycle() {
    if (typeof gsap === 'undefined') return;
    gateTimeline = gsap.timeline({ repeat: -1 });
    gateTimeline
        .to(poreOpenValue, { value: 0.0, duration: 0.8, ease: 'power2.in' })
        .to({}, { duration: 3.0 })
        .to(poreOpenValue, { value: 1.0, duration: 0.6, ease: 'power2.out' })
        .to({}, { duration: 2.5 });
}

// ============================================================
// Update Membranes
// ============================================================
function updateMembranes(t) {
    var gatedX = CONFIG.layout.zoneCenters.gated;
    Object.keys(zoneObjects).forEach(function(id) {
        var zo = zoneObjects[id];
        if (zo.material) zo.material.uniforms.time.value = t;
        if (zo.material2) zo.material2.uniforms.time.value = t;

        if (id === 'gated') {
            if (zo.material) zo.material.uniforms.poreOpen.value = poreOpenValue.value;
            if (zo.material2) zo.material2.uniforms.poreOpen.value = poreOpenValue.value;

            // Orbiting status indicator
            if (zo.indicator) {
                var angle = t * 0.5;
                zo.indicator.position.x = gatedX + Math.cos(angle) * 0.5;
                zo.indicator.position.z = Math.sin(angle) * 0.5;

                if (poreOpenValue.value > 0.7) {
                    zo.indicator.material.color.setHex(0x34d399);
                } else if (poreOpenValue.value > 0.3) {
                    zo.indicator.material.color.setHex(0xfbbf24);
                } else {
                    zo.indicator.material.color.setHex(0xdc2626);
                }
            }
        }
    });
}

// ============================================================
// Update Particles
// ============================================================
function updateParticles(t) {
    var VISIBLE_X = CONFIG.layout.zoneCenters.visible;
    var GATED_X = CONFIG.layout.zoneCenters.gated;
    var HUMAN_X = CONFIG.layout.zoneCenters.humanOnly;
    var dt = 0.016;

    particles.forEach(function(particle) {
        var x = particle.position.x;
        var ud = particle.userData;
        var speed = ud.baseSpeed;

        // Flash timer (membrane contact effect)
        if (ud.flashTimer > 0) {
            ud.flashTimer -= dt;
            var flashProgress = Math.max(0, ud.flashTimer / 0.3);
            particle.scale.setScalar(1.0 + flashProgress * 0.5);
            particle.material.opacity = 0.7 + flashProgress * 0.3;
        } else {
            particle.scale.setScalar(1.0);
        }

        // Zone behavior
        if (x < -6) {
            // SEAMLESS — full speed, cyan
            speed *= 1.0;
            particle.material.color.lerp(_aiColor, 0.08);
            if (ud.flashTimer <= 0) {
                particle.material.opacity += (0.7 - particle.material.opacity) * 0.1;
            }

        } else if (x < 0) {
            // VISIBLE — tag at membrane, slow slightly
            speed *= 0.75;
            if (!ud.isTagged && x > VISIBLE_X) {
                ud.isTagged = true;
                ud.flashTimer = 0.3;
            }
            if (ud.isTagged) {
                particle.material.color.lerp(_taggedColor, 0.04);
            }

        } else if (x < 6) {
            // GATED — behavior depends on pore state
            var poreState = poreOpenValue.value;
            if (poreState > 0.5) {
                speed *= 0.4;
                if (!ud.gatedFlashed && Math.abs(x - GATED_X) < 0.3) {
                    ud.gatedFlashed = true;
                    ud.flashTimer = 0.3;
                }
            } else {
                var distToMembrane = GATED_X - x;
                if (distToMembrane > 0 && distToMembrane < 3) {
                    speed *= 0.05 + (distToMembrane / 3) * 0.2;
                } else if (distToMembrane <= 0) {
                    speed *= 0.15;
                } else {
                    speed *= 0.3;
                }
            }
            particle.material.color.lerp(_gatedColor, 0.02);

        } else {
            // HUMAN-ONLY — decelerate at membrane, stop, drift back
            var distToWall = HUMAN_X - x;
            if (distToWall > 2) {
                speed *= Math.max(0.1, distToWall / 5);
            } else if (distToWall > 0 && !ud.isStopped) {
                speed *= 0.02;
            } else if (!ud.isStopped) {
                ud.isStopped = true;
                ud.fadeOutTimer = 0;
            }

            if (ud.isStopped) {
                speed = -0.3;
                ud.fadeOutTimer += dt;
                particle.material.opacity = Math.max(0, 0.7 - ud.fadeOutTimer * 0.35);
                particle.position.y += 0.01;
            }
            particle.material.color.lerp(_humanOnlyColor, 0.02);
        }

        // Move
        particle.position.x += speed * dt;

        // Gentle oscillation
        if (!ud.isStopped) {
            particle.position.y = ud.yOffset + Math.sin(t * 0.6 + ud.phase) * 0.12;
            particle.position.z = ud.zOffset + Math.sin(t * 0.3 + ud.phase * 2) * 0.08;
        }

        // Reset check
        if (ud.fadeOutTimer > 2.5 || x < -15 || x > 14) {
            resetParticle(particle);
        }
    });
}

// ============================================================
// Label Projection (3D → 2D)
// ============================================================
function updateLabels() {
    ZONES.forEach(function(zone) {
        var label = document.getElementById('label-' + zone.id);
        if (!label) return;

        _labelPos.set(zone.center, 5.5, 0);
        _labelPos.project(camera);

        var sx = (_labelPos.x * 0.5 + 0.5) * window.innerWidth;
        var sy = (-_labelPos.y * 0.5 + 0.5) * window.innerHeight;

        label.style.left = sx + 'px';
        label.style.top = sy + 'px';

        if (_labelPos.z > 1) {
            label.classList.remove('visible');
        } else if (StateManager.currentView === 'overview' || StateManager.currentView === zone.id) {
            label.classList.add('visible');
        }
    });
}

// ============================================================
// Hover / Raycasting
// ============================================================
function checkHover() {
    if (isTouchDevice) return;

    _mouseVec2.set(mouse.x, mouse.y);
    _raycaster.setFromCamera(_mouseVec2, camera);

    var clickTargets = [];
    Object.keys(zoneObjects).forEach(function(k) { clickTargets.push(zoneObjects[k].clickTarget); });
    var intersects = _raycaster.intersectObjects(clickTargets);

    hoveredZone = null;
    if (intersects.length > 0) {
        hoveredZone = intersects[0].object.userData.zoneId;
        document.body.style.cursor = 'pointer';
    } else {
        document.body.style.cursor = 'default';
    }
    updateTooltip();
}

function updateTooltip() {
    var tooltip = document.getElementById('tooltip');
    if (!tooltip) return;

    if (hoveredZone && !StateManager.focusedZone) {
        var zone = null;
        for (var i = 0; i < ZONES.length; i++) {
            if (ZONES[i].id === hoveredZone) { zone = ZONES[i]; break; }
        }
        if (zone) {
            tooltip.querySelector('.tip-title').textContent = zone.title;
            tooltip.querySelector('.tip-desc').textContent = zone.subtitle;
            tooltip.style.left = (mouseClient.x + 15) + 'px';
            tooltip.style.top = (mouseClient.y - 10) + 'px';
            tooltip.classList.add('visible');
        }
    } else {
        tooltip.classList.remove('visible');
    }
}

// ============================================================
// Focus / Unfocus
// ============================================================
function focusOnZone(zone) {
    if (typeof gsap === 'undefined') return;

    StateManager.setFocusedZone(zone.id);
    StateManager.currentView = zone.id;

    var preset = CAMERA_PRESETS[zone.id];
    gsap.to(camera.position, {
        x: preset.position.x, y: preset.position.y, z: preset.position.z,
        duration: 1.5, ease: 'power2.inOut',
        onUpdate: function() { controls.update(); },
    });
    gsap.to(controls.target, {
        x: preset.target.x, y: preset.target.y, z: preset.target.z,
        duration: 1.5, ease: 'power2.inOut',
    });

    setSceneDimming(true, zone.id);
    showDetailPanel(zone);
    updateViewButtons(zone.id);

    // Hide non-focused labels
    ZONES.forEach(function(z) {
        var label = document.getElementById('label-' + z.id);
        if (label && z.id !== zone.id) label.classList.remove('visible');
    });

    var freqs = { seamless: 262, visible: 330, gated: 392, 'human-only': 523 };
    AudioManager.playNote(freqs[zone.id] || 392, 0.5);
}

function exitFocus() {
    if (typeof gsap === 'undefined') return;

    StateManager.setFocusedZone(null);
    StateManager.currentView = 'overview';

    var preset = CAMERA_PRESETS.overview;
    gsap.to(camera.position, {
        x: preset.position.x, y: preset.position.y, z: preset.position.z,
        duration: 1.5, ease: 'power2.inOut',
        onUpdate: function() { controls.update(); },
    });
    gsap.to(controls.target, {
        x: preset.target.x, y: preset.target.y, z: preset.target.z,
        duration: 1.5, ease: 'power2.inOut',
    });

    setSceneDimming(false, null);
    hideDetailPanel();
    updateViewButtons('overview');
}

function setView(viewId) {
    StateManager.recordInteraction();
    if (viewId === 'overview') {
        exitFocus();
    } else {
        var zone = null;
        for (var i = 0; i < ZONES.length; i++) {
            if (ZONES[i].id === viewId) { zone = ZONES[i]; break; }
        }
        if (zone) focusOnZone(zone);
    }
}

// ============================================================
// Scene Dimming
// ============================================================
function setSceneDimming(dimmed, exceptZoneId) {
    if (typeof gsap === 'undefined') return;

    Object.keys(zoneObjects).forEach(function(id) {
        var zo = zoneObjects[id];
        var isException = (id === exceptZoneId);
        var targetScale = dimmed && !isException ? 0.4 : 1.0;

        zo.group.traverse(function(child) {
            if (child.material && child.material.transparent !== undefined) {
                if (child.material.visible === false) return;
                if (child.userData.baseOpacity === undefined) {
                    child.userData.baseOpacity = child.material.opacity !== undefined ? child.material.opacity : 1.0;
                }
                var target = (child.userData.baseOpacity || 0.5) * targetScale;
                gsap.to(child.material, { opacity: target, duration: 0.6 });
            }
        });

        if (zo.light) {
            var targetI = dimmed && !isException ? 0.1 : 0.4;
            gsap.to(zo.light, { intensity: targetI, duration: 0.6 });
        }
    });
}

// ============================================================
// Detail Panel
// ============================================================
function showDetailPanel(zone) {
    var panel = document.getElementById('detail-panel');
    if (!panel) return;

    var stakesEl = panel.querySelector('.panel-stakes');
    stakesEl.textContent = zone.stakes;
    stakesEl.style.background = zone.colorHex + '22';
    stakesEl.style.color = zone.colorHex;

    panel.querySelector('.panel-title').textContent = zone.title;
    panel.querySelector('.panel-subtitle').textContent = zone.subtitle;
    panel.querySelector('.panel-description').textContent = zone.description;
    panel.querySelector('.panel-examples').textContent = zone.examples;

    var quoteEl = panel.querySelector('.panel-quote');
    if (zone.quote) {
        quoteEl.innerHTML = '\u201C' + zone.quote + '\u201D' +
            (zone.quoteAttr ? '<span class="quote-attr">\u2014 ' + zone.quoteAttr + '</span>' : '');
        quoteEl.style.display = 'block';
    } else {
        quoteEl.style.display = 'none';
    }

    panel.classList.add('open');
}

function hideDetailPanel() {
    var panel = document.getElementById('detail-panel');
    if (panel) panel.classList.remove('open');
}

function navigateZone(direction) {
    var currentZone = StateManager.focusedZone;
    if (!currentZone) return;

    var currentIndex = -1;
    for (var i = 0; i < ZONES.length; i++) {
        if (ZONES[i].id === currentZone) { currentIndex = i; break; }
    }
    var nextIndex = (currentIndex + direction + ZONES.length) % ZONES.length;
    focusOnZone(ZONES[nextIndex]);
}

// ============================================================
// View Buttons
// ============================================================
function updateViewButtons(activeView) {
    var buttons = document.querySelectorAll('#view-controls button');
    for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        if (btn.dataset.view === activeView) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }
}

// ============================================================
// Events
// ============================================================
function setupEvents() {
    window.addEventListener('resize', function() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    document.addEventListener('mousemove', function(e) {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        mouseClient.x = e.clientX;
        mouseClient.y = e.clientY;
        StateManager.recordInteraction();
    });

    renderer.domElement.addEventListener('click', function(e) {
        StateManager.recordInteraction();

        _mouseVec2.set(
            (e.clientX / window.innerWidth) * 2 - 1,
            -(e.clientY / window.innerHeight) * 2 + 1
        );
        _raycaster.setFromCamera(_mouseVec2, camera);

        var clickTargets = [];
        Object.keys(zoneObjects).forEach(function(k) { clickTargets.push(zoneObjects[k].clickTarget); });
        var intersects = _raycaster.intersectObjects(clickTargets);

        if (intersects.length > 0) {
            var zoneId = intersects[0].object.userData.zoneId;
            var zone = null;
            for (var i = 0; i < ZONES.length; i++) {
                if (ZONES[i].id === zoneId) { zone = ZONES[i]; break; }
            }
            if (zone) {
                if (StateManager.focusedZone === zoneId) { exitFocus(); } else { focusOnZone(zone); }
            }
        } else if (StateManager.focusedZone) {
            exitFocus();
        }
    });

    // Touch support
    if (isTouchDevice) {
        renderer.domElement.addEventListener('touchstart', function(e) {
            if (e.touches.length !== 1) return;
            StateManager.recordInteraction();
            var touch = e.touches[0];
            _mouseVec2.set(
                (touch.clientX / window.innerWidth) * 2 - 1,
                -(touch.clientY / window.innerHeight) * 2 + 1
            );
            _raycaster.setFromCamera(_mouseVec2, camera);
            var clickTargets = [];
            Object.keys(zoneObjects).forEach(function(k) { clickTargets.push(zoneObjects[k].clickTarget); });
            var intersects = _raycaster.intersectObjects(clickTargets);
            if (intersects.length > 0) {
                var zoneId = intersects[0].object.userData.zoneId;
                var zone = null;
                for (var j = 0; j < ZONES.length; j++) {
                    if (ZONES[j].id === zoneId) { zone = ZONES[j]; break; }
                }
                if (zone) focusOnZone(zone);
            }
        }, { passive: true });
    }

    // Keyboard
    document.addEventListener('keydown', function(e) {
        StateManager.recordInteraction();
        switch (e.key) {
            case '0': setView('overview'); break;
            case '1': setView('seamless'); break;
            case '2': setView('visible'); break;
            case '3': setView('gated'); break;
            case '4': setView('human-only'); break;
            case 'Escape': exitFocus(); break;
            case 'ArrowRight': if (StateManager.focusedZone) navigateZone(1); break;
            case 'ArrowLeft': if (StateManager.focusedZone) navigateZone(-1); break;
        }
    });
}

// ============================================================
// Idle Auto-Pan
// ============================================================
var idlePanActive = false;
var idlePanProgress = 0;

function updateIdlePan() {
    if (StateManager.focusedZone) {
        idlePanActive = false;
        idlePanProgress = 0;
        return;
    }
    if (!StateManager.isIdle()) {
        idlePanActive = false;
        return;
    }
    if (!idlePanActive) {
        idlePanActive = true;
        idlePanProgress = 0;
    }
    idlePanProgress += 0.0003;
    if (idlePanProgress > 1) idlePanProgress = 0;

    var targetX = -12 + idlePanProgress * 24;
    camera.position.x += (targetX - camera.position.x) * 0.01;
    controls.target.x += (targetX * 0.8 - controls.target.x) * 0.01;
}

// ============================================================
// Intro Animation
// ============================================================
function playIntro() {
    if (typeof gsap === 'undefined') return;

    var preset = CAMERA_PRESETS.overview;
    gsap.to(camera.position, {
        x: preset.position.x, y: preset.position.y, z: preset.position.z,
        duration: 2.5, ease: 'power2.out',
        onUpdate: function() { controls.update(); },
    });
    gsap.to(controls.target, {
        x: preset.target.x, y: preset.target.y, z: preset.target.z,
        duration: 2.5, ease: 'power2.out',
    });

    var uiIds = ['header', 'view-controls', 'quote', 'legend', 'friction-arrow', 'controls-hint', 'audio-toggle'];
    uiIds.forEach(function(id, i) {
        setTimeout(function() {
            var el = document.getElementById(id);
            if (el) el.classList.add('visible');
        }, 800 + i * 200);
    });

    // Show labels after camera settles
    setTimeout(function() {
        ZONES.forEach(function(zone) {
            var label = document.getElementById('label-' + zone.id);
            if (label) label.classList.add('visible');
        });
    }, 2000);
}

// ============================================================
// Animation Loop
// ============================================================
function animate() {
    requestAnimationFrame(animate);
    var t = performance.now() * 0.001;

    controls.update();
    updateMembranes(t);
    updateParticles(t);
    updateLabels();
    checkHover();
    updateIdlePan();

    renderer.render(scene, camera);
}

// ============================================================
// Start
// ============================================================
window.addEventListener('DOMContentLoaded', init);

// ============================================================
// Global Exports (for HTML onclick)
// ============================================================
window.setView = setView;
window.exitFocus = exitFocus;
window.navigateZone = navigateZone;
window.toggleAudio = function() { AudioManager.toggle(); };
