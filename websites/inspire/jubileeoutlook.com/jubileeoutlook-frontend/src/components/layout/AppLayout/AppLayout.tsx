import React from 'react';
import { useAppContext } from '../../../context/AppContext';
import AppRail from '../AppRail';
import TitleBar from '../TitleBar';
import Ribbon from '../Ribbon';
import StatusBar from '../StatusBar';
import MailPage from '../../../pages/Mail/MailPage';
import CalendarPage from '../../../pages/Calendar/CalendarPage';
import PeoplePage from '../../../pages/People/PeoplePage';
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
      default:
        return <MailPage />;
    }
  };

  return (
    <div className="app-layout">
      <AppRail />
      <div className="app-layout__main">
        <TitleBar />
        <Ribbon />
        <div className="app-layout__content">
          {renderActiveModule()}
        </div>
        <StatusBar />
      </div>
    </div>
  );
};

export default AppLayout;
