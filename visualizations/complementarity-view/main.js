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
// Performance & Embed Mode Detection
// ============================================================

const PerformanceMode = {
    isLowFi: false,
    isEmbed: false,

    // Detect performance capabilities and embed context
    detect() {
        // Check for embed mode via URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        this.isEmbed = urlParams.get('embed') === 'true';

        // Check for low-performance device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const hasLowCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
        const hasLowMemory = navigator.deviceMemory && navigator.deviceMemory <= 2;

        this.isLowFi = isMobile || hasLowCores || hasLowMemory;

        // Also check URL parameter override
        if (urlParams.get('lowfi') === 'true') this.isLowFi = true;
        if (urlParams.get('lowfi') === 'false') this.isLowFi = false;

        console.log('Performance mode:', this.isLowFi ? 'Low-Fi' : 'Full');
        console.log('Embed mode:', this.isEmbed);

        return { isLowFi: this.isLowFi, isEmbed: this.isEmbed };
    },

    // Apply performance optimizations
    apply() {
        if (this.isLowFi) {
            // Disable shadows
            if (renderer) {
                renderer.shadowMap.enabled = false;
            }

            // Hide dust particles
            if (dustParticles) {
                dustParticles.visible = false;
            }

            // Simplify animations in animate loop (handled by checking isLowFi)
        }

        if (this.isEmbed) {
            // Hide UI elements for embedded view
            document.querySelector('.header')?.classList.add('hidden');
            document.querySelector('.legend')?.classList.add('hidden');
            document.querySelector('.controls-hint')?.classList.add('hidden');
            document.querySelector('.footer-quote')?.classList.add('hidden');
            document.querySelector('.view-mode-toggle')?.classList.add('hidden');
            document.querySelector('.audio-btn')?.classList.add('hidden');

            // Show minimal embed controls instead
            this.createEmbedControls();
        }
    },

    createEmbedControls() {
        const controls = document.createElement('div');
        controls.className = 'embed-controls';
        controls.innerHTML = `
            <button class="embed-btn" onclick="transitionToPreset('overview')" title="Reset view">⟲</button>
            <button class="embed-btn" onclick="document.documentElement.requestFullscreen()" title="Fullscreen">⛶</button>
        `;
        document.body.appendChild(controls);
    }
};

// ============================================================
// Audio Manager
// ============================================================

