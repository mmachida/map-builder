"use client";

import { Suspense, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import "../../page.css";

function SteamAuthContent() {
  const searchParams = useSearchParams();
  const ticket = searchParams.get("ticket");
  const error = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  useEffect(() => {
    if (!ticket) return;

    async function completeSteamLogin() {
      const result = await signIn("steam", {
        ticket,
        callbackUrl,
        redirect: false,
      });

      if (result?.error === "BANNED") {
        window.location.href = "/?loginError=banned";
        return;
      }

      if (result?.ok && result.url) {
        window.location.href = result.url;
        return;
      }

      if (result?.error) {
        window.location.href = "/auth/steam?error=1";
      }
    }

    completeSteamLogin();
  }, [ticket, callbackUrl]);

  return (
    <main className="loadingPage">
      {error ? "Erro ao entrar com Steam." : "Entrando com Steam..."}
    </main>
  );
}

export default function SteamAuthPage() {
  return (
    <Suspense fallback={<main className="loadingPage">Entrando com Steam...</main>}>
      <SteamAuthContent />
    </Suspense>
  );
}
