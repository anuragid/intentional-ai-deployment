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
        humanOnly: 0xdc2626,
    },
};

// Zone data
const ZONES = {
    seamless: {
        id: 'seamless',
        title: 'Seamless',
        stakes: 'Low Stakes',
        description: 'Zero friction. AI flows through invisibly — indistinguishable from human work. The user may not even know AI is involved.',
        examples: 'Auto-save, spell-check, spam filtering, smart replies',
        color: CONFIG.colors.seamless,
        colorHex: '#22d3ee',
    },
    visible: {
        id: 'visible',
        title: 'Visible',
        stakes: 'Learning Stakes',
        description: 'Beautiful seams illuminate where AI contributed — teaching through transparency. Users see and learn from AI\'s reasoning.',
        examples: 'Writing suggestions with highlights, code completion with explanations',
        color: CONFIG.colors.visible,
        colorHex: '#60a5fa',
    },
    gated: {
        id: 'gated',
        title: 'Gated',
        stakes: 'High Stakes',
        description: 'The flow pauses. Human approval required before AI action proceeds. A checkpoint ensures human judgment at critical moments.',
        examples: 'Send email confirmation, financial transactions, medical recommendations',
        color: CONFIG.colors.gated,
        colorHex: '#fbbf24',
    },
    'human-only': {
        id: 'human-only',
        title: 'Human-Only',
        stakes: 'Constitutional Stakes',
        description: 'The barrier is absolute. Human decides, AI advises at most. Some choices belong to us alone.',
        examples: 'Hiring decisions, judicial rulings, life-altering medical choices',
        color: CONFIG.colors.humanOnly,
        colorHex: '#dc2626',
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

    // Camera
    camera = new THREE.PerspectiveCamera(
        50,
        window.innerWidth / window.innerHeight,
        0.1,
        100
    );
    camera.position.set(0, 5, 12);
    camera.lookAt(0, 2, 0);

    // Renderer
    const canvas = document.getElementById('canvas');
    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 6;
    controls.maxDistance = 20;
    controls.maxPolarAngle = Math.PI * 0.65;
    controls.target.set(0, 2, 0);

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
}

function createPlatform(color) {
    const geometry = new THREE.CylinderGeometry(3.5, 3.7, 0.15, 64);
    const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.08,
        roughness: 0.6,
        metalness: 0.3,
    });
    const platform = new THREE.Mesh(geometry, material);
    platform.position.y = -0.08;
    zoneGroup.add(platform);

    // Subtle glow ring
    const ringGeo = new THREE.RingGeometry(3.3, 3.8, 64);
    const ringMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    zoneGroup.add(ring);
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
    const labelName = document.getElementById('zoneLabelName');
    const labelStakes = document.getElementById('zoneLabelStakes');
    const label = document.getElementById('zoneLabel');

    if (labelName) {
        labelName.textContent = zone.title;
        labelName.style.color = zone.colorHex;
    }
    if (labelStakes) {
        labelStakes.textContent = zone.stakes;
    }
}

