import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "Home - Map Builder",
    template: "%s - Map Builder",
  },
  description: "Create interactive maps for game worlds.",
  icons: {
    icon: [{ url: "/api/site-icons/site_logo", type: "image/svg+xml" }],
    shortcut: [{ url: "/api/site-icons/site_logo", type: "image/svg+xml" }],
    apple: [{ url: "/api/site-icons/site_logo", type: "image/svg+xml" }],
  },
};
