import React from 'react';
import './TitleBar.css';

const TitleBar: React.FC = () => {
  return (
    <header className="title-bar">
      <div className="title-bar__left">
        <span className="title-bar__title">Jubilee Outlook</span>
      </div>
      <div className="title-bar__right">
        <button className="title-bar__profile" title="Profile">
          <span className="material-symbols-outlined">account_circle</span>
        </button>
      </div>
    </header>
  );
};

export default TitleBar;
