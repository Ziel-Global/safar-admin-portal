import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowLeft, BadgeCheck, Calendar, MapPin, Pencil, Star, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageThread } from "@/components/messages/MessageThread";

import { supabase } from "@/integrations/supabase/client";
import { formatPrice, trustLabel, ZONE_STYLES } from "@/lib/format";
import { RFQ_STATUS_LABEL, TYPE_LABEL, type RfqType } from "@/lib/rfq";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/rfqs/$id")({
  head: () => ({
    meta: [
      { title: "Request Details - Safar" },
      { name: "description", content: "View your quote request and compare incoming agent offers." },
    ],
  }),
  component: RfqDetailPage,
});

interface Rfq {
  id: string;
  type: RfqType;
  departure_city: string;
  departure_country: string;
  date_from: string | null;
  date_to: string | null;
  adults: number;
  children: number;
  budget_min: number | null;
  budget_max: number | null;
  budget_currency: string;
  zone_pref: string;
  meal_pref: string;
  transport_pref: string;
  notes: string | null;
  status: string;
  matched_agents: number;
  expires_at: string;
  created_at: string;
}

interface Quote {
  id: string;
  rfq_id: string;
  agent_id: string;
  package_id: string | null;
  price_total: number;
  price_currency: string;
  hotel_name: string | null;
  hotel_zone: string | null;
  valid_until: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  agents: {
    business_name: string;
    slug: string | null;
    avg_rating: number;
    trust_score: number;
    verification_level: string;
  } | null;
}

function RfqDetailPage() {
  return (
    <ProtectedRoute requireRole="pilgrim">
      <RfqDetailContent />
    </ProtectedRoute>
  );
}

