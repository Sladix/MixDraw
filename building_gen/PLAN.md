# Building Generator - Plan d'Implementation

## Vue d'ensemble

Generateur procedural de facades architecturales utilisant une Split Grammar, avec accent sur:
- Controles haut niveau pour outputs radicalement differents
- GUI organisee en niveaux (Simple → Expert)
- Export SVG pour plotter Axidraw

## Architecture

```
building_gen/
├── index.html          # Point d'entree, canvas + Tweakpane
├── src/
│   ├── main.ts         # Setup Paper.js, GUI, orchestration
│   ├── grammar/
│   │   ├── types.ts    # Block, Rule, Grammar interfaces
│   │   ├── rules.ts    # Regles de subdivision
│   │   └── engine.ts   # Moteur d'execution de la grammaire
│   ├── styles/
│   │   ├── presets.ts  # Gothic, ArtDeco, Brutalist, Baroque, SciFi
│   │   └── interpolate.ts # Morphing entre styles
│   ├── render/
│   │   ├── facade.ts   # Rendu des blocs → paths Paper.js
│   │   ├── details.ts  # Fenetres, ornements, textures
│   │   └── effects.ts  # Biseautage, ombres, hachures
│   └── utils/
│       ├── random.ts   # Seeded RNG
│       ├── proportions.ts # Golden ratio, Fibonacci helpers
│       └── export.ts   # SVG export
└── PLAN.md
```

## Systeme de Grammaire

### Types de Blocs

```typescript
type BlockType =
  | 'building'    // Racine
  | 'body'        // Corps principal
  | 'wing'        // Aile laterale
  | 'tower'       // Tour/fleche
  | 'setback'     // Retrait (Art Deco)
  | 'crown'       // Couronnement
  | 'base'        // Soubassement
  | 'floor'       // Etage
  | 'bay'         // Travee (section verticale)
  | 'window'      // Fenetre
  | 'door'        // Porte
  | 'ornament'    // Decoration
  | 'buttress'    // Contrefort
  | 'spire'       // Fleche/pinacle
  | 'dome'        // Coupole
  | 'arch'        // Arc
  | 'column';     // Colonne

interface Block {
  type: BlockType;
  bounds: Rectangle;
  children: Block[];
  params: BlockParams;
  depth: number;      // Profondeur dans l'arbre
  symmetryId?: number; // Pour synchroniser les blocs symetriques
}
```

### Regles de Subdivision

```typescript
interface Rule {
  from: BlockType;
  to: BlockType[] | ((block: Block, rng: RNG, style: Style) => Block[]);
  weight: number;
  conditions?: (block: Block, style: Style) => boolean;
}

// Exemple: Corps → Base + Etages + Couronnement
const bodyRule: Rule = {
  from: 'body',
  to: (block, rng, style) => {
    const baseRatio = style.proportions.baseHeight;
    const crownRatio = style.proportions.crownHeight;
    // Subdivision verticale...
    return [baseBlock, floorsBlock, crownBlock];
  },
  weight: 1.0
};
```

### Execution

1. Partir d'un bloc `building` (tout le canvas)
2. Appliquer les regles recursively jusqu'a `maxDepth`
3. A chaque niveau, choisir une regle selon son poids et les conditions
4. Respecter la symetrie axiale (cloner les operations gauche→droite)

## Styles (Presets)

Chaque style definit:
- **Silhouette**: Forme generale (setbacks, tours, domes)
- **Proportions**: Ratios golden/fibonacci, hauteur base/crown
- **Angles**: Droits, biseautes, arrondis, pointus
- **Ornements**: Types, densite, placement
- **Fenetres**: Forme, grille, repetition

### Presets

| Style | Silhouette | Caracteristiques |
|-------|-----------|------------------|
| **Gothic** | Tours elancees, fleches | Arcs ogives, rosaces, contreforts |
| **Art Deco** | Setbacks pyramidaux | Biseaux, motifs geometriques, sunbursts |
| **Brutalist** | Blocs massifs | Angles droits, repetition, beton brut |
| **Baroque** | Courbes, domes | Volutes, ornements riches, colonnes |
| **SciFi** | Asymetrique, futuriste | Angles extremes, antennes, lumiere |
| **Ruin** | Degrade, incomplet | Elements manquants, vegetation |

### Morphing

Un slider `styleBlend` permet de mixer deux styles:
```typescript
function blendStyles(styleA: Style, styleB: Style, t: number): Style {
  // Interpolation de tous les parametres numeriques
  // Selection probabiliste pour les enums
}
```

## Hierarchie GUI (Tweakpane)

### Niveau 1: Essentiel (toujours visible)
```
[Style] ◄────────────────────────► [Art Deco ▼]
[Character] ◄━━━━━●━━━━━━━━━━━━━━► [Imposant]
[Seed] [1234] [🎲]
[Regenerate]
```

