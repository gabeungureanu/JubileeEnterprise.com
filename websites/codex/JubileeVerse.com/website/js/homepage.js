/**
 * JubileeVerse Homepage JavaScript
 * Handles interactions for the homepage
 */

(function() {
  'use strict';

  var selectedPersonaSlug = null;
  var selectedLanguage = null;
  var personaCookieName = 'jv_default_persona';
  var selectedLanguageKey = 'jv_selected_language';
  var recentLanguagesKey = 'jv_recent_languages';

  // Set current year in footer
  var currentYearEl = document.getElementById('currentYear');
  if (currentYearEl) {
    currentYearEl.textContent = new Date().getFullYear();
  }

  // Search input handler - redirect to chat on Enter
  var searchInputEl = document.getElementById('searchInput');
  var searchBox = document.querySelector('.search-box');
  if (searchInputEl && searchBox) {
    // Expand/collapse based on character count (50+ chars = expanded)
    function checkExpand() {
      if (searchInputEl.value.length >= 50) {
        searchBox.classList.add('expanded');
      } else {
        searchBox.classList.remove('expanded');
      }
    }

    searchInputEl.addEventListener('input', checkExpand);

    searchInputEl.addEventListener('keydown', function(e) {
      // Submit on Enter (without Shift)
      if (e.key === 'Enter' || e.keyCode === 13) {
        if (!e.shiftKey) {
          e.preventDefault();
          var searchText = this.value.trim();
          if (searchText) {
            var params = new URLSearchParams();
            params.set('q', searchText);

            // Add timestamp to ensure each search submission creates a new message
            params.set('t', Date.now().toString());

            var personaSlug = getSelectedPersonaSlug();
            if (personaSlug) {
              params.set('persona', personaSlug);
            }

            var languageState = getSelectedLanguageState();
            if (languageState && languageState.code) {
              params.set('lang', languageState.code);
            }

            // Pass the selected model
            var modelId = getCookie('selectedInspireModel');
            if (modelId) {
              params.set('model', modelId);
            }

            // Check if privacy mode is enabled (lock icon has 'unlocked' class)
            var lockIcon = document.querySelector('.action-icon[title="Privacy Mode"]');
            if (lockIcon && lockIcon.classList.contains('unlocked')) {
              params.set('private', '1');
            }

            window.location.href = '/chat?' + params.toString();
          }
        }
      }
    });
  }

  // Slide panel toggle
  var menuToggle = document.getElementById('menuToggle');
  var slidePanel = document.getElementById('slidePanel');
  var sidebar = document.querySelector('.sidebar');

  if (menuToggle && slidePanel) {
    menuToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      slidePanel.classList.toggle('open');
    });

    // Close slide panel when clicking outside of it and the sidebar
    document.addEventListener('click', function(e) {
      if (slidePanel.classList.contains('open')) {
        // Check if click is outside the slide panel and sidebar
        if (!slidePanel.contains(e.target) && !sidebar.contains(e.target)) {
          slidePanel.classList.remove('open');
        }
      }
    });
  }

  // Hover sync between sidebar icons and slide panel items
  var sidebarIcons = document.querySelectorAll('.sidebar-icon[data-nav]');
  var slidePanelItems = document.querySelectorAll('.slide-panel-item[data-nav]');

  // Sidebar icon hover -> highlight slide panel item
  sidebarIcons.forEach(function(icon) {
    icon.addEventListener('mouseenter', function() {
      var navId = this.getAttribute('data-nav');
      var panelItem = document.querySelector('.slide-panel-item[data-nav="' + navId + '"]');
      if (panelItem) {
        panelItem.classList.add('hover-highlight');
      }
    });
    icon.addEventListener('mouseleave', function() {
      var navId = this.getAttribute('data-nav');
      var panelItem = document.querySelector('.slide-panel-item[data-nav="' + navId + '"]');
      if (panelItem) {
        panelItem.classList.remove('hover-highlight');
      }
    });

    // Click on sidebar icon navigates to that section
    icon.addEventListener('click', function() {
      var navId = this.getAttribute('data-nav');
      var panelItem = document.querySelector('.slide-panel-item[data-nav="' + navId + '"]');
      if (panelItem && panelItem.href) {
        window.location.href = panelItem.href;
      }
    });
  });

  // Slide panel item hover -> highlight sidebar icon
  slidePanelItems.forEach(function(item) {
    item.addEventListener('mouseenter', function() {
      var navId = this.getAttribute('data-nav');
      var sidebarIcon = document.querySelector('.sidebar-icon[data-nav="' + navId + '"]');
      if (sidebarIcon) {
        sidebarIcon.classList.add('hover-highlight');
      }
    });
    item.addEventListener('mouseleave', function() {
      var navId = this.getAttribute('data-nav');
      var sidebarIcon = document.querySelector('.sidebar-icon[data-nav="' + navId + '"]');
      if (sidebarIcon) {
        sidebarIcon.classList.remove('hover-highlight');
      }
    });
  });

  // Cookie helper functions
  function setCookie(name, value, days) {
    var expires = '';
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/';
  }

  function getCookie(name) {
    var nameEQ = name + '=';
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return null;
  }

  function getSelectedPersonaSlug() {
    if (selectedPersonaSlug) return selectedPersonaSlug;
    var stored = getCookie(personaCookieName);
    if (stored) return stored.toLowerCase();
    return 'jubilee';
  }

  function getSelectedLanguageState() {
    if (selectedLanguage) return selectedLanguage;
    return readSelectedLanguage();
  }

  // Inspire dropdown toggle
  var inspireDropdown = document.getElementById('inspireDropdown');
  var inspireMenu = document.getElementById('inspireMenu');

  if (inspireDropdown && inspireMenu) {
    inspireDropdown.addEventListener('click', function(e) {
      e.stopPropagation();
      inspireMenu.classList.toggle('open');
    });

    // Close inspire menu when clicking outside
    document.addEventListener('click', function(e) {
      if (!inspireMenu.contains(e.target) && !inspireDropdown.contains(e.target)) {
        inspireMenu.classList.remove('open');
      }
    });

    // Handle inspire menu item selection
    var inspireMenuItems = document.querySelectorAll('.inspire-menu-item');
    var submenuItems = document.querySelectorAll('.inspire-submenu-item');

    function selectModel(modelId, modelName) {
      // Remove selected class from all main menu items
      inspireMenuItems.forEach(function(i) {
        i.classList.remove('selected');
        var checkEl = i.querySelector('.inspire-menu-check');
        if (checkEl) checkEl.innerHTML = '';
      });

      // Remove selected class from all submenu items
      submenuItems.forEach(function(i) {
        i.classList.remove('selected');
      });

      // Find and select the matching menu item if it exists in main menu
      var matchingItem = document.querySelector('.inspire-menu-item[data-model="' + modelId + '"]');
      if (matchingItem) {
        matchingItem.classList.add('selected');
        var checkEl = matchingItem.querySelector('.inspire-menu-check');
        if (checkEl) {
          checkEl.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
        }
      }

      // Find and select the matching submenu item if it exists
      var matchingSubmenuItem = document.querySelector('.inspire-submenu-item[data-model="' + modelId + '"]');
      if (matchingSubmenuItem) {
        matchingSubmenuItem.classList.add('selected');
      }

      // Update dropdown text
      var dropdownSpan = inspireDropdown.querySelector('span');
      if (dropdownSpan) {
        dropdownSpan.textContent = modelName;
      }

      // Save to cookie (30 days)
      setCookie('selectedInspireModel', modelId, 30);
      setCookie('selectedInspireModelName', modelName, 30);

      // Close menu
      inspireMenu.classList.remove('open');
    }

    inspireMenuItems.forEach(function(item) {
      item.addEventListener('click', function() {
        var modelId = this.getAttribute('data-model');
        var titleEl = this.querySelector('.inspire-menu-title');
        var modelName = titleEl ? titleEl.textContent : 'Inspire 8.0';
        selectModel(modelId, modelName);
      });
    });

    // Handle submenu item selection (More Models)
    submenuItems.forEach(function(item) {
      item.addEventListener('click', function(e) {
        e.stopPropagation();
        var modelId = this.getAttribute('data-model');
        var titleEl = this.querySelector('.inspire-submenu-title');
        var modelName = titleEl ? titleEl.textContent : 'Inspire';
        selectModel(modelId, modelName);
      });
    });

    // Load saved model from cookie on page load, or use default
    var savedModelId = getCookie('selectedInspireModel');
    var savedModelName = getCookie('selectedInspireModelName');

    // Default to Gospel Pulse if no saved model
    if (!savedModelId || !savedModelName) {
      savedModelId = 'gospelpulse';
      savedModelName = 'Inspire 8.0: Gospel Pulse';
    }

    // Clear default selection first
    inspireMenuItems.forEach(function(i) {
      i.classList.remove('selected');
      var checkEl = i.querySelector('.inspire-menu-check');
      if (checkEl) checkEl.innerHTML = '';
    });

    // Find and select the saved model in main menu
    var savedItem = document.querySelector('.inspire-menu-item[data-model="' + savedModelId + '"]');
    if (savedItem) {
      savedItem.classList.add('selected');
      var checkEl = savedItem.querySelector('.inspire-menu-check');
      if (checkEl) {
        checkEl.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
      }
    }

    // Find and select the saved model in submenu
    var savedSubmenuItem = document.querySelector('.inspire-submenu-item[data-model="' + savedModelId + '"]');
    if (savedSubmenuItem) {
      savedSubmenuItem.classList.add('selected');
    }

    var dropdownSpan = inspireDropdown.querySelector('span');
    if (dropdownSpan) {
      dropdownSpan.textContent = savedModelName;
    }
  }

  // Language panel
  var languageToggleBtn = document.getElementById('languageToggleBtn');
  var languagePanel = document.getElementById('languagePanel');
  var languagePanelClose = document.getElementById('languagePanelClose');
  var languagePanelOverlay = document.getElementById('languagePanelOverlay');
  var allLanguagesContainer = document.getElementById('allLanguages');
  var recentLanguagesContainer = document.getElementById('recentLanguages');

  var allLanguages = [
    { code: 'en', name: 'English (US)', flag: 'us' },
    { code: 'af', name: 'Afrikaans', flag: 'za' },
    { code: 'sq', name: 'Albanian', flag: 'al' },
    { code: 'am', name: 'Amharic', flag: 'et' },
    { code: 'ar', name: 'Arabic', flag: 'sa' },
    { code: 'hy', name: 'Armenian', flag: 'am' },
    { code: 'az', name: 'Azerbaijani', flag: 'az' },
    { code: 'eu', name: 'Basque', flag: 'es' },
    { code: 'be', name: 'Belarusian', flag: 'by' },
    { code: 'bn', name: 'Bengali', flag: 'bd' },
    { code: 'bs', name: 'Bosnian', flag: 'ba' },
    { code: 'bg', name: 'Bulgarian', flag: 'bg' },
    { code: 'ca', name: 'Catalan', flag: 'es' },
    { code: 'zh', name: 'Chinese (Mandarin)', flag: 'cn' },
    { code: 'zh-tw', name: 'Chinese (Traditional)', flag: 'tw' },
    { code: 'hr', name: 'Croatian', flag: 'hr' },
    { code: 'cs', name: 'Czech', flag: 'cz' },
    { code: 'da', name: 'Danish', flag: 'dk' },
    { code: 'nl', name: 'Dutch', flag: 'nl' },
    { code: 'et', name: 'Estonian', flag: 'ee' },
    { code: 'fo', name: 'Faroese', flag: 'fo' },
    { code: 'fi', name: 'Finnish', flag: 'fi' },
    { code: 'fr', name: 'French', flag: 'fr' },
    { code: 'gl', name: 'Galician', flag: 'es' },
    { code: 'ka', name: 'Georgian', flag: 'ge' },
    { code: 'de', name: 'German', flag: 'de' },
    { code: 'el', name: 'Greek', flag: 'gr' },
    { code: 'gu', name: 'Gujarati', flag: 'in' },
    { code: 'ha', name: 'Hausa', flag: 'ng' },
    { code: 'he', name: 'Hebrew', flag: 'il' },
    { code: 'hi', name: 'Hindi', flag: 'in' },
    { code: 'hu', name: 'Hungarian', flag: 'hu' },
    { code: 'is', name: 'Icelandic', flag: 'is' },
    { code: 'ig', name: 'Igbo', flag: 'ng' },
    { code: 'id', name: 'Indonesian', flag: 'id' },
    { code: 'ga', name: 'Irish', flag: 'ie' },
    { code: 'it', name: 'Italian', flag: 'it' },
    { code: 'ja', name: 'Japanese', flag: 'jp' },
    { code: 'kn', name: 'Kannada', flag: 'in' },
    { code: 'kk', name: 'Kazakh', flag: 'kz' },
    { code: 'ko', name: 'Korean', flag: 'kr' },
    { code: 'ky', name: 'Kyrgyz', flag: 'kg' },
    { code: 'lv', name: 'Latvian', flag: 'lv' },
    { code: 'lt', name: 'Lithuanian', flag: 'lt' },
    { code: 'mk', name: 'Macedonian', flag: 'mk' },
    { code: 'ms', name: 'Malay', flag: 'my' },
    { code: 'ml', name: 'Malayalam', flag: 'in' },
    { code: 'mt', name: 'Maltese', flag: 'mt' },
    { code: 'mr', name: 'Marathi', flag: 'in' },
    { code: 'mn', name: 'Mongolian', flag: 'mn' },
    { code: 'ne', name: 'Nepali', flag: 'np' },
    { code: 'no', name: 'Norwegian', flag: 'no' },
    { code: 'ps', name: 'Pashto', flag: 'af' },
    { code: 'fa', name: 'Persian', flag: 'ir' },
    { code: 'pl', name: 'Polish', flag: 'pl' },
    { code: 'pt', name: 'Portuguese', flag: 'pt' },
    { code: 'pt-br', name: 'Portuguese (Brazil)', flag: 'br' },
    { code: 'pa', name: 'Punjabi', flag: 'in' },
    { code: 'ro', name: 'Romanian', flag: 'ro' },
    { code: 'ru', name: 'Russian', flag: 'ru' },
    { code: 'sr', name: 'Serbian', flag: 'rs' },
    { code: 'sk', name: 'Slovak', flag: 'sk' },
    { code: 'sl', name: 'Slovenian', flag: 'si' },
    { code: 'so', name: 'Somali', flag: 'so' },
    { code: 'es', name: 'Spanish', flag: 'es' },
    { code: 'sw', name: 'Swahili', flag: 'ke' },
    { code: 'sv', name: 'Swedish', flag: 'se' },
    { code: 'tl', name: 'Tagalog (Filipino)', flag: 'ph' },
    { code: 'tg', name: 'Tajik', flag: 'tj' },
    { code: 'ta', name: 'Tamil', flag: 'in' },
    { code: 'te', name: 'Telugu', flag: 'in' },
    { code: 'th', name: 'Thai', flag: 'th' },
    { code: 'tr', name: 'Turkish', flag: 'tr' },
    { code: 'tk', name: 'Turkmen', flag: 'tm' },
    { code: 'uk', name: 'Ukrainian', flag: 'ua' },
    { code: 'ur', name: 'Urdu', flag: 'pk' },
    { code: 'uz', name: 'Uzbek', flag: 'uz' },
    { code: 'vi', name: 'Vietnamese', flag: 'vn' },
    { code: 'cy', name: 'Welsh', flag: 'gb' },
    { code: 'xh', name: 'Xhosa', flag: 'za' },
    { code: 'yo', name: 'Yoruba', flag: 'ng' },
    { code: 'zu', name: 'Zulu', flag: 'za' }
  ];

  function readSelectedLanguage() {
    try {
      var stored = localStorage.getItem(selectedLanguageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}
    return { code: 'en', name: 'English (US)', flag: 'us' };
  }

  function saveSelectedLanguage(lang) {
    try {
      localStorage.setItem(selectedLanguageKey, JSON.stringify(lang));
    } catch (e) {}
  }

  function getRecentLanguages() {
    try {
      var stored = localStorage.getItem(recentLanguagesKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}
    return [{ code: 'en', name: 'English (US)', flag: 'us' }];
  }

  function saveRecentLanguages(langs) {
    try {
      localStorage.setItem(recentLanguagesKey, JSON.stringify(langs));
    } catch (e) {}
  }

  function updateLanguageIcon(lang) {
    var flagImg = document.getElementById('currentLanguageFlag');
    if (flagImg) {
      flagImg.src = 'https://flagcdn.com/w40/' + lang.flag + '.png';
      flagImg.alt = lang.name;
    }
    if (languageToggleBtn) {
      languageToggleBtn.title = lang.name;
    }
  }

  function createLanguageItem(lang, isSelected) {
    var item = document.createElement('div');
    item.className = 'language-item' + (isSelected ? ' selected' : '');
    item.setAttribute('data-lang', lang.code);
    item.innerHTML = '<img src="https://flagcdn.com/w40/' + lang.flag + '.png" alt="' + lang.name + '" class="language-flag">' +
      '<span class="language-name">' + lang.name + '</span>';
    return item;
  }

  function renderLanguages() {
    if (!allLanguagesContainer || !recentLanguagesContainer) return;

    recentLanguagesContainer.innerHTML = '';
    var recentLangs = getRecentLanguages();
    recentLangs.forEach(function(lang) {
      var isSelected = selectedLanguage && lang.code === selectedLanguage.code;
      var item = createLanguageItem(lang, isSelected);
      item.addEventListener('click', function() {
        selectLanguage(lang);
      });
      recentLanguagesContainer.appendChild(item);
    });

    allLanguagesContainer.innerHTML = '';
    allLanguages.forEach(function(lang) {
      var isSelected = selectedLanguage && lang.code === selectedLanguage.code;
      var item = createLanguageItem(lang, isSelected);
      item.addEventListener('click', function() {
        selectLanguage(lang);
      });
      allLanguagesContainer.appendChild(item);
    });
  }

  function selectLanguage(lang) {
    selectedLanguage = {
      code: lang.code,
      name: lang.name,
      flag: lang.flag
    };
    saveSelectedLanguage(selectedLanguage);

    var recentLangs = getRecentLanguages();
    var exists = recentLangs.some(function(item) { return item.code === lang.code; });
    if (!exists) {
      recentLangs.unshift(lang);
      recentLangs = recentLangs.slice(0, 6);
      saveRecentLanguages(recentLangs);
    }

    updateLanguageIcon(selectedLanguage);
    renderLanguages();
    closeLanguagePanel();

    // Update search placeholder for the selected language
    updateSearchPlaceholder();
  }

  // Fetch translated placeholder from API
  function updateSearchPlaceholder() {
    if (!searchInputEl) return;

    var personaSlug = getSelectedPersonaSlug();
    var langCode = selectedLanguage ? selectedLanguage.code : 'en';

    // For English, use local placeholder immediately
    if (langCode === 'en') {
      var personaName = personaSlug.charAt(0).toUpperCase() + personaSlug.slice(1);
      searchInputEl.placeholder = 'Ask ' + personaName + ' Anything...';
      return;
    }

    // Fetch translated placeholder from server
    fetch('/translation/placeholder?persona=' + encodeURIComponent(personaSlug) + '&language=' + encodeURIComponent(langCode), {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    })
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      if (data.success && data.placeholder) {
        searchInputEl.placeholder = data.placeholder;
      }
    })
    .catch(function(error) {
      console.error('Failed to fetch translated placeholder:', error);
      // Fallback to English placeholder
      var personaName = personaSlug.charAt(0).toUpperCase() + personaSlug.slice(1);
      searchInputEl.placeholder = 'Ask ' + personaName + ' Anything...';
    });
  }

  function openLanguagePanel() {
    if (!languagePanel) return;
    // Close persona panel but keep both icons active
    if (personaPanel && personaPanel.classList.contains('open')) {
      personaPanel.classList.remove('open');
      // Restore sidebar color when persona panel closes
      if (sidebar) {
        sidebar.style.backgroundColor = '#000';
      }
    }
    languagePanel.classList.add('open');
    languagePanel.setAttribute('aria-hidden', 'false');
    if (languagePanelOverlay) {
      languagePanelOverlay.classList.add('open');
    }
    renderLanguages();
  }

  function closeLanguagePanel() {
    if (!languagePanel) return;
    languagePanel.classList.remove('open');
    languagePanel.setAttribute('aria-hidden', 'true');
    if (languagePanelOverlay) {
      languagePanelOverlay.classList.remove('open');
    }
  }

  function toggleLanguagePanel() {
    if (!languagePanel) return;
    if (languagePanel.classList.contains('open')) {
      closeLanguagePanel();
    } else {
      openLanguagePanel();
    }
  }

  if (languageToggleBtn && languagePanel) {
    selectedLanguage = readSelectedLanguage();
    updateLanguageIcon(selectedLanguage);
    renderLanguages();

    languageToggleBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleLanguagePanel();
    });
  }

  if (languagePanelClose) {
    languagePanelClose.addEventListener('click', function(e) {
      e.stopPropagation();
      closeLanguagePanel();
    });
  }

  if (languagePanelOverlay) {
    languagePanelOverlay.addEventListener('click', function() {
      closeLanguagePanel();
    });
  }

  document.addEventListener('click', function(e) {
    if (!languagePanel || !languagePanel.classList.contains('open')) return;
    if (!languagePanel.contains(e.target) && e.target !== languageToggleBtn && !languageToggleBtn.contains(e.target)) {
      closeLanguagePanel();
    }
  });

  // Persona panel toggle
  var personaToggleBtn = document.getElementById('personaToggleBtn');
  var personaPanel = document.getElementById('personaPanel');
  var personaPanelClose = document.getElementById('personaPanelClose');
  var personaPanelItems = document.querySelectorAll('.persona-panel-item[data-persona]');
  var activePersonaAvatar = document.getElementById('activePersonaAvatar');

  function normalizePersonaSlug(slug) {
    if (!slug) return null;
    var normalized = slug.toLowerCase();
    for (var i = 0; i < personaPanelItems.length; i++) {
      if (personaPanelItems[i].getAttribute('data-persona') === normalized) {
        return normalized;
      }
    }
    return null;
  }

  function getPersonaName(slug) {
    for (var i = 0; i < personaPanelItems.length; i++) {
      var item = personaPanelItems[i];
      if (item.getAttribute('data-persona') === slug) {
        var nameEl = item.querySelector('.persona-panel-name');
        if (nameEl) {
          return nameEl.textContent.trim();
        }
      }
    }
    return slug.charAt(0).toUpperCase() + slug.slice(1) + ' Inspire';
  }

  // Track if user is authenticated
  var isUserAuthenticated = false;

  function setPersonaSelection(slug, saveToServer) {
    var normalized = normalizePersonaSlug(slug) || 'jubilee';
    selectedPersonaSlug = normalized;

    personaPanelItems.forEach(function(item) {
      var isSelected = item.getAttribute('data-persona') === normalized;
      item.classList.toggle('selected', isSelected);
    });

    var personaName = getPersonaName(normalized);
    if (activePersonaAvatar) {
      activePersonaAvatar.src = '/images/personas/' + normalized + '.png';
      activePersonaAvatar.alt = personaName;
    }

    // Update search input placeholder based on selected persona and language
    updateSearchPlaceholder();

    // Always save to cookie for fallback
    setCookie(personaCookieName, normalized, 30);
    try {
      localStorage.setItem('jv_selected_personas', JSON.stringify([normalized]));
    } catch (e) {}

    // Save to database if user is authenticated and saveToServer is true
    if (saveToServer && isUserAuthenticated) {
      saveDefaultPersonaToServer(normalized);
    }
  }

  // Save default persona to server (PostgreSQL)
  function saveDefaultPersonaToServer(personaSlug) {
    fetch('/api/user/default-persona', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ personaSlug: personaSlug })
    })
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      if (data.success) {
        console.log('Default persona saved:', data.defaultPersona);
      }
    })
    .catch(function(error) {
      console.error('Failed to save default persona:', error);
    });
  }

  if (personaToggleBtn && personaPanel) {
    function openPersonaPanel() {
      personaPanel.classList.add('open');
      if (languagePanel && languagePanel.classList.contains('open')) {
        closeLanguagePanel();
      }
      // Turn sidebar solid yellow when persona panel is expanded
      if (sidebar) {
        sidebar.style.backgroundColor = '#ffbd59';
      }
    }

    function closePersonaPanel() {
      personaPanel.classList.remove('open');
      // Return sidebar to default gray/black when panel collapses
      if (sidebar) {
        sidebar.style.backgroundColor = '#000';
      }
    }

    function togglePersonaPanel() {
      if (personaPanel.classList.contains('open')) {
        closePersonaPanel();
      } else {
        openPersonaPanel();
      }
    }

    personaToggleBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      togglePersonaPanel();
    });

    if (personaPanelClose) {
      personaPanelClose.addEventListener('click', function(e) {
        e.stopPropagation();
        closePersonaPanel();
      });
    }

    document.addEventListener('click', function(e) {
      if (personaPanel.classList.contains('open') &&
          !personaPanel.contains(e.target) &&
          e.target !== personaToggleBtn &&
          !personaToggleBtn.contains(e.target)) {
        closePersonaPanel();
      }
    });
  }

  if (personaPanelItems.length) {
    // Initial selection from cookie (will be updated from server if logged in)
    var initialPersona = normalizePersonaSlug(getCookie(personaCookieName)) || 'jubilee';
    setPersonaSelection(initialPersona, false); // Don't save to server on initial load

    personaPanelItems.forEach(function(item) {
      item.addEventListener('click', function() {
        var slug = item.getAttribute('data-persona');
        setPersonaSelection(slug, true); // Save to server when user explicitly selects
        if (personaPanel && personaPanel.classList.contains('open')) {
          personaPanel.classList.remove('open');
        }
      });
    });
  }

  // PIN Modal functionality
  var lockIcon = document.querySelector('.action-icon[title="Privacy Mode"]');
  var pinModalOverlay = document.getElementById('pinModalOverlay');
  var pinInputs = document.querySelectorAll('.pin-input');
  var pinModalTitle = document.getElementById('pinModalTitle');
  var pinModalText = document.getElementById('pinModalText');
  var isLocking = true;

  if (lockIcon && pinModalOverlay) {
    // Open PIN modal when lock icon is clicked
    lockIcon.addEventListener('click', function() {
      // Determine if we're locking or unlocking
      if (this.classList.contains('unlocked')) {
        isLocking = false;
        if (pinModalTitle) pinModalTitle.textContent = 'Unlock Private Chat';
        if (pinModalText) pinModalText.textContent = 'Please enter your four digit pin to unlock and exit private chat mode.';
      } else {
        isLocking = true;
        if (pinModalTitle) pinModalTitle.textContent = 'Private Chat';
        if (pinModalText) pinModalText.textContent = 'Please enter a four digit pin to encrypt your conversation for privacy.';
      }

      // Show modal
      this.classList.add('active');
      pinModalOverlay.classList.add('open');

      // Clear all inputs and focus first one
      pinInputs.forEach(function(input) {
        input.value = '';
      });
      setTimeout(function() {
        if (pinInputs[0]) pinInputs[0].focus();
      }, 100);
    });

    // Close modal when clicking overlay (outside modal)
    pinModalOverlay.addEventListener('click', function(e) {
      if (e.target === pinModalOverlay) {
        pinModalOverlay.classList.remove('open');
        lockIcon.classList.remove('active');
      }
    });

    // Handle PIN input
    pinInputs.forEach(function(input, index) {
      // Only allow numbers
      input.addEventListener('input', function() {
        // Remove non-numeric characters
        this.value = this.value.replace(/[^0-9]/g, '');

        if (this.value.length === 1) {
          // Move to next input
          if (index < pinInputs.length - 1) {
            pinInputs[index + 1].focus();
          } else {
            // Last input filled - check if all are filled
            var allFilled = true;
            pinInputs.forEach(function(inp) {
              if (inp.value.length !== 1) allFilled = false;
            });

            if (allFilled) {
              // Get the full PIN
              var pin = '';
              pinInputs.forEach(function(inp) {
                pin += inp.value;
              });

              // Close modal and toggle lock state
              pinModalOverlay.classList.remove('open');
              lockIcon.classList.remove('active');

              if (isLocking) {
                lockIcon.classList.add('unlocked');
              } else {
                lockIcon.classList.remove('unlocked');
              }

              // Store PIN in session storage
              if (isLocking) {
                sessionStorage.setItem('privateChatPin', pin);
              } else {
                sessionStorage.removeItem('privateChatPin');
              }
            }
          }
        }
      });

      // Handle backspace to go to previous input
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && this.value === '' && index > 0) {
          pinInputs[index - 1].focus();
        }
      });

      // Select all text on focus
      input.addEventListener('focus', function() {
        this.select();
      });
    });
  }

  // Attach file icon - navigate to chat page when clicked (files can be attached there)
  var attachFileIcon = document.querySelector('.action-icon[title="Attach File"]');
  if (attachFileIcon && searchInputEl) {
    attachFileIcon.style.cursor = 'pointer';
    attachFileIcon.addEventListener('click', function() {
      // Navigate to chat page where files can be attached
      var searchText = searchInputEl.value.trim();
      var params = new URLSearchParams();

      if (searchText) {
        params.set('q', searchText);
        // Add timestamp to ensure each submission creates a new message
        params.set('t', Date.now().toString());
      }

      var personaSlug = getSelectedPersonaSlug();
      if (personaSlug) {
        params.set('persona', personaSlug);
      }

      var languageState = getSelectedLanguageState();
      if (languageState && languageState.code) {
        params.set('lang', languageState.code);
      }

      var modelId = getCookie('selectedInspireModel');
      if (modelId) {
        params.set('model', modelId);
      }

      var lockIconEl = document.querySelector('.action-icon[title="Privacy Mode"]');
      if (lockIconEl && lockIconEl.classList.contains('unlocked')) {
        params.set('private', '1');
      }

      // Flag to trigger file attachment on chat page
      params.set('attach', '1');

      window.location.href = '/chat?' + params.toString();
    });
  }

  // Check authentication status and update auth button
  function checkAuthStatus() {
    var authBtn = document.getElementById('authBtn');
    var authBtnText = document.getElementById('authBtnText');
    if (!authBtn || !authBtnText) return;

    fetch('/auth/me', {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    })
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      if (data.success && data.user) {
        // Mark user as authenticated
        isUserAuthenticated = true;

        // User is authenticated - show Sign Out
        authBtnText.textContent = 'Sign Out';
        authBtn.href = '#';
        authBtn.onclick = function(e) {
          e.preventDefault();
          fetch('/auth/logout', {
            method: 'POST',
            headers: { 'Accept': 'application/json' }
          })
          .then(function() {
            isUserAuthenticated = false;
            window.location.reload();
          });
        };
        // Update sidebar avatar if user has avatar
        if (data.user.avatar) {
          var sidebarAvatar = document.querySelector('.sidebar-avatar img');
          if (sidebarAvatar) {
            sidebarAvatar.src = data.user.avatar;
          }
        }

        // Load user's default persona from server
        loadDefaultPersonaFromServer();
      }
    })
    .catch(function() {
      // Keep default "Sign In" state
      isUserAuthenticated = false;
    });
  }

  // Load user's default persona from server (PostgreSQL)
  function loadDefaultPersonaFromServer() {
    fetch('/api/user/default-persona', {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    })
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      if (data.success && data.defaultPersona && data.defaultPersona.slug) {
        // Update UI with server-stored default persona
        var serverPersona = data.defaultPersona.slug;
        if (normalizePersonaSlug(serverPersona)) {
          setPersonaSelection(serverPersona, false); // Don't re-save to server
          // Also update the cookie to stay in sync
          setCookie(personaCookieName, serverPersona, 30);
          console.log('Loaded default persona from server:', serverPersona);
        }
      }
    })
    .catch(function(error) {
      console.error('Failed to load default persona from server:', error);
    });
  }

  // Check auth status on load
  checkAuthStatus();

})();
