# SEUIL

Le labyrinthe des Gardiens : un jeu de navigateur où l'on pose des salles comme des cartes, où chaque porte est scellée par une énigme chronométrée, et où chaque pas est compté. Un jeu Maison Paradoxe, dans l'univers du Bureau des affaires occultes.

## Jouer

- **En ligne** : https://maisonparadoxe.github.io/Seuil/ (publié automatiquement par GitHub Pages à chaque mise à jour de la branche `main`). Sur téléphone, ouvrez cette adresse et ajoutez-la à l'écran d'accueil.
- **Hors ligne** : ouvrez `index.html` dans un navigateur (double-clic). Aucun serveur, aucune installation, aucune dépendance.

Les progrès (paliers, exploits, joker fétiche, pion, réglages du son) sont enregistrés dans le navigateur, sur l'appareil utilisé.

## Le jeu en bref

- Une partie compte **trois étages**. À chaque étage, on part du vestibule d'un plan et on cherche la Chambre des Gardiens avant d'avoir épuisé ses pas.
- Derrière chaque porte, on pose **une salle parmi trois**, tirée de son **deck** (8 cartes au départ, 15 au plus). La couleur de la carte choisit le thème de l'énigme suivante.
- Les portes sont scellées par une **énigme chronométrée** : Chiffres, Mots, Logique, Symboles ou Mémoire. La dernière porte de chaque étage pose une épreuve spéciale : mot caché (Wordle), code (Mastermind), enquête (Murdle).
- Les **pièces** servent en boutique : cartes, **paquets** à ouvrir carte par carte, jokers. Au-delà de 15 cartes, on choisit lesquelles jeter.
- Des règles s'ajoutent **par paliers** : murs et salles fixes, jokers, cases spéciales, gemmes (qui décalent une ligne ou une colonne du plan). Les salles **portail** relient deux endroits du plan.
- **Exploits** (15) qui débloquent cartes et jokers, **joker fétiche** gardé d'une partie à l'autre, **mode libre** avec l'ordre des règles tiré par la graine, **défi du jour** identique pour tout le monde.
- Chaque partie a une **graine** : avec la même graine, la même partie.

La conception complète, les décisions et l'état d'avancement sont dans `CONCEPTION.md`.

## Fichiers

- `index.html`, `seuil.css`, `seuil.js` : le jeu, sans dépendance.
- `img/` : images (un fichier absent est ignoré).
- `audio/` : musique et effets sonores (un fichier absent est ignoré ; la liste et les consignes sont dans `audio/LISEZMOI.md`).

## Réglages et accessibilité

- Le bouton 🔊 ouvre « Son et effets » : volume de la musique, volume des effets, tout couper, effets visuels.
- Les effets visuels sont ignorés si l'appareil demande de réduire les animations.
- Le jeu fonctionne au toucher comme à la souris et au clavier (flèches ou Z Q S D pour se déplacer).

## Crédits

Concept, direction et musique principale : Maison Paradoxe. Développement : Claude (Anthropic), avec le créateur du jeu. Les polices viennent du Bureau des affaires occultes.
