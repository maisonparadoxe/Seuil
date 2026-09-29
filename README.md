# SEUIL

Un labyrinthe de portes et d'énigmes, jouable dans le navigateur. Un jeu Maison Paradoxe.

Chaque porte est scellée par une énigme chronométrée (Chiffres, Mots, Logique, Symboles). Si vous la résolvez, vous choisissez une salle parmi trois. Vos pas sont comptés, et des gemmes permettent de décaler une ligne ou une colonne du plan.

## Jouer

Ouvrez `index.html` dans un navigateur (double-clic), sans serveur. Sans internet, seules les polices changent.

## Fichiers

- `index.html`, `seuil.css`, `seuil.js` : le jeu, sans dépendance
- `img/`, `audio/` : images et sons (un fichier absent est ignoré)

Issu de l'univers du Bureau des affaires occultes, mais dans un projet indépendant.

## Deck et graines

Vos salles sont des cartes : vous partez avec un deck de 8 cartes, vous en tirez 3 à chaque porte et vous en posez une. Les trois vont ensuite à la défausse, et quand la pioche est presque vide on y remélange la défausse. Le bouton « Deck » montre vos cartes.

Chaque partie a une **graine** (six lettres). Avec la même graine, la partie est la même : mêmes portes, mêmes énigmes, même pioche. Écrivez une graine dans le champ du menu pour rejouer une partie, ou touchez « Défi du jour » pour jouer la même partie que tout le monde aujourd'hui.

La conception complète est dans `CONCEPTION.md`.
