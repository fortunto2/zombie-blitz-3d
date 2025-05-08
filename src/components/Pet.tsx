import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Group, Mesh } from 'three';
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
  
  // Параметры оптимизации
  const ZOMBIES_SEARCH_INTERVAL = 10; // Обновлять список зомби каждые N кадров
  const ANIMATION_SKIP_FRAMES = 2; // Выполнять анимации только каждые N кадров
  const PERFORMANCE_CHECK_INTERVAL = 60; // Проверять производительность каждые N кадров
  const LOW_PERFORMANCE_MODE = useRef(false); // Флаг режима низкой производительности
  
  // Кэш зомби для оптимизации поиска
  const zombieCache = useRef<ZombieTarget[]>([]);
  const lastZombieSearchTime = useRef(0);
  const frameCounter = useRef(0);
  const lastFpsCheckTime = useRef(0);
  const fpsHistory = useRef<number[]>([]);
  
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
    frameCounter.current++;
    
    if (!isEnabled || isGameOver) return;
    
    // Проверка производительности и адаптация уровня детализации
    if (frameCounter.current % PERFORMANCE_CHECK_INTERVAL === 0) {
      const now = performance.now();
      if (lastFpsCheckTime.current > 0) {
        const elapsedMs = now - lastFpsCheckTime.current;
        const fps = 1000 / (elapsedMs / PERFORMANCE_CHECK_INTERVAL);
        
        fpsHistory.current.push(fps);
        if (fpsHistory.current.length > 5) {
          fpsHistory.current.shift();
        }
        
        // Вычисляем средний FPS
        const avgFps = fpsHistory.current.reduce((sum, fps) => sum + fps, 0) / fpsHistory.current.length;
        
        // Адаптируем уровень детализации
        if (avgFps < 30 && !LOW_PERFORMANCE_MODE.current) {
          console.log('Низкий FPS для питомца, снижаем детализацию');
          LOW_PERFORMANCE_MODE.current = true;
        } else if (avgFps > 45 && LOW_PERFORMANCE_MODE.current) {
          console.log('FPS восстановлен, возвращаем стандартную детализацию питомца');
          LOW_PERFORMANCE_MODE.current = false;
        }
      }
      lastFpsCheckTime.current = now;
    }
    
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
    
    // Анимации выполняем только на определенных кадрах в зависимости от режима производительности
    const animationSkipRate = LOW_PERFORMANCE_MODE.current ? ANIMATION_SKIP_FRAMES * 2 : ANIMATION_SKIP_FRAMES;
    if (frameCounter.current % animationSkipRate === 0) {
      animateTail();
      animateHead();
      animateJaw();
    }
    
    const now = Date.now();
    
    // Обработка звуков: лай собаки периодически, но реже в режиме низкой производительности
    if (LOW_PERFORMANCE_MODE.current) {
      // В режиме низкой производительности звуки воспроизводятся реже
      if (now - lastBarkTime.current > barkCooldown * 2 && 
          (behaviorMode === 'wander' || Math.random() < 0.05)) {
        lastBarkTime.current = now;
        if (onPlaySound) {
          onPlaySound('bark');
        }
      }
    } else {
      // Стандартное воспроизведение звуков
      if (now - lastBarkTime.current > barkCooldown && 
          (behaviorMode === 'wander' || Math.random() < 0.1)) {
        lastBarkTime.current = now;
        if (onPlaySound) {
          onPlaySound('bark');
        }
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
    
    // Кэшированный поиск зомби для повышения производительности
    // Обновляем кэш зомби только через определенные интервалы
    const zombieSearchInterval = LOW_PERFORMANCE_MODE.current ? 
      ZOMBIES_SEARCH_INTERVAL * 3 : ZOMBIES_SEARCH_INTERVAL;
    
    if (frameCounter.current % zombieSearchInterval === 0) {
      // Очищаем кэш зомби
      zombieCache.current = [];
      
      // Находим всех зомби в сцене
      let closestZombieForAttack: ZombieTarget | null = null;
      let closestDistanceForAttack = DETECT_ZOMBIE_RANGE;
      
      // Перебираем всех зомби в сцене
      scene.children.forEach((child) => {
        if (child.userData && child.userData.isZombie && !child.userData.isDying) {
          const zombiePosition = child.position.clone();
          const distanceToZombie = petRef.current!.position.distanceTo(zombiePosition);
          
          // Добавляем в кэш всех зомби в пределах дальности обнаружения
          if (distanceToZombie < DETECT_ZOMBIE_RANGE * 1.5) {
            const zombieTarget = {
              id: child.userData.id,
              position: zombiePosition,
              distance: distanceToZombie
            };
            
            zombieCache.current.push(zombieTarget);
            
            // Определяем ближайшего зомби
            if (distanceToZombie < closestDistanceForAttack) {
              closestZombieForAttack = zombieTarget;
              closestDistanceForAttack = distanceToZombie;
            }
          }
        }
      });
      
      lastZombieSearchTime.current = now;
    } else {
      // Используем кэшированных зомби, но обновляем их дистанции
      let closestZombieForAttack: ZombieTarget | null = null;
      let closestDistanceForAttack = DETECT_ZOMBIE_RANGE;
      
      // Обновляем дистанции до кэшированных зомби
      zombieCache.current.forEach(zombie => {
        const distanceToZombie = petRef.current!.position.distanceTo(zombie.position);
        zombie.distance = distanceToZombie;
        
        if (distanceToZombie < closestDistanceForAttack) {
          closestZombieForAttack = zombie;
          closestDistanceForAttack = distanceToZombie;
        }
      });
    }
    
    // Выбираем ближайшего зомби из кэша
    let closestZombieForAttack: ZombieTarget | null = null;
    if (zombieCache.current.length > 0) {
      closestZombieForAttack = zombieCache.current.reduce((closest, zombie) => {
        return (!closest || zombie.distance < closest.distance) ? zombie : closest;
      }, null as ZombieTarget | null);
    }
    
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
    
    // В режиме низкой производительности движение питомца обрабатывается не каждый кадр
    const movementSkipRate = LOW_PERFORMANCE_MODE.current ? 2 : 1;
    if (frameCounter.current % movementSkipRate !== 0) {
      // В режиме низкой производительности пропускаем обработку движения на некоторых кадрах
      
      // Передаем обновленную позицию для мини-карты
      if (updatePosition && frameCounter.current % 5 === 0) { // Обновление для UI реже
        const petDirection = new THREE.Vector3(0, 0, 1)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), petRef.current!.rotation.y);
        
        updatePosition(petPosition.current.clone(), petDirection);
      }
      
      return;
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
        
        // Плавный поворот, но быстрее в режиме низкой производительности
        petRef.current!.rotation.y += normalizedDiff * Math.min(1, delta * (LOW_PERFORMANCE_MODE.current ? 15 : 10));
        
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
        
        // Ограничиваем в пределах арены - упрощенная версия
        const arenaSize = 23.5; // Чуть меньше, чтобы не застревать в стенах
        petRef.current!.position.x = Math.max(-arenaSize, Math.min(arenaSize, petRef.current!.position.x));
        petRef.current!.position.z = Math.max(-arenaSize, Math.min(arenaSize, petRef.current!.position.z));
      }
    }
    
    // Обновляем позицию питомца
    petPosition.current.copy(petRef.current!.position);
    
    // Передаем обновленную позицию и направление для мини-карты, но реже в режиме низкой производительности
    if (updatePosition && frameCounter.current % (LOW_PERFORMANCE_MODE.current ? 5 : 2) === 0) {
      // Определяем направление взгляда питомца из его поворота
      const petDirection = new THREE.Vector3(0, 0, 1)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), petRef.current!.rotation.y);
      
      updatePosition(petPosition.current.clone(), petDirection);
    }
  });
  
  // Режим охоты: атакуем и преследуем зомби, но с упрощенной логикой
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
      
      // Упрощенная логика - просто бежим к текущей позиции зомби
      targetPosition.current.copy(zombie.position);
    }
  };
  
  // Режим блуждания: собака свободно перемещается по карте (упрощенная версия)
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
      
      // Упрощенная проверка границ
      const arenaSize = 23;
      potentialPosition.x = Math.max(-arenaSize, Math.min(arenaSize, potentialPosition.x));
      potentialPosition.z = Math.max(-arenaSize, Math.min(arenaSize, potentialPosition.z));
      
      targetPosition.current = potentialPosition;
    }
  };
  
  // Режим следования: собака следует за игроком (упрощенная версия)
  const handleFollowMode = () => {
    // Сбрасываем цель зомби, если была
    if (targetZombieId !== null) {
      setTargetZombieId(null);
    }
    
    const distanceToPlayer = petRef.current!.position.distanceTo(playerPosition);
    
    // Если питомец очень далеко от игрока, приближаемся к нему
    if (distanceToPlayer > FOLLOW_DISTANCE * 2) {
      // Позиция немного позади и сбоку от игрока
      const offsetX = (Math.random() - 0.5) * 2; // Случайное смещение по X
      const randomOffset = new Vector3(offsetX, 0, 2);
      
      targetPosition.current.copy(playerPosition).add(randomOffset);
    } else {
      // Если питомец близко к игроку, переключаемся на режим блуждания
      setBehaviorMode('wander');
      lastWanderChangeTime.current = Date.now() - wanderChangeInterval; // Чтобы сразу сменить направление
    }
  };
  
  // Анимация хвоста (упрощенная)
  const animateTail = () => {
    if (tailRef.current) {
      // Базовое махание хвостом
      const tailWag = Math.sin(Date.now() / 200) * 0.5;
      
      // В низкопроизводительном режиме упрощаем анимацию
      if (LOW_PERFORMANCE_MODE.current) {
        tailRef.current.rotation.z = tailWag * (isAttacking ? 1.5 : 1.0);
      } else {
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
    }
  };
  
  // Анимация головы (упрощенная)
  const animateHead = () => {
    if (headRef.current) {
      // В низкопроизводительном режиме упрощаем анимацию
      if (LOW_PERFORMANCE_MODE.current) {
        // Упрощенная анимация
        const headMovement = Math.sin(Date.now() / 500) * 0.1;
        headRef.current.rotation.x = isAttacking ? 0.2 : headMovement;
      } else {
        // Полная анимация
        const headMovement = Math.sin(Date.now() / 500) * 0.1;
        
        if (isAttacking) {
          headRef.current.rotation.x = 0.2 + Math.sin(Date.now() / 100) * 0.3;
        } else if (targetZombieId !== null) {
          headRef.current.rotation.x = 0.1 + headMovement / 2;
        } else if (behaviorMode === 'wander') {
          headRef.current.rotation.x = headMovement;
          headRef.current.rotation.y = Math.sin(Date.now() / 1200) * 0.2;
        } else {
          headRef.current.rotation.x = headMovement;
        }
      }
    }
  };
  
  // Анимация челюсти (для укуса) (упрощенная)
  const animateJaw = () => {
    if (jawRef.current) {
      // В низкопроизводительном режиме упрощаем анимацию
      if (LOW_PERFORMANCE_MODE.current) {
        // Упрощенная анимация
        jawRef.current.rotation.x = isAttacking ? 0.3 : 0;
      } else {
        // Полная анимация
        if (isAttacking) {
          jawRef.current.rotation.x = 0.3 + Math.sin(Date.now() / 30) * 0.4; 
        } else if (behaviorMode === 'hunt' && targetZombieId !== null) {
          jawRef.current.rotation.x = 0.2;
        } else if (Date.now() - lastBarkTime.current < 300) {
          jawRef.current.rotation.x = 0.3;
        } else {
          jawRef.current.rotation.x = 0;
        }
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