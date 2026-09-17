// ============================================================
// REFLECTION 1 — scroll-driven poem.
// Each verse: words appear ONE BY ONE in order while scrolling
// down (fade-in phase) -> hold, fully visible -> dissolve into
// particles. Scrolling back up reverses everything automatically,
// because every visual value is computed directly FROM the
// current scroll progress (0 -> 1), never from elapsed time.
// ============================================================

const PHASE = {
    fadeInEnd: 0.30,   // 0        -> 0.30 : words appear one by one
    holdEnd: 0.60,     // 0.30     -> 0.60 : fully visible, readable
    dissolveEnd: 1.0   // 0.60     -> 1.00 : dissolves into particles
};

const REVEAL_OVERLAP = 2.0;    // >1 = words' fade-ins overlap a little (smoother than a strict typewriter)
const PARTICLE_STEP = 3;       // sample every Nth pixel (lower = more particles = slower)
const PARTICLE_MAX_DIST = 220; // how far a particle can drift at full dissolve

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(v) { return Math.max(0, Math.min(1, v)); }

// ------------------------------------------------------------
// One VerseController per .verse section.
// ------------------------------------------------------------
class VerseController {
    constructor(sectionEl) {
        this.section = sectionEl;
        this.inner = sectionEl.querySelector('.verse-inner');
        this.words = Array.from(sectionEl.querySelectorAll('.word')); // DOM order = reading order = id order
        this.canvas = sectionEl.querySelector('.particle-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = null;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.progress = 0;
    }

    // Render every word into an offscreen canvas (matching its real
    // on-screen font/size/position) and sample the opaque pixels
    // into particle points for the dissolve effect.
    buildParticles() {
        const innerRect = this.inner.getBoundingClientRect();
        const w = this.inner.clientWidth;
        const h = this.inner.clientHeight;

        this.resizeCanvas(w, h);

        const sample = document.createElement('canvas');
        sample.width = w;
        sample.height = h;
        const sctx = sample.getContext('2d');

        // Sample using the current theme color so the offscreen text
        // shape matches what's on screen...
        const shapeColor = getComputedStyle(document.body).getPropertyValue('--text-color').trim() || '#ebe9ff';
        sctx.fillStyle = shapeColor;
        sctx.textBaseline = 'alphabetic';

        this.words.forEach(word => {
            const rect = word.getBoundingClientRect();
            const style = getComputedStyle(word);
            const relX = rect.left - innerRect.left;
            const relY = rect.top - innerRect.top + rect.height * 0.82; // approx baseline
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
                        dy: -Math.abs(Math.sin(angle) * dist) - dist * 0.4, // drift mostly upward
                        size: 1 + Math.random() * 1.8
                    });
                }
            }
        }

        this.particles = pts;
        this.particleColor = '#ffffff'; // dust is always white, regardless of theme
    }

    resizeCanvas(w, h) {
        this.canvas.width = w * this.dpr;
        this.canvas.height = h * this.dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    // Pinned-scroll progress: 0 when this section starts being
    // pinned, 1 right before it releases.
    computeProgress() {
        const rect = this.section.getBoundingClientRect();
        const vh = window.innerHeight;
        const scrollableDist = this.section.offsetHeight - vh;
        if (scrollableDist <= 0) return 0;
        const scrolled = -rect.top;
        return clamp01(scrolled / scrollableDist);
    }

    // Opacity of one word, given the verse's overall progress.
    // - During fadeIn phase: words light up in sequence (index order).
    // - During hold phase: fully visible.
    // - During dissolve phase: all fade out together (particles take over).
    wordOpacity(progress, index, total) {
        if (progress <= PHASE.fadeInEnd) {
            const duration = Math.max((PHASE.fadeInEnd / total) * REVEAL_OVERLAP, 0.001);
            const start = (index / total) * PHASE.fadeInEnd;
            const end = Math.min(start + duration, PHASE.fadeInEnd);
            return clamp01((progress - start) / (end - start));
        } else if (progress <= PHASE.holdEnd) {
            return 1;
        } else {
            return lerp(1, 0, (progress - PHASE.holdEnd) / (PHASE.dissolveEnd - PHASE.holdEnd));
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
        this.progress = this.computeProgress();
        this.render();
    }
}

// ------------------------------------------------------------
// Ambient floating dust in the background (decorative only).
// Plain fills, no canvas filter (filter-blur on canvas is
// unreliable across browsers — avoided project-wide).
// ------------------------------------------------------------
const ambientCanvas = document.getElementById('ambientCanvas');
const actx = ambientCanvas.getContext('2d');
let ambientDots = [];

function initAmbient() {
    resizeAmbient();
    ambientDots = [];
    const count = 25;
    for (let i = 0; i < count; i++) {
        ambientDots.push({
            x: Math.random() * ambientCanvas.width,
            y: Math.random() * ambientCanvas.height,
            r: 2 + Math.random() * 2.5,
            speed: 0.15 + Math.random() * 0.25,
            drift: (Math.random() - 0.5) * 0.3,
            phase: Math.random() * Math.PI * 2
        });
    }
}

function resizeAmbient() {
    ambientCanvas.width = window.innerWidth;
    ambientCanvas.height = window.innerHeight;
}

function drawAmbient() {
    const color = getComputedStyle(document.body).getPropertyValue('--text-color').trim() || '#ebe9ff';
    actx.clearRect(0, 0, ambientCanvas.width, ambientCanvas.height);
    actx.fillStyle = color;

    ambientDots.forEach(d => {
        d.y -= d.speed;
        d.x += d.drift;
        d.phase += 0.02;
        if (d.y < -10) {
            d.y = ambientCanvas.height + 10;
            d.x = Math.random() * ambientCanvas.width;
        }
        const twinkle = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(d.phase));
        actx.globalAlpha = twinkle;
        actx.beginPath();
        actx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        actx.fill();
    });
    actx.globalAlpha = 1;

    requestAnimationFrame(drawAmbient);
}

