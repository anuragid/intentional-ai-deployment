/**
 * The Complementarity View
 * Isometric 3D visualization with street lamp metaphor
 */

// ============================================================
// Configuration
// ============================================================

const CONFIG = {
    colors: {
        bg: 0x08080c,
        ground: 0x1a1a24,
        lampPost: 0x3a3a44,
        lampLight: 0xfef3c7,
        lampGlow: 0xfbbf24,
        ai: 0x22d3ee,
        human: 0x34d399,
        unobservable: 0xf59e0b,
    },

    // Unobservables positioned in human's perception area (x=0 to x=7, centered at x=3.5)
    // All OUTSIDE AI's light cone (which ends at x=1.5)
    // Arranged in a pleasing arc around the human figure
    unobservables: [
        { id: 'intuition', symbol: '◎', title: 'Intuition',
          description: 'Knowing something is wrong before you can articulate why.',
          position: { x: 2.5, z: -2.5 } },
        { id: 'presence', symbol: '◈', title: 'Physical Presence',
          description: 'The weight of a handshake, the tension in a room.',
          position: { x: 4.5, z: 2 } },
        { id: 'room', symbol: '◇', title: 'Reading the Room',
          description: 'The collective mood. Energy that shifts without anyone speaking.',
          position: { x: 5.5, z: -1.5 } },
        { id: 'trust', symbol: '∞', title: 'Relationship Capital',
          description: 'Trust built through years.',
          position: { x: 3.5, z: 2.5 } },
        { id: 'memory', symbol: '⌘', title: 'Institutional Memory',
          description: 'How things actually work, beyond the org chart.',
          position: { x: 6, z: 0.5 } },
        { id: 'context', symbol: '⟡', title: 'Contextual Meaning',
          description: 'Understanding what "fine" really means.',
          position: { x: 4.5, z: -2 } },
        { id: 'timing', symbol: '◐', title: 'Timing & Rhythm',
          description: 'Knowing when to push and when to wait.',
          position: { x: 5, z: 1 } },
        { id: 'silence', symbol: '○', title: "What's Not Said",
          description: 'The pause that speaks volumes.',
          position: { x: 6.5, z: -0.5 } },
    ],
};

// ============================================================
// Global variables
// ============================================================

let scene, camera, renderer, controls;
let time = 0;
let mouse = { x: 0, y: 0 };
let mouseClient = { x: 0, y: 0 };
let hoveredUnobservable = null;
let unobservableObjects = [];
let labelElements = [];
let lightCone, humanGlow, aiEye, humanArm;

// ============================================================
// Initialize
// ============================================================

function init() {
    console.log('Initializing Three.js scene...');

    try {
        // Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(CONFIG.colors.bg);
        scene.fog = new THREE.Fog(CONFIG.colors.bg, 15, 40);
        console.log('Scene created');

        // Camera - isometric corner view
        const aspect = window.innerWidth / window.innerHeight;
        camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
        // Position at corner diagonal - adjusted to frame the full scene
        camera.position.set(12, 12, 14);
        // Note: camera.lookAt is managed by OrbitControls
        console.log('Camera created');

        // Renderer
        const canvas = document.getElementById('canvas');
        if (!canvas) {
            console.error('Canvas element not found!');
            return;
        }

        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        console.log('Renderer created');

        // OrbitControls for pan/tilt/zoom
        if (typeof THREE.OrbitControls !== 'undefined') {
            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.screenSpacePanning = true;
            controls.minDistance = 5;
            controls.maxDistance = 50;
            controls.maxPolarAngle = Math.PI / 2.1; // Prevent going below ground
            controls.target.set(2, 0, 0); // Look at center of scene
            controls.update();
            console.log('OrbitControls initialized');
        } else {
            console.warn('OrbitControls not available - using static camera');
            camera.lookAt(2, 0, 0);
        }

        // Lights - brighter for better visibility
        const ambient = new THREE.AmbientLight(0x606080, 1.2);
        scene.add(ambient);

        // Add directional light for better definition
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
        dirLight.position.set(10, 15, 10);
        scene.add(dirLight);

        // Create scene elements
        createGround();
        createStreetLamp();
        createAIFigure();
        createHumanFigure();
        createUnobservables();
        createSceneLabels();

        // Events
        setupEvents();

        // Start animation
        animate();

        // UI intro
        playIntro();

        console.log('Initialization complete!');

    } catch (error) {
        console.error('Error during initialization:', error);
    }
}

