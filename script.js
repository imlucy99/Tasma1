// ===================== KONFIGURASI =====================
const CONFIG = {
    unit: 'MPH',      // 'MPH' atau 'KMH'
    maxSpeed: 160,    // Angka maksimal di dial (KMH: ganti ke 240)
    majorStep: 20,    // Jarak angka besar
    midStep: 10,      // Jarak tick sedang
    minorStep: 5,     // Jarak tick halus
    redStart: 140,    // Tick setelah angka ini berwarna merah
    rpmMax: 8,        // Skala RPM (x1000 r/min)
    rpmRed: 7.5,      // Mulai zona merah RPM
    oilMax: 150,      // Skala oli (PSI)
    lowFuel: 0.2      // Ikon bensin merah jika <= 20%
};

const MPS_TO_MPH = 2.236936;
const MPS_TO_KMH = 3.6;
const SPEED_FACTOR = CONFIG.unit === 'KMH' ? MPS_TO_KMH : MPS_TO_MPH;
const SVG_NS = 'http://www.w3.org/2000/svg';

// Geometri (koordinat viewBox SVG 1000 x 600)
const G = {
    speed: { cx: 514, cy: 297, r: 222, start: 135, sweep: 270 },
    rpm:   { cx: 198, cy: 349, r: 140, start: 150, sweep: 150 },
    fuel:  { cx: 794, cy: 212, r: 84 },   // E = +60deg, F = -60deg
    oil:   { cx: 789, cy: 403, r: 84 }    // 0 = +60deg, max = -60deg
};

// Elemen DOM
const elGear = document.getElementById('gear');
const elOdo = document.getElementById('odometer');
const elNeedle = document.getElementById('needle');
const elRpmNeedle = document.getElementById('rpm-needle');
const elFuelNeedle = document.getElementById('fuel-needle');
const elOilNeedle = document.getElementById('oil-needle');
const elFuelIcon = document.getElementById('fuel-icon');

if (new URLSearchParams(location.search).has('preview')) {
    document.documentElement.classList.add('preview');
}

// ===================== HELPER GEOMETRI =====================
function polar(cx, cy, radius, angleDeg) {
    const a = angleDeg * Math.PI / 180;
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
}

