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

Une énigme résolue rapporte des pièces, et les portes difficiles offrent parfois une carte nouvelle. Une carte Boutique, ou un marchand toutes les 10 salles posées, permet d'acheter des cartes et d'en retirer. Le deck est limité à 15 cartes.

Les **jokers** sont des règles passives (temps en plus, pièces en plus, tirage élargi, gemmes plus puissantes...). On a 3 emplacements au départ, jusqu'à 5. On les achète en boutique et on les revend à moitié prix ; les jokers « malédiction » sont puissants mais ont un prix.

La conception complète est dans `CONCEPTION.md`.
