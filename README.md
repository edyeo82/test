# Block Dungeon Crawl

A small browser-based, blocky dungeon crawler inspired by voxel dungeon games. It uses original placeholder art drawn with Canvas and does not use Minecraft assets.

The game has been placed in this repo under:

```text
block-dungeon-crawl/
```

## How to run locally

Clone this repo, then run:

```bash
cd test/block-dungeon-crawl
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

You can also try opening `block-dungeon-crawl/index.html` directly, but some browsers are stricter with joypad APIs on local files.

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

- `block-dungeon-crawl/index.html` - page layout
- `block-dungeon-crawl/styles.css` - page and overlay styling
- `block-dungeon-crawl/game.js` - game engine, dungeon generation, gamepad input, combat, UI
