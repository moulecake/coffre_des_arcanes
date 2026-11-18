// Bâtiments passifs : coût 15% exponentiel, paliers x2 à 10/25/50/100. Voile = Éther (nL) · Grimoire = Sagesse.
const Passives = (() => {
  const T = [10, 25, 50, 100], tm = n => 2 ** T.filter(t => n >= t).length, own = id => S.b[id] || 0;
  const L = [
    { id: "anc", s: "V", n: "Ancrage Runique",     ic: "⬡", base: 15,   d: "+1 nL/s" },
    { id: "pyl", s: "V", n: "Pylône de Stase",     ic: "▲", base: 150,  d: "0,5 impulsion/s (= 1 clic)", p: "anc" },
    { id: "bou", s: "V", n: "Boussole Arcanique",  ic: "◎", base: 1200, d: "+1% micro-critique passif (×5)", p: "pyl" },
    { id: "lut", s: "G", n: "Lutin Scribe",        ic: "✎", base: 20,   d: "0,5 page/s" },
    { id: "bgi", s: "G", n: "Bougie d'Invocation", ic: "♨", base: 120,  d: "+20% Sg par page passive", p: "lut" },
    { id: "hom", s: "G", n: "Homoncule Liseur",    ic: "☿", base: 600,  d: "+5% de pages rares", p: "bgi" }
  ];
  const cost = b => Math.ceil(b.base * 1.15 ** own(b.id) * M(b.s === "G" ? "sgCost" : "ethCost", 1));
  const calc = () => {
    const a = own("anc"), p = own("pyl"), b = own("bou"), l = own("lut"), c = own("bgi"), h = own("hom");
    const flat = a * tm(a) * M("passive", 1), clickV = 1 + .02 * flat, crit = Math.min(.5, .01 * b * tm(b));
    const ethPS = (flat + (p * .5 * tm(p) * M("pylon", 1) + M("famil", 0)) * clickV) * (1 + crit * 4) * M("ether", 1);
    const pagesPS = l * .5 * tm(l) * M("scribe", 1) + M("pagesFlat", 0), sgPage = 1 + .2 * c * tm(c), sgPS = pagesPS * sgPage * M("sg", 1);
    return { clickV, ethPS, pagesPS, sgPage, sgPS, pageClick: 1 + .02 * sgPS, rare: (1 + .05 * h) * tm(h) };
  };
  const buy = b => {
    const k = b.s === "G" ? "sg" : "eth", c = cost(b);
    if (S[k] < c) return;
    S[k] -= c; S.b[b.id] = own(b.id) + 1; save(); update();
  };
  const build = (el, s) => L.filter(b => b.s === s).forEach(b => {
    const d = document.createElement("div");
    d.className = "bld"; d.id = "b_" + b.id;
    d.innerHTML = "<i>" + b.ic + "</i><div><b>" + b.n + "</b> <em></em><small>" + b.d + "</small></div><span class='px'></span>";
    d.onclick = () => buy(b); el.append(d);
  });
  const update = () => L.forEach(b => {
    const d = document.getElementById("b_" + b.id), n = own(b.id), c = cost(b), nx = T.find(t => t > n);
    d.hidden = !(!b.p || own(b.p) > 0 || n > 0);                       // teasing N+1
    d.classList.toggle("can", S[b.s === "G" ? "sg" : "eth"] >= c);
    d.querySelector("em").textContent = "×" + n + (nx ? " · palier " + nx : " · max");
    d.querySelector(".px").textContent = b.s === "G" ? fN(c) + " Sg" : fE(c);
  });
  return { calc, build, update, L };
})();
