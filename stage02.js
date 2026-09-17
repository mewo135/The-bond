let flowers = [];
let currentShape = 'fat';
let currentType = 1;
let landImg;

// Cache: raw flower texture per type/shape (created once, reused)
const flowerBuffers = {};

// Flower color definitions: [outer, mid, center], stops: [centerPos, midPos, outerPos]
const flowerTypes = {
    1: { outer: [206, 97, 103], mid: [209, 193, 180], center: [86, 135, 167], stops: [0, 0.18, 0.8], label: 'Pink-Red' },
    2: { outer: [235, 230, 220], mid: [250, 220, 90], center: [230, 130, 70], stops: [0, 0.18, 0.4], label: 'White-Yellow' },
    3: { outer: [90, 140, 220], mid: [251, 141, 159], center: [243, 143, 152, 0.6], stops: [0, 0.18, 0.8], label: 'Blue-Pink' },
    4: { outer: [240, 150, 50], mid: [250, 220, 40], center: [150, 170, 210], stops: [0, 0.18, 0.8], label: 'Orange-Yellow' }
};

// Background - dark & light themes
const bgPalettes = {
    dark: { bg1: '#0a0a0a', bg2: '#1a1a1a', ground: '#1f2a1f' },
    light: { bg1: '#fffaf5', bg2: '#fffaf5', ground: '#d4e8d4' }
};
let currentTheme = 'dark';

// Background baked ONCE into a buffer (safe optimization, no visual change)
let bgBuffer = null;
function createBgBuffer(p) {
    bgBuffer = p.createGraphics(p.width, p.height);
    bgBuffer.pixelDensity(1);
    const bgPalette = bgPalettes[currentTheme];
    for (let i = 0; i < bgBuffer.height; i++) {
        let inter = p.map(i, 0, bgBuffer.height, 0, 1);
        let c = p.lerpColor(p.color(bgPalette.bg1), p.color(bgPalette.bg2), inter);
        bgBuffer.stroke(c);
        bgBuffer.line(0, i, bgBuffer.width, i);
    }
}

// ===== ORIGINAL flower texture creation - UNCHANGED from your working version =====
function getOrCreateFlowerBuffer(p, type, fat) {
    const key = `type_${type}_${fat ? 'fat' : 'thin'}`;
    if (!flowerBuffers[key]) {
        flowerBuffers[key] = createFlowerBuffer(p, type, fat);
    }
    return flowerBuffers[key];
}

function createFlowerBuffer(p, type, fat) {
    const colors = flowerTypes[type];
    const petalCount = 8;
    const bufSize = 260;
    const radius = fat ? 100 : 105;
    const petalW = fat ? 46 : 30;

    const buf = p.createGraphics(bufSize, bufSize);
    buf.pixelDensity(1);
    buf.angleMode(buf.RADIANS);
    buf.noStroke();
    buf.push();
    buf.translate(bufSize / 2, bufSize / 2);

    buf.fill(255);
    for (let i = 0; i < petalCount; i++) {
        const angle = (Math.PI * 2 / petalCount) * i;
        buf.push();
        buf.rotate(angle);
        buf.ellipse(0, -radius * 0.55, petalW, radius);
        buf.pop();
    }
    buf.ellipse(0, 0, radius * (fat ? 0.9 : 0.6), radius * (fat ? 0.9 : 0.6));

    const canvasEl = buf.canvas;
    buf.drawingContext.save();
    buf.drawingContext.setTransform(1, 0, 0, 1, 0, 0);
    buf.drawingContext.globalCompositeOperation = 'source-atop';
    const grad = buf.drawingContext.createRadialGradient(
        canvasEl.width / 2, canvasEl.height / 2, 2,
        canvasEl.width / 2, canvasEl.height / 2, canvasEl.width / 2
    );
    grad.addColorStop(colors.stops[0], `rgba(${colors.center[0]}, ${colors.center[1]}, ${colors.center[2]}, 1)`);
    grad.addColorStop(colors.stops[1], `rgba(${colors.mid[0]}, ${colors.mid[1]}, ${colors.mid[2]}, 1)`);
    grad.addColorStop(colors.stops[2], `rgba(${colors.outer[0]}, ${colors.outer[1]}, ${colors.outer[2]}, 1)`);
    buf.drawingContext.fillStyle = grad;
    buf.drawingContext.fillRect(0, 0, canvasEl.width, canvasEl.height);
    buf.drawingContext.globalCompositeOperation = 'source-over';
    buf.drawingContext.restore();

    buf.pop();
    return buf;
}

