'use strict';
// Envoie les notifications push arrivées à échéance. Lancé toutes les 10 min par .github/workflows/send-push.yml
//
// Données lues (Firestore, collection `push`, un document par joueur — écrites par le jeu, voir NOTIFICATIONS.md) :
//   tokens   : { <adresse> : { t: <jeton FCM>, url: <adresse du Coffre> } }   (null = désactivé)
//   keysAt   : heure (ms) où les clés du Coffre sont toutes rechargées
//   clickerAt: heure (ms) estimée où le flux passif du Clicker forme une clé
// Variables d'environnement : FIREBASE_SERVICE_ACCOUNT (JSON du compte de service) · DRY_RUN=1 (aucun envoi, aucune écriture) · FORCE_SEND=1
//
// SÉCURITÉ : le dépôt de TEST partage le même Firebase que le dépôt OFFICIEL → hors dépôt officiel, on reste en simulation (sauf FORCE_SEND=1).

const OFFICIAL_REPO = 'moulecake/coffre_des_arcanes';
const STALE_MS = 48 * 3600e3;            // une échéance dépassée de plus de 48 h n'est plus envoyée (juste effacée)
const KINDS = {
  keysAt:    { tag: 'keys',    title: '🔑 Tes clés sont rechargées !', body: 'Les clés du Coffre des Arcanes t’attendent. Viens ouvrir un coffre !' },
  clickerAt: { tag: 'clicker', title: '✦ Une clé est prête !',        body: 'Ton Clicker a produit une nouvelle clé : viens la récupérer dans le Coffre.' }
};
const DEAD_TOKEN_CODES = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument'];

// Fonction pure (testée) : que faut-il faire pour ce document à l'instant `now` ?
function planDoc(data, now) {
  const plan = { sends: [], clear: [] };
  const tokens = Object.entries((data && data.tokens) || {}).filter(([, v]) => v && v.t).map(([key, v]) => ({ key, token: v.t, url: v.url }));
  for (const field of Object.keys(KINDS)) {
    const at = data && data[field];
    if (typeof at !== 'number' || at > now) continue;     // pas encore l'heure (ou pas d'échéance)
    plan.clear.push({ field, at });                       // dans tous les cas, l'échéance est consommée
    if (!tokens.length || now - at > STALE_MS) continue;  // aucun appareil, ou échéance trop ancienne : pas d'envoi
    plan.sends.push({ field, ...KINDS[field], tokens });
  }
  return plan;
}

async function main() {
  const admin = require('firebase-admin');
  const dry = process.env.DRY_RUN === '1' || (!!process.env.GITHUB_REPOSITORY && process.env.GITHUB_REPOSITORY !== OFFICIAL_REPO && process.env.FORCE_SEND !== '1');
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) { console.error('FIREBASE_SERVICE_ACCOUNT manquant (secret GitHub).'); process.exit(1); }
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const db = admin.firestore(), messaging = admin.messaging(), now = Date.now();
  console.log(`[push] ${new Date(now).toISOString()} — ${dry ? 'SIMULATION (aucun envoi)' : 'ENVOI RÉEL'}`);

  const due = new Map();                                   // uid → doc (deux requêtes : une par type d'échéance)
  for (const field of Object.keys(KINDS)) {
    const snap = await db.collection('push').where(field, '<=', now).get();
    snap.forEach(d => due.set(d.id, d));
  }
  console.log(`[push] ${due.size} joueur(s) avec une échéance dépassée`);

  let sent = 0, failed = 0, cleared = 0;
  for (const [uid, docSnap] of due) {
    const plan = planDoc(docSnap.data(), now), ref = docSnap.ref, dead = [];
    for (const s of plan.sends) {
      for (const t of s.tokens) {
        const msg = { token: t.token, data: { title: s.title, body: s.body, tag: s.tag, url: t.url || '' }, webpush: { headers: { TTL: '86400', Urgency: 'normal' } } };
        if (dry) { console.log(`  (simulation) ${uid.slice(0, 6)}… ← ${s.tag} → ${t.key}`); continue; }
        try { await messaging.send(msg); sent++; console.log(`  envoyé ${uid.slice(0, 6)}… ← ${s.tag}`); }
        catch (e) { failed++; console.warn(`  échec ${uid.slice(0, 6)}… ${s.tag} : ${e.code || e.message}`); if (DEAD_TOKEN_CODES.includes(e.code)) dead.push(t.key); }
      }
    }
    if (dry) continue;
    // On efface l'échéance seulement si elle n'a pas été modifiée entre-temps par le jeu (transaction) ; jetons morts supprimés.
    await db.runTransaction(async tx => {
      const cur = (await tx.get(ref)).data() || {}, upd = {};
      for (const c of plan.clear) if (cur[c.field] === c.at) { upd[c.field] = null; cleared++; }
      for (const k of dead) upd['tokens.' + k] = admin.firestore.FieldValue.delete();
      if (Object.keys(upd).length) tx.update(ref, upd);
    });
  }
  console.log(`[push] terminé : ${sent} envoyée(s), ${failed} échec(s), ${cleared} échéance(s) effacée(s).`);
}

module.exports = { planDoc, KINDS };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
