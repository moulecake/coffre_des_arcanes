// ============================================================
// DEMO DATA — Remplacez par votre fichier data.js
// ============================================================


// ============================================================
// VERSIONING — Changer CURRENT_VERSION (avec CACHE_NAME de sw.js) offre MAX_KEYS clés une seule fois à chaque joueur.
// Aucun reset d'inventaire, jamais (comptes Google/Firebase en production).
// ============================================================
// Adresse propre : on masque « index.html » dans la barre d'adresse (affichage seulement).
if (/index\.html$/.test(location.pathname)) history.replaceState(null, "", location.pathname.replace(/index\.html$/, "") + location.search + location.hash);
const CURRENT_VERSION = "2.2.0";
document.getElementById("app-version").textContent = CURRENT_VERSION;

// DROP RATES — C:40 | PC:25 | R:20 | TR:8 | L:5 | A:2
const DROP_RATES = { C:40, PC:25, R:20, TR:8, L:5, A:2 };
// Ordre de fallback si pool vide (du plus rare vers le plus commun)
const RARITY_FALLBACK = ['A','L','TR','R','PC','C'];

const MAX_KEYS = 3;
const REGEN_MS = 4 * 60 * 60 * 1000;
const FRAGS_PER_KEY = 5;
const LSKEY = 'arcane-vault';


// ============================================================
// PRÉFÉRENCES (appareil) — partagées avec le Clicker : clé localStorage « coffre-prefs »
// ============================================================
const PREFS_KEY = 'coffre-prefs';
function getPrefs(){ try{ return Object.assign({sound:true, vibe:true}, JSON.parse(localStorage.getItem(PREFS_KEY)||'{}')); }catch(e){ return {sound:true, vibe:true}; } }
function setPref(k, v){ const p=getPrefs(); p[k]=!!v; try{ localStorage.setItem(PREFS_KEY, JSON.stringify(p)); }catch(e){} }
const soundOn = () => getPrefs().sound !== false;
function openOptionsModal(){
  const p=getPrefs(); document.getElementById('opt-sound').checked=p.sound!==false; document.getElementById('opt-vibe').checked=p.vibe!==false;
  document.getElementById('opt-push').checked=p.push!==false && ('Notification' in window) && Notification.permission==='granted';
  document.getElementById('options-modal').style.display='flex';
}
function closeOptionsModal(){ document.getElementById('options-modal').style.display='none'; }

// ============================================================
// WEB AUDIO API
// ============================================================
let audioCtx = null;
function getAudioCtx(){ if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); return audioCtx; }

let shakeInterval = null;
function playClickSound(){
  if(!soundOn()) return;
  // Tension croissante : clics de plus en plus rapides
  try{
    const ctx = getAudioCtx();
    let t = ctx.currentTime;
    let interval = 0.22;
    for(let i=0;i<8;i++){
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type='square'; o.frequency.value=120+i*15;
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.08,t+0.01); g.gain.linearRampToValueAtTime(0,t+0.05);
      o.start(t); o.stop(t+0.06);
      t += interval;
      interval = Math.max(0.06, interval*0.78);
    }
  }catch(e){}
}

function playImpactSound(){
  if(!soundOn()) return;
  try{
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    // Sub-bass thump
    const o=ctx.createOscillator(), g=ctx.createGain();
    const dist=ctx.createWaveShaper();
    const curve=new Float32Array(256);
    for(let i=0;i<256;i++){ const x=i*2/256-1; curve[i]=x*(Math.PI+400)/(Math.PI+400*Math.abs(x)); }
    dist.curve=curve;
    o.connect(dist); dist.connect(g); g.connect(ctx.destination);
    o.type='sine'; o.frequency.setValueAtTime(80,t); o.frequency.exponentialRampToValueAtTime(20,t+0.4);
    g.gain.setValueAtTime(0.9,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.4);
    o.start(t); o.stop(t+0.5);
    // Crack noise
    const buf=ctx.createBuffer(1,ctx.sampleRate*0.1,ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1);
    const src=ctx.createBufferSource(), gn=ctx.createGain();
    src.buffer=buf; gn.gain.setValueAtTime(0.4,t); gn.gain.exponentialRampToValueAtTime(0.001,t+0.08);
    src.connect(gn); gn.connect(ctx.destination);
    src.start(t);
  }catch(e){}
}

function playRevealSound(rarity){
  if(!soundOn()) return;
  try{
    const ctx = getAudioCtx();
    let t = ctx.currentTime + 0.05;
    const isHighTier = rarity==='L'||rarity==='A';
    // Arpège ascendant, plus complexe pour L/A
    const scales = {
      C:[261,330,392], PC:[261,330,392,523], R:[293,370,440,587],
      TR:[311,415,523,622,830], L:[329,415,523,659,830,1046,1319], A:[277,370,466,587,740,932,1175,1480]
    };
    const notes = scales[rarity]||scales['C'];
    notes.forEach((freq,i)=>{
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = isHighTier ? 'sine' : 'triangle';
      o.frequency.value=freq;
      const delay = i*0.08*(isHighTier?0.9:1);
      g.gain.setValueAtTime(0,t+delay);
      g.gain.linearRampToValueAtTime(isHighTier?0.18:0.12,t+delay+0.02);
      g.gain.exponentialRampToValueAtTime(0.001,t+delay+(isHighTier?0.8:0.5));
      o.start(t+delay); o.stop(t+delay+(isHighTier?0.9:0.6));
    });
    // Pour A: harmonie supplémentaire
    if(rarity==='A'){
      setTimeout(()=>{
        try{
          const ctx2=getAudioCtx(), t2=ctx2.currentTime+0.1;
          [277,554,1108].forEach((f,i)=>{
            const o=ctx2.createOscillator(),g=ctx2.createGain();
            o.connect(g);g.connect(ctx2.destination);
            o.type='sine';o.frequency.value=f;
            g.gain.setValueAtTime(0,t2+i*0.1);
            g.gain.linearRampToValueAtTime(0.1,t2+i*0.1+0.03);
            g.gain.exponentialRampToValueAtTime(0.001,t2+i*0.1+1.2);
            o.start(t2+i*0.1);o.stop(t2+i*0.1+1.3);
          });
        }catch(e){}
      },400);
    }
  }catch(e){}
}

// ============================================================
// STATE
// ============================================================
let state = {
  version: CURRENT_VERSION,
  keys: MAX_KEYS,
  lastRegen: Date.now(),
  inventory: {},
  chestsOpened: 0,       // compteur de coffres ouverts (depuis v2.a2.10) — enregistré dans le Firestore avec le reste de `state`
  fragments: 0,
  forceLegendary: false,
  mjActive: false,
 pseudo: ''           // ← AJOUT
};

