import { Box, Typography, alpha, useTheme } from '../ui/system';
import { AppChip } from './ui/data-display';
import { AddIcon, CheckIcon, ContentCopyIcon, DeleteOutlineIcon, EditOutlinedIcon, PushPinOutlinedIcon } from '../ui/icons';
import { useMemo, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useLocalPersist } from '../hooks/useLocalPersist';
import { LS_KEYS } from '../types';
import { AppButton, AppSelect, AppTextArea, AppTextField } from './ui/controls';
import { AppDialog } from './ui/overlays';
import { PageHeader, PageLayout } from './ui/page';
import { FONT_DISPLAY, FONT_MONO, TEXT_LABEL } from '../theme';
import { trackEvent } from '../analytics/posthog';
import './planner/planner-notebook.css';
import { PlannerSavedWork } from './planner/PlannerSavedWork';

const NOTE_TAGS = ['note', 'mining', 'craft', 'route', 'missions', 'economy'];

export interface PlannerNote {
  id: string;
  title: string;
  body: string;
  tag: string;
  pinned: boolean;
  updatedAt: number;
}

const DEFAULT_NOTES: PlannerNote[] = [];

// ── Inline Markdown tokenizer ──────────────────────────────────────────────

type MdToken = { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'code'; value: string }
  | { type: 'ref-bp'; id: string }
  | { type: 'ref-res'; id: string };