// ============================================================
// Ground
// ============================================================

function createGround() {
    const groundGeom = new THREE.PlaneGeometry(40, 40);
    const groundMat = new THREE.MeshStandardMaterial({
        color: CONFIG.colors.ground,
        roughness: 0.9,
        metalness: 0.1,
    });

    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid - more visible
    const grid = new THREE.GridHelper(30, 40, 0x3a3a48, 0x2a2a38);
    grid.position.y = 0.01;
    scene.add(grid);

    console.log('Ground created');
}

// ============================================================
// Street Lamp
// ============================================================

function createStreetLamp() {
    const lampGroup = new THREE.Group();

    // Post
    const postGeom = new THREE.CylinderGeometry(0.08, 0.12, 4, 8);
    const postMat = new THREE.MeshStandardMaterial({
        color: CONFIG.colors.lampPost,
        roughness: 0.6,
        metalness: 0.4,
    });
    const post = new THREE.Mesh(postGeom, postMat);
    post.position.y = 2;
    post.castShadow = true;
    lampGroup.add(post);

    // Arm
    const armGeom = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6);
    const arm = new THREE.Mesh(armGeom, postMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(0.5, 3.8, 0);
    lampGroup.add(arm);

    // Housing
    const housingGeom = new THREE.ConeGeometry(0.4, 0.5, 8);
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
    const housing = new THREE.Mesh(housingGeom, housingMat);
    housing.position.set(1, 3.6, 0);
    lampGroup.add(housing);

    // Bulb
    const bulbGeom = new THREE.SphereGeometry(0.15, 16, 16);
    const bulbMat = new THREE.MeshBasicMaterial({ color: CONFIG.colors.lampLight });
    const bulb = new THREE.Mesh(bulbGeom, bulbMat);
    bulb.position.set(1, 3.35, 0);
    lampGroup.add(bulb);

    // Spot light - brighter
    const spotLight = new THREE.SpotLight(CONFIG.colors.lampGlow, 4);
    spotLight.position.set(1, 3.3, 0);
    spotLight.angle = Math.PI / 3.5;
    spotLight.penumbra = 0.4;
    spotLight.decay = 1.2;
    spotLight.distance = 18;
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    spotLight.target.position.set(1, 0, 0);
    lampGroup.add(spotLight);
    lampGroup.add(spotLight.target);

    // Point light for glow
    const pointLight = new THREE.PointLight(CONFIG.colors.lampLight, 0.8, 8);
    pointLight.position.set(1, 3.3, 0);
    lampGroup.add(pointLight);

    lampGroup.position.set(-3, 0, 0);
    scene.add(lampGroup);

    // Light cone visual
    createLightCone();

    console.log('Street lamp created');
}

