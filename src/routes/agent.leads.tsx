import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Inbox, LayoutGrid, List, Plus } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { LeadCard } from "@/components/agent/LeadCard";
import { LeadDetailPanel } from "@/components/agent/LeadDetailPanel";
import { SendQuoteDialog } from "@/components/agent/SendQuoteDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Shimmer, LeadCardSkeleton } from "@/components/ui/skeletons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  AGE_COLORS,
  KANBAN_COLUMNS,
  LEAD_STATUS_LABEL,
  ageBucket,
  ageLabel,
  type Lead,
  type LeadStatus,
} from "@/lib/leads";

export const Route = createFileRoute("/agent/leads")({
  head: () => ({
    meta: [
      { title: "Leads - Safar Agent" },
      { name: "description", content: "Track and manage pilgrim leads in your sales pipeline." },
    ],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  return (
    <ProtectedRoute requireRole="agent">
      <LeadsContent />
    </ProtectedRoute>
  );
}

type ViewMode = "kanban" | "list";

function LeadsContent() {
  const { agent } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("kanban");
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [draggingLead, setDraggingLead] = useState<Lead | null>(null);
  const [quoteFor, setQuoteFor] = useState<Lead | null>(null);
  const [newLeadIds, setNewLeadIds] = useState<Set<string>>(new Set());
  const newLeadTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function load() {
    if (!agent) return;
    setLoading(true);
    // Fields: Kanban + list view need card-level data only. The slide-over panel
    //   fetches RFQ details, quotes, notes, and messages on demand.
    const { data, error } = await supabase
      .from("leads")
      .select(
        "id, agent_id, rfq_id, pilgrim_id, status, pilgrim_name, trip_type, departure_date, group_size, budget_range, score, created_at, first_response_at, source, snoozed_until, tags, source_detail, lost_reason, updated_at",
      )
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false })
      .range(0, 199);
    if (error) {
      toast.error("Could not load leads");
    } else {
      setLeads((data ?? []) as Lead[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id]);

  // Realtime: new leads animate in, updates merge in place
  useEffect(() => {
    if (!agent?.id) return;
    const channel = supabase
      .channel(`agent-leads-${agent.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads", filter: `agent_id=eq.${agent.id}` },
        (payload) => {
          const lead = payload.new as Lead;
          setLeads((prev) => (prev.some((l) => l.id === lead.id) ? prev : [lead, ...prev]));
          setNewLeadIds((prev) => new Set(prev).add(lead.id));
          const t = setTimeout(() => {
            setNewLeadIds((prev) => {
              const next = new Set(prev);
              next.delete(lead.id);
              return next;
            });
            newLeadTimers.current.delete(lead.id);
          }, 4000);
          newLeadTimers.current.set(lead.id, t);
          toast.success(`New lead: ${lead.pilgrim_name || "Anonymous"}`);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads", filter: `agent_id=eq.${agent.id}` },
        (payload) => {
          const lead = payload.new as Lead;
          setLeads((prev) => prev.map((l) => (l.id === lead.id ? lead : l)));
        },
      )
      .subscribe();
    return () => {
      newLeadTimers.current.forEach((t) => clearTimeout(t));
      newLeadTimers.current.clear();
      supabase.removeChannel(channel);
    };
  }, [agent?.id]);

  const grouped = useMemo(() => {
    const map: Record<LeadStatus, Lead[]> = {
      new: [],
      contacted: [],
      quote_sent: [],
      awaiting_deposit: [],
      confirmed: [],
      completed: [],
      lost: [],
    };
    for (const l of leads) map[l.status]?.push(l);
    return map;
  }, [leads]);

  function handleDragStart(e: DragStartEvent) {
    const lead = leads.find((l) => l.id === e.active.id);
    if (lead) setDraggingLead(lead);
  }

  async function handleDragEnd(e: DragEndEvent) {
    setDraggingLead(null);
    const { active, over } = e;
    if (!over) return;
    const lead = leads.find((l) => l.id === active.id);
    if (!lead) return;

    // `over.id` can be either a column status (when dropping on empty column
    // space) or another lead's UUID (when hovering over a card). Resolve to
    // the target column in both cases.
    const overId = String(over.id);
    let next: LeadStatus | null = null;
    if ((KANBAN_COLUMNS as readonly string[]).includes(overId)) {
      next = overId as LeadStatus;
    } else {
      const overLead = leads.find((l) => l.id === overId);
      if (overLead) next = overLead.status;
    }
    if (!next || lead.status === next) return;

    const previous = lead.status;
    // optimistic
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: next! } : l)));
    const { error } = await supabase.from("leads").update({ status: next }).eq("id", lead.id);
    if (error) {
      toast.error("Could not move lead - reverted");
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: previous } : l)));
    } else {
      toast.success(`Moved to ${LEAD_STATUS_LABEL[next]}`);
    }
  }

  return (
    <DashboardLayout variant="agent" title="Leads">
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Pilgrim leads</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Drag leads between columns as they move through your pipeline.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm">
              {leads.length} total
            </Badge>
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => v && setView(v as ViewMode)}
            >
              <ToggleGroupItem value="kanban" aria-label="Kanban">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="List">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {KANBAN_COLUMNS.slice(0, 4).map((s) => (
              <div key={s} className="w-72 shrink-0 space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
                <Shimmer className="h-4 w-24" />
                <LeadCardSkeleton />
                <LeadCardSkeleton />
              </div>
            ))}
          </div>
        ) : leads.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-7 w-7" />}
            title="No leads yet"
            description="Make sure your packages are active and match common departure countries. Leads will appear here as pilgrims request quotes."
            action={
              <Button asChild>
                <a href="/agent/packages/new">
                  <Plus className="h-4 w-4" /> Create a package
                </a>
              </Button>
            }
          />
        ) : view === "kanban" ? (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:snap-none sm:px-0">
              {KANBAN_COLUMNS.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  leads={grouped[status]}
                  newLeadIds={newLeadIds}
                  onCardClick={setActiveLead}
                />
              ))}
            </div>
            <DragOverlay>
              {draggingLead ? (
                <LeadCard lead={draggingLead} onClick={() => {}} isOverlay />
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <ListView leads={leads} onRowClick={setActiveLead} />
        )}
      </div>

      <LeadDetailPanel
        lead={activeLead}
        onClose={() => setActiveLead(null)}
        onChanged={load}
        onSendQuote={() => {
          if (activeLead) setQuoteFor(activeLead);
        }}
      />

      {quoteFor && quoteFor.rfq_id && agent ? (
        <SendQuoteDialog
          rfqId={quoteFor.rfq_id}
          agentId={agent.id}
          title="Send a quote"
          description={`${quoteFor.pilgrim_name || "Pilgrim"} · ${quoteFor.trip_type ?? ""}`}
          onClose={() => setQuoteFor(null)}
          onSent={() => {
            setQuoteFor(null);
            load();
          }}
        />
      ) : null}
    </DashboardLayout>
  );
}

function KanbanColumn({
  status,
  leads,
  newLeadIds,
  onCardClick,
}: {
  status: LeadStatus;
  leads: Lead[];
  newLeadIds: Set<string>;
  onCardClick: (lead: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[80vw] max-w-[18rem] shrink-0 snap-start flex-col rounded-lg border border-border bg-secondary/30 p-3 transition sm:w-72 sm:snap-align-none",
        isOver && "border-primary bg-primary/5",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{LEAD_STATUS_LABEL[status]}</h3>
        <Badge variant="outline" className="text-xs">
          {leads.length}
        </Badge>
      </div>
      <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2">
          {leads.map((lead) => (
            <div
              key={lead.id}
              className={cn(newLeadIds.has(lead.id) && "animate-in fade-in slide-in-from-top-2")}
            >
              <LeadCard lead={lead} onClick={() => onCardClick(lead)} />
            </div>
          ))}
          {leads.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No leads</p>
          ) : null}
        </div>
      </SortableContext>
    </div>
  );
}

function ListView({ leads, onRowClick }: { leads: Lead[]; onRowClick: (l: Lead) => void }) {
  const [sortKey, setSortKey] = useState<"created_at" | "departure_date" | "status">("created_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...leads];
    copy.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [leads, sortKey, dir]);

  function toggle(key: typeof sortKey) {
    if (sortKey === key) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setDir("desc");
    }
  }

  return (
    <Card className="border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pilgrim</TableHead>
            <TableHead>Trip</TableHead>
            <TableHead onClick={() => toggle("departure_date")} className="cursor-pointer">
              Departure
            </TableHead>
            <TableHead>Group</TableHead>
            <TableHead>Budget</TableHead>
            <TableHead onClick={() => toggle("status")} className="cursor-pointer">
              Status
            </TableHead>
            <TableHead onClick={() => toggle("created_at")} className="cursor-pointer">
              Age
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((lead) => {
            const bucket = ageBucket(lead.created_at);
            return (
              <TableRow
                key={lead.id}
                className="cursor-pointer"
                onClick={() => onRowClick(lead)}
              >
                <TableCell className="font-medium">{lead.pilgrim_name || "Anonymous"}</TableCell>
                <TableCell className="capitalize">{lead.trip_type ?? "-"}</TableCell>
                <TableCell>
                  {lead.departure_date
                    ? new Date(lead.departure_date).toLocaleDateString()
                    : "-"}
                </TableCell>
                <TableCell>{lead.group_size ?? "-"}</TableCell>
                <TableCell className="max-w-[180px] truncate">{lead.budget_range ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{LEAD_STATUS_LABEL[lead.status]}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("text-[10px]", AGE_COLORS[bucket])}>
                    {ageLabel(lead.created_at)}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
