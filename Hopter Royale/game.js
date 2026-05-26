// --- Game Configuration & Globals ---
const MAP_SIZE = 2000;
const MAX_PLAYERS = 15;
const TICK_RATE = 30; // Host updates per second

const NAMES = ["SkyHawk", "RotorBoss", "ChopperChomp", "AeroViper", "PropNinja", "Pranesh The Dog", "HeliHound", "HoverGhost", "RotorRogue", "FlightFury", "SkyStriker", "WindWeaver", "AirAssassin", "WhirlyBird", "GatorCopter", "MetalLocust", "SteelWasp", "IronDragon", "StormRider", "CloudCutter"];

let myName = NAMES[Math.floor(Math.random() * NAMES.length)];
let myId = null;
let isHost = false;
let peer = null;
let connections = {}; // Host stores client connections
let hostConnection = null; // Client stores host connection

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
    storm: { x: MAP_SIZE / 2, y: MAP_SIZE / 2, radius: MAP_SIZE },
    aliveCount: 0
};

// Lerp targets for client rendering
let renderState = { players: {} };

// DOM Elements
const menuScreen = document.getElementById('menu-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameUI = document.getElementById('game-ui');
const nameDisplay = document.getElementById('player-name-display');
const joinInput = document.getElementById('join-code-input');
const playerListUI = document.getElementById('player-list');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

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
    document.getElementById('menu-status').innerText = "Starting Host...";
    
    peer = new Peer(myId);
    peer.on('open', (id) => {
        menuScreen.classList.add('hidden');
        lobbyScreen.classList.remove('hidden');
        document.getElementById('room-code-display').innerText = `Code: ${id}`;
        document.getElementById('btn-start-game').classList.remove('hidden');
        
        // Add host to player list
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

    peer.on('error', (err) => { document.getElementById('menu-status').innerText = err.message; });
}

function initClient(hostCode) {
    isHost = false;
    document.getElementById('menu-status').innerText = "Connecting...";
    peer = new Peer(); // Client gets random ID

    peer.on('open', (id) => {
        myId = id;
        hostConnection = peer.connect(hostCode, { reliable: true });
        
        hostConnection.on('open', () => {
            menuScreen.classList.add('hidden');
            lobbyScreen.classList.remove('hidden');
            document.getElementById('room-code-display').innerText = `Code: ${hostCode}`;
            hostConnection.send({ type: 'JOIN', name: myName });
        });

        hostConnection.on('data', (data) => {
            if (data.type === 'LOBBY_UPDATE') {
                gameState.players = data.players;
                updateLobbyUI();
            } else if (data.type === 'START_GAME') {
                lobbyScreen.classList.add('hidden');
                gameUI.classList.remove('hidden');
                gameState = data.state; // Initial sync
                requestAnimationFrame(clientRenderLoop);
            } else if (data.type === 'STATE_UPDATE') {
                updateRenderState(data.state);
            }
        });

        hostConnection.on('close', () => { alert("Host disconnected."); location.reload(); });
    });

    peer.on('error', (err) => { document.getElementById('menu-status').innerText = "Failed to connect to Host."; });
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

document.getElementById('btn-start-game').addEventListener('click', () => {
    if (!isHost) return;
    document.getElementById('btn-start-game').classList.add('hidden');
    
    // Bot Backfilling
    let currentPlayers = Object.keys(gameState.players).length;
    for (let i = currentPlayers; i < MAX_PLAYERS; i++) {
        let botId = 'BOT_' + i;
        gameState.players[botId] = createPlayer(botId, `Bot_${NAMES[Math.floor(Math.random() * NAMES.length)]}`, true);
    }
    
    // Spawn initial crates
    for (let i = 0; i < 40; i++) spawnCrate();

    gameState.started = true;
    gameState.aliveCount = Object.keys(gameState.players).length;
    
    // Broadcast start
    Object.values(connections).forEach(conn => conn.send({ type: 'START_GAME', state: gameState }));
    
    lobbyScreen.classList.add('hidden');
    gameUI.classList.remove('hidden');
    
    // Start Host Loops
    setInterval(hostTick, 1000 / TICK_RATE);
    requestAnimationFrame(clientRenderLoop); // Host also renders locally
});

// --- Factory Functions ---
function createPlayer(id, name, isBot) {
    return {
        id: id, name: name, isBot: isBot, alive: true,
        x: Math.random() * (MAP_SIZE - 200) + 100,
        y: Math.random() * (MAP_SIZE - 200) + 100,
        vx: 0, vy: 0, angle: 0,
        color: isBot ? '#e67e22' : '#2ecc71',
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
        hp: 30
    });
}

// --- Input Handling ---
window.addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'ArrowUp') keys.w = true;
    if (e.key === 'a' || e.key === 'ArrowLeft') keys.a = true;
    if (e.key === 's' || e.key === 'ArrowDown') keys.s = true;
    if (e.key === 'd' || e.key === 'ArrowRight') keys.d = true;
});
window.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'ArrowUp') keys.w = false;
    if (e.key === 'a' || e.key === 'ArrowLeft') keys.a = false;
    if (e.key === 's' || e.key === 'ArrowDown') keys.s = false;
    if (e.key === 'd' || e.key === 'ArrowRight') keys.d = false;
});
window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', () => mouse.down = true);
window.addEventListener('mouseup', () => mouse.down = false);

