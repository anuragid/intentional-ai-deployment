/**
 * The Friction Spectrum
 * Navigate through four zones of human-AI friction
 *
 * Design Philosophy:
 * - ONE zone visible at a time, navigated via tabs
 * - Smooth horizontal slide transitions between zones
 * - Detail panel appears on click, not always visible
 * - Professional, contemplative aesthetic
 *
 * Part 3: The Friction Spectrum
 * "From seamless to human-only: matching friction to stakes"
 */

// ============================================================
// Configuration
// ============================================================
const CONFIG = {
    colors: {
        bg: 0x08080c,
        seamless: 0x22d3ee,
        visible: 0x60a5fa,
        gated: 0xfbbf24,
        humanOnly: 0x8b5cf6, // Violet - wisdom, judgment, dignity
    },
};

// Zone data
const ZONES = {
    seamless: {
        id: 'seamless',
        title: 'Seamless',
        stakes: 'Low Stakes',
        essence: 'AI flows invisibly, indistinguishable from human work.',
        description: 'Zero friction. AI flows through invisibly, indistinguishable from human work. The user may not even know AI is involved.',
        examples: 'Calendar scheduling, email sorting, auto-save',
        color: CONFIG.colors.seamless,
        colorHex: '#22d3ee',
    },
    visible: {
        id: 'visible',
        title: 'Visible',
        stakes: 'Learning Stakes',
        essence: 'Beautiful seams reveal where AI contributed.',
        description: 'Beautiful seams illuminate where AI contributed, teaching through transparency. Users see and learn from AI\'s reasoning.',
        examples: 'AI-drafted reports with marked sections, code with attribution',
        color: CONFIG.colors.visible,
        colorHex: '#60a5fa',
    },
    gated: {
        id: 'gated',
        title: 'Gated',
        stakes: 'High Stakes',
        essence: 'Flow pauses. Human approval required.',
        description: 'The flow pauses. Human approval required before AI action proceeds. A checkpoint ensures human judgment at critical moments.',
        examples: 'Medical diagnosis requiring approval, fraud flags for review',
        color: CONFIG.colors.gated,
        colorHex: '#fbbf24',
    },
    'human-only': {
        id: 'human-only',
        title: 'Human-Only',
        stakes: 'Constitutional Stakes',
        essence: 'Human decides. AI advises at most.',
        description: 'The barrier is absolute. Human decides, AI advises at most. Some choices belong to us alone.',
        examples: 'Judicial rulings, personnel decisions, strategic direction',
        color: CONFIG.colors.humanOnly,
        colorHex: '#8b5cf6',
    },
};

const ZONE_ORDER = ['seamless', 'visible', 'gated', 'human-only'];

// ============================================================
// Global State
// ============================================================
let scene, camera, renderer, controls;
let currentZone = 'seamless';
let zoneGroup = null;
let particles = [];
let time = 0;
let isTransitioning = false;

// Interactive state for Gated zone
let gateOpenAmount = 0; // 0 = closed, 1 = open

// ============================================================
// Initialization
// ============================================================
window.addEventListener('DOMContentLoaded', init);

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.colors.bg);
    scene.fog = new THREE.Fog(CONFIG.colors.bg, 15, 40);

    // Camera - front view, objects rotate on their own axis
    camera = new THREE.PerspectiveCamera(
        50,
        window.innerWidth / window.innerHeight,
        0.1,
        100
    );
    camera.position.set(0, 3, 12);
    camera.lookAt(0, 1.5, 0);

    // Renderer
    const canvas = document.getElementById('canvas');
    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Controls - front view with orbit ability
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 8;
    controls.maxDistance = 25;
    controls.maxPolarAngle = Math.PI * 0.65;
    controls.target.set(0, 1.5, 0);

    // Lighting
    setupLighting();

    // Create initial zone
    createZone(currentZone);

    // Events
    window.addEventListener('resize', onResize);
    renderer.domElement.addEventListener('click', onCanvasClick);

    // Start animation
    animate();

    // Play intro
    playIntro();
}

// ============================================================
// Lighting
// ============================================================
function setupLighting() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.5);
    keyLight.position.set(5, 10, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.2);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);
}

// ============================================================
// Zone Creation
// ============================================================
function createZone(zoneId) {
    // Clear existing zone
    if (zoneGroup) {
        scene.remove(zoneGroup);
        zoneGroup = null;
    }
    particles = [];

    zoneGroup = new THREE.Group();
    zoneGroup.scale.setScalar(0.8); // 20% smaller
    scene.add(zoneGroup);

    const zone = ZONES[zoneId];

    // Create zone-specific content
    switch (zoneId) {
        case 'seamless': createSeamlessScene(zone); break;
        case 'visible': createVisibleScene(zone); break;
        case 'gated': createGatedScene(zone); break;
        case 'human-only': createHumanOnlyScene(zone); break;
    }

    // Add base platform
    createPlatform(zone.color);

    // Update zone light color
    updateZoneLight(zone.color);

    // Update 3D label
    updateZoneLabel(zone);

    // Update legend for this zone
    updateLegend(zoneId);
}

