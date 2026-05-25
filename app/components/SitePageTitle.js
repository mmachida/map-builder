"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SITE_NAME = "Map Builder";

const PAGE_TITLES = [
  { match: (path) => path === "/", title: "Home" },
  { match: (path) => path === "/dashboard", title: "My Maps" },
  { match: (path) => path === "/library", title: "Library" },
  { match: (path) => path === "/faq", title: "F.A.Q" },
  { match: (path) => path === "/contact", title: "Contact" },
  { match: (path) => path === "/support", title: "Support" },
  { match: (path) => path === "/settings", title: "Settings" },
  { match: (path) => path === "/terms-of-service", title: "Terms of Service" },
  { match: (path) => path.startsWith("/dashboard/"), title: "My Maps" },
  { match: (path) => path.startsWith("/group/"), title: "Map Group" },
  { match: (path) => path.startsWith("/editor/"), title: "Map Editor" },
  { match: (path) => path.startsWith("/map/"), title: "Interactive Map" },
];

function getPageTitle(pathname) {
  const page = PAGE_TITLES.find((item) => item.match(pathname));
  return page?.title || "Home";
}

export default function SitePageTitle() {
  const pathname = usePathname();

  useEffect(() => {
    document.title = `${getPageTitle(pathname)} - ${SITE_NAME}`;
  }, [pathname]);

  return null;
}
