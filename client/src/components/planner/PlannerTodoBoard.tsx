import { Box, ButtonBase, IconButton, Paper, Typography, alpha, useTheme } from '../../ui/system';
import { AppTooltip } from '../ui/overlays';
import { AppChip } from '../ui/data-display';
import { AddTaskOutlinedIcon, CheckCircleOutlineOutlinedIcon, DeleteOutlineOutlinedIcon, EditOutlinedIcon, Inventory2OutlinedIcon, RocketLaunchOutlinedIcon, SearchOutlinedIcon } from '../../ui/icons';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useCraft } from '../../store/CraftContext';
import type { PlannerTodoItem, PlannerTodoSource } from '../../types';
import { FONT_HEADING } from '../../theme';
import { AppAutocomplete, AppButton, AppCheckbox, AppTextArea, AppTextField } from '../ui/controls';
import { PlannerSegmentedControl } from './PlannerControls';
import { shouldHandleInternalLinkClick } from '../../utils/spaLinks';
import { toSlug } from '../../utils/slug';

type PlannerTodoFilter = 'all' | 'open' | 'done' | 'manual' | 'mission-blueprint';

function formatTimestamp(timestamp: number | null, locale: string) {
  if (!timestamp || Number.isNaN(Number(timestamp))) {
    return null;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

export function PlannerTodoBoard() {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const {
    blueprints,
    activeBlueprint,
    setActiveBlueprint,
    plannerTodoItems,
    addPlannerTodoItem,
    updatePlannerTodoItem,
    togglePlannerTodoItem,
    removePlannerTodoItem,
    clearCompletedPlannerTodoItems,
  } = useCraft();
  const [draftMode, setDraftMode] = useState<PlannerTodoSource>('manual');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string | null>(null);
  const [blueprintQuery, setBlueprintQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<PlannerTodoFilter>('open');
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingDescription, setEditingDescription] = useState('');

  const locale = lang === 'fr' ? 'fr-FR' : lang === 'de' ? 'de-DE' : 'en-US';

  const blueprintOptions = useMemo(
    () => [...blueprints].sort((left, right) => left.name.localeCompare(right.name)),
    [blueprints],
  );
  const selectedBlueprint = useMemo(
    () => blueprintOptions.find((blueprint) => blueprint.id === selectedBlueprintId) ?? null,
    [blueprintOptions, selectedBlueprintId],
  );
  const blueprintSuggestions = useMemo(() => {
    const query = blueprintQuery.trim().toLowerCase();
    return query
      ? blueprintOptions.filter((blueprint) => blueprint.name.toLowerCase().includes(query))
      : blueprintOptions;
  }, [blueprintOptions, blueprintQuery]);

  useEffect(() => {
    if (draftMode !== 'mission-blueprint') {
      return;
    }

    if (!selectedBlueprintId && activeBlueprint) {
      setSelectedBlueprintId(activeBlueprint.id);
      if (!draftTitle.trim()) {
        setDraftTitle(`Craft ${activeBlueprint.name}`);
      }
    }
  }, [activeBlueprint, draftMode, draftTitle, selectedBlueprintId]);

  const counts = useMemo(() => {
    const open = plannerTodoItems.filter((item) => !item.completed).length;
    const done = plannerTodoItems.length - open;
    const blueprintMissions = plannerTodoItems.filter(
      (item) => item.source === 'mission-blueprint',
    ).length;
    return {
      open,
      done,
      blueprintMissions,
    };
  }, [plannerTodoItems]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return plannerTodoItems.filter((item) => {
      if (filter === 'open' && item.completed) {
        return false;
      }
      if (filter === 'done' && !item.completed) {
        return false;
      }
      if (filter === 'manual' && item.source !== 'manual') {
        return false;
      }
      if (filter === 'mission-blueprint' && item.source !== 'mission-blueprint') {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      return [
        item.title,
        item.description ?? '',
        item.relatedBlueprintName ?? '',
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [filter, plannerTodoItems, searchQuery]);

  const handleCreateTodo = () => {
    if (draftMode === 'mission-blueprint' && !selectedBlueprint) {
      return;
    }

    const trimmedTitle = draftTitle.trim();
    const resolvedTitle =
      trimmedTitle ||
      (draftMode === 'mission-blueprint' && selectedBlueprint
        ? `Craft ${selectedBlueprint.name}`
        : '');
    if (!resolvedTitle) {
      return;
    }

    addPlannerTodoItem({
      title: resolvedTitle,
      description: draftDescription.trim() || null,
      source: draftMode,
      relatedBlueprintId:
        draftMode === 'mission-blueprint' ? selectedBlueprint?.id ?? null : null,
      relatedBlueprintName:
        draftMode === 'mission-blueprint' ? selectedBlueprint?.name ?? null : null,
    });

    setDraftTitle('');
    setDraftDescription('');
    if (draftMode === 'manual') {
      setSelectedBlueprintId(null);
    }
  };

  const startEditing = (item: PlannerTodoItem) => {
    setEditingTodoId(item.id);
    setEditingTitle(item.title);
    setEditingDescription(item.description ?? '');
  };

  const saveEditing = () => {
    if (!editingTodoId) {
      return;
    }

    updatePlannerTodoItem(editingTodoId, {
      title: editingTitle,
      description: editingDescription,
    });
    setEditingTodoId(null);
    setEditingTitle('');
    setEditingDescription('');
  };

  const cancelEditing = () => {
    setEditingTodoId(null);
    setEditingTitle('');
    setEditingDescription('');
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderColor: alpha(theme.palette.primary.main, 0.18),
        background:
          theme.palette.mode === 'dark'
            ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.background.paper, 0.96)} 18%, ${theme.palette.background.paper} 100%)`
            : theme.palette.background.paper,
      }}
    >
      <Box
        sx={{
          px: { xs: 1.5, md: 2 },
          py: { xs: 1.5, md: 2 },
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="overline"
              sx={{ color: 'primary.main', letterSpacing: '0.16em' }}
            >
              {t('Planner', 'Planificateur')}
            </Typography>
            <Typography
              variant="h5"
              sx={{ fontFamily: FONT_HEADING, lineHeight: 0.95 }}
            >
              {t('Operations board', 'Tableau des opérations')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 620 }}>
              {t(
                'Keep manual tasks, blueprint missions and follow-up notes in one place.',
                'Centralisez les tâches manuelles, les missions blueprint et tout le suivi dans un seul outil.',
              )}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            <AppChip
              size="sm"
              outlined
              icon={<AddTaskOutlinedIcon sx={{ fontSize: 16 }} />}
              label={`${counts.open} ${t('open', 'ouvertes')}`}
            />
            <AppChip
              size="sm"
              outlined
              icon={<CheckCircleOutlineOutlinedIcon sx={{ fontSize: 16 }} />}
              label={`${counts.done} ${t('done', 'terminées')}`}
            />
            <AppChip
              size="sm"
              outlined
              icon={<RocketLaunchOutlinedIcon sx={{ fontSize: 16 }} />}
              label={`${counts.blueprintMissions} ${t('missions', 'missions')}`}
            />
          </Box>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'auto minmax(0, 1fr) auto' },
            gap: 1,
            alignItems: 'start',
          }}
        >
          <PlannerSegmentedControl
            value={draftMode}
            ariaLabel={t('Task type', 'Type de tâche')}
            onValueChange={setDraftMode}
            options={[
              { value: 'manual', label: t('Manual task', 'Tâche manuelle') },
              { value: 'mission-blueprint', label: t('Blueprint mission', 'Mission blueprint') },
            ]}
          />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                xl: draftMode === 'mission-blueprint' ? 'minmax(200px, 0.9fr) minmax(0, 1.1fr) minmax(0, 1fr)' : 'minmax(240px, 1fr) minmax(0, 1fr)',
              },
              gap: 1,
            }}
          >
            {draftMode === 'mission-blueprint' && (
              <AppAutocomplete
                label={t('Blueprint', 'Blueprint')}
                value={selectedBlueprint}
                suggestions={blueprintSuggestions}
                getOptionLabel={(option) => option.name as string}
                onQueryChange={setBlueprintQuery}
                onValueChange={(value) => {
                  const blueprint = typeof value === 'string' ? null : value;
                  setSelectedBlueprintId(blueprint?.id as string ?? null);
                  if (blueprint && !draftTitle.trim()) {
                    setDraftTitle(`Craft ${blueprint.name}`);
                  }
                }}
                forceSelection
                placeholder={t('Select a blueprint', 'Sélectionner un blueprint')}
              />
            )}
            <AppTextField
              value={draftTitle}
              onValueChange={setDraftTitle}
              label={t('Task title', 'Titre de la tâche')}
              placeholder={
                draftMode === 'mission-blueprint'
                  ? t('Craft mission title', 'Titre de mission de craft')
                  : t('What needs to be done?', 'Que faut-il faire ?')
              }
            />
            <AppTextArea
              value={draftDescription}
              onValueChange={setDraftDescription}
              label={t('Notes', 'Notes')}
              placeholder={t('Context, requirements, follow-up...', 'Contexte, exigences, suivi...')}
              rows={1}
              autoResize
            />
          </Box>

          <AppButton
            variant="primary"
            onClick={handleCreateTodo}
            icon={<AddTaskOutlinedIcon />}
            disabled={draftMode === 'mission-blueprint' && !selectedBlueprint}
            sx={{ minHeight: 44, whiteSpace: 'nowrap' }}
          >
            {t('Add task', 'Ajouter')}
          </AppButton>
        </Box>

        {draftMode === 'mission-blueprint' && activeBlueprint && activeBlueprint.id !== selectedBlueprintId && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <AppButton
              size="sm"
              variant="ghost"
              icon={<Inventory2OutlinedIcon />}
              onClick={() => {
                setSelectedBlueprintId(activeBlueprint.id);
                if (!draftTitle.trim()) {
                  setDraftTitle(`Craft ${activeBlueprint.name}`);
                }
              }}
            >
              {t('Use current blueprint', 'Utiliser le blueprint courant')}: {activeBlueprint.name}
            </AppButton>
          </Box>
        )}
      </Box>

      <Box
        sx={{
          px: { xs: 1.5, md: 2 },
          py: 1.25,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'auto minmax(220px, 1fr) auto' },
          gap: 1,
          alignItems: 'center',
        }}
      >
        <PlannerSegmentedControl
          value={filter}
          ariaLabel={t('Filter tasks', 'Filtrer les tâches')}
          onValueChange={setFilter}
          compact
          options={[
            { value: 'all', label: t('All', 'Tout') },
            { value: 'open', label: t('Open', 'Ouvert') },
            { value: 'done', label: t('Done', 'Terminé') },
            { value: 'manual', label: t('Manual', 'Manuel') },
            { value: 'mission-blueprint', label: t('Missions', 'Missions') },
          ]}
        />

        <Box sx={{ position: 'relative' }}>
          <SearchOutlinedIcon sx={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'text.secondary', zIndex: 1, pointerEvents: 'none' }} />
          <AppTextField
            type="search"
            value={searchQuery}
            onValueChange={setSearchQuery}
            ariaLabel={t('Search tasks or blueprints', 'Rechercher une tâche ou un blueprint')}
            placeholder={t('Search tasks or blueprints', 'Rechercher une tâche ou un blueprint')}
            sx={{ paddingLeft: 4.5 }}
          />
        </Box>

        <AppButton
          variant="secondary"
          size="sm"
          disabled={counts.done === 0}
          onClick={clearCompletedPlannerTodoItems}
          sx={{ justifySelf: { xs: 'stretch', sm: 'end' } }}
        >
          {t('Clear completed', 'Nettoyer le terminé')}
        </AppButton>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          px: { xs: 1.25, md: 2 },
          py: { xs: 1.25, md: 1.75 },
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {filteredItems.length === 0 && (
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderStyle: 'dashed',
              borderColor: alpha(theme.palette.primary.main, 0.2),
              backgroundColor: alpha(theme.palette.primary.main, 0.03),
            }}
          >
            <Typography
              variant="body1"
              sx={{ fontFamily: FONT_HEADING, fontWeight: 700 }}
            >
              {t('No tasks match the current view.', 'Aucune tâche ne correspond à la vue actuelle.')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t(
                'Create manual reminders, blueprint craft missions, or search with different filters.',
                'Ajoutez des rappels manuels, des missions blueprint ou changez les filtres.',
              )}
            </Typography>
          </Paper>
        )}

        {filteredItems.map((item) => {
          const isEditing = editingTodoId === item.id;
          const createdLabel = formatTimestamp(item.createdAt, locale);
          const completedLabel = formatTimestamp(item.completedAt, locale);

          return (
            <Paper
              key={item.id}
              outlined
              sx={{
                p: 1.25,
                borderColor: item.completed
                  ? alpha(theme.palette.success.main, 0.28)
                  : alpha(theme.palette.primary.main, 0.12),
                backgroundColor: item.completed
                  ? alpha(theme.palette.success.main, 0.04)
                  : 'background.paper',
                opacity: item.completed ? 0.78 : 1,
              }}
            >
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <AppCheckbox
                  label={item.completed ? t('Mark task open', 'Rouvrir la tâche') : t('Mark task completed', 'Marquer la tâche terminée')}
                  checked={item.completed}
                  onCheckedChange={() => togglePlannerTodoItem(item.id)}
                  sx={{ mt: -0.25, minWidth: 44, minHeight: 44, '& > span': { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' } }}
                />

                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {isEditing ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <AppTextField
                        value={editingTitle}
                        onValueChange={setEditingTitle}
                        label={t('Task title', 'Titre de la tâche')}
                      />
                      <AppTextArea
                        value={editingDescription}
                        onValueChange={setEditingDescription}
                        label={t('Notes', 'Notes')}
                        rows={2}
                      />
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <AppButton size="sm" variant="primary" onClick={saveEditing}>
                          {t('Save', 'Enregistrer')}
                        </AppButton>
                        <AppButton size="sm" variant="secondary" onClick={cancelEditing}>
                          {t('Cancel', 'Annuler')}
                        </AppButton>
                      </Box>
                    </Box>
                  ) : (
                    <>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                          flexWrap: 'wrap',
                        }}
                      >
                        <Typography
                          variant="body1"
                          sx={{
                            fontFamily: FONT_HEADING,
                            fontWeight: 700,
                            textDecoration: item.completed ? 'line-through' : 'none',
                          }}
                        >
                          {item.title}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                          <AppChip
                            size="sm"
                            outlined
                            icon={
                              item.source === 'mission-blueprint' ? (
                                <RocketLaunchOutlinedIcon sx={{ fontSize: 15 }} />
                              ) : (
                                <Inventory2OutlinedIcon sx={{ fontSize: 15 }} />
                              )
                            }
                            label={
                              item.source === 'mission-blueprint'
                                ? t('Blueprint mission', 'Mission blueprint')
                                : t('Manual task', 'Tâche manuelle')
                            }
                          />
                          {item.relatedBlueprintId && item.relatedBlueprintName && (
                            <ButtonBase
                              component="a"
                              href={`/item/${toSlug(item.relatedBlueprintName)}`}
                              onClick={(event) => {
                                if (!shouldHandleInternalLinkClick(event)) return;
                                event.preventDefault();
                                const relatedBlueprint =
                                  blueprints.find((blueprint) => blueprint.id === item.relatedBlueprintId) ??
                                  null;
                                if (relatedBlueprint) {
                                  setActiveBlueprint(relatedBlueprint);
                                }
                              }}
                              sx={{
                                px: 1,
                                py: 0.25,
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                                borderRadius: 999,
                                color: 'primary.main',
                                fontFamily: FONT_HEADING,
                                fontWeight: 700,
                                fontSize: '0.78rem',
                              }}
                            >
                              {item.relatedBlueprintName}
                            </ButtonBase>
                          )}
                        </Box>
                      </Box>

                      {item.description && (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {item.description}
                        </Typography>
                      )}

                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                          flexWrap: 'wrap',
                        }}
                      >
                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                          {createdLabel && (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {t('Created', 'Créé')} {createdLabel}
                            </Typography>
                          )}
                          {item.completed && completedLabel && (
                            <Typography variant="caption" sx={{ color: 'success.main' }}>
                              {t('Closed', 'Clos')} {completedLabel}
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.25 }}>
                          <AppTooltip content={t('Edit task', 'Modifier la tâche')}>
                            <IconButton size="small" onClick={() => startEditing(item)} aria-label={t('Edit item', 'Modifier l\'élément')}>
                              <EditOutlinedIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </AppTooltip>
                          <AppTooltip content={t('Delete task', 'Supprimer la tâche')}>
                            <IconButton size="small" onClick={() => removePlannerTodoItem(item.id)} aria-label={t('Remove item', 'Supprimer l\'élément')}>
                              <DeleteOutlineOutlinedIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </AppTooltip>
                        </Box>
                      </Box>
                    </>
                  )}
                </Box>
              </Box>
            </Paper>
          );
        })}
      </Box>
    </Paper>
  );
}
