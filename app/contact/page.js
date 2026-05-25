import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import Link from "next/link";
import "../page.css";

export default function ContactPage() {
  return (
    <main className="dashboardPage siteMain">
      <SiteHeader />

      <section className="dashboardCard sitePageCard">
        <h1>Contact</h1>
        <p>
          Send feedback, report issues or talk about features for your game map
          project.
        </p>
        <div className="siteContactList">
          <span>Email: contact@mapbuilder.local</span>
          <span>Discord server: coming soon</span>
          <span>Creator updates: coming soon</span>
          <span>
            Terms: <Link href="/terms-of-service">Terms of Service</Link>
          </span>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
