# Asset credits

Every file in `assets/` is listed here with its author, licence and where it came from. All are CC0 (public domain), so crediting is not required, but we do it anyway. Add a row before adding an asset; only CC0 assets go in this folder.

| File | What it is in the game | Original | Author | Licence | Link |
|---|---|---|---|---|---|
| `kenney-nature-kit/crops_leafsStageA.glb` | Cotton seedling | Nature Kit 2.1, `crops_leafsStageA` | Kenney | CC0 1.0 | https://kenney.nl/assets/nature-kit |
| `kenney-nature-kit/crops_leafsStageB.glb` | Flowering cotton plant (flowers added in code) | Nature Kit 2.1, `crops_leafsStageB` | Kenney | CC0 1.0 | https://kenney.nl/assets/nature-kit |
| `kenney-nature-kit/plant_bushDetailed.glb` | Cotton bush at the boll and ripe stages (bolls added in code) | Nature Kit 2.1, `plant_bushDetailed` | Kenney | CC0 1.0 | https://kenney.nl/assets/nature-kit |
| `kenney-nature-kit/fence_planks.glb` | The fence around the field | Nature Kit 2.1, `fence_planks` | Kenney | CC0 1.0 | https://kenney.nl/assets/nature-kit |
| `quaternius-modular-men/farmer.glb` | The Worker | Ultimate Modular Men, `Farmer` (copy taken from the CC0 redistribution in github.com/LuanDucate/Ducz.CharacterCreator, `public/models/Male/Farmer.glb`) | Quaternius | CC0 1.0 | https://quaternius.com/packs/ultimatemodularcharacters.html |
| `quaternius-modular-men/suit.glb` | The Overseer (suit recoloured to a drab uniform in code; the model's pistol is hidden) | Ultimate Modular Men, `Suit` (copy taken from the same CC0 redistribution, `public/models/Male/Suit.glb`) | Quaternius | CC0 1.0 | https://quaternius.com/packs/ultimatemodularcharacters.html |
| `kenney-impact-sounds/footstep_grass_000.ogg`, `_001`, `_002` | The Worker's footsteps on the track | Impact Sounds 1.0, `footstep_grass_000` to `_002` | Kenney | CC0 1.0 | https://kenney.nl/assets/impact-sounds |
| `kenney-interface-sounds/tick_002.ogg` | The soft electric tick of a power tile lighting under the Worker's foot | Interface Sounds 1.0, `tick_002` | Kenney | CC0 1.0 | https://kenney.nl/assets/interface-sounds |
| `bigsoundbank/whistle.ogg` | The Overseer's whistle | "Whistle, plastic #4" (#1142), one blast cut from 0.93 s to 2.33 s, mono Ogg | Joseph Sardin (BigSoundBank) | CC0 1.0 | https://bigsoundbank.com/whistle-plastic-4-s1142.html |
| `bigsoundbank/whip_crack.ogg` | The Overseer's whip crack | "Whip crack 2" (#2950), cut from 0.2 s to 0.9 s with a fade out, mono Ogg | Joseph Sardin (BigSoundBank) | CC0 1.0 | https://bigsoundbank.com/whip-crack-2-s2950.html |
| `ggbotnet-first-time-writing/FirstTimeWriting.woff2` | The handwriting of the Children's letters | First Time Writing! 1.35, `FirstTimeWriting.woff2` (the copy named without the exclamation mark) | GGBotNet | CC0 1.0 | https://opengameart.org/content/first-time-writing-font |
| `polyhaven/dry_ground_01_diff_1k.jpg` | Dust on the ground and in the plots | `dry_ground_01`, diffuse, 1k JPG | Poly Haven (Rob Tuytel) | CC0 1.0 | https://polyhaven.com/a/dry_ground_01 |

The plant and fence colours are replaced in code (`src/adapters/field/`) with the field's muted palette; the Worker keeps the model's own colours. The model files are unchanged; the two BigSoundBank sounds were cut from the site's MP3s with ffmpeg as described. The Generator and its loudspeaker pole are simple shapes built in code (`src/adapters/field/generator.gd`), not an asset, and so are the power tiles and the lap line (`src/adapters/field/power_tiles.gd`). So is the Overseer's whip (`src/adapters/field/overseer_look.gd`), and the Generator's whine is a hum made in code (`src/adapters/audio/field_sounds.gd`).