function createLightCone() {
    // Cone starts at lamp bulb and expands DOWN to ground
    // Lamp bulb is at world position (-2, 3.35, 0)
    const coneHeight = 3.35;
    const coneRadius = 3.5;

    const coneGeom = new THREE.ConeGeometry(coneRadius, coneHeight, 32, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
        color: CONFIG.colors.lampGlow,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    lightCone = new THREE.Mesh(coneGeom, coneMat);
    // Position so tip is at bulb (y=3.35) and base is at ground (y=0)
    // Cone center needs to be at y = coneHeight/2
    lightCone.position.set(-2, coneHeight / 2, 0);
    // No rotation needed - cone tip points UP by default, which is towards lamp
    scene.add(lightCone);

    // Ground circle - matches cone base, this is AI's observable domain
    const circleGeom = new THREE.CircleGeometry(coneRadius, 32);
    const circleMat = new THREE.MeshBasicMaterial({
        color: CONFIG.colors.lampGlow,
        transparent: true,
        opacity: 0.2,
    });
    const circle = new THREE.Mesh(circleGeom, circleMat);
    circle.rotation.x = -Math.PI / 2;
    circle.position.set(-2, 0.02, 0);
    scene.add(circle);
}

// ============================================================
// AI Figure
// ============================================================

function createAIFigure() {
    const aiGroup = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
        color: CONFIG.colors.ai,
        roughness: 0.2,
        metalness: 0.8,
        emissive: CONFIG.colors.ai,
        emissiveIntensity: 0.6,
    });

    // Body
    const bodyGeom = new THREE.BoxGeometry(0.5, 1.0, 0.3);
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    aiGroup.add(body);

    // Head
    const headGeom = new THREE.BoxGeometry(0.35, 0.35, 0.3);
    const head = new THREE.Mesh(headGeom, bodyMat);
    head.position.y = 1.35;
    head.castShadow = true;
    aiGroup.add(head);

    // Eye
    const eyeGeom = new THREE.BoxGeometry(0.25, 0.05, 0.02);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    aiEye = new THREE.Mesh(eyeGeom, eyeMat);
    aiEye.position.set(0, 1.35, 0.16);
    aiGroup.add(aiEye);

    // Legs
    const legGeom = new THREE.BoxGeometry(0.15, 0.4, 0.15);
    const leftLeg = new THREE.Mesh(legGeom, bodyMat);
    leftLeg.position.set(-0.12, 0.2, 0);
    aiGroup.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeom, bodyMat);
    rightLeg.position.set(0.12, 0.2, 0);
    aiGroup.add(rightLeg);

    aiGroup.position.set(-2, 0, 0);
    aiGroup.rotation.y = Math.PI / 8;
    scene.add(aiGroup);

    // Label
    createLabel('AI', new THREE.Vector3(-2, 2.2, 0), '#22d3ee');

    console.log('AI figure created');
}

// ============================================================
// Human Figure
// ============================================================

function createHumanFigure() {
    const humanGroup = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
        color: CONFIG.colors.human,
        roughness: 0.4,
        metalness: 0.2,
        emissive: CONFIG.colors.human,
        emissiveIntensity: 0.5,
    });

    // Body - use cylinder instead of capsule for compatibility
    const bodyGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.9, 16);
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.65;
    body.castShadow = true;
    humanGroup.add(body);

    // Head
    const headGeom = new THREE.SphereGeometry(0.2, 16, 16);
    const head = new THREE.Mesh(headGeom, bodyMat);
    head.position.y = 1.35;
    head.castShadow = true;
    humanGroup.add(head);

    // Arms - use cylinders
    const armGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8);

    const leftArm = new THREE.Mesh(armGeom, bodyMat);
    leftArm.position.set(-0.3, 0.8, 0);
    leftArm.rotation.z = 0.2;
    humanGroup.add(leftArm);

    humanArm = new THREE.Mesh(armGeom, bodyMat);
    humanArm.position.set(0.35, 1.0, 0);
    humanArm.rotation.z = -1.2;
    humanGroup.add(humanArm);

    // Legs
    const legGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8);
    const leftLeg = new THREE.Mesh(legGeom, bodyMat);
    leftLeg.position.set(-0.1, 0.2, 0);
    humanGroup.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeom, bodyMat);
    rightLeg.position.set(0.1, 0.2, 0);
    humanGroup.add(rightLeg);

    // Human is positioned at the edge of AI's light cone
    // Light cone center is at x=-2, radius 3.5, so boundary is at x=1.5
    // Human stands at the boundary
    humanGroup.position.set(2, 0, 0);
    humanGroup.rotation.y = -Math.PI / 5; // Facing towards AI/light
    scene.add(humanGroup);

    // Human perception area - ground circle with ~20% overlap with AI's area
    // AI circle: center x=-2, radius 3.5 (extends to x=1.5)
    // Human circle: center x=3.5, radius 3.5 → overlaps from x=0 to x=1.5
    const humanPerceptionGeom = new THREE.CircleGeometry(3.5, 32);
    const humanPerceptionMat = new THREE.MeshBasicMaterial({
        color: CONFIG.colors.human,
        transparent: true,
        opacity: 0.1,
    });
    const humanPerception = new THREE.Mesh(humanPerceptionGeom, humanPerceptionMat);
    humanPerception.rotation.x = -Math.PI / 2;
    humanPerception.position.set(3.5, 0.03, 0);
    scene.add(humanPerception);

    // Label - positioned above the human figure
    createLabel('Human', new THREE.Vector3(2, 2.2, 0), '#34d399');

    console.log('Human figure created');
}

