# Car Racing Game

## Current State
New project with no existing frontend or backend logic.

## Requested Changes (Diff)

### Add
- 2D top-down car racing game rendered on HTML Canvas
- Player car controlled with arrow keys or WASD
- Scrolling road/track with lane markings
- AI opponent cars (obstacles) moving at varying speeds
- Collision detection between player and opponents
- Speed/score system: score increases the longer you survive
- Difficulty progression: cars spawn faster and move faster over time
- Game states: Start screen, Playing, Game Over
- Visual: road, lane lines, player car, opponent cars, HUD (score, speed)
- Leaderboard stored in backend (top 10 high scores with player name)

### Modify
- N/A

### Remove
- N/A

## Implementation Plan
1. Generate Motoko backend with high score storage (store name + score, query top 10)
2. Build Canvas-based game loop with requestAnimationFrame
3. Implement scrolling road with dashed lane markings
4. Player car with acceleration, steering, and boundary clamping
5. Opponent car spawning system with increasing difficulty
6. Collision detection (AABB)
7. Score/speed HUD overlay
8. Start screen and Game Over screen with score submission
9. Fetch and display leaderboard on start/game over screens