// ------------------------------------------------------------
// Skip prompt — appears once the last verse has fully dissolved
// (its own scroll progress reaches ~1), same "Press E / Enter"
// pattern as the landing page. Pressing E/Enter navigates on.
//
// NOTE: this checks the last verse's PROGRESS value (0->1), not
// getBoundingClientRect() on the whole 250vh section — because of
// how position:sticky unpins, waiting for the section to fully
// leave the viewport means an extra ~100vh of "dead" scrolling
// after the text has already dissolved, making the prompt feel
// like it never shows up. Progress-based = shows immediately.
// ------------------------------------------------------------
const skipPrompt = document.getElementById('skipPrompt');
const NEXT_STAGE_URL = './stage02.html'; // change if this should point elsewhere

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

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
let verses = [];
let ticking = false;

function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
        verses.forEach(v => v.update());
        checkSkipPromptVisibility();
        ticking = false;
    });
}

async function init() {
    try {
        await document.fonts.ready; // wait for Ballet + Ebrima before sampling text pixels
    } catch (e) {
        // continue anyway if the font loading API isn't available
    }

    verses = Array.from(document.querySelectorAll('.verse')).map(el => new VerseController(el));
    verses.forEach(v => v.buildParticles());
    verses.forEach(v => v.update());

    initAmbient();
    requestAnimationFrame(drawAmbient);
    checkSkipPromptVisibility();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => {
        resizeAmbient();
        verses.forEach(v => v.buildParticles());
        verses.forEach(v => v.update());
    });
}

// ------------------------------------------------------------
// Theme toggle
// ------------------------------------------------------------
const themeToggleEl = document.getElementById('themeToggle');
const body = document.body;
const savedTheme = localStorage.getItem('theme') || 'dark';
body.classList.remove('dark', 'light');
body.classList.add(savedTheme);
themeToggleEl.checked = savedTheme === 'light';

themeToggleEl.addEventListener('change', () => {
    const isLight = themeToggleEl.checked;
    body.classList.toggle('dark', !isLight);
    body.classList.toggle('light', isLight);
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    verses.forEach(v => v.buildParticles()); // re-sample particle color for the new theme
    verses.forEach(v => v.update());
});

init();