import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy - Safar" },
      {
        name: "description",
        content:
          "How Safar collects, stores, and uses your personal data when booking Hajj and Umrah packages.",
      },
      { property: "og:title", content: "Privacy Policy - Safar" },
      {
        property: "og:description",
        content: "How Safar handles your personal data.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PublicLayout>
      <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Privacy Policy" }]} />
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated {new Date().getFullYear()}
        </p>

        <div className="prose prose-neutral mt-8 max-w-none text-sm leading-relaxed text-foreground/90">
          <p>
            Safar ("we", "us") respects your privacy. This page summarises what data we collect,
            why we collect it, and how you can control it. This is a placeholder document - your
            production policy should be reviewed by qualified legal counsel.
          </p>

          <h2 className="mt-8 text-xl font-semibold">What we collect</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>Account details (name, email, country) when you register.</li>
            <li>Quote requests you submit, including dates, group size and budget.</li>
            <li>Messages and quotes exchanged with agents through Safar.</li>
            <li>Anonymous analytics (page views, search queries) to improve the product.</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold">How we use it</h2>
          <p className="mt-3">
            We use your data to match you with relevant agents, deliver the quotes and messages
            you receive, and to operate and improve Safar. We do not sell your personal data.
          </p>

          <h2 className="mt-8 text-xl font-semibold">Your rights</h2>
          <p className="mt-3">
            You can request access to, correction of, or deletion of your personal data at any
            time by contacting us. We will respond within a reasonable period as required by
            applicable law (including UK GDPR and EU GDPR where relevant).
          </p>

          <h2 className="mt-8 text-xl font-semibold">Contact</h2>
          <p className="mt-3">
            For privacy questions, contact us via the address listed on our{" "}
            <a href="/about" className="font-semibold text-primary hover:underline">
              About page
            </a>
            .
          </p>
        </div>
      </article>
    </PublicLayout>
  );
}
