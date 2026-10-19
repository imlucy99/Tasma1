// ===================== KONFIGURASI =====================
const CONFIG = {
    unit: 'KMH',          // 'MPH' atau 'KMH'
    maxSpeed: 200,        // Angka maksimal di dial
    majorStep: 20,        // Garis tebal + angka
    midStep: 10,          // Garis tipis
    redMarks: [40, 80]    // Tanda merah kecil di dial (kosongkan [] kalau tidak mau)
};
const SPEED_FACTOR = CONFIG.unit === 'KMH' ? 3.6 : 2.236936;
const NS = 'http://www.w3.org/2000/svg';

// Geometri dial (viewBox 800 x 370). Pivot jarum ada di bawah jendela krem.
const PX = 400, PY = 259, A0 = 203.6, SWEEP = 132.8;
const yOut = x => 144 + 21 * Math.pow((x - 400) / 240, 2);   // tepi atas wajah krem
const yIn  = x => 183 + 5 * Math.pow((x - 400) / 240, 2);    // ujung dalam garis skala

if (new URLSearchParams(location.search).has('preview')) document.documentElement.classList.add('preview');

function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) k === 'text' ? e.textContent = attrs[k] : e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
}
const $ = id => document.getElementById(id);
const art = $('art'), gauges = $('gauges');

// Cari jarak dari pivot ke kurva (outer/inner) pada sudut tertentu
function rAt(deg, fn) {
    const a = deg * Math.PI / 180;
    for (let r = 20; r < 500; r += 0.5) {
        if (PY + r * Math.sin(a) <= fn(PX + r * Math.cos(a))) return r;
    }
    return 0;
}
const valueToAngle = v => A0 + Math.max(0, Math.min(CONFIG.maxSpeed, v)) / CONFIG.maxSpeed * SWEEP;

// ===================== DIAL =====================
for (let v = 0; v <= CONFIG.maxSpeed; v += CONFIG.midStep) {
    const a = valueToAngle(v), rad = a * Math.PI / 180;
    const major = v % CONFIG.majorStep === 0;
    const r1 = rAt(a, yIn), r2 = rAt(a, yOut) - (major ? 0 : 6);
    const line = (cls, rr1, rr2) => el('line', {
        x1: PX + rr1 * Math.cos(rad), y1: PY + rr1 * Math.sin(rad),
        x2: PX + rr2 * Math.cos(rad), y2: PY + rr2 * Math.sin(rad), class: cls
    }, art);
    line(major ? 'tk-major' : 'tk-mid', r1, r2);
    if (CONFIG.redMarks.includes(v)) line('tk-red', r2 - 24, r2 - 4);
    if (major) {
        const t = v / CONFIG.maxSpeed;
        el('text', { x: 165 + t * 470, y: 124 + 16 * Math.pow(2 * t - 1, 2), class: 'num', text: v }, art);
    }
}
el('text', { x: 622, y: 193, class: 'unit', text: CONFIG.unit === 'KMH' ? 'km/h' : 'mph' }, art);
el('text', { x: 400, y: 207, class: 'brand', text: 'JGVRP' }, art);

// Odometer mekanik (6 digit, digit terakhir = desimal)
el('rect', { x: 358, y: 211, width: 84, height: 20, rx: 2, class: 'odo-bg' }, art);
const odoDigits = [];
for (let i = 0; i < 6; i++) {
    const x = 360 + i * 13.5;
    el('rect', { x, y: 213, width: 12.5, height: 16, class: i === 5 ? 'odo-box' : 'odo-bg' }, art);
    const t = el('text', { x: x + 6.2, y: 221.5, class: 'odo-d' + (i === 5 ? ' odo-t' : ''), text: '0' }, art);
    odoDigits.push(t);
}
// Jendela gear
el('text', { x: 478, y: 207, class: 'cap dk', text: 'GEAR' }, art);
el('rect', { x: 466, y: 211, width: 24, height: 20, rx: 2, class: 'odo-bg' }, art);
const elGear = el('text', { x: 478, y: 221.5, class: 'odo-d', text: '1' }, art);

// ===================== ANIMASI JARUM =====================
const anims = [];
function anim(k, start, apply) {
    const o = { cur: start, tgt: start, k, apply };
    anims.push(o); apply(start); return o;
}
(function loop() {
    for (const o of anims) {
        o.cur += (o.tgt - o.cur) * o.k;
        if (Math.abs(o.tgt - o.cur) < 0.01) o.cur = o.tgt;
        o.apply(o.cur);
    }
    requestAnimationFrame(loop);
})();

