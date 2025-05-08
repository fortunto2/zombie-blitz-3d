import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import { Vector3 } from 'three';
import Game from './components/Game';
import UI from './components/UI';
import Menu from './components/Menu';
import PauseMenu from './components/PauseMenu';
import SoundEffects, { SoundEffectsRef } from './components/SoundEffects';
import MobileControls from './components/MobileControls';

const App: React.FC = () => {
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [showMenu, setShowMenu] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isPetEnabled, setIsPetEnabled] = useState(true);
  const soundEffectsRef = useRef<SoundEffectsRef>(null);
  // Состояние для движения с мобильного джойстика
  const [mobileMovement, setMobileMovement] = useState<{x: number, y: number}>({x: 0, y: 0});
  // Обнаружение мобильного устройства
  const [isMobile, setIsMobile] = useState<boolean>(false);
  
  // States for mini-map and counters
  const [playerPosition, setPlayerPosition] = useState<Vector3 | null>(null);
  const [playerDirection, setPlayerDirection] = useState<Vector3 | null>(null);
  const [petPosition, setPetPosition] = useState<Vector3 | null>(null);
  const [petDirection, setPetDirection] = useState<Vector3 | null>(null);
  const [zombiePositions, setZombiePositions] = useState<{ id: string; position: Vector3; isDying: boolean; direction?: Vector3 }[]>([]);
  const [zombiesKilled, setZombiesKilled] = useState(0);
  
  // Определяем, является ли устройство мобильным
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    };
    
    setIsMobile(checkMobile());
  }, []);
  
  // Callback для обработки мобильного движения
  const handleMobileMove = (x: number, y: number) => {
    setMobileMovement({x, y});
  };
  
  // Callback для обработки мобильного выстрела
  const handleMobileShoot = () => {
    handleShoot();
  };
  
  // Callback for updating zombie data
  const handleZombieDataUpdate = (data: { positions: any[]; killed: number }) => {
    setZombiePositions(data.positions);
    setZombiesKilled(data.killed);
  };

  // Handler for updating player direction
  const handlePlayerDirectionUpdate = (direction: Vector3) => {
    setPlayerDirection(direction);
  };

  // Handler for updating pet position and direction
  const handlePetUpdate = (position: Vector3 | null, direction?: Vector3) => {
    setPetPosition(position);
    if (direction) {
      setPetDirection(direction);
    }
  };

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
  
  // Sound handlers
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

  const handlePlayerHurt = () => {
    if (soundEffectsRef.current) {
      soundEffectsRef.current.playPlayerHurt();
    }
  };
  
  // Handle ESC key for pause
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

  // Style for stats container to stack panels
  const statsContainerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '30px',
    right: '160px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column'
  };

  return (
    <>
      <Canvas shadows>
        <Suspense fallback={null}>
          <Game 
            isGameOver={isGameOver} 
            onScoreChange={handleScoreChange} 
            onHealthChange={handleHealthChange}
            isPaused={isPaused}
            isPetEnabled={false}
            onPetSound={handlePetSound}
            onShoot={handleShoot}
            onZombieHurt={handleZombieHurt}
            onZombieDeath={handleZombieDeath}
            onPlayerHurt={handlePlayerHurt}
            setZombieData={handleZombieDataUpdate}
            setPetPosition={handlePetUpdate}
            setPlayerPos={setPlayerPosition}
            setPlayerDirection={handlePlayerDirectionUpdate}
            mobileMovement={mobileMovement}
          />
        </Suspense>
        {/* Container for statistics panels */}
        <group> {/* Using group for positioning in Canvas if Stats doesn't accept style directly */}
          {/* Stats component doesn't accept style directly. We can wrap them or use className and CSS file. */}
          {/* For simplicity, we'll place them in different corners or we'd need to add CSS */}
          {/* Since Stats are rendered to a DOM element outside Canvas, we can style them via CSS or div */}
        </group>
      </Canvas>

      {/* Place Stats outside Canvas for easier styling */}
      <div style={statsContainerStyle}>
        <Stats showPanel={0} className="fps-stats" /> {/* FPS */}
        <Stats showPanel={1} className="ms-stats" />  {/* MS */}
        <Stats showPanel={2} className="mb-stats" />  {/* MB */}
      </div>
      
      {/* Enable sound effects, but only for shots and zombie sounds */}
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
            isPetEnabled={false}
            playerPosition={playerPosition}
            playerDirection={playerDirection}
            zombiePositions={zombiePositions}
            petPosition={petPosition}
            petDirection={petDirection}
            zombiesKilled={zombiesKilled}
          />
          
          {isPaused && !isGameOver && (
            <PauseMenu
              onResume={handleResumePause}
              onQuit={handleQuitToMenu}
            />
          )}
          
          {/* Мобильные элементы управления */}
          {!showMenu && !isGameOver && !isPaused && (
            <MobileControls 
              isEnabled={isMobile} 
              onMove={handleMobileMove}
              onShoot={handleMobileShoot}
            />
          )}
        </>
      )}
    </>
  );
};

export default App; 