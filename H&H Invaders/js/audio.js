/**
 * H&H Invaders - Audio System
 * Uses the Web Audio API to procedurally synthesize all retro sci-fi sound effects
 * and ambient ship engines, ensuring 100% self-contained gameplay without CORS issues.
 */
class AudioSystem {
    constructor() {
        this.ctx = null;
        this.masterVolume = null;
        this.engineOsc1 = null;
        this.engineOsc2 = null;
        this.engineGain = null;
        this.beamSound = null;
        this.unlocked = false;
    }

    /**
     * Initializes the Web Audio context. Must be triggered via user interaction.
     */
    init() {
        if (this.unlocked) return;

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
            
            // Set up master gain node (limiter/volume)
            this.masterVolume = this.ctx.createGain();
            this.masterVolume.gain.setValueAtTime(0.5, this.ctx.currentTime); // 50% volume default
            this.masterVolume.connect(this.ctx.destination);
            
            // Start the continuous engine hum
            this.startEngineHum();
            
            this.unlocked = true;
            console.log("Audio System initialized and unlocked.");
        } catch (e) {
            console.error("Web Audio API not supported in this browser:", e);
        }
    }

    /**
     * Triggers the AudioContext resume (handles browser autoplay lock).
     */
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * Synthesizes the continuous background engine hum of the ship.
     */
    startEngineHum() {
        if (!this.ctx) return;

        // Engine is formed of two detuned low-frequency sawtooth waves
        this.engineOsc1 = this.ctx.createOscillator();
        this.engineOsc2 = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        
        const filter = this.ctx.createBiquadFilter();

        this.engineOsc1.type = 'sawtooth';
        this.engineOsc1.frequency.setValueAtTime(55, this.ctx.currentTime); // A1 note
        
        this.engineOsc2.type = 'sawtooth';
        this.engineOsc2.frequency.setValueAtTime(55.8, this.ctx.currentTime); // Detuned for phasing

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(100, this.ctx.currentTime); // Filter out high frequencies
        filter.Q.setValueAtTime(4, this.ctx.currentTime);

        this.engineGain.gain.setValueAtTime(0.06, this.ctx.currentTime); // Very quiet ambient hum

        // Connect graph
        this.engineOsc1.connect(filter);
        this.engineOsc2.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.masterVolume);

        this.engineOsc1.start();
        this.engineOsc2.start();
    }

    /**
     * Adjusts the engine pitch and volume based on flight speed and boost.
     * @param {number} speedFactor - 0.0 to 1.0 based on movement
     * @param {boolean} isBoosting - True if space bar is held
     */
    updateEngineSound(speedFactor, isBoosting) {
        if (!this.ctx || !this.engineOsc1 || !this.engineOsc2) return;

        const now = this.ctx.currentTime;
        let targetFreq = 55 + (speedFactor * 25);
        let targetVol = 0.06 + (speedFactor * 0.04);

        if (isBoosting) {
            targetFreq += 35;
            targetVol += 0.08;
        }

        // Smoothly ramp to values
        this.engineOsc1.frequency.setTargetAtTime(targetFreq, now, 0.1);
        this.engineOsc2.frequency.setTargetAtTime(targetFreq * 1.015, now, 0.1);
        this.engineGain.gain.setTargetAtTime(targetVol, now, 0.15);
    }

    /**
     * Synthesizes Primary Laser Sound.
     * Quick high-to-low pitch sweep.
     */
    playLaser() {
        if (!this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now); // A5
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

        osc.connect(gain);
        gain.connect(this.masterVolume);

        osc.start(now);
        osc.stop(now + 0.13);
    }

    /**
     * Synthesizes Rapid Fire Sound.
     * Higher, shorter laser burst.
     */
    playRapidFire() {
        if (!this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.07);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

        osc.connect(gain);
        gain.connect(this.masterVolume);

        osc.start(now);
        osc.stop(now + 0.08);
    }

    /**
     * Synthesizes Plasma Cannon.
     * Heavy charge sweep + low frequency white noise blast.
     */
    playPlasma() {
        if (!this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        
        // 1. Charge Sound
        const osc = this.ctx.createOscillator();
        const gainOsc = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(350, now + 0.25);
        gainOsc.gain.setValueAtTime(0.01, now);
        gainOsc.gain.exponentialRampToValueAtTime(0.15, now + 0.25);
        osc.connect(gainOsc);
        gainOsc.connect(this.masterVolume);
        osc.start(now);
        osc.stop(now + 0.26);

        // 2. Heavy explosion blast on launch
        const bufferSize = this.ctx.sampleRate * 0.35; // 0.35 seconds
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1; // White noise
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(180, now + 0.25);
        filter.frequency.exponentialRampToValueAtTime(50, now + 0.6);

        const gainNoise = this.ctx.createGain();
        gainNoise.gain.setValueAtTime(0, now);
        gainNoise.gain.setValueAtTime(0.4, now + 0.25);
        gainNoise.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

        noise.connect(filter);
        filter.connect(gainNoise);
        gainNoise.connect(this.masterVolume);

        noise.start(now + 0.25);
        noise.stop(now + 0.65);
    }

    /**
     * Synthesizes Missile Launch.
     * Sweeping white-noise exhaust sound.
     */
    playMissile() {
        if (!this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.45;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.45);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterVolume);

        noise.start(now);
        noise.stop(now + 0.46);
    }

    /**
     * Controls the continuous Charged Beam sound loop.
     * @param {boolean} active - True to start looping beam sound, false to fade out.
     */
    setBeamSoundActive(active) {
        if (!this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;

        if (active) {
            if (this.beamSound) return; // Already running

            this.beamSound = {
                osc1: this.ctx.createOscillator(),
                osc2: this.ctx.createOscillator(),
                gain: this.ctx.createGain()
            };

            this.beamSound.osc1.type = 'sawtooth';
            this.beamSound.osc1.frequency.setValueAtTime(220, now); // A3
            
            this.beamSound.osc2.type = 'sine';
            this.beamSound.osc2.frequency.setValueAtTime(221.5, now);

            // High filter to represent laser friction
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(600, now);

            this.beamSound.gain.gain.setValueAtTime(0.01, now);
            this.beamSound.gain.gain.exponentialRampToValueAtTime(0.18, now + 0.15); // fade in

            this.beamSound.osc1.connect(filter);
            this.beamSound.osc2.connect(filter);
            filter.connect(this.beamSound.gain);
            this.beamSound.gain.connect(this.masterVolume);

            this.beamSound.osc1.start(now);
            this.beamSound.osc2.start(now);
        } else {
            if (!this.beamSound) return;

            const currentBeam = this.beamSound;
            this.beamSound = null; // Clear handle immediately

            currentBeam.gain.gain.cancelScheduledValues(now);
            currentBeam.gain.gain.setValueAtTime(currentBeam.gain.gain.value, now);
            currentBeam.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1); // fade out fast

            currentBeam.osc1.stop(now + 0.12);
            currentBeam.osc2.stop(now + 0.12);
        }
    }

    /**
     * Synthesizes Explosion Sounds.
     * Heavy filtered white noise with wide dispersion and long decay.
     * @param {number} intensity - Scale of the explosion (0.5 to 2.0)
     */
    playExplosion(intensity = 1.0) {
        if (!this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        const duration = 0.5 * intensity;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        // Custom filter to shape explosion boom and rumble
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(280 * intensity, now);
        filter.frequency.exponentialRampToValueAtTime(25, now + duration);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.45 * Math.min(1.5, intensity), now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterVolume);

        noise.start(now);
        noise.stop(now + duration + 0.05);
    }

    /**
     * Plays warning system pulse alerts.
     */
    playWarningAlarm() {
        if (!this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.setValueAtTime(520, now + 0.15); // Pulsing tones

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.setValueAtTime(0.15, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.connect(gain);
        gain.connect(this.masterVolume);

        osc.start(now);
        osc.stop(now + 0.31);
    }
}
window.AudioSystem = AudioSystem;