const needle = el('path', { id: 'needle', d: 'M0 -3.4L1 -.8L1 .8L0 3.4Z' }, $('needleLayer'));
const speedAnim = anim(0.2, A0, a => needle.setAttribute('transform',
    `translate(${PX} ${PY}) rotate(${a.toFixed(2)}) scale(${(rAt(a, yIn) + 6).toFixed(1)} 1)`));

// ===================== GAUGE KECIL =====================
const GY = 262, GH = 56;
function box(x, w) {
    el('rect', { x, y: GY, width: w, height: GH, rx: 7, class: 'gbox' }, gauges);
    const id = 'gc' + x;
    el('rect', { x, y: GY, width: w, height: GH, rx: 7 }, el('clipPath', { id }, gauges));
    return el('g', { 'clip-path': `url(#${id})` }, gauges);
}
const A_E = 215, A_SW = 110;
function needleGauge(x, w, iconPath, l, r) {
    const g = box(x, w), cx = x + w / 2, py = GY + GH - 6;
    for (let i = 0; i <= 10; i++) {
        const a = (A_E + i * A_SW / 10) * Math.PI / 180, len = i % 5 ? 4 : 8;
        el('line', { x1: cx + 44 * Math.cos(a), y1: py + 44 * Math.sin(a),
            x2: cx + (44 - len) * Math.cos(a), y2: py + (44 - len) * Math.sin(a), class: 'gline' }, g);
    }
    const a1 = A_E * Math.PI / 180, a2 = (A_E + 22) * Math.PI / 180;
    el('path', { d: `M${cx + 41 * Math.cos(a1)} ${py + 41 * Math.sin(a1)}A41 41 0 0 1 ${cx + 41 * Math.cos(a2)} ${py + 41 * Math.sin(a2)}`, class: 'gred' }, g);
    el('text', { x: x + 12, y: GY + 13, class: 'gtxt', text: l }, g);
    el('text', { x: x + w - 12, y: GY + 13, class: 'gtxt', text: r }, g);
    const icon = el('path', { d: iconPath, class: 'gicon', transform: `translate(${cx - 2} ${GY + 24}) scale(.62)` }, g);
    const n = el('path', { d: 'M-6 -1.3L46 -.5L46 .5L-6 1.3Z', class: 'gneedle' }, g);
    const an = anim(0.15, A_E, a => n.setAttribute('transform', `translate(${cx} ${py}) rotate(${a.toFixed(2)})`));
    return { an, icon };
}
function bulb(cx, cy, r, glyph, label, cls) {
    const g = el('g', { class: 'bulb ' + cls }, gauges);
    el('circle', { cx, cy, r: r + 3, class: 'bez' }, g);
    el('circle', { cx, cy, r, class: 'glass' }, g);
    el('path', { d: glyph, class: 'glyph', transform: `translate(${cx - r * .62} ${cy - r * .62}) scale(${r * 1.24 / 24})` }, g);
    el('ellipse', { cx: cx - r * .3, cy: cy - r * .45, rx: r * .34, ry: r * .18, class: 'shine' }, g);
    if (label) el('text', { x: cx, y: cy + r + 11, class: 'cap', text: label }, g);
    return g;
}

const ICON_FUEL = 'M19 11h-1V3c0-.55-.45-1-1-1H7c-.55 0-1 .45-1 1v18h12c.55 0 1-.45 1-1v-6c0-1.66-1.34-3-3-3zM8 4h8v5H8V4z';
const ICON_ENG  = 'M22 12c0-.6-.4-1-1-1h-2V9c0-.6-.4-1-1-1h-2V5c0-.6-.4-1-1-1H9c-.6 0-1 .4-1 1v3H6c-.6 0-1 .4-1 1v2H3c-.6 0-1 .4-1 1v3c0 .6.4 1 1 1h2v2c0 .6.4 1 1 1h12c.6 0 1-.4 1-1v-2h2c.6 0 1-.4 1-1v-3zM10 6h4v2h-4V6z';
const G_LEFT = 'M10 4 2 12l8 8v-5h12V9H10z', G_RIGHT = 'M14 4l8 8-8 8v-5H2V9h12z';
const G_HEAD = 'M12 6a6 6 0 0 1 0 12zM2 8h7v1.8H2zM2 11.1h7v1.8H2zM2 14.2h7v1.8H2z';
const G_LOCK = 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM8.9 6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2H8.9z';
const G_BELT = 'M12 2a2.2 2.2 0 1 0 0 4.4A2.2 2.2 0 0 0 12 2zM8 8h8l1 7h-2l-.5 7h-5L9 15H7zM16.5 6.5l1.4 1.4L7.5 18.3l-1.4-1.4z';

