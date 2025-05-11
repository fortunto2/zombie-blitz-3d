import React from 'react';

interface UIProps {
  score: number;
  isGameOver: boolean;
  onRestart: () => void;
}

const UI: React.FC<UIProps> = ({ score, isGameOver, onRestart }) => {
  return (
    <>
      {/* Score Display */}
      <div 
        style={{ 
          position: 'absolute', 
          top: '10px', 
          width: '100%', 
          textAlign: 'center', 
          color: 'white', 
          fontSize: '24px', 
          zIndex: 100 
        }}
      >
        Score: {score}
      </div>
      
      {/* Instructions */}
      <div 
        style={{ 
          position: 'absolute', 
          bottom: '20px', 
          width: '100%', 
          textAlign: 'center', 
          color: 'white', 
          fontSize: '18px', 
          zIndex: 100 
        }}
      >
        Yellow Monster (AAAAH): Press DOWN ARROW to Duck<br />
        White Monster (Ssshhh): Press UP ARROW to Jump
      </div>
      
      {/* Game Over Screen */}
      {isGameOver && (
        <div 
          style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)', 
            backgroundColor: 'rgba(0,0,0,0.7)', 
            color: 'white', 
            padding: '30px', 
            borderRadius: '10px', 
            textAlign: 'center', 
            zIndex: 200 
          }}
        >
          <h2 style={{ marginTop: 0 }}>Game Over!</h2>
          <p>Final Score: {score}</p>
          <button 
            style={{ 
              padding: '10px 20px', 
              fontSize: '18px', 
              marginTop: '20px', 
              cursor: 'pointer' 
            }} 
            onClick={onRestart}
          >
            Restart
          </button>
        </div>
      )}
    </>
  );
};

export default UI; 