import { startTransition, useMemo, useState } from 'react';
import { FONT_DISPLAY } from '../../theme';
import {
  AddOutlinedIcon,
  DeleteOutlineIcon,
  DragIndicatorIcon,
  EditOutlinedIcon,
  GridViewOutlinedIcon,
  GroupsOutlinedIcon,
  SearchOutlinedIcon,
} from '../../ui/icons';
import { Box, Paper, Stack, Typography } from '../../ui/system';
import { formatQualityLabel, formatResourceQuantity } from '../../utils/crafting';
import { navigateToPath, resourcePathFromSlug } from '../../utils/slug';
import { BlueprintCard } from '../BlueprintGrid';
import { AccountResourceCard } from './AccountResourceCard';
import { SyncBlueprintsButton } from '../ScLogSyncDialog';
import { AppButton, AppCheckbox, AppSelect, AppTextField } from '../ui/controls';
import { AppChip } from '../ui/data-display/AppChip';
import { AppAlert } from '../ui/feedback';
import { AppDialog } from '../ui/overlays';
import { ACCOUNT_BLUEPRINT_BATCH_SIZE, type AccountLibraryEntry } from './accountHelpers';
import type { AccountController } from './useAccountController';

export function AccountInventoryPanel({ model }: { model: AccountController }) {
  const {
    t,
    lang,
    activeDataset,
    assetFilter,
    setAssetFilter,
    assetSearch,
    setAssetSearch,
    assetSort,
    sharingFilter,
    assetView,
    updatePreferences,
    filteredAssetEntries,
    visibleAssetEntries,
    inventoryCount,
    favoriteCount,
    inventoryResources,
    canManageOrganizations,
  } = model;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [selectedBlueprints, setSelectedBlueprints] = useState<string[]>([]);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const pickerEntries = useMemo(
    () =>
      Array.from(model.blueprintById.values())
        .filter((blueprint) =>
          `${blueprint.name} ${blueprint.manufacturer ?? ''} ${blueprint.category}`
            .toLocaleLowerCase(lang)
            .includes(pickerSearch.trim().toLocaleLowerCase(lang)),
        )
        .sort((a, b) => a.name.localeCompare(b.name, lang))
        .slice(0, 100),
    [model.blueprintById, pickerSearch, lang],
  );
  const openPicker = () => {
    setPickerOpen(true);
    setPickerSearch('');
    setSelectedBlueprints([]);
    setPickerError(null);
  };
  const saveBlueprints = async () => {
    if (pickerBusy || !selectedBlueprints.length) return;
    setPickerBusy(true);
    setPickerError(null);
    try {
      await model.handleAddBlueprints(selectedBlueprints);
      setPickerOpen(false);
    } catch (error) {
      setPickerError(
        error instanceof Error
          ? error.message
          : t(
              'Unable to add blueprints.',
              'Impossible d’ajouter les blueprints.',
              'Blueprints konnten nicht hinzugefügt werden.',
            ),
      );
    } finally {
      setPickerBusy(false);
    }
  };
  const resetFilters = () =>
    updatePreferences({ filter: 'all', search: '', sharing: 'all', sort: 'name-asc' });
  const filtered = assetSearch.trim() !== '' || assetFilter !== 'all' || sharingFilter !== 'all';
  const openBlueprint = (entry: Extract<AccountLibraryEntry, { kind: 'blueprint' }>) =>
    startTransition(() => model.setActiveBlueprint(entry.blueprint));
  const resourceActions = (entry: Extract<AccountLibraryEntry, { kind: 'resource' }>) => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      <AppButton
        size="sm"
        variant="secondary"
        icon={<EditOutlinedIcon sx={{ fontSize: 14 }} />}
        disabled={model.sharedResourceBusyId !== null}
        onClick={() => model.openEditResourceDialog(entry.resourceEntry)}
      >
        {t('Edit', 'Modifier', 'Bearbeiten')}
      </AppButton>
      <AppButton
        size="sm"
        variant="ghost"
        icon={<GroupsOutlinedIcon sx={{ fontSize: 14 }} />}
        disabled={
          !canManageOrganizations || !model.linkedOrganizations.length || model.sharedResourceBusyId !== null
        }
        onClick={() => model.openShareResourceDialog(entry.resourceEntry.id)}
      >
        {t('Share', 'Partager', 'Teilen')}
      </AppButton>
      <AppButton
        size="sm"
        variant="ghost"
        icon={<DeleteOutlineIcon sx={{ fontSize: 14 }} />}
        disabled={model.sharedResourceBusyId !== null}
        onClick={() => {
          void model.handleRemoveResourceEntry(entry.resourceEntry.id);
        }}
      >
        {t('Remove', 'Retirer', 'Entfernen')}
      </AppButton>
    </Box>
  );
  const listEntry = (entry: AccountLibraryEntry) => (
    <Paper
      role="listitem"
      key={entry.key}
      variant="outlined"
      sx={{ p: 1.5, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}
    >
      <Box sx={{ flex: 1, minWidth: 170 }}>
        <AppButton
          variant="ghost"
          size="sm"
          onClick={() =>
            entry.kind === 'blueprint'
              ? openBlueprint(entry)
              : entry.resource &&
                navigateToPath(resourcePathFromSlug(entry.resourceEntry.resourceId), {
                  mainView: 'resources',
                })
          }
          disabled={entry.kind === 'resource' && !entry.resource}
          sx={{ p: 0, minHeight: 36, justifyContent: 'flex-start', textAlign: 'left', color: 'text.primary' }}
        >
          {entry.kind === 'blueprint' ? entry.blueprint.name : entry.resourceEntry.resourceName}
        </AppButton>
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
          {entry.kind === 'blueprint'
            ? `${entry.blueprint.category} · ${entry.isInInventory ? t('Owned', 'Possédé', 'Im Besitz') : t('Favorite', 'Favori', 'Favorit')}`
            : `${formatResourceQuantity(entry.resourceEntry.quantity, entry.resourceEntry.quantityUnit, lang, 'long')} · ${entry.resourceEntry.quality == null ? t('Quality unspecified', 'Qualité non précisée', 'Qualität nicht angegeben') : formatQualityLabel(entry.resourceEntry.quality, lang)}`}
        </Typography>
      </Box>
      <AppChip
        label={
          entry.isShared
            ? t(
                `Shared with ${entry.sharedOrganizationIds.length} orgs`,
                `Partagé avec ${entry.sharedOrganizationIds.length} orgs`,
                `Mit ${entry.sharedOrganizationIds.length} Orgs geteilt`,
              )
            : t('Private', 'Privé', 'Privat')
        }
        size="sm"
        outlined
        tone={entry.isShared ? 'info' : 'default'}
      />
      {entry.kind === 'resource' ? (
        resourceActions(entry)
      ) : (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          <AppButton
            size="sm"
            variant="ghost"
            ariaPressed={entry.isFavorite}
            onClick={() => model.handleToggleFavoriteBlueprint(entry.blueprint.id)}
          >
            {entry.isFavorite
              ? t('Unfavorite', 'Retirer des favoris', 'Favorit entfernen')
              : t('Favorite', 'Favori', 'Favorisieren')}
          </AppButton>
          <AppButton
            size="sm"
            variant="ghost"
            disabled={model.defaultInventoryIdSet.has(entry.blueprint.id)}
            onClick={() => model.handleToggleInventoryBlueprint(entry.blueprint.id)}
          >
            {entry.isInInventory
              ? t('Remove', 'Retirer', 'Entfernen')
              : t('Mark owned', 'Marquer possédé', 'Als vorhanden markieren')}
          </AppButton>
          <AppButton
            size="sm"
            variant="ghost"
            disabled={
              !entry.isInInventory ||
              !canManageOrganizations ||
              !model.linkedOrganizations.length ||
              model.sharedBlueprintBusyId !== null
            }
            onClick={() => model.openShareBlueprintDialog(entry.blueprint.id)}
          >
            {t('Share', 'Partager', 'Teilen')}
          </AppButton>
        </Box>
      )}
    </Paper>
  );

  return (
    <Stack
      role="tabpanel"
      id="account-tabpanel-inventory"
      aria-labelledby="account-tab-inventory"
      tabIndex={0}
      spacing={2}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          alignItems: 'start',
        }}
      >
        <Box>
          <Typography component="h2" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 750, fontSize: '1.4rem' }}>
            {t('Your inventory', 'Ton inventaire', 'Dein Inventar')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {t(
              'Build your collection and decide exactly what to share.',
              'Complète ta collection et choisis précisément ce que tu partages.',
              'Baue deine Sammlung auf und entscheide, was du teilst.',
            )}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          <AppButton
            variant="secondary"
            icon={<AddOutlinedIcon sx={{ fontSize: 15 }} />}
            onClick={openPicker}
          >
            {t('Add blueprints', 'Ajouter des blueprints', 'Blueprints hinzufügen')}
          </AppButton>
          <AppButton
            variant="primary"
            icon={<AddOutlinedIcon sx={{ fontSize: 15 }} />}
            onClick={model.openResourceBatchDialog}
            disabled={!model.sortedResources.length}
          >
            {t('Add resources', 'Ajouter des ressources', 'Ressourcen hinzufügen')}
          </AppButton>
          {model.isDesktop && <SyncBlueprintsButton variant="outlined" size="small" />}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', fontSize: '.8rem', color: 'text.secondary' }}>
        {[
          t(
            `${inventoryCount} owned blueprint${inventoryCount === 1 ? '' : 's'}`,
            `${inventoryCount} blueprint${inventoryCount === 1 ? '' : 's'} possédé${inventoryCount === 1 ? '' : 's'}`,
            `${inventoryCount} eigene Blueprints`,
          ),
          t(
            `${favoriteCount} favorite${favoriteCount === 1 ? '' : 's'}`,
            `${favoriteCount} favoris`,
            `${favoriteCount} Favoriten`,
          ),
          t(
            `${inventoryResources.length} resource lot${inventoryResources.length === 1 ? '' : 's'}`,
            `${inventoryResources.length} lots de ressources`,
            `${inventoryResources.length} Ressourcenbestände`,
          ),
        ].map((text) => (
          <Box component="span" key={text}>
            {text}
          </Box>
        ))}
      </Box>
      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 } }}>
        <Stack spacing={1.5}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) 190px' },
              gap: 1.25,
            }}
          >
            <AppTextField
              type="search"
              label={t('Search inventory', 'Rechercher dans l’inventaire', 'Inventar durchsuchen')}
              value={assetSearch}
              onValueChange={setAssetSearch}
              placeholder={t(
                'Name, manufacturer, resource…',
                'Nom, fabricant, ressource…',
                'Name, Hersteller, Ressource…',
              )}
            />
            <AppSelect
              label={t('Type', 'Type', 'Typ')}
              value={assetFilter}
              onValueChange={(value) => value && setAssetFilter(value)}
              options={[
                { value: 'all', label: t('All assets', 'Tous les éléments', 'Alle Einträge') },
                {
                  value: 'inventory-blueprints',
                  label: t('Owned blueprints', 'Blueprints possédés', 'Eigene Blueprints'),
                },
                { value: 'favorite-blueprints', label: t('Favorites', 'Favoris', 'Favoriten') },
                { value: 'resources', label: t('Resources', 'Ressources', 'Ressourcen') },
              ]}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <AppSelect
              label={t('Sharing', 'Partage', 'Freigabe')}
              value={sharingFilter}
              onValueChange={(sharing) => sharing && updatePreferences({ sharing })}
              fieldSx={{ flex: '1 1 150px' }}
              options={[
                { value: 'all', label: t('All', 'Tous', 'Alle') },
                { value: 'private', label: t('Private', 'Privé', 'Privat') },
                { value: 'shared', label: t('Shared', 'Partagé', 'Geteilt') },
              ]}
            />
            <AppSelect
              label={t('Sort', 'Trier', 'Sortieren')}
              value={assetSort}
              onValueChange={(sort) => sort && updatePreferences({ sort })}
              fieldSx={{ flex: '1 1 190px' }}
              options={[
                { value: 'name-asc', label: t('Name A–Z', 'Nom A–Z', 'Name A–Z') },
                { value: 'name-desc', label: t('Name Z–A', 'Nom Z–A', 'Name Z–A') },
                {
                  value: 'recent',
                  label: t('Recently updated', 'Modifiés récemment', 'Zuletzt aktualisiert'),
                },
                {
                  value: 'quality',
                  label: t('Quality high to low', 'Qualité décroissante', 'Qualität absteigend'),
                },
              ]}
            />
            <Box
              role="group"
              aria-label={t('Inventory view', 'Vue de l’inventaire', 'Inventaransicht')}
              sx={{ display: 'flex', gap: 0.5 }}
            >
              <AppButton
                size="sm"
                variant={assetView === 'cards' ? 'secondary' : 'ghost'}
                ariaPressed={assetView === 'cards'}
                icon={<GridViewOutlinedIcon sx={{ fontSize: 15 }} />}
                onClick={() => updatePreferences({ view: 'cards' })}
              >
                {t('Cards', 'Cartes', 'Karten')}
              </AppButton>
              <AppButton
                size="sm"
                variant={assetView === 'list' ? 'secondary' : 'ghost'}
                ariaPressed={assetView === 'list'}
                icon={<DragIndicatorIcon sx={{ fontSize: 15 }} />}
                onClick={() => updatePreferences({ view: 'list' })}
              >
                {t('List', 'Liste', 'Liste')}
              </AppButton>
            </Box>
          </Box>
        </Stack>
      </Paper>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography
          role="status"
          aria-live="polite"
          variant="body2"
          sx={{ flex: 1, color: 'text.secondary' }}
        >
          {t(
            `${filteredAssetEntries.length} results`,
            `${filteredAssetEntries.length} résultats`,
            `${filteredAssetEntries.length} Ergebnisse`,
          )}
        </Typography>
        {filtered && (
          <AppButton variant="ghost" size="sm" onClick={resetFilters}>
            {t('Clear filters', 'Effacer les filtres', 'Filter zurücksetzen')}
          </AppButton>
        )}
        <AppButton
          variant="ghost"
          size="sm"
          icon={<GroupsOutlinedIcon sx={{ fontSize: 15 }} />}
          disabled={
            !canManageOrganizations || !model.linkedOrganizations.length || !inventoryResources.length
          }
          onClick={model.openResourceBulkShareDialog}
        >
          {t('Share resource batches', 'Partager des lots de ressources', 'Ressourcenbestände teilen')}
        </AppButton>
      </Box>
      {model.hiddenBlueprintCount > 0 && (
        <AppAlert severity="info">
          {t(
            `${model.hiddenBlueprintCount} saved blueprints are unavailable in this dataset. They remain in your account.`,
            `${model.hiddenBlueprintCount} blueprints sauvegardés sont absents de ce jeu de données. Ils restent dans ton compte.`,
            `${model.hiddenBlueprintCount} gespeicherte Blueprints fehlen in diesem Datensatz. Sie bleiben in deinem Konto.`,
          )}
        </AppAlert>
      )}
      {(model.blueprintCollectionError || model.sharedBlueprintError || model.resourceCollectionError) && (
        <AppAlert severity="error">
          {model.blueprintCollectionError || model.sharedBlueprintError || model.resourceCollectionError}
        </AppAlert>
      )}
      {model.resourceCollectionNotice && (
        <AppAlert severity="success">{model.resourceCollectionNotice}</AppAlert>
      )}
      {!filteredAssetEntries.length ? (
        <Paper variant="outlined" sx={{ px: 2, py: 5, textAlign: 'center', borderStyle: 'dashed' }}>
          <SearchOutlinedIcon sx={{ color: 'text.secondary', mb: 1.5 }} />
          <Typography component="h3" sx={{ fontWeight: 700 }}>
            {filtered
              ? t('No matching items', 'Aucun élément correspondant', 'Keine passenden Einträge')
              : t('Start your collection', 'Commence ta collection', 'Starte deine Sammlung')}
          </Typography>
          <Typography sx={{ color: 'text.secondary', mt: 1, mb: 2, fontSize: '.875rem' }}>
            {filtered
              ? t(
                  'Try a different search or clear your filters.',
                  'Essaie une autre recherche ou efface les filtres.',
                  'Ändere die Suche oder setze die Filter zurück.',
                )
              : t(
                  'Add blueprints you own or resources you have gathered.',
                  'Ajoute les blueprints que tu possèdes ou les ressources récoltées.',
                  'Füge eigene Blueprints oder gesammelte Ressourcen hinzu.',
                )}
          </Typography>
          <AppButton variant="secondary" onClick={filtered ? resetFilters : openPicker}>
            {filtered
              ? t('Reset filters', 'Réinitialiser les filtres', 'Filter zurücksetzen')
              : t('Add blueprints', 'Ajouter des blueprints', 'Blueprints hinzufügen')}
          </AppButton>
        </Paper>
      ) : (
        <Box
          role="list"
          aria-label={t('Inventory items', 'Éléments de l’inventaire', 'Inventareinträge')}
          sx={{
            display: 'grid',
            '& .blueprint-card-actions': {
              opacity: 1,
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              '& > :last-child:nth-child(odd)': { gridColumn: '1 / -1' },
            },
            gridTemplateColumns:
              assetView === 'list' ? '1fr' : 'repeat(auto-fill, minmax(min(100%, 290px), 1fr))',
            gap: 1.5,
          }}
        >
          {visibleAssetEntries.map((entry, index) =>
            assetView === 'list' ? (
              listEntry(entry)
            ) : entry.kind === 'blueprint' ? (
              <BlueprintCard
                key={entry.key}
                blueprint={entry.blueprint}
                isActive={model.activeBlueprint?.id === entry.blueprint.id}
                isFavorite={entry.isFavorite}
                isInInventory={entry.isInInventory}
                resources={activeDataset.resources}
                priority={index < 8}
                organizationShareAction={
                  entry.isInInventory
                    ? {
                        selected: entry.isShared,
                        label: t('Share', 'Partager', 'Teilen'),
                        ariaLabel: t(
                          'Choose organization shares',
                          'Choisir les partages',
                          'Organisationsfreigaben wählen',
                        ),
                        disabled:
                          !canManageOrganizations ||
                          !model.linkedOrganizations.length ||
                          model.sharedBlueprintBusyId !== null,
                        tooltip: t(
                          'Choose organizations to share with',
                          'Choisir les organisations avec qui partager',
                          'Organisationen für die Freigabe wählen',
                        ),
                        onToggle: model.openShareBlueprintDialog,
                      }
                    : undefined
                }
                onSelect={(blueprint) => startTransition(() => model.setActiveBlueprint(blueprint))}
                onToggleFavorite={model.handleToggleFavoriteBlueprint}
                onToggleInventory={
                  model.defaultInventoryIdSet.has(entry.blueprint.id)
                    ? undefined
                    : model.handleToggleInventoryBlueprint
                }
              />
            ) : (
              <AccountResourceCard key={entry.key} entry={entry} actions={resourceActions(entry)} />
            ),
          )}
        </Box>
      )}
      {visibleAssetEntries.length < filteredAssetEntries.length && (
        <AppButton
          variant="secondary"
          onClick={() => model.setVisibleBlueprintCount((count) => count + ACCOUNT_BLUEPRINT_BATCH_SIZE)}
        >
          {t('Load more', 'Afficher plus', 'Mehr anzeigen')} ({visibleAssetEntries.length}/
          {filteredAssetEntries.length})
        </AppButton>
      )}
      <AppDialog
        open={pickerOpen}
        onOpenChange={(open) => {
          if (!pickerBusy) setPickerOpen(open);
        }}
        title={t('Add blueprints', 'Ajouter des blueprints', 'Blueprints hinzufügen')}
        dismissable={!pickerBusy}
        description={t(
          'Select the blueprints you own. Already owned blueprints are kept.',
          'Sélectionne les blueprints que tu possèdes. Les blueprints déjà possédés sont conservés.',
          'Wähle deine Blueprints. Bereits vorhandene Blueprints bleiben erhalten.',
        )}
        footer={
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <AppButton variant="ghost" disabled={pickerBusy} onClick={() => setPickerOpen(false)}>
              {t('Cancel', 'Annuler', 'Abbrechen')}
            </AppButton>
            <AppButton
              variant="primary"
              loading={pickerBusy}
              disabled={!selectedBlueprints.length}
              onClick={() => {
                void saveBlueprints();
              }}
            >
              {t('Add selected', 'Ajouter la sélection', 'Auswahl hinzufügen')} ({selectedBlueprints.length})
            </AppButton>
          </Box>
        }
      >
        <Stack spacing={1.5}>
          <AppTextField
            type="search"
            label={t('Search blueprints', 'Rechercher des blueprints', 'Blueprints suchen')}
            value={pickerSearch}
            onValueChange={setPickerSearch}
          />
          {pickerError && <AppAlert severity="error">{pickerError}</AppAlert>}
          <Box sx={{ maxHeight: '45vh', overflowY: 'auto' }}>
            {pickerEntries.map((blueprint) => {
              const owned = model.inventorySnapshotIds.includes(blueprint.id);
              return (
                <Box key={blueprint.id} sx={{ py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <AppCheckbox
                    disabled={owned || pickerBusy}
                    checked={owned || selectedBlueprints.includes(blueprint.id)}
                    label={
                      <Box>
                        <Typography component="span" sx={{ fontSize: '.875rem' }}>
                          {blueprint.name}
                        </Typography>
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{ display: 'block', color: 'text.secondary' }}
                        >
                          {blueprint.category}
                          {owned ? ` · ${t('Already owned', 'Déjà possédé', 'Bereits vorhanden')}` : ''}
                        </Typography>
                      </Box>
                    }
                    onCheckedChange={(checked) =>
                      setSelectedBlueprints((current) =>
                        checked ? [...current, blueprint.id] : current.filter((id) => id !== blueprint.id),
                      )
                    }
                  />
                </Box>
              );
            })}
            {!pickerEntries.length && (
              <Typography sx={{ color: 'text.secondary' }}>
                {t(
                  'No blueprints match your search.',
                  'Aucun blueprint ne correspond à ta recherche.',
                  'Keine Blueprints entsprechen deiner Suche.',
                )}
              </Typography>
            )}
          </Box>
          {pickerEntries.length === 100 && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {t(
                'Showing the first 100 results. Refine your search to find more.',
                'Les 100 premiers résultats sont affichés. Affine ta recherche pour trouver les autres.',
                'Die ersten 100 Ergebnisse werden angezeigt. Grenze deine Suche ein.',
              )}
            </Typography>
          )}
        </Stack>
      </AppDialog>
    </Stack>
  );
}
