"use strict";
if (/index\.html$/.test(location.pathname)) history.replaceState(null, "", location.pathname.replace(/index\.html$/, "") + location.search + location.hash);   // adresse propre : /clicker/ sans index.html
// Core : state, formats, boucle, Voile (surchauffe), Grimoire (gacha), hors-ligne, sauvegarde locale.
const PREFS_KEY = "coffre-prefs", readPrefs = () => { try { return Object.assign({ sound: true, vibe: true }, JSON.parse(localStorage.getItem(PREFS_KEY) || "{}")); } catch (e) { return { sound: true, vibe: true }; } };
let SOUND = readPrefs().sound !== false;               // son activé ? (réglable ici et dans Options du Coffre)
const KEY = "coffre-clicker", $ = id => document.getElementById(id), M = (k, d) => Spells.mod(k, d);
const U = ["nL","µL","mL","L","kL","ML","GL","TL","PL","EL"], SF = ["","K","M","B","T","Qa","Qi"];
const fE = v => { if (v < 1e3) return v.toFixed(v < 10 ? 2 : 1) + " nL"; const i = Math.min(Math.floor(Math.log10(v) / 3), 9), x = v / 1e3 ** i; return x.toFixed(x < 10 ? 2 : x < 100 ? 1 : 0) + " " + U[i]; };
const fN = v => { if (v < 1e3) return v < 10 ? v.toFixed(1) : Math.floor(v) + ""; const i = Math.min(Math.floor(Math.log10(v) / 3), 6); return (v / 1e3 ** i).toFixed(2) + SF[i]; };

let S = { eth: 0, sg: 0, b: {}, seen: Date.now() };
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
const save = () => { S.seen = Date.now(); localStorage.setItem(KEY, JSON.stringify(S)); };

