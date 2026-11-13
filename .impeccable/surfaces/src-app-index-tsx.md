---
version: 1
slug: "src-app-index-tsx"
primary_target: "src/app/index.tsx"
related_targets: []
---

# National Dex list

Scope: the National Dex tab (`src/app/index.tsx`), the app's first screen. Mode: Operate.
Task: find one Pokémon fast in the middle of a game, by name, number or type, then read its typing at a glance.
Constraints: offline (bundled SQLite), Android first, color-blind safe (types always named), system font scaling.

## Direction contract

THESIS: The Dex is a sign system you scan with your thumb. Each lookup works like airport wayfinding: one yellow sign band, numbers set big, and you always know which generation you're in. This rejects the category default of a grey Material list with colored type chips.

OWN-WORLD: Signal yellow #FFCC00 sign band with sign-black #0B0B0B type. Black panel signs with yellow lettering for the generation "gates". White ground (light) or sign black (dark), with hairline #E6E6E6 rules. Atkinson Hyperlegible Next is the humanist signage face. Material Symbols pictograms are drawn in the sign's ink. The 18 type colors are the only other hues, and each always carries its type name.

STORY: The player opens the app, and the search field is already in thumb reach at the top. They type "char", "25" or "fire" and the list narrows instantly. They read the big number, the name and the type badges, then put the phone down.

FIRST VIEWPORT: A yellow band under the status bar holds "National Dex", the count, and a full-width black search field. Below it, a black generation sign ("GEN I · Kanto" with the range "0001–0151") sticks to the top. Rows are 72dp: a big bold dex number, the sprite, then the name over its type badges. The bottom navigation bar is sign black with a yellow active indicator.

FORM: Terminal yellow wayfinding (a dealt challenger, chosen by the user over the assigned Town Map). seed:ad537f5b81d76aba

SIGNATURE: Sticky generation gate signs. The current generation's sign stays pinned and is replaced by the next one as you scroll, so you always know where you are among the 1,025 Pokémon. While searching, the signs only head the generations that have matches.