// ===== ORIGINAL two-layer blur draw - EXACTLY as it was, UNCHANGED =====
// The trick now is WHERE this gets called: once per flower add, not 60x/sec.
function drawFlowerShape(target, cx, cy, size, buffer, rotation) {
    const drawSize = 260 * size * 0.9;

    target.push();
    target.translate(cx, cy);
    target.rotate(rotation);

    // Glow layer (duplicate, blurred behind) - original values, untouched
    target.push();
    target.drawingContext.filter = 'blur(10px)';
    target.imageMode(target.CENTER);
    target.image(buffer, 0, 0, drawSize, drawSize);
    target.drawingContext.filter = 'none';
    target.pop();

    // Sharp layer on top - original values, untouched
    target.push();
    target.drawingContext.filter = 'blur(1.2px)';
    target.imageMode(target.CENTER);
    target.image(buffer, 0, 0, drawSize, drawSize);
    target.drawingContext.filter = 'none';
    target.pop();

    target.pop();
}

// ===== KEY PERFORMANCE FIX =====
// All placed flowers get rendered ONCE onto this static layer.
// Every frame we just display this cached image - no blur, no loop, no filter at 60fps.
let flowersLayer = null;

function rebuildFlowersLayer(p) {
    if (!flowersLayer) {
        flowersLayer = p.createGraphics(p.width, p.height);
        // ✅ IMPORTANT: attach this canvas to the DOM (hidden) so ctx.filter (blur)
        // renders correctly. Chrome can glitch filter blur on fully detached canvases.
        flowersLayer.canvas.style.position = 'fixed';
        flowersLayer.canvas.style.left = '-99999px';
        flowersLayer.canvas.style.top = '0px';
        flowersLayer.canvas.style.pointerEvents = 'none';
        document.body.appendChild(flowersLayer.canvas);
    } else {
        flowersLayer.clear(); // wipe transparent, keep same canvas (avoids realloc)
    }
    const sorted = [...flowers].sort((a, b) => a.y - b.y);
    sorted.forEach(f => drawFlowerShape(flowersLayer, f.x, f.y, f.size, f.buffer, f.rotation));
}

let particles = [];

function drawParticles(p) {
    if (p.frameCount % 8 === 0 && particles.length < 30) {
        particles.push({
            x: p.random(p.width),
            y: p.random(p.height),
            vx: p.random(-0.3, 0.3),
            vy: p.random(-1, -0.3),
            life: 200,
            size: p.random(1.5, 3.5)
        });
    }
    for (let i = particles.length - 1; i >= 0; i--) {
        let part = particles[i];
        part.x += part.vx;
        part.y += part.vy;
        part.life -= 1.5;
        p.noStroke();
        p.fill(240, 220, 230, part.life);
        p.ellipse(part.x, part.y, part.size);
        if (part.life <= 0) particles.splice(i, 1);
    }
}

// hoa roi - dung <img> DOM giong landing page (unchanged)
let fallingPetals = [];
const PETAL_COUNT = 5;
const PETAL_SPACING = window.innerWidth / (PETAL_COUNT + 1);

function initFallingPetals() {
    for (let i = 0; i < PETAL_COUNT; i++) {
        const colorType = Math.random() < 0.5 ? 'pink' : 'yellow';
        const filename = colorType === 'pink' ? 'Hydrangea-pinkpetal.svg' : 'Hydrangea-yellowpetal.svg';

        const img = document.createElement('img');
        img.src = 'assets/' + filename;
        img.style.position = 'fixed';
        img.style.left = (PETAL_SPACING * (i + 1) + (Math.random() - 0.5) * 100) + 'px';
        img.style.top = (Math.random() * 150 - 200) + 'px';
        img.style.width = '48px';
        img.style.height = '48px';
        img.style.pointerEvents = 'none';
        img.style.zIndex = '3';
        document.body.appendChild(img);

        fallingPetals.push({
            el: img,
            x: parseFloat(img.style.left),
            y: parseFloat(img.style.top),
            speed: Math.random() * 0.5 + 2,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 4
        });
    }
}

function drawFallingPetals() {
    const angle = Math.PI * 115 / 180;
    fallingPetals.forEach(function(petal) {
        petal.y += petal.speed * Math.sin(angle);
        petal.x += petal.speed * Math.cos(angle);
        petal.rotation += petal.rotationSpeed;

        petal.el.style.top = petal.y + 'px';
        petal.el.style.left = petal.x + 'px';
        petal.el.style.transform = 'rotate(' + petal.rotation + 'deg)';

        const alpha = Math.max(0, Math.min(1, 1 - petal.y / window.innerHeight));
        petal.el.style.opacity = alpha;

        if (petal.y > window.innerHeight + 50) {
            petal.y = -100;
            petal.x = Math.random() * window.innerWidth;
            petal.el.style.left = petal.x + 'px';
            petal.rotation = Math.random() * 360;
        }
    });
}

