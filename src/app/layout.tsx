import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { WatchlistProvider } from "@/context/WatchlistContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SearchModal from "@/components/SearchModal";
import CapacitorBackHandler from "@/components/CapacitorBackHandler";
import FloatingBottomNav from "@/components/FloatingBottomNav";
import GlobalAnnouncementModal from "@/components/GlobalAnnouncementModal";
import TvNavigationHandler from "@/components/TvNavigationHandler";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#090a0f",
};

export const metadata: Metadata = {
  title: {
    default: "Stream Freak",
    template: "%s | Stream Freak",
  },
  description: "Your streaming platform for Movies, TV Shows, and Anime.",
  manifest: "/manifest.webmanifest",
  keywords: ["stream freak", "streaming", "movies", "tv shows", "anime", "watch online"],
  openGraph: {
    title: "Stream Freak",
    description: "Your streaming platform for Movies, TV Shows, and Anime.",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body
        className="min-h-screen bg-[#090a0f] text-gray-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black antialiased"
        suppressHydrationWarning
      >
        <AuthProvider>
        <WatchlistProvider>
          {/* Handles Android hardware back button & screen orientation lock/unlock */}
          <CapacitorBackHandler />
          <TvNavigationHandler />
          <GlobalAnnouncementModal />
          <Navbar />
          <SearchModal />
          <main className="flex-1 w-full pb-[env(safe-area-inset-bottom,0px)]" suppressHydrationWarning>
            {children}
          </main>
          <Footer />
          <FloatingBottomNav />
        </WatchlistProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
