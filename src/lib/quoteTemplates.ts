import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/format";

export interface QuoteTemplate {
  id: string;
  agent_id: string | null;
  name: string;
  design_id: number;
  html_template: string;
  merge_fields: string[];
  is_default: boolean;
  is_starter: boolean;
  created_at: string;
  updated_at: string;
}

export const MERGE_FIELDS = [
  "pilgrim_name",
  "package_name",
  "price_total",
  "hotel_name",
  "dates",
  "agent_name",
  "agent_phone",
] as const;

export type MergeFieldKey = (typeof MERGE_FIELDS)[number];

export async function listQuoteTemplates(agentId: string): Promise<QuoteTemplate[]> {
  // RLS returns starters + own templates automatically
  const { data, error } = await supabase
    .from("quote_templates")
    .select("*")
    .or(`agent_id.eq.${agentId},is_starter.eq.true`)
    .order("is_starter", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as QuoteTemplate[];
}

export function applyMergeFields(
  template: string,
  values: Partial<Record<MergeFieldKey, string | number | null>>,
): string {
  let out = template;
  for (const key of MERGE_FIELDS) {
    const raw = values[key];
    const replacement = raw === null || raw === undefined || raw === "" ? `[${key}]` : String(raw);
    out = out.replaceAll(`{{${key}}}`, replacement);
  }
  return out;
}

export function buildMergeValues(input: {
  pilgrim_name?: string | null;
  package_name?: string | null;
  price_total?: number | null;
  price_currency?: string | null;
  hotel_name?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  agent_name?: string | null;
  agent_phone?: string | null;
}): Record<MergeFieldKey, string> {
  const dates =
    input.date_from && input.date_to
      ? `${input.date_from} → ${input.date_to}`
      : input.date_from || input.date_to || "Flexible";
  const price =
    input.price_total != null && input.price_currency
      ? formatPrice(input.price_total, input.price_currency)
      : "";
  return {
    pilgrim_name: input.pilgrim_name ?? "",
    package_name: input.package_name ?? "",
    price_total: price,
    hotel_name: input.hotel_name ?? "",
    dates,
    agent_name: input.agent_name ?? "",
    agent_phone: input.agent_phone ?? "",
  };
}

/** Tiny markdown -> HTML for preview (headings, bold, italic, lists, tables, line breaks). */
export function markdownToHtml(md: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.split(/\r?\n/);
  let html = "";
  let inList = false;
  let inTable = false;
  let tableHeaderDone = false;

  const closeList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };
  const closeTable = () => {
    if (inTable) {
      html += "</tbody></table>";
      inTable = false;
      tableHeaderDone = false;
    }
  };

  const inline = (s: string) =>
    escape(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>");

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line.slice(1, -1).split("|").map((c) => c.trim());
      if (cells.every((c) => /^-+$/.test(c.replace(/:/g, "")))) {
        // separator row - skip
        tableHeaderDone = true;
        continue;
      }
      if (!inTable) {
        closeList();
        html += '<table class="qt-table"><thead><tr>';
        for (const c of cells) html += `<th>${inline(c)}</th>`;
        html += "</tr></thead><tbody>";
        inTable = true;
        continue;
      }
      if (tableHeaderDone || true) {
        html += "<tr>";
        for (const c of cells) html += `<td>${inline(c)}</td>`;
        html += "</tr>";
      }
      continue;
    }
    closeTable();

    if (/^### /.test(line)) {
      closeList();
      html += `<h3>${inline(line.slice(4))}</h3>`;
    } else if (/^## /.test(line)) {
      closeList();
      html += `<h2>${inline(line.slice(3))}</h2>`;
    } else if (/^# /.test(line)) {
      closeList();
      html += `<h1>${inline(line.slice(2))}</h1>`;
    } else if (/^[-*] /.test(line)) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline(line.slice(2))}</li>`;
    } else if (line === "") {
      closeList();
      html += "<br/>";
    } else {
      closeList();
      html += `<p>${inline(line)}</p>`;
    }
  }
  closeList();
  closeTable();
  return html;
}
