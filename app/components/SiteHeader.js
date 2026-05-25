"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AccountMenu from "./AccountMenu";
import SiteLanguageSelect from "./SiteLanguageSelect";

const SITE_NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "My Maps" },
  { href: "/library", label: "Library" },
  { href: "/faq", label: "F.A.Q" },
  { href: "/contact", label: "Contact" },
  { href: "/support", label: "Supporter", support: true },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="siteHeader">
      <div className="siteHeaderLeft">
        <Link className="siteBrand" href="/">
          <img
            className="siteBrandLogo"
            src="/api/site-icons/site_logo"
            alt=""
            aria-hidden="true"
          />
          <span>Map Builder</span>
        </Link>

        <nav className="siteNav" aria-label="Site navigation">
          {SITE_NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                className={[
                  active ? "active" : "",
                  item.support ? "siteSupportLink" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                href={item.href}
              >
                {item.support && (
                  <span className="siteSupportIcon" aria-hidden="true">
                    {"\u2764"}
                  </span>
                )}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="siteHeaderActions">
        <SiteLanguageSelect />
        <AccountMenu />
      </div>
    </header>
  );
}