// ============================================================
// SEAMLESS ZONE - Invisible flow
// ============================================================
function createSeamlessScene(zone) {
    // Transparent sphere containing invisible flow
    const sphereGeo = new THREE.SphereGeometry(2.2, 32, 32);
    const sphereMat = new THREE.MeshPhysicalMaterial({
        color: zone.color,
        transparent: true,
        opacity: 0.04,
        roughness: 0.1,
        transmission: 0.95,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.y = 2.5;
    zoneGroup.add(sphere);
    zoneGroup.userData.sphere = sphere;

    // Particles that flow nearly invisibly
    for (let i = 0; i < 35; i++) {
        const geo = new THREE.SphereGeometry(0.06, 8, 8);
        const mat = new THREE.MeshBasicMaterial({
            color: zone.color,
            transparent: true,
            opacity: 0.15, // Barely visible
        });
        const p = new THREE.Mesh(geo, mat);
        p.userData = {
            angle: Math.random() * Math.PI * 2,
            radius: 0.8 + Math.random() * 1.2,
            speed: 0.4 + Math.random() * 0.4,
            yOffset: Math.random() * 3,
            ySpeed: 0.25 + Math.random() * 0.25,
        };
        zoneGroup.add(p);
        particles.push(p);
    }
}

function animateSeamless() {
    if (!zoneGroup) return;

    particles.forEach(p => {
        if (!p.userData || p.userData.angle === undefined) return;
        p.userData.angle += p.userData.speed * 0.012;
        p.userData.yOffset += p.userData.ySpeed * 0.015;
        if (p.userData.yOffset > 4) p.userData.yOffset = 0;

        p.position.x = Math.cos(p.userData.angle) * p.userData.radius;
        p.position.y = 0.8 + p.userData.yOffset;
        p.position.z = Math.sin(p.userData.angle) * p.userData.radius;
    });

    // Gentle sphere breathing
    if (zoneGroup.userData.sphere) {
        const breathe = 1 + Math.sin(time * 0.8) * 0.03;
        zoneGroup.userData.sphere.scale.setScalar(breathe);
    }
}

// ============================================================
// VISIBLE ZONE - Illuminated seams
// ============================================================
function createVisibleScene(zone) {
    // Crystal with glowing edges (the seams)
    const icoGeo = new THREE.IcosahedronGeometry(1.8, 0);
    const icoMat = new THREE.MeshPhysicalMaterial({
        color: zone.color,
        transparent: true,
        opacity: 0.15,
        roughness: 0.2,
        transmission: 0.7,
    });
    const crystal = new THREE.Mesh(icoGeo, icoMat);
    crystal.position.y = 2.5;
    zoneGroup.add(crystal);
    zoneGroup.userData.crystal = crystal;

    // Glowing edges (the beautiful seams)
    const edgeGeo = new THREE.EdgesGeometry(icoGeo);
    const edgeMat = new THREE.LineBasicMaterial({
        color: zone.color,
        transparent: true,
        opacity: 0.85,
    });
    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    edges.position.y = 2.5;
    zoneGroup.add(edges);
    zoneGroup.userData.edges = edges;

    // Particles orbiting vertices
    const vertices = [
        new THREE.Vector3(0, 1.8, 0),
        new THREE.Vector3(0, -1.8, 0),
        new THREE.Vector3(1.8, 0, 0),
        new THREE.Vector3(-1.8, 0, 0),
        new THREE.Vector3(0, 0, 1.8),
        new THREE.Vector3(0, 0, -1.8),
    ];

    for (let i = 0; i < 18; i++) {
        const geo = new THREE.SphereGeometry(0.05, 8, 8);
        const mat = new THREE.MeshBasicMaterial({
            color: zone.color,
            transparent: true,
            opacity: 0.75,
        });
        const p = new THREE.Mesh(geo, mat);
        p.userData = {
            vertex: i % vertices.length,
            orbitAngle: Math.random() * Math.PI * 2,
            orbitRadius: 0.25 + Math.random() * 0.2,
            orbitSpeed: 0.8 + Math.random() * 0.6,
        };
        zoneGroup.add(p);
        particles.push(p);
    }
    zoneGroup.userData.vertices = vertices;
}

function animateVisible() {
    if (!zoneGroup || !zoneGroup.userData) return;

    // Crystal rotation
    if (zoneGroup.userData.crystal) {
        zoneGroup.userData.crystal.rotation.y += 0.004;
        zoneGroup.userData.crystal.rotation.x = Math.sin(time * 0.25) * 0.08;
    }
    if (zoneGroup.userData.edges) {
        zoneGroup.userData.edges.rotation.y += 0.004;
        zoneGroup.userData.edges.rotation.x = Math.sin(time * 0.25) * 0.08;
    }

    // Particles orbit vertices
    const vertices = zoneGroup.userData.vertices || [];
    particles.forEach(p => {
        if (!p.userData || p.userData.vertex === undefined) return;
        p.userData.orbitAngle += p.userData.orbitSpeed * 0.015;
        const v = vertices[p.userData.vertex];
        if (!v) return;
        const r = p.userData.orbitRadius;

        p.position.x = v.x * 0.85 + Math.cos(p.userData.orbitAngle) * r;
        p.position.y = 2.5 + v.y * 0.85 + Math.sin(p.userData.orbitAngle * 0.7) * r * 0.4;
        p.position.z = v.z * 0.85 + Math.sin(p.userData.orbitAngle) * r;
    });
}

// ============================================================
// GATED ZONE - Checkpoint with approval
// ============================================================
function createGatedScene(zone) {
    const pillarMat = new THREE.MeshStandardMaterial({
        color: zone.color,
        emissive: zone.color,
        emissiveIntensity: 0.15,
        roughness: 0.4,
        metalness: 0.5,
    });

    // Gate pillars
    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4, 0.5), pillarMat);
    leftPillar.position.set(-1.2, 2, 0);
    zoneGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4, 0.5), pillarMat);
    rightPillar.position.set(1.2, 2, 0);
    zoneGroup.add(rightPillar);

    // Horizontal bar (the gate)
    const gateMat = new THREE.MeshStandardMaterial({
        color: zone.color,
        emissive: zone.color,
        emissiveIntensity: 0.3,
    });
    const gateBar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 0.25), gateMat);
    gateBar.position.set(0, 1.5, 0);
    zoneGroup.add(gateBar);
    zoneGroup.userData.gateBar = gateBar;

    // Status light at top
    const lightGeo = new THREE.SphereGeometry(0.25, 16, 16);
    const lightMat = new THREE.MeshBasicMaterial({ color: zone.color });
    const statusLight = new THREE.Mesh(lightGeo, lightMat);
    statusLight.position.set(0, 4.3, 0);
    zoneGroup.add(statusLight);
    zoneGroup.userData.statusLight = statusLight;

    // Particles queuing/waiting
    for (let i = 0; i < 12; i++) {
        const geo = new THREE.SphereGeometry(0.1, 8, 8);
        const mat = new THREE.MeshBasicMaterial({
            color: zone.color,
            transparent: true,
            opacity: 0.7,
        });
        const p = new THREE.Mesh(geo, mat);
        p.userData = {
            lane: (Math.random() - 0.5) * 1.5,
            height: 1.2 + Math.random() * 1.8,
            progress: Math.random(),
            speed: 0.002 + Math.random() * 0.002,
            waiting: Math.random() > 0.5,
        };
        zoneGroup.add(p);
        particles.push(p);
    }
}

