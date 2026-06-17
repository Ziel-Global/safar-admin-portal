import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Trash2, Star, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  applyMergeFields,
  buildMergeValues,
  listQuoteTemplates,
  markdownToHtml,
  MERGE_FIELDS,
  type QuoteTemplate,
} from "@/lib/quoteTemplates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agent/templates/quotes")({
  head: () => ({
    meta: [
      { title: "Quote Templates - Safar Agent" },
      { name: "description", content: "Create and manage reusable quote templates with merge fields." },
    ],
  }),
  component: () => (
    <ProtectedRoute requireRole="agent">
      <QuoteTemplatesPage />
    </ProtectedRoute>
  ),
});

const SAMPLE_VALUES = buildMergeValues({
  pilgrim_name: "Aisha Rahman",
  package_name: "14-night Premium Umrah",
  price_total: 2499,
  price_currency: "GBP",
  hotel_name: "Hilton Suites Makkah",
  date_from: "2026-03-12",
  date_to: "2026-03-26",
  agent_name: "Noor Travel",
  agent_phone: "+44 20 7946 0000",
});

function QuoteTemplatesPage() {
  const { agent } = useAuth();
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function reload() {
    if (!agent) return;
    setLoading(true);
    try {
      const t = await listQuoteTemplates(agent.id);
      setTemplates(t);
      if (!selectedId && t.length > 0) {
        setSelectedId(t[0].id);
        setName(t[0].name);
        setBody(t[0].html_template);
      }
    } catch (err) {
      toast.error("Could not load templates", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id]);

  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const isStarter = selected?.is_starter ?? false;
  const ownTemplates = templates.filter((t) => !t.is_starter);
  const starterTemplates = templates.filter((t) => t.is_starter);

  function selectTemplate(t: QuoteTemplate) {
    setSelectedId(t.id);
    setName(t.name);
    setBody(t.html_template);
  }

  async function createBlank() {
    if (!agent) return;
    const { data, error } = await supabase
      .from("quote_templates")
      .insert({
        agent_id: agent.id,
        name: "Untitled template",
        html_template:
          "Assalamu alaikum {{pilgrim_name}},\n\nThank you for your enquiry about **{{package_name}}**.\n\n- Hotel: {{hotel_name}}\n- Dates: {{dates}}\n- Total: **{{price_total}}**\n\nWarm regards,\n{{agent_name}}\n{{agent_phone}}",
        merge_fields: MERGE_FIELDS as unknown as string[],
      })
      .select("*")
      .single();
    if (error) {
      toast.error("Could not create template");
      return;
    }
    const created = data as QuoteTemplate;
    setTemplates((prev) => [created, ...prev]);
    selectTemplate(created);
    toast.success("New template created");
  }

  async function duplicateStarter(t: QuoteTemplate) {
    if (!agent) return;
    const { data, error } = await supabase
      .from("quote_templates")
      .insert({
        agent_id: agent.id,
        name: `${t.name} (copy)`,
        html_template: t.html_template,
        design_id: t.design_id,
        merge_fields: t.merge_fields,
      })
      .select("*")
      .single();
    if (error) {
      toast.error("Could not copy template");
      return;
    }
    const created = data as QuoteTemplate;
    setTemplates((prev) => [created, ...prev]);
    selectTemplate(created);
    toast.success("Copied to your templates");
  }

  async function save() {
    if (!selected || isStarter) return;
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("quote_templates")
      .update({ name: name.trim(), html_template: body })
      .eq("id", selected.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save");
      return;
    }
    toast.success("Saved");
    setTemplates((prev) =>
      prev.map((t) => (t.id === selected.id ? { ...t, name: name.trim(), html_template: body } : t)),
    );
  }

  async function setDefault() {
    if (!selected || isStarter) return;
    const { error } = await supabase
      .from("quote_templates")
      .update({ is_default: true })
      .eq("id", selected.id);
    if (error) {
      toast.error("Could not set default");
      return;
    }
    toast.success("Set as default");
    reload();
  }

  async function deleteTemplate() {
    if (!selected || isStarter) return;
    if (!confirm("Delete this template?")) return;
    const { error } = await supabase.from("quote_templates").delete().eq("id", selected.id);
    if (error) {
      toast.error("Could not delete");
      return;
    }
    toast.success("Deleted");
    setSelectedId(null);
    setName("");
    setBody("");
    reload();
  }

  function insertField(field: string) {
    setBody((prev) => `${prev}{{${field}}}`);
  }

  const previewHtml = useMemo(() => markdownToHtml(applyMergeFields(body, SAMPLE_VALUES)), [body]);

  return (
    <DashboardLayout variant="agent" title="Quote Templates">
      <div className="mx-auto w-full max-w-6xl">
        <Button variant="ghost" size="sm" asChild className="mb-4 gap-2">
          <Link to="/agent/leads">
            <ArrowLeft className="h-4 w-4" /> Back to leads
          </Link>
        </Button>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* List */}
          <div className="space-y-4">
            <Button onClick={createBlank} className="w-full gap-2">
              <Plus className="h-4 w-4" /> New template
            </Button>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your templates
              </h3>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : ownTemplates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No templates yet - create one or duplicate a starter below.
                </p>
              ) : (
                <ul className="space-y-1">
                  {ownTemplates.map((t) => (
                    <li key={t.id}>
                      <button
                        onClick={() => selectTemplate(t)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition",
                          selectedId === t.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-secondary/50",
                        )}
                      >
                        <span className="truncate">{t.name}</span>
                        {t.is_default ? (
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3 w-3" /> Starters
              </h3>
              <ul className="space-y-1">
                {starterTemplates.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => selectTemplate(t)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition",
                        selectedId === t.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-secondary/50",
                      )}
                    >
                      <span className="truncate">{t.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        Starter
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Editor */}
          <Card className="border-border">
            <CardContent className="p-5">
              {!selected ? (
                <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
                  Select or create a template to start editing.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <Label className="text-xs">Template name</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isStarter}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isStarter ? (
                        <Button onClick={() => duplicateStarter(selected)} className="gap-2">
                          <Plus className="h-4 w-4" /> Duplicate to edit
                        </Button>
                      ) : (
                        <>
                          <Button variant="outline" onClick={setDefault} disabled={selected.is_default}>
                            <Star className="mr-1 h-4 w-4" />
                            {selected.is_default ? "Default" : "Set default"}
                          </Button>
                          <Button variant="outline" onClick={deleteTemplate} className="gap-1">
                            <Trash2 className="h-4 w-4" /> Delete
                          </Button>
                          <Button onClick={save} disabled={saving}>
                            {saving ? "Saving..." : "Save"}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Insert merge field</Label>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {MERGE_FIELDS.map((f) => (
                        <button
                          key={f}
                          onClick={() => insertField(f)}
                          disabled={isStarter}
                          className="rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-xs hover:bg-secondary disabled:opacity-50"
                          type="button"
                        >
                          {`{{${f}}}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Tabs defaultValue="edit">
                    <TabsList>
                      <TabsTrigger value="edit">Markdown</TabsTrigger>
                      <TabsTrigger value="preview">Preview (sample data)</TabsTrigger>
                    </TabsList>
                    <TabsContent value="edit" className="mt-3">
                      <Textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={18}
                        disabled={isStarter}
                        className="font-mono text-sm"
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Supports **bold**, *italic*, # headings, - lists, and | tables |.
                      </p>
                    </TabsContent>
                    <TabsContent value="preview" className="mt-3">
                      <div
                        className="qt-preview rounded-md border border-border bg-card p-4 text-sm text-foreground"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