// ---- Fragments de clés : EFFORT ACTIF uniquement (clic/sort < 10 s). 5 min d'effort = 1 fragment (5 fragments = 1 clé du Coffre).
// 10-15 min tryhard ≈ 2-3 fragments · plafond 9/jour (≈ 1,8 clé) · le farm idle ne donne rien À CE NIVEAU (le flux passif = micro-fragments, ci-dessous). `fr.earned` est cumulatif : le Coffre
// réclame (earned − déjà réclamé), donc jamais de doublon même avec plusieurs appareils.
const FR_SEC = 300, FR_DAY = 9;
const dayKey = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
// ---- Micro-fragments PASSIFS (Sprint 4) : flux lié à l'Éther/s, 100 micro = 1 fragment (même `earned` que l'actif → pont Coffre inchangé).
// Courbe [log10(nL/s), clés/jour] interpolée linéairement ; <10 nL/s proportionnel ; >1e15 monte vers 25 (atteint à 1e17). Plafond passif 25 clés/jour = 125 fragments,
// SÉPARÉ des FR_DAY actifs. Hooks M("frag") (en ligne + hors-ligne) et M("fragOff") (hors-ligne seul). Aucune écriture cloud par tick : sync à chaque fragment entier.
const FR_PCAP = 125, FR_CURVE = [[1, .1], [6, 1], [9, 5], [12, 12], [15, 22], [17, 25]];
const keysPerDay = e => {
  if (!(e > 0)) return 0; const l = Math.log10(e); if (l < 1) return .1 * e / 10; if (l >= 17) return 25;
  for (let i = 1; i < FR_CURVE.length; i++) if (l <= FR_CURVE[i][0]) { const a = FR_CURVE[i - 1], b = FR_CURVE[i]; return a[1] + (b[1] - a[1]) * (l - a[0]) / (b[0] - a[0]); }
  return 25;
};
const fragRate = e => keysPerDay(e) * 5 * 100 / 86400 * M("frag", 1);      // micro-fragments par seconde
function getFr() {                                     // état normalisé + remise à zéro quotidienne (actif ET passif)
  const f = S.fr || (S.fr = {}), d = dayKey();
  f.earned = f.earned || 0; f.eff = f.eff || 0; f.today = f.today || 0; f.micro = f.micro || 0; f.pday = f.pday || 0;
  if (f.day !== d) { f.day = d; f.today = 0; f.pday = 0; }
  return f;
}
function microAdd(m) {                                 // renvoie le nombre de fragments entiers gagnés
  const f = getFr(); if (!(m > 0)) return 0;
  if (f.pday >= FR_PCAP) { f.micro = 0; return 0; }
  f.micro += m; let n = 0;
  while (f.micro >= 100 && f.pday < FR_PCAP) { f.micro -= 100; f.earned++; f.pday++; n++; }
  if (f.pday >= FR_PCAP) f.micro = 0;
  return n;
}
let CK = null, lastT = -1, lastE = -1, keyBusy = 0, shownSeg = -1, lastLiq = -1, gT = 0;   // CK : état Coffre lu en lecture seule (fragments + clickerClaimed)
const keyTotal = f => CK ? CK.fr + Math.max(0, f.earned - CK.claimed) : f.earned;         // repli hors connexion : earned % 5
function keyFly() {                                    // 5/5 : la clé pulse, puis vole vers « Retour au Coffre » (purement visuel)
  const k = $("fkey"), b = document.querySelector(".back"); keyBusy = 1; k.classList.add("ready");
  const end = () => { k.classList.remove("ready"); keyBusy = 0; };
  if (RM || !k.animate) return void setTimeout(end, 900);
  setTimeout(() => {
    const a = k.getBoundingClientRect(), z = b.getBoundingClientRect(), dx = z.left + z.width / 2 - a.left - a.width / 2, dy = z.top + z.height / 2 - a.top - a.height / 2;
    for (let i = 0; i < 4; i++) {
      const g = k.cloneNode(true); g.removeAttribute("id"); g.setAttribute("class", "fkfly"); g.style.cssText = "left:" + a.left + "px;top:" + a.top + "px;width:" + a.width + "px;height:" + a.height + "px";
      document.body.append(g);
      const an = g.animate([{ transform: "none", opacity: i ? .5 - i * .1 : 1 }, { transform: "translate(" + dx * .5 + "px," + (dy * .5 - 60) + "px) scale(1.15)", opacity: i ? .4 - i * .08 : 1, offset: .45 }, { transform: "translate(" + dx + "px," + dy + "px) scale(.45)", opacity: 0 }], { duration: 750, delay: i * 70, easing: "cubic-bezier(.5,0,.8,.4)", fill: "backwards" });
      an.onfinish = () => { g.remove(); if (!i) { b.classList.remove("got"); void b.offsetWidth; b.classList.add("got"); end(); } };
    }
  }, 700);
}
function grain(c, dt) {                                // grains du Voile → fiole, ≤ 6/s
  if (RM || document.hidden || !(c.ethPS > 0) || !$("fvial").animate) return;
  gT += dt; const rate = .4 + 5.6 * Math.min(1, Math.log10(c.ethPS + 1) / 15);
  if (gT < 1 / rate) return; gT = 0;
  const v = $("veilSvg").getBoundingClientRect(), t = $("fvial").getBoundingClientRect(); if (!v.width || !t.width) return;
  const sx = v.left + v.width * (.15 + Math.random() * .7), sy = v.top + v.height * (.25 + Math.random() * .55), ex = t.left + t.width / 2, ey = t.top + t.height * .7;
  const g = document.createElement("i"); g.className = "fgrain"; document.body.append(g);
  const an = g.animate([{ transform: "translate(" + sx + "px," + sy + "px)", opacity: 0 }, { transform: "translate(" + (sx + (ex - sx) * .3) + "px," + (sy - 40) + "px)", opacity: 1, offset: .25 }, { transform: "translate(" + ex + "px," + ey + "px) scale(.4)", opacity: 0 }], { duration: 900, easing: "ease-in" });
  an.onfinish = () => g.remove();
}
function fragUI(f, c, dt) {
  const t = keyTotal(f);
  if (lastT >= 0 && Math.floor(t / 5) > Math.floor(lastT / 5) && !keyBusy) keyFly();
  lastT = t;
  if (lastE >= 0 && f.earned > lastE) { const v = $("fvial"); v.classList.remove("flash"); void v.offsetWidth; v.classList.add("flash"); }
  lastE = f.earned;
  const seg = keyBusy ? 5 : t % 5;
  if (seg !== shownSeg) {
    shownSeg = seg; $("fkey").classList.toggle("lit", seg > 0);
    document.querySelectorAll("#fkey .kp").forEach((e, i) => e.classList.toggle("on", i < seg));
    document.querySelectorAll("#fkey .kcr").forEach(e => e.classList.toggle("on", +e.dataset.i + 2 <= seg));
  }
  const lq = Math.floor(f.micro), lv = Math.round(f.micro * 2);
  if (lv !== lastLiq) { lastLiq = lv; $("fvL").style.transform = "translateY(" + (f.micro < .5 ? 47 : 47 - 29 * f.micro / 100) + "px)"; }
  const kd = Math.min(25, keysPerDay(c.ethPS) * M("frag", 1));
  $("frm").textContent = f.pday >= FR_PCAP ? "Plafond passif atteint" : "Passif ≈ " + (kd < 10 ? kd.toFixed(1) : Math.round(kd)) + " clé/j · " + lq + "/100";
  grain(c, dt);
}
// Clé d'or verticale brisée en 5 éclats (zigzags fixes = cassures, graine constante) ; éclat 0 = anneau + joyau rouge, 4 = panneton.
function initKey() {
  let sd = 7; const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647, f1 = n => n.toFixed(1);
  const P = a => a.map((p, i) => (i ? "L" : "M") + f1(p[0]) + " " + f1(p[1])).join("");
  const zig = B => Array.from({ length: 9 }, (_, i) => [-2 + (i + (i > 0 && i < 8 ? (rnd() - .5) * .6 : 0)) * 5.5, B + (rnd() - .5) * 8]);
  const Z = [70, 52, 36, 20].map(zig), top = [[-2, -2], [42, -2]], bot = [[-2, 122], [42, 122]];
  const ex = [   // gravures propres à chaque éclat
    "<circle class='kd' cx='20' cy='92' r='13.5'/><g class='kgem' transform='translate(20 92)'><circle r='9.4' fill='none' stroke='#5b3f0c' stroke-width='1.2'/><circle r='7.4' fill='url(#kgm)' stroke='#6b1020' stroke-width='.8'/><path d='M-7.4 0L0-7.4L7.4 0L0 7.4Z M-3.7-3.7L3.7 3.7M3.7-3.7L-3.7 3.7' fill='none' stroke='rgba(255,255,255,.32)' stroke-width='.5'/><ellipse cx='-2.4' cy='-3.1' rx='2' ry='1.1' fill='rgba(255,255,255,.8)' transform='rotate(-35 -2.4 -3.1)'/></g>",
    "<path class='kd' d='M15 57H25M15 60.5H25'/>", "<path class='kd' d='M20 40V49M17.5 44.5H22.5'/>", "<path class='kd' d='M18 24V33M22 24V33'/>", "<path class='kd' d='M20 8V15'/>"
  ];
  let h = "<defs><linearGradient id='kg' gradientUnits='userSpaceOnUse' x1='2' y1='0' x2='38' y2='0'><stop offset='0' stop-color='#8a6a1d'/><stop offset='.3' stop-color='#fff1b0'/><stop offset='.55' stop-color='#e8c04a'/><stop offset='1' stop-color='#7a5a14'/></linearGradient>" +
    "<radialGradient id='kgm' cx='.4' cy='.35' r='.75'><stop offset='0' stop-color='#fda4af'/><stop offset='.45' stop-color='#e11d48'/><stop offset='1' stop-color='#7f1030'/></radialGradient>" +
    "<g id='kshape'><circle id='kb' cx='20' cy='92' r='19'/><rect id='kh' x='15' y='6' width='10' height='78' rx='3'/><rect id='kt1' x='24' y='4' width='14' height='10' rx='1.5'/><rect id='kt2' x='24' y='22' width='10' height='8' rx='1.5'/><rect id='kt3' x='24' y='40' width='8' height='7' rx='1.5'/></g>" +
    "<clipPath id='kall'><use href='#kb'/><use href='#kh'/><use href='#kt1'/><use href='#kt2'/><use href='#kt3'/></clipPath>";
  for (let k = 0; k < 5; k++) h += "<clipPath id='kc" + k + "'><path d='" + P(k < 4 ? Z[k] : top) + P((k ? Z[k - 1] : bot).slice().reverse()).replace("M", "L") + "Z'/></clipPath>";
  h += "</defs>";
  for (let k = 0; k < 5; k++) h += "<g class='kp' clip-path='url(#kc" + k + ")'><use href='#kshape'/><g clip-path='url(#kall)'>" + ex[k] + "</g></g>";
  h += "<g clip-path='url(#kall)'>";
  Z.forEach((z, i) => { h += "<path class='kcr' data-i='" + i + "' d='" + P(z) + "'/><path class='kcr hl' data-i='" + i + "' transform='translate(0 1)' d='" + P(z) + "'/>"; });
  $("fkey").innerHTML = h + "</g>";
}
function initStars() {                                 // même ciel que le Coffre : 80 étoiles qui scintillent
  const c = $("stars");
  for (let i = 0; i < 80; i++) {
    const s = document.createElement("div"), z = Math.random() * 2 + 1; s.className = "star";
    s.style.cssText = "width:" + z + "px;height:" + z + "px;top:" + Math.random() * 100 + "%;left:" + Math.random() * 100 + "%;--d:" + (2 + Math.random() * 4) + "s;--delay:" + -Math.random() * 4 + "s;opacity:" + Math.random() * .5;
    c.appendChild(s);
  }
}
function fragTick(dt, c) {
  const f = getFr();
  if (f.today < FR_DAY && Spells.active()) {
    f.eff += dt;
    if (f.eff >= FR_SEC) {
      f.eff -= FR_SEC; f.earned++; f.today++; sfx("gold"); save(); cloudSave(true);
      toast("✦ Fragment de clé obtenu — envoyé au Coffre (" + f.today + "/" + FR_DAY + " aujourd'hui)");
    }
  }
  const r = Math.ceil(FR_SEC - f.eff);
  $("fr").textContent = f.today + " / " + FR_DAY;
  $("frs").textContent = f.today >= FR_DAY ? "Quota du jour atteint" : "Prochain : " + Math.floor(r / 60) + ":" + String(r % 60).padStart(2, "0") + " d'effort";
  const np = microAdd(fragRate(c.ethPS) * dt);          // flux passif (silencieux : aucun son hors geste utilisateur)
  if (np) { save(); cloudSave(true); toast("✦ Micro-fragments : +" + np + " fragment(s) passif(s) — envoyé au Coffre (" + f.pday + "/" + FR_PCAP + " aujourd'hui)"); }
  fragUI(f, c, dt);
}

