import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WatchlistProvider } from "@/context/WatchlistContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SearchModal from "@/components/SearchModal";
import CapacitorBackHandler from "@/components/CapacitorBackHandler";

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
  title: "Stream Freak | Watch Movies, TV Shows & Anime",
  description: "Ultra-modern streaming platform for Movies, TV Shows, and Anime.",
  keywords: ["stream freak", "streaming", "movies", "tv shows", "anime", "watch online"],
  openGraph: {
    title: "Stream Freak | Watch Movies, TV Shows & Anime",
    description: "Ultra-modern streaming platform for Movies, TV Shows, and Anime.",
    type: "website",
  },
  icons: {
    icon: "/app-icon.svg",
    shortcut: "/app-icon.svg",
    apple: "/app-icon.svg",
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
        className="min-h-screen bg-[#090a0f] text-gray-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black antialiased"
        suppressHydrationWarning
      >
        <WatchlistProvider>
          {/* Handles Android hardware back button & screen orientation lock/unlock */}
          <CapacitorBackHandler />
          <Navbar />
          <SearchModal />
          <main className="flex-1 w-full" suppressHydrationWarning>
            {children}
          </main>
          <Footer />
        </WatchlistProvider>
      </body>
    </html>
  );
}
