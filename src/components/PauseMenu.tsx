import React from 'react';
import '../styles.css';

interface PauseMenuProps {
  onResume: () => void;
  onQuit: () => void;
}

const PauseMenu: React.FC<PauseMenuProps> = ({ onResume, onQuit }) => {
  return (
    <div className="pause-menu-container">
      <div className="pause-menu">
        <h2>Game Paused</h2>
        
        <button className="menu-button" onClick={onResume}>
          Resume Game
        </button>
        
        <button className="menu-button" onClick={onQuit}>
          Quit to Menu
        </button>
      </div>
    </div>
  );
};

export default PauseMenu; 