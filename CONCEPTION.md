# Seuil : document de conception

Ce document garde la mémoire des décisions prises pour faire évoluer Seuil d'un prototype de labyrinthe à énigmes vers un **deckbuilder roguelike où les salles sont les cartes**. Chaque décision a été discutée et tranchée. Il ne reste que quelques détails de contenu, listés en fin de document.

Dernière mise à jour : 29 septembre 2026 (bonus de voisinage confié aux jokers).

## 1. Où en est le jeu aujourd'hui

Prototype jouable dans le navigateur (`index.html`, sans serveur).

- Plan de 5 colonnes par 9 lignes. Départ en bas au centre (Vestibule), arrivée en haut au centre (Chambre des Gardiens). 45 pas.
- Chaque porte verrouillée pose une énigme chronométrée (une seule chance, sinon la porte est condamnée). Si elle est résolue, on choisit une salle parmi trois.
- Quatre thèmes d'énigmes, chacun avec sa couleur : Chiffres (bleu), Mots (rouge), Logique (vert), Symboles (or). La couleur d'une salle est le thème des énigmes de ses portes de sortie.
- Ressources : pas, dés (relancent le tirage), sceaux (ouvrent une porte sans énigme), sablier (temps en plus), gemmes ↔ et ↕ (décalent une ligne ou colonne du plan, en bouclant).
- Le tirage de trois salles se fait dans un pool pondéré de 20 modèles de salles, avec aperçu de la salle sur le plan avant de la poser.
- Fil narratif léger : le carnet de Valcourt, le serrurier disparu (6 fragments).

Ce prototype est la base sur laquelle les décisions ci-dessous viennent se greffer.

## 2. Vision

Une expédition traverse **trois étages** d'un labyrinthe des Gardiens du seuil. On y construit un **deck de salles** et une **main de jokers** pour atteindre la Chambre de chaque étage. Le jeu reste avant tout un jeu de puzzles : ce sont les énigmes qui ouvrent les portes.

## 3. Décisions

### 3.1 Le deck (les salles sont des cartes)

| Sujet | Décision |
| --- | --- |
| Cycle | Pioche, défausse, remélange. À chaque porte, on tire 3 cartes de la pioche et on en joue une. Les trois vont ensuite à la défausse. Quand la pioche a moins de 3 cartes, on y remélange la défausse. La salle reste sur le plan, mais la carte revient dans le cycle. |
| Taille | Départ à **8 cartes**, plafond à **15**. |
| Deck de départ | 2 Galeries, 2 Coudes, 1 Fourche, 1 Salle en T, 1 Cellier (+8 pas), 1 Réfectoire (+5 pas). La **couleur d'une carte est fixe** : les six salles de passage et le Réfectoire se répartissent sur les quatre thèmes (chiffres, mots, logique, symboles) pour que toutes les énigmes soient possibles au début. Le Cellier, cul-de-sac, n'a pas de thème. Les cartes spéciales (gemmes, dés, fragments) se gagnent en cours de partie. |
| Gains | Une porte difficile (niveau 3) offre le choix d'une carte nouvelle parmi trois. Une salle **Boutique** (elle-même une carte du deck) vend des cartes. |
| Retrait et amélioration | Retirer une carte coûte de la monnaie (Boutique ou Atelier). Une amélioration est rare et ne se fait que dans une salle particulière. |
| Monnaie | Une seule, gagnée aux énigmes selon la difficulté de la porte et le temps restant. Les salles bonus peuvent en donner. |
| Gains | Porte niveau 1 : 2 pièces. Niveau 2 : 3. Niveau 3 : 5. Plus **1 pièce** si l'énigme est résolue avec plus de la moitié du temps restant. Un étage rapporte environ 40 pièces. |
| Prix | Carte courante 6. Carte spéciale 10. Retrait d'une carte 5 (+2 à chaque retrait). Joker commun 8, peu commun 14, rare 22. Emplacement de joker supplémentaire 15, puis 25. Économie « moyenne » : on achète 3 à 5 choses par étage. À régler après quelques parties. |
| Couleurs | La couleur reste le thème des énigmes des portes de sortie : le deck décide de ce qu'on affronte. **Aucun bonus de voisinage par défaut** : les effets liés à la proximité de deux salles de même couleur passent par des **jokers** (voir 3.2). |

