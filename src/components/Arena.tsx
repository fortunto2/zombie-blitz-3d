import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Создаем несколько препятствий для арены
const obstacles = [
  { position: [5, 1, 5], size: [2, 2, 2] as [number, number, number] },
  { position: [-5, 1, 5], size: [2, 2, 2] as [number, number, number] },
  { position: [5, 1, -5], size: [2, 2, 2] as [number, number, number] },
  { position: [-5, 1, -5], size: [2, 2, 2] as [number, number, number] },
  { position: [0, 1, 8], size: [4, 2, 1] as [number, number, number] },
  { position: [0, 1, -8], size: [4, 2, 1] as [number, number, number] },
  { position: [8, 1, 0], size: [1, 2, 4] as [number, number, number] },
  { position: [-8, 1, 0], size: [1, 2, 4] as [number, number, number] },
];

const Arena: React.FC = () => {
  // Рефы для потенциальной анимации
  const floorRef = useRef<THREE.Mesh>(null);
  const wallsRef = useRef<THREE.Group>(null);
  
  return (
    <group>
      {/* Пол */}
      <mesh 
        ref={floorRef}
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0, 0]} 
        receiveShadow
      >
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
      
      {/* Стены арены */}
      <group ref={wallsRef}>
        {/* Северная стена */}
        <mesh position={[0, 2.5, -25]} castShadow receiveShadow>
          <boxGeometry args={[50, 5, 1]} />
          <meshStandardMaterial color="#555555" />
        </mesh>
        
        {/* Южная стена */}
        <mesh position={[0, 2.5, 25]} castShadow receiveShadow>
          <boxGeometry args={[50, 5, 1]} />
          <meshStandardMaterial color="#555555" />
        </mesh>
        
        {/* Восточная стена */}
        <mesh position={[25, 2.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[1, 5, 50]} />
          <meshStandardMaterial color="#555555" />
        </mesh>
        
        {/* Западная стена */}
        <mesh position={[-25, 2.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[1, 5, 50]} />
          <meshStandardMaterial color="#555555" />
        </mesh>
      </group>
      
      {/* Препятствия - коробки */}
      {obstacles.map((obstacle, index) => (
        <mesh 
          key={index} 
          position={new THREE.Vector3(...obstacle.position as [number, number, number])} 
          castShadow 
          receiveShadow
        >
          <boxGeometry args={obstacle.size} />
          <meshStandardMaterial color="#775533" />
        </mesh>
      ))}
    </group>
  );
};

export default Arena; 