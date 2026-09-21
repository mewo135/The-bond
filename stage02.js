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
    dark: { bg1: '#000000', bg2: '#000000', ground: '#1f2a1f' },
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

// gray: 0 = màu gốc, 1 = xám hoàn toàn. Vẽ ĐÚNG 1 lần (kèm filter grayscale) nên viền blur của hoa
// giữ nguyên suốt quá trình xám. (Trước đây vẽ 2 lớp màu + xám chồng lên nhau: viền blur đậm lên rồi
// tụt xuống lúc xám xong -> bị khựng.)
function drawFlowerShape(target, cx, cy, size, buffer, rotation, alpha = 1, gray = 0) {
    const baked = getGlowBuffer(target, buffer);
    const drawSize = baked.width * size;
    const ctx = target.drawingContext;

    target.push();
    target.translate(cx, cy);
    target.rotate(rotation);
    target.imageMode(target.CENTER);
    ctx.globalAlpha = alpha;
    if (gray > 0) ctx.filter = 'grayscale(' + gray + ')';
    target.image(baked, 0, 0, drawSize, drawSize);
    if (gray > 0) ctx.filter = 'none';
    ctx.globalAlpha = 1;
    target.pop();
}

const WILT_AT_10 = 3;          
const WILT_AT_20 = 9;          
const WILT_MAX_FRACTION = 0.5;  
const WILT_KEEP_MIN = 5;        
const WILT_START_DELAY = 4000; 
const WILT_SPREAD = 0.9;        // các lần héo được rải đều tới 90% độ dài bài thơ (tính từ lúc đủ hoa)
const WILT_MS = 8000;         
const WILT_END_SCALE = 0.3;     // cỡ lúc gần biến mất (so với cỡ ban đầu)
// Cửa sổ của từng giai đoạn, tính theo tỉ lệ 0..1 của WILT_MS (các cửa sổ chồng lên nhau -> mượt)
const WILT_GRAY_WIN   = [0, 0.3];     // hoá xám
const WILT_SHRINK_WIN = [0.2, 0.7];     // nhỏ lại (bắt đầu khi đã xám được 20%)
const WILT_FADE_WIN   = [0.5, 0.7];     // mờ dần, xong đúng lúc biến mất

let wiltQueue = []; // các mốc thời gian (ms) sẽ có 1 bông bắt đầu héo

function smoother(u) { return u * u * u * (u * (u * 6 - 15) + 10); } // ease-in-out mượt hơn smoothstep
function wiltWin(u, win) { return smoother(clamp01((u - win[0]) / (win[1] - win[0]))); }

// Ước lượng độ dài bài thơ (ms) từ đúng các hằng số POEM_* để rải lịch héo cho khớp
function estimatePoemMs() {
    let ms = POEM_START_DELAY;
    for (const lines of POEM_SENTENCES) {
        const words = lines.reduce((n, l) => n + l.text.split(' ').filter(Boolean).length, 0);
        ms += words * POEM_WORD_STAGGER + lines.length * POEM_LINE_PAUSE
            + POEM_WORD_FADE_IN + POEM_HOLD + POEM_FADE_OUT + POEM_GAP;
    }
    return ms;
}

// Trạng thái héo của 1 bông tại thời điểm `now` -> { gray, scale, alpha } (hệ số nhân lên cỡ / độ mờ gốc)
function getWilt(f, now) {
    const u = clamp01((now - f.wiltStart) / WILT_MS);
    const gray = wiltWin(u, WILT_GRAY_WIN);
    const shrink = wiltWin(u, WILT_SHRINK_WIN);
    const fade = wiltWin(u, WILT_FADE_WIN);
    return { gray, scale: 1 - (1 - WILT_END_SCALE) * shrink, alpha: 1 - fade };
}

