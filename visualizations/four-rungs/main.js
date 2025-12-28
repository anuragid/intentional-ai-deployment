/**
 * The Four Rungs
 * A visualization of the problem abstraction ladder
 *
 * Design Philosophy:
 * - ONE central metaphor: The luminous conduit of proper decision-making
 * - Energy flows DOWN through abstraction (the right path)
 * - Simple, purposeful geometry
 * - Awe-inspiring, not cluttered
 *
 * Part 2: Before You Automate
 * "80% of AI projects fail by starting on the wrong rung"
 */

// ============================================================
// Configuration
// ============================================================
const CONFIG = {
    colors: {
        bg: 0x08080c,           // Deep void

        // Human Territory - Warm light from above
        outcome: 0xe8c496,      // Soft warm gold
        approach: 0xd4b07a,     // Warm amber

        // AI Territory - Cool light from below
        method: 0x7a9cb8,       // Cool steel blue
        execution: 0x6889a0,    // Deep slate blue

        // The Conduit - Transitions from warm to cool
        beamTop: 0xf5d4a8,      // Warm cream
        beamBottom: 0x8ab4d0,   // Cool blue

        // Judgment Boundary - Distinct from both territories
        boundary: 0xe0d8c8,     // Cream/warm white - neutral dividing line
        boundaryGlow: 0xf0ebe0, // Light cream glow

        // Accent
        warning: 0xd4756a,      // Dusty rose
    },

    // Vertical positions
    positions: {
        outcome: 5.5,
        approach: 3.5,
        boundary: 2.0,          // The membrane sits here
        method: 1.0,
        execution: -1.0,
    },

    // Ring radii - smaller, more elegant
    radii: {
        outcome: 2.2,
        approach: 1.8,
        method: 1.5,
        execution: 1.2,
    },

    // Central beam
    beam: {
        topRadius: 0.4,
        bottomRadius: 0.15,
        segments: 32,
    }
};

// Rung data
const RUNGS = [
    {
        id: 'outcome',
        title: 'Outcome',
        question: 'What does success look like?',
        description: 'The destination. What will be different in the world when you succeed? AI cannot tell you what problem deserves solving.',
        territory: 'human',
        y: CONFIG.positions.outcome,
        radius: CONFIG.radii.outcome,
        color: CONFIG.colors.outcome,
    },
    {
        id: 'approach',
        title: 'Approach',
        question: 'How will we create value?',
        description: 'The strategy. Two organizations might pursue the same outcome through radically different approaches. AI cannot tell you how to differentiate.',
        territory: 'human',
        y: CONFIG.positions.approach,
        radius: CONFIG.radii.approach,
        color: CONFIG.colors.approach,
    },
    {
        id: 'method',
        title: 'Method',
        question: 'What capabilities will we deploy?',
        description: 'The tactics. This is where AI enters the conversation. What specific tools and technologies will execute your approach?',
        territory: 'ai',
        y: CONFIG.positions.method,
        radius: CONFIG.radii.method,
        color: CONFIG.colors.method,
    },
    {
        id: 'execution',
        title: 'Execution',
        question: 'How will we implement day-to-day?',
        description: 'The implementation. Workflows, automation, tactical details. AI excels here when given clear objectives from above.',
        territory: 'ai',
        y: CONFIG.positions.execution,
        radius: CONFIG.radii.execution,
        color: CONFIG.colors.execution,
    },
];

// ============================================================
// Global State
// ============================================================
let scene, camera, renderer, controls;
let centralBeam, boundaryMembrane;
let rungRings = [];
let particles = [];
let focusedRung = null;
let currentView = 'recommended';
let flowDirection = 1; // 1 = down (recommended), -1 = up (current/problematic)

// Touch detection
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// ============================================================
// Performance Mode
// ============================================================
const PerformanceMode = {
    isLowFi: false,
    isEmbed: false,

    detect() {
        const urlParams = new URLSearchParams(window.location.search);
        this.isEmbed = urlParams.get('embed') === 'true';

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const hasLowCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;

        this.isLowFi = isMobile || hasLowCores;

        if (urlParams.get('lowfi') === 'true') this.isLowFi = true;
        if (urlParams.get('lowfi') === 'false') this.isLowFi = false;

        return { isLowFi: this.isLowFi, isEmbed: this.isEmbed };
    }
};