// ============================================================
// Unobservables
// ============================================================

function createUnobservables() {
    CONFIG.unobservables.forEach((u, i) => {
        const group = new THREE.Group();

        // Minimal, refined orb - small and elegant
        const orbGeom = new THREE.SphereGeometry(0.1, 16, 16);
        const orbMat = new THREE.MeshBasicMaterial({
            color: CONFIG.colors.unobservable,
            transparent: true,
            opacity: 0.9,
        });
        const orb = new THREE.Mesh(orbGeom, orbMat);
        group.add(orb);

        // Subtle glow halo - just enough to make it visible
        const glowGeom = new THREE.SphereGeometry(0.18, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({
            color: CONFIG.colors.unobservable,
            transparent: true,
            opacity: 0.12,
        });
        const glow = new THREE.Mesh(glowGeom, glowMat);
        group.add(glow);

        // Position - floating at a low height
        const baseY = 0.5;
        group.position.set(u.position.x, baseY, u.position.z);
        group.userData = { unobservable: u, index: i, baseY: baseY };

        scene.add(group);
        unobservableObjects.push(group);

        // HTML label
        createUnobservableLabel(u, group);
    });

    console.log('Unobservables created');
}

function createUnobservableLabel(u, group) {
    const labelDiv = document.createElement('div');
    labelDiv.className = 'unobservable-label';
    labelDiv.innerHTML = `
        <span class="symbol">${u.symbol}</span>
        <span class="title">${u.title}</span>
    `;
    labelDiv.dataset.id = u.id;
    document.body.appendChild(labelDiv);

    labelElements.push({
        element: labelDiv,
        object: group,
        data: u,
        isUnobservable: true,
    });
}

// ============================================================
// Scene Labels (Observable/Unobservable area labels)
// ============================================================

function createSceneLabels() {
    // "Observable Data" label - positioned above AI's domain
    const observableLabel = document.getElementById('labelObservable');
    if (observableLabel) {
        labelElements.push({
            element: observableLabel,
            position: new THREE.Vector3(-2, 0.5, -3), // Above/behind the light cone
            isFixed: true,
            isSceneLabel: true,
        });
    }

    // "The Unobservable" label - positioned in human's domain
    const unobservableLabel = document.getElementById('labelUnobservable');
    if (unobservableLabel) {
        labelElements.push({
            element: unobservableLabel,
            position: new THREE.Vector3(5, 0.5, -2), // In the unobservable area
            isFixed: true,
            isSceneLabel: true,
        });
    }

    console.log('Scene labels created');
}

// ============================================================
// Labels
// ============================================================

function createLabel(text, position, color) {
    const labelDiv = document.createElement('div');
    labelDiv.className = 'figure-label';
    labelDiv.textContent = text;
    labelDiv.style.color = color;
    document.body.appendChild(labelDiv);

    labelElements.push({
        element: labelDiv,
        position: position,
        isFixed: true,
    });
}

function updateLabels() {
    labelElements.forEach(label => {
        let pos;
        if (label.isFixed) {
            pos = label.position.clone();
        } else {
            pos = label.object.position.clone();
            pos.y += 0.4; // Smaller offset for smaller orbs
        }

        const projected = pos.project(camera);
        const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;

        label.element.style.left = x + 'px';
        label.element.style.top = y + 'px';

        if (label.isUnobservable) {
            const isHovered = hoveredUnobservable === label.data.id;
            label.element.classList.toggle('hovered', isHovered);
        }
    });
}

// ============================================================
// Tooltip
// ============================================================

function updateTooltip() {
    const tooltip = document.getElementById('tooltip');
    const tooltipTitle = document.getElementById('tooltipTitle');
    const tooltipText = document.getElementById('tooltipText');

    if (hoveredUnobservable) {
        const u = CONFIG.unobservables.find(u => u.id === hoveredUnobservable);
        if (u) {
            tooltipTitle.textContent = u.title;
            tooltipText.textContent = u.description;
            tooltip.style.left = (mouseClient.x + 20) + 'px';
            tooltip.style.top = (mouseClient.y - 20) + 'px';
            tooltip.classList.add('visible');
        }
    } else {
        tooltip.classList.remove('visible');
    }
}

// ============================================================
// Raycasting
// ============================================================

function checkHover() {
    const raycaster = new THREE.Raycaster();
    const mouseVec = new THREE.Vector2(mouse.x, mouse.y);
    raycaster.setFromCamera(mouseVec, camera);

    const orbs = unobservableObjects.map(g => g.children[0]);
    const intersects = raycaster.intersectObjects(orbs);

    if (intersects.length > 0) {
        const obj = intersects[0].object.parent;
        hoveredUnobservable = obj.userData.unobservable.id;
        document.body.style.cursor = 'pointer';
    } else {
        hoveredUnobservable = null;
        document.body.style.cursor = 'default';
    }
}

// ============================================================
// Animation
// ============================================================

function animate() {
    requestAnimationFrame(animate);

    time += 0.016;

    // Update OrbitControls for smooth damping
    if (controls) {
        controls.update();
    }

    // Light cone flicker
    if (lightCone) {
        lightCone.material.opacity = 0.06 + Math.sin(time * 3) * 0.02;
    }

    // AI eye scan
    if (aiEye) {
        aiEye.position.y = 1.35 + Math.sin(time * 2) * 0.05;
    }

    // Human arm reach
    if (humanArm) {
        humanArm.rotation.z = -1.2 + Math.sin(time * 0.5) * 0.1;
    }

    // Animate unobservables - gentle floating motion
    unobservableObjects.forEach((group, i) => {
        const baseY = group.userData.baseY;
        group.position.y = baseY + Math.sin(time * 0.5 + i * 0.7) * 0.08;

        const isHovered = hoveredUnobservable === group.userData.unobservable.id;
        const targetScale = isHovered ? 1.3 : 1.0;
        const currentScale = group.scale.x;
        const newScale = currentScale + (targetScale - currentScale) * 0.1;
        group.scale.setScalar(newScale);

        // Animate opacity for hover feedback
        const orb = group.children[0];
        const glow = group.children[1];
        orb.material.opacity = isHovered ? 1.0 : 0.9;
        glow.material.opacity = isHovered ? 0.25 : 0.12;
    });

    checkHover();
    updateLabels();
    updateTooltip();

    renderer.render(scene, camera);
}

// ============================================================
// Events
// ============================================================

function setupEvents() {
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    document.addEventListener('mousemove', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        mouseClient.x = e.clientX;
        mouseClient.y = e.clientY;
    });

    document.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        mouseClient.x = touch.clientX;
        mouseClient.y = touch.clientY;
    });
}

// ============================================================
// Intro
// ============================================================

function playIntro() {
    setTimeout(() => {
        document.getElementById('quote').classList.add('visible');
    }, 500);

    setTimeout(() => {
        document.getElementById('legend').classList.add('visible');
        // Show scene labels
        document.getElementById('labelObservable')?.classList.add('visible');
        document.getElementById('labelUnobservable')?.classList.add('visible');
    }, 1000);

    setTimeout(() => {
        document.getElementById('footerQuote').classList.add('visible');
    }, 1500);

    setTimeout(() => {
        document.getElementById('controlsHint').classList.add('visible');
    }, 2500);

    // Camera animation - zoom in from further corner
    if (typeof gsap !== 'undefined') {
        const startPos = { x: 20, y: 18, z: 22 };
        camera.position.set(startPos.x, startPos.y, startPos.z);

        gsap.to(camera.position, {
            x: 12,
            y: 12,
            z: 14,
            duration: 2.5,
            ease: 'power2.out',
            onUpdate: () => {
                if (controls) {
                    controls.update();
                }
            }
        });
    }
}

// ============================================================
// Start
// ============================================================

window.addEventListener('DOMContentLoaded', init);
