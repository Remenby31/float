---
name: "Float — Daybook"
version: "1.0"
tags: [editorial, monochrome, daybook, responsive, quiet]
author: "Float"
source_url: ""
created: "2026-09-26"
style_prompt_short: >
  Un carnet de tâches éditorial, papier ou graphite. Grandes capitales compactes,
  séparateurs fins, cases carrées et une seule ponctuation orange.
style_prompt_full: >
  Create Float's Daybook identity: a calm, typographic task manager inspired by
  a printed daily planner. Paper #EFEEEA with Ink #30302D in light mode;
  Graphite #292927 with Paper #EFEEEA in dark mode. Reserve Signal #F45B24 for
  the square full stop of the geometric FLOAT wordmark and completed square
  checkboxes. Use #B83C0D for accent text on Paper and #FF8B59 on Graphite.
  Geist Bold 700, tightly tracked at -0.055em, uppercase for weekday headings;
  Geist Regular 400 for sentence-case task content; Geist Mono for small
  metadata. Left-aligned text, generous negative space, 1px rules and flat
  surfaces. No gradients, frosted glass, colorful cards, pill-shaped controls,
  decorative shadows or confetti. On laptops use two columns: a vertical
  Monday–Sunday agenda on the left and grouped projects on the right. On mobile
  use one column and Week / Projects navigation, not a horizontal carousel.
  A 15px checkbox sits inside a 44px target. Completed text has a restrained
  orange strike-through. Dialogs are bordered editorial sheets, becoming
  bottom sheets on phones. Keep focus visible, errors explicit, text readable
  and transitions short. Respect reduced motion. The voice is brief, humane,
  and pressure-free: Less noise. More doing. One day at a time.
colors:
  primary:
    - { name: "Paper", hex: "#EFEEEA", role: "Fond clair, texte inversé" }
    - { name: "Graphite", hex: "#292927", role: "Fond sombre, icône d’application" }
    - { name: "Ink", hex: "#30302D", role: "Texte principal sur papier" }
  accent:
    - { name: "Signal", hex: "#F45B24", role: "Ponctuation du logo, case terminée" }
    - { name: "Signal text / Paper", hex: "#B83C0D", role: "Texte d’accent accessible sur fond clair" }
    - { name: "Signal text / Graphite", hex: "#FF8B59", role: "Texte d’accent sur fond sombre" }
  neutral:
    - { name: "Pencil", hex: "#68665F", role: "Métadonnées en thème clair" }
    - { name: "Chalk", hex: "#AAA79F", role: "Métadonnées en thème sombre" }
    - { name: "Rule / Paper", hex: "#C5C4BC", role: "Séparateurs clairs" }
    - { name: "Rule / Graphite", hex: "#53534E", role: "Séparateurs sombres" }
typography:
  display:
    family: "Geist"
    weight: "700"
    style: "capitales, interlettrage -0.055em, alignement gauche"
  body:
    family: "Geist"
    weight: "400"
    style: "casse naturelle, 13–16px, interligne 1.55"
  caption:
    family: "Geist Mono"
    weight: "400"
    style: "10–12px, interlettrage 0.08em, capitales pour les libellés"
  rules:
    - "Polices WOFF2 auto-hébergées, aucun appel à un CDN."
    - "Les titres structurent; le contenu utilisateur ne passe jamais en capitales."
    - "Les titres de tâches reviennent à la ligne; les métadonnées peuvent être tronquées."
    - "Champs à 16px sur mobile pour éviter le zoom automatique."
layout:
  grid: "Base 4px, largeur maximale 1440px, deux colonnes au-dessus de 768px"
  alignment: "Gauche, lignes horizontales continues, aucun effet masonry"
  aspect_ratio: "Responsive : laptop et téléphone"
  notes:
    - "Marges 56px laptop, 32px tablette, 20px mobile."
    - "Gouttière 64px desktop, 36px en dessous de 1100px."
    - "Les jours restent visibles même sans tâche."
    - "Les projets sont des sections, pas des cartes."
    - "Rayons : 2px contrôles, 4px fenêtres, 8px sommet des feuilles mobiles."
    - "Cibles principales 44px; cases dessinées 15px."
motion:
  transitions: ["couleur 150ms", "fenêtre 180ms", "insertion tâche 250ms"]
  animation_style: "Apparitions discrètes, déplacements courts, aucun rebond."
  pacing: "Immédiat, mesuré, sans animation permanente hors chargement."
  audio_cues: []
mood:
  keywords: [calme, concret, éditorial, familier, lisible]
  era: "Papeterie moderniste, interface contemporaine"
  cultural_reference: "Carnet journalier et typographie grotesque, d’après la référence fournie"
  avoid:
    - "Dégradés, glassmorphism et cartes pastel"
    - "Pills, cases rondes et ombres décoratives"
    - "Gamification et messages de productivité culpabilisants"
    - "Textures de bruit sur le texte ou contraste volontairement insuffisant"
    - "Réduction d’un dashboard desktop pour fabriquer la version mobile"
assets:
  reference_images: []
  gsep_elements: []
  html_snippets: []
x_float:
  implementation: "frontend/src/styles/app.css"
  tokens: "frontend/public/brand/tokens.json"
  preview_route: "/brand"
  guide: "docs/brand/branding-kit.md"
---

## Principes

La structure vient des caractères, de l’espace et du filet. Orange indique une
action accomplie ou un point d’attention, pas une catégorie arbitraire. Une même
identité doit survivre au changement de taille et à l’inversion du thème.

## Extraction de la référence

Source : image fournie par l’utilisateur le 26 septembre 2026, avec deux agendas
mobiles côte à côte, clair et sombre. Les éléments repris sont les titres de jours
massifs, l’absence de cartes, les filets fins, le rythme vertical et les cases orange.
La police exacte et les valeurs de couleur de l’image ne sont pas connues : Geist
et les couleurs ci-dessus sont des choix de conception, pas une identification.
La texture photographique de la maquette n’est pas ajoutée à l’interface.

## Application

Le CSS de l’application est la source d’exécution. Le JSON est l’export portable,
et `/brand` montre les mêmes composants et variables que l’interface. Les SVG sont
vectoriels et le mot-symbole est converti en tracés : aucune police n’est nécessaire
pour réutiliser le logo. Les couleurs personnelles des projets sont préservées.
