// --- Game Configuration & Globals ---
const MAP_SIZE = 2500;
const MAX_PLAYERS = 15;
const TICK_RATE = 45; // Increased for smoother multiplayer

const NAMES = ["SkyHawk", "RotorBoss", "ChopperChomp", "AeroViper", "PropNinja", "Pranesh", "slurpdudex", "HeliHound", "HoverGhost", "RotorRogue", "FlightFury", "SkyStriker", "WindWeaver", "AirAssassin", "WhirlyBird", "GatorCopter", "MetalLocust", "SteelWasp", "IronDragon", "StormRider"];

let myName = NAMES[Math.floor(Math.random() * NAMES.length)];
let myId = null;
let isHost = false;
let peer = null;
let connections = {}; 
let hostConnection = null; 

// Inputs
const keys = { w: false, a: false, s: false, d: false };
const mouse = { x: 0, y: 0, down: false };
let myAngle = 0;

// Game State (Authoritative on Host, mirrored on Clients)
let gameState = {
    started: false,
    players: {},
    bullets: [],
    crates: [],
    gems: [],
    storm: { x: MAP_SIZE / 2, y: MAP_SIZE / 2, radius: MAP_SIZE * 0.8 },
    aliveCount: 0
};

// Client-side only visuals
let renderState = { players: {} };
let particles = [];

// DOM Elements
const menuScreen = document.getElementById('menu-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameUI = document.getElementById('game-ui');
const nameDisplay = document.getElementById('player-name-display');
const joinInput = document.getElementById('join-code-input');
const playerListUI = document.getElementById('player-list');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimapCanvas');
const mmCtx = minimapCanvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });

// --- Menu Logic ---
nameDisplay.innerText = myName;

document.getElementById('btn-cycle-name').addEventListener('click', () => {
    myName = NAMES[Math.floor(Math.random() * NAMES.length)];
    nameDisplay.innerText = myName;
});

document.getElementById('btn-create-game').addEventListener('click', initHost);
document.getElementById('btn-join-game').addEventListener('click', () => {
    const code = joinInput.value.toUpperCase();
    if (code.length === 5) initClient(code);
    else document.getElementById('menu-status').innerText = "Enter a valid 5-letter code.";
});

