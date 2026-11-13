---
name: Pokédex App
description: An offline Pokédex read like airport wayfinding - yellow sign bands, black panel signs, big numbers.
world: "wayfinding-cartography-signage-terminal-yellow-wayfinding"
colors:
  sign-yellow: "#FFCC00"
  sign-black: "#0B0B0B"
  panel-frame: "#1A1A1A"
  sign-white: "#FFFFFF"
  panel-grey: "#A3A3A3"
  ground-element: "#F0F0F0"
  hairline: "#E6E6E6"
  ink-secondary: "#5C5C5C"
  hairline-dark: "#262626"
  bar-grey: "#8A8A8A"
  type-normal: "#6E6E55"
  type-fire: "#C2410C"
  type-water: "#1D63C7"
  type-electric: "#FFD23F"
  type-grass: "#2F7D32"
  type-ice: "#7FD3DD"
  type-fighting: "#A8262E"
  type-poison: "#8236A6"
  type-ground: "#C9A15A"
  type-flying: "#5470C6"
  type-psychic: "#C8296B"
  type-bug: "#6B7A12"
  type-rock: "#8A7529"
  type-ghost: "#5B4485"
  type-dragon: "#4B33C9"
  type-dark: "#4A3B32"
  type-steel: "#5E7A8A"
  type-fairy: "#F2A7CF"
typography:
  display-number:
    fontFamily: "Atkinson Hyperlegible Next"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: "48px"
    letterSpacing: "-1px"
    fontFeature: "tnum"
  row-number:
    fontFamily: "Atkinson Hyperlegible Next"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: "32px"
    letterSpacing: "-0.5px"
    fontFeature: "tnum"
  headline:
    fontFamily: "Atkinson Hyperlegible Next"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: "34px"
  title:
    fontFamily: "Atkinson Hyperlegible Next"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: "26px"
  name:
    fontFamily: "Atkinson Hyperlegible Next"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: "24px"
  sign:
    fontFamily: "Atkinson Hyperlegible Next"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: "22px"
  strong:
    fontFamily: "Atkinson Hyperlegible Next"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: "24px"
  entry:
    fontFamily: "Atkinson Hyperlegible Next"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "26px"
  body:
    fontFamily: "Atkinson Hyperlegible Next"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "22px"
  label:
    fontFamily: "Atkinson Hyperlegible Next"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
    fontFeature: "tnum"
  chip-label:
    fontFamily: "Atkinson Hyperlegible Next"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: "18px"
  badge:
    fontFamily: "Atkinson Hyperlegible Next"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: "16px"
    letterSpacing: "0.3px"
rounded:
  none: "0px"
  badge: "4px"
  chip: "8px"
spacing:
  half: "2px"
  one: "4px"
  two: "8px"
  three: "16px"
  four: "24px"
  five: "32px"
components:
  search-band:
    backgroundColor: "{colors.sign-yellow}"
    textColor: "{colors.sign-black}"
    typography: "{typography.headline}"
    padding: "8px 16px 16px"
  search-field:
    backgroundColor: "{colors.sign-black}"
    textColor: "{colors.sign-white}"
    rounded: "{rounded.none}"
    height: "52px"
    padding: "0 0 0 16px"
  gate-sign:
    backgroundColor: "{colors.sign-black}"
    textColor: "{colors.sign-yellow}"
    typography: "{typography.sign}"
    rounded: "{rounded.none}"
    height: "44px"
    padding: "0 16px"
  gate-sign-dark:
    backgroundColor: "{colors.panel-frame}"
    textColor: "{colors.sign-yellow}"
  section-sign:
    backgroundColor: "{colors.sign-black}"
    textColor: "{colors.sign-yellow}"
    typography: "{typography.sign}"
    rounded: "{rounded.none}"
    height: "44px"
    padding: "8px 16px"
  section-sign-dark:
    backgroundColor: "{colors.panel-frame}"
    textColor: "{colors.sign-yellow}"
  dex-row:
    backgroundColor: "{colors.sign-white}"
    textColor: "{colors.sign-black}"
    typography: "{typography.row-number}"
    height: "72px"
    padding: "0 16px"
  dex-row-pressed:
    backgroundColor: "{colors.ground-element}"
  type-badge:
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "2px 8px"
  type-badge-electric:
    backgroundColor: "{colors.type-electric}"
    textColor: "{colors.sign-black}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "2px 8px"
  form-chip:
    textColor: "{colors.sign-black}"
    typography: "{typography.chip-label}"
    rounded: "{rounded.chip}"
    height: "40px"
    padding: "0 16px"
  form-chip-selected:
    backgroundColor: "{colors.sign-black}"
    textColor: "{colors.sign-white}"
    rounded: "{rounded.chip}"
  game-chip-selected:
    backgroundColor: "{colors.sign-yellow}"
    textColor: "{colors.sign-black}"
    typography: "{typography.chip-label}"
    rounded: "{rounded.chip}"
    height: "40px"
    padding: "0 16px"
  app-bar:
    backgroundColor: "{colors.sign-yellow}"
    textColor: "{colors.sign-black}"
    typography: "{typography.title}"
    height: "56px"
  nav-bar:
    backgroundColor: "{colors.sign-black}"
    textColor: "{colors.panel-grey}"
  nav-bar-dark:
    backgroundColor: "{colors.panel-frame}"
    textColor: "{colors.panel-grey}"
  nav-indicator:
    backgroundColor: "{colors.sign-yellow}"
    textColor: "{colors.sign-black}"