function createPlatform(color) {
    // Clean, minimal platform - just a subtle ring
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(3, 0.04, 16, 64),
        new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.6,
        })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0;
    zoneGroup.add(ring);

    // Very subtle disc
    const disc = new THREE.Mesh(
        new THREE.CircleGeometry(3, 64),
        new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.04,
            side: THREE.DoubleSide,
        })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.01;
    zoneGroup.add(disc);
}

function updateZoneLight(color) {
    // Remove old point lights
    scene.children.forEach(child => {
        if (child.isPointLight) scene.remove(child);
    });

    const light = new THREE.PointLight(color, 0.8, 20);
    light.position.set(0, 6, 0);
    scene.add(light);
}

function updateZoneLabel(zone) {
    const labelStakes = document.getElementById('zoneLabelStakes');
    const labelEssence = document.getElementById('zoneLabelEssence');
    const examplesText = document.getElementById('examplesText');

    if (labelStakes) {
        labelStakes.textContent = zone.stakes;
        labelStakes.style.color = zone.colorHex;
    }
    if (labelEssence) {
        labelEssence.textContent = zone.essence;
    }
    if (examplesText) {
        examplesText.textContent = zone.examples;
    }
}

// Legend configuration per zone
const LEGEND_CONFIG = {
    seamless: {
        item1: { label: 'Source A', color: '#93c5fd' },
        item2: { label: 'Source B', color: '#5eead4' },
    },
    visible: {
        item1: { label: 'AI', color: '#22d3ee' },
        item2: { label: 'Human', color: '#f5a623' },
    },
    gated: {
        item1: { label: 'Requests', color: '#fbbf24' },
        item2: null, // Hidden
    },
    'human-only': {
        item1: { label: 'AI', color: '#8b5cf6' },
        item2: { label: 'Human', color: '#f5f0e8' },
    },
};

function updateLegend(zoneId) {
    const config = LEGEND_CONFIG[zoneId];
    if (!config) return;

    const dot1 = document.getElementById('legendDot1');
    const label1 = document.getElementById('legendLabel1');
    const item1 = document.getElementById('legendItem1');
    const dot2 = document.getElementById('legendDot2');
    const label2 = document.getElementById('legendLabel2');
    const item2 = document.getElementById('legendItem2');

    // Item 1
    if (config.item1 && dot1 && label1 && item1) {
        dot1.style.background = config.item1.color;
        dot1.style.boxShadow = `0 0 4px ${config.item1.color}`;
        label1.textContent = config.item1.label;
        item1.style.display = 'flex';
    }

    // Item 2
    if (item2) {
        if (config.item2 && dot2 && label2) {
            dot2.style.background = config.item2.color;
            dot2.style.boxShadow = `0 0 4px ${config.item2.color}`;
            label2.textContent = config.item2.label;
            item2.style.display = 'flex';
        } else {
            item2.style.display = 'none';
        }
    }
}

// ============================================================
// SEAMLESS ZONE - Two streams merge into indistinguishable vortex
// Particles evenly distributed along path for clear shape visibility
// ============================================================
function createSeamlessScene(zone) {
    const streamAColor = 0x93c5fd;  // Light blue
    const streamBColor = 0x5eead4;  // Teal
    const mergedColor = 0x22d3ee;   // Cyan - blended

    const mergeHeight = 1.2;
    const vortexHeight = 4.5;
    const particleCount = 18;

    // Stream A particles - evenly distributed along path with slight variation
    for (let i = 0; i < particleCount; i++) {
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 24, 24),
            new THREE.MeshBasicMaterial({
                color: streamAColor,
                transparent: true,
                opacity: 0.8,
            })
        );
        // Evenly spaced progress with small random offset for organic feel
        const baseProgress = i / particleCount;
        const randomOffset = (Math.random() - 0.5) * 0.03;
        p.userData = {
            type: 'streamA',
            progress: (baseProgress + randomOffset + 1) % 1,
            speed: 0.0014 + Math.random() * 0.0004, // Tighter speed range
            startX: -2.5,
            startZ: (Math.random() - 0.5) * 0.5,
            originalColor: streamAColor,
            mergedColor: mergedColor,
        };
        zoneGroup.add(p);
        particles.push(p);
    }

    // Stream B particles - evenly distributed, offset from stream A
    for (let i = 0; i < particleCount; i++) {
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 24, 24),
            new THREE.MeshBasicMaterial({
                color: streamBColor,
                transparent: true,
                opacity: 0.8,
            })
        );
        // Offset by half a particle spacing from stream A
        const baseProgress = (i + 0.5) / particleCount;
        const randomOffset = (Math.random() - 0.5) * 0.03;
        p.userData = {
            type: 'streamB',
            progress: (baseProgress + randomOffset + 1) % 1,
            speed: 0.0014 + Math.random() * 0.0004,
            startX: 2.5,
            startZ: (Math.random() - 0.5) * 0.5,
            originalColor: streamBColor,
            mergedColor: mergedColor,
        };
        zoneGroup.add(p);
        particles.push(p);
    }

    zoneGroup.userData.mergeHeight = mergeHeight;
    zoneGroup.userData.vortexHeight = vortexHeight;
}

