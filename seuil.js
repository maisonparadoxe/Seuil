// ===================================================================
// SEUIL : prototype jouable.
// Un labyrinthe de portes, dans l'esprit de Blue Prince : chaque porte
// est scellée par une énigme ; si on la résout, on choisit une salle
// parmi trois et on avance. Les pas sont comptés. Une porte ratée reste
// condamnée. Tout est dans ce fichier : aucune dépendance, pas de serveur.
// ===================================================================
(function () {
  "use strict";

  // ------------------------------------------------------------------
  // Constantes et petits outils
  // ------------------------------------------------------------------
  const ROWS = 9;
  const COLS = 5;
  const START = { r: 8, c: 2 };
  const GOAL = { r: 0, c: 2 };
  const START_STEPS = 45;
  const DIRS = [
    { dr: -1, dc: 0, nom: "nord", fleche: "↑" },
    { dr: 0, dc: 1, nom: "est", fleche: "→" },
    { dr: 1, dc: 0, nom: "sud", fleche: "↓" },
    { dr: 0, dc: -1, nom: "ouest", fleche: "←" },
  ];
  const opp = (d) => (d + 2) % 4;
  const inGrid = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
  // ------------------------------------------------------------------
  // Hasard à graine. Tout l'aléatoire d'une partie passe par R, qui est
  // toujours un flux dérivé de la graine et d'un nom (porte, pioche, énigme...).
  // Deux joueurs qui ont la même graine voient donc la même partie, même s'ils
  // ne font pas les mêmes choix : chaque flux ne dépend que de son nom.
  // ------------------------------------------------------------------
  let R = Math.random;
  const rnd = (a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (a) => a[Math.floor(R() * a.length)];
  const shuffle = (a) => {
    const t = a.slice();
    for (let i = t.length - 1; i > 0; i--) {
      const j = Math.floor(R() * (i + 1));
      [t[i], t[j]] = [t[j], t[i]];
    }
    return t;
  };

  function hachage(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function avecFlux(nom, fn) {
    const prec = R;
    R = mulberry32(hachage(G.seed + "|" + nom));
    try {
      return fn();
    } finally {
      R = prec;
    }
  }

  const ALPHABET_GRAINE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function graineAleatoire() {
    let out = "";
    let oct = null;
    try {
      oct = crypto.getRandomValues(new Uint8Array(6));
    } catch (e) {}
    for (let i = 0; i < 6; i++) {
      const v = oct ? oct[i] : Math.floor(Math.random() * 256);
      out += ALPHABET_GRAINE[v % ALPHABET_GRAINE.length];
    }
    return out;
  }
  function normaliserGraine(t) {
    return String(t || "").trim().toUpperCase().replace(/\s+/g, "-").slice(0, 24);
  }
  function graineDuJour() {
    const d = new Date();
    const z = (n) => (n < 10 ? "0" : "") + n;
    return "JOUR-" + d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
  }

  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);

  // ------------------------------------------------------------------
  // Sons : on réutilise ceux du Bureau. Un fichier absent est ignoré.
  // ------------------------------------------------------------------
  let muet = false;
  try {
    muet = localStorage.getItem("seuil-muet") === "1";
  } catch (e) {}
  const sonsCache = {};
  function son(nom) {
    if (muet) return;
    try {
      let a = sonsCache[nom];
      if (a === null) return;
      if (!a) {
        a = new Audio("audio/" + nom + ".mp3");
        a.addEventListener("error", () => (sonsCache[nom] = null));
        sonsCache[nom] = a;
      }
      a.currentTime = 0;
      a.volume = 0.7;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }

  // ------------------------------------------------------------------
  // Les salles
  // Les portes sont données par rapport au sens de l'entrée :
  // F = en face, L = à gauche, R = à droite. La porte d'entrée existe toujours.
  // kind : pass (passage), bonus, trap (piège). max : nombre maximal par partie.
  // ------------------------------------------------------------------
  const SALLES = [
    { id: "galerie", nom: "Galerie", court: "Galerie", doors: ["F"], w: 12, kind: "pass", desc: "Un long couloir de pierre, usé par des siècles de pas." },
    { id: "coude", nom: "Coude", court: "Coude", doors: ["L"], mirror: true, w: 12, kind: "pass", desc: "Le couloir tourne brusquement." },
    { id: "fourche", nom: "Fourche", court: "Fourche", doors: ["F", "L"], mirror: true, w: 9, kind: "pass", desc: "Le chemin se sépare en deux." },
    { id: "te", nom: "Salle en T", court: "Salle en T", doors: ["L", "R"], w: 8, kind: "pass", desc: "Deux issues, à gauche et à droite." },
    { id: "croisee", nom: "Croisée", court: "Croisée", doors: ["F", "L", "R"], w: 6, kind: "pass", desc: "Un carrefour à quatre portes." },
    { id: "cellier", nom: "Cellier", court: "Cellier", doors: [], w: 5, max: 2, kind: "bonus", fx: { steps: 8 }, desc: "Des vivres laissés là par quelqu'un. Un cul-de-sac." },
    { id: "refectoire", nom: "Réfectoire", court: "Réfectoire", doors: ["L", "R"], w: 5, max: 2, kind: "bonus", fx: { steps: 5 }, desc: "Une longue table. Le pain est encore mangeable." },
    { id: "reliquaire", nom: "Reliquaire", court: "Reliquaire", doors: [], w: 4, max: 2, kind: "bonus", fx: { seals: 1 }, desc: "Un sceau des Gardiens, sous une cloche de verre. Un cul-de-sac." },
    { id: "forge", nom: "Forge froide", court: "Forge", doors: ["L"], mirror: true, w: 4, max: 2, kind: "bonus", fx: { dice: 1 }, desc: "Un établi, des moules, un dé de fondeur oublié." },
    { id: "sablier", nom: "Salle du sablier", court: "Sablier", doors: ["F"], w: 3, max: 2, kind: "bonus", fx: { time: 6 }, desc: "Un sablier géant. Le temps semble s'y écouler plus lentement." },
    { id: "puits", nom: "Puits aux salamandres", court: "Puits", doors: ["F"], w: 2, max: 1, kind: "bonus", fx: { steps: 3, dice: 1 }, desc: "L'eau y est claire. Des salamandres gravées tapissent la margelle." },
    { id: "sanctuaire", nom: "Sanctuaire", court: "Sanctuaire", doors: ["F", "L", "R"], w: 2, max: 1, kind: "bonus", fx: { steps: 4, seals: 1 }, desc: "Une salle calme, éclairée par une flamme qui ne vacille pas." },
    { id: "cristallerie", nom: "Cristallerie", court: "Cristaux", doors: ["F", "L"], mirror: true, w: 3, max: 2, kind: "bonus", fx: { gem: { axe: "H", max: 1 } }, desc: "Des cristaux taillés en losange, alignés sur une étagère. L'un d'eux vibre encore." },
    { id: "cave", nom: "Cave aux cristaux", court: "Cave", doors: ["L", "R"], w: 3, max: 2, kind: "bonus", fx: { gem: { axe: "V", max: 1 } }, desc: "Des cristaux dressés comme des stalagmites. Un seul est détachable." },
    { id: "engrenages", nom: "Salle des engrenages", court: "Engrenages", doors: ["F"], w: 2, max: 1, kind: "bonus", fx: { gem: { axe: "H", max: 2 } }, desc: "Un mécanisme colossal de Valcourt. Une gemme rare, encore chaude, dans son axe." },
    { id: "vents", nom: "Colonne des vents", court: "Colonne", doors: ["F"], w: 2, max: 1, kind: "bonus", fx: { gem: { axe: "V", max: 2 } }, desc: "Un puits d'air qui monte du sol. Une gemme rare flotte à mi-hauteur." },
    { id: "boutique", nom: "Boutique", court: "Boutique", doors: ["L", "R"], w: 4, max: 1, kind: "bonus", fx: { shop: true }, desc: "Un colporteur des Gardiens a posé son étal. On y achète des salles, on s'y débarrasse des mauvaises." },
    { id: "archives", nom: "Archives", court: "Archives", doors: ["F", "R"], mirror: true, w: 4, max: 3, kind: "bonus", fx: { fragment: 1 }, desc: "Des rayonnages de dossiers. Certains portent le nom de Valcourt." },
    { id: "fresque", nom: "Fresque des Gardiens", court: "Fresque", doors: ["L", "R"], w: 3, max: 2, kind: "bonus", fx: { fragment: 1 }, desc: "Des silhouettes en capuche gardent une porte. L'une d'elles tient une salamandre." },
    { id: "cabinet", nom: "Cabinet du serrurier", court: "Cabinet", doors: ["F"], w: 2, max: 1, kind: "bonus", fx: { fragment: 1, steps: 3 }, desc: "Un bureau encombré de pênes et de ressorts. Quelqu'un a travaillé ici." },
    { id: "lames", nom: "Salle des lames", court: "Lames", doors: ["F", "L"], mirror: true, w: 3, max: 2, kind: "trap", fx: { steps: -5 }, desc: "Des lames sortent du mur au moindre pas. Vous vous en tirez, mais pas gratuitement." },
    { id: "eboulis", nom: "Éboulement", court: "Éboulis", doors: ["F"], w: 3, max: 2, kind: "trap", fx: { steps: -3 }, desc: "La voûte a cédé. Il faut contourner les gravats." },
  ];
  const SALLES_PAR_ID = {};
  SALLES.forEach((t) => (SALLES_PAR_ID[t.id] = t));
  const PLAFOND_DECK = 15;
  const DECK_MINI = 4; // on ne peut pas retirer de carte en dessous
  const GAIN_PORTE = { 1: 2, 2: 3, 3: 5 }; // pièces par énigme résolue, selon le niveau de la porte
  const RECOMPENSE_PAR_NIVEAU = { 1: 0, 2: 0.5, 3: 1 }; // chance qu'une porte offre une carte
  const PRIX_CARTE_COURANTE = 6;
  const PRIX_CARTE_SPECIALE = 10;
  const PRIX_RETRAIT = 5; // +2 à chaque retrait
  const SALLES_MARCHAND = 10; // un marchand de passage toutes les 10 salles posées
  // Deck de départ : [salle, thème]. La couleur d'une carte est fixe.
  const DECK_DEPART = [
    ["galerie", "chiffres"],
    ["galerie", "mots"],
    ["coude", "logique"],
    ["coude", "symboles"],
    ["fourche", "chiffres"],
    ["te", "mots"],
    ["refectoire", "logique"],
    ["cellier", null],
  ];
  const HALL = { id: "hall", nom: "Vestibule", court: "Vestibule", kind: "start", desc: "Un vestibule glacé. Sur le linteau, une salamandre et ces mots : NUTRISCO ET EXTINGUO." };
  const CHAMBRE = { id: "chambre", nom: "Chambre des Gardiens", court: "Chambre", kind: "goal", desc: "Le cœur du labyrinthe." };

  const FRAGMENTS = [
    "Une carte de visite : « A. Valcourt, serrurier-inventeur. Sécurité sur mesure. » Au dos, une salamandre à l'encre.",
    "Un carnet de commandes : douze portes « sans clé, sans force, avec la tête », pour un client qui ne signe jamais.",
    "Une note de Valcourt : « Le client veut que ne passe que celui qui sait compter, lire ou attendre. »",
    "Gravé dans la pierre, à hauteur d'homme : NUTRISCO ET EXTINGUO. Quelqu'un l'a souligné au crayon.",
    "Un plan déchiré : les salles changent de place quand personne ne les regarde. Valcourt l'avait déjà remarqué.",
    "Le dernier mot de Valcourt, au crayon : « Je ne suis pas perdu. Je suis gardé. »",
  ];

  // ------------------------------------------------------------------
  // Énigmes : simples pour le prototype, à enrichir plus tard.
  // ------------------------------------------------------------------
  const MOTS = [
    // [niveau, bonne orthographe, fautes possibles]
    [1, "rythme", ["rithme", "rytme"]],
    [1, "mystère", ["mistère", "mysthère"]],
    [1, "ennemi", ["énemi", "ennémi"]],
    [1, "labyrinthe", ["labyrinte", "labirynthe"]],
    [1, "souterrain", ["soutterrain", "souterin"]],
    [1, "sanctuaire", ["sanctuère", "santuaire"]],
    [1, "grimoire", ["grimoir", "grimoîre"]],
    [2, "phénomène", ["fénomène", "phénomêne"]],
    [2, "connaissance", ["connaisance", "conaissance"]],
    [2, "apparence", ["aparence", "apparance"]],
    [2, "nécessaire", ["nécéssaire", "necéssaire"]],
    [2, "cérémonie", ["cérémonnie", "cèrémonie"]],
    [2, "incantation", ["incantacion", "encantation"]],
    [2, "sarcophage", ["sarcofage", "sarcophague"]],
    [2, "occurrence", ["occurence", "ocurrence"]],
    [2, "asthme", ["asme", "astme"]],
    [3, "exhaustif", ["exaustif", "exhausthif"]],
    [3, "hiéroglyphe", ["hiéroglife", "hiéroglyffe"]],
    [3, "ésotérique", ["ésotérrique", "ésoterique"]],
    [3, "acquérir", ["aquérir", "acquérrir"]],
    [3, "développement", ["dévelopement", "développment"]],
    [3, "parallèle", ["paralèle", "parallelle"]],
    [3, "rhinocéros", ["rinocéros", "rhinocérosse"]],
    [3, "oxygène", ["oxigène", "oxygéne"]],
  ];

  function suiteTexte(termes) {
    return termes.join(", ") + ", ?";
  }

  const GEN = {
    add(l) {
      const [lo, hi] = [[10, 60], [100, 500], [200, 900]][l - 1];
      const a = rnd(lo, hi), b = rnd(lo, hi);
      return { kind: "num", label: "Addition", text: `${a} + ${b}`, answer: a + b };
    },
    sub(l) {
      const [lo, hi] = [[30, 99], [200, 900], [500, 1500]][l - 1];
      const a = rnd(lo, hi);
      const b = rnd(Math.floor(a / 4), a - 1);
      return { kind: "num", label: "Soustraction", text: `${a} − ${b}`, answer: a - b };
    },
    mul(l) {
      let a, b;
      if (l === 1) { a = rnd(3, 9); b = rnd(3, 9); }
      else if (l === 2) { a = rnd(12, 25); b = rnd(3, 9); }
      else { a = rnd(12, 19); b = rnd(11, 19); }
      return { kind: "num", label: "Multiplication", text: `${a} × ${b}`, answer: a * b };
    },
    suite(l) {
      let t = [];
      if (l === 1) {
        const s = rnd(1, 20), k = rnd(2, 9);
        for (let i = 0; i < 6; i++) t.push(s + k * i);
      } else if (l === 2) {
        if (R() < 0.5) {
          const s = rnd(1, 5), q = pick([2, 3]);
          for (let i = 0; i < 6; i++) t.push(s * Math.pow(q, i));
        } else {
          const s = rnd(1, 10), a = rnd(2, 5), b = rnd(6, 9);
          t.push(s);
          for (let i = 1; i < 6; i++) t.push(t[i - 1] + (i % 2 ? a : b));
        }
      } else {
        const type = pick(["carres", "fib", "double"]);
        if (type === "carres") {
          const n = rnd(2, 6);
          for (let i = 0; i < 6; i++) t.push((n + i) * (n + i));
        } else if (type === "fib") {
          t = [rnd(1, 4), rnd(2, 6)];
          for (let i = 2; i < 6; i++) t.push(t[i - 1] + t[i - 2]);
        } else {
          t = [rnd(1, 3)];
          for (let i = 1; i < 6; i++) t.push(t[i - 1] * 2 + 1);
        }
      }
      const answer = t[5];
      return { kind: "num", label: "Suite logique", text: suiteTexte(t.slice(0, 5)), answer };
    },
    anagramme(l) {
      const liste = MOTS.filter((m) => m[0] === l);
      const m = pick(liste);
      const lettres = m[1].split("");
      let melange = lettres.slice();
      for (let i = 0; i < 30 && melange.join("") === m[1]; i++) melange = shuffle(lettres);
      const autres = shuffle(liste.filter((x) => x[1] !== m[1])).slice(0, 2).map((x) => x[1]);
      return {
        kind: "mcq", label: "Anagramme",
        text: "Remettez ces lettres dans l'ordre, puis choisissez le mot.",
        grand: melange.join(" ").toUpperCase(),
        options: shuffle([m[1], ...autres]), answer: m[1],
      };
    },
    intrus(l) {
      const k = pick([[3, 4, 5, 6], [7, 8, 9], [11, 12, 13]][l - 1]);
      const mx = [60, 100, 150][l - 1];
      const mult = [];
      while (mult.length < 3) {
        const v = k * rnd(2, Math.floor(mx / k));
        if (!mult.includes(v)) mult.push(v);
      }
      let intrus;
      do intrus = k * rnd(2, Math.floor(mx / k)) + rnd(1, k - 1);
      while (mult.includes(intrus));
      return {
        kind: "mcq", label: "Multiples",
        text: "Lequel de ces nombres n'est pas un multiple de " + k + " ?",
        options: shuffle([...mult, intrus]).map(String), answer: String(intrus),
      };
    },
    motif(l) {
      const SYM = ["▲", "●", "■", "◆", "★", "✚"];
      const p = l + 2;
      const base = shuffle(SYM).slice(0, p);
      const seq = [];
      for (let i = 0; i < 2 * p; i++) seq.push(base[i % p]);
      const answer = seq[2 * p - 1];
      const autres = shuffle(SYM.filter((x) => x !== answer)).slice(0, 2);
      return {
        kind: "mcq", label: "Motif", text: "Quel symbole vient ensuite ?",
        grand: seq.slice(0, 2 * p - 1).join(" ") + " ?",
        options: shuffle([answer, ...autres]), answer,
      };
    },
    compte(l) {
      const SYM = ["▲", "●", "■"];
      const n = [12, 20, 30][l - 1];
      const par = n === 12 ? 6 : 10;
      let cible, items, nb;
      do {
        cible = pick(SYM);
        items = [];
        nb = 0;
        for (let i = 0; i < n; i++) {
          const x = pick(SYM);
          items.push(x);
          if (x === cible) nb++;
        }
      } while (nb === 0);
      const lignes = [];
      for (let i = 0; i < n; i += par) lignes.push(items.slice(i, i + par).join(" "));
      return { kind: "num", label: "Comptage", consigne: "Combien de " + cible + " voyez-vous ?", text: lignes.join("\n"), grille: true, answer: nb };
    },
    ortho(l) {
      const liste = MOTS.filter((m) => m[0] === l);
      const m = pick(liste);
      const options = shuffle([m[1], ...m[2]]);
      return { kind: "mcq", label: "Orthographe", text: "Une seule de ces graphies est correcte.", options, answer: m[1] };
    },
  };

  function makePuzzle(level, theme) {
    const t = THEMES[theme] ? theme : pick(THEME_IDS);
    const p = GEN[pick(THEMES[t].gens)](level);
    p.level = level;
    p.theme = t;
    return p;
  }

  const TEMPS_BASE = { 1: 40, 2: 35, 3: 30 };

  // Les quatre thèmes. La couleur d'une salle est le thème des énigmes
  // qui gardent ses portes de sortie.
  const THEMES = {
    chiffres: { nom: "Chiffres", couleur: "#3F5B66", glyphe: "#", gens: ["add", "sub", "mul"] },
    mots: { nom: "Mots", couleur: "#9A2B25", glyphe: "A", gens: ["ortho", "anagramme"] },
    logique: { nom: "Logique", couleur: "#4C5A4E", glyphe: "?", gens: ["suite", "intrus"] },
    symboles: { nom: "Symboles", couleur: "#B98B2A", glyphe: "★", gens: ["motif", "compte"] },
  };
  const THEME_IDS = Object.keys(THEMES);

  // ------------------------------------------------------------------
  // État de la partie
  // ------------------------------------------------------------------
  let G = null; // la partie en cours ; null tant qu'on est au menu
  let timer = null;
  let pz = null; // énigme en cours { puzzle, restant, total, fini }

  function stats() {
    try {
      return JSON.parse(localStorage.getItem("seuil-stats") || "{}");
    } catch (e) {
      return {};
    }
  }
  function saveStats(s) {
    try {
      localStorage.setItem("seuil-stats", JSON.stringify(s));
    } catch (e) {}
  }

  function nouvellePartie(graine) {
    const seed = normaliserGraine(graine) || graineAleatoire();
    G = {
      seed,
      deck: [],
      pioche: [],
      defausse: [],
      melanges: 0,
      tirages: 0,
      coins: 0,
      retraits: 0,
      achats: 0,
      uidMax: 0,
      boutique: null,
      visite: null,
      boutiqueOfferte: false,
      steps: START_STEPS,
      dice: 1,
      seals: 1,
      timeBonus: 0,
      grid: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
      pos: { r: START.r, c: START.c },
      gems: [],
      shift: null,
      fragments: 0,
      log: [],
      moves: 0,
      rooms: 1,
      solved: 0,
      failed: 0,
      over: null,
      pending: null,
      draft: null,
    };
    G.deck = DECK_DEPART.map((d) => ({ uid: ++G.uidMax, id: d[0], theme: d[1] }));
    G.pioche = melanger(G.deck);
    G.grid[START.r][START.c] = { tpl: HALL, doors: [0, 1, 3], visited: true };
    G.grid[GOAL.r][GOAL.c] = { tpl: CHAMBRE, doors: [2], visited: false, goal: true };
    log("Vous entrez dans le vestibule. Quarante-cinq pas, pas un de plus.");
    const s = stats();
    s.runs = (s.runs || 0) + 1;
    saveStats(s);
  }

  function log(msg) {
    G.log.unshift(msg);
    if (G.log.length > 40) G.log.pop();
  }

  // ------------------------------------------------------------------
  // Portes
  // ------------------------------------------------------------------
  // Chaque salle porte ses propres portes (room.door[d]) : elles la suivent
  // quand une ligne ou une colonne glisse.
  function porteDe(room, r, c, d) {
    room.door = room.door || {};
    const r2 = r + DIRS[d].dr, c2 = c + DIRS[d].dc;
    const cible = G.grid[r2][c2];
    let D = room.door[d];
    if (!D) {
      D = avecFlux("porte:" + r + "," + c + "," + d, () => {
        let level, status = "locked";
        if (cible && cible.goal) level = 3;
        else {
          const row = Math.min(r, r2);
          level = row >= 6 ? 1 : row >= 3 ? 2 : 3;
          const x = R();
          if (x < 0.2 && level > 1) level -= 1;
          else if (x > 0.85 && level < 3) level += 1;
          if (R() < 0.18) { status = "ajar"; level = 0; }
        }
        return { level, status, theme: room.theme || pick(THEME_IDS) };
      });
      room.door[d] = D;
    }
    return D;
  }

  // État d'une porte vue depuis la salle (r,c), côté d.
  // s : wall | open | locked | ajar | blocked
  function edge(r, c, d) {
    const room = G.grid[r][c];
    if (!room || !room.doors.includes(d)) return { s: "wall" };
    const r2 = r + DIRS[d].dr, c2 = c + DIRS[d].dc;
    if (!inGrid(r2, c2)) return { s: "wall" };
    const n = G.grid[r2][c2];
    if (n) {
      if (!n.doors.includes(opp(d))) return { s: "wall" };
      if (!(n.goal || room.goal)) return { s: "open" };
    }
    const D = porteDe(room, r, c, d);
    return { s: D.status, level: D.level, theme: D.theme };
  }

  // ------------------------------------------------------------------
  // Tirage de trois salles
  // ------------------------------------------------------------------
  function candidat(card, d, tr, tc) {
    const tpl = SALLES_PAR_ID[card.id];
    const miroir = tpl.mirror && R() < 0.5;
    const abs = [opp(d)];
    (tpl.doors || []).forEach((x) => {
      let rel = x;
      if (miroir) rel = x === "L" ? "R" : x === "R" ? "L" : "F";
      const dd = rel === "F" ? d : rel === "R" ? (d + 1) % 4 : (d + 3) % 4;
      const nr = tr + DIRS[dd].dr, nc = tc + DIRS[dd].dc;
      if (!inGrid(nr, nc)) return; // pas de porte sur le vide
      const voisin = G.grid[nr][nc];
      if (voisin && !voisin.doors.includes(opp(dd))) return; // mur en face
      abs.push(dd);
    });
    const sorties = abs.length - 1;
    return { card, tpl, doors: abs, sorties, theme: sorties > 0 ? card.theme : null };
  }

  // ---- Le cycle du deck : pioche, défausse, remélange ----
  function melanger(liste) {
    return avecFlux("pioche:" + G.melanges++, () => shuffle(liste));
  }

  // Quand la pioche a moins de n cartes, on y remélange la défausse.
  function piocher(n) {
    if (G.pioche.length < n && G.defausse.length) {
      G.pioche = melanger(G.pioche.concat(G.defausse));
      G.defausse = [];
    }
    return G.pioche.splice(0, n);
  }

  function tirage(d, tr, tc) {
    const main = piocher(3);
    G.tirages += 1;
    return main.map((card, i) => avecFlux("miroir:" + G.tirages + ":" + i, () => candidat(card, d, tr, tc)));
  }

  // ---- Économie : offres de cartes, achats, retraits ----
  const copies = (id) => G.deck.filter((c) => c.id === id).length;
  const prixCarte = (tpl) => (tpl.kind === "pass" ? PRIX_CARTE_COURANTE : PRIX_CARTE_SPECIALE);
  const prixRetrait = () => PRIX_RETRAIT + 2 * G.retraits;
  const deckPlein = () => G.deck.length >= PLAFOND_DECK;

  // n cartes distinctes du pool (les salles pièges n'y figurent pas). Le hasard vient du flux courant.
  function offrir(n, forcer) {
    const pool = SALLES.filter((t) => t.kind !== "trap" && copies(t.id) < (t.max || 99)).map((t) => ({ t, w: t.w }));
    const cartes = [];
    const ajouter = (t) => cartes.push({ id: t.id, theme: (t.doors || []).length ? pick(THEME_IDS) : null });
    if (forcer) {
      const i = pool.findIndex((x) => x.t.id === forcer);
      if (i >= 0) {
        ajouter(pool[i].t);
        pool.splice(i, 1);
      }
    }
    while (cartes.length < n && pool.length) {
      let x = R() * pool.reduce((sum, e) => sum + e.w, 0), i = 0;
      for (; i < pool.length - 1; i++) {
        x -= pool[i].w;
        if (x <= 0) break;
      }
      ajouter(pool[i].t);
      pool.splice(i, 1);
    }
    return cartes;
  }

  // Une porte de niveau 2 ou 3 peut offrir une carte nouvelle ; la Boutique est proposée d'office la première fois.
  function calculerRecompense(P) {
    const r2 = P.r + DIRS[P.d].dr, c2 = P.c + DIRS[P.d].dc;
    if (G.grid[r2][c2]) return null; // porte de la Chambre : la fin de l'étage suffit
    return avecFlux("recompense:" + P.r + "," + P.c + "," + P.d, () => {
      if (R() >= (RECOMPENSE_PAR_NIVEAU[P.level] || 0)) return null;
      const forcer = !G.boutiqueOfferte && copies("boutique") === 0 ? "boutique" : null;
      if (forcer) G.boutiqueOfferte = true;
      const cartes = offrir(3, forcer);
      return cartes.length ? { cartes } : null;
    });
  }

  function ajouterCarte(card) {
    const c = { uid: ++G.uidMax, id: card.id, theme: card.theme };
    G.deck.push(c);
    G.defausse.push(c); // une carte nouvelle rejoint la défausse, comme dans un deckbuilder
    return c;
  }

  function retirerCarte(uid) {
    const i = G.deck.findIndex((c) => c.uid === uid);
    if (i < 0) return false;
    G.deck.splice(i, 1);
    const retirer = (liste) => {
      const j = liste.findIndex((c) => c.uid === uid);
      if (j >= 0) liste.splice(j, 1);
    };
    retirer(G.pioche);
    retirer(G.defausse);
    return true;
  }

  function choisirRecompense(i) {
    const P = G.pending;
    const card = P && P.recompense && P.recompense.cartes[i];
    if (!card || deckPlein()) return;
    ajouterCarte(card);
    log("Récompense : la carte « " + SALLES_PAR_ID[card.id].nom + " » rejoint votre deck.");
    son("punaise");
    suiteApresPorte();
  }

  function ouvrirBoutique(type) {
    G.boutique = avecFlux("boutique:" + G.rooms, () => ({
      type,
      stock: offrir(type === "carte" ? 4 : 2).map((card) => ({ card, prix: prixCarte(SALLES_PAR_ID[card.id]) })),
    }));
    log(type === "carte" ? "Vous entrez dans la Boutique." : "Un marchand des Gardiens vous attendait dans cette salle.");
    modaleBoutique();
  }

  function acheter(i) {
    const B = G.boutique;
    const item = B && B.stock[i];
    if (!item || G.coins < item.prix || deckPlein()) return;
    G.coins -= item.prix;
    G.achats += 1;
    ajouterCarte(item.card);
    B.stock.splice(i, 1);
    log("Achat : « " + SALLES_PAR_ID[item.card.id].nom + " » (−" + item.prix + " pièces).");
    son("punaise");
    modaleBoutique();
    render();
  }

  function retirerAchat(uid) {
    const prix = prixRetrait();
    if (!G.boutique || G.coins < prix || G.deck.length <= DECK_MINI) return;
    const card = G.deck.find((c) => c.uid === uid);
    if (!card) return;
    G.coins -= prix;
    G.retraits += 1;
    retirerCarte(uid);
    log("Retrait : « " + SALLES_PAR_ID[card.id].nom + " » quitte votre deck (−" + prix + " pièces).");
    son("rature");
    modaleBoutique();
    render();
  }

  function defausserMain(cands) {
    cands.forEach((cd) => G.defausse.push(cd.card));
  }

  // ------------------------------------------------------------------
  // Actions du joueur
  // ------------------------------------------------------------------
  function modalOpen() {
    return !document.getElementById("modal").hidden || !!(G && G.draft);
  }

  function tenter(d) {
    if (!G || G.over || G.shift || modalOpen()) return;
    const { r, c } = G.pos;
    const e = edge(r, c, d);
    if (e.s === "wall") return;
    if (e.s === "open") return deplacer(d);
    if (e.s === "blocked") {
      log("Cette porte est condamnée : la serrure ne répond plus.");
      son("rature");
      return render();
    }
    if (e.s === "ajar") {
      log("La porte est entrouverte : personne ne l'a verrouillée.");
      return ouvrirTirage(d);
    }
    G.pending = { r, c, d, level: e.level, theme: e.theme };
    modalePorte();
  }

  function deplacer(d) {
    const r2 = G.pos.r + DIRS[d].dr, c2 = G.pos.c + DIRS[d].dc;
    const room = G.grid[r2][c2];
    G.steps -= 1;
    G.moves += 1;
    G.pos = { r: r2, c: c2 };
    son("page");
    if (!room.visited) {
      room.visited = true;
      appliquer(room);
      if (room.tpl.fx && room.tpl.fx.shop) G.visite = "carte";
      else if (room.marchand) G.visite = "passage";
    }
    if (room.goal) return finir("win");
    if (G.steps <= 0) return finir("steps");
    if (impasse()) return finir("stuck");
    render();
    if (G.visite) {
      const type = G.visite;
      G.visite = null;
      ouvrirBoutique(type);
    }
  }

  function appliquer(room) {
    const fx = room.tpl.fx;
    if (!fx) return;
    const morceaux = [];
    if (fx.steps) {
      G.steps = Math.max(0, G.steps + fx.steps);
      morceaux.push((fx.steps > 0 ? "+" : "−") + Math.abs(fx.steps) + " pas");
    }
    if (fx.dice) { G.dice += fx.dice; morceaux.push("+" + fx.dice + " dé"); }
    if (fx.seals) { G.seals += fx.seals; morceaux.push("+" + fx.seals + " sceau"); }
    if (fx.time) { G.timeBonus += fx.time; morceaux.push("+" + fx.time + " s par énigme"); }
    if (fx.gem) {
      G.gems.push({ axe: fx.gem.axe, max: fx.gem.max });
      morceaux.push("une gemme " + (fx.gem.axe === "H" ? "↔" : "↕") + (fx.gem.max === 2 ? " rare" : ""));
    }
    if (fx.fragment && G.fragments < FRAGMENTS.length) {
      G.fragments += 1;
      morceaux.push("un fragment du carnet de Valcourt");
    }
    if (!morceaux.length) return;
    log(room.tpl.nom + " : " + morceaux.join(", ") + ".");
    son(fx.steps < 0 ? "rature" : "crayon-note");
  }

  function ouvrirTirage(d) {
    const { r, c } = G.pos;
    const tr = r + DIRS[d].dr, tc = c + DIRS[d].dc;
    G.draft = { d, tr, tc, sel: null, cands: tirage(d, tr, tc) };
    render();
    defilerVersCible();
  }

  function choisir(i) {
    const D = G.draft;
    const cand = D.cands[i];
    G.grid[D.tr][D.tc] = { tpl: cand.tpl, doors: cand.doors, visited: false, theme: cand.theme, card: cand.card };
    defausserMain(D.cands); // les trois cartes tirées vont à la défausse
    G.rooms += 1;
    if ((G.rooms - 1) % SALLES_MARCHAND === 0) G.grid[D.tr][D.tc].marchand = true;
    porteDe(G.grid[G.pos.r][G.pos.c], G.pos.r, G.pos.c, D.d).status = "open";
    log("Porte " + (D.d === 0 || D.d === 2 ? "du " : "de l'") + DIRS[D.d].nom + " : vous choisissez « " + cand.tpl.nom + " ».");
    son("punaise");
    const d = D.d;
    G.draft = null;
    fermerModale();
    deplacer(d);
  }

  function apercu(i) {
    const D = G.draft;
    if (!D || !D.cands[i]) return;
    if (D.sel === i) return choisir(i);
    D.sel = i;
    son("clic");
    render();
  }

  // Sur petit écran, on amène la case visée au-dessus du tirage
  function defilerVersCible() {
    if (!G || !G.draft || !window.matchMedia("(max-width: 860px)").matches) return;
    const el = document.querySelector('[data-cell="' + G.draft.tr + "," + G.draft.tc + '"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function relancer() {
    if (G.dice < 1) return;
    G.dice -= 1;
    const D = G.draft;
    defausserMain(D.cands);
    D.cands = tirage(D.d, D.tr, D.tc);
    D.sel = null;
    log("Vous jouez un dé : trois nouvelles cartes.");
    son("clic");
    render();
  }

  // Est-il encore possible d'aller quelque part ? Sinon, impasse.
  function impasse() {
    if (gemUtile()) return false;
    const vus = new Set();
    const file = [[G.pos.r, G.pos.c]];
    vus.add(G.pos.r + "," + G.pos.c);
    while (file.length) {
      const [r, c] = file.shift();
      for (let d = 0; d < 4; d++) {
        const e = edge(r, c, d);
        if (e.s === "locked" || e.s === "ajar") return false;
        if (e.s === "open") {
          const r2 = r + DIRS[d].dr, c2 = c + DIRS[d].dc;
          const k = r2 + "," + c2;
          if (!vus.has(k)) { vus.add(k); file.push([r2, c2]); }
        }
      }
    }
    return true;
  }

  function finir(raison) {
    G.over = raison;
    fermerModale();
    const s = stats();
    if (raison === "win") {
      s.wins = (s.wins || 0) + 1;
      if (G.steps > (s.best || 0)) s.best = G.steps;
      son("tampon");
    } else {
      son("rature");
    }
    saveStats(s);
    render();
    modaleFin();
  }

  // ------------------------------------------------------------------
  // Énigmes
  // ------------------------------------------------------------------
  function demarrerEnigme() {
    const P = G.pending;
    const p = avecFlux("enigme:" + P.r + "," + P.c + "," + P.d, () => makePuzzle(P.level, P.theme));
    const total = (TEMPS_BASE[P.level] || 35) + G.timeBonus;
    pz = { puzzle: p, restant: total, total, fini: false };
    modaleEnigme();
    arreterChrono();
    timer = setInterval(() => {
      if (!pz || pz.fini) return arreterChrono();
      pz.restant -= 0.1;
      majChrono();
      if (pz.restant <= 0) resoudre(false, "Le temps est écoulé.");
    }, 100);
  }

  function arreterChrono() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function repondre(valeur) {
    if (!pz || pz.fini) return;
    const p = pz.puzzle;
    let ok;
    if (p.kind === "num") {
      const n = parseInt(String(valeur).replace(/\s+/g, ""), 10);
      ok = n === p.answer;
    } else ok = valeur === p.answer;
    resoudre(ok, ok ? "Le mécanisme cède." : "Mauvaise réponse.");
  }

  function resoudre(ok, message) {
    if (!pz || pz.fini) return;
    pz.fini = true;
    arreterChrono();
    const P = G.pending;
    const D = G.grid[P.r][P.c].door[P.d];
    const p = pz.puzzle;
    if (ok) {
      G.solved += 1;
      D.status = "open";
      const base = GAIN_PORTE[P.level] || 0;
      const rapide = base && pz.restant > pz.total / 2 ? 1 : 0;
      pz.gain = base + rapide;
      pz.rapide = rapide;
      G.coins += pz.gain;
      P.recompense = calculerRecompense(P);
      log("Énigme résolue (" + p.label.toLowerCase() + ")" + (pz.gain ? " : +" + pz.gain + " pièce" + (pz.gain > 1 ? "s" : "") : "") + ".");
      son("deblocage");
    } else {
      G.failed += 1;
      D.status = "blocked";
      log("Énigme ratée (" + p.label.toLowerCase() + ") : la porte est condamnée pour cette partie.");
      son("rature");
    }
    modaleResultat(ok, message);
    render();
  }

  function utiliserSceau() {
    if (G.seals < 1) return;
    G.seals -= 1;
    const P = G.pending;
    G.grid[P.r][P.c].door[P.d].status = "open";
    log("Vous posez un sceau sur la serrure : la porte s'ouvre d'elle-même.");
    son("deblocage");
    suiteApresPorte();
  }

  function suiteApresPorte() {
    const P = G.pending;
    const r2 = P.r + DIRS[P.d].dr, c2 = P.c + DIRS[P.d].dc;
    const d = P.d;
    if (P.recompense && !P.recompenseVue) {
      P.recompenseVue = true;
      modaleRecompense();
      return;
    }
    G.pending = null;
    fermerModale();
    if (G.grid[r2][c2]) return deplacer(d); // la porte du fond : la chambre
    ouvrirTirage(d);
  }

  // ------------------------------------------------------------------
  // Dessin des salles (SVG)
  // ------------------------------------------------------------------
  const FOND = { pass: "#D9CDAE", bonus: "#C9D0B8", trap: "#DDB9AC", start: "#E4D8B4", goal: "#E3C77A" };
  const COTES = [
    { full: "M0 4H100", a: "M0 4H34", b: "M66 4H100", porte: [34, 0, 32, 8], h: true },
    { full: "M96 0V100", a: "M96 0V34", b: "M96 66V100", porte: [92, 34, 8, 32], h: false },
    { full: "M0 96H100", a: "M0 96H34", b: "M66 96H100", porte: [34, 92, 32, 8], h: true },
    { full: "M4 0V100", a: "M4 0V34", b: "M4 66V100", porte: [0, 34, 8, 32], h: false },
  ];

  function iconeDe(tpl) {
    if (tpl.kind === "start") return "🚪";
    if (tpl.kind === "goal") return "🦎";
    const fx = tpl.fx || {};
    const parts = [];
    if (fx.steps) parts.push((fx.steps > 0 ? "+" : "−") + Math.abs(fx.steps));
    if (fx.dice) parts.push("🎲");
    if (fx.seals) parts.push("🗝");
    if (fx.time) parts.push("⏳");
    if (fx.fragment) parts.push("📜");
    if (fx.shop) parts.push("💰");
    if (fx.gem) parts.push((fx.gem.max === 2 ? "💎" : "") + (fx.gem.axe === "H" ? "↔" : "↕"));
    return parts.slice(0, 2).join(" ");
  }

  // cotes : tableau de 4 objets { s, level } (s = wall | gap | locked | ajar | blocked)
  function salleSVG(tpl, cotes, opts) {
    opts = opts || {};
    const fond = FOND[tpl.kind] || FOND.pass;
    let s = `<svg viewBox="0 0 100 100" class="room-svg" aria-hidden="true">`;
    s += `<rect width="100" height="100" fill="${fond}"/>`;
    s += `<rect x="12" y="12" width="76" height="76" fill="none" stroke="rgba(42,38,32,.13)" stroke-width="1.2"/>`;
    for (let d = 0; d < 4; d++) {
      const c = COTES[d], st = cotes[d] || { s: "wall" };
      const ouvert = st.s !== "wall";
      s += `<path d="${ouvert ? c.a + " " + c.b : c.full}" stroke="#2A2620" stroke-width="8" fill="none"/>`;
      if (!ouvert) continue;
      const [x, y, w, h] = c.porte;
      if (st.s === "locked") {
        const col = st.theme && THEMES[st.theme] ? THEMES[st.theme].couleur : "#7A5A34";
        s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${col}" stroke="#2A2620" stroke-width="1.5"/>`;
        for (let i = 0; i < st.level; i++) {
          const off = (i - (st.level - 1) / 2) * 8;
          const cx = c.h ? 50 + off : x + w / 2, cy = c.h ? y + h / 2 : 50 + off;
          s += `<circle cx="${cx}" cy="${cy}" r="2.4" fill="#F3EBD6"/>`;
        }
      } else if (st.s === "ajar") {
        s += `<rect x="${x + (c.h ? 4 : 0)}" y="${y + (c.h ? 0 : 4)}" width="${c.h ? w - 8 : w}" height="${c.h ? h : h - 8}" fill="#B98B2A" stroke="#2A2620" stroke-width="1.2" opacity=".85"/>`;
      } else if (st.s === "blocked") {
        s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#6E655A" stroke="#2A2620" stroke-width="1.5"/>`;
        s += `<path d="M${x + 2} ${y + 1}L${x + w - 2} ${y + h - 1}M${x + w - 2} ${y + 1}L${x + 2} ${y + h - 1}" stroke="#9A2B25" stroke-width="2.4"/>`;
      }
    }
    if (opts.entree !== undefined) {
      const f = [
        "M50 9L43 20H57Z", // entrée au nord : flèche vers le bas → on dessine un repère
        "M91 50L80 43V57Z",
        "M50 91L43 80H57Z",
        "M9 50L20 43V57Z",
      ][opts.entree];
      s += `<path d="${f}" fill="#9A2B25"/>`;
    }
    if (opts.theme && THEMES[opts.theme]) {
      const T = THEMES[opts.theme];
      s += `<rect x="11" y="11" width="78" height="78" fill="none" stroke="${T.couleur}" stroke-width="3.4"/>`;
      s += `<text x="19" y="26" font-size="13" font-family="IBM Plex Mono, monospace" font-weight="700" fill="${T.couleur}">${T.glyphe}</text>`;
    }
    const icone = opts.icone !== undefined ? opts.icone : iconeDe(tpl);
    if (icone) {
      s += `<text x="50" y="48" text-anchor="middle" dominant-baseline="middle" font-size="${icone.length > 3 ? 20 : 25}" font-family="IBM Plex Mono, monospace" font-weight="600" fill="${tpl.kind === "trap" ? "#9A2B25" : "#2A2620"}">${icone}</text>`;
    }
    if (opts.nom) {
      s += `<text x="50" y="76" text-anchor="middle" font-size="10.5" font-family="IBM Plex Mono, monospace" fill="#524A3E">${esc(opts.nom)}</text>`;
    }
    return s + `</svg>`;
  }

  function coteEtat(r, c, d) {
    const e = edge(r, c, d);
    if (e.s === "open") return { s: "gap" };
    return e;
  }

  // ------------------------------------------------------------------
  // Affichage du plateau et de l'interface
  // ------------------------------------------------------------------
  function effetTexte(fx) {
    if (!fx) return "Aucun effet.";
    const p = [];
    if (fx.steps) p.push((fx.steps > 0 ? "+" : "−") + Math.abs(fx.steps) + " pas");
    if (fx.dice) p.push("+" + fx.dice + " dé");
    if (fx.seals) p.push("+" + fx.seals + " sceau");
    if (fx.time) p.push("+" + fx.time + " s par énigme");
    if (fx.fragment) p.push("un fragment du carnet de Valcourt");
    if (fx.shop) p.push("une boutique : achat de cartes, retrait d'une carte");
    if (fx.gem) p.push("une gemme " + (fx.gem.axe === "H" ? "↔ (décale une ligne" : "↕ (décale une colonne") + (fx.gem.max === 2 ? " de 1 ou 2 crans, rare)" : " d'un cran)"));
    return p.join(", ") + ".";
  }

  function plateauHTML() {
    const S = G.shift;
    const gemS = S ? G.gems[S.gi] : null;
    let h = `<div class="board${S ? " shifting" : ""}" role="grid" aria-label="Plan du labyrinthe">`;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const room = G.grid[r][c];
        const cur = G.pos.r === r && G.pos.c === c;
        const cible = !!(G.draft && G.draft.tr === r && G.draft.tc === c);
        let cls = "cell";
        let contenu = "";
        let action = "";
        if (gemS) {
          // Mode gemme : on choisit la ligne ou la colonne à décaler
          const ligne = gemS.axe === "H" ? r : c;
          if (ligneOk(gemS.axe, ligne)) {
            cls += " shift-ok" + (S.sel === ligne ? " shift-sel" : "");
            action = ` data-act="line" data-line="${ligne}"`;
          } else cls += " shift-no";
        } else if (!G.draft) {
          // Voisinage de la salle actuelle
          let d = -1;
          for (let k = 0; k < 4; k++) if (G.pos.r + DIRS[k].dr === r && G.pos.c + DIRS[k].dc === c) d = k;
          if (d >= 0 && !G.over) {
            const e = edge(G.pos.r, G.pos.c, d);
            if (e.s === "open") cls += " can-go";
            else if (e.s === "locked" || e.s === "ajar") cls += " can-open";
            if (e.s !== "wall") action = ` data-act="go" data-d="${d}"`;
          }
        }
        if (room) {
          const cotes = [0, 1, 2, 3].map((k) => coteEtat(r, c, k));
          contenu = salleSVG(room.tpl, cotes, { nom: room.tpl.court, theme: room.theme });
          cls += " placed" + (room.visited ? "" : " unseen") + (room.goal ? " goal" : "");
          if (cur) {
            cls += " current";
            contenu += `<img class="pion" src="img/salamandre.png" alt="Vous" onerror="this.outerHTML='<span class=&quot;pion-point&quot;></span>'">`;
          }
        } else if (cible) {
          cls += " draft-target";
          const cd = G.draft.sel !== null ? G.draft.cands[G.draft.sel] : null;
          if (cd) {
            const cotes = [0, 1, 2, 3].map((k) => (cd.doors.includes(k) ? { s: "gap" } : { s: "wall" }));
            contenu = salleSVG(cd.tpl, cotes, { nom: cd.tpl.court, theme: cd.theme, entree: opp(G.draft.d) });
            cls += " ghost";
          } else contenu = `<span class="cible-q">?</span>`;
        } else cls += " empty";
        h += `<div class="${cls}" role="gridcell" data-cell="${r},${c}"${action}>${contenu}</div>`;
      }
    }
    return h + `</div>`;
  }

  function gemmesHTML() {
    if (!G.gems.length) return `<span class="chip vide-chip" title="Les gemmes se trouvent dans certaines salles">💎 <em>aucune gemme</em></span>`;
    return G.gems
      .map((g, i) => {
        const fl = g.axe === "H" ? "↔" : "↕";
        const actif = G.shift && G.shift.gi === i;
        return `<button class="chip gem-btn${actif ? " actif" : ""}" data-act="gem" data-i="${i}" title="Gemme ${g.axe === "H" ? "horizontale : décale une ligne" : "verticale : décale une colonne"} de ${g.max === 2 ? "1 ou 2 crans" : "1 cran"}">💎 <b>${fl}</b>${g.max === 2 ? "<sup>2</sup>" : ""}</button>`;
      })
      .join("");
  }

  // ------------------------------------------------------------------
  // Gemmes : décaler une ligne (H) ou une colonne (V)
  // ------------------------------------------------------------------
  function ligneOk(axe, i) {
    if (axe === "H") {
      if (i === G.pos.r || i === START.r || i === GOAL.r) return false;
    } else if (i === G.pos.c || i === START.c || i === GOAL.c) return false;
    const n = axe === "H" ? COLS : ROWS;
    for (let j = 0; j < n; j++) if (axe === "H" ? G.grid[i][j] : G.grid[j][i]) return true;
    return false;
  }

  function gemUtile() {
    return G.gems.some((g) => {
      const n = g.axe === "H" ? ROWS : COLS;
      for (let i = 0; i < n; i++) if (ligneOk(g.axe, i)) return true;
      return false;
    });
  }

  function decaler(k) {
    const S = G.shift;
    if (!S || S.sel === null) return;
    const gem = G.gems[S.gi];
    if (!gem || Math.abs(k) > gem.max || !ligneOk(gem.axe, S.sel)) return;
    const H = gem.axe === "H", i = S.sel, n = H ? COLS : ROWS;
    const anciens = [];
    for (let j = 0; j < n; j++) anciens.push(H ? G.grid[i][j] : G.grid[j][i]);
    const nouveaux = Array(n).fill(null);
    anciens.forEach((salle, j) => {
      nouveaux[(((j + k) % n) + n) % n] = salle;
      // Les passages déjà ouverts sont recalculés d'après le nouveau voisinage
      if (salle && salle.door) for (const d in salle.door) if (salle.door[d].status === "open") delete salle.door[d];
    });
    for (let j = 0; j < n; j++) {
      if (H) G.grid[i][j] = nouveaux[j];
      else G.grid[j][i] = nouveaux[j];
    }
    // Un passage ouvert vers une case devenue vide n'existe plus : la porte est à refaire
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const salle = G.grid[r][c];
        if (!salle || !salle.door) continue;
        for (const d in salle.door) {
          if (salle.door[d].status !== "open") continue;
          const r2 = r + DIRS[d].dr, c2 = c + DIRS[d].dc;
          if (!inGrid(r2, c2) || !G.grid[r2][c2]) delete salle.door[d];
        }
      }
    G.gems.splice(S.gi, 1);
    G.shift = null;
    const sens = H ? (k > 0 ? "vers la droite" : "vers la gauche") : k > 0 ? "vers le bas" : "vers le haut";
    log("Gemme " + (H ? "↔" : "↕") + " : " + (H ? "la ligne " : "la colonne ") + (i + 1) + " glisse de " + Math.abs(k) + " cran" + (Math.abs(k) > 1 ? "s" : "") + " " + sens + ".");
    son("carte-depliee");
    if (impasse()) return finir("stuck");
    render();
  }

  function barreDecalage() {
    const S = G.shift;
    if (!S) return "";
    const g = G.gems[S.gi];
    const H = g.axe === "H";
    const mot = H ? "ligne" : "colonne";
    let h = `<div class="shift-bar"><span class="shift-txt">💎 ${H ? "↔" : "↕"}${g.max === 2 ? " rare" : ""} : `;
    if (S.sel === null) h += `touchez une ${mot} du plan.</span>`;
    else {
      h += `${mot} ${S.sel + 1}, décaler :</span>`;
      const a = H ? "◀" : "▲", b = H ? "▶" : "▼";
      for (let k = 1; k <= g.max; k++) {
        h += `<button class="btn mini-btn" data-act="shift-do" data-k="${-k}">${a.repeat(k)} ${k}</button><button class="btn mini-btn" data-act="shift-do" data-k="${k}">${k} ${b.repeat(k)}</button>`;
      }
    }
    return h + `<button class="btn lien mini-btn" data-act="shift-cancel">Annuler</button></div>`;
  }

  function panneauHTML() {
    const room = G.grid[G.pos.r][G.pos.c];
    const pct = Math.max(0, Math.min(100, (G.steps / START_STEPS) * 100));
    const bas = G.steps <= 10;
    let h = `<div class="hud">
      <div class="hud-steps${bas ? " bas" : ""}">
        <span class="hud-label">Pas restants</span>
        <span class="hud-big">${G.steps}</span>
        <span class="bar"><span style="width:${pct}%"></span></span>
      </div>
      <div class="hud-items">
        <span class="chip" title="Dés : relancer un tirage de trois salles">🎲 <b>${G.dice}</b> <em>dé${G.dice > 1 ? "s" : ""}</em></span>
        <span class="chip" title="Sceaux : ouvrent une porte sans énigme">🗝 <b>${G.seals}</b> <em>sceau${G.seals > 1 ? "x" : ""}</em></span>
        <span class="chip" title="Temps bonus sur chaque énigme">⏳ <b>+${G.timeBonus}</b> <em>s</em></span>
      </div>
      <div class="hud-items">${gemmesHTML()}</div>
      <div class="hud-items">${deckChip()}<button class="chip" data-act="copier" title="Copier la graine pour rejouer ou partager cette partie">🌱 <b>${esc(G.seed)}</b></button></div>
    </div>
    ${G.draft ? tirageHTML() : ""}
    <section class="carte">
      <h3>Vous êtes ici</h3>
      <p class="salle-nom">${esc(room.tpl.nom)}</p>
      <p class="salle-desc">${esc(room.tpl.desc)}</p>
    </section>
    <section class="carte">
      <h3>Carnet de Valcourt <span class="compte">${G.fragments}/${FRAGMENTS.length}</span></h3>`;
    if (G.fragments === 0) h += `<p class="vide">Aucun fragment trouvé. Cherchez les archives, les fresques, le cabinet.</p>`;
    else {
      h += `<ol class="fragments">`;
      for (let i = G.fragments - 1; i >= 0; i--) h += `<li>${esc(FRAGMENTS[i])}</li>`;
      h += `</ol>`;
    }
    h += `</section>
    <section class="carte">
      <h3>Journal</h3>
      <ul class="journal" aria-live="polite">${G.log.slice(0, 6).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
    </section>`;
    return h;
  }

  function render() {
    const app = document.getElementById("app");
    document.body.classList.toggle("menu-mode", !G);
    document.body.classList.toggle("tirage-ouvert", !!(G && G.draft));
    if (!G) return (app.innerHTML = menuHTML());
    app.innerHTML = `
      <header class="entete">
        <div class="titre-mini"><span class="marque">Bureau des affaires occultes</span><h1>SEUIL</h1></div>
        <div class="entete-btns">
          <button class="petit" data-act="rules" title="Règles">?</button>
          <button class="petit" data-act="sound" title="Son">${muet ? "🔇" : "🔊"}</button>
          <button class="petit texte" data-act="menu">Menu</button>
        </div>
      </header>
      <main class="game">
        <div class="col-plateau">
          <div class="hud-mobile">${hudMobile()}</div>
          ${barreDecalage()}
          <div class="plateau-cadre">
            <div class="etiquette haut">Chambre des Gardiens</div>
            ${plateauHTML()}
            <div class="etiquette bas">Vestibule</div>
          </div>
          <p class="aide">Touchez une salle voisine, ou utilisez les flèches / ZQSD.</p>
        </div>
        <aside class="col-panneau">${panneauHTML()}</aside>
      </main>`;
  }

  function deckChip() {
    const enMain = G.draft ? G.draft.cands.length : 0;
    return `<span class="chip" title="Pièces">🪙 <b>${G.coins}</b></span><button class="chip deck-btn" data-act="deck" title="Voir le deck">🃏 <b>${G.deck.length}/${PLAFOND_DECK}</b> <em>pioche ${G.pioche.length} · défausse ${G.defausse.length}${enMain ? " · main " + enMain : ""}</em></button>`;
  }

  function hudMobile() {
    const bas = G.steps <= 10;
    return `<span class="hm-steps${bas ? " bas" : ""}"><b>${G.steps}</b> pas</span>
      <span class="chip">🎲 <b>${G.dice}</b></span><span class="chip">🗝 <b>${G.seals}</b></span><span class="chip">⏳ <b>+${G.timeBonus}</b></span>
      <span class="chip">📜 <b>${G.fragments}/${FRAGMENTS.length}</b></span>${deckChip()}${G.gems.length ? gemmesHTML() : ""}`;
  }

  function menuHTML() {
    const s = stats();
    const rec = s.wins ? `Meilleur résultat : sortie avec ${s.best} pas restants · ${s.wins} victoire${s.wins > 1 ? "s" : ""} sur ${s.runs || s.wins} expédition${(s.runs || 0) > 1 ? "s" : ""}.` : s.runs ? `${s.runs} expédition${s.runs > 1 ? "s" : ""}, aucune sortie pour l'instant.` : "";
    return `<div class="menu">
      <div class="menu-fond"><img src="img/menu-fond.jpg" alt="" onerror="this.remove()"></div>
      <div class="menu-inner">
        <p class="menu-marque">Bureau des affaires occultes</p>
        <img class="menu-sal" src="img/salamandre.png" alt="" onerror="this.remove()">
        <h1 class="menu-titre">SEUIL</h1>
        <p class="menu-tag">Le labyrinthe des Gardiens. Chaque porte est une question. Chaque réponse ouvre un chemin, et le chemin se paie en pas.</p>
        <label class="menu-graine">
          <span>Graine (facultative)</span>
          <input id="graine" type="text" maxlength="24" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="au hasard">
        </label>
        <div class="menu-liste">
          <button class="menu-item" data-act="new"><span class="menu-label">Nouvelle expédition</span><span class="menu-sub">Un deck de 8 salles, 45 pas, et un serrurier à retrouver</span></button>
          <button class="menu-item" data-act="daily"><span class="menu-label">Défi du jour</span><span class="menu-sub">La même partie pour tout le monde aujourd'hui</span></button>
          <button class="menu-item" data-act="rules"><span class="menu-label">Comment jouer</span><span class="menu-sub">Deux minutes de lecture</span></button>
        </div>
        <p class="menu-foot">${esc(rec)}</p>
        <p class="menu-foot">Prototype · Maison Paradoxe</p>
      </div>
    </div>`;
  }

  // ------------------------------------------------------------------
  // Fenêtres modales
  // ------------------------------------------------------------------
  function afficherModale(html, cls) {
    const m = document.getElementById("modal");
    m.className = "modal " + (cls || "");
    m.innerHTML = `<div class="modal-boite" role="dialog" aria-modal="true">${html}</div>`;
    m.hidden = false;
  }

  function fermerModale() {
    arreterChrono();
    const m = document.getElementById("modal");
    m.hidden = true;
    m.innerHTML = "";
  }

  function modalePorte() {
    const P = G.pending;
    const d = DIRS[P.d];
    const temps = (TEMPS_BASE[P.level] || 35) + G.timeBonus;
    const pips = "●".repeat(P.level) + "○".repeat(3 - P.level);
    const T = THEMES[P.theme];
    afficherModale(`
      <p class="modal-sur">Porte du ${d.nom} ${d.fleche}</p>
      <h2>Une serrure sans clé</h2>
      <p class="niveau"><span class="theme-tag" style="--t:${T.couleur}">${T.glyphe} ${T.nom}</span> Difficulté <span class="pips">${pips}</span></p>
      <p>Une seule tentative, ${temps} secondes. Si vous échouez, la porte est condamnée pour toute la partie.</p>
      <div class="boutons">
        <button class="btn principal" data-act="try">Tenter l'énigme</button>
        ${G.seals > 0 ? `<button class="btn" data-act="seal">Utiliser un sceau (${G.seals})</button>` : ""}
        <button class="btn lien" data-act="back">Revenir</button>
      </div>`);
  }

  function majChrono() {
    const f = document.getElementById("chrono-barre");
    const t = document.getElementById("chrono-texte");
    if (!f || !pz) return;
    const pct = Math.max(0, (pz.restant / pz.total) * 100);
    f.style.width = pct + "%";
    f.parentNode.classList.toggle("urgent", pz.restant <= 8);
    if (t) t.textContent = Math.max(0, Math.ceil(pz.restant)) + " s";
  }

  function modaleEnigme() {
    const p = pz.puzzle;
    let corps;
    const grand = p.grand ? `<p class="enonce suite">${esc(p.grand)}</p>` : "";
    if (p.kind === "num") {
      corps = `${p.consigne ? `<p class="consigne">${esc(p.consigne)}</p>` : ""}<p class="enonce${p.label === "Suite logique" ? " suite" : ""}${p.grille ? " grille" : ""}">${esc(p.text)}</p>
        <form class="reponse" data-form="num" autocomplete="off">
          <input id="champ" type="text" inputmode="numeric" pattern="-?[0-9]*" autocomplete="off" aria-label="Votre réponse" placeholder="?">
          <button class="btn principal" type="submit">Valider</button>
        </form>`;
    } else {
      corps = `<p class="consigne">${esc(p.text)}</p>${grand}
        <div class="choix">${p.options.map((o, i) => `<button class="btn choix-btn" data-act="mcq" data-v="${esc(o)}"><kbd>${i + 1}</kbd> ${esc(o)}</button>`).join("")}</div>`;
    }
    const T = THEMES[p.theme];
    afficherModale(`
      <p class="modal-sur"><span class="theme-tag" style="--t:${T.couleur}">${T.glyphe} ${T.nom}</span> ${esc(p.label)} · difficulté ${"●".repeat(p.level)}${"○".repeat(3 - p.level)}</p>
      <div class="chrono"><span id="chrono-barre"></span><span id="chrono-texte" class="chrono-texte"></span></div>
      ${corps}`, "enigme sans-echap");
    majChrono();
    const champ = document.getElementById("champ");
    if (champ) champ.focus();
  }

  function modaleResultat(ok, message) {
    const p = pz.puzzle;
    const bonne = p.kind === "num" ? String(p.answer) : p.answer;
    const cible = G.grid[G.pending.r + DIRS[G.pending.d].dr][G.pending.c + DIRS[G.pending.d].dc];
    const gain = ok && pz.gain ? `<p class="gain">+${pz.gain} pièce${pz.gain > 1 ? "s" : ""}${pz.rapide ? " (dont 1 pour la rapidité)" : ""}</p>` : "";
    const suite = cible ? "Franchir la porte" : G.pending.recompense ? "Voir la récompense" : "Choisir une salle";
    afficherModale(`
      <p class="modal-sur">${ok ? "Réussi" : "Raté"}</p>
      <h2 class="${ok ? "ok" : "ko"}">${esc(message)}</h2>
      ${gain}
      ${ok ? "" : `<p>La bonne réponse était : <b>${esc(bonne)}</b>.</p><p>La porte est condamnée pour cette partie.</p>`}
      <div class="boutons"><button class="btn principal" data-act="after">${ok ? suite : "Continuer"}</button></div>`, (ok ? "reussi" : "rate") + " sans-echap");
    const b = document.querySelector('[data-act="after"]');
    if (b) b.focus();
  }

  function tirageHTML() {
    const D = G.draft;
    const cartes = D.cands
      .map((cd, i) => {
        const cotes = [0, 1, 2, 3].map((k) => (cd.doors.includes(k) ? { s: "gap" } : { s: "wall" }));
        const sel = D.sel === i;
        return `<button class="carte-salle ${cd.tpl.kind}${sel ? " sel" : ""}" data-act="apercu" data-i="${i}" aria-pressed="${sel}">
          <span class="mini">${salleSVG(cd.tpl, cotes, { entree: opp(D.d), theme: cd.theme })}</span>
          <span class="cs-nom">${esc(cd.tpl.nom)}</span>
          <span class="cs-desc">${esc(cd.tpl.desc)}</span>
          <span class="cs-fx">${esc(effetTexte(cd.tpl.fx))}</span>
          <span class="cs-portes">${cd.sorties === 0 ? "Cul-de-sac" : cd.sorties + " sortie" + (cd.sorties > 1 ? "s" : "")}</span>
          ${cd.theme ? `<span class="cs-theme theme-tag" style="--t:${THEMES[cd.theme].couleur}">${THEMES[cd.theme].glyphe} ${THEMES[cd.theme].nom}</span>` : ""}
        </button>`;
      })
      .join("");
    return `<section class="tirage-panel" aria-label="Choix de la salle">
      <h3>Porte du ${DIRS[D.d].nom} ${DIRS[D.d].fleche} : quelle salle ?</h3>
      <p class="tirage-aide">${D.sel === null ? "Touchez une salle pour la voir sur le plan, à l'emplacement marqué ?" : "Aperçu sur le plan. Touchez « Choisir » (ou la salle) pour la poser."}</p>
      <div class="tirage">${cartes}</div>
      <div class="boutons">
        <button class="btn principal" data-act="pick"${D.sel === null ? " disabled" : ""}>Choisir cette salle</button>
        <button class="btn" data-act="reroll"${G.dice < 1 ? " disabled" : ""}>🎲 Relancer (${G.dice})</button>
      </div>
      <p class="note">Le triangle rouge marque l'entrée ; les autres ouvertures sont les sorties. La couleur d'une salle est le thème des énigmes de ses portes de sortie.</p>
    </section>`;
  }

  function modaleFin() {
    const win = G.over === "win";
    const titre = win ? "Vous êtes sorti vivant… et arrivé." : G.over === "steps" ? "Plus un pas." : "Il n'y a plus de porte.";
    const texte = win
      ? "Vous atteignez la chambre des Gardiens. Sur la table, le carnet de Valcourt, ouvert. La dernière page a été arrachée. Une tasse est encore tiède."
      : G.over === "steps"
      ? "Vos pas sont comptés, et ils sont finis. Les Gardiens referment le seuil. Le labyrinthe se recompose : la prochaine fois, ses portes seront ailleurs."
      : "Toutes les portes ouvertes ne mènent nulle part, et toutes les autres sont condamnées. Le labyrinthe vous garde.";
    afficherModale(`
      <p class="modal-sur">${win ? "Fin de l'expédition" : "Expédition terminée"}</p>
      <h2 class="${win ? "ok" : "ko"}">${titre}</h2>
      <p>${texte}</p>
      <ul class="bilan">
        <li>Graine <b>${esc(G.seed)}</b></li>
        <li><b>${G.steps}</b> pas restants</li>
        <li><b>${G.rooms}</b> salles ouvertes</li>
        <li><b>${G.solved}</b> énigmes résolues, <b>${G.failed}</b> ratées</li>
        <li><b>${G.coins}</b> pièces, <b>${G.deck.length}</b> cartes dans le deck</li>
        <li><b>${G.fragments}/${FRAGMENTS.length}</b> fragments du carnet</li>
      </ul>
      <div class="boutons">
        <button class="btn principal" data-act="new">Nouvelle graine</button>
        <button class="btn" data-act="replay">Rejouer cette graine</button>
        <button class="btn lien" data-act="menu">Menu</button>
      </div>`, (win ? "reussi" : "rate") + " sans-echap");
  }

  function apercuCarte(card) {
    const t = SALLES_PAR_ID[card.id];
    const portes = [2]; // l'entrée est au sud dans l'aperçu
    (t.doors || []).forEach((x) => portes.push(x === "F" ? 0 : x === "R" ? 1 : 3));
    const cotes = [0, 1, 2, 3].map((k) => (portes.includes(k) ? { s: "gap" } : { s: "wall" }));
    return salleSVG(t, cotes, { entree: 2, theme: (t.doors || []).length ? card.theme : null });
  }

  function themeTag(card) {
    return card.theme ? `<span class="theme-tag" style="--t:${THEMES[card.theme].couleur}">${THEMES[card.theme].glyphe} ${THEMES[card.theme].nom}</span>` : "";
  }

  function modaleRecompense() {
    const R2 = G.pending.recompense;
    const plein = deckPlein();
    const cartes = R2.cartes
      .map((card, i) => {
        const t = SALLES_PAR_ID[card.id];
        const sorties = (t.doors || []).length;
        return `<button class="carte-salle ${t.kind}" data-act="recomp" data-i="${i}"${plein ? " disabled" : ""}>
          <span class="mini">${apercuCarte(card)}</span>
          <span class="cs-nom">${esc(t.nom)}</span>
          <span class="cs-desc">${esc(t.desc)}</span>
          <span class="cs-fx">${esc(effetTexte(t.fx))}</span>
          <span class="cs-portes">${sorties === 0 ? "Cul-de-sac" : sorties + " sortie" + (sorties > 1 ? "s" : "")}</span>
          ${card.theme ? `<span class="cs-theme theme-tag" style="--t:${THEMES[card.theme].couleur}">${THEMES[card.theme].glyphe} ${THEMES[card.theme].nom}</span>` : ""}
        </button>`;
      })
      .join("");
    afficherModale(`
      <p class="modal-sur">Récompense</p>
      <h2>Une carte pour votre deck</h2>
      <p class="note-deck">Choisissez-en une : elle rejoint la défausse et reviendra dans vos tirages. Deck : ${G.deck.length}/${PLAFOND_DECK}.${plein ? " <b>Deck plein</b> : retirez une carte dans une boutique pour faire de la place." : ""}</p>
      <div class="tirage">${cartes}</div>
      <div class="boutons"><button class="btn${plein ? " principal" : " lien"}" data-act="recomp-passer">${plein ? "Continuer" : "Passer"}</button></div>`, "recompense-modal sans-echap");
  }

  function modaleBoutique() {
    const B = G.boutique;
    const plein = deckPlein();
    const stock = B.stock.length
      ? B.stock
          .map((it, i) => {
            const t = SALLES_PAR_ID[it.card.id];
            const sorties = (t.doors || []).length;
            const raison = plein ? "Deck plein" : G.coins < it.prix ? "Trop cher" : "";
            return `<li class="offre">
              <span class="mini">${apercuCarte(it.card)}</span>
              <span class="offre-txt"><span class="cs-nom">${esc(t.nom)}</span> ${themeTag(it.card)}<br>
                <span class="cs-desc">${esc(t.desc)}</span><br>
                <span class="cs-fx">${esc(effetTexte(t.fx))}</span> <span class="cs-portes">${sorties === 0 ? "cul-de-sac" : sorties + " sortie" + (sorties > 1 ? "s" : "")}</span></span>
              <button class="btn achat" data-act="acheter" data-i="${i}"${raison ? " disabled" : ""}>${raison || "Acheter"}<br><b>${it.prix} 🪙</b></button>
            </li>`;
          })
          .join("")
      : `<li class="vide">Tout est vendu.</li>`;
    const prix = prixRetrait();
    const retrait = G.deck
      .slice()
      .sort((a, b) => SALLES_PAR_ID[a.id].nom.localeCompare(SALLES_PAR_ID[b.id].nom) || a.uid - b.uid)
      .map((c) => {
        const t = SALLES_PAR_ID[c.id];
        const raison = G.deck.length <= DECK_MINI ? "Deck minimum" : G.coins < prix ? "Trop cher" : "";
        return `<li class="retrait-ligne"><span class="deck-nom">${esc(t.nom)}</span> ${themeTag(c)}<button class="btn mini-btn" data-act="retirer" data-uid="${c.uid}"${raison ? " disabled" : ""}>${raison || "Retirer"} · ${prix} 🪙</button></li>`;
      })
      .join("");
    afficherModale(`
      <p class="modal-sur">${B.type === "carte" ? "Boutique" : "Marchand de passage"}</p>
      <h2>Vos pièces : ${G.coins} 🪙</h2>
      <p class="note-deck">Deck : ${G.deck.length}/${PLAFOND_DECK}${plein ? " (plein)" : ""}. Une carte achetée rejoint la défausse.</p>
      <ul class="boutique-liste">${stock}</ul>
      <details class="retrait">
        <summary>Retirer une carte du deck (${prix} 🪙, puis +2 à chaque retrait)</summary>
        <ul class="retrait-liste">${retrait}</ul>
      </details>
      <div class="boutons"><button class="btn principal" data-act="quitter">Quitter la boutique</button></div>`, "boutique-modal sans-echap");
  }

  // Peut-on ouvrir une fenêtre d'information sans écraser une décision en cours ?
  function modaleLibre() {
    const m = document.getElementById("modal");
    return m.hidden || !m.classList.contains("sans-echap");
  }

  function modaleDeck() {
    const enMain = new Set(G.draft ? G.draft.cands.map((c) => c.card.uid) : []);
    const dansPioche = new Set(G.pioche.map((c) => c.uid));
    const lignes = G.deck
      .slice()
      .sort((a, b) => SALLES_PAR_ID[a.id].nom.localeCompare(SALLES_PAR_ID[b.id].nom) || a.uid - b.uid)
      .map((card) => {
        const t = SALLES_PAR_ID[card.id];
        const statut = enMain.has(card.uid) ? "en main" : dansPioche.has(card.uid) ? "pioche" : "défausse";
        const sorties = (t.doors || []).length;
        return `<li class="deck-ligne">
          <span class="deck-nom">${esc(t.nom)}</span>
          ${card.theme ? `<span class="theme-tag" style="--t:${THEMES[card.theme].couleur}">${THEMES[card.theme].glyphe} ${THEMES[card.theme].nom}</span>` : `<span class="theme-tag" style="--t:#6E655A">sans thème</span>`}
          <span class="deck-detail">${sorties === 0 ? "cul-de-sac" : sorties + " sortie" + (sorties > 1 ? "s" : "")} · ${esc(effetTexte(t.fx))}</span>
          <span class="deck-statut ${statut === "pioche" ? "pi" : statut === "en main" ? "ma" : "de"}">${statut}</span>
        </li>`;
      })
      .join("");
    afficherModale(`
      <p class="modal-sur">Votre deck</p>
      <h2>${G.deck.length} cartes sur ${PLAFOND_DECK}</h2>
      <p class="note-deck">Pioche ${G.pioche.length} · défausse ${G.defausse.length}${enMain.size ? " · main " + enMain.size : ""}. À chaque porte, vous tirez 3 cartes de la pioche, en jouez une, et les trois vont à la défausse. Quand la pioche a moins de 3 cartes, on y remélange la défausse.</p>
      <ul class="deck-liste">${lignes}</ul>
      <div class="boutons"><button class="btn principal" data-act="close">Fermer</button></div>`, "deck-modal");
  }

  function modaleRegles() {
    afficherModale(`
      <p class="modal-sur">Comment jouer</p>
      <h2>Règles de l'expédition</h2>
      <ol class="regles">
        <li><b>Objectif :</b> atteindre la <b>Chambre des Gardiens</b>, tout en haut du plan, en partant du vestibule tout en bas.</li>
        <li><b>Chaque pas coûte 1.</b> Traverser une porte, même pour revenir en arrière, consomme un pas. À zéro, l'expédition s'arrête.</li>
        <li><b>Les portes sont scellées.</b> Une porte verrouillée pose une énigme chronométrée : calcul, suite logique, orthographe. Trois niveaux de difficulté, de plus en plus durs en montant.</li>
        <li><b>Une seule chance.</b> Rater ou laisser filer le temps condamne la porte pour toute la partie. Si vous résolvez l'énigme, vous choisissez <b>une salle parmi trois</b>.</li>
        <li><b>Vos salles sont des cartes.</b> Vous partez avec un deck de 8 cartes. À chaque porte, vous tirez 3 cartes de la pioche et vous en posez une derrière la porte, avec ses propres portes. Les trois cartes vont ensuite à la défausse ; quand la pioche est presque vide, on y remélange la défausse. Touchez « Deck » pour voir vos cartes.</li>
        <li><b>Quatre thèmes, quatre couleurs.</b> Chiffres (bleu), Mots (rouge), Logique (vert), Symboles (or). La couleur d'une carte est fixe : c'est le thème des énigmes des portes de sortie de la salle. En choisissant une salle, vous choisissez ce que vous affronterez ensuite.</li>
        <li><b>Dés et sceaux.</b> Un dé défausse les 3 cartes tirées et en tire 3 nouvelles. Un sceau ouvre une porte sans énigme.</li>
        <li><b>Pièces, récompenses, boutique.</b> Une énigme résolue rapporte des pièces (2, 3 ou 5 selon la porte, plus 1 si vous êtes rapide). Les portes difficiles offrent parfois une carte nouvelle. Une carte Boutique, ou un marchand qui vous attend toutes les 10 salles posées, vend des cartes et permet d'en retirer contre des pièces. Le deck est limité à 15 cartes.</li>
        <li><b>La graine.</b> Chaque partie a une graine (six lettres). Avec la même graine, vous retrouvez la même partie : mêmes portes, mêmes énigmes, même pioche. Copiez-la pour rejouer ou partager. Le « Défi du jour » donne la même graine à tout le monde.</li>
        <li><b>Gemmes ↔ et ↕.</b> Une gemme décale toute une ligne (↔) ou toute une colonne (↕) du plan d'un cran, en bouclant : la salle qui sort d'un côté réapparaît de l'autre. Les gemmes rares vont jusqu'à deux crans. Le Vestibule, la Chambre et la ligne et la colonne où vous vous trouvez ne bougent pas. Après un décalage, les portes se recalculent : deux portes face à face forment un passage, une porte contre un mur devient un mur.</li>
        <li><b>Impasse :</b> si plus aucune porte n'est accessible, l'expédition est perdue.</li>
      </ol>
      <div class="boutons"><button class="btn principal" data-act="close">Compris</button></div>`, "regles");
  }

  // ------------------------------------------------------------------
  // Événements
  // ------------------------------------------------------------------
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-act]");
    if (!el) return;
    const act = el.getAttribute("data-act");
    switch (act) {
      case "new":
      case "daily":
      case "replay": {
        const champ = document.getElementById("graine");
        const graine = act === "daily" ? graineDuJour() : act === "replay" && G ? G.seed : champ ? champ.value : "";
        fermerModale();
        nouvellePartie(graine);
        son("page-journal");
        render();
        break;
      }
      case "deck":
        if (G && modaleLibre()) modaleDeck();
        break;
      case "recomp":
        choisirRecompense(parseInt(el.getAttribute("data-i"), 10));
        break;
      case "recomp-passer":
        if (G && G.pending && G.pending.recompense) {
          log("Vous passez la récompense.");
          suiteApresPorte();
        }
        break;
      case "acheter":
        acheter(parseInt(el.getAttribute("data-i"), 10));
        break;
      case "retirer":
        retirerAchat(parseInt(el.getAttribute("data-uid"), 10));
        break;
      case "quitter":
        G.boutique = null;
        fermerModale();
        render();
        break;
      case "copier":
        if (G) {
          try {
            navigator.clipboard.writeText(G.seed);
            log("Graine " + G.seed + " copiée.");
            render();
          } catch (e) {
            window.prompt("Graine de cette partie :", G.seed);
          }
        }
        break;
      case "menu":
        fermerModale();
        G = null;
        render();
        break;
      case "rules":
        if (modaleLibre()) modaleRegles();
        break;
      case "close":
        fermerModale();
        break;
      case "sound":
        muet = !muet;
        try {
          localStorage.setItem("seuil-muet", muet ? "1" : "0");
        } catch (e) {}
        render();
        break;
      case "go":
        tenter(parseInt(el.getAttribute("data-d"), 10));
        break;
      case "try":
        demarrerEnigme();
        break;
      case "seal":
        utiliserSceau();
        break;
      case "back":
        G.pending = null;
        fermerModale();
        break;
      case "mcq":
        repondre(el.getAttribute("data-v"));
        break;
      case "after":
        if (pz && pz.fini) {
          const ok = G.grid[G.pending.r][G.pending.c].door[G.pending.d].status === "open";
          pz = null;
          if (ok) suiteApresPorte();
          else {
            G.pending = null;
            fermerModale();
            if (G.steps <= 0) finir("steps");
            else if (impasse()) finir("stuck");
          }
        }
        break;
      case "apercu":
        apercu(parseInt(el.getAttribute("data-i"), 10));
        break;
      case "pick":
        if (G && G.draft && G.draft.sel !== null) choisir(G.draft.sel);
        break;
      case "gem": {
        if (!G || G.over || modalOpen()) break;
        const i = parseInt(el.getAttribute("data-i"), 10);
        G.shift = G.shift && G.shift.gi === i ? null : { gi: i, sel: null };
        son("clic");
        render();
        break;
      }
      case "line":
        if (G && G.shift) {
          const i = parseInt(el.getAttribute("data-line"), 10);
          if (ligneOk(G.gems[G.shift.gi].axe, i)) {
            G.shift.sel = i;
            son("clic");
            render();
          }
        }
        break;
      case "shift-do":
        if (G && G.shift) decaler(parseInt(el.getAttribute("data-k"), 10));
        break;
      case "shift-cancel":
        if (G) {
          G.shift = null;
          render();
        }
        break;
      case "reroll":
        relancer();
        break;
    }
  });

  document.addEventListener("submit", (ev) => {
    if (ev.target.getAttribute("data-form") === "num") {
      ev.preventDefault();
      const v = document.getElementById("champ").value.trim();
      if (v !== "") repondre(v);
    }
  });

  document.addEventListener("keydown", (ev) => {
    const ouverte = modalOpen();
    if (ouverte) {
      const enCours = pz && !pz.fini;
      if (ev.key === "Escape" && !enCours && !(G && G.draft) && !(G && G.over) && modaleLibre()) {
        if (G) G.pending = null;
        fermerModale();
      } else if (pz && !pz.fini && pz.puzzle.kind === "mcq" && /^[1-4]$/.test(ev.key) && parseInt(ev.key, 10) <= pz.puzzle.options.length) repondre(pz.puzzle.options[parseInt(ev.key, 10) - 1]);
      else if (G && G.draft && /^[1-3]$/.test(ev.key)) apercu(parseInt(ev.key, 10) - 1);
      else if (G && G.draft && ev.key === "Enter" && G.draft.sel !== null) choisir(G.draft.sel);
      return;
    }
    if (!G || G.over) return;
    if (G.shift) {
      if (ev.key === "Escape") {
        G.shift = null;
        render();
      }
      return;
    }
    const map = { ArrowUp: 0, w: 0, z: 0, ArrowRight: 1, d: 1, ArrowDown: 2, s: 2, ArrowLeft: 3, a: 3, q: 3 };
    if (ev.key in map) {
      ev.preventDefault();
      tenter(map[ev.key]);
    }
  });

  render();

  // Petit accès pour les essais dans la console du navigateur
  window.SEUIL = { get partie() { return G; }, get enigme() { return pz && pz.puzzle; }, render: () => render(), gen: (l, t) => avecFlux("test:" + l + t, () => makePuzzle(l, t)) };
})();
