import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Создаем объекты на карте
const createHouses = (count: number, arenaSize: number) => {
  const houses = [];
  for (let i = 0; i < count; i++) {
    // Создаем позицию, избегая центр карты (где игрок появляется)
    let x, z;
    do {
      x = (Math.random() - 0.5) * (arenaSize * 1.7); 
      z = (Math.random() - 0.5) * (arenaSize * 1.7);
    } while (Math.sqrt(x * x + z * z) < 15); // Не размещаем дома близко к центру

    const width = 3 + Math.random() * 3;
    const height = 4 + Math.random() * 3;
    const depth = 3 + Math.random() * 3;

    houses.push({
      position: [x, height / 2, z],
      size: [width, height, depth],
      rotation: Math.random() * Math.PI * 2
    });
  }
  return houses;
};

// Создаем деревья
const createTrees = (count: number, arenaSize: number, houses: any[]) => {
  const trees = [];
  for (let i = 0; i < count; i++) {
    // Создаем позицию, проверяя расстояние до домов
    let x, z, isValid;
    do {
      x = (Math.random() - 0.5) * (arenaSize * 1.8);
      z = (Math.random() - 0.5) * (arenaSize * 1.8);
      
      // Проверяем, что дерево не внутри домов
      isValid = true;
      for (const house of houses) {
        const houseX = house.position[0];
        const houseZ = house.position[2];
        const houseWidth = house.size[0];
        const houseDepth = house.size[2];
        
        // Проверяем расстояние до дома
        const distToHouse = Math.sqrt(
          Math.pow(x - houseX, 2) + 
          Math.pow(z - houseZ, 2)
        );
        
        // Если дерево слишком близко к дому
        if (distToHouse < Math.max(houseWidth, houseDepth) / 2 + 3) {
          isValid = false;
          break;
        }
      }
      
      // Не размещаем деревья близко к центру
      if (Math.sqrt(x * x + z * z) < 10) {
        isValid = false;
      }
    } while (!isValid);

    const height = 3 + Math.random() * 5;
    const trunkRadius = 0.2 + Math.random() * 0.3;
    
    trees.push({
      position: [x, height / 2, z],
      trunk: {
        height: height,
        radius: trunkRadius
      },
      leaves: {
        height: height * 0.6,
        radius: 1.5 + Math.random() * 1
      },
      rotation: Math.random() * Math.PI * 2
    });
  }
  return trees;
};

// Новый размер арены
const ARENA_SIZE = 75; // Увеличиваем размер арены

// Создаем сугробы снега
const createSnowDrifts = (count: number, arenaSize: number) => {
  const drifts = [];
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * arenaSize * 1.8;
    const z = (Math.random() - 0.5) * arenaSize * 1.8;
    
    // Размеры сугроба
    const width = 5 + Math.random() * 10;
    const depth = 5 + Math.random() * 10;
    const height = 0.2 + Math.random() * 0.5; // Очень низкая высота
    
    drifts.push({
      position: [x, 0, z], // Строго на земле
      size: [width, height, depth],
      rotation: Math.random() * Math.PI * 2
    });
  }
  return drifts;
};

