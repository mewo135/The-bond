// timing and particle config
const PHASE = {
    fadeInEnd: 0.80,
    holdEnd: 0.85,
    dissolveEnd: 1.0
};

if (PHASE.fadeInEnd > PHASE.holdEnd) PHASE.holdEnd = PHASE.fadeInEnd;

const REVEAL_OVERLAP = 1.2;
const PARTICLE_STEP = 18;
const PARTICLE_MAX_DIST = 130;
const PARTICLE_COLORS = ["#dc76a3", "#3c6dbb", "#f9ea93", "#8eba98"];
const SCROLL_SMOOTHING = 0.06;

// helpers
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(v) { return Math.max(0, Math.min(1, v)); }

// frame scale
const FRAME_WIDTH = 1920;
const FRAME_HEIGHT = 1080;

function updateFrameScale() {
    let scale = Math.min(window.innerWidth / FRAME_WIDTH, window.innerHeight / FRAME_HEIGHT);
    if (scale > 0.97 && scale < 1.03) scale = 1;
    document.documentElement.style.setProperty('--frame-scale', scale);
}

updateFrameScale();

// word fade and dissolve
class VerseController {
    constructor(sectionEl) {
        this.section = sectionEl;
        this.inner = sectionEl.querySelector('.verse-inner');
        this.words = Array.from(sectionEl.querySelectorAll('.word'));
        this.canvas = sectionEl.querySelector('.particle-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = null;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.progress = 0;
    }
    buildParticles() {
        const innerRect = this.inner.getBoundingClientRect();
        const w = this.inner.clientWidth;
        const h = this.inner.clientHeight;

        this.resizeCanvas(w, h);

        const sample = document.createElement('canvas');
        sample.width = w;
        sample.height = h;
        const sctx = sample.getContext('2d');

        const shapeColor = getComputedStyle(document.body).getPropertyValue('--text-color').trim() || '#ebe9ff';
        sctx.fillStyle = shapeColor;
        sctx.textBaseline = 'alphabetic';

        this.words.forEach(word => {
            const rect = word.getBoundingClientRect();
            const style = getComputedStyle(word);
            const relX = rect.left - innerRect.left;
            const relY = rect.top - innerRect.top + rect.height * 0.82;
            sctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
            sctx.fillText(word.textContent, relX, relY);
        });

        const imgData = sctx.getImageData(0, 0, w, h).data;
        const pts = [];
        for (let y = 0; y < h; y += PARTICLE_STEP) {
            for (let x = 0; x < w; x += PARTICLE_STEP) {
                const alpha = imgData[(y * w + x) * 4 + 3];
                if (alpha > 120) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = PARTICLE_MAX_DIST * (0.4 + Math.random() * 0.6);
                    pts.push({
                        hx: x, hy: y,
                        dx: Math.cos(angle) * dist * 0.5,
                        dy: -Math.abs(Math.sin(angle) * dist) - dist * 0.4,
                        size: 1 + Math.random() * 1.8
                    });
                }
            }
        }

        this.particles = pts;
        this.particleColor = shapeColor;
    }

