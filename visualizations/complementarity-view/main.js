/**
 * Complementarity View - Responsive Visualization
 * Particles contained within bounded containers
 */

// Configuration
const CONFIG = {
  particles: {
    observable: { count: 10 },
    unobservable: { count: 14 }
  },
  animation: {
    speed: 0.0008,
    amplitude: { x: 12, y: 18 }
  }
};

// Particle class - creates DOM elements within container bounds
class Particle {
  constructor(container, type) {
    this.container = container;
    this.type = type;

    // Random position as percentage of container
    this.xPercent = 10 + Math.random() * 80;
    this.yPercent = 10 + Math.random() * 80;

    // Animation parameters
    this.size = 6 + Math.random() * 8;
    this.phase = Math.random() * Math.PI * 2;
    this.speedX = 0.3 + Math.random() * 0.5;
    this.speedY = 0.4 + Math.random() * 0.6;
    this.amplitudeX = 8 + Math.random() * 12;
    this.amplitudeY = 10 + Math.random() * 15;

    this.element = null;
    this.baseX = 0;
    this.baseY = 0;

    this.create();
  }

  create() {
    this.element = document.createElement('div');
    this.element.className = `particle particle--${this.type}`;
    this.element.style.cssText = `
      left: ${this.xPercent}%;
      top: ${this.yPercent}%;
      width: ${this.size}px;
      height: ${this.size}px;
      opacity: ${0.6 + Math.random() * 0.4};
    `;
    this.container.appendChild(this.element);
  }

  update(time) {
    const offsetX = Math.sin(time * this.speedX + this.phase) * this.amplitudeX;
    const offsetY = Math.cos(time * this.speedY + this.phase * 1.3) * this.amplitudeY;
    this.element.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  }

  destroy() {
    this.element?.remove();
  }
}

// Tooltip controller
class TooltipController {
  constructor(element) {
    this.element = element;
    this.visible = false;
  }

  show(event, data) {
    this.element.innerHTML = `
      <h4>${data.title}</h4>
      <p>${data.description}</p>
    `;
    this.element.className = `tooltip tooltip--${data.type} tooltip--visible`;
    this.updatePosition(event);
    this.visible = true;
  }

  hide() {
    this.element.classList.remove('tooltip--visible');
    this.visible = false;
  }

  updatePosition(event) {
    const padding = 15;
    let x = event.clientX + padding;
    let y = event.clientY - padding;

    const rect = this.element.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - padding;
    const maxY = window.innerHeight - rect.height - padding;

    this.element.style.left = `${Math.min(x, maxX)}px`;
    this.element.style.top = `${Math.max(padding, Math.min(y, maxY))}px`;
  }
}

// Main visualization
class ComplementarityView {
  constructor() {
    this.observableContainer = document.getElementById('observableParticles');
    this.unobservableContainer = document.getElementById('unobservableParticles');
    this.tooltip = new TooltipController(document.getElementById('tooltip'));

    this.particles = [];
    this.animationId = null;
    this.startTime = performance.now();

    this.init();
  }

  init() {
    this.createParticles();
    this.setupInteractions();
    this.startAnimation();
  }

  createParticles() {
    // Observable particles (blue, in light zone)
    for (let i = 0; i < CONFIG.particles.observable.count; i++) {
      this.particles.push(new Particle(this.observableContainer, 'observable'));
    }

    // Unobservable particles (orange, in dark zone)
    for (let i = 0; i < CONFIG.particles.unobservable.count; i++) {
      this.particles.push(new Particle(this.unobservableContainer, 'unobservable'));
    }
  }

  setupInteractions() {
    const tooltipData = {
      ai: {
        title: 'AI System',
        description: 'Operates within the bounds of its training data. Can only see what enters the data pipeline.',
        type: 'ai'
      },
      human: {
        title: 'Human Expert',
        description: 'Accesses both observable data and tacit, contextual knowledge that never enters any database.',
        type: 'human'
      },
      observable: {
        title: 'Observable Data',
        description: 'Structured information in the training data. AI has scale and speed advantages here.',
        type: 'ai'
      },
      unobservable: {
        title: 'Model Unobservable',
        description: 'Contextual, tacit, situational knowledge. The 90% that shapes expert judgment but never enters any data.',
        type: 'unobservable'
      }
    };

    // Figure interactions
    const figureAI = document.querySelector('.figure--ai');
    const figureHuman = document.querySelector('.figure--human');

    if (figureAI) {
      figureAI.addEventListener('mouseenter', (e) => this.tooltip.show(e, tooltipData.ai));
      figureAI.addEventListener('mouseleave', () => this.tooltip.hide());
      figureAI.addEventListener('mousemove', (e) => this.tooltip.visible && this.tooltip.updatePosition(e));
    }

    if (figureHuman) {
      figureHuman.addEventListener('mouseenter', (e) => this.tooltip.show(e, tooltipData.human));
      figureHuman.addEventListener('mouseleave', () => this.tooltip.hide());
      figureHuman.addEventListener('mousemove', (e) => this.tooltip.visible && this.tooltip.updatePosition(e));
    }

    // Particle interactions using event delegation
    this.observableContainer?.addEventListener('mouseenter', (e) => {
      if (e.target.classList.contains('particle')) {
        this.tooltip.show(e, tooltipData.observable);
      }
    }, true);

    this.observableContainer?.addEventListener('mouseleave', (e) => {
      if (e.target.classList.contains('particle')) {
        this.tooltip.hide();
      }
    }, true);

    this.unobservableContainer?.addEventListener('mouseenter', (e) => {
      if (e.target.classList.contains('particle')) {
        this.tooltip.show(e, tooltipData.unobservable);
      }
    }, true);

    this.unobservableContainer?.addEventListener('mouseleave', (e) => {
      if (e.target.classList.contains('particle')) {
        this.tooltip.hide();
      }
    }, true);

    // Global mouse move for tooltip following
    document.addEventListener('mousemove', (e) => {
      if (this.tooltip.visible) {
        this.tooltip.updatePosition(e);
      }
    });
  }

  startAnimation() {
    const animate = () => {
      const elapsed = (performance.now() - this.startTime) / 1000;
      this.particles.forEach(p => p.update(elapsed));
      this.animationId = requestAnimationFrame(animate);
    };
    this.animationId = requestAnimationFrame(animate);
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.particles.forEach(p => p.destroy());
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.complementarityView = new ComplementarityView();
});
