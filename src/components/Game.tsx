import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { Vector3 } from 'three';
import * as THREE from 'three';

import Arena from './Arena';
import Player from './Player';
import Zombies from './Zombies';
import Pet from './Pet';

interface GameProps {
  isGameOver: boolean;
  onScoreChange: (score: number) => void;
  onHealthChange: (health: number) => void;
  isPaused: boolean;
  isPetEnabled: boolean;
  onPetSound: (soundType: 'bark' | 'bite') => void;
  onShoot: () => void;
  onZombieHurt: () => void;
  onZombieDeath: () => void;
  gameStarted: boolean;
}

const Game: React.FC<GameProps> = ({ 
  isGameOver, 
  onScoreChange, 
  onHealthChange, 
  isPaused,
  isPetEnabled,
  onPetSound,
  onShoot,
  onZombieHurt,
  onZombieDeath,
  gameStarted
}) => {
  const controlsRef = useRef<any>(null);
  const [zombies, setZombies] = useState<any[]>([]);
  const [playerPosition, setPlayerPosition] = useState(new Vector3(0, 1, 0));
  const [playerVelocity, setPlayerVelocity] = useState(new Vector3());
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [isLocked, setIsLocked] = useState(false);
  
  // Получаем доступ к сцене из Three.js
  const { scene } = useThree();
  const [gameScene, setGameScene] = useState<THREE.Scene | null>(null);
  
  // Инициализация сцены
  useEffect(() => {
    if (scene) {
      setGameScene(scene);
      console.log('Сцена инициализирована');
    }
  }, [scene]);
  
  // Handle pointer lock change
  useEffect(() => {
    const handleLockChange = () => {
      setIsLocked(!!document.pointerLockElement);
    };
    
    document.addEventListener('pointerlockchange', handleLockChange);
    return () => {
      document.removeEventListener('pointerlockchange', handleLockChange);
    };
  }, []);

  // Handle game over or pause
  useEffect(() => {
    if ((isGameOver || isPaused) && controlsRef.current) {
      document.exitPointerLock();
    }
  }, [isGameOver, isPaused]);

  // Sync score and health with parent
  useEffect(() => {
    onScoreChange(score);
  }, [score, onScoreChange]);

  useEffect(() => {
    onHealthChange(health);
  }, [health, onHealthChange]);

  // Handle zombie hit
  const handleZombieHit = (zombieId: string) => {
    setZombies(prev => prev.filter(z => z.id !== zombieId));
    setScore(prev => prev + 10);
    
    // Воспроизводим звук смерти зомби
    onZombieDeath();
  };

  // Handle player damage
  const handlePlayerDamage = (damage: number) => {
    setHealth(prev => Math.max(0, prev - damage));
  };

  // Приостанавливаем игровую логику при паузе
  useFrame((_, delta) => {
    if (isPaused) {
      return; // Останавливаем все обновления при паузе
    }
  }, 0); // Приоритет 0, чтобы этот хук вызывался первым

  // Эффект для сброса игрового состояния при изменении isGameOver
  useEffect(() => {
    if (isGameOver === false && gameScene) {
      // Игра только что была перезапущена
      setScore(0);
      setHealth(100);
      
      // Сбрасываем состояние волны зомби
      if (typeof gameScene.userData.resetZombieWave === 'function') {
        console.log('Вызываем сброс волны зомби при рестарте');
        gameScene.userData.resetZombieWave();
      } else {
        console.warn('Функция resetZombieWave не найдена в userData сцены');
      }
    }
  }, [isGameOver, gameScene]);

  return (
    <>
      <PointerLockControls ref={controlsRef} />
      
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      
      <Arena />
      
      <Player 
        position={playerPosition}
        velocity={playerVelocity}
        setPosition={setPlayerPosition}
        setVelocity={setPlayerVelocity}
        isLocked={isLocked}
        isGameOver={isGameOver || isPaused}
        onZombieHit={handleZombieHit}
        onShoot={onShoot}
        onZombieHurt={onZombieHurt}
      />
      
      <Zombies 
        playerPosition={playerPosition}
        zombies={zombies}
        setZombies={setZombies}
        isGameOver={isGameOver || isPaused}
        onPlayerDamage={handlePlayerDamage}
        gameStarted={gameStarted}
      />
      
      {isPetEnabled && (
        <Pet 
          playerPosition={playerPosition}
          isEnabled={isPetEnabled}
          isGameOver={isGameOver || isPaused}
          onPlaySound={onPetSound}
        />
      )}
    </>
  );
};

export default Game; 