const AudioManager = {
    context: null,
    masterGain: null,
    ambientNodes: [],
    lfoNode: null,
    enabled: false,
    initialized: false,

    // Initialize audio context (must be called after user interaction)
    init() {
        if (this.initialized) return;

        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.context.createGain();
            this.masterGain.gain.value = 0;
            this.masterGain.connect(this.context.destination);
            this.initialized = true;
            console.log('Audio Manager initialized');
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    },

    // Toggle ambient soundscape
    toggleAmbient() {
        if (!this.initialized) this.init();
        if (!this.context) return;

        this.enabled = !this.enabled;

        if (this.enabled) {
            // Resume context if suspended
            if (this.context.state === 'suspended') {
                this.context.resume();
            }

            // Create ambient soundscape
            this.createAmbientSoundscape();

            // Fade in
            this.masterGain.gain.cancelScheduledValues(this.context.currentTime);
            this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.context.currentTime);
            this.masterGain.gain.linearRampToValueAtTime(0.12, this.context.currentTime + 2);
        } else {
            // Fade out
            this.masterGain.gain.cancelScheduledValues(this.context.currentTime);
            this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.context.currentTime);
            this.masterGain.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.5);

            // Stop all nodes after fade
            setTimeout(() => {
                this.stopAmbientSoundscape();
            }, 600);
        }

        // Update UI
        const btn = document.getElementById('audioToggle');
        if (btn) {
            btn.classList.toggle('audio-btn--active', this.enabled);
            btn.querySelector('.audio-btn__label').textContent = this.enabled ? 'Sound On' : 'Sound Off';
        }
    },

    createAmbientSoundscape() {
        if (this.ambientNodes.length > 0) return; // Already playing

        // Create a rich, evolving ambient pad with multiple layers

        // Layer 1: Deep drone with slight movement
        const droneFrequencies = [55, 82.5, 110]; // A1, E2, A2 - perfect fifth harmony
        droneFrequencies.forEach((freq, i) => {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();
            const filter = this.context.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.value = freq;
            osc.detune.value = Math.random() * 8 - 4;

            // Low-pass filter for warmth
            filter.type = 'lowpass';
            filter.frequency.value = 400 + i * 100;
            filter.Q.value = 1;

            gain.gain.value = 0.15 / (i + 1);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            osc.start();

            this.ambientNodes.push({ node: osc, gain, filter });
        });

        // Layer 2: Ethereal high harmonics with tremolo
        const highFrequencies = [440, 659.25, 880]; // A4, E5, A5
        highFrequencies.forEach((freq, i) => {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();
            const filter = this.context.createBiquadFilter();
            const tremolo = this.context.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;
            osc.detune.value = Math.random() * 15 - 7.5;

            // High-pass filter for airiness
            filter.type = 'highpass';
            filter.frequency.value = 200;

            // Very quiet
            gain.gain.value = 0.02 / (i + 1);

            // Create LFO for tremolo
            const lfo = this.context.createOscillator();
            const lfoGain = this.context.createGain();
            lfo.type = 'sine';
            lfo.frequency.value = 0.1 + i * 0.05; // Slow modulation
            lfoGain.gain.value = 0.5;
            lfo.connect(lfoGain);
            lfoGain.connect(tremolo.gain);
            tremolo.gain.value = 0.5;
            lfo.start();

            osc.connect(filter);
            filter.connect(tremolo);
            tremolo.connect(gain);
            gain.connect(this.masterGain);
            osc.start();

            this.ambientNodes.push({ node: osc, gain, filter, lfo });
        });

        // Layer 3: Subtle noise texture (filtered pink noise simulation)
        this.createNoiseLayer();
    },

    createNoiseLayer() {
        // Create filtered noise for texture
        const bufferSize = 2 * this.context.sampleRate;
        const noiseBuffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        // Generate pink-ish noise
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
            output[i] *= 0.11;
            b6 = white * 0.115926;
        }

        const noiseSource = this.context.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        const noiseFilter = this.context.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 800;
        noiseFilter.Q.value = 0.5;

        const noiseGain = this.context.createGain();
        noiseGain.gain.value = 0.015;

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noiseSource.start();

        this.ambientNodes.push({ node: noiseSource, gain: noiseGain, filter: noiseFilter });
    },

    stopAmbientSoundscape() {
        this.ambientNodes.forEach(({ node, gain, filter, lfo }) => {
            try {
                node.stop();
                node.disconnect();
                gain?.disconnect();
                filter?.disconnect();
                lfo?.stop();
                lfo?.disconnect();
            } catch (e) {}
        });
        this.ambientNodes = [];
    },

    // Play hover sound for an orb
    playHoverSound(orbIndex) {
        if (!this.enabled || !this.context) return;

        // Create a short ethereal tone with harmonics
        const baseFreq = 220 + orbIndex * 40;

        // Main tone
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        const filter = this.context.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.value = baseFreq;

        // Soft filter
        filter.type = 'lowpass';
        filter.frequency.value = 2000;

        // Envelope
        gain.gain.value = 0;
        gain.gain.setValueAtTime(0, this.context.currentTime);
        gain.gain.linearRampToValueAtTime(0.06, this.context.currentTime + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.6);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.context.currentTime + 0.6);

        // Add subtle harmonic
        const osc2 = this.context.createOscillator();
        const gain2 = this.context.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = baseFreq * 2;
        gain2.gain.value = 0;
        gain2.gain.setValueAtTime(0, this.context.currentTime);
        gain2.gain.linearRampToValueAtTime(0.02, this.context.currentTime + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.4);
        osc2.connect(gain2);
        gain2.connect(this.masterGain);
        osc2.start();
        osc2.stop(this.context.currentTime + 0.4);
    },

    // Play focus/zoom-in sound
    playFocusSound() {
        if (!this.enabled || !this.context) return;

        // Rising ethereal sweep
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        const filter = this.context.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, this.context.currentTime + 0.8);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, this.context.currentTime);
        filter.frequency.exponentialRampToValueAtTime(1500, this.context.currentTime + 0.8);

        gain.gain.value = 0;
        gain.gain.setValueAtTime(0, this.context.currentTime);
        gain.gain.linearRampToValueAtTime(0.08, this.context.currentTime + 0.15);
        gain.gain.linearRampToValueAtTime(0.05, this.context.currentTime + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 1.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.context.currentTime + 1.2);

        // Add shimmering harmonic
        const osc2 = this.context.createOscillator();
        const gain2 = this.context.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(300, this.context.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(800, this.context.currentTime + 0.8);
        gain2.gain.value = 0;
        gain2.gain.setValueAtTime(0, this.context.currentTime + 0.1);
        gain2.gain.linearRampToValueAtTime(0.03, this.context.currentTime + 0.3);
        gain2.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 1.0);
        osc2.connect(gain2);
        gain2.connect(this.masterGain);
        osc2.start();
        osc2.stop(this.context.currentTime + 1.0);
    }
};

// ============================================================
// State Manager
// ============================================================

const StateManager = {
    // View mode: 'normal' | 'ai-view' | 'human-view'
    mode: 'normal',

    // Currently focused unobservable (null or orb id)
    focusedOrb: null,

    // Camera state
    currentPreset: 'overview',
    idleTime: 0,
    isAutoOrbit: false,

    // Audio
    audioEnabled: false,

    // Detail level: 'full' | 'reduced'
    detailLevel: 'full',

    // Interaction state
    lastInteractionTime: Date.now(),

    // Listeners for state changes
    listeners: [],

    // Subscribe to state changes
    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    },

    // Notify all listeners
    notify(key, value) {
        this.listeners.forEach(callback => callback(key, value));
    },

    // Set mode with notification
    setMode(mode) {
        if (this.mode !== mode) {
            this.mode = mode;
            this.notify('mode', mode);
        }
    },

    // Set focused orb with notification
    setFocusedOrb(orbId) {
        if (this.focusedOrb !== orbId) {
            this.focusedOrb = orbId;
            this.notify('focusedOrb', orbId);
        }
    },

    // Record user interaction (resets idle timer)
    recordInteraction() {
        this.lastInteractionTime = Date.now();
        if (this.isAutoOrbit) {
            this.isAutoOrbit = false;
            this.notify('isAutoOrbit', false);
        }
    },

    // Check if idle (no interaction for specified ms)
    isIdle(thresholdMs = 30000) {
        return Date.now() - this.lastInteractionTime > thresholdMs;
    },

    // Set camera preset
    setPreset(presetName) {
        if (this.currentPreset !== presetName) {
            this.currentPreset = presetName;
            this.notify('currentPreset', presetName);
        }
    }
};

