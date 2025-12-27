import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' }
  ];

  const currentLang = languages.find(lang => lang.code === i18n.language) || languages[0];

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const changeLanguage = (langCode) => {
    i18n.changeLanguage(langCode);
    setIsOpen(false);
    // Language sẽ tự động lưu vào localStorage nhờ LanguageDetector
  };

  return (
    <div className="position-relative" ref={dropdownRef}>
      <div
        className="d-flex align-items-center gap-2"
        style={{
          color: '#555555',
          opacity: 0.9,
          cursor: 'pointer',
          userSelect: 'none'
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{currentLang.flag}</span>
        <span>{currentLang.name}</span>
        <i className="fa fa-chevron-down" style={{ fontSize: '10px' }}></i>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            background: 'white',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000,
            minWidth: '150px',
            overflow: 'hidden'
          }}
        >
          {languages.map((lang) => (
            <div
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              style={{
                padding: '10px 16px',
                cursor: 'pointer',
                background: i18n.language === lang.code ? '#f5f5f5' : 'white',
                borderBottom: lang.code !== languages[languages.length - 1].code ? '1px solid #f0f0f0' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => {
                if (i18n.language !== lang.code) {
                  e.currentTarget.style.background = '#f8f8f8';
                }
              }}
              onMouseLeave={(e) => {
                if (i18n.language !== lang.code) {
                  e.currentTarget.style.background = 'white';
                }
              }}
            >
              <span>{lang.flag}</span>
              <span style={{
                color: i18n.language === lang.code ? '#ee4d2d' : '#222',
                fontWeight: i18n.language === lang.code ? 600 : 400
              }}>
                {lang.name}
              </span>
              {i18n.language === lang.code && (
                <i className="fa fa-check" style={{ marginLeft: 'auto', color: '#ee4d2d' }}></i>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