// --- Host Game Logic (Authoritative) ---
function hostTick() {
    if (!gameState.started) return;

    // Apply Host's own local inputs to state
    if (gameState.players[myId] && gameState.players[myId].alive) {
        // Calculate host angle based on screen center (camera focuses on player)
        let cx = canvas.width / 2;
        let cy = canvas.height / 2;
        let angle = Math.atan2(mouse.y - cy, mouse.x - cx);
        gameState.players[myId].input = { w: keys.w, a: keys.a, s: keys.s, d: keys.d, angle: angle, click: mouse.down };
    }

    gameState.aliveCount = 0;

    Object.values(gameState.players).forEach(p => {
        if (!p.alive) return;
        gameState.aliveCount++;

        // Bot AI
        if (p.isBot) runBotAI(p);

        // Movement Physics
        let speed = 2;
        if (p.input.w) p.vy -= speed;
        if (p.input.s) p.vy += speed;
        if (p.input.a) p.vx -= speed;
        if (p.input.d) p.vx += speed;

        p.vx *= 0.85; // Friction
        p.vy *= 0.85;
        p.x += p.vx;
        p.y += p.vy;

        // Map Bounds
        if (p.x < 20) { p.x = 20; p.vx = 0; }
        if (p.y < 20) { p.y = 20; p.vy = 0; }
        if (p.x > MAP_SIZE - 20) { p.x = MAP_SIZE - 20; p.vx = 0; }
        if (p.y > MAP_SIZE - 20) { p.y = MAP_SIZE - 20; p.vy = 0; }

        p.angle = p.input.angle;

        // Shooting
        if (p.fireCooldown > 0) p.fireCooldown--;
        if (p.input.click && p.fireCooldown <= 0) {
            let fireRate = Math.max(5, 15 - p.level); // Shoots faster as level increases
            p.fireCooldown = fireRate;
            let bSize = 4 + (p.level * 0.5); // Bullets get slightly larger
            gameState.bullets.push({
                x: p.x + Math.cos(p.angle) * 20,
                y: p.y + Math.sin(p.angle) * 20,
                vx: Math.cos(p.angle) * 15,
                vy: Math.sin(p.angle) * 15,
                ownerId: p.id,
                size: bSize,
                life: 60 // frames
            });
        }

        // Gem Collection
        for (let i = gameState.gems.length - 1; i >= 0; i--) {
            let g = gameState.gems[i];
            let dx = p.x - g.x; let dy = p.y - g.y;
            if (Math.sqrt(dx*dx + dy*dy) < 25) { // 20 player radius + 5 gem radius
                gameState.gems.splice(i, 1);
                p.xp += 10;
                let xpNeeded = p.level * 20;
                if (p.xp >= xpNeeded) {
                    p.level++;
                    p.xp = 0;
                    p.maxHp += 10;
                    p.hp = p.maxHp;
                }
            }
        }

        // Storm Damage
        let distToStormCenter = Math.sqrt(Math.pow(p.x - gameState.storm.x, 2) + Math.pow(p.y - gameState.storm.y, 2));
        if (distToStormCenter > gameState.storm.radius) {
            p.hp -= 0.5; // Tick damage
        }

        if (p.hp <= 0) p.alive = false;
    });

    // Bullets update & collision
    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
        let b = gameState.bullets[i];
        b.x += b.vx;
        b.y += b.vy;
        b.life--;
        let destroyed = false;

        if (b.life <= 0) { gameState.bullets.splice(i, 1); continue; }

        // Bullet vs Players
        Object.values(gameState.players).forEach(p => {
            if (destroyed || !p.alive || p.id === b.ownerId) return;
            let dx = p.x - b.x; let dy = p.y - b.y;
            if (Math.sqrt(dx*dx + dy*dy) < 20 + b.size) { // Hit
                p.hp -= 15;
                destroyed = true;
            }
        });

        // Bullet vs Crates
        if (!destroyed) {
            for (let c = gameState.crates.length - 1; c >= 0; c--) {
                let crate = gameState.crates[c];
                // Crate AABB collision (size 30x30 centered)
                if (b.x > crate.x - 15 && b.x < crate.x + 15 && b.y > crate.y - 15 && b.y < crate.y + 15) {
                    crate.hp -= 15;
                    destroyed = true;
                    if (crate.hp <= 0) {
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
    if (gameState.storm.radius > 50) gameState.storm.radius -= 0.2;

    // Send state to clients
    Object.values(connections).forEach(conn => conn.send({ type: 'STATE_UPDATE', state: gameState }));
    
    // Update local render state for Host
    updateRenderState(gameState);
}

function runBotAI(bot) {
    // Very simple AI: Find nearest crate or player, move towards it, shoot if close.
    let target = null;
    let minDist = 9999;

    // Find nearest crate
    gameState.crates.forEach(c => {
        let dist = Math.sqrt(Math.pow(bot.x - c.x, 2) + Math.pow(bot.y - c.y, 2));
        if (dist < minDist) { minDist = dist; target = c; }
    });

    // Find nearest player
    Object.values(gameState.players).forEach(p => {
        if (p.id === bot.id || !p.alive) return;
        let dist = Math.sqrt(Math.pow(bot.x - p.x, 2) + Math.pow(bot.y - p.y, 2));
        if (dist < minDist) { minDist = dist; target = p; }
    });

    bot.input.w = false; bot.input.a = false; bot.input.s = false; bot.input.d = false; bot.input.click = false;

    // Stay in storm logic overrides targets
    let distToStorm = Math.sqrt(Math.pow(bot.x - gameState.storm.x, 2) + Math.pow(bot.y - gameState.storm.y, 2));
    if (distToStorm > gameState.storm.radius - 100) {
        target = { x: gameState.storm.x, y: gameState.storm.y };
    }

    if (target) {
        let angleToTarget = Math.atan2(target.y - bot.y, target.x - bot.x);
        bot.input.angle = angleToTarget;
        
        // Move towards if far
        if (minDist > 100 || target.x === gameState.storm.x) {
            if (Math.abs(Math.cos(angleToTarget)) > 0.3) bot.input[Math.cos(angleToTarget) > 0 ? 'd' : 'a'] = true;
            if (Math.abs(Math.sin(angleToTarget)) > 0.3) bot.input[Math.sin(angleToTarget) > 0 ? 's' : 'w'] = true;
        }

        // Shoot if close to a player or crate
        if (minDist < 300 && target.x !== gameState.storm.x) {
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
    
    // Set lerp targets for players
    Object.values(newState.players).forEach(p => {
        if (!renderState.players[p.id]) renderState.players[p.id] = { ...p }; // Initial sync
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

    // Send Inputs to Host if Client
    if (!isHost && hostConnection && hostConnection.open) {
        let cx = canvas.width / 2;
        let cy = canvas.height / 2;
        myAngle = Math.atan2(mouse.y - cy, mouse.x - cx);
        hostConnection.send({ type: 'INPUT', input: { w: keys.w, a: keys.a, s: keys.s, d: keys.d, angle: myAngle, click: mouse.down } });
    }

    // Clear Canvas
    ctx.fillStyle = '#222f3e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let myPlayer = renderState.players[myId];
    if (!myPlayer) { requestAnimationFrame(clientRenderLoop); return; } // Wait for state

    // Camera Offset
    let camX = myPlayer.x - canvas.width / 2;
    let camY = myPlayer.y - canvas.height / 2;

    ctx.save();
    ctx.translate(-camX, -camY);

    // Draw Grid (Map Background)
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 1;
    for(let i = 0; i <= MAP_SIZE; i += 100) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, MAP_SIZE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(MAP_SIZE, i); ctx.stroke();
    }
    // Map Border
    ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Draw Crates
    ctx.fillStyle = '#8e44ad';
    gameState.crates.forEach(c => {
        ctx.fillRect(c.x - 15, c.y - 15, 30, 30);
    });

    // Draw Gems
    ctx.fillStyle = '#3498db';
    gameState.gems.forEach(g => {
        ctx.beginPath();
        ctx.arc(g.x, g.y, 6, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw Bullets
    ctx.fillStyle = '#f1c40f';
    gameState.bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw Players (Lerped)
    Object.values(renderState.players).forEach(p => {
        if (!p.alive) return;

        // Lerp position for smooth movement
        if(p.targetX !== undefined) p.x = lerp(p.x, p.targetX, 0.3);
        if(p.targetY !== undefined) p.y = lerp(p.y, p.targetY, 0.3);

        // Helicopter Body
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
        ctx.fill();

        // Direction Indicator / Gun
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30);
        ctx.stroke();

        // Rotor (Animated slightly based on time)
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Date.now() / 50); // Spinning rotor effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(-25, -2, 50, 4);
        ctx.fillRect(-2, -25, 4, 50);
        ctx.restore();

        // Nameplate
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, p.x, p.y - 30);
    });

    // Draw Storm
    ctx.fillStyle = 'rgba(231, 76, 60, 0.2)'; // Inner safe zone tint
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(gameState.storm.x, gameState.storm.y, gameState.storm.radius, 0, Math.PI * 2);
    ctx.stroke();
    // Render the "danger zone" invertedly by drawing a massive rect with a cutout
    ctx.beginPath();
    ctx.rect(-1000, -1000, MAP_SIZE + 2000, MAP_SIZE + 2000); // Massive outer box
    ctx.arc(gameState.storm.x, gameState.storm.y, gameState.storm.radius, 0, Math.PI * 2, true); // Cutout
    ctx.fill();

    ctx.restore();

    // --- Update UI ---
    document.getElementById('hud-alive').innerText = `Players Alive: ${gameState.aliveCount}`;
    
    if (myPlayer.alive) {
        document.getElementById('hud-hp-bar').style.width = `${(myPlayer.hp / myPlayer.maxHp) * 100}%`;
        document.getElementById('hud-xp-bar').style.width = `${(myPlayer.xp / (myPlayer.level * 20)) * 100}%`;
        document.getElementById('hud-level').innerText = `Level: ${myPlayer.level}`;
    } else {
        document.getElementById('hud-hp-bar').style.width = `0%`;
        document.getElementById('game-over-screen').classList.remove('hidden');
    }

    requestAnimationFrame(clientRenderLoop);
}