    resizeCanvas(w, h) {
        this.canvas.width = w * this.dpr;
        this.canvas.height = h * this.dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    computeRawProgress() {
        const rect = this.section.getBoundingClientRect();
        const vh = window.innerHeight;
        const scrollableDist = this.section.offsetHeight - vh;
        if (scrollableDist <= 0) return 0;
        const scrolled = -rect.top;
        return clamp01(scrolled / scrollableDist);
    }

    wordOpacity(progress, index, total) {
        if (progress <= PHASE.fadeInEnd) {
            const duration = Math.max((PHASE.fadeInEnd / total) * REVEAL_OVERLAP, 0.001);
            const start = (index / total) * PHASE.fadeInEnd;
            const end = Math.min(start + duration, PHASE.fadeInEnd);
            return clamp01((progress - start) / (end - start));
        } else if (progress <= PHASE.holdEnd) {
            return 1;
        } else {
            const dissolveT = (progress - PHASE.holdEnd) / (PHASE.dissolveEnd - PHASE.holdEnd);
            const TEXT_DROP_FRACTION = 0.25;
            return lerp(1, 0, clamp01(dissolveT / TEXT_DROP_FRACTION));
        }
    }

    render() {
        const p = this.progress;
        const total = this.words.length;

        this.words.forEach((word, i) => {
            word.style.opacity = this.wordOpacity(p, i, total);
        });

        const scatterT = p <= PHASE.holdEnd
            ? 0
            : clamp01((p - PHASE.holdEnd) / (PHASE.dissolveEnd - PHASE.holdEnd));

        this.drawParticles(scatterT);
    }

    drawParticles(scatterT) {
        const ctx = this.ctx;
        const w = this.canvas.width / this.dpr;
        const h = this.canvas.height / this.dpr;
        ctx.clearRect(0, 0, w, h);

        if (scatterT <= 0 || !this.particles) return;

        ctx.fillStyle = this.particleColor || '#ebe9ff';
        const alpha = 1 - scatterT;

        this.particles.forEach(pt => {
            const x = pt.hx + pt.dx * scatterT;
            const y = pt.hy + pt.dy * scatterT;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(x, y, pt.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    update() {
        const raw = this.computeRawProgress();
        this.progress = lerp(this.progress, raw, SCROLL_SMOOTHING);
        if (Math.abs(this.progress - raw) < 0.0008) this.progress = raw;
        this.render();
    }
}

// ambient sparkles
const ambientCanvas = document.getElementById('ambientCanvas');
const actx = ambientCanvas.getContext('2d');
let ambientDots = [];

const SPARKLE_COUNT = 25;
const SPARKLE_MIN_SIZE = 1.5;
const SPARKLE_MAX_SIZE = 3.5;
const SPARKLE_MIN_SPEED = 0.15;
const SPARKLE_MAX_SPEED = 0.45;
const SPARKLE_TWINKLE_SPEED = 0.02;

function resizeAmbient() {
    ambientCanvas.width = window.innerWidth;
    ambientCanvas.height = window.innerHeight;
}

function initAmbient() {
    resizeAmbient();
    ambientDots = [];
    for (let i = 0; i < SPARKLE_COUNT; i++) {
        ambientDots.push({
            x: Math.random() * ambientCanvas.width,
            y: Math.random() * ambientCanvas.height,
            r: SPARKLE_MIN_SIZE + Math.random() * (SPARKLE_MAX_SIZE - SPARKLE_MIN_SIZE),
            speed: SPARKLE_MIN_SPEED + Math.random() * (SPARKLE_MAX_SPEED - SPARKLE_MIN_SPEED),
            drift: (Math.random() - 0.5) * 0.3,
            phase: Math.random() * Math.PI * 2,
            color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)]
        });
    }
}

function drawAmbient() {
    actx.clearRect(0, 0, ambientCanvas.width, ambientCanvas.height);

    ambientDots.forEach(d => {
        d.y -= d.speed;
        d.x += d.drift;
        d.phase += SPARKLE_TWINKLE_SPEED;
        if (d.y < -10) {
            d.y = ambientCanvas.height + 10;
            d.x = Math.random() * ambientCanvas.width;
        }
        const twinkle = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(d.phase));
        actx.globalAlpha = twinkle;
        actx.fillStyle = d.color;
        actx.beginPath();
        actx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        actx.fill();
    });
    actx.globalAlpha = 1;

    requestAnimationFrame(drawAmbient);
}

// skip prompt
const skipPrompt = document.getElementById('skipPrompt');
const NEXT_STAGE_URL = './stage.html';

function checkSkipPromptVisibility() {
    if (!verses.length) return;
    const lastProgress = verses[verses.length - 1].progress;
    skipPrompt.classList.toggle('visible', lastProgress >= 0.99);
}

document.addEventListener('keydown', (event) => {
    if (!skipPrompt.classList.contains('visible')) return;
    if (event.key === 'e' || event.key === 'E' || event.key === 'Enter') {
        setTimeout(() => {
            window.location.href = NEXT_STAGE_URL;
        }, 400);
    }
});

skipPrompt.addEventListener('click', () => {
    if (skipPrompt.classList.contains('visible')) {
        window.location.href = NEXT_STAGE_URL;
    }
});

// scroll hint
const scrollHint = document.getElementById('scrollHint');
window.addEventListener('scroll', () => {
    scrollHint.classList.toggle('hidden', window.scrollY > 5);
}, { passive: true });

// theme
const themeToggleEl = document.getElementById('themeToggle');
const titleNav = document.getElementById('titleNav');
const body = document.body;
const savedTheme = localStorage.getItem('theme') || 'dark';
body.classList.remove('dark', 'light');
body.classList.add(savedTheme);
themeToggleEl.checked = savedTheme === 'light';
updateTitleNav();

themeToggleEl.addEventListener('change', () => {
    const isLight = themeToggleEl.checked;
    body.classList.toggle('dark', !isLight);
    body.classList.toggle('light', isLight);
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateTitleNav();
    verses.forEach(v => v.buildParticles());
    verses.forEach(v => v.update());
});

function updateTitleNav() {
    const isLight = body.classList.contains('light');
    titleNav.src = isLight ? 'assets/title-light.svg' : 'assets/title.svg';
}

// main loop and init
let verses = [];

function mainLoop() {
    verses.forEach(v => v.update());
    checkSkipPromptVisibility();
    requestAnimationFrame(mainLoop);
}

async function init() {
    try {
        await document.fonts.ready;
    } catch (e) {
    }

    updateFrameScale();

    verses = Array.from(document.querySelectorAll('.verse')).map(el => new VerseController(el));
    verses.forEach(v => v.buildParticles());
    verses.forEach(v => v.update());

    initAmbient();
    requestAnimationFrame(drawAmbient);
    checkSkipPromptVisibility();

    requestAnimationFrame(mainLoop);

    window.addEventListener('resize', () => {
        updateFrameScale();
        resizeAmbient();
        verses.forEach(v => v.buildParticles());
        verses.forEach(v => v.update());
    });
}

init();