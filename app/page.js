import Link from "next/link";
import SiteFooter from "./components/SiteFooter";
import SiteHeader from "./components/SiteHeader";
import "./page.css";

export default function HomePage() {
  return (
    <main className="dashboardPage siteMain">
      <SiteHeader />

      <section className="dashboardCard siteHero">
        <div className="siteHeroCopy">
          <h1>Mark every boss, shortcut, loot route and secret.</h1>
          <p>
            Build public maps for existing games, upcoming releases, mods and
            private projects. Drop pins, draw routes, connect zones and publish a
            clean guide players can actually use.
          </p>
          <div className="siteHeroActions">
            <Link href="/dashboard">Start Mapping</Link>
            <Link href="/library">Explore Library</Link>
          </div>
        </div>

        <div className="siteMapPreview" aria-hidden="true">
          <div className="siteMapPreviewTop">
            <span>Stormhold Depths</span>
            <strong>LIVE MAP</strong>
          </div>
          <div className="siteMapSurface">
            <span className="siteRouteLine routeA" />
            <span className="siteRouteLine routeB" />
            <span className="sitePreviewPin pinA">★</span>
            <span className="sitePreviewPin pinB">◆</span>
            <span className="sitePreviewPin pinC">!</span>
            <span className="sitePreviewPortal">◎</span>
          </div>
          <div className="siteMapPreviewBottom">
            <span>14 pins</span>
            <span>5 routes</span>
            <span>3 linked maps</span>
          </div>
        </div>
      </section>

      <section className="dashboardCard siteFeatureGrid">
        <article>
          <span className="siteFeatureCode">01</span>
          <h2>Pins Built For Guides</h2>
          <p>Separate bosses, keys, upgrades, NPCs and secrets with icons, colors and groups.</p>
        </article>
        <article>
          <span className="siteFeatureCode">02</span>
          <h2>Routes For Runs</h2>
          <p>Draw route paths, reorder steps and export text or LiveSplit segments.</p>
        </article>
        <article>
          <span className="siteFeatureCode">03</span>
          <h2>Public Player View</h2>
          <p>Share a clean read-only map while the editor tools stay private.</p>
        </article>
        <article>
          <span className="siteFeatureCode">04</span>
          <h2>Connected Areas</h2>
          <p>Use portal pins to jump between floors, regions, dungeons or planets.</p>
        </article>
      </section>

      <section className="dashboardCard siteUseCaseStrip">
        <span>Soulslike checklists</span>
        <span>Speedrun routes</span>
        <span>MMO resource maps</span>
        <span>Metroidvania zones</span>
        <span>Modded worlds</span>
      </section>

      <SiteFooter />
    </main>
  );
}