// ============================================================
// Audio Manager
// ============================================================
const AudioManager = {
    context: null,
    masterGain: null,
    enabled: false,
    initialized: false,

    init() {
        if (this.initialized) return;

        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.context = new AudioContextClass();

            this.masterGain = this.context.createGain();
            this.masterGain.gain.value = 0;
            this.masterGain.connect(this.context.destination);

            this.initialized = true;
        } catch (e) {
            console.warn('Audio not available:', e);
        }
    },

    toggle() {
        if (!this.initialized) this.init();
        if (!this.context) return;

        this.enabled = !this.enabled;

        if (this.enabled) {
            if (this.context.state === 'suspended') {
                this.context.resume();
            }
            this.startAmbient();
            gsap.to(this.masterGain.gain, { value: 0.3, duration: 2 });
        } else {
            gsap.to(this.masterGain.gain, { value: 0, duration: 1 });
        }

        this.updateButton();
    },

    startAmbient() {
        if (!this.context || this.ambientStarted) return;
        this.ambientStarted = true;

        // Deep, contemplative drone
        const frequencies = [65.41, 98.00, 130.81]; // C2, G2, C3

        frequencies.forEach((freq, i) => {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.value = 0.08 / (i + 1);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
        });
    },

    playNote(frequency, duration = 0.3) {
        if (!this.enabled || !this.context) return;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.type = 'sine';
        osc.frequency.value = frequency;

        gain.gain.setValueAtTime(0.15, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.context.destination);

        osc.start();
        osc.stop(this.context.currentTime + duration);
    },

    updateButton() {
        const btn = document.getElementById('audioBtn');
        if (btn) {
            btn.innerHTML = this.enabled
                ? '<span class="audio-icon">♫</span><span class="audio-label">Sound On</span>'
                : '<span class="audio-icon">♪</span><span class="audio-label">Sound Off</span>';
            btn.classList.toggle('active', this.enabled);
        }
    }
};

// ============================================================
// State Manager
// ============================================================
const StateManager = {
    state: {
        view: 'overview',
        focusedRung: null,
        showMistakes: false,
    },

    listeners: [],

    subscribe(fn) {
        this.listeners.push(fn);
        return () => this.listeners = this.listeners.filter(l => l !== fn);
    },

    update(changes) {
        Object.assign(this.state, changes);
        this.listeners.forEach(fn => fn(this.state));
    },

    get(key) {
        return this.state[key];
    }
};

// ============================================================
// Camera Presets
// ============================================================
const CAMERA_PRESETS = {
    recommended: {
        // Slightly higher, looking down - emphasizes the top-down flow
        position: { x: 5, y: 5, z: 13 },
        target: { x: 0, y: 2.0, z: 0 }
    },
    current: {
        // Slightly lower and closer - still shows full diagram but subtle shift
        // Emphasizes the bottom-up problematic pattern
        position: { x: 4, y: 3, z: 11 },
        target: { x: 0, y: 2.0, z: 0 }
    }
};

// ============================================================
// Initialization
// ============================================================
window.addEventListener('DOMContentLoaded', init);

function init() {
    PerformanceMode.detect();

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.colors.bg);
    scene.fog = new THREE.Fog(CONFIG.colors.bg, 12, 35);

    // Camera
    camera = new THREE.PerspectiveCamera(
        50,
        window.innerWidth / window.innerHeight,
        0.1,
        100
    );
    camera.position.set(8, 6, 16);
    camera.lookAt(0, 2.0, 0);

    // Renderer
    const canvas = document.getElementById('canvas');
    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !PerformanceMode.isLowFi,
        alpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !PerformanceMode.isLowFi;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 5;
    controls.maxDistance = 25;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.target.set(0, 2.0, 0);

    // Lighting
    setupLighting();

    // Create scene elements
    createGround();
    createCentralBeam();
    createRungRings();
    createBoundaryMembrane();
    if (!PerformanceMode.isLowFi) {
        createParticles();
    }

    // Events
    setupEvents();

    // Start animation
    animate();

    // Play intro
    setTimeout(playIntro, 100);
}

