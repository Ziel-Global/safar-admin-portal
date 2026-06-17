import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy - Safar" },
      {
        name: "description",
        content: "How Safar uses cookies and similar technologies on our website.",
      },
      { property: "og:title", content: "Cookie Policy - Safar" },
      {
        property: "og:description",
        content: "How Safar uses cookies on our website.",
      },
    ],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <PublicLayout>
      <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Cookie Policy" }]} />
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Cookie Policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated {new Date().getFullYear()}
        </p>

        <div className="prose prose-neutral mt-8 max-w-none text-sm leading-relaxed text-foreground/90">
          <p>
            Safar uses cookies and similar technologies (such as <code>localStorage</code>) to
            keep you signed in, remember your preferences (currency, language), and measure
            anonymous usage. This is a placeholder document - your production policy should be
            reviewed by qualified legal counsel.
          </p>

          <h2 className="mt-8 text-xl font-semibold">Categories</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              <strong>Strictly necessary</strong> - keep you signed in and remember your
              session. These cannot be disabled.
            </li>
            <li>
              <strong>Preferences</strong> - remember your chosen currency and locale so you
              don't have to set them on every visit.
            </li>
            <li>
              <strong>Analytics</strong> - help us understand which pages are useful and where
              we should improve. We do not use these to identify you personally.
            </li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold">Managing cookies</h2>
          <p className="mt-3">
            Most browsers let you block or delete cookies. Doing so may sign you out and reset
            your preferences. See your browser's help pages for instructions.
          </p>
        </div>
      </article>
    </PublicLayout>
  );
}
