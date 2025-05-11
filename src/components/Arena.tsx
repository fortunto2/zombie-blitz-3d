import React from 'react';
import * as THREE from 'three';

interface ArenaProps {
  roadWidth: number;
  roadLength: number;
}

const Arena: React.FC<ArenaProps> = ({ roadWidth, roadLength }) => {
  // Materials
  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
  const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x339933 });
  
  return (
    <>
      {/* Ground (grass) */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.05, 0]} 
        receiveShadow
      >
        <planeGeometry args={[roadWidth * 5, roadLength * 2]} />
        <meshStandardMaterial color="#339933" />
      </mesh>
      
      {/* Road */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0, 0]} 
        receiveShadow
      >
        <planeGeometry args={[roadWidth, roadLength * 2]} />
        <meshStandardMaterial color="#555555" />
      </mesh>
      
      {/* Sky (simply using scene background in Game component) */}
    </>
  );
};

export default Arena; 