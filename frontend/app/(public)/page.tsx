import { redirect } from "next/navigation";
import { getUserSession } from "@/data/get-user-session";
import Navbar from "@/components/ui/navbar";
import Hero from "./_components/hero-section";
import Stats from "./_components/stats";
import RealitySection from "./_components/Reality-Section";
import HowItWorks from "./_components/How-It-Works";
import FeaturesFullHeight from "./_components/Features-Full-Height";
import SwarikaSection from "./_components/Swarika";
import ComparisonTable from "./_components/Comparison";
import Testimonials from "./_components/testimonials";
import MissionSection from "./_components/MissionSection";
import CallToAction from "./_components/call-to-action";
import Footer from "./_components/footer";
export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getUserSession();

  if (session?.user) {
    const userRole = session.user.role;

    if (userRole === "admin") {
      redirect("/admin");
    } else if (userRole === "student") {
      redirect("/student");
    } else if (userRole === "teacher") {
      redirect("/teacher");
    } else {
      redirect("/login");
    }
  }

  return (
    <>
      <Navbar />
      <Hero />
      <Stats />
      <RealitySection />
      <HowItWorks />
      <FeaturesFullHeight />
      <SwarikaSection />
      <ComparisonTable />
      <Testimonials />
      <MissionSection />
      <CallToAction />
      <Footer />
    </>
  );
}