// ============================================================
// INVENTAIRE COMPACT (stockage localStorage + Firestore)
// En mémoire, l'inventaire garde les clés « Nom|lien|Type|Rareté » (tout le code existant reste inchangé).
// À l'enregistrement, chaque clé est remplacée par un identifiant court = paramètre « vf= » du lien (ex. amulette-de-cicatrisation).
// À la lecture, identifiants ET anciennes clés longues sont acceptés → migration automatique, sans perte.
// Sécurités : un identifiant absent ou en double dans data.js n'est PAS compacté (clé longue conservée) ; si data.js n'est pas chargé, rien n'est converti.
// ============================================================
const LOOT_ID = {}, LOOT_BY_ID = {};
const slugOfLine = l => { try { return new URL(l.split('|')[1]).searchParams.get('vf') || ''; } catch (e) { return ''; } };
(function buildLootIds(){
  if (typeof loots === 'undefined' || !loots.length) return;
  const count = {}; loots.forEach(l => { const id = slugOfLine(l); if (id) count[id] = (count[id] || 0) + 1; });
  loots.forEach(l => { const id = slugOfLine(l); if (id && count[id] === 1 && /^[a-z0-9-]+$/i.test(id)) { LOOT_ID[l] = id; LOOT_BY_ID[id] = l; } });
})();
function packInventory(inv) {
  const out = {}, ok = Object.keys(LOOT_BY_ID).length > 0;
  for (const k in (inv || {})) {
    const c = inv[k]; if (!(c > 0)) continue;
    const ph = k.match(/^([a-z0-9-]+)\|#\|Objet inconnu\|C$/i);                     // repère créé quand data.js ne connaissait pas l'identifiant : on remet l'identifiant d'origine
    const key = ph ? ph[1] : ((ok && LOOT_ID[k]) || k); out[key] = Math.max(out[key] || 0, c);
  }
  return out;
}
// ⚠ TEMPORAIRE — À SUPPRIMER APRÈS LE 2026-11-24 (rappel : MEMOIRE.md « RAPPELS » + mémoire Claude).
// Correctif « raretés » : data.js a été corrigé (les « peu commun » étaient tagués |C, ils sont maintenant |PC). Les inventaires déjà enregistrés
// contiennent encore l'ancienne ligne (…|C). Toute clé longue NON canonique dont l'identifiant `vf=` correspond à un objet actuel de data.js
// est donc RAMENÉE sur la ligne actuelle (…|PC) et ses quantités sont AJOUTÉES (jamais écrasées, jamais perdues). L'ancienne clé disparaît ensuite
// à l'enregistrement suivant (le champ `state` est remplacé en entier). Pour désactiver : passer TEMP_RARITY_FIX à false puis supprimer ce bloc.
const TEMP_RARITY_FIX = true;
function unpackInventory(inv) {
  const out = {}, legacy = [], ok = Object.keys(LOOT_BY_ID).length > 0;
  for (const k in (inv || {})) {
    const c = inv[k]; if (!(c > 0)) continue;
    if (!k.includes('|')) {                              // identifiant court → ligne actuelle de data.js (ou repère si l'objet a disparu)
      const full = (ok && LOOT_BY_ID[k]) || (k + '|#|Objet inconnu|C');
      out[full] = Math.max(out[full] || 0, c); continue;   // doublon id / clé longue identique : on garde le max
    }
    if (TEMP_RARITY_FIX && ok && !LOOT_ID[k]) {          // clé longue qui n'est plus une ligne actuelle de data.js
      const canon = LOOT_BY_ID[slugOfLine(k)];
      if (canon && canon !== k) { legacy.push([canon, c, k]); continue; }
    }
    out[k] = Math.max(out[k] || 0, c);
  }
  legacy.forEach(([canon, c]) => { out[canon] = (out[canon] || 0) + c; });
  if (legacy.length) console.info('[Correctif raretés] ' + legacy.length + ' objet(s) ré-étiqueté(s) vers la ligne actuelle de data.js');
  return out;
}
// ============================================================
// SYNCHRONISATION SÛRE (v2.a2.15) — règle d'or : un objet d'inventaire ne doit JAMAIS disparaître.
//  • Révision `rev` + transaction : on n'écrase jamais un cloud modifié ailleurs ; en cas de conflit, FUSION À 3 VOIES (base = dernière synchro de CET appareil) :
//    cloud + (ce que cet appareil a changé) → les gains hors-ligne et ceux d'un autre appareil s'additionnent, les recyclages aussi.
//  • Garde-fou : le résultat contient toujours AU MOINS tous les objets uniques du cloud ET du local (un objet n'est jamais retiré, seul son compteur varie).
//  • `state.uid` : l'état local d'un AUTRE compte est ignoré (jamais mélangé) ; copie de sécurité locale avant.
//  • Sauvegardes de secours dans le document du joueur (`backups.preMigration`, `.daily`, `.conflict`).
//  • Aucune écriture cloud avant la 1re synchro réussie, ni si data.js n'est pas chargé.
// Rien d'autre ne doit écrire `players/{uid}.state` : tout passe par syncState().
// ============================================================
const SCHEMA = 2, BASE_KEY = 'arcane-base', LOCALBK_KEY = 'arcane-localbackup';
let _cloudLoaded = false, _syncing = false, _syncAgain = false, _dirty = false, _syncT = 0, _mut = 0, _base = null, _lastSync = null;
// Vrai si l'inventaire contient des clés longues convertibles (ancien format / ancienne rareté).
const needsRepack = inv => Object.keys(LOOT_BY_ID).length > 0 && Object.keys(inv || {}).some(k => k.includes('|') && (LOOT_ID[k] || (TEMP_RARITY_FIX && LOOT_BY_ID[slugOfLine(k)])));
const dataOk = () => Object.keys(LOOT_BY_ID).length > 0;
const copyInv = inv => Object.assign({}, inv);
const serializeStateOf = st => Object.assign({}, st, { inventory: packInventory(st.inventory) });
const serializeState = () => serializeStateOf(state);
const unpackState = cs => Object.assign({}, cs, { inventory: unpackInventory(cs.inventory) });
const snapLocal = () => Object.assign({}, state, { inventory: copyInv(state.inventory), mjAdded: (state.mjAdded || []).slice() });
const freshState = () => ({ version: CURRENT_VERSION, keys: MAX_KEYS, lastRegen: Date.now(), inventory: {}, chestsOpened: 0, fragments: 0, forceLegendary: false, mjActive: false, pseudo: '' });
const snapBase = st => ({ uid: st.uid || '', rev: st.rev || 0, inv: copyInv(st.inventory), keys: st.keys || 0, fragments: st.fragments || 0, clickerClaimed: st.clickerClaimed || 0, chestsOpened: st.chestsOpened || 0 });
function loadBase() { try { const b = JSON.parse(localStorage.getItem(BASE_KEY) || 'null'); if (b) b.inv = unpackInventory(b.inv); return b; } catch (e) { return null; } }
function storeBase(b) { _base = b; try { localStorage.setItem(BASE_KEY, JSON.stringify(Object.assign({}, b, { inv: packInventory(b.inv) }))); } catch (e) {} }
function ensureSuperset(inv, ref) { for (const k in (ref || {})) if (ref[k] > 0 && !(inv[k] > 0)) inv[k] = ref[k]; return inv; }

// Fusion d'inventaires (clés longues). base = inventaire à la dernière synchro de cet appareil (ou null).
const cmpVer = (a, b) => { const x = String(a || '0').split('.').map(n => parseInt(n) || 0), y = String(b || '0').split('.').map(n => parseInt(n) || 0); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
const newerVer = (a, b) => cmpVer(a, b) >= 0 ? (a || '') : (b || '');
function mergeInventories(base, local, cloud) {
  const out = {}, keys = new Set([...Object.keys(local || {}), ...Object.keys(cloud || {})]);
  keys.forEach(k => {
    const l = local && local[k] > 0 ? local[k] : 0, c = cloud && cloud[k] > 0 ? cloud[k] : 0;
    let m;
    if (!l || !c) m = Math.max(l, c);                                       // présent d'un seul côté : on le garde (jamais de perte)
    else if (base) { const b = base[k] > 0 ? base[k] : 0; m = Math.max(c + (l - b), 1); }                            // 3 voies (plancher 1 : un objet possédé d'un côté n'est jamais retiré)
    else m = Math.max(l, c);                                                // pas de base connue : le plus grand
    if (m > 0) out[k] = m;
  });
  return out;
}
// Fusion d'états complets (inventaire en clés longues). L = local, C = cloud.
function mergeStates(base, L, C) {
  const M = Object.assign({}, C);
  M.inventory = mergeInventories(base && base.inv, L.inventory, C.inventory);
  const delta = f => Math.max(0, (C[f] || 0) + ((L[f] || 0) - (base[f] || 0)));
  M.chestsOpened = base ? delta('chestsOpened') : Math.max(L.chestsOpened || 0, C.chestsOpened || 0);
  let keys = base ? delta('keys') : (C.keys || 0), frag = base ? delta('fragments') : (C.fragments || 0);   // sans base : le cloud fait foi (pas de clés gratuites sur appareil neuf)
  if (base && keys > MAX_KEYS && Math.max(L.keys || 0, C.keys || 0) <= MAX_KEYS) keys = MAX_KEYS;          // double régénération
  while (frag >= FRAGS_PER_KEY) { frag -= FRAGS_PER_KEY; keys++; }
  M.keys = keys; M.fragments = frag;
  M.clickerClaimed = Math.max(L.clickerClaimed || 0, C.clickerClaimed || 0);
  M.patchSeen = newerVer(L.patchSeen, C.patchSeen);                        // dernier patchnote lu : le plus récent des deux
  M.lastRegen = keys >= MAX_KEYS ? Date.now() : (base ? Math.min(L.lastRegen || Date.now(), C.lastRegen || Date.now()) : (C.lastRegen || Date.now()));
  M.pseudo = C.pseudo || L.pseudo || '';
  const seen = new Set(), adds = []; [].concat(C.mjAdded || [], L.mjAdded || []).forEach(a => { const id = (a && a.name) + '@' + (a && a.ts); if (!seen.has(id)) { seen.add(id); adds.push(a); } });
  if (adds.length) M.mjAdded = adds;
  M.forceLegendary = !!L.forceLegendary; M.mjActive = !!L.mjActive;
  return M;
}

// ---- Moteur : lecture + fusion + écriture en UNE transaction ----
async function syncState(reason) {
  const u = window.auth?.currentUser;
  if (!u || !window.runTransaction || !window.db) return false;
  if (!dataOk()) { console.warn('[synchro] data.js non chargé : aucune écriture cloud'); return false; }
  if (_syncing) { _syncAgain = true; return false; }
  _syncing = true; clearTimeout(_syncT);
  const mut0 = _mut, L0 = snapLocal();
  try {
    const ref = window.doc(window.db, 'players', u.uid); let res = null;
    await window.runTransaction(window.db, async tx => {
      const snap = await tx.get(ref), data = snap.exists() ? snap.data() : {}, now = Date.now();
      const cs = data.state ? unpackState(data.state) : null;
      const base = _base && _base.uid === u.uid ? _base : null, foreign = !!(L0.uid && L0.uid !== u.uid);
      let merged, mode;
      if (!cs) { merged = foreign ? freshState() : Object.assign({}, L0); mode = 'create'; }
      else if (foreign) { merged = Object.assign({}, cs); mode = 'adopt'; }                       // état local d'un autre compte : ignoré
      else if (base && (cs.rev || 0) === base.rev) { merged = Object.assign({}, cs, L0); mode = 'push'; }   // cloud inchangé depuis notre dernière synchro
      else { merged = mergeStates(base, L0, cs); mode = 'merge'; }
      if (data.pseudo) merged.pseudo = data.pseudo;
      merged.inventory = Object.assign({}, merged.inventory);
      if (cs) ensureSuperset(merged.inventory, cs.inventory);                                     // garde-fou : jamais moins d'objets uniques que le cloud
      if (mode !== 'adopt' && !foreign) ensureSuperset(merged.inventory, L0.inventory);           // … ni que le local
      merged.uid = u.uid; merged.rev = ((cs && cs.rev) || 0) + 1; merged.savedAt = now; merged.schema = SCHEMA;
      const bk = {}, prev = data.backups || {};
      if (cs && !prev.preMigration && (cs.schema !== SCHEMA || needsRepack(data.state.inventory))) bk.preMigration = { ts: now, state: data.state };   // copie BRUTE avant la 1re conversion
      if (cs && (!prev.daily || now - (prev.daily.ts || 0) > 864e5)) bk.daily = { ts: now, state: data.state };                                   // instantané quotidien
      if (mode === 'merge' && base) bk.conflict = { ts: now, cloud: data.state, local: serializeStateOf(L0) };                                      // dernier conflit
      const body = { state: serializeStateOf(merged), lastUpdated: new Date().toISOString() }, fields = ['state', 'lastUpdated'];
      if (merged.pseudo) { body.pseudo = merged.pseudo; fields.push('pseudo'); }
      Object.keys(bk).forEach(k => fields.push('backups.' + k)); if (Object.keys(bk).length) body.backups = bk;
      tx.set(ref, body, { mergeFields: fields });
      res = { merged, mode, hadBase: !!base, foreign, clickerEarned: data.clicker && data.clicker.earned, backups: Object.keys(bk) };
    });
    if (res.foreign) { try {                                                                     // copie de sécurité locale de l'état de l'autre compte (3 max)
      localStorage.setItem(LOCALBK_KEY + '-' + Date.now(), JSON.stringify(serializeStateOf(L0)));
      Object.keys(localStorage).filter(k => k.startsWith(LOCALBK_KEY + '-')).sort().slice(0, -3).forEach(k => localStorage.removeItem(k)); } catch (e) {} }
    let final = res.merged;
    if (_mut !== mut0) final = mergeStates(snapBase(L0), snapLocal(), res.merged);               // le joueur a agi pendant la synchro : on rejoue ses actions
    state = Object.assign({}, final);
    storeBase(snapBase(res.merged)); _cloudLoaded = true; _dirty = (_mut !== mut0); _lastSync = { mode: res.mode, rev: res.merged.rev, backups: res.backups, at: Date.now() };
    try { localStorage.setItem(LSKEY, JSON.stringify(serializeState())); } catch (e) {}
    if (res.mode !== 'push') { if (typeof renderInventory === 'function') renderInventory(); if (typeof updateTimer === 'function') updateTimer(); }
    if (res.mode === 'merge' && res.hadBase) showToast('☁ Progression fusionnée avec ton autre appareil', 4000);
    syncLeaderboardDoc(); syncPushSchedule();
    if (_dirty) scheduleSync();
    return res;
  } catch (e) { console.warn('[synchro] échec (hors-ligne ?) — la sauvegarde locale est conservée', e && (e.code || e.message)); _dirty = true; return false; }
  finally { _syncing = false; if (_syncAgain) { _syncAgain = false; setTimeout(() => syncState('again'), 300); } }
}
function scheduleSync() { if (!window.auth?.currentUser || !_cloudLoaded) return; clearTimeout(_syncT); _syncT = setTimeout(() => syncState('save'), 1200); }
// Reprise après hors-ligne / retour sur l'onglet / fermeture : on resynchronise dès qu'il y a du travail non envoyé
window.addEventListener('online', () => { if (_dirty) syncState('online'); });
document.addEventListener('visibilitychange', () => { if (_dirty && window.auth?.currentUser) syncState('visibility'); });
window.addEventListener('pagehide', () => { if (_dirty && window.auth?.currentUser) syncState('pagehide'); });
setInterval(() => { if (_dirty && window.auth?.currentUser && !_syncing) syncState('retry'); }, 60000);
window.syncInfo = () => ({ dirty: _dirty, cloudLoaded: _cloudLoaded, rev: state.rev || 0, baseRev: _base ? _base.rev : null, uid: (state.uid || '').slice(0, 6), last: _lastSync });
// Diagnostic à lancer dans la console (F12) : inventoryIdStats()
window.inventoryIdStats = () => ({ objetsDansDataJs: (typeof loots !== 'undefined' ? loots.length : 0), identifiantsCompacts: Object.keys(LOOT_BY_ID).length, nonCompactes: (typeof loots !== 'undefined' ? loots.length : 0) - Object.keys(LOOT_BY_ID).length });

// ============================================================
// CLASSEMENT : mini-document public `leaderboard/{uid}` (pseudo + totaux) — le classement ne télécharge plus les documents joueurs complets.
// Règles Firestore à ajouter : voir MEMOIRE.md « Règles Firestore ». Écriture seulement si une valeur a changé.
// ============================================================
// ============================================================
// NOTIFICATIONS PUSH (Firebase Cloud Messaging) — mode d'emploi : NOTIFICATIONS.md
// Le jeu enregistre dans Firestore `push/{uid}` : le(s) jeton(s) de l'appareil + les HEURES prévues (clés rechargées, clé du Clicker).
// Un script GitHub Actions (scripts/send-push.js) envoie les notifications arrivées à échéance ; sw.js les affiche.
// ============================================================
const FCM_VAPID_KEY = 'BPkbzA8BIJAKUKVP4NTaGprmd8P445Ke39zEhMVofl1L7ix2HbIKM9pEFeIaf82qFqsCsoJwIw1U-b7QvwPGhEI';   // clé PUBLIQUE (Web Push), sans danger
const FCM_CDN = 'https://www.gstatic.com/firebasejs/13.2.0/firebase-messaging.js';
const pushDir = () => location.pathname.replace(/[^/]*$/, '');
const pushOriginKey = () => (location.host + pushDir()).replace(/[^a-zA-Z0-9]/g, '_');     // un jeton par adresse (officiel / test)
const pushBaseUrl = () => location.origin + pushDir();
async function getFcmToken() {
  const m = await import(FCM_CDN);
  if (!(await m.isSupported())) throw new Error('unsupported');
  const reg = await navigator.serviceWorker.ready;
  return m.getToken(m.getMessaging(window.fbApp), { vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: reg });
}
async function savePushToken(token) {
  const u = window.auth?.currentUser; if (!u) return;
  await window.setDoc(window.doc(window.db, 'push', u.uid), { tokens: { [pushOriginKey()]: { t: token, url: pushBaseUrl(), ts: Date.now() } }, updatedAt: new Date().toISOString() }, { merge: true });
}
async function enablePush() {                           // à appeler depuis un CLIC (Options ou fenêtre d'invitation) ; renvoie true si activé
  try {
    if (!window.auth?.currentUser) throw new Error('login');
    if (!('Notification' in window) || !('serviceWorker' in navigator)) throw new Error('unsupported');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('denied');
    const token = await getFcmToken();
    await savePushToken(token); localStorage.setItem('arcane-push-token', token); setPref('push', true);
    showToast('🔔 Notifications activées !', 4000); syncPushSchedule(true);
    return true;
  } catch (e) {
    if (e.message === 'denied') setPref('push', false);
    const m = { login: 'Connecte-toi avec Google pour activer les notifications.', unsupported: "Notifications indisponibles ici. Sur iPhone : ajoute d'abord l'app à l'écran d'accueil (Partager → Sur l'écran d'accueil).", denied: 'Autorisation refusée : tu peux la modifier dans les réglages du navigateur.' };
    showToast(m[e.message] || "Activation impossible pour le moment.", 6000); if (!m[e.message]) console.warn('push', e);
    return false;
  }
}
async function togglePush(cb) { if (!cb.checked) { await disablePush(); return; } if (!(await enablePush())) cb.checked = false; }
async function disablePush() {
  setPref('push', false); localStorage.removeItem('arcane-push-token');
  try { const u = window.auth?.currentUser; if (u) await window.setDoc(window.doc(window.db, 'push', u.uid), { tokens: { [pushOriginKey()]: null }, keysAt: null, clickerAt: null, updatedAt: new Date().toISOString() }, { merge: true }); } catch (e) {}
  try { const m = await import(FCM_CDN); await m.deleteToken(m.getMessaging(window.fbApp)); } catch (e) {}
  showToast('🔕 Notifications désactivées');
}
// ACTIVÉES PAR DÉFAUT : à chaque connexion, si l'autorisation est déjà accordée on rafraîchit le jeton ; sinon on PROPOSE une fois (fenêtre d'invitation,
// puis rappel après 7 jours). Le navigateur exige un clic du joueur pour demander l'autorisation : on ne peut pas l'accorder à sa place.
// Tant que le joueur n'a pas désactivé lui-même (`push:false`), tout reste actif.
const PUSH_ASK_KEY = 'arcane-push-asked';
async function ensurePush(delay) {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || getPrefs().push === false) return;
  if (Notification.permission === 'granted') {
    try { const t = await getFcmToken(); if (t !== localStorage.getItem('arcane-push-token')) { await savePushToken(t); localStorage.setItem('arcane-push-token', t); } syncPushSchedule(true); }
    catch (e) { console.warn('push', e); }
  } else if (Notification.permission === 'default') maybeAskPush(delay);
}
function maybeAskPush(delay) {
  const asked = +localStorage.getItem(PUSH_ASK_KEY) || 0; if (asked && Date.now() - asked < 7 * 864e5) return;
  setTimeout(async () => {
    try { const m = await import(FCM_CDN); if (!(await m.isSupported())) return; } catch (e) { return; }        // ex. iPhone sans installation : on ne harcèle pas
    if (Notification.permission !== 'default' || document.hidden || !window.auth?.currentUser) return;
    document.getElementById('push-modal').style.display = 'flex';
  }, delay || 4000);
}
function pushPromptYes() { document.getElementById('push-modal').style.display = 'none'; localStorage.setItem(PUSH_ASK_KEY, Date.now()); enablePush(); }
function pushPromptLater() { document.getElementById('push-modal').style.display = 'none'; localStorage.setItem(PUSH_ASK_KEY, Date.now()); }
let _pushSig = '';
async function syncPushSchedule(force) {                // heure à laquelle les clés seront toutes rechargées (null si déjà pleines)
  const u = window.auth?.currentUser;
  if (!u || getPrefs().push === false || !('Notification' in window) || Notification.permission !== 'granted') return;
  const keysAt = state.keys < MAX_KEYS ? state.lastRegen + (MAX_KEYS - state.keys) * REGEN_MS : null;
  const sig = String(keysAt ? Math.round(keysAt / 6e4) : 0); if (!force && sig === _pushSig) return; _pushSig = sig;
  try { await window.setDoc(window.doc(window.db, 'push', u.uid), { keysAt, updatedAt: new Date().toISOString() }, { merge: true }); } catch (e) { _pushSig = ''; }
}

let _lbSig = '';
async function syncLeaderboardDoc() {
  const u = window.auth?.currentUser; if (!u || !window.db || !state.pseudo) return;
  const inv = state.inventory || {};
  const discovered = Object.keys(inv).filter(k => inv[k] > 0).length;
  const total = Object.keys(inv).reduce((a, k) => a + (inv[k] > 0 ? inv[k] : 0), 0);
  const chests = state.chestsOpened || 0, sig = [state.pseudo, discovered, total, chests].join('|');
  if (sig === _lbSig) return; _lbSig = sig;
  try {
    await window.setDoc(window.doc(window.db, 'leaderboard', u.uid), { pseudo: state.pseudo, discovered, total, chests, updatedAt: new Date().toISOString() });
  } catch (e) { _lbSig = ''; console.warn('Classement : écriture impossible (règles Firestore ?)', e.code || e); }
}

function saveState() {
  _mut++; state.savedAt = Date.now();
  try { localStorage.setItem(LSKEY, JSON.stringify(serializeState())); } catch (e) { console.warn('localStorage plein ou indisponible', e); }
  _dirty = true; scheduleSync();                           // envoi au cloud différé (1,2 s) et fusionné : voir syncState()
}

async function loadState() {                                // lecture LOCALE seulement ; le cloud est fusionné par loadGameDataFromCloud() dès que Firebase répond
  _base = loadBase();
  const raw = localStorage.getItem(LSKEY);
  if (!raw) { saveState(); return; }
  try { const loc = JSON.parse(raw); loc.inventory = unpackInventory(loc.inventory); state = Object.assign(state, loc); }
  catch (e) { try { localStorage.setItem(LSKEY + '-corrompu', raw); } catch (x) {} console.error('Sauvegarde locale illisible : copie conservée', e); }   // on n'écrase pas une sauvegarde illisible
}

// ============================================================
// PATCHNOTES (contenu : patchnotes.js) — affiché UNE fois par version et par compte (state.patchSeen, synchronisé), puis via Menu › Patchnote.
// Ordre à l'entrée : (pseudo si nouveau compte) → patchnote → invitation aux notifications.
// ============================================================
const patchPending = () => typeof PATCHNOTES !== 'undefined' && PATCHNOTES.length > 0 && cmpVer(state.patchSeen, PATCHNOTES[0].v) < 0;
let _patchAuto = false, _entryDone = false;
function richText(el, txt) {
  String(txt).split(/(\*\*[^*]+\*\*)/).forEach(p => {
    if (/^\*\*[^*]+\*\*$/.test(p)) { const b = document.createElement('strong'); b.textContent = p.slice(2, -2); el.append(b); }
    else if (p) el.append(document.createTextNode(p));
  });
}
function renderPatchnotes() {
  const list = document.getElementById('patch-list'); list.textContent = '';
  PATCHNOTES.forEach((n, i) => {
    const d = document.createElement('details'); d.className = 'pv' + (i === 0 ? ' cur' : ''); if (i === 0) d.open = true;
    const sm = document.createElement('summary'); sm.append(document.createTextNode('V' + n.v + ' — « ' + n.name + ' »'));
    if (i === 0) { const bd = document.createElement('span'); bd.className = 'pv-badge'; bd.textContent = _patchAuto ? 'NOUVEAU' : 'ACTUELLE'; sm.append(bd); }
    d.append(sm);
    const body = document.createElement('div'); body.className = 'pv-body';
    if (n.gift) { const g = document.createElement('div'); g.className = 'pv-gift'; g.textContent = '🎁 ' + n.gift; body.append(g); }
    n.sections.forEach(sec => {
      const s = document.createElement('div'), h = document.createElement('h4'), ul = document.createElement('ul'); s.className = 'pv-sec'; h.textContent = sec.t;
      sec.items.forEach(it => { const li = document.createElement('li'); richText(li, it); ul.append(li); });
      s.append(h, ul); body.append(s);
    });
    d.append(body); list.append(d);
  });
}
function openPatchnotes(auto) {
  if (typeof PATCHNOTES === 'undefined' || !PATCHNOTES.length) return;
  _patchAuto = !!auto; renderPatchnotes();
  document.getElementById('patch-ok').textContent = auto ? 'Compris !' : 'Fermer';
  document.getElementById('patch-modal').style.display = 'flex';
}
function closePatchnotes() {
  document.getElementById('patch-modal').style.display = 'none';
  if (patchPending()) { state.patchSeen = PATCHNOTES[0].v; saveState(); }        // marqué comme lu
  if (_patchAuto) { _patchAuto = false; ensurePush(1200); }                       // … puis l'invitation aux notifications
}
function afterEntry() {                                                           // appelée une fois l'app affichée ET le compte synchronisé
  if (_entryDone) return; _entryDone = true;
  setTimeout(() => { if (patchPending()) openPatchnotes(true); else ensurePush(); }, 900);
}

// MISE À JOUR : une seule fois par joueur, quel que soit le nombre de versions sautées → clés remises à MAX_KEYS (jamais réduites).
// L'inventaire n'est JAMAIS touché. Appelée après chaque fusion local/cloud (le cloud écrase `version` et `keys`).
function applyVersionUpdate() {
  if (state.version === CURRENT_VERSION) return;
  const first = !state.version;                         // sauvegarde sans version (très ancienne) : on aligne sans cadeau superflu
  state.version = CURRENT_VERSION;
  if (!first) {
    state.keys = Math.max(state.keys || 0, MAX_KEYS); state.lastRegen = Date.now();
    setTimeout(() => showToast('🔑 Mise à jour — ' + MAX_KEYS + ' clés offertes, inventaire conservé'), 500);
  }
  saveState();
  if (typeof updateTimer === 'function') updateTimer();
}
// ============================================================
// REGEN
// ============================================================
function processRegen(){
  const now = Date.now();
  const elapsed = now - state.lastRegen;
  const charges = Math.floor(elapsed / REGEN_MS);
  if(charges > 0 && state.keys < MAX_KEYS){
    state.keys = Math.min(MAX_KEYS, state.keys + charges);
    state.lastRegen += charges * REGEN_MS;
    if(state.keys >= MAX_KEYS) state.lastRegen = now;
    saveState();
  }
}

function updateTimer(){
  processRegen();
  const keysEl = document.getElementById('keys-icons');
  const bar = document.getElementById('timer-bar');
  const txt = document.getElementById('timer-text');
  const fragEl = document.getElementById('frag-info');

  // Draw keys (can exceed MAX_KEYS via fragments)
  keysEl.innerHTML='';
  const displayMax = Math.max(MAX_KEYS, state.keys);
  for(let i=0;i<displayMax;i++){
    const d=document.createElement('div');
    d.className='key-icon '+(i<state.keys?'active':'inactive')+(i===_glowIdx?' glow':'');
    d.innerHTML=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`;
    keysEl.appendChild(d);
  }

  // Timer
  if(state.keys >= MAX_KEYS){
    bar.style.width='100%';
    txt.textContent='Toutes les clés disponibles';
  } else {
    const elapsed = Date.now() - state.lastRegen;
    const remaining = REGEN_MS - elapsed;
    bar.style.width=Math.min(100,(elapsed/REGEN_MS)*100)+'%';
    const h=Math.floor(remaining/3600000);
    const m=Math.floor((remaining%3600000)/60000);
    const s=Math.floor((remaining%60000)/1000);
    txt.textContent=`Prochaine clé dans ${h}h ${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s`;
  }

  // Fragments
  fragEl.innerHTML = state.fragments>0
    ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="var(--c-r)" style="flex-shrink:0"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
       <span style="color:var(--c-r)">${state.fragments}/${FRAGS_PER_KEY} fragments</span>`
    : '';
}

// ============================================================
// STARS
// ============================================================
function initStars(){
  const c=document.getElementById('stars');
  for(let i=0;i<80;i++){
    const s=document.createElement('div');
    s.className='star';
    const sz=Math.random()*2+1;
    s.style.cssText=`width:${sz}px;height:${sz}px;top:${Math.random()*100}%;left:${Math.random()*100}%;--d:${2+Math.random()*4}s;--delay:${-Math.random()*4}s;opacity:${Math.random()*.5}`;
    c.appendChild(s);
  }
}

// ============================================================
// RARITY TABLES
// ============================================================
const RARITY_LABELS = { C:'Commun', PC:'Peu Commun', R:'Rare', TR:'Très Rare', L:'Légendaire', A:'Artefact' };
const RARITY_COLORS = { C:'var(--c-c)', PC:'var(--c-pc)', R:'var(--c-r)', TR:'var(--c-tr)', L:'var(--c-l)', A:'var(--c-a)' };
const RARITY_DOTS   = { C:'#94a3b8', PC:'#4ade80', R:'#22d3ee', TR:'#a855f7', L:'#f97316', A:'#e11d48' };

function rollRarity(){
  const r=Math.random()*100; let cumul=0;
  for(const [k,v] of Object.entries(DROP_RATES)){ cumul+=v; if(r<=cumul) return k; }
  return 'C';
}

function rollLoot(rarity){
  // Fallback cascade si pool vide pour cette rareté
  const idx = RARITY_FALLBACK.indexOf(rarity);
  const candidates = idx>=0 ? RARITY_FALLBACK.slice(idx) : [rarity,'C'];
  for(const r of candidates){
    const pool = loots.filter(l=>l.split('|')[3]===r);
    if(pool.length) return pool[Math.floor(Math.random()*pool.length)];
  }
  return loots[Math.floor(Math.random()*loots.length)];
}

// ============================================================
// TYPE ICONS
// ============================================================
function typeIcon(type){
  const t=(type||'').toLowerCase();
  const icons={
    arme:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.5 2.5l7 7-11 11-4-4 11-11zM2 22l4-4M8 8l2 2"/></svg>`,
    armure:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L4 6v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V6l-8-4z"/></svg>`,
    anneau:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>`,
    sceptre:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v20M8 6l4-4 4 4"/><circle cx="12" cy="6" r="3"/></svg>`,
    potion:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 3h6M10 3v4L6 12v7a2 2 0 002 2h8a2 2 0 002-2v-7l-4-5V3"/></svg>`,
    parchemin:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zM8 8h8M8 12h8M8 16h5"/></svg>`,
    default:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
  };
  for(const k of Object.keys(icons)){ if(t.includes(k)) return icons[k]; }
  return icons.default;
}

// ============================================================
// PARTICLES
// ============================================================
function createParticles(card, rarity){
  card.querySelectorAll('.particle').forEach(p=>p.remove());
  const palettes={
    L:['#f97316','#fbbf24','#fb923c','#fde68a'],
    A:['#e11d48','#fbbf24','#a855f7','#f43f5e','#fff']
  };
  const colors = palettes[rarity]||palettes['L'];
  const count = rarity==='A' ? 24 : 16;
  for(let i=0;i<count;i++){
    const p=document.createElement('div');
    p.className='particle';
    const sz=3+Math.random()*5;
    p.style.cssText=`width:${sz}px;height:${sz}px;background:${colors[Math.floor(Math.random()*colors.length)]};
      left:${Math.random()*100}%;bottom:${Math.random()*60}%;
      --d:${2+Math.random()*4}s;--delay:${-Math.random()*4}s;--x:${(Math.random()-.5)*50}px;opacity:.8`;
    card.appendChild(p);
  }
}

// ============================================================
// OPEN CHEST
// ============================================================
let isAnimating=false;
function openChest(){
  if(_authPending){ showToast('⏳ Synchronisation avec ton compte…'); return; }
  if(isAnimating||state.keys<=0) return;
  playClickSound();
  isAnimating=true;
  state.keys--;
  if(state.keys===MAX_KEYS-1) state.lastRegen=Date.now();
  saveState(); updateTimer();

  const btn=document.getElementById('open-btn');
  const chest=document.getElementById('chest-svg');
  const glow=document.getElementById('chest-glow');
  btn.disabled=true;
  chest.classList.add('shake');
  glow.style.animation='breathe 0.3s ease-in-out infinite';

  setTimeout(()=>{
    const flash=document.getElementById('flash');
    flash.style.opacity='1';
    if(navigator.vibrate && getPrefs().vibe!==false) navigator.vibrate([80,30,120]);
    playImpactSound();

    setTimeout(()=>{
      flash.style.opacity='0';
      document.getElementById('chest-wrap').style.display='none';
      btn.style.display='none';

      const rarity = state.forceLegendary ? 'A' : rollRarity();
      if(state.forceLegendary){
        state.forceLegendary=false;
        document.getElementById('force-legendary').checked=false;
        saveState();
      }
      const lootStr=rollLoot(rarity);
      const [name,link,type,actualRarity] = lootStr.split('|');
      // Use actualRarity (handles fallback cascade correctly)
      const finalRarity = actualRarity || rarity;

      state.inventory[lootStr]=(state.inventory[lootStr]||0)+1;
      state.chestsOpened=(state.chestsOpened||0)+1;
      saveState();

      playRevealSound(finalRarity);
      buildCard(name,link,type,finalRarity);

      const ca=document.getElementById('card-area');
      ca.style.display='block';
      requestAnimationFrame(()=>requestAnimationFrame(()=>document.getElementById('card-flip').classList.add('flipped')));
      isAnimating=false;
    },130);
  },1500);
}

function buildCard(name,link,type,rarity){
  const card=document.getElementById('loot-card');
  card.className=`loot-card r-${rarity}`;
  const isHigh=rarity==='L'||rarity==='A';
  if(isHigh) createParticles(card,rarity);
  else card.querySelectorAll('.particle').forEach(p=>p.remove());

  const color=RARITY_COLORS[rarity];
  const icon=typeIcon(type);
  const nameClass=rarity==='A'?'artefact-glow':rarity==='L'?'legendary-glow':'';

  const linkHTML = (link && link !== '#')
    ? '<a class="card-link" href="' + link + '" target="_blank" rel="noopener">'
      + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>'
      + 'Voir la fiche</a>'
    : '';
  document.getElementById('card-inner').innerHTML =
    '<div style="display:flex;align-items:center;gap:12px;">'
    + '<div class="card-type-icon" style="color:' + color + ';border-color:' + color + '33">' + icon + '</div>'
    + '<div>'
    + '<div class="card-rarity rc-' + rarity + '">' + (RARITY_LABELS[rarity]||rarity) + '</div>'
    + '<div class="card-type" style="margin-top:2px">'
    + '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" opacity=".5"><circle cx="12" cy="12" r="4"/></svg>' + type
    + '</div></div></div>'
    + '<div class="card-name ' + nameClass + '" style="color:' + color + '">' + name + '</div>'
    + linkHTML;
}

function resetToChest(){
  document.getElementById('card-area').style.display='none';
  document.getElementById('card-flip').classList.remove('flipped');
  document.getElementById('chest-wrap').style.display='flex';
  const btn=document.getElementById('open-btn');
  btn.style.display=''; btn.disabled=state.keys<=0;
  updateTimer();
}

// ============================================================
// INVENTORY SIDEBAR
// ============================================================
let activeTab='all';
function openSidebar(){ document.getElementById('sidebar').classList.add('open'); document.getElementById('overlay').classList.add('show'); renderInventory(); }
function closeSidebar(){
  if (isProfileOpen) {
    // Si on est dans le profil, fermer d'abord le détail ou le profil pour revenir à l'inventaire
    const detailView = document.getElementById('profile-detail-view');
    const gridView = document.getElementById('profile-grid-view');
    const titleText = document.getElementById('sidebar-title-text');
    if (detailView && detailView.style.display === 'flex') {
      detailView.style.display = 'none';
      if (gridView) gridView.style.display = 'grid';
      if (titleText) titleText.textContent = '✦ Profil & Modules';
      return;
    }
    isProfileOpen = false;
    const invView = document.getElementById('inventory-view');
    const profPanel = document.getElementById('profile-panel');
    if (invView) invView.style.display = 'flex';
    if (profPanel) profPanel.style.display = 'none';
    if (titleText) titleText.textContent = '✦ Inventaire';
    return;
  }
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

function recycleByIndex(idx, e){ recycleItem(window._invKeys[idx], e); }
// ★ FRAGMENTS RAPPORTÉS PAR UN RECYCLAGE selon la rareté (éditable ici). A (Artefact) = valeur provisoire, à décider plus tard.
const RECYCLE_FRAGS = { C:1, PC:2, R:3, TR:4, L:5, A:5 };
const recycleGain = lootKey => RECYCLE_FRAGS[lootKey.split('|')[3]] || 1;
function recycleItem(lootKey, e){
  e.stopPropagation();
  if(_authPending){ showToast('⏳ Synchronisation avec ton compte…'); return; }
  if((state.inventory[lootKey]||0) < 2) return;
  const gain = recycleGain(lootKey);
  state.inventory[lootKey]--;
  state.fragments = (state.fragments||0) + gain;
  // Fragments → clés (peut dépasser MAX_KEYS) ; plusieurs clés possibles d'un seul recyclage
  let forged = 0;
  while(state.fragments >= FRAGS_PER_KEY){ state.fragments -= FRAGS_PER_KEY; state.keys++; forged++; }
  saveState(); updateTimer();
  if(forged){
    showToast('✨ +' + gain + ' fragment' + (gain>1?'s':'') + ' → ' + forged + ' clé' + (forged>1?'s':'') + ' forgée' + (forged>1?'s':'') + ' !');
    document.getElementById('open-btn').disabled=false;
  } else {
    showToast('♻ +' + gain + ' fragment' + (gain>1?'s':'') + ' (' + state.fragments + '/' + FRAGS_PER_KEY + ')');
  }
  renderInventory();
}

function renderInventory(){
    // Badge joueur
  const badge = document.getElementById('player-badge');
  if(badge) badge.innerHTML = state.pseudo
    ? '<div style="display:flex; align-items:center; justify-content:space-between; width:100%;">'
      + '<div style="display:flex; align-items:center; gap:8px;">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
      + 'Aventurier :&nbsp;<strong>' + escapeLeaderboardHtml(state.pseudo) + '</strong>'
      + '</div>'
      + '<button class="share-btn" style="padding:4px 10px; font-size:11px; margin:0;" onclick="toggleProfilePanel()">🎛️ Menu</button>'
      + '</div>'
    : '';
  const search=document.getElementById('search-input').value.toLowerCase();
  const entries=Object.entries(state.inventory).filter(([,c])=>c>0);

  // Completion bar
  const totalUnique=loots.length;
  const discovered=Object.keys(state.inventory).filter(k=>(state.inventory[k]||0)>0).length;
  const pct=totalUnique>0?Math.round(discovered/totalUnique*100):0;
  document.getElementById('completion-text').textContent=`Collection : ${discovered} / ${totalUnique} objets uniques`;
  document.getElementById('completion-pct').textContent=pct+'%';
  document.getElementById('completion-fill').style.width=pct+'%';

  // Tabs
  const tabs=document.getElementById('sidebar-tabs');
  const tabDefs=[['all','Tout'],['A','Artefact'],['L','Légendaire'],['TR','T. Rare'],['R','Rare'],['PC','P. Commun'],['C','Commun']];
  tabs.innerHTML=tabDefs.map(([k,l])=>`<button class="tab-btn ${activeTab===k?'active':''}" onclick="setTab('${k}')">${l}</button>`).join('');

  // Filter + sort
  const order={A:0,L:1,TR:2,R:3,PC:4,C:5};
  const filtered=entries
    .filter(([k])=>{ const [n,,,r]=k.split('|'); return (activeTab==='all'||r===activeTab)&&(!search||n.toLowerCase().includes(search)); })
    .sort(([a],[b])=>{ const ra=a.split('|')[3],rb=b.split('|')[3]; return (order[ra]??9)-(order[rb]??9); });

  const list=document.getElementById('inv-list');
  if(!filtered.length){
    list.innerHTML=`<div class="inv-empty">Aucun objet trouvé.<br><br>Ouvrez des coffres pour<br>remplir votre inventaire.</div>`;
  } else {
    // Store keys in a temp lookup so onclick can reference by index safely
    window._invKeys = filtered.map(([k])=>k);
    list.innerHTML=filtered.map(([k,cnt],idx)=>{
      const [n,lnk,,rar]=k.split('|');
      const extraHTML = cnt > 1
        ? '<span class="inv-count rc-' + rar + '">×' + cnt + '</span>'
          + '<button class="recycle-btn" onclick="recycleByIndex(' + idx + ',event)" title="Recycler un doublon : +' + recycleGain(k) + ' fragment(s)">♻ +' + recycleGain(k) + '</button>'
        : '';
      return '<div class="inv-item" onclick="window.open(\'' + lnk.replace(/'/g,"\\'") + '\',\'_blank\')">'
        + '<div class="inv-dot" style="background:' + (RARITY_DOTS[rar]||'#666') + '"></div>'
        + '<span class="inv-name">' + n + '</span>'
        + extraHTML
        + '</div>';
    }).join('');
  }

  // Stats
  const stats={A:0,L:0,TR:0,R:0,PC:0,C:0};
  Object.keys(state.inventory).filter(k=>state.inventory[k]>0).forEach(k=>{ const r=k.split('|')[3]; if(stats[r]!==undefined) stats[r]++; });
  document.getElementById('inv-stats').innerHTML=Object.entries(stats).map(([k,v])=>`
    <div class="stat-chip"><span class="stat-num rc-${k}">${v}</span><span class="stat-lbl">${k}</span></div>`).join('');
}

function setTab(t){ activeTab=t; renderInventory(); }

// ============================================================
// MJ / SECRET
// ============================================================
function openMJModal(){
  document.getElementById('modal').classList.add('show');
  document.getElementById('mj-input').value='';
  document.getElementById('mj-input').focus();
}
let logoClicks=0, logoTimer=null;
document.getElementById('logo-click').addEventListener('click',()=>{
  logoClicks++;
  clearTimeout(logoTimer);
  logoTimer=setTimeout(()=>logoClicks=0,1500);
  if(logoClicks>=5){ logoClicks=0; openMJModal(); }
});
let invBtnClicks=0, invBtnTimer=null;
document.querySelector('.inv-btn').addEventListener('click', function(e){
  // Ignorer les clics venant de l'intérieur de la sidebar
  if(document.getElementById('sidebar').contains(e.target)) return;
  invBtnClicks++;
  clearTimeout(invBtnTimer);
  invBtnTimer=setTimeout(()=>invBtnClicks=0,1500);
  if(invBtnClicks>=5){ invBtnClicks=0; openMJModal(); return; }
  openSidebar();
},{capture:true});
document.getElementById('secret-zone').addEventListener('click',openMJModal);

function checkMJCode(){
  const v=document.getElementById('mj-input').value;
  if(v.length===4){
    if(v==='8416'){
      closeModal(); state.mjActive=true;
      document.getElementById('mj-panel').classList.add('show');
      document.getElementById('force-legendary').checked=state.forceLegendary;
      showToast('⚙ Mode Maître du Jeu activé');
    } else {
      document.getElementById('mj-input').value='';
      document.getElementById('mj-input').style.borderColor='rgba(239,68,68,.5)';
      setTimeout(()=>document.getElementById('mj-input').style.borderColor='',800);
    }
  }
}
function closeMJPanel(){
  document.getElementById('mj-panel').classList.remove('show');
  state.mjActive=false;
  showToast('Mode MJ désactivé');
}
function mjRenamePseudo(){
  const np = prompt('Nouveau pseudo (2–15 caractères) :', state.pseudo||'');
  if(np === null) return;
  const trimmed = np.trim();
  if(trimmed.length < 2 || trimmed.length > 15){
    showToast('❌ Pseudo invalide (2–15 caractères)'); return;
  }
  state.pseudo = trimmed; saveState();
  renderInventory();
  showToast('✎ Pseudo mis à jour : ' + trimmed);
}

function mjAddItem(){
  if(!loots || !loots.length){ showToast('❌ data.js non chargé'); return; }
  const query = prompt('Nom de l\'objet à ajouter (recherche partielle) :');
  if(!query) return;
  const matches = loots.filter(l => l.split('|')[0].toLowerCase().includes(query.toLowerCase()));
  if(!matches.length){ showToast('❌ Aucun objet trouvé pour : ' + query); return; }
  const display = matches.slice(0, 8);
  let msg = display.map((l,i) => (i+1) + '. ' + l.split('|')[0]).join('\n');
  if(matches.length > 8) msg += '\n… (' + (matches.length-8) + ' autres, affinez la recherche)';
  const raw = prompt('Résultats :\n' + msg + '\n\nNuméro à ajouter (1-' + display.length + ') :');
  if(raw === null) return;
  const idx = parseInt(raw);
  if(isNaN(idx) || idx < 1 || idx > display.length){ showToast('❌ Choix invalide (1-' + display.length + ')'); return; }
  const lootStr = display[idx-1];
  const name = lootStr.split('|')[0];
  state.inventory[lootStr] = (state.inventory[lootStr]||0) + 1;
  if(!state.mjAdded) state.mjAdded = [];
  state.mjAdded.push({ name, ts: Date.now() });
  saveState(); renderInventory();
  showToast('⚙ MJ : "' + name + '" ajouté');
}

function closeModal(){ document.getElementById('modal').classList.remove('show'); }
function mjResetKeys(){ state.keys=MAX_KEYS; state.lastRegen=Date.now(); saveState(); updateTimer(); document.getElementById('open-btn').disabled=false; showToast('🔑 Clés rechargées !'); }
function updateForceLegendary(){ state.forceLegendary=document.getElementById('force-legendary').checked; saveState(); showToast(state.forceLegendary?'☆ Prochain drop : ARTEFACT forcé':'Drop aléatoire rétabli'); }

// ============================================================
// TOAST
// ============================================================
let toastTimer=null;
function showToast(msg, ms){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),ms||2800);
}

document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeModal(); });



// ============================================================
// INIT
// ============================================================
window.onload = function() {
  // Chemin RELATIF : le même code marche sur /coffre_des_arcanes/ et /coffre_des_arcanes_dev/ (sw.js ne met rien en cache en local).
  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;       // vrai = une ancienne version tourne déjà dans cette page
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) { const b = document.getElementById('update-banner'); if (b) b.style.display = 'flex'; } });
    navigator.serviceWorker.register('sw.js')
      .then(reg => {
        console.log('SW enregistré', reg);
        // Vérification automatique des mises à jour du Service Worker
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('Nouvelle version disponible. Rechargez la page.');
            }
          };
        };
      })
      .catch(err => console.error('Erreur SW', err));
  }

  loadState();
  processRegen();
  initStars();

  // Gestion de l'écran d'accueil avec l'authentification Google
  const welcome = document.getElementById('welcome-screen');
  
  // On s'appuie sur le state utilisateur ou le pseudo Google validé
  if (state.pseudo && state.pseudo.length >= 2) {
    // Joueur déjà connu sur cet appareil : l'écran d'accueil est masqué par la classe `fast` (posée dans <head>) ;
    // le Cloud est fusionné dès que Firebase répond → pendant ce court délai on bloque ouverture/recyclage (évite d'être écrasé par le Cloud).
    _authPending = true; setTimeout(() => { _authPending = false; }, 6000);   // hors-ligne : on débloque au bout de 6 s
    const ob = document.getElementById('open-btn'); if (ob) ob.disabled = true;
    bootApp();
  } else {
    // Nouveau joueur / Non connecté : afficher l'écran d'accueil, masquer #app
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.style.visibility = 'hidden';
      appElement.style.opacity = '0';
    }
  }
};

