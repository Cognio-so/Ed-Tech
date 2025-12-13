import HeroSection from "./_components/hero-section";
import WhyWeBuiltThisSection from "./_components/why-we-built";
import FounderSection from "./_components/founder";
import OurCommitmentSection from "./_components/our-commitment";
import FounderQuotesSection from "./_components/founder-quotes";
import PartnerCtaSection from "./_components/partner";
import Footer from "./_components/footer";

export default function OurMissionPage() {
  return (
    <div>
      <HeroSection />
      <WhyWeBuiltThisSection />
      <FounderSection />
      <OurCommitmentSection />
      <FounderQuotesSection />
      <PartnerCtaSection />
      <Footer />
    </div>
  );
}