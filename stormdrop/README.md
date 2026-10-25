# Stormdrop

A battle royale with building that runs in the browser. You drop from a battle bus onto a generated island, loot, gather materials, build and edit, and outlast up to 99 bots while the storm closes in. It is a single HTML file with no image or audio files. Everything is generated in code.

Open `index.html` in a browser to play. It loads three.js from cdnjs, so you need an internet connection.

## What's in it

**Modes**
- Solo, Duos and Squads. In team modes your AI teammates follow you, answer your pings, share targets and revive you. Players are knocked before they are eliminated, and a team is out once all of its members are down.
- Team Rumble: three teams, respawns, and the first team to the target score wins.
- Creative: unlimited materials, every weapon, and target dummies.
- Mutators: low gravity, snipers only, explosives only, and high-rarity loot.

**The island**
- A new island each match. It scales with the lobby size, up to 1.45× for 99 bots.
- Grassland, snow and desert biomes.
- Named places: a city, docks, towns, a farm and a quarry, plus a ski lodge, a desert outpost, a factory, a lighthouse and a guarded vault with a boss.
- Ziplines, launch pads, drivable quads and forageable food.
- Different times of day and weather each match (clear, overcast or rain), snowfall in the snow biome, and wind moving the grass, trees and clouds.

**Fighting and building**
- 12 weapons in six rarities, up to Mythic. They include burst and tactical rifles, a hand cannon, a minigun with spin-up, a heavy sniper and the boss's Mythic rifle.
- Consumables and gadgets: bandages, med kits, shields, a heal-over-time drink, grenades, launch pads, an instant fort and a campfire.
- Building with walls, floors, ramps and cones, in wood, stone or metal. Unsupported pieces collapse.
- Editing on a 3×3 grid of tiles, so you can cut doors, windows and arches into your own walls.
- Movement includes crouching, slope-aware sliding, mantling onto ledges, sprinting and gliding.

**Bots**
- Navigation uses A* pathfinding on a 1 m grid.
- Each bot has a personality. Bots hear gunfire and footsteps, use cover, and respond to damage by building ramps and walls.
- They also throw grenades, take launch pads out of the storm and emote after kills.
- Bots far from you think less often, so 99 of them stay cheap to run.

**Look and sound**
- Physically based lighting with image-based lighting, bloom, ACES tone mapping, color grading, soft shadows and dynamic resolution.
- Four quality presets.
- Animated characters:
  - Inverse kinematics keeps hands on the weapon.
  - Layered locomotion, 12 emotes, capes, gliders and contrails.
  - A dissolve effect plays when a player is eliminated.
- Effects: muzzle flashes with lights, shell casings, bullet holes, explosions, smoke, and building pieces that pop in and break into chunks.
- 3D sound uses HRTF panning, reverb and occlusion. Weapon sounds are layered, and footsteps change with the surface.
- Ambient sound, procedural music that follows the action, and a spoken announcer.

**Progression**
- XP and levels, a 50-tier pass with unlockable outfits, gliders, trails and emotes, and daily and weekly challenges.
- A locker with outfit color customization and a 3D lobby.
- Career stats, a post-match XP breakdown, and a leaderboard. The leaderboard works only when the game runs as a claude.ai artifact.
- Progress is saved in the browser.

**Interface**
- Minimap and full map, compass, kill feed, stacked damage numbers and hit markers.
- A Tab inventory where you can swap and drop items.
- Pings with middle click, and spectating after you're eliminated.
- Touch controls on phones, with buttons for crouch, edit, ping and inventory.

## Controls (keyboard and mouse)

| Key | Action |
| --- | --- |
| WASD | Move |
| Shift | Sprint |
| Space | Jump, leave the bus, open the glider |
| C | Crouch. Press while sprinting to slide |
| Left click | Fire, or place a build piece |
| Right click | Aim. In build mode, swap material |
| Middle click | Ping |
| 1–5 / mouse wheel | Inventory slots |
| F | Pickaxe |
| E | Interact: loot, open chests, revive, drive, ride ziplines, eat |
| R | Reload. In build mode, rotate the piece |
| Q | Toggle build mode |
| Z / X / V / B | Wall / floor / ramp / cone |
| G | Edit the wall you're looking at. Press again to confirm |
| T | Emote |
| Tab or I | Inventory |
| M | Map |
| Esc | Pause |

## Editing the code

The source is split into parts in `src/`: the HTML and CSS shell, then the JavaScript files in sorted order. They are concatenated into one script. After changing anything in `src/`, rebuild the page:

```
python3 build.py
```
