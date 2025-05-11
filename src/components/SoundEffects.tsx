import React, { forwardRef, useImperativeHandle, useRef } from 'react';

export interface SoundEffectsRef {
  playYellowMonster: () => void;
  playWhiteMonster: () => void;
  playJump: () => void;
  playDuck: () => void;
  playCrash: () => void;
}

interface SoundEffectsProps {
  isEnabled: boolean;
}

const SoundEffects = forwardRef<SoundEffectsRef, SoundEffectsProps>(
  ({ isEnabled }, ref) => {
    const yellowMonsterSoundRef = useRef<HTMLAudioElement>(null);
    const whiteMonsterSoundRef = useRef<HTMLAudioElement>(null);
    const jumpSoundRef = useRef<HTMLAudioElement>(null);
    const duckSoundRef = useRef<HTMLAudioElement>(null);
    const crashSoundRef = useRef<HTMLAudioElement>(null);
    
    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      playYellowMonster: () => {
        if (isEnabled && yellowMonsterSoundRef.current) {
          yellowMonsterSoundRef.current.currentTime = 0;
          yellowMonsterSoundRef.current.play().catch(e => console.log('Audio play error:', e));
        }
      },
      playWhiteMonster: () => {
        if (isEnabled && whiteMonsterSoundRef.current) {
          whiteMonsterSoundRef.current.currentTime = 0;
          whiteMonsterSoundRef.current.play().catch(e => console.log('Audio play error:', e));
        }
      },
      playJump: () => {
        if (isEnabled && jumpSoundRef.current) {
          jumpSoundRef.current.currentTime = 0;
          jumpSoundRef.current.play().catch(e => console.log('Audio play error:', e));
        }
      },
      playDuck: () => {
        if (isEnabled && duckSoundRef.current) {
          duckSoundRef.current.currentTime = 0;
          duckSoundRef.current.play().catch(e => console.log('Audio play error:', e));
        }
      },
      playCrash: () => {
        if (isEnabled && crashSoundRef.current) {
          crashSoundRef.current.currentTime = 0;
          crashSoundRef.current.play().catch(e => console.log('Audio play error:', e));
        }
      }
    }));
    
    return (
      <>
        <audio 
          ref={yellowMonsterSoundRef} 
          src="/assets/sounds/yellow_monster.mp3" 
          preload="auto"
        />
        <audio 
          ref={whiteMonsterSoundRef} 
          src="/assets/sounds/white_monster.mp3" 
          preload="auto"
        />
        <audio 
          ref={jumpSoundRef} 
          src="/assets/sounds/jump.mp3" 
          preload="auto"
        />
        <audio 
          ref={duckSoundRef} 
          src="/assets/sounds/duck.mp3" 
          preload="auto"
        />
        <audio 
          ref={crashSoundRef} 
          src="/assets/sounds/crash.mp3" 
          preload="auto"
        />
      </>
    );
  }
);

export default SoundEffects; 