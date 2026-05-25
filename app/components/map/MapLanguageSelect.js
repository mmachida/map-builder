"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MAP_LANGUAGES } from "@/lib/mapI18n";

export default function MapLanguageSelect({ locale, onLocaleChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const [isMounted, setIsMounted] = useState(false);
  const selectRef = useRef(null);
  const menuRef = useRef(null);
  const selectedLanguage =
    MAP_LANGUAGES.find((language) => language.code === locale) ||
    MAP_LANGUAGES[0];

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    function updateMenuPosition() {
      if (!selectRef.current || !isOpen) {
        return;
      }

      const rect = selectRef.current.getBoundingClientRect();

      setMenuPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    function handlePointerDown(event) {
      const clickedSelect = selectRef.current?.contains(event.target);
      const clickedMenu = menuRef.current?.contains(event.target);

      if (!clickedSelect && !clickedMenu) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function handleLanguageChange(languageCode) {
    onLocaleChange(languageCode);
    setIsOpen(false);
  }

  const languageMenu =
    isOpen && menuPosition ? (
      <div
        className="mapLanguageMenu"
        ref={menuRef}
        role="listbox"
        style={{
          top: `${menuPosition.top}px`,
          right: `${menuPosition.right}px`,
        }}
      >
        {MAP_LANGUAGES.map((language) => (
          <button
            key={language.code}
            type="button"
            className={`mapLanguageOption${
              language.code === locale ? " active" : ""
            }`}
            role="option"
            aria-selected={language.code === locale}
            title={language.label}
            onClick={() => handleLanguageChange(language.code)}
          >
            <img src={language.flag} alt={language.label} />
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div className="mapLanguageSelect" ref={selectRef} title="Language">
      <span className="srOnly">Language</span>
      <button
        type="button"
        className="mapLanguageButton"
        aria-label="Language"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <img src={selectedLanguage.flag} alt={selectedLanguage.label} />
      </button>
      {isMounted ? createPortal(languageMenu, document.body) : null}
    </div>
  );
}
