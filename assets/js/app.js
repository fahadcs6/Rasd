/* ==========================================================================
   RASD Showcase v2.2.1 — Precision Radar, Motion, Simulation & Document Engine
   Zero external CDN dependencies · Subpath-safe (/Rasd/) · RTL & Reduced-Motion safe
   ========================================================================== */

const CFG = window.RASD_CONFIG || {};
const REDUCED_MQ = window.matchMedia("(prefers-reduced-motion: reduce)");
let REDUCED = REDUCED_MQ.matches;
if (REDUCED_MQ.addEventListener) {
  REDUCED_MQ.addEventListener("change", (e) => { REDUCED = e.matches; });
} else if (REDUCED_MQ.addListener) {
  REDUCED_MQ.addListener((e) => { REDUCED = e.matches; });
}

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;

const state = {
  lang: resolveInitialLang(),
  docLang: null,
  flowIdx: 0,
  flowTourTimer: null,
  pillarIdx: 0,
  hotspotIdx: 0,
  lvlIdx: 2,          // defaults to "Isolated Critical -> Elevated" — core L0 != L1 insight
  geoTab: "interactive",
  zoneIdx: 1,         // Eastern Wadis (1 Critical + 1 Normal -> L1 Elevated)
  respIdx: 3,         // Step 04 · Escalate (Human-in-the-loop gate)
  statusFilter: "all",
  simTick: 20,        // peak of F-03 Run #5 (88 cm)
  simPlaying: false,
  simSpeed: 210,
  simTimer: null,
  soundEnabled: false,
  factsCounted: false,
  pdf: { lib: null, doc: null, page: 1, pages: 0, zoom: 1, rendering: false, pending: null, loadedUrl: null },
};
state.docLang = state.lang;

function resolveInitialLang() {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "ar" || q === "en") return q;
  try {
    const saved = localStorage.getItem("rasd_lang");
    if (saved === "ar" || saved === "en") return saved;
  } catch {}
  return (navigator.language || "").toLowerCase().startsWith("ar") ? "ar" : "en";
}

const isSupplied = (v) => typeof v === "string" && v.trim() !== "" && !v.startsWith("PLACEHOLDER_");
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const getPath = (obj, p) => p.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const modTau = (a) => ((a % TAU) + TAU) % TAU;

/* ==========================================================================
   OPTIONAL PROCEDURAL WEB AUDIO ENGINE (Strictly Opt-In / Off by Default)
   ========================================================================== */
const Sound = (() => {
  let ctx = null;
  function ensure() {
    if (!state.soundEnabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }
  function tone(freq = 440, dur = 0.14, gainVal = 0.030, type = "sine") {
    const c = ensure();
    if (!c) return;
    try {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(gainVal, c.currentTime + 0.016);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      osc.connect(g).connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + dur + 0.02);
    } catch {}
  }
  return {
    tick: () => tone(520, 0.075, 0.020, "sine"),
    ping: (st) => tone(st === "crit" ? 680 : st === "warn" ? 560 : 440, 0.09, 0.014, "sine"),
    lock: () => { tone(330, 0.20, 0.028, "triangle"); setTimeout(() => tone(495, 0.26, 0.026, "sine"), 85); },
    alert: (lvl) => tone(lvl === "crit" ? 660 : 495, 0.16, 0.028, "triangle"),
  };
})();

function syncSoundUI() {
  const t = CONTENT[state.lang].ui;
  const on = state.soundEnabled;
  const wavePath = on ? "M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" : "M19 9l-4 6M15 9l4 6";
  ["#introSoundBtn", "#soundBtn"].forEach((sel) => {
    const b = $(sel);
    if (b) b.setAttribute("aria-pressed", String(on));
  });
  const lbl = $("#introSoundBtn span");
  if (lbl) lbl.textContent = on ? t.soundOn : t.soundOff;
  ["#introSoundWaves", "#topSoundWaves"].forEach((sel) => {
    const p = $(sel);
    if (p) p.setAttribute("d", wavePath);
  });
}

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  syncSoundUI();
  if (state.soundEnabled) Sound.lock();
}

/* ==========================================================================
   OFFICIAL BRAND v2.1 RANGE FAN SYMBOL
   Strict Identity Manual compliance:
   - Exact 100x100 geometry from origin (14,86), r=26/52/78, butt caps
   - Size Law: <32px marks drop datum ticks and apply +12% optical stroke weight
   - Intro Reveal: arcs emerge in unified unison (never animated independently)
   ========================================================================== */
function brandMarkSVG(mode = "small") {
  if (mode === "intro") {
    return `
      <path class="im-axis" d="M14 86 V0" fill="none" stroke="#F1ECE1" stroke-width="2.4" stroke-linecap="butt" opacity=".45"/>
      <g class="im-fan">
        <path d="M14 60 A26 26 0 0 1 40 86" fill="none" stroke="#F1ECE1" stroke-width="7" stroke-linecap="butt"/>
        <path d="M14 34 A52 52 0 0 1 66 86" fill="none" stroke="#F1ECE1" stroke-width="7" stroke-linecap="butt"/>
        <path d="M14 8 A78 78 0 0 1 92 86" fill="none" stroke="#F1ECE1" stroke-width="7" stroke-linecap="butt"/>
      </g>
      <path class="im-base" d="M14 86 H100" fill="none" stroke="#3ECF96" stroke-width="8" stroke-linecap="butt"/>
      <path class="im-tick" d="M44 79 V93 M76 79 V93" fill="none" stroke="#3ECF96" stroke-width="2.2" stroke-linecap="butt"/>
      <circle class="im-origin" cx="14" cy="86" r="7.5" fill="#3ECF96"/>`;
  }
  // Small UI mark (26px inside 36px topbar/footer badge): Size Law (+12% weight, no ticks)
  return `
    <path d="M14 60 A26 26 0 0 1 40 86" fill="none" stroke="#F1ECE1" stroke-width="7.84" stroke-linecap="butt"/>
    <path d="M14 34 A52 52 0 0 1 66 86" fill="none" stroke="#F1ECE1" stroke-width="7.84" stroke-linecap="butt"/>
    <path d="M14 8 A78 78 0 0 1 92 86" fill="none" stroke="#F1ECE1" stroke-width="7.84" stroke-linecap="butt"/>
    <path d="M14 86 H100" fill="none" stroke="#3ECF96" stroke-width="8.96" stroke-linecap="butt"/>
    <circle cx="14" cy="86" r="8.1" fill="#3ECF96"/>`;
}

function mountMarks() {
  const im = $("#introMark");
  if (im) im.innerHTML = brandMarkSVG("intro");
  $$(".brandMark").forEach((g) => (g.innerHTML = brandMarkSVG("small")));
}

/* ==========================================================================
   IMMUTABLE KINGDOM TELEMETRY STATIONS & PRECISION RADAR ENGINE
   Strict Physical Invariants:
   1. Radar structure (center, rings, azimuth ticks, crosshairs) is 100% stationary.
   2. Sweep rotates 360° clockwise around exact (cx, cy) with zero center drift.
   3. Detection points use frozen (az, r) coordinates — NEVER rotate, orbit, wobble,
      follow the sweep, or gather toward the center.
   4. Illumination, concentric echo ring, and exponential phosphor decay trigger
      strictly when the rotating sweep crosses each station's fixed azimuth.
   ========================================================================== */
const RADAR_STATIONS = Object.freeze([
  Object.freeze({ id: "PRS-04", regionEn: "Al-Jawf", regionAr: "الجوف",          valEn: "1009 hPa · Normal",  valAr: "1009 هكتوباسكال · طبيعي", shortVal: "1009 hPa", st: "ok",   az: 0.32, r: 0.72, rIntro: 0.78 }),
  Object.freeze({ id: "WTR-01", regionEn: "Hail",    regionAr: "حائل",           valEn: "63 cm · Warn 60",    valAr: "63 سم · حد التحذير 60",   shortVal: "63 cm",    st: "warn", az: 0.84, r: 0.56, rIntro: 0.68 }),
  Object.freeze({ id: "RAIN-01",regionEn: "Hail",    regionAr: "حائل",           valEn: "0.8 mm/min · Normal",valAr: "0.8 مم/د · طبيعي",        shortVal: "0.8 mm/m", st: "ok",   az: 1.18, r: 0.38, rIntro: 0.62 }),
  Object.freeze({ id: "WND-02", regionEn: "Eastern", regionAr: "المنطقة الشرقية", valEn: "54 km/h · Warning",  valAr: "54 كم/س · تحذير",         shortVal: "54 km/h",  st: "warn", az: 1.68, r: 0.68, rIntro: 0.80 }),
  Object.freeze({ id: "WTR-02", regionEn: "Riyadh",  regionAr: "الرياض",         valEn: "82 cm · Crit 80",    valAr: "82 سم · الحد الحرج 80",   shortVal: "82 cm",    st: "crit", az: 2.18, r: 0.44, rIntro: 0.66 }),
  Object.freeze({ id: "TMP-03", regionEn: "Najran",  regionAr: "نجران",          valEn: "34 °C · Normal",     valAr: "34 °م · طبيعي",           shortVal: "34 °C",    st: "ok",   az: 2.76, r: 0.74, rIntro: 0.82 }),
  Object.freeze({ id: "HUM-02", regionEn: "Jazan",   regionAr: "جازان",          valEn: "68 % · Normal",      valAr: "68 % · طبيعي",            shortVal: "68 %",     st: "ok",   az: 3.28, r: 0.78, rIntro: 0.84 }),
  Object.freeze({ id: "WTR-05", regionEn: "Asir",    regionAr: "عسير",           valEn: "61 cm · Warn 60",    valAr: "61 سم · حد التحذير 60",   shortVal: "61 cm",    st: "warn", az: 3.74, r: 0.52, rIntro: 0.70 }),
  Object.freeze({ id: "WTR-04", regionEn: "Makkah",  regionAr: "مكة المكرمة",    valEn: "28 cm · Normal",     valAr: "28 سم · طبيعي",           shortVal: "28 cm",    st: "ok",   az: 4.30, r: 0.60, rIntro: 0.74 }),
  Object.freeze({ id: "PRS-01", regionEn: "Madinah", regionAr: "المدينة المنورة", valEn: "1011 hPa · Normal",  valAr: "1011 هكتوباسكال · طبيعي", shortVal: "1011 hPa", st: "ok",   az: 4.86, r: 0.66, rIntro: 0.77 }),
  Object.freeze({ id: "TMP-01", regionEn: "Qassim",  regionAr: "القصيم",         valEn: "31 °C · Normal",     valAr: "31 °م · طبيعي",           shortVal: "31 °C",    st: "ok",   az: 5.38, r: 0.42, rIntro: 0.64 }),
  Object.freeze({ id: "SEIS-01",regionEn: "Tabuk",   regionAr: "تبوك",           valEn: "0.4 Ml · Normal",    valAr: "0.4 رختر · طبيعي",        shortVal: "0.4 Ml",   st: "ok",   az: 5.86, r: 0.75, rIntro: 0.83 }),
]);

const RADAR_RGB = Object.freeze({
  ok:   [62, 207, 150],
  warn: [242, 177, 76],
  crit: [242, 96, 79],
});
const RADAR_HEX = Object.freeze({
  ok:   "#3ECF96",
  warn: "#F2B14C",
  crit: "#F2604F",
});

// Public read-only diagnostic state for multi-rotation invariance verification
window.__RASD_RADAR_TELEMETRY__ = { intro: null, hero: null };

