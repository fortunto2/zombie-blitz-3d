import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Raycaster, Vector2, Mesh, Group } from 'three';
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

// Компонент модели оружия
const GunModel: React.FC = () => {
  const gunRef = useRef<Group>(null);
  
  useEffect(() => {
    if (!gunRef.current) return;
    
    // Создаем оружие (дробовик в руках игрока)
    const createShotgun = () => {
      // Ствол
      const barrelGeometry = new THREE.CylinderGeometry(0.03, 0.04, 0.7, 8);
      const barrelMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x333333, 
        shininess: 60 
      });
      const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
      barrel.rotation.x = Math.PI / 2; // Поворачиваем ствол горизонтально
      barrel.position.set(0, 0, -0.3);
      gunRef.current.add(barrel);
      
      // Второй ствол (дробовик с двумя стволами)
      const barrel2 = barrel.clone();
      barrel2.position.set(0, 0.05, -0.3);
      gunRef.current.add(barrel2);
      
      // Приклад
      const stockGeometry = new THREE.BoxGeometry(0.05, 0.1, 0.4);
      const stockMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x8B4513, // Коричневый для дерева
        shininess: 20 
      });
      const stock = new THREE.Mesh(stockGeometry, stockMaterial);
      stock.position.set(0, -0.05, 0.15);
      gunRef.current.add(stock);
      
      // Рукоятка
      const handleGeometry = new THREE.BoxGeometry(0.04, 0.15, 0.06);
      const handle = new THREE.Mesh(handleGeometry, stockMaterial);
      handle.position.set(0, -0.15, 0.05);
      handle.rotation.x = -Math.PI / 8; // Немного наклоняем рукоятку
      gunRef.current.add(handle);
      
      // Деталь между стволами и прикладом
      const middleGeometry = new THREE.BoxGeometry(0.1, 0.12, 0.1);
      const middleMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x000000, 
        shininess: 40 
      });
      const middle = new THREE.Mesh(middleGeometry, middleMaterial);
      middle.position.set(0, 0, 0);
      gunRef.current.add(middle);
      
      // Прицел
      const sightGeometry = new THREE.BoxGeometry(0.02, 0.03, 0.02);
      const sightMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x222222, 
        shininess: 50 
      });
      const sight = new THREE.Mesh(sightGeometry, sightMaterial);
      sight.position.set(0, 0.08, -0.3);
      gunRef.current.add(sight);
      
      // Блики на стволах для визуального эффекта
      const highlightGeometry = new THREE.PlaneGeometry(0.02, 0.4);
      const highlightMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.3,
        side: THREE.DoubleSide 
      });
      
      const highlight1 = new THREE.Mesh(highlightGeometry, highlightMaterial);
      highlight1.rotation.x = Math.PI / 2;
      highlight1.rotation.z = Math.PI / 2;
      highlight1.position.set(0.031, 0, -0.3);
      gunRef.current.add(highlight1);
      
      const highlight2 = new THREE.Mesh(highlightGeometry, highlightMaterial);
      highlight2.rotation.x = Math.PI / 2;
      highlight2.rotation.z = Math.PI / 2;
      highlight2.position.set(0.031, 0.05, -0.3);
      gunRef.current.add(highlight2);
      
      // Устанавливаем правильную позицию для отображения в камере
      gunRef.current.position.set(0.25, -0.25, -0.5);
      gunRef.current.rotation.set(0, 0, 0);
    };
    
    createShotgun();
  }, []);
  
  return <group ref={gunRef} />;
};

