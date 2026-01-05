// ============================================================
// THE COST OF SPEED - Organizational Pace Layers
// Flat dark circles with subtle white glow for depth
// Simple radar concentric circles
// ============================================================

const CONFIG = {
    // Glow colors for each layer (muted for soft glow effect)
    colors: {
        capability: { r: 94, g: 170, b: 141 },    // Sage green
        productivity: { r: 184, g: 131, b: 155 }, // Dusty rose
        expertise: { r: 122, g: 156, b: 184 },    // Steel blue
        governance: { r: 201, g: 168, b: 88 },    // Antique gold
        profession: { r: 150, g: 131, b: 176 },   // Muted purple
        purpose: { r: 196, g: 133, b: 86 },       // Terracotta
    },

    // Vivid text colors for readability (brighter versions)
    textColors: {
        capability: '#6BE8B8',    // Bright sage green
        productivity: '#E89BBF',  // Bright rose
        expertise: '#8BC4F0',     // Bright steel blue
        governance: '#F0D264',    // Bright gold
        profession: '#C4A8E8',    // Bright purple
        purpose: '#F0A86B',       // Bright terracotta
    },

    layers: [
        {
            id: 'capability',
            name: 'Capability',
            speed: 'Days',
            description: 'What the organization can do right now. Tools, features, immediate capacity.',
            quote: '"The tools change weekly. The skills to evaluate them don\'t."',
            quoteCite: 'Design Lead, Fortune 500',
            radius: 4.8,
            rotationSpeed: 0.8,
        },
        {
            id: 'productivity',
            name: 'Productivity',
            speed: 'Weeks',
            description: 'How efficiently work gets done. Workflows, processes, team velocity.',
            quote: '"We\'re 3x faster at producing. We\'re not 3x better at knowing what to produce."',
            quoteCite: 'Product Manager',
            radius: 4.0,
            rotationSpeed: 0.5,
        },
        {
            id: 'expertise',
            name: 'Expertise',
            speed: 'Months',
            description: 'Deep domain knowledge and judgment. The ability to recognize when AI is wrong.',
            quote: '"It\'s like going to the gym... Eventually our own brains, they atrophy."',
            quoteCite: 'Kathleen Brandenburg',
            radius: 3.2,
            rotationSpeed: 0.25,
        },
        {
            id: 'governance',
            name: 'Governance',
            speed: 'Years',
            description: 'Rules, policies, and oversight structures. How decisions get made and reviewed.',
            quote: '"Our review processes were designed for human error rates."',
            quoteCite: 'Legal Counsel',
            radius: 2.4,
            rotationSpeed: 0.12,
        },
        {
            id: 'profession',
            name: 'Profession',
            speed: 'Decades',
            description: 'Professional identity and community standards. What it means to be good at this work.',
            quote: '"Twenty years to build a reputation. One viral AI mistake to question it."',
            quoteCite: 'Senior Partner',
            radius: 1.6,
            rotationSpeed: 0.05,
        },
        {
            id: 'purpose',
            name: 'Purpose',
            speed: 'Evolutionary',
            description: 'Why the organization exists. Core values and mission. The slowest layer.',
            quote: '"We forgot to ask why we were automating."',
            quoteCite: 'CEO, post-mortem',
            radius: 0.8,
            rotationSpeed: 0.015,
        }
    ],

    strains: [
        { name: 'Skill Strain', between: ['capability', 'productivity'] },
        { name: 'Quality Strain', between: ['productivity', 'expertise'] },
        { name: 'Trust Strain', between: ['expertise', 'governance'] },
        { name: 'Ethics Strain', between: ['governance', 'profession'] },
        { name: 'Identity Strain', between: ['profession', 'purpose'] },
    ]
};

let scene, camera, renderer, controls;
let diskGroups = [];
let labelElements = [];
let focusedLayerIndex = -1;
let hoveredLayerIndex = -1;
let time = 0;

const canvas = document.getElementById('canvas');
const quote = document.getElementById('quote');
const legend = document.getElementById('legend');
const controlsHint = document.getElementById('controlsHint');
const detailPanel = document.getElementById('detailPanel');
const closePanel = document.getElementById('closePanel');

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0c10);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 7, 9);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 18;
    controls.maxPolarAngle = Math.PI * 0.55;
    controls.minPolarAngle = Math.PI * 0.2;

    createDisks();
    createLabels();

    window.addEventListener('resize', onWindowResize);
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('mousemove', onCanvasHover);
    closePanel.addEventListener('click', exitFocus);

    setTimeout(() => {
        quote.classList.add('visible');
        legend.classList.add('visible');
        controlsHint.classList.add('visible');
        document.getElementById('debtIndicator').classList.add('visible');
        labelElements.forEach(el => el.classList.add('visible'));
    }, 500);

    animate();
}

