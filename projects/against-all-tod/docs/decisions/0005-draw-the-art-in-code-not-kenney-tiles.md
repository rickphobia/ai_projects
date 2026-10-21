# Draw the art in code, not with Kenney tiles

The first look used Kenney's Tower Defense (top-down) tiles. Every Dude kind shared one small grey soldier sprite on an orange disc, so kinds couldn't be told apart, and the pack had nothing that fitted most Pieces (Siren, Tax Booth, Bouncer, The HR Department). For the art pass we draw everything on the Board in code with PixiJS shapes instead: wobbly, faced Dudes in the style of Totally Accurate Battle Simulator, and a bright, clean Board and Pieces in the style of Bloons TD 6. Each shape is drawn once at load into a texture and reused as a sprite, so 500 Dudes still batch. Shapes in code can be made for any new kind, animated freely, and recoloured for the Brightness trick, and they need no asset licence. This replaces the spec's "One art pack" rule. The Kenney sounds stay.

**Trade-offs:** each new Dude kind or Piece now needs drawing code rather than picking a tile, and the art is only as good as that code; the textures are built at load, which adds a little to start-up time.

**Considered Options:** using the Kenney packs better (more of their sprites, softer palette): cheapest, but their soldiers are too small and dark to tell 500 apart on a phone; another Kenney cartoon pack: still no fit for most Pieces; commissioned or generated art: hard to source and keep consistent.
