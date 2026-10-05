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
  // Le plan change à chaque étage : dimensions, départ et arrivée sont rechargés par chargerEtage().
  let ROWS = 9;
  let COLS = 5;
  let START = { r: 8, c: 2 };
  let GOAL = { r: 0, c: 2 };
  const ETAGES_TOTAL = 3;
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
  // Sons demandés par le jeu. Valeur : le son existant joué à la place tant que le fichier n'est pas fourni (null : silence).
  const SONS = {
    // existants
    clic: null, page: null, "page-journal": null, tampon: null, punaise: null, rature: null, deblocage: null, "crayon-note": null, "carte-depliee": null,
    // à fournir (voir audio/LISEZMOI.md)
    "paquet-dechire": "page",
    "carte-retournee": "page",
    "carte-rare": "carte-depliee",
    "enigme-ok": "deblocage",
    "enigme-ko": "rature",
    tic: null,
    piece: null,
    "case-bonus": "crayon-note",
    "case-interdit": "rature",
    "case-malus": "rature",
    "pose-salle": null,
    "etage-fin": "tampon",
    victoire: "tampon",
    defaite: "rature",
    exploit: "tampon",
  };
  const sonsManquants = new Set(); // fichiers demandés mais introuvables
  function son(nom) {
    if (muet) return;
    try {
      let a = sonsCache[nom];
      if (a === null) {
        if (SONS[nom]) son(SONS[nom]);
        return;
      }
      if (!a) {
        a = new Audio("audio/" + nom + ".mp3");
        a.addEventListener("error", () => {
          sonsCache[nom] = null;
          sonsManquants.add(nom);
          if (SONS[nom]) son(SONS[nom]);
        });
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
    { id: "tresorerie", nom: "Trésorerie des Gardiens", court: "Trésor", doors: [], w: 2, max: 1, kind: "bonus", fx: { coins: 8 }, desc: "Un coffre ouvert, des pièces d'un autre siècle. Un cul-de-sac." },
    { id: "autel", nom: "Autel du seuil", court: "Autel", doors: ["F"], w: 2, max: 1, kind: "bonus", fx: { steps: 6, dice: 1, seals: 1 }, desc: "Une offrande y attend celui qui a su venir jusqu'ici." },
    { id: "miroirs", nom: "Salle des miroirs", court: "Miroirs", doors: ["F", "L", "R"], mirror: true, w: 2, max: 1, kind: "bonus", fx: { steps: 4 }, desc: "Cent reflets, trois issues. L'un des reflets vous précède." },
    { id: "eboulis", nom: "Éboulement", court: "Éboulis", doors: ["F"], w: 3, max: 2, kind: "trap", fx: { steps: -3 }, desc: "La voûte a cédé. Il faut contourner les gravats." },
  ];
  // Niveau d'une salle : 0 base · 1 courant · 2 avancé · 3 rare. Il fixe l'étage à partir duquel elle peut apparaître.
  const NIVEAU_SALLE = {
    galerie: 0, coude: 0, fourche: 0, te: 0,
    croisee: 1, cellier: 1, refectoire: 1, boutique: 1, archives: 1, cristallerie: 1, cave: 1,
    reliquaire: 2, forge: 2, sablier: 2, fresque: 2, cabinet: 2, engrenages: 2, vents: 2,
    puits: 3, sanctuaire: 3, tresorerie: 3, autel: 3, miroirs: 3,
  };
  SALLES.forEach((t) => (t.niv = NIVEAU_SALLE[t.id] || 0));
  // Poids de chaque niveau selon l'étage (0 : le niveau n'apparaît pas encore)
  const POIDS_NIVEAU = { 1: { 0: 6, 1: 4 }, 2: { 0: 3, 1: 4, 2: 3 }, 3: { 0: 2, 1: 3, 2: 3, 3: 2 } };
  const SYMB_NIVEAU = ["○", "◐", "●", "★"];
  const NOM_NIVEAU = ["Base", "Courant", "Avancé", "Rare"];
  const niveauTag = (t) => `<span class="niv-tag niv${t.niv}" title="Niveau ${t.niv} : ${NOM_NIVEAU[t.niv]}">${SYMB_NIVEAU[t.niv]} ${NOM_NIVEAU[t.niv]}</span>`;
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

  // ---- Les jokers : des règles passives, achetées en boutique ----
  const RARETES = {
    commun: { nom: "Commun", prix: 8, w: 6, couleur: "#6E655A" },
    peu: { nom: "Peu commun", prix: 14, w: 3, couleur: "#3F5B66" },
    rare: { nom: "Rare", prix: 22, w: 1, couleur: "#B98B2A" },
  };
  const EMPLACEMENTS_DEPART = 3;
  const EMPLACEMENTS_MAX = 5;
  const PRIX_EMPLACEMENT = { 3: 15, 4: 25 };
  const JOKERS = [
    { id: "loupe", nom: "Loupe de Valcourt", rar: "commun", famille: "Énigmes", icone: "🔍", desc: "+5 secondes à chaque énigme." },
    { id: "piece", nom: "Pièce fêlée", rar: "commun", famille: "Économie", icone: "🪙", desc: "+1 pièce à chaque énigme résolue." },
    { id: "sourcier", nom: "Baguette de sourcier", rar: "commun", famille: "Gemmes", requiert: "gemmes", icone: "🌿", desc: "Les salles à gemmes apparaissent deux fois plus souvent en récompense et en boutique." },
    { id: "craie", nom: "Craie du géomètre", rar: "commun", famille: "Plan", icone: "📐", desc: "Poser une salle contre une salle de même couleur rapporte 1 pièce." },
    { id: "sacoche", nom: "Sacoche du serrurier", rar: "peu", famille: "Deck", icone: "👜", desc: "+3 au plafond du deck." },
    { id: "cle", nom: "Clé à quatre dents", rar: "peu", famille: "Tirage", icone: "🗝", desc: "Une fois sur 3, une salle à 4 portes s'ajoute à votre tirage. Elle n'entre pas dans votre deck." },
    { id: "ciseau", nom: "Ciseau de lapidaire", rar: "peu", famille: "Gemmes", requiert: "gemmes", icone: "💎", desc: "Vos gemmes décalent de 1 ou 2 crans, même les gemmes courantes." },
    { id: "boussole", nom: "Boussole du nord", rar: "peu", famille: "Tirage", icone: "🧭", desc: "Chaque tirage contient, si votre deck le permet, une salle avec une porte en face de vous." },
    { id: "sentier", nom: "Sentier de couleur", rar: "peu", famille: "Pas", icone: "🌈", desc: "En entrant dans une salle de même couleur que celle que vous quittez, 50 % de chance que le pas ne coûte rien." },
    { id: "main4", nom: "Quatrième main", rar: "rare", famille: "Tirage", icone: "🖐", desc: "Vous tirez 4 cartes au lieu de 3." },
    { id: "souffle", nom: "Second souffle", rar: "rare", famille: "Énigmes", icone: "💨", desc: "Une énigme ratée par partie ne condamne pas la porte : vous pourrez la retenter." },
    { id: "alambic", nom: "Alambic", rar: "rare", famille: "Économie", icone: "⚗", desc: "Les pas, les dés et les sceaux des salles bonus sont doublés." },
    { id: "sablier2", nom: "Sablier fêlé", rar: "peu", maudit: true, famille: "Énigmes", icone: "⌛", desc: "+10 secondes à chaque énigme. Prix : 3 pas de moins tout de suite (et à chaque nouvel étage).", prix: "−3 pas" },
    { id: "pacte", nom: "Pacte du fondeur", rar: "peu", maudit: true, famille: "Économie", icone: "📜", desc: "+1 pièce à chaque énigme résolue. Prix : le plafond du deck est réduit de 3.", prix: "plafond −3" },
    { id: "poing", nom: "Poing des Gardiens", rar: "rare", maudit: true, famille: "Gemmes", requiert: "gemmes", icone: "✊", desc: "Vos gemmes décalent toujours de 2 crans, et votre propre salle est entraînée avec sa ligne au lieu de rester en place.", prix: "votre salle bouge aussi" },
  ];
  const JOKERS_PAR_ID = {};
  JOKERS.forEach((j) => (JOKERS_PAR_ID[j.id] = j));
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
  // ---- Les plans (un par étage, tirés par la graine) ----
  // # case murée · . case libre · D départ · C Chambre · B Boutique fixe · P Puits fixe · S Sanctuaire fixe · F Forge fixe
  // Le nombre de pas est propre à chaque plan : environ 5,6 fois la distance la plus courte au premier étage,
  // 5,3 fois au deuxième, 5 fois au troisième.
  const PLANS = [
    { id: "vestibule", nom: "Le vestibule", tier: 1, pas: 34, carte: ["..C..", ".....", "...?.", ".B...", ".?...", ".....", "..D.."] },
    { id: "ailes", nom: "Les deux ailes", tier: 1, pas: 45, carte: ["C.#..", "..#..", ".?...", ".#.#.", "...?.", "..#..", "..D.."] },
    { id: "palier", nom: "Le palier", tier: 1, pas: 45, carte: ["....C.", "..?...", ".#..#.", "....?.", ".#..#.", ".D...."] },
    { id: "croix", nom: "La croix", tier: 2, pas: 32, carte: ["#.C.#", "#...#", "...?.", ".?...", "..?..", "#...#", "#.D.#"] },
    { id: "piliers", nom: "Les piliers", tier: 2, pas: 32, carte: ["..C..", ".#.#.", ".?.?.", ".#.#.", "...?.", ".#.#.", "..D.."] },
    { id: "aile", nom: "L'aile brisée", tier: 2, pas: 58, carte: ["C....", "..?..", ".###.", ".....", "...?.", ".###.", ".?...", "....D"] },
    { id: "anneau", nom: "L'anneau", tier: 3, pas: 50, carte: ["..C..", ".?.?.", ".###.", ".###.", "?...?", ".....", "..D.."] },
    { id: "hall", nom: "Le grand hall", tier: 3, pas: 40, carte: ["..C..", ".?...", ".#.#.", "...?.", "..S..", ".?...", ".#.#.", "...?.", "..D.."] },
    { id: "derniere", nom: "La dernière porte", tier: 3, pas: 60, carte: [".....C", "..?...", ".##...", "....?.", "...##.", ".?..?.", ".P....", "D....."] },
    // Plan réservé aux tests automatiques : jamais tiré (étage 0)
    { id: "essai", nom: "Plan d'essai", tier: 0, pas: 45, carte: ["..C..", ".....", ".....", ".....", ".....", ".....", ".....", ".....", "..D.."] },
  ];
  // ---- Les paliers : les règles arrivent une par une, débloquées entre les parties ----
  // Ordre fixe de la première campagne : base, murs et salles fixes, jokers, cases spéciales, gemmes.
  // « pret: false » : la règle n'existe pas encore ; le palier est affiché « bientôt » et sauté.
  const PALIERS = [
    {
      n: 1, id: "base", nom: "Le jeu de base", pret: true,
      resume: "Énigmes, deck, pièces et boutique.",
      texte: [
        "Vous descendez dans le labyrinthe des Gardiens du seuil, sur les traces du serrurier Valcourt. Trois étages, et une Chambre à atteindre à chacun.",
        "<b>Chaque porte est scellée par une énigme chronométrée.</b> Vous n'avez qu'une chance : une énigme ratée condamne la porte.",
        "<b>Réussie, elle vous rapporte des pièces</b> et vous fait choisir une salle parmi trois cartes tirées de votre deck. Chaque pas coûte 1 : à zéro, l'expédition s'arrête.",
        "<b>Vos pièces</b> achètent de nouvelles cartes, ou retirent les mauvaises, chez le marchand entre deux étages.",
      ],
    },
    {
      n: 2, id: "murs", nom: "Murs et salles fixes", pret: true,
      resume: "Des plans plus tortueux.",
      texte: [
        "Le plan n'est plus un simple rectangle.",
        "<b>Des murs de pierre</b> barrent certaines cases : rien ne peut y être posé, on ne les traverse pas, et une porte contre un mur n'existe pas.",
        "<b>Des salles fixes</b>, marquées d'une punaise 📌 (boutique, puits, sanctuaire), sont posées d'avance et ne bougent jamais.",
        "Les plans sont plus longs à parcourir : le nombre de pas de chaque étage s'adapte à sa forme.",
      ],
    },
    {
      n: 3, id: "jokers", nom: "Les jokers", pret: true,
      resume: "Des règles passives à acheter.",
      texte: [
        "<b>Un joker est une règle passive</b> qui change votre partie : plus de temps, plus de pièces, un tirage élargi...",
        "Vous avez <b>3 emplacements</b> (jusqu'à 5, en boutique). Chaque boutique vend 2 jokers ; vous pouvez les <b>revendre à moitié prix</b>.",
        "Attention aux <b>malédictions</b> : des jokers très puissants, mais avec un prix. Une bulle et un éclat signalent chaque fois qu'un joker agit.",
      ],
    },
    {
      n: 4, id: "cases", nom: "Cases spéciales", pret: true,
      resume: "Des cases qui changent les règles un instant.",
      texte: [
        "Certaines cases du plan, marquées d'un <b>« ? »</b>, ont un <b>environnement spécial</b>. Vous savez qu'il y en a une, mais pas laquelle : l'effet se révèle <b>quand vous arrivez</b> sur la case.",
        "Il y a trois sortes d'effets : des <b>bonus</b> (un pas gratuit, des pièces, un sceau), des <b>interdictions de pose</b> (« pas de salle rouge ici »), et des <b>malus</b> (jokers coupés, porte plus dure, pas perdus).",
        "Un effet dure <b>jusqu'à la prochaine salle posée</b> : il touche votre prochain pas, votre prochaine énigme, votre prochain tirage, puis il s'éteint. Les interdictions sont révélées quand vous ouvrez la porte vers la case, avant de choisir la salle.",
        "Ces cases font partie du terrain : les gemmes ne les déplacent pas, seules les salles glissent au-dessus.",
      ],
    },
    {
      n: 5, id: "gemmes", nom: "Les gemmes", pret: true,
      resume: "Décaler les lignes et les colonnes du plan.",
      texte: [
        "Certaines salles donnent des <b>gemmes ↔ et ↕</b>. Une gemme décale toute une ligne (↔) ou toute une colonne (↕) du plan d'un cran, <b>en bouclant</b> : la salle qui sort d'un côté réapparaît de l'autre.",
        "Les murs, les salles fixes, le vestibule, la Chambre et <b>la salle où vous êtes</b> ne bougent pas : les autres salles glissent en les sautant. Les gemmes rares vont jusqu'à deux crans.",
        "Touchez la gemme dans le panneau, puis une ligne ou une colonne, puis un sens. Elle est grisée quand aucune ligne n'est utilisable.",
      ],
    },
  ];
  // ---- Cases spéciales : huit environnements ----
  // cat : bonus (à l'arrivée), interdiction (révélée quand on ouvre la porte vers la case), malus.
  const ENVIRONNEMENTS = {
    passe_libre: { nom: "Passe libre", cat: "bonus", icone: "👣", desc: "La prochaine salle où vous entrez ne coûte aucun pas." },
    filon: { nom: "Filon", cat: "bonus", icone: "💰", desc: "+3 pièces." },
    cle_oubliee: { nom: "Clé oubliée", cat: "bonus", icone: "🗝", desc: "+1 sceau." },
    interdit_couleur: { nom: "Interdit de couleur", cat: "interdiction", icone: "🚫", desc: (e) => "Ici, pas de salle de couleur " + THEMES[e.param].nom + " (" + THEMES[e.param].glyphe + ")." },
    pas_cul_de_sac: { nom: "Pas de cul-de-sac", cat: "interdiction", icone: "⛔", desc: "Ici, la salle posée doit avoir au moins une sortie." },
    brouillard: { nom: "Brouillard", cat: "malus", icone: "🌫", desc: "Vos jokers sont coupés jusqu'à la prochaine salle posée." },
    serrure_grippee: { nom: "Serrure grippée", cat: "malus", icone: "🔒", desc: "La prochaine porte est d'un niveau plus dur (3 au maximum)." },
    eboulis: { nom: "Éboulis", cat: "malus", icone: "⛏", desc: "−2 pas." },
  };
  const CATEGORIES_ENV = ["bonus", "interdiction", "malus"];
  const texteEnv = (e) => {
    const d = ENVIRONNEMENTS[e.id].desc;
    return typeof d === "function" ? d(e) : d;
  };

  // Mode libre : la graine mélange l'ordre des quatre règles optionnelles ; les k premières sont actives.
  const REGLES_OPTIONNELLES = ["murs", "jokers", "cases", "gemmes"];
  const NOMS_REGLES = { murs: "Murs et salles fixes", jokers: "Jokers", cases: "Cases spéciales", gemmes: "Gemmes" };
  const PALIER_DE_REGLE = { murs: 2, jokers: 3, cases: 4, gemmes: 5 };
  function ordreDesRegles(seed) {
    const rng = mulberry32(hachage("ordre-regles|" + seed));
    const a = REGLES_OPTIONNELLES.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function reglesLibres(seed, k) {
    const r = { murs: false, jokers: false, cases: false, gemmes: false };
    ordreDesRegles(seed).slice(0, k).forEach((id) => (r[id] = true));
    return r;
  }
  let libreK = 2; // nombre de règles actives choisi dans le menu

  const reglesDe = (n) => ({ murs: n >= 2, jokers: n >= 3, cases: n >= 4, gemmes: n >= 5 });
  const RATIO_PAS = { 0: 5.6, 1: 5.6, 2: 5.3, 3: 5.0 }; // pas = ratio × distance la plus courte, selon les règles actives
  const palierDe = (n) => PALIERS.find((p) => p.n === n);
  const dernierPalierPret = () => PALIERS.filter((p) => p.pret).slice(-1)[0].n;
  const palierSuivant = (n) => {
    const p = PALIERS.find((x) => x.n > n && x.pret);
    return p ? p.n : 0;
  };
  // ---- Exploits : chacun débloque une carte (salle) ou un joker, pour toujours ----
  // ev : "tick" (n'importe quand), "etage" (Chambre d'un étage atteinte), "win" (Chambre du dernier étage)
  const finDEtage = (ev) => ev === "etage" || ev === "win";
  const EXPLOITS = [
    { id: "premiere", nom: "Première Chambre", desc: "Atteindre la Chambre du 1er étage.", cle: { type: "salle", id: "sablier" }, ok: (g, ev) => finDEtage(ev) && g.etage === 1 || ev === "win" },
    { id: "sans-condamner", nom: "Serrurier consciencieux", desc: "Finir un étage sans condamner une seule porte.", cle: { type: "salle", id: "cabinet" }, ok: (g, ev) => finDEtage(ev) && g.stat.condamnesEtage === 0 },
    { id: "dix-enigmes", nom: "Esprit délié", desc: "Résoudre 10 énigmes en une partie.", cle: { type: "salle", id: "archives" }, ok: (g) => g.solved >= 10 },
    { id: "douze-salles", nom: "Bâtisseur", desc: "Poser 12 salles en une partie.", cle: { type: "salle", id: "puits" }, ok: (g) => g.rooms - 1 >= 12 },
    { id: "victoire", nom: "Sortie des Gardiens", desc: "Gagner une partie.", cle: { type: "salle", id: "sanctuaire" }, ok: (g, ev) => ev === "win" },
    { id: "mots", nom: "Bouche d'ombre", desc: "Résoudre 4 énigmes de Mots en une partie.", cle: { type: "salle", id: "fresque" }, ok: (g) => g.stat.mots >= 4 },
    { id: "acheteur", nom: "Client fidèle", desc: "Acheter 3 cartes en une partie.", cle: { type: "salle", id: "forge" }, ok: (g) => g.achats >= 3 },
    { id: "deck-mince", nom: "Léger bagage", desc: "Gagner avec 8 cartes ou moins dans le deck.", cle: { type: "salle", id: "reliquaire" }, ok: (g, ev) => ev === "win" && g.deck.length <= 8 },
    { id: "fortune", nom: "Bourse pleine", desc: "Avoir 15 pièces en même temps.", cle: { type: "joker", id: "alambic" }, ok: (g) => g.coins >= 15 },
    { id: "niveau3", nom: "Nerfs d'acier", desc: "Résoudre 4 énigmes de niveau 3 en une partie.", cle: { type: "joker", id: "souffle" }, ok: (g) => g.stat.niv3 >= 4 },
    { id: "sans-des", nom: "Ni dé ni sceau", desc: "Finir un étage sans utiliser de dé ni de sceau.", cle: { type: "joker", id: "boussole" }, ok: (g, ev) => finDEtage(ev) && g.stat.deEtage === 0 },
    { id: "pas-restants", nom: "Sans hâte", desc: "Finir un étage avec au moins 15 pas restants.", cle: { type: "joker", id: "main4" }, ok: (g, ev) => finDEtage(ev) && g.steps >= 15 },
    { id: "jokers", nom: "Collectionneur", desc: "Acheter 2 jokers en une partie.", cle: { type: "joker", id: "pacte" }, ok: (g) => g.stat.jokersAchetes >= 2 },
    { id: "eclair", nom: "Réflexes", desc: "Résoudre 3 énigmes en moins de 8 secondes chacune, en une partie.", cle: { type: "joker", id: "sablier2" }, ok: (g) => g.stat.rapides >= 3 },
    { id: "gemmes", nom: "Lapidaire", desc: "Utiliser 3 gemmes en une partie.", cle: { type: "joker", id: "poing" }, ok: (g) => g.stat.gemmes >= 3 },
  ];
  function exploits() {
    try {
      const p = JSON.parse(localStorage.getItem("seuil-exploits") || "{}");
      return { faits: p.faits || {}, tout: !!p.tout };
    } catch (e) {
      return { faits: {}, tout: false };
    }
  }
  function sauverExploits(x) {
    try {
      localStorage.setItem("seuil-exploits", JSON.stringify(x));
    } catch (e) {}
  }
  const exploitFait = (id) => {
    const x = exploits();
    return x.tout || !!x.faits[id];
  };
  const carteVerrouillee = (type, id) => EXPLOITS.some((e) => e.cle.type === type && e.cle.id === id && !exploitFait(e.id));
  const salleVerrouillee = (id) => carteVerrouillee("salle", id);
  const jokerVerrouille = (id) => carteVerrouillee("joker", id);
  const nomRecompense = (cle) => (cle.type === "salle" ? "la salle « " + SALLES_PAR_ID[cle.id].nom + " »" : "le joker « " + JOKERS_PAR_ID[cle.id].icone + " " + JOKERS_PAR_ID[cle.id].nom + " »");

  // Vérifie les exploits non encore accomplis (appelé à chaque affichage et aux fins d'étage).
  function controler(ev) {
    if (!G) return;
    const x = exploits();
    EXPLOITS.forEach((e) => {
      if (x.tout || x.faits[e.id] || !e.ok(G, ev || "tick")) return;
      x.faits[e.id] = true;
      sauverExploits(x);
      G.nouveauxExploits.push(e.id);
      son("exploit");
      log("🏆 Exploit : " + e.nom + ". Débloque " + nomRecompense(e.cle) + ".");
      toast("🏆 Exploit : " + e.nom + " — " + nomRecompense(e.cle) + " débloqué");
    });
  }

  // ---- Joker fétiche : un joker gardé d'une partie à l'autre ----
  function fetiche() {
    try {
      const id = JSON.parse(localStorage.getItem("seuil-fetiche") || "{}").id;
      return id && JOKERS_PAR_ID[id] ? id : null;
    } catch (e) {
      return null;
    }
  }
  function sauverFetiche(id) {
    try {
      if (id) localStorage.setItem("seuil-fetiche", JSON.stringify({ id }));
      else localStorage.removeItem("seuil-fetiche");
    } catch (e) {}
  }

  // ---- Pion : forme et couleur au choix ----
  const FORMES_PION = {
    salamandre: { nom: "Salamandre" },
    rond: { nom: "Rond", svg: `<circle cx="12" cy="12" r="8"/>` },
    losange: { nom: "Losange", svg: `<path d="M12 2.5 21.5 12 12 21.5 2.5 12Z"/>` },
    triangle: { nom: "Triangle", svg: `<path d="M12 3 21.5 20.5H2.5Z"/>` },
    etoile: { nom: "Étoile", svg: `<polygon points="12,2 14.9,8.6 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.6"/>` },
    croix: { nom: "Croix", svg: `<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>` },
    cle: { nom: "Serrure", svg: `<circle cx="12" cy="8" r="5.5"/><path d="M9.8 12h4.4l1.8 9H8z"/>` },
    flamme: { nom: "Flamme", svg: `<path d="M12 2c1 4.2 5.5 6.2 5.5 11.2a5.5 5.5 0 0 1-11 0c0-2.2 1-3.4 2.2-4.6 0 2 1 3 2.3 3.2C10.3 8.2 10.5 5.4 12 2z"/>` },
  };
  const COULEURS_PION = [
    { id: "rouge", nom: "Rouge", c: "#C0392B" },
    { id: "or", nom: "Or", c: "#D4A017" },
    { id: "bleu", nom: "Bleu", c: "#3F7CAC" },
    { id: "vert", nom: "Vert", c: "#4C9A5A" },
    { id: "violet", nom: "Violet", c: "#7E57A8" },
    { id: "rose", nom: "Rose", c: "#D0648F" },
    { id: "ivoire", nom: "Ivoire", c: "#F1E8D0" },
    { id: "noir", nom: "Noir", c: "#2A2620" },
  ];
  function pion() {
    try {
      const p = JSON.parse(localStorage.getItem("seuil-pion") || "{}");
      return { forme: FORMES_PION[p.forme] ? p.forme : "salamandre", couleur: COULEURS_PION.some((c) => c.id === p.couleur) ? p.couleur : "rouge" };
    } catch (e) {
      return { forme: "salamandre", couleur: "rouge" };
    }
  }
  function sauverPion(x) {
    try {
      localStorage.setItem("seuil-pion", JSON.stringify(x));
    } catch (e) {}
  }
  const couleurPion = (id) => COULEURS_PION.find((c) => c.id === id).c;
  // Le pion en SVG (ou la salamandre, entourée de la couleur choisie)
  function pionSVG(forme, couleur, classe) {
    const col = couleurPion(couleur);
    if (forme === "salamandre") return `<span class="${classe} pion-sal" style="--c:${col}"><img src="img/salamandre.png" alt="" onerror="this.remove()"></span>`;
    return `<span class="${classe} pion-svg" style="--c:${col}"><svg viewBox="0 0 24 24" aria-hidden="true"><g fill="${col}" stroke="#2A2620" stroke-width="1.6" stroke-linejoin="round">${FORMES_PION[forme].svg}</g></svg></span>`;
  }

  function paliers() {
    try {
      const p = JSON.parse(localStorage.getItem("seuil-paliers") || "{}");
      return { max: p.max || 1, gagnes: p.gagnes || {}, vus: p.vus || {} };
    } catch (e) {
      return { max: 1, gagnes: {}, vus: {} };
    }
  }
  function sauverPaliers(p) {
    try {
      localStorage.setItem("seuil-paliers", JSON.stringify(p));
    } catch (e) {}
  }
  let palierChoisi = 0; // palier sélectionné dans le menu (0 : le plus avancé)
  function palierEffectif() {
    const P = paliers();
    const n = palierChoisi;
    return n && n <= P.max && palierDe(n) && palierDe(n).pret ? n : P.max;
  }

  const SALLES_FIXES = { B: "boutique", P: "puits", S: "sanctuaire", F: "forge" };
  const AJAR_PAR_ETAGE = { 1: 0.22, 2: 0.15, 3: 0.08 };

  function parserPlan(plan, miroir, regles) {
    regles = regles || { murs: true };
    const rows = plan.carte.map((r) => (miroir ? r.split("").reverse().join("") : r));
    const nr = rows.length, nc = rows[0].length;
    const mur = Array.from({ length: nr }, () => Array(nc).fill(false));
    const fixes = [];
    const speciales = [];
    let start = null, goal = null;
    rows.forEach((ligne, r) => {
      if (ligne.length !== nc) throw new Error("Plan " + plan.id + " : lignes de longueurs différentes");
      ligne.split("").forEach((ch, c) => {
        // Sans la règle « murs et salles fixes », # et B P S F deviennent des cases libres
        if (ch === "#") mur[r][c] = !!regles.murs;
        else if (ch === "D") start = { r, c };
        else if (ch === "C") goal = { r, c };
        else if (SALLES_FIXES[ch] && regles.murs) fixes.push({ r, c, id: SALLES_FIXES[ch] });
        else if (ch === "?" && regles.cases) speciales.push({ r, c }); // sans la règle, un ? est une case libre
      });
    });
    if (!start || !goal) throw new Error("Plan " + plan.id + " : départ ou Chambre manquant");
    // distance jusqu'à la Chambre, à travers les cases non murées
    const dist = Array.from({ length: nr }, () => Array(nc).fill(Infinity));
    dist[goal.r][goal.c] = 0;
    const file = [[goal.r, goal.c]];
    while (file.length) {
      const [r, c] = file.shift();
      for (let d = 0; d < 4; d++) {
        const a = r + DIRS[d].dr, b = c + DIRS[d].dc;
        if (a < 0 || b < 0 || a >= nr || b >= nc || mur[a][b] || dist[a][b] !== Infinity) continue;
        dist[a][b] = dist[r][c] + 1;
        file.push([a, b]);
      }
    }
    return { rows: nr, cols: nc, mur, fixes, speciales, start, goal, dist };
  }

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
    // Memory : on mémorise les cartes pendant quelques secondes, puis on retrouve les paires
    memoire(l) {
      const SYM = ["🦎", "🗝", "🕯", "👁", "📜", "⚓", "🔔", "🗡"];
      const paires = [3, 6, 8][l - 1];
      const choisis = shuffle(SYM.slice()).slice(0, paires);
      const cartes = shuffle(choisis.concat(choisis));
      return { kind: "memoire", label: "Mémoire", cartes, cols: [3, 4, 4][l - 1], paires, erreursMax: Math.round(paires * 1.5), erreurs: 0, etats: cartes.map(() => "visible"), ouvertes: [], phase: "apercu", trouvees: 0, verrou: false, answer: "memoire" };
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
  const TEMPS_MEMOIRE = { 1: 35, 2: 55, 3: 75 };
  const APERCU_MEMOIRE = { 1: 3, 2: 4, 3: 5 }; // secondes pendant lesquelles les cartes sont visibles
  const TEMPS_WORDLE = 120;
  const ESSAIS_WORDLE = 6;
  const PENALITE_WORDLE = 6;

  // ---- Le mot caché : un Wordle à la dernière porte de chaque étage ----
  const MOTS5 = "abris acier agent aigle aller amour ancre angle arbre armee arret astre atlas avion bague balai balle banal barre bijou blanc blond bocal boire boite bonne botte boule bruit brule brume cabri cadre calme canal carte casse cause cedre chant chaos chaud chene chiot chose cible clair clous coeur colle conte copie corde corps coude coupe cours crane creux crime croix cruel cuire dague danse debut delai demon dense depot devin dieux doigt doute douze drame droit eclat ecole ecran effet email encre ennui envie epais epine epoux essai etage etang exact fable facon faire fanal farce faute femme ferme fiole fleur foire folie force forge forme fosse foule franc frele froid fruit fugue fumee furie gagne galet garde geant genou glace globe gorge grace grand grave gruau guide haine haute herbe heros heure hibou hotel huile ideal image jaune jeton jeune jouer juger jupon juste lacet laine lampe large larme lecon legal lever libre lieux ligne linge livre local loger lourd lueur lutte magie maire malin masse matin meche melee messe metal miche mirer mixte moine monde morne motif mulet munir muret neige niche noble noeud noire nuage nuire obeir objet ombre opale orage ordre outil ouvre pacte paire panne parer passe patte pause peine perle phare piege piste place plage plomb pluie poele poing point poire porte poser poule pouls prier prise puits quete queue radis rampe rayon rebut regle reine reste rever roche ronde rouge route ruban ruine ruser sable sacre saine salle salut sauce saule savon scene selle sente serre seuil signe sirop soeur sonde sorte souci spire stage style suite sujet table tache taire talon tarte tasse temps tente terme terre tigre tisse titre toile tombe tonne torse trace trahi trame trois trone tuile union usage usine vague valse vaste veine velin vendu verre vigne villa vivre voeux voile voler vouer zebre".split(" ");
  function makeWordle(level) {
    return { kind: "wordle", label: "Mot caché", answer: pick(MOTS5), guesses: [], saisie: "", level, theme: "mots" };
  }
  // v : bien placée, j : dans le mot mais ailleurs, x : absente (les doublons sont comptés une seule fois par lettre du mot)
  function noterMot(mot, reponse) {
    const res = Array(5).fill("x");
    const reste = {};
    for (let i = 0; i < 5; i++) {
      if (mot[i] === reponse[i]) res[i] = "v";
      else reste[reponse[i]] = (reste[reponse[i]] || 0) + 1;
    }
    for (let i = 0; i < 5; i++) {
      if (res[i] !== "v" && reste[mot[i]] > 0) {
        res[i] = "j";
        reste[mot[i]]--;
      }
    }
    return res;
  }
  // ---- Le code : un Mastermind à la dernière porte du 2e étage ----
  const TEMPS_MASTERMIND = 150;
  const ESSAIS_MASTERMIND = 8;
  const SYMBOLES_CODE = [
    { g: "★", c: "#B98B2A", nom: "étoile" },
    { g: "☾", c: "#3F5B66", nom: "lune" },
    { g: "♦", c: "#9A2B25", nom: "carreau" },
    { g: "♣", c: "#4C5A4E", nom: "trèfle" },
    { g: "♥", c: "#A8467A", nom: "cœur" },
    { g: "♠", c: "#2A2620", nom: "pique" },
  ];
  function makeMastermind(level) {
    const code = [0, 0, 0, 0].map(() => Math.floor(R() * SYMBOLES_CODE.length));
    return { kind: "mastermind", label: "Le code", level, theme: "symboles", code, guesses: [], saisie: [], answer: code.join(""), reponseTexte: code.map((i) => SYMBOLES_CODE[i].g).join(" ") };
  }
  // n : bien placés ; b : bon symbole, mauvaise place
  function noterCode(essai, code) {
    let n = 0;
    const ce = {}, ee = {};
    for (let i = 0; i < 4; i++) {
      if (essai[i] === code[i]) n++;
      else {
        ce[code[i]] = (ce[code[i]] || 0) + 1;
        ee[essai[i]] = (ee[essai[i]] || 0) + 1;
      }
    }
    let b = 0;
    Object.keys(ee).forEach((k) => (b += Math.min(ee[k], ce[k] || 0)));
    return { n, b };
  }

  // ---- L'enquête : un Murdle 3×3 à la dernière porte du dernier étage ----
  const TEMPS_MURDLE = 180;
  const MU_SUSPECTS = ["Mme Vasseur", "Aubin, le jardinier", "Le docteur Lambert", "Mlle Corvin", "Le comte de Sarre", "Mère Bérénice"];
  const MU_ARMES = ["le chandelier", "la clé de cuivre", "le coupe-papier", "la corde", "le tisonnier", "le flacon d'encre"];
  const MU_LIEUX = ["la cave", "la serre", "l'atelier", "la bibliothèque", "le grenier", "la chapelle"];
  const PERMS3 = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  // Un indice vrai dans le scénario caché. pp[s] : lieu du suspect s ; pw[s] : arme du suspect s.
  function indicesMurdle(pp, pw) {
    const out = [];
    for (let s = 0; s < 3; s++) {
      for (let l = 0; l < 3; l++) out.push({ t: pp[s] === l ? "pos" : "npos", s, l });
      for (let w = 0; w < 3; w++) out.push({ t: pw[s] === w ? "arm" : "narm", s, w });
    }
    for (let w = 0; w < 3; w++) for (let l = 0; l < 3; l++) out.push({ t: pp[pw.indexOf(w)] === l ? "armlieu" : "narmlieu", w, l });
    return out;
  }
  function verifie(c, pp, pw) {
    switch (c.t) {
      case "pos": return pp[c.s] === c.l;
      case "npos": return pp[c.s] !== c.l;
      case "arm": return pw[c.s] === c.w;
      case "narm": return pw[c.s] !== c.w;
      case "armlieu": return pp[pw.indexOf(c.w)] === c.l;
      default: return pp[pw.indexOf(c.w)] !== c.l;
    }
  }
  // La solution (coupable, arme) est-elle la même dans tous les scénarios compatibles avec les indices ?
  function uniqueMurdle(clues, lieuCrime) {
    const sols = new Set();
    PERMS3.forEach((pp) => PERMS3.forEach((pw) => {
      if (clues.every((c) => verifie(c, pp, pw))) {
        const k = pp.indexOf(lieuCrime);
        sols.add(k + ":" + pw[k]);
      }
    }));
    return sols.size === 1;
  }
  function makeMurdle(level) {
    for (let essai = 0; essai < 200; essai++) {
      const pp = pick(PERMS3), pw = pick(PERMS3);
      const killer = Math.floor(R() * 3);
      const lieuCrime = pp[killer];
      let clues = shuffle(indicesMurdle(pp, pw));
      const gardes = [];
      for (const c of clues) {
        gardes.push(c);
        if (uniqueMurdle(gardes, lieuCrime)) break;
      }
      if (!uniqueMurdle(gardes, lieuCrime)) continue;
      // on retire les indices devenus inutiles
      let fin = gardes.slice();
      for (let i = fin.length - 1; i >= 0; i--) {
        const sans = fin.filter((_, j) => j !== i);
        if (uniqueMurdle(sans, lieuCrime)) fin = sans;
      }
      if (fin.length < 3 || fin.length > 6) continue;
      const suspects = shuffle(MU_SUSPECTS.slice()).slice(0, 3);
      const armes = shuffle(MU_ARMES.slice()).slice(0, 3);
      const lieux = shuffle(MU_LIEUX.slice()).slice(0, 3);
      const texte = (c) => {
        switch (c.t) {
          case "pos": return suspects[c.s] + " se trouvait dans " + lieux[c.l] + ".";
          case "npos": return suspects[c.s] + " ne se trouvait pas dans " + lieux[c.l] + ".";
          case "arm": return suspects[c.s] + " tenait " + armes[c.w] + ".";
          case "narm": return suspects[c.s] + " ne tenait pas " + armes[c.w] + ".";
          case "armlieu": return majuscule(armes[c.w]) + " a été trouvé" + (/^la /.test(armes[c.w]) ? "e" : "") + " dans " + lieux[c.l] + ".";
          default: return majuscule(armes[c.w]) + " n'était pas dans " + lieux[c.l] + ".";
        }
      };
      return {
        kind: "murdle", label: "L'enquête", level, theme: "logique",
        suspects, armes, lieux, lieuCrime: lieux[lieuCrime],
        indices: fin.map(texte),
        sol: { s: killer, w: pw[killer] },
        answer: suspects[killer] + " avec " + armes[pw[killer]],
        reponseTexte: suspects[killer] + " avec " + armes[pw[killer]],
      };
    }
    return makeWordle(level); // ne devrait jamais arriver : repli sûr
  }

  const porteFinale = (P) => {
    const cible = G.grid[P.r + DIRS[P.d].dr][P.c + DIRS[P.d].dc];
    return !!(cible && cible.goal);
  };

  // Les cinq thèmes. La couleur d'une salle est le thème des énigmes
  // qui gardent ses portes de sortie.
  const THEMES = {
    chiffres: { nom: "Chiffres", couleur: "#3F5B66", glyphe: "#", gens: ["add", "sub", "mul"] },
    mots: { nom: "Mots", couleur: "#9A2B25", glyphe: "A", gens: ["ortho", "anagramme"] },
    logique: { nom: "Logique", couleur: "#4C5A4E", glyphe: "?", gens: ["suite", "intrus"] },
    symboles: { nom: "Symboles", couleur: "#B98B2A", glyphe: "★", gens: ["motif", "compte"] },
    memoire: { nom: "Mémoire", couleur: "#6B4E8A", glyphe: "◈", gens: ["memoire"] },
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

  function nouvellePartie(graine, palier, libre) {
    const seed = normaliserGraine(graine) || graineAleatoire();
    const n = palier || 1;
    const enLibre = typeof libre === "number";
    G = {
      seed,
      palier: enLibre ? 0 : n,
      libre: enLibre ? { k: libre, ordre: ordreDesRegles(seed) } : null,
      regles: enLibre ? reglesLibres(seed, libre) : reglesDe(n),
      nouveauPalier: 0,
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
      jokers: [],
      slots: EMPLACEMENTS_DEPART,
      souffle: false,
      tempUid: 0,
      flash: null,
      steps: 0,
      stepsMax: 1,
      etage: 1,
      plan: null,
      miroir: false,
      mur: [],
      distBut: [],
      dist0: 1,
      dice: 1,
      seals: 1,
      timeBonus: 0,
      grid: [],
      pos: { r: 0, c: 0 },
      gems: [],
      shift: null,
      fragments: 0,
      log: [],
      moves: 0,
      rooms: 1,
      solved: 0,
      failed: 0,
      stat: { mots: 0, niv3: 0, rapides: 0, jokersAchetes: 0, gemmes: 0, deEtage: 0, condamnesEtage: 0 },
      nouveauxExploits: [],
      over: null,
      pending: null,
      draft: null,
    };
    G.deck = DECK_DEPART.map((d) => ({ uid: ++G.uidMax, id: d[0], theme: d[1] }));
    G.pioche = melanger(G.deck);
    const fet = fetiche();
    G.fetiche = null;
    G.fetichePris = null;
    // Le fétiche ne s'applique que si sa règle est active (une gemme sans palier des gemmes n'aurait aucun effet)
    if (fet && G.regles.jokers && !(JOKERS_PAR_ID[fet].requiert === "gemmes" && !G.regles.gemmes)) {
      G.jokers.push(fet);
      G.fetiche = fet;
    }
    chargerEtage(1);
    const s = stats();
    s.runs = (s.runs || 0) + 1;
    saveStats(s);
  }

  const estMur = (r, c) => !!(G.mur[r] && G.mur[r][c]);
  const caseLibre = (r, c) => inGrid(r, c) && !estMur(r, c);
  const portesLibres = (r, c) => [0, 1, 2, 3].filter((d) => caseLibre(r + DIRS[d].dr, c + DIRS[d].dc));

  // Charge le plan de l'étage n : le plan est tiré par la graine, et peut être retourné en miroir.
  // `forcer` ne sert qu'aux tests automatiques.
  function chargerEtage(n, forcer) {
    const plan = forcer ? PLANS.find((p) => p.id === forcer.id) : avecFlux("plan:" + n, () => pick(PLANS.filter((p) => p.tier === n)));
    const miroir = forcer ? !!forcer.miroir : avecFlux("plan-miroir:" + n, () => R() < 0.5);
    const P = parserPlan(plan, miroir, G.regles);
    ROWS = P.rows;
    COLS = P.cols;
    START = P.start;
    GOAL = P.goal;
    G.etage = n;
    G.plan = plan;
    G.miroir = miroir;
    G.mur = P.mur;
    G.distBut = P.dist;
    G.dist0 = Math.max(1, P.dist[START.r][START.c]);
    G.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    G.pos = { r: START.r, c: START.c };
    G.grid[START.r][START.c] = { tpl: HALL, doors: portesLibres(START.r, START.c), visited: true, fixe: true };
    const dC = [2, 3, 1, 0].find((d) => caseLibre(GOAL.r + DIRS[d].dr, GOAL.c + DIRS[d].dc)); // la Chambre n'a qu'une porte
    G.grid[GOAL.r][GOAL.c] = { tpl: CHAMBRE, doors: [dC], visited: false, goal: true, fixe: true };
    P.fixes.forEach((f) => {
      G.grid[f.r][f.c] = { tpl: SALLES_PAR_ID[f.id], doors: portesLibres(f.r, f.c), visited: false, fixe: true, theme: null };
    });
    // Cases spéciales : les emplacements viennent du plan, les effets sont tirés par la graine
    G.stat.deEtage = 0;
    G.stat.condamnesEtage = 0;
    G.speciales = {};
    G.envs = [];
    if (G.regles.cases && P.speciales.length) {
      const effets = avecFlux("cases:" + n, () => tirerEffets(P.speciales.length));
      const cases = avecFlux("cases-pos:" + n, () => shuffle(P.speciales));
      cases.forEach((c, i) => (G.speciales[c.r + "," + c.c] = { id: effets[i].id, param: effets[i].param, revele: false, declenche: false }));
    }
    // Les pas suivent la forme du plan avec les règles actives : environ 5,6 fois la distance au 1er étage, 5,3 au 2e, 5 au 3e
    const pas = Math.round((RATIO_PAS[plan.tier] || 5.6) * G.dist0);
    G.stepsMax = Math.max(5, pas - (aJoker("sablier2") ? 3 : 0)); // le Sablier fêlé retire 3 pas à chaque étage
    G.steps = G.stepsMax;
    G.dice = Math.max(1, G.dice); // un dé et un sceau sont renouvelés à chaque étage
    G.seals = Math.max(1, G.seals);
    G.pending = null;
    G.draft = null;
    G.shift = null;
    G.boutique = null;
    G.visite = null;
    log("Étage " + n + " sur " + ETAGES_TOTAL + " : « " + plan.nom + " ». " + G.stepsMax + " pas." + (Object.keys(G.speciales).length ? " " + Object.keys(G.speciales).length + " case" + (Object.keys(G.speciales).length > 1 ? "s" : "") + " spéciale" + (Object.keys(G.speciales).length > 1 ? "s" : "") + " (?)." : ""));
  }

  // n effets répartis entre bonus, interdictions et malus : toujours un bonus d'abord, puis un mélange
  function tirerEffets(n) {
    const par = { bonus: [], interdiction: [], malus: [] };
    Object.keys(ENVIRONNEMENTS).forEach((id) => {
      if (id === "brouillard" && !G.regles.jokers) return; // sans jokers, le Brouillard n'aurait aucun effet
      par[ENVIRONNEMENTS[id].cat].push(id);
    });
    const ordre = ["bonus"].concat(shuffle(["interdiction", "malus"]));
    const pris = new Set();
    const out = [];
    for (let i = 0; i < n; i++) {
      const cat = i < 3 ? ordre[i] : pick(CATEGORIES_ENV);
      const libres = par[cat].filter((id) => !pris.has(id));
      const id = pick(libres.length ? libres : par[cat]);
      pris.add(id);
      out.push({ id, param: id === "interdit_couleur" ? pick(THEME_IDS) : null });
    }
    return out;
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
  // Avancée vers la Chambre, de 0 (départ) à 1 (Chambre)
  function progres(r, c) {
    const d = G.distBut[r] ? G.distBut[r][c] : undefined;
    if (d === undefined || d === Infinity) return 0.5;
    return Math.max(0, Math.min(1, 1 - d / G.dist0));
  }

  function porteDe(room, r, c, d) {
    room.door = room.door || {};
    const r2 = r + DIRS[d].dr, c2 = c + DIRS[d].dc;
    const cible = G.grid[r2][c2];
    let D = room.door[d];
    if (!D) {
      D = avecFlux("porte:" + G.etage + ":" + r + "," + c + "," + d, () => {
        let level, status = "locked";
        if (cible && cible.goal) level = 3;
        else {
          // La difficulté monte avec l'étage et avec l'avancée vers la Chambre
          const p = Math.max(progres(r, c), progres(r2, c2));
          const seuil = { 1: 0.5, 2: 0.35, 3: 0.2 }[G.etage] || 0.5;
          level = p < seuil ? G.etage : Math.min(3, G.etage + 1);
          const plancher = G.etage === 1 ? 1 : 2;
          const x = R();
          if (x < 0.2 && level > plancher) level -= 1;
          else if (x > 0.85 && level < 3) level += 1;
          if (R() < (AJAR_PAR_ETAGE[G.etage] || 0.15)) { status = "ajar"; level = 0; }
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
    if (!caseLibre(r2, c2)) return { s: "wall" };
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
      if (!caseLibre(nr, nc)) return; // pas de porte sur le vide ni contre un mur
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
    const main = piocher(tailleMain());
    G.tirages += 1;
    // Clé à quatre dents : une fois sur 3, une salle à 4 portes (temporaire) prend la place de la dernière carte
    if (aJoker("cle") && main.length) {
      const th = avecFlux("cle:" + G.tirages, () => (R() < 1 / 3 ? pick(THEME_IDS) : null));
      if (th) {
        G.pioche.unshift(main.pop()); // la carte remplacée retourne en haut de la pioche
        main.push({ uid: -(++G.tempUid), id: "croisee", theme: th, temp: true });
        declencher("cle", "une salle à 4 portes s'ajoute à votre tirage");
      }
    }
    const cands = main.map((card, i) => avecFlux("miroir:" + G.tirages + ":" + i, () => candidat(card, d, tr, tc)));
    // Boussole du nord : au moins une salle avec une porte en face, si la pioche en contient une
    let ecartable = -1; // on n'écarte jamais une carte temporaire : elle ne peut pas retourner dans la pioche
    cands.forEach((c, x) => {
      if (!c.card.temp) ecartable = x;
    });
    if (aJoker("boussole") && ecartable >= 0 && !cands.some((c) => c.doors.includes(d))) {
      for (let j = 0; j < G.pioche.length; j++) {
        const cd = avecFlux("boussole:" + G.tirages + ":" + j, () => candidat(G.pioche[j], d, tr, tc));
        if (cd.doors.includes(d)) {
          const sortie = cands.splice(ecartable, 1)[0];
          G.pioche[j] = sortie.card; // la carte écartée prend sa place dans la pioche
          cands.push(cd);
          declencher("boussole", "une salle avec une porte en face de vous");
          break;
        }
      }
    }
    // Case spéciale à interdiction : cartes concernées grisées ; si toutes le sont, l'interdiction est levée
    const spI = G.speciales[tr + "," + tc];
    if (spI && ENVIRONNEMENTS[spI.id].cat === "interdiction") {
      cands.forEach((cd) => (cd.interdit = spI.id === "interdit_couleur" ? cd.card.theme === spI.param : cd.sorties === 0));
      if (cands.length && cands.every((cd) => cd.interdit)) {
        cands.forEach((cd) => (cd.interdit = false));
        cands.levee = true;
      }
    }
    return cands;
  }

  // ---- Jokers : aides et effets ----
  const brouillard = () => !!G && !!G.envs && G.envs.some((e) => e.id === "brouillard");
  const aJoker = (id) => !!G && G.jokers.includes(id) && !brouillard(); // le Brouillard coupe les jokers
  const plafondDeck = () => PLAFOND_DECK + (aJoker("sacoche") ? 3 : 0) - (aJoker("pacte") ? 3 : 0);
  const bonusTemps = () => G.timeBonus + (aJoker("loupe") ? 5 : 0) + (aJoker("sablier2") ? 10 : 0);
  const tempsPorte = (niveau) => (TEMPS_BASE[niveau] || 35) + bonusTemps();
  const tailleMain = () => (aJoker("main4") ? 4 : 3);
  // Crans autorisés pour une gemme
  function crans(g) {
    if (aJoker("poing")) return [2];
    return (aJoker("ciseau") ? 2 : g.max) === 2 ? [1, 2] : [1];
  }
  const prixJoker = (j) => RARETES[j.rar].prix;

  function toast(msg) {
    let pile = document.getElementById("toasts");
    if (!pile) {
      pile = document.createElement("div");
      pile.id = "toasts";
      pile.className = "toast-pile";
      document.body.appendChild(pile);
    }
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    pile.appendChild(el);
    setTimeout(() => el.classList.add("sortie"), 2000);
    setTimeout(() => el.remove(), 2600);
  }

  // Signale qu'un joker vient de agir : ligne de journal (sauf effet répété), bulle et éclat sur son emplacement
  function declencher(id, texte, silencieux) {
    const j = JOKERS_PAR_ID[id];
    if (!silencieux) log(j.icone + " " + j.nom + " : " + texte);
    toast(j.icone + " " + j.nom + " : " + texte);
    G.flash = id;
    setTimeout(() => {
      if (G && G.flash === id) G.flash = null;
    }, 1400);
  }

  // ---- Économie : offres de cartes, achats, retraits ----
  const copies = (id) => G.deck.filter((c) => c.id === id).length;
  const prixCarte = (tpl) => (tpl.kind === "pass" ? PRIX_CARTE_COURANTE : PRIX_CARTE_SPECIALE);
  const prixRetrait = () => PRIX_RETRAIT + 2 * G.retraits;
  const deckPlein = () => G.deck.length >= plafondDeck();

  // n cartes distinctes du pool (les salles pièges n'y figurent pas). Le hasard vient du flux courant.
  // opts : { niveaux: [..], kind: "bonus", theme: "mots" } pour les paquets
  function offrir(n, forcer, opts) {
    opts = opts || {};
    const poids = POIDS_NIVEAU[Math.min(3, G.etage || 1)];
    const somme = {};
    SALLES.forEach((t) => {
      if (t.kind !== "trap") somme[t.niv] = (somme[t.niv] || 0) + t.w;
    });
    const pool = SALLES.filter((t) => t.kind !== "trap" && !salleVerrouillee(t.id) && copies(t.id) < (t.max || 99) && (G.regles.gemmes || !(t.fx && t.fx.gem)) && poids[t.niv] && (!opts.niveaux || opts.niveaux.includes(t.niv)) && (!opts.kind || t.kind === opts.kind)).map((t) => ({ t, w: ((poids[t.niv] * t.w) / somme[t.niv]) * (aJoker("sourcier") && t.fx && t.fx.gem ? 2 : 1) }));
    const cartes = [];
    const ajouter = (t) => cartes.push({ id: t.id, theme: (t.doors || []).length ? opts.theme || pick(THEME_IDS) : null });
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

  // ---- Paquets de cartes : on découvre les cartes et on en garde une ----
  const PACKS = {
    passages: { nom: "Paquet de passages", prix: 5, n: 3, desc: "3 salles de passage, sans effet." },
    speciales: { nom: "Paquet de salles spéciales", prix: 9, n: 3, desc: "3 salles à effet." },
    theme: { nom: "Paquet thématique", prix: 7, n: 3, desc: "3 salles de la même couleur." },
    mystere: { nom: "Paquet mystère", prix: 14, n: 5, desc: "5 salles, dont une du plus haut niveau possible." },
  };
  // À appeler dans un flux de hasard (la boutique) : le contenu est fixé à l'ouverture de la boutique
  function construirePack(id) {
    const P = PACKS[id];
    let cartes = [];
    let theme = null;
    if (id === "passages") cartes = offrir(P.n, null, { niveaux: [0] });
    else if (id === "speciales") cartes = offrir(P.n, null, { kind: "bonus" });
    else if (id === "theme") {
      theme = pick(THEME_IDS);
      cartes = offrir(P.n, null, { theme });
    } else {
      const haut = Math.min(3, G.etage || 1);
      const garantie = offrir(1, null, { niveaux: [haut] });
      cartes = garantie.concat(offrir(P.n, null).filter((c) => !garantie.some((g) => g.id === c.id))).slice(0, P.n);
    }
    return { id, nom: P.nom, desc: P.desc, prix: P.prix, theme, cartes };
  }

  // ---- Débordement : au-delà du maximum, on choisit les cartes à jeter (gratuit, définitif) ----
  function verifierDebord(nouvelleUid, suite) {
    const exces = G.deck.length - plafondDeck();
    if (exces <= 0) return suite();
    G.debord = { nouvelle: nouvelleUid, exces, sel: [], suite };
    son("rature");
    modaleDebord();
  }
  function modaleDebord() {
    const D = G.debord;
    const cartes = G.deck
      .slice()
      .sort((a, b) => (b.uid === D.nouvelle) - (a.uid === D.nouvelle) || SALLES_PAR_ID[a.id].niv - SALLES_PAR_ID[b.id].niv || SALLES_PAR_ID[a.id].nom.localeCompare(SALLES_PAR_ID[b.id].nom))
      .map((card) => {
        const t = SALLES_PAR_ID[card.id];
        const sel = D.sel.includes(card.uid);
        return `<button class="carte-salle ${t.kind} debord-carte${sel ? " sel-jeter" : ""}${card.uid === D.nouvelle ? " nouvelle" : ""}" data-act="debord-sel" data-uid="${card.uid}" aria-pressed="${sel}">
          <span class="mini">${apercuCarte(card)}</span>
          <span class="cs-nom">${esc(t.nom)} ${niveauTag(t)}</span>
          ${card.uid === D.nouvelle ? `<span class="nouvelle-tag">Nouvelle</span>` : ""}
          <span class="cs-fx">${esc(effetTexte(t.fx))}</span>
          ${card.theme ? `<span class="cs-theme theme-tag" style="--t:${THEMES[card.theme].couleur}">${THEMES[card.theme].glyphe} ${THEMES[card.theme].nom}</span>` : ""}
          ${sel ? `<span class="jeter-marque">✕ À jeter</span>` : ""}
        </button>`;
      })
      .join("");
    const reste = D.exces - D.sel.length;
    afficherModale(`
      <p class="modal-sur">Votre deck déborde</p>
      <h2>${G.deck.length}/${plafondDeck()} cartes</h2>
      <p class="note-deck">Le maximum est de ${plafondDeck()}. Choisissez <b>${D.exces} carte${D.exces > 1 ? "s" : ""}</b> à jeter, définitivement et gratuitement. Vous pouvez jeter la carte que vous venez de recevoir.</p>
      <div class="tirage debord-liste">${cartes}</div>
      <div class="boutons"><button class="btn principal" data-act="debord-ok"${reste === 0 ? "" : " disabled"}>${reste === 0 ? "Jeter " + D.sel.length + " carte" + (D.sel.length > 1 ? "s" : "") : "Encore " + reste + " à choisir"}</button></div>`, "recompense-modal debord-modal sans-echap");
  }
  function basculerDebord(uid) {
    const D = G.debord;
    if (!D || !G.deck.some((c) => c.uid === uid)) return;
    if (D.sel.includes(uid)) D.sel = D.sel.filter((x) => x !== uid);
    else if (D.sel.length < D.exces) D.sel.push(uid);
    else D.sel = D.sel.slice(1).concat(uid); // au-delà du nombre voulu, le plus ancien choix est remplacé
    son("clic");
    modaleDebord();
  }
  function validerDebord() {
    const D = G.debord;
    if (!D || D.sel.length !== D.exces) return;
    D.sel.forEach((uid) => {
      const c = G.deck.find((x) => x.uid === uid);
      if (c) log("Vous jetez la carte « " + SALLES_PAR_ID[c.id].nom + " ».");
      retirerCarte(uid);
    });
    const suite = D.suite;
    G.debord = null;
    son("tampon");
    suite();
  }

  function acheterPack(i) {
    const B = G.boutique;
    const it = B && B.packs && B.packs[i];
    if (!it || G.coins < it.prix) return;
    G.coins -= it.prix;
    G.achats += 1;
    B.packs.splice(i, 1);
    G.pack = { item: it, revele: false };
    log("Paquet acheté : « " + it.nom + " » (−" + it.prix + " pièces).");
    son("punaise");
    modalePack();
    render();
  }
  function modalePack() {
    const K = G.pack;
    const it = K.item;
    if (!K.revele) {
      afficherModale(`
        <p class="modal-sur">${esc(it.nom)}${it.theme ? " · " + THEMES[it.theme].nom : ""}</p>
        <h2>Un paquet scellé</h2>
        <p class="note-deck">${it.cartes.length} cartes à découvrir. Vous en garderez une ; elle rejoindra votre deck (${G.deck.length}/${plafondDeck()}).</p>
        <div class="pack-dos">${it.cartes.map(() => `<span class="pack-carte dos">?</span>`).join("")}</div>
        <div class="boutons"><button class="btn principal" data-act="pack-reveler">Ouvrir le paquet</button></div>`, "boutique-modal sans-echap");
      return;
    }
    const cartes = it.cartes
      .map((card, i) => {
        const t = SALLES_PAR_ID[card.id];
        const sorties = (t.doors || []).length;
        return `<button class="carte-salle ${t.kind} pack-reveal niv${t.niv}" style="animation-delay:${i * 0.35}s" data-act="pack-choisir" data-i="${i}">
          <span class="mini">${apercuCarte(card)}</span>
          <span class="cs-nom">${esc(t.nom)} ${niveauTag(t)}</span>
          <span class="cs-desc">${esc(t.desc)}</span>
          <span class="cs-fx">${esc(effetTexte(t.fx))}</span>
          <span class="cs-portes">${sorties === 0 ? "Cul-de-sac" : sorties + " sortie" + (sorties > 1 ? "s" : "")}</span>
          ${card.theme ? `<span class="cs-theme theme-tag" style="--t:${THEMES[card.theme].couleur}">${THEMES[card.theme].glyphe} ${THEMES[card.theme].nom}</span>` : ""}
        </button>`;
      })
      .join("");
    afficherModale(`
      <p class="modal-sur">${esc(it.nom)}</p>
      <h2>Gardez une carte</h2>
      <p class="note-deck">La carte choisie rejoint la défausse. Les autres sont perdues.</p>
      <div class="tirage pack-liste">${cartes}</div>
      <div class="boutons"><button class="btn lien" data-act="pack-passer">Ne rien garder</button></div>`, "boutique-modal recompense-modal sans-echap");
  }
  function choisirDansPack(i) {
    const K = G.pack;
    const card = K && K.revele && K.item.cartes[i];
    if (!card) return;
    const nouvelle = ajouterCarte(card);
    log("Paquet : la carte « " + SALLES_PAR_ID[card.id].nom + " » rejoint votre deck.");
    G.pack = null;
    son("tampon");
    verifierDebord(nouvelle.uid, () => {
      modaleBoutique();
      render();
    });
  }

  // Une porte de niveau 2 ou 3 peut offrir une carte nouvelle ; la Boutique est proposée d'office la première fois.
  function calculerRecompense(P) {
    const r2 = P.r + DIRS[P.d].dr, c2 = P.c + DIRS[P.d].dc;
    if (G.grid[r2][c2]) return null; // porte de la Chambre : la fin de l'étage suffit
    return avecFlux("recompense:" + G.etage + ":" + P.r + "," + P.c + "," + P.d, () => {
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
    if (!card) return;
    const c = ajouterCarte(card);
    log("Récompense : la carte « " + SALLES_PAR_ID[card.id].nom + " » rejoint votre deck.");
    son("punaise");
    verifierDebord(c.uid, () => suiteApresPorte());
  }

  // n jokers que le joueur n'a pas encore, tirés selon leur rareté (flux courant)
  function offrirJokers(n) {
    if (!G.regles.jokers) return [];
    const pool = JOKERS.filter((j) => !aJoker(j.id) && !jokerVerrouille(j.id) && !(j.requiert === "gemmes" && !G.regles.gemmes)).map((j) => ({ j, w: RARETES[j.rar].w }));
    const ids = [];
    while (ids.length < n && pool.length) {
      let x = R() * pool.reduce((sum, e) => sum + e.w, 0), i = 0;
      for (; i < pool.length - 1; i++) {
        x -= pool[i].w;
        if (x <= 0) break;
      }
      ids.push(pool[i].j.id);
      pool.splice(i, 1);
    }
    return ids;
  }

  function raisonJoker(j, prix) {
    if (G.jokers.length >= G.slots) return "Pas d'emplacement";
    if (G.coins < prix) return "Trop cher";
    if (j.id === "pacte" && G.deck.length > plafondDeck() - 3) return "Deck trop grand";
    return "";
  }

  function acheterJoker(i) {
    const B = G.boutique;
    const it = B && B.jokers[i];
    if (!it) return;
    const j = JOKERS_PAR_ID[it.id];
    if (raisonJoker(j, it.prix)) return;
    G.coins -= it.prix;
    G.jokers.push(j.id);
    G.stat.jokersAchetes += 1;
    B.jokers.splice(i, 1);
    if (j.id === "sablier2") G.steps = Math.max(1, G.steps - 3); // le prix du Sablier fêlé
    log("Joker acheté : " + j.icone + " " + j.nom + " (−" + it.prix + " pièces).");
    son("tampon");
    modaleBoutique();
    render();
  }

  function raisonVente(j) {
    if (j.id === G.fetiche) return "Fétiche";
    if (j.id === "sacoche" && G.deck.length > plafondDeck() - 3) return "Deck trop grand";
    return "";
  }

  function vendreJoker(id) {
    const j = JOKERS_PAR_ID[id];
    if (!G.jokers.includes(id) || raisonVente(j)) return;
    const gain = Math.floor(prixJoker(j) / 2);
    G.jokers.splice(G.jokers.indexOf(id), 1);
    G.coins += gain;
    log("Joker vendu : " + j.icone + " " + j.nom + " (+" + gain + " pièces).");
    son("rature");
    modaleBoutique();
    render();
  }

  const prixEmplacement = () => PRIX_EMPLACEMENT[G.slots] || 0;

  function acheterEmplacement() {
    const prix = prixEmplacement();
    if (!prix || G.coins < prix || G.slots >= EMPLACEMENTS_MAX) return;
    G.coins -= prix;
    G.slots += 1;
    log("Un emplacement de joker en plus (−" + prix + " pièces) : " + G.slots + " en tout.");
    son("punaise");
    modaleBoutique();
    render();
  }

  function ouvrirBoutique(type) {
    G.boutique = avecFlux("boutique:" + G.etage + ":" + G.rooms, () => ({
      type,
      stock: offrir(type === "passage" ? 1 : 2).map((card) => ({ card, prix: prixCarte(SALLES_PAR_ID[card.id]) })),
      packs: shuffle(Object.keys(PACKS)).slice(0, type === "passage" ? 1 : 2).map((id) => construirePack(id)),
      jokers: offrirJokers(2).map((id) => ({ id, prix: prixJoker(JOKERS_PAR_ID[id]) })),
    }));
    log(type === "carte" ? "Vous entrez dans la Boutique." : type === "etage" ? "Un marchand des Gardiens vous attend au pied de l'escalier." : "Un marchand des Gardiens vous attendait dans cette salle.");
    modaleBoutique();
  }

  function acheter(i) {
    const B = G.boutique;
    const item = B && B.stock[i];
    if (!item || G.coins < item.prix) return;
    G.coins -= item.prix;
    G.achats += 1;
    const nouvelle = ajouterCarte(item.card);
    B.stock.splice(i, 1);
    log("Achat : « " + SALLES_PAR_ID[item.card.id].nom + " » (−" + item.prix + " pièces).");
    son("punaise");
    verifierDebord(nouvelle.uid, () => {
      modaleBoutique();
      render();
    });
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
    cands.forEach((cd) => {
      if (!cd.card.temp) G.defausse.push(cd.card); // une carte temporaire disparaît après usage
    });
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
    const grippee = G.envs.some((x) => x.id === "serrure_grippee");
    G.pending = { r, c, d, level: grippee ? Math.min(3, e.level + 1) : e.level, theme: e.theme, grippee };
    G.pending.finale = porteFinale(G.pending);
    G.pending.murdle = G.pending.finale && G.etage === ETAGES_TOTAL;
    G.pending.mastermind = G.pending.finale && G.etage === 2;
    modalePorte();
  }

  // Révèle l'effet d'une case spéciale (bulle et journal)
  function reveler(sp) {
    if (sp.revele) return;
    sp.revele = true;
    const E = ENVIRONNEMENTS[sp.id];
    log("✦ Case spéciale : " + E.icone + " " + E.nom + ". " + texteEnv(sp));
    toast("✦ " + E.icone + " " + E.nom + " : " + texteEnv(sp));
  }

  function arriveeSpeciale(sp) {
    sp.declenche = true;
    reveler(sp);
    switch (sp.id) {
      case "filon":
        G.coins += 3;
        break;
      case "cle_oubliee":
        G.seals += 1;
        break;
      case "eboulis":
        G.steps = Math.max(0, G.steps - 2);
        break;
      case "passe_libre":
      case "brouillard":
      case "serrure_grippee":
        G.envs.push({ id: sp.id, posee: false });
        break;
      default:
        break; // les interdictions ont déjà servi au moment du choix de la salle
    }
    son("case-" + ENVIRONNEMENTS[sp.id].cat);
  }

  function deplacer(d) {
    const r2 = G.pos.r + DIRS[d].dr, c2 = G.pos.c + DIRS[d].dc;
    const room = G.grid[r2][c2];
    let cout = 1;
    const depart = G.grid[G.pos.r][G.pos.c];
    const passeLibre = G.envs.find((e) => e.id === "passe_libre");
    if (passeLibre) {
      cout = 0; // Passe libre : la prochaine salle où l'on entre ne coûte aucun pas
      G.envs.splice(G.envs.indexOf(passeLibre), 1);
      toast(ENVIRONNEMENTS.passe_libre.icone + " Passe libre : ce pas ne coûte rien");
      log("👣 Passe libre : ce pas ne coûte rien.");
    } else if (aJoker("sentier") && depart.theme && depart.theme === room.theme && avecFlux("sentier:" + G.moves, () => R() < 0.5)) {
      cout = 0;
      declencher("sentier", "ce pas ne coûte rien");
    }
    G.steps -= cout;
    G.moves += 1;
    G.pos = { r: r2, c: c2 };
    son("page");
    // Les effets dont la « prochaine salle » vient d'être posée s'éteignent après ce pas
    G.envs = G.envs.filter((e) => !e.posee);
    if (!room.visited) {
      room.visited = true;
      appliquer(room);
      if (room.tpl.fx && room.tpl.fx.shop) G.visite = "carte";
      else if (room.marchand) G.visite = "passage";
    }
    // Arrivée sur une case spéciale : l'effet se révèle et s'applique (une seule fois)
    const sp = G.speciales[r2 + "," + c2];
    if (sp && !sp.declenche) arriveeSpeciale(sp);
    if (room.goal) return G.etage < ETAGES_TOTAL ? finEtage() : finir("win");
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
    const mult = aJoker("alambic") && room.tpl.kind === "bonus" ? 2 : 1;
    if (mult === 2 && (fx.steps > 0 || fx.dice || fx.seals)) declencher("alambic", "les effets de la salle sont doublés", true);
    if (fx.steps) {
      const st = fx.steps > 0 ? fx.steps * mult : fx.steps;
      G.steps = Math.max(0, G.steps + st);
      morceaux.push((st > 0 ? "+" : "−") + Math.abs(st) + " pas");
    }
    if (fx.dice) { G.dice += fx.dice * mult; morceaux.push("+" + fx.dice * mult + " dé" + (fx.dice * mult > 1 ? "s" : "")); }
    if (fx.seals) { G.seals += fx.seals * mult; morceaux.push("+" + fx.seals * mult + " sceau" + (fx.seals * mult > 1 ? "x" : "")); }
    if (fx.time) { G.timeBonus += fx.time; morceaux.push("+" + fx.time + " s par énigme"); }
    if (fx.coins) { G.coins += fx.coins; morceaux.push("+" + fx.coins + " pièces"); }
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
    const cands = tirage(d, tr, tc);
    G.draft = { d, tr, tc, sel: null, cands, levee: !!cands.levee };
    const sp = G.speciales[tr + "," + tc];
    if (sp && ENVIRONNEMENTS[sp.id].cat === "interdiction") reveler(sp); // révélée avant le choix de la salle
    render();
    defilerVersCible();
  }

  function choisir(i) {
    const D = G.draft;
    const cand = D.cands[i];
    if (cand.interdit) return interditIci(cand);
    son("pose-salle");
    G.envs.forEach((e) => (e.posee = true)); // la prochaine salle est posée : ces effets s'éteindront après le pas qui y entre
    G.grid[D.tr][D.tc] = { tpl: cand.tpl, doors: cand.doors, visited: false, theme: cand.theme, card: cand.card };
    defausserMain(D.cands); // les trois cartes tirées vont à la défausse
    G.rooms += 1;
    if (aJoker("craie") && cand.theme) {
      const memeCouleur = [0, 1, 2, 3].some((k) => {
        const v = inGrid(D.tr + DIRS[k].dr, D.tc + DIRS[k].dc) ? G.grid[D.tr + DIRS[k].dr][D.tc + DIRS[k].dc] : null;
        return v && v.theme === cand.theme;
      });
      if (memeCouleur) {
        G.coins += 1;
        declencher("craie", "+1 pièce, une salle de même couleur est voisine");
      }
    }
    if ((G.rooms - 1) % SALLES_MARCHAND === 0) G.grid[D.tr][D.tc].marchand = true;
    porteDe(G.grid[G.pos.r][G.pos.c], G.pos.r, G.pos.c, D.d).status = "open";
    log("Porte " + (D.d === 0 || D.d === 2 ? "du " : "de l'") + DIRS[D.d].nom + " : vous choisissez « " + cand.tpl.nom + " ».");
    son("punaise");
    const d = D.d;
    G.draft = null;
    fermerModale();
    deplacer(d);
  }

  function interditIci(cand) {
    const sp = G.speciales[G.draft.tr + "," + G.draft.tc];
    son("rature");
    toast("🚫 Interdit ici : " + (sp ? texteEnv(sp) : "cette salle ne peut pas être posée."));
  }

  function apercu(i) {
    const D = G.draft;
    if (!D || !D.cands[i]) return;
    if (D.cands[i].interdit) return interditIci(D.cands[i]);
    if (D.sel === i) return choisir(i);
    D.sel = i;
    son("clic");
    render();
  }

  // Sur petit écran, on amène la case visée au milieu de l'espace libre au-dessus du tirage
  function defilerVersCible() {
    if (!G || !G.draft || !window.matchMedia("(max-width: 860px)").matches) return;
    const el = document.querySelector('[data-cell="' + G.draft.tr + "," + G.draft.tc + '"]');
    const panneau = document.querySelector(".tirage-panel");
    if (!el || !panneau) return;
    const c = el.getBoundingClientRect(), p = panneau.getBoundingClientRect();
    const haut = 64; // barre d'état collée en haut
    const delta = (c.top + c.bottom) / 2 - (haut + p.top) / 2;
    if (Math.abs(delta) > 4) window.scrollBy({ top: delta, behavior: "smooth" });
  }

  function relancer() {
    if (G.dice < 1) return;
    G.dice -= 1;
    G.stat.deEtage += 1;
    const D = G.draft;
    defausserMain(D.cands);
    D.cands = tirage(D.d, D.tr, D.tc);
    D.levee = !!D.cands.levee;
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

  function finEtage() {
    log("Étage " + G.etage + " terminé : la Chambre est atteinte avec " + G.steps + " pas restants.");
    controler("etage");
    son("etage-fin");
    fermerModale();
    render();
    afficherModale(`
      <p class="modal-sur">Étage ${G.etage} sur ${ETAGES_TOTAL} · ${esc(G.plan.nom)}</p>
      <h2 class="ok">La Chambre s'ouvre.</h2>
      <p>Une porte de pierre coulisse derrière l'autel, sur un escalier qui descend. Avant de la franchir, un marchand des Gardiens vous attend.</p>
      <ul class="bilan">
        <li><b>${G.steps}</b> pas restants (ils seront renouvelés)</li>
        <li><b>${G.coins}</b> pièces, <b>${G.deck.length}</b> cartes, <b>${G.jokers.length}</b> joker${G.jokers.length > 1 ? "s" : ""}</li>
      </ul>
      <div class="boutons"><button class="btn principal" data-act="etage-suite">Voir le marchand</button></div>`, "reussi sans-echap");
  }

  function nouvelEtage() {
    chargerEtage(G.etage + 1);
    son("page-journal");
    render();
  }

  function finir(raison) {
    G.over = raison;
    fermerModale();
    const s = stats();
    if (raison === "win") {
      controler("win");
      s.wins = (s.wins || 0) + 1;
      if (G.steps > (s.best || 0)) s.best = G.steps;
      // Une victoire débloque le palier suivant
      if (!G.libre) {
        const P = paliers();
        P.gagnes[G.palier] = true;
        const suiv = palierSuivant(G.palier);
        if (suiv && suiv > P.max) {
          P.max = suiv;
          G.nouveauPalier = suiv;
          palierChoisi = suiv; // le menu propose désormais le palier tout juste débloqué
        }
        sauverPaliers(P);
      }
      son("victoire");
    } else {
      son("defaite");
    }
    saveStats(s);
    render();
    modaleFin();
  }

  // ------------------------------------------------------------------
  // Énigmes
  // ------------------------------------------------------------------
  function consommerGrippee() {
    const i = G.envs.findIndex((x) => x.id === "serrure_grippee");
    if (i >= 0) {
      G.envs.splice(i, 1);
      log("🔒 La serrure grippée cède.");
    }
  }

  function demarrerEnigme() {
    const P = G.pending;
    if (P.grippee) consommerGrippee();
    const porte = G.grid[P.r][P.c].door[P.d];
    const p = avecFlux("enigme:" + G.etage + ":" + P.r + "," + P.c + "," + P.d + ":" + (porte.essais || 0), () => (P.murdle ? makeMurdle(P.level) : P.mastermind ? makeMastermind(P.level) : P.finale ? makeWordle(P.level) : makePuzzle(P.level, P.theme)));
    porte.essais = (porte.essais || 0) + 1; // une porte retentée pose une autre énigme
    if (aJoker("loupe")) declencher("loupe", "+5 secondes", true);
    if (aJoker("sablier2")) declencher("sablier2", "+10 secondes", true);
    const total = P.murdle ? TEMPS_MURDLE + bonusTemps() : P.mastermind ? TEMPS_MASTERMIND + bonusTemps() : P.finale ? TEMPS_WORDLE + bonusTemps() : p.kind === "memoire" ? TEMPS_MEMOIRE[P.level] + bonusTemps() : tempsPorte(P.level);
    pz = { puzzle: p, restant: total, total, fini: false };
    modaleEnigme();
    arreterChrono();
    timer = setInterval(() => {
      if (!pz || pz.fini) return arreterChrono();
      pz.restant -= 0.1;
      majChrono();
      const sec = Math.ceil(pz.restant);
      if (sec <= 10 && sec > 0 && sec !== pz.dernierTic) {
        pz.dernierTic = sec;
        son("tic");
      }
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
      if (P.theme === "mots") G.stat.mots += 1;
      if (P.level === 3) G.stat.niv3 += 1;
      if (pz.total - pz.restant < 8) G.stat.rapides += 1;
      D.status = "open";
      const base = GAIN_PORTE[P.level] || 0;
      const rapide = base && pz.restant > pz.total / 2 ? 1 : 0;
      const extra = base ? (aJoker("piece") ? 1 : 0) + (aJoker("pacte") ? 1 : 0) : 0;
      if (base && aJoker("piece")) declencher("piece", "+1 pièce", true);
      if (base && aJoker("pacte")) declencher("pacte", "+1 pièce", true);
      pz.gain = base + rapide + extra;
      pz.rapide = rapide;
      pz.extra = extra;
      G.coins += pz.gain;
      P.recompense = calculerRecompense(P);
      log("Énigme résolue (" + p.label.toLowerCase() + ")" + (pz.gain ? " : +" + pz.gain + " pièce" + (pz.gain > 1 ? "s" : "") : "") + ".");
      son("enigme-ok");
      if (pz.gain) setTimeout(() => son("piece"), 300);
    } else {
      G.failed += 1;
      if (p.kind === "wordle" || p.kind === "murdle" || p.kind === "mastermind") {
        G.steps = Math.max(0, G.steps - PENALITE_WORDLE);
        pz.penalite = PENALITE_WORDLE;
        log((p.kind === "murdle" ? "Enquête ratée" : p.kind === "mastermind" ? "Code raté" : "Mot caché raté") + " (" + (p.reponseTexte || p.answer.toUpperCase()) + ") : −" + PENALITE_WORDLE + " pas. La porte reste verrouillée.");
      } else if (aJoker("souffle") && !G.souffle) {
        G.souffle = true;
        pz.sauvee = true; // la porte reste verrouillée : on pourra la retenter
        declencher("souffle", "la porte n'est pas condamnée");
      } else {
        D.status = "blocked";
        G.stat.condamnesEtage += 1;
        log("Énigme ratée (" + p.label.toLowerCase() + ") : la porte est condamnée pour cette partie.");
      }
      son("enigme-ko");
    }
    modaleResultat(ok, message);
    render();
  }

  function utiliserSceau() {
    if (G.seals < 1) return;
    G.seals -= 1;
    G.stat.deEtage += 1;
    const P = G.pending;
    if (P.grippee) consommerGrippee();
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
    if (fx.coins) parts.push("🪙");
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
    if (fx.coins) p.push("+" + fx.coins + " pièces");
    if (fx.fragment) p.push("un fragment du carnet de Valcourt");
    if (fx.shop) p.push("une boutique : achat de cartes, retrait d'une carte");
    if (fx.gem) p.push("une gemme " + (fx.gem.axe === "H" ? "↔ (décale une ligne" : "↕ (décale une colonne") + (fx.gem.max === 2 ? " de 1 ou 2 crans, rare)" : " d'un cran)"));
    return p.join(", ") + ".";
  }

  function plateauHTML() {
    const S = G.shift;
    const gemS = S ? G.gems[S.gi] : null;
    let h = `<div class="board${S ? " shifting" : ""}" role="grid" aria-label="Plan du labyrinthe" style="--cols:${COLS};--rows:${ROWS}">`;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (estMur(r, c)) {
          h += `<div class="cell mur" role="gridcell" data-cell="${r},${c}" aria-label="Mur"></div>`;
          continue;
        }
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
          if (room.fixe && !room.goal && room.tpl !== HALL) {
            cls += " fixe";
            contenu += `<span class="pin" title="Salle fixe : elle ne bouge jamais">📌</span>`;
          }
          if (cur) {
            cls += " current";
            const pn = pion();
            contenu += pionSVG(pn.forme, pn.couleur, "pion");
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
        const sp = G.speciales[r + "," + c];
        if (sp) {
          cls += " speciale";
          if (sp.revele) contenu += `<span class="badge-env" title="${esc(ENVIRONNEMENTS[sp.id].nom + " : " + texteEnv(sp))}">${ENVIRONNEMENTS[sp.id].icone}</span>`;
          else if (!room && !cible) contenu += `<span class="q-spe" title="Case spéciale : effet inconnu">?</span>`;
          else contenu += `<span class="badge-env" title="Case spéciale : effet inconnu">?</span>`;
        }
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
        const inutile = lignesUtiles(g.axe) === 0;
        return `<button class="chip gem-btn${actif ? " actif" : ""}${inutile ? " inutile" : ""}" data-act="gem" data-i="${i}" title="Gemme ${g.axe === "H" ? "horizontale : décale une ligne" : "verticale : décale une colonne"} de ${g.max === 2 ? "1 ou 2 crans" : "1 cran"}${inutile ? ". Aucune " + (g.axe === "H" ? "ligne" : "colonne") + " à décaler pour l'instant." : ""}">💎 <b>${fl}</b>${g.max === 2 ? "<sup>2</sup>" : ""}</button>`;
      })
      .join("");
  }

  // ------------------------------------------------------------------
  // Gemmes : décaler une ligne (H) ou une colonne (V)
  // ------------------------------------------------------------------
  // Les cases d'une ligne (H) ou d'une colonne (V) qui peuvent recevoir une salle mobile :
  // ni murées, ni occupées par une salle fixe (départ, Chambre, boutique fixe...).
  function casesMobiles(axe, i) {
    const n = axe === "H" ? COLS : ROWS;
    const out = [];
    for (let j = 0; j < n; j++) {
      const r = axe === "H" ? i : j, c = axe === "H" ? j : i;
      if (estMur(r, c)) continue;
      const salle = G.grid[r][c];
      if (salle && salle.fixe) continue;
      // La salle où l'on se trouve reste en place (case immobile), sauf avec le Poing des Gardiens
      if (r === G.pos.r && c === G.pos.c && !aJoker("poing")) continue;
      out.push({ r, c });
    }
    return out;
  }

  function ligneOk(axe, i) {
    const cases = casesMobiles(axe, i);
    return cases.length >= 2 && cases.some((x) => G.grid[x.r][x.c]);
  }

  function lignesUtiles(axe) {
    const n = axe === "H" ? ROWS : COLS;
    let nb = 0;
    for (let i = 0; i < n; i++) if (ligneOk(axe, i)) nb++;
    return nb;
  }

  function gemUtile() {
    return G.gems.some((g) => lignesUtiles(g.axe) > 0);
  }

  function decaler(k) {
    const S = G.shift;
    if (!S || S.sel === null) return;
    const gem = G.gems[S.gi];
    if (!gem || !crans(gem).includes(Math.abs(k)) || !ligneOk(gem.axe, S.sel)) return;
    const H = gem.axe === "H", i = S.sel;
    // Les cases fixes restent en place ; les salles mobiles tournent entre les cases mobiles, en les sautant.
    const cases = casesMobiles(gem.axe, i);
    const m = cases.length;
    const contenus = cases.map((x) => G.grid[x.r][x.c]);
    const vers = (idx) => (((idx + k) % m) + m) % m;
    cases.forEach((x, idx) => {
      const salle = contenus[idx];
      G.grid[cases[vers(idx)].r][cases[vers(idx)].c] = salle;
      // Les passages déjà ouverts sont recalculés d'après le nouveau voisinage
      if (salle && salle.door) for (const d in salle.door) if (salle.door[d].status === "open") delete salle.door[d];
    });
    // Poing des Gardiens : le joueur est entraîné avec sa salle (s'il n'est pas sur une case fixe)
    const iJoueur = cases.findIndex((x) => x.r === G.pos.r && x.c === G.pos.c);
    if (iJoueur >= 0) G.pos = { r: cases[vers(iJoueur)].r, c: cases[vers(iJoueur)].c };
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
    G.stat.gemmes += 1;
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
    if (S.sel === null) {
      h += lignesUtiles(g.axe) > 0
        ? `touchez une ${mot} du plan.</span>`
        : `aucune ${mot} ne peut être décalée pour l'instant.<br>Il faut au moins une salle mobile dans la ${mot}, et une case libre pour la faire glisser. Posez d'abord d'autres salles.</span>`;
    }
    else {
      h += `${mot} ${S.sel + 1}, décaler :</span>`;
      const a = H ? "◀" : "▲", b = H ? "▶" : "▼";
      for (const k of crans(g)) {
        h += `<button class="btn mini-btn" data-act="shift-do" data-k="${-k}">${a.repeat(k)} ${k}</button><button class="btn mini-btn" data-act="shift-do" data-k="${k}">${k} ${b.repeat(k)}</button>`;
      }
    }
    return h + `<button class="btn lien mini-btn" data-act="shift-cancel">Annuler</button></div>`;
  }

  function envsHTML() {
    if (!G.regles.cases || !Object.keys(G.speciales).length) return "";
    const inconnues = Object.keys(G.speciales).filter((k) => !G.speciales[k].declenche && !G.speciales[k].revele).length;
    const lignes = G.envs.map((e) => `<li class="env-${ENVIRONNEMENTS[e.id].cat}">${ENVIRONNEMENTS[e.id].icone} <b>${esc(ENVIRONNEMENTS[e.id].nom)}</b> : ${esc(texteEnv(e))}</li>`);
    return `<section class="carte">
      <h3>Environnement <span class="compte">${inconnues} ?</span></h3>
      ${lignes.length ? `<ul class="env-liste">${lignes.join("")}</ul><p class="note">Jusqu'à la prochaine salle posée.</p>` : `<p class="vide">Aucun effet en cours.${inconnues ? " " + inconnues + " case" + (inconnues > 1 ? "s" : "") + " « ? » à découvrir." : ""}</p>`}
    </section>`;
  }

  function panneauHTML() {
    const room = G.grid[G.pos.r][G.pos.c];
    const pct = Math.max(0, Math.min(100, (G.steps / G.stepsMax) * 100));
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
        <span class="chip" title="Temps bonus sur chaque énigme">⏳ <b>+${bonusTemps()}</b> <em>s</em></span>
      </div>
      ${G.regles.gemmes ? `<div class="hud-items">${gemmesHTML()}</div>` : ""}
      <div class="hud-items">${deckChip()}<button class="chip" data-act="copier" title="Copier la graine pour rejouer ou partager cette partie">🌱 <b>${esc(G.seed)}</b></button></div>
    </div>
    ${G.draft ? tirageHTML() : ""}
    ${jokersHTML()}
    ${envsHTML()}
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
    if (G && !G.over) controler("tick");
    const app = document.getElementById("app");
    document.body.classList.toggle("menu-mode", !G);
    document.body.classList.toggle("tirage-ouvert", !!(G && G.draft));
    if (!G) return (app.innerHTML = menuHTML());
    app.innerHTML = `
      <header class="entete">
        <div class="titre-mini"><span class="marque">Bureau des affaires occultes</span><h1>SEUIL</h1><span class="palier-tag">${G.libre ? "Mode libre · " + G.libre.k + " règle" + (G.libre.k > 1 ? "s" : "") : "Palier " + G.palier + " · " + esc(palierDe(G.palier).nom)}</span></div>
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
          <div class="plateau-cadre" style="--cols:${COLS};--rows:${ROWS}">
            <div class="etiquette haut">Étage ${G.etage}/${ETAGES_TOTAL} · ${esc(G.plan.nom)}</div>
            ${plateauHTML()}
            <div class="etiquette bas">nord ↑</div>
          </div>
          <p class="aide">Touchez une salle voisine, ou utilisez les flèches / ZQSD.</p>
        </div>
        <aside class="col-panneau">${panneauHTML()}</aside>
      </main>`;
  }

  function jokersHTML() {
    if (!G.regles.jokers) return "";
    const cases = [];
    for (let i = 0; i < G.slots; i++) {
      const id = G.jokers[i];
      if (!id) {
        cases.push(`<span class="joker vide">emplacement libre</span>`);
        continue;
      }
      const j = JOKERS_PAR_ID[id];
      cases.push(`<button class="joker${id === G.fetiche ? " fetiche" : ""}${j.maudit ? " maudit" : ""}${G.flash === id ? " decl" : ""}${brouillard() ? " coupe" : ""}" style="--r:${RARETES[j.rar].couleur}" data-act="joker" data-id="${id}"${brouillard() ? ' title="Coupé par le Brouillard"' : ""}>
        <span class="j-ico">${j.icone}</span><span class="j-nom">${esc(j.nom)}${id === G.fetiche ? " 📌" : ""}</span><span class="j-desc">${esc(j.desc)}</span></button>`);
    }
    return `<section class="carte jokers"><h3>Jokers <span class="compte">${G.jokers.length}/${G.slots}</span></h3><div class="joker-liste">${cases.join("")}</div></section>`;
  }

  function modaleJoker(id) {
    const j = JOKERS_PAR_ID[id];
    afficherModale(`
      <p class="modal-sur">Joker · ${esc(j.famille)}</p>
      <h2>${j.icone} ${esc(j.nom)}</h2>
      <p><span class="theme-tag" style="--t:${RARETES[j.rar].couleur}">${RARETES[j.rar].nom}</span>${j.maudit ? ` <span class="theme-tag" style="--t:#9A2B25">Malédiction : ${esc(j.prix)}</span>` : ""}</p>
      <p>${esc(j.desc)}</p>
      <p class="note-deck">${id === G.fetiche ? "📌 Votre joker fétiche : il vous suit de partie en partie et ne peut pas être vendu." : "Vendre : dans une boutique, pour " + Math.floor(prixJoker(j) / 2) + " pièces."}</p>
      <div class="boutons"><button class="btn principal" data-act="close">Fermer</button></div>`, "joker-modal");
  }

  function deckChip() {
    const enMain = G.draft ? G.draft.cands.filter((c) => !c.card.temp).length : 0;
    return `<span class="chip" title="Pièces">🪙 <b>${G.coins}</b></span><button class="chip deck-btn" data-act="deck" title="Voir le deck">🃏 <b>${G.deck.length}/${plafondDeck()}</b> <em>pioche ${G.pioche.length} · défausse ${G.defausse.length}${enMain ? " · main " + enMain : ""}</em></button>`;
  }

  function hudMobile() {
    const bas = G.steps <= 10;
    return `<span class="hm-steps${bas ? " bas" : ""}"><b>${G.steps}</b> pas</span>
      <span class="chip">🎲 <b>${G.dice}</b></span><span class="chip">🗝 <b>${G.seals}</b></span><span class="chip">⏳ <b>+${bonusTemps()}</b></span>
      <span class="chip">📜 <b>${G.fragments}/${FRAGMENTS.length}</b></span>${deckChip()}${G.gems.length ? gemmesHTML() : ""}${G.jokers.map((id) => `<button class="chip joker-chip" data-act="joker" data-id="${id}" title="${esc(JOKERS_PAR_ID[id].nom)}">${JOKERS_PAR_ID[id].icone}</button>`).join("")}`;
  }

  function menuHTML() {
    const s0 = stats();
    const P = paliers();
    const sel = palierEffectif();
    const rec = s0.wins ? `Meilleur résultat : sortie avec ${s0.best} pas restants · ${s0.wins} victoire${s0.wins > 1 ? "s" : ""} sur ${s0.runs || s0.wins} expédition${(s0.runs || 0) > 1 ? "s" : ""}.` : s0.runs ? `${s0.runs} expédition${s0.runs > 1 ? "s" : ""}, aucune sortie pour l'instant.` : "";
    const lignes = PALIERS.map((p) => {
      const debloque = p.pret && p.n <= P.max;
      const etat = !p.pret ? "Bientôt" : !debloque ? "🔒" : P.gagnes[p.n] ? "✓" : "";
      const raison = !p.pret ? "Cette règle arrive bientôt." : !debloque ? "Gagnez le palier " + (p.n - 1 > 0 && !PALIERS[p.n - 2].pret ? p.n - 2 : p.n - 1) + " pour le débloquer." : p.resume;
      return `<li><button class="palier${p.n === sel ? " sel" : ""}${debloque ? "" : " verrou"}" data-act="palier" data-n="${p.n}"${debloque ? "" : " disabled"} aria-pressed="${p.n === sel}">
        <span class="p-num">${p.n}</span><span class="p-nom">${esc(p.nom)}</span><span class="p-etat">${etat}</span>
        <span class="p-resume">${esc(raison)}</span></button></li>`;
    }).join("");
    const complet = P.max >= dernierPalierPret();
    return `<div class="menu">
      <div class="menu-fond"><img src="img/menu-fond.jpg" alt="" onerror="this.remove()"></div>
      <div class="menu-inner">
        <p class="menu-marque">Bureau des affaires occultes</p>
        <img class="menu-sal" src="img/salamandre.png" alt="" onerror="this.remove()">
        <h1 class="menu-titre">SEUIL</h1>
        <p class="menu-tag">Le labyrinthe des Gardiens. Chaque porte est une question. Chaque réponse ouvre un chemin, et le chemin se paie en pas.</p>
        <section class="paliers" aria-label="Choix du palier">
          <h2 class="paliers-titre">Palier</h2>
          <ul>${lignes}</ul>
        </section>
        <section class="pion-choix" aria-label="Choix du pion">
          <h2 class="paliers-titre">Votre pion</h2>
          <div class="pion-ligne">
            <span class="pion-apercu">${pionSVG(pion().forme, pion().couleur, "pion-grand")}</span>
            <div class="pion-reglages">
              <div class="pion-formes" role="group" aria-label="Forme">${Object.keys(FORMES_PION).map((f) => `<button class="pion-btn${f === pion().forme ? " sel" : ""}" data-act="pion-forme" data-f="${f}" title="${FORMES_PION[f].nom}" aria-pressed="${f === pion().forme}">${pionSVG(f, pion().couleur, "pion-mini")}</button>`).join("")}</div>
              <div class="pion-couleurs" role="group" aria-label="Couleur">${COULEURS_PION.map((c) => `<button class="pion-couleur${c.id === pion().couleur ? " sel" : ""}" style="--c:${c.c}" data-act="pion-couleur" data-c="${c.id}" title="${c.nom}" aria-label="${c.nom}" aria-pressed="${c.id === pion().couleur}"></button>`).join("")}</div>
            </div>
          </div>
        </section>
        <label class="menu-graine">
          <span>Graine (facultative)</span>
          <input id="graine" type="text" maxlength="24" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="au hasard">
        </label>
        <div class="menu-liste">
          <button class="menu-item" data-act="new"><span class="menu-label">Nouvelle expédition · palier ${sel}</span><span class="menu-sub">${esc(palierDe(sel).nom)} : trois étages, un deck de 8 salles, un serrurier à retrouver</span></button>
          <button class="menu-item" data-act="daily"${complet ? "" : " disabled"}><span class="menu-label">Défi du jour</span><span class="menu-sub">${complet ? "Le jeu complet, la même partie pour tout le monde aujourd'hui" : "Disponible quand tous les paliers sont débloqués"}</span></button>
          <div class="menu-item libre-bloc${complet ? "" : " off"}">
            <button class="libre-lancer" data-act="libre"${complet ? "" : " disabled"}><span class="menu-label">Mode libre</span><span class="menu-sub">${complet ? "La graine tire l'ordre des règles ; choisissez combien sont actives (0 à 4)" : "Disponible quand tous les paliers sont débloqués"}</span></button>
            ${complet ? `<div class="libre-k" role="group" aria-label="Nombre de règles actives">${[0, 1, 2, 3, 4].map((k) => `<button class="chip${k === libreK ? " sel" : ""}" data-act="libre-k" data-k="${k}" aria-pressed="${k === libreK}">${k}</button>`).join("")}<span class="libre-legende">règle${libreK > 1 ? "s" : ""} active${libreK > 1 ? "s" : ""}</span></div>` : ""}
          </div>
          <button class="menu-item" data-act="exploits"><span class="menu-label">Exploits · ${EXPLOITS.filter((e) => exploitFait(e.id)).length}/${EXPLOITS.length}</span><span class="menu-sub">Ce qu'il reste à accomplir pour débloquer salles et jokers</span></button>
          <button class="menu-item" data-act="rules"><span class="menu-label">Comment jouer</span><span class="menu-sub">Les règles du palier ${sel}</span></button>
        </div>
        <p class="menu-foot">${esc(rec)}</p>
        ${fetiche() ? `<p class="menu-foot">📌 Joker fétiche : <b>${JOKERS_PAR_ID[fetiche()].icone} ${esc(JOKERS_PAR_ID[fetiche()].nom)}</b> <button class="lien-petit" data-act="fetiche-abandon">l'abandonner</button></p>` : ""}
        <p class="menu-foot menu-liens"><button class="lien-petit" data-act="tout-debloquer">Je connais déjà le jeu : tout débloquer</button>${P.max > 1 || Object.keys(P.vus).length ? ` · <button class="lien-petit" data-act="reinit-paliers">Recommencer la progression</button>` : ""}</p>
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
    const temps = P.theme === "memoire" ? TEMPS_MEMOIRE[P.level] + bonusTemps() : tempsPorte(P.level);
    const pips = "●".repeat(P.level) + "○".repeat(3 - P.level);
    const T = THEMES[P.theme];
    afficherModale(`
      <p class="modal-sur">Porte du ${d.nom} ${d.fleche}</p>
      <h2>${P.murdle ? "La dernière serrure : l'enquête" : P.mastermind ? "La dernière serrure : le code" : P.finale ? "La dernière serrure" : "Une serrure sans clé"}</h2>
      <p class="niveau"><span class="theme-tag" style="--t:${T.couleur}">${T.glyphe} ${T.nom}</span> Difficulté <span class="pips">${pips}</span></p>
      ${P.grippee ? `<p class="tirage-env">🔒 Serrure grippée : cette porte est plus dure qu'elle ne devrait.</p>` : ""}
      ${P.mastermind ? `<p>Dernière porte de l'étage : un <b>code à 4 symboles</b> à retrouver parmi 6 (un symbole peut se répéter), ${ESSAIS_MASTERMIND} essais, ${TEMPS_MASTERMIND + bonusTemps()} secondes. Après chaque essai : ● = bon symbole bien placé, ○ = bon symbole mal placé. Un échec coûte ${PENALITE_WORDLE} pas, la porte reste fermée et vous pourrez retenter avec un autre code.</p>` : P.murdle ? `<p>Dernière porte du dernier étage : une <b>enquête</b>. Des indices vous disent qui se trouvait où et qui tenait quoi ; il faut désigner le coupable et son arme. ${TEMPS_MURDLE + bonusTemps()} secondes. Un échec coûte ${PENALITE_WORDLE} pas, la porte reste fermée et vous pourrez retenter avec une autre enquête.</p>` : P.finale ? `<p>Dernière porte de l'étage : un <b>mot caché de 5 lettres</b>, ${ESSAIS_WORDLE} essais, ${TEMPS_WORDLE + bonusTemps()} secondes. Vert : bien placée. Jaune : dans le mot, ailleurs. Gris : absente. Un échec coûte ${PENALITE_WORDLE} pas, la porte reste fermée et vous pourrez retenter avec un autre mot.</p>` : `<p>Une seule tentative, ${temps} secondes. Si vous échouez, la porte est condamnée pour toute la partie.${aJoker("souffle") && !G.souffle ? " 💨 Second souffle : ce premier échec ne condamnera pas la porte." : ""}</p>`}
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

  function caseCode(i) {
    const s = SYMBOLES_CODE[i];
    return `<span class="mm-case" style="--c:${s.c}">${s.g}</span>`;
  }
  function modaleMastermind() {
    const p = pz.puzzle;
    const lignes = [];
    for (let i = 0; i < ESSAIS_MASTERMIND; i++) {
      const g = p.guesses[i];
      let cases = "", fb = "";
      for (let j = 0; j < 4; j++) {
        if (g) cases += caseCode(g.essai[j]);
        else if (i === p.guesses.length && p.saisie[j] !== undefined) cases += caseCode(p.saisie[j]);
        else cases += `<span class="mm-case vide"></span>`;
      }
      if (g) fb = "●".repeat(g.n) + "○".repeat(g.b) || "·";
      lignes.push(`<div class="mm-ligne"><span class="mm-cases">${cases}</span><span class="mm-fb" aria-label="${g ? g.n + " bien placés, " + g.b + " mal placés" : ""}">${fb}</span></div>`);
    }
    const pal = SYMBOLES_CODE.map((s, i) => `<button class="mm-btn" style="--c:${s.c}" data-act="mm" data-k="${i}" aria-label="${s.nom}">${s.g}</button>`).join("");
    afficherModale(`
      <p class="modal-sur"><span class="theme-tag" style="--t:${THEMES.symboles.couleur}">${THEMES.symboles.glyphe} ${THEMES.symboles.nom}</span> ${esc(p.label)} · essai ${Math.min(p.guesses.length + 1, ESSAIS_MASTERMIND)}/${ESSAIS_MASTERMIND}</p>
      <div class="chrono"><span id="chrono-barre"></span><span id="chrono-texte" class="chrono-texte"></span></div>
      <div class="mm-grille">${lignes.join("")}</div>
      <p class="mu-aide">● bon symbole bien placé · ○ bon symbole mal placé</p>
      <div class="mm-pal">${pal}<button class="mm-btn mm-act" data-act="mm-del" aria-label="Effacer">⌫</button><button class="mm-btn mm-act mm-ok" data-act="mm-ok" aria-label="Valider">⏎</button></div>`, "enigme mastermind sans-echap");
    majChrono();
  }
  const mmActif = () => (pz && !pz.fini && pz.puzzle.kind === "mastermind" ? pz.puzzle : null);
  function mmAjouter(k) {
    const p = mmActif();
    if (!p || p.saisie.length >= 4) return;
    p.saisie.push(k);
    modaleMastermind();
  }
  function mmEffacer() {
    const p = mmActif();
    if (!p || !p.saisie.length) return;
    p.saisie.pop();
    modaleMastermind();
  }
  function mmValider() {
    const p = mmActif();
    if (!p) return;
    if (p.saisie.length < 4) return toast("Il faut 4 symboles");
    const essai = p.saisie.slice();
    const r = noterCode(essai, p.code);
    p.guesses.push({ essai, n: r.n, b: r.b });
    p.saisie = [];
    if (r.n === 4) return resoudre(true, "Le code cède.");
    if (p.guesses.length >= ESSAIS_MASTERMIND) return resoudre(false, "Plus d'essais.");
    modaleMastermind();
  }

  function modaleMurdle() {
    const p = pz.puzzle;
    afficherModale(`
      <p class="modal-sur"><span class="theme-tag" style="--t:${THEMES.logique.couleur}">${THEMES.logique.glyphe} ${THEMES.logique.nom}</span> ${esc(p.label)}</p>
      <div class="chrono"><span id="chrono-barre"></span><span id="chrono-texte" class="chrono-texte"></span></div>
      <p class="consigne">Le crime a eu lieu dans <b>${esc(p.lieuCrime)}</b>. Trois suspects, trois armes, trois lieux : chacun était dans un lieu différent et tenait une arme différente.</p>
      <p class="mu-liste-titre">Suspects : ${p.suspects.map(esc).join(" · ")}<br>Armes : ${p.armes.map(esc).join(" · ")}<br>Lieux : ${p.lieux.map(esc).join(" · ")}</p>
      <ul class="mu-indices">${p.indices.map((t) => `<li data-act="mu-note">${esc(t)}</li>`).join("")}</ul>
      <p class="mu-aide">Touchez un indice pour le barrer une fois utilisé.</p>
      <div class="mu-choix">
        <label>Coupable <select id="mu-s">${p.suspects.map((x, i) => `<option value="${i}">${esc(x)}</option>`).join("")}</select></label>
        <label>Arme <select id="mu-w">${p.armes.map((x, i) => `<option value="${i}">${esc(x)}</option>`).join("")}</select></label>
      </div>
      <div class="boutons"><button class="btn principal" data-act="mu-ok">Accuser</button></div>`, "enigme murdle sans-echap");
    majChrono();
  }
  function accuser() {
    if (!pz || pz.fini || pz.puzzle.kind !== "murdle") return;
    const p = pz.puzzle;
    const s = parseInt(document.getElementById("mu-s").value, 10);
    const w = parseInt(document.getElementById("mu-w").value, 10);
    resoudre(s === p.sol.s && w === p.sol.w, s === p.sol.s && w === p.sol.w ? "L'enquête aboutit." : "Mauvaise accusation.");
  }

  function modaleMemoire() {
    const p = pz.puzzle;
    const cases = p.cartes
      .map((sym, i) => {
        const e = p.etats[i];
        const visible = e !== "cache";
        return `<button class="mem-carte ${e}" data-act="mem" data-i="${i}" ${p.phase === "jeu" && e === "cache" && !p.verrou ? "" : "tabindex=\"-1\""} aria-label="${visible ? sym : "Carte cachée"}">${visible ? sym : "?"}</button>`;
      })
      .join("");
    afficherModale(`
      <p class="modal-sur"><span class="theme-tag" style="--t:${THEMES.memoire.couleur}">${THEMES.memoire.glyphe} ${THEMES.memoire.nom}</span> ${esc(p.label)} · difficulté ${"●".repeat(p.level)}${"○".repeat(3 - p.level)}</p>
      <div class="chrono"><span id="chrono-barre"></span><span id="chrono-texte" class="chrono-texte"></span></div>
      <p class="consigne">${p.phase === "apercu" ? "Mémorisez les cartes : elles vont se cacher." : "Retrouvez toutes les paires."}</p>
      <div class="mem-grille" style="--cols:${p.cols}">${cases}</div>
      <p class="mu-aide">Paires : ${p.trouvees}/${p.paires} · Erreurs : ${p.erreurs}/${p.erreursMax} (au-delà, la porte est condamnée)</p>`, "enigme memoire sans-echap");
    majChrono();
  }
  function lancerApercuMemoire() {
    const p = pz.puzzle;
    const pzActuel = pz;
    pzActuel.tmo = setTimeout(() => {
      if (pz !== pzActuel || pz.fini) return;
      p.phase = "jeu";
      p.etats = p.etats.map(() => "cache");
      modaleMemoire();
    }, APERCU_MEMOIRE[p.level] * 1000);
  }
  function memoireTap(i) {
    const p = pz && !pz.fini && pz.puzzle.kind === "memoire" ? pz.puzzle : null;
    if (!p || p.phase !== "jeu" || p.verrou || p.etats[i] !== "cache") return;
    p.etats[i] = "visible";
    p.ouvertes.push(i);
    son("clic");
    if (p.ouvertes.length < 2) return modaleMemoire();
    const [a, b] = p.ouvertes;
    if (p.cartes[a] === p.cartes[b]) {
      p.etats[a] = p.etats[b] = "trouve";
      p.ouvertes = [];
      p.trouvees += 1;
      if (p.trouvees === p.paires) return resoudre(true, "Toutes les paires sont retrouvées.");
      return modaleMemoire();
    }
    p.erreurs += 1;
    p.verrou = true;
    modaleMemoire();
    const pzActuel = pz;
    pzActuel.tmo = setTimeout(() => {
      if (pz !== pzActuel || pz.fini) return;
      if (p.erreurs > p.erreursMax) return resoudre(false, "Trop d'erreurs.");
      p.etats[a] = p.etats[b] = "cache";
      p.ouvertes = [];
      p.verrou = false;
      modaleMemoire();
    }, 700);
  }

  function modaleWordle() {
    const p = pz.puzzle;
    const lignes = [];
    for (let i = 0; i < ESSAIS_WORDLE; i++) {
      const g = p.guesses[i];
      let cases = "";
      for (let j = 0; j < 5; j++) {
        let ch = "", cl = "";
        if (g) {
          ch = g.mot[j];
          cl = g.etats[j];
        } else if (i === p.guesses.length) {
          ch = p.saisie[j] || "";
          cl = ch ? "s" : "";
        }
        cases += `<span class="wc ${cl}">${ch}</span>`;
      }
      lignes.push(`<div class="wl">${cases}</div>`);
    }
    const meilleur = {};
    const rang = { x: 1, j: 2, v: 3 };
    p.guesses.forEach((g) => [...g.mot].forEach((ch, j) => { if (!meilleur[ch] || rang[g.etats[j]] > rang[meilleur[ch]]) meilleur[ch] = g.etats[j]; }));
    const clavier = ["azertyuiop", "qsdfghjklm", "wxcvbn"]
      .map((r, i) => `<div class="wk-row">${i === 2 ? `<button class="wk wk-big" data-act="wk-ok" aria-label="Valider">⏎</button>` : ""}${[...r].map((ch) => `<button class="wk ${meilleur[ch] || ""}" data-act="wk" data-k="${ch}">${ch}</button>`).join("")}${i === 2 ? `<button class="wk wk-big" data-act="wk-del" aria-label="Effacer">⌫</button>` : ""}</div>`)
      .join("");
    afficherModale(`
      <p class="modal-sur"><span class="theme-tag" style="--t:${THEMES.mots.couleur}">${THEMES.mots.glyphe} ${THEMES.mots.nom}</span> ${esc(p.label)} · essai ${Math.min(p.guesses.length + 1, ESSAIS_WORDLE)}/${ESSAIS_WORDLE}</p>
      <div class="chrono"><span id="chrono-barre"></span><span id="chrono-texte" class="chrono-texte"></span></div>
      <div class="wordle" aria-label="Grille du mot caché">${lignes.join("")}</div>
      <div class="wkb">${clavier}</div>`, "enigme wordle sans-echap");
    majChrono();
  }

  function saisirLettre(l) {
    const p = pz && !pz.fini && pz.puzzle.kind === "wordle" ? pz.puzzle : null;
    if (!p || p.saisie.length >= 5) return;
    p.saisie += l;
    modaleWordle();
  }
  function effacerLettre() {
    const p = pz && !pz.fini && pz.puzzle.kind === "wordle" ? pz.puzzle : null;
    if (!p || !p.saisie.length) return;
    p.saisie = p.saisie.slice(0, -1);
    modaleWordle();
  }
  function validerMot() {
    const p = pz && !pz.fini && pz.puzzle.kind === "wordle" ? pz.puzzle : null;
    if (!p) return;
    if (p.saisie.length < 5) return toast("Il faut 5 lettres");
    const mot = p.saisie;
    p.guesses.push({ mot, etats: noterMot(mot, p.answer) });
    p.saisie = "";
    if (mot === p.answer) return resoudre(true, "Le mot cède.");
    if (p.guesses.length >= ESSAIS_WORDLE) return resoudre(false, "Plus d'essais.");
    modaleWordle();
  }

  function modaleEnigme() {
    if (pz.puzzle.kind === "memoire") {
      modaleMemoire();
      lancerApercuMemoire();
      return;
    }
    if (pz.puzzle.kind === "wordle") return modaleWordle();
    if (pz.puzzle.kind === "murdle") return modaleMurdle();
    if (pz.puzzle.kind === "mastermind") return modaleMastermind();
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
    const detail = [pz.rapide ? "1 pour la rapidité" : "", pz.extra ? pz.extra + " grâce à vos jokers" : ""].filter(Boolean).join(", ");
    const gain = ok && pz.gain ? `<p class="gain">+${pz.gain} pièce${pz.gain > 1 ? "s" : ""}${detail ? " (dont " + detail + ")" : ""}</p>` : "";
    const suite = cible ? "Franchir la porte" : G.pending.recompense ? "Voir la récompense" : "Choisir une salle";
    afficherModale(`
      <p class="modal-sur">${ok ? "Réussi" : "Raté"}</p>
      <h2 class="${ok ? "ok" : "ko"}">${esc(message)}</h2>
      ${gain}
      ${ok ? "" : p.kind === "wordle" || p.kind === "murdle" || p.kind === "mastermind" ? `<p>${p.kind === "murdle" ? "La solution était" : p.kind === "mastermind" ? "Le code était" : "Le mot était"} : <b>${esc(p.reponseTexte || bonne.toUpperCase())}</b>.</p><p>−${pz.penalite} pas. La porte reste verrouillée : vous pourrez retenter, avec ${p.kind === "murdle" ? "une autre enquête" : p.kind === "mastermind" ? "un autre code" : "un autre mot"}.</p>` : `${p.kind === "memoire" ? "<p>Vous n'avez pas retrouvé toutes les paires.</p>" : `<p>La bonne réponse était : <b>${esc(bonne)}</b>.</p>`}<p>${pz.sauvee ? "💨 <b>Second souffle</b> : la porte n'est pas condamnée. Vous pourrez la retenter, avec une autre énigme." : "La porte est condamnée pour cette partie."}</p>`}
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
        return `<button class="carte-salle ${cd.tpl.kind}${sel ? " sel" : ""}${cd.interdit ? " interdit" : ""}" data-act="apercu" data-i="${i}" aria-pressed="${sel}">
          ${cd.interdit ? `<span class="cs-fx">🚫 Interdit ici</span>` : ""}
          <span class="mini">${salleSVG(cd.tpl, cotes, { entree: opp(D.d), theme: cd.theme })}</span>
          <span class="cs-nom">${esc(cd.tpl.nom)} ${niveauTag(cd.tpl)}${cd.card.temp ? ` <span class="temp-tag">🗝 temporaire</span>` : ""}</span>
          <span class="cs-desc">${esc(cd.tpl.desc)}</span>
          <span class="cs-fx">${esc(effetTexte(cd.tpl.fx))}</span>
          <span class="cs-portes">${cd.sorties === 0 ? "Cul-de-sac" : cd.sorties + " sortie" + (cd.sorties > 1 ? "s" : "")}</span>
          ${cd.theme ? `<span class="cs-theme theme-tag" style="--t:${THEMES[cd.theme].couleur}">${THEMES[cd.theme].glyphe} ${THEMES[cd.theme].nom}</span>` : ""}
        </button>`;
      })
      .join("");
    const spD = G.speciales[D.tr + "," + D.tc];
    const bandeau = spD && ENVIRONNEMENTS[spD.id].cat === "interdiction"
      ? `<p class="tirage-env">${ENVIRONNEMENTS[spD.id].icone} ${esc(texteEnv(spD))}${D.levee ? " Aucune des trois salles ne convient : l'interdiction est levée." : ""}</p>`
      : "";
    return `<section class="tirage-panel" aria-label="Choix de la salle">
      <h3>Porte du ${DIRS[D.d].nom} ${DIRS[D.d].fleche} : quelle salle ?</h3>
      ${bandeau}
      <p class="tirage-aide">${D.sel === null ? "Touchez une salle pour la voir sur le plan, à l'emplacement marqué ?" : "Aperçu sur le plan. Touchez « Choisir » (ou la salle) pour la poser."}</p>
      <div class="tirage n${D.cands.length}">${cartes}</div>
      <div class="boutons">
        <button class="btn principal" data-act="pick"${D.sel === null ? " disabled" : ""}>Choisir cette salle</button>
        <button class="btn" data-act="reroll"${G.dice < 1 ? " disabled" : ""}>🎲 Relancer (${G.dice})</button>
      </div>
      <p class="note">Le triangle rouge marque l'entrée ; les autres ouvertures sont les sorties. La couleur d'une salle est le thème des énigmes de ses portes de sortie.</p>
    </section>`;
  }

  // Bloc d'explication d'une règle (utilisé au déblocage et au premier lancement du palier)
  function nouvelleRegleHTML(n) {
    const p = palierDe(n);
    return `<div class="nouvelle-regle">
      <p class="nr-etiquette">✦ Nouvelle règle débloquée · palier ${n}</p>
      <h3>${esc(p.nom)}</h3>
      ${p.texte.map((t) => `<p>${t}</p>`).join("")}
    </div>`;
  }

  function modalePalierIntro(n) {
    const p = palierDe(n);
    afficherModale(`
      <p class="modal-sur">Palier ${n}</p>
      <h2>${esc(p.nom)}</h2>
      ${n === 1 ? "" : `<p class="nr-etiquette">✦ Nouveau dans ce palier</p>`}
      ${p.texte.map((t) => `<p>${t}</p>`).join("")}
      <div class="boutons"><button class="btn principal" data-act="close">${n === 1 ? "Descendre" : "Compris, en avant"}</button></div>`, "regle-modal");
  }

  function fetichesFinHTML() {
    if (G.over !== "win" || !G.regles.jokers || !G.jokers.length) return "";
    const actuel = G.fetichePris || fetiche();
    const boutons = G.jokers
      .map((id) => {
        const j = JOKERS_PAR_ID[id];
        return `<button class="btn fetiche-btn${id === actuel ? " sel" : ""}" data-act="fetiche" data-id="${id}" aria-pressed="${id === actuel}">${j.icone} ${esc(j.nom)}${id === actuel ? " 📌" : ""}</button>`;
      })
      .join("");
    return `<div class="fetiche-fin"><h3>📌 Joker fétiche</h3>
      <p>Choisissez un joker à emporter : il occupera un emplacement au début de chaque prochaine partie (dès le palier des jokers) et ne pourra pas être vendu.${actuel && !G.jokers.includes(actuel) ? " Votre fétiche actuel est " + esc(JOKERS_PAR_ID[actuel].nom) + " ; en choisir un autre le remplace." : ""}</p>
      <div class="fetiche-choix">${boutons}</div></div>`;
  }

  function exploitsFinHTML() {
    if (!G.nouveauxExploits.length) return "";
    return `<div class="exploits-fin"><h3>🏆 Exploits accomplis</h3><ul>${G.nouveauxExploits
      .map((id) => {
        const e = EXPLOITS.find((x) => x.id === id);
        return `<li><b>${esc(e.nom)}</b> : ${esc(e.desc)}<br><em>Débloque ${nomRecompense(e.cle)}.</em></li>`;
      })
      .join("")}</ul></div>`;
  }

  function modaleExploits() {
    const n = EXPLOITS.filter((e) => exploitFait(e.id)).length;
    afficherModale(`
      <p class="modal-sur">Carnet des exploits · ${n}/${EXPLOITS.length}</p>
      <h2>Exploits</h2>
      <p>Chaque exploit débloque, pour toutes vos parties, une salle ou un joker qui rejoint les récompenses et les boutiques. Ils se valident même dans une partie perdue.</p>
      <ul class="exploits">${EXPLOITS.map((e) => {
        const fait = exploitFait(e.id);
        return `<li class="${fait ? "fait" : ""}"><span class="ex-etat">${fait ? "✓" : "○"}</span><span class="ex-txt"><b>${esc(e.nom)}</b><br>${esc(e.desc)}<br><em>${fait ? "Débloqué : " : "Débloque : "}${nomRecompense(e.cle)}</em></span></li>`;
      }).join("")}</ul>
      <div class="boutons"><button class="btn principal" data-act="close">Fermer</button></div>`, "regle-modal");
  }

  // « 2 règles sur 4 : Gemmes, Jokers (ordre tiré : Gemmes, Jokers, Murs et salles fixes, Cases spéciales) »
  function libreResume(L) {
    const actives = L.ordre.slice(0, L.k).map((id) => NOMS_REGLES[id]);
    return (L.k ? L.k + " règle" + (L.k > 1 ? "s" : "") + " sur 4 : " + actives.join(", ") : "jeu de base, aucune règle en plus") + ". Ordre tiré par la graine : " + L.ordre.map((id) => NOMS_REGLES[id]).join(", ") + ".";
  }

  function modaleLibreIntro() {
    const L = G.libre;
    afficherModale(`
      <p class="modal-sur">Mode libre · graine ${esc(G.seed)}</p>
      <h2>${L.k ? L.k + " règle" + (L.k > 1 ? "s" : "") + " en plus du jeu de base" : "Le jeu de base"}</h2>
      <p>La graine a tiré l'ordre des règles : <b>${L.ordre.map((id, i) => (i < L.k ? "<u>" + NOMS_REGLES[id] + "</u>" : NOMS_REGLES[id])).join(" · ")}</b>. Les règles actives sont soulignées.</p>
      <ul class="regles-libre">${L.ordre.slice(0, L.k).map((id) => `<li><b>${NOMS_REGLES[id]}</b> : ${esc(palierDe(PALIER_DE_REGLE[id]).resume)}</li>`).join("")}</ul>
      <p class="note-deck">Les explications complètes sont dans « Comment jouer ». Même graine et même nombre de règles : même partie.</p>
      <div class="boutons"><button class="btn principal" data-act="close">En avant</button></div>`, "regle-modal");
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
      <p class="modal-sur">${win ? "Fin de l'expédition" : "Expédition terminée"} · ${G.libre ? "mode libre" : "palier " + G.palier}</p>
      <h2 class="${win ? "ok" : "ko"}">${titre}</h2>
      <p>${texte}</p>
      <ul class="bilan">
        <li>Graine <b>${esc(G.seed)}</b></li>
        <li>Étage <b>${G.etage}</b> sur ${ETAGES_TOTAL}${G.plan ? " · " + esc(G.plan.nom) : ""}</li>
        <li><b>${G.steps}</b> pas restants</li>
        <li><b>${G.rooms}</b> salles ouvertes</li>
        <li><b>${G.solved}</b> énigmes résolues, <b>${G.failed}</b> ratées</li>
        <li><b>${G.coins}</b> pièces, <b>${G.deck.length}</b> cartes dans le deck</li>
        <li><b>${G.fragments}/${FRAGMENTS.length}</b> fragments du carnet</li>
      </ul>
      ${exploitsFinHTML()}
      ${fetichesFinHTML()}
      ${G.libre ? `<p class="note-deck">Mode libre : ${libreResume(G.libre)}</p>` : ""}
      ${G.nouveauPalier ? nouvelleRegleHTML(G.nouveauPalier) : ""}
      <div class="boutons">
        ${G.nouveauPalier ? `<button class="btn principal" data-act="palier-suivant">Jouer le palier ${G.nouveauPalier}</button>` : ""}
        <button class="btn${G.nouveauPalier ? "" : " principal"}" data-act="new">${G.nouveauPalier ? "Rejouer ce palier" : "Nouvelle graine"}</button>
        <button class="btn" data-act="replay">Même graine</button>
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
        return `<button class="carte-salle ${t.kind}" data-act="recomp" data-i="${i}">
          <span class="mini">${apercuCarte(card)}</span>
          <span class="cs-nom">${esc(t.nom)} ${niveauTag(t)}</span>
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
      <p class="note-deck">Choisissez-en une : elle rejoint la défausse et reviendra dans vos tirages. Deck : ${G.deck.length}/${plafondDeck()}.${plein ? " <b>Deck plein</b> : vous devrez jeter une carte pour garder celle-ci." : ""}</p>
      <div class="tirage">${cartes}</div>
      <div class="boutons"><button class="btn lien" data-act="recomp-passer">Passer</button></div>`, "recompense-modal sans-echap");
  }

  function jokerLigne(j, action) {
    return `<li class="offre offre-joker ${j.maudit ? "maudit" : ""}">
      <span class="j-ico">${j.icone}</span>
      <span class="offre-txt"><span class="cs-nom">${esc(j.nom)}</span> <span class="theme-tag" style="--t:${RARETES[j.rar].couleur}">${RARETES[j.rar].nom}</span>${j.maudit ? ` <span class="theme-tag" style="--t:#9A2B25">Malédiction</span>` : ""}<br>
        <span class="cs-desc">${esc(j.desc)}</span><br><span class="cs-portes">${esc(j.famille)}</span></span>
      ${action}
    </li>`;
  }

  function jokersBoutiqueHTML() {
    if (!G.regles.jokers) return "";
    const B = G.boutique;
    const vente = B.jokers.length
      ? B.jokers
          .map((it, i) => {
            const j = JOKERS_PAR_ID[it.id];
            const raison = raisonJoker(j, it.prix);
            return jokerLigne(j, `<button class="btn achat" data-act="acheter-joker" data-i="${i}"${raison ? " disabled" : ""}>${raison || "Acheter"}<br><b>${it.prix} 🪙</b></button>`);
          })
          .join("")
      : `<li class="vide">Plus de jokers en vente.</li>`;
    const miens = G.jokers
      .map((id) => {
        const j = JOKERS_PAR_ID[id];
        const raison = raisonVente(j);
        return jokerLigne(j, `<button class="btn achat" data-act="vendre-joker" data-id="${id}"${raison ? " disabled" : ""}>${raison || "Vendre"}<br><b>+${Math.floor(prixJoker(j) / 2)} 🪙</b></button>`);
      })
      .join("");
    const pe = prixEmplacement();
    const slot = pe
      ? `<li class="offre-slot"><span>Un emplacement de joker de plus (${G.slots} → ${G.slots + 1})</span><button class="btn mini-btn" data-act="acheter-slot"${G.coins < pe ? " disabled" : ""}>${G.coins < pe ? "Trop cher" : "Acheter"} · ${pe} 🪙</button></li>`
      : "";
    return `<h3 class="sous-titre">Jokers en vente <span class="compte">${G.jokers.length}/${G.slots} emplacements</span></h3>
      <ul class="boutique-liste">${vente}${slot}</ul>
      ${G.jokers.length ? `<h3 class="sous-titre">Vos jokers (revente à moitié prix)</h3><ul class="boutique-liste">${miens}</ul>` : ""}`;
  }

  function modaleBoutique() {
    const B = G.boutique;
    const plein = deckPlein();
    const stock = B.stock.length
      ? B.stock
          .map((it, i) => {
            const t = SALLES_PAR_ID[it.card.id];
            const sorties = (t.doors || []).length;
            const raison = G.coins < it.prix ? "Trop cher" : "";
            return `<li class="offre">
              <span class="mini">${apercuCarte(it.card)}</span>
              <span class="offre-txt"><span class="cs-nom">${esc(t.nom)}</span> ${niveauTag(t)} ${themeTag(it.card)}<br>
                <span class="cs-desc">${esc(t.desc)}</span><br>
                <span class="cs-fx">${esc(effetTexte(t.fx))}</span> <span class="cs-portes">${sorties === 0 ? "cul-de-sac" : sorties + " sortie" + (sorties > 1 ? "s" : "")}</span></span>
              <button class="btn achat" data-act="acheter" data-i="${i}"${raison ? " disabled" : ""}>${raison || "Acheter"}<br><b>${it.prix} 🪙</b></button>
            </li>`;
          })
          .join("")
      : `<li class="vide">Tout est vendu.</li>`;
    const paquets = (B.packs || [])
      .map((it, i) => {
        const raison = G.coins < it.prix ? "Trop cher" : "";
        return `<li class="offre offre-pack">
          <span class="mini pack-ico">🎴</span>
          <span class="offre-txt"><span class="cs-nom">${esc(it.nom)}</span>${it.theme ? ` <span class="theme-tag" style="--t:${THEMES[it.theme].couleur}">${THEMES[it.theme].glyphe} ${THEMES[it.theme].nom}</span>` : ""}<br><span class="cs-desc">${esc(it.desc)} Vous en gardez une.</span></span>
          <button class="btn achat" data-act="acheter-pack" data-i="${i}"${raison ? " disabled" : ""}>${raison || "Ouvrir"}<br><b>${it.prix} 🪙</b></button>
        </li>`;
      })
      .join("");
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
      <p class="modal-sur">${B.type === "carte" ? "Boutique" : B.type === "etage" ? "Entre deux étages" : "Marchand de passage"}</p>
      <h2>Vos pièces : ${G.coins} 🪙</h2>
      <p class="note-deck">Deck : ${G.deck.length}/${plafondDeck()}${plein ? " (plein : toute nouvelle carte vous obligera à en jeter une)" : ""}. Une carte achetée rejoint la défausse.</p>
      <ul class="boutique-liste">${paquets}${stock}</ul>
      ${jokersBoutiqueHTML()}
      <details class="retrait">
        <summary>Retirer une carte du deck (${prix} 🪙, puis +2 à chaque retrait)</summary>
        <ul class="retrait-liste">${retrait}</ul>
      </details>
      <div class="boutons"><button class="btn principal" data-act="quitter">${B.type === "etage" ? "Étage suivant" : "Quitter la boutique"}</button></div>`, "boutique-modal sans-echap");
  }

  // Peut-on ouvrir une fenêtre d'information sans écraser une décision en cours ?
  function modaleLibre() {
    const m = document.getElementById("modal");
    return m.hidden || !m.classList.contains("sans-echap");
  }

  // Lance une partie au palier n ; au premier lancement d'un palier, on explique sa règle.
  function demarrer(graine, palier, libre) {
    fermerModale();
    nouvellePartie(graine, palier, libre);
    son("page-journal");
    render();
    if (typeof libre === "number") {
      log("Mode libre : " + libreResume(G.libre));
      render();
      modaleLibreIntro();
      return;
    }
    const P = paliers();
    if (!P.vus[palier]) {
      P.vus[palier] = true;
      sauverPaliers(P);
      modalePalierIntro(palier);
    }
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
      <h2>${G.deck.length} cartes sur ${plafondDeck()}</h2>
      <p class="note-deck">Pioche ${G.pioche.length} · défausse ${G.defausse.length}${enMain.size ? " · main " + enMain.size : ""}. À chaque porte, vous tirez 3 cartes de la pioche, en jouez une, et les trois vont à la défausse. Quand la pioche a moins de 3 cartes, on y remélange la défausse.</p>
      <ul class="deck-liste">${lignes}</ul>
      <div class="boutons"><button class="btn principal" data-act="close">Fermer</button></div>`, "deck-modal");
  }

  function modaleRegles() {
    const R2 = G ? G.regles : reglesDe(palierEffectif());
    const li = [];
    li.push("<b>Objectif :</b> traverser <b>trois étages</b>. À chaque étage, atteindre la <b>Chambre des Gardiens</b> en partant du vestibule. Chaque étage a son plan (tiré par la graine), son nombre de pas, et ses portes de plus en plus dures. Vous gardez votre deck, vos pièces" + (R2.jokers ? " et vos jokers" : "") + " d'un étage à l'autre ; un marchand vous attend entre deux étages. Un dé et un sceau vous sont rendus à chaque étage.");
    if (R2.murs) li.push("<b>Murs et salles fixes.</b> Une case en pierre est un mur : rien ne peut y être posé. Une salle marquée d'une punaise 📌 (boutique, puits...) est posée d'avance et ne bouge jamais" + (R2.gemmes ? ", même quand une gemme décale sa ligne : les autres salles glissent en la sautant." : "."));
    li.push("<b>Chaque pas coûte 1.</b> Traverser une porte, même pour revenir en arrière, consomme un pas. À zéro, l'expédition s'arrête.");
    li.push("<b>Les portes sont scellées.</b> Une porte verrouillée pose une énigme chronométrée : calcul, suite logique, orthographe. Trois niveaux de difficulté, de plus en plus durs en montant.");
    li.push("<b>La dernière porte.</b> La porte qui mène à la Chambre est gardée par un <b>mot caché</b> de 5 lettres, façon Wordle : 6 essais, vert si la lettre est bien placée, jaune si elle est ailleurs dans le mot, gris si elle n'y est pas. Un échec coûte 6 pas mais ne condamne pas la porte : vous pouvez retenter avec un autre mot. Au 2ᵉ étage, c'est un <b>code</b> de 4 symboles parmi 6 à retrouver en 8 essais (● bien placé, ○ mal placé). Au dernier étage, c'est une <b>enquête</b> : des indices disent qui se trouvait où et qui tenait quoi, et il faut désigner le coupable et son arme.");
    li.push("<b>Une seule chance.</b> Rater ou laisser filer le temps condamne la porte pour toute la partie. Si vous résolvez l'énigme, vous choisissez <b>une salle parmi trois</b>.");
    li.push("<b>Vos salles sont des cartes.</b> Vous partez avec un deck de 8 cartes. À chaque porte, vous tirez 3 cartes de la pioche et vous en posez une derrière la porte, avec ses propres portes. Les trois cartes vont ensuite à la défausse ; quand la pioche est presque vide, on y remélange la défausse. Touchez « Deck » pour voir vos cartes.");
    li.push("<b>Cinq thèmes, cinq couleurs.</b> Chiffres (bleu), Mots (rouge), Logique (vert), Symboles (or), Mémoire (violet : un jeu de paires à retrouver, avec un temps pour mémoriser les cartes). La couleur d'une carte est fixe : c'est le thème des énigmes des portes de sortie de la salle. En choisissant une salle, vous choisissez ce que vous affronterez ensuite.");
    li.push("<b>Niveaux des salles et paquets.</b> Chaque salle a un niveau : ○ base, ◐ courant, ● avancé, ★ rare. Au 1er étage, on trouve surtout des salles de base ; les niveaux plus forts n'apparaissent qu'en descendant. En boutique, des paquets de cartes se découvrent carte par carte : on en garde une et les autres sont perdues.");
    li.push("<b>Dés et sceaux.</b> Un dé défausse les 3 cartes tirées et en tire 3 nouvelles. Un sceau ouvre une porte sans énigme.");
    li.push("<b>Pièces, récompenses, boutique.</b> Une énigme résolue rapporte des pièces (2, 3 ou 5 selon la porte, plus 1 si vous êtes rapide). Les portes difficiles offrent parfois une carte nouvelle. Une carte Boutique, ou un marchand qui vous attend toutes les 10 salles posées, vend des cartes et permet d'en retirer contre des pièces. Le deck est limité à 15 cartes.");
    if (R2.jokers) li.push("<b>Jokers.</b> Trois emplacements au départ (jusqu'à 5). Un joker est une règle passive : temps en plus, pièces en plus, tirage élargi" + (R2.gemmes ? ", gemmes plus puissantes" : "") + "... On les achète en boutique et on peut les revendre à moitié prix. Les jokers « malédiction » sont très forts, mais ont un prix. Une bulle et un éclat signalent quand l'un d'eux agit.");
    if (R2.jokers) li.push("<b>Joker fétiche.</b> Quand vous gagnez une partie, vous pouvez choisir l'un de vos jokers à emporter : il occupera un emplacement au début de chaque partie suivante et ne pourra pas être vendu. Un seul fétiche à la fois ; en choisir un autre à la victoire suivante le remplace.");
    li.push("<b>Exploits.</b> Au début, la moitié des salles et des jokers sont verrouillés. Chaque exploit (finir un étage sans condamner de porte, gagner avec un petit deck...) en débloque un pour toujours. Le carnet des exploits est dans le menu ; ils se valident même dans une partie perdue.");
    li.push("<b>La graine.</b> Chaque partie a une graine (six lettres). Avec la même graine, vous retrouvez la même partie : mêmes portes, mêmes énigmes, même pioche. Copiez-la pour rejouer ou partager. Le « Défi du jour » donne la même graine à tout le monde.");
    if (R2.gemmes) li.push("<b>Gemmes ↔ et ↕.</b> Une gemme décale toute une ligne (↔) ou toute une colonne (↕) du plan d'un cran, en bouclant : la salle qui sort d'un côté réapparaît de l'autre. Les gemmes rares vont jusqu'à deux crans. Le vestibule, la Chambre, les salles fixes, les murs et la salle où vous vous trouvez ne bougent pas : les autres salles de la ligne glissent en les sautant. Il faut au moins une salle mobile dans la ligne ; sinon la gemme est grisée. Après un décalage, les portes se recalculent : deux portes face à face forment un passage, une porte contre un mur devient un mur.");
    if (R2.cases) li.push("<b>Cases spéciales « ? ».</b> Certaines cases du plan cachent un environnement : bonus (pas gratuit, pièces, sceau), interdiction de pose (une couleur, les culs-de-sac) ou malus (jokers coupés, porte plus dure, pas perdus). L'effet se révèle quand vous y arrivez (les interdictions, quand vous ouvrez la porte vers la case) et dure jusqu'à la prochaine salle posée. Les gemmes ne déplacent pas ces cases.");
    li.push("<b>Impasse :</b> si plus aucune porte n'est accessible, l'expédition est perdue.");
    const n = G ? G.palier : palierEffectif();
    afficherModale(`
      <p class="modal-sur">Comment jouer · ${G && G.libre ? "mode libre" : "palier " + n}</p>
      <h2>Règles de l'expédition</h2>
      <ol class="regles">${li.map((x) => `<li>${x}</li>`).join("")}</ol>
      <p class="note-deck">${G && G.libre ? libreResume(G.libre) : "D'autres règles se débloquent au fil des paliers, en gagnant des expéditions."}</p>
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
      case "replay":
      case "palier-suivant": {
        const champ = document.getElementById("graine");
        let graine = champ ? champ.value : "";
        let palier = G ? G.palier : palierEffectif();
        if (G && G.libre && act !== "daily" && act !== "palier-suivant") {
          if (act === "replay") graine = G.seed;
          demarrer(graine, 0, G.libre.k);
          break;
        }
        if (act === "daily") {
          if (paliers().max < dernierPalierPret()) break;
          graine = graineDuJour();
          palier = dernierPalierPret();
        } else if (act === "replay" && G) graine = G.seed;
        else if (act === "palier-suivant" && G) {
          palier = G.nouveauPalier;
          graine = "";
          palierChoisi = palier;
        }
        demarrer(graine, palier);
        break;
      }
      case "palier":
        palierChoisi = parseInt(el.getAttribute("data-n"), 10);
        son("clic");
        render();
        break;
      case "tout-debloquer":
        afficherModale(`
          <p class="modal-sur">Progression</p>
          <h2>Tout débloquer ?</h2>
          <p>Tous les paliers et tous les exploits (donc toutes les salles et tous les jokers) seront débloqués d'un coup, y compris le défi du jour. Vous perdrez les explications qui accompagnent chaque nouvelle règle. Elles restent lisibles dans « Comment jouer ».</p>
          <div class="boutons"><button class="btn principal" data-act="tout-debloquer-oui">Oui, tout débloquer</button><button class="btn lien" data-act="close">Annuler</button></div>`, "regle-modal");
        break;
      case "exploits":
        modaleExploits();
        break;
      case "pion-forme":
        sauverPion({ forme: el.getAttribute("data-f"), couleur: pion().couleur });
        son("clic");
        render();
        break;
      case "pion-couleur":
        sauverPion({ forme: pion().forme, couleur: el.getAttribute("data-c") });
        son("clic");
        render();
        break;
      case "libre-k":
        libreK = parseInt(el.getAttribute("data-k"), 10);
        son("clic");
        render();
        break;
      case "libre": {
        if (paliers().max < dernierPalierPret()) break;
        const champ = document.getElementById("graine");
        demarrer(champ ? champ.value : "", 0, libreK);
        break;
      }
      case "fetiche": {
        if (!G || G.over !== "win") break;
        const id = el.getAttribute("data-id");
        if (!G.jokers.includes(id)) break;
        sauverFetiche(id);
        G.fetichePris = id;
        log("📌 Joker fétiche : " + JOKERS_PAR_ID[id].nom + ".");
        son("tampon");
        modaleFin();
        break;
      }
      case "fetiche-abandon":
        sauverFetiche(null);
        render();
        break;
      case "tout-debloquer-oui": {
        const X = exploits();
        EXPLOITS.forEach((e) => (X.faits[e.id] = true));
        sauverExploits(X);
        const P = paliers();
        P.max = dernierPalierPret();
        PALIERS.forEach((p) => (P.vus[p.n] = true));
        sauverPaliers(P);
        palierChoisi = P.max;
        fermerModale();
        render();
        break;
      }
      case "reinit-paliers":
        afficherModale(`
          <p class="modal-sur">Progression</p>
          <h2>Recommencer la progression ?</h2>
          <p>Les paliers débloqués, les exploits accomplis, le joker fétiche et les explications déjà lues seront effacés : vous repartirez du palier 1. Vos records restent.</p>
          <div class="boutons"><button class="btn principal" data-act="reinit-paliers-oui">Oui, recommencer</button><button class="btn lien" data-act="close">Annuler</button></div>`, "regle-modal");
        break;
      case "reinit-paliers-oui":
        sauverFetiche(null);
        sauverExploits({ faits: {} });
        sauverPaliers({ max: 1, gagnes: {}, vus: {} });
        palierChoisi = 0;
        fermerModale();
        render();
        break;
      case "deck":
        if (G && modaleLibre()) modaleDeck();
        break;
      case "joker":
        if (G && modaleLibre()) modaleJoker(el.getAttribute("data-id"));
        break;
      case "acheter-joker":
        acheterJoker(parseInt(el.getAttribute("data-i"), 10));
        break;
      case "vendre-joker":
        vendreJoker(el.getAttribute("data-id"));
        break;
      case "acheter-slot":
        acheterEmplacement();
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
      case "debord-sel":
        basculerDebord(parseInt(el.getAttribute("data-uid"), 10));
        break;
      case "debord-ok":
        validerDebord();
        break;
      case "acheter-pack":
        acheterPack(parseInt(el.getAttribute("data-i"), 10));
        break;
      case "pack-reveler":
        if (G && G.pack) {
          G.pack.revele = true;
          son("paquet-dechire");
          modalePack();
          G.pack.item.cartes.forEach((c, i) => {
            const rare = SALLES_PAR_ID[c.id].niv >= 2;
            setTimeout(() => G && G.pack && son(rare ? "carte-rare" : "carte-retournee"), 350 + i * 350);
          });
        }
        break;
      case "pack-choisir":
        choisirDansPack(parseInt(el.getAttribute("data-i"), 10));
        break;
      case "pack-passer":
        if (G && G.pack) {
          G.pack = null;
          modaleBoutique();
        }
        break;
      case "retirer":
        retirerAchat(parseInt(el.getAttribute("data-uid"), 10));
        break;
      case "etage-suite":
        fermerModale();
        ouvrirBoutique("etage");
        break;
      case "quitter": {
        const fin = G.boutique && G.boutique.type === "etage";
        G.boutique = null;
        fermerModale();
        if (fin) nouvelEtage();
        else render();
        break;
      }
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
      case "mem":
        memoireTap(parseInt(el.getAttribute("data-i"), 10));
        break;
      case "mm":
        mmAjouter(parseInt(el.getAttribute("data-k"), 10));
        break;
      case "mm-del":
        mmEffacer();
        break;
      case "mm-ok":
        mmValider();
        break;
      case "mu-note":
        el.classList.toggle("barre");
        break;
      case "mu-ok":
        accuser();
        break;
      case "wk":
        saisirLettre(el.getAttribute("data-k"));
        break;
      case "wk-del":
        effacerLettre();
        break;
      case "wk-ok":
        validerMot();
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
      } else if (pz && !pz.fini && pz.puzzle.kind === "mastermind") {
        if (/^[1-6]$/.test(ev.key)) mmAjouter(parseInt(ev.key, 10) - 1);
        else if (ev.key === "Backspace") mmEffacer();
        else if (ev.key === "Enter") {
          ev.preventDefault();
          mmValider();
        }
      } else if (pz && !pz.fini && pz.puzzle.kind === "wordle") {
        if (/^[a-zA-Z]$/.test(ev.key) && !ev.ctrlKey && !ev.metaKey) saisirLettre(ev.key.toLowerCase());
        else if (ev.key === "Backspace") effacerLettre();
        else if (ev.key === "Enter") {
          ev.preventDefault();
          validerMot();
        }
      } else if (pz && !pz.fini && pz.puzzle.kind === "mcq" && /^[1-4]$/.test(ev.key) && parseInt(ev.key, 10) <= pz.puzzle.options.length) repondre(pz.puzzle.options[parseInt(ev.key, 10) - 1]);
      else if (G && G.draft && /^[1-4]$/.test(ev.key)) apercu(parseInt(ev.key, 10) - 1);
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
  window.SEUIL = { get partie() { return G; }, get enigme() { return pz && pz.puzzle; }, render: () => render(), t: { PALIERS, reglesDe, paliers, palierSuivant, dernierPalierPret, edge, PLANS, parserPlan, chargerEtage, finEtage, nouvelEtage, casesMobiles, pion, sauverPion, FORMES_PION, COULEURS_PION, verifierDebord, ajouterCarte, son, SONS, sonsManquants, PACKS, construirePack, acheterPack, niveauTag, SALLES, POIDS_NIVEAU, makeMastermind, noterCode, makeMurdle, noterMot, MOTS5, ordreDesRegles, reglesLibres, nouvellePartie, fetiche, sauverFetiche, EXPLOITS, exploits, exploitFait, controler, salleVerrouillee, jokerVerrouille, ENVIRONNEMENTS, ouvrirTirage, apercu, choisir, tenter, tirerEffets, texteEnv, ouvrirBoutique, modaleBoutique, tirage, offrir, offrirJokers, avecFlux, defausserMain, deplacer, plafondDeck, decaler, ligneOk, crans, declencher, JOKERS }, gen: (l, t) => avecFlux("test:" + l + t, () => makePuzzle(l, t)) };
})();
