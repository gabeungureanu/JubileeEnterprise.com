import React from 'react';
import { useAppContext } from '../../../context/AppContext';
import AppRail from '../AppRail';
import TitleBar from '../TitleBar';
import StatusBar from '../StatusBar';
import MailPage from '../../../pages/Mail/MailPage';
import CalendarPage from '../../../pages/Calendar/CalendarPage';
import PeoplePage from '../../../pages/People/PeoplePage';
import SettingsPage from '../../../pages/Settings/SettingsPage';
import './AppLayout.css';

const AppLayout: React.FC = () => {
  const { activeModule } = useAppContext();

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'mail':
        return <MailPage />;
      case 'calendar':
        return <CalendarPage />;
      case 'people':
        return <PeoplePage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <MailPage />;
    }
  };

  return (
    <div className="app-layout">
      <AppRail />
      <div className="app-layout__main">
        <TitleBar />
        <div className="app-layout__content">
          {renderActiveModule()}
        </div>
        <StatusBar />
      </div>
    </div>
  );
};

export default AppLayout;
