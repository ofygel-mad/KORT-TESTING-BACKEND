/**
 * Export data to a CSV file that opens correctly in Excel.
 * BOM (\uFEFF) ensures UTF-8 encoding is recognized by Excel.
 */
export function exportToCSV(data: Record<string, string | number | null | undefined>[], filename: string) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const rows = [
    keys.join(';'),
    ...data.map(row =>
      keys.map(k => {
        const val = row[k] ?? '';
        const str = String(val);
        // Quote if contains delimiter, quotes or newlines
        return str.includes(';') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(';')
    ),
  ];
  const csv = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