function animateSeamless() {
    if (!zoneGroup) return;

    const mergeHeight = zoneGroup.userData.mergeHeight || 1.2;
    const vortexHeight = zoneGroup.userData.vortexHeight || 4.5;
    const mergePoint = 0.35;  // Progress point where merge begins

    particles.forEach(p => {
        if (!p.userData || p.userData.progress === undefined) return;

        // Advance progress
        p.userData.progress += p.userData.speed;
        if (p.userData.progress > 1) {
            p.userData.progress = 0;
        }

        const prog = p.userData.progress;
        const isStreamA = p.userData.type === 'streamA';

        if (prog < mergePoint) {
            // BEFORE MERGE: Distinct streams approaching center
            // Linear interpolation from start position toward center
            const t = prog / mergePoint;
            const startX = p.userData.startX;

            p.position.x = startX * (1 - t);
            p.position.y = mergeHeight + t * 0.3;
            p.position.z = p.userData.startZ * (1 - t * 0.5);

            // Keep original color - distinguishable
            p.material.color.setHex(p.userData.originalColor);
            p.material.opacity = 0.85;

        } else {
            // AFTER MERGE: Rotating vortex, indistinguishable
            const vortexProg = (prog - mergePoint) / (1 - mergePoint);

            // Spiral upward - gentle rotation
            const angle = vortexProg * Math.PI * 3 + (isStreamA ? 0 : Math.PI); // Offset streams
            const radius = 0.3 + vortexProg * 0.8; // Expands slightly as it rises

            p.position.x = Math.cos(angle + time * 0.4) * radius; // Slower rotation
            p.position.z = Math.sin(angle + time * 0.4) * radius;
            p.position.y = mergeHeight + vortexProg * (vortexHeight - mergeHeight);

            // Transition to merged color (indistinguishable)
            const colorBlend = Math.min(1, vortexProg * 3); // Quick blend
            const origColor = new THREE.Color(p.userData.originalColor);
            const mergeColor = new THREE.Color(p.userData.mergedColor);
            const blendedColor = origColor.lerp(mergeColor, colorBlend);
            p.material.color.copy(blendedColor);

            // Fade out near top
            p.material.opacity = 0.85 * (1 - vortexProg * 0.6);
        }
    });
}

// Smooth interpolation helper
function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

// Quadratic bezier helper
function quadBezier(p0, p1, p2, t) {
    const mt = 1 - t;
    return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
}

// ============================================================
// VISIBLE ZONE - Holographic Structures Built Together
// AI (cyan) and Human (orange) collaboratively build detailed
// holographic structures. Wireframe + glow + transparency.
// "Beautiful seams" - you can see who built what.
// ============================================================

// Helper: Create clean glass material - NO wireframes
function createGlassMat(color, opacity = 0.5) {
    return new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: opacity,
        roughness: 0.1,
        metalness: 0.3,
        side: THREE.DoubleSide,
    });
}

// Helper: Create a clean glass piece - smooth, no wireframe clutter
function createHoloPiece(geometry, color) {
    const mesh = new THREE.Mesh(geometry, createGlassMat(color, 0.5));
    mesh.userData.solid = mesh;
    return mesh;
}

// Simple structure: alternating blocks clearly showing AI vs Human contributions
const HOLO_STRUCTURES = [
    {
        name: 'blocks',
        buildTime: 6000,
        holdTime: 8000,
        fadeTime: 2000,
        create: (aiColor, humanColor) => {
            const pieces = [];

            // Simple stack of alternating blocks - clearly shows "who built what"
            const blockHeight = 0.6;
            const labels = ['AI', 'Human', 'AI', 'Human', 'AI'];

            for (let i = 0; i < 5; i++) {
                const isAI = i % 2 === 0;
                const block = createHoloPiece(
                    new THREE.BoxGeometry(1.4, blockHeight, 0.8),
                    isAI ? aiColor : humanColor
                );
                block.userData.targetPos = new THREE.Vector3(0, 0.5 + i * (blockHeight + 0.1), 0);
                block.userData.isAI = isAI;
                block.userData.delay = i * 500;
                pieces.push(block);
            }

            return pieces;
        },
    },
];

function createVisibleScene(zone) {
    const aiColor = 0x22d3ee;    // Cyan
    const humanColor = 0xf5a623; // Warm orange/amber

    // Store colors and state
    zoneGroup.userData.aiColor = aiColor;
    zoneGroup.userData.humanColor = humanColor;
    zoneGroup.userData.currentStructure = 0;
    zoneGroup.userData.structurePhase = 'building';
    zoneGroup.userData.phaseStartTime = performance.now();
    zoneGroup.userData.pieces = [];
    zoneGroup.userData.structureGroup = new THREE.Group();
    zoneGroup.add(zoneGroup.userData.structureGroup);

    // Create first structure
    createHoloStructure(0);
}

