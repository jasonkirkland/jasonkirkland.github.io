# The Act of Bringing Creatures Back

A web-based, single-player game where you live as a real prehistoric creature,
survive, and learn true facts about it. Built with Three.js and **no build step**.

## How to play (on a computer)
1. Open a terminal in this folder.
2. Run: `node server.js`
3. Open **http://localhost:8123** in a browser.
4. Pick a dinosaur and press **Play**.

### Controls
- **Move:** W A S D (or arrow keys)
- **Run:** hold Shift
- **Eat / Drink / Dig up fossil:** E or Spacebar (when the prompt appears)
- **Turn the camera:** drag the mouse, or Q / R
- On a **phone or tablet**: use the on-screen joystick (left), **Run** and **Act**
  buttons (right), and drag the right side of the screen to turn the camera.
  Hold the phone **sideways (landscape)**.

## The goal
Survive by keeping your **hunger, thirst, stamina and health** up. Eating food
leaves behind bones. Drink at lakes and rivers. Dig up **fossils** to earn
**scales**, and spend scales in the menu to unlock new creatures. Every action
teaches you a real fact. When your dinosaur dies, you return to the menu to
choose and learn about another.

## How to add or change a dinosaur (the fun part!)
Open **`js/dinos.js`**. Each creature is one block of text in the `SPECIES` list.
Copy one, change the name, diet, biome, size, colors and facts, and it shows up
in the menu automatically. The comments at the top of that file explain every
field.

## Files
- `index.html` – the page and all the screens
- `css/style.css` – how everything looks
- `js/dinos.js` – **the dinosaur facts and data (edit this!)**
- `js/creature.js` – builds each dinosaur's 3D body from simple shapes
- `js/world.js` – the ground, water, plants, fossils and day/night
- `js/player.js` – your dinosaur: stats, movement, growing up, actions
- `js/input.js` – keyboard and touch controls
- `js/sound.js` – the dinosaur calls and sound effects
- `js/ui.js` – menus, bars, fact popups, saving your scales
- `js/main.js` – ties it all together and runs the game loop
- `server.js` – a tiny local web server for testing

## Ideas to add next
Nests and eggs, territories, weather, camouflage, more biomes per map,
group/herd companions, fall damage from cliffs, and swapping the simple shapes
for downloaded 3D models (`.glb` files) — see the note in `js/creature.js`.
