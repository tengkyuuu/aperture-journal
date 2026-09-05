'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { apiPost } from '@/lib/client/api';

/**
 * Rename or delete a single entry.
 *
 * ── WHY THE DELETE MATTERS ──
 * Until this existed, the only deletion in the app was "delete everything".
 * Someone who wrote something they regret had one remedy: destroy their entire
 * history. Data rights that are all-or-nothing are barely data rights.
 *
 * It asks you to type DELETE. A journal entry is not a to-do item, and a
 * mis-click should not be able to remove one — the friction is the feature.
 * The dialog says plainly that the copy on the server goes too, because for a
 * sealed entry that is the only copy there ever was.
 */
export function SessionActions({
  sessionId,
  title,
  sealed,
}: {
  sessionId: string;
  title: string | null;
  sealed: boolean;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title ?? '');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setDraft(title ?? ''), [title]);

  async function rename() {
    const next = draft.trim();
    if (!next || next === title) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost('/api/session/manage', {
        action: 'rename',
        sessionId,
        title: next,
      });
      if (!res.ok) {
        setError('That name did not save.');
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (confirm !== 'DELETE' || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost('/api/session/manage', {
        action: 'delete',
        sessionId,
        confirm,
      });
      if (!res.ok) {
        setError('Deletion did not complete. Nothing was removed.');
        setBusy(false);
        return;
      }
      dialogRef.current?.close();
      router.replace('/today');
      router.refresh();
    } catch {
      setError('Deletion did not complete. Nothing was removed.');
      setBusy(false);
    }
  }

  return (
    <div className="mt-10 flex flex-wrap items-center gap-2 border-t-[3px] border-line pt-5">
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void rename();
          }}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
        >
          <label htmlFor="rename" className="sr-only">
            Entry title
          </label>
          <input
            id="rename"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
            maxLength={120}
            className="min-w-0 flex-1 rounded-control border-[3px] border-line bg-surface px-3 py-1.5 text-[14px] outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="brut-press-sm rounded-control border-[3px] border-line bg-accent px-3 py-1.5 text-[12px] font-bold uppercase text-on-accent shadow-[3px_3px_0_0_var(--border-ink)] disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-control px-2 py-1.5 text-[12px] text-ink-3 hover:text-ink"
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          {/* A sealed entry has no title by design — sealing deleted it — so
              there is nothing to rename without leaking a description of
              encrypted content in plaintext. */}
          {!sealed ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="brut-press-sm rounded-control border-[3px] border-line bg-surface px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-ink shadow-[3px_3px_0_0_var(--border-ink)]"
            >
              Rename
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setConfirm('');
              setError(null);
              dialogRef.current?.showModal();
            }}
            className="brut-press-sm ml-auto rounded-control border-[3px] border-line bg-surface px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-danger shadow-[3px_3px_0_0_var(--border-ink)]"
          >
            Delete entry
          </button>
        </>
      )}

      {error && !dialogRef.current?.open ? (
        <p role="alert" className="w-full text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-label="Delete this entry"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="m-0 w-full max-w-md rounded-sheet brut bg-elevated p-0 text-ink backdrop:bg-black/50 open:animate-rise-in sm:mx-auto sm:mt-[14vh]"
      >
        <div className="flex flex-col gap-4 p-6">
          <div>
            <span className="chip-brut bg-danger">Cannot be undone</span>
            <h2 className="mt-3 text-[22px] font-bold uppercase leading-tight">Delete this entry</h2>
          </div>

          <p className="text-[13.5px] leading-relaxed text-ink-2">
            The entry, its messages and its summary are removed from the server permanently.
            {sealed
              ? ' This entry is sealed, so the copy here is the only copy that has ever existed.'
              : ' Export first if you might want it back.'}
          </p>

          <div className="flex flex-col gap-2">
            <label htmlFor="confirm-del" className="label">
              Type DELETE to confirm
            </label>
            <input
              id="confirm-del"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="DELETE"
              className="rounded-control border-[3px] border-line bg-surface px-3 py-2 font-mono text-[13px] outline-none"
            />
          </div>

          {error ? (
            <p role="alert" className="animate-shake text-[13px] font-medium text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-control px-3 py-2 text-[13px] text-ink-3 hover:text-ink"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={confirm !== 'DELETE' || busy}
              className="brut-press-sm rounded-control border-[3px] border-line bg-danger px-4 py-2 text-[12px] font-bold uppercase tracking-wide text-[#111111] shadow-[3px_3px_0_0_var(--border-ink)] disabled:pointer-events-none disabled:opacity-30"
            >
              {busy ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
