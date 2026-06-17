import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service - Safar" },
      {
        name: "description",
        content:
          "The terms governing your use of Safar to discover and book Hajj and Umrah packages.",
      },
      { property: "og:title", content: "Terms of Service - Safar" },
      {
        property: "og:description",
        content: "The terms that govern your use of Safar.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <PublicLayout>
      <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Terms of Service" }]} />
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated {new Date().getFullYear()}
        </p>

        <div className="prose prose-neutral mt-8 max-w-none text-sm leading-relaxed text-foreground/90">
          <p>
            Welcome to Safar. By accessing or using our marketplace you agree to these terms.
            This is a placeholder document - your production terms should be reviewed by
            qualified legal counsel before relying on them.
          </p>

          <h2 className="mt-8 text-xl font-semibold">Marketplace role</h2>
          <p className="mt-3">
            Safar connects pilgrims with independent travel agents. Bookings are contracts
            between you and the agent you choose. Safar is not the travel provider and is not
            party to that contract.
          </p>

          <h2 className="mt-8 text-xl font-semibold">Acceptable use</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>Provide accurate information when requesting quotes.</li>
            <li>Do not impersonate other users or misrepresent your identity.</li>
            <li>Do not post fraudulent reviews, scrape data, or abuse our APIs.</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold">Agent obligations</h2>
          <p className="mt-3">
            Agents must hold the licences appropriate to the markets they serve, deliver the
            services they sell, and respond to quote requests in good faith. Repeated breach
            may lead to suspension or removal under our enforcement policy.
          </p>

          <h2 className="mt-8 text-xl font-semibold">Liability</h2>
          <p className="mt-3">
            Safar provides the platform "as is". To the maximum extent permitted by law we
            exclude liability for losses arising from agent performance, third-party services,
            or events outside our reasonable control.
          </p>

          <h2 className="mt-8 text-xl font-semibold">Changes</h2>
          <p className="mt-3">
            We may update these terms. Material changes will be communicated in-app or by
            email. Continued use of Safar after changes means you accept the updated terms.
          </p>
        </div>
      </article>
    </PublicLayout>
  );
}
