import type { Metadata } from "next";
import { Bangers, Boogaloo, Nunito } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Hero Kids Universe — Your Child, The Hero",
  description:
    "Create a personalized illustrated storybook where your child is the hero. Upload a photo, choose an adventure, and receive a comic with narration and printable PDF.",
  keywords: ["personalized storybook", "kids stories", "AI storybook", "children books", "hero story"],
  openGraph: {
    title: "Hero Kids Universe — Your Child, The Hero",
    description:
      "Upload your child's photo and watch them become the hero of their own illustrated adventure story.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${boogaloo.variable} ${nunito.variable} ${bangers.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-cream text-ink" suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