// ---- Cloud (Firebase injecté par clicker/index.html) : champ `clicker` du doc players/{uid}, écriture différée ≥ 30 s, jamais par tick.
const mergeFr = (a, b) => { const t = (b.day || "") > (a.day || "") || ((b.day || "") === (a.day || "") && (b.today || 0) > (a.today || 0)) ? b : a;
  return { earned: Math.max(a.earned || 0, b.earned || 0), eff: t.eff || 0, day: t.day || "", today: t.today || 0, micro: t.micro || 0, pday: t.pday || 0 }; };
// ---- Notification push « une clé est prête » : estimation de l'heure où le flux PASSIF (hors-ligne, plafonné par offlineCap) aura formé la prochaine clé.
// Écrite dans Firestore push/{uid}.clickerAt (le jeton est enregistré par le Coffre) ; envoyée par scripts/send-push.js. 0 = pas de clé avant la limite d'absence.
let pushSig = "";
function clickerKeyETA() {
  const f = getFr(), c = Passives.calc(), rate = fragRate(c.ethPS) * M("fragOff", 1);        // micro-fragments par seconde, hors-ligne
  if (!(rate > 0)) return 0;
  const need = 5 - (keyTotal(f) % 5);                                                       // fragments avant la prochaine clé (1 à 5)
  if (f.pday + need > FR_PCAP) return 0;                                                    // plafond passif du jour atteint avant la clé
  const sec = (need * 100 - f.micro) / rate;
  return sec > M("offlineCap", 8) * 3600 ? 0 : Date.now() + sec * 1e3;
}
async function pushSchedule(force) {
  const u = window.auth && window.auth.currentUser; if (!u || !window.setDoc || readPrefs().push === false || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const at = clickerKeyETA(), sig = at ? Math.round(at / 6e4) : 0; if (!force && sig === pushSig) return; pushSig = sig;
  try { await window.setDoc(window.doc(window.db, "push", u.uid), { clickerAt: at || null, updatedAt: new Date().toISOString() }, { merge: true }); } catch (e) { pushSig = ""; }
}
// ---- SYNCHRO CLOUD : règles de protection de la progression (v2.a2.14) ----
//  • Score d'avancement `progScore` (bâtiments + sorts appris + pages lues + fragments : tout ne fait que CROÎTRE) : on garde TOUJOURS l'état le plus avancé.
//    (Avant : le plus « récent » gagnait — or un état vide neuf est « récent » → il écrasait le cloud à la reconnexion.)
//  • `S.uid` : l'état local appartient à un compte ; s'il est différent du compte connecté, il est ignoré (jamais mélangé).
//  • Aucune écriture cloud tant que le chargement du cloud n'a pas réussi (`cloudReady`) ; chaque écriture est une TRANSACTION qui refuse de
//    remplacer un cloud plus avancé (autre appareil) : on recharge alors le cloud au lieu de l'écraser.
const progScore = X => {
  if (!X) return 0;
  const b = Object.values(X.b || {}).reduce((a, v) => a + (v || 0), 0), sp = X.sp && X.sp.learned ? Object.keys(X.sp.learned).length : 0;
  return b * 1000 + sp * 100000 + ((X.g && X.g.n) || 0) * 10 + ((X.fr && X.fr.earned) || 0) * 1000;
};
let cloudT = 0, cloudReady = false, cloudUid = "";
async function cloudSave(force) {
  pushSchedule(force);
  const u = window.auth && window.auth.currentUser, n = Date.now(); if (!u || !cloudReady || cloudUid !== u.uid || (!force && n - cloudT < 3e4)) return; cloudT = n;
  const ref = window.doc(window.db, "players", u.uid), body = () => ({ clicker: { json: JSON.stringify(S), earned: (S.fr && S.fr.earned) || 0, ts: n } });
  try {
    if (!window.runTransaction) return void await window.setDoc(ref, body(), { merge: true });
    await window.runTransaction(window.db, async tx => {
      const cur = await tx.get(ref), C = cur.exists() && cur.data().clicker; let R = null;
      if (C && C.json) { try { R = JSON.parse(C.json); } catch (e) {} }
      if (R && progScore(R) > progScore(S)) throw new Error("STALE");                  // le cloud est plus avancé : on ne l'écrase pas
      tx.set(ref, body(), { merge: true });
    });
  } catch (e) {
    if (e && e.message === "STALE") { cloudReady = false; cloudLoad(u); }                // autre appareil plus avancé → on le récupère
    else console.warn("cloudSave", e);
  }
}
async function cloudLoad(u) {
  try {
    const snap = await window.getDoc(window.doc(window.db, "players", u.uid)), c = snap.exists() ? snap.data().clicker : null, st = snap.exists() ? snap.data().state : null;
    if (st) { CK = { fr: st.fragments || 0, claimed: st.clickerClaimed || 0 }; lastT = lastE = -1; }   // lecture seule : segments de la clé
    let R = null; if (c && c.json) { try { R = JSON.parse(c.json); } catch (e) {} }
    const foreign = !!(S.uid && S.uid !== u.uid), lp = foreign ? -1 : progScore(S), cp = R ? progScore(R) : -1;
    if (R && (cp > lp || (cp === lp && (R.seen || 0) > (S.seen || 0)))) {                // le cloud est plus avancé (ou égal et plus récent)
      const fr = mergeFr(foreign ? {} : S.fr || {}, R.fr || {});
      Object.keys(S).forEach(k => delete S[k]); Object.assign(S, R); S.fr = fr; Spells.init(); toast("☁ Progression synchronisée");
    } else if (foreign) {                                                                // compte sans sauvegarde, état local d'un AUTRE compte : on repart à zéro
      Object.keys(S).forEach(k => delete S[k]); Object.assign(S, { eth: 0, sg: 0, b: {}, seen: Date.now() }); Spells.init();
    } else if (R) S.fr = mergeFr(S.fr || {}, R.fr || {});
    S.uid = u.uid; if (!(S.g && S.g.need > 0)) { S.g = { n: 0, t: "norm", need: 0, got: 0 }; nextPage(false); }
    lastT = lastE = -1; save(); cloudReady = true; cloudUid = u.uid; cloudSave(true);
  } catch (e) { console.warn("cloudLoad", e); }
}

let heat = 0, hot = 0, hotMs = 5000, last = Date.now(), ac, tt;
const PG = { red: { p: .05, x: 4, d: 10, n: "Page Nécrotique" }, gold: { p: .01, x: 12, d: 8, n: "Page Dorée" } };

// Audio (Web Audio) : [freq, type, durée, volume]
const noise = (c, d) => { const b = c.createBuffer(1, c.sampleRate * d, c.sampleRate), a = b.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; return s; };
const rumble = (c, n, v, d) => {                       // grondement sourd
  const o = c.createOscillator(), l = c.createBiquadFilter(), g = c.createGain(); o.type = "sawtooth"; l.type = "lowpass"; l.frequency.value = 160;
  o.frequency.setValueAtTime(70, n); o.frequency.exponentialRampToValueAtTime(38, n + d); g.gain.setValueAtTime(v, n); g.gain.exponentialRampToValueAtTime(.001, n + d);
  o.connect(l); l.connect(g); g.connect(c.destination); o.start(n); o.stop(n + d);
};
const zap = (c, n) => {                                // décharge électrique cristalline + sourd
  [[2200 + Math.random() * 600, .035], [3400 + Math.random() * 800, .02]].forEach(([f, v]) => {
    const o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.setValueAtTime(f, n); o.frequency.exponentialRampToValueAtTime(f / 2, n + .12);
    g.gain.setValueAtTime(v, n); g.gain.exponentialRampToValueAtTime(.001, n + .14); o.connect(g); g.connect(c.destination); o.start(n); o.stop(n + .15);
  });
  const s = noise(c, .06), h = c.createBiquadFilter(), g = c.createGain(); h.type = "highpass"; h.frequency.value = 5000;
  g.gain.setValueAtTime(.05, n); g.gain.exponentialRampToValueAtTime(.001, n + .06); s.connect(h); h.connect(g); g.connect(c.destination); s.start(n);
  rumble(c, n, .07, .22);
};
const paper = (c, n, v, f, d) => {                     // papier feutré : bruit filtré en bande, attaque douce
  const s = noise(c, d), b = c.createBiquadFilter(), g = c.createGain(); b.type = "bandpass"; b.Q.value = .9;
  b.frequency.setValueAtTime(f, n); b.frequency.exponentialRampToValueAtTime(f * 1.8, n + d);
  g.gain.setValueAtTime(.0001, n); g.gain.exponentialRampToValueAtTime(v, n + d * .25); g.gain.exponentialRampToValueAtTime(.0001, n + d);
  s.connect(b); b.connect(g); g.connect(c.destination); s.start(n);
};
const bell = (c, n, f, v, d) => [1, 2.76, 4.07].forEach((m, i) => {   // carillon de cristal : partiels inharmoniques
  const o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.value = f * m;
  g.gain.setValueAtTime(v / (i + 1), n); g.gain.exponentialRampToValueAtTime(.0005, n + d / (i + 1)); o.connect(g); g.connect(c.destination); o.start(n); o.stop(n + d);
});
const choir = (c, n, fs, v, d, lp) => fs.forEach(f => [-6, 6].forEach(dt => {   // chœur harmonique : voix désaccordées, nappe lente
  const o = c.createOscillator(), l = c.createBiquadFilter(), g = c.createGain(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = dt; l.type = "lowpass"; l.frequency.value = lp;
  g.gain.setValueAtTime(.0001, n); g.gain.linearRampToValueAtTime(v, n + d * .3); g.gain.exponentialRampToValueAtTime(.0005, n + d);
  o.connect(l); l.connect(g); g.connect(c.destination); o.start(n); o.stop(n + d);
}));
const sfx = (t, m = 1) => { if (!SOUND) return; try {
  ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  const T0 = ac.currentTime;
  if (t === "zap") return zap(ac, T0); if (t === "rumble") return rumble(ac, T0, .12, .6);
  if (t === "paper") return paper(ac, T0, .05, 2200, .09);
  if (t === "turn") { paper(ac, T0, .09, 900, .5); return bell(ac, T0 + .25, 1568, .05, 1.2); }
  if (t === "chime") return bell(ac, T0, 1318 * m, .05, .9);
  if (t === "gold") { choir(ac, T0, [261.6, 392, 523.3, 659.3, 784], .03, 2.2, 2400); return bell(ac, T0 + .1, 2093, .06, 1.6); }
  if (t === "red") { choir(ac, T0, [98, 116.5, 146.8, 196], .045, 2.4, 700); return rumble(ac, T0, .08, 1.4); }
  const [f, ty, d, v] = { chime: [1320, "sine", .25, .05], gold: [1760, "triangle", .9, .08], red: [220, "triangle", .6, .08], deny: [110, "square", .12, .04] }[t];
  const o = ac.createOscillator(), g = ac.createGain(), n = ac.currentTime;
  o.type = ty; o.frequency.setValueAtTime(f, n); if (t === "zap") o.frequency.exponentialRampToValueAtTime(f / 4, n + d);
  g.gain.setValueAtTime(v, n); g.gain.exponentialRampToValueAtTime(.001, n + d);
  o.connect(g); g.connect(ac.destination); o.start(n); o.stop(n + d);
} catch (e) {} };

const toast = m => { const t = $("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 3500); };
const ptIn = (e, p) => {                               // point d'un clic dans le panneau p ; au clavier (Espace/Entrée : pas de coordonnées) → centre de l'élément activé
  const r = p.getBoundingClientRect();
  if (e.detail === 0 || (!e.clientX && !e.clientY)) { const t = e.currentTarget && e.currentTarget.getBoundingClientRect ? e.currentTarget.getBoundingClientRect() : r; return { x: t.left + t.width / 2 - r.left, y: t.top + t.height / 2 - r.top }; }
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};
const fl = (e, txt, col) => {
  const p = e.currentTarget.closest(".pane"), q = ptIn(e, p), s = document.createElement("span");
  s.className = "fl"; s.textContent = txt; s.style.cssText = "left:" + q.x + "px;top:" + q.y + "px;color:" + col;
  p.append(s); setTimeout(() => s.remove(), 900);
};

let nx = Math.random();                                // tirage de la prochaine page (Augure l'affiche)
const kk = c => Math.min(10, c.rare * M("rare", 1)), typ = (r, c) => { const k = kk(c); return r < PG.gold.p * k ? "gold" : r < (PG.gold.p + PG.red.p) * k ? "red" : null; };
const px = k => k === "red" ? M("redX", 4) : PG[k].x;
const pageX = () => S.g && S.g.t !== "norm" ? px(S.g.t) : 1;       // ×Sagesse tant que la page spéciale est en lecture

// Pages = paliers de lecture : la Sagesse gagnée remplit la jauge ; page pleine → page suivante tirée (normale/spéciale).
// Pool = 3 + (flux Sg + 3 clics/s) × T, T = 2 s (début) → 12 s (≈ page 25). Page spéciale : pool × multiplicateur × durée.
function nextPage(user) {
  const c = Passives.calc(), G = S.g, r = nx; nx = Math.random();
  const t = Spells.force() ? (r < .2 ? "gold" : "red") : typ(r, c);
  const T = Math.min(12, 2 + .4 * G.n), farm = c.sgPS + 3 * c.pageClick;
  let need = 3 + farm * T; if (t) need *= px(t) * (1 + M("buffDur", 0) / 20);
  G.t = t || "norm"; G.need = need; G.got = 0;
  if (t && user) sfx(t);                               // son UNIQUEMENT si le joueur est à l'origine
}
function gainSg(a, user) {
  S.sg += a; const G = S.g; G.got += a; let k = 0;
  while (G.got >= G.need && k++ < 50) { const left = G.got - G.need; G.n++; nextPage(user); G.got = left; }
  if (k >= 50) G.got = 0; if (k) turnPage(user);
}

// ---- Voile d'Éther : filet SVG suspendu · ondes élastiques au clic (ripple) · curseur Orbe de Focalisation ----
const VC = 15, VR = 10, VP = [], RP = [], NS = "http://www.w3.org/2000/svg";
const RM = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
function pos(p, t) {                                   // position d'un nœud : affaissement + balancement + ondes
  const w = p.j / (VR - 1); let x = p.x, y = p.y + 18 * w * (1 - ((p.x - 160) / 146) ** 2);
  if (!RM) { x += Math.sin(t * .0007 + p.j * .6) * 2.2 * w; y += Math.sin(t * .0009 + p.i * .5) * 1.6 * w; }
  for (const r of RP) {
    const dx = x - r.x, dy = y - r.y, d = Math.hypot(dx, dy) || 1, a = (t - r.t) / 1e3;
    const k = Math.sin(d * .09 - a * 9) * Math.exp(-a * 1.8) * Math.exp(-d / 90) * r.s * (RM ? .3 : 1) * 16 * (.35 + .65 * w);
    x += dx / d * k; y += dy / d * k;
  }
  return [x, y];
}
function ripple(e, s = 1) {                            // impact en coordonnées du viewBox 320×240 (global : réutilisable par les sorts)
  const r = $("veilSvg").getBoundingClientRect(), sc = Math.min(r.width / 320, r.height / 240), ok = e && e.clientX;
  RP.push({ x: ok ? (e.clientX - r.left - (r.width - 320 * sc) / 2) / sc : 160, y: ok ? (e.clientY - r.top - (r.height - 240 * sc) / 2) / sc : 120, t: performance.now(), s });
  if (RP.length > 8) RP.shift();
}
function initVeil() {
  const net = $("vNet"), kn = $("vKnots"), st = $("vStars"), mk = (par, tag) => { const e = document.createElementNS(NS, tag); par.append(e); return e; };
  for (let k = 0; k < 44; k++) { const c = mk(st, "circle"); c.setAttribute("cx", Math.random() * 320); c.setAttribute("cy", Math.random() * 240); c.setAttribute("r", .4 + Math.random() * .8); c.setAttribute("class", "vs"); c.style.animationDelay = -Math.random() * 3 + "s"; }
  for (let j = 0; j < VR; j++) for (let i = 0; i < VC; i++) VP.push({ i, j, x: 14 + i * 292 / (VC - 1), y: 22 + j * 188 / (VR - 1) });
  const H = Array.from({ length: VR }, () => mk(net, "path")), V = Array.from({ length: VC }, () => mk(net, "path"));
  const K = VP.filter(p => p.i % 2 === 0 && p.j % 2 === 0 && p.j > 0).map(p => { const c = mk(kn, "circle"); c.setAttribute("r", 1.8); return [p, c]; });
  const f1 = n => n.toFixed(1), sm = a => { let d = "M" + f1(a[0][0]) + " " + f1(a[0][1]); for (let k = 1; k < a.length - 1; k++) d += "Q" + f1(a[k][0]) + " " + f1(a[k][1]) + " " + f1((a[k][0] + a[k + 1][0]) / 2) + " " + f1((a[k][1] + a[k + 1][1]) / 2); const z = a[a.length - 1]; return d + "L" + f1(z[0]) + " " + f1(z[1]); };
  const frame = t => {
    requestAnimationFrame(frame); if (document.hidden) return;
    while (RP.length && t - RP[0].t > 3500) RP.shift();
    const w = VP.map(p => pos(p, t));
    H.forEach((e, j) => e.setAttribute("d", sm(w.slice(j * VC, j * VC + VC))));
    V.forEach((e, i) => e.setAttribute("d", sm(Array.from({ length: VR }, (_, j) => w[j * VC + i]))));
    K.forEach(([p, c]) => { const q = w[p.j * VC + p.i]; c.setAttribute("cx", f1(q[0])); c.setAttribute("cy", f1(q[1])); });
  };
  requestAnimationFrame(frame);
}
function initCursor() {                                // l'Orbe suit la souris ; au tactile il apparaît au tap
  const oc = $("orbCur"), vl = $("orb"), mv = e => { oc.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px)"; oc.classList.add("on"); };
  document.body.append(oc); vl.addEventListener("pointermove", mv); vl.addEventListener("pointerleave", () => oc.classList.remove("on"));
  vl.addEventListener("pointerdown", e => { mv(e); if (e.pointerType === "touch") setTimeout(() => oc.classList.remove("on"), 350); });
}

function clickV(e) {
  const n = Date.now(); if (n < hot) { sfx("deny"); ripple(e, .25); return; }      // voile rigide pendant la surchauffe
  heat += 10; const over = heat >= 100; if (over) { hotMs = M("cps", CPS_PALIERS[0]) * 1000; hot = n + hotMs; }   // surchauffe : pause = limite en secondes (5 cps → 5 s · 10 → 10 s · 15 → 15 s)
  const m = Spells.onClick(), g = Passives.calc().clickV * M("click", 1) * m; S.eth += g;
  sfx(over ? "rumble" : "zap"); ripple(e, over ? 1.8 : m > 1 ? 1.5 : 1); fl(e, "+" + fE(g), "#a78bfa");
  if (m > 1) critFx(e, "ill", "CRITIQUE ×" + m);        // Image Miroir : glyphe d'Illusion
}
// ---- Grimoire : double page · glyphes révélés par la jauge · page 3D · runes envolées · pages Nécrotique/Dorée · curseur Plume ----
const GL = [], PTS = [[1, 3], [9, 3], [1, 8], [9, 8], [1, 13], [9, 13], [5, 1], [5, 15]];
let turning = 0, clkPt = null, lastN = -1;
const runeD = () => { let d = "M5 1V15"; for (let k = 0, n = 2 + (Math.random() * 2 | 0); k < n; k++) { const a = PTS[Math.random() * 8 | 0], b = PTS[Math.random() * 8 | 0]; if (a !== b) d += "M" + a + "L" + b; } return d; };
const paneXY = e => { const p = e.currentTarget.closest(".pane"), q = ptIn(e, p); return { p, x: q.x, y: q.y }; };
function buildGlyphs() {                               // 2 pages × 7 lignes × 5 pseudo-runes, nouvelle page = nouvelles runes
  GL.length = 0;
  ["gL", "gR"].forEach(id => {
    const g = $(id); g.innerHTML = "<circle cx='50' cy='13' r='6' class='sg'/><path d='M44 13h12M50 7v12' class='sg'/>";
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
      const p = document.createElementNS(NS, "path"); p.setAttribute("d", runeD()); p.setAttribute("class", "gl");
      p.setAttribute("transform", "translate(" + (12 + c * 17) + "," + (28 + r * 17) + ") scale(.85)"); g.append(p); GL.push(p);
    }
  });
}
const reveal = p => { const n = Math.floor(p * GL.length); if (n === lastN) return; lastN = n; GL.forEach((g, i) => g.classList.toggle("on", i < n)); };
function flyRunes(pt, c0) {
  const col = c0 || (S.g.t === "red" ? "#fb7185" : "#f5d98a");
  for (let i = 0; i < 9; i++) {
    const s = document.createElement("span"); s.className = "fr"; s.innerHTML = "<svg viewBox='0 0 10 16' width='12' height='19'><path d='" + runeD() + "'/></svg>";
    s.style.cssText = "left:" + pt.x + "px;top:" + pt.y + "px;color:" + col + ";--dx:" + (Math.random() - .5) * 150 + "px;--dy:" + (-40 - Math.random() * 90) + "px;--r:" + (Math.random() - .5) * 200 + "deg";
    pt.p.append(s); setTimeout(() => s.remove(), 1200);
  }
}
function turnPage(user) {                              // page lue : feuillet 3D + nouvelles runes ; son/runes seulement si le joueur est à l'origine
  const lf = $("leaf"); setTimeout(() => { buildGlyphs(); lastN = -1; }, 420);
  if (!turning) { turning = 1; lf.classList.add("turn"); setTimeout(() => { lf.classList.remove("turn"); turning = 0; }, 900); }
  if (user) { sfx("turn"); flyRunes(clkPt || { p: document.querySelector(".grimoire"), x: 160, y: 150 }); }
}
function initBook() {
  buildGlyphs(); const bk = $("tome"), qc = $("quillCur"); document.body.append(qc);
  for (let i = 0; i < 14; i++) { const p = document.createElement("i"); p.className = "gp"; p.style.cssText = "left:" + (12 + Math.random() * 76) + "%;animation-delay:" + -Math.random() * 3 + "s;--gx:" + (Math.random() - .5) * 40 + "px"; bk.append(p); }
  const mv = e => { qc.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px)"; qc.classList.add("on"); };
  bk.addEventListener("pointermove", mv); bk.addEventListener("pointerleave", () => qc.classList.remove("on"));
  bk.addEventListener("pointerdown", e => { mv(e); if (e.pointerType === "touch") setTimeout(() => qc.classList.remove("on"), 350); });
}

// ---- UI-C : habillage visuel par école de magie (registre : Spells.glyph / Spells.hue) ----
// schoolFx(k, pane, sort) : glyphe d'école + teinte + effet signature (Voile : ondes ; Grimoire : runes) · critFx(e, k, txt) : coup critique.
function schoolFx(k, p, s) {
  const pane = document.querySelector(p === "V" ? ".voile" : ".grimoire"), el = document.createElement("div"), c = Spells.hue(k);
  el.className = "sfx"; el.style.setProperty("--c", c);
  let h = "<i class='sfx-t'></i><b class='sfx-g fx-" + k + "'>" + Spells.glyph(k, 96) + "</b>";
  if (k === "evo") {                                   // Évocation : éclair zigzaguant
    let d = "", x = 20 + Math.random() * 60; for (let i = 0; i <= 8; i++) d += (i ? "L" : "M") + (x + (Math.random() - .5) * 18).toFixed(1) + " " + i * 12.5;
    h += "<svg class='bolt' viewBox='0 0 100 100' preserveAspectRatio='none'><path d='" + d + "'/></svg>";
  }
  el.innerHTML = h; pane.append(el); setTimeout(() => el.remove(), 1000);
  if (p === "V") { const r = $("veilSvg").getBoundingClientRect(); [0, 90, 180].forEach(t => setTimeout(() => ripple({ clientX: r.left + r.width * (.2 + Math.random() * .6), clientY: r.top + r.height * (.3 + Math.random() * .5) }, k === "evo" ? 1.6 : 1.1), t)); }
  else flyRunes({ p: pane, x: pane.clientWidth / 2, y: 150 }, c);
}
function critFx(e, k, txt) {
  const pt = paneXY(e), el = document.createElement("div");
  el.className = "crit"; el.style.cssText = "left:" + pt.x + "px;top:" + pt.y + "px;color:" + Spells.hue(k);
  el.innerHTML = Spells.glyph(k, 54) + "<b>" + txt + "</b>"; pt.p.append(el); setTimeout(() => el.remove(), 900);
}

let heatG = 0, hotG = 0, hotGMs = 10000, lastDenyG = 0;
function clickG(e) {
  const nG = Date.now();
  if (nG < hotG) { if (nG - lastDenyG > 500) { lastDenyG = nG; sfx("deny"); } return; }       // Grimoire verrouillé pendant le chaos
  heatG += 10;
  if (heatG >= 100) { hotGMs = CPS_GRIMOIRE * 1000; hotG = nG + hotGMs; startChaos(); }       // trop de clics/s : chaos (pause = limite en secondes)
  const c = Passives.calc(), pt = S.g.t, g = c.pageClick * pageX() * M("sg", 1);
  Spells.touch(); clkPt = paneXY(e); gainSg(g, true); sfx("paper"); fl(e, "+" + fN(g) + " Sg", pt === "gold" ? "#d4af37" : pt === "red" ? "#e11d48" : "#f5d98a");
}

// ---- Chaos du Grimoire (anti-autoclic) : le livre noircit, des tentacules sortent des bords ; SVG recalculé à chaque image PENDANT la pause seulement ----
const TENT = [];
function initTent() {
  const g = $("tentG"); if (!g) return;
  // [x, y (repère 400×300), angle de départ (rad), longueur, épaisseur à la base, courbure, vitesse, phase]
  [[46, 172, 3.5, 125, 12, -1.1, 1.3, 0], [58, 74, -2.5, 135, 12, 1.0, 1.1, 1.7], [205, 46, -1.62, 120, 11, .8, 1.5, 3.1], [318, 60, -.75, 140, 12, -.9, 1.2, 4.4], [356, 158, -.12, 125, 12, 1.1, 1.4, 2.2],
   [334, 264, .85, 130, 12, -1.0, 1.0, 5.3], [78, 264, 2.3, 128, 11, 1.1, 1.25, .9], [170, 258, -1.95, 80, 8, 2.6, 1.8, 3.9], [236, 256, -1.2, 84, 8, -2.5, 1.6, .4]].forEach(([x, y, a, L, w, cu, sp, ph]) => {
    const el = document.createElementNS(NS, "g"), p = document.createElementNS(NS, "path"), b = document.createElementNS(NS, "ellipse"), sk = [];
    b.setAttribute("class", "tb"); b.setAttribute("opacity", 0); b.setAttribute("cx", x); b.setAttribute("cy", y); b.setAttribute("rx", w * 1.35); b.setAttribute("ry", w * .85); b.setAttribute("transform", "rotate(" + (a * 180 / Math.PI + 90).toFixed(0) + " " + x + " " + y + ")"); el.append(b);   // racine : fissure sombre sur le bord du livre
    p.setAttribute("class", "tn"); el.append(p);
    for (let i = 0; i < 7; i++) { const c = document.createElementNS(NS, "circle"); c.setAttribute("class", "ts"); el.append(c); sk.push(c); }
    const tip = document.createElementNS(NS, "circle"); tip.setAttribute("class", "tt"); el.append(tip); g.append(el); TENT.push({ x, y, a, L, w, cu, sp, ph, p, b, sk, tip });
  });
}
let tentRaf = 0, lastCor = -1;
const easeO = t => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;
function tentFrame() {
  const n = Date.now(), age = (n - (hotG - hotGMs)) / 1e3, left = (hotG - n) / 1e3, t = performance.now() / 1e3, f1 = v => v.toFixed(1);
  const gr = n >= hotG ? 0 : Math.min(easeO(age / .9), easeO(left / .8));                  // pousse en 0,9 s, se rétracte les 0,8 dernières secondes
  TENT.forEach(T => {
    T.b.setAttribute("opacity", gr > 0 ? 1 : 0);
    if (gr <= 0) { T.p.setAttribute("d", ""); T.sk.forEach(c => c.setAttribute("r", 0)); T.tip.setAttribute("r", 0); return; }
    const N = 26, ds = T.L * gr / N, pts = []; let x = T.x, y = T.y;
    for (let i = 0; i <= N; i++) { pts.push([x, y]); const u = i / N, th = T.a + T.cu * u * 1.3 + (RM ? 0 : Math.sin(t * T.sp * 2.2 - i * .38 + T.ph) * .55 * u); x += Math.cos(th) * ds; y += Math.sin(th) * ds; }
    const Lp = [], Rp = [];
    pts.forEach((p, i) => {
      const q = pts[Math.min(N, i + 1)], r = pts[Math.max(0, i - 1)], dx = q[0] - r[0], dy = q[1] - r[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, w = T.w * (1 - i / N) ** .8 * Math.min(1, gr * 1.4) + .7;
      Lp.push(f1(p[0] + nx * w) + " " + f1(p[1] + ny * w)); Rp.push(f1(p[0] - nx * w) + " " + f1(p[1] - ny * w));
    });
    T.p.setAttribute("d", "M" + Lp.join("L") + "L" + Rp.reverse().join("L") + "Z");
    T.sk.forEach((c, k) => { const i = 4 + k * 3, p = pts[i]; c.setAttribute("cx", f1(p[0])); c.setAttribute("cy", f1(p[1])); c.setAttribute("r", f1(Math.max(.5, T.w * (1 - i / N) ** .8 * .3))); });
    const e = pts[N]; T.tip.setAttribute("cx", f1(e[0])); T.tip.setAttribute("cy", f1(e[1])); T.tip.setAttribute("r", f1(1.2 + gr * (RM ? .6 : .6 + .6 * Math.sin(t * 9 + T.ph))));
  });
  tentRaf = (n < hotG || gr > 0) ? requestAnimationFrame(tentFrame) : 0;
}
function startChaos() {
  $("tome").classList.add("chaos"); document.querySelector(".grimoire").classList.add("chaos"); sfx("red");
  cancelAnimationFrame(tentRaf); tentRaf = requestAnimationFrame(tentFrame);
}
function endChaos() { $("tome").classList.remove("chaos"); document.querySelector(".grimoire").classList.remove("chaos"); }

function away(sec) {                                   // hors-ligne : timestamps, plafond 8 h (extensible via sorts)
  sec = Math.min(sec, M("offlineCap", 8) * 3600);
  const c = Passives.calc(), e = c.ethPS * sec, s = c.sgPS * sec * M("offlineSg", 1);
  S.eth += e; S.sg += s;
  const nf = microAdd(fragRate(c.ethPS) * sec * M("fragOff", 1)); if (nf) save();   // micro-fragments hors-ligne (plafond passif/jour inclus)
  if (e + s > 0) toast("Absence : +" + fE(e) + " · +" + fN(s) + " Sg" + (nf ? " · +" + nf + " fragment(s)" : ""));
}

function tick() {
  const n = Date.now(), dt = (n - last) / 1e3; last = n;
  if (dt > 5) { away(dt); return; }                    // onglet endormi
  const c = Passives.calc(); S.eth += c.ethPS * dt;
  if (c.sgPS > 0) gainSg(c.sgPS * dt * pageX(), false);             // lecture automatique : silencieuse
  fragTick(dt, c);
  if (n < hotG) heatG = (hotG - n) / hotGMs * 100; else { if (hotG) { hotG = 0; heatG = 0; endChaos(); } heatG = Math.max(0, heatG - CPS_GRIMOIRE * 10 * dt); }
  const ccr = Math.round((n < hotG ? 1 : Math.max(0, (heatG - 35) / 65)) * 20) / 20; if (ccr !== lastCor) { lastCor = ccr; $("tome").style.setProperty("--cor", ccr); }   // encre d'avertissement
  if (n < hot) heat = (hot - n) / hotMs * 100; else { if (hot) { hot = 0; heat = 0; } heat = Math.max(0, heat - M("cps", CPS_PALIERS[0]) * 10 * dt); }

  $("eth").textContent = fE(S.eth); $("sg").textContent = fN(S.sg);
  $("ethps").textContent = "+" + fE(c.ethPS) + "/s"; $("sgps").textContent = "+" + fN(c.sgPS) + " Sg/s";
  $("heat").style.width = Math.min(100, heat) + "%"; $("heatBox").classList.toggle("hot", n < hot); $("orb").classList.toggle("hot", n < hot); document.body.classList.toggle("hot", n < hot);
  $("heatTxt").textContent = n < hot ? "Surchauffe — canalisation en pause " + Math.ceil((hot - n) / 1e3) + " s" : "Canalisation stable"; $("heatTxt").classList.toggle("red", n < hot);
  $("heatLim").textContent = "Limite : " + M("cps", CPS_PALIERS[0]) + " clics/s avant surchauffe";
  const G = S.g, pt = G.t;
  $("buff").textContent = "Page " + (G.n + 1) + (pt === "norm" ? "" : " · " + PG[pt].n + " ×" + px(pt));
  $("buff").className = "buff" + (pt === "norm" ? "" : " " + pt);
  if (n < hotG) { $("buff").textContent = "Le Grimoire se débat — " + Math.ceil((hotG - n) / 1e3) + " s"; $("buff").className = "buff red"; }
  else if (heatG >= 70) { $("buff").textContent = "Encre instable…"; $("buff").className = "buff red"; }
  $("pgFill").style.width = Math.min(100, G.got / G.need * 100) + "%"; $("pgbar").className = "pgbar " + pt;
  $("pgTxt").textContent = fN(G.got) + " / " + fN(G.need) + " Runes décryptées";
  const tm = $("tome"); tm.classList.toggle("red", pt === "red"); tm.classList.toggle("gold", pt === "gold"); reveal(Math.min(1, G.got / G.need));
  Spells.tick(dt, n);
  $("hintG").textContent = Spells.has("div1") ? "Augure : prochaine page " + ({ gold: "Dorée", red: "Nécrotique" }[Spells.forced() ? (nx < .2 ? "gold" : "red") : typ(nx, c)] || "commune") : "";
  Passives.update();
}

addEventListener("DOMContentLoaded", () => {
  const e = (Date.now() - S.seen) / 1e3; if (e > 10) away(e);
  Passives.build($("bV"), "V"); Passives.build($("bG"), "G"); Spells.init();
  S.g = S.g || { n: 0, t: "norm", need: 0, got: 0 }; if (!(S.g.need > 0)) nextPage(false);
  $("orb").onclick = clickV; $("tome").onclick = clickG; initVeil(); initCursor(); initBook(); initKey(); initStars(); initTent();
  const snd = $("snd"), updSnd = () => { snd.classList.toggle("off", !SOUND); snd.title = "Sons : " + (SOUND ? "activés" : "coupés"); snd.setAttribute("aria-pressed", String(SOUND)); };
  updSnd(); snd.onclick = () => { const p = readPrefs(); p.sound = !SOUND; try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch (e) {} SOUND = p.sound; updSnd(); if (SOUND) sfx("chime"); };
  addEventListener("storage", ev => { if (ev.key === PREFS_KEY) { SOUND = readPrefs().sound !== false; updSnd(); } });
  // Fenêtre d'accueil : s'affiche tant que « Ne plus afficher » n'est pas coché (S.introSeen, synchronisé avec le compte) ; bouton « ? » pour la relire
  const showIntro = () => { $("introNo").checked = !!S.introSeen; $("intro").hidden = false; $("introGo").focus(); };
  const closeIntro = () => { S.introSeen = $("introNo").checked; save(); cloudSave(true); $("intro").hidden = true; };
  $("introGo").onclick = closeIntro; $("help").onclick = showIntro; addEventListener("keydown", ev => { if (ev.key === "Escape" && !$("intro").hidden) closeIntro(); });
  if (!S.introSeen) setTimeout(showIntro, 500);
  setInterval(tick, 100); setInterval(save, 5000); setInterval(() => !document.hidden && cloudSave(), 6e4);
  if (window.auth && window.onAuthStateChanged) window.onAuthStateChanged(window.auth, u => u && cloudLoad(u));
  addEventListener("pagehide", () => { save(); cloudSave(true); }); document.addEventListener("visibilitychange", () => { if (document.hidden) { save(); cloudSave(true); } });
  window.Clicker = { state: () => S, calc: Passives.calc, save, fE, fN };   // API pour spells / cloud (étapes suivantes)
});
