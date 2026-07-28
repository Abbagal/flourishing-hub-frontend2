// Shared CSV export helpers. Centralized so every export button gets the same
// comma/quote escaping — duplicated ad-hoc implementations previously drifted,
// and some (AnalyticsTab registry export, event registrants/attendees export)
// built CSV via a plain `.join(',')` with no escaping, silently corrupting
// columns whenever a name/department/venue contained a comma or quote.
export function toCsvContent(data: Record<string, any>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const escapeCell = (value: any) => {
    if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value ?? '';
  };
  return [
    headers.join(','),
    ...data.map((row) => headers.map((header) => escapeCell(row[header])).join(',')),
  ].join('\n');
}

// Builds the CSV and triggers a browser download. Returns false (without
// downloading) when there's no data, so callers can show their own toast.
export function downloadCsv(data: Record<string, any>[], filename: string): boolean {
  if (data.length === 0) return false;

  const csvContent = toCsvContent(data);
  // Excel (Windows) ignores the Blob's charset=utf-8 hint when a CSV is
  // opened by double-click — without a UTF-8 byte-order-mark at the very
  // start of the file, it falls back to the system codepage (Windows-1252),
  // turning any non-ASCII character (e.g. the "—" this app uses for empty
  // cells) into mojibake like "â€"". Prepending the BOM is what tells Excel
  // specifically (most other tools ignore or already assume UTF-8) to
  // decode the rest of the file as UTF-8.
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}
