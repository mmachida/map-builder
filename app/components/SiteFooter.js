import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="siteFooter">
      <span>Map Builder - All rights reserved, 2026.</span>
      <Link href="/terms-of-service">Terms of Service</Link>
    </footer>
  );
}
