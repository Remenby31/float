# Float / Daybook — kit de marque

Édition 01 · 26 septembre 2026

La direction : un carnet éditorial. Fond papier ou graphite, texte dense et net,
filets fins, orange utilisé avec parcimonie. La marque reste **Float**.

## Livrables

| Élément | Fichier ou emplacement |
| --- | --- |
| Guide visuel portable | `docs/brand/visual-style.md` |
| Présentation interactive | Route `/brand`, sans connexion requise |
| Tokens exportables | `frontend/public/brand/tokens.json` |
| Archive complète | `frontend/public/brand/float-daybook-kit.zip` |
| Mot-symbole clair | `frontend/public/brand/wordmark-ink.svg` |
| Mot-symbole inversé | `frontend/public/brand/wordmark-paper.svg` |
| Monogramme vectoriel | `frontend/public/brand/mark.svg` |
| Palette vectorielle | `frontend/public/brand/palette.svg` |
| Couverture sociale | `frontend/public/brand/social-card.svg` et `.png`, 1200 × 630 |
| Icônes installables | `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` |
| Favicon | `favicon.svg` et `favicon.png` |
| Composants réutilisables | `Brand.tsx`, `TaskCheckbox.tsx`, `ConfirmDialog.tsx` |

Les chemins sans préfixe de dossier sont dans `frontend/public/`. Les illustrations
du kit sont réalisées en SVG et CSS : elles restent éditables, légères et nettes.

## Identité et ton

Promesse : **Make room for what matters.**

Signature : **Less noise. More doing.**

Phrase quotidienne : **One day at a time.**

Float s’exprime avec des phrases courtes, concrètes et calmes. Ni performance
imposée, ni fausse urgence. Exemple d’état vide : « A little room to breathe. »
Une erreur décrit le problème et permet de réessayer, sans blâmer la personne.
L’anglais existant de l’interface est conservé; les noms de projets et tâches ne
sont ni traduits, ni transformés.

## Logo

Le FLOAT géométrique est dessiné en tracés, avec un carré Signal à la ligne de base.
Le monogramme F utilise le même principe. Réserver une hauteur de capitale autour
du logo. Largeur minimale du mot-symbole : 80px. Favicon dédié à 32px pour conserver
une lecture nette. Les icônes installables gardent leur marque dans la zone centrale
afin de supporter les masques des systèmes mobiles.

Ne pas étirer, incliner, ajouter de contour, d’ombre ou de dégradé. Ne pas remplacer
le carré orange par une pastille. Sur photo, utiliser un fond uni Paper ou Graphite.

## Couleurs, typographie et espace

Le JSON contient les deux thèmes complets, les couleurs sémantiques, les tailles,
les rayons et les durées. Signal `#F45B24` est réservé à la marque et aux états
terminés; les accents textuels sont plus contrastés. Les couleurs de projet restent
disponibles comme petits repères personnels, sans teinter des surfaces entières.

Geist 700 pour les titres en capitales; Geist 400 pour les tâches; Geist Mono pour
les libellés et raccourcis. Polices déjà présentes, hébergées localement. Pas de
dépendance typographique ou réseau ajoutée. Corps de tâche à 13px laptop / 14px
mobile, champs à 16px mobile, titres de jours de 26 à 38px.

Échelle d’espace : 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64px. Filets à 1px.
Pas d’ombres dans l’espace de travail; ombre discrète réservée aux fenêtres.

## Système responsive

| Surface | Laptop ≥768px | Mobile <768px |
| --- | --- | --- |
| Navigation | Masthead, recherche, historique, thème, compte | Recherche, thème, compte; historique dans le compte |
| Organisation | Agenda à gauche, projets à droite | Bascule Week / Projects, une colonne |
| Jours | Sections verticales repliables | Même rythme, titres 32px |
| Tâches | Cases carrées, titres sur plusieurs lignes | Cases de 15px dans une cible de 44px |
| Détails | Feuille centrée, largeur max. 780px | Feuille inférieure, max. 94dvh |
| Date / apparence | Popover bordé | Feuille inférieure |
| Marges | 56px, puis 32px sous 1100px | 20px |

Les jours avec du contenu et le jour courant sont ouverts par défaut. Les autres
restent repliables et accessibles, même sans tâche. Une nouvelle tâche lancée depuis
un jour reçoit cette date par défaut; une date explicitement saisie reste prioritaire.

## Inventaire couvert

- Connexion, mot de passe affichable, soumission et erreur.
- Masthead, compte, changement de thème, undo/redo, recherche et ajout global.
- Agenda lundi–dimanche, tâches en retard et futures, glisser-déposer entre jours.
- Groupes, sous-projets, titres éditables, couleurs, icônes, création et suppression.
- Tâches en attente, terminées pendant la session, ajouts, détails, déplacement.
- Recherche et création clavier ou bouton tactile; suggestions de dates.
- Date, heure, déplacement vers un autre projet, notes riches, barre de formatage.
- Pièces jointes, confirmations, notifications et états vides.
- Chargement, erreur de route, 404 et retour vers l’application.
- Favicon, icônes PWA, métadonnées et couleur de barre système selon le thème.

## Accessibilité et interaction

Focus visible, commandes natives, états `aria-expanded` / `aria-pressed`, titres de
fenêtres accessibles, retour du focus et boucle clavier dans les fenêtres principales.
Les champs ont des noms accessibles; les tâches peuvent s’ouvrir au clavier sans
cliquer sur un conteneur. La validation n’utilise pas la couleur seule : coche et
texte barré l’accompagnent. Les notifications sont annoncées par une région live.

Les cibles des actions principales et des cases sont de 44px. Les jours de calendrier
et certaines palettes compactes sont plus denses sur laptop. `prefers-reduced-motion`
désactive les mouvements. Les tests de contraste couvrent les paires de texte
principales des deux thèmes; ils ne constituent pas à eux seuls un audit WCAG complet.

## Vérification et maintenance

Depuis `frontend/` : `npm run check`, puis Playwright local. Les scénarios de branding
utilisent des données isolées et couvrent les deux thèmes, les vues 320px à 1440px,
les composants et les assets. Les tests existants de création clavier sont conservés.
Le smoke de production est non destructif. Cette PR ne déclenche pas de déploiement.

Pour modifier une couleur, synchroniser `src/styles/app.css` et `public/brand/tokens.json`;
le test des tokens détecte un écart. Mettre à jour les aperçus si l’identité change.
Les fichiers générés du routeur doivent être régénérés par `npm run build` et commités.

Pour régénérer les PNG et l’archive, exécuter `npm run brand:assets` depuis `frontend/`.
Le script nécessite `rsvg-convert` (librsvg) et `zip`; aucun service de génération
ou appel réseau n’est nécessaire. Les sources de référence restent les SVG et le JSON.
