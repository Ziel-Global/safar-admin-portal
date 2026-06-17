import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { RitualCard } from "@/components/guides/RitualCard";
import { Button } from "@/components/ui/button";
import { fetchRitualBySlug, fetchRituals, type GuideType } from "@/lib/guides";

const VALID: GuideType[] = ["hajj", "umrah"];

export const Route = createFileRoute("/guides/$guideType/$slug")({
  beforeLoad: ({ params }) => {
    if (!VALID.includes(params.guideType as GuideType)) throw notFound();
  },
  loader: async ({ params }) => {
    const ritual = await fetchRitualBySlug(params.slug);
    if (!ritual || ritual.guide_type !== params.guideType) throw notFound();
    return { ritual };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const r = loaderData.ritual;
    const guideName = r.guide_type === "hajj" ? "Hajj" : "Umrah";
    const title = `${r.name} - ${guideName} Step-by-Step | Safar`;
    const description =
      r.description ||
      `Learn how to perform ${r.name} during ${guideName} with step-by-step instructions, duas and common mistakes.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        ...(r.header_image_url ? [{ property: "og:image", content: r.header_image_url }] : []),
      ],
    };
  },
  errorComponent: ({ error }) => (
    <PublicLayout>
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
    </PublicLayout>
  ),
  notFoundComponent: () => (
    <PublicLayout>
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Ritual not found</h1>
        <p className="mt-2 text-muted-foreground">We couldn't find that guide page.</p>
        <Button asChild className="mt-6">
          <Link to="/tools">Back to tools</Link>
        </Button>
      </div>
    </PublicLayout>
  ),
  component: RitualPage,
});

function RitualPage() {
  const { ritual } = Route.useLoaderData();
  const { guideType } = Route.useParams();
  const type = guideType as GuideType;

  const { data: siblings } = useQuery({
    queryKey: ["guide-rituals", type],
    queryFn: () => fetchRituals(type),
    staleTime: 1000 * 60 * 60,
  });

  const idx = siblings?.findIndex((r) => r.id === ritual.id) ?? -1;
  const prev = idx > 0 ? siblings![idx - 1] : null;
  const next = siblings && idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <Link
          to="/guides/$guideType"
          params={{ guideType: type }}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to {type === "hajj" ? "Hajj" : "Umrah"} guide
        </Link>

        <RitualCard ritual={ritual} index={idx >= 0 ? idx : 0} total={siblings?.length ?? 1} />

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {prev ? (
            <Link
              to="/guides/$guideType/$slug"
              params={{ guideType: type, slug: prev.slug }}
              className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary"
            >
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowLeft className="h-3 w-3" /> Previous
              </p>
              <p className="mt-1 font-semibold text-foreground">{prev.name}</p>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              to="/guides/$guideType/$slug"
              params={{ guideType: type, slug: next.slug }}
              className="rounded-lg border border-border bg-card p-4 text-right transition-colors hover:border-primary"
            >
              <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                Next <ArrowRight className="h-3 w-3" />
              </p>
              <p className="mt-1 font-semibold text-foreground">{next.name}</p>
            </Link>
          ) : (
            <div />
          )}
        </div>

        <div className="mt-10 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6 text-center sm:p-8">
          <h3 className="text-xl font-bold text-foreground sm:text-2xl">
            Plan your {type === "hajj" ? "Hajj" : "Umrah"} with confidence
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Browse verified agents offering {type === "hajj" ? "Hajj" : "Umrah"} packages with transparent pricing and real reviews.
          </p>
          <Button asChild size="lg" className="mt-5">
            <Link to="/search" search={{ type }}>
              <Search className="mr-2 h-4 w-4" /> Browse packages
            </Link>
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
}
