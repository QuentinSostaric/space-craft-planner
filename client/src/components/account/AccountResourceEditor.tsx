import { Box, Paper, Stack, Typography } from '../../ui/system';
import { AddOutlinedIcon } from '../../ui/icons';
import { AppButton, AppSelect, AppTextField } from '../ui/controls';
import { AppAlert } from '../ui/feedback';
import { AppDialog } from '../ui/overlays';
import { RESOURCE_BATCH_SCU_STEP } from './accountHelpers';
import type { AccountController } from './useAccountController';

export function AccountResourceEditor({ model }: { model: AccountController }) {
  const {
    t,
    resourceBatchDialogOpen,
    resourceBatchBusy,
    resourceBatchRows,
    resourceBatchError,
    editingResourceId,
  } = model;
  const existing = editingResourceId
    ? model.inventoryResources.find((entry) => entry.id === editingResourceId)
    : null;
  return (
    <AppDialog
      open={resourceBatchDialogOpen}
      onOpenChange={(open) => {
        if (!open) model.closeResourceBatchDialog();
      }}
      dismissable={!resourceBatchBusy}
      title={
        editingResourceId
          ? t('Edit resource', 'Modifier la ressource', 'Ressource bearbeiten')
          : t('Add resources', 'Ajouter des ressources', 'Ressourcen hinzufügen')
      }
      description={
        editingResourceId
          ? t(
              'Update this lot without changing its organization shares.',
              'Modifie ce lot en conservant ses partages avec les organisations.',
              'Aktualisiere diesen Bestand, ohne seine Freigaben zu ändern.',
            )
          : t(
              'Keep separate lots for different qualities. Leave quality empty when it is unknown.',
              'Garde des lots séparés pour chaque qualité. Laisse la qualité vide si elle est inconnue.',
              'Nutze getrennte Bestände für verschiedene Qualitäten. Lasse unbekannte Qualität leer.',
            )
      }
      width="min(48rem, calc(100vw - 2rem))"
      footer={
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <AppButton variant="ghost" disabled={resourceBatchBusy} onClick={model.closeResourceBatchDialog}>
            {t('Cancel', 'Annuler', 'Abbrechen')}
          </AppButton>
          <AppButton
            variant="primary"
            loading={resourceBatchBusy}
            disabled={!resourceBatchRows.length}
            onClick={() => {
              void model.handleAddResourceBatch();
            }}
          >
            {editingResourceId
              ? t('Save changes', 'Enregistrer les modifications', 'Änderungen speichern')
              : t('Add resource entries', 'Ajouter les ressources', 'Ressourceneinträge hinzufügen')}
          </AppButton>
        </Box>
      }
    >
      <Stack spacing={1.5}>
        {resourceBatchError && <AppAlert severity="error">{resourceBatchError}</AppAlert>}
        {resourceBatchRows.map((row, index) => {
          const quantityUnit =
            existing?.quantityUnit ?? model.resourceQuantityUnitById.get(row.resourceId) ?? 'scu';
          return (
            <Paper key={row.id} variant="outlined" sx={{ p: 1.5 }}>
              <Stack spacing={1.25}>
                {!editingResourceId && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '.8125rem', fontWeight: 650 }}>
                      {t(`Lot ${index + 1}`, `Lot ${index + 1}`, `Bestand ${index + 1}`)}
                    </Typography>
                    {resourceBatchRows.length > 1 && (
                      <AppButton
                        size="sm"
                        variant="ghost"
                        disabled={resourceBatchBusy}
                        onClick={() => model.removeResourceBatchRow(row.id)}
                      >
                        {t('Remove row', 'Retirer la ligne', 'Zeile entfernen')}
                      </AppButton>
                    )}
                  </Box>
                )}
                {editingResourceId ? (
                  <Typography sx={{ fontWeight: 650 }}>{existing?.resourceName}</Typography>
                ) : (
                  <AppSelect
                    label={t('Resource', 'Ressource', 'Ressource')}
                    value={row.resourceId}
                    options={model.sortedResources.map((resource) => ({
                      label: resource.name,
                      value: resource.id,
                    }))}
                    filterable
                    disabled={resourceBatchBusy}
                    onValueChange={(value) =>
                      value && model.updateResourceBatchRow(row.id, { resourceId: value })
                    }
                  />
                )}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.5,
                  }}
                >
                  <AppTextField
                    type="number"
                    label={`${t('Quantity', 'Quantité', 'Menge')} (${quantityUnit === 'scu' ? 'SCU' : t('items', 'objets', 'Stück')})`}
                    value={row.quantity}
                    disabled={resourceBatchBusy}
                    onValueChange={(value) => model.updateResourceBatchRow(row.id, { quantity: value })}
                    min={quantityUnit === 'count' ? 1 : RESOURCE_BATCH_SCU_STEP}
                    step={quantityUnit === 'count' ? 1 : RESOURCE_BATCH_SCU_STEP}
                    helperText={
                      quantityUnit === 'count'
                        ? t(
                            'Whole items, greater than zero.',
                            'Nombre entier, supérieur à zéro.',
                            'Ganze Stückzahl größer als null.',
                          )
                        : t('Minimum 0.000001 SCU.', 'Minimum 0,000001 SCU.', 'Mindestens 0,000001 SCU.')
                    }
                  />
                  <AppTextField
                    type="number"
                    label={t('Quality', 'Qualité', 'Qualität')}
                    value={row.quality}
                    disabled={resourceBatchBusy}
                    onValueChange={(value) => model.updateResourceBatchRow(row.id, { quality: value })}
                    min={0}
                    max={1000}
                    step={1}
                    placeholder={t('Unknown', 'Inconnue', 'Unbekannt')}
                    helperText={t(
                      'Optional · 0 to 1000',
                      'Facultatif · de 0 à 1000',
                      'Optional · 0 bis 1000',
                    )}
                  />
                </Box>
              </Stack>
            </Paper>
          );
        })}
        {!editingResourceId && (
          <AppButton
            variant="secondary"
            icon={<AddOutlinedIcon sx={{ fontSize: 15 }} />}
            disabled={resourceBatchBusy || !model.sortedResources.length}
            onClick={model.addResourceBatchRow}
          >
            {t('Add row', 'Ajouter une ligne', 'Zeile hinzufügen')}
          </AppButton>
        )}
      </Stack>
    </AppDialog>
  );
}