// ============================================================
// Lighting
// ============================================================
function setupLighting() {
    // Ambient - soft fill
    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(ambient);

    // Warm light from above (Human Territory)
    const warmLight = new THREE.PointLight(0xffecd2, 0.6, 15);
    warmLight.position.set(0, 8, 0);
    scene.add(warmLight);

    // Cool light from below (AI Territory)
    const coolLight = new THREE.PointLight(0xd4e8f2, 0.4, 12);
    coolLight.position.set(0, -3, 0);
    scene.add(coolLight);

    // Subtle directional for definition
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);
}

// ============================================================
// Ground
// ============================================================
function createGround() {
    // Simple dark plane - unobtrusive
    const geometry = new THREE.PlaneGeometry(50, 50);
    const material = new THREE.MeshStandardMaterial({
        color: 0x0a0a0e,
        roughness: 1,
        metalness: 0
    });

    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Very subtle grid
    const grid = new THREE.GridHelper(30, 30, 0x151520, 0x101018);
    grid.position.y = -1.99;
    grid.material.opacity = 0.3;
    grid.material.transparent = true;
    scene.add(grid);
}

// ============================================================
// Central Beam - The Conduit
// ============================================================
function createCentralBeam() {
    const group = new THREE.Group();

    // The beam tapers from wide at top to narrow at bottom
    // This represents: broad thinking (Outcome) -> focused execution
    const topY = CONFIG.positions.outcome + 1;
    const bottomY = CONFIG.positions.execution - 0.5;
    const height = topY - bottomY;

    // Outer glow cylinder
    const glowGeometry = new THREE.CylinderGeometry(
        CONFIG.beam.topRadius * 2.5,
        CONFIG.beam.bottomRadius * 2.5,
        height,
        32,
        1,
        true
    );
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.03,
        side: THREE.DoubleSide
    });
    const glowCylinder = new THREE.Mesh(glowGeometry, glowMaterial);
    glowCylinder.position.y = (topY + bottomY) / 2;
    group.add(glowCylinder);

    // Inner core - the actual beam
    const coreGeometry = new THREE.CylinderGeometry(
        CONFIG.beam.topRadius,
        CONFIG.beam.bottomRadius,
        height,
        32,
        1,
        true
    );

    // Gradient shader for warm-to-cool transition
    const coreMaterial = new THREE.ShaderMaterial({
        uniforms: {
            colorTop: { value: new THREE.Color(CONFIG.colors.beamTop) },
            colorBottom: { value: new THREE.Color(CONFIG.colors.beamBottom) },
            time: { value: 0 },
            opacity: { value: 0.25 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 colorTop;
            uniform vec3 colorBottom;
            uniform float time;
            uniform float opacity;
            varying vec2 vUv;

            void main() {
                // Gradient from top to bottom
                vec3 color = mix(colorBottom, colorTop, vUv.y);

                // Subtle pulse
                float pulse = 0.9 + 0.1 * sin(time * 0.5 + vUv.y * 3.14159);

                gl_FragColor = vec4(color * pulse, opacity);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide
    });

    const coreCylinder = new THREE.Mesh(coreGeometry, coreMaterial);
    coreCylinder.position.y = (topY + bottomY) / 2;
    group.add(coreCylinder);

    // Central bright line
    const lineGeometry = new THREE.CylinderGeometry(0.02, 0.01, height, 8);
    const lineMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.5
    });
    const centerLine = new THREE.Mesh(lineGeometry, lineMaterial);
    centerLine.position.y = (topY + bottomY) / 2;
    group.add(centerLine);

    scene.add(group);
    centralBeam = { group, coreMaterial };
}

