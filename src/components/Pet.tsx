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
}

interface ZombieTarget {
  id: string;
  position: Vector3;
  distance: number;
}

const Pet: React.FC<PetProps> = ({ playerPosition, isEnabled, isGameOver, onPlaySound }) => {
  const { scene } = useThree();
  const petRef = useRef<Group>(null);
  const targetPosition = useRef(new Vector3());
  const velocity = useRef(new Vector3());
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
  
  // Функция для создания модели зомби-собаки
  const createZombieDog = () => {
    if (!petRef.current) return;
    
    // Очищаем существующие элементы
    while (petRef.current.children.length > 0) {
      petRef.current.remove(petRef.current.children[0]);
    }
    
    // Основные материалы для зомби-собаки
    // Используем более реалистичные цвета для зомби-собаки
    const rottenFleshColor = new THREE.Color(0x3a4024); // Тёмно-зелёный с оттенком коричневого
    const exposedFleshColor = new THREE.Color(0x8c2f2f); // Тёмно-красный для обнажённых ран
    const boneColor = new THREE.Color(0xe6ddc3); // Грязноватый цвет костей
    const bloodColor = new THREE.Color(0x790000); // Тёмный цвет засохшей крови
    
    // Материалы с разными свойствами
    const skinMaterial = new THREE.MeshPhongMaterial({ 
      color: rottenFleshColor,
      flatShading: true, 
      shininess: 5
    });
    
    const fleshMaterial = new THREE.MeshPhongMaterial({ 
      color: exposedFleshColor,
      flatShading: true,
      shininess: 20,
      emissive: new THREE.Color(0x301010),
      emissiveIntensity: 0.2
    });
    
    const boneMaterial = new THREE.MeshPhongMaterial({ 
      color: boneColor,
      flatShading: true,
      shininess: 10
    });
    
    const bloodMaterial = new THREE.MeshPhongMaterial({ 
      color: bloodColor,
      flatShading: false,
      shininess: 50,
      emissive: new THREE.Color(0x200000),
      emissiveIntensity: 0.2
    });
    
    // СОЗДАЕМ ТЕЛО СОБАКИ (удлиненное, с выступающими ребрами)
    // Используем цилиндр вместо куба для тела, чтобы форма была ближе к реальной собаке
    const bodyGeometry = new THREE.CylinderGeometry(0.35, 0.4, 1.4, 12, 1, false);
    
    // Деформируем геометрию для эффекта худого, покрытого шрамами тела
    const bodyPositions = bodyGeometry.attributes.position;
    for (let i = 0; i < bodyPositions.count; i++) {
      const x = bodyPositions.getX(i);
      const y = bodyPositions.getY(i);
      const z = bodyPositions.getZ(i);
      
      // Делаем тело более худым - впалые бока
      if (Math.abs(x) > 0.2) {
        bodyPositions.setX(i, x * 0.9);
      }
      
      // Добавляем неровности для эффекта шрамов и ран
      if (Math.random() > 0.85) {
        bodyPositions.setX(i, x + (Math.random() - 0.5) * 0.08);
        bodyPositions.setZ(i, z + (Math.random() - 0.5) * 0.08);
      }
      
      // Создаем выступающие ребра на боках
      if (Math.abs(x) > 0.25 && y > 0) {
        // Используем синусоиду для создания периодичности ребер
        const ribFactor = Math.sin(z * 10) * 0.05;
        if (ribFactor > 0.03) {
          bodyPositions.setX(i, x * (1 + ribFactor));
        }
      }
    }
    
    bodyGeometry.rotateZ(Math.PI / 2); // Поворачиваем цилиндр для правильной ориентации
    
    const body = new THREE.Mesh(bodyGeometry, skinMaterial);
    body.position.set(0, 0.6, 0);
    body.scale.set(1, 1, 0.8); // Сжимаем по вертикали для более реалистичной формы
    body.castShadow = true;
    petRef.current.add(body);
    
    // Добавляем открытую рану на боку с видимыми ребрами
    const woundGeometry = new THREE.SphereGeometry(0.2, 8, 8, 0, Math.PI * 1.5, 0, Math.PI / 2);
    const wound = new THREE.Mesh(woundGeometry, fleshMaterial);
    wound.position.set(0.25, 0.7, 0.1);
    wound.rotation.set(0, Math.PI / 2, 0);
    wound.scale.set(1, 0.6, 1);
    body.add(wound);
    
    // Добавляем видимые ребра, торчащие из раны
    for (let i = 0; i < 3; i++) {
      const ribGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6);
      ribGeometry.translate(0, 0.15, 0); // Сдвигаем, чтобы один конец был в ране
      
      // Деформируем ребро для искривленного вида
      const ribPositions = ribGeometry.attributes.position;
      for (let j = 0; j < ribPositions.count; j++) {
        const x = ribPositions.getX(j);
        const y = ribPositions.getY(j);
        
        // Искривление ребра
        ribPositions.setX(j, x + y * 0.1);
      }
      
      const rib = new THREE.Mesh(ribGeometry, boneMaterial);
      rib.position.set(0, 0, (i - 1) * 0.08);
      rib.rotation.set(0, 0, Math.PI / 2 - 0.3);
      wound.add(rib);
    }
    
    // Добавляем засохшую кровь вокруг раны
    const bloodTrailGeometry = new THREE.PlaneGeometry(0.4, 0.6, 4, 4);
    // Деформируем для неровных краев
    const bloodTrailPositions = bloodTrailGeometry.attributes.position;
    for (let i = 0; i < bloodTrailPositions.count; i++) {
      const x = bloodTrailPositions.getX(i);
      const y = bloodTrailPositions.getY(i);
      
      // Создаем рваные, неровные края
      if (Math.abs(x) > 0.15 || Math.abs(y) > 0.25) {
        bloodTrailPositions.setX(i, x + (Math.random() - 0.5) * 0.07);
        bloodTrailPositions.setY(i, y + (Math.random() - 0.5) * 0.07);
      }
    }
    
    const bloodTrail = new THREE.Mesh(bloodTrailGeometry, bloodMaterial);
    bloodTrail.position.set(0.28, 0, 0.1);
    bloodTrail.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    body.add(bloodTrail);
    
    // СОЗДАЕМ ГОЛОВУ СОБАКИ (более вытянутую, как у добермана/немецкой овчарки)
    // Используем удлиненный куб для основы морды
    const headBaseGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.6);
    
    // Деформируем для более естественной формы
    const headBasePositions = headBaseGeometry.attributes.position;
    for (let i = 0; i < headBasePositions.count; i++) {
      const x = headBasePositions.getX(i);
      const y = headBasePositions.getY(i);
      const z = headBasePositions.getZ(i);
      
      // Сужаем голову к морде
      if (z > 0.2) {
        const factor = 1 - (z - 0.2) * 0.4;
        headBasePositions.setX(i, x * factor);
        headBasePositions.setY(i, y * factor);
      }
      
      // Добавляем неровности для эффекта ран
      if (Math.random() > 0.85) {
        headBasePositions.setX(i, x + (Math.random() - 0.5) * 0.05);
        headBasePositions.setY(i, y + (Math.random() - 0.5) * 0.05);
        headBasePositions.setZ(i, z + (Math.random() - 0.5) * 0.05);
      }
    }
    
    const head = new THREE.Mesh(headBaseGeometry, skinMaterial.clone());
    head.position.set(0, 0.85, 0.5);
    head.castShadow = true;
    petRef.current.add(head);
    headRef.current = head;
    
    // Создаем вытянутую морду
    const muzzleGeometry = new THREE.ConeGeometry(0.2, 0.5, 8);
    // Обрезаем кончик конуса
    muzzleGeometry.translate(0, -0.1, 0);
    
    // Деформируем для более реалистичной формы пасти
    const muzzlePositions = muzzleGeometry.attributes.position;
    for (let i = 0; i < muzzlePositions.count; i++) {
      const x = muzzlePositions.getX(i);
      const y = muzzlePositions.getY(i);
      const z = muzzlePositions.getZ(i);
      
      // Расширяем нижнюю часть морды
      if (y < 0) {
        muzzlePositions.setX(i, x * 1.2);
        muzzlePositions.setZ(i, z * 1.2);
      }
      
      // Сплющиваем морду сверху вниз
      muzzlePositions.setY(i, y * 0.8);
    }
    
    const muzzle = new THREE.Mesh(muzzleGeometry, skinMaterial.clone());
    muzzle.rotation.set(Math.PI / 2, 0, 0);
    muzzle.position.set(0, 0.75, 0.9);
    muzzle.castShadow = true;
    head.add(muzzle);
    
    // Создаем нижнюю челюсть с видимыми зубами
    const jawGeometry = new THREE.BoxGeometry(0.35, 0.12, 0.4);
    
    // Деформируем для заостренной формы
    const jawPositions = jawGeometry.attributes.position;
    for (let i = 0; i < jawPositions.count; i++) {
      const x = jawPositions.getX(i);
      const y = jawPositions.getY(i);
      const z = jawPositions.getZ(i);
      
      // Сужаем переднюю часть челюсти
      if (z > 0.1) {
        const factor = 1 - (z - 0.1) * 0.6;
        jawPositions.setX(i, x * factor);
      }
      
      // Добавляем неровности
      if (Math.random() > 0.8) {
        jawPositions.setX(i, x + (Math.random() - 0.5) * 0.03);
        jawPositions.setZ(i, z + (Math.random() - 0.5) * 0.03);
      }
    }
    
    const jaw = new THREE.Mesh(jawGeometry, skinMaterial.clone());
    jaw.position.set(0, 0.6, 0.9);
    jaw.castShadow = true;
    head.add(jaw);
    jawRef.current = jaw;
    
    // Добавляем зубы (острые, нерегулярные)
    // Создаем функцию для генерации зуба
    const createTooth = (x: number, z: number, height: number = 0.12, isTop: boolean = true) => {
      const toothGeometry = new THREE.ConeGeometry(0.025, height, 4);
      
      // Деформируем для более неровных зубов
      const toothPositions = toothGeometry.attributes.position;
      for (let i = 0; i < toothPositions.count; i++) {
        // Добавляем неровности только если это не вершина зуба
        if (toothPositions.getY(i) < height * 0.8) {
          toothPositions.setX(i, toothPositions.getX(i) + (Math.random() - 0.5) * 0.01);
          toothPositions.setZ(i, toothPositions.getZ(i) + (Math.random() - 0.5) * 0.01);
        }
      }
      
      // Случайно выбираем между чисто белым и желтоватым цветом
      const toothColor = Math.random() > 0.5 ? 
        new THREE.Color(0xf8f0e3) : // Белый с желтоватым оттенком
        new THREE.Color(0xd3c7a2);  // Более желтоватый
      
      const toothMaterial = new THREE.MeshPhongMaterial({ 
        color: toothColor,
        shininess: 70
      });
      
      const tooth = new THREE.Mesh(toothGeometry, toothMaterial);
      
      if (isTop) {
        // Верхние зубы
        tooth.rotation.x = Math.PI / 2 + Math.PI;
        tooth.position.set(x, 0.67, z);
        muzzle.add(tooth);
      } else {
        // Нижние зубы
        tooth.rotation.x = Math.PI / 2;
        tooth.position.set(x, 0.06, z);
        jaw.add(tooth);
      }
      
      return tooth;
    };
    
    // Верхние зубы (клыки длиннее)
    createTooth(-0.13, 0.35, 0.18, true); // Левый клык
    createTooth(0.13, 0.35, 0.18, true);  // Правый клык
    
    // Дополнительные верхние зубы
    for (let i = 0; i < 6; i++) {
      const offset = (i - 2.5) * 0.06;
      const z = 0.3 - Math.abs(offset) * 0.15; // Зубы по дуге
      const height = 0.08 + Math.random() * 0.05; // Случайная высота остальных зубов
      createTooth(offset, z, height, true);
    }
    
    // Нижние зубы
    createTooth(-0.12, 0.3, 0.15, false); // Левый клык
    createTooth(0.12, 0.3, 0.15, false);  // Правый клык
    
    // Дополнительные нижние зубы
    for (let i = 0; i < 5; i++) {
      const offset = (i - 2) * 0.06;
      const z = 0.25 - Math.abs(offset) * 0.1; // Зубы по дуге
      const height = 0.07 + Math.random() * 0.04; // Случайная высота
      createTooth(offset, z, height, false);
    }
    
    // Создаем глаза (один глаз нормальный, второй поврежденный)
    
    // Правый глаз (нормальный, но светящийся красным)
    const rightEyeGeometry = new THREE.SphereGeometry(0.08, 12, 12);
    const rightEyeMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x200000,
      emissive: 0xff0000,
      emissiveIntensity: 0.7,
      shininess: 100
    });
    
    const rightEye = new THREE.Mesh(rightEyeGeometry, rightEyeMaterial);
    rightEye.position.set(-0.15, 0.15, 0.22);
    head.add(rightEye);
    
    // Левый глаз (поврежденный/отсутствующий)
    const leftEyeSocketGeometry = new THREE.SphereGeometry(0.09, 12, 12);
    // Деформируем для создания эффекта разорванного глаза
    const leftEyeSocketPositions = leftEyeSocketGeometry.attributes.position;
    for (let i = 0; i < leftEyeSocketPositions.count; i++) {
      const x = leftEyeSocketPositions.getX(i);
      const y = leftEyeSocketPositions.getY(i);
      const z = leftEyeSocketPositions.getZ(i);
      
      // Создаем "рваную" форму
      if (x > 0 || y > 0) {
        leftEyeSocketPositions.setX(i, x + (Math.random() - 0.3) * 0.07);
        leftEyeSocketPositions.setY(i, y + (Math.random() - 0.3) * 0.07);
        leftEyeSocketPositions.setZ(i, z + (Math.random() - 0.5) * 0.05);
      }
    }
    
    const leftEyeSocketMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x400000,
      side: THREE.DoubleSide,
      flatShading: true
    });
    
    const leftEyeSocket = new THREE.Mesh(leftEyeSocketGeometry, leftEyeSocketMaterial);
    leftEyeSocket.position.set(0.15, 0.15, 0.22);
    head.add(leftEyeSocket);
    
    // Добавляем засохшую кровь, стекающую из поврежденного глаза
    const eyeBloodGeometry = new THREE.PlaneGeometry(0.15, 0.3, 4, 4);
    // Деформируем для неровных краев
    const eyeBloodPositions = eyeBloodGeometry.attributes.position;
    for (let i = 0; i < eyeBloodPositions.count; i++) {
      const x = eyeBloodPositions.getX(i);
      const y = eyeBloodPositions.getY(i);
      
      // Создаем потек крови с неровными краями
      eyeBloodPositions.setX(i, x + Math.sin(y * 20) * 0.02);
      
      if (Math.abs(x) > 0.05) {
        eyeBloodPositions.setX(i, x + (Math.random() - 0.5) * 0.05);
      }
    }
    
    const eyeBlood = new THREE.Mesh(eyeBloodGeometry, bloodMaterial);
    eyeBlood.position.set(0.16, 0, 0.22);
    eyeBlood.rotation.set(0, Math.PI / 2, 0);
    head.add(eyeBlood);
    
    // Уши (рваные, поврежденные)
    const createEar = (isLeft: boolean) => {
      const earGeometry = new THREE.BoxGeometry(0.1, 0.3, 0.05, 3, 5, 2);
      
      // Деформируем уши для создания рваных краев
      const earPositions = earGeometry.attributes.position;
      for (let i = 0; i < earPositions.count; i++) {
        const x = earPositions.getX(i);
        const y = earPositions.getY(i);
        const z = earPositions.getZ(i);
        
        // Более сильные деформации в верхней части уха
        if (y > 0.1) {
          const deformStrength = Math.min(1, (y - 0.1) * 3) * 0.1;
          earPositions.setX(i, x + (Math.random() - 0.5) * deformStrength);
          
          // Создаем дыры/разрывы в ухе
          if (Math.random() > 0.85) {
            earPositions.setY(i, y - 0.05);
          }
        }
      }
      
      const ear = new THREE.Mesh(earGeometry, skinMaterial.clone());
      
      if (isLeft) {
        ear.position.set(0.18, 0.25, 0);
        ear.rotation.set(0.1, 0, 0.3);
      } else {
        ear.position.set(-0.18, 0.25, 0);
        ear.rotation.set(0.1, 0, -0.3);
      }
      
      head.add(ear);
      
      // Добавляем видимую рану на ухе
      if (isLeft) {
        const earWoundGeometry = new THREE.CircleGeometry(0.04, 8);
        const earWound = new THREE.Mesh(earWoundGeometry, fleshMaterial);
        earWound.position.set(0, 0.1, 0.03);
        earWound.rotation.set(0, 0, Math.random() * Math.PI);
        ear.add(earWound);
      }
      
      return ear;
    };
    
    createEar(true);  // Левое ухо
    createEar(false); // Правое ухо
    
    // Создаем ноги (худые, с видимыми ранами)
    const createLeg = (x: number, z: number, isFront: boolean) => {
      const legGeometry = new THREE.CylinderGeometry(0.07, 0.05, 0.6, 8);
      
      // Деформируем для эффекта истощенных ног
      const legPositions = legGeometry.attributes.position;
      for (let i = 0; i < legPositions.count; i++) {
        const x = legPositions.getX(i);
        const y = legPositions.getY(i);
        const z = legPositions.getZ(i);
        
        // Создаем впадины на ногах для эффекта видимых мышц
        legPositions.setX(i, x + Math.sin(y * 10) * 0.02);
        legPositions.setZ(i, z + Math.cos(y * 10) * 0.02);
        
        // Добавляем случайные деформации
        if (Math.random() > 0.9) {
          legPositions.setX(i, x + (Math.random() - 0.5) * 0.04);
          legPositions.setZ(i, z + (Math.random() - 0.5) * 0.04);
        }
      }
      
      const leg = new THREE.Mesh(legGeometry, skinMaterial.clone());
      leg.position.set(x, 0.3, z);
      if (petRef.current) {
        petRef.current.add(leg);
      }
      
      // Добавляем кровавую рану на одну из ног
      if ((x > 0 && isFront) || (x < 0 && !isFront)) {
        const woundGeometry = new THREE.SphereGeometry(0.05, 8, 8, 0, Math.PI);
        const wound = new THREE.Mesh(woundGeometry, fleshMaterial);
        wound.position.set(0.08, 0.1, 0);
        wound.rotation.set(0, Math.PI / 2, 0);
        leg.add(wound);
        
        // Добавляем потек крови
        const bloodStreamGeometry = new THREE.PlaneGeometry(0.1, 0.2);
        const bloodStream = new THREE.Mesh(bloodStreamGeometry, bloodMaterial);
        bloodStream.position.set(0.08, -0.05, 0);
        bloodStream.rotation.set(0, Math.PI / 2, 0);
        leg.add(bloodStream);
      }
      
      // Создаем лапу
      const pawGeometry = new THREE.SphereGeometry(0.06, 8, 8);
      pawGeometry.scale(1.2, 0.6, 1.5); // Сплющиваем для формы лапы
      
      const paw = new THREE.Mesh(pawGeometry, skinMaterial.clone());
      paw.position.set(0, -0.3, 0.05); // Сдвигаем немного вперед
      leg.add(paw);
      
      // Добавляем когти
      for (let i = 0; i < 3; i++) {
        const clawGeometry = new THREE.ConeGeometry(0.015, 0.08, 4);
        const clawMaterial = new THREE.MeshPhongMaterial({
          color: 0x2a2a2a,
          shininess: 30
        });
        
        const claw = new THREE.Mesh(clawGeometry, clawMaterial);
        claw.rotation.set(Math.PI / 2, 0, 0);
        claw.position.set((i - 1) * 0.03, -0.05, 0.08);
        paw.add(claw);
      }
      
      return leg;
    };
    
    // Создаем четыре ноги
    createLeg(0.3, 0.4, true);   // Передняя левая
    createLeg(-0.3, 0.4, true);  // Передняя правая
    createLeg(0.3, -0.4, false); // Задняя левая
    createLeg(-0.3, -0.4, false); // Задняя правая
    
    // Создаем хвост (покореженный, частично лишенный шерсти)
    const tailGeometry = new THREE.CylinderGeometry(0.06, 0.03, 0.7, 8);
    
    // Деформируем хвост для создания изгибов и повреждений
    const tailPositions = tailGeometry.attributes.position;
    for (let i = 0; i < tailPositions.count; i++) {
      const x = tailPositions.getX(i);
      const y = tailPositions.getY(i);
      const z = tailPositions.getZ(i);
      
      // Создаем изгиб хвоста
      tailPositions.setX(i, x + Math.sin(y * 3) * 0.1);
      
      // Добавляем неровности
      if (Math.random() > 0.8) {
        tailPositions.setX(i, tailPositions.getX(i) + (Math.random() - 0.5) * 0.03);
        tailPositions.setZ(i, z + (Math.random() - 0.5) * 0.03);
      }
    }
    
    const tail = new THREE.Mesh(tailGeometry, skinMaterial.clone());
    tail.position.set(0, 0.6, -0.7);
    tail.rotation.set(-Math.PI / 4, Math.PI / 8, 0);
    petRef.current.add(tail);
    tailRef.current = tail;
    
    // Добавляем оголенную кость на кончике хвоста
    const tailBoneGeometry = new THREE.ConeGeometry(0.03, 0.15, 6);
    const tailBone = new THREE.Mesh(tailBoneGeometry, boneMaterial);
    tailBone.position.set(0, -0.4, 0);
    tailBone.rotation.set(0, 0, Math.PI);
    tail.add(tailBone);
    
    // Добавляем мелкие детали, например лоскут кожи, свисающий с тела
    const skinFlapGeometry = new THREE.PlaneGeometry(0.2, 0.3, 3, 3);
    // Деформируем для неровных краев
    const skinFlapPositions = skinFlapGeometry.attributes.position;
    for (let i = 0; i < skinFlapPositions.count; i++) {
      const x = skinFlapPositions.getX(i);
      const y = skinFlapPositions.getY(i);
      
      if (y < -0.1 || Math.abs(x) > 0.08) {
        skinFlapPositions.setX(i, x + (Math.random() - 0.5) * 0.07);
        skinFlapPositions.setY(i, y + (Math.random() - 0.5) * 0.07);
      }
    }
    
    const skinFlap = new THREE.Mesh(skinFlapGeometry, skinMaterial.clone());
    skinFlap.position.set(-0.35, 0.6, -0.1);
    skinFlap.rotation.set(0, Math.PI / 2, 0.2);
    body.add(skinFlap);
  };
  
  // Инициализация зомби-собаки при монтировании
  useEffect(() => {
    // Если питомец не включен, не создаем его
    if (!isEnabled) return;
    
    console.log('Инициализация зомби-собаки');
    
    // Создаем модель зомби-собаки
    if (petRef.current) {
      createZombieDog();
    }
    
    // Остальной код из оригинального useEffect
    // ...
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
        velocity.current.copy(direction).multiplyScalar(speed * delta);
        
        // Обновляем позицию
        petRef.current!.position.add(velocity.current);
        
        // Ограничиваем в пределах арены
        const arenaSize = 74; // Обновлено: чуть меньше чем новая арена (75)
        
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
      const arenaSize = 74; // Обновлено: новый размер соответствует размеру арены
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
    />
  );
};

export default Pet; 