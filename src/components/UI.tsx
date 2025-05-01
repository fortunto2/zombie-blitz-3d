import React from 'react';

interface UIProps {
  score: number;
  health: number;
  isGameOver: boolean;
  onRestart: () => void;
  isPetEnabled: boolean;
}

const UI: React.FC<UIProps> = ({ score, health, isGameOver, onRestart, isPetEnabled }) => {
  return (
    <div className="ui-container">
      <div className="crosshair" />
      <div className="score">Score: {score}</div>
      <div className="health-bar">
        <div 
          className="health-bar-fill" 
          style={{ width: `${health}%` }} 
        />
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
          <button onClick={onRestart}>Play Again</button>
        </div>
      )}
    </div>
  );
};

export default UI; 