function createHoloStructure(structureIndex) {
    if (!zoneGroup || !zoneGroup.userData) return;

    const structure = HOLO_STRUCTURES[structureIndex];
    const aiColor = zoneGroup.userData.aiColor;
    const humanColor = zoneGroup.userData.humanColor;
    const structureGroup = zoneGroup.userData.structureGroup;

    // Clear old pieces
    while (structureGroup.children.length > 0) {
        structureGroup.remove(structureGroup.children[0]);
    }
    zoneGroup.userData.pieces = [];

    // Create new pieces
    const pieces = structure.create(aiColor, humanColor);
    pieces.forEach(piece => {
        // Start invisible and slightly scaled down
        piece.scale.setScalar(0.01);
        piece.userData.currentScale = 0.01;
        piece.userData.currentOpacity = 0;

        // Set initial position at target (will scale up in place)
        if (piece.userData.targetPos) {
            piece.position.copy(piece.userData.targetPos);
        }
        if (piece.userData.targetRot) {
            piece.rotation.copy(piece.userData.targetRot);
        }

        structureGroup.add(piece);
        zoneGroup.userData.pieces.push(piece);
    });

    // Reset phase
    zoneGroup.userData.structurePhase = 'building';
    zoneGroup.userData.phaseStartTime = performance.now();
    structureGroup.rotation.y = 0;
}

function animateVisible() {
    if (!zoneGroup || !zoneGroup.userData) return;

    const now = performance.now();
    const structureIndex = zoneGroup.userData.currentStructure;
    const structure = HOLO_STRUCTURES[structureIndex];
    const phaseTime = now - zoneGroup.userData.phaseStartTime;
    const pieces = zoneGroup.userData.pieces;
    const structureGroup = zoneGroup.userData.structureGroup;

    if (zoneGroup.userData.structurePhase === 'building') {
        // Animate pieces materializing
        let allComplete = true;

        pieces.forEach(piece => {
            const delay = piece.userData.delay || 0;
            const buildDuration = 600;

            if (phaseTime < delay) {
                allComplete = false;
            } else {
                const t = Math.min(1, (phaseTime - delay) / buildDuration);
                const eased = smoothstep(t);

                // Scale up from center
                piece.scale.setScalar(0.01 + eased * 0.99);

                // Fade in materials
                const targetOpacity = 0.5;
                const wireOpacity = 0.9;

                if (piece.userData.solid) {
                    piece.userData.solid.material.opacity = eased * targetOpacity;
                }
                if (piece.userData.wireframe) {
                    piece.userData.wireframe.material.opacity = eased * wireOpacity;
                }

                if (t < 1) allComplete = false;
            }
        });

        // Check if building phase is complete
        if (phaseTime > structure.buildTime || allComplete) {
            zoneGroup.userData.structurePhase = 'holding';
            zoneGroup.userData.phaseStartTime = now;
        }

    } else if (zoneGroup.userData.structurePhase === 'holding') {
        // Gentle rotation while holding
        structureGroup.rotation.y += 0.003;

        // Subtle pulse effect
        const pulse = Math.sin(now * 0.003) * 0.1;
        pieces.forEach(piece => {
            if (piece.userData.solid) {
                piece.userData.solid.material.emissiveIntensity = 0.3 + pulse;
            }
        });

        // Check if hold phase is complete
        if (phaseTime > structure.holdTime) {
            zoneGroup.userData.structurePhase = 'fading';
            zoneGroup.userData.phaseStartTime = now;
        }

    } else if (zoneGroup.userData.structurePhase === 'fading') {
        // Fade out and scale down
        const t = Math.min(1, phaseTime / structure.fadeTime);
        const eased = smoothstep(t);

        pieces.forEach(piece => {
            piece.scale.setScalar(1 - eased * 0.5);

            if (piece.userData.solid) {
                piece.userData.solid.material.opacity = 0.5 * (1 - eased);
            }
            if (piece.userData.wireframe) {
                piece.userData.wireframe.material.opacity = 0.9 * (1 - eased);
            }
        });

        // Check if fade is complete
        if (phaseTime > structure.fadeTime) {
            // Move to next structure
            const nextIndex = (structureIndex + 1) % HOLO_STRUCTURES.length;
            zoneGroup.userData.currentStructure = nextIndex;
            createHoloStructure(nextIndex);
        }
    }
}

