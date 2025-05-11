# Monster Lane Runner

3D endless runner game built with React Three Fiber, inspired by the classic obstacle avoidance gameplay.

## Game Concept

In Monster Lane Runner, you control an orange car that automatically moves forward through a pixelated environment. Two types of monsters appear on the sides of the road:

- **Yellow Monster**: When it opens its mouth with an "AAAAH" sound, you need to press DOWN ARROW to duck under a high middle obstacle.
- **White Monster**: When it opens its mouth with a "Ssshhh" sound, you need to press UP ARROW to jump through a gap between side pillars.

Your goal is to survive as long as possible by reacting correctly to the monster cues and successfully navigating the obstacles.

## Technical Stack

- React
- TypeScript
- Three.js
- React Three Fiber
- React Three Drei

## Installation

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build
```

## Controls

- **UP ARROW** or **W**: Jump
- **DOWN ARROW** or **S**: Duck
- **ESC**: Pause game

## Game Features

- Procedurally generated obstacles
- Monster cues to signal upcoming obstacles
- Sound effects for enhanced gameplay
- Score tracking
- Game over and restart functionality

## Future Improvements

- More detailed monster models and animations
- Varied wall patterns
- Power-ups
- Mobile touch controls
- High score leaderboard

## Credits

Developed as a demonstration of Three.js and React Three Fiber capabilities. 