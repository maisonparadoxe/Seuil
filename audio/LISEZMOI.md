# Sons de Seuil

Format : **MP3**, mono, courts, normalisés à peu près au même volume (le jeu les joue à 70 %). Déposer les fichiers dans ce dossier avec **exactement** ces noms. Un fichier absent ne fait jamais d'erreur : le jeu joue à la place le son de repli indiqué, ou rien.

## Sons déjà présents (repris du Bureau des affaires occultes)

`clic`, `page`, `page-journal`, `tampon`, `punaise`, `rature`, `deblocage`, `crayon-note`, `carte-depliee`.

## Musique

- `musique-principale.ogg` et `musique-principale.mp3` : thème principal du jeu, mis en boucle sans coupure (les 5 dernières secondes de l'original, qui se termine en fondu, sont fondues avec les 5 premières). Le jeu lit l'OGG si le navigateur le permet, sinon le MP3.
- Le morceau se lance au premier geste du joueur (règle des navigateurs), se met en pause quand l'onglet est caché, et se règle dans « Son et effets ».
- Un fichier absent ne fait aucune erreur : le jeu reste silencieux.
- Pistes prévues plus tard (non branchées) : énigme chronométrée, urgence, boutique, victoire, défaite.

## Sons fournis (15) : tous présents

`paquet-dechire`, `carte-retournee`, `carte-rare`, `enigme-ok`, `enigme-ko`, `tic`, `piece`, `case-bonus`, `case-interdit`, `case-malus`, `pose-salle`, `etage-fin`, `victoire`, `defaite`, `exploit`.

Les fichiers reçus ont été retaillés (silences et queues trop longues coupés, petit fondu de fin) et ramenés à un volume de crête comparable, pour qu'aucun effet ne couvre les autres. Les originaux sont conservés chez toi. Durées finales : de 0,2 s (`tic`, un seul tic extrait du fichier d'origine qui en contenait une série) à 6,7 s (`victoire`).

Les sons de repli (voir `SONS` dans `seuil.js`) ne servent plus que si un fichier est supprimé.

## Plus tard (non branchés)

Nappe d'ambiance en boucle (désactivable à part), son de glisser pour l'ouverture d'un paquet (déchirure progressive), retrait ou jet d'une carte, clic de touche du Wordle et du Mastermind.
