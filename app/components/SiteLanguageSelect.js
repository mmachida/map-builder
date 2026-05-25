"use client";

import MapLanguageSelect from "./map/MapLanguageSelect";
import useMapLocale from "./map/useMapLocale";

export default function SiteLanguageSelect() {
  const { locale, setLocale } = useMapLocale();

  return (
    <div className="siteLanguageControl">
      <MapLanguageSelect locale={locale} onLocaleChange={setLocale} />
    </div>
  );
}
