// ============================================================
// STAGE 01 — scroll-driven poem.
// Each verse: words appear ONE BY ONE in order while scrolling
// down (fade-in phase) -> hold, fully visible -> dissolve into
// particles. Scrolling back up reverses everything automatically,
// because every visual value is computed directly FROM the
// current scroll progress (0 -> 1), never from elapsed time.
// ============================================================

const PHASE = {
    fadeInEnd: 0.80,   // 0        -> 0.80 : words appear one by one
    holdEnd: 0.85,     // 0.80     -> 0.85 : giữ ngắn
    dissolveEnd: 1.0   // 0.85     -> 1.00 : tan từ từ (khoảng rộng hơn, 15% thay vì 8%)
};
// Safety net: if fadeInEnd is ever pushed past holdEnd (e.g. testing
// a "chỉ hiện chữ, không dissolve" setup), auto-correct holdEnd so
// text-fade and particle-scatter never fall out of sync again.
if (PHASE.fadeInEnd > PHASE.holdEnd) PHASE.holdEnd = PHASE.fadeInEnd;

const REVEAL_OVERLAP = 1.2;    // >1 = words' fade-ins overlap a little; lower = more distinctly one-by-one
const PARTICLE_STEP = 8;       // sample every Nth pixel (bigger = sparser + nhẹ hơn)
const PARTICLE_MAX_DIST = 220; // how far a particle can drift at full dissolve
const SCROLL_SMOOTHING = 0.06; // 0-1, how fast displayed progress catches up to raw scroll (lower = smoother/slower/laggier, higher = snappier/choppier)

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(v) { return Math.max(0, Math.min(1, v)); }

// ------------------------------------------------------------
// Frame scaling — fixed 1920x1080 design frame, scaled uniformly
// to fit any screen (see .frame in the CSS).
// ------------------------------------------------------------
const FRAME_WIDTH = 1920;
const FRAME_HEIGHT = 1080;

function updateFrameScale() {
    let scale = Math.min(window.innerWidth / FRAME_WIDTH, window.innerHeight / FRAME_HEIGHT);
    // Snap to exactly 1 when the window is very close to the native
    // 1920x1080 design size (e.g. taskbar/browser chrome eating a few
    // px even in "fullscreen") — avoids a tiny, confusing scale-down
    // on the exact screen this was designed on.
    if (scale > 0.97 && scale < 1.03) scale = 1;
    document.documentElement.style.setProperty('--frame-scale', scale);
}

updateFrameScale(); // run immediately, don't wait for fonts/init

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
    // pinned, 1 right before it releases. This is the RAW value —
    // it jumps around exactly with scroll input (choppy with mouse
    // wheel notches). update() below smooths it out.
    computeRawProgress() {
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
    // - During dissolve phase: text drops out FAST (first 25% of the
    //   dissolve window) so it doesn't sit visually on top of the
    //   particles for the whole dissolve.
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
            const TEXT_DROP_FRACTION = 0.25; // text is fully gone by 25% into the dissolve window
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
        // Stays fully visible a bit longer, then fades toward the end
        // of the scatter — reads more like dust drifting off than an
        // even linear fade the whole way.
        const alpha = 1 - scatterT; // linear fade — đều đặn, từ từ suốt cả quá trình tan

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

    // Called every animation frame (not just on scroll events).
    // this.progress smoothly chases the raw scroll-based progress —
    // this is what makes the reveal/dissolve feel buttery instead
    // of stepping in chunks with each scroll tick.
    update() {
        const raw = this.computeRawProgress();
        this.progress = lerp(this.progress, raw, SCROLL_SMOOTHING);
        // snap once very close, so it doesn't asymptotically creep forever
        if (Math.abs(this.progress - raw) < 0.0008) this.progress = raw;
        this.render();
    }
}

// ------------------------------------------------------------
// Ambient sparkle particles (nền) — các chấm sáng trôi lên, độ
// sáng nhấp nháy (twinkle) theo hình sin, tạo cảm giác lấp lánh.
// Plain fills, no canvas filter (filter-blur on canvas is
// unreliable across browsers — avoided project-wide).
// ------------------------------------------------------------
const ambientCanvas = document.getElementById('ambientCanvas');
const actx = ambientCanvas.getContext('2d');
let ambientDots = [];

const SPARKLE_COUNT = 25;           // số lượng hạt — tăng/giảm tuỳ ý (giữ nhẹ, tránh lag)
const SPARKLE_MIN_SIZE = 1.5;
const SPARKLE_MAX_SIZE = 3.5;
const SPARKLE_MIN_SPEED = 0.15;     // tốc độ trôi lên (px/frame)
const SPARKLE_MAX_SPEED = 0.45;
const SPARKLE_TWINKLE_SPEED = 0.02; // tốc độ nhấp nháy sáng/tối

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
            phase: Math.random() * Math.PI * 2 // lệch pha để không nhấp nháy đồng loạt
        });
    }
}

function drawAmbient() {
    const color = getComputedStyle(document.body).getPropertyValue('--text-color').trim() || '#ebe9ff';
    actx.clearRect(0, 0, ambientCanvas.width, ambientCanvas.height);
    actx.fillStyle = color;

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

// Runs every animation frame (not just on scroll events) so the
// per-verse smoothing in VerseController.update() actually has
// something continuous to interpolate against.
function mainLoop() {
    verses.forEach(v => v.update());
    checkSkipPromptVisibility();
    requestAnimationFrame(mainLoop);
}

async function init() {
    try {
        await document.fonts.ready; // wait for Ballet + Ebrima before sampling text pixels
    } catch (e) {
        // continue anyway if the font loading API isn't available
    }

    updateFrameScale(); // must run BEFORE buildParticles, so words are sampled at their final on-screen position

    verses = Array.from(document.querySelectorAll('.verse')).map(el => new VerseController(el));
    verses.forEach(v => v.buildParticles());
    verses.forEach(v => v.update());

    initAmbient();
    requestAnimationFrame(drawAmbient);
    checkSkipPromptVisibility();

    requestAnimationFrame(mainLoop); // continuous loop, replaces scroll-event-only updates

    window.addEventListener('resize', () => {
        updateFrameScale();
        resizeAmbient();
        verses.forEach(v => v.buildParticles());
        verses.forEach(v => v.update());
    });
}

// ------------------------------------------------------------
// Theme toggle
// ------------------------------------------------------------
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
    verses.forEach(v => v.buildParticles()); // re-sample particle color for the new theme
    verses.forEach(v => v.update());
});

function updateTitleNav() {
    const isLight = body.classList.contains('light');
    titleNav.src = isLight ? 'assets/title-light.svg' : 'assets/title.svg';
}

init();