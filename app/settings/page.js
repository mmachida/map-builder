"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import { FREE_ACCOUNT_LIMITS } from "@/lib/accountLimits";
import "../page.css";

const PROFILE_TITLE_MAX_LENGTH = 60;
const PROFILE_BIO_MAX_LENGTH = 500;
const SOCIAL_LINK_LIMIT = 5;

const COUNTRIES = [
  "Afeganistão",
  "África do Sul",
  "Albânia",
  "Alemanha",
  "Andorra",
  "Angola",
  "Antígua e Barbuda",
  "Arábia Saudita",
  "Argélia",
  "Argentina",
  "Armênia",
  "Austrália",
  "Áustria",
  "Azerbaijão",
  "Bahamas",
  "Bahrein",
  "Bangladesh",
  "Barbados",
  "Bélgica",
  "Belize",
  "Benin",
  "Bielorrússia",
  "Bolívia",
  "Bósnia e Herzegovina",
  "Botsuana",
  "Brasil",
  "Brunei",
  "Bulgária",
  "Burkina Faso",
  "Burundi",
  "Butão",
  "Cabo Verde",
  "Camarões",
  "Camboja",
  "Canadá",
  "Catar",
  "Cazaquistão",
  "Chade",
  "Chile",
  "China",
  "Chipre",
  "Colômbia",
  "Comores",
  "Congo",
  "Coreia do Norte",
  "Coreia do Sul",
  "Costa do Marfim",
  "Costa Rica",
  "Croácia",
  "Cuba",
  "Dinamarca",
  "Djibuti",
  "Dominica",
  "Egito",
  "El Salvador",
  "Emirados Árabes Unidos",
  "Equador",
  "Eritreia",
  "Eslováquia",
  "Eslovênia",
  "Espanha",
  "Estados Unidos",
  "Estônia",
  "Eswatini",
  "Etiópia",
  "Fiji",
  "Filipinas",
  "Finlândia",
  "França",
  "Gabão",
  "Gâmbia",
  "Gana",
  "Geórgia",
  "Granada",
  "Grécia",
  "Guatemala",
  "Guiana",
  "Guiné",
  "Guiné Equatorial",
  "Guiné-Bissau",
  "Haiti",
  "Honduras",
  "Hungria",
  "Iêmen",
  "Ilhas Marshall",
  "Ilhas Salomão",
  "Índia",
  "Indonésia",
  "Irã",
  "Iraque",
  "Irlanda",
  "Islândia",
  "Israel",
  "Itália",
  "Jamaica",
  "Japão",
  "Jordânia",
  "Kiribati",
  "Kuwait",
  "Laos",
  "Lesoto",
  "Letônia",
  "Líbano",
  "Libéria",
  "Líbia",
  "Liechtenstein",
  "Lituânia",
  "Luxemburgo",
  "Macedônia do Norte",
  "Madagascar",
  "Malásia",
  "Malawi",
  "Maldivas",
  "Mali",
  "Malta",
  "Marrocos",
  "Maurício",
  "Mauritânia",
  "México",
  "Micronésia",
  "Moçambique",
  "Moldávia",
  "Mônaco",
  "Mongólia",
  "Montenegro",
  "Myanmar",
  "Namíbia",
  "Nauru",
  "Nepal",
  "Nicarágua",
  "Níger",
  "Nigéria",
  "Noruega",
  "Nova Zelândia",
  "Omã",
  "Países Baixos",
  "Palau",
  "Panamá",
  "Papua-Nova Guiné",
  "Paquistão",
  "Paraguai",
  "Peru",
  "Polônia",
  "Portugal",
  "Quênia",
  "Quirguistão",
  "Reino Unido",
  "República Centro-Africana",
  "República Democrática do Congo",
  "República Dominicana",
  "República Tcheca",
  "Romênia",
  "Ruanda",
  "Rússia",
  "Samoa",
  "San Marino",
  "Santa Lúcia",
  "São Cristóvão e Névis",
  "São Tomé e Príncipe",
  "São Vicente e Granadinas",
  "Seicheles",
  "Senegal",
  "Serra Leoa",
  "Sérvia",
  "Singapura",
  "Síria",
  "Somália",
  "Sri Lanka",
  "Sudão",
  "Sudão do Sul",
  "Suécia",
  "Suíça",
  "Suriname",
  "Tailândia",
  "Taiwan",
  "Tajiquistão",
  "Tanzânia",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad e Tobago",
  "Tunísia",
  "Turcomenistão",
  "Turquia",
  "Tuvalu",
  "Ucrânia",
  "Uganda",
  "Uruguai",
  "Uzbequistão",
  "Vanuatu",
  "Vaticano",
  "Venezuela",
  "Vietnã",
  "Zâmbia",
  "Zimbábue",
];