const Player: React.FC<PlayerProps> = ({
  position,
  velocity,
  setPosition,
  setVelocity,
  isLocked,
  isGameOver,
  onZombieHit,
  onShoot,
  onZombieHurt
}) => {
  const { camera, scene } = useThree();
  const playerRef = useRef<any>(null);
  const raycaster = useRef(new Raycaster());
  const mouse = useRef(new Vector2(0, 0)); // Центр экрана для raycaster
  const [bullets, setBullets] = useState<Array<BulletType>>([]);
  const [muzzleFlashes, setMuzzleFlashes] = useState<Array<MuzzleFlashType>>([]);
  
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
          break;
        case 'KeyS':
          keys.current.forward = true; // S двигает вперед
          break;
        case 'KeyA':
          keys.current.left = true;
          break;
        case 'KeyD':
          keys.current.right = true;
          break;
        // case 'Space':
        //   keys.current.space = true;
        //   // Прыжок только если игрок на земле
        //   if (isOnGround.current) {
        //     setVelocity(new Vector3(velocity.x, JUMP_FORCE, velocity.z));
        //     isOnGround.current = false;
        //   }
        //   break;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      switch(e.code) {
        case 'KeyW':
          keys.current.backward = false;
          break;
        case 'KeyS':
          keys.current.forward = false;
          break;
        case 'KeyA':
          keys.current.left = false;
          break;
        case 'KeyD':
          keys.current.right = false;
          break;
        // case 'Space':
        //   keys.current.space = false;
        //   break;
      }
    };
    
    // Обработка стрельбы
    const handleShoot = () => {
      if (!isLocked || isGameOver) return;
      
      // Воспроизводим звук выстрела, если передан соответствующий обработчик
      if (onShoot) {
        onShoot();
      }
      
      // Создаем эффект отдачи
      setRecoil(0.05);
      setTimeout(() => setRecoil(0), 150);
      
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
        if (parent && parent.userData && parent.userData.isZombie) {
          // Вызываем функцию для воспроизведения звука ранения зомби
          if (onZombieHurt) {
            // Use setTimeout to defer the state update
            setTimeout(() => onZombieHurt(), 0);
          }
          
          // Вызываем функцию нанесения урона зомби из компонента Zombies
          if (scene.userData.damageZombie) {
            scene.userData.damageZombie(parent.userData.id);
            
            // Увеличиваем счет только если зомби умирает (здоровье <= 0)
            if (parent.userData.health <= 34) { // Если это будет последний удар
              // Use setTimeout to defer the state update
              setTimeout(() => onZombieHit(parent.userData.id), 0); // Увеличиваем счет (но зомби не удаляем)
            }
          }
          
          console.log(`Пуля ${bullet.id.substring(0, 8)} попала в зомби!`);
          
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
    const arenaSize = 74; // Обновляем: чуть меньше размера арены (75) для учета размера игрока
    newPosition.x = Math.max(-arenaSize, Math.min(arenaSize, newPosition.x));
    newPosition.z = Math.max(-arenaSize, Math.min(arenaSize, newPosition.z));
    
    setPosition(newPosition);
    
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
  });
  
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
  
  // Добавляем состояние для анимации отдачи
  const [recoil, setRecoil] = useState<number>(0);
  const gunRef = useRef<Group>(null);
  
  // Позиционирование оружия с учетом отдачи
  useFrame(() => {
    if (gunRef.current) {
      // Базовая позиция
      gunRef.current.position.set(0.25, -0.25, -0.5);
      
      // Применяем отдачу если есть
      if (recoil > 0) {
        gunRef.current.position.z += recoil;
        gunRef.current.rotation.x -= recoil * 2;
      }
    }
  });
  
  return (
    <>
      <mesh ref={playerRef} position={position} visible={false}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color="blue" wireframe />
      </mesh>
      
      {bullets.map((bullet) => (
        <Bullet
          key={bullet.id}
          position={bullet.position}
          direction={bullet.direction}
          hasHit={bullet.hasHit}
          onHit={() => handleBulletHit(bullet.id)}
        />
      ))}
      
      {muzzleFlashes.map((flash) => (
        <MuzzleFlash
          key={flash.id}
          position={flash.position}
          direction={flash.direction}
        />
      ))}
      
      {/* Рендерим модель оружия в руках игрока (будет следовать за камерой) */}
      <group position={camera.position} rotation={camera.rotation} ref={gunRef}>
        <GunModel />
      </group>
    </>
  );
};

export default Player;