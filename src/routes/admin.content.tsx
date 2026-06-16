import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Save, Eye, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/admin";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/admin/content")({
  component: AdminContentPage,
});

type ContentRow = {
  id: string;
  type: string;
  title: string;
  slug: string;
  body: string;
  status: string;
  locale: string;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  updated_at: string;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function AdminContentPage() {
  return (
    <ProtectedRoute requireRole="admin">
      <AdminLayout title="Content">
        <ContentManager />
      </AdminLayout>
    </ProtectedRoute>
  );
}

function ContentManager() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ContentRow[] | null>(null);
  const [selected, setSelected] = useState<ContentRow | null>(null);
  const [draft, setDraft] = useState<Partial<ContentRow>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("cms_content")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setRows([]);
      return;
    }
    setRows(data as ContentRow[]);
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    const blank: Partial<ContentRow> = {
      id: undefined,
      type: "page",
      title: "",
      slug: "",
      body: "",
      status: "draft",
      locale: "en",
      seo_title: "",
      seo_description: "",
    };
    setSelected(null);
    setDraft(blank);
  };

  const startEdit = (row: ContentRow) => {
    setSelected(row);
    setDraft({ ...row });
  };

  const save = async (publish?: boolean) => {
    if (!draft.title || !draft.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    const slug = (draft.slug && draft.slug.trim()) || slugify(draft.title);
    const status = publish ? "published" : draft.status || "draft";
    const payload = {
      type: draft.type || "page",
      title: draft.title.trim(),
      slug,
      body: draft.body || "",
      status,
      locale: draft.locale || "en",
      seo_title: draft.seo_title || null,
      seo_description: draft.seo_description || null,
      author_id: user?.id ?? null,
      published_at:
        status === "published"
          ? selected?.published_at ?? new Date().toISOString()
          : null,
    };
    const result = selected?.id
      ? await supabase.from("cms_content").update(payload).eq("id", selected.id).select().single()
      : await supabase.from("cms_content").insert(payload).select().single();

    setSaving(false);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success(publish ? "Published" : "Saved");
    if (user?.id) {
      await logAdminAction(
        user.id,
        (selected?.id ? "content.update" : "content.create") as never,
        "cms_content",
        result.data.id,
        { title: payload.title, status },
      );
    }
    setSelected(result.data as ContentRow);
    setDraft(result.data as ContentRow);
    load();
  };

  const remove = async (row: ContentRow) => {
    if (!confirm(`Delete "${row.title}"?`)) return;
    const { error } = await supabase.from("cms_content").delete().eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    if (user?.id) {
      await logAdminAction(user.id, "content.delete" as never, "cms_content", row.id, {
        title: row.title,
      });
    }
    if (selected?.id === row.id) {
      setSelected(null);
      setDraft({});
    }
    load();
  };

  const editing = draft.title !== undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Sidebar list */}
      <div className="space-y-3">
        <Button onClick={startNew} className="w-full">
          <Plus className="h-4 w-4" /> New content
        </Button>
        {rows === null ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No content yet - start by creating a new page.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => startEdit(row)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selected?.id === row.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {row.title}
                  </span>
                  <StatusBadge status={row.status} />
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  <span>/pages/{row.slug}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Editor */}
      <div>
        {!editing ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Select a page on the left or create a new one.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={draft.title ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        title: e.target.value,
                        slug: !selected?.id && (!d.slug || d.slug === slugify(d.title ?? ""))
                          ? slugify(e.target.value)
                          : d.slug,
                      }))
                    }
                    placeholder="About our agents"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={draft.slug ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, slug: slugify(e.target.value) }))}
                    placeholder="about-our-agents"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={draft.type ?? "page"}
                    onValueChange={(v) => setDraft((d) => ({ ...d, type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="page">Page</SelectItem>
                      <SelectItem value="post">Blog post</SelectItem>
                      <SelectItem value="guide">Guide</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="body">Body (Markdown)</Label>
                <Textarea
                  id="body"
                  value={draft.body ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                  rows={14}
                  placeholder="# Heading&#10;&#10;Write your content in Markdown…"
                  className="font-mono text-sm"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="seo_title">SEO title (optional)</Label>
                  <Input
                    id="seo_title"
                    value={draft.seo_title ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, seo_title: e.target.value }))}
                    placeholder="Falls back to title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seo_desc">SEO description (optional)</Label>
                  <Input
                    id="seo_desc"
                    value={draft.seo_description ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, seo_description: e.target.value }))
                    }
                    placeholder="Short summary for search engines"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <StatusBadge status={draft.status ?? "draft"} />
                  {selected?.id ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/pages/$slug" params={{ slug: draft.slug ?? "" }} target="_blank">
                        <Eye className="h-4 w-4" /> Preview
                      </Link>
                    </Button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected?.id ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => remove(selected)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={() => save(false)} disabled={saving}>
                    <Save className="h-4 w-4" /> Save draft
                  </Button>
                  <Button onClick={() => save(true)} disabled={saving}>
                    Publish
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "published"
      ? "bg-emerald-100 text-emerald-700 border-emerald-300"
      : status === "archived"
        ? "bg-secondary text-foreground/70 border-border"
        : "bg-amber-100 text-amber-800 border-amber-300";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${cls}`}
    >
      {status}
    </span>
  );
}
