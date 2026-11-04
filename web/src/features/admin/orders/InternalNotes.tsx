import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { InternalNoteDto } from '@painter/shared';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Icon } from '../../../components/ui/Icon';
import { Textarea } from '../../../components/ui/Inputs';
import { useErrorMessage } from '../../../components/ui/States';
import { useToast } from '../../../components/ui/Toast';
import { formatDateTime } from '../../../lib/format';
import { useLocale } from '../../../lib/i18n';
import { useAddNote } from '../hooks';

/** Notes only the artist sees — visually distinct from the customer thread (PROMPT.md §10). */
export function InternalNotes({ orderId, notes }: { orderId: string; notes: InternalNoteDto[] }) {
  const { t } = useTranslation('admin');
  const locale = useLocale();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const add = useAddNote(orderId);
  const [body, setBody] = useState('');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    add.mutate(text, { onSuccess: () => setBody(''), onError: (error) => toast.error(errorMessage(error)) });
  }

  return (
    <section aria-labelledby="notes-title" className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-dashed border-status-amber/60 bg-status-amber/5 p-5">
      <div className="flex flex-col gap-1">
        <h2 id="notes-title" className="font-sans text-lg font-semibold">
          {t('notes.title')}
        </h2>
        <p className="flex items-center gap-2 text-sm text-status-amber">
          <Icon name="lock" size={16} />
          {t('notes.onlyAdmins')}
        </p>
      </div>
      {notes.length ? (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id} className="flex flex-col gap-1">
              <p className="whitespace-pre-line">{note.body}</p>
              <span className="text-xs text-text-subtle">{formatDateTime(note.createdAt, locale)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">{t('notes.empty')}</p>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field label={t('notes.add')}>
          {(p) => <Textarea {...p} rows={3} value={body} onChange={(e) => setBody(e.target.value)} />}
        </Field>
        <Button type="submit" variant="secondary" size="sm" loading={add.isPending} disabled={!body.trim()} className="self-start">
          {t('notes.save')}
        </Button>
      </form>
    </section>
  );
}
