import { Box, IconButton, Stack, Typography, alpha, useTheme } from '../ui/system';
import { AppChip } from './ui/data-display';
import { AddIcon, CheckIcon, ContentCopyIcon, DeleteOutlineIcon, EditOutlinedIcon, PushPinOutlinedIcon, SearchIcon, VisibilityOutlinedIcon } from '../ui/icons';
import { useMemo, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useLocalPersist } from '../hooks/useLocalPersist';
import { LS_KEYS } from '../types';
import { AppButton, AppSelect, AppTextArea, AppTextField } from './ui/controls';
import { PageHeader, PageLayout } from './ui/page';
import { FONT_DISPLAY, FONT_MONO, TEXT_LABEL, TEXT_LABEL_SM} from '../theme';
import { trackEvent } from '../analytics/posthog';
import { PlannerSegmentedControl } from './planner/PlannerControls';

const NOTE_TAGS = ['note', 'mining', 'craft', 'route', 'missions', 'economy'];

export interface PlannerNote {
  id: string;
  title: string;
  body: string;
  tag: string;
  pinned: boolean;
  updatedAt: number;
}

const DEFAULT_NOTES: PlannerNote[] = [
  {
    id: 'demo-1',
    title: 'Getting started',
    body: '# Getting started\n\n- [ ] Assign materials to blueprint slots\n- [ ] Check missions for blueprint drops\n- [ ] Add blueprints with **@bp:id** and resources with **@res:id**\n',
    tag: 'note',
    pinned: true,
    updatedAt: Date.now(),
  },
];

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
        <Box
          component="li"
          key={idx}
          sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, listStyle: 'none', ml: -2, minHeight: 44 }}
        >
          <Box
            component="input"
            type="checkbox"
            checked={checked}
            onChange={() => toggleLine(idx)}
            aria-label="Toggle task"
            sx={{ width: 20, height: 20, mt: 1.5, cursor: 'pointer', accentColor: theme.palette.primary.main }}
          />
          <Typography
            component="span"
            sx={{
              fontSize: '0.875rem',
              color: checked ? 'text.disabled' : 'text.primary',
              textDecoration: checked ? 'line-through' : 'none',
              lineHeight: 1.5,
            }}
          >
            <InlineMd text={checkMatch[2]} />
          </Typography>
        </Box>,
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

// ── Note list item ─────────────────────────────────────────────────────────