// ============================================================
// Camera Presets
// ============================================================

const CAMERA_PRESETS = {
    overview: {
        position: { x: 12, y: 12, z: 14 },
        target: { x: 2, y: 0, z: 0 }
    },
    ai: {
        position: { x: -5, y: 8, z: 5 },
        target: { x: -2, y: 1, z: 0 }
    },
    human: {
        position: { x: 8, y: 6, z: 8 },
        target: { x: 3, y: 0.5, z: 0 }
    }
};

// ============================================================
// View Mode System
// ============================================================

function setViewMode(mode) {
    StateManager.setMode(mode);
    StateManager.recordInteraction();

    // Update button states
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('view-btn--active');
    });

    if (mode === 'normal') {
        document.getElementById('viewNormal')?.classList.add('view-btn--active');
        transitionToPreset('overview', 1.5);
    } else if (mode === 'ai-view') {
        document.getElementById('viewAI')?.classList.add('view-btn--active');
        transitionToPreset('ai', 1.5);
    } else if (mode === 'human-view') {
        document.getElementById('viewHuman')?.classList.add('view-btn--active');
        transitionToPreset('human', 1.5);
    }

    // Apply visual changes based on mode
    applyViewMode(mode);
}

function applyViewMode(mode) {
    if (typeof gsap === 'undefined') return;

    // Phase 1: ALL transitions go dark first (like AI view)
    // This happens during camera movement
    if (scene.fog) {
        gsap.to(scene.fog, { near: 8, far: 20, duration: 0.5 });
    }
    if (lightCone) {
        gsap.to(lightCone.material, { opacity: 0.25, duration: 0.5 });
    }
    // Shrink orbs during transition
    unobservableObjects.forEach(group => {
        gsap.to(group.scale, { x: 0, y: 0, z: 0, duration: 0.4, ease: 'power2.in' });
    });
    document.querySelectorAll('.unobservable-label').forEach(el => {
        el.style.opacity = '0';
    });

    // Phase 2: After dark transition, apply target state
    // Timed to happen as camera arrives
    setTimeout(() => {
        switch(mode) {
            case 'ai-view':
                // Stay dark - AI can't see unobservables
                document.getElementById('labelUnobservable')?.classList.remove('visible');
                break;

            case 'human-view':
                // Reveal expanded perception
                unobservableObjects.forEach((group, i) => {
                    gsap.to(group.scale, {
                        x: 1.2, y: 1.2, z: 1.2,
                        duration: 0.6,
                        delay: i * 0.05,
                        ease: 'back.out(1.5)'
                    });
                });
                document.querySelectorAll('.unobservable-label').forEach(el => {
                    el.style.opacity = '1';
                });
                if (lightCone) {
                    gsap.to(lightCone.material, { opacity: 0.08, duration: 0.6 });
                }
                if (scene.fog) {
                    gsap.to(scene.fog, { near: 20, far: 50, duration: 0.8 });
                }
                document.getElementById('labelUnobservable')?.classList.add('visible');
                break;

            case 'normal':
            default:
                // Restore normal balanced view
                unobservableObjects.forEach((group, i) => {
                    gsap.to(group.scale, {
                        x: 1, y: 1, z: 1,
                        duration: 0.5,
                        delay: i * 0.03,
                        ease: 'power2.out'
                    });
                });
                document.querySelectorAll('.unobservable-label').forEach(el => {
                    el.style.opacity = '';
                });
                if (lightCone) {
                    gsap.to(lightCone.material, { opacity: 0.15, duration: 0.6 });
                }
                if (scene.fog) {
                    gsap.to(scene.fog, { near: 15, far: 40, duration: 0.8 });
                }
                document.getElementById('labelUnobservable')?.classList.add('visible');
                break;
        }
    }, 700); // Delay matches camera transition midpoint
}

// ============================================================
// Camera Transitions
// ============================================================

function transitionToPreset(presetName, duration = 1.5) {
    const preset = CAMERA_PRESETS[presetName];
    if (!preset || typeof gsap === 'undefined') return;

    StateManager.setPreset(presetName);
    StateManager.recordInteraction();

    gsap.to(camera.position, {
        x: preset.position.x,
        y: preset.position.y,
        z: preset.position.z,
        duration: duration,
        ease: 'power2.inOut',
        onUpdate: () => {
            if (controls) controls.update();
        }
    });

    gsap.to(controls.target, {
        x: preset.target.x,
        y: preset.target.y,
        z: preset.target.z,
        duration: duration,
        ease: 'power2.inOut'
    });
}

function transitionToPosition(position, target, duration = 1.2) {
    if (typeof gsap === 'undefined') return;

    StateManager.recordInteraction();

    gsap.to(camera.position, {
        x: position.x,
        y: position.y,
        z: position.z,
        duration: duration,
        ease: 'power2.inOut',
        onUpdate: () => {
            if (controls) controls.update();
        }
    });

    gsap.to(controls.target, {
        x: target.x,
        y: target.y,
        z: target.z,
        duration: duration,
        ease: 'power2.inOut'
    });
}

// ============================================================
// Focus System
// ============================================================

