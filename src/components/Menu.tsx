import React from 'react';
import '../styles.css';

interface MenuProps {
  onStartGame: () => void;
  onTogglePet: (enabled: boolean) => void;
  isPetEnabled: boolean;
}

const Menu: React.FC<MenuProps> = ({ onStartGame, onTogglePet, isPetEnabled }) => {
  return (
    <div className="menu-container">
      <div className="menu">
        <h1>Zombie Blitz</h1>
        <p>Survive the zombie apocalypse!</p>
        
        <div className="menu-options">
          <label className="option-toggle">
            <input
              type="checkbox"
              checked={isPetEnabled}
              onChange={(e) => onTogglePet(e.target.checked)}
            />
            Enable Dog Companion
          </label>
        </div>
        
        <button className="start-button" onClick={onStartGame}>
          Start Game
        </button>
        
        <div className="controls-info">
          <h3>Controls</h3>
          <ul>
            <li>WASD - Move</li>
            <li>Mouse - Look around</li>
            <li>Left Click - Shoot</li>
            <li>ESC - Pause game</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Menu; 