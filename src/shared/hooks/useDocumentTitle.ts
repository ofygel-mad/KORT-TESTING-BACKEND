import React, { useEffect } from 'react';

const BASE = 'KORT';

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} — ${BASE}` : BASE;
    return () => {
      document.title = BASE;
    };
  }, [title]);
}
