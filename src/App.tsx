import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import { Vector3 } from 'three';
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
  
  // Состояния для мини-карты и счетчиков
  const [playerPosition, setPlayerPosition] = useState<Vector3 | null>(null);
  const [playerDirection, setPlayerDirection] = useState<Vector3 | null>(null);
  const [petPosition, setPetPosition] = useState<Vector3 | null>(null);
  const [petDirection, setPetDirection] = useState<Vector3 | null>(null);
  const [zombiePositions, setZombiePositions] = useState<{ id: string; position: Vector3; isDying: boolean; direction?: Vector3 }[]>([]);
  const [zombiesKilled, setZombiesKilled] = useState(0);
  
  // Колбэк для обновления данных о зомби
  const handleZombieDataUpdate = (data: { positions: any[]; killed: number }) => {
    setZombiePositions(data.positions);
    setZombiesKilled(data.killed);
  };

  // Обработчик обновления направления игрока
  const handlePlayerDirectionUpdate = (direction: Vector3) => {
    setPlayerDirection(direction);
  };

  // Обработчик обновления позиции и направления питомца
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

  // Стиль для контейнера статистики, чтобы панели шли друг под другом
  const statsContainerStyle: React.CSSProperties = {
    position: 'fixed',
    top: '0px',
    left: '0px',
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
            setZombieData={handleZombieDataUpdate}
            setPetPosition={handlePetUpdate}
            setPlayerPos={setPlayerPosition}
            setPlayerDirection={handlePlayerDirectionUpdate}
          />
        </Suspense>
        {/* Контейнер для панелей статистики */}
        <group> {/* Используем group для позиционирования в Canvas, если Stats не принимает style напрямую */}
          {/* Stats компонент не принимает style напрямую. Мы можем обернуть их или использовать className и CSS файл. */}
          {/* Для простоты, разместим их в разных углах или придется добавлять CSS */}
          {/* Так как Stats рендерятся в DOM элемент вне Canvas, мы можем их стилизовать через CSS или div */}
        </group>
      </Canvas>

      {/* Помещаем Stats вне Canvas, чтобы легче стилизовать их положение */}
      <div style={statsContainerStyle}>
        <Stats showPanel={0} className="fps-stats" /> {/* FPS */}
        <Stats showPanel={1} className="ms-stats" />  {/* MS */}
        <Stats showPanel={2} className="mb-stats" />  {/* MB */}
      </div>
      
      {/* Временно скрываем звуковые эффекты */}
      {/* <SoundEffects 
        ref={soundEffectsRef}
        isEnabled={!showMenu && !isPaused && !isGameOver}
      /> */}
      
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
            playerPosition={null}
            playerDirection={null}
            zombiePositions={[]}
            petPosition={null}
            petDirection={null}
            zombiesKilled={zombiesKilled}
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