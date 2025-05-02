import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Mesh, MeshPhongMaterial, SphereGeometry, BoxGeometry, Group, Box3, PlaneGeometry, MeshBasicMaterial } from 'three';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';

interface ZombieData {
  id: string;
  position?: Vector3;
  health: number;
}

interface ZombiesProps {
  playerPosition: Vector3;
  zombies: ZombieData[];
  setZombies: (zombies: ZombieData[]) => void;
  isGameOver: boolean;
  onPlayerDamage: (damage: number) => void;
  updatePositions?: (positions: { id: string; position: Vector3; isDying: boolean }[]) => void;
  onZombieKilled?: (zombieId: string) => void;
}

interface Zombie {
  id: string;
  mesh: Group;
  velocity: Vector3;
  lastDamageTime: number;
  health: number;
  isDying: boolean;
  dyingStartTime: number;
  speed: number;
  healthBar: Group;
}

// Интерфейс для анимации предупреждения о зомби
interface ZombieWarning {
  id: string;
  position: Vector3;
  startTime: number;
  mesh: Group;
}

// Определяем препятствия (те же, что в Arena.tsx)
const obstacles = [
  { position: [5, 1, 5], size: [2, 2, 2] },
  { position: [-5, 1, 5], size: [2, 2, 2] },
  { position: [5, 1, -5], size: [2, 2, 2] },
  { position: [-5, 1, -5], size: [2, 2, 2] },
  { position: [0, 1, 8], size: [4, 2, 1] },
  { position: [0, 1, -8], size: [4, 2, 1] },
  { position: [8, 1, 0], size: [1, 2, 4] },
  { position: [-8, 1, 0], size: [1, 2, 4] },
].map(({ position, size }) => ({
  position: new Vector3(...position as [number, number, number]),
  size: new Vector3(...size as [number, number, number])
}));

// Функция для получения случайной позиции у стены арены с указанием стороны
function getRandomWallPosition(arenaSize: number, forcedSide?: number): Vector3 {
  const side = forcedSide !== undefined ? forcedSide : Math.floor(Math.random() * 4); // 0: верх, 1: право, 2: низ, 3: лево
  let x, z;
  
  switch (side) {
    case 0: // Верхняя стена
      x = Math.random() * (arenaSize * 2) - arenaSize;
      z = -arenaSize;
      break;
    case 1: // Правая стена
      x = arenaSize;
      z = Math.random() * (arenaSize * 2) - arenaSize;
      break;
    case 2: // Нижняя стена
      x = Math.random() * (arenaSize * 2) - arenaSize;
      z = arenaSize;
      break;
    case 3: // Левая стена
      x = -arenaSize;
      z = Math.random() * (arenaSize * 2) - arenaSize;
      break;
    default:
      x = 0;
      z = 0;
  }
  
  return new Vector3(x, 0, z);
}

// Функция для получения цвета зомби в зависимости от оставшегося здоровья
function getZombieColorByHealth(health: number): THREE.Color {
  if (health > 66) {
    return new THREE.Color(0x00cc00); // Яркий зеленый (полное здоровье)
  } else if (health > 33) {
    return new THREE.Color(0xffff00); // Желтый (после первого попадания)
  } else if (health > 0) {
    return new THREE.Color(0xff8000); // Оранжевый (после второго попадания)
  } else {
    return new THREE.Color(0xff0000); // Красный (после третьего попадания, перед смертью)
  }
}