// ============================================================
// Rung Rings - Simple, Elegant Circles
// ============================================================
function createRungRings() {
    RUNGS.forEach((rung, index) => {
        const group = new THREE.Group();
        group.userData = { rung, index };

        // Main ring - thin elegant torus
        const ringGeometry = new THREE.TorusGeometry(rung.radius, 0.03, 16, 64);
        const ringMaterial = new THREE.MeshStandardMaterial({
            color: rung.color,
            emissive: rung.color,
            emissiveIntensity: 0.3,
            roughness: 0.3,
            metalness: 0.7,
            transparent: true,
            opacity: 0.9
        });

        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = rung.y;
        ring.castShadow = true;
        group.add(ring);

        // Inner glow disc - very subtle (also used for click detection)
        const discGeometry = new THREE.CircleGeometry(rung.radius - 0.1, 64);
        const discMaterial = new THREE.MeshBasicMaterial({
            color: rung.color,
            transparent: true,
            opacity: 0.05,
            side: THREE.DoubleSide
        });

        const disc = new THREE.Mesh(discGeometry, discMaterial);
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = rung.y;
        group.add(disc);

        // Outer glow ring (also clickable)
        const glowGeometry = new THREE.TorusGeometry(rung.radius, 0.15, 8, 64);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: rung.color,
            transparent: true,
            opacity: 0.08
        });

        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.rotation.x = Math.PI / 2;
        glow.position.y = rung.y;
        group.add(glow);

        scene.add(group);
        rungRings.push({
            group,
            ring,
            disc,
            glow,
            material: ringMaterial,
            rung
        });
    });
}

// ============================================================
// Judgment Boundary - Fog layers
// ============================================================
function createBoundaryMembrane() {
    const y = CONFIG.positions.boundary;
    const group = new THREE.Group();

    // Create multiple layered fog planes for volumetric effect
    const fogLayers = 8;
    const fogMaterials = [];

    for (let i = 0; i < fogLayers; i++) {
        const layerY = y + (i - fogLayers / 2) * 0.08;

        const fogGeometry = new THREE.PlaneGeometry(12, 12);
        const fogMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(CONFIG.colors.boundary) },
                time: { value: 0 },
                layerIndex: { value: i }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float time;
                uniform float layerIndex;
                varying vec2 vUv;

                // Simplex-style noise
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }

                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    float a = hash(i);
                    float b = hash(i + vec2(1.0, 0.0));
                    float c = hash(i + vec2(0.0, 1.0));
                    float d = hash(i + vec2(1.0, 1.0));
                    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
                }

                float fbm(vec2 p) {
                    float value = 0.0;
                    float amplitude = 0.5;
                    for (int i = 0; i < 4; i++) {
                        value += amplitude * noise(p);
                        p *= 2.0;
                        amplitude *= 0.5;
                    }
                    return value;
                }

                void main() {
                    vec2 center = vUv - 0.5;
                    float dist = length(center);

                    // Rotate coordinates for spinning noise
                    float rot = time * 0.3;
                    mat2 rotMat = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
                    vec2 rotatedCoord = rotMat * center;

                    // Sample noise at rotated coordinates
                    float n = fbm(rotatedCoord * 6.0 + layerIndex * 0.5);

                    // Full circle shape - soft fade at edges only
                    float circle = 1.0 - smoothstep(0.3, 0.45, dist);

                    // Combine circle with noise for non-uniform rotating fog
                    float density = circle * (0.4 + n * 0.6);

                    float alpha = density * 0.06;
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const fogPlane = new THREE.Mesh(fogGeometry, fogMaterial);
        fogPlane.rotation.x = -Math.PI / 2;
        fogPlane.position.y = layerY;
        group.add(fogPlane);
        fogMaterials.push(fogMaterial);
    }

    scene.add(group);
    boundaryMembrane = { group, fogMaterials };
}

