import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Raycaster, Mesh, Group } from 'three';
import * as THREE from 'three';
import Bullet from '../components/Bullet';
import { v4 as uuidv4 } from 'uuid';

interface PlayerProps {
  position: Vector3;
  velocity: Vector3;
  setPosition: (pos: Vector3) => void;
  setVelocity: (vel: Vector3) => void;
  isLocked: boolean;
  isGameOver: boolean;
  onZombieHit: (zombieId: string) => void;
  onShoot?: () => void;
  onZombieHurt?: () => void;
  onUpdateDirection?: (direction: Vector3) => void;
  setPlayerPosition?: (pos: Vector3) => void;
  onShot?: (position: Vector3, direction: Vector3) => void;
}

interface BulletType {
  id: string;
  position: Vector3;
  direction: Vector3;
  hasHit: boolean;
  createdAt: number;
}

interface MuzzleFlashType {
  id: string;
  position: Vector3;
  direction: Vector3;
  createdAt: number;
}

const Player: React.FC<PlayerProps> = ({
  position,
  velocity,
  setPosition,
  setVelocity,
  isLocked,
  isGameOver,
  onZombieHit,
  onShoot,
  onZombieHurt,
  onUpdateDirection,
  setPlayerPosition,
  onShot
}) => {
  const { camera, scene } = useThree();
  const playerRef = useRef<any>(null);
  const raycaster = useRef(new Raycaster());
  const [bullets, setBullets] = useState<Array<BulletType>>([]);
  const [muzzleFlashes, setMuzzleFlashes] = useState<Array<MuzzleFlashType>>([]);
  const gunRef = useRef<Group>(null);
  const lastShootTime = useRef<number>(0);
  const isMoving = useRef<boolean>(false);
  
  // Физические параметры
  const GRAVITY = 20;
  const JUMP_FORCE = 8;
  const MOVEMENT_SPEED = 8; // Увеличенная скорость движения
  const BULLET_SPEED = 80; // Увеличиваем скорость пули (было 50)
  
  // Клавиши управления
  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    space: false,
  });
  
  // Флаг для отслеживания, находится ли игрок на земле
  const isOnGround = useRef(true);
  
  // Настройка камеры
  useEffect(() => {
    camera.position.set(position.x, position.y + 1.6, position.z);
  }, [camera, position]);
  
  // Обработка нажатий клавиш
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLocked) return;
      
      switch(e.code) {
        case 'KeyW':
          keys.current.backward = true; // W двигает назад
          isMoving.current = true;
          break;
        case 'KeyS':
          keys.current.forward = true; // S двигает вперед
          isMoving.current = true;
          break;
        case 'KeyA':
          keys.current.left = true;
          isMoving.current = true;
          break;
        case 'KeyD':
          keys.current.right = true;
          isMoving.current = true;
          break;
        case 'Space':
          keys.current.space = true;
          // Прыжок только если игрок на земле
          if (isOnGround.current) {
            setVelocity(new Vector3(velocity.x, JUMP_FORCE, velocity.z));
            isOnGround.current = false;
          }
          break;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      switch(e.code) {
        case 'KeyW':
          keys.current.backward = false;
          if (!keys.current.forward && !keys.current.left && !keys.current.right) isMoving.current = false;
          break;
        case 'KeyS':
          keys.current.forward = false;
          if (!keys.current.backward && !keys.current.left && !keys.current.right) isMoving.current = false;
          break;
        case 'KeyA':
          keys.current.left = false;
          if (!keys.current.forward && !keys.current.backward && !keys.current.right) isMoving.current = false;
          break;
        case 'KeyD':
          keys.current.right = false;
          if (!keys.current.forward && !keys.current.left && !keys.current.backward) isMoving.current = false;
          break;
        case 'Space':
          keys.current.space = false;
          break;
      }
    };
    
    // Обработка стрельбы
    const handleShoot = () => {
      if (!isLocked || isGameOver) return;
      
      const now = Date.now();
      lastShootTime.current = now;
      
      // Воспроизводим звук выстрела, если передан соответствующий обработчик
      if (onShoot) {
        onShoot();
      }
      
      // Создаем новую пулю
      const bulletId = uuidv4();
      const bulletPosition = new Vector3(camera.position.x, camera.position.y, camera.position.z);
      
      // Направление пули совпадает с направлением камеры
      const bulletDirection = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
      
      console.log(`Выстрел! ID: ${bulletId.substring(0, 8)}, Позиция: ${bulletPosition.x.toFixed(2)}, ${bulletPosition.y.toFixed(2)}, ${bulletPosition.z.toFixed(2)}`);
      
      // Добавляем пулю в список с временной меткой создания
      setBullets(prev => [...prev, { 
        id: bulletId, 
        position: bulletPosition, 
        direction: bulletDirection, 
        hasHit: false,
        createdAt: Date.now()
      }]);
      
      // Создаем вспышку выстрела
      const muzzleFlashId = uuidv4();
      // Позиция немного впереди камеры
      const muzzlePosition = bulletPosition.clone().addScaledVector(bulletDirection, 0.6);
      
      // Добавляем вспышку
      setMuzzleFlashes(prev => [...prev, { 
        id: muzzleFlashId, 
        position: muzzlePosition,
        direction: bulletDirection,
        createdAt: Date.now()
      }]);
    };
    
    const handleClick = () => {
      handleShoot();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('click', handleClick);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('click', handleClick);
    };
  }, [camera, isLocked, isGameOver, scene, onZombieHit, velocity, setVelocity, onShoot]);
  
  // Проверка столкновения пули с зомби
  const checkBulletCollisions = (bullet: BulletType): BulletType => {
    if (bullet.hasHit) return bullet; // Пуля уже попала в цель
    
    // Создаем raycast из текущей позиции пули в направлении ее движения
    raycaster.current.set(bullet.position, bullet.direction);
    // Увеличиваем дальность проверки для более легкого попадания
    const intersects = raycaster.current.intersectObjects(scene.children, true);
    
    for (let i = 0; i < intersects.length; i++) {
      const intersect = intersects[i];
      // Проверяем, не попала ли пуля в какой-либо объект
      // Увеличиваем расстояние проверки с 0.5 до 1.5 для более легкого попадания
      if (intersect.distance < 1.5) { // Увеличенная зона попадания
        // Проверяем, попали ли в зомби
        const parent = intersect.object.parent;
        
        // Проверяем, является ли объект головой зомби
        const isHeadshot = intersect.object.userData && intersect.object.userData.isHead === true;
        
        if (parent && parent.userData && parent.userData.isZombie) {
          // Вызываем функцию для воспроизведения звука ранения зомби
          if (onZombieHurt) {
            // Use setTimeout to defer the state update
            setTimeout(() => onZombieHurt(), 0);
          }
          
          // Вызываем функцию нанесения урона зомби из компонента Zombies
          if (scene.userData.damageZombie) {
            scene.userData.damageZombie(parent.userData.id, false, isHeadshot);
          }
          
          console.log(`Пуля ${bullet.id.substring(0, 8)} попала в зомби! ${isHeadshot ? 'ХЕДШОТ!' : ''}`);
          
          // Помечаем пулю как попавшую в цель
          return { ...bullet, hasHit: true };
        }
        
        console.log(`Пуля ${bullet.id.substring(0, 8)} попала в препятствие!`);
        
        // Попали в препятствие (не зомби)
        return { ...bullet, hasHit: true };
      }
    }
    
    return bullet; // Пуля не попала ни в какой объект
  };
  
  // Основной игровой цикл
  useFrame((_, delta) => {
    if (isGameOver) return;
    
    // Применяем гравитацию к скорости по Y
    const newVelocityY = velocity.y - GRAVITY * delta;
    
    // Вектор направления из поворота камеры
    const direction = new Vector3();
    const frontVector = new Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
    const sideVector = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    
    // Обновление направления в зависимости от нажатых клавиш
    direction
      .subVectors(new Vector3(), frontVector)
      .multiplyScalar(Number(keys.current.backward) - Number(keys.current.forward))
      .addScaledVector(sideVector, Number(keys.current.right) - Number(keys.current.left))
      .normalize();
      
    // Обновление скорости и позиции
    let newPosition = position.clone();
    
    // Обновляем горизонтальное движение
    if (keys.current.forward || keys.current.backward || keys.current.left || keys.current.right) {
      const horizontalVelocity = new Vector3(
        direction.x * MOVEMENT_SPEED * delta,
        0,
        direction.z * MOVEMENT_SPEED * delta
      );
      
      newPosition.add(horizontalVelocity);
    }
    
    // Обновляем вертикальное движение (прыжок/падение)
    newPosition.y += newVelocityY * delta;
    
    // Проверка столкновения с землей
    if (newPosition.y <= 1) { // Y позиция земли
      newPosition.y = 1;
      isOnGround.current = true;
      setVelocity(new Vector3(velocity.x, 0, velocity.z));
    } else {
      isOnGround.current = false;
      setVelocity(new Vector3(velocity.x, newVelocityY, velocity.z));
    }
    
    // Обновление позиции с учетом коллизий
    // В простом случае не даем выйти за пределы арены
    const arenaSize = 24;  // Чуть меньше размера арены (25) для учета размера игрока
    newPosition.x = Math.max(-arenaSize, Math.min(arenaSize, newPosition.x));
    newPosition.z = Math.max(-arenaSize, Math.min(arenaSize, newPosition.z));
    
    setPosition(newPosition);
    
    // Обновляем позицию игрока для мини-карты сразу после обновления основной позиции
    if (setPlayerPosition) {
      setPlayerPosition(newPosition.clone());
    }
    
    // Обновление позиции камеры
    camera.position.x = newPosition.x;
    camera.position.y = newPosition.y + 1.6; // Высота глаз игрока
    camera.position.z = newPosition.z;
    
    // Обновление пуль
    if (bullets.length > 0) {
      setBullets(prevBullets => {
        const updatedBullets = prevBullets.map(bullet => {
          // Пропускаем пули, которые уже попали в цель
          if (bullet.hasHit) return bullet;
          
          // Обновляем позицию пули
          const newBulletPosition = bullet.position.clone().addScaledVector(bullet.direction, BULLET_SPEED * delta);
          
          // Отладочный вывод позиции пули (только для каждой 10-й пули и каждые 0.5 секунд)
          if (Math.random() < 0.01) {
            console.log(`Пуля ${bullet.id.substring(0, 8)} движется: ${bullet.position.x.toFixed(2)}, ${bullet.position.y.toFixed(2)}, ${bullet.position.z.toFixed(2)} -> ${newBulletPosition.x.toFixed(2)}, ${newBulletPosition.y.toFixed(2)}, ${newBulletPosition.z.toFixed(2)}`);
          }
          
          const updatedBullet = {
            ...bullet,
            position: newBulletPosition
          };
          
          // Проверяем столкновения пули с объектами
          const bulletWithCollision = checkBulletCollisions(updatedBullet);
          
          // Проверяем, не вышла ли пуля за пределы арены
          if (
            Math.abs(newBulletPosition.x) > arenaSize + 5 ||
            Math.abs(newBulletPosition.z) > arenaSize + 5 ||
            newBulletPosition.y < 0 ||
            newBulletPosition.y > 20
          ) {
            return { ...bulletWithCollision, hasHit: true }; // Помечаем для удаления
          }
          
          return bulletWithCollision;
        });
        
        return updatedBullets.filter(bullet => {
          const bulletLifespan = 2.0; // Пуля существует 2 секунды
          const bulletAge = (Date.now() - bullet.createdAt) / 1000;
          
          // Если пуля слишком старая или попала в цель, выводим отладочную информацию
          if (bulletAge >= bulletLifespan) {
            console.log(`Пуля ${bullet.id.substring(0, 8)} удалена: превышено время жизни (${bulletAge.toFixed(2)}s)`);
            return false;
          }
          
          if (bullet.hasHit) {
            console.log(`Пуля ${bullet.id.substring(0, 8)} удалена: попадание`);
            return false;
          }
          
          return true;
        });
      });
    }
    
    // Обновление вспышек выстрелов
    if (muzzleFlashes.length > 0) {
      setMuzzleFlashes(prevFlashes => {
        // Удаляем вспышки через короткое время (100мс)
        return prevFlashes.filter(flash => {
          return Date.now() - flash.createdAt < 100;
        });
      });
    }
    
    // Анимация оружия
    if (gunRef.current) {
      // Получаем текущее время
      const now = Date.now();
      
      // Обновляем позицию оружия, чтобы оно всегда было перед камерой и смещено вправо
      gunRef.current.position.set(0.3, -0.35, -0.7); // Смещаем вправо (было 0, -0.35, -0.7)
      
      // Плавное движение при ходьбе
      if (isMoving.current) {
        const walkOffset = Math.sin(now * 0.01) * 0.01;
        gunRef.current.position.y += walkOffset;
        gunRef.current.rotation.x = Math.sin(now * 0.01) * 0.02;
        gunRef.current.rotation.z = Math.sin(now * 0.01) * 0.01;
      } else {
        // Плавное дыхание, когда игрок стоит на месте
        const breathOffset = Math.sin(now * 0.001) * 0.005;
        gunRef.current.position.y += breathOffset;
      }
      
      // Эффект отдачи при стрельбе
      const timeSinceLastShot = now - lastShootTime.current;
      if (timeSinceLastShot < 150) { // Анимация отдачи длится 150мс
        const recoilProgress = timeSinceLastShot / 150; // От 0 до 1
        const recoilCurve = 1 - recoilProgress; // Начинается с 1 и снижается до 0
        
        // Отдача назад и вверх
        gunRef.current.position.z += recoilCurve * 0.1; // Смещение назад
        gunRef.current.rotation.x -= recoilCurve * 0.1; // Поворот вверх
      }
    }
    
    // Передаем направление взгляда игрока
    if (onUpdateDirection) {
      const cameraDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraDirection);
      onUpdateDirection(cameraDirection);
      
      // Если функция onShot определена, вызываем ее
      if (onShot) {
        onShot(playerRef.current.position.clone(), cameraDirection);
      }
    }
  });
  
  // Компонент MP5
  const MP5 = () => {
    // Создаем группу для всего оружия
    return (
      <group ref={gunRef} position={[0.3, -0.35, -0.7]}>
        {/* Основной корпус автомата */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.08, 0.08, 0.5]} />
          <meshStandardMaterial color="black" metalness={0.7} roughness={0.3} />
        </mesh>
        
        {/* Магазин */}
        <mesh position={[0, -0.1, 0.05]}>
          <boxGeometry args={[0.06, 0.18, 0.12]} />
          <meshStandardMaterial color="black" metalness={0.7} roughness={0.3} />
        </mesh>
        
        {/* Ствол */}
        <mesh position={[0, 0.01, -0.3]}>
          <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
          <meshStandardMaterial color="#333" metalness={0.9} roughness={0.2} />
        </mesh>
        
        {/* Рукоятка */}
        <mesh position={[0, -0.08, 0.15]}>
          <boxGeometry args={[0.06, 0.15, 0.08]} />
          <meshStandardMaterial color="#222" metalness={0.5} roughness={0.5} />
        </mesh>
        
        {/* Приклад */}
        <mesh position={[0, 0, 0.3]}>
          <boxGeometry args={[0.06, 0.06, 0.15]} />
          <meshStandardMaterial color="#222" metalness={0.5} roughness={0.5} />
        </mesh>
        
        {/* Прицел */}
        <mesh position={[0, 0.06, 0.1]}>
          <boxGeometry args={[0.03, 0.02, 0.08]} />
          <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
        </mesh>
        
        {/* Передняя рукоятка */}
        <mesh position={[0, -0.06, -0.15]}>
          <boxGeometry args={[0.05, 0.08, 0.05]} />
          <meshStandardMaterial color="#222" metalness={0.5} roughness={0.5} />
        </mesh>
      </group>
    );
  };
  
  // Компонент вспышки выстрела
  const MuzzleFlash = ({ position, direction }: { position: Vector3; direction: Vector3 }) => {
    const flashRef = useRef<Mesh>(null);
    
    useFrame(() => {
      if (flashRef.current) {
        // Всегда поворачиваем вспышку в направлении выстрела
        flashRef.current.lookAt(position.clone().add(direction));
        // Добавляем случайный поворот для более динамичного эффекта
        flashRef.current.rotation.z = Math.random() * Math.PI * 2;
      }
    });
    
    return (
      <mesh ref={flashRef} position={position}>
        <circleGeometry args={[0.2, 8]} />
        <meshBasicMaterial 
          color="orange" 
          transparent={true}
          opacity={0.9}
        />
      </mesh>
    );
  };
  
  return (
    <>
      <mesh ref={playerRef} position={position} visible={false}>
        <capsuleGeometry args={[0.5, 1, 1, 16]} />
        <meshStandardMaterial wireframe color="red" />
      </mesh>
      
      {/* Добавляем MP5 как дочерний элемент камеры */}
      <primitive object={camera}>
        <MP5 />
      </primitive>
      
      {/* Рендеринг всех пуль */}
      {bullets.map(bullet => (
        <Bullet 
          key={bullet.id} 
          position={bullet.position} 
          direction={bullet.direction} 
        />
      ))}
      
      {/* Рендеринг вспышек выстрелов */}
      {muzzleFlashes.map(flash => (
        <MuzzleFlash
          key={flash.id}
          position={flash.position}
          direction={flash.direction}
        />
      ))}
    </>
  );
};

export default Player; 