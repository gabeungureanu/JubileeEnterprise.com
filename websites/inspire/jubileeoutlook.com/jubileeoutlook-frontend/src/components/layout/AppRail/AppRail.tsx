import React from 'react';
import { useAppContext } from '../../../context/AppContext';
import { AppModule } from '../../../types/common';
import './AppRail.css';

const AppRail: React.FC = () => {
  const { activeModule, setActiveModule, toggleFolderPane } = useAppContext();

  const modules: { id: AppModule; icon: string; label: string }[] = [
    { id: 'mail', icon: 'mail', label: 'Mail' },
    { id: 'calendar', icon: 'calendar_today', label: 'Calendar' },
    { id: 'people', icon: 'contacts', label: 'People' },
  ];

  return (
    <nav className="app-rail">
      <div className="app-rail__top">
        <button
          className="app-rail__button app-rail__hamburger"
          onClick={toggleFolderPane}
          title="Toggle folder pane"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
      </div>

      <div className="app-rail__modules">
        {modules.map((mod) => (
          <button
            key={mod.id}
            className={`app-rail__button app-rail__module ${
              activeModule === mod.id ? 'app-rail__module--active' : ''
            }`}
            onClick={() => setActiveModule(mod.id)}
            title={mod.label}
          >
            <span className="material-symbols-outlined">{mod.icon}</span>
          </button>
        ))}
      </div>

      <div className="app-rail__bottom">
        <button className="app-rail__button" title="Settings">
          <span className="material-symbols-outlined">settings</span>
        </button>
      </div>
    </nav>
  );
};

export default AppRail;