function drawRadarScope(ctx, opts) {
  const {
    w, h, cx, cy, R,
    azRad,          // current clockwise sweep azimuth from 12 o'clock in [0, 2π)
    sweptTotal,     // cumulative radians swept since start (handles pre-first-pass gracefully)
    mode,           // "intro" | "hero"
    alpha = 1,      // overall fade envelope
    pointer = null, // {x, y} in CSS px (hero interactive mode)
    pinnedId = null,
    showSweep = true,
  } = opts;

  ctx.clearRect(0, 0, w, h);
  if (R <= 8 || alpha <= 0.001) return { hovered: null, latestLock: null, stations: [] };

  ctx.save();
  ctx.direction = "ltr";
  ctx.globalAlpha = alpha;

  const isHero = mode === "hero";
  const ringCount = 4;

  // 1A. Stationary watershed contour arcs inside scope (never rotate)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.clip();
  ctx.strokeStyle = isHero ? "rgba(62,207,150,0.065)" : "rgba(62,207,150,0.045)";
  ctx.lineWidth = 1;
  [-0.38, 0.05, 0.44].forEach((ky, idx) => {
    const yBase = cy + ky * R;
    ctx.beginPath();
    ctx.moveTo(cx - R, yBase + (idx - 1) * 8);
    ctx.bezierCurveTo(cx - R * 0.35, yBase - 22, cx + R * 0.35, yBase + 24, cx + R, yBase - 6);
    ctx.stroke();
  });
  ctx.restore();

  // 1B. Stationary radial axes (crosshairs + subtle 45° survey diagonals — never rotate)
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 4;
    const isCardinal = k % 2 === 0;
    ctx.strokeStyle = isCardinal
      ? (isHero ? "rgba(241,236,225,0.085)" : "rgba(241,236,225,0.055)")
      : (isHero ? "rgba(241,236,225,0.038)" : "rgba(241,236,225,0.025)");
    ctx.lineWidth = 1;
    const dx = Math.cos(a) * R, dy = Math.sin(a) * R;
    ctx.beginPath();
    ctx.moveTo(cx - dx, cy - dy);
    ctx.lineTo(cx + dx, cy + dy);
    ctx.stroke();
  }

  // 1C. Stationary concentric range rings (0.25R, 0.50R, 0.75R, 1.00R — never rotate)
  for (let i = 1; i <= ringCount; i++) {
    if (!isHero && i === 1) continue; // keep center behind intro logo calm and clean
    const rr = (R * i) / ringCount;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, TAU);
    ctx.strokeStyle = i === ringCount
      ? (isHero ? "rgba(62,207,150,0.30)" : "rgba(62,207,150,0.20)")
      : (isHero ? "rgba(241,236,225,0.085)" : "rgba(241,236,225,0.06)");
    ctx.lineWidth = i === ringCount ? 1.25 : 1;
    ctx.stroke();
  }

  // 1D. Stationary outer degree graduation ticks (72 ticks, every 5°) & cardinal bearings
  const tickCount = 72;
  for (let i = 0; i < tickCount; i++) {
    const deg = i * 5;
    const rad = (deg * Math.PI) / 180 - HALF_PI;
    const isMajor = deg % 30 === 0;
    const isCardinal = deg % 90 === 0;
    const inner = R - (isCardinal ? 8 : isMajor ? 5.5 : 3);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * inner, cy + Math.sin(rad) * inner);
    ctx.lineTo(cx + Math.cos(rad) * R, cy + Math.sin(rad) * R);
    ctx.strokeStyle = isCardinal
      ? "rgba(62,207,150,0.55)"
      : isMajor
        ? "rgba(241,236,225,0.22)"
        : "rgba(241,236,225,0.08)";
    ctx.lineWidth = isCardinal ? 1.4 : 1;
    ctx.stroke();
  }

  if (isHero && R >= 115) {
    ctx.font = "500 9.5px 'Plex Mono', monospace";
    ctx.fillStyle = "rgba(241,236,225,0.42)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lblOff = R + 11;
    ctx.fillText("000°", cx, cy - lblOff + 1);
    ctx.fillText("180°", cx, cy + lblOff);
    ctx.save();
    ctx.font = "400 8.5px 'Plex Mono', monospace";
    ctx.fillStyle = "rgba(241,236,225,0.28)";
    ctx.textAlign = "left";
    [0.5, 0.75].forEach((f) => {
      ctx.fillText(`R${Math.round(f * 100)}`, cx + 4, cy - R * f + 9);
    });
    ctx.restore();
  }

  // 2. Rotating 360° radar sweep around exact (cx, cy) — zero translation or center drift
  const normAz = modTau(azRad);
  const sweepCanvasAngle = normAz - HALF_PI;
  const trailSpan = 0.68; // ~39° phosphor persistence wedge

  if (showSweep) {
    const startAng = sweepCanvasAngle - trailSpan;
    const normStartAng = modTau(startAng);
    if (typeof ctx.createConicGradient === "function") {
      const cg = ctx.createConicGradient(normStartAng, cx, cy);
      const frac = trailSpan / TAU;
      cg.addColorStop(0, "rgba(62,207,150,0)");
      cg.addColorStop(frac * 0.55, isHero ? "rgba(62,207,150,0.065)" : "rgba(62,207,150,0.045)");
      cg.addColorStop(frac, isHero ? "rgba(62,207,150,0.21)" : "rgba(62,207,150,0.15)");
      cg.addColorStop(Math.min(1, frac + 0.002), "rgba(62,207,150,0)");
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, startAng, sweepCanvasAngle);
      ctx.closePath();
      ctx.fillStyle = cg;
      ctx.fill();
    } else {
      // Lightweight multi-slice fallback if createConicGradient is unavailable
      const slices = 14;
      for (let s = 0; s < slices; s++) {
        const a0 = startAng + (s / slices) * trailSpan;
        const a1 = startAng + ((s + 1) / slices) * trailSpan;
        const op = ((s + 1) / slices) * (isHero ? 0.16 : 0.11);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, a0, a1 + 0.004);
        ctx.closePath();
        ctx.fillStyle = `rgba(62,207,150,${op.toFixed(3)})`;
        ctx.fill();
      }
    }

    const tipX = cx + Math.cos(sweepCanvasAngle) * R;
    const tipY = cy + Math.sin(sweepCanvasAngle) * R;

    // Soft beam bloom + crisp leading edge scan line
    const beamGrad = ctx.createLinearGradient(cx, cy, tipX, tipY);
    beamGrad.addColorStop(0, isHero ? "rgba(62,207,150,0.35)" : "rgba(62,207,150,0.05)");
    beamGrad.addColorStop(0.32, isHero ? "rgba(62,207,150,0.72)" : "rgba(62,207,150,0.45)");
    beamGrad.addColorStop(1, "rgba(62,207,150,0.96)");

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tipX, tipY);
    ctx.strokeStyle = "rgba(62,207,150,0.16)";
    ctx.lineWidth = 4.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tipX, tipY);
    ctx.strokeStyle = beamGrad;
    ctx.lineWidth = 1.65;
    ctx.stroke();

    // Rim sweep cursor pip
    ctx.beginPath();
    ctx.arc(tipX, tipY, 2.3, 0, TAU);
    ctx.fillStyle = "#F1ECE1";
    ctx.fill();
  }

  // Stationary center origin hub (hero mode)
  if (isHero) {
    ctx.beginPath();
    ctx.arc(cx, cy, 9.5, 0, TAU);
    ctx.strokeStyle = "rgba(62,207,150,0.32)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 4.2, 0, TAU);
    ctx.fillStyle = "#3ECF96";
    ctx.fill();
  }

  // 3 & 4. Fixed Detection Points + Sweep-Synchronized Hit Illumination & Decay
  let hovered = null;
  let latestLock = null;
  let minLockDelta = Infinity;
  const stationSnap = [];

  for (let i = 0; i < RADAR_STATIONS.length; i++) {
    const st = RADAR_STATIONS[i];
    const radFrac = isHero ? st.r : st.rIntro;
    // STRICT FIXED COORDINATES: st.az and radFrac are immutable constants
    const fixedAngle = st.az - HALF_PI;
    const x = cx + Math.cos(fixedAngle) * (R * radFrac);
    const y = cy + Math.sin(fixedAngle) * (R * radFrac);

    // Exact angular distance in [0, 2π) since the clockwise sweep crossed st.az
    const delta = modTau(normAz - st.az);
    // Tiny 0.045 rad (~2.5°) leading anticipation as beam touches outer halo
    const leadDelta = TAU - delta;
    const hasBeenReached = sweptTotal >= delta || leadDelta < 0.045;

    let glow = 0;
    let echoProgress = -1;
    if (!showSweep) {
      // Static reduced-motion presentation: calm steady visibility
      glow = st.st === "crit" ? 0.65 : st.st === "warn" ? 0.50 : 0.35;
    } else if (hasBeenReached) {
      if (leadDelta < 0.045) {
        glow = 1 - leadDelta / 0.045;
      } else {
        glow = Math.exp(-delta * 2.55);
        if (delta < 1.18) echoProgress = delta / 1.18;
        if (delta < minLockDelta) {
          minLockDelta = delta;
          latestLock = st;
        }
      }
    }

    const [cr, cg, cb] = RADAR_RGB[st.st];
    const hex = RADAR_HEX[st.st];
    const isPinned = pinnedId === st.id;
    const isPtrNear = isHero && pointer && Math.hypot(pointer.x - x, pointer.y - y) < 18;
    if (isPtrNear || isPinned) {
      hovered = { st, x, y, col: hex };
    }
    const activeBoost = isPtrNear || isPinned ? 1 : glow;

    // Subtle radial echo ring expanding around FIXED (x, y) strictly on sweep hit
    if (echoProgress >= 0 && echoProgress <= 1) {
      const easeOut = 1 - Math.pow(1 - echoProgress, 2.3);
      const maxEcho = st.st === "crit" ? 17 : st.st === "warn" ? 14 : 10.5;
      const echoR = 4.2 + easeOut * maxEcho;
      const echoAlpha = (1 - echoProgress) * (st.st === "crit" ? 0.72 : st.st === "warn" ? 0.58 : 0.42);
      ctx.beginPath();
      ctx.arc(x, y, echoR, 0, TAU);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${echoAlpha.toFixed(3)})`;
      ctx.lineWidth = st.st === "crit" ? 1.5 : 1.2;
      ctx.stroke();
    }

    // Soft phosphor illumination halo at fixed (x, y)
    const haloAlpha = 0.08 + activeBoost * 0.30;
    ctx.beginPath();
    ctx.arc(x, y, isHero ? 8.8 : 7.8, 0, TAU);
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${haloAlpha.toFixed(3)})`;
    ctx.fill();

    // Official Brand Identity concentric status ring for Warning / Critical stations
    if (st.st !== "ok" || isPtrNear || isPinned) {
      const ringAlpha = 0.24 + activeBoost * 0.64;
      ctx.beginPath();
      ctx.arc(x, y, isHero ? 7.6 : 6.8, 0, TAU);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${ringAlpha.toFixed(3)})`;
      ctx.lineWidth = 1.25;
      ctx.stroke();
    }

    // Crisp stationary station core dot
    const coreR = st.st === "crit" ? 4.3 : st.st === "warn" ? 3.9 : 3.4;
    const coreAlpha = 0.42 + activeBoost * 0.58;
    ctx.beginPath();
    ctx.arc(x, y, coreR, 0, TAU);
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${coreAlpha.toFixed(3)})`;
    ctx.fill();

    // Bright center glint at exact moment of sweep lock
    if (activeBoost > 0.55) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, TAU);
      ctx.fillStyle = `rgba(250,247,241,${((activeBoost - 0.55) / 0.45 * 0.9).toFixed(3)})`;
      ctx.fill();
    }

    // Subtle inline station ID tag on sweep illumination (keeps fixed offset from fixed x,y)
    if (activeBoost > 0.38 && R >= 125 && (isHero ? (st.st !== "ok" || activeBoost > 0.62) : activeBoost > 0.52)) {
      const lblAlpha = Math.min(1, (activeBoost - 0.38) / 0.42) * (isHero ? 0.88 : 0.72);
      ctx.font = "500 9.5px 'Plex Mono', monospace";
      ctx.fillStyle = `rgba(241,236,225,${lblAlpha.toFixed(3)})`;
      const onRight = x >= cx;
      ctx.textAlign = onRight ? "left" : "right";
      ctx.textBaseline = "middle";
      const tagX = onRight ? x + 10 : x - 10;
      ctx.fillText(st.id, tagX, y);
    }

    stationSnap.push({
      id: st.id,
      az: st.az,
      r: radFrac,
      x: +x.toFixed(3),
      y: +y.toFixed(3),
      glow: +glow.toFixed(3),
    });
  }

  ctx.restore();
  return { hovered, latestLock, stations: stationSnap };
}

/* ==========================================================================
   CINEMATIC MULTI-ACT OPENING SEQUENCE (#intro)
   ========================================================================== */
let introFinishFn = null;
let activeIntroCleanup = null;

function startIntro(forceReplay = false) {
  const root = $("#intro");
  if (!root) return;

  // Clean up any in-flight intro loop if user triggers Replay rapidly
  if (activeIntroCleanup) {
    activeIntroCleanup();
    activeIntroCleanup = null;
  }

  let seen = false;
  try { seen = sessionStorage.getItem("rasd_intro_v21") === "1"; } catch {}

  if (!forceReplay && (REDUCED || seen)) {
    root.classList.add("done");
    return;
  }

  // Reset DOM & replay unified Official Brand Range Fan symbol choreography
  root.classList.remove("done");
  const im = $("#introMark");
  if (im) im.innerHTML = brandMarkSVG("intro");
  $$(".intro-word-row, .intro-sub, .intro-line", root).forEach((el) => {
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
  });

  const canvas = $("#introCanvas");
  const ctx = canvas.getContext("2d");
  const bar = $("#introBar");
  const pctEl = $("#introPct");
  const phaseEl = $("#introPhaseText");
  const azEl = $("#introAzimuth");

  let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth || window.innerWidth;
    h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size();

  const ro = "ResizeObserver" in window ? new ResizeObserver(size) : null;
  if (ro) ro.observe(canvas);
  else window.addEventListener("resize", size);

  const DUR = 4400;
  // Angular velocity: 1.28 full 360° revolutions across 4.4s (~3.44s per 360° sweep)
  const OMEGA = (TAU * 1.28) / (DUR / 1000);
  const START_AZ = 0.18;
  const t0 = performance.now();
  let raf = 0, closed = false, lastPhase = -1, lastLockId = null;

  function cleanup() {
    cancelAnimationFrame(raf);
    if (ro) ro.disconnect();
    else window.removeEventListener("resize", size);
  }
  activeIntroCleanup = cleanup;

  function finish() {
    if (closed) return;
    closed = true;
    cleanup();
    activeIntroCleanup = null;
    root.classList.add("done");
    try { sessionStorage.setItem("rasd_intro_v21", "1"); } catch {}
  }
  introFinishFn = finish;

  function frame(now) {
    if (closed) return;
    const elapsedMs = Math.max(0, now - t0);
    const p = Math.min(1, elapsedMs / DUR);
    const elapsedSec = elapsedMs / 1000;

    if (bar) bar.style.width = (p * 100).toFixed(1) + "%";
    if (pctEl) pctEl.textContent = String(Math.round(p * 100)).padStart(3, "0") + "%";

    const introOmega = REDUCED ? (TAU * 0.95) / (DUR / 1000) : OMEGA;
    const sweptTotal = elapsedSec * introOmega;
    const azRad = modTau(START_AZ + sweptTotal);
    const azDeg = Math.floor((azRad * 180) / Math.PI) % 360;
    if (azEl) azEl.textContent = `AZ ${String(azDeg).padStart(3, "0")}°`;

    const phIdx = p < 0.34 ? 0 : p < 0.74 ? 1 : 2;
    if (phIdx !== lastPhase) {
      lastPhase = phIdx;
      const phases = CONTENT[state.lang].ui.introPhases;
      if (phaseEl && phases[phIdx]) phaseEl.textContent = phases[phIdx];
      if (phIdx === 1) Sound.lock();
    }

    const cx = w * 0.5;
    const cy = h * 0.5;
    const minDim = Math.min(w, h);
    const R = minDim * (w < 560 ? 0.42 : 0.42);
    const fadeIn = Math.min(1, elapsedMs / 380);

    const res = drawRadarScope(ctx, {
      w, h, cx, cy, R,
      azRad,
      sweptTotal,
      mode: "intro",
      alpha: fadeIn,
      showSweep: true,
    });

    if (res.latestLock && res.latestLock.id !== lastLockId) {
      lastLockId = res.latestLock.id;
      if (res.latestLock.st !== "ok") Sound.ping(res.latestLock.st);
    }

    window.__RASD_RADAR_TELEMETRY__.intro = {
      cx: +cx.toFixed(2),
      cy: +cy.toFixed(2),
      R: +R.toFixed(2),
      azDeg,
      rotations: +(sweptTotal / TAU).toFixed(3),
      stations: res.stations,
    };

    if (p < 1) raf = requestAnimationFrame(frame);
    else finish();
  }

  raf = requestAnimationFrame(frame);
}

function wireIntroControls() {
  $("#skipIntro")?.addEventListener("click", () => introFinishFn && introFinishFn());
  $("#replayIntroBtn")?.addEventListener("click", () => startIntro(true));
  $("#introSoundBtn")?.addEventListener("click", toggleSound);
  $("#soundBtn")?.addEventListener("click", toggleSound);
  window.addEventListener("keydown", (e) => {
    const root = $("#intro");
    if (root && !root.classList.contains("done") && (e.key === "Escape" || e.key === " ")) {
      e.preventDefault();
      introFinishFn && introFinishFn();
    }
  });
}

