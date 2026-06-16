import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { listAllUpdates, severityClasses, type RegulatoryUpdate } from "@/lib/regulatory";
import { Trash2, Plus, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/regulatory")({
  head: () => ({
    meta: [{ title: "Regulatory Updates - Admin" }],
  }),
  component: RegulatoryAdminPage,
});

function RegulatoryAdminPage() {
  const [items, setItems] = useState<RegulatoryUpdate[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [countriesInput, setCountriesInput] = useState("");
  const [severity, setSeverity] = useState<"info" | "warning" | "critical">("info");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    listAllUpdates().then(setItems).catch(() => null);
  }

  async function publish() {
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    setSubmitting(true);
    const countries = countriesInput
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    const { error } = await supabase.from("regulatory_updates").insert({
      title: title.trim(),
      body,
      countries,
      severity,
      published_at: new Date().toISOString(),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Published");
      setTitle("");
      setBody("");
      setCountriesInput("");
      setSeverity("info");
      refresh();
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("regulatory_updates").delete().eq("id", id);
    if (error) toast.error(error.message);
    else refresh();
  }

  async function togglePublished(u: RegulatoryUpdate) {
    const { error } = await supabase
      .from("regulatory_updates")
      .update({ published_at: u.published_at ? null : new Date().toISOString() })
      .eq("id", u.id);
    if (error) toast.error(error.message);
    else refresh();
  }

  return (
    <AdminLayout title="Regulatory Updates">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> Publish a new update</CardTitle>
            <CardDescription>Visible to agents in matching countries on their dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="mt-1" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Countries (comma-separated ISO codes, blank = all)</Label>
                <Input
                  value={countriesInput}
                  onChange={(e) => setCountriesInput(e.target.value)}
                  placeholder="GB, US, PK"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Severity</Label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={publish} disabled={submitting}>
                <Send className="h-4 w-4" /> Publish
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All updates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No updates yet.
              </p>
            ) : (
              items.map((u) => (
                <div
                  key={u.id}
                  className={cn("rounded-md border p-3", severityClasses(u.severity))}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{u.title}</p>
                        <Badge variant="outline" className="text-xs uppercase">{u.severity}</Badge>
                        {u.published_at ? (
                          <Badge variant="default" className="text-xs">Published</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Draft</Badge>
                        )}
                      </div>
                      {u.body && <p className="mt-1 text-xs opacity-90">{u.body}</p>}
                      {u.countries.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {u.countries.map((c) => (
                            <span key={c} className="rounded bg-background/40 px-1.5 py-0.5 text-[10px] font-mono">
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => togglePublished(u)}>
                        {u.published_at ? "Unpublish" : "Publish"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(u.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
