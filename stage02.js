let flowers = [];
let currentFlowerKind = 'daisy';
let currentDaisyColor = 1;
let currentSvgColor = { hydrangea: 'pink', tulip: 'red' };
const flowerBuffers = {};

const flowerTypes = {
    1: { outer: [206, 97, 103], mid: [209, 193, 180], center: [86, 135, 167], stops: [0, 0.18, 0.8], label: 'Pink-Red' },
    2: { outer: [235, 230, 220], mid: [250, 220, 90], center: [230, 130, 70], stops: [0, 0.18, 0.4], label: 'White-Yellow' },
    3: { outer: [90, 140, 220], mid: [251, 141, 159], center: [243, 143, 152, 0.6], stops: [0, 0.18, 0.8], label: 'Blue-Pink' },
    4: { outer: [240, 150, 50], mid: [250, 220, 40], center: [150, 170, 210], stops: [0, 0.18, 0.8], label: 'Orange-Yellow' }
};

const SVG_FLOWER_ASSETS = {
    hydrangea: {
        blue:   { path: 'assets/hydrangea-blue.svg', colorHex: '#6a9fd8' },
        green:  { path: 'assets/hydrangea-green.svg', colorHex: '#8eba98' },
        pink:   { path: 'assets/hydrangea-pink.svg', colorHex: '#dd88b3' },
        yellow: { path: 'assets/hydrangea-yellow.svg', colorHex: '#e8c94a' }
    },
    tulip: {
        red:    { path: 'assets/tulip-red.svg', colorHex: '#d1495b' },
        yellow: { path: 'assets/tulip-yellow.svg', colorHex: '#f2c14e' },
        pink:   { path: 'assets/tulip-pink.svg', colorHex: '#e8a0bf' }
    }
};

const svgFlowerBuffers = {};

const bgPalettes = {
    dark: { bg1: '#0f0f0f', bg2: '#0f0f0f', ground: '#1f2a1f' },
    light: { bg1: '#fffaf5', bg2: '#fffaf5', ground: '#d4e8d4' }
};
let currentTheme = 'dark';

let bgBuffer = null;
function createBgBuffer(p) {
    bgBuffer = p.createGraphics(p.width, p.height);
    bgBuffer.pixelDensity(1);
    bgBuffer.background(bgPalettes[currentTheme].bg1);
}

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

function loadSvgAsBuffer(p, path, bufSize = 260) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const buf = p.createGraphics(bufSize, bufSize);
            buf.pixelDensity(1);
            const ratio = Math.min(bufSize / img.width, bufSize / img.height);
            const w = img.width * ratio;
            const h = img.height * ratio;
            const dx = (bufSize - w) / 2;
            const dy = (bufSize - h) / 2;
            buf.drawingContext.drawImage(img, dx, dy, w, h);
            resolve(buf);
        };
        img.onerror = (e) => reject(e);
        img.src = path;
    });
}

async function getOrCreateSvgBuffer(p, kind, colorKey) {
    const key = `${kind}_${colorKey}`;
    if (svgFlowerBuffers[key]) return svgFlowerBuffers[key];

    const asset = SVG_FLOWER_ASSETS[kind] && SVG_FLOWER_ASSETS[kind][colorKey];
    if (!asset) {
        console.log(`Không tìm thấy asset cho ${kind}/${colorKey}`);
        return null;
    }
    try {
        const buf = await loadSvgAsBuffer(p, asset.path);
        svgFlowerBuffers[key] = buf;
        return buf;
    } catch (e) {
        console.log(`SVG ${asset.path} chưa tồn tại hoặc load lỗi (bình thường nếu bạn chưa thêm file):`, e);
        return null;
    }
}

// ---- Blur glow được "nướng" sẵn 1 lần cho mỗi loại hoa ----
// Trước đây mỗi bông mỗi frame chạy 2 lần ctx.filter = blur(...) -> rất nặng.
// Giờ: blur 1 lần khi buffer được dùng lần đầu, sau đó mỗi bông chỉ 1 lần image().
const GLOW_BASE = 260 * 0.9;  // kích thước vẽ khi size = 1 (giữ đúng như cũ)
const GLOW_PAD = 36;          // chừa viền cho vệt blur khỏi bị cắt
const glowCache = new WeakMap();