const Zombies: React.FC<ZombiesProps> = ({
  playerPosition,
  zombies,
  setZombies,
  isGameOver,
  onPlayerDamage,
  updatePositions,
  onZombieKilled
}) => {
  const { scene } = useThree();
  const zombieRefs = useRef<{ [key: string]: Zombie }>({});
  const lastSpawnTime = useRef<number>(0);
  const wave = useRef<number>(1);
  const baseZombieSpeed = useRef<number>(3); // Увеличиваем начальную базовую скорость (было 2)
  const zombieWarnings = useRef<{ [key: string]: ZombieWarning }>({});
  
  // Refs to accumulate changes for batch update
  const zombiesToAddRef = useRef<ZombieData[]>([]);
  const zombiesToRemoveRef = useRef<string[]>([]);
  const zombiesToUpdateRef = useRef<Partial<ZombieData>[]>([]); // Store updates like health
  const [needsUpdate, setNeedsUpdate] = useState(false);
  
  // Добавляем состояние для отслеживания начального всплеска зомби
  const initialZombieWave = useRef<{ active: boolean; count: number; startTime: number }>({
    active: false, // Изменяем на false, чтобы отключить начальную волну
    count: 0,
    startTime: Date.now()
  });
  
  // Создание полоски здоровья для зомби
  const createHealthBar = () => {
    const healthBarGroup = new Group();
    
    // Задний фон полоски (красный)
    const backgroundGeometry = new PlaneGeometry(1, 0.1);
    const backgroundMaterial = new MeshPhongMaterial({ 
      color: 0xff0000,
      depthTest: false, // Чтобы полоска всегда была видна
      transparent: true,
      opacity: 0.8
    });
    const background = new Mesh(backgroundGeometry, backgroundMaterial);
    
    // Полоска здоровья (зеленая)
    const barGeometry = new PlaneGeometry(1, 0.1);
    const barMaterial = new MeshPhongMaterial({ 
      color: 0x00ff00,
      depthTest: false, // Чтобы полоска всегда была видна  
      transparent: true,
      opacity: 0.8
    });
    const bar = new Mesh(barGeometry, barMaterial);
    
    // Помещаем полоску здоровья перед фоном
    bar.position.z = 0.01;
    
    // Добавляем оба элемента в группу
    healthBarGroup.add(background);
    healthBarGroup.add(bar);
    
    // Позиционируем полоску над зомби (выше из-за увеличенного размера)
    healthBarGroup.position.y = 2.8; // Поднимаем выше (было 2.5)
    
    // Поворачиваем полоску так, чтобы она всегда была видна сверху
    healthBarGroup.rotation.x = -Math.PI / 2;
    
    return healthBarGroup;
  };
  
  // Обновление полоски здоровья
  const updateHealthBar = (zombie: Zombie) => {
    if (!zombie.healthBar || zombie.healthBar.children.length < 2) {
      console.warn("Не удалось найти полоску здоровья для зомби", zombie.id);
      return;
    }
    
    // Получаем зеленую полоску (второй элемент в группе)
    const healthBar = zombie.healthBar.children[1] as THREE.Mesh;
    
    if (!healthBar || !(healthBar.geometry instanceof THREE.PlaneGeometry)) {
      console.warn("Некорректная геометрия полоски здоровья");
      return;
    }
    
    // Обновляем ширину зеленой полоски в зависимости от здоровья
    const healthPercent = Math.max(0, zombie.health / 100);
    
    // Удаляем старую геометрию и создаем новую с шириной, соответствующей здоровью
    (healthBar.geometry as THREE.PlaneGeometry).dispose();
    healthBar.geometry = new PlaneGeometry(healthPercent, 0.1);
    
    // Сдвигаем полоску влево для выравнивания с начала
    healthBar.position.x = (healthPercent - 1) / 2;
  };
  
  // Создание зомби
  const createZombie = (position: Vector3) => {
    const id = uuidv4();
    
    // Создаем группу для зомби
    const zombie = new Group();
    
    // Устанавливаем начальный цвет зомби
    const zombieColor = getZombieColorByHealth(100);
    const material = new MeshPhongMaterial({ 
      color: zombieColor,
      shininess: 10, // Уменьшаем блеск для более мертвого вида
      flatShading: true // Добавляем плоское затенение для более грубого вида
    });
    
    // Создаем тело зомби (используем цилиндр для более округлой формы)
    const bodyGeometry = new THREE.CylinderGeometry(0.6, 0.5, 1.8, 8);
    const body = new Mesh(bodyGeometry, material.clone());
    body.position.set(0, 1.0, 0);
    body.castShadow = true;
    
    // Создаем голову зомби
    const headGeometry = new SphereGeometry(0.5, 8, 8);
    const headMaterial = material.clone();
    const head = new Mesh(headGeometry, headMaterial);
    head.position.set(0, 2.1, 0); // Немного выше для более реалистичной посадки
    head.scale.set(1, 1.1, 1); // Слегка вытягиваем голову
    head.castShadow = true;
    
    // Создаем левую руку
    const armGeometry = new THREE.CylinderGeometry(0.2, 0.15, 1.3, 6);
    const leftArm = new Mesh(armGeometry, material.clone());
    leftArm.position.set(0.8, 1.4, 0); // Размещаем сбоку от тела
    leftArm.rotation.z = Math.PI / 6; // Слегка поднимаем руку
    leftArm.castShadow = true;
    
    // Создаем правую руку
    const rightArm = new Mesh(armGeometry, material.clone());
    rightArm.position.set(-0.8, 1.4, 0); // Размещаем сбоку от тела
    rightArm.rotation.z = -Math.PI / 6; // Слегка поднимаем руку
    rightArm.castShadow = true;
    
    // Создаем дополнительные детали для зомби
    
    // Глаза (пустые глазницы)
    const eyeGeometry = new SphereGeometry(0.12, 8, 8);
    const eyeMaterial = new MeshPhongMaterial({ 
      color: 0x000000,
      shininess: 20,
      emissive: 0x330000, // Слегка светящиеся красные глаза
      emissiveIntensity: 0.3
    });
    
    const leftEye = new Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(0.2, 2.2, 0.35);
    
    const rightEye = new Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(-0.2, 2.2, 0.35);
    
    // Рот (простая линия)
    const mouthGeometry = new BoxGeometry(0.3, 0.05, 0.05);
    const mouthMaterial = new MeshPhongMaterial({ color: 0x330000 });
    const mouth = new Mesh(mouthGeometry, mouthMaterial);
    mouth.position.set(0, 1.95, 0.45);
    
    // Добавляем все части к зомби
    zombie.add(body);
    zombie.add(head);
    zombie.add(leftArm);
    zombie.add(rightArm);
    zombie.add(leftEye);
    zombie.add(rightEye);
    zombie.add(mouth);
    
    // Создаем невидимый хитбокс для более точного определения попаданий
    const hitboxGeometry = new THREE.CapsuleGeometry(1.0, 2.0, 4, 8); // Капсула лучше охватывает всю фигуру зомби
    const hitboxMaterial = new MeshPhongMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.0, // Полностью прозрачный
      depthWrite: false // Не записывать в буфер глубины
    });
    
    const hitbox = new Mesh(hitboxGeometry, hitboxMaterial);
    hitbox.position.set(0, 1.5, 0); // По центру зомби
    zombie.add(hitbox); // Добавляем хитбокс к зомби
    
    // Добавляем небольшой случайный наклон для разнообразия
    zombie.rotation.x = (Math.random() - 0.5) * 0.1; // Небольшой случайный наклон вперед/назад
    zombie.rotation.y = Math.random() * Math.PI * 2; // Случайный поворот
    zombie.rotation.z = (Math.random() - 0.5) * 0.1; // Небольшой случайный наклон влево/вправо
    
    zombie.position.copy(position);
    zombie.userData = { isZombie: true, id, health: 100 };
    
    // Создаем и добавляем полоску здоровья
    const healthBarGroup = createHealthBar();
    zombie.add(healthBarGroup);
    
    // Добавляем зомби в сцену
    scene.add(zombie);
    
    // Создаем случайную стартовую скорость с большей вариацией
    const zombieSpeed = baseZombieSpeed.current * (0.7 + Math.random() * 0.6);
    
    // Сохраняем ссылку на зомби
    const zombieObj = {
      id,
      mesh: zombie,
      velocity: new Vector3(0, 0, 0),
      lastDamageTime: 0,
      health: 100,
      isDying: false,
      dyingStartTime: 0,
      speed: zombieSpeed,
      healthBar: healthBarGroup
    };
    
    // Логируем создание зомби
    console.log(`Создан зомби ${id} с позицией ${position.x.toFixed(2)}, ${position.z.toFixed(2)}`);
    
    zombieRefs.current[id] = zombieObj;
    
    // Accumulate zombie to add instead of calling setZombies directly
    zombiesToAddRef.current.push({ id, position: zombie.position.clone(), health: 100 });
    setNeedsUpdate(true); // Signal that an update is needed
    
    return zombieObj;
  };
  
  // Создание предупреждения о появлении зомби
  const createZombieWarning = (position: Vector3) => {
    const id = uuidv4();
    
    // Создаем группу для предупреждения
    const warningGroup = new Group();
    
    // Создаем основной круг предупреждения (красный круг на земле)
    const warningGeometry = new PlaneGeometry(3, 3);
    const warningMaterial = new MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    
    const warningMesh = new Mesh(warningGeometry, warningMaterial);
    warningMesh.rotation.x = -Math.PI / 2; // Поворачиваем, чтобы было параллельно земле
    warningMesh.position.y = 0.05; // Чуть выше земли, чтобы избежать z-fighting
    
    // Добавляем внутренний круг для более заметной анимации
    const innerCircleGeometry = new PlaneGeometry(1.5, 1.5);
    const innerCircleMaterial = new MeshBasicMaterial({
      color: 0xffff00, // Желтый цвет для контраста
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    
    const innerCircleMesh = new Mesh(innerCircleGeometry, innerCircleMaterial);
    innerCircleMesh.rotation.x = -Math.PI / 2;
    innerCircleMesh.position.y = 0.06; // Чуть выше основного круга
    
    // Добавляем вертикальный "столб" света
    const lightPillarGeometry = new THREE.CylinderGeometry(0.2, 0.5, 5, 8);
    const lightPillarMaterial = new MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.3
    });
    
    const lightPillar = new Mesh(lightPillarGeometry, lightPillarMaterial);
    lightPillar.position.y = 2.5; // Половина высоты
    
    // Добавляем все элементы в группу
    warningGroup.add(warningMesh);
    warningGroup.add(innerCircleMesh);
    warningGroup.add(lightPillar);
    
    warningGroup.position.copy(position);
    
    // Добавляем в сцену
    scene.add(warningGroup);
    
    // Сохраняем предупреждение
    const warning: ZombieWarning = {
      id,
      position: position.clone(),
      startTime: Date.now(),
      mesh: warningGroup
    };
    
    zombieWarnings.current[id] = warning;
    
    console.log(`Создано предупреждение о зомби ${id} с позицией ${position.x.toFixed(2)}, ${position.z.toFixed(2)}`);
    
    return warning;
  };
  
  // Удаление зомби
  const removeZombie = (id: string) => {
    const zombie = zombieRefs.current[id];
    if (zombie) {
      scene.remove(zombie.mesh);
      delete zombieRefs.current[id];
      
      // Accumulate zombie ID to remove
      zombiesToRemoveRef.current.push(id);
      setNeedsUpdate(true); // Signal that an update is needed
    }
  };
  
  // Удаление предупреждения о зомби
  const removeZombieWarning = (id: string) => {
    const warning = zombieWarnings.current[id];
    if (warning) {
      scene.remove(warning.mesh);
      delete zombieWarnings.current[id];
      console.log(`Удалено предупреждение о зомби ${id}`);
    }
  };
  
  // Нанесение урона зомби
  const damageZombie = (id: string) => {
    const zombie = zombieRefs.current[id];
    if (zombie && !zombie.isDying) {
      // Запоминаем предыдущее здоровье для проверки перехода порогов
      const previousHealth = zombie.health;
      
      // Определяем источник урона (от игрока или от питомца)
      // По умолчанию урон от игрока - 34 (100/3 ≈ 33.33, три пули должны убить зомби)
      // Для питомца урон составляет 10
      // Проверяем наличие флага для питомца
      const isPetAttack = zombie.mesh.userData && zombie.mesh.userData.isPetAttack === true;
      const damage = isPetAttack ? 10 : 34;
      
      // Уменьшаем здоровье
      zombie.health -= damage;
      
      console.log(`Зомби ${id} получил урон ${damage} от ${isPetAttack ? 'питомца' : 'игрока'}. Здоровье: ${previousHealth} -> ${zombie.health}`);
      
      // Сбрасываем флаг атаки питомца после применения урона и логирования
      if (zombie.mesh.userData) {
        delete zombie.mesh.userData.isPetAttack;
      }
      
      // Обновляем здоровье зомби в userData для проверки в Player.tsx
      if (zombie.mesh && zombie.mesh.userData) {
        zombie.mesh.userData.health = zombie.health;
      }
      
      // Обновляем полоску здоровья
      updateHealthBar(zombie);
      
      // Получаем цвет зомби по его здоровью
      const color = getZombieColorByHealth(zombie.health);
      console.log(`Устанавливаем цвет для зомби: ${color.getHexString()}`);
      
      // Применяем цвет ко всем частям зомби, кроме полоски здоровья
      zombie.mesh.children.forEach((child) => {
        // Проверяем, что это меш, но не часть полоски здоровья
        if (child instanceof THREE.Mesh && 
            child.material instanceof THREE.MeshPhongMaterial && 
            !zombie.healthBar.children.includes(child) &&
            !(child.material as THREE.MeshPhongMaterial).transparent) { // Исключаем прозрачные материалы (глаза, рот)
          
          (child.material as THREE.MeshPhongMaterial).color.set(color);
        }
      });
      
      // Если здоровье кончилось, помечаем зомби как "умирающего"
      if (zombie.health <= 0) {
        zombie.isDying = true;
        zombie.dyingStartTime = Date.now();
        
        // Останавливаем движение зомби (он падает)
        zombie.velocity.set(0, 0, 0);
        
        // Скрываем полоску здоровья
        if (zombie.healthBar) {
          zombie.healthBar.visible = false;
        }
        
        // Сохраняем текущее направление поворота зомби (только по оси Y)
        // Это предотвратит вращение во время падения
        const currentYRotation = zombie.mesh.rotation.y;
        
        // Сбрасываем вращение по другим осям для правильного падения
        zombie.mesh.rotation.x = 0;
        zombie.mesh.rotation.z = 0;
        
        // Восстанавливаем вращение по оси Y, чтобы зомби падал в правильном направлении
        zombie.mesh.rotation.y = currentYRotation;
        
        console.log(`Зомби ${id} умирает, начинаем анимацию падения`);
      }
      
      // Обновляем состояние зомби в родительском компоненте (отложенно)
      // Accumulate health update
      zombiesToUpdateRef.current.push({ id, health: zombie.health });
      setNeedsUpdate(true); // Signal that an update is needed
    }
  };
  
  // Обновление предупреждений о зомби
  const updateZombieWarnings = (delta: number) => {
    Object.keys(zombieWarnings.current).forEach(id => {
      const warning = zombieWarnings.current[id];
      const now = Date.now();
      const age = now - warning.startTime;
      
      // Продолжительность предупреждения - 1 секунда
      const warningDuration = 1000;
      
      if (age >= warningDuration) {
        // Предупреждение истекло, создаем зомби
        createZombie(warning.position);
        removeZombieWarning(id);
      } else {
        // Анимация пульсации предупреждения
        const warningProgress = age / warningDuration; // 0 -> 1
        const mainCircle = warning.mesh.children[0] as Mesh;
        const innerCircle = warning.mesh.children[1] as Mesh;
        const lightPillar = warning.mesh.children[2] as Mesh;
        
        if (mainCircle && mainCircle.material instanceof MeshBasicMaterial) {
          // Пульсация размера основного круга
          const mainScale = 1 + 0.2 * Math.sin(age / 100); // Медленная пульсация
          mainCircle.scale.set(mainScale, mainScale, 1);
          
          // Пульсация прозрачности основного круга
          mainCircle.material.opacity = 0.3 + 0.3 * Math.sin(age / 80);
        }
        
        if (innerCircle && innerCircle.material instanceof MeshBasicMaterial) {
          // Ускоренная пульсация внутреннего круга
          const innerScale = 0.8 + 0.5 * Math.sin(age / 50); // Быстрая пульсация
          innerCircle.scale.set(innerScale, innerScale, 1);
          
          // Изменение цвета внутреннего круга с желтого на красный по мере приближения к появлению
          const colorValue = Math.floor(255 * (1 - warningProgress)); // от 255 до 0
          innerCircle.material.color.setRGB(1, colorValue / 255, 0); // от желтого к красному
          
          // Более выраженная пульсация прозрачности
          innerCircle.material.opacity = 0.5 + 0.5 * Math.sin(age / 40);
        }
        
        if (lightPillar && lightPillar.material instanceof MeshBasicMaterial) {
          // Анимация "столба" света
          lightPillar.rotation.y += delta * 3; // Вращение
          
          // Увеличение высоты столба по мере приближения к появлению
          const heightScale = 1 + warningProgress * 2; // от 1 до 3
          lightPillar.scale.set(1, heightScale, 1);
          
          // Увеличение яркости с приближением к появлению
          lightPillar.material.opacity = 0.1 + 0.4 * warningProgress;
        }
        
        // Общая анимация группы (легкое подпрыгивание)
        warning.mesh.position.y = 0.1 * Math.sin(age / 200); // Легкое подпрыгивание
      }
    });
  };
  
  // Спавн зомби
  const spawnZombie = () => {
    const now = Date.now();
    
    // Стандартный спавн зомби
    // Изменяем интервал спавна зомби на 2 секунды
    const spawnInterval = 2000; // Было 1000 (1 секунда)
    
    if (now - lastSpawnTime.current > spawnInterval) {
      lastSpawnTime.current = now;
      
      // Создаем предупреждение о появлении зомби
      const arenaSize = 24;
      const spawnPosition = getRandomWallPosition(arenaSize);
      
      // Создаем предупреждение вместо зомби
      createZombieWarning(spawnPosition);
      
      // Увеличиваем волну каждые 10 спавнов (20 секунд)
      if (wave.current % 10 === 0) {
        baseZombieSpeed.current = Math.min(7, baseZombieSpeed.current + 0.4);
        console.log(`Волна ${wave.current}: скорость зомби увеличена до ${baseZombieSpeed.current.toFixed(1)}`);
      }
      
      wave.current++;
    }
  };
  
  // Расчет направления к игроку с учетом избегания других зомби
  const calculateZombieDirection = (zombie: Zombie): Vector3 => {
    // Если зомби умирает, не двигаем его
    if (zombie.isDying) {
      return new Vector3(0, 0, 0);
    }
    
    // Базовое направление к игроку
    const directionToPlayer = new Vector3()
      .subVectors(playerPosition, zombie.mesh.position)
      .normalize();
    
    // Отталкивание от других зомби
    const separationForce = new Vector3();
    const separationRadius = 2;
    let neighborCount = 0;
    
    // Проверяем каждого зомби для разделения
    Object.values(zombieRefs.current).forEach(otherZombie => {
      if (otherZombie.id !== zombie.id && !otherZombie.isDying) {
        const distance = zombie.mesh.position.distanceTo(otherZombie.mesh.position);
        
        if (distance < separationRadius) {
          // Вектор, указывающий от другого зомби к текущему
          const awayVector = new Vector3()
            .subVectors(zombie.mesh.position, otherZombie.mesh.position);
          
          // Нормализуем и масштабируем по расстоянию (чем ближе, тем сильнее)
          awayVector.normalize().divideScalar(Math.max(0.1, distance));
          
          separationForce.add(awayVector);
          neighborCount++;
        }
      }
    });
    
    // Нормализуем направление разделения, если есть соседи
    if (neighborCount > 0) {
      separationForce.divideScalar(neighborCount);
      separationForce.normalize();
    }
    
    // Объединяем силы с разными весами
    const seekWeight = 1;
    const separationWeight = 1.5;
    
    // Результирующее направление
    const direction = directionToPlayer.multiplyScalar(seekWeight)
      .add(separationForce.multiplyScalar(separationWeight))
      .normalize();
    
    return direction;
  };
  
  // Обработка падения умирающих зомби
  const processDeadZombie = (zombie: Zombie, delta: number) => {
    const now = Date.now();
    const dyingDuration = 1000; // Уменьшаем длительность анимации падения до 1 секунды (было 1.5)
    const elapsedTime = now - zombie.dyingStartTime;
    
    if (elapsedTime < dyingDuration) {
      // Вычисляем прогресс анимации (0 - начало, 1 - конец)
      const rotationProgress = Math.min(1, elapsedTime / dyingDuration);
      
      // Вращаем зомби вперед (падение), но только по оси X
      // Сохраняем текущий поворот по осям Y и Z, меняем только X
      const targetRotationX = Math.PI / 2; // 90 градусов (лежит на земле)
      zombie.mesh.rotation.x = rotationProgress * targetRotationX;
      
      // Добавляем небольшое смещение вниз для имитации падения на землю
      // Высота падения зависит от прогресса, вначале падает быстрее, потом медленнее
      const fallHeight = Math.max(0, 1 - Math.pow(rotationProgress, 2));
      zombie.mesh.position.y = fallHeight;
      
      return false; // Продолжаем анимацию
    } else {
      // Убеждаемся, что зомби лежит ровно на земле после окончания анимации
      zombie.mesh.rotation.x = Math.PI / 2; // 90 градусов
      zombie.mesh.position.y = 0;
      
      // Выключаем вращение по другим осям
      zombie.mesh.rotation.y = zombie.mesh.rotation.y; // Сохраняем текущее значение
      zombie.mesh.rotation.z = 0;
      
      // Уведомляем об удалении зомби (для учета очков)
      if (onZombieKilled) {
        onZombieKilled(zombie.id);
      }
      
      // Время анимации истекло, удаляем зомби
      return true; // Готов к удалению
    }
  };
  
  // Обновление зомби на каждом кадре
  useFrame((_, delta) => {
    if (isGameOver) return;
    
    // Спавн новых зомби
    spawnZombie();
    
    // Обновляем предупреждения о зомби
    updateZombieWarnings(delta);
    
    // Собираем данные о позициях зомби для мини-карты
    if (updatePositions) {
      const positions = Object.values(zombieRefs.current).map(zombie => ({
        id: zombie.id,
        position: zombie.mesh.position.clone(),
        isDying: zombie.isDying
      }));
      updatePositions(positions);
    }
    
    // Обновляем каждого зомби
    Object.keys(zombieRefs.current).forEach(id => {
      const zombie = zombieRefs.current[id];
      
      // Обрабатываем умирающих зомби отдельно
      if (zombie.isDying) {
        const shouldRemove = processDeadZombie(zombie, delta);
        if (shouldRemove) {
          removeZombie(id);
        }
        return; // Пропускаем дальнейшую обработку для умирающих зомби
      }
      
      // Получаем направление движения
      const direction = calculateZombieDirection(zombie);
      
      // Обновляем скорость
      const speed = zombie.speed * delta;
      zombie.velocity.copy(direction.multiplyScalar(speed));
      
      // Обновляем позицию
      zombie.mesh.position.add(zombie.velocity);
      
      // Поворачиваем зомби к игроку, если он движется
      if (zombie.velocity.length() > 0.001) {
        // Вычисляем направление к игроку в горизонтальной плоскости
        const lookDirection = new Vector3(
          playerPosition.x - zombie.mesh.position.x,
          0, // Игнорируем Y-координату для горизонтального поворота
          playerPosition.z - zombie.mesh.position.z
        ).normalize();
        
        // Вычисляем целевой угол поворота (в радианах)
        const targetAngle = Math.atan2(lookDirection.x, lookDirection.z);
        
        // Плавно поворачиваем зомби к целевому углу
        const currentAngle = zombie.mesh.rotation.y;
        const angleDiff = targetAngle - currentAngle;
        
        // Нормализуем разницу углов в диапазоне [-PI, PI]
        let normalizedDiff = angleDiff;
        while (normalizedDiff > Math.PI) normalizedDiff -= Math.PI * 2;
        while (normalizedDiff < -Math.PI) normalizedDiff += Math.PI * 2;
        
        // Плавно интерполируем текущий угол к целевому
        zombie.mesh.rotation.y += normalizedDiff * Math.min(1, delta * 5); // Скорость поворота
      }
      
      // Всегда поворачиваем полоску здоровья к камере, только для живых зомби
      if (zombie.healthBar) {
        // Получаем камеру из сцены
        const camera = scene.getObjectByProperty('isCamera', true);
        if (camera) {
          // Для полоски здоровья важно, чтобы она всегда была видна сверху
          // Но не нужно менять ее ориентацию при каждом кадре
          // Достаточно обеспечить ее постоянное положение над зомби
          zombie.healthBar.position.set(0, 2.8, 0);
          
          // Убеждаемся, что полоска всегда обращена вверх
          zombie.healthBar.rotation.x = -Math.PI / 2;
          zombie.healthBar.rotation.y = 0;
          zombie.healthBar.rotation.z = 0;
        }
      }
      
      // Ограничиваем в пределах арены
      const arenaSize = 24;
      zombie.mesh.position.x = Math.max(-arenaSize, Math.min(arenaSize, zombie.mesh.position.x));
      zombie.mesh.position.z = Math.max(-arenaSize, Math.min(arenaSize, zombie.mesh.position.z));
      
      // Проверяем столкновение с игроком
      const distanceToPlayer = zombie.mesh.position.distanceTo(playerPosition);
      const now = Date.now();
      
      // Если зомби близко к игроку и достаточно времени прошло с последнего удара
      if (distanceToPlayer < 1.5 && now - zombie.lastDamageTime > 1000) {
        zombie.lastDamageTime = now;
        onPlayerDamage(10); // Наносим урон игроку
      }
    });
  });
  
  // Экспортируем функцию для обработки попадания пули в зомби
  useEffect(() => {
    // Добавляем метод к userData компонента
    scene.userData.damageZombie = (zombieId: string, isPet: boolean = false) => {
      // Если атака от питомца, устанавливаем флаг
      const zombie = zombieRefs.current[zombieId];
      if (zombie && zombie.mesh && zombie.mesh.userData) {
        if (isPet) {
          console.log(`Питомец атакует зомби ${zombieId}`);
          zombie.mesh.userData.isPetAttack = true;
        }
      }
      damageZombie(zombieId);
    };
    
    // Добавляем функцию для сброса волны зомби
    scene.userData.resetZombieWave = () => {
      console.log('Сброс волны зомби');
      
      // Сбрасываем счетчик волн
      wave.current = 1;
      
      // Сбрасываем скорость зомби
      baseZombieSpeed.current = 3;
      
      // Сбрасываем время последнего спавна
      lastSpawnTime.current = 0;
    };
    
    return () => {
      // Очистка при размонтировании
      delete scene.userData.damageZombie;
      delete scene.userData.resetZombieWave;
      
      // Удаляем всех зомби из сцены
      Object.values(zombieRefs.current).forEach(zombie => {
        scene.remove(zombie.mesh);
      });
      
      // Удаляем все предупреждения о зомби
      Object.values(zombieWarnings.current).forEach(warning => {
        scene.remove(warning.mesh);
      });
    };
  }, [scene]);

  // Effect to apply batched updates to the parent state
  useEffect(() => {
    if (!needsUpdate) return;

    let newZombies = [...zombies];

    // Apply additions
    newZombies = [...newZombies, ...zombiesToAddRef.current];

    // Apply removals
    const removedIds = new Set(zombiesToRemoveRef.current);
    newZombies = newZombies.filter(z => !removedIds.has(z.id));

    // Apply updates (e.g., health)
    const updatesMap = new Map(zombiesToUpdateRef.current.map(u => [u.id, u]));
    newZombies = newZombies.map(z => {
      const update = updatesMap.get(z.id);
      return update ? { ...z, ...update } : z;
    });

    setZombies(newZombies);

    // Clear accumulated changes and reset flag
    zombiesToAddRef.current = [];
    zombiesToRemoveRef.current = [];
    zombiesToUpdateRef.current = [];
    setNeedsUpdate(false);

  }, [needsUpdate, zombies, setZombies]);
  
  return null; // Визуальное представление обрабатывается через Three.js напрямую
};

export default Zombies; 