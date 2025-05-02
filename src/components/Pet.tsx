import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Group, Mesh, Box3 } from 'three';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';

interface PetProps {
  playerPosition: Vector3;
  isEnabled: boolean;
  isGameOver: boolean;
  onPlaySound?: (soundType: 'bark' | 'bite') => void;
  updatePosition?: (position: Vector3 | null, direction?: Vector3) => void;
}

interface ZombieTarget {
  id: string;
  position: Vector3;
  distance: number;
}

const Pet: React.FC<PetProps> = ({ playerPosition, isEnabled, isGameOver, onPlaySound, updatePosition }) => {
  const { scene } = useThree();
  const petRef = useRef<Group>(null);
  const targetPosition = useRef(new Vector3());
  const petVelocity = useRef(new Vector3());
  const lastAttackTime = useRef(0);
  const lastBarkTime = useRef(0);
  const attackCooldown = 1500; // 1.5 секунды между атаками
  const barkCooldown = 5000; // 5 секунд между лаем
  const [isAttacking, setIsAttacking] = useState(false);
  const [targetZombieId, setTargetZombieId] = useState<string | null>(null);
  const headRef = useRef<Mesh>(null);
  const tailRef = useRef<Mesh>(null);
  const jawRef = useRef<Mesh>(null);
  const petId = useRef(uuidv4());
  
  // Сохраняем последнюю позицию питомца, чтобы избежать телепортации
  const petPosition = useRef(new Vector3(
    playerPosition.x + (Math.random() - 0.5) * 10, 
    0.5, 
    playerPosition.z + (Math.random() - 0.5) * 10
  ));
  
  // Флаг инициализации для отслеживания первого рендера
  const isInitialized = useRef(false);
  
  // Режимы поведения собаки
  const [behaviorMode, setBehaviorMode] = useState<'follow' | 'hunt' | 'wander'>('wander');
  const wanderTimer = useRef(0);
  const wanderDuration = 10000; // Время в режиме блуждания (10 сек)
  const lastWanderChangeTime = useRef(0);
  const wanderChangeInterval = 3000; // Меняем направление в режиме блуждания каждые 3 сек
  
  // Параметры питомца
  const PET_SPEED = 7;
  const FOLLOW_DISTANCE = 8; // Увеличенное расстояние от игрока, на котором питомец начинает следовать
  const DETECT_ZOMBIE_RANGE = 12; // Увеличили радиус обнаружения зомби
  const ATTACK_RANGE = 1.5; // Расстояние атаки зомби
  
  // Инициализация питомца при монтировании
  useEffect(() => {
    // Если питомец не включен, не создаем его
    if (!isEnabled) return;
    
    console.log('Инициализация питомца');
    
    // Создаем функцию для атаки зомби
    const attackZombie = (zombieId: string) => {
      const now = Date.now();
      
      // Проверяем кулдаун атаки
      if (now - lastAttackTime.current < attackCooldown) {
        return; // Еще не готов атаковать
      }
      
      lastAttackTime.current = now;
      
      // Воспроизводим звук укуса
      if (onPlaySound) {
        onPlaySound('bite');
      }
      
      // Используем функцию нанесения урона зомби из глобального userData
      if (scene.userData.damageZombie) {
        scene.userData.damageZombie(zombieId, true); // передаем true для обозначения атаки питомца
        console.log(`Питомец атаковал зомби ${zombieId}`);
        
        // Устанавливаем состояние атаки для анимации
        setIsAttacking(true);
        
        // Сбрасываем состояние атаки через 300мс
        setTimeout(() => {
          setIsAttacking(false);
        }, 300);
      }
    };
    
    // Регистрируем функцию атаки, чтобы она была доступна в других местах
    scene.userData.petAttackZombie = attackZombie;
    
    // Сразу переходим в режим охоты/блуждания при старте игры
    setBehaviorMode('wander');
    wanderTimer.current = Date.now();
    
    // Воспроизводим звук лая при начале блуждания
    if (onPlaySound) {
      onPlaySound('bark');
    }
    
    return () => {
      // Удаляем функцию атаки при размонтировании
      delete scene.userData.petAttackZombie;
    };
  }, [scene, isEnabled, onPlaySound]);
  
  // Создание и обновление питомца
  useFrame((_, delta) => {
    if (!isEnabled || isGameOver) return;
    
    // Только при первом рендере создаём питомца в случайной позиции
    if (!isInitialized.current && petRef.current) {
      // Устанавливаем начальную позицию питомца (случайная позиция вокруг игрока)
      const randomOffset = new Vector3(
        (Math.random() - 0.5) * 10, // более широкий разброс
        0,
        (Math.random() - 0.5) * 10
      );
      
      petRef.current.position.copy(playerPosition).add(randomOffset);
      petPosition.current.copy(petRef.current.position);
      
      isInitialized.current = true;
      
      // Устанавливаем начальную цель движения
      targetPosition.current.copy(petRef.current.position).add(
        new Vector3((Math.random() - 0.5) * 5, 0, (Math.random() - 0.5) * 5)
      );
      
      return; // Пропускаем первый кадр
    }
    
    // Создаем питомца, если его еще нет
    if (!petRef.current) {
      return;
    }
    
    // Обновляем сохраненную позицию питомца
    petPosition.current.copy(petRef.current.position);
    
    // Вспомогательные анимации
    animateTail(delta);
    animateHead(delta);
    animateJaw(delta);
    
    const now = Date.now();
    
    // Обработка звуков: лай собаки периодически
    if (now - lastBarkTime.current > barkCooldown && 
        (behaviorMode === 'wander' || Math.random() < 0.1)) {
      lastBarkTime.current = now;
      if (onPlaySound) {
        onPlaySound('bark');
      }
    }
    
    // Переключение режимов поведения - фокусируемся на охоте и блуждании
    if (behaviorMode === 'wander' && (now - wanderTimer.current > wanderDuration)) {
      wanderTimer.current = now; // Просто обновляем таймер и продолжаем блуждать
    } else if (behaviorMode === 'follow') {
      // Из режима следования быстро переходим в блуждание
      setBehaviorMode('wander');
      wanderTimer.current = now;
    }
    
    // Находим ближайшего зомби для атаки
    let closestZombieForAttack: ZombieTarget | null = null;
    let closestDistanceForAttack = DETECT_ZOMBIE_RANGE;
    
    // Перебираем всех зомби в сцене
    scene.children.forEach((child) => {
      if (child.userData && child.userData.isZombie && !child.userData.isDying) {
        const zombiePosition = child.position.clone();
        const distanceToZombie = petRef.current!.position.distanceTo(zombiePosition);
        
        // Если нашли более близкого зомби
        if (distanceToZombie < closestDistanceForAttack) {
          closestZombieForAttack = {
            id: child.userData.id,
            position: zombiePosition,
            distance: distanceToZombie
          };
          closestDistanceForAttack = distanceToZombie;
        }
      }
    });
    
    // Если найден зомби, обязательно переходим в режим охоты
    if (closestZombieForAttack) {
      if (behaviorMode !== 'hunt') {
        setBehaviorMode('hunt');
      }
      // Мгновенно обрабатываем охоту, чтобы не ждать следующего кадра
      handleHuntMode(closestZombieForAttack, now);
    } else if (behaviorMode === 'hunt') {
      // Если нет зомби, но были в режиме охоты, возвращаемся к блужданию
      setBehaviorMode('wander');
      wanderTimer.current = now;
      // Сразу обрабатываем блуждание
      handleWanderMode(now);
    }
    
    // Определяем целевую позицию для питомца в зависимости от режима, если она не была установлена выше
    if (behaviorMode === 'wander') {
      handleWanderMode(now);
    } else if (behaviorMode === 'follow') {
      handleFollowMode();
    }
    
    // Вычисляем направление движения
    const direction = new Vector3()
      .subVectors(targetPosition.current, petRef.current!.position)
      .normalize();
    
    // Если расстояние до цели достаточно большое, двигаем питомца
    const distanceToTarget = petRef.current!.position.distanceTo(targetPosition.current);
    
    if (distanceToTarget > 0.5) {
      // Поворачиваем питомца в направлении движения
      if (direction.length() > 0.1) {
        const targetAngle = Math.atan2(direction.x, direction.z);
        let currentAngle = petRef.current!.rotation.y;
        
        // Нормализуем угол для плавного поворота
        const angleDiff = targetAngle - currentAngle;
        let normalizedDiff = angleDiff;
        while (normalizedDiff > Math.PI) normalizedDiff -= Math.PI * 2;
        while (normalizedDiff < -Math.PI) normalizedDiff -= Math.PI * 2;
        
        // Плавный поворот
        petRef.current!.rotation.y += normalizedDiff * Math.min(1, delta * 10);
        
        // Вычисляем скорость в зависимости от цели
        let speed = PET_SPEED;
        
        // Если атакуем или следуем за зомби, увеличиваем скорость
        if (targetZombieId !== null) {
          speed = PET_SPEED * 1.3;
        }
        
        // В режиме блуждания скорость ниже
        if (behaviorMode === 'wander') {
          speed = PET_SPEED * 0.7;
        }
        
        // Применяем скорость
        petVelocity.current.copy(direction).multiplyScalar(speed * delta);
        
        // Обновляем позицию
        petRef.current!.position.add(petVelocity.current);
        
        // Ограничиваем в пределах арены
        const arenaSize = 23.5; // Чуть меньше, чтобы не застревать в стенах
        
        // Проверяем, не вышел ли питомец за границы арены
        const distanceFromCenter = Math.sqrt(
          petRef.current!.position.x * petRef.current!.position.x + 
          petRef.current!.position.z * petRef.current!.position.z
        );
        
        // Если вышел, возвращаем его внутрь арены
        if (distanceFromCenter > arenaSize) {
          const directionToCenter = new Vector3(
            -petRef.current!.position.x, 
            0, 
            -petRef.current!.position.z
          ).normalize();
          
          // Корректируем позицию, чтобы вернуться внутрь арены
          petRef.current!.position.x = directionToCenter.x * -arenaSize * 0.95;
          petRef.current!.position.z = directionToCenter.z * -arenaSize * 0.95;
          
          // Меняем целевую позицию к центру арены
          targetPosition.current.copy(new Vector3(0, 0, 0)); 
        }
        
        petRef.current!.position.x = Math.max(-arenaSize, Math.min(arenaSize, petRef.current!.position.x));
        petRef.current!.position.z = Math.max(-arenaSize, Math.min(arenaSize, petRef.current!.position.z));
      }
    }
    
    // Обновляем позицию питомца
    petPosition.current.copy(petRef.current!.position);
    
    // Передаем обновленную позицию и направление для мини-карты
    if (updatePosition) {
      // Определяем направление взгляда питомца из его поворота
      const petDirection = new THREE.Vector3(0, 0, 1)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), petRef.current!.rotation.y);
      
      updatePosition(petPosition.current.clone(), petDirection);
    }
  });
  
  // Режим охоты: атакуем и преследуем зомби
  const handleHuntMode = (zombie: ZombieTarget, now: number) => {
    if (zombie.distance < ATTACK_RANGE) {
      // Зомби в пределах атаки, атакуем
      if (targetZombieId !== zombie.id) {
        setTargetZombieId(zombie.id);
      }
      
      // Если кулдаун атаки прошел, атакуем зомби
      if (now - lastAttackTime.current >= attackCooldown) {
        if (scene.userData.petAttackZombie) {
          scene.userData.petAttackZombie(zombie.id);
        }
      }
      
      // Немного отходим от зомби для подготовки к следующей атаке
      const directionFromZombie = new Vector3()
        .subVectors(petRef.current!.position, zombie.position)
        .normalize()
        .multiplyScalar(1.2);
        
      targetPosition.current.copy(zombie.position).add(directionFromZombie);
    } else {
      // Зомби в пределах обнаружения, бежим к нему
      if (targetZombieId !== zombie.id) {
        setTargetZombieId(zombie.id);
      }
      
      // Создаем более естественное преследование, избегая телепортации
      // Устанавливаем цель чуть впереди зомби, учитывая его движение
      const zombieObject = scene.children.find(child => 
        child.userData && child.userData.isZombie && child.userData.id === zombie.id
      );
      
      if (zombieObject && zombieObject.userData.velocity) {
        // Предугадываем движение зомби для интерсепции
        const zombieVelocity = zombieObject.userData.velocity;
        const interceptPoint = zombie.position.clone().add(
          new Vector3(zombieVelocity.x, 0, zombieVelocity.z).multiplyScalar(0.5)
        );
        targetPosition.current.copy(interceptPoint);
      } else {
        // Если нет информации о скорости, просто бежим к текущей позиции зомби
        targetPosition.current.copy(zombie.position);
      }
    }
  };
  
  // Режим блуждания: собака свободно перемещается по карте
  const handleWanderMode = (now: number) => {
    // Сбрасываем цель зомби, если была
    if (targetZombieId !== null) {
      setTargetZombieId(null);
    }
    
    // Меняем направление блуждания периодически
    if (now - lastWanderChangeTime.current > wanderChangeInterval) {
      lastWanderChangeTime.current = now;
      
      // Случайное направление блуждания с увеличенной дистанцией
      const randomAngle = Math.random() * Math.PI * 2;
      const randomDistance = 5 + Math.random() * 10; // 5-15 единиц (умереннее)
      
      const wanderOffset = new Vector3(
        Math.cos(randomAngle) * randomDistance,
        0,
        Math.sin(randomAngle) * randomDistance
      );
      
      // Отталкиваемся от текущей позиции питомца
      const petCurrentPosition = petRef.current!.position.clone();
      const potentialPosition = petCurrentPosition.clone().add(wanderOffset);
      
      // Проверяем границы арены
      const arenaSize = 23; // Размер арены
      const distanceFromCenter = Math.sqrt(
        potentialPosition.x * potentialPosition.x + 
        potentialPosition.z * potentialPosition.z
      );
      
      // Если выходит за границы арены, корректируем
      if (distanceFromCenter > arenaSize) {
        const toCenter = new Vector3(-potentialPosition.x, 0, -potentialPosition.z).normalize();
        
        // Корректируем направление к центру арены
        toCenter.x += (Math.random() - 0.5) * 0.5; // Небольшое случайное отклонение
        toCenter.z += (Math.random() - 0.5) * 0.5;
        toCenter.normalize();
        
        targetPosition.current = petCurrentPosition.clone()
          .add(toCenter.multiplyScalar(randomDistance * 0.7));
      } else {
        targetPosition.current = potentialPosition;
      }
    }
  };
  
  // Режим следования: собака следует за игроком
  const handleFollowMode = () => {
    // Сбрасываем цель зомби, если была
    if (targetZombieId !== null) {
      setTargetZombieId(null);
    }
    
    const distanceToPlayer = petRef.current!.position.distanceTo(playerPosition);
    
    // Если питомец очень далеко от игрока, приближаемся к нему
    if (distanceToPlayer > FOLLOW_DISTANCE * 3) {
      // Вычисляем позицию за игроком
      const camera = scene.getObjectByProperty('isCamera', true) as THREE.Camera;
      
      if (camera && camera.quaternion) {
        // Определяем позицию за игроком
        const playerDirection = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
        
        // Позиция немного позади и сбоку от игрока
        const offsetX = (Math.random() - 0.5) * 2; // Случайное смещение по X
        const petOffset = new Vector3(offsetX, 0, 2).applyQuaternion(camera.quaternion);
        
        // Новая целевая позиция относительно игрока
        targetPosition.current.copy(playerPosition).add(petOffset);
      } else {
        // Если камера недоступна, просто идем к игроку
        const directionToPlayer = new Vector3().subVectors(playerPosition, petRef.current!.position).normalize();
        const randomOffset = new Vector3(
          (Math.random() - 0.5) * 2,
          0,
          (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(2);
        
        targetPosition.current.copy(playerPosition).add(randomOffset);
      }
    } else {
      // Если питомец близко к игроку, переключаемся на режим блуждания
      setBehaviorMode('wander');
      lastWanderChangeTime.current = Date.now() - wanderChangeInterval; // Чтобы сразу сменить направление
    }
  };
  
  // Анимация хвоста
  const animateTail = (delta: number) => {
    if (tailRef.current) {
      // Базовое махание хвостом
      const tailWag = Math.sin(Date.now() / 200) * 0.5;
      
      // Если атакуем, хвост более активный
      if (isAttacking || targetZombieId !== null) {
        tailRef.current.rotation.z = tailWag * 2;
      } else if (behaviorMode === 'wander') {
        // В режиме блуждания - активное махание хвостом
        tailRef.current.rotation.z = tailWag * 1.5;
      } else {
        tailRef.current.rotation.z = tailWag;
      }
    }
  };
  
  // Анимация головы
  const animateHead = (delta: number) => {
    if (headRef.current) {
      // Базовое движение головой
      const headMovement = Math.sin(Date.now() / 500) * 0.1;
      
      // Если атакуем, голова более активная
      if (isAttacking) {
        headRef.current.rotation.x = 0.2 + Math.sin(Date.now() / 100) * 0.3;
      } else if (targetZombieId !== null) {
        // Если преследуем зомби, голова смотрит вперед
        headRef.current.rotation.x = 0.1 + headMovement / 2;
      } else if (behaviorMode === 'wander') {
        // В режиме блуждания - оглядывается по сторонам
        headRef.current.rotation.x = headMovement;
        headRef.current.rotation.y = Math.sin(Date.now() / 1200) * 0.2;
      } else {
        // Обычное движение
        headRef.current.rotation.x = headMovement;
      }
    }
  };
  
  // Анимация челюсти (для укуса)
  const animateJaw = (delta: number) => {
    if (jawRef.current) {
      if (isAttacking) {
        // Анимация укуса: челюсть открывается и закрывается быстро
        jawRef.current.rotation.x = 0.3 + Math.sin(Date.now() / 30) * 0.4; 
      } else if (behaviorMode === 'hunt' && targetZombieId !== null) {
        // В режиме охоты челюсть слегка приоткрыта
        jawRef.current.rotation.x = 0.2;
      } else if (Date.now() - lastBarkTime.current < 300) {
        // Анимация лая
        jawRef.current.rotation.x = 0.3;
      } else {
        // Обычное состояние - челюсть закрыта
        jawRef.current.rotation.x = 0;
      }
    }
  };
  
  // Если питомец не включен, не рендерим его
  if (!isEnabled) {
    return null;
  }
  
  return (
    <group 
      ref={petRef} 
      position={isInitialized.current ? petPosition.current.toArray() : [playerPosition.x, 0.5, playerPosition.z + 2]} 
      userData={{ isPet: true, id: petId.current }}
    >
      {/* Тело собаки */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.8, 0.6, 1.2]} />
        <meshPhongMaterial color="#8B4513" />
      </mesh>
      
      {/* Голова */}
      <mesh ref={headRef} position={[0, 0.9, 0.6]} castShadow>
        <boxGeometry args={[0.7, 0.7, 0.7]} />
        <meshPhongMaterial color="#8B4513" />
        
        {/* Челюсть (нижняя часть головы) */}
        <mesh ref={jawRef} position={[0, -0.2, 0.1]}>
          <boxGeometry args={[0.65, 0.3, 0.65]} />
          <meshPhongMaterial color="#8B4513" />
          
          {/* Зубы */}
          <mesh position={[0.15, 0, 0.3]} rotation={[0, 0, 0]}>
            <coneGeometry args={[0.05, 0.1, 8]} />
            <meshPhongMaterial color="white" />
          </mesh>
          <mesh position={[-0.15, 0, 0.3]} rotation={[0, 0, 0]}>
            <coneGeometry args={[0.05, 0.1, 8]} />
            <meshPhongMaterial color="white" />
          </mesh>
        </mesh>
        
        {/* Нос */}
        <mesh position={[0, -0.15, 0.4]} castShadow>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshPhongMaterial color="#000000" />
        </mesh>
        
        {/* Глаза */}
        <mesh position={[0.2, 0.1, 0.4]} castShadow>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshPhongMaterial color="#000000" />
        </mesh>
        <mesh position={[-0.2, 0.1, 0.4]} castShadow>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshPhongMaterial color="#000000" />
        </mesh>
        
        {/* Уши */}
        <mesh position={[0.3, 0.4, 0]} castShadow>
          <boxGeometry args={[0.2, 0.3, 0.1]} />
          <meshPhongMaterial color="#6B2E0C" />
        </mesh>
        <mesh position={[-0.3, 0.4, 0]} castShadow>
          <boxGeometry args={[0.2, 0.3, 0.1]} />
          <meshPhongMaterial color="#6B2E0C" />
        </mesh>
      </mesh>
      
      {/* Ноги */}
      <mesh position={[0.3, 0.15, 0.4]} castShadow>
        <boxGeometry args={[0.2, 0.5, 0.2]} />
        <meshPhongMaterial color="#6B2E0C" />
      </mesh>
      <mesh position={[-0.3, 0.15, 0.4]} castShadow>
        <boxGeometry args={[0.2, 0.5, 0.2]} />
        <meshPhongMaterial color="#6B2E0C" />
      </mesh>
      <mesh position={[0.3, 0.15, -0.4]} castShadow>
        <boxGeometry args={[0.2, 0.5, 0.2]} />
        <meshPhongMaterial color="#6B2E0C" />
      </mesh>
      <mesh position={[-0.3, 0.15, -0.4]} castShadow>
        <boxGeometry args={[0.2, 0.5, 0.2]} />
        <meshPhongMaterial color="#6B2E0C" />
      </mesh>
      
      {/* Хвост */}
      <mesh ref={tailRef} position={[0, 0.6, -0.7]} castShadow>
        <boxGeometry args={[0.2, 0.2, 0.6]} />
        <meshPhongMaterial color="#8B4513" />
      </mesh>
    </group>
  );
};

export default Pet; 