// ============================================================
// Particles - Energy flowing down the conduit
// ============================================================
function createParticles() {
    const particleCount = 50; // More particles for better coverage

    for (let i = 0; i < particleCount; i++) {
        // Larger particles for better visibility
        const geometry = new THREE.SphereGeometry(0.045, 8, 8);

        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.7
        });

        const particle = new THREE.Mesh(geometry, material);

        // Each particle has unique characteristics
        particle.userData = {
            angleOffset: Math.random() * Math.PI * 2,
            speed: 0.4 + Math.random() * 0.4,
            spiralSpeed: 0.3 + Math.random() * 0.3,
            radiusFactor: 0.3 + Math.random() * 0.7, // How far from center (0.3-1.0)
            startDelay: Math.random() * 5 // Stagger start times
        };

        // Initialize at different positions along the beam for variety
        resetParticle(particle, i / particleCount);
        scene.add(particle);
        particles.push(particle);
    }
}

function resetParticle(particle, initialProgress = 0) {
    // Particles start at the very top - above the Outcome ring
    const topY = CONFIG.positions.outcome + 1.0;
    const bottomY = CONFIG.positions.execution - 0.5;

    // Start position - either at top or distributed along beam initially
    if (initialProgress > 0) {
        // For initial setup, distribute along the beam
        particle.position.y = topY - (topY - bottomY) * initialProgress;
    } else {
        // For reset, always start at top with slight variation
        particle.position.y = topY + Math.random() * 0.3;
    }

    // Calculate radius based on Y position (beam tapers from top to bottom)
    const beamTopRadius = CONFIG.beam.topRadius * 1.5;
    const beamBottomRadius = CONFIG.beam.bottomRadius * 1.5;
    const t = (particle.position.y - bottomY) / (topY - bottomY);
    const currentBeamRadius = THREE.MathUtils.lerp(beamBottomRadius, beamTopRadius, t);

    // Position within the beam at this level
    const angle = particle.userData.angleOffset;
    const radius = currentBeamRadius * particle.userData.radiusFactor;
    particle.position.x = Math.cos(angle) * radius;
    particle.position.z = Math.sin(angle) * radius;
}

function resetParticleToPosition(particle, targetY) {
    // Reset particle to a specific Y position (for direction-dependent reset)
    const topY = CONFIG.positions.outcome + 1.0;
    const bottomY = CONFIG.positions.execution - 0.5;

    // Add slight variation to the target position
    particle.position.y = targetY + (Math.random() - 0.5) * 0.4;

    // Calculate radius based on Y position (beam tapers from top to bottom)
    const beamTopRadius = CONFIG.beam.topRadius * 1.5;
    const beamBottomRadius = CONFIG.beam.bottomRadius * 1.5;
    const t = Math.max(0, Math.min(1, (particle.position.y - bottomY) / (topY - bottomY)));
    const currentBeamRadius = THREE.MathUtils.lerp(beamBottomRadius, beamTopRadius, t);

    // Position within the beam at this level
    const angle = particle.userData.angleOffset + Math.random() * 0.5;
    const radius = currentBeamRadius * particle.userData.radiusFactor;
    particle.position.x = Math.cos(angle) * radius;
    particle.position.z = Math.sin(angle) * radius;
}

// ============================================================
// Events
// ============================================================
function setupEvents() {
    window.addEventListener('resize', onResize);

    // View mode buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            setViewMode(mode);
        });
    });

    // Audio toggle
    const audioBtn = document.getElementById('audioBtn');
    if (audioBtn) {
        audioBtn.addEventListener('click', () => AudioManager.toggle());
    }

    // Click on rungs
    renderer.domElement.addEventListener('click', onCanvasClick);

    // Keyboard
    document.addEventListener('keydown', onKeyDown);
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onCanvasClick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Check all clickable elements: ring, disc, and glow
    const clickableMeshes = rungRings.flatMap(r => [r.ring, r.disc, r.glow]);
    const intersects = raycaster.intersectObjects(clickableMeshes);

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        // Find which rung this mesh belongs to
        const clickedRung = rungRings.find(r =>
            r.ring === clickedObject ||
            r.disc === clickedObject ||
            r.glow === clickedObject
        );
        if (clickedRung) {
            focusOnRung(clickedRung.rung);
        }
    }
}