const SETTINGS_SECTIONS = [
  {
    title: "Configurações",
    items: [
      { id: "profile", label: "Perfil" },
      { id: "customization", label: "Customização" },
      { id: "favorites", label: "Favoritos" },
      { id: "account", label: "Conta" },
    ],
  },
  {
    title: "Supporter",
    items: [
      { id: "supporter-status", label: "Status" },
      { id: "purchase-history", label: "Histórico de compras" },
    ],
  },
];

const SETTINGS_CONTENT = {
  account: {
    title: "Conta",
    description: "Configurações gerais da sua conta e login.",
  },
  favorites: {
    title: "Favoritos",
    description: "Mapas salvos como favoritos aparecerão aqui.",
  },
  "supporter-status": {
    title: "Status Supporter",
    description: "Veja os benefícios ativos da sua conta Supporter.",
  },
  "purchase-history": {
    title: "Histórico de compras",
    description: "Suas compras e upgrades aparecerão nesta área.",
  },
};

function createEmptySocialLink() {
  return { title: "", url: "" };
}

function createEmptyProfile() {
  return {
    profileTitle: "",
    profileBio: "",
    userColor: "#f5d18a",
    userGlow: false,
    userCardColor: "#b98b4a",
    country: "",
    socialLinks: [createEmptySocialLink()],
  };
}

