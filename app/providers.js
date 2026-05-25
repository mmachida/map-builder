"use client";

import { SessionProvider } from "next-auth/react";
import BannedSessionWatcher from "./components/BannedSessionWatcher";
import SitePageTitle from "./components/SitePageTitle";
import UsernameRequiredModal from "./components/UsernameRequiredModal";

export default function Providers({ children }) {
  return (
    <SessionProvider refetchInterval={30} refetchOnWindowFocus>
      <SitePageTitle />
      <BannedSessionWatcher />
      {children}
      <UsernameRequiredModal />
    </SessionProvider>
  );
}