function focusOnOrb(orbId) {
    const orbData = CONFIG.unobservables.find(u => u.id === orbId);
    const orbObject = unobservableObjects.find(g => g.userData.unobservable.id === orbId);

    if (!orbData || !orbObject) return;

    StateManager.setFocusedOrb(orbId);

    // Play focus sound
    AudioManager.playFocusSound();

    // Calculate camera position for focus (offset from orb)
    const orbPos = orbObject.position;
    const focusPosition = {
        x: orbPos.x + 3,
        y: orbPos.y + 4,
        z: orbPos.z + 4
    };
    const focusTarget = {
        x: orbPos.x,
        y: orbPos.y + 0.5,
        z: orbPos.z
    };

    transitionToPosition(focusPosition, focusTarget, 1.0);

    // Show detail panel
    showDetailPanel(orbData);

    // Dim other elements
    setSceneDimming(true, orbId);
}

function exitFocus() {
    if (!StateManager.focusedOrb) return;

    StateManager.setFocusedOrb(null);

    // Return to overview
    transitionToPreset('overview', 1.0);

    // Hide detail panel
    hideDetailPanel();

    // Restore scene
    setSceneDimming(false, null);
}

function setSceneDimming(dimmed, exceptOrbId) {
    const dimOpacity = 0.3;
    const normalOpacity = 1.0;

    // Dim/restore unobservable orbs
    unobservableObjects.forEach(group => {
        const isException = group.userData.unobservable.id === exceptOrbId;
        const targetOpacity = dimmed && !isException ? dimOpacity : normalOpacity;

        group.children.forEach(child => {
            if (child.material && child.material.opacity !== undefined) {
                gsap.to(child.material, {
                    opacity: targetOpacity * (child.userData?.baseOpacity || child.material.opacity),
                    duration: 0.5
                });
            }
        });
    });

    // Dim light cone when focused
    if (lightCone && lightCone.material) {
        gsap.to(lightCone.material, {
            opacity: dimmed ? 0.03 : 0.15,
            duration: 0.5
        });
    }
}

function showDetailPanel(orbData) {
    const panel = document.getElementById('detailPanel');
    const title = document.getElementById('detailTitle');
    const symbol = document.getElementById('detailSymbol');
    const description = document.getElementById('detailDescription');

    if (!panel) return;

    symbol.textContent = orbData.symbol;
    title.textContent = orbData.title;
    description.textContent = orbData.description;

    panel.classList.add('visible');
}

function hideDetailPanel() {
    const panel = document.getElementById('detailPanel');
    if (panel) {
        panel.classList.remove('visible');
    }
}

// ============================================================
// Connection Lines
// ============================================================

function createConnectionLine(fromPosition, toPosition) {
    // Remove existing line
    removeConnectionLine();

    // Create curved path from orb to human
    const midPoint = new THREE.Vector3(
        (fromPosition.x + toPosition.x) / 2,
        Math.max(fromPosition.y, toPosition.y) + 1,
        (fromPosition.z + toPosition.z) / 2
    );

    const curve = new THREE.QuadraticBezierCurve3(
        fromPosition,
        midPoint,
        toPosition
    );

    const points = curve.getPoints(30);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineDashedMaterial({
        color: CONFIG.colors.unobservable,
        dashSize: 0.15,
        gapSize: 0.1,
        transparent: true,
        opacity: 0.6
    });

    connectionLine = new THREE.Line(geometry, material);
    connectionLine.computeLineDistances();
    scene.add(connectionLine);
}

function removeConnectionLine() {
    if (connectionLine) {
        scene.remove(connectionLine);
        connectionLine.geometry.dispose();
        connectionLine.material.dispose();
        connectionLine = null;
    }
}

function updateConnectionLine() {
    // Show connection line when hovering OR when focused on an orb
    const activeOrb = StateManager.focusedOrb || hoveredUnobservable;

    if (activeOrb) {
        const orbObject = unobservableObjects.find(
            g => g.userData.unobservable.id === activeOrb
        );
        if (orbObject) {
            createConnectionLine(
                orbObject.position.clone(),
                humanFigurePosition.clone()
            );

            // Animate dash offset for flowing effect
            if (connectionLine && connectionLine.material) {
                connectionLine.material.dashOffset -= 0.02;
            }
        }
    } else {
        removeConnectionLine();
    }
}

// ============================================================
// Global variables
// ============================================================

let scene, camera, renderer, controls;
let humanFigurePosition = new THREE.Vector3(2, 0.8, 0); // Human figure center
let connectionLine = null; // For hover connection lines
let time = 0;
let mouse = { x: 0, y: 0 };
let mouseClient = { x: 0, y: 0 };
let hoveredUnobservable = null;
let unobservableObjects = [];
let labelElements = [];
let lightCone, humanGlow, aiEye, humanArm, humanBody;

// ============================================================
// Initialize
// ============================================================

function init() {
    console.log('Initializing Three.js scene...');

    // Detect performance and embed mode
    PerformanceMode.detect();

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
        createConstellationLines();

        // Events
        setupEvents();

        // Apply performance optimizations
        PerformanceMode.apply();

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

    // Create dust particles in light beam
    createDustParticles();
}

// ============================================================
// Dust Particles in Light Beam
// ============================================================

let dustParticles = null;
let dustVelocities = [];

