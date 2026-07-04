# Block Dungeon Crawl

A small browser-based, blocky dungeon crawler inspired by voxel dungeon games. It uses original placeholder art drawn with Canvas and does not use Minecraft assets.

## How to run

The most reliable way is to serve the folder locally:

```bash
cd block_dungeon_crawl
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

You can also try opening `index.html` directly, but some browsers are stricter with joypad APIs on local files.

## Controls

### Joypad

- Left stick or D-pad: move
- A, X, or right trigger: attack
- B or right bumper: dash
- Start: pause / resume / restart from end screen

### Keyboard / mouse fallback

- WASD or arrow keys: move
- Space or left mouse click: attack
- Shift: dash
- Esc or P: pause

## Objective

1. Explore the dungeon.
2. Break crates and collect gems/potions.
3. Defeat the Gatekeeper boss.
4. Walk onto the green exit stairs.

## Files

- `index.html` - page layout
- `styles.css` - page and overlay styling
- `game.js` - game engine, dungeon generation, gamepad input, combat, UI
