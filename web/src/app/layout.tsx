import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Source_Sans_3, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Elegant serif for headings - refined, editorial feel
const displayFont = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

// Clean sans-serif for body text - highly readable
const bodyFont = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

// Monospace for data/numbers
const monoFont = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sue Stitt Art | Collection Manager",
  description: "Inventory management for fine art print editions",
  applicationName: "Collection Manager",
  appleWebApp: {
    // iOS ignores the web manifest, so installability there comes from here.
    capable: true,
    title: "Collection",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  // Installed on a phone, the app fills the screen; without viewportFit the
  // sidebar and table edges sit under the notch and home indicator.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf5ea" },
    { media: "(prefers-color-scheme: dark)", color: "#000b13" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