let _booted = false, _authPending = false;
function bootApp(){
  if (_booted) { updateTimer(); document.getElementById('open-btn').disabled = state.keys <= 0; runPendingKeyFx(); return; }
  _booted = true;
  updateTimer();
  setInterval(updateTimer, 1000);
  document.getElementById('open-btn').disabled = state.keys <= 0;
  runPendingKeyFx();
  document.getElementById('card-area').style.display = 'none';
  document.getElementById('chest-wrap').style.display = 'flex';
}

function validateCustomPseudoInput(){
  const input = document.getElementById('custom-pseudo-input');
  const btn = document.getElementById('pseudo-submit-btn');
  if(!input || !btn) return;
  const val = input.value.trim();
  btn.disabled = val.length === 0;
}

async function submitCustomPseudo(){
  const input = document.getElementById('custom-pseudo-input');
  if(!input) return;
  const pseudoVal = input.value.trim();
  if(pseudoVal.length < 2){
    showToast("❌ Le pseudo doit contenir au moins 2 caractères");
    return;
  }
  state.pseudo = pseudoVal;
  saveState();
  await saveGameDataToCloud();

  const welcome = document.getElementById('welcome-screen');
  const appEl = document.getElementById('app');
  if(welcome) welcome.classList.add('hidden');
  if(appEl){
    appEl.style.visibility = 'visible';
    appEl.style.opacity = '0';
    appEl.style.transition = 'opacity .5s ease';
    requestAnimationFrame(()=> requestAnimationFrame(()=>{ appEl.style.opacity = '1'; }));
  }

  bootApp();
  afterEntry();
  showToast("✨ Bienvenue Mage " + pseudoVal + " !");
}


