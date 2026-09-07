import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import type { StoredAccount } from "../../services/authService";
import type { MarketplacePublication } from "../../services/marketplaceService";
import { useCraft } from "../../store/CraftContext";
import { Box, Paper, Stack, Typography } from "../../ui/system";
import { AppButton, AppCheckbox, AppTextField } from "../ui/controls";
import { AppAlert, SurfaceState } from "../ui/feedback";
import {
  SharedBlueprintOfferCard,
  SharedResourceOfferCard,
} from "../organizations";
import { AppChip } from "../ui/data-display/AppChip";

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
  onViewOffers,
}: {
  account: StoredAccount;
  verified: boolean;
  busy: boolean;
  onSave: (value: MarketplacePublication) => Promise<boolean>;
  onViewOffers: () => void;
}) {
  const { t } = useI18n();
  const { activeDataset } = useCraft();
  const [draft, setDraft] = useState(() => selectionOf(account));
  const [type, setType] = useState<"blueprints" | "resources">("blueprints");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(24);
  const saved = JSON.stringify(selectionOf(account));
  useEffect(() => {
    setDraft(JSON.parse(saved) as MarketplacePublication);
  }, [saved]);
  useEffect(() => {
    setVisibleCount(24);
  }, [search, type]);
  const blueprintById = useMemo(
    () => new Map(activeDataset.blueprints.map((item) => [item.id, item])),
    [activeDataset.blueprints],
  );
  const resourceById = useMemo(
    () => new Map(activeDataset.resources.map((item) => [item.id, item])),
    [activeDataset.resources],
  );
  const owned = new Set(account.inventoryBlueprintIds);
  const lots = new Set(account.inventoryResources.map((item) => item.id));
  const validDraft = {
    ...draft,
    blueprintIds: draft.blueprintIds.filter((id) => owned.has(id)),
    resourceEntryIds: draft.resourceEntryIds.filter((id) => lots.has(id)),
  };
  const selectedCount =
    validDraft.blueprintIds.length + validDraft.resourceEntryIds.length;
  const tooMany = selectedCount > 400;
  const published = Boolean(account.marketplace?.enabled);
  const owner = {
    handle: account.rsi?.handle ?? "",
    displayName: account.rsi?.displayName ?? "",
  };
  const choices = (
    type === "blueprints"
      ? account.inventoryBlueprintIds.map((id) => ({
          id,
          name: blueprintById.get(id)?.name ?? id,
        }))
      : account.inventoryResources.map((entry) => ({
          id: entry.id,
          name: entry.resourceName,
        }))
  ).filter((entry) =>
    entry.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const field = type === "blueprints" ? "blueprintIds" : "resourceEntryIds";
  const dirty =
    JSON.stringify(validDraft.blueprintIds) !==
      JSON.stringify(account.marketplace?.blueprintIds ?? []) ||
    JSON.stringify(validDraft.resourceEntryIds) !==
      JSON.stringify(account.marketplace?.resourceEntryIds ?? []);
  const toggle = (id: string, checked: boolean) =>
    setDraft((current) => ({
      ...current,
      [field]: checked
        ? [...new Set([...current[field], id])]
        : current[field].filter((value) => value !== id),
    }));
  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2 }}>
        <Stack
          direction="row"
          spacing={1.5}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
          justifyContent="space-between"
        >
          <Box>
            <Typography component="h2" variant="h5" sx={{ fontWeight: 700 }}>
              {t("My listings", "Mes annonces", "Meine Angebote")}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
              {t(
                "Select items below, then publish. Changes go live only when you publish.",
                "Sélectionne tes offres ci-dessous, puis publie-les. Les modifications deviennent visibles uniquement après publication.",
                "Wähle unten Angebote aus und veröffentliche sie. Änderungen werden erst danach sichtbar.",
              )}
            </Typography>
          </Box>
          <AppChip
            tone={published ? "success" : "default"}
            label={
              published
                ? t("Published", "Publié", "Veröffentlicht")
                : t("Not published", "Non publié", "Nicht veröffentlicht")
            }
          />
        </Stack>
        <Typography variant="body2" sx={{ mt: 1.5, color: "text.secondary" }}>
          {t(
            "Publishing shares your public RSI identity and the selected offers with verified members. Organization shares remain separate. You can withdraw at any time.",
            "Publier rend ton identité RSI publique et les offres choisies visibles aux membres vérifiés. Les partages avec tes organisations restent séparés. Tu peux retirer tes annonces à tout moment.",
            "Die Veröffentlichung zeigt verifizierten Mitgliedern deine öffentliche RSI-Identität und gewählten Angebote. Organisationsfreigaben bleiben getrennt. Du kannst jederzeit zurückziehen.",
          )}
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
          sx={{ mt: 2 }}
        >
          <AppButton
            disabled={busy || !verified || tooMany || selectedCount === 0}
            onClick={() => {
              void onSave({ ...validDraft, enabled: true });
            }}
          >
            {published
              ? t(
                  "Publish changes",
                  "Publier les modifications",
                  "Änderungen veröffentlichen",
                )
              : t(
                  "Publish my selection",
                  "Publier ma sélection",
                  "Meine Auswahl veröffentlichen",
                )}
          </AppButton>
          {published && (
            <>
              <AppButton variant="secondary" onClick={onViewOffers}>
                {t(
                  "View my published offers",
                  "Voir mes offres publiées",
                  "Meine veröffentlichten Angebote ansehen",
                )}
              </AppButton>
              <AppButton
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  void onSave({ ...selectionOf(account), enabled: false });
                }}
              >
                {t(
                  "Withdraw all listings",
                  "Retirer toutes mes annonces",
                  "Alle Angebote zurückziehen",
                )}
              </AppButton>
            </>
          )}
          {dirty && (
            <Typography role="status" variant="body2">
              {t(
                "Unpublished changes",
                "Modifications non publiées",
                "Unveröffentlichte Änderungen",
              )}
            </Typography>
          )}
        </Stack>
        <Typography variant="body2" sx={{ mt: 1.5 }}>
          {validDraft.blueprintIds.length}{" "}
          {t(
            "blueprints selected",
            "blueprints sélectionnés",
            "Blueprints ausgewählt",
          )}{" "}
          · {validDraft.resourceEntryIds.length}{" "}
          {t(
            "resource lots selected",
            "lots de ressources sélectionnés",
            "Ressourcenlose ausgewählt",
          )}{" "}
          · {activeDataset.channel.toUpperCase()}
        </Typography>
      </Paper>
      <Box
        role="group"
        aria-label={t("Listing type", "Type d’annonce", "Angebotstyp")}
        sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}
      >
        <AppButton
          variant={type === "blueprints" ? "primary" : "secondary"}
          ariaPressed={type === "blueprints"}
          onClick={() => {
            setType("blueprints");
            setSearch("");
          }}
        >
          {t("Blueprints", "Blueprints", "Blueprints")} ·{" "}
          {account.inventoryBlueprintIds.length}
        </AppButton>
        <AppButton
          variant={type === "resources" ? "primary" : "secondary"}
          ariaPressed={type === "resources"}
          onClick={() => {
            setType("resources");
            setSearch("");
          }}
        >
          {t("Resources", "Ressources", "Ressourcen")} ·{" "}
          {account.inventoryResources.length}
        </AppButton>
      </Box>
      <Paper sx={{ p: 2 }}>
        <Stack
          direction="row"
          spacing={1.5}
          useFlexGap
          flexWrap="wrap"
          alignItems="flex-end"
        >
          <AppTextField
            type="search"
            label={t(
              "Search my inventory",
              "Rechercher dans mon inventaire",
              "Mein Inventar durchsuchen",
            )}
            value={search}
            onValueChange={setSearch}
            fieldSx={{ flex: "1 1 250px" }}
          />
          <AppButton href="/account?section=inventory" variant="secondary">
            {type === "resources"
              ? t(
                  "Add or edit resource lots",
                  "Ajouter ou modifier des lots",
                  "Ressourcenlose hinzufügen oder bearbeiten",
                )
              : t(
                  "Manage inventory",
                  "Gérer mon inventaire",
                  "Inventar verwalten",
                )}
          </AppButton>
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          sx={{ mt: 1.5 }}
          useFlexGap
          flexWrap="wrap"
        >
          <AppButton
            size="sm"
            variant="ghost"
            disabled={busy || !verified || !choices.length}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                [field]: [
                  ...new Set([
                    ...current[field],
                    ...choices.map((entry) => entry.id),
                  ]),
                ],
              }))
            }
          >
            {t(
              "Select matching items",
              "Sélectionner les résultats",
              "Treffer auswählen",
            )}
          </AppButton>
          <AppButton
            size="sm"
            variant="ghost"
            disabled={busy || !verified || !validDraft[field].length}
            onClick={() => setDraft((current) => ({ ...current, [field]: [] }))}
          >
            {t(
              "Clear this selection",
              "Vider cette sélection",
              "Diese Auswahl leeren",
            )}
          </AppButton>
        </Stack>
      </Paper>
      {tooMany && (
        <AppAlert severity="warning">
          {t(
            "Select at most 400 offers per environment, combining blueprints and resource lots.",
            "Sélectionne au maximum 400 offres par environnement, blueprints et lots confondus.",
            "Wähle höchstens 400 Angebote pro Umgebung, Blueprints und Ressourcenlose zusammen.",
          )}
        </AppAlert>
      )}
      <Box
        role="group"
        aria-label={t(
          "Items to publish",
          "Éléments à publier",
          "Zu veröffentlichende Einträge",
        )}
        sx={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fill, minmax(min(100%, 290px), 1fr))",
          gap: 2,
        }}
      >
        {choices.slice(0, visibleCount).map((entry) => {
          const blueprint =
            type === "blueprints" ? blueprintById.get(entry.id) : null;
          const lot =
            type === "resources"
              ? account.inventoryResources.find((item) => item.id === entry.id)
              : null;
          return (
            <Stack key={entry.id} spacing={1}>
              <AppCheckbox
                label={entry.name}
                checked={validDraft[field].includes(entry.id)}
                disabled={busy || !verified}
                onCheckedChange={(checked) => toggle(entry.id, checked)}
              />
              {blueprint ? (
                <SharedBlueprintOfferCard
                  blueprint={blueprint}
                  owner={owner}
                  selectionPreview
                />
              ) : lot ? (
                <SharedResourceOfferCard
                  entry={lot}
                  resource={resourceById.get(lot.resourceId)}
                  owner={owner}
                  selectionPreview
                />
              ) : (
                <Paper sx={{ p: 2 }}>
                  <Typography>{entry.name}</Typography>
                  <Typography variant="body2">
                    {t(
                      "Blueprint unavailable in this dataset",
                      "Blueprint indisponible dans ce dataset",
                      "Blueprint in diesem Datensatz nicht verfügbar",
                    )}
                  </Typography>
                </Paper>
              )}
            </Stack>
          );
        })}
      </Box>
      {!choices.length && (
        <SurfaceState
          title={
            type === "resources"
              ? t(
                  "No resource lots",
                  "Aucun lot de ressources",
                  "Keine Ressourcenlose",
                )
              : t(
                  "No matching blueprints",
                  "Aucun blueprint correspondant",
                  "Keine passenden Blueprints",
                )
          }
          description={
            type === "resources"
              ? t(
                  "Add resource lots in your Account inventory, with quantity and quality, then select them here.",
                  "Ajoute des lots dans l’inventaire de ton compte, avec leur quantité et leur qualité, puis sélectionne-les ici.",
                  "Füge Ressourcenlose mit Menge und Qualität im Kontoinventar hinzu und wähle sie hier aus.",
                )
              : t(
                  "Add blueprints in Account or change your search.",
                  "Ajoute des blueprints dans Account ou modifie ta recherche.",
                  "Füge Blueprints im Konto hinzu oder ändere die Suche.",
                )
          }
        />
      )}
      {choices.length > visibleCount && (
        <AppButton
          variant="secondary"
          onClick={() => setVisibleCount((count) => count + 24)}
        >
          {t(
            "Show more inventory",
            "Afficher plus d’éléments",
            "Mehr Inventar anzeigen",
          )}
        </AppButton>
      )}
    </Stack>
  );
}
