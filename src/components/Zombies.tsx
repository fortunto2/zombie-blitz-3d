import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Mesh, MeshPhongMaterial, SphereGeometry, BoxGeometry, Group, PlaneGeometry, MeshBasicMaterial } from 'three';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';

interface ZombieData {
  id: string;
  position: Vector3;
  health: number;
  isDying: boolean;
  dyingStartTime: number;
  speed: number;
  healthBar: Group | null;
  coloredMaterial?: THREE.MeshPhongMaterial;
}

interface ZombiesProps {
  playerPosition: Vector3;
  zombies: ZombieData[];
  setZombies: (zombies: ZombieData[]) => void;
  isGameOver: boolean;
  onPlayerDamage: (damage: number) => void;
  updatePositions?: (positions: { id: string; position: Vector3; isDying: boolean; direction?: Vector3 }[]) => void;
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
  healthBar: Group | null;
  coloredMaterial?: THREE.MeshPhongMaterial;
}

// Интерфейс для анимации предупреждения о зомби
interface ZombieWarning {
  id: string;
  position: Vector3;
  startTime: number;
  mesh: Group;
}

// Глобальный счетчик инстансов зомби для отслеживания потенциальных утечек
let totalZombiesCreated = 0;
let totalZombiesRemoved = 0;

// Система пулинга объектов для предотвращения частых операций создания/удаления
class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (item: T) => void;
  private maxSize: number;
  private _created: number = 0; // Счетчик созданных объектов
  private _reused: number = 0; // Счетчик повторно использованных объектов

  constructor(createFn: () => T, resetFn: (item: T) => void, initialSize: number = 0, maxSize: number = 100) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;

    // Предварительное создание объектов
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
      this._created++;
    }
    
    console.log(`Пул инициализирован: создано ${initialSize} объектов`);
  }

  // Получение объекта из пула или создание нового
  get(): T {
    if (this.pool.length > 0) {
      const obj = this.pool.pop()!;
      this._reused++;
      return obj;
    }
    
    this._created++;
    return this.createFn();
  }

  // Возврат объекта в пул с его сбросом
  release(item: T): void {
    if (this.pool.length < this.maxSize) {
      this.resetFn(item);
      this.pool.push(item);
    }
    // Если пул заполнен, объект будет утилизирован сборщиком мусора
  }

  // Очистка всего пула
  clear(): void {
    this.pool = [];
    this._created = 0;
    this._reused = 0;
  }

  // Получение текущего размера пула
  size(): number {
    return this.pool.length;
  }
  
  // Получение статистики пула
  getStats(): { created: number; reused: number; poolSize: number } {
    return {
      created: this._created,
      reused: this._reused,
      poolSize: this.pool.length
    };
  }
}

// Cached Geometries & Materials

// For Health Bar
const healthBarBackgroundGeometry = new PlaneGeometry(1, 0.1);
const healthBarForegroundGeometry = new PlaneGeometry(1, 0.1); // Initial full health, will be scaled
const healthBarBackgroundMaterial = new MeshPhongMaterial({
  color: 0xff0000,
  depthTest: false,
  transparent: true,
  opacity: 0.8
});
const healthBarForegroundMaterial = new MeshPhongMaterial({
  color: 0x00ff00,
  depthTest: false,
  transparent: true,
  opacity: 0.8
});

// For Zombie Parts
const zombieBodyGeometry = new THREE.CylinderGeometry(0.6, 0.5, 1.8, 8);
const zombieHeadGeometry = new SphereGeometry(0.5, 8, 8);
const zombieArmGeometry = new THREE.CylinderGeometry(0.2, 0.15, 1.3, 6);
const zombieEyeGeometry = new SphereGeometry(0.12, 8, 8);
const zombieMouthGeometry = new BoxGeometry(0.3, 0.05, 0.05);

const baseZombieMaterial = new MeshPhongMaterial({
  shininess: 10,
  flatShading: true
  // Color will be set on cloned material
});
const zombieEyeMaterial = new MeshPhongMaterial({
  color: 0x000000,
  shininess: 20,
  emissive: 0x330000,
  emissiveIntensity: 0.3
});
const zombieMouthMaterial = new MeshPhongMaterial({ color: 0x330000 });

// For Zombie Warning
const warningPlaneGeometry = new PlaneGeometry(3, 3);
const warningInnerCircleGeometry = new PlaneGeometry(1.5, 1.5);
const warningLightPillarGeometry = new THREE.CylinderGeometry(0.2, 0.5, 5, 8);

// Materials for warnings will be cloned as their opacity/color is animated per instance
const baseWarningPlaneMaterial = new MeshBasicMaterial({
  color: 0xff0000,
  transparent: true,
  opacity: 0.5,
  side: THREE.DoubleSide
});
const baseWarningInnerCircleMaterial = new MeshBasicMaterial({
  color: 0xffff00,
  transparent: true,
  opacity: 0.7,
  side: THREE.DoubleSide
});
const baseWarningLightPillarMaterial = new MeshBasicMaterial({
  color: 0xff0000,
  transparent: true,
  opacity: 0.3
});

// Класс для быстрого поиска соседей в пространстве (пространственное хеширование)
class SpatialHashGrid {
  private cellSize: number;
  private cells: Map<string, Set<string>>;
  
  constructor(cellSize: number = 5) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }
  
  // Получение ключа ячейки по позиции
  private getKey(position: Vector3): string {
    const x = Math.floor(position.x / this.cellSize);
    const z = Math.floor(position.z / this.cellSize);
    return `${x},${z}`;
  }
  
  // Добавление объекта в хеш-сетку
  add(id: string, position: Vector3): void {
    const key = this.getKey(position);
    if (!this.cells.has(key)) {
      this.cells.set(key, new Set());
    }
    this.cells.get(key)!.add(id);
  }
  
  // Удаление объекта из сетки
  remove(id: string, position: Vector3): void {
    const key = this.getKey(position);
    if (this.cells.has(key)) {
      this.cells.get(key)!.delete(id);
      if (this.cells.get(key)!.size === 0) {
        this.cells.delete(key);
      }
    }
  }
  
  // Поиск соседей в ячейке и соседних ячейках
  findNearby(position: Vector3, radius: number = 2): string[] {
    const result: string[] = [];
    const cellX = Math.floor(position.x / this.cellSize);
    const cellZ = Math.floor(position.z / this.cellSize);
    
    // Определяем радиус поиска в ячейках
    const cellRadius = Math.ceil(radius / this.cellSize);
    
    // Проверяем ячейки в пределах радиуса
    for (let x = cellX - cellRadius; x <= cellX + cellRadius; x++) {
      for (let z = cellZ - cellRadius; z <= cellZ + cellRadius; z++) {
        const key = `${x},${z}`;
        if (this.cells.has(key)) {
          for (const id of this.cells.get(key)!) {
            result.push(id);
          }
        }
      }
    }
    
    return result;
  }
  
  // Очистка сетки
  clear(): void {
    this.cells.clear();
  }
  
  // Обновление позиции объекта
  update(id: string, oldPosition: Vector3, newPosition: Vector3): void {
    const oldKey = this.getKey(oldPosition);
    const newKey = this.getKey(newPosition);
    
    if (oldKey !== newKey) {
      // Если объект перешел в новую ячейку, перемещаем его
      if (this.cells.has(oldKey)) {
        this.cells.get(oldKey)!.delete(id);
        if (this.cells.get(oldKey)!.size === 0) {
          this.cells.delete(oldKey);
        }
      }
      
      if (!this.cells.has(newKey)) {
        this.cells.set(newKey, new Set());
      }
      this.cells.get(newKey)!.add(id);
    }
  }
}

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

