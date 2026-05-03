"use client";

import { MAP_LANGUAGES } from "@/lib/mapI18n";

export default function MapLanguageSelect({ locale, onLocaleChange }) {
  return (
    <label className="mapLanguageSelect" title="Language">
      <span className="srOnly">Language</span>
      <select
        value={locale}
        aria-label="Language"
        onChange={(event) => onLocaleChange(event.target.value)}
      >
        {MAP_LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {language.flag}
          </option>
        ))}
      </select>
    </label>
  );
}
