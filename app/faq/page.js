import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import "../page.css";

const FAQ_ITEMS = [
  {
    question: "What is Map Builder for?",
    answer:
      "Map Builder is made for interactive game maps. You can upload a game map, place pins, organize categories, draw routes, add notes and publish a public version for players.",
  },
  {
    question: "Can I create maps for existing games?",
    answer:
      "Yes. You can create maps for existing games, fan projects or games you are building, as long as the content follows the Terms of Service.",
  },
  {
    question: "How do public maps work?",
    answer:
      "A public map is read-only. Visitors can view pins, routes, notes, chains and portals, but they cannot edit or delete your content.",
  },
  {
    question: "What is the difference between Public, Not Listed and Private?",
    answer:
      "Public maps can appear in the Library. Not Listed maps can be viewed by people with the link. Private maps are only available to the owner; collaborators can only edit after the owner changes the map to Public or Not Listed.",
  },
  {
    question: "Can I organize pins by category?",
    answer:
      "Yes. Pins are organized through groups and categories. Each category can have its own icon and color, making large maps easier to scan.",
  },
  {
    question: "Can I add routes?",
    answer:
      "Yes. Routes can be drawn on the map, reordered in the route sidebar and exported as .txt or LiveSplit files.",
  },
  {
    question: "Can routes and pins be placed outside the map image?",
    answer:
      "Yes. The editor supports an interactive area around the map, useful for extra context, notes and planning space.",
  },
  {
    question: "What are notes?",
    answer:
      "Notes are text boxes that can be placed on the map workspace. They are useful for explanations, warnings, instructions or larger descriptions.",
  },
  {
    question: "What are chains?",
    answer:
      "Chains let you show requirements for a pin, such as needing a key, item or another specific pin before reaching the selected location.",
  },
  {
    question: "What are portals?",
    answer:
      "Portal pins can connect one map to another map in the same group, making it possible to move between floors, regions, dungeons or zones without opening a new browser page.",
  },
  {
    question: "Can other people help edit my maps?",
    answer:
      "Yes. You can add editors and give them different permissions, such as full access, pin editing or route editing. Editors can only access the editor when the map visibility is Public or Not Listed.",
  },
  {
    question: "Can I upload custom icons?",
    answer:
      "Yes. Custom icons can be uploaded once and linked to the groups where you want to use them.",
  },
  {
    question: "Are there limits for free accounts?",
    answer:
      "Yes. Free accounts currently have limits for created maps and custom icons. Supporter upgrades are planned to increase those limits.",
  },
  {
    question: "Can I search for maps in the Library?",
    answer:
      "Yes. The Library lists public maps and can search by map title or tags.",
  },
  {
    question: "What content is not allowed?",
    answer:
      "Content that is abusive, offensive, pornographic or otherwise violates the Terms of Service may be removed, and accounts may be banned without prior notice.",
  },
];

export default function FaqPage() {
  return (
    <main className="dashboardPage siteMain">
      <SiteHeader />

      <section className="dashboardCard sitePageCard">
        <h1>F.A.Q</h1>
        <p>Quick answers for creators building maps, guides and route sheets.</p>
      </section>

      <section className="dashboardCard siteFaqCard">
        <div className="siteFaqList">
          {FAQ_ITEMS.map((item) => (
            <article key={item.question}>
              <h2>{item.question}</h2>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