// Lập lịch: k mốc héo rải đều (nhưng ngẫu nhiên trong từng đoạn) suốt bài thơ
function startWiltWave() {
    if (endState !== 'planting' && endState !== 'ready') return;
    const now = performance.now();
    const n = flowers.length;
    const slope = (WILT_AT_20 - WILT_AT_10) / 10;
    const k = Math.max(1, Math.min(Math.floor(n * WILT_MAX_FRACTION), Math.round(WILT_AT_10 + (n - 10) * slope)));
    const span = Math.max(1000, estimatePoemMs() * WILT_SPREAD - WILT_START_DELAY);
    wiltQueue = [];
    for (let i = 0; i < k; i++) {
        wiltQueue.push(now + WILT_START_DELAY + (i + Math.random()) * span / k);
    }
}

// Chạy mỗi frame (độc lập với state ending): tới giờ thì cho 1 bông khoẻ héo; héo xong thì gỡ bông đó
function updateWilt(now) {
    while (wiltQueue.length && now >= wiltQueue[0]) {
        wiltQueue.shift();
        if (endState !== 'planting' && endState !== 'ready') { wiltQueue.length = 0; break; }
        // chỉ chọn bông đang khoẻ, và đã mọc xong (hoa con mới mọc chưa được héo ngay)
        const healthy = flowers.filter(f => f.wiltStart === undefined &&
            (f.growStart === undefined || now > f.growStart + END_GROW));
        if (healthy.length <= WILT_KEEP_MIN) continue;
        const f = healthy[(Math.random() * healthy.length) | 0];
        f.wiltStart = now;
        f.wiltEnd = now + WILT_MS;
    }

    let removed = false;
    for (let i = flowers.length - 1; i >= 0; i--) {
        if (flowers[i].wiltEnd !== undefined && now >= flowers[i].wiltEnd) {
            flowers.splice(i, 1);
            removed = true;
        }
    }
    if (removed) updateFlowerCount();
}

