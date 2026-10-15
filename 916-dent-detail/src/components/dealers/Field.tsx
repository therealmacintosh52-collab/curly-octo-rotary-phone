import type { ReactNode } from 'react';

/** Label + control + hint + error wired with aria-describedby. `children` receives the ids to put on the control. */
export function Field({ id, label, hint, error, required, children }: { id: string; label: string; hint?: string; error?: string; required?: boolean; children: (p: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; 'aria-required'?: boolean }) => ReactNode }) {
  const desc = [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="dl-label">{label}{required && <span aria-hidden="true" className="text-gold"> *</span>}{!required && <span className="font-normal text-steel"> (optional)</span>}</label>
      {children({ id, 'aria-describedby': desc, 'aria-invalid': error ? true : undefined, 'aria-required': required || undefined })}
      {hint && <p id={`${id}-hint`} className="dl-hint">{hint}</p>}
      {error && <p id={`${id}-err`} className="dl-err" aria-live="polite">{error}</p>}
    </div>
  );
}