### Niveau 2: Composition (folder)
```
▼ Composition
  [Silhouette] ◄──●────────────► [Stepped]
  [Symmetry] [Strict ▼]
  [Towers] ◄●─────────────────► [0]
  [Wings] [✓]
```

### Niveau 3: Proportions (folder)
```
▼ Proportions
  [Aspect Ratio] ◄───────●─────► [1.5]
  [Base Height %] ◄──────●─────► [15%]
  [Crown Height %] ◄─────●─────► [20%]
  [Golden Ratio] [✓]
```

### Niveau 4: Details (folder)
```
▼ Details
  [Window Density] ◄─────●─────►
  [Ornament Level] ◄●──────────►
  [Chamfer Amount] ◄─────●─────►
```

### Niveau 5: Rendering (folder)
```
▼ Rendering
  [Stroke Width] ◄──●──────────►
  [Hatching] [Enabled ▼]
  [Hatch Density] ◄────●───────►
  [Shadow Side] [Left ▼]
```

### Niveau 6: Expert (folder collapsed)
```
▶ Expert
  [Max Depth] [5]
  [Min Block Size] [10px]
  [Rule Weights...]
```

## Parametres Haut Niveau

### "Character" Slider
Un seul slider qui influence **15+ parametres** pour creer des "personnalites":

| Value | Name | Effects |
|-------|------|---------|
| 0.0 | Humble | Bas, large, peu d'ornements, angles droits |
| 0.25 | Elegant | Proportions classiques, details raffines |
| 0.5 | Balanced | Mix equilibre |
| 0.75 | Imposant | Haut, tours, ornements riches |
| 1.0 | Monumental | Tres haut, multiple tours, maximum details |

### Style Presets avec Variations
Chaque preset a des "sous-presets":
- Art Deco: Empire State / Chrysler / Generic
- Gothic: Notre-Dame / Westminster / Cologne
- etc.

## Rendu

### Fusion des Lignes
Critique pour le plotter: **ne pas dessiner les lignes internes**.

```typescript
function renderBlock(block: Block, ctx: RenderContext) {
  // Ne dessiner que les edges qui touchent l'exterieur
  // ou qui separent des zones de traitement different

  const edges = getExternalEdges(block);
  for (const edge of edges) {
    if (!isSharedWithParent(edge, block)) {
      ctx.drawEdge(edge);
    }
  }
}
```

### Biseautage (Chamfer)
Applique uniquement au rendu, pas a la structure:

```typescript
function chamferCorners(rect: Rectangle, amount: number, corners: Corner[]): Path {
  // Coupe les coins specifies
  // corners: ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']
}
```

### Hachures pour Ombres
```typescript
function hatchArea(bounds: Rectangle, angle: number, spacing: number): Path[] {
  // Lignes paralleles pour simuler l'ombre
  // Cote gauche = ombre (lignes denses)
  // Cote droit = lumiere (pas de lignes)
}
```

## Symetrie

### Modes
- **Strict**: Parfaitement identique gauche/droite
- **Structural**: Structure symetrique, details varies
- **Imperfect**: 90% symetrique, quelques differences
- **None**: Pas de contrainte

### Implementation
```typescript
class SymmetryManager {
  mode: SymmetryMode;
  centerX: number;

  mirror(block: Block): Block {
    // Clone le bloc de l'autre cote de l'axe
  }

  shouldMirrorDetails(): boolean {
    // Selon le mode, les details suivent ou non
  }
}
```

## Skyline Mode

Option pour generer **plusieurs batiments** en ligne:

```typescript
interface SkylineParams {
  buildingCount: number;     // 3-7
  envelope: 'peak' | 'valley' | 'random' | 'ascending';
  depthLayers: number;       // 1-3 (avant-plan, milieu, arriere-plan)
  styleVariation: number;    // 0 = identique, 1 = tres varie
}
```

## Export

### SVG Optimise Plotter
- Paths merged quand possible
- Pas de fills (strokes only)
- Ordre des paths pour minimiser les levees de plume
- Metadata: seed, params, date

## Phases d'Implementation

### Phase 1: Core Engine
1. Types et interfaces
2. Moteur de grammaire basique
3. Rendu simple (rectangles)
4. GUI minimale

### Phase 2: Styles
1. 3 presets (Art Deco, Gothic, Brutalist)
2. Parametres de style
3. Morphing basique

### Phase 3: Details
1. Fenetres et portes
2. Ornements basiques
3. Biseautage

### Phase 4: Polish
1. Hachures
2. Skyline mode
3. Tous les presets
4. Export optimise

## Questions Ouvertes

1. **Integration MixDraw**: Garder standalone ou integrer comme generator?
   → Recommandation: Standalone d'abord, puis port si succes

2. **Complexite grammaire**: Jusqu'ou aller dans les regles?
   → Commencer simple, iterer

3. **Performance**: Combien de blocs max?
   → Target: 1000+ blocs, rendu < 100ms
