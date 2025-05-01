import React, { useRef, useState, useEffect } from 'react';
import { Vector3, Mesh, CylinderGeometry } from 'three';
import { useFrame } from '@react-three/fiber';

interface BulletProps {
  position: Vector3;
  direction: Vector3;
}

const Bullet: React.FC<BulletProps> = ({ position, direction }) => {
  // Используем локальную копию позиции для отслеживания, что позиция обновляется
  const [localPosition, setLocalPosition] = useState(position.clone());
  const bulletRef = useRef<Mesh>(null);
  const tracerRef = useRef<Mesh>(null);
  
  // Синхронизируем локальную позицию с пропсом при изменении
  useEffect(() => {
    setLocalPosition(position.clone());
  }, [position.x, position.y, position.z]);
  
  // Обновляем положение и вращение пули на сцене
  useFrame((_, delta) => {
    if (bulletRef.current) {
      // Обновляем позицию
      bulletRef.current.position.copy(localPosition);
      
      // Поворачиваем пулю в направлении движения
      bulletRef.current.lookAt(localPosition.clone().add(direction));
      
      // Добавляем вращение вокруг оси движения
      bulletRef.current.rotateZ(delta * 15); // Скорость вращения
    }
    
    // Обновляем позицию и размер трассера
    if (tracerRef.current) {
      // Позиционируем трассер позади пули
      const tracerPosition = localPosition.clone().sub(direction.clone().multiplyScalar(0.3));
      tracerRef.current.position.copy(tracerPosition);
      
      // Поворачиваем трассер в направлении движения
      tracerRef.current.lookAt(localPosition);
    }
  });
  
  return (
    <>
      {/* Пуля */}
      <mesh ref={bulletRef} position={localPosition}>
        <cylinderGeometry args={[0.05, 0.05, 0.25, 8]} />
        <meshStandardMaterial 
          color="yellow" 
          emissive="orange" 
          emissiveIntensity={0.8} 
          metalness={0.7} 
          roughness={0.3} 
        />
      </mesh>
      
      {/* Трассер (светящийся след) */}
      <mesh ref={tracerRef} position={localPosition.clone().sub(direction.clone().multiplyScalar(0.3))}>
        <cylinderGeometry args={[0.015, 0.03, 0.6, 8]} />
        <meshStandardMaterial 
          color="orange" 
          emissive="yellow" 
          emissiveIntensity={1.5} 
          transparent={true} 
          opacity={0.7} 
        />
      </mesh>
    </>
  );
};

export default Bullet; 