function arcPath(cx, cy, radius, fromDeg, toDeg) {
    const [x1, y1] = polar(cx, cy, radius, fromDeg);
    const [x2, y2] = polar(cx, cy, radius, toDeg);
    const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
    const sweep = toDeg > fromDeg ? 1 : 0;
    return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${radius} ${radius} 0 ${large} ${sweep} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function sectorPath(cx, cy, radius, fromDeg, toDeg) {
    const [x1, y1] = polar(cx, cy, radius, fromDeg);
    const [x2, y2] = polar(cx, cy, radius, toDeg);
    const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
    const sweep = toDeg > fromDeg ? 1 : 0;
    return `M${cx} ${cy} L${x1.toFixed(2)} ${y1.toFixed(2)} A${radius} ${radius} 0 ${large} ${sweep} ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
}

function line(g, cx, cy, r1, r2, angle, cls) {
    const [x1, y1] = polar(cx, cy, r1, angle);
    const [x2, y2] = polar(cx, cy, r2, angle);
    g.appendChild(svgEl('line', {
        x1: x1.toFixed(2), y1: y1.toFixed(2),
        x2: x2.toFixed(2), y2: y2.toFixed(2), class: cls
    }));
}

function text(g, cx, cy, r, angle, str, cls) {
    const [x, y] = polar(cx, cy, r, angle);
    const t = svgEl('text', { x: x.toFixed(2), y: y.toFixed(2), class: cls });
    t.textContent = str;
    g.appendChild(t);
}

function setRot(el, cx, cy, deg) {
    el.setAttribute('transform', `translate(${cx} ${cy}) rotate(${deg.toFixed(2)})`);
}

// ===================== MEMBANGUN DIAL =====================
function buildSpeed() {
    const s = G.speed;
    const ticks = document.getElementById('speed-ticks');
    const labels = document.getElementById('speed-labels');
    const ang = v => s.start + (v / CONFIG.maxSpeed) * s.sweep;

    for (let v = 0; v <= CONFIG.maxSpeed; v += CONFIG.minorStep) {
        const a = ang(v);
        let cls = 'tick-minor', len = 10;
        if (v % CONFIG.majorStep === 0) { cls = 'tick-major'; len = 26; }
        else if (v % CONFIG.midStep === 0) { cls = 'tick-mid'; len = 17; }
        if (v > CONFIG.redStart && cls !== 'tick-major') cls += ' over';

        line(ticks, s.cx, s.cy, s.r, s.r - len, a, cls);
        if (v % CONFIG.majorStep === 0) {
            text(labels, s.cx, s.cy, s.r - 52, a, v, 'tick-label');
        }
    }

    document.getElementById('unit-text').textContent = CONFIG.unit === 'KMH' ? 'km/h' : 'mph';
    document.getElementById('odo-unit').innerText = CONFIG.unit === 'KMH' ? 'km' : 'mi';
}

function buildRpm() {
    const g = G.rpm;
    const ticks = document.getElementById('rpm-ticks');
    const labels = document.getElementById('rpm-labels');

    document.getElementById('rpm-rim').setAttribute('d', arcPath(g.cx, g.cy, g.r + 12, 135, 310));

    for (let r = 0; r <= CONFIG.rpmMax + 0.001; r += 0.25) {
        const a = g.start + (r / CONFIG.rpmMax) * g.sweep;
        const major = Number.isInteger(r);
        const half = !major && (r * 2) % 1 === 0;
        const isRed = r >= CONFIG.rpmRed;
        const len = major ? 15 : (half ? 10 : 6);
        line(ticks, g.cx, g.cy, g.r, g.r - len, a,
            'rpm-tick' + (major ? ' major' : '') + (isRed ? ' red' : ''));
        if (major) text(labels, g.cx, g.cy, g.r - 30, a, r, 'rpm-num' + (isRed ? ' red' : ''));
    }
}

function buildFuel() {
    const g = G.fuel;
    const ticks = document.getElementById('fuel-ticks');
    document.getElementById('fuel-rim').setAttribute('d', arcPath(g.cx, g.cy, 90, -100, 100));

    for (let i = 0; i <= 8; i++) {
        const a = 60 - (i / 8) * 120;
        const major = i % 4 === 0;
        line(ticks, g.cx, g.cy, g.r, g.r - (major ? 13 : 8), a,
            'mini-tick' + (major ? ' major' : '') + (i === 0 ? ' red' : ''));
    }
}

function buildOil() {
    const g = G.oil;
    const ticks = document.getElementById('oil-ticks');
    const labels = document.getElementById('oil-labels');
    document.getElementById('oil-rim').setAttribute('d', arcPath(g.cx, g.cy, 90, -100, 100));

    for (let p = 0; p <= CONFIG.oilMax; p += 10) {
        const a = 60 - (p / CONFIG.oilMax) * 120;
        const major = p % 50 === 0;
        line(ticks, g.cx, g.cy, g.r, g.r - (major ? 13 : 8), a,
            'mini-tick' + (major ? ' major' : '') + (p <= 10 ? ' red' : ''));
        if (major) text(labels, g.cx, g.cy, g.r - 30, a, p, 'oil-num');
    }
}

buildSpeed();
buildRpm();
buildFuel();
buildOil();

// ===================== POSISI JARUM =====================
function speedAngle(value) {
    const v = Math.max(0, Math.min(CONFIG.maxSpeed, value));
    return G.speed.start + (v / CONFIG.maxSpeed) * G.speed.sweep;
}

// Jarum bergerak halus 60 FPS: game cuma kirim nilai target (biasanya jarang),
// lalu jarum mengejar target tiap frame dengan kecepatan yang tidak bergantung FPS.
const needles = {
    speed: { el: elNeedle,     cx: G.speed.cx, cy: G.speed.cy, cur: G.speed.start, target: G.speed.start, rate: 14 },
    rpm:   { el: elRpmNeedle,  cx: G.rpm.cx,   cy: G.rpm.cy,   cur: G.rpm.start,   target: G.rpm.start,   rate: 18 },
    fuel:  { el: elFuelNeedle, cx: G.fuel.cx,  cy: G.fuel.cy,  cur: -60,           target: -60,           rate: 10 },
    oil:   { el: elOilNeedle,  cx: G.oil.cx,   cy: G.oil.cy,   cur: 60,            target: 60,            rate: 10 }
};

function setSpeedNeedle(value) { needles.speed.target = speedAngle(value); }
function setRpmNeedle(p)  { needles.rpm.target = G.rpm.start + p * G.rpm.sweep; }
function setFuelNeedle(p) { needles.fuel.target = 60 - p * 120; }
function setOilNeedle(p)  { needles.oil.target = 60 - p * 120; }

let lastFrame = performance.now();
function frame(now) {
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    for (const k in needles) {
        const n = needles[k];
        if (n.cur !== n.target) {
            n.cur += (n.target - n.cur) * (1 - Math.exp(-dt * n.rate));
            if (Math.abs(n.target - n.cur) < 0.02) n.cur = n.target;
            setRot(n.el, n.cx, n.cy, n.cur);
        }
    }
    requestAnimationFrame(frame);
}

// Posisi awal (langsung, tanpa gerak)
setSpeedNeedle(0);
setRpmNeedle(0);
setFuelNeedle(1);
setOilNeedle(0);
for (const k in needles) {
    const n = needles[k];
    n.cur = n.target;
    setRot(n.el, n.cx, n.cy, n.cur);
}
requestAnimationFrame(frame);

// ===================== HELPER =====================
// Mendeteksi nilai TRUE/LOCKED dari JGRP (1, "1", true, "true", atau 2)
function isLockedState(val) {
    return val === true || val === 1 || val === "1" || val === "true" || val === 2 || val === "2";
}

function isTrueValue(val) {
    return val === true || val === 1 || val === "1" || val === "true";
}

function clamp01(n) {
    return Math.max(0, Math.min(1, n));
}

// ===================== API UNTUK JGRP / CEF =====================

// 1. Kecepatan (input m/s, jarum analog + 3 digit)
window.setSpeed = function(speed) {
    setSpeedNeedle(Math.round(Number(speed || 0) * SPEED_FACTOR));
};

// 2. RPM (0.0 - 1.0)
window.setRPM = function(rpm) {
    setRpmNeedle(clamp01(Number(rpm || 0)));
};

// 3. Bensin (0.0-1.0 atau 0-100%)
window.setFuel = function(fuel) {
    const val = Number(fuel || 0);
    const percent = clamp01(val > 1 ? val / 100 : val);
    setFuelNeedle(percent);
    if (elFuelIcon) elFuelIcon.setAttribute('class', percent <= CONFIG.lowFuel ? 'side-icon low' : 'side-icon');
};

// 4. Oli (PSI langsung, 0 - 150)
window.setOil = function(psi) {
    setOilNeedle(clamp01(Number(psi || 0) / CONFIG.oilMax));
};

// 5. Engine Health (0.0-1.0 atau 0-1000) -> ditampilkan di gauge kanan bawah
window.setHealth = function(health) {
    const val = Number(health || 0);
    const percent = clamp01(val > 1 ? val / 1000 : val);
    setOilNeedle(percent);
};

// 6. Gear
window.setGear = function(gear) {
    if (!elGear) return;
    elGear.innerText = (gear == 0 || gear === "0") ? 'R' : String(gear);
};

// 7. Lock / Unlock Vehicle
window.updateLockStatus = function(state) {
    const el = document.getElementById('door-lock');
    if (!el) return;
    el.className = isLockedState(state) ? 'icon-item locked' : 'icon-item';
};

// Alias lock/unlock CEF
window.setDoors = window.updateLockStatus;
window.setDoorLock = window.updateLockStatus;
window.setVehicleLocked = window.updateLockStatus;
window.setLocked = window.updateLockStatus;
window.setLock = window.updateLockStatus;
window.toggleLock = window.updateLockStatus;

// 8. Lampu (0 = mati, 1 = dekat, 2 = jauh)
window.setHeadlights = function(state) {
    const low = document.getElementById('headlight-low');
    const high = document.getElementById('headlight-high');
    const val = Number(state || 0);
    if (low) low.className = (val === 1) ? 'icon-item active' : 'icon-item';
    if (high) high.className = (val === 2) ? 'icon-item high-beam' : 'icon-item';
};

// 9. Lampu Sein dihapus dari tampilan (fungsi dibiarkan kosong agar panggilan dari game tidak error)
window.setLeftIndicator = function() {};
window.setRightIndicator = function() {};

// 10. Seatbelt
window.setSeatbelts = function(state) {
    const el = document.getElementById('seatbelts');
    if (el) el.className = isTrueValue(state) ? 'icon-item active' : 'icon-item warn';
};

// 11. Odometer
window.setOdometer = function(distance) {
    if (elOdo) elOdo.innerText = Number(distance || 0).toFixed(1);
};

// Komunikasi via Event Message
window.addEventListener('message', function(event) {
    if (!event.data) return;
    const data = event.data;

    if (data.type === 'setDoors' || data.action === 'setDoors' || data.type === 'lock') {
        window.updateLockStatus(data.status !== undefined ? data.status : data.state);
    }
});

// Nilai contoh untuk preview di browser: buka index.html?preview&demo
if (new URLSearchParams(location.search).has('demo')) {
    setSpeed(23);          // ~51 mph
    setRPM(0.45);
    setFuel(0.7);
    setHealth(0.8);
    setGear(3);
    setOdometer(1234.5);
    setHeadlights(1);
    setSeatbelts(true);
}