// Функция для получения N-го числа Фибоначчи
function fibonacci(n: number): number {
  if (n <= 1) return n;
  
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    const temp = a + b;
    a = b;
    b = temp;
  }
  return b;
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
  
  // Пул для переиспользования объектов зомби - добавляем начальное значение null
  const zombiePoolRef = useRef<ObjectPool<Group> | null>(null);
  const warningPoolRef = useRef<ObjectPool<Group> | null>(null);
  
  // Только для экстренных случаев - принудительное ограничение
  const HARD_MAX_ZOMBIES_LIMIT = 300; // Увеличено с 30 до 300 для стресс-тестирования
  
  // Refs to accumulate changes for batch update
  const zombiesToAddRef = useRef<ZombieData[]>([]);
  const zombiesToRemoveRef = useRef<string[]>([]);
  const zombiesToUpdateRef = useRef<Partial<ZombieData>[]>([]); // Store updates like health
  const [needsUpdate, setNeedsUpdate] = useState(false);
  
  // Для оптимизации поиска соседей зомби
  const spatialGrid = useRef<SpatialHashGrid>(new SpatialHashGrid(5));
  const zombiePositions = useRef<{ [key: string]: Vector3 }>({});
  
  // Для оптимизации calculateZombieDirection
  const frameCount = useRef<number>(0);
  const separationForces = useRef<{ [key: string]: Vector3 }>({});
  const neighborCounts = useRef<{ [key: string]: number }>({});
  
  // Для системы Фибоначчи и волн
  const gameStartTime = useRef<number>(Date.now());
  const lastWaveTime = useRef<number>(Date.now());
  const nextWaveInterval = useRef<number>(60000); // 1 minute between waves
  const spawnBurst = useRef<number>(0); // Number of zombies to create in current wave
  const spawnBurstRemaining = useRef<number>(0); // How many left to create in current wave
  const burstSpawnInterval = useRef<number>(500); // Interval between spawns in wave
  const lastBurstSpawnTime = useRef<number>(0);
  
  // Константы для оптимизации
  const SEPARATION_UPDATE_FREQUENCY = 10; // Обновлять разделение каждые N кадров
  const ZOMBIE_UPDATE_BATCH_SIZE = 25; // Увеличено с 15 до 25 для обработки большего количества зомби за кадр
  const PERFORMANCE_MONITOR_INTERVAL = 20; // Интервал мониторинга производительности (кадры)
  
  // Для контроля производительности
  const fpsHistory = useRef<number[]>([]);
  const lastFrameTime = useRef<number>(0);
  const dynamicSpawnInterval = useRef<number>(500); // Начальное значение спавна уменьшено с 2000 до 500 мс
  const averageFps = useRef<number>(60); // Средний FPS для динамической адаптации
  const lowPerformanceMode = useRef<boolean>(false); // Режим низкой производительности
  const criticalPerformanceMode = useRef<boolean>(false); // Режим критически низкой производительности
  const ultraLowGraphicsMode = useRef<boolean>(false); // Режим ультра-низкой графики - критически упрощенные объекты
  
  // Инициализация пулов объектов при монтировании компонента
  useEffect(() => {
    // Создаем простую группу для зомби
    const createZombieGroup = (): Group => {
      const group = new Group();
      // Не добавляем никаких элементов, они будут добавлены при использовании
      return group;
    };
    
    // Сброс группы зомби перед возвратом в пул
    const resetZombieGroup = (group: Group): void => {
      // Удаляем все дочерние элементы
      while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        
        // Освобождаем ресурсы для материалов и геометрий
        if (child instanceof Mesh) {
          if (child.material instanceof MeshPhongMaterial || 
              child.material instanceof MeshBasicMaterial) {
            child.material.dispose();
          }
          if (child.geometry) {
            child.geometry.dispose();
          }
        }
      }
      
      // Сбрасываем позицию и поворот
      group.position.set(0, 0, 0);
      group.rotation.set(0, 0, 0);
      
      // Сбрасываем userData
      group.userData = {};
    };
    
    // Создаем простую группу для предупреждений
    const createWarningGroup = (): Group => {
      const group = new Group();
      return group;
    };
    
    // Сброс группы предупреждений перед возвратом в пул
    const resetWarningGroup = (group: Group): void => {
      // Удаляем все дочерние элементы
      while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        
        if (child instanceof Mesh) {
          if (child.material instanceof MeshBasicMaterial) {
            child.material.dispose();
          }
          if (child.geometry) {
            child.geometry.dispose();
          }
        }
      }
      
      // Сбрасываем позицию и поворот с правильными аргументами
      group.position.set(0, 0, 0);
      group.rotation.set(0, 0, 0);
      
      // Сбрасываем userData
      group.userData = {};
    };
    
    // Создаем пулы с начальными объектами
    // Увеличиваем начальный размер и максимальный размер пула для лучшей производительности
    zombiePoolRef.current = new ObjectPool<Group>(
      createZombieGroup,
      resetZombieGroup,
      20, // Увеличено с 5 до 20
      100 // Увеличено с 30 до 100
    );
    
    warningPoolRef.current = new ObjectPool<Group>(
      createWarningGroup,
      resetWarningGroup,
      10, // Увеличено с 5 до 10
      50  // Увеличено с 20 до 50
    );
    
    // Для мобильных устройств или низкой производительности сразу активируем режим низкой графики
    if (window.innerWidth < 768 || window.navigator.userAgent.includes('Mobile')) {
      lowPerformanceMode.current = true;
      console.log('Мобильное устройство обнаружено, включен режим низкой производительности');
    }
    
    // Для очень слабых устройств включаем ультра-низкую графику
    const gl = document.createElement('canvas').getContext('webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        // Если это слабые встроенные GPU, включаем ультра-низкую графику
        if (renderer.includes('Intel') || 
            renderer.includes('Mesa') || 
            renderer.includes('Integrated') ||
            renderer.includes('Apple GPU')) {
          ultraLowGraphicsMode.current = true;
          lowPerformanceMode.current = true;
          console.log('Обнаружена встроенная графика, включен режим ультра-низкой графики');
        }
      }
    }
    
    // Устанавливаем проверку на утечки памяти 
    const intervalId = setInterval(() => {
      const zombiePoolStats = zombiePoolRef.current?.getStats() || { created: 0, reused: 0, poolSize: 0 };
      const warningPoolStats = warningPoolRef.current?.getStats() || { created: 0, reused: 0, poolSize: 0 };
      
      console.log(`Zombie statistics: created=${totalZombiesCreated}, removed=${totalZombiesRemoved}, active=${Object.keys(zombieRefs.current).length}`);
      console.log(`Zombie pool: created=${zombiePoolStats.created}, reused=${zombiePoolStats.reused}, pool size=${zombiePoolStats.poolSize}`);
      console.log(`Warning pool: created=${warningPoolStats.created}, reused=${warningPoolStats.reused}, pool size=${warningPoolStats.poolSize}`);
    }, 10000);
    
    return () => {
      // Clean up on unmount
      // При размонтировании очищаем пулы
      zombiePoolRef.current?.clear();
      warningPoolRef.current?.clear();
      
      // Удаляем всех зомби из сцены
      Object.values(zombieRefs.current).forEach(zombie => {
        scene.remove(zombie.mesh);
        
        // Освобождаем ресурсы
        zombie.mesh.traverse((child) => {
          if (child instanceof Mesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(material => material.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
      });
      
      // Удаляем все предупреждения о зомби
      Object.values(zombieWarnings.current).forEach(warning => {
        scene.remove(warning.mesh);
        
        // Освобождаем ресурсы
        warning.mesh.traverse((child) => {
          if (child instanceof Mesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(material => material.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
      });
      
      // Очищаем пространственную сетку
      spatialGrid.current.clear();
      
      // Очищаем интервал
      clearInterval(intervalId);
      
      // Очищаем данные о зомби
      zombieRefs.current = {};
      zombieWarnings.current = {};
      zombiePositions.current = {};
      separationForces.current = {};
      neighborCounts.current = {};
    };
  }, [scene]);
  
  // Создание зомби с использованием пула объектов
  const createZombie = (position: Vector3) => {
    // Проверяем, не превышен ли жесткий лимит зомби
    const currentZombieCount = Object.keys(zombieRefs.current).length;
    if (currentZombieCount >= HARD_MAX_ZOMBIES_LIMIT) {
      console.log(`Reached hard zombie limit (${currentZombieCount}/${HARD_MAX_ZOMBIES_LIMIT}), canceling creation`);
      return null;
    }
    
    const id = uuidv4();
    totalZombiesCreated++;
    
    // Берем группу из пула или создаем новую
    const zombieGroup = zombiePoolRef.current?.get() || new Group();
    
    const initialHealth = 100;
    // Клонируем базовый материал для частей, меняющих цвет
    const coloredBodyMaterial = baseZombieMaterial.clone() as THREE.MeshPhongMaterial;
    coloredBodyMaterial.color.set(getZombieColorByHealth(initialHealth));
    
    // Используем упрощенную геометрию для всех режимов 
    if (ultraLowGraphicsMode.current) {
      // Ультра-упрощенная версия - просто куб и сфера
      const body = new Mesh(
        new BoxGeometry(1, 2, 1),
        coloredBodyMaterial
      );
      body.position.set(0, 1.0, 0);
      zombieGroup.add(body);
    } else if (criticalPerformanceMode.current || lowPerformanceMode.current) {
      // Упрощенная версия - только основные части
      const body = new Mesh(zombieBodyGeometry, coloredBodyMaterial);
      body.position.set(0, 1.0, 0);
      
      const head = new Mesh(zombieHeadGeometry, coloredBodyMaterial);
      head.position.set(0, 2.1, 0);
      head.scale.set(1, 1.1, 1);
      head.castShadow = true;
      head.userData = { isHead: true }; // Добавляем метку головы для проверки хедшотов
      
      zombieGroup.add(body);
      zombieGroup.add(head);
    } else {
      // Стандартная версия с более детальной моделью
      const body = new Mesh(zombieBodyGeometry, coloredBodyMaterial);
      body.position.set(0, 1.0, 0);
      body.castShadow = true;
      
      const head = new Mesh(zombieHeadGeometry, coloredBodyMaterial);
      head.position.set(0, 2.1, 0);
      head.scale.set(1, 1.1, 1);
      head.castShadow = true;
      
      const leftArm = new Mesh(zombieArmGeometry, coloredBodyMaterial);
      leftArm.position.set(0.8, 1.4, 0);
      leftArm.rotation.z = Math.PI / 6;
      
      const rightArm = new Mesh(zombieArmGeometry, coloredBodyMaterial);
      rightArm.position.set(-0.8, 1.4, 0);
      rightArm.rotation.z = -Math.PI / 6;
      
      // Глаза
      const leftEye = new Mesh(zombieEyeGeometry, zombieEyeMaterial);
      leftEye.position.set(0.2, 2.2, 0.35);
      
      const rightEye = new Mesh(zombieEyeGeometry, zombieEyeMaterial);
      rightEye.position.set(-0.2, 2.2, 0.35);
      
      // Рот
      const mouth = new Mesh(zombieMouthGeometry, zombieMouthMaterial);
      mouth.position.set(0, 1.95, 0.45);
      
      zombieGroup.add(body);
      zombieGroup.add(head);
      zombieGroup.add(leftArm);
      zombieGroup.add(rightArm);
      zombieGroup.add(leftEye);
      zombieGroup.add(rightEye);
      zombieGroup.add(mouth);
    }
    
    // Добавляем небольшой случайный наклон для разнообразия
    zombieGroup.rotation.x = (Math.random() - 0.5) * 0.1;
    zombieGroup.rotation.y = Math.random() * Math.PI * 2;
    zombieGroup.rotation.z = (Math.random() - 0.5) * 0.1;
    
    zombieGroup.position.copy(position);
    zombieGroup.userData = { isZombie: true, id, health: initialHealth };
    
    // Создаем и добавляем полоску здоровья только если не в режиме ультра-низкой графики
    let healthBarGroup: Group | null = null;
    if (!ultraLowGraphicsMode.current) {
      healthBarGroup = createHealthBar();
      zombieGroup.add(healthBarGroup);
    }
    
    // Добавляем зомби в сцену
    scene.add(zombieGroup);
    
    // Добавляем зомби в пространственную сетку
    spatialGrid.current.add(id, position.clone());
    zombiePositions.current[id] = position.clone();
    
    // Создаем случайную стартовую скорость с большей вариацией
    const zombieSpeed = getZombieSpeed() * (0.7 + Math.random() * 0.6);
    
    // Сохраняем ссылку на зомби
    const zombieObj: Zombie = {
      id,
      mesh: zombieGroup,
      velocity: new Vector3(0, 0, 0),
      lastDamageTime: 0,
      health: initialHealth,
      isDying: false,
      dyingStartTime: 0,
      speed: zombieSpeed,
      healthBar: healthBarGroup,
      coloredMaterial: coloredBodyMaterial
    };
    
    // Логируем создание зомби
    console.log(`Created zombie ${id} at position ${position.x.toFixed(2)}, ${position.z.toFixed(2)}`);
    
    zombieRefs.current[id] = zombieObj;
    
    // Accumulate zombie to add instead of calling setZombies directly
    zombiesToAddRef.current.push({
      id,
      position: zombieGroup.position.clone(),
      health: initialHealth,
      isDying: false,
      dyingStartTime: 0,
      speed: zombieSpeed,
      healthBar: healthBarGroup,
      coloredMaterial: coloredBodyMaterial
    });
    setNeedsUpdate(true); // Signal that an update is needed
    
    return zombieObj;
  };
  
  // Создание предупреждения о появлении зомби с использованием пула
  const createZombieWarning = (position: Vector3) => {
    const id = uuidv4();
    
    // Берем группу из пула или создаем новую
    const warningGroup = warningPoolRef.current?.get() || new Group();
    
    // Для режима ультра-низкой графики создаем максимально упрощенное предупреждение
    if (ultraLowGraphicsMode.current) {
      // Только простой круг
      const warningMesh = new Mesh(
        new PlaneGeometry(2, 2),
        new MeshBasicMaterial({
          color: 0xff0000,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide
        })
      );
      warningMesh.rotation.x = -Math.PI / 2;
      warningMesh.position.y = 0.05;
      warningGroup.add(warningMesh);
    } else {
      // Стандартное предупреждение
      const warningMesh = new Mesh(warningPlaneGeometry, baseWarningPlaneMaterial.clone());
      warningMesh.rotation.x = -Math.PI / 2;
      warningMesh.position.y = 0.05;
      
      const innerCircleMesh = new Mesh(warningInnerCircleGeometry, baseWarningInnerCircleMaterial.clone());
      innerCircleMesh.rotation.x = -Math.PI / 2;
      innerCircleMesh.position.y = 0.06;
      
      // Световой столб только в полнофункциональном режиме
      if (!lowPerformanceMode.current && !criticalPerformanceMode.current) {
        const lightPillar = new Mesh(warningLightPillarGeometry, baseWarningLightPillarMaterial.clone());
        lightPillar.position.y = 2.5;
        warningGroup.add(lightPillar);
      }
      
      warningGroup.add(warningMesh);
      warningGroup.add(innerCircleMesh);
    }
    
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
    
    console.log(`Created zombie warning ${id} at position ${position.x.toFixed(2)}, ${position.z.toFixed(2)}`);
    
    return warning;
  };
  
  // Удаление зомби с возвратом в пул
  const removeZombie = (id: string) => {
    const zombie = zombieRefs.current[id];
    if (zombie) {
      scene.remove(zombie.mesh);
      
      // Удаляем из пространственной сетки
      if (zombiePositions.current[id]) {
        spatialGrid.current.remove(id, zombiePositions.current[id]);
        delete zombiePositions.current[id];
      }
      
      // Возвращаем в пул объектов
      if (zombiePoolRef.current) {
        zombiePoolRef.current.release(zombie.mesh);
      }
      
      delete zombieRefs.current[id];
      totalZombiesRemoved++;
      
      // Accumulate zombie ID to remove
      zombiesToRemoveRef.current.push(id);
      setNeedsUpdate(true); // Signal that an update is needed
    }
  };
  
  // Удаление предупреждения о зомби с возвратом в пул
  const removeZombieWarning = (id: string) => {
    const warning = zombieWarnings.current[id];
    if (warning) {
      scene.remove(warning.mesh);
      
      // Возвращаем в пул объектов
      if (warningPoolRef.current) {
        warningPoolRef.current.release(warning.mesh);
      }
      
      delete zombieWarnings.current[id];
      console.log(`Removed zombie warning ${id}`);
    }
  };
  
  // Создание полоски здоровья для зомби
  const createHealthBar = () => {
    const healthBarGroup = new Group();
    
    // Используем закэшированные геометрии и материалы
    const background = new Mesh(healthBarBackgroundGeometry, healthBarBackgroundMaterial);
    const bar = new Mesh(healthBarForegroundGeometry, healthBarForegroundMaterial); // Эта геометрия будет масштабироваться
    
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
    const healthBarMesh = zombie.healthBar.children[1] as THREE.Mesh;
    
    if (!healthBarMesh) {
      console.warn("Некорректная полоска здоровья");
      return;
    }
    
    // Обновляем ширину зеленой полоски в зависимости от здоровья
    const healthPercent = Math.max(0, zombie.health / 100);
    
    // Масштабируем существующую геометрию вместо ее замены
    healthBarMesh.scale.x = healthPercent;
    
    // Корректируем позицию, чтобы масштабирование происходило от левого края
    // Исходная геометрия имеет ширину 1. Центр вращения находится в ее центре.
    // Когда scale.x = 1, position.x должен быть 0.
    // Когда scale.x = 0.5, position.x должен быть -0.25 ( (0.5-1)/2 )
    // Когда scale.x = 0, position.x должен быть -0.5
    healthBarMesh.position.x = (healthPercent - 1) / 2;
  };
  
  // Получение скорости для новых зомби на основе волны
  const getZombieSpeed = (): number => {
    // Базовая скорость + логарифмическое увеличение от волны
    // Логарифм обеспечивает быстрый рост в начале и замедление в поздних волнах
    const speedIncrease = Math.log(wave.current + 1) / Math.log(5); // Логарифм по основанию 5
    const speed = baseZombieSpeed.current * (1 + speedIncrease * 0.5);
    
    // Ограничиваем максимальную скорость
    const maxSpeed = lowPerformanceMode.current ? 7 : 10;
    return Math.min(speed, maxSpeed);
  };
  
  // Спавн зомби
  const spawnZombie = () => {
      const now = Date.now();
    
    // Получаем текущее число активных зомби (не умирающих)
    const activeZombieCount = Object.values(zombieRefs.current)
      .filter(zombie => !zombie.isDying).length;
    
    // Динамически вычисляем максимальное количество зомби на основе волны и Фибоначчи
    const MAX_ZOMBIES = getMaxZombies();
    
    // Проверяем, не пора ли начать новую волну
    if (now - lastWaveTime.current > nextWaveInterval.current) {
      // Увеличиваем счетчик волны
      wave.current++;
      
      // Запоминаем время начала новой волны
      lastWaveTime.current = now;
      
      // Вычисляем размер волны (количество зомби) по Фибоначчи и увеличиваем в 10 раз
      spawnBurst.current = fibonacci(wave.current + 5) * 10; // Increased by 10x!
      spawnBurstRemaining.current = spawnBurst.current;
      
      // Увеличиваем базовую скорость зомби
      baseZombieSpeed.current = Math.min(8, baseZombieSpeed.current + 0.2);
      
      // Уменьшаем интервал между волнами в 2 раза
      nextWaveInterval.current = Math.max(15000, 30000 - wave.current * 2000); // Reduced to 15 seconds minimum from 30
      
      console.log(`===== NEW WAVE ${wave.current} =====`);
      console.log(`Number of zombies: ${spawnBurst.current}`);
      console.log(`Base speed: ${baseZombieSpeed.current.toFixed(1)}`);
      console.log(`Next wave in: ${(nextWaveInterval.current / 1000).toFixed(0)} seconds`);
    }
    
    // Проверяем, нужно ли спавнить зомби из текущей волны
    if (spawnBurstRemaining.current > 0 && now - lastBurstSpawnTime.current > burstSpawnInterval.current) {
      if (activeZombieCount < MAX_ZOMBIES) {
        // Создаем нового зомби в волне
        const arenaSize = 24;
        const spawnPosition = getRandomWallPosition(arenaSize);
        
        // Создаем предупреждение вместо зомби
        createZombieWarning(spawnPosition);
        
        // Уменьшаем счетчик оставшихся зомби в волне
        spawnBurstRemaining.current--;
        
        // Запоминаем время спавна
        lastBurstSpawnTime.current = now;
        lastSpawnTime.current = now;
        
        // Адаптируем интервал спавна к размеру волны: чем больше волна, тем чаще спавн
        // Уменьшаем интервал в 5 раз
        burstSpawnInterval.current = Math.max(50, 400 - wave.current * 20); // Было Math.max(200, 2000 - wave.current * 100)
        
        return; // Выходим после создания зомби из волны
      }
    }
    
    // Если достигнут лимит зомби, пропускаем стандартный спавн
    if (activeZombieCount >= MAX_ZOMBIES) {
      // Пропускаем спавн, если достигнут максимум
      return;
    }
    
    // Стандартный спавн зомби между волнами (редкий)
    // Адаптируем интервал спавна в зависимости от количества зомби и текущей волны
    // Уменьшаем интервал в 2 раза
    const spawnInterval = dynamicSpawnInterval.current * (1 + activeZombieCount / MAX_ZOMBIES) 
      * (1 + Math.log(wave.current + 1) / Math.log(10)) / 2; // Добавлено деление на 2
    
    if (now - lastSpawnTime.current > spawnInterval) {
      lastSpawnTime.current = now;
      
      // Создаем предупреждение о появлении зомби
      const arenaSize = 24;
      const spawnPosition = getRandomWallPosition(arenaSize);
      
      // Создаем предупреждение вместо зомби
      createZombieWarning(spawnPosition);
    }
  };
  
  // Расчет направления к игроку с учетом избегания других зомби
  const calculateZombieDirection = (zombie: Zombie): Vector3 => {
    // Если зомби умирает, не двигаем его
    if (zombie.isDying) {
      return new Vector3(0, 0, 0);
    }
    
    // Базовое направление к игроку - всегда рассчитываем
    const directionToPlayer = new Vector3()
      .subVectors(playerPosition, zombie.mesh.position)
      .normalize();
    
    // Проверяем, есть ли уже рассчитанная сила отталкивания для данного зомби
    // Если нет, создаем пустой вектор
    if (!separationForces.current[zombie.id]) {
      separationForces.current[zombie.id] = new Vector3();
      neighborCounts.current[zombie.id] = 0;
    }
    
    // Объединяем силы с разными весами
    const seekWeight = 1;
    const separationWeight = 1.5;
    
    // Результирующее направление
    const direction = directionToPlayer.multiplyScalar(seekWeight);
    
    // Добавляем силу отталкивания, если она есть и у зомби есть соседи
    if (separationForces.current[zombie.id] && neighborCounts.current[zombie.id] > 0) {
      direction.add(
        separationForces.current[zombie.id]
          .clone()
          .multiplyScalar(separationWeight)
      );
    }
    
    // Нормализуем конечное направление
    return direction.normalize();
  };

  // Вынесено в отдельную функцию для оптимизации
  const calculateSeparationForces = () => {
    // Очищаем предыдущие силы и счетчики
    separationForces.current = {};
    neighborCounts.current = {};
    
    // Используем пространственное хеширование для быстрого нахождения соседей
    // Перебираем только активных зомби
    Object.values(zombieRefs.current).forEach((zombie) => {
      if (zombie.isDying) return; // Пропускаем умирающих зомби
      
      // Инициализируем силу отталкивания и счетчик соседей
      separationForces.current[zombie.id] = new Vector3();
      neighborCounts.current[zombie.id] = 0;
      
      // Определяем радиус разделения в зависимости от количества зомби
      // Чем больше зомби, тем меньше радиус, чтобы они могли плотнее группироваться
      const zombieCount = Object.keys(zombieRefs.current).length;
      const separationRadius = zombieCount > 100 ? 1.2 : zombieCount > 50 ? 1.5 : 2;
      
      // Получаем позицию зомби
      const zombiePosition = zombie.mesh.position;
      
      // Быстро находим потенциальных соседей через пространственную сетку
      const nearbyZombieIds = spatialGrid.current.findNearby(zombiePosition, separationRadius);
      
      // Ограничиваем количество обрабатываемых соседей для повышения производительности
      // при наличии большого количества зомби
      const limitedNeighbors = zombieCount > 150 ? 
                              nearbyZombieIds.slice(0, 5) : 
                              zombieCount > 80 ? 
                              nearbyZombieIds.slice(0, 8) : 
                              nearbyZombieIds;
      
      // Обрабатываем только ближайших соседей
      limitedNeighbors.forEach((otherId) => {
        if (otherId === zombie.id) return; // Пропускаем самого себя
        
        const otherZombie = zombieRefs.current[otherId];
        if (!otherZombie || otherZombie.isDying) return; // Пропускаем отсутствующих или умирающих зомби
        
        // Вычисляем расстояние между зомби
        const distance = zombiePosition.distanceTo(otherZombie.mesh.position);
        
        // Если зомби достаточно близко
        if (distance < separationRadius) {
          // Вектор, указывающий от другого зомби к текущему
          const awayVector = new Vector3()
            .subVectors(zombiePosition, otherZombie.mesh.position);
          
          // Нормализуем и масштабируем по расстоянию (чем ближе, тем сильнее)
          awayVector.normalize().divideScalar(Math.max(0.1, distance));
          
          // Добавляем к существующей силе отталкивания
          separationForces.current[zombie.id].add(awayVector);
          neighborCounts.current[zombie.id]++;
        }
      });
      
      // Нормализуем силу отталкивания, если у зомби есть соседи
      if (neighborCounts.current[zombie.id] > 0) {
        separationForces.current[zombie.id]
          .divideScalar(neighborCounts.current[zombie.id])
          .normalize();
      }
    });
  };
  
  // Обработка падения умирающих зомби
  const processDeadZombie = (zombie: Zombie) => {
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
  useFrame((state, delta) => {
    if (isGameOver) return;
    
    // Мониторинг производительности
    const now = performance.now();
    if (lastFrameTime.current > 0) {
      const frameTime = now - lastFrameTime.current;
      const fps = 1000 / frameTime;
      
      // Сохраняем историю FPS
      fpsHistory.current.push(fps);
      if (fpsHistory.current.length > 10) {
        fpsHistory.current.shift();
      }
      
      // Каждые N кадров анализируем производительность и адаптируем параметры
      if (frameCount.current % PERFORMANCE_MONITOR_INTERVAL === 0) {
        // Вычисляем средний FPS
        const avgFps = fpsHistory.current.reduce((sum, fps) => sum + fps, 0) / fpsHistory.current.length;
        averageFps.current = avgFps;
        
        // Определяем режим производительности
        const wasCritical = criticalPerformanceMode.current;
        const wasLow = lowPerformanceMode.current;
        const wasUltraLow = ultraLowGraphicsMode.current;
        
        // Для стресс-теста снижаем порог критического FPS с 15 до 10 и с 20 до 12
        if (avgFps < 10) { // Было < 15
          // Включаем режим ультра-низкой графики при критически низком FPS
          ultraLowGraphicsMode.current = true;
          criticalPerformanceMode.current = true;
          lowPerformanceMode.current = true;
          console.log(`КРИТИЧЕСКИ НИЗКИЙ FPS (${avgFps.toFixed(0)}), активируем ультра-низкую графику`);
          
          // При экстремально низкой производительности удаляем большую часть зомби
          if (!wasUltraLow) {
            const zombiesCount = Object.keys(zombieRefs.current).length;
            if (zombiesCount > 40) { // Увеличено с 8 до 40
              // Удаляем половину зомби для экстренного повышения производительности
              const toRemove = Math.floor(zombiesCount * 0.3); // Уменьшено с 0.5 до 0.3
              removeDistantZombies(toRemove);
            }
          }
        } else if (avgFps < 12) { // Было < 20
          ultraLowGraphicsMode.current = false;
          criticalPerformanceMode.current = true;
          lowPerformanceMode.current = true;
          console.log(`КРИТИЧЕСКИ НИЗКИЙ FPS (${avgFps.toFixed(0)}), активируем экстренные меры`);
          
          // Если большое падение производительности, удаляем часть зомби
          if (!wasCritical) {
            const zombiesCount = Object.keys(zombieRefs.current).length;
            if (zombiesCount > 40) { // Увеличено с 8 до 40
              // Удаляем самых дальних зомби
              const toRemove = Math.floor(zombiesCount * 0.2); // Уменьшено с 0.3 до 0.2
              removeDistantZombies(toRemove);
            }
          }
        } else if (avgFps < 20) { // Было < 30
          ultraLowGraphicsMode.current = false;
          criticalPerformanceMode.current = false;
          lowPerformanceMode.current = true;
          if (!wasLow) {
            console.log(`Низкий FPS (${avgFps.toFixed(0)}), активируем режим низкой производительности`);
          }
        } else if (avgFps > 35) { // Было > 45
          ultraLowGraphicsMode.current = false;
          criticalPerformanceMode.current = false;
          lowPerformanceMode.current = false;
        }
        
        // Адаптируем интервал спавна в зависимости от FPS
        if (avgFps < 20) { // Было < 30
          // Производительность низкая, увеличиваем интервал спавна
          dynamicSpawnInterval.current = Math.min(2000, dynamicSpawnInterval.current * 1.2); // Уменьшено с 5000 до 2000, множитель с 1.3 до 1.2
          
          // Также увеличиваем интервал между волнами
          if (nextWaveInterval.current < 45000) { // Уменьшено с 90000 до 45000
            nextWaveInterval.current = Math.min(45000, nextWaveInterval.current * 1.1); // Множитель уменьшен с 1.2 до 1.1
          }
        } else if (avgFps > 30 && dynamicSpawnInterval.current > 250) { // Было > 50 и > 1000
          // Производительность хорошая, можем уменьшить интервал спавна
          dynamicSpawnInterval.current = Math.max(250, dynamicSpawnInterval.current * 0.9); // Уменьшено с 1000 до 250
        }
      }
    }
    lastFrameTime.current = now;
    
    // Увеличиваем счетчик кадров
    frameCount.current++;
    
    // В критическом режиме обрабатываем только каждый третий кадр для экономии CPU
    if (criticalPerformanceMode.current && frameCount.current % 3 !== 0) {
      return;
    }
    
    // В режиме ультра-низкой графики обрабатываем каждый четвертый кадр
    if (ultraLowGraphicsMode.current && frameCount.current % 4 !== 0) {
      return;
    }
    
    // Спавн новых зомби - выполняем только на определенных кадрах
    if (frameCount.current % 5 === 0) {
      spawnZombie();
    }
    
    // Обновляем предупреждения о зомби только в некритичном режиме и не на каждом кадре
    if ((!criticalPerformanceMode.current && frameCount.current % 2 === 0) || 
        (criticalPerformanceMode.current && frameCount.current % 6 === 0)) {
      updateZombieWarnings(delta);
    }
    
    // Частота обновления сил разделения зависит от режима производительности и количества зомби
    // Чем больше зомби, тем реже вычисляем силы отталкивания
    const zombieCount = Object.keys(zombieRefs.current).length;
    const separationFrequency = 
      ultraLowGraphicsMode.current ? 
        SEPARATION_UPDATE_FREQUENCY * 6 :
      criticalPerformanceMode.current ? 
        SEPARATION_UPDATE_FREQUENCY * 4 : 
      lowPerformanceMode.current ? 
        SEPARATION_UPDATE_FREQUENCY * 2 : 
      zombieCount > 200 ?
        SEPARATION_UPDATE_FREQUENCY * 3 :
      zombieCount > 100 ?
        SEPARATION_UPDATE_FREQUENCY * 2 :
      SEPARATION_UPDATE_FREQUENCY;
    
    // Пересчитываем силы отталкивания только раз в separationFrequency кадров
    if (frameCount.current % separationFrequency === 0) {
      calculateSeparationForces();
    }
    
    // Собираем данные о позициях зомби для мини-карты с пониженной частотой
    if (updatePositions && 
        ((!lowPerformanceMode.current && frameCount.current % 2 === 0) ||
         (lowPerformanceMode.current && frameCount.current % 3 === 0) ||
         (criticalPerformanceMode.current && frameCount.current % 5 === 0) ||
         (ultraLowGraphicsMode.current && frameCount.current % 7 === 0))) {
      
      // Send all zombie positions for UI update
      const positions = Object.values(zombieRefs.current)
        .map(zombie => {
          // Получаем направление взгляда из поворота зомби
          const direction = new THREE.Vector3(0, 0, 1)
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), zombie.mesh.rotation.y);
          
          return {
            id: zombie.id,
            position: zombie.mesh.position.clone(),
            isDying: zombie.isDying,
            direction: direction
          };
        });
      
      updatePositions(positions);
    }
    
    // Получаем все активные зомби
    const zombieIds = Object.keys(zombieRefs.current);
    
    // Ограничиваем количество обрабатываемых зомби за один кадр
    // Адаптивно увеличиваем размер пакета для большего количества зомби
    const batchSize = 
      zombieCount > 150 ? 
        Math.min(50, Math.floor(zombieCount / 6)) : // Для большого количества зомби увеличиваем пакет
      ultraLowGraphicsMode.current ?
        Math.max(3, Math.floor(ZOMBIE_UPDATE_BATCH_SIZE / 5)) :
      criticalPerformanceMode.current ? 
        Math.max(5, Math.floor(ZOMBIE_UPDATE_BATCH_SIZE / 4)) : 
      lowPerformanceMode.current ? 
        Math.floor(ZOMBIE_UPDATE_BATCH_SIZE / 2) : 
      ZOMBIE_UPDATE_BATCH_SIZE;
    
    // Оптимизация: статический индекс обработки для равномерного распределения зомби
    // Вместо (frameCount.current * batchSize) % Math.max(1, zombieIds.length)
    // Разделим зомби на равные группы и будем обрабатывать их последовательно
    const numGroups = Math.ceil(zombieIds.length / batchSize);
    const groupIndex = frameCount.current % numGroups;
    const startIndex = groupIndex * batchSize;
    const endIndex = Math.min(startIndex + batchSize, zombieIds.length);
    
    // Обрабатываем только часть зомби за раз
    for (let i = startIndex; i < endIndex; i++) {
      const id = zombieIds[i];
      const zombie = zombieRefs.current[id];
      if (!zombie) continue;
      
      // Обрабатываем умирающих зомби отдельно и с меньшей частотой
      if (zombie.isDying) {
        // В критическом режиме обрабатываем умирающих зомби реже
        if (criticalPerformanceMode.current && frameCount.current % 2 !== 0) {
          continue;
        }
        
        const shouldRemove = processDeadZombie(zombie);
        if (shouldRemove) {
          removeZombie(id);
        }
        continue; // Пропускаем дальнейшую обработку для умирающих зомби
      }
      
      // Вычисляем расстояние до игрока
      const distanceToPlayer = zombie.mesh.position.distanceTo(playerPosition);
      
      // Оптимизация: адаптивное пропускание обновлений для дальних зомби
      // Чем больше зомби, тем чаще пропускаем обновления
      if (lowPerformanceMode.current || zombieCount > 100) {
        if ((distanceToPlayer > 15 && frameCount.current % 4 !== 0) ||
            (distanceToPlayer > 10 && frameCount.current % 3 !== 0)) {
          continue; // Пропускаем обработку дальних зомби
        }
      }
      
      // В ультра-низком режиме пропускаем еще больше обновлений для дальних зомби
      if (ultraLowGraphicsMode.current || zombieCount > 150) {
        if ((distanceToPlayer > 20 && frameCount.current % 10 !== 0) ||
            (distanceToPlayer > 15 && frameCount.current % 6 !== 0) ||
            (distanceToPlayer > 10 && frameCount.current % 3 !== 0)) {
          continue; // Пропускаем обработку дальних зомби с разной частотой
        }
      }
      
      // Получаем направление движения
      const direction = calculateZombieDirection(zombie);
      
      // Обновляем скорость
      const speed = zombie.speed * delta;
      zombie.velocity.copy(direction.multiplyScalar(speed));
      
      // Вместо сохранения неиспользуемой переменной oldPosition,
      // сразу обновляем пространственную сетку
      const oldPos = zombie.mesh.position.clone();
      
      // Обновляем позицию
      zombie.mesh.position.add(zombie.velocity);
      
      // Ограничиваем в пределах арены
      const arenaSize = 24;
      zombie.mesh.position.x = Math.max(-arenaSize, Math.min(arenaSize, zombie.mesh.position.x));
      zombie.mesh.position.z = Math.max(-arenaSize, Math.min(arenaSize, zombie.mesh.position.z));
      
      // Обновляем позицию в пространственной сетке
      if (zombiePositions.current[id]) {
        spatialGrid.current.update(id, oldPos, zombie.mesh.position.clone());
        zombiePositions.current[id].copy(zombie.mesh.position);
      }
      
      // Поворачиваем зомби к игроку, если он движется и находится близко
      // Пропускаем для дальних зомби в режиме низкой производительности
      if (zombie.velocity.length() > 0.001 && 
          ((distanceToPlayer < 20 && !lowPerformanceMode.current && !criticalPerformanceMode.current) || 
           (distanceToPlayer < 15 && lowPerformanceMode.current) ||
           (distanceToPlayer < 10 && criticalPerformanceMode.current))) {
        
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
        // Для низкой производительности уменьшаем плавность
        const rotationSpeed = lowPerformanceMode.current ? 7 : 5;
        zombie.mesh.rotation.y += normalizedDiff * Math.min(1, delta * rotationSpeed);
      }
      
      // Всегда поворачиваем полоску здоровья к камере, только для живых зомби и близких зомби
      if (zombie.healthBar && 
          ((distanceToPlayer < 15 && frameCount.current % 2 === 0 && !lowPerformanceMode.current) || 
           (distanceToPlayer < 10 && frameCount.current % 3 === 0 && !criticalPerformanceMode.current) ||
           (distanceToPlayer < 5))) {
        
        zombie.healthBar.position.set(0, 2.8, 0);
        
        // Убеждаемся, что полоска всегда обращена вверх
        zombie.healthBar.rotation.x = -Math.PI / 2;
        zombie.healthBar.rotation.y = 0;
        zombie.healthBar.rotation.z = 0;
      }
      
      // Проверяем столкновение с игроком только для ближайших зомби
      if (distanceToPlayer < 2) {
        const now = Date.now();
        
        // Если зомби близко к игроку и достаточно времени прошло с последнего удара
        if (distanceToPlayer < 1.5 && now - zombie.lastDamageTime > 1000) {
          zombie.lastDamageTime = now;
          onPlayerDamage(10); // Deal damage to player, this will trigger zombie attack sound
        }
      }
    }
    
    // Принудительная очистка неиспользуемых ресурсов
    if (frameCount.current % 3000 === 0) {
      // Очищаем рендерер для освобождения WebGL ресурсов
      if (state.gl) {
        state.gl.renderLists.dispose();
        // Подсказка для сборщика мусора
        if (typeof window !== 'undefined' && (window as any).gc) {
          try {
            (window as any).gc();
            console.log("Принудительная очистка памяти выполнена");
          } catch (e) {
            // GC недоступен
          }
        }
      }
    }
  });
  
  // Удаление самых дальних зомби для повышения производительности
  const removeDistantZombies = (count: number) => {
    // Получаем активных зомби
    const activeZombies = Object.values(zombieRefs.current)
      .filter(zombie => !zombie.isDying);
    
    if (activeZombies.length <= count) return; // Если зомби слишком мало, не удаляем
    
    // Сортируем зомби по расстоянию от игрока (от дальних к ближним)
    const sortedZombies = activeZombies
      .map(zombie => ({
        id: zombie.id,
        distance: zombie.mesh.position.distanceTo(playerPosition)
      }))
      .sort((a, b) => b.distance - a.distance); // Сортировка по убыванию (сначала дальние)
    
    // Удаляем count самых дальних зомби
    for (let i = 0; i < count && i < sortedZombies.length; i++) {
      removeZombie(sortedZombies[i].id);
    }
    
    console.log(`Удалено ${count} зомби для повышения производительности`);
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
  
  // Динамический лимит зомби на основе волны и производительности
  const getMaxZombies = (): number => {
    // Получаем число зомби по Фибоначчи для текущей волны, но ограничиваем максимумом
    // Увеличиваем в 10 раз
    const fibMaxZombies = fibonacci(wave.current + 3) * 10; // Увеличено в 10 раз
    
    // Жестко ограничиваем максимальное количество зомби в зависимости от производительности
    // Увеличиваем все значения примерно в 10 раз
    let maxAllowed = 250; // Стандартное значение увеличено с 25 до 250
    
    if (ultraLowGraphicsMode.current) {
      maxAllowed = 100; // Ультра низкое значение увеличено с 10 до 100
    } else if (criticalPerformanceMode.current) {
      maxAllowed = 120; // Экстремальное ограничение увеличено с 12 до 120
    } else if (lowPerformanceMode.current) {
      maxAllowed = 180; // Строгое ограничение увеличено с 18 до 180
    } else if (averageFps.current > 55) {
      maxAllowed = 250; // Высокая производительность увеличена с 25 до 250
    } else if (averageFps.current > 40) {
      maxAllowed = 200; // Средняя производительность увеличена с 20 до 200
    } else {
      maxAllowed = 150; // Низкая производительность увеличена с 15 до 150
    }
    
    // Возвращаем наименьшее из всех ограничений и жесткого лимита
    return Math.min(fibMaxZombies, maxAllowed, HARD_MAX_ZOMBIES_LIMIT);
  };
  
  // Нанесение урона зомби
  const damageZombie = (id: string, _isPet: boolean = false, isHeadshot: boolean = false) => {
    const zombie = zombieRefs.current[id];
    if (zombie && !zombie.isDying) {
      // Запоминаем предыдущее здоровье для проверки перехода порогов
      const previousHealth = zombie.health;
      
      // Определяем источник урона (от игрока или от питомца)
      // По умолчанию урон от игрока - 34 (100/3 ≈ 33.33, три пули должны убить зомби)
      // Для питомца урон составляет 10
      // Проверяем наличие флага для питомца
      const isPetAttack = zombie.mesh.userData && zombie.mesh.userData.isPetAttack === true;
      
      // При хедшоте наносим смертельный урон
      let damage = 0;
      if (isHeadshot) {
        damage = 100; // Мгновенное убийство при хедшоте
        console.log(`HEADSHOT! Instant kill for zombie ${id}`);
      } else {
        damage = isPetAttack ? 10 : 34; // Стандартный урон
      }
      
      // Уменьшаем здоровье
      zombie.health -= damage;
      
      console.log(`Zombie ${id} took ${damage} damage from ${isPetAttack ? 'pet' : 'player'}${isHeadshot ? ' (HEADSHOT!)' : ''}. Health: ${previousHealth} -> ${zombie.health}`);
      
      // Сбрасываем флаг атаки питомца после применения урона и логирования
      if (zombie.mesh.userData) {
        delete zombie.mesh.userData.isPetAttack;
      }
      
      // Обновляем здоровье зомби в userData для проверки в Player.tsx
      if (zombie.mesh && zombie.mesh.userData) {
        zombie.mesh.userData.health = zombie.health;
      }
      
      // Обновляем полоску здоровья
      if (zombie.healthBar) {
        updateHealthBar(zombie);
      }
      
      // Получаем цвет зомби по его здоровью
      const color = getZombieColorByHealth(zombie.health);
      console.log(`Setting color for zombie: ${color.getHexString()}`);
      
      // Применяем цвет к основному материалу зомби напрямую
      if (zombie.coloredMaterial) {
        zombie.coloredMaterial.color.set(color);
      } else {
        // Fallback or error if material not stored, though it should be by createZombie
        console.warn(`Colored material not found for zombie ${id}. Falling back to iterating children.`);
        // Старый метод изменения цвета (менее эффективный)
        zombie.mesh.children.forEach((child) => {
          if (child instanceof THREE.Mesh &&
              child.material instanceof THREE.MeshPhongMaterial &&
              (!zombie.healthBar || !zombie.healthBar.children.includes(child)) &&
              !(child.material as THREE.MeshPhongMaterial).transparent) {
            (child.material as THREE.MeshPhongMaterial).color.set(color);
          }
        });
      }
      
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
        
        // Если это был хедшот или критический урон, создаем эффект взрыва
        if (isHeadshot || damage >= 50) {
          createExplosion(zombie.mesh.position.clone(), zombie.mesh.children);
          
          // Ищем соседних зомби для цепной реакции
          triggerChainReaction(zombie.mesh.position.clone(), id);
        } else {
          // Сохраняем текущее направление поворота зомби (только по оси Y)
          // Это предотвратит вращение во время падения
          const currentYRotation = zombie.mesh.rotation.y;
          
          // Сбрасываем вращение по другим осям для правильного падения
          zombie.mesh.rotation.x = 0;
          zombie.mesh.rotation.z = 0;
          
          // Восстанавливаем вращение по оси Y, чтобы зомби падал в правильном направлении
          zombie.mesh.rotation.y = currentYRotation;
        }
        
        console.log(`Zombie ${id} is dying, starting ${isHeadshot ? 'explosion' : 'falling'} animation`);
        
        // Вызываем обработчик убийства зомби, если он задан
        if (onZombieKilled) {
          onZombieKilled(id);
        }
      }
      
      // Обновляем состояние зомби в родительском компоненте (отложенно)
      // Accumulate health update
      zombiesToUpdateRef.current.push({ id, health: zombie.health });
      setNeedsUpdate(true); // Signal that an update is needed
    }
  };

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

  // Экспортируем функцию для обработки попадания пули в зомби
  useEffect(() => {
    // Добавляем метод к userData компонента
    scene.userData.damageZombie = (zombieId: string, isPet: boolean = false, isHeadshot: boolean = false) => {
      // Если атака от питомца, устанавливаем флаг
      const zombie = zombieRefs.current[zombieId];
      if (zombie && zombie.mesh && zombie.mesh.userData) {
        if (isPet) {
          console.log(`Питомец атакует зомби ${zombieId}`);
          zombie.mesh.userData.isPetAttack = true;
        }
      }
      damageZombie(zombieId, isPet, isHeadshot);
    };
    
    // Добавляем функцию для сброса волны зомби
    scene.userData.resetZombieWave = () => {
      console.log('Resetting zombie wave');
      
      // Reset wave counter
      wave.current = 1;
      
      // Reset zombie speed
      baseZombieSpeed.current = 3;
      
      // Reset last spawn time
      lastSpawnTime.current = 0;
      
      // Reset wave parameters
      gameStartTime.current = Date.now();
      lastWaveTime.current = Date.now();
      nextWaveInterval.current = 60000; // 1 minute to first wave
      spawnBurst.current = 0;
      spawnBurstRemaining.current = 0;
    };
    
    return () => {
      // Очистка при размонтировании
      delete scene.userData.damageZombie;
      delete scene.userData.resetZombieWave;
    };
  }, [scene]);
  
  // Константы для системы частиц и цепной реакции
  const EXPLOSION_PARTICLES = 15; // Количество частиц при взрыве
  const CHAIN_REACTION_RADIUS = 3; // Радиус цепной реакции
  const CHAIN_REACTION_DAMAGE = 50; // Урон от цепной реакции
  const CHAIN_REACTION_PROBABILITY = 0.7; // Вероятность срабатывания цепной реакции

  // Создание эффекта взрыва зомби
  const createExplosion = (position: Vector3, zombieParts: THREE.Object3D[]) => {
    if (ultraLowGraphicsMode.current) return; // Пропускаем в режиме ультра-низкой графики
    
    // Уменьшаем количество частиц при низкой производительности
    let particleCount = lowPerformanceMode.current ? 
      Math.floor(EXPLOSION_PARTICLES / 2) : 
      EXPLOSION_PARTICLES;
    
    // Используем части зомби как основу для частиц
    zombieParts.forEach((part, index) => {
      if (part instanceof THREE.Mesh && 
          !(part.material instanceof THREE.MeshBasicMaterial && (part.material as any).transparent) &&
          index < particleCount) {
        
        // Создаем копию части для взрыва
        const particle = (part as THREE.Mesh).clone();
        
        // Применяем материал и масштаб
        if (particle.material instanceof THREE.MeshPhongMaterial) {
          const phongMat = particle.material as THREE.MeshPhongMaterial;
          particle.material = phongMat.clone();
          // Слегка затемняем материал
          phongMat.color.multiplyScalar(0.8);
        } else {
          // Если материал не MeshPhongMaterial, не трогаем цвет
        }
        
        // Начальная позиция - позиция части зомби
        particle.position.copy(part.position.clone());
        
        // Устанавливаем масштаб частиц
        particle.scale.multiplyScalar(0.7);
        
        // Переносим в мировые координаты
        particle.position.add(position);
        
        // Случайная скорость
        const velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          Math.random() * 5 + 3, // Больше вверх
          (Math.random() - 0.5) * 8
        );
        
        // Случайное вращение
        const angularVelocity = new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 5
        );
        
        // Время жизни частицы
        const lifespan = 1.5 + Math.random();
        
        // Добавляем частицу в сцену
        scene.add(particle);
        
        // Создаем анимацию для частицы
        const startTime = Date.now();
        
        // Функция анимации частицы
        const animateParticle = () => {
          const elapsed = (Date.now() - startTime) / 1000; // время в секундах
          
          if (elapsed < lifespan) {
            // Обновляем позицию
            particle.position.x += velocity.x * 0.016; // приблизительно 60fps
            particle.position.y += velocity.y * 0.016 - 9.8 * 0.016 * elapsed; // гравитация
            particle.position.z += velocity.z * 0.016;
            
            // Обновляем вращение
            particle.rotation.x += angularVelocity.x * 0.016;
            particle.rotation.y += angularVelocity.y * 0.016;
            particle.rotation.z += angularVelocity.z * 0.016;
            
            // Уменьшаем размер со временем
            const scale = Math.max(0.1, 1 - elapsed / lifespan);
            particle.scale.set(scale, scale, scale);
            
            // Продолжаем анимацию
            requestAnimationFrame(animateParticle);
          } else {
            // Удаляем частицу из сцены
            scene.remove(particle);
            if (particle.material) {
              if (Array.isArray(particle.material)) {
                particle.material.forEach(m => m.dispose());
              } else {
                particle.material.dispose();
              }
            }
            if (particle.geometry) {
              particle.geometry.dispose();
            }
          }
        };
        
        // Запускаем анимацию
        requestAnimationFrame(animateParticle);
      }
    });
  };

  // Функция для цепной реакции
  const triggerChainReaction = (position: Vector3, sourceZombieId: string) => {
    // Пропускаем в низких режимах производительности
    if (ultraLowGraphicsMode.current || criticalPerformanceMode.current) {
      return;
    }
    
    // Находим соседних зомби в радиусе цепной реакции
    const zombieIds = Object.keys(zombieRefs.current);
    const nearbyZombies = zombieIds.filter(id => {
      // Пропускаем исходного зомби и мертвых зомби
      if (id === sourceZombieId || zombieRefs.current[id].isDying) {
        return false;
      }
      
      // Проверяем расстояние
      const distance = zombieRefs.current[id].mesh.position.distanceTo(position);
      return distance <= CHAIN_REACTION_RADIUS;
    });
    
    // Для каждого ближайшего зомби с определенной вероятностью запускаем цепную реакцию
    nearbyZombies.forEach(id => {
      if (Math.random() < CHAIN_REACTION_PROBABILITY) {
        // Получаем зомби
        const zombie = zombieRefs.current[id];
        // Наносим урон от цепной реакции
        if (zombie && !zombie.isDying) {
          // Наносим урон от взрыва
          zombie.health -= CHAIN_REACTION_DAMAGE;
          // Обновляем полоску здоровья
          if (zombie.healthBar) {
            updateHealthBar(zombie);
          }
          // Если зомби умер от урона
          if (zombie.health <= 0) {
            zombie.isDying = true;
            zombie.dyingStartTime = Date.now();
            // Останавливаем движение зомби
            zombie.velocity.set(0, 0, 0);
            // Скрываем полоску здоровья
            if (zombie.healthBar) {
              zombie.healthBar.visible = false;
            }
            // --- Исправление: определяем isHeadshot и damage локально ---
            const isHeadshot = false;
            const damage = CHAIN_REACTION_DAMAGE;
            if (isHeadshot || damage >= 50) {
              createExplosion(zombie.mesh.position.clone(), zombie.mesh.children);
              // Ищем соседних зомби для цепной реакции
              triggerChainReaction(zombie.mesh.position.clone(), id);
            } else {
              // Сохраняем текущее направление поворота зомби (только по оси Y)
              const currentYRotation = zombie.mesh.rotation.y;
              zombie.mesh.rotation.x = 0;
              zombie.mesh.rotation.z = 0;
              zombie.mesh.rotation.y = currentYRotation;
            }
            console.log(`Zombie ${id} is dying, starting ${isHeadshot ? 'explosion' : 'falling'} animation`);
            if (onZombieKilled) {
              onZombieKilled(id);
            }
          }
        }
      }
    });
  };
  
  return null; // Визуальное представление обрабатывается через Three.js напрямую
};

export default Zombies; 