function onKeyDown(event) {
    switch (event.key) {
        case 'Escape':
            clearFocus();
            break;
        case '1':
            focusOnRung(RUNGS[3]); // Execution
            break;
        case '2':
            focusOnRung(RUNGS[2]); // Method
            break;
        case '3':
            focusOnRung(RUNGS[1]); // Approach
            break;
        case '4':
            focusOnRung(RUNGS[0]); // Outcome
            break;
    }
}

// ============================================================
// View Modes
// ============================================================
function setViewMode(mode) {
    currentView = mode;

    // Update button states
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Clear any focused rung
    clearFocus();

    // Transition camera
    const preset = CAMERA_PRESETS[mode] || CAMERA_PRESETS.recommended;

    gsap.to(camera.position, {
        x: preset.position.x,
        y: preset.position.y,
        z: preset.position.z,
        duration: 1.5,
        ease: 'power2.inOut'
    });

    gsap.to(controls.target, {
        x: preset.target.x,
        y: preset.target.y,
        z: preset.target.z,
        duration: 1.5,
        ease: 'power2.inOut'
    });

    // Mode-specific visual adjustments
    if (mode === 'recommended') {
        // Show full ladder, emphasize top-down flow
        flowDirection = 1; // Particles flow DOWN (the right way)
        rungRings.forEach(({ material }) => {
            gsap.to(material, {
                opacity: 0.9,
                emissiveIntensity: 0.3,
                duration: 1
            });
        });
        // Hide insight overlay
        document.getElementById('insightOverlay')?.classList.remove('visible');
        AudioManager.playNote(523.25, 0.3); // C5 - bright, ascending

    } else if (mode === 'current') {
        // Emphasize bottom rungs where most start, show the insight
        flowDirection = -1; // Particles flow UP (the problematic pattern)
        rungRings.forEach(({ material, rung }) => {
            const isBottom = rung.id === 'method' || rung.id === 'execution';
            gsap.to(material, {
                opacity: isBottom ? 1 : 0.4,
                emissiveIntensity: isBottom ? 0.4 : 0.15,
                duration: 1
            });
        });
        // Show insight overlay after camera settles
        setTimeout(() => {
            document.getElementById('insightOverlay')?.classList.add('visible');
        }, 800);
        AudioManager.playNote(261.63, 0.4); // C4 - lower, grounding
    }
}

// ============================================================
// Focus System
// ============================================================
function focusOnRung(rung) {
    focusedRung = rung;
    StateManager.update({ focusedRung: rung.id });

    // Camera focuses on the rung
    const targetY = rung.y + 0.5;
    const distance = 6;
    const angle = Math.PI / 6;

    gsap.to(camera.position, {
        x: Math.cos(angle) * distance,
        y: targetY + 2,
        z: Math.sin(angle) * distance,
        duration: 1.2,
        ease: 'power2.inOut'
    });

    gsap.to(controls.target, {
        x: 0,
        y: rung.y,
        z: 0,
        duration: 1.2,
        ease: 'power2.inOut'
    });

    // Highlight focused ring, dim others
    rungRings.forEach(({ material, rung: r }) => {
        const isFocused = r.id === rung.id;
        gsap.to(material, {
            opacity: isFocused ? 1 : 0.2,
            emissiveIntensity: isFocused ? 0.5 : 0.1,
            duration: 0.8
        });
    });

    // Show detail panel
    showDetailPanel(rung);

    // Play ascending note based on rung height
    const noteMap = {
        execution: 261.63,  // C4
        method: 329.63,     // E4
        approach: 392.00,   // G4
        outcome: 523.25     // C5
    };
    AudioManager.playNote(noteMap[rung.id] || 392, 0.3);
}