// ============================================================
// GATED ZONE - Clean checkpoint with approval
// Simple, clear glass-like structures
// ============================================================
function createGatedScene(zone) {
    const gateColor = zone.color;  // Amber

    // Clean glass material - no wireframes, smooth and clear
    const createGlassMaterial = (opacity = 0.5) => {
        return new THREE.MeshStandardMaterial({
            color: gateColor,
            emissive: gateColor,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: opacity,
            roughness: 0.1,
            metalness: 0.3,
        });
    };

    // Gate dimensions
    const pillarHeight = 4.5;
    const gateWidth = 2.6;
    const gateOpeningHeight = 4.0; // Height of the opening area
    const gateBottomY = 0.3;       // Bottom of the gate opening
    const gateTopY = gateBottomY + gateOpeningHeight; // Top of the gate opening

    // Store gate bounds for animation
    zoneGroup.userData.gateBottomY = gateBottomY;
    zoneGroup.userData.gateTopY = gateTopY;
    zoneGroup.userData.gateOpeningHeight = gateOpeningHeight;
    zoneGroup.userData.gateWidth = gateWidth;

    // === SIMPLE PILLARS ===
    for (let side = -1; side <= 1; side += 2) {
        const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.15, 0.18, pillarHeight, 32),
            createGlassMaterial(0.5)
        );
        pillar.position.set(side * 1.5, pillarHeight / 2, 0);
        zoneGroup.add(pillar);
    }

    // === TOP BAR ===
    const topBar = new THREE.Mesh(
        new THREE.BoxGeometry(3.3, 0.2, 0.15),
        createGlassMaterial(0.5)
    );
    topBar.position.set(0, pillarHeight + 0.1, 0);
    zoneGroup.add(topBar);

    // === SHUTTER (Translucent layer that rolls up) ===
    // When closed: covers entire opening. When open: rolled up, not visible.
    const shutter = new THREE.Mesh(
        new THREE.PlaneGeometry(gateWidth, gateOpeningHeight),
        new THREE.MeshStandardMaterial({
            color: gateColor,
            emissive: gateColor,
            emissiveIntensity: 0.15,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide,
        })
    );
    // Position: centered in the opening when closed
    shutter.position.set(0, gateBottomY + gateOpeningHeight / 2, 0);
    zoneGroup.add(shutter);
    zoneGroup.userData.shutter = shutter;

    // === GATE BAR (Bottom edge of shutter) ===
    const gateBar = new THREE.Mesh(
        new THREE.BoxGeometry(gateWidth, 0.15, 0.1),
        createGlassMaterial(0.7)
    );
    gateBar.position.set(0, gateBottomY, 0); // Start at bottom (closed)
    zoneGroup.add(gateBar);
    zoneGroup.userData.gateBar = gateBar;

    // === STATUS LIGHT - Simple sphere ===
    const statusLight = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0xdc2626 })  // Red when closed
    );
    statusLight.position.set(0, pillarHeight + 0.5, 0);
    zoneGroup.add(statusLight);
    zoneGroup.userData.statusLight = statusLight;

    // === PARTICLES - Behind the shutter, waiting to flow through ===
    for (let i = 0; i < 15; i++) {
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 16, 16),
            new THREE.MeshBasicMaterial({
                color: gateColor,
                transparent: true,
                opacity: 0.8,
            })
        );
        // Particles start behind the gate (negative Z)
        p.userData = {
            lane: (Math.random() - 0.5) * 1.8,
            height: gateBottomY + 0.5 + Math.random() * (gateOpeningHeight - 1),
            startZ: -2.5 - Math.random() * 1,  // Behind the gate
            endZ: 3.5,                          // In front of gate
            progress: Math.random() * 0.3,     // Start mostly behind gate
            speed: 0.004 + Math.random() * 0.002,
        };
        zoneGroup.add(p);
        particles.push(p);
    }
}

function animateGated() {
    if (!zoneGroup || !zoneGroup.userData) return;

    const gateBottomY = zoneGroup.userData.gateBottomY || 0.3;
    const gateTopY = zoneGroup.userData.gateTopY || 4.3;
    const gateOpeningHeight = zoneGroup.userData.gateOpeningHeight || 4.0;

    // === GATE BAR - Moves up as gate opens ===
    // 0% = bar at bottom, 100% = bar at top
    if (zoneGroup.userData.gateBar) {
        const targetY = gateBottomY + gateOpenAmount * (gateTopY - gateBottomY);
        zoneGroup.userData.gateBar.position.y += (targetY - zoneGroup.userData.gateBar.position.y) * 0.1;
    }

    // === SHUTTER - Rolls up with the bar ===
    // When closed (0%): full height, centered in opening
    // When open (100%): zero height (invisible), at top
    // Key: top edge stays fixed at gateTopY, bottom edge rises with gate bar
    if (zoneGroup.userData.shutter) {
        const shutter = zoneGroup.userData.shutter;

        // Target scale based on gate open amount
        const targetScaleY = 1 - gateOpenAmount;

        // Calculate target position based on TARGET scale (not current)
        // This keeps top edge fixed at gateTopY during animation
        const targetHeight = gateOpeningHeight * targetScaleY;
        const targetPosY = gateTopY - targetHeight / 2;

        // Animate both scale and position toward targets
        shutter.scale.y += (targetScaleY - shutter.scale.y) * 0.1;
        shutter.position.y += (targetPosY - shutter.position.y) * 0.1;

        // Fade out as it opens
        shutter.material.opacity = 0.25 * (1 - gateOpenAmount * 0.8);
    }

    // === STATUS LIGHT - Color based on open amount ===
    if (zoneGroup.userData.statusLight) {
        if (gateOpenAmount < 0.3) {
            zoneGroup.userData.statusLight.material.color.setHex(0xdc2626); // Red - closed
        } else if (gateOpenAmount < 0.7) {
            zoneGroup.userData.statusLight.material.color.setHex(0xfbbf24); // Amber - partial
        } else {
            zoneGroup.userData.statusLight.material.color.setHex(0x22c55e); // Green - open
        }
    }

    // === PARTICLES - Can only pass through the OPEN area (below shutter) ===
    // Current bar position determines where the opening is
    const currentBarY = gateBottomY + gateOpenAmount * (gateTopY - gateBottomY);

    particles.forEach(p => {
        if (!p.userData || p.userData.progress === undefined) return;

        const startZ = p.userData.startZ;
        const endZ = p.userData.endZ;
        const totalDistance = endZ - startZ;

        // Gate position as progress value (where 0 is startZ, 1 is endZ)
        const gateProgressPoint = (0 - startZ) / totalDistance;

        // Current position as progress
        const currentProgress = p.userData.progress;

        // Check if this particle's height is in the OPEN area (below the bar)
        const particleY = p.userData.height;
        const isInOpenArea = particleY < currentBarY;

        // Initialize stuck counter if needed
        if (p.userData.stuckTime === undefined) p.userData.stuckTime = 0;

        // Determine if particle can move through the gate
        let canMove = true;
        let speedMultiplier = 1;

        // Is particle at/near the gate?
        const atGate = currentProgress > gateProgressPoint - 0.08 && currentProgress < gateProgressPoint + 0.05;

        if (atGate) {
            // At the gate - can only pass if in the open area
            if (!isInOpenArea) {
                // Blocked by shutter - stop here
                canMove = false;
                p.userData.stuckTime += 1;
            } else {
                // In open area - flow through
                speedMultiplier = 1;
                p.userData.stuckTime = 0;
            }
        } else if (currentProgress < gateProgressPoint) {
            // Behind gate - approach
            speedMultiplier = 0.6;
            p.userData.stuckTime = 0;
        } else {
            // Past gate - move normally
            speedMultiplier = 1;
            p.userData.stuckTime = 0;
        }

        // Move particle if allowed
        if (canMove) {
            p.userData.progress += p.userData.speed * speedMultiplier;
        }

        // Reset when reaching end OR if stuck at gate too long
        const shouldReset = p.userData.progress > 1 || p.userData.stuckTime > 150;

        if (shouldReset) {
            p.userData.progress = 0;
            p.userData.stuckTime = 0;
            p.userData.lane = (Math.random() - 0.5) * 1.8;
            // Give new random height - might be in open area next time
            p.userData.height = gateBottomY + 0.3 + Math.random() * (gateOpeningHeight - 0.5);
        }

        // Position particle
        p.position.z = startZ + p.userData.progress * totalDistance;
        p.position.x = p.userData.lane;
        p.position.y = p.userData.height;

        // Opacity: dimmer behind shutter, brighter when through
        if (p.position.z < 0) {
            p.material.opacity = 0.6;
        } else {
            p.material.opacity = 0.9;
        }
    });
}