function RfqDetailContent() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    date_from: "",
    date_to: "",
    budget_min: "",
    budget_max: "",
    notes: "",
  });

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [rfqRes, quotesRes] = await Promise.all([
        supabase.from("rfqs").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("quotes")
          .select(
            "id, rfq_id, agent_id, package_id, price_total, price_currency, hotel_name, hotel_zone, valid_until, status, notes, created_at, agents(business_name, slug, avg_rating, trust_score, verification_level)",
          )
          .eq("rfq_id", id)
          .order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      if (rfqRes.error || !rfqRes.data) {
        toast.error("Request not found");
        navigate({ to: "/dashboard" });
        return;
      }
      setRfq(rfqRes.data as unknown as Rfq);
      setQuotes((quotesRes.data ?? []) as unknown as Quote[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id, navigate]);

  useEffect(() => {
    const channel = supabase
      .channel(`rfq-quotes-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "quotes",
          filter: `rfq_id=eq.${id}`,
        },
        async (payload) => {
          const newQuote = payload.new as { id: string; agent_id: string };
          // Refetch the new quote with joined agent info
          const { data } = await supabase
            .from("quotes")
            .select(
              "id, rfq_id, agent_id, package_id, price_total, price_currency, hotel_name, hotel_zone, valid_until, status, notes, created_at, agents(business_name, slug, avg_rating, trust_score, verification_level)",
            )
            .eq("id", newQuote.id)
            .maybeSingle();
          if (data) {
            const q = data as unknown as Quote;
            setQuotes((prev) =>
              prev.some((x) => x.id === q.id) ? prev : [q, ...prev],
            );
            toast.success(
              `New quote received from ${q.agents?.business_name ?? "an agent"}!`,
            );
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function acceptQuote(q: Quote) {
    const { error } = await supabase
      .from("quotes")
      .update({ status: "accepted" })
      .eq("id", q.id);
    if (error) {
      toast.error("Could not accept");
      return;
    }
    await supabase.from("rfqs").update({ status: "booked" }).eq("id", id);
    toast.success("Quote accepted - the agent will contact you shortly");
    setQuotes((prev) => prev.map((x) => (x.id === q.id ? { ...x, status: "accepted" } : x)));
    setRfq((r) => (r ? { ...r, status: "booked" } : r));
  }

  function openEdit() {
    if (!rfq) return;
    setEditForm({
      date_from: rfq.date_from ?? "",
      date_to: rfq.date_to ?? "",
      budget_min: rfq.budget_min != null ? String(rfq.budget_min) : "",
      budget_max: rfq.budget_max != null ? String(rfq.budget_max) : "",
      notes: rfq.notes ?? "",
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!rfq) return;
    setSaving(true);
    const payload = {
      date_from: editForm.date_from || null,
      date_to: editForm.date_to || null,
      budget_min: editForm.budget_min ? Number(editForm.budget_min) : null,
      budget_max: editForm.budget_max ? Number(editForm.budget_max) : null,
      notes: editForm.notes || null,
    };
    const { error } = await supabase.from("rfqs").update(payload).eq("id", rfq.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save changes");
      return;
    }
    setRfq({ ...rfq, ...payload });
    setEditOpen(false);
    toast.success("Request updated");
  }

  async function cancelRfq() {
    if (!rfq) return;
    const { error } = await supabase.from("rfqs").update({ status: "cancelled" }).eq("id", rfq.id);
    if (error) {
      toast.error("Could not cancel request");
      return;
    }
    setRfq({ ...rfq, status: "cancelled" });
    setCancelOpen(false);
    toast.success("Request cancelled");
  }

  const canEdit = rfq ? !["booked", "cancelled", "expired"].includes(rfq.status) : false;

  return (
    <DashboardLayout variant="pilgrim" title="Request Details">
      <div className="mx-auto w-full max-w-6xl">
        <Button variant="ghost" size="sm" asChild className="mb-4 gap-2">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
        </Button>

        {loading || !rfq ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            <Card className="border-border">
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn("border", RFQ_STATUS_LABEL[rfq.status]?.tone)}
                      >
                        {RFQ_STATUS_LABEL[rfq.status]?.label ?? rfq.status}
                      </Badge>
                      <Badge variant="outline">{TYPE_LABEL[rfq.type]}</Badge>
                    </div>
                    <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground">
                      {rfq.departure_city} → Makkah & Madinah
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Sent {format(new Date(rfq.created_at), "PPP")} · Expires{" "}
                      {format(new Date(rfq.expires_at), "PPP")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        Matched agents
                      </p>
                      <p className="text-2xl font-bold text-foreground">{rfq.matched_agents}</p>
                    </div>
                    {canEdit ? (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={openEdit} className="gap-1.5">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCancelOpen(true)}
                          className="gap-1.5 text-destructive hover:text-destructive"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Cancel
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Fact icon={MapPin} label="From">
                    {rfq.departure_city}, {rfq.departure_country}
                  </Fact>
                  <Fact icon={Calendar} label="Dates">
                    {rfq.date_from ?? "Any"} → {rfq.date_to ?? "Any"}
                  </Fact>
                  <Fact icon={Users} label="Group">
                    {rfq.adults} adult{rfq.adults > 1 ? "s" : ""}
                    {rfq.children > 0 ? `, ${rfq.children} child${rfq.children > 1 ? "ren" : ""}` : ""}
                  </Fact>
                  <Fact icon={BadgeCheck} label="Budget">
                    {formatPrice(rfq.budget_min ?? 0, rfq.budget_currency)} -{" "}
                    {formatPrice(rfq.budget_max ?? 0, rfq.budget_currency)}
                  </Fact>
                </dl>
              </CardContent>
            </Card>

            <Tabs defaultValue="quotes" className="mt-8">
              <TabsList>
                <TabsTrigger value="quotes">Quotes ({quotes.length})</TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
              </TabsList>

              <TabsContent value="quotes" className="mt-4">
                {quotes.length === 0 ? (
                  <Card className="border-dashed border-border">
                    <CardContent className="p-10 text-center">
                      <p className="text-sm text-muted-foreground">
                        No quotes yet. Agents typically respond within 24-48 hours.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {quotes.map((q) => (
                      <QuoteCard key={q.id} quote={q} onAccept={() => acceptQuote(q)} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="messages" className="mt-4">
                <MessageThread
                  rfqId={rfq.id}
                  viewerType="pilgrim"
                  readOnly
                  emptyHint="No messages yet. When an agent sends you a message, it will appear here and you'll be notified."
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit request</DialogTitle>
            <DialogDescription>
              Update your dates, budget, or notes. Matched agents will see the changes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="date_from">Date from</Label>
                <Input
                  id="date_from"
                  type="date"
                  value={editForm.date_from}
                  onChange={(e) => setEditForm((f) => ({ ...f, date_from: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="date_to">Date to</Label>
                <Input
                  id="date_to"
                  type="date"
                  value={editForm.date_to}
                  onChange={(e) => setEditForm((f) => ({ ...f, date_to: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="budget_min">Budget min ({rfq?.budget_currency})</Label>
                <Input
                  id="budget_min"
                  type="number"
                  value={editForm.budget_min}
                  onChange={(e) => setEditForm((f) => ({ ...f, budget_min: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="budget_max">Budget max ({rfq?.budget_currency})</Label>
                <Input
                  id="budget_max"
                  type="number"
                  value={editForm.budget_max}
                  onChange={(e) => setEditForm((f) => ({ ...f, budget_max: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={4}
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
            <AlertDialogDescription>
              Agents will no longer be able to send you quotes for this request. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep request</AlertDialogCancel>
            <AlertDialogAction onClick={cancelRfq}>Cancel request</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}

function QuoteCard({ quote, onAccept }: { quote: Quote; onAccept: () => void }) {
  const trust = trustLabel(quote.agents?.trust_score ?? 0, quote.agents?.verification_level ?? "");
  return (
    <Card className="border-border">
      <CardContent className="flex h-full flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {quote.agents?.business_name ?? "Agent"}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline" className={cn("border", trust.className)}>
                {trust.label}
              </Badge>
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {(quote.agents?.avg_rating ?? 0).toFixed(1)}
              </span>
            </div>
          </div>
          {quote.status === "accepted" ? (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 border">
              Accepted
            </Badge>
          ) : null}
        </div>

        <p className="mt-3 text-2xl font-bold text-foreground">
          {formatPrice(quote.price_total, quote.price_currency)}
        </p>
        <p className="text-xs text-muted-foreground">total package price</p>

        <div className="mt-3 space-y-1.5 text-sm">
          {quote.hotel_name ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Hotel:</span>
              <span className="font-medium text-foreground">{quote.hotel_name}</span>
              {quote.hotel_zone ? (
                <Badge
                  variant="outline"
                  className={cn("border text-[10px]", ZONE_STYLES[quote.hotel_zone])}
                >
                  Zone {quote.hotel_zone}
                </Badge>
              ) : null}
            </div>
          ) : null}
          {quote.valid_until ? (
            <p className="text-xs text-muted-foreground">
              Valid until {format(new Date(quote.valid_until), "PPP")}
            </p>
          ) : null}
        </div>

        {quote.notes ? (
          <p className="mt-3 line-clamp-3 rounded-md bg-secondary/50 p-2 text-xs text-foreground/80">
            {quote.notes}
          </p>
        ) : null}

        <div className="mt-auto flex gap-2 pt-4">
          {quote.agents?.slug ? (
            <Button variant="outline" size="sm" asChild className="flex-1">
              <Link to="/agents/$slug" params={{ slug: quote.agents.slug }}>
                View Agent
              </Link>
            </Button>
          ) : null}
          <Button
            size="sm"
            onClick={onAccept}
            disabled={quote.status === "accepted"}
            className="flex-1"
          >
            {quote.status === "accepted" ? "Accepted" : "Accept"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