function normalizeProfile(profile) {
  const socialLinks = Array.isArray(profile?.socialLinks)
    ? profile.socialLinks
    : [];

  return {
    profileTitle: profile?.profileTitle || "",
    profileBio: profile?.profileBio || "",
    userColor: profile?.userColor || "#f5d18a",
    userGlow: profile?.userGlow === true,
    userCardColor: profile?.userCardColor || "#b98b4a",
    country: profile?.country || "",
    socialLinks: socialLinks.length ? socialLinks : [createEmptySocialLink()],
  };
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [activeSection, setActiveSection] = useState("profile");
  const [profileTitle, setProfileTitle] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [userColor, setUserColor] = useState("#f5d18a");
  const [userGlow, setUserGlow] = useState(false);
  const [userCardColor, setUserCardColor] = useState("#b98b4a");
  const [country, setCountry] = useState("");
  const [socialLinks, setSocialLinks] = useState([createEmptySocialLink()]);
  const [savedProfile, setSavedProfile] = useState(createEmptyProfile);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [deleteAccountConfirmation, setDeleteAccountConfirmation] = useState("");
  const [deleteAccountMessage, setDeleteAccountMessage] = useState("");
  const [deleteAccountSaving, setDeleteAccountSaving] = useState(false);
  const [usageCounts, setUsageCounts] = useState({ maps: 0, customIcons: 0 });
  const [accountLimits, setAccountLimits] = useState(FREE_ACCOUNT_LIMITS);
  const [payments, setPayments] = useState([]);
  const [supporterModalOpen, setSupporterModalOpen] = useState(false);
  const isSupporter = session?.user?.supporter === true;
  const currentContent = SETTINGS_CONTENT[activeSection];

  useEffect(() => {
    if (status !== "authenticated") return;

    let ignore = false;

    async function loadProfile() {
      setProfileLoading(true);
      setProfileMessage("");

      try {
        const response = await fetch("/api/account/profile");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Erro ao carregar perfil.");
        }

        if (ignore) return;

        const profile = normalizeProfile(data.profile);
        setSavedProfile(profile);
        applyProfile(profile);
      } catch (error) {
        if (!ignore) {
          setProfileMessage(error.message || "Erro ao carregar perfil.");
        }
      } finally {
        if (!ignore) {
          setProfileLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      ignore = true;
    };
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    let ignore = false;

    async function loadPayments() {
      try {
        const response = await fetch("/api/payments");
        const data = await response.json();

        if (!ignore && response.ok) {
          setPayments(data.payments || []);
        }
      } catch (error) {
        console.error("Erro ao carregar pagamentos.", error);
      }
    }

    loadPayments();

    return () => {
      ignore = true;
    };
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    let ignore = false;

    async function loadUsageCounts() {
      try {
        const [mapsResponse, assetsResponse, limitsResponse] = await Promise.all([
          fetch("/api/maps"),
          fetch("/api/assets"),
          fetch("/api/account/limits"),
        ]);
        const [mapsData, assetsData, limitsData] = await Promise.all([
          mapsResponse.json(),
          assetsResponse.json(),
          limitsResponse.json(),
        ]);

        if (ignore) return;

        setUsageCounts({
          maps: mapsResponse.ok ? (mapsData.maps || []).length : 0,
          customIcons: assetsResponse.ok ? (assetsData.assets || []).length : 0,
        });

        if (limitsResponse.ok && limitsData.limits) {
          setAccountLimits(limitsData.limits);
        }
      } catch (error) {
        console.error("Erro ao carregar uso da conta.", error);
      }
    }

    loadUsageCounts();

    return () => {
      ignore = true;
    };
  }, [status]);

  function applyProfile(profile) {
    setProfileTitle(profile.profileTitle);
    setProfileBio(profile.profileBio);
    setUserColor(profile.userColor);
    setUserGlow(profile.userGlow);
    setUserCardColor(profile.userCardColor);
    setCountry(profile.country);
    setSocialLinks(profile.socialLinks);
  }

  function addSocialLink() {
    if (socialLinks.length >= SOCIAL_LINK_LIMIT) return;

    setSocialLinks((prev) => [...prev, createEmptySocialLink()]);
  }

  function updateSocialLink(index, field, value) {
    setSocialLinks((prev) =>
      prev.map((link, currentIndex) =>
        currentIndex === index ? { ...link, [field]: value } : link
      )
    );
  }

  function resetProfileChanges() {
    applyProfile(savedProfile);
    setProfileMessage("Alteracoes descartadas.");
  }

  async function saveProfileChanges() {
    setProfileSaving(true);
    setProfileMessage("");

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileTitle,
          profileBio,
          userColor,
          userGlow,
          userCardColor,
          country,
          socialLinks,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao salvar perfil.");
      }

      const profile = normalizeProfile(data.profile);
      setSavedProfile(profile);
      applyProfile(profile);
      setProfileMessage("Perfil salvo com sucesso.");
    } catch (error) {
      setProfileMessage(error.message || "Erro ao salvar perfil.");
    } finally {
      setProfileSaving(false);
    }
  }

  function getProviderLabel(provider) {
    const labels = {
      google: "Google",
      discord: "Discord",
      steam: "Steam",
    };

    return labels[provider] || provider || "Nao informado";
  }

  async function deleteAccount() {
    setDeleteAccountSaving(true);
    setDeleteAccountMessage("");

    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteAccountConfirmation }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao deletar conta.");
      }

      await signOut({ callbackUrl: "/" });
    } catch (error) {
      setDeleteAccountMessage(error.message || "Erro ao deletar conta.");
    } finally {
      setDeleteAccountSaving(false);
    }
  }

  function renderProfileContent() {
    return (
      <>
        <div className="settingsTitleRow">
          <h1>Perfil</h1>
          {session?.user?.username && (
            <Link
              className="settingsPublicProfileLink"
              href={`/user/${session.user.username}`}
              target="_blank"
              rel="noreferrer"
            >
              Ver perfil público
            </Link>
          )}
        </div>

        {profileLoading && <p>Carregando perfil...</p>}

        <section className="settingsProfileSection">
          <h2>Biografia</h2>
          <p>
            Adicione uma breve apresentação para contextualizar sua experiência,
            seus projetos ou o tipo de mapas que você cria.
          </p>

          <label>
            Título
            <input
              value={profileTitle}
              maxLength={PROFILE_TITLE_MAX_LENGTH}
              onChange={(event) => setProfileTitle(event.target.value)}
              placeholder="Ex: Criador de mapas e rotas"
            />
            <small>
              {profileTitle.length}/{PROFILE_TITLE_MAX_LENGTH}
            </small>
          </label>

          <label>
            Biografia
            <textarea
              value={profileBio}
              maxLength={PROFILE_BIO_MAX_LENGTH}
              onChange={(event) => setProfileBio(event.target.value)}
              placeholder="Conte um pouco sobre você, seus jogos favoritos ou os mapas que costuma criar."
              rows={6}
            />
            <small>
              {profileBio.length}/{PROFILE_BIO_MAX_LENGTH}
            </small>
          </label>
        </section>

        <section className="settingsProfileSection">
          <h2>Location</h2>
          <p>
            Informe seu país para ajudar outros usuários a reconhecerem melhor
            seu perfil público e sua comunidade.
          </p>

          <label>
            País
            <select value={country} onChange={(event) => setCountry(event.target.value)}>
              <option value="">Selecione um país</option>
              {COUNTRIES.map((countryName) => (
                <option key={countryName} value={countryName}>
                  {countryName}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="settingsProfileSection">
          <div className="settingsSocialHeader">
            <div>
              <h2>Redes Sociais</h2>
              <p>Compartilhe seus canais oficiais e perfis públicos.</p>
            </div>
          </div>

          <div className="settingsSocialList">
            {socialLinks.map((link, index) => (
              <div className="settingsSocialRow" key={index}>
                <input
                  value={link.title}
                  onChange={(event) =>
                    updateSocialLink(index, "title", event.target.value)
                  }
                  placeholder="Título"
                  maxLength={30}
                />
                <input
                  value={link.url}
                  onChange={(event) =>
                    updateSocialLink(index, "url", event.target.value)
                  }
                  placeholder="Link URL"
                  type="url"
                />
              </div>
            ))}
          </div>
          <button
            className="settingsSocialAddButton"
            type="button"
            onClick={addSocialLink}
            disabled={socialLinks.length >= SOCIAL_LINK_LIMIT}
            aria-label="Adicionar rede social"
          >
            +
          </button>
          <small>
            {socialLinks.length}/{SOCIAL_LINK_LIMIT} links
          </small>
        </section>

        {profileMessage && (
          <p className="settingsProfileMessage">{profileMessage}</p>
        )}

        <div className="settingsProfileActions">
          <button
            className="primary"
            type="button"
            onClick={saveProfileChanges}
            disabled={profileLoading || profileSaving}
          >
            {profileSaving ? "Salvando..." : "Salvar"}
          </button>
          <button
            className="secondary"
            type="button"
            onClick={resetProfileChanges}
            disabled={profileLoading || profileSaving}
          >
            Cancelar
          </button>
        </div>
      </>
    );
  }


  function renderCustomizationContent() {
    return (
      <>
        <h1>Customização</h1>
        <section className="settingsProfileSection settingsUsernameSection">
          <h2>Customização</h2>
          <p>
            Ajuste a aparência pública do seu username e da borda dos seus cards
            na Library. Cores personalizadas e glow são recursos exclusivos para
            contas Supporter.
          </p>

          <div className="settingsCustomizationGrid">
            <div className="settingsCustomizationPanel">
              <h3>Username</h3>
              <div className="settingsUsernameControls">
                <label className="settingsUsernameColorField">
                  <span>Color</span>
                  <button
                    className={
                      isSupporter
                        ? "settingsUserColorControl"
                        : "settingsUserColorControl disabled"
                    }
                    type="button"
                    onClick={() => {
                      if (!isSupporter) {
                        setSupporterModalOpen(true);
                      }
                    }}
                  >
                    <span style={{ backgroundColor: userColor }} />
                    <input
                      type="color"
                      value={userColor}
                      disabled={!isSupporter}
                      onChange={(event) => setUserColor(event.target.value)}
                      aria-label="Selecionar cor do username"
                    />
                  </button>
                </label>

                <button
                  className="settingsUsernameDefaultButton"
                  type="button"
                  onClick={() => setUserColor("#f5d18a")}
                  disabled={!isSupporter}
                >
                  Default
                </button>

                <label
                  className={
                    isSupporter ? "settingsGlowToggle" : "settingsGlowToggle disabled"
                  }
                  onClick={(event) => {
                    if (!isSupporter) {
                      event.preventDefault();
                      setSupporterModalOpen(true);
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={userGlow}
                    disabled={!isSupporter}
                    onChange={(event) => setUserGlow(event.target.checked)}
                  />
                  Glow
                </label>
              </div>
            </div>

            <div className="settingsCustomizationPanel">
              <h3>Card</h3>
              <div className="settingsUsernameControls">
                <label className="settingsUsernameColorField">
                  <span>Border</span>
                  <button
                    className={
                      isSupporter
                        ? "settingsUserColorControl"
                        : "settingsUserColorControl disabled"
                    }
                    type="button"
                    onClick={() => {
                      if (!isSupporter) {
                        setSupporterModalOpen(true);
                      }
                    }}
                  >
                    <span style={{ backgroundColor: userCardColor }} />
                    <input
                      type="color"
                      value={userCardColor}
                      disabled={!isSupporter}
                      onChange={(event) => setUserCardColor(event.target.value)}
                      aria-label="Selecionar cor da borda do card"
                    />
                  </button>
                </label>

                <button
                  className="settingsUsernameDefaultButton"
                  type="button"
                  onClick={() => setUserCardColor("#b98b4a")}
                  disabled={!isSupporter}
                >
                  Default
                </button>
              </div>
            </div>
          </div>

          <div
            className={
              userGlow
                ? "settingsLibraryPreviewCard glow"
                : "settingsLibraryPreviewCard"
            }
            style={{
              "--preview-user-color": userColor,
              ...(userCardColor === "#b98b4a"
                ? {}
                : { "--preview-card-color": userCardColor }),
            }}
          >
            <span>Preview</span>
            <h3>Example Map</h3>
            <p>No map preview needed here. This is how your Library card style will read.</p>
            <strong>{session?.user?.username || "username"}</strong>
          </div>
        </section>

        {profileMessage && (
          <p className="settingsProfileMessage">{profileMessage}</p>
        )}

        <div className="settingsProfileActions">
          <button
            className="primary"
            type="button"
            onClick={saveProfileChanges}
            disabled={profileLoading || profileSaving}
          >
            {profileSaving ? "Salvando..." : "Salvar"}
          </button>
          <button
            className="secondary"
            type="button"
            onClick={resetProfileChanges}
            disabled={profileLoading || profileSaving}
          >
            Cancelar
          </button>
        </div>
      </>
    );
  }

  function renderFavoritesContent() {
    const favoriteMaps = [];

    return (
      <>
        <h1>Favoritos</h1>

        <section className="settingsProfileSection">
          <h2>Mapas favoritados</h2>
          <p>
            Acompanhe aqui os mapas que voce marcou como favoritos para acessar
            rapidamente suas comunidades, rotas e conteudos mais importantes.
          </p>

          {favoriteMaps.length ? (
            <div className="settingsFavoriteList">
              {favoriteMaps.map((map) => (
                <div className="settingsFavoriteItem" key={map.id}>
                  <div>
                    <strong>{map.title}</strong>
                    <span>{map.groupName}</span>
                  </div>
                  <div className="settingsFavoriteActions">
                    <Link href={`/map/${map.id}`}>Acessar mapa</Link>
                    <button type="button">Desfavoritar</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="settingsEmptyState">
              <strong>Nenhum mapa favoritado ainda.</strong>
              <span>
                Quando o sistema de favoritos estiver disponivel, os mapas
                marcados por voce aparecerao nesta lista.
              </span>
            </div>
          )}
        </section>
      </>
    );
  }

  function renderAccountContent() {
    return (
      <>
        <h1>Conta</h1>

        <section className="settingsProfileSection">
          <h2>Informacoes da conta</h2>
          <p>
            Gerencie os dados principais vinculados ao seu login e confira qual
            provedor de autenticacao esta conectado a esta conta.
          </p>

          <div className="settingsAccountDetails">
            <div>
              <span>Provider</span>
              <strong>{getProviderLabel(session?.user?.provider)}</strong>
            </div>
            <div>
              <span>E-mail</span>
              <strong>{session?.user?.email || "Nao informado"}</strong>
            </div>
          </div>
        </section>

        <section className="settingsProfileSection settingsDangerSection">
          <h2>Deletar conta</h2>
          <p>
            Esta acao remove permanentemente sua conta, mapas, grupos e icones
            personalizados. Depois de confirmada, ela nao podera ser desfeita.
          </p>
          <button
            className="danger"
            type="button"
            onClick={() => {
              setDeleteAccountConfirmation("");
              setDeleteAccountMessage("");
              setDeleteAccountModalOpen(true);
            }}
          >
            Deletar conta
          </button>
        </section>
      </>
    );
  }

  function renderSupporterStatusContent() {
    return (
      <>
        <h1>Status</h1>

        <section className="settingsProfileSection">
          <h2>Benefícios da conta</h2>
          <p>
            Confira o plano ativo da sua conta e acompanhe os limites atuais de
            criação disponíveis para seu workspace.
          </p>

          <div className="settingsStatusRow">
            <div>
              <span>Status</span>
              <strong>{isSupporter ? "Supporter" : "Free account"}</strong>
            </div>
            {!isSupporter && (
              <Link href="/support" target="_blank" rel="noreferrer">
                Upgrade
              </Link>
            )}
          </div>

          {isSupporter && (
            <ul className="settingsPerkList">
              <li>Custom color options for your profile/map presence.</li>
              <li>Add more than one collaborator to your maps.</li>
              <li>Higher maximum map and custom icon limits.</li>
              <li>Highlighted map card and username styling in Library.</li>
              <li>Future supporter-only quality of life perks.</li>
            </ul>
          )}

          <div className="settingsUsageGrid">
            <div
              className={
                usageCounts.maps >= accountLimits.maps
                  ? "limitReached"
                  : ""
              }
            >
              <span>Mapas</span>
              <strong>
                {usageCounts.maps} / {accountLimits.maps}
              </strong>
            </div>
            <div
              className={
                usageCounts.customIcons >= accountLimits.customIcons
                  ? "limitReached"
                  : ""
              }
            >
              <span>Ícones personalizados</span>
              <strong>
                {usageCounts.customIcons} / {accountLimits.customIcons}
              </strong>
            </div>
          </div>
        </section>
      </>
    );
  }

  function renderPurchaseHistoryContent() {
    return (
      <>
        <h1>Histórico de compras</h1>

        <section className="settingsProfileSection">
          <h2>Compras e upgrades</h2>
          <p>
            Consulte aqui o histórico de compras, upgrades e benefícios
            adicionados à sua conta.
          </p>

          {payments.length ? (
            <div className="settingsPurchaseList">
              {payments.map((payment) => (
                <div className="settingsPurchaseItem" key={payment._id}>
                  <div>
                    <strong>{payment.planLabel || payment.plan}</strong>
                    <span>
                      {new Date(
                        payment.paidAt || payment.createdAt
                      ).toLocaleDateString("pt-BR")}{" "}
                      - {payment.provider} - {payment.currency} {payment.amount}
                    </span>
                  </div>
                  <span>{payment.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="settingsEmptyState">
              <strong>Nenhuma compra registrada ainda.</strong>
              <span>
                Quando compras ou upgrades forem adicionados à sua conta, eles
                aparecerão nesta lista.
              </span>
            </div>
          )}
        </section>
      </>
    );
  }

  return (
    <main className="dashboardPage siteMain">
      <SiteHeader />

      <section className="dashboardCard sitePageCard settingsPageCard">
        <aside className="settingsSidebar">
          {SETTINGS_SECTIONS.map((section) => (
            <div className="settingsNavGroup" key={section.title}>
              <h2>{section.title}</h2>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  className={activeSection === item.id ? "active" : ""}
                  onClick={() => setActiveSection(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <div className="settingsContent">
          {status === "loading" ? (
            <p>Carregando conta...</p>
          ) : !session ? (
            <p>Faça login para acessar as configurações da sua conta.</p>
          ) : activeSection === "profile" ? (
            renderProfileContent()
          ) : activeSection === "customization" ? (
            renderCustomizationContent()
          ) : activeSection === "favorites" ? (
            renderFavoritesContent()
          ) : activeSection === "account" ? (
            renderAccountContent()
          ) : activeSection === "supporter-status" ? (
            renderSupporterStatusContent()
          ) : activeSection === "purchase-history" ? (
            renderPurchaseHistoryContent()
          ) : (
            <>
              <span className="settingsContentEyebrow">Account settings</span>
              <h1>{currentContent.title}</h1>
              <p>{currentContent.description}</p>
              <div className="settingsInfoBox">
                <span>Usuário atual</span>
                <strong>{session.user.username || "usuário"}</strong>
              </div>
            </>
          )}
        </div>
      </section>

      {supporterModalOpen && (
        <div
          className="modalOverlay supporterFeatureOverlay"
          onClick={() => setSupporterModalOpen(false)}
        >
          <div
            className="modal supporterFeatureModal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="closeButton"
              onClick={() => setSupporterModalOpen(false)}
            >
              {"\u00D7"}
            </button>
            <h2>Recurso Supporter</h2>
            <p>
              A personalização da cor do usuário está disponível somente para
              contas Supporter.
            </p>
            <div className="modalActions">
              <Link
                className="primary"
                href="/support"
                target="_blank"
                rel="noreferrer"
              >
                Ir para Support
              </Link>
              <button
                className="secondary"
                onClick={() => setSupporterModalOpen(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteAccountModalOpen && (
        <div
          className="modalOverlay supporterFeatureOverlay"
          onClick={() => setDeleteAccountModalOpen(false)}
        >
          <div
            className="modal supporterFeatureModal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="closeButton"
              onClick={() => setDeleteAccountModalOpen(false)}
            >
              {"\u00D7"}
            </button>
            <h2>Deletar conta</h2>
            <p>
              Esta acao vai deletar sua conta e todos os mapas, grupos e icones
              personalizados vinculados a ela. Esses dados nao poderao ser
              recuperados.
            </p>
            <label>
              Digite delete para confirmar
              <input
                value={deleteAccountConfirmation}
                onChange={(event) =>
                  setDeleteAccountConfirmation(event.target.value)
                }
                placeholder="delete"
              />
            </label>
            {deleteAccountMessage && (
              <p className="settingsProfileMessage">{deleteAccountMessage}</p>
            )}
            <div className="modalActions">
              <button
                className="danger"
                onClick={deleteAccount}
                disabled={
                  deleteAccountSaving ||
                  deleteAccountConfirmation.trim().toLowerCase() !== "delete"
                }
              >
                {deleteAccountSaving ? "Deletando..." : "Confirmar delete"}
              </button>
              <button
                className="secondary"
                onClick={() => setDeleteAccountModalOpen(false)}
                disabled={deleteAccountSaving}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <SiteFooter />
    </main>
  );
}
