import React from 'react';
import { useAppContext } from '../../../context/AppContext';
import MailRibbon from './MailRibbon';
import CalendarRibbon from './CalendarRibbon';
import PeopleRibbon from './PeopleRibbon';
import './Ribbon.css';

const Ribbon: React.FC = () => {
  const { activeModule } = useAppContext();

  const renderModuleRibbon = () => {
    switch (activeModule) {
      case 'mail':
        return <MailRibbon />;
      case 'calendar':
        return <CalendarRibbon />;
      case 'people':
        return <PeopleRibbon />;
      default:
        return null;
    }
  };

  return (
    <div className="ribbon">
      {renderModuleRibbon()}
    </div>
  );
};

export default Ribbon;
