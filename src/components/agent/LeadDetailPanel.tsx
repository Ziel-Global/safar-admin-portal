import { lazy, Suspense, useEffect, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Loader2, MessageSquare, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/format";
import { LEAD_STATUS_LABEL, LOST_REASONS, type Lead, type LeadStatus } from "@/lib/leads";
import { TYPE_LABEL, type RfqType } from "@/lib/rfq";

// Lazy-load the message thread — only loaded when the Messages tab is opened
const MessageThread = lazy(() =>
  import("@/components/messages/MessageThread").then((m) => ({ default: m.MessageThread })),
);

interface LeadNote {
  id: string;
  note: string;
  created_at: string;
  user_id: string;
}

interface RfqDetails {
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
}

interface QuoteSummary {
  id: string;
  price_total: number;
  price_currency: string;
  hotel_name: string | null;
  hotel_zone: string | null;
  status: string;
  created_at: string;
}

interface BookingSummary {
  id: string;
  status: string;
  trip_end: string | null;
}

interface LeadDetailPanelProps {
  lead: Lead | null;
  onClose: () => void;
  onChanged: () => void;
  onSendQuote: () => void;
}

export function LeadDetailPanel({ lead, onClose, onChanged, onSendQuote }: LeadDetailPanelProps) {
  const { user } = useAuth();
  const [rfq, setRfq] = useState<RfqDetails | null>(null);
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [completing, setCompleting] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLostReason, setShowLostReason] = useState(false);
  const [lostReason, setLostReason] = useState<string>("");

  useEffect(() => {
    if (!lead) return;
    setShowLostReason(false);
    setLostReason("");
    setBooking(null);
    setLoading(true);
    (async () => {
      const [rfqRes, quotesRes, notesRes, bookingRes] = await Promise.all([
        lead.rfq_id
          ? supabase
              .from("rfqs")
              .select(
                "id, type, departure_city, departure_country, date_from, date_to, adults, children, budget_min, budget_max, budget_currency, zone_pref, meal_pref, transport_pref, notes",
              )
              .eq("id", lead.rfq_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        lead.rfq_id
          ? supabase
              .from("quotes")
              .select("id, price_total, price_currency, hotel_name, hotel_zone, status, created_at")
              .eq("rfq_id", lead.rfq_id)
              .eq("agent_id", lead.agent_id)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
        supabase
          .from("lead_notes")
          .select("id, note, created_at, user_id")
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: false }),
        lead.rfq_id
          ? supabase
              .from("bookings")
              .select("id, status, trip_end")
              .eq("rfq_id", lead.rfq_id)
              .eq("agent_id", lead.agent_id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setRfq((rfqRes.data as RfqDetails | null) ?? null);
      setQuotes((quotesRes.data as QuoteSummary[] | null) ?? []);
      setNotes((notesRes.data as LeadNote[] | null) ?? []);
      setBooking((bookingRes.data as BookingSummary | null) ?? null);
      setLoading(false);
    })();
  }, [lead]);

  async function addNote() {
    if (!lead || !user || !newNote.trim()) return;
    setSavingNote(true);
    const { data, error } = await supabase
      .from("lead_notes")
      .insert({ lead_id: lead.id, user_id: user.id, note: newNote.trim() })
      .select("id, note, created_at, user_id")
      .single();
    setSavingNote(false);
    if (error) {
      toast.error("Could not save note");
      return;
    }
    setNotes((prev) => [data as LeadNote, ...prev]);
    setNewNote("");
  }

  async function markAsLost() {
    if (!lead) return;
    if (!lostReason) {
      toast.error("Pick a reason");
      return;
    }
    const { error } = await supabase
      .from("leads")
      .update({ status: "lost", lost_reason: lostReason })
      .eq("id", lead.id);
    if (error) {
      toast.error("Could not update lead");
      return;
    }
    toast.success("Marked as lost");
    onChanged();
    onClose();
  }

  async function changeStatus(next: LeadStatus) {
    if (!lead) return;
    const { error } = await supabase.from("leads").update({ status: next }).eq("id", lead.id);
    if (error) {
      toast.error("Could not update status");
      return;
    }
    toast.success(`Moved to ${LEAD_STATUS_LABEL[next]}`);
    onChanged();
  }

  async function markTripCompleted() {
    if (!booking) return;
    setCompleting(true);
    // Back-date trip_end to yesterday so the pilgrim's review CTA becomes
    // available immediately (the review flow requires the trip to have ended).
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "completed", trip_end: yesterday })
      .eq("id", booking.id);
    setCompleting(false);
    if (error) {
      toast.error("Could not complete trip", { description: error.message });
      return;
    }
    toast.success("Trip marked completed — the pilgrim can now leave a review");
    setBooking({ ...booking, status: "completed", trip_end: yesterday });
    onChanged();
  }

  return (
    <Sheet open={!!lead} onOpenChange={(o) => (!o ? onClose() : null)}>

      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {lead ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {lead.pilgrim_name || "Anonymous"}
                <Badge variant="outline">{LEAD_STATUS_LABEL[lead.status]}</Badge>
              </SheetTitle>
              <SheetDescription>
                {lead.trip_type ? TYPE_LABEL[lead.trip_type as RfqType] : "Trip"} ·{" "}
                {format(new Date(lead.created_at), "PP")}
              </SheetDescription>
            </SheetHeader>

            <Tabs defaultValue="details" className="mt-6">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="messages" disabled={!lead.rfq_id}>
                  Messages
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-4 space-y-6">
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : rfq ? (
                  <section>
                    <h4 className="text-sm font-semibold text-foreground">Trip details</h4>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">From</dt>
                        <dd>
                          {rfq.departure_city}, {rfq.departure_country}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Dates</dt>
                        <dd>
                          {rfq.date_from ?? "Any"} → {rfq.date_to ?? "Any"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Group</dt>
                        <dd>
                          {rfq.adults} adult{rfq.adults > 1 ? "s" : ""}
                          {rfq.children > 0 ? `, ${rfq.children} child` : ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Budget</dt>
                        <dd>
                          {formatPrice(rfq.budget_min ?? 0, rfq.budget_currency)} –{" "}
                          {formatPrice(rfq.budget_max ?? 0, rfq.budget_currency)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Zone</dt>
                        <dd className="capitalize">{rfq.zone_pref}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Meals</dt>
                        <dd className="capitalize">{rfq.meal_pref}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Transport</dt>
                        <dd className="capitalize">{rfq.transport_pref}</dd>
                      </div>
                    </dl>
                    {rfq.notes ? (
                      <p className="mt-3 rounded-md bg-secondary/50 p-2 text-xs text-foreground/80">
                        “{rfq.notes}”
                      </p>
                    ) : null}
                  </section>
                ) : (
                  <p className="text-sm text-muted-foreground">RFQ no longer available.</p>
                )}

                <section>
                  <h4 className="text-sm font-semibold text-foreground">
                    Your quotes ({quotes.length})
                  </h4>
                  {quotes.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      No quote sent for this RFQ yet.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {quotes.map((q) => (
                        <li
                          key={q.id}
                          className="rounded-md border border-border bg-card p-2 text-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {formatPrice(q.price_total, q.price_currency)}
                            </span>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {q.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {q.hotel_name ?? "-"}{" "}
                            {q.hotel_zone ? <span>· Zone {q.hotel_zone}</span> : null}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <MessageSquare className="h-4 w-4" /> Notes
                  </h4>
                  <div className="mt-2 space-y-2">
                    <Textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      rows={2}
                      placeholder="Add a private note..."
                    />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={addNote} disabled={savingNote || !newNote.trim()}>
                        {savingNote ? "Saving..." : "Add note"}
                      </Button>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {notes.map((n) => (
                      <li
                        key={n.id}
                        className="rounded-md border border-border bg-secondary/30 p-2 text-sm"
                      >
                        <p className="whitespace-pre-wrap text-foreground/90">{n.note}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {format(new Date(n.created_at), "PPp")}
                        </p>
                      </li>
                    ))}
                    {notes.length === 0 ? (
                      <li className="text-xs text-muted-foreground">No notes yet.</li>
                    ) : null}
                  </ul>
                </section>

                <section className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={onSendQuote} className="gap-2">
                      <Send className="h-4 w-4" /> Send Quote
                    </Button>
                    {lead.status !== "contacted" ? (
                      <Button variant="outline" onClick={() => changeStatus("contacted")}>
                        Mark contacted
                      </Button>
                    ) : null}
                    {lead.status !== "lost" ? (
                      <Button variant="outline" onClick={() => setShowLostReason((s) => !s)}>
                        <X className="mr-1 h-4 w-4" /> Mark as Lost
                      </Button>
                    ) : null}
                    {booking && booking.status !== "completed" ? (
                      <Button
                        variant="outline"
                        onClick={markTripCompleted}
                        disabled={completing}
                        className="gap-2"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {completing ? "Completing..." : "Mark trip completed"}
                      </Button>
                    ) : null}
                  </div>
                  {booking?.status === "completed" ? (
                    <p className="text-xs text-emerald-600">
                      Trip completed — the pilgrim can now leave a review.
                    </p>
                  ) : null}
                  {showLostReason ? (
                    <div className="flex items-end gap-2 rounded-md border border-border p-3">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">Reason</label>
                        <Select value={lostReason} onValueChange={setLostReason}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select a reason" />
                          </SelectTrigger>
                          <SelectContent>
                            {LOST_REASONS.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button variant="destructive" onClick={markAsLost}>
                        Confirm lost
                      </Button>
                    </div>
                  ) : null}
                </section>
                </TabsContent>

              <TabsContent value="messages" className="mt-4">
                {lead.rfq_id ? (
                  <Suspense
                    fallback={
                      <div className="flex items-center justify-center py-10 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    }
                  >
                    <MessageThread
                      rfqId={lead.rfq_id}
                      viewerType="agent"
                      emptyHint="Start the conversation - pilgrims appreciate a warm intro before pricing."
                    />
                  </Suspense>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This lead isn't linked to an RFQ, so messaging isn't available.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
