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

    unobservables: [
        { id: 'intuition', symbol: '◎', title: 'Intuition',
          description: 'Knowing something is wrong before you can articulate why.',
          position: { x: 4, z: -2 } },
        { id: 'presence', symbol: '◈', title: 'Physical Presence',
          description: 'The weight of a handshake, the tension in a room.',
          position: { x: 5.5, z: 1 } },
        { id: 'room', symbol: '◇', title: 'Reading the Room',
          description: 'The collective mood. Energy that shifts without anyone speaking.',
          position: { x: 6, z: -1.5 } },
        { id: 'trust', symbol: '∞', title: 'Relationship Capital',
          description: 'Trust built through years.',
          position: { x: 4.5, z: 2 } },
        { id: 'memory', symbol: '⌘', title: 'Institutional Memory',
          description: 'How things actually work, beyond the org chart.',
          position: { x: 7, z: 0 } },
        { id: 'context', symbol: '⟡', title: 'Contextual Meaning',
          description: 'Understanding what "fine" really means.',
          position: { x: 5, z: -3 } },
        { id: 'timing', symbol: '◐', title: 'Timing & Rhythm',
          description: 'Knowing when to push and when to wait.',
          position: { x: 6.5, z: 2.5 } },
        { id: 'silence', symbol: '○', title: "What's Not Said",
          description: 'The pause that speaks volumes.',
          position: { x: 8, z: -2 } },
    ],
};

// ============================================================
// Global variables
// ============================================================

let scene, camera, renderer;
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
        scene.fog = new THREE.Fog(CONFIG.colors.bg, 10, 25);
        console.log('Scene created');

        // Camera - 3rd person view (good for embedding)
        const aspect = window.innerWidth / window.innerHeight;
        camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
        camera.position.set(2, 12, 12);
        camera.lookAt(2, 0, 0);
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

        // Lights
        const ambient = new THREE.AmbientLight(0x404050, 0.5);
        scene.add(ambient);

        // Create scene elements
        createGround();
        createStreetLamp();
        createAIFigure();
        createHumanFigure();
        createUnobservables();

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

    // Grid
    const grid = new THREE.GridHelper(30, 60, 0x2a2a34, 0x1f1f28);
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

    // Spot light
    const spotLight = new THREE.SpotLight(CONFIG.colors.lampGlow, 2);
    spotLight.position.set(1, 3.3, 0);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.5;
    spotLight.decay = 1.5;
    spotLight.distance = 15;
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
    const coneGeom = new THREE.ConeGeometry(3, 3.5, 32, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
        color: CONFIG.colors.lampGlow,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    lightCone = new THREE.Mesh(coneGeom, coneMat);
    lightCone.position.set(-2, 1.75, 0);
    lightCone.rotation.z = Math.PI;
    scene.add(lightCone);

    // Ground circle
    const circleGeom = new THREE.CircleGeometry(3, 32);
    const circleMat = new THREE.MeshBasicMaterial({
        color: CONFIG.colors.lampGlow,
        transparent: true,
        opacity: 0.1,
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
        roughness: 0.3,
        metalness: 0.7,
        emissive: CONFIG.colors.ai,
        emissiveIntensity: 0.2,
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
        roughness: 0.6,
        metalness: 0.1,
        emissive: CONFIG.colors.human,
        emissiveIntensity: 0.1,
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

    // Perception glow sphere
    const glowGeom = new THREE.SphereGeometry(2.5, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
        color: CONFIG.colors.human,
        transparent: true,
        opacity: 0.03,
        side: THREE.BackSide,
    });
    humanGlow = new THREE.Mesh(glowGeom, glowMat);
    humanGlow.position.y = 0.8;
    humanGlow.position.x = 1;
    humanGroup.add(humanGlow);

    humanGroup.position.set(1, 0, 0);
    humanGroup.rotation.y = -Math.PI / 6;
    scene.add(humanGroup);

    // Label
    createLabel('Human', new THREE.Vector3(1, 2.2, 0), '#34d399');

    console.log('Human figure created');
}

// ============================================================
// Unobservables
// ============================================================

function createUnobservables() {
    CONFIG.unobservables.forEach((u, i) => {
        const group = new THREE.Group();

        // Orb
        const orbGeom = new THREE.SphereGeometry(0.25, 16, 16);
        const orbMat = new THREE.MeshStandardMaterial({
            color: CONFIG.colors.unobservable,
            emissive: CONFIG.colors.unobservable,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.8,
        });
        const orb = new THREE.Mesh(orbGeom, orbMat);
        group.add(orb);

        // Glow
        const glowGeom = new THREE.SphereGeometry(0.5, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({
            color: CONFIG.colors.unobservable,
            transparent: true,
            opacity: 0.12,
        });
        const glow = new THREE.Mesh(glowGeom, glowMat);
        group.add(glow);

        // Position
        const baseY = 1.2 + i * 0.08;
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
            pos.y += 0.8;
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

    // Animate unobservables
    unobservableObjects.forEach((group, i) => {
        const baseY = group.userData.baseY;
        group.position.y = baseY + Math.sin(time * 0.7 + i * 0.5) * 0.15;
        group.rotation.y = time * 0.3 + i;

        const isHovered = hoveredUnobservable === group.userData.unobservable.id;
        const targetScale = isHovered ? 1.4 : 1.0;
        const currentScale = group.scale.x;
        const newScale = currentScale + (targetScale - currentScale) * 0.1;
        group.scale.setScalar(newScale);

        const orb = group.children[0];
        orb.material.emissiveIntensity = isHovered ? 0.9 : 0.5;
        orb.material.opacity = isHovered ? 1.0 : 0.8;
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
    }, 1000);

    setTimeout(() => {
        document.getElementById('footerQuote').classList.add('visible');
    }, 1500);

    // Camera animation
    if (typeof gsap !== 'undefined') {
        gsap.from(camera.position, {
            x: 2,
            y: 18,
            z: 18,
            duration: 2,
            ease: 'power2.out',
        });
    }
}

// ============================================================
// Start
// ============================================================

window.addEventListener('DOMContentLoaded', init);