function tokenizeLine(text: string): MdToken[] {
  const re = /(\*\*([^*\n]+)\*\*)|(_([^_\n]+)_)|(`([^`\n]+)`)|(@bp:([\w-]+))|(@res:([\w-]+))/;
  const tokens: MdToken[] = [];
  let rest = text;
  while (rest.length) {
    const m = rest.match(re);
    if (!m) { tokens.push({ type: 'text', value: rest }); break; }
    if (m.index! > 0) tokens.push({ type: 'text', value: rest.slice(0, m.index) });
    if (m[1]) tokens.push({ type: 'bold', value: m[2] });
    else if (m[3]) tokens.push({ type: 'italic', value: m[4] });
    else if (m[5]) tokens.push({ type: 'code', value: m[6] });
    else if (m[7]) tokens.push({ type: 'ref-bp', id: m[8] });
    else if (m[9]) tokens.push({ type: 'ref-res', id: m[10] });
    rest = rest.slice(m.index! + m[0].length);
  }
  return tokens;
}

function InlineMd({ text }: { text: string }) {
  const theme = useTheme();
  const tokens = tokenizeLine(text);
  return (
    <>
      {tokens.map((tok, i) => {
        if (tok.type === 'text') return <span key={i}>{tok.value}</span>;
        if (tok.type === 'bold') return <strong key={i}>{tok.value}</strong>;
        if (tok.type === 'italic') return <em key={i}>{tok.value}</em>;
        if (tok.type === 'code') return (
          <Box component="code" key={i} sx={{ fontFamily: FONT_MONO, fontSize: '0.85em', px: 0.5, py: 0.1, backgroundColor: alpha(theme.palette.primary.main, 0.12), color: 'primary.light' }}>
            {tok.value}
          </Box>
        );
        if (tok.type === 'ref-bp') return (
          <AppChip key={i} label={`@bp:${tok.id}`} size="sm" outlined sx={{ mx: 0.25, height: 18, fontSize: TEXT_LABEL, fontFamily: FONT_MONO, cursor: 'default' }} />
        );
        if (tok.type === 'ref-res') return (
          <AppChip key={i} label={`@res:${tok.id}`} size="sm" outlined tone="info" sx={{ mx: 0.25, height: 18, fontSize: TEXT_LABEL, fontFamily: FONT_MONO, cursor: 'default' }} />
        );
        return null;
      })}
    </>
  );
}

function MarkdownView({ source, onChange }: { source: string; onChange: (next: string) => void }) {
  const theme = useTheme();
  const lines = source.split('\n');
  const elements: React.ReactNode[] = [];
  let listBuf: React.ReactNode[] = [];
  let listKey = 0;

  const flushList = () => {
    if (listBuf.length) {
      elements.push(
        <Box component="ul" key={`ul-${listKey++}`} sx={{ pl: 2.5, my: 0.5, '& li': { mb: 0.35 } }}>
          {listBuf}
        </Box>,
      );
      listBuf = [];
    }
  };

  const toggleLine = (idx: number) => {
    const ln = lines[idx];
    const next = [...lines];
    if (/^- \[x\] /i.test(ln)) next[idx] = ln.replace(/^- \[x\] /i, '- [ ] ');
    else next[idx] = ln.replace(/^- \[ \] /, '- [x] ');
    onChange(next.join('\n'));
  };

  lines.forEach((raw, idx) => {
    if (/^### /.test(raw)) {
      flushList();
      elements.push(
        <Typography key={idx} sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: '0.95rem', mt: 1.5, mb: 0.5, color: 'text.primary' }}>
          <InlineMd text={raw.slice(4)} />
        </Typography>,
      );
      return;
    }
    if (/^## /.test(raw)) {
      flushList();
      elements.push(
        <Typography key={idx} sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: '1.1rem', mt: 1.75, mb: 0.5, color: 'text.primary', borderBottom: `1px solid ${theme.palette.ui.border}`, pb: 0.5 }}>
          <InlineMd text={raw.slice(3)} />
        </Typography>,
      );
      return;
    }
    if (/^# /.test(raw)) {
      flushList();
      elements.push(
        <Typography key={idx} sx={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: '1.3rem', mt: 2, mb: 0.75, color: 'text.primary' }}>
          <InlineMd text={raw.slice(2)} />
        </Typography>,
      );
      return;
    }

    const checkMatch = raw.match(/^- \[( |x|X)\] (.*)$/);
    if (checkMatch) {
      const checked = checkMatch[1].toLowerCase() === 'x';
      listBuf.push(
        <li className="planner-checklist-item" key={idx} data-complete={checked}>
          <label><input type="checkbox" checked={checked} onChange={() => toggleLine(idx)} /><span><InlineMd text={checkMatch[2]} /></span></label>
        </li>,
      );
      return;
    }

    const bulletMatch = raw.match(/^- (.*)$/);
    if (bulletMatch) {
      listBuf.push(
        <Typography component="li" key={idx} sx={{ fontSize: '0.875rem', color: 'text.primary', lineHeight: 1.6 }}>
          <InlineMd text={bulletMatch[1]} />
        </Typography>,
      );
      return;
    }

    flushList();

    if (raw.trim() === '') {
      elements.push(<Box key={idx} sx={{ height: 8 }} />);
      return;
    }

    elements.push(
      <Typography key={idx} sx={{ fontSize: '0.875rem', color: 'text.primary', lineHeight: 1.7 }}>
        <InlineMd text={raw} />
      </Typography>,
    );
  });

  flushList();

  return <Box sx={{ py: 0.5 }}>{elements}</Box>;
}

function noteTasks(body: string) {
  return body.split('\n').flatMap((line, index) => {
    const match = line.match(/^- \[( |x|X)\] (.*)$/);
    return match ? [{ index, title: match[2], completed: match[1].toLowerCase() === 'x' }] : [];
  });
}

function TaskRing({ done, total, label }: { done: number; total: number; label: string }) {
  const ratio = total > 0 ? done / total : 0;
  return <div className="planner-task-ring" role="progressbar" aria-label={label} aria-valuenow={done} aria-valuemin={0} aria-valuemax={total || 1}>
    <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" /><circle cx="24" cy="24" r="20" pathLength="100" strokeDasharray={`${ratio * 100} 100`} /></svg>
    <span>{done}<small>/{total}</small></span>
  </div>;
}

function NoteListItem({ note, active, onClick, untitledLabel, locale }: { note: PlannerNote; active: boolean; onClick: () => void; untitledLabel: string; locale: string }) {
  const { t } = useI18n();
  const tasks = noteTasks(note.body);
  const done = tasks.filter((task) => task.completed).length;
  const next = tasks.find((task) => !task.completed);
  const preview = next?.title ?? note.body.replace(/^#+ /gm, '').replace(/^- \[[ xX]\] /gm, '').replace(/\n+/g, ' ').slice(0, 100);
  return <button className="planner-note-card" type="button" aria-pressed={active} onClick={onClick}>
    <span className="planner-note-card-title">{note.pinned && <i className="pi pi-thumbtack" aria-hidden="true" />}{note.title || untitledLabel}</span>
    {preview && <span className="planner-note-card-preview">{preview}</span>}
    <span className="planner-note-card-meta"><span>{note.tag}</span><span>{tasks.length ? `${done}/${tasks.length} ${t('tasks', 'tâches', 'Aufgaben')}` : new Date(note.updatedAt).toLocaleDateString(locale)}</span></span>
    {tasks.length > 0 && <span className="planner-note-card-progress" aria-hidden="true"><span style={{ width: `${done / tasks.length * 100}%` }} /></span>}
  </button>;
}

export function PlannerPage() {
  const { lang, t } = useI18n();
  const locale = lang === 'fr' ? 'fr-FR' : lang === 'de' ? 'de-DE' : 'en-US';
  const [notes, setNotes] = useLocalPersist<PlannerNote[]>(LS_KEYS.PLANNER_NOTES, DEFAULT_NOTES);
  const [activeId, setActiveId] = useState<string | null>(notes[0]?.id ?? null);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');
  const [undo, setUndo] = useState<{ noteId: string; body: string } | null>(null);
  const [pendingDeleteNote, setPendingDeleteNote] = useState<PlannerNote | null>(null);
  const activeNote = useMemo(() => notes.find((note) => note.id === activeId) ?? notes[0] ?? null, [notes, activeId]);
  const filtered = useMemo(() => notes.filter((note) => !search || `${note.title} ${note.body}`.toLowerCase().includes(search.toLowerCase())), [notes, search]);
  const pinned = filtered.filter((note) => note.pinned);
  const others = filtered.filter((note) => !note.pinned);
  const tasks = activeNote ? noteTasks(activeNote.body) : [];
  const done = tasks.filter((task) => task.completed).length;
  const nextTask = tasks.find((task) => !task.completed);
  const totalOpen = useMemo(() => notes.reduce((sum, note) => sum + noteTasks(note.body).filter((task) => !task.completed).length, 0), [notes]);

  function update(id: string, patch: Partial<PlannerNote>) {
    setNotes((previous) => previous.map((note) => note.id === id ? { ...note, ...patch, updatedAt: Date.now() } : note));
  }
  function selectNote(id: string) {
    setActiveId(id);
    setMode('preview');
    setUndo(null);
    setNotice('');
  }
  function addNote() {
    const note: PlannerNote = { id: `n-${Date.now()}`, title: t('New note', 'Nouvelle note', 'Neue Notiz'), body: '', tag: 'note', pinned: false, updatedAt: Date.now() };
    setNotes((previous) => [note, ...previous]);
    setSearch('');
    selectNote(note.id);
    setMode('edit');
  }
  function updateBody(body: string, reversible = true) {
    if (!activeNote) return;
    setUndo(reversible ? { noteId: activeNote.id, body: activeNote.body } : null);
    update(activeNote.id, { body });
  }
  function completeNextTask() {
    if (!activeNote || !nextTask) return;
    const lines = activeNote.body.split('\n');
    lines[nextTask.index] = lines[nextTask.index].replace(/^- \[ \] /, '- [x] ');
    updateBody(lines.join('\n'));
    setNotice(t('Task completed.', 'Tâche terminée.', 'Aufgabe erledigt.'));
  }
  function undoLastAction() {
    if (!undo) return;
    update(undo.noteId, { body: undo.body });
    setUndo(null);
    setNotice(t('Last action undone.', 'Dernière action annulée.', 'Letzte Aktion rückgängig gemacht.'));
  }
  async function handleCopy() {
    if (!activeNote) return;
    try {
      await navigator.clipboard.writeText(activeNote.body);
      setCopied(true);
      setNotice(t('Note copied.', 'Note copiée.', 'Notiz kopiert.'));
      trackEvent('planner_exported', { export_target: 'clipboard', note_chars: activeNote.body.length });
      setTimeout(() => setCopied(false), 1400);
    } catch { setNotice(t('Could not copy the note.', 'Impossible de copier la note.', 'Die Notiz konnte nicht kopiert werden.')); }
  }

  const tagLabels: Record<string, string> = {
    note: t('Note', 'Note', 'Notiz'), mining: t('Mining', 'Minage', 'Bergbau'), craft: t('Craft', 'Craft', 'Fertigung'),
    route: t('Route', 'Itinéraire', 'Route'), missions: t('Missions', 'Missions', 'Missionen'), economy: t('Economy', 'Économie', 'Wirtschaft'),
  };

  return <PageLayout width="wide">
    <PageHeader title={t('Planner', 'Planificateur', 'Planer')} variant="compact"
      description={t('Your next action, and the notes that keep it on track.', 'Votre prochaine action et les notes pour la mener à bien.', 'Ihre nächste Aktion und die passenden Notizen dazu.')}
      actions={<AppButton variant="primary" size="sm" icon={<AddIcon />} onClick={addNote}>{t('New note', 'Nouvelle note', 'Neue Notiz')}</AppButton>} />
    <PlannerSavedWork />
    <div className="planner-notebook">
      <aside className="planner-note-library" aria-label={t('Your notes', 'Vos notes', 'Ihre Notizen')}>
        <div className="planner-note-library-heading"><h2>{t('Your notes', 'Vos notes', 'Ihre Notizen')}</h2><span>{notes.length}</span></div>
        {totalOpen > 0 && <p className="planner-note-library-status"><i className="pi pi-list-check" aria-hidden="true" />{totalOpen} {t('tasks remaining', 'tâches restantes', 'offene Aufgaben')}</p>}
        {notes.length > 0 && <AppTextField type="search" ariaLabel={t('Filter notes', 'Filtrer les notes', 'Notizen filtern')} placeholder={t('Find a note…', 'Trouver une note…', 'Notiz finden…')} value={search} onValueChange={setSearch} />}
        <nav className="planner-note-cards" aria-label={t('Select a note', 'Sélectionner une note', 'Notiz auswählen')}>
          {pinned.length > 0 && <><h3>{t('Pinned', 'Épinglées', 'Angeheftet')}</h3>{pinned.map((note) => <NoteListItem key={note.id} note={note} active={note.id === activeNote?.id} onClick={() => selectNote(note.id)} untitledLabel={t('Untitled', 'Sans titre', 'Ohne Titel')} locale={locale} />)}</>}
          {others.length > 0 && <>{pinned.length > 0 && <h3>{t('Other notes', 'Autres notes', 'Weitere Notizen')}</h3>}{others.map((note) => <NoteListItem key={note.id} note={note} active={note.id === activeNote?.id} onClick={() => selectNote(note.id)} untitledLabel={t('Untitled', 'Sans titre', 'Ohne Titel')} locale={locale} />)}</>}
          {filtered.length === 0 && <p className="planner-note-muted">{search ? t('No matching notes.', 'Aucune note correspondante.', 'Keine passenden Notizen.') : t('Your plans will appear here.', 'Vos plans apparaîtront ici.', 'Ihre Pläne erscheinen hier.')}</p>}
        </nav>
      </aside>

      <article className="planner-note-workspace">
        {activeNote ? <>
          <header className="planner-note-heading">
            <div>{mode === 'edit' ? <AppTextField value={activeNote.title} onValueChange={(title) => update(activeNote.id, { title })} ariaLabel={t('Note title', 'Titre de la note', 'Notiztitel')} /> : <h2>{activeNote.title || t('Untitled', 'Sans titre', 'Ohne Titel')}</h2>}<span>{tagLabels[activeNote.tag] ?? activeNote.tag}</span></div>
            <AppButton variant={mode === 'edit' ? 'primary' : 'secondary'} size="sm" icon={mode === 'edit' ? <CheckIcon /> : <EditOutlinedIcon />} onClick={() => setMode(mode === 'edit' ? 'preview' : 'edit')}>{mode === 'edit' ? t('Done editing', 'Terminer l’édition', 'Bearbeitung beenden') : t('Edit note', 'Modifier la note', 'Notiz bearbeiten')}</AppButton>
          </header>

          {mode === 'preview' && tasks.length > 0 && <section className="planner-next-action" aria-label={t('Next action', 'Prochaine action', 'Nächste Aktion')}>
            <TaskRing done={done} total={tasks.length} label={t('Checklist progress', 'Progression de la checklist', 'Fortschritt der Checkliste')} />
            <div className="planner-next-action-body"><span className="planner-kicker">{nextTask ? t('Next action', 'Prochaine action', 'Nächste Aktion') : t('Checklist complete', 'Checklist terminée', 'Checkliste abgeschlossen')}</span>
              <h3>{nextTask ? <InlineMd text={nextTask.title} /> : t('Everything is checked off.', 'Tout est coché.', 'Alles ist erledigt.')}</h3>
              {nextTask && <AppButton variant="primary" size="sm" onClick={completeNextTask} icon={<CheckIcon />}>{t('Complete task', 'Terminer la tâche', 'Aufgabe abschließen')}</AppButton>}
              {!nextTask && <p>{t('You can reopen any task in the full checklist below.', 'Vous pouvez rouvrir une tâche dans la checklist complète ci-dessous.', 'Sie können Aufgaben in der vollständigen Checkliste unten wieder öffnen.')}</p>}
            </div>
          </section>}

          {mode === 'edit' ? <div className="planner-note-editor">
            <AppTextArea value={activeNote.body} onValueChange={(body) => updateBody(body, false)} rows={14}
              ariaLabel={t('Note body', 'Contenu de la note', 'Notizinhalt')}
              placeholder={t('Write your notes. Start a task with - [ ]', 'Écrivez vos notes. Commencez une tâche par - [ ]', 'Schreiben Sie Ihre Notizen. Beginnen Sie eine Aufgabe mit - [ ]')}
              sx={{ width: '100%', minHeight: 310, resize: 'vertical', border: 'none', boxShadow: 'none', backgroundColor: 'transparent', fontFamily: FONT_MONO, fontSize: '.8125rem', lineHeight: 1.7, p: 0 }} />
            <details className="planner-writing-help"><summary>{t('Formatting & references', 'Mise en forme & références', 'Formatierung & Referenzen')}</summary><p>**{t('bold', 'gras', 'fett')}** · _{t('italic', 'italique', 'kursiv')}_ · `{t('code', 'code', 'Code')}` · # {t('heading', 'titre', 'Überschrift')} · - [ ] {t('task', 'tâche', 'Aufgabe')} · @bp:id · @res:id</p></details>
          </div> : tasks.length > 0 ? <details className="planner-note-full" key={activeNote.id}><summary><span><i className="pi pi-list" aria-hidden="true" />{t('Full checklist & notes', 'Checklist complète & notes', 'Vollständige Checkliste & Notizen')}</span><small>{done}/{tasks.length}</small></summary><div><MarkdownView source={activeNote.body} onChange={updateBody} /></div></details>
            : <div className="planner-note-reading">{activeNote.body ? <MarkdownView source={activeNote.body} onChange={updateBody} /> : <div className="planner-note-empty-body"><i className="pi pi-pencil" aria-hidden="true" /><p>{t('Add notes or a checklist to prepare your next session.', 'Ajoutez des notes ou une checklist pour préparer votre prochaine session.', 'Fügen Sie Notizen oder eine Checkliste für Ihre nächste Sitzung hinzu.')}</p><AppButton variant="secondary" size="sm" onClick={() => setMode('edit')}>{t('Start writing', 'Commencer à écrire', 'Mit dem Schreiben beginnen')}</AppButton></div>}</div>}

          <div className="planner-note-feedback"><span role="status">{notice || t('Saved on this device', 'Enregistré sur cet appareil', 'Auf diesem Gerät gespeichert')}</span>{undo && undo.noteId === activeNote.id && <AppButton variant="ghost" size="sm" onClick={undoLastAction}>{t('Undo', 'Annuler', 'Rückgängig')}</AppButton>}</div>

          <details className="planner-note-tools"><summary><i className="pi pi-sliders-h" aria-hidden="true" />{t('Organize & export', 'Organiser & exporter', 'Organisieren & exportieren')}</summary>
            <div className="planner-note-tools-body"><AppSelect label={t('Category', 'Catégorie', 'Kategorie')} value={activeNote.tag} options={NOTE_TAGS.map((tag) => ({ label: tagLabels[tag], value: tag }))} onValueChange={(tag) => { if (tag) update(activeNote.id, { tag }); }} />
              <div className="planner-note-tools-actions"><AppButton variant={activeNote.pinned ? 'secondary' : 'ghost'} size="sm" icon={<PushPinOutlinedIcon />} onClick={() => update(activeNote.id, { pinned: !activeNote.pinned })} ariaPressed={activeNote.pinned}>{activeNote.pinned ? t('Unpin', 'Désépingler', 'Loslösen') : t('Pin', 'Épingler', 'Anheften')}</AppButton>
                <AppButton variant="ghost" size="sm" icon={copied ? <CheckIcon /> : <ContentCopyIcon />} onClick={handleCopy}>{copied ? t('Copied', 'Copié', 'Kopiert') : t('Copy Markdown', 'Copier le Markdown', 'Markdown kopieren')}</AppButton>
                <AppButton variant="ghost" size="sm" icon={<DeleteOutlineIcon />} onClick={() => setPendingDeleteNote(activeNote)}>{t('Delete note', 'Supprimer la note', 'Notiz löschen')}</AppButton></div>
              <p>{t('Updated', 'Modifiée', 'Aktualisiert')} {new Date(activeNote.updatedAt).toLocaleString(locale)} · {activeNote.body.length} {t('characters', 'caractères', 'Zeichen')}</p>
            </div>
          </details>
        </> : <div className="planner-notebook-empty"><i className="pi pi-book" aria-hidden="true" /><h2>{t('Prepare your next session', 'Préparez votre prochaine session', 'Bereiten Sie Ihre nächste Sitzung vor')}</h2><p>{t('Keep a route, a materials list or a mission checklist ready to use.', 'Gardez un itinéraire, une liste de matériaux ou une checklist de mission à portée de main.', 'Halten Sie eine Route, eine Materialliste oder eine Missionscheckliste bereit.')}</p><AppButton variant="primary" size="sm" icon={<AddIcon />} onClick={addNote}>{t('Create a note', 'Créer une note', 'Notiz erstellen')}</AppButton></div>}
      </article>
    </div>
    <AppDialog open={pendingDeleteNote !== null} onOpenChange={(open) => { if (!open) setPendingDeleteNote(null); }} title={t('Delete this note?', 'Supprimer cette note ?', 'Diese Notiz löschen?')}
      description={t('This action permanently removes the note from this device.', 'Cette action supprime définitivement la note de cet appareil.', 'Diese Aktion entfernt die Notiz dauerhaft von diesem Gerät.')}
      closeLabel={t('Close', 'Fermer', 'Schließen')}
      footer={<Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}><AppButton variant="secondary" onClick={() => setPendingDeleteNote(null)}>{t('Keep note', 'Conserver la note', 'Notiz behalten')}</AppButton><AppButton variant="danger" onClick={() => {
        if (pendingDeleteNote) {
          setNotes((previous) => previous.filter((note) => note.id !== pendingDeleteNote.id));
          if (activeNote?.id === pendingDeleteNote.id) selectNote(notes.find((note) => note.id !== pendingDeleteNote.id)?.id ?? '');
        }
        setPendingDeleteNote(null);
      }}>{t('Delete note', 'Supprimer la note', 'Notiz löschen')}</AppButton></Box>}>
      <Typography variant="body2" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>{pendingDeleteNote?.title || t('Untitled', 'Sans titre', 'Ohne Titel')}</Typography>
    </AppDialog>
  </PageLayout>;
}