/* ==========================================================================
   INTERACTIVE HERO WATERSHED RADAR (12 Fixed Kingdom Stations + Sweep Hit)
   ========================================================================== */
function startHeroRadar() {
  const c = $("#heroCanvas");
  const wrap = $("#heroRadarWrap") || c?.parentElement;
  const tip = $("#radarTooltip");
  const azBadge = $("#heroRadarAz");
  const lockEl = $("#heroRadarLock");
  if (!c) return;

  const ctx = c.getContext("2d");
  if (!ctx) return;
  let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  let pointer = null;
  let pinnedId = null;

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = (wrap || c).getBoundingClientRect();
    const fallbackW = Math.min(360, Math.max(220, (window.innerWidth || 375) - 64));
    const rawSide = r.width || wrap?.clientWidth || c.clientWidth || fallbackW;
    const side = Math.max(180, Math.round(rawSide));
    w = side;
    h = side;
    c.width = Math.max(1, Math.floor(w * dpr));
    c.height = Math.max(1, Math.floor(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size();

  // Calm, authoritative operational radar cadence:
  // 6.4s per 360° standard; 8.2s calm cadence when OS Reduce Motion / Battery Saver is active.
  // Never freeze or disable the core radar sweep on smartphones.
  const START_AZ = 0.62;
  let sweptAccum = 0;
  let lastNow = null;
  let raf = 0;
  let inView = true;
  let running = false;
  let lastLockId = null;

  function currentOmega() {
    return REDUCED ? TAU / 8.2 : TAU / 6.4;
  }

  function checkRadarInView() {
    const target = wrap || c;
    const r = target.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const vh = window.innerHeight || document.documentElement.clientHeight || 800;
    return r.bottom > -80 && r.top < vh + 80;
  }

  if ("ResizeObserver" in window && wrap) {
    new ResizeObserver(() => {
      size();
      inView = checkRadarInView();
      syncLoopState();
      if (!running) renderOnce();
    }).observe(wrap);
  } else {
    window.addEventListener("resize", () => {
      size();
      inView = checkRadarInView();
      syncLoopState();
      if (!running) renderOnce();
    }, { passive: true });
  }

  c.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const r = c.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (!running) renderOnce();
  });
  c.addEventListener("pointerleave", () => {
    pointer = null;
    if (!pinnedId && tip) tip.hidden = true;
    if (!running) renderOnce();
  });
  c.addEventListener("click", (e) => {
    const r = c.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const cx = w * 0.5, cy = h * 0.5, R = Math.min(w, h) * 0.425;
    const hitRadius = w < 380 ? 26 : 22;
    let best = null;
    let bestDist = hitRadius;
    for (const st of RADAR_STATIONS) {
      const sx = cx + Math.cos(st.az - HALF_PI) * (R * st.r);
      const sy = cy + Math.sin(st.az - HALF_PI) * (R * st.r);
      const d = Math.hypot(px - sx, py - sy);
      if (d < bestDist) { bestDist = d; best = st; }
    }
    pinnedId = best ? (pinnedId === best.id ? null : best.id) : null;
    if (best) Sound.tick();
    if (!pinnedId && !pointer && tip) tip.hidden = true;
    if (!running) renderOnce();
  });

  function renderOnce() {
    if (w <= 0 || h <= 0) size();
    const cx = w * 0.5;
    const cy = h * 0.5;
    const R = Math.min(w, h) * 0.425;
    const sweptTotal = sweptAccum;
    const azRad = modTau(START_AZ + sweptTotal);
    const azDeg = Math.floor((azRad * 180) / Math.PI) % 360;

    if (azBadge) azBadge.textContent = `AZ ${String(azDeg).padStart(3, "0")}°`;

    const res = drawRadarScope(ctx, {
      w, h, cx, cy, R,
      azRad,
      sweptTotal,
      mode: "hero",
      alpha: 1,
      pointer,
      pinnedId,
      showSweep: true,
    });

    if (res.latestLock && res.latestLock.id !== lastLockId) {
      lastLockId = res.latestLock.id;
      if (lockEl) lockEl.textContent = `LOCK · ${res.latestLock.id} · ${res.latestLock.shortVal}`;
    }

    if (tip) {
      if (res.hovered) {
        const { st, x, y, col } = res.hovered;
        const reg = state.lang === "ar" ? st.regionAr : st.regionEn;
        const val = state.lang === "ar" ? st.valAr : st.valEn;
        tip.hidden = false;
        tip.innerHTML = `<strong style="color:${col}">${esc(st.id)}</strong> · ${esc(reg)}<br><span>${esc(val)}</span>`;
        const tipW = Math.min(200, Math.max(148, tip.offsetWidth || 168));
        const maxLeft = Math.max(8, w - tipW - 8);
        tip.style.left = Math.min(maxLeft, Math.max(8, x - tipW * 0.35)) + "px";
        tip.style.top = Math.min(Math.max(8, h - 58), Math.max(8, y - 50)) + "px";
      } else {
        tip.hidden = true;
      }
    }

    window.__RASD_RADAR_TELEMETRY__.hero = {
      cx: +cx.toFixed(2),
      cy: +cy.toFixed(2),
      R: +R.toFixed(2),
      azDeg,
      rotations: +(sweptTotal / TAU).toFixed(3),
      running,
      stations: res.stations,
    };
  }

  function loop(now) {
    if (!running) return;
    if (lastNow !== null) {
      const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
      sweptAccum += dt * currentOmega();
    }
    lastNow = now;
    renderOnce();
    raf = requestAnimationFrame(loop);
  }

  function syncLoopState() {
    const shouldRun = inView && !document.hidden;
    if (shouldRun && !running) {
      running = true;
      lastNow = null;
      raf = requestAnimationFrame(loop);
    } else if (!shouldRun && running) {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
      lastNow = null;
    }
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      const latest = entries[entries.length - 1];
      inView = latest ? (latest.isIntersecting || checkRadarInView()) : checkRadarInView();
      syncLoopState();
    }, { threshold: [0, 0.02, 0.15], rootMargin: "80px 0px 80px 0px" }).observe(wrap || c);
  }

  // Mobile WebKit / Chrome lifecycle hardening: bfcache restore, tab resume, scroll & orientation
  const refreshVisibility = () => {
    size();
    inView = checkRadarInView();
    syncLoopState();
    if (inView && !running) renderOnce();
  };
  document.addEventListener("visibilitychange", refreshVisibility);
  window.addEventListener("pageshow", refreshVisibility);
  window.addEventListener("focus", refreshVisibility);
  window.addEventListener("orientationchange", () => setTimeout(refreshVisibility, 120));

  let radarScrollTick = false;
  window.addEventListener("scroll", () => {
    if (radarScrollTick) return;
    radarScrollTick = true;
    requestAnimationFrame(() => {
      radarScrollTick = false;
      const nowVisible = checkRadarInView();
      if (nowVisible !== inView) {
        inView = nowVisible;
        syncLoopState();
      }
    });
  }, { passive: true });

  inView = checkRadarInView() || true;
  renderOnce();
  syncLoopState();
}

/* ==========================================================================
   BESPOKE TECHNICAL ILLUSTRATIONS & BILINGUAL STAGE SCHEMATICS
   ========================================================================== */
function challengeIcon(kind) {
  const map = {
    frag: `<path d="M3 7h6M15 7h6M3 12h4M11 12h10M3 17h8M15 17h6"/><circle cx="12" cy="7" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="13" cy="17" r="1.6"/>`,
    sev:  `<path d="M3 17l5-5 4 3 8-9"/><path d="M3 10h18" stroke-dasharray="2 3" stroke="#F2B14C"/>`,
    place:`<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/>`,
    resp: `<rect x="3" y="4" width="7" height="6" rx="1.5"/><rect x="14" y="14" width="7" height="6" rx="1.5"/><path d="M10 7h4v7" stroke-dasharray="3 3"/>`,
  };
  return `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${map[kind] || map.frag}</svg>`;
}