### 3.2 Les jokers

Des règles passives qui modifient le tirage, les énigmes ou l'économie, dans l'esprit de *Balatro*. Un indicateur visible signale quand un joker se déclenche.

| Sujet | Décision |
| --- | --- |
| Emplacements | 3 au départ, jusqu'à 5 (l'emplacement supplémentaire s'achète en Boutique, prix croissant). |
| Obtention | En Boutique : 2 cartes et 2 jokers proposés, les jokers coûtant plus cher que les cartes et d'autant plus qu'ils sont rares. |
| Revente | À moitié prix. |
| Persistance | **Un joker fétiche** est gardé d'une partie à l'autre : à la fin d'une partie qui atteint la Chambre, le joueur en choisit un à emporter. N'importe quel joker peut l'être, même un rare, mais il occupe un emplacement et ne peut pas être échangé. |
| Catalogue initial | 12 jokers simples en trois raretés, plus **3 jokers « malédiction »** (forts, avec un inconvénient), soit 15 au total (voir ci-dessous). |
| Prix | Commun 8, peu commun 14, rare 22 (voir 3.1). La revente est à moitié prix. |

Brouillon du catalogue. Les prix indiqués ci-dessous sont ceux de la version d'origine (relatifs) : ce sont ceux du tableau des prix de 3.1 qui font foi.

| Rareté | Joker | Effet | Famille |
| --- | --- | --- | --- |
| Commun (4) | Loupe de Valcourt | +5 secondes à chaque énigme | Énigmes |
| | Pièce fêlée | +1 pièce à chaque énigme résolue | Économie |
| | Baguette de sourcier | Les salles à gemmes sortent deux fois plus souvent | Gemmes |
| | Craie du géomètre | Poser une salle contre une salle de même couleur rapporte 1 pièce | Plan |
| Peu commun (7) | Sacoche du serrurier | +3 au plafond du deck (15 → 18) | Deck |
| | Clé à quatre dents | Une chance sur 3 qu'un tirage contienne une salle à 4 portes | Tirage |
| | Ciseau de lapidaire | Les gemmes décalent 1 ou 2 crans, même les courantes | Gemmes |
| | Boussole du nord | Chaque tirage contient au moins une salle avec une porte face au joueur | Tirage |
| | Sentier de couleur | Entrer dans une salle voisine d'une salle de même couleur : 50 % de chance que le pas ne coûte rien | Pas |
| Rare (12) | Quatrième main | Tirer 4 cartes au lieu de 3 | Tirage |
| | Second souffle | Une énigme ratée par partie ne condamne pas la porte | Énigmes |
| | Alambic | Les effets des salles bonus (pas, dés, sceaux) sont doublés | Économie |

Jokers « malédiction » : trois jokers puissants, de rareté peu commune ou rare, avec une contrepartie. Exemples à affiner :

| Joker | Effet | Prix à payer |
| --- | --- | --- |
| Sablier fêlé | +10 secondes à chaque énigme | 3 pas de moins à chaque étage |
| Pacte du fondeur | +1 pièce à chaque énigme résolue | Plafond du deck réduit de 3 |
| Poing des Gardiens | Les gemmes décalent de 2 crans | La salle du joueur est aussi entraînée par le décalage |

### 3.3 Les niveaux (les étages)

