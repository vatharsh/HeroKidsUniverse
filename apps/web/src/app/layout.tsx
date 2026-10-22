import type { Metadata } from "next";
import { Bangers, Boogaloo, Nunito } from "next/font/google";
import CouponCapture from "@/components/shared/CouponCapture";
import { AuthProvider } from "@/contexts/AuthContext";
import "./globals.css";

const boogaloo = Boogaloo({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const bangers = Bangers({
  variable: "--font-comic",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://herokidsuniverse.com";

export const metadata: Metadata = {
  // Makes share-preview images absolute URLs (WhatsApp/Instagram need them).
  metadataBase: new URL(SITE_URL),
  title: { default: "Hero Kids Universe — Your Child, The Hero", template: "%s · Hero Kids Universe" },
  description:
    "Create a personalized illustrated storybook where your child is the hero. Upload a photo, choose an adventure, and receive a comic with narration and printable PDF.",
  keywords: ["personalized storybook", "kids stories", "AI storybook", "children books", "hero story"],
  openGraph: {
    title: "Hero Kids Universe — Your Child, The Hero",
    description:
      "Upload your child's photo and watch them become the hero of their own illustrated adventure story.",
    type: "website",
    siteName: "Hero Kids Universe",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${boogaloo.variable} ${nunito.variable} ${bangers.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-cream text-ink" suppressHydrationWarning>
        <CouponCapture />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