function valueIcon(name) {
  const m = {
    layers: `<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 16l9 5 9-5"/>`,
    trace:  `<circle cx="5" cy="6" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="18" r="2.2"/><path d="M6.8 7.5l3.5 3M13.8 13.5l3.5 3"/>`,
    gauge:  `<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-6"/><circle cx="12" cy="17" r="1.6"/>`,
    map:    `<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z"/><path d="M9 4v14M15 6v14"/>`,
    eye:    `<path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.8"/>`,
    play:   `<circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5V8.5z"/>`,
    route:  `<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H13a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h4.8"/>`,
  };
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${m[name] || m.layers}</svg>`;
}

let archMqBound = false;
function renderArchitectureDiagram(lang) {
  const ar = lang === "ar";
  const f = ar ? "'Plex Arabic','Plex Sans',sans-serif" : "'Plex Sans',sans-serif";
  const nodes = ar
    ? [
        ["01 · الرصد والتحقق", "قراءات موحّدة + فحص جودة"],
        ["02 · ذكاء المخاطر", "تنبيه L0 ≠ مخاطر L1"],
        ["03 · السياق الجغرافي", "12 نقطة ← 11 منطقة"],
        ["04 · القرار والخطة", "أولويات مفسّرة + الخطة v30"],
      ]
    : [
        ["01 · Ingest & Validate", "Unified packet + quality gate"],
        ["02 · Risk Intelligence", "L0 Alert ≠ L1 Situation"],
        ["03 · Geospatial Context", "12 Points → 11 Regions"],
        ["04 · Decision & Plan", "Ranked zones + Plan v30"],
      ];

  if (!archMqBound && window.matchMedia) {
    archMqBound = true;
    const mq = window.matchMedia("(max-width: 679px)");
    const onChange = () => renderArchitectureDiagram(state.lang);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  const isMobileStack = (window.innerWidth || 1024) < 680;
  let svgMarkup = "";

  if (isMobileStack) {
    // Dedicated vertical 4-layer architecture flow for smartphones (< 680px) — zero horizontal overflow
    const W = 340, bw = 308, bh = 80, vGap = 26, x = 16, y0 = 14;
    const H = y0 * 2 + 4 * bh + 3 * vGap;
    let boxes = "", wires = "";
    nodes.forEach((nd, logicalIdx) => {
      const active = logicalIdx === state.pillarIdx;
      const y = y0 + logicalIdx * (bh + vGap);
      const stroke = active ? "#3ECF96" : "rgba(241,236,225,0.20)";
      const fill = active ? "rgba(62,207,150,0.16)" : "#0F2C2A";
      const dotX = ar ? x + bw - 20 : x + 20;
      boxes += `
        <g class="arch-node" data-pidx="${logicalIdx}" role="button" tabindex="0" aria-label="${esc(nd[0])}" style="cursor:pointer">
          <rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="${active ? 2 : 1.2}"/>
          <circle cx="${dotX}" cy="${y + 24}" r="4.5" fill="${active ? "#3ECF96" : "#8FA6A2"}"/>
          <text x="${x + bw / 2}" y="${y + 36}" text-anchor="middle" font-family="${f}" font-size="14" font-weight="600" fill="#F1ECE1">${nd[0]}</text>
          <text x="${x + bw / 2}" y="${y + 59}" text-anchor="middle" font-family="${f}" font-size="12" fill="#CFC9BC">${nd[1]}</text>
        </g>`;
      if (logicalIdx < 3) {
        const y1 = y + bh;
        const y2 = y + bh + vGap;
        const my = (y1 + y2) / 2;
        wires += `
          <line x1="${W / 2}" y1="${y1}" x2="${W / 2}" y2="${y2}" stroke="rgba(62,207,150,0.28)" stroke-width="2"/>
          <line class="arch-pulse" x1="${W / 2}" y1="${y1}" x2="${W / 2}" y2="${y2}" stroke="#3ECF96" stroke-width="2.4"/>
          <circle cx="${W / 2}" cy="${my}" r="3.5" fill="#3ECF96"/>`;
      }
    });
    svgMarkup = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="RASD 4-layer architecture">${wires}${boxes}</svg>`;
  } else {
    const order = ar ? [...nodes].reverse() : nodes;
    const W = 920, H = 156, bw = 204, bh = 98, gap = 22;
    const x0 = (W - (4 * bw + 3 * gap)) / 2;

    let boxes = "", wires = "";
    order.forEach((nd, i) => {
      const logicalIdx = ar ? 3 - i : i;
      const active = logicalIdx === state.pillarIdx;
      const x = x0 + i * (bw + gap), y = 29;
      const stroke = active ? "#3ECF96" : "rgba(241,236,225,0.18)";
      const fill = active ? "rgba(62,207,150,0.16)" : "#0F2C2A";
      const dotX = ar ? x + bw - 18 : x + 18;
      boxes += `
        <g class="arch-node" data-pidx="${logicalIdx}" role="button" tabindex="0" aria-label="${esc(nd[0])}" style="cursor:pointer">
          <rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="${active ? 2 : 1.2}"/>
          <circle cx="${dotX}" cy="${y + 22}" r="4.5" fill="${active ? "#3ECF96" : "#8FA6A2"}"/>
          <text x="${x + bw / 2}" y="${y + 50}" text-anchor="middle" font-family="${f}" font-size="14" font-weight="600" fill="#F1ECE1">${nd[0]}</text>
          <text x="${x + bw / 2}" y="${y + 74}" text-anchor="middle" font-family="${f}" font-size="12" fill="#CFC9BC">${nd[1]}</text>
        </g>`;
      if (i < 3) {
        const x1 = ar ? x + bw + gap : x + bw;
        const x2 = ar ? x + bw : x + bw + gap;
        const mx = (x1 + x2) / 2;
        wires += `
          <line x1="${x1}" y1="${y + bh / 2}" x2="${x2}" y2="${y + bh / 2}" stroke="rgba(62,207,150,0.28)" stroke-width="2"/>
          <line class="arch-pulse" x1="${x1}" y1="${y + bh / 2}" x2="${x2}" y2="${y + bh / 2}" stroke="#3ECF96" stroke-width="2.4"/>
          <circle cx="${mx}" cy="${y + bh / 2}" r="3.5" fill="#3ECF96"/>`;
      }
    });
    svgMarkup = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="RASD 4-layer architecture">${wires}${boxes}</svg>`;
  }

  $("#chainFigure").innerHTML = svgMarkup;
  $$(".arch-node", $("#chainFigure")).forEach((g) => {
    const activate = () => {
      state.pillarIdx = Number(g.dataset.pidx);
      Sound.tick();
      renderConcept(lang);
    };
    g.addEventListener("click", activate);
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
    });
  });

  $("#chainCap").textContent = ar
    ? "الشكل 1 — المسار المعماري المتصل في رَصد: تنتقل القراءة عبر الطبقات الأربع مع بقاء أصلها وتوقيتها محفوظين حتى خطة الاستجابة."
    : "Figure 1 — RASD's connected architectural chain: every reading travels across all four layers with full provenance preserved to Plan v30.";
}

function stageSchematicSVG(idx, lang) {
  const ar = lang === "ar";
  const f = ar ? "'Plex Arabic','Plex Sans',sans-serif" : "'Plex Mono',monospace";
  const schematics = [
    // 0: Ingest (Bilingual)
    `<rect x="16" y="22" width="106" height="28" rx="6" fill="#0F2C2A" stroke="rgba(241,236,225,.2)"/><text x="69" y="40" text-anchor="middle" font-family="${f}" font-size="10.5" fill="#CFC9BC">${ar ? "تغذية الطقس" : "WEATHER API"}</text>
     <rect x="16" y="66" width="106" height="28" rx="6" fill="#0F2C2A" stroke="rgba(241,236,225,.2)"/><text x="69" y="84" text-anchor="middle" font-family="${f}" font-size="10.5" fill="#CFC9BC">${ar ? "حساس WTR-01" : "WTR-01 GAUGE"}</text>
     <rect x="16" y="110" width="106" height="28" rx="6" fill="#0F2C2A" stroke="rgba(241,236,225,.2)"/><text x="69" y="128" text-anchor="middle" font-family="${f}" font-size="10.5" fill="#CFC9BC">${ar ? "تغذية زلزالية" : "SEISMIC FEED"}</text>
     <path d="M122 36 C158 36,158 80,192 80 M122 80 H192 M122 124 C158 124,158 80,192 80" fill="none" stroke="#3ECF96" stroke-width="1.8" class="arch-pulse"/>
     <rect x="192" y="52" width="154" height="56" rx="10" fill="rgba(62,207,150,.15)" stroke="#3ECF96" stroke-width="1.8"/>
     <text x="269" y="77" text-anchor="middle" font-family="${f}" font-size="11.5" font-weight="600" fill="#F1ECE1">${ar ? "حزمة قياسية موحّدة" : "UNIFIED PACKET"}</text>
     <text x="269" y="95" text-anchor="middle" font-family="'Plex Mono',monospace" font-size="10" fill="#3ECF96">{id, ts, val, unit}</text>`,
    // 1: Validate (Bilingual)
    `<rect x="16" y="56" width="98" height="48" rx="8" fill="#0F2C2A" stroke="rgba(241,236,225,.2)"/>
     <text x="65" y="84" text-anchor="middle" font-family="${f}" font-size="11" fill="#F1ECE1">${ar ? "قراءة خام" : "RAW STREAM"}</text>
     <line x1="114" y1="80" x2="144" y2="80" stroke="#3ECF96" stroke-width="2"/>
     <polygon points="184,42 224,80 184,118 144,80" fill="rgba(62,207,150,.14)" stroke="#3ECF96" stroke-width="1.8"/>
     <text x="184" y="84" text-anchor="middle" font-family="${f}" font-size="10.5" fill="#F1ECE1">${ar ? "فحص" : "CHECK"}</text>
     <path d="M224 80 H254" stroke="#3ECF96" stroke-width="2"/><rect x="254" y="42" width="96" height="32" rx="7" fill="rgba(62,207,150,.16)" stroke="#3ECF96"/>
     <text x="302" y="62" text-anchor="middle" font-family="${f}" font-size="10.5" fill="#3ECF96">${ar ? "صالحة ✓" : "VALID ✓"}</text>
     <path d="M184 118 V136 H254" fill="none" stroke="#F2604F" stroke-width="1.5" stroke-dasharray="3 3"/>
     <rect x="254" y="118" width="96" height="28" rx="7" fill="rgba(242,96,79,.14)" stroke="#F2604F"/>
     <text x="302" y="136" text-anchor="middle" font-family="${f}" font-size="10" fill="#F2604F">${ar ? "عزل القراءة" : "QUARANTINE"}</text>`,
    // 2: Risk L0 (Bilingual)
    `<line x1="30" y1="126" x2="334" y2="126" stroke="rgba(241,236,225,.2)" stroke-width="1.5"/>
     <line x1="30" y1="84" x2="334" y2="84" stroke="#F2B14C" stroke-dasharray="4 4"/><text x="330" y="77" text-anchor="end" font-family="${f}" font-size="10" fill="#F2B14C">${ar ? "تحذير 60 سم" : "WARN 60 cm"}</text>
     <line x1="30" y1="48" x2="334" y2="48" stroke="#F2604F" stroke-dasharray="4 4"/><text x="330" y="41" text-anchor="end" font-family="${f}" font-size="10" fill="#F2604F">${ar ? "حرج 80 سم" : "CRIT 80 cm"}</text>
     <path d="M36 118 Q105 116, 150 76 T250 38 T324 96" fill="none" stroke="#3ECF96" stroke-width="2.6"/>
     <circle cx="156" cy="74" r="5" fill="#F2B14C"/><circle cx="244" cy="39" r="5.5" fill="#F2604F"/>`,
    // 3: Geospatial (Bilingual)
    `<polygon points="44,40 164,28 190,88 140,136 52,124" fill="rgba(242,177,76,.12)" stroke="#F2B14C" stroke-width="1.6"/>
     <polygon points="174,32 326,44 314,132 196,134" fill="rgba(62,207,150,.10)" stroke="#3ECF96" stroke-width="1.4"/>
     <circle cx="104" cy="78" r="10" fill="none" stroke="#F2604F" stroke-opacity=".5"/><circle cx="104" cy="78" r="5" fill="#F2604F"/><circle cx="142" cy="104" r="4.5" fill="#3ECF96"/>
     <circle cx="246" cy="84" r="4.5" fill="#3ECF96"/><circle cx="284" cy="96" r="4.5" fill="#3ECF96"/>
     <text x="112" y="54" text-anchor="middle" font-family="${f}" font-size="10.5" fill="#F2B14C">${ar ? "المنطقة: مرتفع (L1)" : "REGION L1: ELEVATED"}</text>`,
    // 4: Decision Support (Bilingual — in RTL SVG, text-anchor="start" aligns the right/start edge of RTL text at x=328)
    `<rect x="22" y="26" width="320" height="32" rx="7" fill="rgba(242,96,79,.16)" stroke="#F2604F"/>
     <text x="${ar ? 328 : 36}" y="46" text-anchor="start" font-family="${f}" font-size="11" fill="#F1ECE1">${ar ? "#1 · AR-01 الحي السكني الجنوبي · أولوية 0.89" : "#1 · AR-01 South Residential · Score 0.89"}</text>
     <rect x="22" y="66" width="282" height="30" rx="7" fill="rgba(242,177,76,.14)" stroke="#F2B14C"/>
     <text x="${ar ? 290 : 36}" y="85" text-anchor="start" font-family="${f}" font-size="11" fill="#F1ECE1">${ar ? "#2 · AR-02 المزارع المنخفضة · أولوية 0.71" : "#2 · AR-02 Low Farmland · Score 0.71"}</text>
     <rect x="22" y="104" width="236" height="30" rx="7" fill="rgba(62,207,150,.12)" stroke="#3ECF96"/>
     <text x="${ar ? 244 : 36}" y="123" text-anchor="start" font-family="${f}" font-size="11" fill="#F1ECE1">${ar ? "#3 · AR-04 معبر الوادي · أولوية 0.48" : "#3 · AR-04 Valley Crossing · Score 0.48"}</text>`,
    // 5: Plan v30 (Bilingual)
    `<rect x="22" y="26" width="146" height="108" rx="10" fill="#0F2C2A" stroke="rgba(242,177,76,.5)"/>
     <text x="95" y="52" text-anchor="middle" font-family="${f}" font-size="11" fill="#F2B14C">${ar ? "مقترح النظام (v30)" : "PROPOSED (v30)"}</text>
     <text x="95" y="78" text-anchor="middle" font-family="${f}" font-size="10.5" fill="#CFC9BC">${ar ? "رصد · تحقق" : "Monitor · Verify"}</text>
     <text x="95" y="98" text-anchor="middle" font-family="${f}" font-size="10.5" fill="#CFC9BC">${ar ? "تبليغ · تصعيد" : "Notify · Escalate"}</text>
     <path d="M168 80 H204" stroke="#3ECF96" stroke-width="2" stroke-dasharray="4 3"/>
     <rect x="204" y="26" width="138" height="108" rx="10" fill="rgba(62,207,150,.14)" stroke="#3ECF96" stroke-width="1.8"/>
     <text x="273" y="58" text-anchor="middle" font-family="${f}" font-size="11" font-weight="600" fill="#3ECF96">${ar ? "اعتماد المشغّل" : "HUMAN GATE"}</text>
     <text x="273" y="84" text-anchor="middle" font-family="${f}" font-size="10.5" fill="#F1ECE1">${ar ? "موثّق بسجل الحوكمة" : "Audit Logged"}</text>`,
  ];
  return `<svg viewBox="0 0 364 160" role="img" aria-label="Stage logic schematic">${schematics[idx] || schematics[0]}</svg>`;
}

/* ==========================================================================
   INTERACTIVE REGION SCHEMATIC & 3-TAB GEOSPATIAL EXPLORER (05)
   ========================================================================== */
function renderInteractiveBasinSVG(lang) {
  const ar = lang === "ar";
  const f = ar ? "'Plex Arabic','Plex Sans',sans-serif" : "'Plex Sans',sans-serif";
  const polys = [
    { idx: 0, d: "M48,44 L220,30 L242,122 L72,134 Z",   pts: [[112, 78, "warn"], [186, 72, "ok"]],   lx: 145, ly: 112 },
    { idx: 1, d: "M220,30 L424,40 L408,140 L242,122 Z", pts: [[296, 70, "crit"], [368, 96, "ok"]],   lx: 332, ly: 122 },
    { idx: 2, d: "M424,40 L592,58 L578,170 L408,140 Z", pts: [[478, 90, "ok"],   [542, 122, "ok"]],  lx: 504, ly: 148 },
    { idx: 3, d: "M72,134 L242,122 L258,252 L56,262 Z", pts: [[126, 182, "warn"],[198, 208, "warn"]],lx: 158, ly: 238 },
    { idx: 4, d: "M242,122 L408,140 L396,266 L258,252 Z",pts:[[304, 180, "ok"],  [358, 216, "ok"]],  lx: 328, ly: 246 },
    { idx: 5, d: "M408,140 L578,170 L560,278 L396,266 Z",pts:[[458, 198, "ok"],  [522, 228, "ok"]],  lx: 486, ly: 256 },
  ];
  const cm = { ok: "#3ECF96", warn: "#F2B14C", crit: "#F2604F" };
  const zones = CONTENT[lang].map.zones;

  // Brand v2.1 subtle survey grid (opacity 0.12)
  let grid = "";
  for (let gx = 64; gx < 620; gx += 64) grid += `<line x1="${gx}" y1="0" x2="${gx}" y2="304" stroke="rgba(241,236,225,0.045)" stroke-width="1"/>`;
  for (let gy = 52; gy < 300; gy += 52) grid += `<line x1="0" y1="${gy}" x2="636" y2="${gy}" stroke="rgba(241,236,225,0.045)" stroke-width="1"/>`;

  const shapes = polys.map((p) => {
    const active = p.idx === state.zoneIdx;
    const z = zones[p.idx];
    const dots = p.pts.map(([x, y, st]) => `
      <circle cx="${x}" cy="${y}" r="11" fill="${cm[st]}" fill-opacity=".14"/>
      ${st !== "ok" ? `<circle cx="${x}" cy="${y}" r="9.5" fill="none" stroke="${cm[st]}" stroke-opacity=".65" stroke-width="1.2"/>` : ""}
      <circle cx="${x}" cy="${y}" r="4.8" fill="${cm[st]}"/>
    `).join("");
    return `
      <g class="map-zone-grp" data-zidx="${p.idx}" role="button" tabindex="0" aria-label="${esc(z.name)}" style="cursor:pointer">
        <path class="map-zone${active ? " active" : ""}" d="${p.d}" fill="${active ? "rgba(62,207,150,0.20)" : "rgba(15,44,42,0.68)"}" stroke="${active ? "#3ECF96" : "rgba(241,236,225,0.20)"}" stroke-width="${active ? 2 : 1.2}"/>
        ${dots}
        <text x="${p.lx}" y="${p.ly}" text-anchor="middle" font-family="${f}" font-size="11" fill="${active ? "#F1ECE1" : "#8FA6A2"}">${z.code}</text>
      </g>`;
  }).join("");

  const leg = CONTENT[lang].map.legend;
  const schemNote = ar ? "مخطط توضيحي · ليس تمثيلاً جغرافياً دقيقاً" : "schematic · not a geographic rendering";
  return `
    <p class="small" style="margin-bottom:10px">${esc(CONTENT[lang].map.interactiveHint)}</p>
    <svg direction="ltr" viewBox="0 0 636 304" role="img" aria-label="Interactive regional risk schematic">
      <rect width="636" height="304" rx="12" fill="#061110"/>
      ${grid}
      <text x="${ar ? 618 : 18}" y="20" text-anchor="${ar ? "end" : "start"}" font-family="${ar ? f : "'Plex Mono',monospace"}" font-size="10" fill="rgba(241,236,225,0.44)">${schemNote}</text>
      <path d="M36 100 C210 72, 390 158, 602 112 M36 208 C228 176, 412 248, 602 210" fill="none" stroke="rgba(62,207,150,0.12)" stroke-dasharray="4 5"/>
      ${shapes}
    </svg>
    <div class="map-legend">
      <span><i style="background:#3ECF96"></i>${esc(leg[0])}</span>
      <span><i style="background:#F2B14C"></i>${esc(leg[1])}</span>
      <span><i style="background:#F2604F"></i>${esc(leg[2])}</span>
    </div>`;
}

/* ==========================================================================
   SECTION RENDERERS (Bilingual AR RTL + EN LTR)
   ========================================================================== */
function applySimpleI18n(lang) {
  const c = CONTENT[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = c.dir;
  document.title = c.meta.title;
  const md = $('meta[name="description"]');
  if (md) md.setAttribute("content", c.meta.desc);

  $$("[data-i18n]").forEach((el) => {
    const v = getPath(c, el.dataset.i18n);
    if (typeof v === "string") el.textContent = v;
  });
  $$("[data-i18n-html]").forEach((el) => {
    const v = getPath(c, el.dataset.i18nHtml);
    if (typeof v === "string") el.innerHTML = v;
  });
  $("#langLabel").textContent = c.ui.lang;
  syncSoundUI();
}

function renderNavAndChapters(lang) {
  const c = CONTENT[lang];
  const ids = ["challenge", "concept", "workflow", "simulation", "team", "document"];
  const links = ids.map((id, i) => `<a href="#${id}" data-sec="${id}">${esc(c.ui.nav[i])}</a>`).join("");
  $("#topnav").innerHTML = links;

  const platUrl = CFG.links?.platform || "https://rasd.alsuhaibi96.com/";
  $("#drawer").innerHTML = links +
    `<a href="#contact" data-sec="contact">${esc(c.contact.eyebrow)}</a>` +
    `<button class="drawer-replay" id="drawerReplayBtn" type="button"><span>${esc(c.ui.replayIntro)}</span><span aria-hidden="true">↺</span></button>` +
    `<a class="drawer-plat" href="${esc(platUrl)}" target="_blank" rel="noopener noreferrer">${esc(c.ui.tryPlatform)} ↗</a>`;

  $("#chapterRail").innerHTML = c.ui.chapters
    .map(([id, num, lbl]) => `<a class="cr-dot" href="#${id}" data-rail="${id}" aria-label="${esc(lbl)}"><i></i><span>${num} · ${esc(lbl)}</span></a>`)
    .join("");

  $$("#drawer a").forEach((a) => a.addEventListener("click", () => toggleDrawer(false)));
  $("#drawerReplayBtn")?.addEventListener("click", () => {
    toggleDrawer(false);
    startIntro(true);
  });
}

function renderHeroExtras(lang) {
  const h = CONTENT[lang].hero;
  $("#heroFacts").innerHTML = h.facts
    .map(([n, k, sub, tagLbl, tagCls]) => `
      <div class="hero-fact">
        <div class="hf-top">
          <b class="hf-val" data-target="${esc(n)}"><bdi dir="ltr">${esc(n)}</bdi></b>
          ${tagLbl ? `<span class="hf-tag ${esc(tagCls || "")}">${esc(tagLbl)}</span>` : ""}
        </div>
        <strong>${esc(k)}</strong>
        <span>${esc(sub)}</span>
      </div>`)
    .join("");

  if (!state.factsCounted && !REDUCED && "IntersectionObserver" in window) {
    const factsEl = $("#heroFacts");
    if (factsEl) {
      const obs = new IntersectionObserver((entries) => {
        if (!entries.some((en) => en.isIntersecting) || state.factsCounted) return;
        state.factsCounted = true;
        obs.disconnect();
        $$(".hf-val", factsEl).forEach((el) => {
          const raw = (el.dataset.target || "").trim();
          if (!/^\d+$/.test(raw)) return; // keep "0 / 15" steady so 0 live sensors is never misread
          const target = parseInt(raw, 10);
          if (!target) return;
          const bdi = el.querySelector("bdi") || el;
          const t0 = performance.now();
          const dur = 620;
          const step = (now) => {
            const p = Math.min(1, (now - t0) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            bdi.textContent = String(Math.round(target * eased));
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
      }, { threshold: 0.25 });
      obs.observe(factsEl);
    }
  } else {
    state.factsCounted = true;
  }

  const img = $("#heroConsoleImg");
  if (img) img.src = `assets/img/media/platform-dashboard-${lang}.webp`;

  const hsWrap = $("#heroHotspots");
  const totalHs = h.hotspots.length;
  hsWrap.innerHTML = h.hotspots.map((hs, i) => `
    <button class="hs-pin" type="button" style="left:${hs.x}%;top:${hs.y}%" aria-selected="${i === state.hotspotIdx}" aria-label="${esc(hs.title)}" data-hs="${i}">
      <b class="hs-num" dir="ltr">0${i + 1}</b>
      <span class="hs-txt">${esc(hs.code)}</span>
    </button>
  `).join("");

  const cur = h.hotspots[state.hotspotIdx] || h.hotspots[0];
  $("#heroHotspotReadout").innerHTML = `
    <div class="ci-main">
      <span class="badge b-sim">${esc(cur.code)}</span>
      <b>${esc(cur.title)}</b>
      <span>— ${esc(cur.desc)}</span>
    </div>
    <div class="ci-nav" dir="ltr">
      <button class="ci-step" id="hsPrev" type="button" aria-label="Previous callout">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
      </button>
      <span class="ci-idx">0${state.hotspotIdx + 1} / 0${totalHs}</span>
      <button class="ci-step" id="hsNext" type="button" aria-label="Next callout">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
      </button>
    </div>`;

  $$(".hs-pin", hsWrap).forEach((btn) => {
    btn.addEventListener("click", () => {
      state.hotspotIdx = Number(btn.dataset.hs);
      Sound.tick();
      renderHeroExtras(state.lang);
    });
  });
  $("#hsPrev")?.addEventListener("click", () => {
    state.hotspotIdx = (state.hotspotIdx - 1 + totalHs) % totalHs;
    Sound.tick();
    renderHeroExtras(state.lang);
  });
  $("#hsNext")?.addEventListener("click", () => {
    state.hotspotIdx = (state.hotspotIdx + 1) % totalHs;
    Sound.tick();
    renderHeroExtras(state.lang);
  });
}

function renderChallenge(lang) {
  const ch = CONTENT[lang].challenge;
  $("#challengeStreams").innerHTML = ch.streamFeeds
    .map(([k, v, cls]) => `<div class="silo-pill ${cls}"><b>${esc(k)}</b><span>${esc(v)}</span></div>`)
    .join("");

  $("#challengeCards").innerHTML = ch.cards
    .map(([t, b, icon], i) => `
      <article class="spot-card ch-card reveal" style="--d:${i * 65}ms">
        <div>
          <div class="idx" dir="ltr">01.${i + 1}</div>
          <h3>${esc(t)}</h3>
          <p>${esc(b)}</p>
        </div>
        <div class="ch-illus">${challengeIcon(icon)}</div>
      </article>`)
    .join("");

  $("#gapViz").innerHTML = ch.gaps
    .map(([q, st, pct, cls], i) => `
      <div class="row">
        <span class="q">${esc(q)}</span>
        <span class="bar"><i class="${cls}" style="--bw:${(pct / 100).toFixed(2)};--bd:${i * 80}ms"></i></span>
        <span class="st">${esc(st)}</span>
      </div>`)
    .join("");
}

function renderConcept(lang) {
  const cp = CONTENT[lang].concept;
  renderArchitectureDiagram(lang);

  $("#conceptPillars").innerHTML = cp.pillars.map((p, i) => `
    <button class="arch-pillar${i === state.pillarIdx ? " on" : ""}" type="button" data-pidx="${i}">
      <span class="ap-code">${esc(p.code)}</span>
      <strong>${esc(p.name)}</strong>
      <span class="ap-metric">${esc(p.metric)}</span>
      <p>${esc(p.desc)}</p>
    </button>
  `).join("");

  $$(".arch-pillar", $("#conceptPillars")).forEach((b) => {
    b.addEventListener("click", () => {
      state.pillarIdx = Number(b.dataset.pidx);
      Sound.tick();
      renderConcept(state.lang);
    });
  });

  $("#conceptChips").innerHTML = cp.chips.map((x) => `<span class="chip">${esc(x)}</span>`).join("");
  $("#conceptPoints").innerHTML = cp.points
    .map(([a, b]) => `<div class="c-pt"><strong>${esc(a)}</strong><span>${esc(b)}</span></div>`)
    .join("");
}

function renderWorkflow(lang) {
  const wf = CONTENT[lang].workflow;
  const list = $("#flowList");
  list.innerHTML = wf.stages
    .map((s, i) => `
      <button class="flow-step" role="tab" id="fstep-${i}"
        aria-selected="${i === state.flowIdx}" aria-controls="flowPanel" tabindex="${i === state.flowIdx ? 0 : -1}" data-idx="${i}">
        <span class="n" dir="ltr">0${i + 1}</span>
        <span class="nm">${esc(s.name)}</span>
        <span class="tg">${esc(s.short)}</span>
      </button>`)
    .join("");

  list.querySelectorAll(".flow-step").forEach((btn) => {
    btn.addEventListener("click", () => {
      stopFlowTour();
      selectFlow(Number(btn.dataset.idx));
    });
    btn.addEventListener("keydown", (e) => {
      const base = Number(btn.dataset.idx);
      const dir = document.documentElement.dir === "rtl" ? -1 : 1;
      if (e.key === "ArrowRight") { e.preventDefault(); selectFlow((base + dir + 6) % 6, true); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); selectFlow((base - dir + 6) % 6, true); }
    });
  });
  paintFlowPanel(lang);
}

function selectFlow(i, focus = false) {
  state.flowIdx = i;
  Sound.tick();
  $$("#flowList .flow-step").forEach((b, k) => {
    b.setAttribute("aria-selected", String(k === i));
    b.tabIndex = k === i ? 0 : -1;
    if (focus && k === i) b.focus();
  });
  paintFlowPanel(state.lang);
}

function paintFlowPanel(lang) {
  const wf = CONTENT[lang].workflow;
  const s = wf.stages[state.flowIdx];
  const L = wf.labels;
  const inLbl = lang === "ar" ? "عينة المدخلات" : "INPUT SAMPLE";
  const outLbl = lang === "ar" ? "مخرجات المرحلة" : "STAGE OUTPUT";
  $("#flowPanel").innerHTML = `
    <div class="fp-grid fp-enter">
      <div>
        <div class="fp-head">
          <div>
            <span class="st">${esc(L.stage)} 0${state.flowIdx + 1} / 06</span>
            <h3 style="margin-top:4px">${esc(s.name)}</h3>
          </div>
          <span class="badge b-verified">${esc(CAPABILITY.verified[lang])}</span>
        </div>
        <p style="margin-top:14px;color:var(--ink-2);font-size:15px">${esc(s.body)}</p>
        <div class="fp-packets">
          <div class="fp-pkt"><small style="${lang === "ar" ? "font-family:var(--font-ar);letter-spacing:0" : ""}">${inLbl}</small><code>${esc(s.sampleIn)}</code></div>
          <div class="fp-pkt"><small style="${lang === "ar" ? "font-family:var(--font-ar);letter-spacing:0" : ""}">${outLbl}</small><code>${esc(s.sampleOut)}</code></div>
        </div>
        <div class="fp-io">
          <div class="fp-box"><h4>${esc(L.receives)}</h4><p>${esc(s.receives)}</p></div>
          <div class="fp-box"><h4>${esc(L.gives)}</h4><p>${esc(s.gives)}</p></div>
          <div class="fp-box"><h4>${esc(L.next)}</h4><p><strong style="color:var(--signal)">${esc(s.next)}</strong> — ${esc(s.nextNote)}</p></div>
        </div>
      </div>
      <div class="fp-schem">
        <div class="fp-schem-lbl">${esc(L.schematic)}</div>
        ${stageSchematicSVG(state.flowIdx, lang)}
      </div>
    </div>`;
}

function stopFlowTour() {
  if (state.flowTourTimer) {
    clearInterval(state.flowTourTimer);
    state.flowTourTimer = null;
  }
  const btn = $("#flowTourBtn");
  const lbl = $("#flowTourLabel");
  if (btn) btn.setAttribute("aria-pressed", "false");
  if (lbl) lbl.textContent = CONTENT[state.lang].ui.autoTour;
}

function toggleFlowTour() {
  if (state.flowTourTimer) {
    stopFlowTour();
    return;
  }
  const btn = $("#flowTourBtn");
  const lbl = $("#flowTourLabel");
  if (btn) btn.setAttribute("aria-pressed", "true");
  if (lbl) lbl.textContent = CONTENT[state.lang].ui.stopTour;
  state.flowTourTimer = setInterval(() => {
    selectFlow((state.flowIdx + 1) % 6);
  }, 2800);
}

function renderRisk(lang) {
  const r = CONTENT[lang].risk;
  const col = (d) => `
    <span class="code">${esc(d.code)}</span>
    <h3>${esc(d.title)}</h3>
    <p class="small">${esc(d.sub)}</p>
    <div class="lvl-steps">
      ${d.steps.map(([n, tx, c, lim]) => `
        <div class="lvl-step">
          <i style="background:${c};box-shadow:0 0 8px ${c}"></i>
          <div><b>${esc(n)}</b><span>${esc(tx)}</span></div>
          <em>${esc(lim)}</em>
        </div>`).join("")}
    </div>
    <p class="small meta-note" style="margin-top:14px">${esc(d.note)}</p>`;
  $("#l0col").innerHTML = col(r.l0);
  $("#l1col").innerHTML = col(r.l1);

  $("#lvlBtns").innerHTML = r.demoStates
    .map((s, i) => `<button class="lvl-btn" type="button" aria-pressed="${i === state.lvlIdx}" data-i="${i}">${esc(s[1])}</button>`)
    .join("");
  $$("#lvlBtns .lvl-btn").forEach((b) =>
    b.addEventListener("click", () => {
      state.lvlIdx = Number(b.dataset.i);
      Sound.tick();
      $$("#lvlBtns .lvl-btn").forEach((x, k) => x.setAttribute("aria-pressed", String(k === state.lvlIdx)));
      paintLvlDemo(state.lang);
    })
  );
  paintLvlDemo(lang);

  const shot = $("#riskShotImg");
  if (shot) shot.src = `assets/img/media/platform-alerts-${lang}.webp`;
}

function paintLvlDemo(lang) {
  const r = CONTENT[lang].risk;
  const [, , l0, l1, why, p0, p1] = r.demoStates[state.lvlIdx];
  const L = r.demoLabels;
  const c0 = state.lvlIdx === 0 ? "#3ECF96" : state.lvlIdx === 1 ? "#F2B14C" : "#F2604F";
  const c1 = state.lvlIdx === 0 ? "#3ECF96" : state.lvlIdx === 1 ? "#7FB2E5" : state.lvlIdx === 2 ? "#F2B14C" : "#F2604F";
  const clusters = [
    [["#3ECF96", "#3ECF96", "#3ECF96", "#3ECF96"], lang === "ar" ? "محطات الحوض: 4 طبيعي" : "Basin nodes: 4 Normal"],
    [["#F2B14C", "#3ECF96", "#3ECF96", "#3ECF96"], lang === "ar" ? "1 تحذير · 3 طبيعي" : "1 Warning · 3 Normal"],
    [["#F2604F", "#3ECF96", "#3ECF96", "#3ECF96"], lang === "ar" ? "1 حرج معزول · 3 طبيعي" : "1 Isolated Crit · 3 Normal"],
    [["#F2604F", "#F2604F", "#F2B14C", "#3ECF96"], lang === "ar" ? "2 حرج مترابط + هطول نشط" : "2 Correlated Crit + Rain"],
  ][state.lvlIdx];
  const dotsHtml = clusters[0].map((col) => `<i style="background:${col};box-shadow:0 0 7px ${col}"></i>`).join("");
  $("#lvlRead").innerHTML = `
    <div class="lvl-meter">
      <small>${esc(L.alert)}</small>
      <strong style="color:${c0}">${esc(l0)}</strong>
      <div class="meter-bar"><i style="transform:scaleX(${(p0 / 100).toFixed(2)});background:${c0}"></i></div>
    </div>
    <div class="lvl-meter">
      <small>${esc(L.risk)}</small>
      <strong style="color:${c1}">${esc(l1)}</strong>
      <div class="meter-bar"><i style="transform:scaleX(${(p1 / 100).toFixed(2)});background:${c1}"></i></div>
    </div>
    <div class="lvl-meter">
      <small>${esc(L.context)}</small>
      <span style="font-size:13.5px;color:var(--ink-2);display:block;margin-top:4px">${esc(why)}</span>
      <div class="lvl-cluster" aria-hidden="true">${dotsHtml}<span>${esc(clusters[1])}</span></div>
    </div>`;
}

function renderMap(lang) {
  const m = CONTENT[lang].map;
  $("#geoTabs").innerHTML = m.tabs
    .map(([key, lbl]) => `<button class="geo-tab${state.geoTab === key ? " on" : ""}" type="button" role="tab" aria-selected="${state.geoTab === key}" data-gtab="${key}">${esc(lbl)}</button>`)
    .join("");
  $$("#geoTabs .geo-tab").forEach((b) =>
    b.addEventListener("click", () => {
      state.geoTab = b.dataset.gtab;
      Sound.tick();
      renderMap(state.lang);
    })
  );

  const fig = $("#mapFigure");
  if (state.geoTab === "interactive") {
    fig.innerHTML = renderInteractiveBasinSVG(lang);
    $$(".map-zone-grp", fig).forEach((g) => {
      const pick = () => {
        state.zoneIdx = Number(g.dataset.zidx);
        Sound.tick();
        renderMap(state.lang);
      };
      g.addEventListener("click", pick);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); }
      });
    });
  } else if (state.geoTab === "kingdom") {
    const src = `assets/img/media/platform-map-${lang}.webp`;
    fig.innerHTML = `
      <div class="map-shot-wrap" data-shot="map"><img src="${src}" alt="Verified RASD 12-point Kingdom monitoring map" width="1500" height="844" loading="lazy"></div>
      <p class="small" style="margin-top:12px">${esc(m.kingdomCaption)}</p>`;
  } else {
    const src = `assets/img/media/platform-basin-${lang}.webp`;
    fig.innerHTML = `
      <div class="map-shot-wrap" data-shot="basin"><img src="${src}" alt="Verified RASD F-03 virtual basin risk map" width="1500" height="844" loading="lazy"></div>
      <p class="small" style="margin-top:12px">${esc(m.basinCaption)}</p>`;
  }

  const z = m.zones[state.zoneIdx] || m.zones[0];
  $("#zoneInspector").innerHTML = `
    <span class="zi-code">${esc(z.code)}</span>
    <div class="zi-head">
      <h4 style="font-size:16.5px">${esc(z.name)}</h4>
      <span class="zi-l1" style="color:${z.l1Col}">L1 · ${esc(z.l1)}</span>
    </div>
    <p class="mono small" style="margin-top:6px;color:var(--ink);${lang === "ar" ? "font-family:var(--font-ar)" : ""}">${esc(z.stations)}</p>
    <p class="small" style="margin-top:8px">${esc(z.detail)}</p>`;

  $("#mapSide").innerHTML = `<dl class="kv">${m.rows
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
    .join("")}</dl>`;

  bindShotTriggers(fig);
}

/* ==========================================================================
   06 · SCENARIO SIMULATION STUDIO (F-03 RUN #5 · T00–T31)
   Exact deterministic L0 vs L1 separation matching verified Run #5:
   - L0 evaluates WTR-01 against configured 60 / 80 cm limits
   - L1 evaluates 3-tick water rise + 10-tick cumulative rain + water level independently
     (so T18–T20 = L1 Severe, while T21 = 88 cm L0 Critical yet L1 drops to Elevated!)
   ========================================================================== */
function stateAt(tick, lang) {
  const w = F03.water[tick];
  const prev3 = F03.water[Math.max(0, tick - 3)];
  const rise3 = w - prev3;
  let r10 = 0;
  for (let k = Math.max(0, tick - 9); k <= tick; k++) r10 += F03.rain[k];

  const stepsL0 = CONTENT[lang].risk.l0.steps;
  const stepsL1 = CONTENT[lang].risk.l1.steps;

  // Deterministic L0 reading classification (60 / 80 cm)
  const l0Idx = w >= F03.crit ? 2 : w >= F03.warn ? 1 : 0;
  const l0Cols = ["#3ECF96", "#F2B14C", "#F2604F"];
  const l0Codes = ["norm", "warn", "crit"];

  // Independent deterministic L1 situational assessment (Run #5 3-factor rule)
  let l1Idx = 0;
  if (w >= 80 && rise3 >= 10 && r10 >= 2) l1Idx = 3;                  // T18–T20: Severe
  else if (w >= 60 && (w >= 72 || rise3 >= 6 || r10 >= 4)) l1Idx = 2; // T15–T17 & T21–T24: Elevated
  else if (w >= 44 || (rise3 >= 8 && r10 >= 2)) l1Idx = 1;            // T13–T14 & T25: Moderate
  const l1Cols = ["#3ECF96", "#7FB2E5", "#F2B14C", "#F2604F"];

  return {
    l0: stepsL0[l0Idx][0],
    col: l0Cols[l0Idx],
    code: l0Codes[l0Idx],
    l1: stepsL1[l1Idx][0],
    l1Col: l1Cols[l1Idx],
    l1Idx,
  };
}

function renderSim(lang) {
  const s = CONTENT[lang].sim;
  $("#simMilestones").innerHTML = s.milestones
    .map(([tk, lbl]) => `<button class="ms-pill${state.simTick === tk ? " on" : ""}" type="button" data-tk="${tk}">${esc(lbl)}</button>`)
    .join("");
  $$("#simMilestones .ms-pill").forEach((b) =>
    b.addEventListener("click", () => {
      stopSim();
      state.simTick = Number(b.dataset.tk);
      $("#simScrub").value = String(state.simTick);
      Sound.tick();
      paintSimAt(state.simTick);
    })
  );

  $("#simLegend").innerHTML = `
    <span style="display:inline-flex;align-items:center;gap:6px"><i style="width:14px;height:2.5px;background:#3ECF96;display:inline-block"></i>${esc(s.chart.water)}</span>
    <span style="display:inline-flex;align-items:center;gap:6px"><i style="width:10px;height:10px;background:rgba(127,178,229,.55);display:inline-block;border-radius:2px"></i>${esc(s.chart.rain)}</span>
    <span style="display:inline-flex;align-items:center;gap:6px"><i style="width:14px;height:0;border-top:1.5px dashed #F2B14C;display:inline-block"></i>${esc(s.chart.warnLine)}</span>
    <span style="display:inline-flex;align-items:center;gap:6px"><i style="width:14px;height:0;border-top:1.5px dashed #F2604F;display:inline-block"></i>${esc(s.chart.critLine)}</span>`;

  const jumpMap = [6, 15, 20, 21, 26];
  $("#simEvents").innerHTML = s.events
    .map(([tk, html], idx) => `<li data-ev="${idx}" data-jtk="${jumpMap[idx]}"><span class="tk" dir="ltr">${esc(tk)}</span><p>${html}</p></li>`)
    .join("");
  $$("#simEvents li").forEach((li) =>
    li.addEventListener("click", () => {
      stopSim();
      state.simTick = Number(li.dataset.jtk);
      $("#simScrub").value = String(state.simTick);
      Sound.tick();
      paintSimAt(state.simTick);
    })
  );

  $("#simWhy").innerHTML = s.why.map((x) => `<li>${esc(x)}</li>`).join("");
  paintSimAt(state.simTick);
}

let simHoverTick = null;

function drawSimChart(activeTick) {
  const c = $("#simChart");
  if (!c) return;
  const ctx = c.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = c.clientWidth || 560, h = c.clientHeight || 270;
  c.width = Math.max(1, Math.floor(w * dpr));
  c.height = Math.max(1, Math.floor(h * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.direction = "ltr";
  ctx.clearRect(0, 0, w, h);

  const compact = w < 380;
  const pad = { l: compact ? 32 : 38, r: 14, t: 18, b: 28 };
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
  const maxW = 100, N = F03.ticks;
  const xOf = (i) => pad.l + (i / (N - 1)) * pw;
  const yOf = (v) => pad.t + (1 - v / maxW) * ph;

  // Grid lines + Y-axis labels (tabular Plex Mono)
  ctx.font = `${compact ? "9.5px" : "10.5px"} 'Plex Mono', monospace`;
  [20, 40, 60, 80, 100].forEach((g) => {
    const y = yOf(g);
    ctx.strokeStyle = "rgba(241,236,225,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillStyle = "rgba(241,236,225,0.40)";
    ctx.textAlign = "right";
    ctx.fillText(String(g), pad.l - 6, y + 3);
  });

  // Rainfall bars
  const bw = Math.max(2.5, (pw / N) * 0.56);
  F03.rain.forEach((rv, i) => {
    if (!rv) return;
    const bh = (rv / 1.5) * (ph * 0.34);
    ctx.fillStyle = i <= activeTick ? "rgba(127,178,229,0.52)" : "rgba(127,178,229,0.16)";
    ctx.fillRect(xOf(i) - bw / 2, pad.t + ph - bh, bw, bh);
  });

  // Threshold dashed lines + right-aligned limit tags
  [[F03.warn, "#F2B14C", "60 cm"], [F03.crit, "#F2604F", "80 cm"]].forEach(([lv, col, tag]) => {
    const y = yOf(lv);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.74;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.restore();
    if (!compact) {
      ctx.fillStyle = col;
      ctx.textAlign = "right";
      ctx.fillText(tag, w - pad.r - 2, y - 4);
    }
  });

  // Full ghost curve
  ctx.beginPath();
  F03.water.forEach((v, i) => (i ? ctx.lineTo(xOf(i), yOf(v)) : ctx.moveTo(xOf(i), yOf(v))));
  ctx.strokeStyle = "rgba(241,236,225,0.16)";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Active illuminated fill + curve up to activeTick
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
  grad.addColorStop(0, "rgba(62,207,150,0.34)");
  grad.addColorStop(1, "rgba(62,207,150,0.01)");
  ctx.beginPath();
  for (let i = 0; i <= activeTick; i++) {
    const x = xOf(i), y = yOf(F03.water[i]);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.lineTo(xOf(activeTick), pad.t + ph);
  ctx.lineTo(xOf(0), pad.t + ph);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i <= activeTick; i++) {
    const x = xOf(i), y = yOf(F03.water[i]);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "#3ECF96";
  ctx.lineWidth = 2.6;
  ctx.stroke();

  // Hover crosshair if present
  if (simHoverTick !== null) {
    const hx = xOf(simHoverTick);
    ctx.strokeStyle = "rgba(241,236,225,0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hx, pad.t); ctx.lineTo(hx, pad.t + ph); ctx.stroke();
  }

  // Subtle L1 Severe window highlight (T18..T20) & T21 L0!=L1 decoupling guide
  const sx0 = xOf(18), sx1 = xOf(20);
  ctx.fillStyle = "rgba(242,96,79,0.065)";
  ctx.fillRect(sx0, pad.t, sx1 - sx0, ph);

  // Active playhead marker (outer ring = L1 situational color, inner core = L0 reading color)
  const ax = xOf(activeTick), ay = yOf(F03.water[activeTick]);
  const st = stateAt(activeTick, state.lang);
  ctx.strokeStyle = "rgba(241,236,225,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ax, pad.t); ctx.lineTo(ax, pad.t + ph); ctx.stroke();
  ctx.beginPath(); ctx.arc(ax, ay, 9.5, 0, TAU);
  ctx.strokeStyle = st.l1Col; ctx.lineWidth = 1.8; ctx.stroke();
  ctx.beginPath(); ctx.arc(ax, ay, 6.8, 0, TAU);
  ctx.fillStyle = "rgba(5,14,13,0.94)"; ctx.fill();
  ctx.beginPath(); ctx.arc(ax, ay, 4.6, 0, TAU);
  ctx.fillStyle = st.col; ctx.fill();

  // Adaptive X ticks (prevents crowding on 320px viewports)
  ctx.fillStyle = "rgba(241,236,225,0.44)";
  ctx.textAlign = "center";
  const xTicks = compact ? [0, 6, 15, 21, 26, 31] : [0, 6, 12, 15, 18, 21, 26, 31];
  xTicks.forEach((tk) => {
    ctx.fillText("T" + String(tk).padStart(2, "0"), xOf(tk), h - 8);
  });
}

function paintSimAt(tick) {
  const lang = state.lang;
  const L = CONTENT[lang].sim.readLabels;
  const st = stateAt(tick, lang);
  const tStr = "T" + String(tick).padStart(2, "0");
  $("#simTickLabel").textContent = `${tStr} / T31`;
  $("#simRead").innerHTML = `
    <div><small>${esc(L.tick)}</small><strong dir="ltr">${tStr}</strong></div>
    <div><small>${esc(L.water)}</small><strong dir="ltr">${F03.water[tick]} cm</strong></div>
    <div><small>${esc(L.rain)}</small><strong dir="ltr">${F03.rain[tick].toFixed(1)} mm/m</strong></div>
    <div><small>${esc(L.state)}</small><strong style="color:${st.col}">${esc(st.l0)}</strong></div>
    <div><small>${esc(L.l1)}</small><strong style="color:${st.l1Col}">${esc(st.l1)}</strong></div>`;

  $$("#simMilestones .ms-pill").forEach((b) => b.classList.toggle("on", Number(b.dataset.tk) === tick));

  const hits = [tick >= 6 && tick < 15, tick >= 15 && tick < 18, tick >= 18 && tick <= 20, tick >= 21 && tick <= 24, tick >= 26];
  $$("#simEvents li").forEach((li, i) => li.classList.toggle("hit", Boolean(hits[i])));
  drawSimChart(tick);
}

function stopSim() {
  state.simPlaying = false;
  clearInterval(state.simTimer);
  const icon = $("#simPlayIcon");
  if (icon) icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
  $("#simPlay")?.setAttribute("aria-label", CONTENT[state.lang].ui.play);
}

function wireSim() {
  const scrub = $("#simScrub");
  const play = $("#simPlay");
  const canvas = $("#simChart");
  const tip = $("#simHoverTip");

  scrub?.addEventListener("input", () => {
    stopSim();
    state.simTick = Number(scrub.value);
    paintSimAt(state.simTick);
  });

  play?.addEventListener("click", () => {
    if (state.simPlaying) { stopSim(); return; }
    state.simPlaying = true;
    $("#simPlayIcon").innerHTML = '<path d="M7 5h3v14H7zM14 5h3v14h-3z"/>';
    play.setAttribute("aria-label", CONTENT[state.lang].ui.pause);
    if (state.simTick >= F03.ticks - 1) state.simTick = 0;
    state.simTimer = setInterval(() => {
      state.simTick += 1;
      if (state.simTick === 15) Sound.alert("warn");
      if (state.simTick === 18) Sound.alert("crit");
      scrub.value = String(state.simTick);
      paintSimAt(state.simTick);
      if (state.simTick >= F03.ticks - 1) stopSim();
    }, state.simSpeed);
  });

  $$(".speed-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.simSpeed = Number(btn.dataset.speed);
      $$(".speed-btn").forEach((b) => b.classList.toggle("on", b === btn));
      if (state.simPlaying) { stopSim(); play.click(); }
    })
  );

  canvas?.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const padL = r.width < 380 ? 32 : 38, padR = 14;
    const pw = Math.max(40, r.width - padL - padR);
    const tk = Math.max(0, Math.min(31, Math.round(((x - padL) / pw) * 31)));
    simHoverTick = tk;
    drawSimChart(state.simTick);
    if (tip) {
      tip.hidden = false;
      tip.textContent = `T${String(tk).padStart(2, "0")} · ${F03.water[tk]} cm · ${F03.rain[tk].toFixed(1)} mm/m`;
      tip.style.left = Math.min(Math.max(8, r.width - 170), Math.max(8, x - 60)) + "px";
    }
  });
  canvas?.addEventListener("pointerleave", () => {
    simHoverTick = null;
    if (tip) tip.hidden = true;
    drawSimChart(state.simTick);
  });
  canvas?.addEventListener("click", () => {
    if (simHoverTick !== null) {
      stopSim();
      state.simTick = simHoverTick;
      scrub.value = String(state.simTick);
      Sound.tick();
      paintSimAt(state.simTick);
    }
  });

  if (canvas && "ResizeObserver" in window) {
    new ResizeObserver(() => drawSimChart(state.simTick)).observe(canvas);
  } else {
    window.addEventListener("resize", () => drawSimChart(state.simTick), { passive: true });
  }
}

/* ==========================================================================
   07–12 · RESPONSE, VALUE, STATUS, TEAM, DOCS & CONTACT LAUNCHPAD
   ========================================================================== */
function renderResponse(lang) {
  const rp = CONTENT[lang].resp;
  $("#respChain").innerHTML = rp.nodes
    .map(([name, k, d, gate], idx) => `
      <div class="resp-node${idx === state.respIdx ? " on" : ""}" role="button" tabindex="0" aria-pressed="${idx === state.respIdx}" data-ridx="${idx}">
        <div>
          <span class="k" dir="ltr">STEP ${esc(k)}</span>
          <h4>${esc(name)}</h4>
          <p>${esc(d)}</p>
        </div>
        <div class="rn-gate">${esc(gate)}</div>
      </div>`)
    .join("");
  $$("#respChain .resp-node").forEach((el) => {
    const pick = () => {
      state.respIdx = Number(el.dataset.ridx);
      Sound.tick();
      renderResponse(state.lang);
    };
    el.addEventListener("click", pick);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); }
    });
  });
  const img = $("#respShotImg");
  if (img) img.src = `assets/img/media/platform-plan-${lang}.webp`;
}

function renderValue(lang) {
  $("#valueGrid").innerHTML = CONTENT[lang].value.items
    .map(([t, b, ic, cls]) => `
      <article class="spot-card vcard ${cls}">
        <div class="ic">${valueIcon(ic)}</div>
        <h3>${esc(t)}</h3>
        <p>${esc(b)}</p>
      </article>`)
    .join("");
}

function renderStatus(lang) {
  const st = CONTENT[lang].status;
  const counts = { all: st.rows.length };
  Object.keys(CAPABILITY).forEach((k) => { counts[k] = st.rows.filter((r) => r[2] === k).length; });

  const filters = [
    ["all", CONTENT[lang].ui.allFilter, counts.all],
    ...Object.entries(CAPABILITY).map(([k, v]) => [k, v[lang], counts[k]]),
  ];

  $("#statusLegend").innerHTML =
    `<span class="small" style="margin-inline-end:6px">${esc(st.legendNote)}</span>` +
    filters.map(([k, lbl, cnt]) => `
      <button class="filter-chip${state.statusFilter === k ? " on" : ""}" type="button" data-sfilter="${k}">
        <span>${esc(lbl)}</span><b dir="ltr">${cnt}</b>
      </button>`).join("");

  $$("#statusLegend .filter-chip").forEach((b) =>
    b.addEventListener("click", () => {
      state.statusFilter = b.dataset.sfilter;
      Sound.tick();
      renderStatus(state.lang);
    })
  );

  const visible = state.statusFilter === "all" ? st.rows : st.rows.filter((r) => r[2] === state.statusFilter);
  $("#statusRows").innerHTML = visible
    .map(([a, b, k]) => `
      <div class="srow">
        <h4>${esc(a)}</h4>
        <p>${esc(b)}</p>
        <span class="badge b-${k}">${esc(CAPABILITY[k][lang])}</span>
      </div>`)
    .join("");

  $("#futureSteps").innerHTML = st.futureSteps
    .map(([a, b]) => `<div class="rm-step"><strong>${esc(a)}</strong><p>${esc(b)}</p></div>`)
    .join("");
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

function renderTeam(lang) {
  const tm = CONTENT[lang].team;
  const ui = CONTENT[lang].ui;
  const members = CFG.team || [];
  $("#teamGrid").innerHTML = members.map((m, idx) => {
    const role = lang === "ar" ? m.role_ar : m.role_en;
    const bio = tm.roles[m.key] || "";
    const li = isSupplied(m.linkedin)
      ? `<a class="lk" href="${esc(m.linkedin)}" target="_blank" rel="noopener noreferrer">
           <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8h4V23h-4V8zm7.5 0h3.8v2.05h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V23h-4v-7.9c0-1.88-.03-4.3-2.62-4.3-2.62 0-3.02 2.05-3.02 4.17V23h-4V8z"/></svg>
           <span>${esc(ui.linkedin)}</span>
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>
         </a>`
      : `<span class="small">${esc(ui.pendingLink)}</span>`;
    return `
      <article class="spot-card member">
        <div class="member-top">
          <div class="avatar" aria-hidden="true">${esc(initials(m.name_en))}</div>
          <span class="member-idx" dir="ltr">0${idx + 1} / 04</span>
        </div>
        <div>
          <h3><bdi dir="ltr">${esc(m.name_en)}</bdi></h3>
          <div class="role">${esc(role)}</div>
        </div>
        <p class="bio">${esc(bio)}</p>
        <div class="links">${li}</div>
      </article>`;
  }).join("");
}

function renderContact(lang) {
  const ct = CONTENT[lang].contact;
  const ui = CONTENT[lang].ui;
  const L = ct.labels;

  // Dual high-impact Launchpad cards
  $("#launchpadGrid").innerHTML = ct.launchpad.map((lp) => `
    <div class="lp-card spot-card${lp.primary ? " primary" : ""}">
      <div>
        <span class="lp-tag">${esc(lp.tag)}</span>
        <h3>${esc(lp.title)}</h3>
        <div class="lp-url"><bdi dir="ltr">${esc(lp.url)}</bdi></div>
        <p>${esc(lp.desc)}</p>
      </div>
      <div>
        ${lp.copy
          ? `<button class="btn btn-ghost copy-url-btn" type="button" data-copy="${esc(lp.url)}">${esc(lp.cta)}</button>`
          : `<a class="btn btn-primary" href="${esc(lp.url)}" target="_blank" rel="noopener noreferrer">${esc(lp.cta)}</a>`}
      </div>
    </div>
  `).join("");

  // Official Showcase QR Hardware Bezel
  const qrPng = CFG.showcase?.qr_png || "qr/RASD_Showcase_QR_Code.png";
  const pubUrl = CFG.showcase?.public_url || "https://fahadcs6.github.io/Rasd/";
  $("#qrCard").innerHTML = `
    <div class="qr-box"><img src="${esc(qrPng)}" alt="Official QR code for ${esc(pubUrl)}" width="160" height="160" loading="lazy"></div>
    <div>
      <span class="eyebrow">${esc(L.qr)}</span>
      <h3 style="margin-top:8px">${esc(ct.qrTitle)}</h3>
      <p class="qr-url"><bdi dir="ltr">${esc(pubUrl)}</bdi></p>
      <p class="small" style="margin-top:8px;max-width:58ch">${esc(ct.qrNote)}</p>
      <div class="qr-actions">
        <a class="btn btn-primary" style="height:40px;font-size:13px" href="${esc(qrPng)}" download="RASD_Showcase_QR_Code.png">${esc(ui.downloadQr)}</a>
        <button class="btn btn-ghost copy-url-btn" style="height:40px;font-size:13px" type="button" data-copy="${esc(pubUrl)}">${esc(ui.copyUrl)}</button>
      </div>
    </div>`;

  $$(".copy-url-btn").forEach((b) =>
    b.addEventListener("click", () => copyShowcaseUrl(b.dataset.copy))
  );

  // Official email + 4 team LinkedIn quick cards
  const cards = [];
  if (isSupplied(CFG.contact?.email)) {
    const em = CFG.contact.email;
    cards.push(`<div class="ccard"><small>${esc(L.email)}</small><div class="val"><a class="lk" href="mailto:${esc(em)}"><bdi dir="ltr">${esc(em)}</bdi></a></div><p class="small">${esc(ct.emailNote)}</p></div>`);
  }
  (CFG.team || []).forEach((m) => {
    if (!isSupplied(m.linkedin)) return;
    const role = lang === "ar" ? m.role_ar : m.role_en;
    cards.push(`<div class="ccard"><small>${esc(ui.linkedin)} · ${esc(role)}</small><div class="val"><a class="lk" href="${esc(m.linkedin)}" target="_blank" rel="noopener noreferrer"><bdi dir="ltr">${esc(m.name_en)} ↗</bdi></a></div></div>`);
  });
  $("#contactCards").innerHTML = cards.join("");

  const plat = CFG.links?.platform || "https://rasd.alsuhaibi96.com/";
  ["#heroPlatformBtn", "#topPlatformBtn", "#footPlatform"].forEach((sel) => {
    const el = $(sel);
    if (el) el.href = plat;
  });
  const footPlat = $("#footPlatform");
  if (footPlat) {
    footPlat.textContent = lang === "ar" ? `${ui.tryPlatform} ↖` : `${ui.tryPlatform} ↗`;
  }
}

function copyShowcaseUrl(url) {
  const msg = CONTENT[state.lang].ui.copied;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(() => showToast(msg)).catch(() => showToast(url));
  } else {
    showToast(url);
  }
}

let toastTimer = null;
function showToast(text) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = text;
  t.hidden = false;
  Sound.tick();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
}

/* ==========================================================================
   FULL-RESOLUTION AUTHENTIC SCREENSHOT LIGHTBOX
   ========================================================================== */
const SHOT_MAP = {
  dashboard: { file: "platform-dashboard", titleEn: "Operational Dashboard (Demo Mode)", titleAr: "لوحة الرصد التشغيلية (وضع التجربة)" },
  alerts:    { file: "platform-alerts",    titleEn: "L0 Alert Log & Acknowledgement",    titleAr: "سجل التنبيهات (L0) وتأكيد الاطلاع" },
  map:       { file: "platform-map",       titleEn: "Kingdom Monitoring Map (12 Points)",titleAr: "خريطة نقاط الرصد بالمملكة (12 نقطة)" },
  basin:     { file: "platform-basin",     titleEn: "F-03 Virtual Basin Risk Map",       titleAr: "خريطة مخاطر الحوض الافتراضي F-03" },
  sim:       { file: "platform-sim",       titleEn: "Simulation Center — Scenario F-03", titleAr: "مركز المحاكاة — السيناريو F-03" },
  plan:      { file: "platform-plan",      titleEn: "Dynamic Response Plan v30",         titleAr: "خطة الاستجابة الديناميكية (الإصدار v30)" },
};

function openLightbox(key) {
  const meta = SHOT_MAP[key];
  if (!meta) return;
  const lb = $("#lightbox");
  const img = $("#lbImg");
  const ttl = $("#lbTitle");
  img.src = `assets/img/media/${meta.file}-${state.lang}.webp`;
  img.alt = state.lang === "ar" ? meta.titleAr : meta.titleEn;
  ttl.textContent = state.lang === "ar" ? meta.titleAr : meta.titleEn;
  lb.hidden = false;
  Sound.tick();
}

function closeLightbox() {
  const lb = $("#lightbox");
  if (lb) lb.hidden = true;
}

function bindShotTriggers(root = document) {
  $$("[data-shot]", root).forEach((el) => {
    if (el.dataset.shotBound === "1") return;
    el.dataset.shotBound = "1";
    el.addEventListener("click", () => openLightbox(el.dataset.shot));
  });
}

function wireLightbox() {
  $("#heroExpandBtn")?.addEventListener("click", () => openLightbox("dashboard"));
  $("#lbClose")?.addEventListener("click", closeLightbox);
  $("#lbBackdrop")?.addEventListener("click", closeLightbox);
  bindShotTriggers(document);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#lightbox")?.hidden) closeLightbox();
  });
}

/* ==========================================================================
   11 · DOCUMENTATION CENTRE (PDF.js v4 + Chapter Jumps + Fullscreen + RTL Safe)
   ========================================================================== */
function docUrlFor(dlang) {
  const files = CFG.project?.document_files;
  if (files && files[dlang]) return files[dlang];
  return dlang === "ar" ? "documents/RASD_Project_Document_AR.pdf" : "documents/RASD_Project_Document_EN.pdf";
}
function docxUrlFor(dlang) {
  const files = CFG.project?.docx_files;
  if (files && files[dlang]) return files[dlang];
  return dlang === "ar" ? "documents/RASD_Project_Document_AR.docx" : "documents/RASD_Project_Document_EN.docx";
}

function renderDocMeta(lang) {
  const p = CFG.project || {};
  const dlang = state.docLang;
  const url = docUrlFor(dlang);
  const docxUrl = docxUrlFor(dlang);
  const fname = url.split("/").pop();
  const docxName = docxUrl.split("/").pop();

  $("#docTitle").textContent = dlang === "ar" ? (p.document_title_ar || "") : (p.document_title_en || "");
  $("#docVersion").textContent = "v" + (p.document_version || "1.1");
  $("#docDate").textContent = p.document_date || "—";
  $("#vFileName").textContent = fname;
  $("#vDownload").href = url;
  $("#vDownload").setAttribute("download", fname);
  $("#docDownload").href = url;
  $("#docDownload").setAttribute("download", fname);

  const dx = $("#docDownloadDocx");
  if (dx) { dx.href = docxUrl; dx.setAttribute("download", docxName); }
  $("#docFileMeta").textContent = `${fname}  ·  ${docxName}`;
  $("#docLangAr").setAttribute("aria-pressed", String(dlang === "ar"));
  $("#docLangEn").setAttribute("aria-pressed", String(dlang === "en"));

  // Chapter quick-jump pills
  const jumps = CONTENT[lang].docs.jumps;
  $("#docJumpPills").innerHTML = jumps
    .map(([pg, lbl]) => `<button class="dj-pill${state.pdf.page === pg ? " on" : ""}" type="button" data-djump="${pg}">${esc(lbl)}</button>`)
    .join("");
  $$("#docJumpPills .dj-pill").forEach((b) =>
    b.addEventListener("click", () => {
      const target = Number(b.dataset.djump);
      if (!state.pdf.doc) {
        state.pdf.page = target;
        loadPdf(docUrlFor(state.docLang));
        return;
      }
      state.pdf.page = Math.min(state.pdf.pages || 18, Math.max(1, target));
      Sound.tick();
      renderPdfPage(state.pdf.page);
      renderDocMeta(state.lang);
    })
  );

  updatePageLabel();
}

function updatePageLabel() {
  const ui = CONTENT[state.lang].ui;
  const p = state.pdf;
  $("#vPage").textContent = p.pages ? `${p.page} ${ui.of} ${p.pages}` : "—";
  $("#vZoomPct").textContent = Math.round(p.zoom * 100) + "%";
  $("#docPages").textContent = p.pages ? `${p.pages} ${CONTENT[state.lang].docs.pagesUnit}` : "18";
  $("#vPrev").disabled = !p.pages || p.page <= 1;
  $("#vNext").disabled = !p.pages || p.page >= p.pages;

  $$("#docJumpPills .dj-pill").forEach((b) => {
    const pg = Number(b.dataset.djump);
    b.classList.toggle("on", pg === p.page);
  });
}

async function ensurePdfLib() {
  if (state.pdf.lib) return state.pdf.lib;
  const mod = await import("../../vendor/pdfjs/pdf.min.mjs");
  mod.GlobalWorkerOptions.workerSrc = new URL("../../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
  state.pdf.lib = mod;
  return mod;
}

async function loadPdf(url) {
  const p = state.pdf;
  if (p.loadedUrl === url && p.doc) { renderPdfPage(p.page); return; }
  $("#vCanvas").hidden = true;
  $("#vState").hidden = false;
  $("#vState").innerHTML = `<div class="spinner"></div><span>${esc(CONTENT[state.lang].ui.loading)}</span>`;
  try {
    const lib = await ensurePdfLib();
    const doc = await lib.getDocument({ url }).promise;
    p.doc = doc;
    p.pages = doc.numPages;
    p.page = Math.min(p.page || 1, p.pages);
    p.loadedUrl = url;
    $("#vState").hidden = true;
    $("#vCanvas").hidden = false;
    updatePageLabel();
    await renderPdfPage(p.page);
  } catch (err) {
    console.warn("PDF viewer fallback:", err);
    const fname = url.split("/").pop();
    $("#vState").hidden = false;
    $("#vState").innerHTML = `
      <p style="max-width:42ch">${esc(CONTENT[state.lang].ui.loadFail)}</p>
      <a class="btn btn-primary" href="${esc(url)}" download="${esc(fname)}">${esc(CONTENT[state.lang].ui.download)}</a>`;
  }
}

async function renderPdfPage(num) {
  const p = state.pdf;
  if (!p.doc) return;
  if (p.rendering) { p.pending = num; return; }
  p.rendering = true;
  try {
    const page = await p.doc.getPage(num);
    const stage = $("#vStage");
    const canvas = $("#vCanvas");
    const baseVp = page.getViewport({ scale: 1 });
    const padX = stage.clientWidth < 500 ? 28 : 48;
    const avail = Math.max(220, stage.clientWidth - padX);
    const fit = avail / baseVp.width;
    const scale = fit * p.zoom;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vp = page.getViewport({ scale: scale * dpr });
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    canvas.style.width = Math.floor(vp.width / dpr) + "px";
    canvas.style.height = Math.floor(vp.height / dpr) + "px";
    canvas.setAttribute("dir", "ltr");
    const ctx = canvas.getContext("2d");
    ctx.direction = "ltr";
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    updatePageLabel();
  } finally {
    p.rendering = false;
    if (p.pending !== null) { const n = p.pending; p.pending = null; renderPdfPage(n); }
  }
}

function wireViewer() {
  const p = state.pdf;
  $("#vPrev")?.addEventListener("click", () => { if (p.page > 1) { p.page--; renderPdfPage(p.page); } });
  $("#vNext")?.addEventListener("click", () => { if (p.page < p.pages) { p.page++; renderPdfPage(p.page); } });
  $("#vZoomIn")?.addEventListener("click", () => { p.zoom = Math.min(2.6, +(p.zoom + 0.2).toFixed(2)); renderPdfPage(p.page); });
  $("#vZoomOut")?.addEventListener("click", () => { p.zoom = Math.max(0.6, +(p.zoom - 0.2).toFixed(2)); renderPdfPage(p.page); });
  $("#vFit")?.addEventListener("click", () => { p.zoom = 1; renderPdfPage(p.page); });
  $("#vFullscreen")?.addEventListener("click", () => {
    const shell = $("#viewerShell");
    if (!shell) return;
    if (shell.classList.contains("pseudo-fullscreen")) {
      shell.classList.remove("pseudo-fullscreen");
      document.body.classList.remove("drawer-open");
      if (p.doc) setTimeout(() => renderPdfPage(p.page), 80);
      return;
    }
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
      return;
    }
    const req = shell.requestFullscreen || shell.webkitRequestFullscreen;
    if (req) {
      Promise.resolve(req.call(shell)).catch(() => {
        shell.classList.add("pseudo-fullscreen");
        document.body.classList.add("drawer-open");
        if (p.doc) setTimeout(() => renderPdfPage(p.page), 80);
      });
    } else {
      shell.classList.add("pseudo-fullscreen");
      document.body.classList.add("drawer-open");
      if (p.doc) setTimeout(() => renderPdfPage(p.page), 80);
    }
  });
  window.addEventListener("keydown", (e) => {
    const shell = $("#viewerShell");
    if (e.key === "Escape" && shell?.classList.contains("pseudo-fullscreen")) {
      shell.classList.remove("pseudo-fullscreen");
      document.body.classList.remove("drawer-open");
      if (p.doc) setTimeout(() => renderPdfPage(p.page), 80);
    }
  });
  $("#viewerShell")?.addEventListener("keydown", (e) => {
    if (!p.doc) return;
    const rtl = state.docLang === "ar";
    if (e.key === "ArrowRight") {
      const nextPg = rtl ? p.page - 1 : p.page + 1;
      if (nextPg >= 1 && nextPg <= p.pages) { e.preventDefault(); p.page = nextPg; renderPdfPage(p.page); }
    } else if (e.key === "ArrowLeft") {
      const nextPg = rtl ? p.page + 1 : p.page - 1;
      if (nextPg >= 1 && nextPg <= p.pages) { e.preventDefault(); p.page = nextPg; renderPdfPage(p.page); }
    }
  });
  document.addEventListener("fullscreenchange", () => { if (p.doc) setTimeout(() => renderPdfPage(p.page), 120); });
  document.addEventListener("webkitfullscreenchange", () => { if (p.doc) setTimeout(() => renderPdfPage(p.page), 120); });

  const pickDoc = (dl) => {
    state.docLang = dl;
    state.pdf.page = 1;
    renderDocMeta(state.lang);
    loadPdf(docUrlFor(dl));
  };
  $("#docLangAr")?.addEventListener("click", () => pickDoc("ar"));
  $("#docLangEn")?.addEventListener("click", () => pickDoc("en"));

  let started = false;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries, obs) => {
      if (entries.some((en) => en.isIntersecting) && !started) {
        started = true;
        obs.disconnect();
        loadPdf(docUrlFor(state.docLang));
      }
    }, { rootMargin: "420px" }).observe($("#document"));
  } else {
    loadPdf(docUrlFor(state.docLang));
  }

  let rt;
  window.addEventListener("resize", () => {
    if (!p.doc) return;
    clearTimeout(rt);
    rt = setTimeout(() => renderPdfPage(p.page), 180);
  }, { passive: true });
}

/* ==========================================================================
   GLOBAL MOTION, SCROLL TELEMETRY, PARALLAX & SPOTLIGHT TRACKING
   ========================================================================== */
function toggleDrawer(open) {
  const d = $("#drawer"), b = $("#menuBtn");
  if (!d || !b) return;
  const next = open === undefined ? !d.classList.contains("open") : open;
  d.classList.toggle("open", next);
  b.setAttribute("aria-expanded", String(next));
  document.body.classList.toggle("drawer-open", next);
}

let revealObserver = null;
function observeReveals() {
  if (REDUCED || !("IntersectionObserver" in window)) {
    $$(".reveal").forEach((el) => el.classList.add("in"));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("in"); revealObserver.unobserve(en.target); }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -36px 0px" });
  }
  $$(".reveal:not(.in)").forEach((el) => revealObserver.observe(el));
}

function wireScrollAndSpotlights() {
  const prog = $("#scrollProgress");
  const parallaxMedia = $$("[data-parallax-media]");
  let scrollQueued = false;

  function flushScrollFrame() {
    scrollQueued = false;
    // PHASE 1: READ ALL DOM/LAYOUT METRICS FIRST (zero layout thrashing)
    const winH = window.innerHeight || 1;
    const winW = window.innerWidth || 1024;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - winH);
    const ratio = Math.min(1, Math.max(0, window.scrollY / maxScroll));

    const offsets = (!REDUCED && winW > 768)
      ? parallaxMedia.map((el) => {
          const speed = parseFloat(el.dataset.parallaxMedia || "0.08");
          const parent = el.parentElement || el;
          const r = parent.getBoundingClientRect();
          if (r.bottom < -120 || r.top > winH + 120) return null;
          const raw = (r.top + r.height * 0.5 - winH * 0.5) * -speed;
          return Math.max(-28, Math.min(28, raw));
        })
      : null;

    // PHASE 2: WRITE PURE GPU CUSTOM PROPERTIES ONLY (scaleX & translate3d)
    if (prog) prog.style.setProperty("--sp", ratio.toFixed(4));
    if (offsets) {
      parallaxMedia.forEach((el, idx) => {
        if (offsets[idx] !== null) el.style.setProperty("--py", `${offsets[idx].toFixed(1)}px`);
      });
    } else {
      parallaxMedia.forEach((el) => el.style.setProperty("--py", "0px"));
    }
  }

  function requestScrollTick() {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(flushScrollFrame);
  }

  window.addEventListener("scroll", requestScrollTick, { passive: true });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 1100 && $("#drawer")?.classList.contains("open")) toggleDrawer(false);
    requestScrollTick();
  }, { passive: true });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("#drawer")?.classList.contains("open")) toggleDrawer(false);
  });
  flushScrollFrame();

  // Active section spy for Topnav + Chapter Rail
  const secs = ["hero", "challenge", "concept", "workflow", "risk", "geography", "simulation", "response", "value", "status", "team", "document", "contact"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if ("IntersectionObserver" in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const id = en.target.id;
        $$("#topnav a").forEach((a) => a.classList.toggle("on", a.dataset.sec === id));
        $$("#chapterRail .cr-dot").forEach((d) => d.classList.toggle("on", d.dataset.rail === id));
      });
    }, { rootMargin: "-38% 0px -52% 0px" });
    secs.forEach((s) => spy.observe(s));
  }

  // Subtle pointer-spotlight border illumination on .spot-card
  document.addEventListener("pointermove", (e) => {
    const card = e.target.closest?.(".spot-card");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${(e.clientX - r.left).toFixed(0)}px`);
    card.style.setProperty("--my", `${(e.clientY - r.top).toFixed(0)}px`);
  }, { passive: true });
}

