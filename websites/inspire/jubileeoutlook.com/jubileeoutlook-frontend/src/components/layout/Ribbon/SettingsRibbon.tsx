import React from 'react';
import { useAppContext } from '../../../context/AppContext';
import './Ribbon.css';

const SettingsRibbon: React.FC = () => {
  const { setActiveModule } = useAppContext();

  return (
    <div className="ribbon__content">
      <div className="ribbon__group">
        <button
          className="ribbon__button"
          title="Back to Mail"
          onClick={() => setActiveModule('mail')}
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span className="ribbon__label">Back to Mail</span>
        </button>
      </div>

      <div className="ribbon__separator" />

      <div className="ribbon__group">
        <button className="ribbon__button" title="Settings" disabled>
          <span className="material-symbols-outlined">settings</span>
          <span className="ribbon__label">Settings</span>
        </button>
      </div>
    </div>
  );
};

export default SettingsRibbon;
