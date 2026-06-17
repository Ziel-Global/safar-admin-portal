import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { Calendar } from "lucide-react";
import { AdminPreviewLayout } from "@/components/layout/AdminPreviewLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type CmsPage = {
  id: string;
  title: string;
  slug: string;
  body: string;
  type: string;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  updated_at: string;
};

export const Route = createFileRoute("/pages/$slug")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
        replace: true,
      });
    }
  },
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("cms_content")
      .select("id, title, slug, body, type, seo_title, seo_description, published_at, updated_at")
      .eq("slug", params.slug)
      .eq("status", "published")
      .maybeSingle();
    if (error || !data) throw notFound();
    return { page: data as CmsPage };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.page) return { meta: [] };
    const p = loaderData.page;
    const title = p.seo_title || p.title;
    const desc =
      p.seo_description ||
      p.body.replace(/[#*_`>\-\[\]()]/g, "").slice(0, 160) ||
      "Read more on Safar.";
    return {
      meta: [
        { title: `${title} | Safar` },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
      ],
    };
  },
  notFoundComponent: () => (
    <AdminPreviewLayout>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
        <Button asChild className="mt-6">
          <Link to="/admin">Back to admin</Link>
        </Button>
      </div>
    </AdminPreviewLayout>
  ),
  component: CmsPageView,
});

function CmsPageView() {
  const { page } = Route.useLoaderData();
  return (
    <AdminPreviewLayout>
      <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {page.title}
        </h1>
        {page.published_at ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <time dateTime={page.published_at}>
              {new Date(page.published_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </div>
        ) : null}
        <MarkdownBody source={page.body} />
      </article>
    </AdminPreviewLayout>
  );
}

// Tiny, safe Markdown-ish renderer. Handles headings, bold/italic, links,
// inline code, lists and paragraphs without pulling in a full markdown lib.
function MarkdownBody({ source }: { source: string }) {
  const blocks = source.split(/\n{2,}/);
  return (
    <div className="prose prose-neutral mt-8 max-w-none text-foreground/90 prose-headings:text-foreground prose-a:text-primary prose-strong:text-foreground">
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  );
}

function renderBlock(block: string, key: number) {
  const trimmed = block.trim();
  if (!trimmed) return null;

  // Headings
  const h = trimmed.match(/^(#{1,6})\s+(.*)$/);
  if (h) {
    const level = h[1].length;
    const text = h[2];
    const sizes: Record<number, string> = {
      1: "text-3xl font-bold",
      2: "text-2xl font-bold",
      3: "text-xl font-semibold",
      4: "text-lg font-semibold",
      5: "text-base font-semibold",
      6: "text-sm font-semibold uppercase tracking-wide",
    };
    const cls = `${sizes[level]} mt-8 mb-3 text-foreground`;
    if (level === 1) return <h1 key={key} className={cls}>{renderInline(text)}</h1>;
    if (level === 2) return <h2 key={key} className={cls}>{renderInline(text)}</h2>;
    if (level === 3) return <h3 key={key} className={cls}>{renderInline(text)}</h3>;
    if (level === 4) return <h4 key={key} className={cls}>{renderInline(text)}</h4>;
    if (level === 5) return <h5 key={key} className={cls}>{renderInline(text)}</h5>;
    return <h6 key={key} className={cls}>{renderInline(text)}</h6>;
  }

  // Lists
  if (/^(\s*[-*]\s+)/.test(trimmed)) {
    const items = trimmed.split(/\n/).map((l) => l.replace(/^\s*[-*]\s+/, ""));
    return (
      <ul key={key} className="my-4 list-disc space-y-1.5 pl-6">
        {items.map((item, idx) => (
          <li key={idx}>{renderInline(item)}</li>
        ))}
      </ul>
    );
  }
  if (/^\d+\.\s+/.test(trimmed)) {
    const items = trimmed.split(/\n/).map((l) => l.replace(/^\d+\.\s+/, ""));
    return (
      <ol key={key} className="my-4 list-decimal space-y-1.5 pl-6">
        {items.map((item, idx) => (
          <li key={idx}>{renderInline(item)}</li>
        ))}
      </ol>
    );
  }

  // Blockquote
  if (trimmed.startsWith(">")) {
    const text = trimmed.replace(/^>\s?/gm, "");
    return (
      <blockquote
        key={key}
        className="my-4 border-l-4 border-primary/40 bg-secondary/40 px-4 py-2 italic text-foreground/80"
      >
        {renderInline(text)}
      </blockquote>
    );
  }

  // Paragraph
  return (
    <p key={key} className="my-4 leading-relaxed">
      {renderInline(trimmed)}
    </p>
  );
}

function renderInline(text: string): React.ReactNode {
  // Process [text](url) → <a>; **bold**, *italic*, `code` in a single pass.
  const parts: React.ReactNode[] = [];
  const regex = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let nodeKey = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(
        <a
          key={nodeKey++}
          href={match[3]}
          target={match[3].startsWith("http") ? "_blank" : undefined}
          rel="noreferrer"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          {match[2]}
        </a>,
      );
    } else if (match[4]) {
      parts.push(
        <strong key={nodeKey++} className="font-semibold text-foreground">
          {match[5]}
        </strong>,
      );
    } else if (match[6]) {
      parts.push(<em key={nodeKey++}>{match[7]}</em>);
    } else if (match[8]) {
      parts.push(
        <code
          key={nodeKey++}
          className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.9em]"
        >
          {match[9]}
        </code>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}