// --- PeerJS Networking ---
function generateId() {
    let result = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

function initHost() {
    isHost = true;
    myId = generateId();
    document.getElementById('menu-status').innerText = "Establishing secure link...";
    
    peer = new Peer(myId);
    peer.on('open', (id) => {
        menuScreen.classList.add('hidden');
        lobbyScreen.classList.remove('hidden');
        document.getElementById('room-code-display').innerText = `${id}`;
        document.getElementById('btn-start-game').classList.remove('hidden');
        
        gameState.players[myId] = createPlayer(myId, myName, false);
        updateLobbyUI();
    });

    peer.on('connection', (conn) => {
        conn.on('data', (data) => {
            if (data.type === 'JOIN') {
                connections[conn.peer] = conn;
                gameState.players[conn.peer] = createPlayer(conn.peer, data.name, false);
                updateLobbyUI();
                broadcastLobby();
            } else if (data.type === 'INPUT') {
                if (gameState.players[conn.peer]) {
                    gameState.players[conn.peer].input = data.input;
                }
            }
        });
        conn.on('close', () => handleDisconnect(conn.peer));
    });

    peer.on('error', (err) => { document.getElementById('menu-status').innerText = "Connection error. Try again."; });
}

function initClient(hostCode) {
    isHost = false;
    document.getElementById('menu-status').innerText = "Connecting to Host...";
    peer = new Peer(); 

    peer.on('open', (id) => {
        myId = id;
        hostConnection = peer.connect(hostCode, { reliable: true });
        
        hostConnection.on('open', () => {
            menuScreen.classList.add('hidden');
            lobbyScreen.classList.remove('hidden');
            document.getElementById('room-code-display').innerText = `${hostCode}`;
            hostConnection.send({ type: 'JOIN', name: myName });
        });

        hostConnection.on('data', (data) => {
            if (data.type === 'LOBBY_UPDATE') {
                gameState.players = data.players;
                updateLobbyUI();
            } else if (data.type === 'START_GAME') {
                lobbyScreen.classList.add('hidden');
                gameUI.classList.remove('hidden');
                gameState = data.state;
                requestAnimationFrame(clientRenderLoop);
            } else if (data.type === 'STATE_UPDATE') {
                updateRenderState(data.state);
            } else if (data.type === 'EVENT_EXPLOSION') {
                spawnParticles(data.x, data.y, data.color);
            }
        });

        hostConnection.on('close', () => { alert("Host disconnected."); location.reload(); });
    });

    peer.on('error', (err) => { document.getElementById('menu-status').innerText = "Failed to connect to Host. Check code."; });
}

function handleDisconnect(id) {
    if (gameState.players[id]) {
        delete gameState.players[id];
        delete connections[id];
        if (!gameState.started) { updateLobbyUI(); broadcastLobby(); }
    }
}

// --- Lobby Logic ---
function updateLobbyUI() {
    playerListUI.innerHTML = "";
    Object.values(gameState.players).forEach(p => {
        if (!p.isBot) {
            const li = document.createElement('li');
            li.innerText = p.name;
            playerListUI.appendChild(li);
        }
    });
}

function broadcastLobby() {
    Object.values(connections).forEach(conn => conn.send({ type: 'LOBBY_UPDATE', players: gameState.players }));
}

function broadcastEvent(eventData) {
    Object.values(connections).forEach(conn => conn.send(eventData));
    // Host also needs to see local events
    if (eventData.type === 'EVENT_EXPLOSION') spawnParticles(eventData.x, eventData.y, eventData.color);
}

document.getElementById('btn-start-game').addEventListener('click', () => {
    if (!isHost) return;
    document.getElementById('btn-start-game').classList.add('hidden');
    
    let currentPlayers = Object.keys(gameState.players).length;
    for (let i = currentPlayers; i < MAX_PLAYERS; i++) {
        let botId = 'BOT_' + i;
        gameState.players[botId] = createPlayer(botId, `Bot ${NAMES[Math.floor(Math.random() * NAMES.length)]}`, true);
    }
    
    for (let i = 0; i < 60; i++) spawnCrate();

    gameState.started = true;
    gameState.aliveCount = Object.keys(gameState.players).length;
    
    Object.values(connections).forEach(conn => conn.send({ type: 'START_GAME', state: gameState }));
    
    lobbyScreen.classList.add('hidden');
    gameUI.classList.remove('hidden');
    
    setInterval(hostTick, 1000 / TICK_RATE);
    requestAnimationFrame(clientRenderLoop); 
});

// --- Factory Functions ---
function createPlayer(id, name, isBot) {
    return {
        id: id, name: name, isBot: isBot, alive: true,
        x: Math.random() * (MAP_SIZE - 200) + 100,
        y: Math.random() * (MAP_SIZE - 200) + 100,
        vx: 0, vy: 0, angle: 0,
        color: isBot ? '#e1b12c' : '#4cd137',
        hp: 100, maxHp: 100, level: 1, xp: 0,
        fireCooldown: 0,
        input: { w: false, a: false, s: false, d: false, angle: 0, click: false }
    };
}

function spawnCrate() {
    gameState.crates.push({
        id: Math.random(),
        x: Math.random() * (MAP_SIZE - 100) + 50,
        y: Math.random() * (MAP_SIZE - 100) + 50,
        hp: 40
    });
}

// --- Visual Effects (Client-side) ---
function spawnParticles(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1.0, color: color,
            size: Math.random() * 5 + 3
        });
    }
}

