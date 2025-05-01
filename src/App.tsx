import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import Game from './components/Game';
import UI from './components/UI';
import Menu from './components/Menu';
import PauseMenu from './components/PauseMenu';
import SoundEffects, { SoundEffectsRef } from './components/SoundEffects';

const App: React.FC = () => {
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [showMenu, setShowMenu] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isPetEnabled, setIsPetEnabled] = useState(true);
  const soundEffectsRef = useRef<SoundEffectsRef>(null);

  const handleGameOver = () => {
    setIsGameOver(true);
  };

  const handleRestart = () => {
    setIsGameOver(false);
    setScore(0);
    setHealth(100);
  };

  const handleScoreChange = (newScore: number) => {
    setScore(newScore);
  };

  const handleHealthChange = (newHealth: number) => {
    setHealth(newHealth);
    if (newHealth <= 0) {
      handleGameOver();
    }
  };
  
  const handleStartGame = () => {
    setShowMenu(false);
    setIsGameOver(false);
    setScore(0);
    setHealth(100);
    setIsPaused(false);
  };
  
  const handleQuitToMenu = () => {
    setShowMenu(true);
    setIsPaused(false);
  };
  
  const handleTogglePet = (enabled: boolean) => {
    setIsPetEnabled(enabled);
  };
  
  const handleResumePause = () => {
    setIsPaused(false);
  };
  
  // Обработчики звуков
  const handlePetSound = (soundType: 'bark' | 'bite') => {
    if (soundEffectsRef.current) {
      if (soundType === 'bark') {
        soundEffectsRef.current.playDogBark();
      } else if (soundType === 'bite') {
        soundEffectsRef.current.playDogBite();
      }
    }
  };
  
  const handleShoot = () => {
    if (soundEffectsRef.current) {
      soundEffectsRef.current.playGunshot();
    }
  };
  
  const handleZombieHurt = () => {
    if (soundEffectsRef.current) {
      soundEffectsRef.current.playZombieHurt();
    }
  };
  
  const handleZombieDeath = () => {
    if (soundEffectsRef.current) {
      soundEffectsRef.current.playZombieDeath();
    }
  };
  
  // Обработка клавиши ESC для паузы
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && !showMenu && !isGameOver) {
        setIsPaused(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMenu, isGameOver]);

  return (
    <>
      <Canvas shadows>
        <Suspense fallback={null}>
          <Game 
            isGameOver={isGameOver} 
            onScoreChange={handleScoreChange} 
            onHealthChange={handleHealthChange}
            isPaused={isPaused}
            isPetEnabled={isPetEnabled}
            onPetSound={handlePetSound}
            onShoot={handleShoot}
            onZombieHurt={handleZombieHurt}
            onZombieDeath={handleZombieDeath}
          />
        </Suspense>
        <Stats />
      </Canvas>
      
      {/* Звуковые эффекты перенесены сюда из компонента Game */}
      <SoundEffects 
        ref={soundEffectsRef}
        isEnabled={!showMenu && !isPaused && !isGameOver}
      />
      
      {showMenu ? (
        <Menu 
          onStartGame={handleStartGame} 
          onTogglePet={handleTogglePet}
          isPetEnabled={isPetEnabled}
        />
      ) : (
        <>
          <UI 
            score={score} 
            health={health} 
            isGameOver={isGameOver} 
            onRestart={handleRestart} 
            isPetEnabled={isPetEnabled}
          />
          
          {isPaused && !isGameOver && (
            <PauseMenu
              onResume={handleResumePause}
              onQuit={handleQuitToMenu}
            />
          )}
        </>
      )}
    </>
  );
};

export default App; 