---

# Design System: Pokédex App

## Overview

**Creative North Star: "Terminal Signs"**

The app is read the way an airport is read: a traveller with their hands full looks up, finds the yellow sign, reads the big number and keeps walking. Every screen carries one signal-yellow sign band at the top (the search band on the National Dex, the identity band on a Pokémon's page). Below it, square black panel signs with yellow lettering mark every section and stick to the top while you scroll, so you always know which gate you are at: which generation among 1,025 Pokémon, or which part of a Pokémon's page.

Density is that of a departures board, not a magazine: full-bleed bands and panels, white (or sign-black) ground, hairline rules between rows, and numbers set big and extra-bold with tabular figures. Atkinson Hyperlegible Next is the single humanist signage face in four weights. The only hues outside yellow, black and grey are the 18 type colors, and every one of them always carries its type's name.

The world was chosen by the user over the category default it replaces: a grey Material list with colored type chips.

**Key Characteristics:**
- One yellow sign band per screen, under the status bar, holding the screen's identity.
- Square, full-width black panel signs with yellow titles head every list section and stay pinned.
- Big extra-bold dex numbers with tabular figures and slashed zeros.
- Flat: no shadows, no cards; depth comes from yellow against black against white.
- Pictograms are Material Symbols drawn in the sign's own ink.
- Built for one-handed, interrupted use and system font scaling up to 2.0.

## Colors

Signal yellow and sign black do all the identity work; greys carry hierarchy; the 18 type colors are data, not decoration.

### Primary
- **Signal Yellow** (sign-yellow): The sign band (search band, identity band, Pokémon app bar), the active navigation indicator, the selected game chip, the cursor and selection color in the search field, the titles on panel signs, and the highest stat bar in dark mode. The same in light and dark.
- **Sign Black** (sign-black): Ink on the yellow band, the search field set into the band, panel signs and the navigation bar in light mode, the selected form chip, the ground in dark mode, and the highest stat bar in light mode.

### Neutral
- **Panel Frame** (panel-frame): Panel signs and the navigation bar in dark mode, and raised element backgrounds in dark mode, so a sign keeps its edge against the sign-black ground.
- **Sign White** (sign-white): The light-mode ground, primary text in dark mode, and text and pictograms on panels and in the search field.
- **Panel Grey** (panel-grey): Secondary text on panels (gate ranges, section details, inactive tab labels and icons), the search placeholder, and secondary text in dark mode.
- **Ink Secondary** (ink-secondary): Secondary text on the light ground (prose, group labels, stat names, levels) and the outline of the Hidden ability tag.
- **Ground Element** (ground-element): Stat bar tracks, pressed rows and the current evolution stage in light mode.
- **Hairline** (hairline): Row rules and the Android ripple in light mode.
- **Hairline Dark** (hairline-dark): Row rules and the ripple in dark mode.
- **Bar Grey** (bar-grey): Every stat bar except the highest, in both modes.

### Type colors
Eighteen fills (type-normal through type-fairy), each paired with a white or sign-black label that passes WCAG AA (4.5:1). Light fills (Electric, Ice, Ground, Fairy) take sign-black labels; the rest take white. An unknown type falls back to ink-secondary with a white label.

### Named Rules
**The Panel Edge Rule.** Panels are sign black in light mode and panel frame in dark mode, never the ground color. A sign that disappears into the ground is not a sign.

**The Named Type Rule.** A type is never shown by color alone. Every type badge prints the type's name, and matchup badges add the multiplier ("×2", "×½").

**The Yellow Is Signage Rule.** Signal yellow marks where you are and what is selected: the sign band, the active tab, the selected game, panel titles, the top stat. It is never a fill for content or a decorative accent.

## Typography

**Display Font:** Atkinson Hyperlegible Next (falls back to the system face only if loading fails)

**Character:** A humanist face designed for legibility, set heavy and tight for numbers and names, regular for prose. It reads at arm's length, like a sign.

### Hierarchy
- **Display number** (800, 44/48, -1 tracking, tabular): The dex number in the identity band.
- **Headline** (800, 28/34): The "National Dex" title (with -0.3 tracking) and the Pokémon's name in the identity band.
- **Row number** (800, 26/32, -0.5 tracking, tabular): The dex number in each National Dex row.
- **Title** (800, 20/26): The number and name in the Pokémon app bar once the identity band scrolls away. Notice titles use the same size at 700.
- **Name** (700, 18/24): The Pokémon's name in a Dex row.
- **Sign** (800, 17/22): Panel sign titles and the "Gen I" numeral; also stat values and move levels (tabular).
- **Strong** (700, 17/24): Ability, move, evolution stage and game names inside sections.
- **Entry** (400, 17/26): The Pokédex flavor text.
- **Body** (400, 15/22): Ability effects, locations, quiet notes. Notice bodies use 16/24.
- **Label** (500, 14/20, tabular): Sign details (ranges, "Total 320", match counts), levels, stage numbers. Region names on gate signs use 700 at 17/22; the count and genus on the band use 500 at 15/20.
- **Chip label** (700, 14/18): Form and game chips, the More button.
- **Badge** (700, 12/16, +0.3 tracking): Type badge and tag labels.

### Named Rules
**The Per-Weight Family Rule.** Atkinson Hyperlegible Next is loaded per weight (400, 500, 700, 800), each from its own import path, and each weight is named as its own font family. Set weight by choosing the family, never with `fontWeight` on Android, and never import the package root (it bundles all 14 files).

**The Big Number Rule.** Dex numbers are four digits, extra-bold, with tabular figures, and capped at a 1.3 font-size multiplier. The number is already display size, so it stops growing before the name does; the row's number column widens with it (72 × scale, up to 1.3).

**The Wrap First Rule.** At large font scales text wraps onto another line rather than truncating. Sign details drop to their own line, and bands and sections grow. The one exception is the range on a Dex gate sign, which gives way first when the numeral and region need the room.

## Layout

Single column, full bleed. Bands, panel signs and rows run edge to edge; content inside them sits on a 16dp side gutter (spacing three). Spacing steps are 2, 4, 8, 16, 24 and 32dp: 4 between badges, 8 between items in a row, 16 inside bands and section bodies, 24 below a section body.

The National Dex list uses fixed heights so scrolling and jumping stay cheap, and the heights grow with the system font scale: rows are max(72, 40 × scale + 28)dp and gate signs max(44, 22 × scale + 22)dp. Detail sections size to content: section signs are at least 44dp, move rows 56dp, evolution stages 64dp, stat rows 28dp.

**The Sticky Sign Rule.** Every list section is headed by a panel sign that sticks to the top of the scroll and is replaced by the next one. On the Dex the signs are generation gates; while searching, only generations with matches get a sign, and the sign shows the match count instead of the range. On a Pokémon's page the signs are Type matchups, Abilities, Base stats, Evolution, Where to find, Moves and Pokédex entry.

**The Thumb Target Rule.** Every touch target is at least 48dp, using hit slop where the visible shape is smaller: 40dp chips get 4dp above and below, the search clear button is 48dp, Back is 56dp, and rows are 56dp or taller.

The status bar sits on the yellow band in both modes and always uses dark icons. The bottom navigation bar reserves its inset (80dp on Android) at the end of every scroll.

## Elevation & Depth

The system is flat. There are no shadows and no elevation anywhere; depth is the contrast between the yellow band, the black panels and the ground, and the sticky signs do the layering by covering rows as they scroll under. Pressed states use a tonal change (ground element under a ripple, or 0.6 opacity on icons and outline buttons), not lift.

**The No Lift Rule.** Nothing casts a shadow. A surface separates from the ground by tone and edge, never by elevation.

## Shapes

Signs are square: bands, panels, the search field and the navigation bar have no radius. Small information marks have a slight radius: type badges and the Hidden ability tag at 4dp. Pressable chips (forms, games, More) are 8dp with a 2dp border. Rows are separated by hairline rules, never by boxes. Artwork sits on the band without a frame (140dp on the identity band, 56dp sprites in rows, 48dp in evolution stages).

**The Square Sign Rule.** Anything that acts as signage (a band, a panel, a field set into a band) has square corners. Radius belongs only to marks and controls.

## Components

### Sign band (search band, identity band, app bar)
The yellow band that names the screen. It runs under the status bar and holds the title in headline weight with sign-black ink. On the Dex it holds "National Dex", the count ("1,025 Pokémon", or "12 of 1,025" while searching) and the search field. On a Pokémon's page a fixed 56dp yellow app bar holds Back and, once the identity band scrolls away, the number and name. The identity band below it holds the number, name, genus, type badges, artwork and form chips.

### Search field
A square sign-black field set into the yellow band, at least 52dp tall, with a white 24dp search pictogram, white medium 17dp input text, a panel-grey placeholder ("Name, number or type") and a yellow cursor. A 48dp clear button appears while there is a query.

### Panel signs (gate sign, section sign)
Full-width square panels in sign black (light) or panel frame (dark). The title is extra-bold signal yellow; the detail sits right-aligned in panel-grey label type. Gate signs show "Gen I" in yellow, the region in white bold, then the range "0001–0151" or "N found". Section signs wrap their detail onto its own line at large text sizes. Both are accessibility headers.

### Dex row
A 72dp row on the ground: the extra-bold row number, a 56dp sprite, then the name over its type badges. A hairline rule below; pressed shows ground element under the ripple. The whole row opens the Pokémon's page and is labelled "Number 25, Pikachu, Electric type".

### Type badge
- **Style:** The type's fill with its AA label, 4dp radius, 2/8dp padding, badge type. It always prints the name, plus an optional multiplier suffix in matchups.
- **On the yellow band:** A 1dp sign-black outline, so yellow-ish types (Electric) keep their edge against the band.

**The Band Outline Rule.** A type badge placed on the yellow band gets a 1dp sign-black border. Off the band, badges have no border.

### Chips
- **Form chips** (identity band): 2dp sign-black border, sign-black label; selected fills sign black with a white label.
- **Game chips** (Moves): 2dp ink-secondary border, text-colored label; selected fills signal yellow with a sign-black label and border.
- **More button:** an outline control with a 2dp text-colored border and an 8dp radius, 0.6 opacity when pressed.
- **Tag:** Hidden ability uses a 1dp ink-secondary border, a 4dp radius and badge type.

### Stat bars
10dp square bars on a ground-element track. The highest stat uses the bar highlight (sign black in light, signal yellow in dark); the rest use bar grey. The value sits left of the bar in sign type with tabular figures.

### Navigation
Native bottom tabs inside a sign panel: sign black in light mode and panel frame in dark mode, with a signal-yellow active indicator. The selected icon is sign black on the yellow pill with a white label; inactive icons and labels are panel grey. Pictograms are Material Symbols.

## Do's and Don'ts

### Do:
- **Do** give every screen one signal-yellow sign band at the top, with sign-black ink and the screen's title in 800-weight Atkinson Hyperlegible Next.
- **Do** head every list section with a square panel sign that sticks to the top of the scroll.
- **Do** use sign black (#0B0B0B) for panels in light mode and panel frame (#1A1A1A) in dark mode.
- **Do** print the type's name on every type badge, using its AA-checked pair from the type colors.
- **Do** outline type badges on the yellow band with 1dp sign black.
- **Do** set dex numbers four-digit, extra-bold and tabular, with `maxFontSizeMultiplier` 1.3.
- **Do** keep every touch target at 48dp or more, with hit slop where the visible control is smaller.
- **Do** let text wrap at large font scales and let bands, signs and rows grow; only the Dex gate range gives way first.
- **Do** load each Atkinson Hyperlegible Next weight from its own path and select weight by family.
- **Do** draw pictograms with Material Symbols in the ink of the surface they sit on.

### Don't:
- **Don't** show a type, category or stat by color alone.
- **Don't** set a panel sign in the ground color, or round its corners.
- **Don't** add shadows or elevation; separate surfaces by tone and edge.
- **Don't** use signal yellow as a content fill or decoration; it marks place and selection only.
- **Don't** add hues beyond yellow, black, the greys and the 18 type colors.
- **Don't** use `fontWeight` to pick an Atkinson weight on Android, or import the font package root.
- **Don't** truncate names, details or labels at large font scale when they can wrap.