// --- Input Handling ---
window.addEventListener('keydown', (e) => {
    let key = e.key.toLowerCase();
    if (key === 'w' || e.key === 'ArrowUp') keys.w = true;
    if (key === 'a' || e.key === 'ArrowLeft') keys.a = true;
    if (key === 's' || e.key === 'ArrowDown') keys.s = true;
    if (key === 'd' || e.key === 'ArrowRight') keys.d = true;
});
window.addEventListener('keyup', (e) => {
    let key = e.key.toLowerCase();
    if (key === 'w' || e.key === 'ArrowUp') keys.w = false;
    if (key === 'a' || e.key === 'ArrowLeft') keys.a = false;
    if (key === 's' || e.key === 'ArrowDown') keys.s = false;
    if (key === 'd' || e.key === 'ArrowRight') keys.d = false;
});
window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', () => mouse.down = true);
window.addEventListener('mouseup', () => mouse.down = false);

// --- Host Game Logic (Authoritative) ---
function hostTick() {
    if (!gameState.started) return;

    if (gameState.players[myId] && gameState.players[myId].alive) {
        let cx = canvas.width / 2;
        let cy = canvas.height / 2;
        let angle = Math.atan2(mouse.y - cy, mouse.x - cx);
        gameState.players[myId].input = { w: keys.w, a: keys.a, s: keys.s, d: keys.d, angle: angle, click: mouse.down };
    }

    gameState.aliveCount = 0;

    Object.values(gameState.players).forEach(p => {
        if (!p.alive) return;
        gameState.aliveCount++;

        if (p.isBot) runBotAI(p);

        // Movement Physics & Friction
        let speed = 2.5 + (p.level * 0.1); 
        if (p.input.w) p.vy -= speed;
        if (p.input.s) p.vy += speed;
        if (p.input.a) p.vx -= speed;
        if (p.input.d) p.vx += speed;

        p.vx *= 0.82; 
        p.vy *= 0.82;
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 20) { p.x = 20; p.vx = 0; }
        if (p.y < 20) { p.y = 20; p.vy = 0; }
        if (p.x > MAP_SIZE - 20) { p.x = MAP_SIZE - 20; p.vx = 0; }
        if (p.y > MAP_SIZE - 20) { p.y = MAP_SIZE - 20; p.vy = 0; }

        p.angle = p.input.angle;

        // Shooting Mechanics
        if (p.fireCooldown > 0) p.fireCooldown--;
        if (p.input.click && p.fireCooldown <= 0) {
            let fireRate = Math.max(4, 18 - (p.level * 1.2)); 
            p.fireCooldown = fireRate;
            let bSize = 4 + (p.level * 0.7); 
            let bSpeed = 16 + (p.level * 0.5);
            
            // Recoil
            p.vx -= Math.cos(p.angle) * 3;
            p.vy -= Math.sin(p.angle) * 3;

            gameState.bullets.push({
                x: p.x + Math.cos(p.angle) * 30,
                y: p.y + Math.sin(p.angle) * 30,
                vx: Math.cos(p.angle) * bSpeed,
                vy: Math.sin(p.angle) * bSpeed,
                ownerId: p.id,
                size: bSize,
                life: 70
            });
        }

        // Gem Collection
        for (let i = gameState.gems.length - 1; i >= 0; i--) {
            let g = gameState.gems[i];
            let dx = p.x - g.x; let dy = p.y - g.y;
            if (Math.sqrt(dx*dx + dy*dy) < 30) { // Pickup radius
                gameState.gems.splice(i, 1);
                p.xp += 15;
                let xpNeeded = p.level * 25;
                if (p.xp >= xpNeeded) {
                    p.level++;
                    p.xp = 0;
                    p.maxHp += 15;
                    p.hp = p.maxHp;
                }
            }
        }

        // Storm Damage
        let distToStormCenter = Math.sqrt(Math.pow(p.x - gameState.storm.x, 2) + Math.pow(p.y - gameState.storm.y, 2));
        if (distToStormCenter > gameState.storm.radius) {
            p.hp -= 0.6; 
        }

        if (p.hp <= 0) {
            p.alive = false;
            broadcastEvent({ type: 'EVENT_EXPLOSION', x: p.x, y: p.y, color: '#e84118' });
        }
    });

    // Bullets update & collision
    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
        let b = gameState.bullets[i];
        b.x += b.vx;
        b.y += b.vy;
        b.life--;
        let destroyed = false;

        if (b.life <= 0) { gameState.bullets.splice(i, 1); continue; }

        // Players collision
        Object.values(gameState.players).forEach(p => {
            if (destroyed || !p.alive || p.id === b.ownerId) return;
            let dx = p.x - b.x; let dy = p.y - b.y;
            if (Math.sqrt(dx*dx + dy*dy) < 22 + b.size) { 
                p.hp -= 15 + (gameState.players[b.ownerId] ? gameState.players[b.ownerId].level * 1.5 : 0);
                destroyed = true;
            }
        });

        // Crates collision
        if (!destroyed) {
            for (let c = gameState.crates.length - 1; c >= 0; c--) {
                let crate = gameState.crates[c];
                if (b.x > crate.x - 18 && b.x < crate.x + 18 && b.y > crate.y - 18 && b.y < crate.y + 18) {
                    crate.hp -= 15 + (gameState.players[b.ownerId] ? gameState.players[b.ownerId].level * 1.5 : 0);
                    destroyed = true;
                    if (crate.hp <= 0) {
                        broadcastEvent({ type: 'EVENT_EXPLOSION', x: crate.x, y: crate.y, color: '#9c88ff' });
                        gameState.crates.splice(c, 1);
                        gameState.gems.push({ x: crate.x, y: crate.y });
                    }
                    break;
                }
            }
        }
        if (destroyed) gameState.bullets.splice(i, 1);
    }

    // Shrink Storm
    if (gameState.storm.radius > 50) gameState.storm.radius -= 0.15;

    Object.values(connections).forEach(conn => conn.send({ type: 'STATE_UPDATE', state: gameState }));
    updateRenderState(gameState);
}