// ============================================================
// HUMAN-ONLY ZONE - Dignified Human Authority
// A warm, luminous human figure stands in quiet authority.
// AI respectfully contained. Human decides with wisdom.
// ============================================================
function createHumanOnlyScene(zone) {
    const humanColor = 0xfaf5eb;      // Warm cream
    const humanGlow = 0xe8c878;       // Warm gold
    const barrierColor = zone.color;  // Violet

    // Warm human material - smooth glass, no wireframe
    const createHumanMaterial = (opacity = 0.6) => {
        return new THREE.MeshStandardMaterial({
            color: humanColor,
            emissive: humanGlow,
            emissiveIntensity: 0.4,
            transparent: true,
            opacity: opacity,
            roughness: 0.2,
            metalness: 0.2,
        });
    };

    // Subtle barrier material
    const createBarrierMaterial = (opacity = 0.3) => {
        return new THREE.MeshStandardMaterial({
            color: barrierColor,
            emissive: barrierColor,
            emissiveIntensity: 0.15,
            transparent: true,
            opacity: opacity,
            roughness: 0.2,
            metalness: 0.3,
        });
    };

    // === BARRIER - The threshold between AI and Human sides ===
    // Single clean wall panel
    const wall = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, 4.5, 0.05),
        createBarrierMaterial(0.25)
    );
    wall.position.set(0, 2.25, -1.8);
    zoneGroup.add(wall);

    // Simple pillars
    for (let side = -1; side <= 1; side += 2) {
        const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.15, 4.5, 32),
            createBarrierMaterial(0.4)
        );
        pillar.position.set(side * 2.4, 2.25, -1.8);
        zoneGroup.add(pillar);
    }

    // Boundary line on ground
    const boundaryLine = new THREE.Mesh(
        new THREE.BoxGeometry(5, 0.02, 0.08),
        new THREE.MeshBasicMaterial({ color: barrierColor, transparent: true, opacity: 0.6 })
    );
    boundaryLine.position.set(0, 0.01, -1.0);
    zoneGroup.add(boundaryLine);

    // === THE HUMAN FIGURE - Simple, warm, dignified ===
    // Human is the gatekeeper - positioned on the human side
    const humanGroup = new THREE.Group();
    humanGroup.position.set(0, 0, 0.8);

    // Body - simple flowing robe shape
    const robe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.5, 1.6, 32),
        createHumanMaterial(0.55)
    );
    robe.position.set(0, 1.0, 0);
    humanGroup.add(robe);

    // Torso
    const torso = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.22, 0.8, 32),
        createHumanMaterial(0.55)
    );
    torso.position.set(0, 2.2, 0);
    humanGroup.add(torso);
    zoneGroup.userData.torso = torso;

    // Head - smooth sphere
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 32, 32),
        createHumanMaterial(0.6)
    );
    head.position.set(0, 3.0, 0);
    head.scale.set(1, 1.1, 1);
    humanGroup.add(head);
    zoneGroup.userData.head = head;

    // Warm inner glow (heart/soul)
    const innerGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 32, 32),
        new THREE.MeshBasicMaterial({ color: humanGlow, transparent: true, opacity: 0.3 })
    );
    innerGlow.position.set(0, 2.2, 0);
    humanGroup.add(innerGlow);
    zoneGroup.userData.innerGlow = innerGlow;

    zoneGroup.add(humanGroup);
    zoneGroup.userData.humanGroup = humanGroup;

    // === AI PARTICLES - On the AI side (behind barrier) ===
    for (let i = 0; i < 12; i++) {
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 16, 16),
            new THREE.MeshBasicMaterial({
                color: barrierColor,
                transparent: true,
                opacity: 0.6,
            })
        );
        p.userData = {
            type: 'ai',
            baseX: (Math.random() - 0.5) * 3,
            baseY: 1 + Math.random() * 2.5,
            baseZ: -2.5 - Math.random() * 1,
            phase: Math.random() * Math.PI * 2,
        };
        zoneGroup.add(p);
        particles.push(p);
    }

    // === DECISION PARTICLES - Warm glow from human going outward ===
    for (let i = 0; i < 5; i++) {
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 16, 16),
            new THREE.MeshBasicMaterial({
                color: humanGlow,
                transparent: true,
                opacity: 0.7,
            })
        );
        p.userData = {
            type: 'human',
            progress: Math.random(),
            speed: 0.004 + Math.random() * 0.002,
            spreadX: (Math.random() - 0.5) * 0.3,
            y: 2 + Math.random() * 0.6,
        };
        zoneGroup.add(p);
        particles.push(p);
    }
}