const Arena: React.FC = () => {
  // Рефы для потенциальной анимации
  const floorRef = useRef<THREE.Mesh>(null);
  const wallsRef = useRef<THREE.Group>(null);
  
  // Генерируем объекты на карте
  const houses = useMemo(() => createHouses(15, ARENA_SIZE), []);
  const trees = useMemo(() => createTrees(30, ARENA_SIZE, houses), [houses]);
  const snowDrifts = useMemo(() => createSnowDrifts(25, ARENA_SIZE), []);
  
  return (
    <group>
      {/* Пол (снег) */}
      <mesh 
        ref={floorRef}
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0, 0]} 
        receiveShadow
      >
        <planeGeometry args={[ARENA_SIZE * 2, ARENA_SIZE * 2]} />
        <meshStandardMaterial color="#e6f0ff" roughness={0.8} metalness={0.1} />
      </mesh>
      
      {/* Невидимые стены арены - увеличиваем размер соответственно ARENA_SIZE */}
      <group ref={wallsRef}>
        {/* Северная стена */}
        <mesh position={[0, 2.5, -ARENA_SIZE]} receiveShadow>
          <boxGeometry args={[ARENA_SIZE * 2, 5, 0.1]} />
          <meshStandardMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        
        {/* Южная стена */}
        <mesh position={[0, 2.5, ARENA_SIZE]} receiveShadow>
          <boxGeometry args={[ARENA_SIZE * 2, 5, 0.1]} />
          <meshStandardMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        
        {/* Восточная стена */}
        <mesh position={[ARENA_SIZE, 2.5, 0]} receiveShadow>
          <boxGeometry args={[0.1, 5, ARENA_SIZE * 2]} />
          <meshStandardMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        
        {/* Западная стена */}
        <mesh position={[-ARENA_SIZE, 2.5, 0]} receiveShadow>
          <boxGeometry args={[0.1, 5, ARENA_SIZE * 2]} />
          <meshStandardMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      
      {/* Дома */}
      {houses.map((house, index) => (
        <group key={`house-${index}`} position={new THREE.Vector3(...house.position)} rotation={[0, house.rotation, 0]}>
          {/* Основа дома */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[house.size[0], house.size[1], house.size[2]]} />
            <meshStandardMaterial color="#532e15" />
          </mesh>
          
          {/* Крыша */}
          <mesh 
            position={[0, house.size[1] / 2 + 0.5, 0]} 
            castShadow 
            receiveShadow
          >
            <coneGeometry args={[Math.max(house.size[0], house.size[2]) * 0.7, 2, 4]} />
            <meshStandardMaterial color="#5c0c0c" />
          </mesh>
          
          {/* Дверь */}
          <mesh 
            position={[0, -house.size[1] / 4, house.size[2] / 2 + 0.01]} 
            castShadow 
            receiveShadow
          >
            <planeGeometry args={[1, 2]} />
            <meshStandardMaterial color="#422006" />
          </mesh>
          
          {/* Окна */}
          <mesh 
            position={[-house.size[0] / 4, 0, house.size[2] / 2 + 0.01]} 
            castShadow 
            receiveShadow
          >
            <planeGeometry args={[1, 1]} />
            <meshStandardMaterial color="#87ceeb" emissive="#3a5e7b" emissiveIntensity={0.3} />
          </mesh>
          
          <mesh 
            position={[house.size[0] / 4, 0, house.size[2] / 2 + 0.01]} 
            castShadow 
            receiveShadow
          >
            <planeGeometry args={[1, 1]} />
            <meshStandardMaterial color="#87ceeb" emissive="#3a5e7b" emissiveIntensity={0.3} />
          </mesh>
        </group>
      ))}
      
      {/* Деревья */}
      {trees.map((tree, index) => (
        <group key={`tree-${index}`} position={new THREE.Vector3(...tree.position)}>
          {/* Ствол */}
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[tree.trunk.radius, tree.trunk.radius * 1.2, tree.trunk.height, 8]} />
            <meshStandardMaterial color="#3b2504" />
          </mesh>
          
          {/* Листья/Ветки (используем конус для заснеженных елок) */}
          <mesh 
            position={[0, tree.trunk.height * 0.1, 0]} 
            castShadow 
            receiveShadow
          >
            <coneGeometry args={[tree.leaves.radius, tree.leaves.height, 8]} />
            <meshStandardMaterial color="#1a472a" />
          </mesh>
          
          {/* Снег на ветках */}
          <mesh 
            position={[0, tree.trunk.height * 0.1 + 0.1, 0]} 
            castShadow 
            receiveShadow
          >
            <coneGeometry args={[tree.leaves.radius * 0.9, tree.leaves.height * 0.8, 8]} />
            <meshStandardMaterial color="#e6f0ff" transparent opacity={0.8} />
          </mesh>
        </group>
      ))}
      
      {/* Сугробы снега - стабильные плоские насыпи */}
      {snowDrifts.map((drift, index) => (
        <mesh 
          key={`drift-${index}`} 
          position={[drift.position[0], 0.01, drift.position[2]]}
          rotation={[0, drift.rotation, 0]}
          castShadow 
          receiveShadow
        >
          {/* Используем простой диск с небольшой высотой для снежной насыпи */}
          <cylinderGeometry 
            args={[
              drift.size[0] / 2, // Радиус верха 
              drift.size[0] / 2 * 1.2, // Немного больший радиус основания
              drift.size[1], // Высота (очень низкая)
              8, // Сегменты по окружности
              1, // Сегменты по высоте
              false // Замкнутый
            ]} 
          />
          <meshStandardMaterial color="#ffffff" roughness={1} />
        </mesh>
      ))}
      
      {/* Несколько препятствий в центре для геймплея */}
      <mesh position={[5, 1, 5]} castShadow receiveShadow>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#775533" />
      </mesh>
      
      <mesh position={[-5, 1, 5]} castShadow receiveShadow>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#775533" />
      </mesh>
      
      <mesh position={[5, 1, -5]} castShadow receiveShadow>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#775533" />
      </mesh>
      
      <mesh position={[-5, 1, -5]} castShadow receiveShadow>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#775533" />
      </mesh>
      
      {/* Добавим эффект тумана */}
      <fog attach="fog" args={['#d6e7ff', 20, 100]} />
    </group>
  );
};

export default Arena;