// <!-- FOOTER TEXTES ET LOGIQUE JURIDIQUE -->
const LEGAL_TEXTS = {
    mentions: {
        title: "Mentions Légales",
        body: "<p>L'application <strong>Le Coffre des Arcanes</strong> (Arcane Vault) est un outil interactif de simulation et de mini-jeux, édité par <strong>Moulecake</strong>.<br><strong>Contact :</strong> killpubs@gmail.com</p><p><strong>Hébergement :</strong> Ce site est hébergé par GitHub, Inc. (88 Colin P Kelly Jr St, San Francisco, CA 94107, USA) via GitHub Pages, et utilise les services d'infrastructure de Google / Firebase pour l'authentification.</p><p><strong>Propriété :</strong> Les contenus de règles, sorts et éléments de JDR s'appuient sur l'univers de référence de la 5e édition et demeurent la propriété de leurs créateurs respectifs.</p>"
    },
    confidentialite: {
        title: "Confidentialité & Cookies",
        body: "<p>Conformément au RGPD, nous veillons à la protection de vos données. L'application n'utilise <strong>aucun traceur publicitaire tiers</strong>.</p><p><strong>Données collectées :</strong> L'utilisation de Firebase Auth implique la gestion de votre identifiant de connexion. Votre progression et vos clés sont synchronisées via votre compte. Si vous activez les notifications (Options), un jeton technique de votre appareil et les heures prévues de vos rappels (clés rechargées, clé du Clicker) sont enregistrés dans votre compte et utilisés uniquement pour vous envoyer ces notifications, via le service Google Firebase Cloud Messaging. Vous pouvez les désactiver à tout moment dans Options (le jeton est alors supprimé).</p><p><strong>Vos droits :</strong> Vous pouvez à tout moment effacer l'intégralité de vos données et réinitialiser votre profil directement depuis les paramètres de l'application.</p>"
    },
    accessibilite: {
        title: "Accessibilité",
        body: "<p>L'interface de l'application a été conçue selon les standards PWA 2026, avec un design sombre à fort contraste et une ergonomie fluide (panneau profil, navigation par onglets) pensée pour le confort sur mobile (Android et iOS) et PC.</p><p>Le système intègre des retours haptiques (Vibraphone API) et des animations optimisées pour une immersion maximale lors de l'ouverture des coffres et des sessions de clicker.</p>"
    }
};