function getGlowBuffer(p, src) {
    let baked = glowCache.get(src);
    if (baked) return baked;

    const S = Math.ceil(GLOW_BASE + GLOW_PAD * 2);
    baked = p.createGraphics(S, S);
    baked.pixelDensity(1);
    const ctx = baked.drawingContext;

    ctx.filter = 'blur(10px)';
    ctx.drawImage(src.canvas, GLOW_PAD, GLOW_PAD, GLOW_BASE, GLOW_BASE);
    ctx.filter = 'blur(1.2px)';
    ctx.drawImage(src.canvas, GLOW_PAD, GLOW_PAD, GLOW_BASE, GLOW_BASE);
    ctx.filter = 'none';

    glowCache.set(src, baked);
    return baked;
}

function drawFlowerShape(target, cx, cy, size, buffer, rotation) {
    const baked = getGlowBuffer(target, buffer);
    const drawSize = baked.width * size;

    target.push();
    target.translate(cx, cy);
    target.rotate(rotation);
    target.imageMode(target.CENTER);
    target.image(baked, 0, 0, drawSize, drawSize);
    target.pop();
}

// ================================================================
// Hoa BAY LẮC nhẹ liên tục (giống hoa trang trí bên landing) — mỗi
// frame vẽ lại ở vị trí lắc mới, không bake tĩnh. Nhẹ vì blur đã bake
// sẵn (getGlowBuffer), mỗi bông chỉ tốn 1 lần image() mỗi frame.
// `flowers` luôn được giữ đúng thứ tự click (sort 1 lần lúc thêm hoa),
// nên ở đây chỉ cần vẽ lần lượt: hoa click sau nằm trên cùng.
// ================================================================
function drawAllFlowers(p) {
    flowers.forEach(f => {
        const t = p.frameCount * 0.02 + f.floatPhase;
        const floatY = Math.sin(t) * f.floatAmp;            // lên xuống rất nhẹ, vài px
        const floatRot = Math.sin(t * 0.7) * f.floatRotAmp; // xoay nhẹ
        drawFlowerShape(p, f.x, f.baseY + floatY, f.size, f.buffer, f.rotation + floatRot);
    });
}

let particles = [];
const PARTICLE_COLORS = [
    [220, 118, 163],
    [60, 109, 187],
    [249, 234, 147],
    [142, 186, 152]
];

function drawParticles(p) {
    if (p.frameCount % 8 === 0 && particles.length < 30) {
        particles.push({
            x: p.random(p.width),
            y: p.random(p.height),
            vx: p.random(-0.3, 0.3),
            vy: p.random(-1, -0.3),
            life: 200,
            size: p.random(4, 8),
            color: PARTICLE_COLORS[Math.floor(p.random(PARTICLE_COLORS.length))]
        });
    }
    for (let i = particles.length - 1; i >= 0; i--) {
        let part = particles[i];
        part.x += part.vx;
        part.y += part.vy;
        part.life -= 1.5;
        p.noStroke();
        const [r, g, b] = part.color;
        p.drawingContext.shadowBlur = 6;
        p.drawingContext.shadowColor = `rgba(${r}, ${g}, ${b}, ${part.life / 255})`;
        p.fill(r, g, b, part.life);
        p.ellipse(part.x, part.y, part.size);
        if (part.life <= 0) particles.splice(i, 1);
    }
    p.drawingContext.shadowBlur = 0;
}

// hoa roi
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
        const startX = PETAL_SPACING * (i + 1) + (Math.random() - 0.5) * 100;
        const startY = Math.random() * 150 - 200;
        img.style.left = '0px';
        img.style.top = '0px';
        img.style.willChange = 'transform, opacity';
        img.style.width = '48px';
        img.style.height = '48px';
        img.style.pointerEvents = 'none';
        img.style.zIndex = '3';
        document.body.appendChild(img);

        fallingPetals.push({
            el: img,
            x: startX,
            y: startY,
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

        petal.el.style.transform =
            'translate(' + petal.x + 'px, ' + petal.y + 'px) rotate(' + petal.rotation + 'deg)';

        const alpha = Math.max(0, Math.min(1, 1 - petal.y / window.innerHeight));
        petal.el.style.opacity = alpha;

        if (petal.y > window.innerHeight + 50) {
            petal.y = -100;
            petal.x = Math.random() * window.innerWidth;
            petal.rotation = Math.random() * 360;
        }
    });
}

initFallingPetals();

