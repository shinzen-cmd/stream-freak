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
import PushNotificationRegistrar from "@/components/PushNotificationRegistrar";
import MaintenanceGate from "@/components/MaintenanceGate";

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
  metadataBase: new URL("https://streamfreak.xyz"),
  applicationName: "Stream Freak",
  title: {
    default: "Stream Freak — Watch Movies, TV Shows & Anime Online",
    template: "%s | Stream Freak",
  },
  description:
    "Stream Freak (streamfreak.xyz) is your all-in-one streaming platform for HD Movies, TV Shows, Bollywood, Anime, and live Watch Parties with friends.",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  keywords: [
    "Stream Freak",
    "streamfreak",
    "streamfreak.xyz",
    "stream freak app",
    "watch movies online",
    "watch anime online",
    "tv shows streaming",
    "bollywood movies",
    "watch party",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "Stream Freak — Watch Movies, TV Shows & Anime Online",
    description:
      "Stream HD Movies, TV Shows, Bollywood, Anime, and host live Watch Parties with friends on Stream Freak.",
    url: "https://streamfreak.xyz",
    siteName: "Stream Freak",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: "Stream Freak",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stream Freak — Movies, TV Shows & Anime",
    description:
      "Stream HD Movies, TV Shows, Bollywood, Anime, and host live Watch Parties on Stream Freak.",
    images: ["/icons/icon-512.png"],
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

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://streamfreak.xyz/#website",
      name: "Stream Freak",
      alternateName: ["StreamFreak", "streamfreak.xyz"],
      url: "https://streamfreak.xyz",
      description:
        "Stream HD Movies, TV Shows, Bollywood, Anime, and host live Watch Parties with friends.",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://streamfreak.xyz/explore?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": "https://streamfreak.xyz/#organization",
      name: "Stream Freak",
      url: "https://streamfreak.xyz",
      logo: "https://streamfreak.xyz/icons/icon-512.png",
      email: "taktshinzen@gmail.com",
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body
        className="min-h-screen bg-[#090a0f] text-gray-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black antialiased"
        suppressHydrationWarning
      >
        <AuthProvider>
        <WatchlistProvider>
          {/* Handles Android hardware back button & screen orientation lock/unlock */}
          <CapacitorBackHandler />
          <TvNavigationHandler />
          <PushNotificationRegistrar />
          <MaintenanceGate />
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
