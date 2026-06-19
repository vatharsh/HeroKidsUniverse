import CTABanner from "@/components/home/CTABanner";
import HeroSection from "@/components/home/HeroSection";
import HowItWorks from "@/components/home/HowItWorks";
import PricingSection from "@/components/home/PricingSection";
import ThemeShowcase from "@/components/home/ThemeShowcase";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <HowItWorks />
        <ThemeShowcase />
        <PricingSection />
        <CTABanner />
      </main>
      <Footer />
    </>
  );
}