// Panel điều khiển góc trên phải — click trong đó thì KHÔNG tạo hoa.
function isMouseOverPanel(mx, my) {
    const panel = document.querySelector('.panel');
    if (!panel) return false;
    const rect = panel.getBoundingClientRect();
    return mx >= rect.left && mx <= rect.right && my >= rect.top && my <= rect.bottom;
}

// Màn retina (Mac) có devicePixelRatio = 2 -> canvas nhiều pixel gấp 4 lần.
// Hoa vốn đã mềm/blur nên hạ xuống 1 gần như không thấy khác mà nhẹ hơn nhiều.
// Muốn nét hơn thì tăng (1.5 hoặc 2), muốn nhẹ hơn nữa thì giữ 1.
const MAX_PIXEL_DENSITY = 1;

// ===== PERF HUD: mở trang với ?perf (vd stage02.html?perf) để xem FPS =====
// "JS ms" là thời gian JS tốn để ra lệnh vẽ. FPS thấp mà JS ms thấp => nghẽn ở GPU/pixel.
const PERF_HUD = new URLSearchParams(location.search).has('perf');
let perfEl = null, perfFrames = 0, perfSince = 0, perfFlowerMs = 0, perfParticleMs = 0;

function perfTick(flowerMs, particleMs) {
    const now = performance.now();
    if (!perfEl) {
        perfEl = document.createElement('div');
        perfEl.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:300;padding:6px 8px;' +
            'font:12px monospace;color:#0f0;background:rgba(0,0,0,.7);pointer-events:none;white-space:pre';
        document.body.appendChild(perfEl);
        perfSince = now;
    }
    perfFrames++;
    perfFlowerMs += flowerMs;
    perfParticleMs += particleMs;
    if (now - perfSince >= 500) {
        const fps = perfFrames * 1000 / (now - perfSince);
        perfEl.textContent =
            'FPS ' + fps.toFixed(0) + '  |  hoa ' + flowers.length + '\n' +
            'JS hoa ' + (perfFlowerMs / perfFrames).toFixed(2) + ' ms\n' +
            'JS hat ' + (perfParticleMs / perfFrames).toFixed(2) + ' ms';
        perfFrames = 0; perfFlowerMs = 0; perfParticleMs = 0; perfSince = now;
    }
}

const sketch = (p) => {
    p.setup = function() {
        p.pixelDensity(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_DENSITY));
        p.createCanvas(window.innerWidth, window.innerHeight);
        p.smooth();
        createBgBuffer(p);
    };

    p.draw = function() {
        p.background(bgPalettes[currentTheme].bg1);
        drawFallingPetals();

        const t1 = PERF_HUD ? performance.now() : 0;
        drawAllFlowers(p); // vẽ trực tiếp mỗi frame (có lắc), không dùng layer tĩnh nữa
        const t2 = PERF_HUD ? performance.now() : 0;
        drawParticles(p);
        if (PERF_HUD) perfTick(t2 - t1, performance.now() - t2);
    };

    // Click chuột lên canvas -> tạo 1 hoa tại đúng vị trí click
    p.mousePressed = function() {
        if (isMouseOverPanel(p.mouseX, p.mouseY)) return; // đừng tạo hoa khi bấm trong panel
        addFlowerAt(p.mouseX, p.mouseY);
    };

    p.windowResized = function() {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
        createBgBuffer(p);
    };
};

const mySketch = new p5(sketch);

