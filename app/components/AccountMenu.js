"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";

const LOGIN_PROVIDERS = [
  {
    id: "google",
    label: "Google",
    icon: "/site-icons/banner_google.png",
    enabled: true,
  },
  {
    id: "steam",
    label: "Steam",
    icon: "/site-icons/banner_steam.png",
    enabled: true,
    href: "/api/auth/steam",
  },
  {
    id: "discord",
    label: "Discord",
    icon: "/site-icons/banner_discord.png",
    enabled: true,
  },
];

export default function AccountMenu() {
  const { data: session, status } = useSession();
  const accountMenuRef = useRef(null);
  const accountButtonRef = useRef(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const [loginError, setLoginError] = useState("");

  const updateMenuPosition = useCallback(() => {
    if (!accountButtonRef.current) return;

    const rect = accountButtonRef.current.getBoundingClientRect();
    const width = 172;

    setMenuPosition({
      top: rect.bottom + 8,
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      width,
    });
  }, []);

  function toggleAccountMenu() {
    updateMenuPosition();
    setMenuOpen((prev) => !prev);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("loginError") === "banned") {
      setLoginError("Essa conta foi banida.");
      setLoginOpen(true);
      params.delete("loginError");

      const query = params.toString();
      const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", cleanUrl);
    }
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;

    function closeMenuOnOutsideClick(event) {
      if (accountMenuRef.current?.contains(event.target)) return;
      setMenuOpen(false);
    }

    updateMenuPosition();
    document.addEventListener("pointerdown", closeMenuOnOutsideClick);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      document.removeEventListener("pointerdown", closeMenuOnOutsideClick);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [menuOpen, updateMenuPosition]);

  if (status === "loading") {
    return (
      <div className="accountMenu">
        <button className="accountButton" disabled>
          Loading
        </button>
      </div>
    );
  }

  if (session) {
    const label = session.user.needsUsername
      ? "Create username"
      : session.user.username || "Account";

    return (
      <div className="accountMenu" ref={accountMenuRef}>
        <button
          ref={accountButtonRef}
          className="accountButton"
          onClick={toggleAccountMenu}
        >
          {label}
        </button>

        {menuOpen && (
          <div
            className="accountDropdown"
            style={
              menuPosition
                ? {
                    position: "fixed",
                    top: menuPosition.top,
                    left: menuPosition.left,
                    width: menuPosition.width,
                  }
                : undefined
            }
          >
            <Link href="/settings" onClick={() => setMenuOpen(false)}>
              <img src="/site-icons/cog_settings_2.svg" alt="" />
              Configurações
            </Link>
            <button onClick={() => signOut()}>
              <img src="/site-icons/leave_settings.svg" alt="" />
              <span>Sair</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="accountMenu">
      <button
        ref={accountButtonRef}
        className="accountButton"
        onClick={() => setLoginOpen(true)}
      >
        Login
      </button>

      {loginOpen && (
        <div className="accountLoginOverlay" onClick={() => setLoginOpen(false)}>
          <div
            className="accountLoginModal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="accountLoginClose"
              onClick={() => setLoginOpen(false)}
            >
              {"\u00D7"}
            </button>

            <h2>Login</h2>
            <p>Entre para criar e editar seus mapas.</p>
            {loginError && (
              <div className="accountLoginError">{loginError}</div>
            )}

            <div className="accountProviderList">
              {LOGIN_PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  className="accountProviderButton"
                  disabled={!provider.enabled}
                  onClick={() => {
                    if (!provider.enabled) return;
                    if (provider.href) {
                      const callbackUrl = window.location.href;
                      window.location.href = `${provider.href}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
                      return;
                    }

                    signIn(provider.id);
                  }}
                  title={
                    provider.enabled
                      ? `Login with ${provider.label}`
                      : `${provider.label} login coming soon`
                  }
                >
                  <img src={provider.icon} alt={`Login with ${provider.label}`} />
                </button>
              ))}
            </div>

            <p className="accountLoginNotice">
              Authentication is handled by the selected provider. We only use
              the minimum account information required to create and secure your
              Map Builder account, according to each provider&apos;s terms.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