| Sujet | Décision |
| --- | --- |
| Structure | Une partie est une **suite de 3 étages**, avec le même deck, les mêmes jokers et les mêmes pièces d'un étage à l'autre. Une Boutique s'intercale entre les étages. La dernière Chambre est la vraie fin. |
| Pas | Renouvelés à chaque étage. **Chaque plan a son propre nombre de pas**, écrit dans le plan en fonction de sa forme. Repère : environ 5 fois la distance la plus courte jusqu'à la Chambre (45 pour le plan actuel, où elle est de 8 cases, avec une marge), réduit d'un cran à chaque étage plus dur. |
| Difficulté | Elle monte par les portes : étage 1 surtout niveaux 1 et 2, étage 2 niveaux 2 et 3, étage 3 surtout niveau 3, avec plus de portes verrouillées et moins de portes ouvertes. |
| Plans | **Écrits à la main**, en petite banque (2 ou 3 par niveau de difficulté). La graine choisit quel plan sert à chaque étage et peut le retourner en miroir. |
| Cases immobiles | Deux types : les **cases murées** (obstacle : aucune salle dessus, on ne les traverse pas) et les **salles fixes** (posées d'avance, avec leurs portes, jamais déplacées, par exemple une Boutique). |
| Gemmes et cases fixes | Quand une ligne ou colonne est décalée, **les cases fixes restent en place** et les salles mobiles glissent en sautant par-dessus. Le bouclage de Ravensburger est conservé. La ligne et la colonne du joueur restent hors d'atteinte. |
| Portes | Une porte contre une case murée est un mur, comme un bord de plan. |

Un plan s'écrit en texte simple, par exemple avec `#` pour une case murée, `.` pour une case libre, `D` pour le départ, `C` pour la Chambre, `F` pour une salle fixe :

```
Le vestibule           Les deux ailes        La croix
. . C . .              C . # . .             # . C . #
. . . . .              . . # . .             . . . . .
. . . . .              . . . . .             # . . . #
. . . . .              . # . # .             . . # . .
. . D . .              . . D . .             # . D . #
```

### 3.3 bis Dés et sceaux

| Sujet | Décision |
| --- | --- |
| Rôle | Un **dé** défausse les 3 cartes tirées et en tire 3 nouvelles. Un **sceau** ouvre une porte sans énigme (sans pièces ni récompense). |
| Quantité | **Renouvelés à chaque étage** : 1 dé et 1 sceau au début de chaque étage. La Boutique ne les vend pas ; les salles bonus peuvent encore en donner en cours d'étage. |

### 3.4 Les graines

- Une **graine aléatoire**, toujours affichée et copiable, pour rejouer ou partager une partie.
- Un **défi du jour** : la graine est dérivée de la date, sans serveur, donc la même partie pour tout le monde.
- Possibilité de **saisir une graine** à la main.
- Les scénarios écrits (deck de départ et règles particulières) viendront plus tard, quand la boucle de base sera solide.

Détail technique important : l'aléatoire du navigateur est remplacé par un générateur à graine. Pour que deux joueurs avec la même graine restent comparables même s'ils font des choix différents, on **sépare les flux aléatoires** (portes, énigmes, pioche, boutique, plans), chacun dérivé de la graine et de la position sur le plan.

### 3.5 La progression entre parties

Le deck repart de zéro à chaque partie. On progresse **en variété, pas en puissance** : de nouvelles cartes et de nouveaux jokers rejoignent les pools de récompense et de boutique. Seul le joker fétiche traverse les parties (voir 3.2).

Le contenu se débloque par **des exploits ciblés, lisibles** (le joueur voit ce qu'il vise) et par **le carnet** :

- Chaque exploit débloque une carte ou un joker. Exemples : atteindre la Chambre du 1er étage ; finir un étage sans condamner une seule porte ; gagner avec un deck de 8 cartes ; réussir 10 énigmes de Logique en une partie.
- Les fragments du carnet de Valcourt débloquent les cartes liées à l'histoire.
- Perdre ne bloque pas la progression : les exploits se valident même dans une partie perdue.

## 4. Points encore ouverts

Il ne reste que du contenu à écrire et à régler en jouant :

1. **La liste des exploits** et ce que chacun débloque (un premier lot de 10 à 15).
2. **Les cartes à débloquer** : un premier lot de 10 à 15 cartes nouvelles, en plus des 20 salles actuelles, avec leur couleur.
3. **Le détail des trois jokers « malédiction »**, à affiner après les premiers essais.
4. **Le réglage des chiffres de l'économie** (gains, prix) et des pas de chaque plan, à faire après quelques parties.
5. **Les plans** : une petite banque à dessiner (2 ou 3 par niveau de difficulté), avec leurs pas.

## 5. Ordre de développement proposé

Chaque étape se teste seule.

1. **Le moteur du deck** (fait). Générateur de hasard à graine, pioche, défausse et remélange, deck de départ.
2. **L'économie** (fait). Monnaie, récompenses, Boutique, retrait, plafond de 15.
3. **Les jokers** (fait). Emplacements, catalogue de 15 (12 simples et 3 malédictions), achat et revente en boutique, indicateur de déclenchement. C'est là que vivent les effets de voisinage entre salles de même couleur.
4. **Les niveaux.** Format de plan en texte, cases murées et salles fixes, règle de décalage adaptée, suite de trois étages avec pas propres à chaque plan.
5. **La progression entre parties.** Cartes et jokers débloqués par des exploits, joker fétiche, écran des graines et défi du jour complets.

Le bonus de voisinage, qui était une étape à part, a été supprimé en tant que règle de base : il n'existe que sous forme de jokers.

## 5 bis. Avancement

- **Étape 3 : les jokers, faite** (voir plus bas).
- **Étape 2 : l'économie, faite** (voir plus bas).
- **Étape 1 : le moteur du deck, fait.** Générateur de hasard à graine (flux séparés par porte, énigme, pioche et orientation des salles), deck de départ de 8 cartes à couleur fixe, cycle pioche, défausse et remélange, dés qui défaussent et retirent 3 cartes, fenêtre « Deck », graine affichée et copiable, saisie d'une graine et défi du jour dans le menu.
  - Vérifié par des parties automatiques : même graine, même partie ; graines différentes, parties différentes ; aucun appel au hasard du navigateur pendant une partie ; le deck conserve toujours ses 8 cartes, réparties entre pioche, défausse et main.
  - Le deck de départ ne contient que 8 cartes : les autres salles (gemmes, fragments du carnet) arrivent par les récompenses et la boutique (étape 2).

### Étape 2 : l'économie (faite)

- **Pièces.** 2, 3 ou 5 pièces par énigme résolue selon le niveau de la porte, plus 1 si elle est résolue avec plus de la moitié du temps restant. Un sceau ne rapporte rien. Les pièces s'affichent dans le panneau.
- **Récompenses.** Après une énigme résolue, une porte de niveau 2 ou 3 peut offrir le choix d'une carte nouvelle parmi trois, avant le tirage de la salle. La carte rejoint la défausse. Si le deck est plein (15), on ne peut plus en prendre. La carte **Boutique** est proposée d'office à la première récompense.
- **Deux accès à la boutique**, comme décidé : la **carte Boutique** (salle à 2 sorties, 4 cartes en vente) et un **marchand de passage** garanti toutes les 10 salles posées (2 cartes en vente). Chacun s'ouvre à la première entrée dans la salle.
- **Achat et retrait.** Carte courante 6 pièces, carte spéciale 10. Retrait d'une carte 5 pièces, puis 7, 9, etc. On ne peut pas descendre sous 4 cartes ni dépasser 15. Les salles pièges ne sont jamais proposées.
- **Écart temporaire avec la conception.** Le document prévoyait des récompenses sur les portes de niveau 3 seulement. Comme il n'y a qu'un étage pour l'instant, les portes de niveau 3 sont trop tardives : une porte de niveau 2 offre une carte une fois sur deux, une de niveau 3 toujours. À revoir quand les étages existeront. Les jokers ne sont pas encore en vente (étape 4).
- **Correction au passage.** La touche Échap ne ferme plus les fenêtres de décision (résultat d'énigme, récompense, boutique) : elle pouvait laisser la partie dans un état incohérent.

### Étape 3 : les jokers (faite)

- **Emplacements.** 3 au départ, jusqu'à 5 : 15 pièces pour le quatrième, 25 pour le cinquième, en boutique. Le panneau montre les jokers (bordure de rareté, teinte rouge pour les malédictions) ; toucher un joker en affiche la description.
- **Boutique.** Chaque boutique vend 2 jokers, tirés selon la rareté, jamais un joker déjà possédé. Prix : commun 8, peu commun 14, rare 22. La revente se fait à moitié prix.
- **Signal de déclenchement.** Une bulle en haut de l'écran et un éclat sur l'emplacement du joker indiquent quand il agit. Les effets fréquents (temps en plus, pièces) n'écrivent pas dans le journal.
- **Les 15 jokers sont actifs** : Loupe de Valcourt, Pièce fêlée, Baguette de sourcier, Craie du géomètre, Sacoche du serrurier, Clé à quatre dents, Ciseau de lapidaire, Boussole du nord, Sentier de couleur, Quatrième main, Second souffle, Alambic, et les trois malédictions Sablier fêlé, Pacte du fondeur, Poing des Gardiens.

Choix d'implémentation à connaître :

| Joker | Comment il est réalisé |
| --- | --- |
| Clé à quatre dents | Une fois sur 3, une **Croisée temporaire** (4 portes, thème au hasard) prend la place de la dernière carte tirée, qui retourne en haut de la pioche. La carte temporaire disparaît après usage et n'entre jamais dans le deck. |
| Boussole du nord | Si aucune carte du tirage n'a de porte en face du joueur, une carte est échangée avec la première carte de la pioche qui en a une. « Si le deck le permet » : si aucune n'est dans la pioche, rien ne change (3 tirages sur 200 restent sans porte en face, contre 34 sans le joker). |
| Second souffle | Le premier échec de la partie laisse la porte verrouillée. La retentative pose une **autre énigme** (le numéro de tentative entre dans la graine de l'énigme), pour ne pas offrir la réponse déjà révélée. |
| Sablier fêlé | −3 pas **à l'achat**, faute d'étages pour l'instant. Le malus se répétera au début de chaque étage quand ils existeront. |
| Pacte du fondeur | Refusé à l'achat si le deck dépasse le plafond réduit. |
| Sacoche du serrurier | Vente refusée si le deck dépasserait ensuite le plafond. |
| Poing des Gardiens | Les gemmes décalent toujours de 2 crans, et la ligne ou colonne du joueur devient décalable : le joueur est entraîné avec sa salle. Le Vestibule et la Chambre restent immobiles. |
| Sentier de couleur | Chaque entrée dans une salle de même couleur que celle qu'on quitte a 50 % de chance d'être gratuite (tirage lié à la graine). |
| Alambic | Double les pas positifs, dés et sceaux des salles bonus. Pas le temps, les gemmes ni les fragments. |

Vérifié par des tests automatiques : chaque effet séparément, l'achat, la revente, les emplacements, le refus des jokers incompatibles, la fréquence de la Clé (105 tirages sur 300, soit environ 1 sur 3) et du Sentier (environ 45 %), le déterminisme des parties avec jokers, et l'absence de tout appel au hasard du navigateur.

## 6. Risques à surveiller

- **Le volume de contenu.** Il faudra au moins 25 à 30 cartes et une dizaine de plans pour que les parties diffèrent vraiment. On part des 20 salles actuelles et on enrichit au fil des tests.
- **L'équilibrage du joker fétiche.** Un rare gardé peut rendre le début de partie trop facile. Premier réglage si c'est le cas : le rendre plus cher à conserver, ou durcir le départ.
- **La lisibilité.** Beaucoup de règles nouvelles : chaque effet doit être visible quand il se déclenche (jokers, bonus de voisinage, décalages).
- **La qualité des énigmes.** Elles restent le cœur du jeu : une énigme injuste casse la boucle plus vite qu'un défaut de décor.