function openLegalModal(type) {
    const modal = document.getElementById('legal-modal');
    const title = document.getElementById('legal-modal-title');
    const body = document.getElementById('legal-modal-body');
    
    if (modal && title && body && LEGAL_TEXTS[type]) {
        title.innerHTML = LEGAL_TEXTS[type].title;
        body.innerHTML = LEGAL_TEXTS[type].body;
        modal.style.display = 'flex';
    }
}

function closeLegalModal() {
    const modal = document.getElementById('legal-modal');
    if (modal) modal.style.display = 'none';
}

// Fermer la modale si on clique à côté de la boîte de dialogue
window.addEventListener('click', function(e) {
    const modal = document.getElementById('legal-modal');
    if (e.target === modal) closeLegalModal();
});

// --- GESTION FIREBASE & SAUVEGARDE CLOUD ---
if (typeof window.onAuthStateChanged === 'function') {
  window.onAuthStateChanged(window.auth, async (user) => {
    const loginBtn = document.getElementById("google-login-btn");
    const userDisplay = document.getElementById("user-display-name");
    const pseudoContainer = document.getElementById("pseudo-modal-container");

    if (user) {
      console.log("Joueur de l'Académie connecté :", user.email || user.uid);
      if (loginBtn) loginBtn.style.display = "none"; // Masquer le bouton de login car connecté
      if (userDisplay) {
        userDisplay.innerText = user.email || user.displayName || "Mage Authentifié";
        userDisplay.style.display = "inline";
      }
      await loadGameDataFromCloud(user.uid);
      _authPending = false;

      // Vérifier si le pseudo est déjà défini dans le state ou Firestore
      if (state.pseudo && state.pseudo.length >= 2) {
        if (pseudoContainer) pseudoContainer.style.display = "none";
        const welcome = document.getElementById('welcome-screen');
        const appEl = document.getElementById('app');
        if (welcome) welcome.classList.add('hidden');
        if (appEl) {
          appEl.style.visibility = 'visible';
          appEl.style.opacity = '1';
        }
        bootApp();
        afterEntry();                                            // patchnote (1 fois par version) puis invitation aux notifications
      } else {
        // Pas de pseudo défini : afficher la modale de saisie de pseudo bloquante
        document.documentElement.classList.remove('fast');
        if (pseudoContainer) pseudoContainer.style.display = "flex";
      }
    } else {
      console.log("Mode Invité / Non connecté");
      _authPending = false; document.documentElement.classList.remove('fast');   // pas connecté : on affiche l'écran d'accueil
      if (loginBtn) loginBtn.style.display = "block";
      if (loginBtn) loginBtn.innerText = "Se connecter avec Google";
      if (userDisplay) userDisplay.style.display = "none";
      if (pseudoContainer) pseudoContainer.style.display = "none";
      const welcome = document.getElementById('welcome-screen');
      if (welcome) welcome.classList.remove('hidden');
      const appEl = document.getElementById('app');
      if (appEl) {
        appEl.style.visibility = 'hidden';
        appEl.style.opacity = '0';
      }
    }
  });
}

