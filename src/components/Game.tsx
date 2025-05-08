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
  setZombieData: (data: { positions: any[]; killed: number }) => void;
  setPetPosition: (position: Vector3 | null, direction?: Vector3) => void;
  setPlayerPos: (position: Vector3) => void;
  setPlayerDirection?: (direction: Vector3) => void;
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
  setZombieData,
  setPetPosition,
  setPlayerPos,
  setPlayerDirection
}) => {
  const controlsRef = useRef<any>(null);
  const [zombies, setZombies] = useState<any[]>([]);
  const [playerPosition, setPlayerPosition] = useState(new Vector3(0, 1, 0));
  const [playerDirection, setLocalPlayerDirection] = useState<Vector3>(new Vector3(0, 0, 1));
  const [playerVelocity, setPlayerVelocity] = useState(new Vector3());
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [isLocked, setIsLocked] = useState(false);
  const [zombiesKilled, setZombiesKilled] = useState(0);
  const petPositionRef = useRef<Vector3 | null>(null);
  const zombiePositionsRef = useRef<{id: string; position: Vector3; isDying: boolean; direction?: Vector3}[]>([]);
  const petDirectionRef = useRef<Vector3 | null>(null);
  
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

  // Синхронизируем позицию игрока с UI
  useEffect(() => {
    setPlayerPos(playerPosition);
  }, [playerPosition, setPlayerPos]);

  // Обновляем данные о зомби для UI - временно отключено для тестирования
  // useEffect(() => {
  //   setZombieData({
  //     positions: zombiePositionsRef.current,
  //     killed: zombiesKilled
  //   });
  // }, [zombiePositionsRef.current, zombiesKilled, setZombieData]);

  // Временно отключаем синхронизацию позиции питомца
  // useEffect(() => {
  //   setPetPosition(petPositionRef.current);
  // }, [petPositionRef.current, setPetPosition]);

  // Добавляем эффект для синхронизации направления с родительским компонентом
  useEffect(() => {
    if (setPlayerDirection) {
      setPlayerDirection(playerDirection);
    }
  }, [playerDirection, setPlayerDirection]);

  // Handle zombie hit - теперь это происходит только когда зомби действительно удален
  const handleZombieHit = (zombieId: string) => {
    setZombies(prev => prev.filter(z => z.id !== zombieId));
    setScore(prev => prev + 10);
    setZombiesKilled(prev => prev + 1);
    
    // Временно отключаем звук смерти зомби
    // onZombieDeath();
  };

  // Handle player damage
  const handlePlayerDamage = (damage: number) => {
    setHealth(prev => Math.max(0, prev - damage));
  };

  // Приостанавливаем игровую логику при паузе
  useFrame(() => {
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
      setZombiesKilled(0);
      
      // Сбрасываем состояние волны зомби
      if (typeof gameScene.userData.resetZombieWave === 'function') {
        console.log('Вызываем сброс волны зомби при рестарте');
        gameScene.userData.resetZombieWave();
      } else {
        console.warn('Функция resetZombieWave не найдена в userData сцены');
      }
    }
  }, [isGameOver, gameScene]);

  // Обновление позиции питомца - сохраняем функцию, но отключаем питомца в рендере
  const handlePetPositionUpdate = (position: Vector3 | null, direction?: Vector3) => {
    petPositionRef.current = position;
    if (direction) {
      petDirectionRef.current = direction;
    }
  };

  // Создаем пустые функции-заглушки для временного отключения звуков
  const noop = () => {};

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
        onZombieHurt={noop}
        onUpdateDirection={setLocalPlayerDirection}
        setPlayerPosition={setPlayerPosition} 
        onShot={() => {}}
      />
      
      <Zombies 
        playerPosition={playerPosition}
        zombies={zombies}
        setZombies={setZombies}
        isGameOver={isGameOver || isPaused}
        onPlayerDamage={handlePlayerDamage}
        updatePositions={undefined} // Отключаем обновление позиций для мини-карты
        onZombieKilled={handleZombieHit}
      />
      
      {/* Временно отключаем питомца */}
      {/* {isPetEnabled && (
        <Pet 
          playerPosition={playerPosition}
          isEnabled={isPetEnabled}
          isGameOver={isGameOver || isPaused}
          onPlaySound={onPetSound}
          updatePosition={handlePetPositionUpdate}
        />
      )} */}
    </>
  );
};

export default Game; 