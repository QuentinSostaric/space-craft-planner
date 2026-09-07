import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { Box, Paper, Stack, Typography } from '../../ui/system';
import { navigateToPath, resourcePathFromSlug } from '../../utils/slug';
import { AppButton, AppSelect, AppTextField } from '../ui/controls';
import { AppAlert, SurfaceState } from '../ui/feedback';
import { SharedBlueprintOfferCard, SharedResourceOfferCard } from '../organizations';
import type { MarketplaceController } from './useMarketplaceController';

export function MarketplaceBrowse({ model }: { model: MarketplaceController }) {
  const { t } = useI18n();
  const { route, navigate, activeDataset, members, blueprintById, resourceById } = model;
  const [ownerInput, setOwnerInput] = useState(route.ownerHandle);
  useEffect(() => {
    setOwnerInput(route.ownerHandle);
  }, [route.ownerHandle]);
  const assets = useMemo(
    () =>
      route.type === 'blueprints'
        ? activeDataset.blueprints.map((item) => ({ label: item.name, value: item.id }))
        : activeDataset.resources.map((item) => ({ label: item.name, value: item.id })),
    [route.type, activeDataset.blueprints, activeDataset.resources],
  );
  const blueprintOffers = members.flatMap((member) =>
    member.sharedBlueprintIds.flatMap((id) => {
      const blueprint = blueprintById.get(id);
      return blueprint && (!route.assetId || route.assetId === id) ? [{ member, blueprint }] : [];
    }),
  );
  const resourceOffers = members.flatMap((member) =>
    member.sharedResources
      .filter((entry) => !route.assetId || route.assetId === entry.resourceId)
      .map((entry) => ({ member, entry })),
  );
  const hiddenBlueprints = members.reduce(
    (sum, member) => sum + member.sharedBlueprintIds.filter((id) => !blueprintById.has(id)).length,
    0,
  );
  const count = route.type === 'blueprints' ? blueprintOffers.length : resourceOffers.length;
  const currentHandle = model.auth.account?.rsi?.handle.toLowerCase();
  const context = t('Community marketplace', 'Marketplace communautaire', 'Community-Marktplatz');
  const safetyActions = (handle: string) =>
    currentHandle === handle.toLowerCase() ? null : (
      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
        <AppButton
          size="sm"
          variant="ghost"
          disabled={model.busy}
          onClick={() => {
            model.setReportError(null);
            model.setReportHandle(handle);
          }}
        >
          {t('Report', 'Signaler', 'Melden')}
        </AppButton>
        <AppButton
          size="sm"
          variant="ghost"
          disabled={model.busy}
          onClick={() => {
            void model.block(handle, true);
          }}
        >
          {t('Block player', 'Bloquer ce joueur', 'Spieler blockieren')}
        </AppButton>
      </Stack>
    );
  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography component="h2" variant="h5" sx={{ fontWeight: 700 }}>
          {t(
            'Find your next craft partner',
            'Trouve ton prochain partenaire de craft',
            'Finde deinen nächsten Craft-Partner',
          )}
        </Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.75 }}>
          {t(
            'Discover voluntarily shared blueprints and resources across the app community.',
            'Découvre les blueprints et ressources proposés volontairement par la communauté de l’app.',
            'Entdecke freiwillig geteilte Blueprints und Ressourcen der App-Community.',
          )}
        </Typography>
      </Box>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            spacing={1}
            role="group"
            aria-label={t('Offer type', 'Type d’offre', 'Angebotstyp')}
          >
            <AppButton
              ariaPressed={route.type === 'blueprints'}
              variant={route.type === 'blueprints' ? 'primary' : 'secondary'}
              onClick={() => navigate({ type: 'blueprints', assetId: '' })}
            >
              {t('Blueprints', 'Blueprints', 'Blueprints')}
            </AppButton>
            <AppButton
              ariaPressed={route.type === 'resources'}
              variant={route.type === 'resources' ? 'primary' : 'secondary'}
              onClick={() => navigate({ type: 'resources', assetId: '' })}
            >
              {t('Resources', 'Ressources', 'Ressourcen')}
            </AppButton>
          </Stack>
          <Box
            component="form"
            onSubmit={(event) => {
              event.preventDefault();
              navigate({ ownerHandle: ownerInput.trim() });
            }}
            sx={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: 1.5 }}
          >
            <AppSelect
              label={t('Find an item', 'Trouver un élément', 'Eintrag finden')}
              value={route.assetId}
              options={[
                { value: '', label: t('All items', 'Tous les éléments', 'Alle Einträge') },
                ...assets,
              ]}
              filterable
              onValueChange={(assetId) => navigate({ assetId: assetId ?? '' })}
              fieldSx={{ flex: '2 1 240px', minWidth: 0 }}
            />
            <AppTextField
              label={t('Exact RSI handle', 'Handle RSI exact', 'Exakter RSI-Handle')}
              value={ownerInput}
              onValueChange={setOwnerInput}
              maxLength={60}
              fieldSx={{ flex: '1 1 180px' }}
            />
            <AppButton type="submit" variant="secondary">
              {t('Apply', 'Appliquer', 'Anwenden')}
            </AppButton>
            {(route.assetId || route.ownerHandle) && (
              <AppButton
                variant="ghost"
                onClick={() => {
                  setOwnerInput('');
                  navigate({ assetId: '', ownerHandle: '' });
                }}
              >
                {t('Clear filters', 'Effacer les filtres', 'Filter löschen')}
              </AppButton>
            )}
          </Box>
        </Stack>
      </Paper>
      <Stack
        direction="row"
        spacing={1.5}
        useFlexGap
        flexWrap="wrap"
        justifyContent="space-between"
        alignItems="center"
      >
        <Typography variant="body2" role="status">
          {count} {t('offers loaded', 'offres chargées', 'Angebote geladen')} · {model.scope.toUpperCase()}
        </Typography>
        <AppButton
          variant="secondary"
          disabled={model.loading || model.busy}
          onClick={() => {
            void model.load();
          }}
        >
          {t('Refresh offers', 'Actualiser les offres', 'Angebote aktualisieren')}
        </AppButton>
      </Stack>
      {route.type === 'resources' && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t(
            'Lots stay separate by player, quantity and quality. Open the RSI profile to arrange availability; craft requests apply to blueprints.',
            'Les lots restent séparés par joueur, quantité et qualité. Ouvre le profil RSI pour convenir des disponibilités ; les demandes de craft concernent les blueprints.',
            'Lose bleiben nach Spieler, Menge und Qualität getrennt. Öffne das RSI-Profil, um Verfügbarkeit abzustimmen; Craft-Anfragen gelten für Blueprints.',
          )}
        </Typography>
      )}
      {model.loadError && (
        <AppAlert severity="error">
          <Stack spacing={1}>
            <Typography>{model.loadError}</Typography>
            <AppButton
              variant="secondary"
              onClick={() => {
                void model.load(model.cursor ?? undefined);
              }}
              disabled={model.loading}
            >
              {t('Try again', 'Réessayer', 'Erneut versuchen')}
            </AppButton>
          </Stack>
        </AppAlert>
      )}
      {hiddenBlueprints > 0 && route.type === 'blueprints' && (
        <AppAlert severity="info">
          {t(
            `${hiddenBlueprints} shared blueprints are not in this dataset and cannot be requested here.`,
            `${hiddenBlueprints} blueprints proposés sont absents de ce jeu de données et ne peuvent pas être demandés ici.`,
            `${hiddenBlueprints} angebotene Blueprints sind in diesem Datensatz nicht verfügbar und können hier nicht angefragt werden.`,
          )}
        </AppAlert>
      )}
      {model.loading && !members.length && (
        <SurfaceState
          tone="loading"
          title={t('Loading community offers', 'Chargement des offres', 'Community-Angebote werden geladen')}
        />
      )}
      {!count && !model.loading && !model.loadError && (
        <SurfaceState
          title={
            model.cursor
              ? t(
                  'No matching offers on this page',
                  'Aucune offre correspondante sur cette page',
                  'Keine passenden Angebote auf dieser Seite',
                )
              : t('No offers found', 'Aucune offre trouvée', 'Keine Angebote gefunden')
          }
          description={
            model.cursor
              ? t(
                  'Load more players to continue browsing.',
                  'Charge davantage de joueurs pour continuer.',
                  'Lade weitere Spieler, um fortzufahren.',
                )
              : t(
                  'Try another item or publish your own selection to help the community.',
                  'Essaie un autre élément ou publie ta sélection pour aider la communauté.',
                  'Versuche einen anderen Eintrag oder veröffentliche deine eigene Auswahl.',
                )
          }
          actionLabel={t('Manage my listings', 'Gérer mes annonces', 'Meine Angebote verwalten')}
          onAction={() => navigate({ tab: 'listings' })}
        />
      )}
      <Box
        role="list"
        aria-label={t('Community offers', 'Offres communautaires', 'Community-Angebote')}
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
          gap: 2,
        }}
      >
        {route.type === 'blueprints'
          ? blueprintOffers.map(({ member, blueprint }) => {
              const activeRequest = model.auth.account?.outgoingCraftRequests.find(
                (request) =>
                  request.source === 'community' &&
                  request.blueprintId === blueprint.id &&
                  request.ownerRsiHandle?.toLowerCase() === member.handle.toLowerCase() &&
                  (request.status === 'pending' || request.status === 'accepted'),
              );
              return (
                <Box
                  role="listitem"
                  key={`${member.handle}:${blueprint.id}`}
                  sx={{ minWidth: 0, display: 'flex', '& > *': { width: '100%' } }}
                >
                  <SharedBlueprintOfferCard
                    blueprint={blueprint}
                    owner={{ handle: member.handle, displayName: member.display }}
                    contextLabel={context}
                    requestState={
                      currentHandle === member.handle.toLowerCase()
                        ? 'self'
                        : activeRequest
                          ? activeRequest.status === 'accepted'
                            ? 'accepted'
                            : 'pending'
                          : 'available'
                    }
                    busy={model.busy}
                    onRequest={() => {
                      model.setRequestError(null);
                      model.setRequest({ blueprint, member });
                    }}
                    onOpenBlueprint={() => model.setActiveBlueprint(blueprint)}
                    onViewRequests={() => navigateToPath('/account?section=requests')}
                    onManageSharing={() => navigate({ tab: 'listings' })}
                    extraAction={safetyActions(member.handle)}
                  />
                </Box>
              );
            })
          : resourceOffers.map(({ member, entry }) => (
              <Box
                role="listitem"
                key={`${member.handle}:${entry.id}`}
                sx={{ minWidth: 0, display: 'flex', '& > *': { width: '100%' } }}
              >
                <SharedResourceOfferCard
                  entry={{ ...entry, createdAt: null, updatedAt: member.updatedAt }}
                  resource={resourceById.get(entry.resourceId)}
                  owner={{ handle: member.handle, displayName: member.display }}
                  contextLabel={context}
                  onOpenResource={
                    resourceById.has(entry.resourceId)
                      ? () => navigateToPath(resourcePathFromSlug(entry.resourceId))
                      : undefined
                  }
                  extraAction={safetyActions(member.handle)}
                />
              </Box>
            ))}
      </Box>
      {model.cursor && (
        <AppButton
          variant="secondary"
          disabled={model.loading || model.busy}
          onClick={() => {
            void model.load(model.cursor ?? undefined);
          }}
        >
          {model.loading
            ? t('Loading…', 'Chargement…', 'Wird geladen…')
            : t('Load more players', 'Charger plus de joueurs', 'Weitere Spieler laden')}
        </AppButton>
      )}
    </Stack>
  );
}