document.getElementById("google-login-btn")?.addEventListener("click", () => {
  if (!window.auth) return;
  if (window.auth.currentUser) {
    window.signOut(window.auth).then(() => console.log("Déconnexion réussie"));
  } else {
    const provider = new window.GoogleAuthProvider();
    window.signInWithPopup(window.auth, provider)
      .then((result) => {
        console.log("Connexion réussie :", result.user.displayName);
      })
      .catch((error) => {
        console.error("Erreur de connexion :", error);
      });
  }
});

async function saveGameDataToCloud() { return syncState('manual'); }      // ancien nom conservé : tout passe par syncState()

async function loadGameDataFromCloud(uid) {
  try {
    const res = await syncState('login');                   // lit le cloud, fusionne avec le local (jamais d'écrasement), écrit le résultat
    applyVersionUpdate();
    syncLeaderboardDoc();
    claimClickerFragments(res ? res.clickerEarned : 0);
  } catch (e) {
    console.error("Erreur lors du chargement des données Cloud :", e);
  }
}

// --- LEADERBOARD & CLASSEMENT DES MAGES ---
document.addEventListener('DOMContentLoaded', () => {
  const lbVisited = localStorage.getItem('arcane-lb-visited');
  const btn = document.getElementById('leaderboard-btn');
  if (btn && !lbVisited) {
    btn.classList.add('pulsing');
  }
});

