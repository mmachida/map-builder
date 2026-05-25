import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import "../page.css";

export default function TermsOfServicePage() {
  return (
    <main className="dashboardPage siteMain">
      <SiteHeader />

      <section className="dashboardCard sitePageCard termsPageCard">
        <h1>Terms of Service</h1>
        <p>
          By creating or uploading maps, icons, notes, routes or any other
          content, you agree to follow these terms.
        </p>

        <div className="termsSectionList">
          <section>
            <h2>Content Rules</h2>
            <p>
              It is prohibited to create, upload or share content that is
              abusive, hateful, threatening, harassing, offensive, pornographic,
              exploitative, illegal, misleading or otherwise harmful. These
              rules also apply to the username you create for your account.
            </p>
          </section>

          <section>
            <h2>Moderator Discretion</h2>
            <p>
              Content moderation is handled at the discretion of the moderators.
              If a moderator determines that content violates the spirit or
              purpose of these rules, it may be removed.
            </p>
          </section>

          <section>
            <h2>Account Action</h2>
            <p>
              Accounts that violate these terms may be restricted, suspended or
              banned without prior notice. Uploaded content may also be removed
              without prior notice.
            </p>
          </section>

          <section>
            <h2>User Responsibility</h2>
            <p>
              You are responsible for the content you create, upload and share.
              Do not upload content that breaks the rules described in these
              terms.
            </p>
          </section>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