// ============================================================
// CREATE DISKS - Flat dark circles with rotating colored glow
// Glow is masked within each ring's boundaries
// ============================================================

function createDisks() {
    const layerCount = CONFIG.layers.length;

    CONFIG.layers.forEach((layer, index) => {
        const group = new THREE.Group();
        group.rotation.x = -Math.PI / 2;
        group.userData = { layer, index };

        // Calculate ring boundaries - visible area between this disk and next inner disk
        const outerRadius = layer.radius;
        const innerRadius = index < layerCount - 1 ? CONFIG.layers[index + 1].radius : 0;
        const labelRadius = (outerRadius + innerRadius) / 2; // Midpoint of visible ring

        // Store labelRadius for use in updateLabels
        layer.labelRadius = labelRadius;

        // Dark filled disk - slightly different shades for depth
        const diskGeometry = new THREE.CircleGeometry(layer.radius, 128);
        const darkness = 0.055 + (index * 0.008);
        const diskMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(darkness, darkness, darkness + 0.005),
            side: THREE.DoubleSide
        });

        const disk = new THREE.Mesh(diskGeometry, diskMaterial);
        group.add(disk);

        // Subtle white edge for depth - thin line at perimeter
        const edgeGeometry = new THREE.RingGeometry(layer.radius - 0.02, layer.radius + 0.02, 128);
        const edgeMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.06,
            side: THREE.DoubleSide
        });

        const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
        edge.position.z = 0.005;
        group.add(edge);

        // Colored glow - comet tail effect masked within ring boundaries
        const color = CONFIG.colors[layer.id];
        const glowColor = new THREE.Color(`rgb(${color.r}, ${color.g}, ${color.b})`);

        // Ring geometry that exactly matches this layer's visible area
        // Higher segment count for smooth comet tail gradient
        const glowGeometry = new THREE.RingGeometry(innerRadius + 0.02, outerRadius - 0.02, 256, 1);

        // Shader creates comet tail effect - intense at head, fading behind
        const glowMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: glowColor },
                opacity: { value: 0.7 }
            },
            vertexShader: `
                varying vec2 vPosition;
                void main() {
                    vPosition = position.xy;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float opacity;
                varying vec2 vPosition;

                #define PI 3.14159265359
                #define TWO_PI 6.28318530718

                void main() {
                    // Calculate angle of this pixel from center
                    float angle = atan(vPosition.y, vPosition.x);

                    // Head is at angle 0 (positive X axis in local space)
                    // For clockwise rotation (viewed from above), tail trails counter-clockwise
                    // Use positive angle so tail extends in counter-clockwise direction (behind clockwise movement)
                    float tailAngle = angle;
                    if (tailAngle < 0.0) tailAngle += TWO_PI;

                    // Normalize to 0-1 range (0 = head, 1 = full circle)
                    float t = tailAngle / TWO_PI;

                    // Comet tail: covers ~70% of circle, 30% is dark gap
                    float tailLength = 0.7;
                    float alpha = 0.0;

                    if (t < tailLength) {
                        // In the tail - intense at head, fading to dark
                        // Use smooth falloff curve for natural comet look
                        float falloff = 1.0 - (t / tailLength);
                        alpha = opacity * falloff * falloff; // Quadratic falloff for softer fade
                    }

                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.z = 0.008; // Slightly above disk
        group.add(glow);

        // Stack - inner disks on top
        group.position.y = index * 0.015;

        scene.add(group);

        diskGroups.push({
            group,
            disk,
            edge,
            glow,
            layer,
            index,
            glowMaterial,
            labelRadius
        });
    });
}

function createLabels() {
    CONFIG.layers.forEach((layer, index) => {
        const labelEl = document.createElement('div');
        labelEl.className = 'layer-label';

        // Get the vivid text color for readability
        const textColor = CONFIG.textColors[layer.id];

        labelEl.innerHTML = `
            <span class="name" style="color: ${textColor}">${layer.name}</span>
            <span class="speed">${layer.speed}</span>
        `;
        labelEl.dataset.index = index;
        document.body.appendChild(labelEl);
        labelElements.push(labelEl);
    });
}

function updateLabels() {
    diskGroups.forEach(({ group, layer, index, labelRadius }) => {
        const labelEl = labelElements[index];
        if (!labelEl) return;

        // Use the calculated labelRadius (midpoint of visible ring)
        // Offset text slightly ahead of the glow head (into the dark area for readability)
        // For clockwise rotation, ahead means negative angle offset
        const textOffset = -0.25; // Radians ahead of glow head (clockwise direction)
        const angle = -group.rotation.z + textOffset;
        const position = new THREE.Vector3(
            Math.cos(angle) * labelRadius,
            group.position.y + 0.05,
            Math.sin(angle) * labelRadius
        );

        const projected = position.clone().project(camera);
        const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;

        labelEl.style.left = `${x}px`;
        labelEl.style.top = `${y}px`;

        if (focusedLayerIndex >= 0) {
            labelEl.classList.toggle('dimmed', index !== focusedLayerIndex);
            labelEl.classList.toggle('hovered', index === focusedLayerIndex);
        } else if (hoveredLayerIndex >= 0) {
            labelEl.classList.remove('dimmed');
            labelEl.classList.toggle('hovered', index === hoveredLayerIndex);
        } else {
            labelEl.classList.remove('hovered', 'dimmed');
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    time += 0.016;

    controls.update();

    // Rotate each disk at its own speed (clockwise when viewed from above)
    diskGroups.forEach(({ group, layer }) => {
        group.rotation.z -= layer.rotationSpeed * 0.008;
    });

    updateLabels();
    renderer.render(scene, camera);
}

function onCanvasClick(event) {
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const disks = diskGroups.map(d => d.disk);
    const intersects = raycaster.intersectObjects(disks);

    if (intersects.length > 0) {
        let clickedIndex = -1;
        let smallestRadius = Infinity;

        for (const intersect of intersects) {
            const idx = intersect.object.parent.userData.index;
            const radius = CONFIG.layers[idx].radius;
            if (radius < smallestRadius) {
                smallestRadius = radius;
                clickedIndex = idx;
            }
        }

        if (clickedIndex >= 0) focusOnLayer(clickedIndex);
    } else if (focusedLayerIndex >= 0) {
        exitFocus();
    }
}

function onCanvasHover(event) {
    if (focusedLayerIndex >= 0) return;

    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const disks = diskGroups.map(d => d.disk);
    const intersects = raycaster.intersectObjects(disks);

    if (intersects.length > 0) {
        let newHoveredIndex = -1;
        let smallestRadius = Infinity;

        for (const intersect of intersects) {
            const idx = intersect.object.parent.userData.index;
            const radius = CONFIG.layers[idx].radius;
            if (radius < smallestRadius) {
                smallestRadius = radius;
                newHoveredIndex = idx;
            }
        }

        if (newHoveredIndex !== hoveredLayerIndex) {
            hoveredLayerIndex = newHoveredIndex;
            canvas.style.cursor = 'pointer';
            highlightLayer(hoveredLayerIndex);
        }
    } else if (hoveredLayerIndex >= 0) {
        hoveredLayerIndex = -1;
        canvas.style.cursor = 'default';
        resetHighlight();
    }
}

function highlightLayer(index) {
    diskGroups.forEach(({ edge }, i) => {
        gsap.to(edge.material, { opacity: i === index ? 0.25 : 0.05, duration: 0.3 });
    });
}

function resetHighlight() {
    diskGroups.forEach(({ edge }) => {
        gsap.to(edge.material, { opacity: 0.08, duration: 0.3 });
    });
}

function focusOnLayer(index) {
    focusedLayerIndex = index;
    const layer = CONFIG.layers[index];
    const textColor = CONFIG.textColors[layer.id];
    const glowColor = CONFIG.colors[layer.id];

    // Set panel content
    const panelTitle = document.getElementById('panelTitle');
    panelTitle.textContent = layer.name;
    panelTitle.style.color = textColor;

    document.getElementById('panelSpeed').textContent = `Pace: ${layer.speed}`;
    document.getElementById('panelDescription').textContent = layer.description;
    document.getElementById('panelQuoteText').textContent = layer.quote;
    document.getElementById('panelQuoteCite').textContent = `— ${layer.quoteCite}`;

    // Apply layer color to panel border and quote accent
    const panelQuote = document.getElementById('panelQuote');
    panelQuote.style.borderLeftColor = textColor;
    detailPanel.style.borderColor = `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, 0.4)`;

    detailPanel.classList.add('visible');
    document.body.classList.add('layer-focused');

    diskGroups.forEach(({ edge }, i) => {
        gsap.to(edge.material, { opacity: i === index ? 0.4 : 0.02, duration: 0.4 });
    });
}

function exitFocus() {
    focusedLayerIndex = -1;
    detailPanel.classList.remove('visible');
    document.body.classList.remove('layer-focused');

    diskGroups.forEach(({ edge }) => {
        gsap.to(edge.material, { opacity: 0.08, duration: 0.4 });
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