function animateGated() {
    if (!zoneGroup || !zoneGroup.userData) return;

    // Gate bar position controlled by slider (1.5 = closed, 4.5 = open)
    const targetGateY = 1.5 + gateOpenAmount * 3;
    if (zoneGroup.userData.gateBar) {
        zoneGroup.userData.gateBar.position.y += (targetGateY - zoneGroup.userData.gateBar.position.y) * 0.1;
    }

    // Status light color based on gate position
    if (zoneGroup.userData.statusLight) {
        const color = new THREE.Color();
        if (gateOpenAmount < 0.33) {
            color.setHex(0xdc2626); // Red - closed
        } else if (gateOpenAmount < 0.66) {
            color.setHex(0xfbbf24); // Amber - review
        } else {
            color.setHex(0x22c55e); // Green - open
        }
        zoneGroup.userData.statusLight.material.color = color;
    }

    // Particles approach gate - behavior depends on gate state
    // Closed: stopped, Review: paused for approval, Open: flowing
    particles.forEach(p => {
        if (!p.userData || p.userData.progress === undefined) return;

        const atGate = p.userData.progress > 0.4 && p.userData.progress < 0.6;

        // Determine flow based on gate state
        let speedMult;
        if (gateOpenAmount < 0.33) {
            // Closed - stopped at gate
            speedMult = 0;
        } else if (gateOpenAmount < 0.66) {
            // Review - cautious flow
            speedMult = 0.5;
        } else {
            // Open - flowing freely
            speedMult = 2;
        }

        if (atGate && speedMult === 0) {
            // Waiting at gate - jitter in place
            p.position.z = -0.8 + Math.sin(time * 5 + p.userData.progress * 10) * 0.03;
        } else {
            // Moving through
            p.userData.progress += p.userData.speed * Math.max(speedMult, 0.1);
            if (p.userData.progress > 1) {
                p.userData.progress = 0;
            }
            p.position.z = -3 + p.userData.progress * 6;
        }

        p.position.x = p.userData.lane;
        p.position.y = p.userData.height;
    });
}