// 1) BENSIN  2) INDIKATOR LAMPU (bohlam)  3) SEATBELT  4) ENGINE HEALTH
const fuelG = needleGauge(60, 104, ICON_FUEL, 'E', 'F');
box(186, 140);
const elSigL = bulb(208, 285, 11, G_LEFT, 'KIRI', 'sig sigL');
const elHead = bulb(240, 285, 11, G_HEAD, 'LAMPU', 'head');
const elLock = bulb(272, 285, 11, G_LOCK, 'KUNCI', 'lock');
const elSigR = bulb(304, 285, 11, G_RIGHT, 'KANAN', 'sig sigR');
box(474, 140);
const elBelt = bulb(544, 288, 14, G_BELT, '', 'belt on');
el('text', { x: 500, y: GY + 44, class: 'cap', text: 'SABUK' }, gauges);
el('text', { x: 588, y: GY + 44, class: 'cap', text: 'SABUK' }, gauges);
const engG = needleGauge(636, 104, ICON_ENG, '0', '100');

// ===================== HELPER =====================
function isLockedState(v) { return v === true || v === 1 || v === "1" || v === "true" || v === 2 || v === "2"; }
function isTrueValue(v) { return v === true || v === 1 || v === "1" || v === "true"; }
const setNeedleGauge = (g, p, mid) => {
    p = Math.max(0, Math.min(1, p));
    g.an.tgt = A_E + p * A_SW;
    return p;
};

// ===================== API UNTUK JGRP / CEF =====================
// 1. Kecepatan (input m/s)
window.setSpeed = function (speed) {
    speedAnim.tgt = valueToAngle(Math.round(Number(speed || 0) * SPEED_FACTOR));
};
// 2. RPM (tidak ada di desain klasik, fungsi dibiarkan agar script server tidak error)
window.setRPM = function () {};
// 3. Bensin (0.0-1.0 atau 0-100)
window.setFuel = function (fuel) {
    const val = Number(fuel || 0);
    const p = setNeedleGauge(fuelG, val > 1 ? val / 100 : val);
    fuelG.icon.classList.toggle('danger', p <= 0.2);
};
// 4. Engine Health (0-1000 atau 0.0-1.0)
window.setHealth = function (health) {
    const val = Number(health || 0);
    const p = setNeedleGauge(engG, val > 1 ? val / 1000 : val);
    engG.icon.classList.toggle('danger', p <= 0.25);
    engG.icon.classList.toggle('warn', p > 0.25 && p <= 0.5);
};
// 5. Gear
window.setGear = function (gear) {
    elGear.textContent = (gear == 0 || gear === "0") ? 'R' : String(gear);
};
// 6. Lock / Unlock (kuning menyala = terkunci)
window.updateLockStatus = function (state) {
    elLock.classList.toggle('on', isLockedState(state));
};
window.setDoors = window.setDoorLock = window.setVehicleLocked = window.setLocked =
    window.setLock = window.toggleLock = window.updateLockStatus;
// 7. Lampu: 0 = mati, 1 = dekat (hijau), 2 = jauh (biru)
window.setHeadlights = function (state) {
    const v = Number(state || 0);
    elHead.classList.toggle('on', v === 1 || v === 2);
    elHead.style.setProperty('--c', v === 2 ? '#3d8bff' : '#2bd96a');
};
// 8. Sein
window.setLeftIndicator = s => elSigL.classList.toggle('on', isTrueValue(s));
window.setRightIndicator = s => elSigR.classList.toggle('on', isTrueValue(s));
// 9. Seatbelt: sudah dipakai = lampu mati, belum = merah menyala
window.setSeatbelts = s => elBelt.classList.toggle('on', !isTrueValue(s));
// 10. Odometer
window.setOdometer = function (distance) {
    const n = Math.floor(Math.max(0, Number(distance || 0)) * 10) % 1000000;
    const s = String(n).padStart(6, '0');
    odoDigits.forEach((t, i) => t.textContent = s[i]);
};

window.addEventListener('message', function (event) {
    const d = event.data;
    if (!d) return;
    if (d.type === 'setDoors' || d.action === 'setDoors' || d.type === 'lock') {
        window.updateLockStatus(d.status !== undefined ? d.status : d.state);
    }
});
