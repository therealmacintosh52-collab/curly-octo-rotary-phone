'use client';
// Client form helpers around server actions: pending state, inline error/success, optional confirm.
import { useActionState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

export type ActionResult = { error?: string; message?: string; ok?: boolean };
export type ServerAction = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

export function SubmitButton({ children, className = 'adm-btn adm-btn-gold', pendingText = 'Saving…', name, value, confirm }: {
  children: ReactNode; className?: string; pendingText?: string; name?: string; value?: string; confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit" name={name} value={value} disabled={pending} className={className}
      onClick={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function ActionForm({ action, children, submit, className = 'space-y-4', submitClass, secondary }: {
  action: ServerAction; children: ReactNode; submit?: string; className?: string; submitClass?: string; secondary?: ReactNode;
}) {
  const [state, formAction] = useActionState(action, {} as ActionResult);
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error && <p role="alert" className="rounded-xl border border-[#8a3b3b] bg-[#231212] px-3 py-2 text-sm text-[#f6b4b4]">{state.error}</p>}
      {state.message && <p role="status" className="rounded-xl border border-[#2f6b49] bg-[#0f2017] px-3 py-2 text-sm text-[#a6e8c0]">{state.message}</p>}
      {(submit || secondary) && (
        <div className="flex flex-wrap items-center gap-2">
          {submit && <SubmitButton className={submitClass ?? 'adm-btn adm-btn-gold w-full sm:w-auto'}>{submit}</SubmitButton>}
          {secondary}
        </div>
      )}
    </form>
  );
}

/** A one-button form (e.g. "Mark reviewed") without result UI beyond an alert. */
export function ActionButton({ action, children, className = 'adm-btn adm-btn-line', confirm, hidden = {} }: {
  action: ServerAction; children: ReactNode; className?: string; confirm?: string; hidden?: Record<string, string>;
}) {
  const [state, formAction] = useActionState(action, {} as ActionResult);
  return (
    <form action={formAction} className="contents">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton className={className} confirm={confirm}>{children}</SubmitButton>
      {state.error && <p role="alert" className="basis-full text-sm text-[#f6b4b4]">{state.error}</p>}
      {state.message && <p role="status" className="basis-full text-sm text-[#a6e8c0]">{state.message}</p>}
    </form>
  );
}