initFallingPetals();

const sketch = (p) => {
    p.setup = async function() {
        p.createCanvas(window.innerWidth, window.innerHeight);
        p.smooth();
        createBgBuffer(p);
        try {
            landImg = await p.loadImage('assets/land.png');
        } catch (e) {
            console.log('land load failed (but continuing):', e);
        }
    };

    p.draw = function() {
        // Cached background - blit only, no per-pixel draw every frame
        if (bgBuffer) {
            p.image(bgBuffer, 0, 0);
        }

        drawFallingPetals();

        if (landImg && landImg.width > 0) {
            p.push();
            p.imageMode(p.CORNER);
            const landH = p.height * 0.45;
            const landW = landH * (landImg.width / landImg.height);
            const landX = (p.width - landW) / 2;
            const landY = p.height - landH + 160;
            p.image(landImg, landX, landY, landW, landH);
            p.pop();
        }

        // ✅ KEY FIX: just display the cached flowers layer, NO loop, NO blur, every frame
        if (flowersLayer) {
            p.image(flowersLayer, 0, 0);
        }

        drawParticles(p);
    };

    p.windowResized = function() {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
        createBgBuffer(p);
        rebuildFlowersLayer(p); // resize the cached layer to match new canvas size
    };
};

const mySketch = new p5(sketch);

function addFlower(forceType, forceShape) {
    const size = parseFloat(document.getElementById('flowerSize').value);
    const type = forceType || currentType;
    const fat = forceShape ? forceShape === 'fat' : (currentShape === 'fat');
    const buffer = getOrCreateFlowerBuffer(mySketch, type, fat);

    const groundY = mySketch.height * 0.9; // giữ nguyên đáy như code gốc

    flowers.push({
        x: mySketch.random(50, mySketch.width - 50),
        y: groundY - mySketch.random(20, 100), // dải cao giảm 1 nửa (160px -> 80px)
        size: size,
        buffer: buffer,
        rotation: mySketch.random(0, Math.PI * 2)
    });
    document.getElementById('flowerCountDisplay').textContent = flowers.length;
}

function randomGenerate() {
    for (let i = 0; i < 8; i++) {
        const randType = Math.floor(Math.random() * 4) + 1;
        const randShape = Math.random() > 0.5 ? 'fat' : 'thin';
        addFlower(randType, randShape);
    }
    rebuildFlowersLayer(mySketch); // rebuild once after all 8 are added, not per flower
}

// Build color swatches
const swatchContainer = document.getElementById('colorSwatches');
Object.keys(flowerTypes).forEach(key => {
    const colors = flowerTypes[key];
    const swatch = document.createElement('div');
    swatch.className = 'swatch' + (parseInt(key) === currentType ? ' active' : '');
    swatch.style.background = `radial-gradient(circle, rgb(${colors.center}), rgb(${colors.mid}), rgb(${colors.outer}))`;
    swatch.title = colors.label;
    swatch.addEventListener('click', () => {
        document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        currentType = parseInt(key);
    });
    swatchContainer.appendChild(swatch);
});

document.querySelectorAll('.shape-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentShape = this.dataset.shape;
    });
});

document.getElementById('flowerSize').addEventListener('input', function() {
    document.getElementById('sizeDisplay').textContent = parseFloat(this.value).toFixed(1);
});

document.getElementById('addFlower').addEventListener('click', () => {
    addFlower();
    rebuildFlowersLayer(mySketch); // rebuild once per click, not every frame
});
document.getElementById('addMultiple').addEventListener('click', function() {
    for (let i = 0; i < 5; i++) addFlower();
    rebuildFlowersLayer(mySketch); // rebuild once after all 5 are added
});
document.getElementById('randomGenerate').addEventListener('click', randomGenerate);

// ===== THEME TOGGLE =====
const themeToggleEl = document.getElementById('themeToggle');
const titleNav = document.getElementById('titleNav');
const body = document.body;

const savedTheme = localStorage.getItem('theme') || 'dark';
body.classList.add(savedTheme);
themeToggleEl.checked = savedTheme === 'light';
currentTheme = savedTheme;
updateTitleNav();

themeToggleEl.addEventListener('change', () => {
    const isLight = themeToggleEl.checked;
    body.classList.toggle('dark', !isLight);
    body.classList.toggle('light', isLight);
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    currentTheme = isLight ? 'light' : 'dark';
    createBgBuffer(mySketch);
    updateTitleNav();
});

function updateTitleNav() {
    const isLight = body.classList.contains('light');
    titleNav.src = isLight ? 'assets/title-light.svg' : 'assets/title.svg';
}   