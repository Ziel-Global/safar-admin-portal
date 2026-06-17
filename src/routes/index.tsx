import { createFileRoute, redirect } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { SocialProof } from "@/components/landing/SocialProof";
import { CtaBand } from "@/components/landing/CtaBand";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Safar - Find your trusted path to Makkah & Madinah" },
      {
        name: "description",
        content:
          "Compare verified Hajj and Umrah packages from licensed travel agents. Book with confidence on Safar - the trusted marketplace for pilgrims.",
      },
      { property: "og:title", content: "Safar - Find your trusted path to Makkah & Madinah" },
      {
        property: "og:description",
        content:
          "The trusted marketplace for Hajj and Umrah pilgrims. Search, compare, and book verified packages.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <PublicLayout>
      <Hero />
      <HowItWorks />
      <SocialProof />
      <CtaBand />
    </PublicLayout>
  );
}
