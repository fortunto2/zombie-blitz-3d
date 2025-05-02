import React from 'react';
import { Vector3 } from 'three';

interface UIProps {
  score: number;
  health: number;
  isGameOver: boolean;
  onRestart: () => void;
  isPetEnabled: boolean;
  playerPosition?: Vector3 | null;
  zombiePositions?: { id: string; position: Vector3; isDying: boolean }[];
  petPosition?: Vector3 | null;
  zombiesKilled: number;
}

const UI: React.FC<UIProps> = ({ 
  score, 
  health, 
  isGameOver, 
  onRestart, 
  isPetEnabled,
  playerPosition,
  zombiePositions = [],
  petPosition,
  zombiesKilled = 0
}) => {
  // Вычисляем количество активных зомби
  const activeZombiesCount = zombiePositions ? zombiePositions.filter(z => !z.isDying).length : 0;
  
  // Масштаб мини-карты (размер арены / размер мини-карты)
  const mapScale = 24 / 100; // 24 - размер арены, 100 - размер мини-карты в пикселях
  
  return (
    <div className="ui-container">
      <div className="crosshair" />
      
      {/* Счетчики зомби */}
      <div className="zombie-counters">
        <div className="active-zombies">Активные зомби: {activeZombiesCount}</div>
        <div className="killed-zombies">Уничтожено зомби: {zombiesKilled}</div>
      </div>
      
      <div className="score">Score: {score}</div>
      <div className="health-bar">
        <div 
          className="health-bar-fill" 
          style={{ width: `${health}%` }} 
        />
      </div>
      
      {/* Мини-карта */}
      <div className="mini-map">
        {playerPosition && (
          <div 
            className="player-dot"
            style={{ 
              left: `${50 + playerPosition.x / mapScale}px`, 
              top: `${50 + playerPosition.z / mapScale}px` 
            }}
          />
        )}
        
        {zombiePositions && zombiePositions.map(zombie => (
          <div 
            key={zombie.id}
            className={`zombie-dot ${zombie.isDying ? 'dying' : ''}`}
            style={{ 
              left: `${50 + zombie.position.x / mapScale}px`, 
              top: `${50 + zombie.position.z / mapScale}px` 
            }}
          />
        ))}
        
        {isPetEnabled && petPosition && (
          <div 
            className="pet-dot"
            style={{ 
              left: `${50 + petPosition.x / mapScale}px`, 
              top: `${50 + petPosition.z / mapScale}px` 
            }}
          />
        )}
      </div>
      
      {isPetEnabled && (
        <div className="pet-status">
          <div className="icon"></div>
          <span>Собака активна</span>
        </div>
      )}
      
      {isGameOver && (
        <div className="game-over">
          <h2>Game Over</h2>
          <p>Your score: {score}</p>
          <p>Зомби уничтожено: {zombiesKilled}</p>
          <button onClick={onRestart}>Play Again</button>
        </div>
      )}
    </div>
  );
};

export default UI; 