function createDustParticles() {
    const count = 150;
    const positions = new Float32Array(count * 3);
    dustVelocities = [];

    // Light cone parameters: center at (-2, 0, 0), radius 3.5 at ground, height 3.35
    const coneCenter = new THREE.Vector3(-2, 0, 0);
    const coneRadius = 3.5;
    const coneHeight = 3.35;

    for (let i = 0; i < count; i++) {
        // Random position within cone
        const y = Math.random() * coneHeight;
        const radiusAtHeight = coneRadius * (1 - y / coneHeight);
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * radiusAtHeight;

        positions[i * 3] = coneCenter.x + Math.cos(angle) * r;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = coneCenter.z + Math.sin(angle) * r;

        // Random velocity (slow drift upward and sideways)
        dustVelocities.push({
            x: (Math.random() - 0.5) * 0.003,
            y: Math.random() * 0.005 + 0.002,
            z: (Math.random() - 0.5) * 0.003
        });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: CONFIG.colors.lampLight,
        size: 0.03,
        transparent: true,
        opacity: 0.5,
        sizeAttenuation: true,
        depthWrite: false
    });

    dustParticles = new THREE.Points(geometry, material);
    scene.add(dustParticles);

    console.log('Dust particles created');
}

function updateDustParticles() {
    if (!dustParticles) return;

    const positions = dustParticles.geometry.attributes.position.array;
    const coneCenter = new THREE.Vector3(-2, 0, 0);
    const coneRadius = 3.5;
    const coneHeight = 3.35;

    for (let i = 0; i < dustVelocities.length; i++) {
        const vel = dustVelocities[i];

        // Update position
        positions[i * 3] += vel.x;
        positions[i * 3 + 1] += vel.y;
        positions[i * 3 + 2] += vel.z;

        const y = positions[i * 3 + 1];

        // Reset if particle goes above cone or outside bounds
        if (y > coneHeight) {
            // Respawn at bottom
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * coneRadius;
            positions[i * 3] = coneCenter.x + Math.cos(angle) * r;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = coneCenter.z + Math.sin(angle) * r;

            // New velocity
            vel.x = (Math.random() - 0.5) * 0.003;
            vel.y = Math.random() * 0.005 + 0.002;
            vel.z = (Math.random() - 0.5) * 0.003;
        }
    }

    dustParticles.geometry.attributes.position.needsUpdate = true;
}

// ============================================================
// Constellation Mode (lines connecting orbs when zoomed out)
// ============================================================

let constellationLines = null;

function createConstellationLines() {
    // Define connections between orbs (pairs of indices)
    const connections = [
        [0, 2], [2, 5], [5, 7], // Main arc
        [1, 3], [3, 4], [4, 6], // Secondary arc
        [0, 1], [2, 3], [5, 6], // Cross connections
    ];

    const points = [];
    connections.forEach(([a, b]) => {
        if (unobservableObjects[a] && unobservableObjects[b]) {
            points.push(unobservableObjects[a].position.clone());
            points.push(unobservableObjects[b].position.clone());
        }
    });

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color: CONFIG.colors.unobservable,
        transparent: true,
        opacity: 0,
        depthWrite: false
    });

    constellationLines = new THREE.LineSegments(geometry, material);
    scene.add(constellationLines);
}

function updateConstellationLines() {
    if (!constellationLines || !camera) return;

    // Calculate camera distance from scene center
    const sceneCenter = new THREE.Vector3(2, 0, 0);
    const distance = camera.position.distanceTo(sceneCenter);

    // Show constellation when zoomed out (distance > 20)
    const fadeStart = 18;
    const fadeEnd = 25;

    let targetOpacity = 0;
    if (distance > fadeStart) {
        targetOpacity = Math.min((distance - fadeStart) / (fadeEnd - fadeStart), 0.3);
    }

    // Smooth transition
    const currentOpacity = constellationLines.material.opacity;
    constellationLines.material.opacity = currentOpacity + (targetOpacity - currentOpacity) * 0.05;

    // Update line positions based on orb positions
    const positions = constellationLines.geometry.attributes.position.array;
    const connections = [
        [0, 2], [2, 5], [5, 7],
        [1, 3], [3, 4], [4, 6],
        [0, 1], [2, 3], [5, 6],
    ];

    let idx = 0;
    connections.forEach(([a, b]) => {
        if (unobservableObjects[a] && unobservableObjects[b]) {
            const posA = unobservableObjects[a].position;
            const posB = unobservableObjects[b].position;
            positions[idx++] = posA.x;
            positions[idx++] = posA.y;
            positions[idx++] = posA.z;
            positions[idx++] = posB.x;
            positions[idx++] = posB.y;
            positions[idx++] = posB.z;
        }
    });

    constellationLines.geometry.attributes.position.needsUpdate = true;
}

// ============================================================
// Proximity Glow (orbs glow brighter when camera is close)
// ============================================================

function updateProximityGlow() {
    if (!camera || unobservableObjects.length === 0) return;

    unobservableObjects.forEach(group => {
        const distance = camera.position.distanceTo(group.position);

        // Closer = brighter (between 3 and 15 units)
        const minDist = 3;
        const maxDist = 15;
        const normalizedDist = Math.max(0, Math.min(1, (distance - minDist) / (maxDist - minDist)));

        // Inverse: closer = higher intensity
        const glowIntensity = 1 - normalizedDist;

        // Apply to glow sphere (second child)
        const glow = group.children[1];
        if (glow && glow.material) {
            const baseOpacity = 0.12;
            const maxOpacity = 0.35;
            glow.material.opacity = baseOpacity + glowIntensity * (maxOpacity - baseOpacity);
        }
    });
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

    // Create ambient fog/particles around AI (digital haze)
    createAIAmbientFog();

    console.log('AI figure created');
}

