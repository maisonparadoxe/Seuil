# Seuil : document de conception

Ce document garde la mémoire des décisions prises pour faire évoluer Seuil d'un prototype de labyrinthe à énigmes vers un **deckbuilder roguelike où les salles sont les cartes**. Chaque décision a été discutée et tranchée. Il ne reste que quelques détails de contenu, listés en fin de document.

Dernière mise à jour : 30 septembre 2026 (paliers décidés).

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
| Gemmes et cases fixes | Quand une ligne ou colonne est décalée, **les cases fixes restent en place** et les salles mobiles glissent en sautant par-dessus. Le bouclage de Ravensburger est conservé. **La salle où se trouve le joueur est aussi une case immobile** : sa ligne et sa colonne restent décalables, les autres salles glissent en la sautant (règle modifiée le 30 septembre 2026, voir ci-dessous). |
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

### 3.3 ter Les cases spéciales (environnements)

Certaines cases du plan ont un **environnement spécial** : une particularité tirée au hasard, qui change les règles un instant. Elles rendent chaque plan vivant et donnent un rôle au placement des salles.

| Sujet | Décision |
| --- | --- |
| Révélation | **Mixte.** Un symbole « ? » marque les cases spéciales dès le début de l'étage. L'effet est révélé à l'arrivée sur la case. |
| Exception | Les **interdictions de pose** sont révélées quand on ouvre la porte vers la case, sur l'écran de choix : elles changent la salle qu'on peut poser, il faut donc les connaître avant. |
| Durée | Jusqu'à la **prochaine salle posée** : l'effet s'applique à la salle posée sur la case, puis à tout ce qu'on fait ensuite (prochain pas, prochaine énigme, prochain tirage), et s'éteint quand la salle suivante est posée. |
| Placement | Les **emplacements sont écrits dans les plans** (symbole `?`) : 2 au premier étage, 3 au deuxième, 4 au troisième. Les **effets sont tirés par la graine** au chargement de l'étage. |
| Terrain | Comme les murs, ces cases sont liées au terrain : **les gemmes ne les déplacent pas**, seules les salles glissent au-dessus. |

Premier lot de 8 effets, réparti entre bonus, interdictions et malus :

| Catégorie | Effet | Ce qu'il fait |
| --- | --- | --- |
| Bonus | Passe libre | La prochaine salle où l'on entre ne coûte aucun pas. |
| Bonus | Filon | +3 pièces à l'arrivée. |
| Bonus | Clé oubliée | +1 sceau à l'arrivée. |
| Interdiction (révélée au choix) | Interdit de couleur | Ici, pas de salle d'une couleur tirée au sort. Les cartes concernées sont grisées. |
| Interdiction (révélée au choix) | Pas de cul-de-sac | Ici, la salle posée doit avoir au moins une sortie. |
| Malus | Brouillard | Les jokers sont coupés jusqu'à la prochaine salle posée. |
| Malus | Serrure grippée | La prochaine porte est d'un niveau plus dur (3 au maximum). |
| Malus | Éboulis | −2 pas à l'arrivée. |

Garde-fou : si toutes les cartes tirées sont interdites, l'interdiction est levée pour ne jamais bloquer le joueur.

Idées gardées pour plus tard : Sablier (+10 secondes à la prochaine énigme), Dé oublié (+1 dé), Tirage réduit (2 cartes au prochain tirage), Thème imposé (thème tiré au sort pour la prochaine énigme).

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

### 3.6 Les paliers : une progression des règles

Le jeu complet a beaucoup de règles. Pour ne pas les imposer d'un coup, elles arrivent **par paliers**, débloqués entre les parties.

| Sujet | Décision |
| --- | --- |
| Structure | Une partie reste de **3 étages**. Gagner un palier (atteindre la Chambre du 3ᵉ étage) débloque le suivant, qui ajoute **une règle**. On peut rejouer n'importe quel palier déjà débloqué. Le dernier palier est le jeu complet. |
| Ordre (première campagne) | **Fixe** : 1 jeu de base · 2 murs et salles fixes · 3 jokers · 4 cases spéciales · 5 gemmes. Les gemmes viennent en dernier : c'est la règle la plus lourde à manier (choisir une ligne, puis un sens). |
| Jeu de base (palier 1) | Énigmes, portes, pas, deck de 8 cartes avec pioche et défausse, pièces, récompenses, boutique entre les étages. **Sans** murs, salles fixes, jokers, gemmes, cases spéciales. |
| Ordre ensuite | Une fois tout débloqué, le défi du jour et un **mode libre** peuvent **tirer l'ordre des règles avec la graine**, avec des garde-fous pour respecter les dépendances. |
| Déblocage | **Une victoire** débloque le palier suivant. Une défaite ne fait rien perdre. Un bouton « Je connais déjà le jeu : tout débloquer », après confirmation, mène directement au jeu complet. |
| Sauvegarde | Dans le navigateur (`localStorage`) : paliers débloqués. Attention : elle ne suit pas d'un appareil à l'autre ; le raccourci « tout débloquer » sert aussi à ça. |

