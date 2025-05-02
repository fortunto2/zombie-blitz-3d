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
  gameStarted: boolean;
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
    return new THREE.Color(0x2a3b24); // Темный грязно-зеленый (полное здоровье)
  } else if (health > 33) {
    return new THREE.Color(0x493828); // Коричневатый (после первого попадания)
  } else if (health > 0) {
    return new THREE.Color(0x3d2121); // Темно-бордовый (после второго попадания)
  } else {
    return new THREE.Color(0x2a1c1c); // Почти черный (перед смертью)
  }
}

const Zombies: React.FC<ZombiesProps> = ({
  playerPosition,
  zombies,
  setZombies,
  isGameOver,
  onPlayerDamage,
  gameStarted
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
    
    // Устанавливаем основные цвета и материалы для зомби
    const zombieSkinColor = new THREE.Color(0x35443a); // Мертвенно-бледная, с оттенком зелени
    const decayedFleshColor = new THREE.Color(0x563631); // Цвет разлагающейся плоти
    const exposedFleshColor = new THREE.Color(0x701f1f); // Цвет открытых ран
    const bloodColor = new THREE.Color(0x5c0c0c); // Цвет засохшей крови
    const boneColor = new THREE.Color(0xe8e4cf); // Цвет кости
    
    // Создаем базовый материал для кожи
    const skinMaterial = new THREE.MeshPhongMaterial({
      color: zombieSkinColor,
      shininess: 5, // Низкий блеск для эффекта сухой кожи
      flatShading: true // Более грубая поверхность
    });
    
    const fleshMaterial = new THREE.MeshPhongMaterial({
      color: exposedFleshColor,
      shininess: 20,
      emissive: new THREE.Color(0x300a0a),
      emissiveIntensity: 0.2,
      flatShading: true
    });
    
    const boneMaterial = new THREE.MeshPhongMaterial({
      color: boneColor,
      shininess: 10,
      flatShading: true
    });
    
    // Создаем тело зомби (цилиндр с деформациями)
    const bodyGeometry = new THREE.CylinderGeometry(0.4, 0.35, 1.8, 10, 4, false);
    
    // Деформируем геометрию тела для создания сутулой, неровной фигуры
    const bodyPositions = bodyGeometry.attributes.position;
    for (let i = 0; i < bodyPositions.count; i++) {
      const x = bodyPositions.getX(i);
      const y = bodyPositions.getY(i);
      const z = bodyPositions.getZ(i);
      
      // Сутулость (наклон вперед)
      if (y > 0.3) {
        bodyPositions.setX(i, x + (y - 0.3) * 0.15); // Сдвигаем верхнюю часть вперед
      }
      
      // Асимметрия тела
      if (x > 0) {
        bodyPositions.setX(i, x * 0.9); // Одно плечо ниже другого
      }
      
      // Неровности и "куски" плоти
      if (Math.random() > 0.85) {
        bodyPositions.setX(i, x + (Math.random() - 0.5) * 0.1);
        bodyPositions.setZ(i, z + (Math.random() - 0.5) * 0.1);
      }
    }
    
    const body = new THREE.Mesh(bodyGeometry, skinMaterial);
    body.position.set(0, 1.0, 0);
    body.castShadow = true;
    zombie.add(body);
    
    // Добавляем рваную рану на туловище, с открытыми ребрами
    const torsoWoundGeometry = new THREE.SphereGeometry(0.25, 8, 8, 0, Math.PI * 1.2, 0, Math.PI / 2);
    const torsoWound = new THREE.Mesh(torsoWoundGeometry, fleshMaterial);
    torsoWound.position.set(0.25, 0.4, 0.2);
    torsoWound.rotation.set(0, Math.PI / 3, 0);
    torsoWound.scale.set(1, 0.6, 0.6);
    body.add(torsoWound);
    
    // Добавляем видимые ребра в рану
    for (let i = 0; i < 2; i++) {
      const ribGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6);
      const rib = new THREE.Mesh(ribGeometry, boneMaterial);
      rib.position.set(0.1, (i - 0.5) * 0.1, 0.05);
      rib.rotation.set(0.3, 0.2, Math.PI / 2);
      torsoWound.add(rib);
    }
    
    // Создаем голову зомби (искаженный череп)
    const headGeometry = new THREE.SphereGeometry(0.4, 10, 10);
    
    // Деформируем форму головы
    const headPositions = headGeometry.attributes.position;
    for (let i = 0; i < headPositions.count; i++) {
      const x = headPositions.getX(i);
      const y = headPositions.getY(i);
      const z = headPositions.getZ(i);
      
      // Удлиняем череп назад
      if (z < 0) {
        headPositions.setZ(i, z * 1.2);
      }
      
      // Сплющиваем сверху
      if (y > 0.2) {
        headPositions.setY(i, y * 0.8);
      }
      
      // Добавляем неровности и впадины
      if (Math.random() > 0.85) {
        const deform = (Math.random() - 0.5) * 0.1;
        headPositions.setX(i, x + deform);
        headPositions.setY(i, y + deform);
        headPositions.setZ(i, z + deform);
      }
    }
    
    const head = new THREE.Mesh(headGeometry, skinMaterial);
    head.position.set(0, 2.0, 0);
    head.castShadow = true;
    zombie.add(head);
    
    // Создаем лицо (яма вместо части лица, с частично открытым черепом)
    const faceWoundGeometry = new THREE.SphereGeometry(0.2, 8, 8, 0, Math.PI, 0, Math.PI);
    const faceWound = new THREE.Mesh(faceWoundGeometry, fleshMaterial);
    faceWound.position.set(0.2, 0, 0.3);
    faceWound.rotation.set(0, -Math.PI / 4, 0);
    faceWound.scale.set(1, 1.3, 0.8);
    head.add(faceWound);
    
    // Добавляем череп, частично виднеющийся из раны
    const skullGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    skullGeometry.scale(0.7, 0.9, 0.6);
    const skull = new THREE.Mesh(skullGeometry, boneMaterial);
    skull.position.set(0.05, 0, 0.05);
    faceWound.add(skull);
    
    // Глаза (один нормальный, второй отсутствует/поврежден)
    
    // Левый глаз (нормальный, но безжизненный)
    const leftEyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeWhiteMaterial = new THREE.MeshPhongMaterial({
      color: 0xd0cfc9, // Желтоватый белок
      shininess: 70
    });
    
    const leftEye = new THREE.Mesh(leftEyeGeometry, eyeWhiteMaterial);
    leftEye.position.set(-0.15, 0, 0.32);
    head.add(leftEye);
    
    // Зрачок левого глаза (мутный)
    const leftPupilGeometry = new THREE.SphereGeometry(0.04, 8, 8);
    const pupilMaterial = new THREE.MeshPhongMaterial({
      color: 0x60605a, // Серый, замутненный
      shininess: 50
    });
    
    const leftPupil = new THREE.Mesh(leftPupilGeometry, pupilMaterial);
    leftPupil.position.set(0, 0, 0.05);
    leftEye.add(leftPupil);
    
    // Правый глаз (отсутствует - пустая глазница)
    const rightEyeSocketGeometry = new THREE.SphereGeometry(0.09, 8, 8, 0, Math.PI);
    const eyeSocketMaterial = new THREE.MeshPhongMaterial({
      color: 0x221111, // Темная пустая глазница
      side: THREE.DoubleSide,
      flatShading: true
    });
    
    const rightEyeSocket = new THREE.Mesh(rightEyeSocketGeometry, eyeSocketMaterial);
    rightEyeSocket.position.set(0.15, 0, 0.32);
    rightEyeSocket.rotation.set(0, Math.PI / 2, 0);
    head.add(rightEyeSocket);
    
    // Рот с частично открытой челюстью и зубами
    
    // Верхняя губа (искаженная и частично отсутствующая)
    const upperLipGeometry = new THREE.BoxGeometry(0.25, 0.05, 0.1);
    const upperLipPositions = upperLipGeometry.attributes.position;
    for (let i = 0; i < upperLipPositions.count; i++) {
      // Деформации для рваного края
      if (Math.random() > 0.7) {
        upperLipPositions.setY(i, upperLipPositions.getY(i) - 0.02);
      }
    }
    
    const lipMaterial = new THREE.MeshPhongMaterial({
      color: 0x4a3631, // Темная, почти черная губа
      flatShading: true
    });
    
    const upperLip = new THREE.Mesh(upperLipGeometry, lipMaterial);
    upperLip.position.set(0, -0.18, 0.35);
    head.add(upperLip);
    
    // Нижняя челюсть (опущена для эффекта открытого рта)
    const jawGeometry = new THREE.BoxGeometry(0.3, 0.15, 0.25);
    
    // Деформируем для формы челюсти
    const jawPositions = jawGeometry.attributes.position;
    for (let i = 0; i < jawPositions.count; i++) {
      const x = jawPositions.getX(i);
      const y = jawPositions.getY(i);
      const z = jawPositions.getZ(i);
      
      // Сужаем переднюю часть челюсти
      if (z > 0) {
        jawPositions.setX(i, x * (1 - z * 0.5));
      }
    }
    
    const jaw = new THREE.Mesh(jawGeometry, skinMaterial);
    jaw.position.set(0, -0.3, 0.25);
    jaw.rotation.set(0.3, 0, 0); // Опущена вниз
    head.add(jaw);
    
    // Добавляем зубы (неровные, частично отсутствующие)
    const createTooth = (x: number, z: number, topJaw: boolean = true) => {
      // Случайная высота и толщина зуба
      const height = 0.05 + Math.random() * 0.04;
      const width = 0.025 + Math.random() * 0.015;
      
      // Некоторые зубы отсутствуют
      if (Math.random() < 0.3) return null;
      
      const toothGeometry = new THREE.BoxGeometry(width, height, width);
      
      // Случайный цвет от желтоватого до коричневого
      const colorValue = 0.7 + Math.random() * 0.3; // от 0.7 до 1.0
      const toothColor = new THREE.Color(
        colorValue * 0.95, 
        colorValue * 0.9, 
        colorValue * 0.7
      );
      
      const toothMaterial = new THREE.MeshPhongMaterial({
        color: toothColor,
        shininess: 40
      });
      
      const tooth = new THREE.Mesh(toothGeometry, toothMaterial);
      
      if (topJaw) {
        // Верхние зубы
        tooth.position.set(x, -0.03, z);
        upperLip.add(tooth);
      } else {
        // Нижние зубы
        tooth.position.set(x, 0.03, z);
        jaw.add(tooth);
      }
      
      return tooth;
    };
    
    // Создаем верхние зубы
    for (let i = -3; i <= 3; i++) {
      createTooth(i * 0.03, 0.04, true);
    }
    
    // Создаем нижние зубы
    for (let i = -3; i <= 3; i++) {
      createTooth(i * 0.03, 0.1, false);
    }
    
    // Создаем руки с деформациями
    const createArm = (isLeft: boolean) => {
      const armGroup = new THREE.Group();
      
      // Верхняя часть руки
      const upperArmGeometry = new THREE.CylinderGeometry(0.1, 0.08, 0.7, 8);
      
      // Деформируем для более худой, высохшей формы
      const upperArmPositions = upperArmGeometry.attributes.position;
      for (let i = 0; i < upperArmPositions.count; i++) {
        const x = upperArmPositions.getX(i);
        const y = upperArmPositions.getY(i);
        const z = upperArmPositions.getZ(i);
        
        // Добавляем впадины для имитации истощенных мышц
        upperArmPositions.setX(i, x + Math.sin(y * 10) * 0.02);
        upperArmPositions.setZ(i, z + Math.cos(y * 8) * 0.02);
      }
      
      const upperArm = new THREE.Mesh(upperArmGeometry, skinMaterial);
      upperArm.position.set(0, -0.35, 0); // Центр верхней части руки
      armGroup.add(upperArm);
      
      // Нижняя часть руки (предплечье)
      const forearmGeometry = new THREE.CylinderGeometry(0.075, 0.06, 0.65, 8);
      
      // Деформируем аналогично
      const forearmPositions = forearmGeometry.attributes.position;
      for (let i = 0; i < forearmPositions.count; i++) {
        const x = forearmPositions.getX(i);
        const y = forearmPositions.getY(i);
        const z = forearmPositions.getZ(i);
        
        // Добавляем впадины для имитации истощенных мышц
        forearmPositions.setX(i, x + Math.sin(y * 10) * 0.02);
        forearmPositions.setZ(i, z + Math.cos(y * 8) * 0.02);
      }
      
      const forearm = new THREE.Mesh(forearmGeometry, skinMaterial);
      forearm.position.set(0, -0.7, 0.1); // Сгиб в локте
      forearm.rotation.set(-0.3, 0, 0);
      armGroup.add(forearm);
      
      // Рука (кисть)
      const handGeometry = new THREE.BoxGeometry(0.12, 0.2, 0.05);
      
      // Деформируем для формы иссохшей кисти
      const handPositions = handGeometry.attributes.position;
      for (let i = 0; i < handPositions.count; i++) {
        // Случайные деформации для большей неровности
        if (Math.random() > 0.7) {
          handPositions.setX(i, handPositions.getX(i) + (Math.random() - 0.5) * 0.03);
          handPositions.setY(i, handPositions.getY(i) + (Math.random() - 0.5) * 0.03);
        }
      }
      
      const hand = new THREE.Mesh(handGeometry, skinMaterial);
      hand.position.set(0, -1.0, 0.15);
      hand.rotation.set(-0.5, 0, 0);
      armGroup.add(hand);
      
      // Пальцы (длинные, скрюченные)
      for (let i = 0; i < 4; i++) {
        const fingerGeometry = new THREE.BoxGeometry(0.02, 0.1, 0.02);
        const finger = new THREE.Mesh(fingerGeometry, skinMaterial);
        
        // Располагаем пальцы равномерно по ширине ладони
        const xPos = (i - 1.5) * 0.03;
        finger.position.set(xPos, -0.12, 0.02);
        
        // Случайное искривление пальцев
        finger.rotation.set(
          -0.2 - Math.random() * 0.3,
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2
        );
        
        hand.add(finger);
      }
      
      // Добавляем видимую рану на одной из рук
      if (isLeft) {
        const armWoundGeometry = new THREE.SphereGeometry(0.06, 8, 8, 0, Math.PI);
        const armWound = new THREE.Mesh(armWoundGeometry, fleshMaterial);
        armWound.position.set(0.1, -0.2, 0);
        armWound.rotation.set(0, Math.PI / 2, 0);
        upperArm.add(armWound);
        
        // Добавляем кость, выступающую из раны
        const boneGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.1, 4);
        const bone = new THREE.Mesh(boneGeometry, boneMaterial);
        bone.position.set(0.03, 0, 0);
        bone.rotation.set(0, 0, Math.PI / 3);
        armWound.add(bone);
      }
      
      // Позиционируем всю руку относительно тела
      armGroup.position.set(isLeft ? 0.45 : -0.45, 1.75, 0);
      armGroup.rotation.set(0, 0, isLeft ? -0.1 : 0.1);
      
      return armGroup;
    };
    
    // Добавляем руки
    zombie.add(createArm(true)); // Левая рука
    zombie.add(createArm(false)); // Правая рука
    
    // Создаем ноги
    const createLeg = (isLeft: boolean) => {
      const legGroup = new THREE.Group();
      
      // Бедро
      const thighGeometry = new THREE.CylinderGeometry(0.15, 0.12, 0.8, 8);
      
      // Деформируем для более истощенного вида
      const thighPositions = thighGeometry.attributes.position;
      for (let i = 0; i < thighPositions.count; i++) {
        const x = thighPositions.getX(i);
        const y = thighPositions.getY(i);
        const z = thighPositions.getZ(i);
        
        // Добавляем неровности
        if (Math.random() > 0.85) {
          thighPositions.setX(i, x + (Math.random() - 0.5) * 0.05);
          thighPositions.setZ(i, z + (Math.random() - 0.5) * 0.05);
        }
      }
      
      const thigh = new THREE.Mesh(thighGeometry, skinMaterial);
      thigh.position.set(0, -0.4, 0);
      legGroup.add(thigh);
      
      // Голень
      const calfGeometry = new THREE.CylinderGeometry(0.11, 0.09, 0.8, 8);
      
      // Деформируем аналогично
      const calfPositions = calfGeometry.attributes.position;
      for (let i = 0; i < calfPositions.count; i++) {
        const x = calfPositions.getX(i);
        const y = calfPositions.getY(i);
        const z = calfPositions.getZ(i);
        
        // Добавляем неровности
        if (Math.random() > 0.85) {
          calfPositions.setX(i, x + (Math.random() - 0.5) * 0.04);
          calfPositions.setZ(i, z + (Math.random() - 0.5) * 0.04);
        }
      }
      
      const calf = new THREE.Mesh(calfGeometry, skinMaterial);
      calf.position.set(0, -0.8, 0.05); // Небольшой сгиб в колене
      calf.rotation.set(0.1, 0, 0);
      legGroup.add(calf);
      
      // Ступня
      const footGeometry = new THREE.BoxGeometry(0.12, 0.1, 0.25);
      const foot = new THREE.Mesh(footGeometry, skinMaterial);
      foot.position.set(0, -1.2, 0.1);
      legGroup.add(foot);
      
      // Позиционируем всю ногу
      legGroup.position.set(isLeft ? 0.2 : -0.2, 0.2, 0);
      
      // Добавляем рану на ноге, если это правая нога
      if (!isLeft) {
        const legWoundGeometry = new THREE.SphereGeometry(0.08, 8, 8, 0, Math.PI);
        const legWound = new THREE.Mesh(legWoundGeometry, fleshMaterial);
        legWound.position.set(0, -0.3, 0.12);
        legWound.rotation.set(0, Math.PI / 2, 0);
        calf.add(legWound);
        
        // Добавляем потек крови из раны
        const bloodTrailGeometry = new THREE.PlaneGeometry(0.15, 0.3);
        const bloodTrailMaterial = new THREE.MeshPhongMaterial({
          color: bloodColor,
          transparent: true,
          opacity: 0.9
        });
        
        const bloodTrail = new THREE.Mesh(bloodTrailGeometry, bloodTrailMaterial);
        bloodTrail.position.set(0, -0.15, 0.13);
        bloodTrail.rotation.set(0, 0, 0);
        calf.add(bloodTrail);
      }
      
      return legGroup;
    };
    
    // Добавляем ноги
    zombie.add(createLeg(true)); // Левая нога
    zombie.add(createLeg(false)); // Правая нога
    
    // Добавляем рваную одежду
    const addRags = () => {
      // Создаем лохмотья одежды на некоторых участках тела
      const createRaggedCloth = (x: number, y: number, z: number, width: number, height: number, parent: THREE.Object3D) => {
        const clothGeometry = new THREE.PlaneGeometry(width, height, 4, 4);
        
        // Деформируем для создания рваных краев
        const clothPositions = clothGeometry.attributes.position;
        for (let i = 0; i < clothPositions.count; i++) {
          const x = clothPositions.getX(i);
          const y = clothPositions.getY(i);
          
          // Добавляем рваные края и дыры
          if (Math.abs(x) > width * 0.3 || Math.abs(y) > height * 0.3 || Math.random() > 0.8) {
            clothPositions.setX(i, x + (Math.random() - 0.5) * 0.1);
            clothPositions.setY(i, y + (Math.random() - 0.5) * 0.1);
          }
        }
        
        // Случайный цвет ткани: от тёмно-серого до коричневого
        const clothColor = new THREE.Color(
          0.2 + Math.random() * 0.2,
          0.15 + Math.random() * 0.15,
          0.1 + Math.random() * 0.15
        );
        
        const clothMaterial = new THREE.MeshPhongMaterial({
          color: clothColor,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          flatShading: true
        });
        
        const cloth = new THREE.Mesh(clothGeometry, clothMaterial);
        cloth.position.set(x, y, z);
        
        // Случайный поворот
        cloth.rotation.set(
          Math.random() * Math.PI * 0.3,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 0.3
        );
        
        parent.add(cloth);
        return cloth;
      };
      
      // Добавляем остатки одежды на тело
      createRaggedCloth(0.2, 0, 0.2, 0.5, 0.7, body);
      createRaggedCloth(-0.2, 0.3, -0.1, 0.4, 0.5, body);
      
      // Добавляем тряпки на ноги (как остатки штанов)
      zombie.children.forEach(child => {
        if (child.position.y < 0.5 && Math.random() > 0.5) {
          createRaggedCloth(0, 0.1, 0.1, 0.3, 0.4, child);
        }
      });
    };
    
    addRags(); // Вызываем функцию для добавления рваной одежды
    
    // Устанавливаем позицию зомби
    zombie.position.copy(position);
    
    // Добавляем полоску здоровья над зомби
    const healthBar = createHealthBar();
    zombie.add(healthBar);
    
    // Добавляем зомби на сцену
    scene.add(zombie);
    
    // Возвращаем объект зомби для хранения в рефах
    return {
      id,
      mesh: zombie,
      velocity: new THREE.Vector3(),
      lastDamageTime: 0,
      health: 100,
      isDying: false,
      dyingStartTime: 0,
      speed: baseZombieSpeed.current + Math.random() * 0.5, // Случайный компонент скорости
      healthBar
    };
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
      
      // Применяем цвет ко всем частям зомби, кроме особых элементов
      zombie.mesh.traverse((child) => {
        // Проверяем, что это меш с материалом
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhongMaterial) {
          // Пропускаем прозрачные материалы и особые элементы
          const skipColorChange = 
            child.material.transparent || // Прозрачные элементы (лохмотья одежды)
            (child.material.emissive && child.material.emissiveIntensity > 0) || // Элементы со свечением (глаза, раны)
            child.material.color.getHexString() === "f0e6d2" || // Кости
            child.material.color.getHexString() === "140a05"; // Когти
            
          if (!skipColorChange && !zombie.healthBar.children.includes(child)) {
            // Меняем цвет только основных частей тела
            child.material.color.set(color);
            
            // Добавляем эффект крови при получении урона
            if (zombie.health < previousHealth && zombie.health > 0) {
              // Временно делаем материал более красным для эффекта крови
              const originalColor = child.material.color.clone();
              child.material.color.lerp(new THREE.Color(0xaa0000), 0.7);
              
              // Возвращаем нормальный цвет через короткое время
              setTimeout(() => {
                if (child.material instanceof THREE.MeshPhongMaterial) {
                  child.material.color.set(color);
                }
              }, 150);
            }
          }
        }
      });
      
      // Создаем эффект брызг крови при попадании
      const createBloodSpray = () => {
        // Находим точку попадания (случайная точка на теле зомби)
        const hitPosition = new THREE.Vector3();
        
        // Выбираем основные части тела для эффекта (голова, торс)
        let targetPart: THREE.Object3D | null = null;
        zombie.mesh.traverse((child) => {
          if (
            child instanceof THREE.Mesh && 
            !child.material.transparent && 
            !zombie.healthBar.children.includes(child) &&
            Math.random() > 0.5
          ) {
            targetPart = child;
          }
        });
        
        if (!targetPart) {
          // Если не нашли конкретную часть, используем позицию всего зомби
          hitPosition.copy(zombie.mesh.position).add(new THREE.Vector3(0, 1.5, 0));
        } else {
          // Если нашли часть, берем ее мировую позицию
          (targetPart as THREE.Object3D).updateMatrixWorld();
          hitPosition.setFromMatrixPosition((targetPart as THREE.Object3D).matrixWorld);
          // Добавляем небольшое случайное смещение
          hitPosition.add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3
          ));
        }
        
        // Создаем брызги крови - несколько маленьких капель
        const numDroplets = 5 + Math.floor(Math.random() * 5); // 5-9 капель
        
        for (let i = 0; i < numDroplets; i++) {
          // Создаем каплю крови
          const dropSize = 0.03 + Math.random() * 0.04; // Размер 0.03-0.07
          const dropGeometry = new THREE.SphereGeometry(dropSize, 4, 4);
          
          // Деформируем каплю для эффекта движения
          const dropPositions = dropGeometry.attributes.position;
          for (let j = 0; j < dropPositions.count; j++) {
            const x = dropPositions.getX(j);
            const y = dropPositions.getY(j);
            const z = dropPositions.getZ(j);
            
            // Вытягиваем каплю в направлении движения
            if (z > 0) {
              dropPositions.setZ(j, z * 1.5);
            }
          }
          
          const dropMaterial = new THREE.MeshPhongMaterial({ 
            color: new THREE.Color(0x8c0000),
            shininess: 80,
            emissive: new THREE.Color(0x300000),
            emissiveIntensity: 0.3
          });
          
          const droplet = new THREE.Mesh(dropGeometry, dropMaterial);
          
          // Устанавливаем начальную позицию в точке попадания
          droplet.position.copy(hitPosition);
          
          // Добавляем случайное направление движения
          const direction = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            Math.random() * 1.5,
            (Math.random() - 0.5) * 2
          ).normalize();
          
          // Смещаем каплю в этом направлении
          const distance = 0.1 + Math.random() * 0.5; // Дистанция разлета 0.1-0.6
          droplet.position.add(direction.multiplyScalar(distance));
          
          // Добавляем каплю на сцену
          scene.add(droplet);
          
          // Удаляем каплю через короткий промежуток времени
          const lifespan = 200 + Math.random() * 400; // 200-600 мс
          setTimeout(() => {
            scene.remove(droplet);
            droplet.geometry.dispose();
            droplet.material.dispose();
          }, lifespan);
        }
      };
      
      // Вызываем эффект брызг крови
      createBloodSpray();
      
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
        const currentYRotation = zombie.mesh.rotation.y;
        
        // Сбрасываем вращение по другим осям для правильного падения
        zombie.mesh.rotation.x = 0;
        zombie.mesh.rotation.z = 0;
        
        // Восстанавливаем вращение по оси Y, чтобы зомби падал в правильном направлении
        zombie.mesh.rotation.y = currentYRotation;
        
        // Создаем лужу крови
        const bloodPool = createBloodPool();
        
        // Добавляем лужу крови на сцену
        bloodPool.position.set(
          zombie.mesh.position.x,
          0.015, // Чуть выше земли
          zombie.mesh.position.z
        );
        
        scene.add(bloodPool);
        
        // Интерактивное "растекание" лужи крови
        const expandPool = () => {
          let expansionProgress = 0;
          const expansionSpeed = 0.03;
          
          const expandInterval = setInterval(() => {
            expansionProgress += expansionSpeed;
            
            // Увеличиваем размер лужи
            bloodPool.scale.set(
              1 + expansionProgress * 0.5,
              1 + expansionProgress * 0.5,
              1
            );
            
            // Уменьшаем прозрачность по мере растекания
            bloodPool.children.forEach(child => {
              if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhongMaterial) {
                child.material.opacity = Math.max(0.2, 0.9 - expansionProgress * 0.2);
              }
            });
            
            // Завершаем анимацию
            if (expansionProgress >= 1) {
              clearInterval(expandInterval);
            }
          }, 100);
        };
        
        // Запускаем анимацию растекания
        expandPool();
        
        // Добавляем несколько мелких брызг вокруг лужи
        for (let i = 0; i < 5; i++) {
          const splatterGeometry = new THREE.CircleGeometry(0.1 + Math.random() * 0.2, 8);
          
          // Деформируем брызги
          const splatterPositions = splatterGeometry.attributes.position;
          for (let j = 0; j < splatterPositions.count; j++) {
            const x = splatterPositions.getX(j);
            const y = splatterPositions.getY(j);
            
            // Искажаем форму
            if (new THREE.Vector2(x, y).length() > 0.05) {
              splatterPositions.setX(j, x + (Math.random() - 0.5) * 0.1);
              splatterPositions.setY(j, y + (Math.random() - 0.5) * 0.1);
            }
            
            // Поднимаем над основной лужей
            splatterPositions.setZ(j, 0.02);
          }
          
          const splatterMaterial = new THREE.MeshPhongMaterial({
            color: new THREE.Color(0x700000), // Более темный оттенок
            transparent: true,
            opacity: 0.7,
            shininess: 80,
            side: THREE.DoubleSide
          });
          
          const splatter = new THREE.Mesh(splatterGeometry, splatterMaterial);
          splatter.rotation.x = -Math.PI / 2;
          
          // Случайное положение вокруг основной лужи
          const angle = Math.random() * Math.PI * 2;
          const distance = 0.7 + Math.random() * 0.5;
          
          splatter.position.set(
            zombie.mesh.position.x + Math.cos(angle) * distance,
            0.017, // Чуть выше основной лужи
            zombie.mesh.position.z + Math.sin(angle) * distance
          );
          
          scene.add(splatter);
        }
        
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
    // Проверяем, началась ли игра
    if (!gameStarted) {
      return; // Если игра не началась, не спавним зомби
    }
    
    const now = Date.now();
    
    // Удаляем обработку начальной волны и сразу переходим к стандартному спавну
    
    // Стандартный спавн зомби
    // Изменяем интервал спавна зомби на 2 секунды
    const spawnInterval = 2000; // 2 секунды между появлением зомби
    
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
      
      // Более плавный прогресс с использованием easing-функции
      const easedProgress = 1 - Math.pow(1 - rotationProgress, 3); // Кубическая ease-out функция
      
      // Вращаем зомби вперед (падение), но только по оси X
      // Сохраняем текущий поворот по осям Y и Z, меняем только X
      const targetRotationX = Math.PI / 2; // 90 градусов (лежит на земле)
      zombie.mesh.rotation.x = easedProgress * targetRotationX;
      
      // Добавляем небольшое смещение вниз для имитации падения на землю
      // Высота падения зависит от прогресса, вначале падает быстрее, потом медленнее
      // Используем квадратичную функцию для более реалистичного падения
      const fallHeight = Math.max(0, 1 - Math.pow(easedProgress, 2));
      zombie.mesh.position.y = fallHeight;
      
      // Добавляем небольшое смещение вперед при падении
      const forwardDistance = Math.sin(easedProgress * Math.PI) * 0.5;
      const forwardVector = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), zombie.mesh.rotation.y);
      zombie.mesh.position.add(forwardVector.multiplyScalar(forwardDistance * delta * 2));
      
      // Добавляем дрожание тела на последней стадии падения
      if (rotationProgress > 0.7) {
        const convulsionAmplitude = 0.05 * (1 - (rotationProgress - 0.7) / 0.3);
        zombie.mesh.rotation.z = (Math.random() - 0.5) * convulsionAmplitude;
        zombie.mesh.rotation.x += (Math.random() - 0.5) * convulsionAmplitude * 0.2;
      }
      
      // Добавляем выплеск капель крови при ударе тела о землю
      if (rotationProgress > 0.85 && rotationProgress < 0.9) {
        // Создаем брызги в момент удара о землю
        for (let i = 0; i < 7; i++) {
          const dropSize = 0.02 + Math.random() * 0.03;
          const dropGeometry = new THREE.SphereGeometry(dropSize, 4, 4);
          
          const dropMaterial = new THREE.MeshPhongMaterial({ 
            color: new THREE.Color(0x8c0000),
            shininess: 80,
            emissive: new THREE.Color(0x300000),
            emissiveIntensity: 0.3
          });
          
          const droplet = new THREE.Mesh(dropGeometry, dropMaterial);
          
          // Устанавливаем начальную позицию
          const startPos = zombie.mesh.position.clone();
          startPos.y = 0.05; // Чуть выше земли
          droplet.position.copy(startPos);
          
          // Случайное направление разлета
          const angle = Math.random() * Math.PI * 2;
          const distance = 0.2 + Math.random() * 0.4;
          droplet.position.x += Math.cos(angle) * distance;
          droplet.position.z += Math.sin(angle) * distance;
          
          scene.add(droplet);
          
          // Удаляем каплю через короткое время
          setTimeout(() => {
            scene.remove(droplet);
            droplet.geometry.dispose();
            droplet.material.dispose();
          }, 300 + Math.random() * 300);
        }
      }
      
      return false; // Продолжаем анимацию
    } else {
      // Убеждаемся, что зомби лежит ровно на земле после окончания анимации
      zombie.mesh.rotation.x = Math.PI / 2; // 90 градусов
      zombie.mesh.position.y = 0;
      
      // Выключаем вращение по другим осям
      zombie.mesh.rotation.y = zombie.mesh.rotation.y; // Сохраняем текущее значение
      zombie.mesh.rotation.z = 0;
      
      // Время анимации истекло, удаляем зомби
      return true; // Готов к удалению
    }
  };
  
  // Обновление зомби на каждом кадре
  useFrame((_, delta) => {
    // Не обновляем зомби, если игра не началась или закончилась
    if (isGameOver || !gameStarted) return;
    
    // Спавн новых зомби
    spawnZombie();
    
    // Обновляем предупреждения о зомби
    updateZombieWarnings(delta);
    
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
      
      // Удаляем всех зомби из сцены
      Object.keys(zombieRefs.current).forEach(id => {
        removeZombie(id);
      });
      
      // Удаляем все предупреждения о зомби
      Object.keys(zombieWarnings.current).forEach(id => {
        removeZombieWarning(id);
      });
      
      // Очищаем состояние
      zombieRefs.current = {};
      zombieWarnings.current = {};
      lastSpawnTime.current = Date.now();
      wave.current = 1;
      baseZombieSpeed.current = 3;
      
      // Очищаем очереди обновлений
      zombiesToAddRef.current = [];
      zombiesToRemoveRef.current = [];
      zombiesToUpdateRef.current = [];
      
      // Применяем обновления состояния
      setZombies([]);
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
  
  // Сбрасываем зомби при изменении gameStarted (когда игра запускается)
  useEffect(() => {
    if (gameStarted) {
      resetZombieWave();
    }
  }, [gameStarted]);
  
  // Функция для сброса состояния зомби
  const resetZombieWave = () => {
    console.log('Сброс волны зомби');
    
    // Удаляем всех зомби из сцены
    Object.keys(zombieRefs.current).forEach(id => {
      removeZombie(id);
    });
    
    // Удаляем все предупреждения о зомби
    Object.keys(zombieWarnings.current).forEach(id => {
      removeZombieWarning(id);
    });
    
    // Очищаем состояние
    zombieRefs.current = {};
    zombieWarnings.current = {};
    lastSpawnTime.current = Date.now();
    wave.current = 1;
    baseZombieSpeed.current = 3;
    
    // Очищаем очереди обновлений
    zombiesToAddRef.current = [];
    zombiesToRemoveRef.current = [];
    zombiesToUpdateRef.current = [];
    
    // Применяем обновления состояния
    setZombies([]);
  };
  
  // Добавляем функцию resetZombieWave в userData сцены
  useEffect(() => {
    if (scene) {
      scene.userData.resetZombieWave = resetZombieWave;
      console.log('Функция resetZombieWave добавлена в userData сцены');
    }
    
    return () => {
      if (scene && scene.userData) {
        delete scene.userData.resetZombieWave;
      }
    };
  }, [scene]);
  
  // Создание более реалистичной лужи крови
  const createBloodPool = () => {
    // Создаем более реалистичную лужу крови с неровными краями
    const poolGeometry = new THREE.CircleGeometry(0.5, 12);
    
    // Деформируем геометрию для создания неравномерных краев
    const positions = poolGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      // Не изменяем центральную точку
      if (i > 0) {
        const angle = Math.random() * Math.PI * 2;
        const variation = 0.5 + Math.random() * 0.8; // Неравномерный радиус
        
        // Извлекаем координаты
        const x = positions.getX(i);
        const z = positions.getZ(i);
        
        // Вычисляем текущий угол и текущее расстояние от центра
        const currentAngle = Math.atan2(z, x);
        const currentDist = Math.sqrt(x*x + z*z);
        
        // Создаем волнистый край с бОльшими вариациями
        const newDist = currentDist * (1 + 0.3 * Math.sin(currentAngle * 5) + 
                                      0.2 * Math.sin(currentAngle * 8) +
                                      0.1 * Math.sin(currentAngle * 12));
        
        // Применяем новое расстояние
        const newX = (newDist / currentDist) * x;
        const newZ = (newDist / currentDist) * z;
        
        positions.setX(i, newX);
        positions.setZ(i, newZ);
      }
    }
    
    // Обновляем геометрию
    poolGeometry.computeVertexNormals();
    
    // Создаем слоистую текстуру для более реалистичного вида крови
    const poolMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x5c0c0c,  // Темный красно-коричневый
      emissive: 0x2c0404, // Слабое свечение
      emissiveIntensity: 0.2,
      transparent: true, 
      opacity: 0.9,
      shininess: 70    // Влажный блеск
    });
    
    const pool = new THREE.Mesh(poolGeometry, poolMaterial);
    
    // Вращаем пул так, чтобы он лежал на земле
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.02; // Немного над землей для предотвращения z-fighting
    
    // Создаем второй слой для эффекта глубины
    const innerPoolGeometry = new THREE.CircleGeometry(0.35, 12);
    
    // Деформируем внутренний слой аналогично внешнему, но с другими параметрами
    const innerPositions = innerPoolGeometry.attributes.position;
    for (let i = 0; i < innerPositions.count; i++) {
      if (i > 0) {
        const x = innerPositions.getX(i);
        const z = innerPositions.getZ(i);
        
        const currentAngle = Math.atan2(z, x);
        const currentDist = Math.sqrt(x*x + z*z);
        
        const newDist = currentDist * (1 + 0.2 * Math.sin(currentAngle * 4) + 
                                     0.15 * Math.sin(currentAngle * 7));
        
        const newX = (newDist / currentDist) * x;
        const newZ = (newDist / currentDist) * z;
        
        innerPositions.setX(i, newX);
        innerPositions.setZ(i, newZ);
      }
    }
    
    innerPoolGeometry.computeVertexNormals();
    
    const innerPoolMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x420808,  // Еще более темный красный
      emissive: 0x200000,
      emissiveIntensity: 0.3,
      transparent: true, 
      opacity: 0.95,
      shininess: 100
    });
    
    const innerPool = new THREE.Mesh(innerPoolGeometry, innerPoolMaterial);
    innerPool.rotation.x = -Math.PI / 2;
    innerPool.position.y = 0.025; // Чуть выше основного слоя
    
    // Создаем капли крови вокруг основной лужи
    const bloodSplatters = new THREE.Group();
    
    // Добавляем 6-10 капель крови разных размеров
    const dropCount = 6 + Math.floor(Math.random() * 5);
    
    for (let i = 0; i < dropCount; i++) {
      // Случайный размер капли
      const scale = 0.05 + Math.random() * 0.15;
      
      // Создаем геометрию капли
      const dropGeometry = new THREE.CircleGeometry(1, 8);
      
      // Деформируем для формы капли
      const dropPositions = dropGeometry.attributes.position;
      for (let j = 0; j < dropPositions.count; j++) {
        if (j > 0) {
          const x = dropPositions.getX(j);
          const z = dropPositions.getZ(j);
          
          // Вычисляем угол относительно центра
          const angle = Math.atan2(z, x);
          const stretch = 1 + 0.5 * Math.cos(angle); // Растягиваем в одном направлении
          
          // Применяем деформацию
          dropPositions.setX(j, x * stretch);
          dropPositions.setZ(j, z);
        }
      }
      
      dropGeometry.scale(scale, scale, scale);
      dropGeometry.computeVertexNormals();
      
      // Материал капли
      const dropMaterial = new THREE.MeshPhongMaterial({ 
        color: (Math.random() > 0.5) ? 0x5c0c0c : 0x4c0a0a,
        transparent: true, 
        opacity: 0.8 - Math.random() * 0.3,
        shininess: 80
      });
      
      const drop = new THREE.Mesh(dropGeometry, dropMaterial);
      
      // Случайное положение и поворот
      const distance = 0.6 + Math.random() * 0.8;
      const dropAngle = Math.random() * Math.PI * 2;
      drop.position.set(
        Math.cos(dropAngle) * distance,
        0.021, // Чуть выше основной лужи
        Math.sin(dropAngle) * distance
      );
      
      // Случайное вращение
      drop.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
      
      bloodSplatters.add(drop);
    }
    
    // Объединяем все части лужи крови
    const bloodPoolGroup = new THREE.Group();
    bloodPoolGroup.add(pool);
    bloodPoolGroup.add(innerPool);
    bloodPoolGroup.add(bloodSplatters);
    
    return bloodPoolGroup;
  };
  
  return null; // Визуальное представление обрабатывается через Three.js напрямую
};

export default Zombies; 