// ============================================================
// AI Ambient Fog (particles around AI figure)
// ============================================================

let aiFogParticles = null;
let aiFogVelocities = [];

function createAIAmbientFog() {
    const count = 60;
    const positions = new Float32Array(count * 3);
    aiFogVelocities = [];

    // Particles around AI figure at x=-2
    const center = new THREE.Vector3(-2, 1, 0);
    const radius = 1.5;

    for (let i = 0; i < count; i++) {
        // Random position in a cylinder around AI
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * radius;
        const y = Math.random() * 2.5;

        positions[i * 3] = center.x + Math.cos(angle) * r;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = center.z + Math.sin(angle) * r;

        // Slow circular drift
        aiFogVelocities.push({
            angle: angle,
            radius: r,
            ySpeed: (Math.random() - 0.5) * 0.002,
            angleSpeed: (Math.random() - 0.5) * 0.005
        });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: CONFIG.colors.ai,
        size: 0.04,
        transparent: true,
        opacity: 0.25,
        sizeAttenuation: true,
        depthWrite: false
    });

    aiFogParticles = new THREE.Points(geometry, material);
    scene.add(aiFogParticles);

    console.log('AI ambient fog created');
}

function updateAIFogParticles() {
    if (!aiFogParticles) return;

    const positions = aiFogParticles.geometry.attributes.position.array;
    const center = new THREE.Vector3(-2, 1, 0);

    for (let i = 0; i < aiFogVelocities.length; i++) {
        const vel = aiFogVelocities[i];

        // Update angle for circular motion
        vel.angle += vel.angleSpeed;

        // Update position
        positions[i * 3] = center.x + Math.cos(vel.angle) * vel.radius;
        positions[i * 3 + 1] += vel.ySpeed;
        positions[i * 3 + 2] = center.z + Math.sin(vel.angle) * vel.radius;

        const y = positions[i * 3 + 1];

        // Reset if particle goes too high or low
        if (y > 2.5 || y < 0) {
            vel.ySpeed = -vel.ySpeed;
        }
    }

    aiFogParticles.geometry.attributes.position.needsUpdate = true;
}

// ============================================================
// Human Figure
// ============================================================

// Store reference to human material for heartbeat effect
let humanMaterial = null;

function createHumanFigure() {
    const humanGroup = new THREE.Group();

    humanMaterial = new THREE.MeshStandardMaterial({
        color: CONFIG.colors.human,
        roughness: 0.4,
        metalness: 0.2,
        emissive: CONFIG.colors.human,
        emissiveIntensity: 0.5,
    });

    // Body - use cylinder instead of capsule for compatibility
    const bodyGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.9, 16);
    humanBody = new THREE.Mesh(bodyGeom, humanMaterial);
    humanBody.position.y = 0.65;
    humanBody.castShadow = true;
    humanGroup.add(humanBody);

    // Head
    const headGeom = new THREE.SphereGeometry(0.2, 16, 16);
    const head = new THREE.Mesh(headGeom, humanMaterial);
    head.position.y = 1.35;
    head.castShadow = true;
    humanGroup.add(head);

    // Arms - use cylinders
    const armGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8);

    const leftArm = new THREE.Mesh(armGeom, humanMaterial);
    leftArm.position.set(-0.3, 0.8, 0);
    leftArm.rotation.z = 0.2;
    humanGroup.add(leftArm);

    humanArm = new THREE.Mesh(armGeom, humanMaterial);
    humanArm.position.set(0.35, 1.0, 0);
    humanArm.rotation.z = -1.2;
    humanGroup.add(humanArm);

    // Legs
    const legGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8);
    const leftLeg = new THREE.Mesh(legGeom, humanMaterial);
    leftLeg.position.set(-0.1, 0.2, 0);
    humanGroup.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeom, humanMaterial);
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