function runBotAI(bot) {
    let target = null;
    let minDist = 9999;

    gameState.crates.forEach(c => {
        let dist = Math.sqrt(Math.pow(bot.x - c.x, 2) + Math.pow(bot.y - c.y, 2));
        if (dist < minDist) { minDist = dist; target = c; }
    });

    Object.values(gameState.players).forEach(p => {
        if (p.id === bot.id || !p.alive) return;
        let dist = Math.sqrt(Math.pow(bot.x - p.x, 2) + Math.pow(bot.y - p.y, 2));
        if (dist < minDist) { minDist = dist; target = p; }
    });

    bot.input.w = false; bot.input.a = false; bot.input.s = false; bot.input.d = false; bot.input.click = false;

    let distToStorm = Math.sqrt(Math.pow(bot.x - gameState.storm.x, 2) + Math.pow(bot.y - gameState.storm.y, 2));
    if (distToStorm > gameState.storm.radius - 200) {
        target = { x: gameState.storm.x, y: gameState.storm.y };
    }

    if (target) {
        let angleToTarget = Math.atan2(target.y - bot.y, target.x - bot.x);
        bot.input.angle = angleToTarget;
        
        // Strafe behavior if close to a player target, otherwise fly straight
        if (minDist > 250 || target.x === gameState.storm.x) {
            if (Math.abs(Math.cos(angleToTarget)) > 0.2) bot.input[Math.cos(angleToTarget) > 0 ? 'd' : 'a'] = true;
            if (Math.abs(Math.sin(angleToTarget)) > 0.2) bot.input[Math.sin(angleToTarget) > 0 ? 's' : 'w'] = true;
        } else {
            // Strafe
            bot.input[Math.cos(angleToTarget + Math.PI/2) > 0 ? 'd' : 'a'] = true;
            bot.input[Math.sin(angleToTarget + Math.PI/2) > 0 ? 's' : 'w'] = true;
        }

        if (minDist < 400 && target.x !== gameState.storm.x) {
            bot.input.click = true;
        }
    }
}