// ============================================================
// HUMAN-ONLY ZONE - The Sanctum
// Human at center, protected by impassable boundary.
// AI particles orbit outside as advisors - they can never enter.
// Decisions emanate FROM the human outward.
// ============================================================
function createHumanOnlyScene(zone) {
    // Circular boundary - the impassable barrier
    const boundaryRadius = 2.2;

    // Boundary ring on ground
    const boundaryRingGeo = new THREE.RingGeometry(boundaryRadius - 0.05, boundaryRadius + 0.05, 64);
    const boundaryRingMat = new THREE.MeshBasicMaterial({
        color: zone.color,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
    });
    const boundaryRing = new THREE.Mesh(boundaryRingGeo, boundaryRingMat);
    boundaryRing.rotation.x = -Math.PI / 2;
    boundaryRing.position.y = 0.02;
    zoneGroup.add(boundaryRing);

    // Vertical barrier posts around the perimeter
    const postMat = new THREE.MeshStandardMaterial({
        color: zone.color,
        emissive: zone.color,
        emissiveIntensity: 0.2,
        roughness: 0.4,
        metalness: 0.5,
    });

    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 8), postMat);
        post.position.set(
            Math.cos(angle) * boundaryRadius,
            1.5,
            Math.sin(angle) * boundaryRadius
        );
        zoneGroup.add(post);
    }

    // Central pedestal for human
    const pedestalMat = new THREE.MeshStandardMaterial({
        color: 0xf5f0e8,
        emissive: 0xf5f0e8,
        emissiveIntensity: 0.05,
    });
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 0.5, 16), pedestalMat);
    pedestal.position.y = 0.25;
    zoneGroup.add(pedestal);

    // Human figure at center - the decision maker
    const figureMat = new THREE.MeshStandardMaterial({
        color: 0xf5f0e8,
        emissive: 0xf5f0e8,
        emissiveIntensity: 0.2,
    });

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), figureMat);
    head.position.set(0, 2.6, 0);
    zoneGroup.add(head);
    zoneGroup.userData.head = head;

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.2, 8), figureMat);
    body.position.set(0, 1.65, 0);
    zoneGroup.add(body);

    // Arms extended outward - showing human agency
    const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8);
    const leftArm = new THREE.Mesh(armGeo, figureMat);
    leftArm.position.set(-0.5, 2.0, 0);
    leftArm.rotation.z = Math.PI / 3;
    zoneGroup.add(leftArm);
    zoneGroup.userData.leftArm = leftArm;

    const rightArm = new THREE.Mesh(armGeo, figureMat);
    rightArm.position.set(0.5, 2.0, 0);
    rightArm.rotation.z = -Math.PI / 3;
    zoneGroup.add(rightArm);
    zoneGroup.userData.rightArm = rightArm;

    zoneGroup.userData.boundaryRadius = boundaryRadius;

    // AI particles - orbit OUTSIDE the boundary, never entering
    for (let i = 0; i < 12; i++) {
        const geo = new THREE.SphereGeometry(0.08, 8, 8);
        const mat = new THREE.MeshBasicMaterial({
            color: zone.color,
            transparent: true,
            opacity: 0.7,
        });
        const p = new THREE.Mesh(geo, mat);
        p.userData = {
            type: 'ai',
            angle: (i / 12) * Math.PI * 2,
            orbitRadius: boundaryRadius + 0.8 + Math.random() * 0.6,
            orbitSpeed: 0.15 + Math.random() * 0.1,
            y: 1.0 + Math.random() * 2.0,
            bobSpeed: 1 + Math.random(),
            bobAmount: 0.1 + Math.random() * 0.1,
        };
        zoneGroup.add(p);
        particles.push(p);
    }

    // Human decision particles - emanate FROM the human outward
    for (let i = 0; i < 6; i++) {
        const geo = new THREE.SphereGeometry(0.06, 8, 8);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xf5f0e8, // Human color, not AI color
            transparent: true,
            opacity: 0.8,
        });
        const p = new THREE.Mesh(geo, mat);
        p.userData = {
            type: 'human',
            angle: Math.random() * Math.PI * 2,
            progress: Math.random(), // 0 = at center, 1 = at boundary
            speed: 0.008 + Math.random() * 0.004,
            y: 1.5 + Math.random() * 1.0,
        };
        zoneGroup.add(p);
        particles.push(p);
    }
}

