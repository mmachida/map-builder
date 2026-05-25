"use client";

import { useEffect } from "react";
import { signOut, useSession } from "next-auth/react";

export default function BannedSessionWatcher() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.banned) return;

    signOut({ callbackUrl: "/?loginError=banned" });
  }, [session?.user?.banned, status]);

  return null;
}
