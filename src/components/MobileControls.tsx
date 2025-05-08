import React, { useEffect, useRef } from 'react';
import nipplejs, { JoystickOutputData, JoystickManager, EventData } from 'nipplejs';
import { Vector3 } from 'three';

interface MobileControlsProps {
  onMove?: (x: number, y: number) => void;
  onShoot?: () => void;
  isEnabled: boolean;
}

const MobileControls: React.FC<MobileControlsProps> = ({ 
  onMove, 
  onShoot,
  isEnabled = true 
}) => {
  const joystickZoneRef = useRef<HTMLDivElement>(null);
  const shootButtonRef = useRef<HTMLDivElement>(null);
  const joystickManagerRef = useRef<JoystickManager | null>(null);
  
  // Создаем джойстик при монтировании компонента
  useEffect(() => {
    if (!isEnabled || !joystickZoneRef.current) return;
    
    // Настройки для джойстика
    const options = {
      zone: joystickZoneRef.current,
      mode: 'static' as const,
      position: { left: '50%', bottom: '80px' },
      color: 'white',
      size: 100,
      lockX: false,
      lockY: false,
      catchDistance: 150,
      restJoystick: true,
    };
    
    // Создаем джойстик
    const manager = nipplejs.create(options);
    joystickManagerRef.current = manager;
    
    // Обработка событий джойстика
    manager.on('move', (evt: EventData, data: JoystickOutputData) => {
      if (onMove && data.vector) {
        // Передаем направление движения
        onMove(data.vector.x, -data.vector.y); // Инвертируем Y для правильной ориентации
      }
    });
    
    manager.on('end', () => {
      if (onMove) {
        // При отпускании джойстика останавливаем движение
        onMove(0, 0);
      }
    });
    
    // Обработка нажатия на кнопку выстрела
    const handleShoot = () => {
      if (onShoot) onShoot();
    };
    
    if (shootButtonRef.current) {
      shootButtonRef.current.addEventListener('touchstart', handleShoot);
    }
    
    // Очистка при размонтировании
    return () => {
      if (joystickManagerRef.current) {
        joystickManagerRef.current.destroy();
      }
      
      if (shootButtonRef.current) {
        shootButtonRef.current.removeEventListener('touchstart', handleShoot);
      }
    };
  }, [isEnabled, onMove, onShoot]);
  
  // Если управление отключено, не рендерим ничего
  if (!isEnabled) return null;
  
  return (
    <div className="mobile-controls">
      <div ref={joystickZoneRef} className="joystick-zone"></div>
      <div ref={shootButtonRef} className="shoot-button">
        <span>Fire</span>
      </div>
    </div>
  );
};

export default MobileControls; 