function animateHumanOnly() {
    if (!zoneGroup || !zoneGroup.userData) return;

    const boundaryRadius = zoneGroup.userData.boundaryRadius || 2.2;

    // Human head looks around thoughtfully
    if (zoneGroup.userData.head) {
        zoneGroup.userData.head.rotation.y = Math.sin(time * 0.4) * 0.3;
    }

    // Arms pulse gently - showing active decision-making
    if (zoneGroup.userData.leftArm) {
        const pulse = Math.sin(time * 2) * 0.1;
        zoneGroup.userData.leftArm.rotation.z = Math.PI / 3 + pulse;
    }
    if (zoneGroup.userData.rightArm) {
        const pulse = Math.sin(time * 2 + Math.PI) * 0.1;
        zoneGroup.userData.rightArm.rotation.z = -Math.PI / 3 + pulse;
    }

    particles.forEach(p => {
        if (!p.userData) return;

        if (p.userData.type === 'ai') {
            // AI particles orbit OUTSIDE the boundary - never entering
            p.userData.angle += p.userData.orbitSpeed * 0.01;

            // They may approach the boundary but always stay outside
            const approachPulse = Math.sin(time * 0.5 + p.userData.angle) * 0.2;
            const currentRadius = p.userData.orbitRadius - approachPulse;

            // Ensure they NEVER cross the boundary
            const safeRadius = Math.max(currentRadius, boundaryRadius + 0.3);

            p.position.x = Math.cos(p.userData.angle) * safeRadius;
            p.position.z = Math.sin(p.userData.angle) * safeRadius;
            p.position.y = p.userData.y + Math.sin(time * p.userData.bobSpeed) * p.userData.bobAmount;

        } else if (p.userData.type === 'human') {
            // Human decision particles emanate FROM center outward
            p.userData.progress += p.userData.speed;

            if (p.userData.progress > 1) {
                // Reset to center and choose new direction
                p.userData.progress = 0;
                p.userData.angle = Math.random() * Math.PI * 2;
            }

            // Expand outward from human
            const radius = p.userData.progress * boundaryRadius * 1.5;
            p.position.x = Math.cos(p.userData.angle) * radius;
            p.position.z = Math.sin(p.userData.angle) * radius;
            p.position.y = p.userData.y;

            // Fade out as they travel outward
            p.material.opacity = 0.8 * (1 - p.userData.progress * 0.7);
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
// Canvas Click - Show detail panel
// ============================================================
function onCanvasClick(event) {
    // Check if clicking on the 3D scene (not UI)
    const rect = renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Simple click detection - if clicking roughly in center, show detail
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));

    if (distance < rect.width * 0.3) {
        showDetail(currentZone);
    }
}

// ============================================================
// Animation Loop
// ============================================================
function animate() {
    requestAnimationFrame(animate);
    time = performance.now() * 0.001;
    controls.update();

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
    camera.position.set(0, 7, 18);

    // Smooth camera approach
    gsap.to(camera.position, {
        y: 5,
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