async function openLeaderboardModal() {
  const btn = document.getElementById('leaderboard-btn');
  if (btn) {
    btn.classList.remove('pulsing');
  }
  localStorage.setItem('arcane-lb-visited', 'true');

  const modal = document.getElementById('leaderboard-modal');
  const listContainer = document.getElementById('leaderboard-list');
  if (modal) modal.style.display = 'flex';
  if (listContainer) {
    listContainer.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:20px;">Chargement des arcanes du classement...</div>';
  }

  try {
    if (!window.db || !window.collection || !window.getDocs) {
      throw new Error("Firestore non disponible");
    }

    // ==========================================
    // LISTE DES COMPTES DE TEST À EXCLURE DU CLASSEMENT
    // Ajoute ici les UIDs Firebase de tes comptes de test
    // ==========================================
    const EXCLUDED_UIDS = [
      "e7olNUvRKaSdPPhzNMbyJgmAdUu1", // Exemple : Eliéta (compte test)
      "ZjnCVWvL0rTVorvimZREv1v6mwC2", //Pubkiller (compte test)
      // "AUTRE_UID_DE_TEST_ICI"
    ];

    const players = [];
    try {                                              // 1) mini-documents publics (léger)
      const lb = await window.getDocs(window.collection(window.db, 'leaderboard'));
      lb.forEach(d => {
        if (EXCLUDED_UIDS.includes(d.id)) return;
        const x = d.data(); players.push({ pseudo: x.pseudo || 'Mage Anonyme', discovered: x.discovered || 0 });
      });
    } catch (e) { console.warn('Classement : collection leaderboard illisible, repli sur players', e.code || e); }

    if (!players.length) {                             // 2) repli (transition) : ancien mode, lit les documents joueurs complets
      const querySnapshot = await window.getDocs(window.collection(window.db, 'players'));
      querySnapshot.forEach((docSnap) => {
        const uid = docSnap.id;
        if (EXCLUDED_UIDS.includes(uid)) return;
        const data = docSnap.data();
        const pState = data.state || {};
        const pseudo = pState.pseudo || data.pseudo || 'Mage Anonyme';
        const inventory = unpackInventory(pState.inventory);
        const discovered = Object.keys(inventory).filter(k => inventory[k] > 0).length;
        players.push({ pseudo, discovered });
      });
    }

    // Trier par ordre décroissant d'objets uniques découverts
    players.sort((a, b) => b.discovered - a.discovered);

    if (listContainer) {
      if (players.length === 0) {
        listContainer.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:20px;">Aucun mage enregistré pour le moment.</div>';
        return;
      }

      const totalUnique = (typeof loots !== 'undefined' && loots.length) ? loots.length : 464;
      let html = '';

      players.forEach((p, index) => {
        const rank = index + 1;
        const pct = totalUnique > 0 ? Math.round((p.discovered / totalUnique) * 100) : 0;
        let podiumClass = '';
        if (rank === 1) podiumClass = 'podium-1';
        else if (rank === 2) podiumClass = 'podium-2';
        else if (rank === 3) podiumClass = 'podium-3';

        let rankDisplay = `#${rank}`;
        if (rank === 1) rankDisplay = '👑 1';
        else if (rank === 2) rankDisplay = '🥈 2';
        else if (rank === 3) rankDisplay = '🥉 3';

        html += `
          <div class="lb-row ${podiumClass}">
            <div class="lb-rank">${rankDisplay}</div>
            <div class="lb-pseudo" title="${escapeLeaderboardHtml(p.pseudo)}">${escapeLeaderboardHtml(p.pseudo)}</div>
            <div class="lb-score">${p.discovered} / ${totalUnique} obj.</div>
            <div class="lb-percent">${pct}%</div>
          </div>
        `;
      });

      listContainer.innerHTML = html;
    }
  } catch (err) {
    console.error("Erreur chargement leaderboard:", err);
    if (listContainer) {
      listContainer.innerHTML = '<div style="text-align:center;color:var(--c-a);padding:20px;">❌ Impossible de charger le classement depuis le Cloud.</div>';
    }
  }
}

function closeLeaderboardModal() {
  const modal = document.getElementById('leaderboard-modal');
  if (modal) modal.style.display = 'none';
}

function escapeLeaderboardHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// PONT CLICKER → FRAGMENTS (idempotent : earned − déjà réclamé)
function claimClickerFragments(cloudEarned) {
  let earned = cloudEarned || 0;
  try { const c = JSON.parse(localStorage.getItem('coffre-clicker') || '{}'); earned = Math.max(earned, (c.fr && c.fr.earned) || 0); } catch (e) {}
  const d = earned - (state.clickerClaimed || 0);
  if (d <= 0) return;
  state.clickerClaimed = earned;
  state.fragments = (state.fragments || 0) + d;
  let k = 0;
  while (state.fragments >= FRAGS_PER_KEY) { state.fragments -= FRAGS_PER_KEY; state.keys++; k++; }
  saveState(); updateTimer();
  if (k) document.getElementById('open-btn').disabled = false;
  showToast('✦ Clicker : +' + d + ' fragment(s)' + (k ? ' → +' + k + ' clé(s) !' : ''), k ? 7000 : 5000);
  if (k) { _pendingKeyFx += k; if (_booted) setTimeout(runPendingKeyFx, 400); }
}

// ============================================================
// ARRIVÉE D'UNE CLÉ GAGNÉE AU CLICKER : la clé d'or (5 éclats collés, joyau rouge) apparaît, puis vole se loger dans l'icône de clé
// ============================================================
let _pendingKeyFx = 0, _glowIdx = -1;
function goldKeySvg(){
  let sd = 7; const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647, f1 = n => n.toFixed(1);   // mêmes cassures que dans le Clicker
  const P = a => a.map((p, i) => (i ? 'L' : 'M') + f1(p[0]) + ' ' + f1(p[1])).join('');
  const zig = B => Array.from({ length: 9 }, (_, i) => [-2 + (i + (i > 0 && i < 8 ? (rnd() - .5) * .6 : 0)) * 5.5, B + (rnd() - .5) * 8]);
  const cr = [70, 52, 36, 20].map(zig).map(z => '<path d="' + P(z) + '" fill="none" stroke="#241702" stroke-width="1"/><path d="' + P(z) + '" transform="translate(0 1)" fill="none" stroke="rgba(255,236,170,.7)" stroke-width=".5"/>').join('');
  return '<svg viewBox="0 0 40 112" width="100%" height="100%"><defs><linearGradient id="kfg" gradientUnits="userSpaceOnUse" x1="2" y1="0" x2="38" y2="0"><stop offset="0" stop-color="#8a6a1d"/><stop offset=".3" stop-color="#fff1b0"/><stop offset=".55" stop-color="#e8c04a"/><stop offset="1" stop-color="#7a5a14"/></linearGradient>'
    + '<radialGradient id="kfm" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#fda4af"/><stop offset=".45" stop-color="#e11d48"/><stop offset="1" stop-color="#7f1030"/></radialGradient>'
    + '<clipPath id="kfc"><circle cx="20" cy="92" r="19"/><rect x="15" y="6" width="10" height="78" rx="3"/><rect x="24" y="4" width="14" height="10" rx="1.5"/><rect x="24" y="22" width="10" height="8" rx="1.5"/><rect x="24" y="40" width="8" height="7" rx="1.5"/></clipPath></defs>'
    + '<g fill="url(#kfg)" stroke="#fde68a" stroke-width=".9"><circle cx="20" cy="92" r="19"/><rect x="15" y="6" width="10" height="78" rx="3"/><rect x="24" y="4" width="14" height="10" rx="1.5"/><rect x="24" y="22" width="10" height="8" rx="1.5"/><rect x="24" y="40" width="8" height="7" rx="1.5"/></g>'
    + '<g clip-path="url(#kfc)">' + cr + '</g><circle cx="20" cy="92" r="13.5" fill="none" stroke="#5b3f0c" stroke-width=".9" opacity=".85"/>'
    + '<g transform="translate(20 92)"><circle r="9.4" fill="none" stroke="#5b3f0c" stroke-width="1.2"/><circle r="7.4" fill="url(#kfm)" stroke="#6b1020" stroke-width=".8"/><path d="M-7.4 0L0-7.4L7.4 0L0 7.4Z M-3.7-3.7L3.7 3.7M3.7-3.7L-3.7 3.7" fill="none" stroke="rgba(255,255,255,.32)" stroke-width=".5"/><ellipse cx="-2.4" cy="-3.1" rx="2" ry="1.1" fill="rgba(255,255,255,.8)" transform="rotate(-35 -2.4 -3.1)"/></g></svg>';
}
function runPendingKeyFx(){
  const n = Math.min(_pendingKeyFx, 3); _pendingKeyFx = 0; if (!n) return;
  const rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const icons = () => [...document.querySelectorAll('#keys-icons .key-icon')];
  const run = i => {
    const idx = Math.max(0, state.keys - n + i), target = icons()[idx]; if (!target) return;
    const t = target.getBoundingClientRect(), cx = t.left + t.width / 2, cy = t.top + t.height / 2;
    const glow = () => { _glowIdx = idx; updateTimer(); setTimeout(() => { if (_glowIdx === idx) { _glowIdx = -1; updateTimer(); } }, 2200); };
    if (rm || !document.body.animate) { glow(); return; }
    const H = 112 / 40 * 54, sx = innerWidth / 2 - 27, sy = Math.max(70, innerHeight * .32) - H / 2;   // taille de départ : 54 × 151 px
    const k = document.createElement('div'); k.className = 'kfx'; k.style.cssText = 'width:54px;height:' + H + 'px'; k.innerHTML = goldKeySvg(); document.body.append(k);
    const endS = 30 / H;
    const appear = k.animate([{ transform: 'translate(' + sx + 'px,' + (sy + 40) + 'px) scale(.2) rotate(-25deg)', opacity: 0 }, { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(1.15) rotate(6deg)', opacity: 1, offset: .55 }, { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(1) rotate(0)', opacity: 1 }], { duration: 900, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'forwards' });
    appear.onfinish = () => {
      for (let g = 3; g >= 0; g--) {                     // traînée : 3 fantômes + la clé
        const el = g ? k.cloneNode(true) : k; if (g) { el.style.opacity = ''; document.body.append(el); }
        const fly = el.animate([{ transform: 'translate(' + sx + 'px,' + sy + 'px) scale(1) rotate(0)', opacity: g ? .5 - g * .12 : 1 },
          { transform: 'translate(' + (sx + (cx - 27 - sx) * .35) + 'px,' + (sy - 50) + 'px) scale(.8) rotate(-14deg)', opacity: g ? .4 - g * .1 : 1, offset: .4 },
          { transform: 'translate(' + (cx - 27) + 'px,' + (cy - H / 2) + 'px) scale(' + endS + ') rotate(0)', opacity: g ? 0 : 1 }], { duration: 850, delay: g * 70, easing: 'cubic-bezier(.55,0,.75,.35)', fill: 'forwards' });
        fly.onfinish = () => { el.remove(); if (!g) {
          const ring = document.createElement('div'); ring.className = 'kfx-ring'; ring.style.transform = 'translate(' + cx + 'px,' + cy + 'px)'; document.body.append(ring);
          ring.animate([{ transform: 'translate(' + cx + 'px,' + cy + 'px) scale(.4)', opacity: 1 }, { transform: 'translate(' + cx + 'px,' + cy + 'px) scale(3)', opacity: 0 }], { duration: 700, easing: 'ease-out' }).onfinish = () => ring.remove();
          glow(); if (i + 1 < n) setTimeout(() => run(i + 1), 250);
        } };
      }
    };
  };
  run(0);
}

