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
  time?: number;
  difficulty?: string;
  gameState?: string;
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
  kills = 0,
  time,
  difficulty,
  gameState
}) => {
  // Вычисляем количество активных зомби
  const activeZombiesCount = zombieCount || (zombiePositions ? zombiePositions.filter(z => !z.isDying).length : 0);
  const totalKills = kills || zombiesKilled;
  
  // Масштаб мини-карты (размер арены / размер мини-карты)
  const mapScale = 24 / 100; // 24 - размер арены, 100 - размер мини-карты в пикселях
  
  // Длина указателя направления
  const directionLength = 10; // длина "стрелки" направления
  
  return (
    <div className="ui-container">
      <div className="crosshair" />
      
      {/* Счетчики зомби */}
      <div className="zombie-counters">
        <div className="active-zombies">Активные зомби: {activeZombiesCount}</div>
        <div className="killed-zombies">Уничтожено зомби: {totalKills}</div>
      </div>
      
      <div className="score">Score: {score}</div>
      <div className="health-bar">
        <div 
          className="health-bar-fill" 
          style={{ width: `${health}%` }} 
        />
      </div>
      
      {/* Мини-карта с игроком всегда в центре */}
      {playerPosition && (
        <div className="mini-map">
          {/* Игрок всегда в центре */}
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
          
          {/* Зомби отображаются относительно игрока */}
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
          
          {/* Собака отображается относительно игрока */}
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
          <span>Собака активна</span>
        </div>
      )}
      
      {isGameOver && onRestart && (
        <div className="game-over">
          <h2>Game Over</h2>
          <p>Your score: {score}</p>
          <p>Зомби уничтожено: {totalKills}</p>
          <button onClick={onRestart}>Play Again</button>
        </div>
      )}
    </div>
  );
};

export default UI; 