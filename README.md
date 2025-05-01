# Zombie Blitz 3D

A fast-paced 3D first-person shooter game where you battle against waves of zombies. Built with React Three Fiber.

![Zombie Blitz 3D](https://github.com/fortunto2/zombie-blitz-3d/raw/main/public/assets/screenshot.png)

## Features

- 🧟 Wave-based zombie hordes with increasing difficulty
- 🔫 First-person shooter gameplay with weapon effects
- 🐕 Optional dog companion that helps you hunt zombies
- 🏛️ 3D arena with obstacles and strategic positions
- 🔊 Dynamic sound effects for an immersive experience
- 📊 Score tracking and health system
- 🎮 Full keyboard and mouse controls

## Installation

### Prerequisites

- Node.js (v14 or newer)
- pnpm (recommended) or npm

### Setup

1. Clone the repository:
```bash
git clone https://github.com/fortunto2/zombie-blitz-3d.git
cd zombie-blitz-3d
```

2. Install dependencies:
```bash
pnpm install
# or with npm
npm install
```

3. Start the development server:
```bash
pnpm dev
# or with npm
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Game Controls

- **WASD** - Move around
- **Mouse** - Look around
- **Left Click** - Shoot
- **ESC** - Pause game

## Technical Information

### Built With

- [React](https://reactjs.org/) - UI Library
- [React Three Fiber](https://github.com/pmndrs/react-three-fiber) - React renderer for Three.js
- [Three.js](https://threejs.org/) - JavaScript 3D library
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Vite](https://vitejs.dev/) - Frontend build tool

### Project Structure

- `src/components/` - Game components (Player, Zombies, Arena, etc.)
- `src/hooks/` - Custom React hooks
- `src/models/` - 3D model components
- `src/engine/` - Game engine functionality
- `src/utils/` - Utility functions
- `public/assets/` - Game assets (sounds, images, etc.)

## Performance Optimizations

The game includes several performance optimizations:

- Efficient zombie spawning system with visual warnings
- Collision detection optimizations
- State batching to prevent React rendering issues
- Level of detail adjustments for distant objects
- Custom shaders for visual effects

## License

MIT License - See the LICENSE file for details.

## Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/fortunto2/zombie-blitz-3d/issues).

## Known Issues

- In fullscreen mode, high CPU usage might occur in some browsers
- Certain key combinations can cause input conflicts 