// --- PROFIL UTILISATEUR & GESTION DU COMPTE ---
let isProfileOpen = false;

function toggleProfilePanel() {
  isProfileOpen = !isProfileOpen;
  const invView = document.getElementById('inventory-view');
  const profPanel = document.getElementById('profile-panel');
  const titleText = document.getElementById('sidebar-title-text');
  const gridView = document.getElementById('profile-grid-view');
  const detailView = document.getElementById('profile-detail-view');

  if (isProfileOpen) {
    if (invView) invView.style.display = 'none';
    if (profPanel) profPanel.style.display = 'flex';
    if (gridView) gridView.style.display = 'grid';
    if (detailView) detailView.style.display = 'none';
    if (titleText) titleText.textContent = '✦ Profil & Modules';
  } else {
    if (invView) invView.style.display = 'flex';
    if (profPanel) profPanel.style.display = 'none';
    if (titleText) titleText.textContent = '✦ Inventaire';
  }
}

function openProfileDetail() {
  const gridView = document.getElementById('profile-grid-view');
  const detailView = document.getElementById('profile-detail-view');
  const titleText = document.getElementById('sidebar-title-text');

  if (gridView) gridView.style.display = 'none';
  if (detailView) detailView.style.display = 'flex';
  if (titleText) titleText.textContent = '✦ Profil du Mage';
  const pseudoInput = document.getElementById('profile-pseudo-input');
  if (pseudoInput) pseudoInput.value = state.pseudo || '';
}

function closeProfileDetail() {
  const gridView = document.getElementById('profile-grid-view');
  const detailView = document.getElementById('profile-detail-view');
  const titleText = document.getElementById('sidebar-title-text');

  if (gridView) gridView.style.display = 'grid';
  if (detailView) detailView.style.display = 'none';
  if (titleText) titleText.textContent = '✦ Profil & Modules';
}

function openPromoCodeModal() {
  const modal = document.getElementById('promo-modal');
  const input = document.getElementById('promo-code-input');
  const msg = document.getElementById('promo-msg');
  if (modal) modal.style.display = 'flex';
  if (input) input.value = '';
  if (msg) {
    msg.textContent = '';
    msg.style.color = '#94a3b8';
    msg.style.fontWeight = 'bold';
  }
}

function closePromoCodeModal() {
  const modal = document.getElementById('promo-modal');
  if (modal) modal.style.display = 'none';
}

// =============================================================
// PROMO CODE VALIDATION
// =============================================================
async function validatePromoCode() {
  const input = document.getElementById('promo-code-input');
  const msgEl = document.getElementById('promo-msg');
  if (!input || !msgEl) return;
  const code = input.value.trim().toUpperCase();

  if (!code) {
    msgEl.textContent = "Veuillez entrer un code promotionnel.";
    msgEl.style.color = "#94a3b8";
    msgEl.style.fontWeight = "bold";
    return;
  }

  msgEl.textContent = "Vérification du code en cours…";
  msgEl.style.color = "#94a3b8";
  msgEl.style.fontWeight = "bold";

  try {
    const db = window.db || window.firebaseAuth?.db;
    if (!db) {
      throw new Error("Base de données Cloud non connectée.");
    }

    const currentUser = window.auth?.currentUser;
    if (!currentUser || !currentUser.uid) {
      throw new Error("Vous devez être connecté avec Google pour utiliser un code.");
    }
    const currentUid = currentUser.uid;

    const docRef = window.doc(db, "promo_codes", code);

    let keysToAdd = 1;
    await window.runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) {
        throw new Error("Code promotionnel inconnu ou invalide.");
      }
      const data = docSnap.data();

      // DEBUG TOTAL DANS LA CONSOLE DU NAVIGATEUR (F12)
      console.log("-----------------------------------------");
      console.log("CODE TESTÉ :", code);
      console.log("UID DU JOUEUR ACTUEL :", `"${currentUid}"`);
      console.log("ASSIGNEDTO DANS FIRESTORE :", `"${data.assignedTo}"`);
      console.log("-----------------------------------------");

      // VÉRIFICATION DE LA DATE D'EXPIRATION (Commune à tous les codes périssables)
      if (data.expiresAt) {
        const expDate = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
        if (expDate < new Date()) {
          throw new Error("Ce code promotionnel a expiré.");
        }
      }

      keysToAdd = data.keysReward || 1;
      const nowIso = new Date().toISOString();

      // 1. CAS DU CODE INDIVIDUEL (assignedTo)
      if (data.assignedTo !== undefined && data.assignedTo !== null && String(data.assignedTo).trim() !== "") {
        if (String(currentUid).trim() !== String(data.assignedTo).trim()) {
          throw new Error("STOP : Ce code promotionnel est attribué à un autre compte !");
        }
        if (data.used === true) {
          throw new Error("Ce code individuel a déjà été utilisé.");
        }

        transaction.update(docRef, {
          used: true,
          usedBy: currentUid,
          usedAt: nowIso
        });
        return; // Quitte net pour les codes individuels
      }

      // 2. CAS DU CODE UNIVERSEL (redeemedBy / redeemedDetails)
      const redeemedByList = data.redeemedBy || [];
      if (redeemedByList.includes(currentUid)) {
        throw new Error("Vous avez déjà utilisé ce code promotionnel.");
      }

      if (data.used === true) {
        throw new Error("Ce code a déjà été utilisé.");
      }

      // On met à jour la liste des UIDs et on ajoute l'historique détaillé horodaté
      const updatedRedeemedBy = [...redeemedByList, currentUid];
      const redeemedDetails = data.redeemedDetails || [];
      redeemedDetails.push({
        uid: currentUid,
        usedAt: nowIso
      });

      transaction.update(docRef, {
        redeemedBy: updatedRedeemedBy,
        redeemedDetails: redeemedDetails
      });
    });

    state.keys = (state.keys || 0) + keysToAdd;
    saveState();
    updateTimer();
    const openBtn = document.getElementById('open-btn');
    if (openBtn) openBtn.disabled = false;

    msgEl.textContent = `✨ Succès ! +${keysToAdd} clé(s) créditée(s) avec succès.`;
    msgEl.style.color = "#4ade80";
    msgEl.style.fontWeight = "bold";
    showToast(`🎟️ Code validé : +${keysToAdd} clé(s) !`);
  } catch (err) {
    console.error("Erreur promo code:", err);
    msgEl.textContent = err.message || "Code promotionnel invalide.";
    msgEl.style.color = "#f87171";
    msgEl.style.fontWeight = "bold";
  }
}
// FIN PROMO CODE VALIDATION
// =============================================================


async function saveProfilePseudo() {
  const input = document.getElementById('profile-pseudo-input');
  if (!input) return;
  const newPseudo = input.value.trim();
  if (!newPseudo) {
    showToast('❌ Le pseudo ne peut pas être vide.');
    return;
  }
  state.pseudo = newPseudo;
  saveState();

  if (window.firebaseAuth && window.firebaseAuth.auth && window.firebaseAuth.auth.currentUser) {
    try {
      const user = window.firebaseAuth.auth.currentUser;
      const { db, doc, setDoc } = window.firebaseAuth;
      await setDoc(doc(db, "players", user.uid), {
        pseudo: newPseudo,
        discovered: Object.keys(state.inventory).filter(k => (state.inventory[k]||0)>0).length,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error("Erreur sync pseudo cloud:", err);
    }
  }

  showToast('✨ Pseudo mis à jour avec succès !');
  renderInventory();
}

function checkAppUpdate() {
  showToast('🔄 Vérification des mises à jour en cours...');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.update();
      }
      setTimeout(() => {
        showToast('✨ Cache mis à jour ! Rechargement...');
        setTimeout(() => window.location.reload(), 1000);
      }, 1200);
    }).catch(() => {
      window.location.reload();
    });
  } else {
    window.location.reload();
  }
}

function confirmLogout() {
  const modal = document.getElementById('profile-action-modal');
  const title = document.getElementById('profile-modal-title');
  const body = document.getElementById('profile-modal-body');
  const inputWrap = document.getElementById('profile-modal-input-wrap');
  const confirmBtn = document.getElementById('profile-modal-confirm-btn');

  if (modal && title && body && confirmBtn) {
    title.textContent = '🚪 Déconnexion du Compte';
    body.innerHTML = 'Êtes-vous sûr de vouloir vous déconnecter de votre session Google sur cet appareil ? Vos données Cloud restent sauvegardées.';
    if (inputWrap) inputWrap.style.display = 'none';
    confirmBtn.textContent = 'Se déconnecter';
    confirmBtn.className = 'share-btn';
    confirmBtn.style.background = 'rgba(244,63,94,0.15)';
    confirmBtn.style.borderColor = 'rgba(244,63,94,0.4)';
    confirmBtn.style.color = '#f43f5e';
    confirmBtn.onclick = executeLogout;
    modal.style.display = 'flex';
  }
}

async function executeLogout() {
  closeProfileActionModal();
  if (window.auth) {
    try {
      if (_dirty) await syncState('logout');                  // rien ne doit rester non synchronisé avant de quitter le compte
      await window.signOut(window.auth);
      showToast('👋 Déconnexion réussie.');
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      showToast('❌ Erreur lors de la déconnexion.');
    }
  } else {
    window.location.reload();
  }
}

function confirmWipeData() {
  const modal = document.getElementById('profile-action-modal');
  const title = document.getElementById('profile-modal-title');
  const body = document.getElementById('profile-modal-body');
  const inputWrap = document.getElementById('profile-modal-input-wrap');
  const confirmInput = document.getElementById('profile-modal-confirm-input');
  const confirmBtn = document.getElementById('profile-modal-confirm-btn');

  if (modal && title && body && confirmBtn) {
    title.textContent = '💥 Effacement Total des Données';
    body.innerHTML = '<b>ATTENTION :</b> Cette action est irréversible. Toutes vos clés, fragments, objets et progression locale seront définitivement supprimés.<br><br>Tapez <b>SUPPRIMER</b> ci-dessous pour confirmer :';
    if (inputWrap) inputWrap.style.display = 'block';
    if (confirmInput) confirmInput.value = '';
    confirmBtn.textContent = 'Effacer définitivement';
    confirmBtn.className = 'share-btn share-btn-danger';
    confirmBtn.style.background = '';
    confirmBtn.style.borderColor = '';
    confirmBtn.style.color = '';
    confirmBtn.onclick = executeWipeData;
    modal.style.display = 'flex';
  }
}

function executeWipeData() {
  const confirmInput = document.getElementById('profile-modal-confirm-input');
  if (!confirmInput || confirmInput.value.trim() !== 'SUPPRIMER') {
    showToast('❌ Veuillez taper SUPPRIMER pour confirmer.');
    return;
  }
  closeProfileActionModal();
  localStorage.clear();
  showToast('💥 Données effacées. Réinitialisation...');
  setTimeout(() => window.location.reload(), 1000);
}

function closeProfileActionModal() {
  const modal = document.getElementById('profile-action-modal');
  if (modal) modal.style.display = 'none';
}
