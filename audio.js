// audio.js: one looping track per page
// usage: <script src="audio.js" data-src="audio/audio1.mp3" data-volume="0.1"></script>
(function () {
    // config
    const script = document.currentScript;
    const SRC = script.dataset.src || 'audio/audio.mp3';
    const VOLUME = parseFloat(script.dataset.volume) || 0.2;
    const FADE_IN_MS = 1500;

    // audio setup
    const audio = new Audio(SRC);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;

    // fade
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

    // playback
    function start() {
        audio.play().then(() => fadeTo(VOLUME, FADE_IN_MS)).catch(() => {
            // autoplay blocked, wait for first interaction
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

    // page lifecycle
    window.addEventListener('pagehide', () => audio.pause());
    window.addEventListener('pageshow', (e) => {
        if (e.persisted) { audio.currentTime = 0; audio.volume = 0; start(); }
    });

    // public api
    window.bgm = { fadeTo, fadeOut, setVolume, audio };
    start();
})();