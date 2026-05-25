"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";

export default function UsernameRequiredModal() {
  const { data: session, status, update } = useSession();
  const [usernameDraft, setUsernameDraft] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  if (status !== "authenticated" || !session?.user?.needsUsername) {
    return null;
  }

  function handleUsernameChange(event) {
    const nextValue = event.target.value
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 15);

    setUsernameDraft(nextValue);
  }

  async function saveUsername() {
    if (!usernameDraft) {
      alert("Digite um username.");
      return;
    }

    setSavingUsername(true);

    try {
      const response = await fetch("/api/account/username", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: usernameDraft }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao salvar username.");
        return;
      }

      await update({
        username: data.username,
        needsUsername: false,
      });

      setUsernameDraft("");
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar username.");
    } finally {
      setSavingUsername(false);
    }
  }

  return (
    <div className="usernameRequiredOverlay">
      <section className="usernameRequiredModal">
        <h2>Criar username</h2>
        <p>
          Esse será o nome exibido publicamente no site, como autor de mapas,
          em logs, toasts e listas de editores. Use apenas a-z e 0-9, com até
          15 caracteres.
        </p>

        <div className="usernameRequiredForm">
          <input
            value={usernameDraft}
            onChange={handleUsernameChange}
            placeholder="username"
            maxLength={15}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                saveUsername();
              }
            }}
          />

          <button onClick={saveUsername} disabled={savingUsername}>
            {savingUsername ? "Salvando..." : "Salvar"}
          </button>
        </div>

        <button
          type="button"
          className="usernameRequiredLogout"
          onClick={() => signOut()}
        >
          Sair da conta
        </button>
      </section>
    </div>
  );
}
