import React, { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import Game from './components/Game';
import UI from './components/UI';
import SoundEffects, { SoundEffectsRef } from './components/SoundEffects';

const App: React.FC = () => {
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const soundEffectsRef = useRef<SoundEffectsRef>(null);
  
  const handleGameOver = () => {
    setIsGameOver(true);
    if (soundEffectsRef.current) {
      soundEffectsRef.current.playCrash();
    }
  };
  
  const handleRestart = () => {
    setIsGameOver(false);
    setScore(0);
  };
  
  const handleScoreChange = (newScore: number) => {
    setScore(newScore);
  };
  
  const handleJump = () => {
    if (soundEffectsRef.current) {
      soundEffectsRef.current.playJump();
    }
  };
  
  const handleDuck = () => {
    if (soundEffectsRef.current) {
      soundEffectsRef.current.playDuck();
    }
  };
  
  const handleYellowMonsterCue = () => {
    if (soundEffectsRef.current) {
      soundEffectsRef.current.playYellowMonster();
    }
  };
  
  const handleWhiteMonsterCue = () => {
    if (soundEffectsRef.current) {
      soundEffectsRef.current.playWhiteMonster();
    }
  };
  
  // Handle ESC key for pause
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && !isGameOver) {
        setIsPaused(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isGameOver]);
  
  return (
    <>
      <Canvas shadows>
        <Game 
          isGameOver={isGameOver} 
          onScoreChange={handleScoreChange} 
          isPaused={isPaused}
        />
        <Stats />
      </Canvas>
      
      <UI 
        score={score} 
        isGameOver={isGameOver} 
        onRestart={handleRestart} 
      />
      
      <SoundEffects 
        ref={soundEffectsRef}
        isEnabled={!isPaused && !isGameOver}
      />
    </>
  );
};

export default App; 