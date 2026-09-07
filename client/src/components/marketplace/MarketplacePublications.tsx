import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { StoredAccount } from '../../services/authService';
import type { MarketplacePublication } from '../../services/marketplaceService';
import { useCraft } from '../../store/CraftContext';
import { Box, Paper, Stack, Typography } from '../../ui/system';
import { formatQualityLabel, formatResourceQuantity } from '../../utils/crafting';
import { AppButton, AppCheckbox, AppTextField } from '../ui/controls';
import { AppAlert } from '../ui/feedback';

const selectionOf = (account: StoredAccount): MarketplacePublication => ({
  enabled: account.marketplace?.enabled ?? false,
  blueprintIds: account.marketplace?.blueprintIds ?? [],
  resourceEntryIds: account.marketplace?.resourceEntryIds ?? [],
});

export function MarketplacePublications({
  account,
  verified,
  busy,
  onSave,
}: {
  account: StoredAccount;
  verified: boolean;
  busy: boolean;
  onSave: (value: MarketplacePublication) => Promise<boolean>;
}) {
  const { t, lang } = useI18n();
  const { activeDataset } = useCraft();
  const [draft, setDraft] = useState(() => selectionOf(account));
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(40);
  const saved = JSON.stringify(selectionOf(account));
  useEffect(() => {
    setDraft(JSON.parse(saved) as MarketplacePublication);
  }, [saved]);
  useEffect(() => {
    setVisibleCount(40);
  }, [search]);
  const blueprintById = useMemo(
    () => new Map(activeDataset.blueprints.map((item) => [item.id, item])),
    [activeDataset.blueprints],
  );
  const owned = new Set(account.inventoryBlueprintIds);
  const lotIds = new Set(account.inventoryResources.map((item) => item.id));
  const validDraft = {
    ...draft,
    blueprintIds: draft.blueprintIds.filter((id) => owned.has(id)),
    resourceEntryIds: draft.resourceEntryIds.filter((id) => lotIds.has(id)),
  };
  const selectedCount = validDraft.blueprintIds.length + validDraft.resourceEntryIds.length;
  const tooMany = selectedCount > 400;
  const choices = [
    ...account.inventoryBlueprintIds.map((id) => ({
      id,
      kind: 'blueprint' as const,
      name: blueprintById.get(id)?.name ?? id,
      detail: t(
        'Craft service · blueprint stays yours',
        'Service de craft · tu conserves ton blueprint',
        'Craft-Service · Blueprint bleibt bei dir',
      ),
    })),
    ...account.inventoryResources.map((entry) => ({
      id: entry.id,
      kind: 'resource' as const,
      name: entry.resourceName,
      detail: `${formatResourceQuantity(entry.quantity, entry.quantityUnit, lang, 'long')} · ${entry.quality == null ? t('Quality unspecified', 'Qualité non précisée', 'Qualität nicht angegeben') : formatQualityLabel(entry.quality, lang)}`,
    })),
  ].filter((entry) =>
    `${entry.name} ${entry.detail}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const toggle = (id: string, kind: 'blueprint' | 'resource', checked: boolean) => {
    const field = kind === 'blueprint' ? 'blueprintIds' : 'resourceEntryIds';
    setDraft((current) => ({
      ...current,
      [field]: checked
        ? [...new Set([...current[field], id])]
        : current[field].filter((value) => value !== id),
    }));
  };
  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography component="h2" variant="h5" sx={{ fontWeight: 700 }}>
          {t('My listings', 'Mes annonces', 'Meine Angebote')}
        </Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.75 }}>
          {t(
            'Choose what the community can see. Your organization shares stay separate.',
            'Choisis ce que la communauté peut voir. Tes partages avec les organisations restent séparés.',
            'Wähle, was die Community sehen darf. Organisationsfreigaben bleiben getrennt.',
          )}
        </Typography>
      </Box>
      <AppAlert severity="info">
        {t(
          'Publishing shows your RSI handle and public name, selected blueprints, and the quantity and quality of selected resource lots to verified app members. Your Discord identity, organizations and other inventory stay private. You can withdraw at any time.',
          'La publication montre ton handle et ton nom RSI publics, les blueprints sélectionnés, ainsi que la quantité et la qualité des lots choisis aux membres vérifiés de l’app. Ton identité Discord, tes organisations et le reste de ton inventaire restent privés. Tu peux retirer tes annonces à tout moment.',
          'Veröffentlichungen zeigen verifizierten App-Mitgliedern deinen RSI-Handle und öffentlichen Namen, ausgewählte Blueprints sowie Menge und Qualität ausgewählter Ressourcen. Discord-Identität, Organisationen und übriges Inventar bleiben privat. Du kannst Angebote jederzeit zurückziehen.',
        )}
      </AppAlert>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <AppCheckbox
          label={t(
            'Make my selection visible to the community',
            'Rendre ma sélection visible à la communauté',
            'Meine Auswahl für die Community veröffentlichen',
          )}
          checked={draft.enabled}
          disabled={busy || !verified}
          onCheckedChange={(enabled) => setDraft((current) => ({ ...current, enabled }))}
        />
        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
          {account.marketplace?.enabled
            ? t(
                'Your saved selection is currently published.',
                'Ta sélection enregistrée est actuellement publiée.',
                'Deine gespeicherte Auswahl ist aktuell veröffentlicht.',
              )
            : t(
                'Your listings are currently private.',
                'Tes annonces sont actuellement privées.',
                'Deine Angebote sind aktuell privat.',
              )}
        </Typography>
      </Paper>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
        <AppTextField
          type="search"
          label={t('Search my inventory', 'Rechercher dans mon inventaire', 'Mein Inventar durchsuchen')}
          value={search}
          onValueChange={setSearch}
          fieldSx={{ flex: '1 1 260px' }}
        />
        <AppButton href="/account?section=inventory" variant="secondary">
          {t('Manage inventory', 'Gérer mon inventaire', 'Inventar verwalten')}
        </AppButton>
      </Stack>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
        <Typography variant="body2">
          {selectedCount} {t('selected', 'sélectionnés', 'ausgewählt')} ·{' '}
          {activeDataset.channel.toUpperCase()}
        </Typography>
        <AppButton
          size="sm"
          variant="ghost"
          disabled={busy || !verified || choices.length === 0}
          onClick={() =>
            setDraft((current) => ({
              ...current,
              blueprintIds: [
                ...new Set([
                  ...current.blueprintIds,
                  ...choices.filter((entry) => entry.kind === 'blueprint').map((entry) => entry.id),
                ]),
              ],
              resourceEntryIds: [
                ...new Set([
                  ...current.resourceEntryIds,
                  ...choices.filter((entry) => entry.kind === 'resource').map((entry) => entry.id),
                ]),
              ],
            }))
          }
        >
          {t('Select matching items', 'Sélectionner les résultats', 'Treffer auswählen')}
        </AppButton>
        <AppButton
          size="sm"
          variant="ghost"
          disabled={busy || !verified || selectedCount === 0}
          onClick={() => setDraft((current) => ({ ...current, blueprintIds: [], resourceEntryIds: [] }))}
        >
          {t('Clear selection', 'Vider la sélection', 'Auswahl leeren')}
        </AppButton>
      </Stack>
      <Box
        role="group"
        aria-label={t('Items to publish', 'Éléments à publier', 'Zu veröffentlichende Einträge')}
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}
      >
        {choices.slice(0, visibleCount).map((entry) => (
          <Paper key={`${entry.kind}:${entry.id}`} variant="outlined" sx={{ p: 1.5, minWidth: 0 }}>
            <AppCheckbox
              label={
                <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <Typography sx={{ fontWeight: 600 }}>{entry.name}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {entry.detail}
                  </Typography>
                </Box>
              }
              checked={(entry.kind === 'blueprint'
                ? validDraft.blueprintIds
                : validDraft.resourceEntryIds
              ).includes(entry.id)}
              disabled={busy || !verified}
              onCheckedChange={(checked) => toggle(entry.id, entry.kind, checked)}
            />
          </Paper>
        ))}
      </Box>
      {!choices.length && (
        <Typography sx={{ color: 'text.secondary' }}>
          {t(
            'No inventory items match. Add items in Account or change your search.',
            'Aucun élément correspondant. Ajoute des éléments dans Account ou modifie ta recherche.',
            'Keine passenden Einträge. Ergänze dein Inventar im Konto oder ändere die Suche.',
          )}
        </Typography>
      )}
      {choices.length > visibleCount && (
        <AppButton variant="secondary" onClick={() => setVisibleCount((count) => count + 40)}>
          {t('Show more inventory', 'Afficher plus d’éléments', 'Mehr Inventar anzeigen')}
        </AppButton>
      )}
      {tooMany && (
        <AppAlert severity="warning">
          {t(
            'Select at most 400 offers per environment, combining blueprints and resource lots.',
            'Sélectionne au maximum 400 offres par environnement, blueprints et lots confondus.',
            'Wähle höchstens 400 Angebote pro Umgebung, Blueprints und Ressourcenlose zusammen.',
          )}
        </AppAlert>
      )}
      <Paper
        variant="outlined"
        sx={{ p: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}
      >
        <AppButton
          disabled={busy || !verified || tooMany || (draft.enabled && selectedCount === 0)}
          onClick={() => {
            void onSave(validDraft);
          }}
        >
          {draft.enabled
            ? t('Publish my selection', 'Publier ma sélection', 'Meine Auswahl veröffentlichen')
            : t('Save without publishing', 'Enregistrer sans publier', 'Ohne Veröffentlichung speichern')}
        </AppButton>
        <AppButton
          variant="secondary"
          disabled={busy || !account.marketplace?.enabled}
          onClick={() => {
            void onSave({ ...selectionOf(account), enabled: false });
          }}
        >
          {t('Withdraw all listings', 'Retirer toutes mes annonces', 'Alle Angebote zurückziehen')}
        </AppButton>
        {saved !== JSON.stringify(validDraft) && (
          <Typography role="status" variant="body2" sx={{ color: 'text.secondary' }}>
            {t('Unsaved selection', 'Sélection non enregistrée', 'Ungespeicherte Auswahl')}
          </Typography>
        )}
      </Paper>
    </Stack>
  );
}