// ================================================================
// Tạo hoa TẠI vị trí (x, y) — dùng khi click chuột lên canvas.
// ================================================================
let randomMode = false;
let flowerOrderCounter = 0;
const FLOWER_KINDS = ['daisy', 'hydrangea', 'tulip'];

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function addFlowerAt(x, y) {
    const order = flowerOrderCounter++; // gán thứ tự lúc click, trước mọi await
    // Mặc định: dùng đúng lựa chọn đang chọn trên panel (nguyên bản).
    let kind = currentFlowerKind;
    let daisyColor = currentDaisyColor;
    let svgColorKey = currentSvgColor[currentFlowerKind];

    // Random ON: mỗi click random loại hoa + màu (size vẫn theo slider).
    if (randomMode) {
        kind = pickRandom(FLOWER_KINDS);
        if (kind === 'daisy') {
            daisyColor = parseInt(pickRandom(Object.keys(flowerTypes)));
        } else {
            svgColorKey = pickRandom(Object.keys(SVG_FLOWER_ASSETS[kind]));
        }
    }

    const rawSize = parseFloat(document.getElementById('flowerSize').value);
    const TULIP_SIZE_FACTOR = 0.65;
    const size = kind === 'tulip' ? rawSize * TULIP_SIZE_FACTOR : rawSize;
    let buffer;

    if (kind === 'daisy') {
        const fat = Math.random() > 0.5;
        buffer = getOrCreateFlowerBuffer(mySketch, daisyColor, fat);
    } else {
        buffer = await getOrCreateSvgBuffer(mySketch, kind, svgColorKey);
        if (!buffer) {
            console.log(`Chưa có SVG cho ${kind}/${svgColorKey}, bỏ qua.`);
            return;
        }
    }

    const rotation = kind === 'tulip'
        ? mySketch.random(-0.26, 0.26) // ~±15 độ
        : mySketch.random(0, Math.PI * 2);

    flowers.push({
        order: order,
        x: x,
        baseY: y, // vị trí gốc; lắc nhẹ quanh baseY mỗi frame
        size: size,
        buffer: buffer,
        rotation: rotation,
        // tham số lắc — rất nhẹ giống landing (chỉ vài px)
        floatPhase: mySketch.random(0, Math.PI * 2),
        floatAmp: mySketch.random(3, 6),        // biên độ lên xuống (px)
        floatRotAmp: mySketch.random(0.02, 0.05) // biên độ xoay (rad, rất nhỏ)
    });
    flowers.sort((a, b) => a.order - b.order); // giữ đúng thứ tự click (SVG load chậm có thể push trễ)
    document.getElementById('flowerCountDisplay').textContent = flowers.length;
    checkPoem();
}

// ================================================================
// FLOWER TYPE BUTTONS
// ================================================================
const flowerTypeButtons = document.getElementById('flowerTypeButtons');
flowerTypeButtons.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        flowerTypeButtons.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFlowerKind = btn.dataset.flowerType;
        rebuildColorSwatches();
    });
});

// ================================================================
// COLOR SWATCHES
// ================================================================
const swatchContainer = document.getElementById('colorSwatches');

function rebuildColorSwatches() {
    swatchContainer.innerHTML = '';

    if (currentFlowerKind === 'daisy') {
        Object.keys(flowerTypes).forEach(key => {
            const colors = flowerTypes[key];
            const swatch = document.createElement('div');
            swatch.className = 'swatch' + (parseInt(key) === currentDaisyColor ? ' active' : '');
            swatch.style.background = `radial-gradient(circle, rgb(${colors.center}), rgb(${colors.mid}), rgb(${colors.outer}))`;
            swatch.title = colors.label;
            swatch.addEventListener('click', () => {
                swatchContainer.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
                currentDaisyColor = parseInt(key);
            });
            swatchContainer.appendChild(swatch);
        });
    } else {
        const colorMap = SVG_FLOWER_ASSETS[currentFlowerKind];
        Object.keys(colorMap).forEach(colorKey => {
            const asset = colorMap[colorKey];
            const swatch = document.createElement('div');
            swatch.className = 'swatch' + (colorKey === currentSvgColor[currentFlowerKind] ? ' active' : '');
            swatch.style.background = asset.colorHex;
            swatch.title = colorKey;
            swatch.addEventListener('click', () => {
                swatchContainer.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
                currentSvgColor[currentFlowerKind] = colorKey;
            });
            swatchContainer.appendChild(swatch);
        });
    }
}

rebuildColorSwatches();

// ===== POEM: câu chữ hiện TỪNG CHỮ sau khi đủ số hoa =====
const POEM_THRESHOLD = 10;      // số hoa cần tạo để bắt đầu
const POEM_START_DELAY = 1500;  // ms chờ trước khi câu đầu tiên hiện
const POEM_WORD_FADE_IN = 1400; // ms mỗi chữ fade in (càng lớn càng chậm)
const POEM_WORD_STAGGER = 500;  // ms cách nhau giữa 2 chữ liên tiếp
const POEM_LINE_PAUSE = 500;    // ms nghỉ thêm khi xuống dòng mới
const POEM_HOLD = 4000;         // ms giữ nguyên sau khi chữ cuối hiện xong
const POEM_FADE_OUT = 3500;     // ms fade out (cả câu cùng mờ, không tan biến)
const POEM_GAP = 3000;          // ms nghỉ giữa 2 câu
const POEM_LOOP = true;         // hết câu cuối thì quay lại câu đầu

