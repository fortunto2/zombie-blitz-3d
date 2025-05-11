import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import Player from './Player';
import Arena from './Arena';

interface GameProps {
  isGameOver: boolean;
  onScoreChange: (score: number) => void;
  isPaused: boolean;
}

const Game: React.FC<GameProps> = ({ isGameOver, onScoreChange, isPaused }) => {
  const score = useRef(0);
  const scene = useThree((state) => state.scene);
  const camera = useRef<THREE.PerspectiveCamera>(null);
  
  // Handle walls and obstacles
  const walls = useRef<THREE.Group[]>([]);
  const nextWallTime = useRef(0);
  
  // Monster cues
  const yellowMonsterRef = useRef<THREE.Group>(null);
  const whiteMonsterRef = useRef<THREE.Group>(null);
  const currentCueType = useRef<'yellow' | 'white' | null>(null);
  const cueEndTime = useRef(0);
  
  // Player state
  const isDucking = useRef(false);
  const isJumping = useRef(false);
  
  // Configuration
  const WALL_SPAWN_Z = -100;
  const WALL_DESPAWN_Z = 20;
  const ROAD_WIDTH = 10;
  const CAR_SPEED = 0.3;
  const MONSTER_CUE_DURATION = 1500; // ms
  const MONSTER_COOLDOWN_MIN = 2000; // ms
  const MONSTER_COOLDOWN_MAX = 5000; // ms

  // Reset game state
  useEffect(() => {
    if (!isGameOver) {
      score.current = 0;
      onScoreChange(0);
      
      // Clear existing walls
      walls.current.forEach(wall => scene.remove(wall));
      walls.current = [];
      
      // Reset monster cues
      currentCueType.current = null;
      if (yellowMonsterRef.current) {
        yellowMonsterRef.current.getObjectByName('mouth')!.visible = false;
      }
      if (whiteMonsterRef.current) {
        whiteMonsterRef.current.getObjectByName('mouth')!.visible = false;
      }
      
      // Set time for next monster cue
      nextWallTime.current = Date.now() + MONSTER_COOLDOWN_MIN + 
        Math.random() * (MONSTER_COOLDOWN_MAX - MONSTER_COOLDOWN_MIN);
    }
  }, [isGameOver, scene]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isGameOver || isPaused) return;
      
      switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (!isJumping.current && !isDucking.current) {
            isJumping.current = true;
          }
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (!isDucking.current && !isJumping.current) {
            isDucking.current = true;
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isGameOver, isPaused]);

  // Create wall based on monster cue
  const createWall = (type: 'yellow' | 'white') => {
    const wallGroup = new THREE.Group();
    wallGroup.userData.type = type;
    wallGroup.userData.collided = false;
    wallGroup.userData.passed = false;
    
    const wallHeight = 3;
    const wallDepth = 1;
    const pillarWidth = ROAD_WIDTH / 3 - 0.5;
    
    const brickMaterial = new THREE.MeshStandardMaterial({ color: 0xCC0000 });
    
    if (type === 'yellow') { // Needs DUCK: Obstacle is high in the middle
      const middleObstacle = new THREE.Mesh(
        new THREE.BoxGeometry(ROAD_WIDTH / 2, wallHeight / 2, wallDepth),
        brickMaterial
      );
      middleObstacle.position.y = wallHeight * 0.75;
      middleObstacle.castShadow = true;
      middleObstacle.receiveShadow = true;
      wallGroup.add(middleObstacle);
      wallGroup.userData.obstacleBox = new THREE.Box3().setFromObject(middleObstacle);
    } else if (type === 'white') { // Needs JUMP: Obstacles on sides
      const leftPillar = new THREE.Mesh(
        new THREE.BoxGeometry(pillarWidth, wallHeight, wallDepth),
        brickMaterial
      );
      leftPillar.position.set(-ROAD_WIDTH / 2 + pillarWidth / 2, wallHeight / 2, 0);
      leftPillar.castShadow = true;
      leftPillar.receiveShadow = true;
      wallGroup.add(leftPillar);
      
      const rightPillar = new THREE.Mesh(
        new THREE.BoxGeometry(pillarWidth, wallHeight, wallDepth),
        brickMaterial
      );
      rightPillar.position.set(ROAD_WIDTH / 2 - pillarWidth / 2, wallHeight / 2, 0);
      rightPillar.castShadow = true;
      rightPillar.receiveShadow = true;
      wallGroup.add(rightPillar);
      
      wallGroup.userData.leftBox = new THREE.Box3().setFromObject(leftPillar);
      wallGroup.userData.rightBox = new THREE.Box3().setFromObject(rightPillar);
    }
    
    wallGroup.position.z = WALL_SPAWN_Z;
    scene.add(wallGroup);
    walls.current.push(wallGroup);
  };

  // Game loop
  useFrame(() => {
    if (isGameOver || isPaused) return;
    
    const now = Date.now();
    
    // Handle monster cues
    if (now > cueEndTime.current && currentCueType.current) {
      currentCueType.current = null;
      if (yellowMonsterRef.current) {
        yellowMonsterRef.current.getObjectByName('mouth')!.visible = false;
      }
      if (whiteMonsterRef.current) {
        whiteMonsterRef.current.getObjectByName('mouth')!.visible = false;
      }
      nextWallTime.current = now + MONSTER_COOLDOWN_MIN + 
        Math.random() * (MONSTER_COOLDOWN_MAX - MONSTER_COOLDOWN_MIN);
    }
    
    if (!currentCueType.current && now > nextWallTime.current) {
      currentCueType.current = Math.random() < 0.5 ? 'yellow' : 'white';
      cueEndTime.current = now + MONSTER_CUE_DURATION;
      createWall(currentCueType.current);
      
      if (currentCueType.current === 'yellow' && yellowMonsterRef.current) {
        yellowMonsterRef.current.getObjectByName('mouth')!.visible = true;
      } else if (currentCueType.current === 'white' && whiteMonsterRef.current) {
        whiteMonsterRef.current.getObjectByName('mouth')!.visible = true;
      }
    }
    
    // Move walls
    for (let i = walls.current.length - 1; i >= 0; i--) {
      const wall = walls.current[i];
      wall.position.z += CAR_SPEED;
      
      // Remove walls that have gone past
      if (wall.position.z > WALL_DESPAWN_Z) {
        scene.remove(wall);
        walls.current.splice(i, 1);
      }
    }
  });

  return (
    <>
      <PerspectiveCamera 
        ref={camera} 
        makeDefault 
        position={[0, 5, 10]} 
        fov={75}
      />
      
      <ambientLight intensity={0.6} />
      <directionalLight 
        position={[5, 10, 7.5]} 
        intensity={0.8} 
        castShadow 
      />
      
      <Arena 
        roadWidth={ROAD_WIDTH} 
        roadLength={200}
      />
      
      <Player 
        isGameOver={isGameOver}
        isDucking={isDucking}
        isJumping={isJumping}
        walls={walls}
        onScoreChange={onScoreChange}
      />
      
      {/* Monsters */}
      <group ref={yellowMonsterRef} position={[-ROAD_WIDTH / 2 - 4, 3, -30]}>
        <mesh castShadow>
          <coneGeometry args={[2.5, 6, 16]} />
          <meshStandardMaterial color="yellow" />
        </mesh>
        <mesh 
          name="mouth" 
          position={[0, 0.5, 2.51]} 
          rotation={[Math.PI / 12, 0, 0]}
          visible={false}
        >
          <planeGeometry args={[2, 1.5]} />
          <meshBasicMaterial color="black" side={THREE.DoubleSide} />
        </mesh>
      </group>
      
      <group ref={whiteMonsterRef} position={[ROAD_WIDTH / 2 + 4, 2.5, -30]}>
        <mesh castShadow>
          <coneGeometry args={[2, 5, 16]} />
          <meshStandardMaterial color="white" />
        </mesh>
        <mesh 
          name="mouth" 
          position={[0, 0.3, 2.01]} 
          rotation={[Math.PI / 12, 0, 0]}
          visible={false}
        >
          <planeGeometry args={[1.5, 0.8]} />
          <meshBasicMaterial color="red" side={THREE.DoubleSide} />
        </mesh>
      </group>
    </>
  );
};

export default Game; 