// ================================================================
// Hoa BAY LẮC nhẹ liên tục (giống hoa trang trí bên landing) — mỗi
// frame vẽ lại ở vị trí lắc mới, không bake tĩnh. Nhẹ vì blur đã bake
// sẵn (getGlowBuffer), mỗi bông chỉ tốn 1 lần image() mỗi frame.
// `flowers` luôn được giữ đúng thứ tự click (sort 1 lần lúc thêm hoa),
// nên ở đây chỉ cần vẽ lần lượt: hoa click sau nằm trên cùng.
// ================================================================
function drawAllFlowers(p, now) {
    flowers.forEach(f => {
        const t = p.frameCount * 0.02 + f.floatPhase;
        const floatY = Math.sin(t) * f.floatAmp;            // lên xuống rất nhẹ, vài px
        const floatRot = Math.sin(t * 0.7) * f.floatRotAmp; // xoay nhẹ

        let size = f.size;
        let alpha = 1;
        if (f.dissolveStart !== undefined && now > f.dissolveStart) {
            // đang tan thành dust: mờ dần
            alpha = 1 - easeInOut(clamp01((now - f.dissolveStart) / END_FLOWER_FADE));
        }
        if (f.growStart !== undefined) {
            // hoa mới mọc từ dust: nhỏ -> to, mờ -> rõ
            const g = clamp01((now - f.growStart) / END_GROW);
            if (g <= 0) return;
            size = f.size * (0.15 + 0.85 * easeOutCubic(g));
            alpha = Math.min(1, g * 1.8);
        }
        let gray = 0;
        if (f.wiltStart !== undefined && now >= f.wiltStart) {
            // đang héo: (xám ->) nhỏ lại -> mờ dần
            const w = getWilt(f, now);
            size *= w.scale;
            alpha *= w.alpha;
            gray = w.gray;
        }
        if (alpha <= 0) return;

        drawFlowerShape(p, f.x, f.baseY + floatY, size, f.buffer, f.rotation + floatRot, alpha, gray);
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

// ================================================================
// ENDING: bấm E / ENTER -> tất cả hoa tan thành dust -> mỗi bông cũ
// cho dust bay về 2 điểm quanh nó -> 2 hoa con mọc (N bông -> 2N bông,
// tối đa END_MAX_FLOWERS) -> hiện "N to grow again / H to return".
// Các state: planting -> ready -> dissolving -> growing -> done -> (N) planting
// ================================================================
const END_DISSOLVE_STAGGER = 1400; // ms: các bông bắt đầu tan rải rác trong khoảng này
const END_FLOWER_FADE = 2200;      // ms: mỗi bông mờ hẳn
const END_DUST_MAX = 1400;         // tổng số hạt dust tối đa lúc tan (chia đều theo số hoa)
const END_SEED_DUST = 55;          // số hạt dust bay về mỗi hoa con (tối đa; tự giảm khi có nhiều hoa con)
const END_GATHER_DUST_MAX = 600;   // tổng số hạt dust bay-về tối đa cho cả vườn (chia đều theo số hoa con)
const END_GATHER = 2600;           // ms: dust bay về điểm mọc
const END_GROW = 3200;             // ms: hoa mới mọc từ nhỏ -> to
const END_OUTRO_DELAY = 800;       // ms: nghỉ sau khi hoa mọc xong rồi mới hiện chữ N / H
// ---- Hoa con mọc quanh hoa mẹ ----
const END_MAX_FLOWERS = 60;        // TRẦN số hoa sau mỗi lần nhân đôi (tránh lag). Vượt trần thì chỉ một phần hoa mẹ có 2 con / 1 con / 0 con
const END_CHILD_DIST_MIN = 70;     // px: hoa con cách hoa mẹ tối thiểu
const END_CHILD_DIST_MAX = 140;    // px: ...và tối đa
const END_CHILD_SIZE_JITTER = 0.15; // cỡ hoa con dao động ±15% quanh cỡ hoa mẹ
const END_GATHER_LEAD = 600;       // ms: dust bắt đầu bay về sớm hơn lúc hoa mẹ mờ hẳn chừng này -> hoa con mọc nối tiếp, mượt
const END_CHILD_GROW_JITTER = 300; // ms: lệch nhẹ giữa các hoa con để không nở đồng loạt

let endState = 'planting';
let endT0 = 0;
let endDoneAt = Infinity;
let dust = [];
let dustLastT = 0;
let endMothers = [];      // các bông hoa cũ đang tan
let endMotherCount = 0;   // số hoa cũ lúc bấm E (dùng chia dust)
let endChildTotal = 0;    // tổng số hoa con sẽ mọc
let endKidsPending = 0;   // số hoa mẹ đang dựng hoa con (async)
let endLatestGrow = 0;    // thời điểm hoa con cuối cùng bắt đầu mọc

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function easeInOut(u) { return u * u * (3 - 2 * u); }
function easeOutCubic(u) { return 1 - Math.pow(1 - u, 3); }

// Điểm mẫu trên hình bông hoa (toạ độ trong buffer 260x260) + màu thật tại điểm đó,
// để dust có đúng hình dạng và màu của bông hoa. Cache theo buffer.
const sampleCache = new WeakMap();
function getFlowerSamples(src, fallbackColors) {
    let samples = sampleCache.get(src);
    if (samples) return samples;

    samples = [];
    try {
        const w = src.canvas.width, h = src.canvas.height;
        const data = src.drawingContext.getImageData(0, 0, w, h).data;
        for (let y = 0; y < h; y += 5) {
            for (let x = 0; x < w; x += 5) {
                const i = (y * w + x) * 4;
                if (data[i + 3] > 120) {
                    samples.push({ x, y, css: `rgb(${data[i]}, ${data[i + 1]}, ${data[i + 2]})` });
                }
            }
        }
    } catch (e) {
        samples = []; // canvas bị "tainted" (mở bằng file://) -> dùng cách dự phòng bên dưới
    }
    if (!samples.length) {
        for (let k = 0; k < 200; k++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * 95;
            samples.push({ x: 130 + Math.cos(a) * r, y: 130 + Math.sin(a) * r, css: pickRandom(fallbackColors) });
        }
    }
    sampleCache.set(src, samples);
    return samples;
}

// Rải dust từ đúng hình dáng bông hoa (tại vị trí/độ xoay hiện tại của nó)
function spawnDust(f, now) {
    const samples = getFlowerSamples(f.buffer, f.dustColors);
    const per = Math.max(3, Math.min(28, Math.floor(END_DUST_MAX / Math.max(1, endMotherCount))));

    const t = mySketch.frameCount * 0.02 + f.floatPhase;
    const cy = f.baseY + Math.sin(t) * f.floatAmp;
    const rot = f.rotation + Math.sin(t * 0.7) * f.floatRotAmp;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const k = 0.9 * f.size; // buffer 260px -> kích thước vẽ (khớp GLOW_BASE / 260)

    for (let i = 0; i < per; i++) {
        const sm = samples[(Math.random() * samples.length) | 0];
        const lx = (sm.x - 130) * k, ly = (sm.y - 130) * k;
        dust.push({
            x: f.x + lx * cos - ly * sin,
            y: cy + lx * sin + ly * cos,
            vx: (Math.random() - 0.5) * 0.5 + lx * 0.002,
            vy: -(0.2 + Math.random() * 0.8),
            size: 1 + Math.random() * 2,
            css: sm.css,
            born: now,
            life: 2800 + Math.random() * 1800,
            phase: Math.random() * Math.PI * 2
        });
    }
}

function drawDust(p, now) {
    const dt = dustLastT ? now - dustLastT : 16.667;
    dustLastT = now;
    if (!dust.length) return;
    const dtScale = Math.min(3, dt / 16.667); // giữ tốc độ đều trên màn 60Hz / 120Hz

    const ctx = p.drawingContext;
    ctx.save();
    for (let i = dust.length - 1; i >= 0; i--) {
        const d = dust[i];
        let alpha;

        if (d.home) {
            // dust bay về điểm mọc hoa mới
            const h = d.home;
            const u = clamp01((now - h.start) / h.dur);
            const e = easeInOut(u);
            const sway = 6 * (1 - u);
            d.x = h.sx + (h.tx - h.sx) * e + Math.sin(now * 0.004 + d.phase) * sway;
            d.y = h.sy + (h.ty - h.sy) * e + Math.cos(now * 0.004 + d.phase) * sway;
            alpha = Math.min(1, u / 0.2) * (u < 0.85 ? 1 : 1 - (u - 0.85) / 0.15);
            if (u >= 1) { dust[i] = dust[dust.length - 1]; dust.pop(); continue; }
        } else {
            // dust từ hoa cũ: bay lên nhẹ, lắc lư, mờ dần
            const age = now - d.born;
            if (age >= d.life) { dust[i] = dust[dust.length - 1]; dust.pop(); continue; }
            d.x += (d.vx + Math.sin(now * 0.002 + d.phase) * 0.15) * dtScale;
            d.y += d.vy * dtScale;
            alpha = Math.pow(1 - age / d.life, 1.3);
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle = d.css;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function startEnding() {
    endState = 'dissolving';
    endT0 = performance.now();
    endDoneAt = Infinity;
    endLatestGrow = 0;
    endKidsPending = 0;
    poemHideLines(getPoemDom().finale, 1600);

    wiltQueue.length = 0; // huỷ các lần héo chưa tới giờ
    endMothers = flowers.filter(f => f.wiltStart === undefined); // hoa đang héo cứ để héo nốt, không sinh con
    endMotherCount = endMothers.length;

    // Chia số hoa con: tổng = min(2N, trần). Nếu 2N vượt trần thì chọn ngẫu nhiên
    // những bông mẹ được 2 con, số còn lại được 1 hoặc 0 con.
    endChildTotal = Math.min(endMotherCount * 2, END_MAX_FLOWERS);
    if (endMotherCount) {
        const base = Math.floor(endChildTotal / endMotherCount);
        const extra = endChildTotal - base * endMotherCount;
        endMothers.slice().sort(() => Math.random() - 0.5).forEach((m, i) => {
            m.childCount = base + (i < extra ? 1 : 0);
        });
    }

    endMothers.forEach(f => {
        f.dissolveStart = endT0 + Math.random() * END_DISSOLVE_STAGGER;
        f.dustSpawned = false;
        f.kidsSpawned = false;
        f.removed = false;
        delete f.growStart; // hoa con của lượt trước còn growStart -> nếu giữ thì không mờ đi được
    });
}

function removeFlower(f) {
    const i = flowers.indexOf(f);
    if (i >= 0) flowers.splice(i, 1);
}

// Chọn vị trí hoa con: cách hoa mẹ 70-140px theo hướng `angle`; nếu ra ngoài màn hình
// hoặc đè lên panel thì thử hướng khác (tối đa 8 lần), cuối cùng thì kẹp vào trong màn hình.
function pickChildPos(m, angle) {
    const W = window.innerWidth, H = window.innerHeight;
    const margin = 50;
    const panel = document.querySelector('.panel');
    const pr = panel ? panel.getBoundingClientRect() : null;
    let x = m.x, y = m.baseY;
    for (let tries = 0; tries < 8; tries++) {
        const a = tries === 0 ? angle : Math.random() * Math.PI * 2;
        const d = END_CHILD_DIST_MIN + Math.random() * (END_CHILD_DIST_MAX - END_CHILD_DIST_MIN);
        x = m.x + Math.cos(a) * d;
        y = m.baseY + Math.sin(a) * d;
        if (x < margin || x > W - margin || y < margin || y > H - margin) continue;
        if (pr && x > pr.left - 40 && x < pr.right + 40 && y > pr.top - 40 && y < pr.bottom + 40) continue;
        return { x, y };
    }
    return { x: Math.max(margin, Math.min(W - margin, x)), y: Math.max(margin, Math.min(H - margin, y)) };
}

// Hoa mẹ sắp tan hết -> dựng hoa con (cùng loại + màu, cỡ dao động nhẹ) + cho dust
// từ chỗ hoa mẹ bay về chỗ hoa con.
async function spawnChildren(m) {
    const count = m.childCount || 0;
    if (!count) return;

    const dustPer = Math.max(8, Math.min(END_SEED_DUST, Math.floor(END_GATHER_DUST_MAX / Math.max(1, endChildTotal))));
    const a0 = Math.random() * Math.PI * 2;

    for (let i = 0; i < count; i++) {
        // 2 con thì tách về 2 phía gần đối nhau cho vườn thoáng; 1 con thì hướng ngẫu nhiên
        const angle = a0 + i * Math.PI + (Math.random() - 0.5) * 0.8;
        const pos = pickChildPos(m, angle);
        const jitter = 1 + (Math.random() * 2 - 1) * END_CHILD_SIZE_JITTER;
        const rawSize = Math.max(0.1, Math.min(2, m.rawSize * jitter));
        const order = flowerOrderCounter++; // gán trước await để giữ đúng thứ tự vẽ

        let f = await buildFlower(m.kind, m.daisyColor, m.svgColorKey, pos.x, pos.y, rawSize, order);
        if (!f) f = await buildFlower('daisy', m.daisyColor, null, pos.x, pos.y, rawSize, order);
        if (!f) continue;

        const t = performance.now();
        f.growStart = t + END_GATHER * 0.55 + Math.random() * END_CHILD_GROW_JITTER; // mọc khi dust gần tới nơi
        endLatestGrow = Math.max(endLatestGrow, f.growStart);
        flowers.push(f);

        const samples = getFlowerSamples(f.buffer, f.dustColors);
        for (let k = 0; k < dustPer; k++) {
            const sm = samples[(Math.random() * samples.length) | 0];
            const sx = m.x + (Math.random() - 0.5) * 100;
            const sy = m.baseY + (Math.random() - 0.5) * 80;
            dust.push({
                x: sx, y: sy,
                size: 1 + Math.random() * 2,
                css: sm.css,
                phase: Math.random() * Math.PI * 2,
                home: {
                    sx, sy,
                    tx: f.x + (Math.random() - 0.5) * 30,
                    ty: f.baseY + (Math.random() - 0.5) * 30,
                    start: t + Math.random() * 500,
                    dur: END_GATHER
                }
            });
        }
    }
    flowers.sort((a, b) => a.order - b.order);
    updateFlowerCount();
}

function updateEnding(now) {
    if (endState === 'dissolving') {
        let allDone = true;
        for (const m of endMothers) {
            const fadeEnd = m.dissolveStart + END_FLOWER_FADE;
            if (!m.dustSpawned && now >= m.dissolveStart) {
                m.dustSpawned = true;
                spawnDust(m, now);
            }
            // hoa mẹ sắp mờ hẳn -> hoa con của nó bắt đầu hình thành (mọc lan dần, không đồng loạt)
            if (!m.kidsSpawned && now >= fadeEnd - END_GATHER_LEAD) {
                m.kidsSpawned = true;
                endKidsPending++;
                spawnChildren(m).catch(console.error).finally(() => { endKidsPending--; });
            }
            if (!m.removed && now >= fadeEnd) {
                m.removed = true;
                removeFlower(m);
                updateFlowerCount();
            }
            if (!m.kidsSpawned || !m.removed) allDone = false;
        }
        if (allDone && endKidsPending === 0) {
            endState = 'growing';
            endDoneAt = Math.max(endLatestGrow, now) + END_GROW + END_OUTRO_DELAY;
        }
    } else if (endState === 'growing' && now >= endDoneAt) {
        endState = 'done';
        showOutro();
    }
}

// N: "grow again" — vườn (hoa con) tiếp tục, chữ chạy lại khi đủ số hoa
function growAgain() {
    endState = 'planting';
    hideOutro();
    poemStarted = false;
    checkPoem();
}

document.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();

    if ((k === 'e' || k === 'enter') && endState === 'ready') {
        e.preventDefault(); // tránh Enter kích hoạt nút đang focus (vd nút Random)
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        startEnding();
    } else if (k === 'n' && endState === 'done') {
        growAgain();
    } else if (k === 'h' && endState === 'done') {
    goHome();   // trước là: window.location.href = 'index.html';
    }
});

const MAX_PIXEL_DENSITY = 1;

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
        const now = performance.now();
        p.background(bgPalettes[currentTheme].bg1);
        drawFallingPetals();
        updateEnding(now);
        updateWilt(now);

        const t1 = PERF_HUD ? performance.now() : 0;
        drawAllFlowers(p, now); // vẽ trực tiếp mỗi frame (có lắc), không dùng layer tĩnh nữa
        drawDust(p, now);       // dust của hiệu ứng kết thúc (rỗng nếu chưa bấm E)
        const t2 = PERF_HUD ? performance.now() : 0;
        drawParticles(p);
        if (PERF_HUD) perfTick(t2 - t1, performance.now() - t2);
    };

    // Click chuột lên canvas -> tạo 1 hoa tại đúng vị trí click
    p.mousePressed = function() {
        if (isMouseOverPanel(p.mouseX, p.mouseY)) return; // đừng tạo hoa khi bấm trong panel
        // đang tan / đang mọc / đang chờ bấm N thì không trồng thêm
        if (endState !== 'planting' && endState !== 'ready') return;
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

// Dựng 1 bông hoa (không đụng tới panel) — dùng cho click và cho 2 hoa mới lúc kết thúc.
// Trả về null nếu thiếu file SVG.
async function buildFlower(kind, daisyColor, svgColorKey, x, y, rawSize, order) {
    const TULIP_SIZE_FACTOR = 0.65;
    const size = kind === 'tulip' ? rawSize * TULIP_SIZE_FACTOR : rawSize;
    let buffer;
    let dustColors; // màu dự phòng cho dust nếu không đọc được pixel

    if (kind === 'daisy') {
        const fat = Math.random() > 0.5;
        buffer = getOrCreateFlowerBuffer(mySketch, daisyColor, fat);
        const c = flowerTypes[daisyColor];
        dustColors = [c.outer, c.mid, c.center].map(a => `rgb(${a[0]}, ${a[1]}, ${a[2]})`);
    } else {
        buffer = await getOrCreateSvgBuffer(mySketch, kind, svgColorKey);
        if (!buffer) return null;
        dustColors = [SVG_FLOWER_ASSETS[kind][svgColorKey].colorHex];
    }

    const rotation = kind === 'tulip'
        ? mySketch.random(-0.26, 0.26) // ~±15 độ
        : mySketch.random(0, Math.PI * 2);

    return {
        order: order,
        x: x,
        baseY: y, // vị trí gốc; lắc nhẹ quanh baseY mỗi frame
        size: size,
        // nhớ lại để hoa con thừa hưởng loại / màu / cỡ của hoa mẹ
        kind: kind,
        daisyColor: daisyColor,
        svgColorKey: svgColorKey,
        rawSize: rawSize,
        buffer: buffer,
        dustColors: dustColors,
        rotation: rotation,
        // tham số lắc — rất nhẹ giống landing (chỉ vài px)
        floatPhase: mySketch.random(0, Math.PI * 2),
        floatAmp: mySketch.random(3, 6),        // biên độ lên xuống (px)
        floatRotAmp: mySketch.random(0.02, 0.05) // biên độ xoay (rad, rất nhỏ)
    };
}

function updateFlowerCount() {
    document.getElementById('flowerCountDisplay').textContent = flowers.length;
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
    const flower = await buildFlower(kind, daisyColor, svgColorKey, x, y, rawSize, order);
    if (!flower) {
        console.log(`Chưa có SVG cho ${kind}/${svgColorKey}, bỏ qua.`);
        return;
    }

    flowers.push(flower);
    flowers.sort((a, b) => a.order - b.order); // giữ đúng thứ tự click (SVG load chậm có thể push trễ)
    updateFlowerCount();
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

// ===== POEM: câu chữ hiện TỪNG CHỮ sau khi đủ số hoa (chạy 1 lượt, không loop) =====
const POEM_THRESHOLD = 10;      // số hoa cần tạo để bắt đầu
const POEM_START_DELAY = 1000;  // ms chờ trước khi câu đầu tiên hiện
const POEM_WORD_FADE_IN = 900; // ms mỗi chữ fade in (càng lớn càng chậm)
const POEM_WORD_STAGGER = 400;  // ms cách nhau giữa 2 chữ liên tiếp
const POEM_LINE_PAUSE = 500;    // ms nghỉ thêm khi xuống dòng mới
const POEM_HOLD = 2500;         // ms giữ nguyên sau khi chữ cuối hiện xong
const POEM_FADE_OUT = 1500;     // ms fade out (cả câu cùng mờ, không tan biến)
const POEM_GAP = 1000;          // ms nghỉ giữa 2 câu

// Cú pháp chữ: từ thường = regular | *từ = accent | ~từ = accent small | _từ = regular small
// top/left tính theo khung 1920x1080 (gốc ở góc trên trái; top tăng = xuống, left tăng = sang phải).
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
        { top: 400, left: 440, text: 'all *at *once' }
    ]
];

// data-id của chữ: finale-l<dòng>-w<chữ>
const POEM_FINALE = [
    { top: 300, left: 180, text: 'Something new has ~taken ~root.' },
    { top: 390, left: 220, text: "Press E / ENTER when you're ready.", blink: true }
];

// Chữ hiện sau khi 2 hoa mới mọc xong. data-id của chữ: outro-l<dòng>-w<chữ>
const POEM_OUTRO = [
    { top: 300, left: 180, text: 'Press N to *grow again.' },
    { top: 420, left: 400, text: 'Press H to return to the beginning.' }
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

// Dựng 1 dòng: trả về { el, words:[<span>], blink }
function makePoemLine(wrap, line, idPrefix) {
    const el = document.createElement('div');
    el.className = 'poem-line';
    el.style.top = line.top + 'px';
    el.style.left = line.left + 'px';

    const words = line.text.split(' ').filter(Boolean).map((token, wi) => {
        const w = parsePoemWord(token);
        const span = document.createElement('span');
        span.className = 'poem-word ' + w.cls;
        span.dataset.id = `${idPrefix}-w${wi + 1}`; // để chỉnh riêng bằng CSS
        span.textContent = w.text;
        el.appendChild(span);
        return span;
    });

    wrap.appendChild(el);
    return { el, words, blink: !!line.blink };
}

// sentences[câu][dòng] = { el, words, blink } ; finale / outro[dòng] = { el, words, blink }
function buildPoem() {
    const wrap = document.createElement('div');
    wrap.id = 'poem';

    const sentences = POEM_SENTENCES.map((lines, si) =>
        lines.map((line, li) => makePoemLine(wrap, line, `s${si + 1}-l${li + 1}`)));
    const finale = POEM_FINALE.map((line, li) => makePoemLine(wrap, line, `finale-l${li + 1}`));
    const outro = POEM_OUTRO.map((line, li) => makePoemLine(wrap, line, `outro-l${li + 1}`));

    return { wrap, sentences, finale, outro };
}

// Chỉ dựng DOM 1 lần, dùng lại cho các lượt sau (sau khi bấm N)
let poemDom = null;
function getPoemDom() {
    if (!poemDom) {
        poemDom = buildPoem();
        document.body.appendChild(poemDom.wrap);
    }
    return poemDom;
}

const poemSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// fade in từng chữ, dòng nọ nối dòng kia
async function poemShowLines(lines) {
    for (const line of lines) {
        for (const word of line.words) {
            word.style.setProperty('--fade', POEM_WORD_FADE_IN + 'ms');
            word.classList.add('show');
            await poemSleep(POEM_WORD_STAGGER);
        }
        await poemSleep(POEM_LINE_PAUSE);
    }
}

// fade out chậm (cả nhóm dòng cùng mờ đi, không tan)
function poemHideLines(lines, ms) {
    lines.forEach(line => {
        line.el.classList.remove('blink');
        line.words.forEach(word => {
            word.style.setProperty('--fade', ms + 'ms');
            word.classList.remove('show');
        });
    });
}

async function runPoem() {
    const poem = getPoemDom();

    await poemSleep(POEM_START_DELAY);

    for (const lines of poem.sentences) {
        await poemShowLines(lines);
        await poemSleep(POEM_WORD_FADE_IN + POEM_HOLD);
        poemHideLines(lines, POEM_FADE_OUT);
        await poemSleep(POEM_FADE_OUT + POEM_GAP);
    }

    // Câu kết: chữ ở lại, lời nhắc nhấp nháy, chờ người dùng bấm E / ENTER
    await poemShowLines(poem.finale);
    await poemSleep(POEM_WORD_FADE_IN);
    poem.finale.forEach(line => { if (line.blink) line.el.classList.add('blink'); });
    endState = 'ready';
}

async function showOutro() { await poemShowLines(getPoemDom().outro); }
function hideOutro() { poemHideLines(getPoemDom().outro, 1500); }

function checkPoem() {
    if (!poemStarted && flowers.length >= POEM_THRESHOLD) {
        poemStarted = true;
        runPoem();
        startWiltWave(); // đủ hoa -> random vài bông héo
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

// ===== Về home: fade out đen rồi mới chuyển trang (home tự fade in từ đen) =====
const HOME_FADE_MS = 900;   // ms fade out
let leavingHome = false;
let homeVeil = null;

function goHome() {
    if (leavingHome) return;
    leavingHome = true;

    homeVeil = document.createElement('div');
    const veilColor = document.body.classList.contains('light') ? '#fffaf5' : '#000'; // theme sáng phủ màu kem
    homeVeil.style.cssText =
        'position:fixed;inset:0;background:' + veilColor + ';opacity:0;z-index:1000;' +
        'transition:opacity ' + HOME_FADE_MS + 'ms ease;';
    document.body.appendChild(homeVeil);
    void homeVeil.offsetHeight;      // ép trình duyệt tính style trước để transition chạy
    homeVeil.style.opacity = '1';

    setTimeout(() => { window.location.href = 'index.html'; }, HOME_FADE_MS);
}

// Logo góc trên trái cũng đi qua hiệu ứng này
document.getElementById('homeNav').addEventListener('click', (e) => {
    e.preventDefault();
    goHome();
});

// Bấm Back từ home quay lại stage02 (bfcache) thì gỡ màn đen, không bị kẹt
window.addEventListener('pageshow', (e) => {
    if (e.persisted && homeVeil) {
        homeVeil.remove();
        homeVeil = null;
        leavingHome = false;
    }
});