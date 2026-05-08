// sound.js - miocode audio system
// web audio api: all sounds generated programmatically, no external files needed
// ref: bishop et al. (2015) - sound effects enhance feedback and engagement in educational games
// background music increases cognitive load (brom et al. 2025) so only functional sfx are used

class SoundManager {
    constructor() {
        this._ctx  = null;
        // persist mute state across sessions - important for classroom use
        this.muted = localStorage.getItem('miocode_muted') === 'true';
    }

    // audiocontext is created lazily on first use
    // browsers require creation inside a user gesture - this defers until then
    _getCtx() {
        if (!this._ctx) {
            this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this._ctx.state === 'suspended') this._ctx.resume();
        return this._ctx;
    }

    toggle() {
        this.muted = !this.muted;
        localStorage.setItem('miocode_muted', String(this.muted));
        return this.muted;
    }

    // core tone helper
    // freq: starting frequency (hz), dur: duration (seconds)
    // options: type, vol, delay, freqEnd (for pitch bends)
    _tone(freq, dur, { type = 'sine', vol = 0.25, delay = 0, freqEnd = null } = {}) {
        if (this.muted) return;
        const ctx = this._getCtx();
        const t   = ctx.currentTime + delay;

        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.05);
    }

    // each cell move - short high blip, quiet so it doesn't distract
    step() {
        this._tone(700, 0.07, { vol: 0.12 });
    }

    // 90 degree turn - quick two note flick
    turn() {
        this._tone(440, 0.06, { vol: 0.1 });
        this._tone(550, 0.06, { vol: 0.08, delay: 0.04 });
    }

    // run button pressed - c-e-g ascending arpeggio, "here we go"
    runStart() {
        [523, 659, 784].forEach((freq, i) => {
            this._tone(freq, 0.14, { vol: 0.18, delay: i * 0.07 });
        });
    }

    // wall or boundary hit - gentle descending pitch, not a harsh buzzer
    // "mistakes should never feel like failure" (gapsy studio 2026)
    wallHit() {
        this._tone(300, 0.22, { vol: 0.16, freqEnd: 150 });
    }

    // fail sequence - softer longer descent with a little afterthought note at the end
    error() {
        this._tone(360, 0.38, { vol: 0.18, freqEnd: 140 });
        this._tone(260, 0.14, { vol: 0.09, delay: 0.32 });
    }

    // star earned - ascending pitch per star index + shimmer overtone
    // staggered by the caller to sync with the visual pop-in (150ms apart)
    starEarn(starIndex) {
        const freqs = [523, 659, 784]; // c5, e5, g5 - same notes as the run arpeggio
        const freq  = freqs[Math.min(starIndex, 2)];
        this._tone(freq, 0.28, { vol: 0.22 });
        this._tone(freq * 2, 0.18, { vol: 0.07, delay: 0.04 });
    }

    // level complete fanfare - c5 e5 g5 c6 ascending, short and satisfying
    win() {
        const notes = [
            { freq: 523,  dur: 0.13, delay: 0    },
            { freq: 659,  dur: 0.13, delay: 0.13 },
            { freq: 784,  dur: 0.13, delay: 0.26 },
            { freq: 1047, dur: 0.50, delay: 0.39 },
        ];
        notes.forEach(({ freq, dur, delay }) => {
            this._tone(freq,     dur, { vol: 0.20, delay });
            this._tone(freq / 2, dur, { vol: 0.06, delay }); // octave below for warmth
        });
    }
}

window.soundManager = new SoundManager();