// --- Client State Management ---
function updateRenderState(newState) {
    gameState.bullets = newState.bullets;
    gameState.crates = newState.crates;
    gameState.gems = newState.gems;
    gameState.storm = newState.storm;
    gameState.aliveCount = newState.aliveCount;
    
    Object.values(newState.players).forEach(p => {
        if (!renderState.players[p.id]) renderState.players[p.id] = { ...p };
        renderState.players[p.id].targetX = p.x;
        renderState.players[p.id].targetY = p.y;
        renderState.players[p.id].angle = p.angle;
        renderState.players[p.id].hp = p.hp;
        renderState.players[p.id].maxHp = p.maxHp;
        renderState.players[p.id].level = p.level;
        renderState.players[p.id].xp = p.xp;
        renderState.players[p.id].alive = p.alive;
    });
}

function lerp(start, end, amt) { return (1 - amt) * start + amt * end; }

// --- Rendering & Game Loop ---
function clientRenderLoop() {
    if (!gameState.started) return;

    if (!isHost && hostConnection && hostConnection.open) {
        let cx = canvas.width / 2;
        let cy = canvas.height / 2;
        myAngle = Math.atan2(mouse.y - cy, mouse.x - cx);
        hostConnection.send({ type: 'INPUT', input: { w: keys.w, a: keys.a, s: keys.s, d: keys.d, angle: myAngle, click: mouse.down } });
    }

    // Clear main canvas
    ctx.fillStyle = '#2f3640';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let myPlayer = renderState.players[myId];
    if (!myPlayer) { requestAnimationFrame(clientRenderLoop); return; }

    let camX = myPlayer.x - canvas.width / 2;
    let camY = myPlayer.y - canvas.height / 2;

    ctx.save();
    ctx.translate(-camX, -camY);

    // Map Grid
    ctx.strokeStyle = '#353b48';
    ctx.lineWidth = 2;
    for(let i = 0; i <= MAP_SIZE; i += 100) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, MAP_SIZE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(MAP_SIZE, i); ctx.stroke();
    }
    ctx.strokeStyle = '#e84118'; ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Crates
    ctx.fillStyle = '#9c88ff';
    ctx.strokeStyle = '#8c7ae6';
    ctx.lineWidth = 3;
    gameState.crates.forEach(c => {
        ctx.fillRect(c.x - 18, c.y - 18, 36, 36);
        ctx.strokeRect(c.x - 18, c.y - 18, 36, 36);
    });

    // Gems
    gameState.gems.forEach(g => {
        ctx.fillStyle = '#00a8ff';
        ctx.beginPath();
        ctx.arc(g.x, g.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0097e6';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.life -= 0.03;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // Bullets
    gameState.bullets.forEach(b => {
        ctx.fillStyle = '#fbc531';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 10; ctx.shadowColor = '#fbc531'; ctx.fill(); ctx.shadowBlur = 0; // Glow
    });

    // Players
    Object.values(renderState.players).forEach(p => {
        if (!p.alive) return;

        if(p.targetX !== undefined) p.x = lerp(p.x, p.targetX, 0.4);
        if(p.targetY !== undefined) p.y = lerp(p.y, p.targetY, 0.4);

        let bodyRadius = 22 + (p.level * 0.5); // Grow slightly with level

        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        // Tail boom
        ctx.fillStyle = '#2f3640';
        ctx.fillRect(-bodyRadius - 15, -4, 20, 8);
        // Tail rotor
        ctx.fillStyle = '#718093';
        ctx.fillRect(-bodyRadius - 15, -10, 4, 20);

        // Body
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, bodyRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#2f3640'; ctx.stroke();

        // Gun barrel
        ctx.fillStyle = '#718093';
        ctx.fillRect(bodyRadius - 5, -5, 18 + (p.level * 0.5), 10);
        ctx.strokeRect(bodyRadius - 5, -5, 18 + (p.level * 0.5), 10);

        // Main Rotor
        ctx.rotate(-p.angle); // reset rotation for rotor
        ctx.rotate(Date.now() / (30 - Math.min(p.level, 20))); // Spin faster with level
        ctx.fillStyle = 'rgba(220, 221, 225, 0.5)';
        let rotorLen = bodyRadius * 2.5;
        ctx.fillRect(-rotorLen/2, -3, rotorLen, 6);
        ctx.fillRect(-3, -rotorLen/2, 6, rotorLen);
        
        ctx.rotate(-Date.now() / (30 - Math.min(p.level, 20))); // reset
        ctx.translate(-p.x, -p.y);

        // Name and HP
        ctx.fillStyle = '#fff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${p.name} (Lv.${p.level})`, p.x, p.y - bodyRadius - 15);
        
        // Small HP bar
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(p.x - 20, p.y + bodyRadius + 10, 40, 6);
        ctx.fillStyle = '#e84118';
        ctx.fillRect(p.x - 20, p.y + bodyRadius + 10, 40 * (p.hp / p.maxHp), 6);
    });

    // Storm
    ctx.fillStyle = 'rgba(232, 65, 24, 0.15)'; 
    ctx.strokeStyle = '#c23616';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(gameState.storm.x, gameState.storm.y, gameState.storm.radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Inverted storm rendering (damage zone)
    ctx.beginPath();
    ctx.rect(-2000, -2000, MAP_SIZE + 4000, MAP_SIZE + 4000);
    ctx.arc(gameState.storm.x, gameState.storm.y, gameState.storm.radius, 0, Math.PI * 2, true);
    ctx.fill();

    ctx.restore();

    // --- Render Minimap ---
    mmCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    let scale = minimapCanvas.width / MAP_SIZE;
    
    // Storm on minimap
    mmCtx.fillStyle = 'rgba(232, 65, 24, 0.3)';
    mmCtx.beginPath();
    mmCtx.arc(gameState.storm.x * scale, gameState.storm.y * scale, gameState.storm.radius * scale, 0, Math.PI * 2);
    mmCtx.fill();
    mmCtx.strokeStyle = '#c23616'; mmCtx.lineWidth = 1; mmCtx.stroke();

    // Inverted storm tint on minimap
    mmCtx.fillStyle = 'rgba(232, 65, 24, 0.4)';
    mmCtx.beginPath();
    mmCtx.rect(0, 0, minimapCanvas.width, minimapCanvas.height);
    mmCtx.arc(gameState.storm.x * scale, gameState.storm.y * scale, gameState.storm.radius * scale, 0, Math.PI * 2, true);
    mmCtx.fill();

    // Me on minimap
    if (myPlayer.alive) {
        mmCtx.fillStyle = '#4cd137';
        mmCtx.beginPath();
        mmCtx.arc(myPlayer.x * scale, myPlayer.y * scale, 3, 0, Math.PI * 2);
        mmCtx.fill();
    }

    // --- Update UI ---
    document.getElementById('hud-alive').innerText = `Pilots Alive: ${gameState.aliveCount}`;
    
    if (myPlayer.alive) {
        document.getElementById('hud-hp-bar').style.width = `${(myPlayer.hp / myPlayer.maxHp) * 100}%`;
        document.getElementById('hud-xp-bar').style.width = `${(myPlayer.xp / (myPlayer.level * 25)) * 100}%`;
        document.getElementById('hud-level').innerText = `Lv: ${myPlayer.level}`;
    } else {
        document.getElementById('hud-hp-bar').style.width = `0%`;
        document.getElementById('game-over-screen').classList.remove('hidden');
    }

    requestAnimationFrame(clientRenderLoop);
}