function clearFocus() {
    focusedRung = null;
    StateManager.update({ focusedRung: null });

    // Reset camera to current view mode
    const preset = CAMERA_PRESETS[currentView] || CAMERA_PRESETS.overview;

    gsap.to(camera.position, {
        x: preset.position.x,
        y: preset.position.y,
        z: preset.position.z,
        duration: 1,
        ease: 'power2.inOut'
    });

    gsap.to(controls.target, {
        x: preset.target.x,
        y: preset.target.y,
        z: preset.target.z,
        duration: 1,
        ease: 'power2.inOut'
    });

    // Reset ring opacities
    rungRings.forEach(({ material }) => {
        gsap.to(material, {
            opacity: 0.9,
            emissiveIntensity: 0.3,
            duration: 0.8
        });
    });

    // Hide detail panel
    hideDetailPanel();
}

// ============================================================
// Detail Panel
// ============================================================
function showDetailPanel(rung) {
    const panel = document.getElementById('detailPanel');
    if (!panel) return;

    // Update content
    document.getElementById('detailTerritory').textContent =
        rung.territory === 'human' ? 'Human Territory' : 'AI Territory';
    document.getElementById('detailTitle').textContent = rung.title;
    document.getElementById('detailQuestion').textContent = `"${rung.question}"`;
    document.getElementById('detailDescription').textContent = rung.description;

    // Update panel variant
    panel.className = `detail-panel visible detail-panel--${rung.territory}`;

    // Update navigation buttons
    updateNavButtons(rung);
}

function hideDetailPanel() {
    const panel = document.getElementById('detailPanel');
    if (panel) {
        panel.classList.remove('visible');
    }
}

// ============================================================
// Animation Loop
// ============================================================
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now() * 0.001;

    // Update controls
    controls.update();

    // Update beam shader time
    if (centralBeam && centralBeam.coreMaterial) {
        centralBeam.coreMaterial.uniforms.time.value = time;
    }

    // Update fog shader time
    if (boundaryMembrane && boundaryMembrane.fogMaterials) {
        boundaryMembrane.fogMaterials.forEach(material => {
            material.uniforms.time.value = time;
        });
    }

    // Animate particles flowing based on direction
    // flowDirection: 1 = down (recommended), -1 = up (current/problematic)
    const topY = CONFIG.positions.outcome + 1.0;
    const bottomY = CONFIG.positions.execution - 0.5;
    const beamTopRadius = CONFIG.beam.topRadius * 1.5;
    const beamBottomRadius = CONFIG.beam.bottomRadius * 1.5;

    particles.forEach(particle => {
        // Move based on flow direction
        particle.position.y -= particle.userData.speed * 0.016 * flowDirection;

        // Calculate current beam radius at this Y level
        const t = Math.max(0, Math.min(1, (particle.position.y - bottomY) / (topY - bottomY)));
        const currentBeamRadius = THREE.MathUtils.lerp(beamBottomRadius, beamTopRadius, t);

        // Spiral motion - angle changes over time (reverse spiral for upward flow)
        const spiralAngle = particle.userData.angleOffset + time * particle.userData.spiralSpeed * flowDirection;
        const radius = currentBeamRadius * particle.userData.radiusFactor;
        particle.position.x = Math.cos(spiralAngle) * radius;
        particle.position.z = Math.sin(spiralAngle) * radius;

        // Color transition based on Y position (warm at top, cool at bottom)
        const warmColor = new THREE.Color(CONFIG.colors.beamTop);
        const coolColor = new THREE.Color(CONFIG.colors.beamBottom);
        particle.material.color.lerpColors(coolColor, warmColor, t);

        // Opacity - slightly fade at extremes
        particle.material.opacity = 0.5 + t * 0.3;

        // Reset when particle exits bounds (depends on flow direction)
        if (flowDirection > 0 && particle.position.y < bottomY) {
            // Flowing down - reset to top
            resetParticleToPosition(particle, topY);
        } else if (flowDirection < 0 && particle.position.y > topY) {
            // Flowing up - reset to bottom
            resetParticleToPosition(particle, bottomY);
        }
    });

    // Subtle ring breathing
    if (!PerformanceMode.isLowFi) {
        rungRings.forEach(({ group }, i) => {
            const breathe = Math.sin(time * 0.5 + i * 0.5) * 0.02;
            group.scale.setScalar(1 + breathe);
        });
    }

    // Update 3D labels
    updateLabels();

    renderer.render(scene, camera);
}

