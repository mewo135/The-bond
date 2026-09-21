// audio.js — mỗi trang 1 bài nhạc riêng, loop trong trang đó
// Cách dùng: <script src="audio.js" data-src="audio/audio1.mp3"></script>
(function () {
    const script = document.currentScript;
    const SRC = script.dataset.src || 'audio/audio.mp3';
    const VOLUME = parseFloat(script.dataset.volume) || 0.1;  // có thể chỉnh riêng từng trang bằng data-volume
    const FADE_IN_MS = 1500;

    const audio = new Audio(SRC);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;

    let fadeTimer = null;
    function fadeTo(v, ms) {
        clearInterval(fadeTimer);
        const from = audio.volume, t0 = performance.now();
        fadeTimer = setInterval(() => {
            const u = Math.min(1, (performance.now() - t0) / ms);
            audio.volume = from + (v - from) * u;
            if (u >= 1) clearInterval(fadeTimer);
        }, 30);
    }

    function fadeOut(ms) { fadeTo(0, ms || 600); }

    function setVolume(v) {
        clearInterval(fadeTimer);
        audio.volume = Math.max(0, Math.min(1, v));
    }

    function start() {
        audio.play().then(() => fadeTo(VOLUME, FADE_IN_MS)).catch(() => {
            // Trình duyệt chặn autoplay -> chờ tương tác đầu tiên rồi mới phát
            let done = false;
            const events = ['keydown', 'pointerdown', 'touchend'];
            const unlock = () => {
                if (done) return;
                done = true;
                events.forEach(e => window.removeEventListener(e, unlock));
                audio.play().then(() => fadeTo(VOLUME, FADE_IN_MS)).catch(() => {});
            };
            events.forEach(e => window.addEventListener(e, unlock));
        });
    }

    // Rời trang thì dừng; bấm Back (bfcache) quay lại thì phát lại từ đầu
    window.addEventListener('pagehide', () => audio.pause());
    window.addEventListener('pageshow', (e) => {
        if (e.persisted) { audio.currentTime = 0; audio.volume = 0; start(); }
    });

    window.bgm = { fadeTo, fadeOut, setVolume, audio };
    start();
})();