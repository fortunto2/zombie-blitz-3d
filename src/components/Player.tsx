import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PlayerProps {
  isGameOver: boolean;
  isDucking: React.MutableRefObject<boolean>;
  isJumping: React.MutableRefObject<boolean>;
  walls: React.MutableRefObject<THREE.Group[]>;
  onScoreChange: (score: number) => void;
}

const Player: React.FC<PlayerProps> = ({ 
  isGameOver, 
  isDucking, 
  isJumping, 
  walls, 
  onScoreChange 
}) => {
  const playerRef = useRef<THREE.Mesh>(null);
  const playerBoundingBox = useRef(new THREE.Box3());
  const score = useRef(0);
  
  // Jump and duck animation parameters
  const jumpFrame = useRef(0);
  const duckFrame = useRef(0);
  const JUMP_HEIGHT = 1.5;
  const JUMP_DURATION = 30; // frames
  const DUCK_SCALE_Y = 0.5;
  const DUCK_DURATION = 30; // frames
  
  // Update bounding box
  useEffect(() => {
    if (playerRef.current) {
      playerBoundingBox.current.setFromObject(playerRef.current);
    }
  }, []);
  
  // Game loop
  useFrame(() => {
    if (isGameOver || !playerRef.current) return;
    
    // Handle jumping
    if (isJumping.current) {
      jumpFrame.current++;
      const jumpProgress = jumpFrame.current / JUMP_DURATION;
      playerRef.current.position.y = 0.5 + JUMP_HEIGHT * Math.sin(Math.PI * jumpProgress);
      
      if (jumpFrame.current >= JUMP_DURATION) {
        isJumping.current = false;
        jumpFrame.current = 0;
        playerRef.current.position.y = 0.5; // Reset to ground level
      }
    }
    
    // Handle ducking
    if (isDucking.current) {
      duckFrame.current++;
      
      if (duckFrame.current <= DUCK_DURATION / 2) {
        // Duck down
        playerRef.current.scale.y = 1 - (1 - DUCK_SCALE_Y) * (duckFrame.current / (DUCK_DURATION / 2));
        playerRef.current.position.y = DUCK_SCALE_Y * 0.5 + (1 - playerRef.current.scale.y) * 0.25;
      } else {
        // Return to normal
        playerRef.current.scale.y = DUCK_SCALE_Y + (1 - DUCK_SCALE_Y) * 
          ((duckFrame.current - DUCK_DURATION / 2) / (DUCK_DURATION / 2));
        playerRef.current.position.y = DUCK_SCALE_Y * 0.5 + (1 - playerRef.current.scale.y) * 0.25;
      }
      
      // Ensure scale is within bounds
      if (playerRef.current.scale.y < DUCK_SCALE_Y) playerRef.current.scale.y = DUCK_SCALE_Y;
      if (playerRef.current.scale.y > 1) playerRef.current.scale.y = 1;
      
      if (duckFrame.current >= DUCK_DURATION) {
        isDucking.current = false;
        duckFrame.current = 0;
        playerRef.current.scale.y = 1;
        playerRef.current.position.y = 0.5;
      }
    }
    
    // Update bounding box after position/scale changes
    playerBoundingBox.current.setFromObject(playerRef.current);
    
    // Check for collisions
    checkCollisions();
  });
  
  // Check for collisions with walls
  const checkCollisions = () => {
    if (!playerRef.current) return;
    
    for (let i = walls.current.length - 1; i >= 0; i--) {
      const wallGroup = walls.current[i];
      if (wallGroup.userData.collided) continue;
      
      let collisionDetected = false;
      
      if (wallGroup.userData.type === 'yellow') { // Duck under this
        const worldObstacleBox = wallGroup.userData.obstacleBox.clone().translate(wallGroup.position);
        if (playerBoundingBox.current.intersectsBox(worldObstacleBox)) {
          collisionDetected = true;
        }
      } else if (wallGroup.userData.type === 'white') { // Jump over/through this
        const worldLeftBox = wallGroup.userData.leftBox.clone().translate(wallGroup.position);
        const worldRightBox = wallGroup.userData.rightBox.clone().translate(wallGroup.position);
        
        if (playerBoundingBox.current.intersectsBox(worldLeftBox) || 
            playerBoundingBox.current.intersectsBox(worldRightBox)) {
          collisionDetected = true;
        }
      }
      
      if (collisionDetected) {
        wallGroup.userData.collided = true;
        // Game over is handled by parent component
        break;
      }
      
      // Scoring: if car passes the wall's origin successfully
      if (!wallGroup.userData.passed && wallGroup.position.z > playerRef.current.position.z + 1.5) {
        score.current++;
        onScoreChange(score.current);
        wallGroup.userData.passed = true;
      }
    }
  };
  
  return (
    <mesh
      ref={playerRef}
      position={[0, 0.5, 0]}
      castShadow
    >
      <boxGeometry args={[1.5, 1, 3]} />
      <meshStandardMaterial color="#FF9900" metalness={0.3} roughness={0.6} />
    </mesh>
  );
};

export default Player; 