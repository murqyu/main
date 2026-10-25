# Stormdrop

A solo battle royale with building that runs in the browser. You jump from a dropship onto an island, loot chests, gather materials with a pickaxe, build cover, and outlast up to 49 bots while a storm shrinks the play area.

Open `index.html` in a browser to play. It loads three.js from cdnjs, so you need an internet connection.

## What's in it

- An island generated fresh each match, with eight named places: a city, docks, three towns, a farm, a quarry and a cabin area. Each has buildings you can enter and destroy.
- A dropship flight, skydiving and gliding. Look down to dive faster.
- Building on a 5-unit grid: walls, floors, ramps and cones in wood, stone or metal. Pieces build up their health over time, and anything left without support collapses.
- Harvesting trees, rocks, cars and walls with the pickaxe. Hitting the glowing weak spot gives double materials.
- Six weapons (assault rifle, SMG, pump shotgun, pistol, bolt sniper with scope, rocket launcher), each in five rarities, plus bandages, med kits and shields.
- A seven-phase storm and two supply drops with Epic and Legendary loot.
- Bots that loot, rotate with the storm, strafe, build walls and ramps when hit, box up to heal, and break through walls when stuck.
- A HUD with minimap, full map, compass, kill feed, damage numbers, hit markers and damage-direction arcs. After you're eliminated you can spectate the bot that beat you.
- Sound effects generated with WebAudio, with no audio files.
- Touch controls on phones: a virtual stick, drag to look, and a fire button you can drag.

## Controls (keyboard and mouse)

| Key | Action |
| --- | --- |
| WASD | Move |
| Shift | Sprint |
| Space | Jump, leave the dropship, open the glider |
| Left click | Fire or place a build piece |
| Right click | Aim, or swap material in build mode |
| 1–5 / mouse wheel | Inventory slots |
| F | Pickaxe |
| E | Open a chest or pick up an item |
| R | Reload, or rotate a ramp in build mode |
| Q | Toggle build mode |
| Z / X / C / V | Wall / floor / ramp / cone |
| M | Map |
| Esc | Pause |

## Editing

The game source is split into parts in `src/`: the HTML and CSS shell, then the JavaScript files in numbered order. After changing anything in `src/`, rebuild the page:

```
python3 build.py
```
