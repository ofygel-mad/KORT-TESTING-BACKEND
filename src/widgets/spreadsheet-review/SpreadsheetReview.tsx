import { useMemo } from 'react';
import s from './SpreadsheetReview.module.css';

export function SpreadsheetReview({ preview }: { preview: any }) {
  const suggestions = useMemo(() => preview?.preview_payload?.mapping_suggestions ?? [], [preview]);
  const sheets = preview?.preview_payload?.sheets ?? [];
  if (!preview) return null;
  return (
    <div className={s.root}>
      <section className={s.panel}>
        <h3 className={s.title}>Source preview</h3>
        {sheets.map((sheet: any) => (
          <div key={sheet.sheet_name} className={s.sheet}>
            <div className={s.sheetName}>{sheet.sheet_name}</div>
          </div>
        ))}
      </section>
      <section className={s.panel}>
        <h3 className={s.title}>Kort interpretation</h3>
        {suggestions.map((item: any) => (
          <div key={item.column_key} className={s.mappingRow}>
            <div className={s.columnKey}>{item.column_key}</div>
            <div className={s.mappingMeta}>{item.target_entity}.{item.target_field}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
