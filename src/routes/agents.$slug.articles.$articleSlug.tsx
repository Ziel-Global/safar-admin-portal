import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { getAgentArticleBySlug, incrementArticleViews, type AgentArticle } from "@/lib/articles";
import { markdownToHtml } from "@/lib/quoteTemplates";

export const Route = createFileRoute("/agents/$slug/articles/$articleSlug")({
  head: (ctx: { loaderData?: { article: AgentArticle; agent: { business_name: string; slug: string | null } } }) => {
    const a = ctx.loaderData?.article;
    if (!a) return { meta: [{ title: "Article - Safar" }] };
    const title = a.meta_title ?? `${a.title} - Safar`;
    const desc = a.meta_description ?? a.title;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        ...(a.featured_image
          ? [
              { property: "og:image", content: a.featured_image },
              { name: "twitter:image", content: a.featured_image },
            ]
          : []),
      ],
    };
  },
  loader: async ({ params }) => {
    const { data: agent } = await supabase
      .from("agents")
      .select("id, business_name, slug")
      .eq("slug", params.slug)
      .eq("status", "active")
      .maybeSingle();
    if (!agent) throw notFound();
    const article = await getAgentArticleBySlug(agent.id, params.articleSlug);
    if (!article || article.status !== "published") throw notFound();
    return { agent, article };
  },
  component: ArticlePage,
  errorComponent: ({ error }) => (
    <PublicLayout>
      <div className="mx-auto max-w-2xl p-12 text-center">
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
    </PublicLayout>
  ),
  notFoundComponent: () => (
    <PublicLayout>
      <div className="mx-auto max-w-2xl p-12 text-center">
        <h1 className="text-2xl font-bold">Article not found</h1>
        <Button asChild className="mt-4"><Link to="/">Go home</Link></Button>
      </div>
    </PublicLayout>
  ),
});

function ArticlePage() {
  const { agent, article } = Route.useLoaderData();

  useEffect(() => {
    incrementArticleViews(article.id).catch(() => null);
  }, [article.id]);

  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          to="/agents/$slug"
          params={{ slug: agent.slug! }}
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to {agent.business_name}
        </Link>

        {article.featured_image && (
          <OptimizedImage
            src={article.featured_image}
            alt={article.title}
            size="hero"
            eager
            wrapperClassName="mb-6 aspect-[16/9] w-full rounded-xl"
            className="h-full w-full rounded-xl object-cover"
          />
        )}

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{article.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          By {agent.business_name}
          {article.published_at ? ` · ${new Date(article.published_at).toLocaleDateString()}` : ""}
        </p>

        {article.tags && article.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {article.tags.map((t: string) => (
              <span key={t} className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xs">
                {t}
              </span>
            ))}
          </div>
        )}

        <div
          className="prose prose-neutral dark:prose-invert mt-8 max-w-none"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(article.body) }}
        />
      </article>
    </PublicLayout>
  );
}