// ============================================================
// Label System
// ============================================================
function updateLabels() {
    // Update rung labels
    RUNGS.forEach(rung => {
        const label = document.getElementById(`label-${rung.id}`);
        if (!label) return;

        // Position label to the side of the ring
        const labelPos = new THREE.Vector3(rung.radius + 0.8, rung.y, 0);
        labelPos.project(camera);

        const x = (labelPos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-labelPos.y * 0.5 + 0.5) * window.innerHeight;

        label.style.left = `${x}px`;
        label.style.top = `${y}px`;

        // Fade based on depth
        const distance = labelPos.z;
        label.style.opacity = distance < 1 ? 1 : 0;
    });

    // Update boundary label
    const boundaryLabel = document.getElementById('label-boundary');
    if (boundaryLabel) {
        const pos = new THREE.Vector3(-4.5, CONFIG.positions.boundary, 0);
        pos.project(camera);

        const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;

        boundaryLabel.style.left = `${x}px`;
        boundaryLabel.style.top = `${y}px`;

        const distance = pos.z;
        boundaryLabel.style.opacity = distance < 1 ? 1 : 0;
    }
}

// ============================================================
// Intro Animation
// ============================================================
function playIntro() {
    // Start camera further away
    camera.position.set(10, 8, 20);

    // Default to recommended view
    currentView = 'recommended';

    // Animate camera to recommended position
    gsap.to(camera.position, {
        x: CAMERA_PRESETS.recommended.position.x,
        y: CAMERA_PRESETS.recommended.position.y,
        z: CAMERA_PRESETS.recommended.position.z,
        duration: 3,
        ease: 'power2.out'
    });

    gsap.to(controls.target, {
        x: CAMERA_PRESETS.recommended.target.x,
        y: CAMERA_PRESETS.recommended.target.y,
        z: CAMERA_PRESETS.recommended.target.z,
        duration: 3,
        ease: 'power2.out'
    });

    // Fade in UI elements with stagger
    setTimeout(() => {
        document.getElementById('header')?.classList.add('visible');
    }, 500);

    setTimeout(() => {
        document.getElementById('viewControls')?.classList.add('visible');
    }, 800);

    setTimeout(() => {
        document.getElementById('legend')?.classList.add('visible');
    }, 1000);

    // Staggered label reveal - from top down (the recommended flow)
    const labelIds = ['label-outcome', 'label-approach', 'label-boundary', 'label-method', 'label-execution'];
    labelIds.forEach((id, i) => {
        setTimeout(() => {
            document.getElementById(id)?.classList.add('visible');
        }, 1400 + i * 180);
    });

    setTimeout(() => {
        document.getElementById('controlsHint')?.classList.add('visible');
    }, 2600);
}

// ============================================================
// Navigation Functions
// ============================================================
function navigateRung(direction) {
    if (!focusedRung) return;

    const currentIndex = RUNGS.findIndex(r => r.id === focusedRung.id);
    const newIndex = currentIndex + direction;

    // Check bounds (0 = Outcome at top, 3 = Execution at bottom)
    if (newIndex >= 0 && newIndex < RUNGS.length) {
        focusOnRung(RUNGS[newIndex]);
    }
}

function updateNavButtons(rung) {
    const currentIndex = RUNGS.findIndex(r => r.id === rung.id);
    const prevBtn = document.getElementById('prevRungBtn');
    const nextBtn = document.getElementById('nextRungBtn');

    if (prevBtn) {
        // Previous goes UP (toward Outcome, index 0)
        prevBtn.disabled = currentIndex === 0;
    }
    if (nextBtn) {
        // Next goes DOWN (toward Execution, index 3)
        nextBtn.disabled = currentIndex === RUNGS.length - 1;
    }
}

// ============================================================
// Global Functions for HTML
// ============================================================
window.setViewMode = setViewMode;
window.toggleAudio = () => AudioManager.toggle();
window.closeDetailPanel = clearFocus;
window.navigateRung = navigateRung;