// Orb effect configurations
const ORB_EFFECTS = {
    intuition: {
        // Irregular pulsing rhythm
        animate: (group, time) => {
            const pulse = Math.sin(time * 3) * Math.sin(time * 1.7) * 0.15;
            group.children[0].scale.setScalar(1 + pulse);
        }
    },
    presence: {
        // Lower float, slight vibration
        baseYOffset: -0.15,
        animate: (group, time) => {
            group.position.x += Math.sin(time * 15) * 0.002;
            group.position.z += Math.cos(time * 12) * 0.002;
        }
    },
    room: {
        // Orbiting small particles (created in setup)
        setup: (group) => {
            for (let i = 0; i < 3; i++) {
                const particleGeom = new THREE.SphereGeometry(0.02, 8, 8);
                const particleMat = new THREE.MeshBasicMaterial({
                    color: CONFIG.colors.unobservable,
                    transparent: true,
                    opacity: 0.6
                });
                const particle = new THREE.Mesh(particleGeom, particleMat);
                particle.userData.orbitAngle = (i / 3) * Math.PI * 2;
                particle.userData.orbitRadius = 0.25;
                group.add(particle);
            }
        },
        animate: (group, time) => {
            group.children.slice(2).forEach((particle, i) => {
                const angle = particle.userData.orbitAngle + time * 1.5;
                const radius = particle.userData.orbitRadius;
                particle.position.x = Math.cos(angle) * radius;
                particle.position.z = Math.sin(angle) * radius;
                particle.position.y = Math.sin(time * 2 + i) * 0.05;
            });
        }
    },
    trust: {
        // Infinity ring structure
        setup: (group) => {
            const curve = new THREE.Curve();
            const points = [];
            for (let t = 0; t <= Math.PI * 2; t += 0.1) {
                const x = Math.sin(t) * 0.15;
                const z = Math.sin(t) * Math.cos(t) * 0.15;
                points.push(new THREE.Vector3(x, 0, z));
            }
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
                color: CONFIG.colors.unobservable,
                transparent: true,
                opacity: 0.5
            });
            const infinityRing = new THREE.Line(geometry, material);
            infinityRing.rotation.x = Math.PI / 2;
            group.add(infinityRing);
        },
        animate: (group, time) => {
            const ring = group.children[2];
            if (ring) {
                ring.rotation.z = time * 0.5;
            }
        }
    },
    memory: {
        // Nested/layered spheres
        setup: (group) => {
            for (let i = 1; i <= 2; i++) {
                const layerGeom = new THREE.SphereGeometry(0.1 + i * 0.06, 8, 8);
                const layerMat = new THREE.MeshBasicMaterial({
                    color: CONFIG.colors.unobservable,
                    transparent: true,
                    opacity: 0.15 - i * 0.04,
                    wireframe: true
                });
                const layer = new THREE.Mesh(layerGeom, layerMat);
                group.add(layer);
            }
        },
        animate: (group, time) => {
            group.children.slice(2).forEach((layer, i) => {
                layer.rotation.y = time * (0.3 + i * 0.2);
                layer.rotation.x = time * (0.2 - i * 0.1);
            });
        }
    },
    context: {
        // Iridescent color shift - stays in amber/gold range (hue 0.08-0.12)
        animate: (group, time) => {
            const hue = 0.1 + Math.sin(time * 0.5) * 0.02; // Subtle shift in amber range
            const color = new THREE.Color().setHSL(hue, 0.85, 0.55);
            group.children[0].material.color = color;
        }
    },
    timing: {
        // Clock-like rotation indicator
        setup: (group) => {
            const handGeom = new THREE.BoxGeometry(0.02, 0.12, 0.01);
            const handMat = new THREE.MeshBasicMaterial({
                color: CONFIG.colors.unobservable,
                transparent: true,
                opacity: 0.7
            });
            const hand = new THREE.Mesh(handGeom, handMat);
            hand.position.y = 0.06;

            const handPivot = new THREE.Group();
            handPivot.add(hand);
            group.add(handPivot);
        },
        animate: (group, time) => {
            const handPivot = group.children[2];
            if (handPivot) {
                handPivot.rotation.z = -time * 0.8;
            }
        }
    },
    silence: {
        // Fade in/out partially transparent
        animate: (group, time) => {
            const fadeAmount = 0.3 + Math.sin(time * 0.8) * 0.3;
            group.children[0].material.opacity = fadeAmount + 0.4;
            group.children[1].material.opacity = fadeAmount * 0.3;
        }
    }
};

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

        // Get orb-specific effect configuration
        const effect = ORB_EFFECTS[u.id];

        // Apply setup function if exists (adds extra geometry)
        if (effect && effect.setup) {
            effect.setup(group);
        }

        // Position - floating at a low height (with optional offset)
        const baseYOffset = effect?.baseYOffset || 0;
        const baseY = 0.5 + baseYOffset;
        group.position.set(u.position.x, baseY, u.position.z);
        group.userData = {
            unobservable: u,
            index: i,
            baseY: baseY,
            effect: effect
        };

        scene.add(group);
        unobservableObjects.push(group);

        // HTML label
        createUnobservableLabel(u, group);
    });

    console.log('Unobservables created with unique effects');
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
            position: new THREE.Vector3(6, 3, -1), // Higher position above orbs
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

let previousHoveredOrb = null;

