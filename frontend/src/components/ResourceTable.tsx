"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { EmptyState, ErrorState } from "./StatCard";

export function ResourceTable<T extends Record<string, unknown>>({
  path,
  columns,
  pick,
}: {
  path: string;
  columns: Array<{ key: string; label: string }>;
  pick?: (raw: unknown) => T[];
}) {
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<unknown>(path)
      .then((data) => {
        if (pick) setRows(pick(data));
        else if (Array.isArray(data)) setRows(data as T[]);
        else if (data && typeof data === "object" && "items" in data) setRows((data as { items: T[] }).items);
        else setRows([]);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [path, pick]);

  if (error) return <ErrorState message={error} />;
  if (loading) return <div className="text-sm text-slate-500">Loading…</div>;
  if (!rows.length) return <EmptyState title="No records" body="Nothing to display for this view yet." />;

  return (
    <div className="card table-wrap">
      <table className="data">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id ?? i)}>
              {columns.map((c) => (
                <td key={c.key}>{formatCell(row[c.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