// Cú pháp chữ: từ thường = regular | *từ = accent | ~từ = accent small | _từ = regular small
// top/left tính theo khung 1920x1080 (gốc ở góc trên trái; top tăng = xuống, left tăng = sang phải).
// Câu 1 theo ảnh mẫu, câu 2-3 là chữ tạm — bạn thay bằng nội dung thật.
const POEM_SENTENCES = [
    [
        { top: 270, left: 108, text: 'When a flower *blooms' },
        { top: 370, left: 262, text: 'it does not simply reach its peak and then ~fade' }
    ],
    [
        { top: 300, left: 180, text: 'Its' },
        { top: 350, left: 240, text: '~begining already holds the traces of its *ending' }
    ],
    [
        { top: 300, left: 180, text: 'As it fades, it ~carries the ~beginning' },
        { top: 385, left: 220, text: 'of what *comes *next' }
    ],

    [
        { top: 300, left: 180, text: 'Blooming, fading, giving birth, and growing' },
        { top: 370, left: 230, text: 'are ~not *separate moments' }
    ],

    [
        { top: 300, left: 180, text: 'They *happen' },
        { top: 450, left: 280, text: 'all *at *once' }
    ]
];

let poemStarted = false;

function updatePoemScale() {
    let scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    if (scale > 0.97 && scale < 1.03) scale = 1;
    document.documentElement.style.setProperty('--poem-scale', scale);
}
updatePoemScale();
window.addEventListener('resize', updatePoemScale);

function parsePoemWord(token) {
    const marks = { '*': 'accent', '~': 'accent small', '_': 'regular small' };
    const first = token.charAt(0);
    if (marks[first]) return { cls: marks[first], text: token.slice(1) };
    return { cls: 'regular', text: token };
}

// Trả về sentences[câu][dòng] = mảng các <span> chữ
function buildPoem() {
    const wrap = document.createElement('div');
    wrap.id = 'poem';

    const sentences = POEM_SENTENCES.map((lines, si) => lines.map((line, li) => {
        const el = document.createElement('div');
        el.className = 'poem-line';
        el.style.top = line.top + 'px';
        el.style.left = line.left + 'px';

        const words = line.text.split(' ').filter(Boolean).map((token, wi) => {
            const w = parsePoemWord(token);
            const span = document.createElement('span');
            span.className = 'poem-word ' + w.cls;
            span.dataset.id = `s${si + 1}-l${li + 1}-w${wi + 1}`; // để chỉnh riêng bằng CSS
            span.textContent = w.text;
            el.appendChild(span);
            return span;
        });

        wrap.appendChild(el);
        return words;
    }));

    return { wrap, sentences };
}

const poemSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runPoem() {
    const poem = buildPoem();
    document.body.appendChild(poem.wrap);

    await poemSleep(POEM_START_DELAY);

    let i = 0;
    while (true) {
        const lines = poem.sentences[i];
        const allWords = lines.flat();

        // fade in từng chữ, chậm
        for (const line of lines) {
            for (const word of line) {
                word.style.setProperty('--fade', POEM_WORD_FADE_IN + 'ms');
                word.classList.add('show');
                await poemSleep(POEM_WORD_STAGGER);
            }
            await poemSleep(POEM_LINE_PAUSE);
        }
        await poemSleep(POEM_WORD_FADE_IN + POEM_HOLD);

        // fade out chậm (cả câu cùng mờ đi, không tan)
        allWords.forEach(word => {
            word.style.setProperty('--fade', POEM_FADE_OUT + 'ms');
            word.classList.remove('show');
        });
        await poemSleep(POEM_FADE_OUT + POEM_GAP);

        i++;
        if (i >= poem.sentences.length) {
            if (!POEM_LOOP) break;
            i = 0;
        }
    }
}

function checkPoem() {
    if (!poemStarted && flowers.length >= POEM_THRESHOLD) {
        poemStarted = true;
        runPoem();
    }
}

// ===== RANDOM GENERATED TOGGLE =====
const randomToggleBtn = document.getElementById('randomToggle');
randomToggleBtn.addEventListener('click', () => {
    randomMode = !randomMode;
    randomToggleBtn.classList.toggle('active', randomMode);
    randomToggleBtn.textContent = randomMode ? 'ON' : 'OFF';
});

document.getElementById('flowerSize').addEventListener('input', function() {
    document.getElementById('sizeDisplay').textContent = parseFloat(this.value).toFixed(1);
});

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