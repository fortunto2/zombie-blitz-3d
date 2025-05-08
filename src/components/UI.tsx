import React from 'react';
import { Vector3 } from 'three';

interface UIProps {
  score: number;
  health: number;
  isGameOver: boolean;
  onRestart?: () => void;
  isPetEnabled?: boolean;
  playerPosition?: Vector3 | null;
  playerDirection?: Vector3 | null;
  zombiePositions?: { id: string; position: Vector3; isDying: boolean; direction?: Vector3 }[];
  petPosition?: Vector3 | null;
  petDirection?: Vector3 | null;
  zombiesKilled?: number;
  zombieCount?: number;
  kills?: number;
}

const UI: React.FC<UIProps> = ({ 
  score, 
  health, 
  isGameOver, 
  onRestart, 
  isPetEnabled,
  playerPosition,
  playerDirection,
  zombiePositions = [],
  petPosition,
  petDirection,
  zombiesKilled = 0,
  zombieCount = 0,
  kills = 0
}) => {
  // Calculate number of active zombies
  const activeZombiesCount = zombiePositions && zombiePositions.length > 0 
    ? zombiePositions.filter(z => !z.isDying).length 
    : zombieCount;
  const totalKills = zombiesKilled || kills;
  
  // Mini-map scale (arena size / mini-map size)
  const mapScale = 24 / 120; // 24 - arena size, 120 - mini-map size in pixels
  
  // Direction indicator length
  const directionLength = 10; // length of the direction "arrow"
  
  return (
    <div className="ui-container">
      <div className="crosshair" />
      
      {/* Zombie counters */}
      <div className="zombie-counters">
        <div className="active-zombies">Active Zombies: {activeZombiesCount}</div>
        <div className="killed-zombies">Zombies Killed: {totalKills}</div>
      </div>
      
      <div className="score">Score: {score}</div>
      <div className="health-bar">
        <div 
          className="health-bar-fill" 
          style={{ width: `${health}%` }} 
        />
      </div>
      
      {/* Mini-map with player always in center */}
      {playerPosition && (
        <div className="mini-map">
          {/* Player is always in center */}
          <div className="player-dot" style={{ left: '50%', top: '50%' }}>
            {playerDirection && (
              <div 
                className="direction-indicator player-direction"
                style={{ 
                  width: `${directionLength}px`, 
                  transform: `rotate(${Math.atan2(playerDirection.x, playerDirection.z)}rad)`
                }}
              />
            )}
          </div>
          
          {/* Zombies are displayed relative to player */}
          {zombiePositions && zombiePositions.map(zombie => (
            <div 
              key={zombie.id}
              className={`zombie-dot ${zombie.isDying ? 'dying' : ''}`}
              style={{ 
                left: `${50 + (zombie.position.x - playerPosition.x) / mapScale}px`, 
                top: `${50 + (zombie.position.z - playerPosition.z) / mapScale}px` 
              }}
            >
              {zombie.direction && (
                <div 
                  className="direction-indicator zombie-direction"
                  style={{ 
                    width: `${directionLength}px`, 
                    transform: `rotate(${Math.atan2(zombie.direction.x, zombie.direction.z)}rad)`
                  }}
                />
              )}
            </div>
          ))}
          
          {/* Dog is displayed relative to player */}
          {isPetEnabled && petPosition && (
            <div 
              className="pet-dot"
              style={{ 
                left: `${50 + (petPosition.x - playerPosition.x) / mapScale}px`, 
                top: `${50 + (petPosition.z - playerPosition.z) / mapScale}px` 
              }}
            >
              {petDirection && (
                <div 
                  className="direction-indicator pet-direction"
                  style={{ 
                    width: `${directionLength}px`, 
                    transform: `rotate(${Math.atan2(petDirection.x, petDirection.z)}rad)`
                  }}
                />
              )}
            </div>
          )}
        </div>
      )}
      
      {isPetEnabled && (
        <div className="pet-status">
          <div className="icon"></div>
          <span>Dog Active</span>
        </div>
      )}
      
      {isGameOver && onRestart && (
        <div className="game-over">
          <h2>Game Over</h2>
          <p>Your score: {score}</p>
          <p>Zombies killed: {totalKills}</p>
          <button onClick={onRestart}>Play Again</button>
        </div>
      )}
    </div>
  );
};

export default UI; 