function checkHover() {
    const raycaster = new THREE.Raycaster();
    const mouseVec = new THREE.Vector2(mouse.x, mouse.y);
    raycaster.setFromCamera(mouseVec, camera);

    const orbs = unobservableObjects.map(g => g.children[0]);
    const intersects = raycaster.intersectObjects(orbs);

    if (intersects.length > 0) {
        const obj = intersects[0].object.parent;
        const newHoveredId = obj.userData.unobservable.id;

        // Play sound when hovering a new orb
        if (newHoveredId !== previousHoveredOrb) {
            const orbIndex = obj.userData.index;
            AudioManager.playHoverSound(orbIndex);
            previousHoveredOrb = newHoveredId;
        }

        hoveredUnobservable = newHoveredId;
        document.body.style.cursor = 'pointer';
    } else {
        hoveredUnobservable = null;
        previousHoveredOrb = null;
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

        // Auto-orbit when idle for 30 seconds
        const IDLE_THRESHOLD = 30000; // 30 seconds
        if (StateManager.isIdle(IDLE_THRESHOLD) && !StateManager.focusedOrb) {
            if (!controls.autoRotate) {
                controls.autoRotate = true;
                controls.autoRotateSpeed = 0.3;
                StateManager.isAutoOrbit = true;
            }
        } else {
            if (controls.autoRotate) {
                controls.autoRotate = false;
                StateManager.isAutoOrbit = false;
            }
        }
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

    // Human heartbeat glow (emissive pulsing ~60bpm)
    if (humanMaterial) {
        const heartbeat = 0.4 + Math.sin(time * 1.0) * 0.15;
        humanMaterial.emissiveIntensity = heartbeat;
    }

    // Human breathing animation (subtle scale on body)
    if (humanBody) {
        const breathScale = 1 + Math.sin(time * 0.4) * 0.015;
        humanBody.scale.y = breathScale;
    }

    // Update dust particles
    updateDustParticles();

    // Update AI fog particles
    updateAIFogParticles();

    // Update constellation lines (visible when zoomed out)
    updateConstellationLines();

    // Update proximity glow (orbs glow brighter when camera is close)
    updateProximityGlow();

    // Animate unobservables - gentle floating motion + unique effects
    unobservableObjects.forEach((group, i) => {
        const baseY = group.userData.baseY;
        group.position.y = baseY + Math.sin(time * 0.5 + i * 0.7) * 0.08;

        const isHovered = hoveredUnobservable === group.userData.unobservable.id;
        const isFocused = StateManager.focusedOrb === group.userData.unobservable.id;
        const targetScale = (isHovered || isFocused) ? 1.3 : 1.0;
        const currentScale = group.scale.x;
        const newScale = currentScale + (targetScale - currentScale) * 0.1;
        group.scale.setScalar(newScale);

        // Apply orb-specific animation effect
        const effect = group.userData.effect;
        if (effect && effect.animate) {
            effect.animate(group, time);
        }

        // Animate opacity for hover feedback
        const orb = group.children[0];
        const glow = group.children[1];
        orb.material.opacity = isHovered ? 1.0 : 0.9;
        glow.material.opacity = isHovered ? 0.25 : 0.12;
    });

    // Update connection line when hovering
    updateConnectionLine();

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
        StateManager.recordInteraction();
    });

    document.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        mouseClient.x = touch.clientX;
        mouseClient.y = touch.clientY;
        StateManager.recordInteraction();
    });

    // Click to focus on unobservables
    document.addEventListener('click', (e) => {
        StateManager.recordInteraction();

        // Check if clicking on UI elements
        if (e.target.closest('.view-btn') ||
            e.target.closest('.detail-panel') ||
            e.target.closest('.legend') ||
            e.target.closest('.header') ||
            e.target.closest('.audio-btn')) {
            return;
        }

        // Check if clicking on an unobservable orb
        if (hoveredUnobservable) {
            // If clicking on a different orb than currently focused, switch to it
            if (StateManager.focusedOrb !== hoveredUnobservable) {
                focusOnOrb(hoveredUnobservable);
            }
            return;
        }

        // If focused and clicking elsewhere (not on an orb), exit focus
        if (StateManager.focusedOrb) {
            exitFocus();
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        StateManager.recordInteraction();

        switch(e.key) {
            case 'Escape':
                exitFocus();
                break;
            case '1':
                transitionToPreset('ai');
                break;
            case '2':
                transitionToPreset('human');
                break;
            case '3':
                transitionToPreset('overview');
                break;
            case 'ArrowRight':
            case 'ArrowDown':
                focusNextOrb(1);
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
                focusNextOrb(-1);
                break;
        }
    });

    // Scroll and mouse wheel record interaction
    document.addEventListener('wheel', () => {
        StateManager.recordInteraction();
    });

    document.addEventListener('mousedown', () => {
        StateManager.recordInteraction();
    });
}

// Navigate to next/previous orb
function focusNextOrb(direction) {
    const orbs = CONFIG.unobservables;
    if (orbs.length === 0) return;

    let currentIndex = -1;
    if (StateManager.focusedOrb) {
        currentIndex = orbs.findIndex(u => u.id === StateManager.focusedOrb);
    }

    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = orbs.length - 1;
    if (nextIndex >= orbs.length) nextIndex = 0;

    focusOnOrb(orbs[nextIndex].id);
}

// ============================================================
// Intro
// ============================================================

function playIntro() {
    // Start orbs hidden (scale 0)
    unobservableObjects.forEach(group => {
        group.scale.setScalar(0);
    });

    setTimeout(() => {
        document.getElementById('quote').classList.add('visible');
    }, 500);

    setTimeout(() => {
        document.getElementById('legend').classList.add('visible');
        // Show scene labels
        document.getElementById('labelObservable')?.classList.add('visible');
        document.getElementById('labelUnobservable')?.classList.add('visible');
    }, 1000);

    // Reveal unobservable orbs with staggered animation
    setTimeout(() => {
        revealUnobservables();
    }, 1500);

    setTimeout(() => {
        document.getElementById('controlsHint').classList.add('visible');
    }, 3500);

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

// Staggered reveal animation for unobservable orbs
function revealUnobservables() {
    if (typeof gsap === 'undefined') {
        // Fallback: just show them
        unobservableObjects.forEach(group => {
            group.scale.setScalar(1);
        });
        return;
    }

    unobservableObjects.forEach((group, i) => {
        gsap.to(group.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: 0.8,
            delay: i * 0.12,
            ease: 'back.out(1.7)'
        });
    });
}

// ============================================================
// Start
// ============================================================

window.addEventListener('DOMContentLoaded', init);
