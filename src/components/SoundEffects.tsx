import React, { useEffect, useRef, forwardRef } from 'react';

// Интерфейс для пропсов
interface SoundEffectsProps {
  isEnabled: boolean;
}

// Интерфейс для типа звуков
export interface SoundEffectsRef {
  playDogBark: () => void;
  playDogBite: () => void;
  playGunshot: () => void;
  playZombieHurt: () => void;
  playZombieDeath: () => void;
}

// Компонент звуковых эффектов - экспортируем с forwardRef, чтобы получить ссылку извне
const SoundEffects = forwardRef<SoundEffectsRef, SoundEffectsProps>(
  ({ isEnabled }, ref) => {
    // Ссылки на аудио элементы
    const dogBarkRef = useRef<HTMLAudioElement | null>(null);
    const dogBiteRef = useRef<HTMLAudioElement | null>(null);
    const gunshotRef = useRef<HTMLAudioElement | null>(null);
    const zombieHurtRef = useRef<HTMLAudioElement | null>(null);
    const zombieDeathRef = useRef<HTMLAudioElement | null>(null);

    // Функции для воспроизведения звуков
    const playDogBark = () => {
      if (isEnabled && dogBarkRef.current) {
        dogBarkRef.current.currentTime = 0;
        dogBarkRef.current.play().catch(err => {
          console.log('Ошибка воспроизведения звука лая:', err);
          // Пытаемся загрузить звук еще раз с другого пути
          dogBarkRef.current!.src = '/assets/sounds/dog_bark.mp3';
        });
      }
    };

    const playDogBite = () => {
      if (isEnabled && dogBiteRef.current) {
        dogBiteRef.current.currentTime = 0;
        dogBiteRef.current.play().catch(err => {
          console.log('Ошибка воспроизведения звука укуса:', err);
          // Пытаемся загрузить звук еще раз с другого пути
          dogBiteRef.current!.src = '/assets/sounds/dog_bite.mp3';
        });
      }
    };

    const playGunshot = () => {
      if (isEnabled && gunshotRef.current) {
        gunshotRef.current.currentTime = 0;
        gunshotRef.current.play().catch(err => {
          console.log('Ошибка воспроизведения звука выстрела:', err);
          // Пытаемся загрузить звук еще раз с другого пути
          gunshotRef.current!.src = '/assets/sounds/gunshot.mp3';
        });
      }
    };

    const playZombieHurt = () => {
      if (isEnabled && zombieHurtRef.current) {
        zombieHurtRef.current.currentTime = 0;
        zombieHurtRef.current.play().catch(err => {
          console.log('Ошибка воспроизведения звука зомби:', err);
          // Пытаемся загрузить звук еще раз с другого пути
          zombieHurtRef.current!.src = '/assets/sounds/zombie_hurt.mp3';
        });
      }
    };

    const playZombieDeath = () => {
      if (isEnabled && zombieDeathRef.current) {
        zombieDeathRef.current.currentTime = 0;
        zombieDeathRef.current.play().catch(err => {
          console.log('Ошибка воспроизведения звука смерти зомби:', err);
          // Пытаемся загрузить звук еще раз с другого пути
          zombieDeathRef.current!.src = '/assets/sounds/zombie_death.mp3';
        });
      }
    };

    // Экспортируем функции через ref
    useEffect(() => {
      if (ref) {
        // Передаем методы воспроизведения через ref
        (ref as React.MutableRefObject<SoundEffectsRef>).current = {
          playDogBark,
          playDogBite,
          playGunshot,
          playZombieHurt,
          playZombieDeath
        };
      }
    }, [ref, isEnabled]);

    return (
      <div style={{ display: 'none' }}>
        <audio 
          ref={dogBarkRef} 
          src="/assets/sounds/dog_bark.mp3" 
          preload="auto"
        />
        <audio 
          ref={dogBiteRef} 
          src="/assets/sounds/dog_bite.mp3" 
          preload="auto"
        />
        <audio 
          ref={gunshotRef} 
          src="/assets/sounds/gunshot.mp3" 
          preload="auto"
        />
        <audio 
          ref={zombieHurtRef} 
          src="/assets/sounds/zombie_hurt.mp3" 
          preload="auto"
        />
        <audio 
          ref={zombieDeathRef} 
          src="/assets/sounds/zombie_death.mp3" 
          preload="auto"
        />
      </div>
    );
  }
);

export default SoundEffects; 