function animateHumanOnly() {
    if (!zoneGroup || !zoneGroup.userData) return;

    // Inner glow - gentle breathing pulse
    if (zoneGroup.userData.innerGlow) {
        const breathe = 0.25 + Math.sin(time * 0.8) * 0.1;
        zoneGroup.userData.innerGlow.material.opacity = breathe;
        const scale = 1 + Math.sin(time * 0.8) * 0.05;
        zoneGroup.userData.innerGlow.scale.setScalar(scale);
    }

    // Torso breathing
    if (zoneGroup.userData.torso) {
        const breatheIntensity = 0.35 + Math.sin(time * 0.7) * 0.08;
        zoneGroup.userData.torso.material.emissiveIntensity = breatheIntensity;
    }

    // Particles
    particles.forEach(p => {
        if (!p.userData) return;

        if (p.userData.type === 'ai') {
            // AI particles drift behind barrier
            const drift = Math.sin(time * 0.5 + p.userData.phase);
            p.position.x = p.userData.baseX + drift * 0.2;
            p.position.y = p.userData.baseY + Math.sin(time * 0.4 + p.userData.phase) * 0.15;
            p.position.z = p.userData.baseZ;

        } else if (p.userData.type === 'human') {
            // Human decision particles flow forward (from human outward)
            p.userData.progress += p.userData.speed;
            if (p.userData.progress > 1) {
                p.userData.progress = 0;
                p.userData.spreadX = (Math.random() - 0.5) * 0.3;
            }

            p.position.x = p.userData.spreadX * p.userData.progress * 2;
            p.position.y = p.userData.y + Math.sin(p.userData.progress * Math.PI) * 0.2;
            p.position.z = 1 + p.userData.progress * 3.5;
            p.material.opacity = 0.7 * (1 - p.userData.progress * 0.6);
        }
    });
}

// ============================================================
// Zone Switching - Smooth horizontal slide
// ============================================================
function switchZone(zoneId) {
    if (zoneId === currentZone || isTransitioning) return;

    isTransitioning = true;
    const prevZoneIndex = ZONE_ORDER.indexOf(currentZone);
    const nextZoneIndex = ZONE_ORDER.indexOf(zoneId);
    const direction = nextZoneIndex > prevZoneIndex ? 1 : -1;

    // Clean up seamless labels when leaving that zone
    document.querySelectorAll('.seamless-label').forEach(el => el.remove());

    currentZone = zoneId;
    const zone = ZONES[zoneId];

    // Reset interactive state
    gateOpenAmount = 0;
    const slider = document.getElementById('gateSlider');
    if (slider) slider.value = 0;

    // Update UI
    updateViewButtons(zoneId);
    updateZoneControls(zoneId);
    closeDetail();

    // Smooth slide transition
    const slideDistance = 8;

    // Slide current zone out
    gsap.to(zoneGroup.position, {
        x: -direction * slideDistance,
        duration: 0.5,
        ease: 'power2.in',
        onComplete: () => {
            // Create new zone
            createZone(zoneId);

            // Position new zone off-screen
            zoneGroup.position.x = direction * slideDistance;

            // Slide new zone in
            gsap.to(zoneGroup.position, {
                x: 0,
                duration: 0.5,
                ease: 'power2.out',
                onComplete: () => {
                    isTransitioning = false;
                }
            });
        }
    });

    // Play tone
    AudioManager.playSelectTone(nextZoneIndex);
}

function updateZoneControls(zoneId) {
    const controls = document.getElementById('zoneControls');
    if (!controls) return;

    // Only show controls for gated zone
    if (zoneId === 'gated') {
        controls.classList.add('visible');
    } else {
        controls.classList.remove('visible');
    }
}

// Snap points for the gate slider (Closed, Review, Open)
const GATE_SNAP_POINTS = [0, 50, 100];

