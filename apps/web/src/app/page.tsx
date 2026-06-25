import CTABanner from "@/components/home/CTABanner";
import FAQ from "@/components/home/FAQ";
import HeroSection from "@/components/home/HeroSection";
import HowItWorks from "@/components/home/HowItWorks";
import MeetTheHeroes from "@/components/home/MeetTheHeroes";
import MerchandiseShowcase from "@/components/home/MerchandiseShowcase";
import SampleUniverses from "@/components/home/SampleUniverses";
import TrustSection from "@/components/home/TrustSection";
import UniverseTimeline from "@/components/home/UniverseTimeline";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        {/* 1 — Hero: Every child deserves their own universe */}
        <HeroSection />

        {/* 2 — How It Works: 3 illustrated steps */}
        <HowItWorks />

        {/* 3 — Sample Universes: 6 demo universes */}
        <SampleUniverses />

        {/* 4 — Meet the Heroes: before/after transformations */}
        <MeetTheHeroes />

        {/* 5 — Universe Timeline: Story → Power → Companion → World → Battle */}
        <UniverseTimeline />

        {/* 6 — Merchandise: realistic product previews */}
        <MerchandiseShowcase />

        {/* 7 — Privacy & Trust */}
        <TrustSection />

        {/* 8 — FAQ */}
        <FAQ />

        {/* 9 — Final CTA */}
        <CTABanner />
      </main>
      <Footer />
    </>
  );
}