function NoteListItem({ note, active, onClick, untitledLabel, locale }: { note: PlannerNote; active: boolean; onClick: () => void; untitledLabel: string; locale: string }) {
  const theme = useTheme();
  const preview = note.body.replace(/^#+ /gm, '').replace(/\n+/g, ' ').slice(0, 120) || '…';
  const taskTotal = (note.body.match(/^- \[/gm) || []).length;
  const taskDone = (note.body.match(/^- \[x\]/gim) || []).length;

  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        px: 1.25,
        py: 1.25,
        border: '1px solid',
        borderColor: active ? alpha(theme.palette.primary.main, 0.35) : 'transparent',
        borderRadius: 1,
        backgroundColor: active ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
        '&:hover': { backgroundColor: active ? undefined : alpha(theme.palette.background.default, 0.6) },
        transition: 'background-color 120ms, border-color 120ms',
      }}
    >
      <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: '0.875rem', color: 'text.primary', mb: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {note.title || untitledLabel}
      </Typography>
      <Typography
        sx={{
          fontSize: '0.715rem',
          color: 'text.disabled',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          lineHeight: 1.35,
          mb: 0.75,
        }}
      >
        {preview}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <AppChip label={note.tag} size="sm" sx={{ height: 16, fontSize: TEXT_LABEL_SM, px: 0.75 }} />
        {taskTotal > 0 && (
          <Typography sx={{ fontSize: TEXT_LABEL_SM, color: 'text.disabled', fontFamily: FONT_MONO }}>
            {taskDone}/{taskTotal}
          </Typography>
        )}
        <Typography sx={{ fontSize: TEXT_LABEL_SM, color: 'text.disabled', ml: 'auto' }}>
          {new Date(note.updatedAt).toLocaleDateString(locale)}
        </Typography>
      </Box>
    </Box>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function PlannerPage() {
  const { lang, t } = useI18n();
  const locale = lang === 'fr' ? 'fr-FR' : lang === 'de' ? 'de-DE' : 'en-US';
  const theme = useTheme();

  const [notes, setNotes] = useLocalPersist<PlannerNote[]>(LS_KEYS.PLANNER_NOTES, DEFAULT_NOTES);
  const [activeId, setActiveId] = useState<string | null>(notes[0]?.id ?? null);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [copied, setCopied] = useState(false);

  const activeNote = useMemo(() => notes.find((n) => n.id === activeId) ?? notes[0] ?? null, [notes, activeId]);

  const filtered = useMemo(
    () => notes.filter((n) => !search || `${n.title} ${n.body}`.toLowerCase().includes(search.toLowerCase())),
    [notes, search],
  );
  const pinned = filtered.filter((n) => n.pinned);
  const others = filtered.filter((n) => !n.pinned);

  const update = (id: string, patch: Partial<PlannerNote>) =>
    setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)));

  const addNote = () => {
    const n: PlannerNote = {
      id: `n-${Date.now()}`,
      title: t('New note', 'Nouvelle note'),
      body: `# ${t('New note', 'Nouvelle note')}\n\n- [ ] ${t('To do', 'À faire')}\n`,
      tag: 'note',
      pinned: false,
      updatedAt: Date.now(),
    };
    setNotes((ns) => [n, ...ns]);
    setActiveId(n.id);
    setMode('edit');
  };

  const removeNote = (id: string) => {
    setNotes((ns) => ns.filter((x) => x.id !== id));
    const remaining = notes.filter((x) => x.id !== id);
    setActiveId(remaining[0]?.id ?? null);
  };

  const handleCopy = async () => {
    if (!activeNote) return;
    try {
      await navigator.clipboard.writeText(activeNote.body);
      setCopied(true);
      trackEvent('planner_exported', {
        export_target: 'clipboard',
        note_chars: activeNote.body.length,
      });
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // no-op
    }
  };

  const taskTotal = activeNote ? (activeNote.body.match(/^- \[/gm) || []).length : 0;
  const taskDone = activeNote ? (activeNote.body.match(/^- \[x\]/gim) || []).length : 0;

  return (
    <PageLayout width="wide">
      <PageHeader
        title={t('Planner', 'Planificateur', 'Planer')}
        description={t(
          'Research notebook in markdown format. Check tasks, reference a blueprint with @bp:id or a resource with @res:id.',
          'Carnet de recherche au format markdown. Coche les tâches, référence un blueprint avec @bp:id ou une ressource avec @res:id.',
          'Forschungsnotizbuch im Markdown-Format. Aufgaben abhaken und Baupläne mit @bp:id oder Ressourcen mit @res:id referenzieren.',
        )}
        actions={(
          <AppButton variant="primary" size="sm" icon={<AddIcon sx={{ fontSize: '0.85rem' }} />} onClick={addNote}>
            {t('New note', 'Nouvelle note', 'Neue Notiz')}
          </AppButton>
        )}
      />

      {/* Shell: sidebar + editor — two separate cards with a gap */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '280px minmax(0, 1fr)' },
          gap: 2,
          alignItems: 'stretch',
          minHeight: 540,
        }}
      >
        {/* Sidebar — own Paper */}
        <Box
          component="aside"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            p: 1.5,
            border: `1px solid ${theme.palette.ui.border}`,
            backgroundColor: 'ui.surface',
            overflowY: 'auto',
          }}
        >
          {/* Search */}
          <Box sx={{ position: 'relative' }}>
            <SearchIcon sx={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.95rem', color: 'text.disabled', zIndex: 1, pointerEvents: 'none' }} />
            <AppTextField
              type="search"
              ariaLabel={t('Filter notes', 'Filtrer les notes', 'Notizen filtern')}
              placeholder={t('Filter notes…', 'Filtrer les notes…', 'Notizen filtern…')}
              value={search}
              onValueChange={setSearch}
              sx={{ height: 32, fontSize: '0.78rem', pl: 3.5 }}
            />
          </Box>

          {pinned.length > 0 && (
            <>
              <Typography sx={{ px: 0.5, pt: 0.5, fontSize: TEXT_LABEL_SM, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'text.secondary' }}>
                {t('Pinned', 'Épinglées')}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {pinned.map((n) => (
                  <NoteListItem key={n.id} note={n} active={n.id === activeNote?.id} onClick={() => setActiveId(n.id)} untitledLabel={t('Untitled', 'Sans titre', 'Ohne Titel')} locale={locale} />
                ))}
              </Box>
            </>
          )}

          {others.length > 0 && (
            <>
              <Typography sx={{ px: 0.5, pt: pinned.length > 0 ? 0.5 : 0, fontSize: TEXT_LABEL_SM, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'text.secondary' }}>
                {t('Notes', 'Autres')}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {others.map((n) => (
                  <NoteListItem key={n.id} note={n} active={n.id === activeNote?.id} onClick={() => setActiveId(n.id)} untitledLabel={t('Untitled', 'Sans titre', 'Ohne Titel')} locale={locale} />
                ))}
              </Box>
            </>
          )}

          {filtered.length === 0 && (
            <Typography sx={{ py: 2, color: 'text.disabled', fontSize: '0.78rem', textAlign: 'center' }}>
              {t('No notes', 'Aucune note')}
            </Typography>
          )}
        </Box>

        {/* Editor — own Paper */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            border: `1px solid ${theme.palette.ui.border}`,
            backgroundColor: 'ui.surface',
            minHeight: 0,
          }}
        >
          {activeNote ? (
            <>
              {/* Editor header */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1,
                  borderBottom: `1px solid ${theme.palette.ui.border}`,
                  flexWrap: 'wrap',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1, minWidth: 120 }}>
                  <AppTextField
                    value={activeNote.title}
                    onValueChange={(title) => update(activeNote.id, { title })}
                    ariaLabel={t('Note title', 'Titre de la note', 'Notiztitel')}
                    sx={{ border: 'none', boxShadow: 'none', backgroundColor: 'transparent', fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: '1rem', color: 'text.primary', px: 0 }}
                  />
                  <AppChip label={activeNote.tag} size="sm" sx={{ height: 18, fontSize: TEXT_LABEL_SM, flexShrink: 0, px: 0.75 }} />
                </Box>
                <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                  <AppButton
                    variant={activeNote.pinned ? 'secondary' : 'ghost'}
                    size="sm"
                    icon={<PushPinOutlinedIcon sx={{ fontSize: '0.8rem' }} />}
                    onClick={() => update(activeNote.id, { pinned: !activeNote.pinned })}
                    ariaPressed={activeNote.pinned}
                  >
                    {activeNote.pinned ? t('Pinned', 'Épinglée') : t('Pin', 'Épingler')}
                  </AppButton>
                  <AppButton
                    variant="ghost"
                    size="sm"
                    icon={copied ? <CheckIcon sx={{ fontSize: '0.8rem' }} /> : <ContentCopyIcon sx={{ fontSize: '0.8rem' }} />}
                    onClick={handleCopy}
                  >
                    {copied ? t('Copied', 'Copié') : t('Copy MD', 'Copier MD')}
                  </AppButton>
                  <PlannerSegmentedControl
                    value={mode}
                    onValueChange={setMode}
                    ariaLabel={t('Edit mode', 'Mode édition')}
                    compact
                    options={[
                      {
                        value: 'preview',
                        ariaLabel: t('Preview', 'Aperçu'),
                        label: <><VisibilityOutlinedIcon sx={{ fontSize: '0.8rem' }} />{t('Preview', 'Aperçu')}</>,
                      },
                      {
                        value: 'edit',
                        ariaLabel: t('Edit', 'Éditer'),
                        label: <><EditOutlinedIcon sx={{ fontSize: '0.8rem' }} />{t('Edit', 'Éditer')}</>,
                      },
                    ]}
                  />
                  <IconButton
                    size="small"
                    onClick={() => removeNote(activeNote.id)}
                    title={t('Delete note', 'Supprimer la note')}
                    aria-label={t('Delete note', 'Supprimer la note')}
                    sx={{ minWidth: 44, minHeight: 44, color: 'error.main' }}
                  >
                    <DeleteOutlineIcon sx={{ fontSize: '1rem' }} />
                  </IconButton>
                </Stack>
              </Box>

              {/* Meta bar */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 0.75, borderBottom: `1px solid ${theme.palette.ui.border}`, backgroundColor: alpha(theme.palette.background.default, 0.4) }}>
                <Typography sx={{ fontSize: TEXT_LABEL_SM, color: 'text.disabled', fontFamily: FONT_MONO }}>
                  {new Date(activeNote.updatedAt).toLocaleString(locale)}
                </Typography>
                <Typography sx={{ fontSize: TEXT_LABEL_SM, color: 'text.disabled', fontFamily: FONT_MONO }}>
                  {activeNote.body.length} {t('chars', 'car.')}
                </Typography>
                {taskTotal > 0 && (
                  <Typography sx={{ fontSize: TEXT_LABEL_SM, color: 'text.disabled', fontFamily: FONT_MONO }}>
                    {taskDone}/{taskTotal} {t('tasks', 'tâches')}
                  </Typography>
                )}
              </Box>

              {/* Body */}
              <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2, minHeight: 320 }}>
                {mode === 'preview' ? (
                  <MarkdownView
                    source={activeNote.body}
                    onChange={(next) => update(activeNote.id, { body: next })}
                  />
                ) : (
                  <AppTextArea
                    value={activeNote.body}
                    onValueChange={(body) => update(activeNote.id, { body })}
                    rows={14}
                    placeholder={t('Write in markdown. ## heading, - [ ] task, **bold**, @bp:id, @res:id', 'Écris en markdown. ## titre, - [ ] tâche, **gras**, @bp:id, @res:id')}
                    ariaLabel={t('Note body', 'Contenu de la note', 'Notizinhalt')}
                    sx={{ width: '100%', minHeight: 320, resize: 'vertical', border: 'none', boxShadow: 'none', backgroundColor: 'transparent', color: 'text.primary', fontFamily: FONT_MONO, fontSize: '0.875rem', lineHeight: 1.7, p: 0 }}
                  />
                )}
              </Box>

              {/* Footer */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 2,
                  py: 1,
                  borderTop: `1px solid ${theme.palette.ui.border}`,
                  backgroundColor: alpha(theme.palette.background.default, 0.45),
                  gap: 1,
                  flexWrap: 'wrap',
                }}
              >
                <Typography sx={{ fontSize: TEXT_LABEL_SM, color: 'text.disabled', fontFamily: FONT_MONO }}>
                  {t('Markdown:', 'Markdown :')} **{t('bold', 'gras')}** _{t('italic', 'italique')}_ `{t('code', 'code')}` # {t('heading', 'titre')} - [ ] {t('task', 'tâche')} @bp:id @res:id
                </Typography>
                <AppSelect
                  value={activeNote.tag}
                  options={NOTE_TAGS.map((tag) => ({ label: tag, value: tag }))}
                  onValueChange={(tag) => { if (tag) update(activeNote.id, { tag }); }}
                  ariaLabel={t('Tag', 'Tag', 'Tag')}
                  sx={{ width: 132, minHeight: 28, fontSize: TEXT_LABEL, fontFamily: FONT_MONO }}
                />
              </Box>
            </>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, p: 4 }}>
              <Box sx={{ textAlign: 'center' }}>
                <EditOutlinedIcon sx={{ fontSize: '2.5rem', color: 'text.disabled', mb: 1 }} />
                <Typography sx={{ color: 'text.disabled', mb: 2 }}>
                  {t('No note selected', 'Aucune note sélectionnée')}
                </Typography>
                <AppButton variant="primary" size="sm" icon={<AddIcon sx={{ fontSize: '0.85rem' }} />} onClick={addNote}>
                  {t('Create a note', 'Créer une note')}
                </AppButton>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </PageLayout>
  );
}
