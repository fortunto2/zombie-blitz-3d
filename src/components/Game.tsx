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
  onPlayerHurt: () => void;
  setZombieData: (data: { positions: any[]; killed: number }) => void;
  setPetPosition: (position: Vector3 | null, direction?: Vector3) => void;
  setPlayerPos: (position: Vector3) => void;
  setPlayerDirection?: (direction: Vector3) => void;
  mobileMovement?: {x: number, y: number};
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
  onPlayerHurt,
  setZombieData,
  setPetPosition,
  setPlayerPos,
  setPlayerDirection,
  mobileMovement
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
  
  // Get access to Three.js scene
  const { scene } = useThree();
  const [gameScene, setGameScene] = useState<THREE.Scene | null>(null);
  
  // Scene initialization
  useEffect(() => {
    if (scene) {
      setGameScene(scene);
      console.log('Scene initialized');
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

  // Sync player position with UI
  useEffect(() => {
    setPlayerPos(playerPosition);
  }, [playerPosition, setPlayerPos]);

  // Update zombie data for UI
  useEffect(() => {
    setZombieData({
      positions: zombiePositionsRef.current,
      killed: zombiesKilled
    });
  }, [zombiesKilled, setZombieData, zombiePositionsRef.current]);

  // Temporarily disable pet position sync
  // useEffect(() => {
  //   setPetPosition(petPositionRef.current);
  // }, [petPositionRef.current, setPetPosition]);

  // Add effect for syncing direction with parent component
  useEffect(() => {
    if (setPlayerDirection) {
      setPlayerDirection(playerDirection);
    }
  }, [playerDirection, setPlayerDirection]);

  // Handle zombie hit - this happens only when the zombie is actually removed
  const handleZombieHit = (zombieId: string) => {
    setZombies(prev => prev.filter(z => z.id !== zombieId));
    setScore(prev => prev + 10);
    setZombiesKilled(prev => prev + 1);
    
    // Temporarily disable zombie death sound
    // onZombieDeath();
  };

  // Handle player damage
  const handlePlayerDamage = (damage: number) => {
    setHealth(prev => Math.max(0, prev - damage));
    // Play player hurt sound when player takes damage
    onPlayerHurt();
  };

  // Pause game logic during pause
  useFrame(() => {
    if (isPaused) {
      return; // Stop all updates during pause
    }
  }, 0); // Priority 0 so this hook is called first

  // Effect to reset game state when isGameOver changes
  useEffect(() => {
    if (isGameOver === false && gameScene) {
      // Game has just been restarted
      setScore(0);
      setHealth(100);
      setZombiesKilled(0);
      
      // Reset zombie wave state
      if (typeof gameScene.userData.resetZombieWave === 'function') {
        console.log('Calling zombie wave reset on restart');
        gameScene.userData.resetZombieWave();
      } else {
        console.warn('resetZombieWave function not found in scene userData');
      }
    }
  }, [isGameOver, gameScene]);

  // Pet position update - keep function but disable pet in render
  const handlePetPositionUpdate = (position: Vector3 | null, direction?: Vector3) => {
    petPositionRef.current = position;
    if (direction) {
      petDirectionRef.current = direction;
    }
  };

  // Create empty no-op functions for temporarily disabling sounds
  const noop = () => {};

  // Обработка движения с мобильного джойстика
  useEffect(() => {
    if (mobileMovement && !isGameOver && !isPaused) {
      // Создаем вектор направления из ввода джойстика
      const moveDir = new Vector3(mobileMovement.x, 0, -mobileMovement.y).normalize();
      
      // Применяем скорость движения
      const moveSpeed = 0.1;
      if (moveDir.length() > 0) {
        setPlayerVelocity(moveDir.multiplyScalar(moveSpeed));
        
        // Также обновляем направление игрока, если он движется
        if (moveDir.length() > 0.1) {
          setLocalPlayerDirection(moveDir.clone());
        }
      }
    }
  }, [mobileMovement, isGameOver, isPaused]);

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
        updatePositions={(positions) => { 
          zombiePositionsRef.current = positions;
          // Force update zombie data in UI when positions change
          setZombieData({
            positions: positions,
            killed: zombiesKilled
          });
        }}
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