function updateGate(value, shouldSnap = true) {
    if (shouldSnap) {
        // Find nearest snap point
        value = findNearestSnapPoint(parseFloat(value));
        const slider = document.getElementById('gateSlider');
        if (slider) slider.value = value;
    }
    gateOpenAmount = value / 100;
}

function snapGate(value) {
    // Called on mouse release (onchange) - snap to nearest position
    const snappedValue = findNearestSnapPoint(parseFloat(value));
    const slider = document.getElementById('gateSlider');
    if (slider) {
        // Animate the snap with GSAP
        gsap.to({ val: parseFloat(value) }, {
            val: snappedValue,
            duration: 0.15,
            ease: 'power2.out',
            onUpdate: function() {
                slider.value = this.targets()[0].val;
                gateOpenAmount = this.targets()[0].val / 100;
            }
        });
    }
}

function findNearestSnapPoint(value) {
    let closest = GATE_SNAP_POINTS[0];
    let minDist = Math.abs(value - closest);

    for (let i = 1; i < GATE_SNAP_POINTS.length; i++) {
        const dist = Math.abs(value - GATE_SNAP_POINTS[i]);
        if (dist < minDist) {
            minDist = dist;
            closest = GATE_SNAP_POINTS[i];
        }
    }
    return closest;
}

function updateViewButtons(zoneId) {
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.zone === zoneId);
    });
}

// ============================================================
// Detail Panel
// ============================================================
function showDetail(zoneId) {
    const zone = ZONES[zoneId || currentZone];
    if (!zone) return;

    const panel = document.getElementById('detailPanel');
    const stakes = document.getElementById('detailStakes');
    const title = document.getElementById('detailTitle');
    const desc = document.getElementById('detailDescription');
    const examples = document.getElementById('detailExamples');

    if (stakes) {
        stakes.textContent = zone.stakes;
        stakes.style.color = zone.colorHex;
    }
    if (title) {
        title.textContent = zone.title;
        title.style.color = zone.colorHex;
    }
    if (desc) desc.textContent = zone.description;
    if (examples) examples.textContent = zone.examples;

    // Update examples border color
    const examplesBox = document.querySelector('.detail-panel__examples');
    if (examplesBox) {
        examplesBox.style.borderLeftColor = zone.colorHex;
    }

    if (panel) panel.classList.add('visible');
}

function closeDetail() {
    const panel = document.getElementById('detailPanel');
    if (panel) panel.classList.remove('visible');
}

// ============================================================
// Canvas Click - Reserved for future interactions
// ============================================================
function onCanvasClick(event) {
    // Click interactions could be added here for specific 3D elements
    // Currently, all information is displayed directly in the UI
}

// ============================================================
// Animation Loop
// ============================================================
function animate() {
    requestAnimationFrame(animate);
    time = performance.now() * 0.001;
    controls.update();

    // Slow rotation of the entire zone group (viewed from angle)
    if (zoneGroup && !isTransitioning) {
        zoneGroup.rotation.y = Math.sin(time * 0.15) * 0.25;
    }

    // Animate current zone
    switch (currentZone) {
        case 'seamless': animateSeamless(); break;
        case 'visible': animateVisible(); break;
        case 'gated': animateGated(); break;
        case 'human-only': animateHumanOnly(); break;
    }

    renderer.render(scene, camera);
}

// ============================================================
// Intro Animation
// ============================================================
function playIntro() {
    // Start camera further back
    camera.position.set(0, 5, 18);

    // Smooth camera approach to front view
    gsap.to(camera.position, {
        x: 0,
        y: 3,
        z: 12,
        duration: 2.5,
        ease: 'power2.out'
    });

    // Staggered UI reveal
    setTimeout(() => {
        document.getElementById('header')?.classList.add('visible');
    }, 400);

    setTimeout(() => {
        document.getElementById('viewControls')?.classList.add('visible');
    }, 700);

    setTimeout(() => {
        document.getElementById('zoneLabel')?.classList.add('visible');
    }, 1000);

    setTimeout(() => {
        document.getElementById('legend')?.classList.add('visible');
    }, 1200);

    setTimeout(() => {
        document.getElementById('controlsHint')?.classList.add('visible');
    }, 1500);

    setTimeout(() => {
        document.getElementById('audioBtn')?.classList.add('visible');
    }, 1800);
}

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
            this.masterGain.gain.value = 0.15;
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

        if (this.enabled && this.context.state === 'suspended') {
            this.context.resume();
        }

        const btn = document.getElementById('audioBtn');
        if (btn) {
            btn.classList.toggle('active', this.enabled);
            const label = btn.querySelector('.audio-label');
            if (label) label.textContent = this.enabled ? 'Sound On' : 'Sound';
        }
    },

    playSelectTone(zoneIndex) {
        if (!this.enabled || !this.context) return;

        const frequencies = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
        const freq = frequencies[zoneIndex] || 392;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.12, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.35);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.context.currentTime + 0.35);
    }
};

// ============================================================
// Utilities
// ============================================================
function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================================
// Global Functions for HTML
// ============================================================
window.switchZone = switchZone;
window.closeDetail = closeDetail;
window.updateGate = updateGate;
window.snapGate = snapGate;
window.toggleAudio = () => AudioManager.toggle();