/* ==========================================================================
   MASTER RENDER & BOOTSTRAP
   ========================================================================== */
function renderAll() {
  const lang = state.lang;
  applySimpleI18n(lang);
  renderNavAndChapters(lang);
  renderHeroExtras(lang);
  renderChallenge(lang);
  renderConcept(lang);
  renderWorkflow(lang);
  renderRisk(lang);
  renderMap(lang);
  renderSim(lang);
  renderResponse(lang);
  renderValue(lang);
  renderStatus(lang);
  renderTeam(lang);
  renderDocMeta(lang);
  renderContact(lang);
  bindShotTriggers(document);
  observeReveals();
}

function setLanguage(next) {
  state.lang = next;
  state.docLang = next;
  state.pdf.page = 1;
  try { localStorage.setItem("rasd_lang", next); } catch {}
  Sound.tick();
  renderAll();
  if (state.pdf.loadedUrl) loadPdf(docUrlFor(next));
}

function boot() {
  mountMarks();
  renderAll();
  wireIntroControls();
  startIntro(false);
  startHeroRadar();
  wireSim();
  wireViewer();
  wireLightbox();
  wireScrollAndSpotlights();

  $("#langBtn")?.addEventListener("click", () => setLanguage(state.lang === "en" ? "ar" : "en"));
  $("#menuBtn")?.addEventListener("click", () => toggleDrawer());
  $("#flowTourBtn")?.addEventListener("click", toggleFlowTour);
}

boot();
