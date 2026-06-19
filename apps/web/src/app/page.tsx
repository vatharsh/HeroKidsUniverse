import CTABanner from "@/components/home/CTABanner";
import FAQ from "@/components/home/FAQ";
import HeroSection from "@/components/home/HeroSection";
import HowItWorks from "@/components/home/HowItWorks";
import PricingSection from "@/components/home/PricingSection";
import Testimonials from "@/components/home/Testimonials";
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
        <Testimonials />
        <PricingSection />
        <FAQ />
        <CTABanner />
      </main>
      <Footer />
    </>
  );
}
