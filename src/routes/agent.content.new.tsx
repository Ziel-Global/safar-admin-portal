import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { markdownToHtml } from "@/lib/quoteTemplates";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { listAgentArticles, type AgentArticle } from "@/lib/articles";
import { Pencil, Plus, Eye, Pin } from "lucide-react";

export const Route = createFileRoute("/agent/content/new")({
  head: () => ({
    meta: [
      { title: "New Article - Safar" },
      { name: "description", content: "Write and publish a guide for pilgrims on your agent profile." },
    ],
  }),
  component: () => (
    <ProtectedRoute requireRole="agent">
      <NewArticlePage />
    </ProtectedRoute>
  ),
});

function NewArticlePage() {
  const { agent } = useAuth();
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [featuredImage, setFeaturedImage] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [articles, setArticles] = useState<AgentArticle[]>([]);

  useEffect(() => {
    if (!agent) return;
    refresh();
  }, [agent]);

  async function refresh() {
    if (!agent) return;
    const list = await listAgentArticles(agent.id).catch(() => []);
    setArticles(list);
  }

  function reset() {
    setEditingId(null);
    setTitle("");
    setBody("");
    setFeaturedImage("");
    setTagsInput("");
    setMetaTitle("");
    setMetaDescription("");
  }

  function startEdit(a: AgentArticle) {
    setEditingId(a.id);
    setTitle(a.title);
    setBody(a.body);
    setFeaturedImage(a.featured_image ?? "");
    setTagsInput((a.tags ?? []).join(", "));
    setMetaTitle(a.meta_title ?? "");
    setMetaDescription(a.meta_description ?? "");
  }

  async function save(status: "draft" | "published") {
    if (!agent) return;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSubmitting(true);
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const payload = {
      agent_id: agent.id,
      title: title.trim(),
      slug: "",
      body,
      featured_image: featuredImage || null,
      tags,
      meta_title: metaTitle || null,
      meta_description: metaDescription || null,
      status,
    };
    try {
      if (editingId) {
        const { error } = await supabase.from("agent_articles").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success(status === "published" ? "Article updated and published" : "Draft saved");
      } else {
        const { error } = await supabase.from("agent_articles").insert([payload]);
        if (error) throw error;
        toast.success(status === "published" ? "Article published" : "Draft saved");
      }
      reset();
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePin(a: AgentArticle) {
    const { error } = await supabase
      .from("agent_articles")
      .update({ is_pinned: !a.is_pinned })
      .eq("id", a.id);
    if (error) toast.error(error.message);
    else refresh();
  }

  async function unpublish(a: AgentArticle) {
    const { error } = await supabase
      .from("agent_articles")
      .update({ status: "draft" })
      .eq("id", a.id);
    if (error) toast.error(error.message);
    else refresh();
  }

  return (
    <DashboardLayout variant="agent" title="Guides & Tips">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? "Edit article" : "New article"}
            </CardTitle>
            <CardDescription>
              Markdown supported. Articles publish immediately to your profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A pilgrim's guide to..." className="mt-1" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Featured image URL</Label>
                <Input value={featuredImage} onChange={(e) => setFeaturedImage(e.target.value)} placeholder="https://..." className="mt-1" />
              </div>
              <div>
                <Label>Tags (comma-separated)</Label>
                <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="hajj, prep, visa" className="mt-1" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>SEO title</Label>
                <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="Optional" className="mt-1" />
              </div>
              <div>
                <Label>SEO description</Label>
                <Input value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} placeholder="Optional, ~155 chars" className="mt-1" />
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Label>Body (Markdown)</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={16}
                  className="mt-1 font-mono text-sm"
                  placeholder="# Heading&#10;&#10;Your content..."
                />
              </div>
              <div>
                <Label>Preview</Label>
                <div
                  className="prose prose-sm dark:prose-invert mt-1 min-h-[400px] max-w-none rounded-md border border-border bg-background p-4"
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(body || "_Nothing to preview yet._") }}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              {editingId && (
                <Button type="button" variant="ghost" onClick={reset}>
                  Cancel edit
                </Button>
              )}
              <Button variant="outline" onClick={() => save("draft")} disabled={submitting}>
                Save draft
              </Button>
              <Button onClick={() => save("published")} disabled={submitting}>
                {editingId ? "Update & publish" : "Publish"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your articles</CardTitle>
            <CardDescription>Drafts stay private. Published articles appear on your profile.</CardDescription>
          </CardHeader>
          <CardContent>
            {articles.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No articles yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {a.is_pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                          <span className="font-medium">{a.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={a.status === "published" ? "default" : "secondary"}>
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{a.views}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(a)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => togglePin(a)} title={a.is_pinned ? "Unpin" : "Pin"}>
                            <Pin className={a.is_pinned ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5"} />
                          </Button>
                          {a.status === "published" && (
                            <Button size="sm" variant="ghost" onClick={() => unpublish(a)} title="Unpublish">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