Conséquences techniques à respecter :

- **Une liste de règles actives** (murs, jokers, cases spéciales, gemmes) est fixée au départ de la partie selon le palier. Chaque règle est un interrupteur : quand elle est éteinte, elle disparaît complètement (rien à l'écran, rien dans les pools).
- **Les plans sont partagés entre les paliers.** Un plan est dessiné une seule fois. Quand les murs sont éteints, les `#` deviennent des cases libres ; quand les salles fixes sont éteintes, `B`, `P`, `S` et `F` deviennent des cases libres ; quand les cases spéciales sont éteintes, les `?` disparaissent. Les pas de chaque plan devront être recalculés quand un plan change de forme.
- **Des dépendances à filtrer.** Les cartes à gemmes (Cristallerie, Cave aux cristaux, Salle des engrenages, Colonne des vents) n'apparaissent en récompense ou en boutique que si les gemmes sont débloquées. Les jokers Ciseau de lapidaire, Poing des Gardiens et Baguette de sourcier demandent les gemmes ; Craie du géomètre et Sentier de couleur n'ont pas besoin des cases spéciales, mais Brouillard, un effet de case spéciale, a besoin des jokers. Le joker Sablier fêlé et l'ordre des règles restent indépendants.
- **La graine** ne décide de l'ordre des règles que dans le mode libre et le défi du jour, pas pendant la première campagne.

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
3. **Les jokers** (fait). Emplacements, catalogue de 15 (12 simples et 3 malédictions), achat et revente en boutique, indicateur de déclenchement.
4. **Les niveaux** (fait). Plans en texte, murs et salles fixes, décalage adapté, trois étages.
5. **Les paliers** (fait). La liste de règles actives, la sauvegarde des paliers débloqués, l'écran de choix du palier, le raccourci « tout débloquer », le filtrage des cartes et des jokers qui dépendent d'une règle éteinte. On la fait **avant** les cases spéciales, pour que celles-ci naissent déjà derrière leur interrupteur.
6. **Les cases spéciales** (fait). Symbole « ? » dans les plans, 8 effets, révélation à l'arrivée (ou au choix de la salle pour les interdictions), durée jusqu'à la prochaine salle posée. Palier 4.
7. **Le reste de la progression.** *7a faite : exploits et cartes/jokers à débloquer. 7b faite : joker fétiche. 7c faite : mode libre.* (Le défi du jour complet existait déjà depuis l'étape 5.) (Exploits, cartes et jokers débloqués, joker fétiche, défi du jour complet, mode libre à l'ordre tiré par la graine.)

Le bonus de voisinage, qui était une étape à part, a été supprimé en tant que règle de base : il n'existe que sous forme de jokers.

## 5 bis. Avancement

- **Enquête (Murdle) à la dernière porte du dernier étage, faite** (voir plus bas).
- **Mot caché (Wordle) à la dernière porte, fait** (voir plus bas).
- **Étape 7c : mode libre, faite** (voir plus bas). L'étape 7 est terminée.
- **Étape 7b : joker fétiche, faite** (voir plus bas).
- **Étape 7a : exploits et déblocages, faite** (voir plus bas). 
- **Étape 6 : les cases spéciales, faite** (voir plus bas).
- **Étape 5 : les paliers, faite** (voir plus bas).
- **Étape 4 : les niveaux, faite** (voir plus bas).
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

### Étape 4 : les niveaux (faite)

- **Une partie = trois étages.** Chaque étage a son plan, tiré par la graine parmi les plans de sa difficulté, avec un miroir possible. Atteindre la Chambre d'un étage ouvre un écran de fin d'étage, puis un marchand (4 cartes, 2 jokers), puis l'étage suivant. La Chambre du 3ᵉ étage est la victoire.
- **Ce qui se conserve d'un étage à l'autre :** le deck, la pioche et la défausse, les jokers, les pièces, les gemmes, le Second souffle déjà utilisé. **Ce qui est renouvelé :** les pas (propres au plan), un dé et un sceau (jamais moins de 1 : on ne perd pas ceux qu'on a en réserve), le plan, les portes.
- **Pas de chaque plan.** Écrits dans le plan : environ 5,6 fois la distance la plus courte à l'étage 1, 5,3 fois à l'étage 2, 5 fois à l'étage 3. Le Sablier fêlé retire 3 pas à chaque étage.
- **Difficulté des portes.** Elle monte avec l'étage et avec l'avancée vers la Chambre. Niveau moyen des portes mesuré : 1,5 (étage 1), 2,6 (étage 2), 2,8 (étage 3). Aux étages 2 et 3, plus aucune porte de niveau 1. Portes entrouvertes : 22 %, 15 %, 8 %.
- **Format d'un plan** (texte, une chaîne par ligne) : `#` case murée, `.` case libre, `D` départ, `C` Chambre, `B` Boutique fixe, `P` Puits fixe, `S` Sanctuaire fixe, `F` Forge fixe. Les plans font au plus 6 colonnes pour rester lisibles sur un téléphone.
- **Murs.** Aucune salle dessus, on ne les traverse pas, et une porte contre un mur n'existe pas (pas plus que contre le bord du plan).
- **Salles fixes** (départ, Chambre, Boutique, Puits...). Elles sont posées d'avance avec leurs 4 portes et ne bougent jamais. Elles sont marquées d'une punaise 📌. La Chambre n'a qu'une porte, du côté d'une case libre (sud de préférence).
- **Gemmes.** Le vestibule, la Chambre et les salles fixes ne bloquent plus le décalage : quand une ligne ou colonne glisse, **les cases fixes et les murs restent en place** et les salles mobiles tournent entre les cases mobiles en les sautant. La salle du joueur compte elle aussi comme une case immobile (sauf avec le Poing des Gardiens, qui l'entraîne avec sa ligne).
- **Correction du 30 septembre 2026 : gemmes inutilisables.** La règle d'origine verrouillait la ligne et la colonne du joueur. Au début d'une partie, toutes les salles posées sont dans la colonne du joueur : aucune colonne n'était utilisable, le jeu disait « touchez une colonne » sans rien permettre. La salle du joueur est maintenant une case immobile comme les autres, et quand aucune ligne n'est utilisable, la barre l'explique et la gemme est grisée dans le panneau.

Les 9 plans actuels :

| Étage | Plan | Taille | Distance | Pas |
| --- | --- | --- | --- | --- |
| 1 | Le vestibule (Boutique fixe) | 5×7 | 6 | 34 |
| 1 | Les deux ailes | 5×7 | 8 | 45 |
| 1 | Le palier | 6×6 | 8 | 45 |
| 2 | La croix | 5×7 | 6 | 32 |
| 2 | Les piliers | 5×7 | 6 | 32 |
| 2 | L'aile brisée | 5×8 | 11 | 58 |
| 3 | L'anneau | 5×7 | 10 | 50 |
| 3 | Le grand hall (Sanctuaire fixe) | 5×9 | 8 | 40 |
| 3 | La dernière porte (Puits fixe) | 6×8 | 12 | 60 |

Un dixième plan, « d'essai » (l'ancien plan 5×9, sans murs), n'est jamais tiré : il ne sert qu'aux tests automatiques.

Vérifié par des tests automatiques : validité des 18 plans (chemin, aucune case isolée), même graine = mêmes plans, les 9 plans apparaissent parmi 40 graines, aucune porte contre un mur sur 1 404 salles tirées, décalages avec cases fixes et murs, transitions d'étage complètes (conservation du deck, des pièces et des jokers, renouvellement des pas, dés et sceaux), victoire au 3ᵉ étage, montée de la difficulté.

À revoir après quelques parties : les pas de chaque plan, la fréquence des récompenses de cartes (toujours réglée pour un seul étage : porte de niveau 2, une fois sur deux ; niveau 3, toujours), et le nombre de plans (2 ou 3 par difficulté).

### Étape 5 : les paliers (faite)

- **Menu.** Cinq paliers listés, avec leur état : sélectionnable, verrouillé (« Gagnez le palier N »), gagné (✓), ou « Bientôt » (palier 4). Le menu propose par défaut le palier le plus avancé ; après avoir débloqué un palier, il propose ce nouveau palier.
- **Interrupteurs de règles.** Chaque partie porte quatre interrupteurs (murs et salles fixes, jokers, cases spéciales, gemmes) fixés par le palier. Une règle éteinte disparaît complètement :
  - sans murs ni salles fixes : les `#` et les `B P S F` des plans deviennent des cases libres ;
  - sans jokers : ni panneau, ni emplacements, ni jokers en boutique ;
  - sans gemmes : ni salles à gemmes dans les récompenses et les boutiques, ni gemmes à l'écran, ni les jokers qui en dépendent (Baguette de sourcier, Ciseau de lapidaire, Poing des Gardiens) ;
  - les règles affichées dans « Comment jouer » suivent le palier.
- **Pas recalculés.** Ils ne sont plus lus dans le plan : ils se calculent d'après la distance la plus courte **avec les règles actives** (5,6 fois au 1ᵉʳ étage, 5,3 au 2ᵉ, 5 au 3ᵉ). Avec toutes les règles, on retrouve exactement les valeurs du tableau des plans ; sans murs, un plan plus court donne moins de pas. Le champ `pas` des plans n'est qu'un repère.
- **Textes explicatifs.** Chaque règle a son texte, affiché à deux moments : dans l'écran de victoire qui la débloque (« Nouvelle règle débloquée », avec un bouton « Jouer le palier N »), et au premier lancement du palier (« Nouveau dans ce palier »), une seule fois. Le palier 1 a un texte de bienvenue. Les textes restent relisibles dans « Comment jouer ».
- **Déblocage.** Une victoire (Chambre du 3ᵉ étage) débloque le palier suivant **prêt** : le palier 4 n'étant pas encore construit, gagner le palier 3 débloque le palier 5. Une défaite ne fait rien perdre. Sauvegarde dans le navigateur (`seuil-paliers`).
- **Raccourcis.** « Je connais déjà le jeu : tout débloquer » (avec confirmation) ouvre tous les paliers et marque les explications comme lues. « Recommencer la progression » (avec confirmation) remet tout à zéro ; les records restent.
- **Défi du jour.** Il joue le jeu complet et n'est disponible qu'une fois tous les paliers débloqués (ou après « tout débloquer »).
- **Reste à faire.** Le mode libre à l'ordre tiré par la graine est prévu à l'étape 7. (Le palier 4 est maintenant prêt : la chaîne de déblocage est 1 → 2 → 3 → 4 → 5.)

Vérifié par des tests automatiques : verrouillage au départ, texte du palier 1, aucune règle avancée au palier 1 (ni mur, ni salle fixe, ni joker, ni gemme, ni salle à gemmes sur 400 offres), pas recalculés, victoire → déblocage avec texte explicatif, explication affichée une seule fois, saut du palier 4, filtrage des jokers de gemmes au palier 3 (12 jokers sur 15), 15 jokers au palier 5, défi du jour verrouillé puis disponible, sauvegarde après rechargement, « tout débloquer » et « recommencer », même graine et même palier = même partie ; et toutes les anciennes suites (économie, jokers, niveaux, déterminisme).

### Étape 6 : les cases spéciales (faite)

- **Plans.** Le symbole `?` marque les cases spéciales : 2 au 1ᵉʳ étage, 3 au 2ᵉ, 4 au 3ᵉ. Jamais sur un mur, le départ, la Chambre, une salle fixe, ni à côté du départ. Sans la règle (paliers 1 à 3), un `?` est une case libre.
- **Effets.** Huit environnements : Passe libre, Filon (+3 pièces), Clé oubliée (+1 sceau) ; Interdit de couleur, Pas de cul-de-sac ; Brouillard (jokers coupés), Serrure grippée (prochaine porte +1 niveau, 3 max), Éboulis (−2 pas). Le tirage donne toujours un bonus d'abord, puis un mélange d'interdictions et de malus, tous distincts. Emplacements et effets viennent de la graine (`cases`, `cases-pos`).
- **Révélation.** Les `?` sont visibles dès le début. L'effet se révèle à l'arrivée sur la case ; une interdiction, dès l'ouverture de la porte vers la case (bandeau dans le tirage, cartes concernées grisées et refusées). Si les trois cartes sont interdites, l'interdiction est levée.
- **Durée.** Un effet dure jusqu'à la prochaine salle posée : il s'éteint après le pas qui entre dans cette salle. Une case ne se déclenche qu'une fois. Les cases sont liées aux coordonnées : les gemmes ne les déplacent pas.
- **Interface.** Case dorée avec « ? » puis pastille de l'icône une fois révélée ; carte « Environnement » dans le panneau ; jokers grisés dans le brouillard ; mention dans la modale de porte pour la serrure grippée ; puce dans « Comment jouer ».

Vérifié par des tests automatiques : nombre et placement des `?` sur les 9 plans, tirage des effets (bonus d'abord, distincts, les 8 apparaissent), déterminisme par graine, aucune case au palier 3, chacun des huit effets, déclenchement unique, gemmes sans effet sur les cases, chaîne de déblocage 1 → 5 ; et toutes les anciennes suites.

### Étape 7a : exploits et déblocages (faite)

- **Pool de départ.** Moitié verrouillée : 8 salles (Reliquaire, Forge froide, Salle du sablier, Puits aux salamandres, Sanctuaire, Archives, Fresque des Gardiens, Cabinet du serrurier) et 7 jokers (Quatrième main, Second souffle, Alambic, Sablier fêlé, Pacte du fondeur, Poing des Gardiens, Boussole du nord). Les cartes verrouillées n'apparaissent ni en récompense ni en boutique.
- **15 exploits, un par carte.** Chambre du 1ᵉʳ étage → Sablier · étage sans porte condamnée → Cabinet · 10 énigmes → Archives · 12 salles posées → Puits · gagner → Sanctuaire · 4 énigmes Mots → Fresque · acheter 3 cartes → Forge · gagner avec 8 cartes ou moins → Reliquaire · 15 pièces en même temps → Alambic · 4 énigmes de niveau 3 → Second souffle · étage sans dé ni sceau → Boussole · étage fini avec 15 pas restants → Quatrième main · acheter 2 jokers → Pacte · 3 énigmes en moins de 8 s → Sablier fêlé · 3 gemmes utilisées → Poing.
- **Fonctionnement.** Les exploits se valident à tout palier et même dans une partie perdue ; ils sont enregistrés dans le navigateur (`seuil-exploits`). Une bulle et le journal les annoncent, l'écran de fin les récapitule. Le menu a un carnet des exploits (n/15) qui montre ce que chacun débloque. « Tout débloquer » ouvre aussi tous les exploits ; « Recommencer » les efface.
- **Aucune carte nouvelle à écrire** pour ce lot : les 15 déblocages sont des cartes et jokers existants.

Vérifié par des tests automatiques : menu et carnet, cartes verrouillées absentes de 500 offres de salles et 300 de jokers, les 15 exploits (condition juste, pas avant), sauvegarde, entrée dans les pools, défaite qui valide quand même, rechargement, « tout débloquer » et « recommencer » ; et toutes les anciennes suites.

### Étape 7b : le joker fétiche (faite)

- **Choix.** À l'écran de victoire (paliers avec jokers), on choisit un joker parmi ceux qu'on possède. Un seul fétiche à la fois ; un nouveau choix à une victoire suivante remplace l'ancien. Une défaite ne propose rien.
- **Effet.** Au départ de chaque partie avec jokers, le fétiche occupe un emplacement, marqué 📌. Il ne peut pas être vendu. Un fétiche qui dépend des gemmes ne s'applique pas tant que les gemmes sont éteintes.
- **Menu.** Le fétiche y est affiché, avec « l'abandonner ». « Recommencer la progression » l'efface aussi. Sauvegarde : `seuil-fetiche`.

Vérifié par des tests automatiques : choix à la victoire, sauvegarde, présence au départ suivant, vente refusée en boutique, remplacement, aucun choix après une défaite, aucun effet au palier sans jokers, abandon ; et toutes les anciennes suites.

### Étape 7c : le mode libre (faite)

- **Principe.** Disponible quand tous les paliers sont débloqués. La graine mélange l'ordre des quatre règles optionnelles (murs et salles fixes, jokers, cases spéciales, gemmes) ; un sélecteur de 0 à 4 choisit combien sont actives, dans cet ordre. Même graine et même nombre : même partie.
- **Garde-fous.** Une règle éteinte disparaît complètement, comme aux paliers. Sans jokers, le Brouillard (effet de case spéciale) n'est pas tiré ; sans gemmes, les jokers et salles de gemmes sont filtrés comme avant.
- **Sans progression de palier.** Une victoire en mode libre ne débloque rien (les exploits et le joker fétiche fonctionnent comme d'habitude). « Même graine » et « Nouvelle graine » gardent le mode et le nombre de règles.
- **Explication.** Au départ, une fenêtre annonce l'ordre tiré et rappelle les règles actives ; le bandeau de la partie et l'écran de fin le résument.
- **Défi du jour.** Inchangé : le jeu complet, même partie pour tout le monde.

Vérifié par des tests automatiques : verrouillage tant que tout n'est pas débloqué, ordre (permutation, stable, varié), k = 0 à 4 avec chaque règle éteinte réellement absente, déterminisme, victoire sans déblocage, rejouer, défi du jour intact ; et toutes les anciennes suites.

### Le mot caché : un Wordle à la dernière porte (fait)

- **Où.** La porte qui mène à la Chambre de chaque étage pose un mot caché au lieu d'une énigme ordinaire (thème Mots). Les autres portes sont inchangées ; le sceau ouvre toujours la porte sans énigme.
- **Règles.** Mot de 5 lettres, 6 essais, 120 secondes (plus les bonus de temps). Vert : bien placée ; jaune : dans le mot, ailleurs ; gris : absente (doublons comptés une fois par lettre du mot). Clavier à l'écran (AZERTY) et clavier physique. Les 5 lettres saisies ne sont pas vérifiées dans un dictionnaire.
- **Mots.** 307 mots courants sans accents, tirés par la graine (même graine, même mot).
- **Échec.** Six essais ratés ou le temps écoulé : −6 pas, le mot est révélé, la porte reste verrouillée (pas de condamnation) et on peut retenter avec un autre mot. Si les pas tombent à zéro, la partie s'arrête.
- **À régler en jouant.** La pénalité (6 pas), la durée (120 s) et la taille de la liste de mots.

Vérifié par des tests automatiques : notation (doublons compris), liste valide, annonce à la dernière porte seulement, clavier virtuel et physique, victoire, échec avec −6 pas et porte verrouillée, nouveau mot au nouvel essai, partie perdue sous 6 pas ; et toutes les anciennes suites.

### L'enquête : un Murdle à la dernière porte du dernier étage (fait)

- **Où.** Les étages 1 et 2 gardent le mot caché ; la dernière porte de l'étage 3 pose une enquête, l'épreuve finale. Le sceau ouvre toujours la porte sans énigme.
- **Principe.** Trois suspects, trois armes, trois lieux : chacun est dans un lieu différent et tient une arme différente. On connaît le lieu du crime ; des indices en français permettent de désigner le coupable et son arme (deux listes déroulantes, bouton « Accuser »). Un indice se barre au toucher.
- **Générateur.** Un scénario caché est tiré par la graine ; les indices sont des affirmations vraies (« X se trouvait dans… », « X ne tenait pas… », « L'arme a été trouvée dans… ») ajoutées jusqu'à ce que la solution soit unique, puis les indices devenus inutiles sont retirés (3 à 6 indices). La solution unique est vérifiée par force brute sur les 36 scénarios.
- **Temps et échec.** 180 secondes. Un échec coûte 6 pas, la solution est révélée, la porte reste verrouillée et on retente avec une autre enquête, comme pour le mot caché.
- **À régler en jouant.** La durée, la pénalité et la difficulté (un 4×4 serait trop dense sur téléphone ; une grille de notes intégrée est une amélioration possible).

Vérifié par des tests automatiques : 300 enquêtes à solution unique et juste (force brute indépendante), 3 à 6 indices, déterminisme, Wordle à l'étage 2 et enquête à l'étage 3, mauvaise puis bonne accusation ; et toutes les anciennes suites.

## 6. Risques à surveiller

- **Le volume de contenu.** Il faudra au moins 25 à 30 cartes et une dizaine de plans pour que les parties diffèrent vraiment. On part des 20 salles actuelles et on enrichit au fil des tests.
- **L'équilibrage du joker fétiche.** Un rare gardé peut rendre le début de partie trop facile. Premier réglage si c'est le cas : le rendre plus cher à conserver, ou durcir le départ.
- **La lisibilité.** Beaucoup de règles nouvelles : chaque effet doit être visible quand il se déclenche (jokers, bonus de voisinage, décalages).
- **La qualité des énigmes.** Elles restent le cœur du jeu : une énigme injuste casse la boucle plus vite qu'un défaut de décor.
