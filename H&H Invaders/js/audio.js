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
        this.masterVolValue = 1.0;
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
            this.masterVolume.gain.setValueAtTime(0.5 * this.masterVolValue, this.ctx.currentTime); // 50% max volume default
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
     * Adjusts the master gain node for the entire game.
     */
    setMasterVolume(val) {
        this.masterVolValue = val;
        if (this.masterVolume && this.ctx) {
            // Master starts at 0.5 to prevent clipping, so 100% slider = 0.5 gain
            this.masterVolume.gain.setValueAtTime(val * 0.5, this.ctx.currentTime);
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
            targetFreq += 10; // Subtly higher pitch
            targetVol += 0.015; // Much quieter volume increase
        }

        // Smoothly ramp to values
        this.engineOsc1.frequency.setTargetAtTime(targetFreq, now, 0.1);
        this.engineOsc2.frequency.setTargetAtTime(targetFreq * 1.015, now, 0.1);
        this.engineGain.gain.setTargetAtTime(targetVol, now, 0.15);
    }

    /**
     * Synthesizes Primary Laser Sound.
     * High-tech snappy dual-oscillator zap.
     */
    playLaser() {
        if (!this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'square';
        osc1.frequency.setValueAtTime(1500, now);
        osc1.frequency.exponentialRampToValueAtTime(100, now + 0.15);

        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(800, now);
        osc2.frequency.exponentialRampToValueAtTime(80, now + 0.15);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(5000, now);
        filter.frequency.exponentialRampToValueAtTime(400, now + 0.15);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterVolume);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.16);
        osc2.stop(now + 0.16);
    }

    /**
     * Synthesizes Rapid Fire Sound.
     * Chiptune-style short piercing triangle burst.
     */
    playRapidFire() {
        if (!this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        osc.connect(gain);
        gain.connect(this.masterVolume);

        osc.start(now);
        osc.stop(now + 0.09);
    }

    /**
     * Synthesizes Plasma Cannon.
     * Deep charge up followed by a thunderous bass blast.
     */
    playPlasma() {
        if (!this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        
        // 1. Charge Sound
        const chargeOsc = this.ctx.createOscillator();
        const chargeGain = this.ctx.createGain();
        chargeOsc.type = 'sine';
        chargeOsc.frequency.setValueAtTime(150, now);
        chargeOsc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
        
        chargeGain.gain.setValueAtTime(0.01, now);
        chargeGain.gain.exponentialRampToValueAtTime(0.25, now + 0.3);
        
        chargeOsc.connect(chargeGain);
        chargeGain.connect(this.masterVolume);
        chargeOsc.start(now);
        chargeOsc.stop(now + 0.3);

        // 2. Blast Sound (Deep bass drop + noise)
        const blastOsc = this.ctx.createOscillator();
        blastOsc.type = 'square';
        blastOsc.frequency.setValueAtTime(150, now + 0.3);
        blastOsc.frequency.exponentialRampToValueAtTime(20, now + 0.7);

        const blastGain = this.ctx.createGain();
        blastGain.gain.setValueAtTime(0, now);
        blastGain.gain.setValueAtTime(0.4, now + 0.3);
        blastGain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);

        // Noise overlay
        const bufferSize = this.ctx.sampleRate * 0.4; 
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(800, now + 0.3);
        noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 0.7);
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0, now);
        noiseGain.gain.setValueAtTime(0.3, now + 0.3);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);

        blastOsc.connect(blastGain);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        
        blastGain.connect(this.masterVolume);
        noiseGain.connect(this.masterVolume);

        blastOsc.start(now + 0.3);
        blastOsc.stop(now + 0.7);
        noise.start(now + 0.3);
        noise.stop(now + 0.7);
    }

    /**
     * Synthesizes Missile Launch.
     * Hard thump followed by an explosive rocket whoosh.
     */
    playMissile() {
        if (!this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        
        // Initial "thump"
        const thumpOsc = this.ctx.createOscillator();
        thumpOsc.type = 'sine';
        thumpOsc.frequency.setValueAtTime(150, now);
        thumpOsc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
        
        const thumpGain = this.ctx.createGain();
        thumpGain.gain.setValueAtTime(0.4, now);
        thumpGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        
        thumpOsc.connect(thumpGain);
        thumpGain.connect(this.masterVolume);
        thumpOsc.start(now);
        thumpOsc.stop(now + 0.15);

        // Rocket thruster hiss
        const bufferSize = this.ctx.sampleRate * 0.8;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.linearRampToValueAtTime(1200, now + 0.8);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterVolume);

        noise.start(now);
        noise.stop(now + 0.85);
    }

    /**
     * Controls the continuous Charged Beam sound loop.
     * High-tech wobble phaser using an LFO on a bandpass filter.
     * @param {boolean} active - True to start looping beam sound, false to fade out.
     */
    setBeamSoundActive(active) {
        if (!this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;

        if (active) {
            if (this.beamSound) return;

            this.beamSound = {
                osc1: this.ctx.createOscillator(),
                osc2: this.ctx.createOscillator(),
                lfo: this.ctx.createOscillator(),
                gain: this.ctx.createGain()
            };

            this.beamSound.osc1.type = 'sawtooth';
            this.beamSound.osc1.frequency.setValueAtTime(110, now); // A2
            
            this.beamSound.osc2.type = 'square';
            this.beamSound.osc2.frequency.setValueAtTime(111.5, now);

            // Filter wobble
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(800, now);
            filter.Q.setValueAtTime(5, now);
            
            this.beamSound.lfo.type = 'sine';
            this.beamSound.lfo.frequency.setValueAtTime(8, now); // 8 Hz wobble
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.setValueAtTime(400, now);
            
            this.beamSound.lfo.connect(lfoGain);
            lfoGain.connect(filter.frequency);

            this.beamSound.gain.gain.setValueAtTime(0.01, now);
            this.beamSound.gain.gain.exponentialRampToValueAtTime(0.2, now + 0.15); // fade in

            this.beamSound.osc1.connect(filter);
            this.beamSound.osc2.connect(filter);
            filter.connect(this.beamSound.gain);
            this.beamSound.gain.connect(this.masterVolume);

            this.beamSound.osc1.start(now);
            this.beamSound.osc2.start(now);
            this.beamSound.lfo.start(now);
        } else {
            if (!this.beamSound) return;

            const currentBeam = this.beamSound;
            this.beamSound = null;

            currentBeam.gain.gain.cancelScheduledValues(now);
            currentBeam.gain.gain.setValueAtTime(currentBeam.gain.gain.value, now);
            currentBeam.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

            currentBeam.osc1.stop(now + 0.12);
            currentBeam.osc2.stop(now + 0.12);
            currentBeam.lfo.stop(now + 0.12);
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
        filter.frequency.setValueAtTime(300 * intensity, now);
        filter.frequency.exponentialRampToValueAtTime(30, now + duration);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5 * Math.min(1.5, intensity), now);
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

    /**
     * Synthesizes HUD Boot Up Sound.
     * High tech sweep with multiple chords turning on.
     */
    playBootUp() {
        if (!this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        
        // Main ascending power-up sweep
        const sweepOsc = this.ctx.createOscillator();
        const sweepGain = this.ctx.createGain();
        sweepOsc.type = 'sine';
        sweepOsc.frequency.setValueAtTime(100, now);
        sweepOsc.frequency.exponentialRampToValueAtTime(800, now + 1.5);
        
        sweepGain.gain.setValueAtTime(0, now);
        sweepGain.gain.linearRampToValueAtTime(0.2, now + 1.0);
        sweepGain.gain.exponentialRampToValueAtTime(0.01, now + 2.0);
        
        sweepOsc.connect(sweepGain);
        sweepGain.connect(this.masterVolume);
        sweepOsc.start(now);
        sweepOsc.stop(now + 2.1);

        // Techy interface blips
        for (let i = 0; i < 5; i++) {
            const blipOsc = this.ctx.createOscillator();
            const blipGain = this.ctx.createGain();
            blipOsc.type = 'square';
            blipOsc.frequency.setValueAtTime(1200 + Math.random() * 800, now + i * 0.15);
            
            blipGain.gain.setValueAtTime(0, now);
            blipGain.gain.setValueAtTime(0.05, now + i * 0.15);
            blipGain.gain.setTargetAtTime(0, now + i * 0.15 + 0.05, 0.02);
            
            blipOsc.connect(blipGain);
            blipGain.connect(this.masterVolume);
            blipOsc.start(now + i * 0.15);
            blipOsc.stop(now + i * 0.15 + 0.1);
        }

        // Final lock-in chord
        const chordFreqs = [440, 554.37, 659.25]; // A Major
        chordFreqs.forEach(freq => {
            const chordOsc = this.ctx.createOscillator();
            const chordGain = this.ctx.createGain();
            chordOsc.type = 'triangle';
            chordOsc.frequency.setValueAtTime(freq, now + 1.5);
            
            chordGain.gain.setValueAtTime(0, now);
            chordGain.gain.setValueAtTime(0.1, now + 1.5);
            chordGain.gain.exponentialRampToValueAtTime(0.01, now + 2.5);
            
            chordOsc.connect(chordGain);
            chordGain.connect(this.masterVolume);
            chordOsc.start(now + 1.5);
            chordOsc.stop(now + 2.6);
        });
    }
}
window.AudioSystem = AudioSystem;
