import type { ReactNode } from "react";
import rsiLogoOfficial from "../../assets/rsi-logo-official.jpg";
import { useThemeMode } from "../../hooks/ThemeContext";
import { useI18n } from "../../i18n/I18nContext";
import { FONT_MONO } from "../../theme";
import { Box, Divider, Paper, Stack, Typography, alpha } from "../../ui/system";
import { sanitizeExternalHttpsUrl } from "../../utils/urlSafety";
import { CitizenIdSignInButton } from "../CitizenIdBrand";
import { Button } from "../ui/Button";
import { AppSelect, AppSwitch, AppTextField } from "../ui/controls";
import { AppChip } from "../ui/data-display/AppChip";
import { AppAlert } from "../ui/feedback";
import { Link } from "../ui/primitives";
import type { AccountController } from "./useAccountController";

function SettingsSection({
  title,
  description,
  children,
  fullWidth = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <Paper
      component="section"
      variant="outlined"
      sx={{
        p: { xs: 1.5, sm: 2 },
        minWidth: 0,
        ...(fullWidth ? { gridColumn: "1 / -1" } : {}),
      }}
    >
      <Stack spacing={2}>
        <Box>
          <Typography component="h3" variant="h6">
            {title}
          </Typography>
          {description && (
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", mt: 0.5 }}
            >
              {description}
            </Typography>
          )}
        </Box>
        {children}
      </Stack>
    </Paper>
  );
}

export function AccountSettingsPanel({ model }: { model: AccountController }) {
  const { lang, setLang } = useI18n();
  const { mode, setMode } = useThemeMode();
  const {
    t,
    user,
    citizenIdRsiLinkEnabled,
    citizenIdBrandEnvironment,
    account,
    activeDataset,
    theme,
    isDesktop,
    sync,
    watcher,
    deleteAction,
    copyLiveToPtuAction,
    rsiUnlinkAction,
    customPaths,
    customPathInput,
    setCustomPathInput,
    customPathLabel,
    setCustomPathLabel,
    watcherError,
    watcherBusy,
    resolvedLivePath,
    addCustomPath,
    removeCustomPath,
    handleWatcherToggle,
    handleAutoStartupToggle,
    rsiVerificationRequired,
    handleDeleteAccount,
    handleCopyLiveDataToPtu,
    handleStartRsiLink,
    handleUnlinkRsiAccount,
  } = model;
  if (!user) return null;
  const profileUrl = sanitizeExternalHttpsUrl(account?.rsi?.profileUrl);
  const pendingLocalCount =
    model.localImportPlan.missingFavoriteBlueprintIds.length +
    model.localImportPlan.missingInventoryBlueprintIds.length +
    model.localImportPlan.missingInventoryResources.length;

  return (
    <Stack
      role="tabpanel"
      id="account-tabpanel-settings"
      aria-labelledby="account-tab-settings"
      spacing={2}
    >
      <Box>
        <Typography component="h2" variant="h5">
          {t("Settings", "Paramètres", "Einstellungen")}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
          {t(
            "Make SC Craft yours, manage your data and connect your accounts.",
            "Personnalise SC Craft, gère tes données et tes comptes liés.",
            "Passe SC Craft an, verwalte deine Daten und verknüpften Konten.",
          )}
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
          gap: 2,
          alignItems: "start",
        }}
      >
        <SettingsSection
          title={t("Preferences", "Préférences", "Einstellungen zur Anzeige")}
          description={t(
            "These choices apply across the app on this device.",
            "Ces choix s’appliquent à toute l’application sur cet appareil.",
            "Diese Auswahl gilt für die gesamte App auf diesem Gerät.",
          )}
        >
          <AppSelect
            label={t("Language", "Langue", "Sprache")}
            value={lang}
            onValueChange={(value) => {
              if (value) setLang(value);
            }}
            options={[
              { value: "en", label: "English" },
              { value: "fr", label: "Français" },
              { value: "de", label: "Deutsch" },
            ]}
          />
          <AppSelect
            label={t("Appearance", "Apparence", "Darstellung")}
            value={mode}
            onValueChange={(value) => {
              if (value) setMode(value);
            }}
            options={[
              { value: "dark", label: t("Dark", "Sombre", "Dunkel") },
              { value: "light", label: t("Light", "Clair", "Hell") },
            ]}
          />
        </SettingsSection>

        <SettingsSection
          title={t("RSI identity", "Identité RSI", "RSI-Identität")}
          description={t(
            "Your verified identity unlocks organizations, sharing and craft requests.",
            "Ton identité vérifiée donne accès aux organisations, aux partages et aux demandes de craft.",
            "Deine verifizierte Identität ermöglicht Organisationen, Freigaben und Craft-Anfragen.",
          )}
        >
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              component="img"
              src={rsiLogoOfficial}
              alt=""
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1,
                objectFit: "contain",
              }}
            />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, overflowWrap: "anywhere" }}
              >
                {account?.rsi?.handle ??
                  t(
                    "No RSI account linked",
                    "Aucun compte RSI lié",
                    "Kein RSI-Konto verknüpft",
                  )}
              </Typography>
              {profileUrl && (
                <Link
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t(
                    "View RSI profile",
                    "Voir le profil RSI",
                    "RSI-Profil ansehen",
                  )}
                </Link>
              )}
            </Box>
          </Stack>
          {account?.rsi?.handle && (
            <AppChip
              size="sm"
              outlined
              tone={rsiVerificationRequired ? "warning" : "success"}
              sx={{ alignSelf: "flex-start" }}
              label={
                rsiVerificationRequired
                  ? t(
                      "Verification required",
                      "Vérification requise",
                      "Verifizierung erforderlich",
                    )
                  : t(
                      "Verified identity",
                      "Identité vérifiée",
                      "Verifizierte Identität",
                    )
              }
            />
          )}
          {(!account?.rsi?.handle || rsiVerificationRequired) &&
            (citizenIdRsiLinkEnabled ? (
              <CitizenIdSignInButton
                environment={citizenIdBrandEnvironment}
                onClick={handleStartRsiLink}
                disabled={model.rsiAction.busy}
                fullWidth
              />
            ) : (
              <Button
                variant="primary"
                onClick={handleStartRsiLink}
                disabled={model.rsiAction.busy}
              >
                {t(
                  "Verify RSI manually",
                  "Vérifier RSI manuellement",
                  "RSI manuell verifizieren",
                )}
              </Button>
            ))}
          {account?.rsi?.handle && (
            <Button
              variant="ghost"
              size="sm"
              sx={{ alignSelf: "flex-start" }}
              onClick={() => {
                void handleUnlinkRsiAccount();
              }}
              disabled={rsiUnlinkAction.busy}
            >
              {rsiUnlinkAction.busy
                ? t("Removing…", "Suppression…", "Entferne…")
                : t(
                    "Unlink RSI account",
                    "Délier le compte RSI",
                    "RSI-Konto trennen",
                  )}
            </Button>
          )}
          {rsiUnlinkAction.error && (
            <AppAlert severity="error">{rsiUnlinkAction.error}</AppAlert>
          )}
        </SettingsSection>

        <SettingsSection
          fullWidth
          title={t(
            "Personal data and privacy",
            "Données personnelles et confidentialité",
            "Persönliche Daten und Datenschutz",
          )}
          description={t(
            "Access a copy of your account data or delete your account below.",
            "Accède à une copie des données de ton compte ou supprime ton compte ci-dessous.",
            "Greife auf eine Kopie deiner Kontodaten zu oder lösche unten dein Konto.",
          )}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t(
                  "Download a copy",
                  "Télécharger une copie",
                  "Kopie herunterladen",
                )}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 0.25, color: "text.secondary" }}
              >
                {t(
                  "Download your profile and LIVE/PTU account data in a readable JSON file. This copy is for access to your data; it is not an importable backup.",
                  "Télécharge ton profil et les données de ton compte LIVE/PTU dans un fichier JSON lisible. Cette copie permet d’accéder à tes données ; elle ne peut pas être réimportée.",
                  "Lade dein Profil und deine LIVE/PTU-Kontodaten als lesbare JSON-Datei herunter. Diese Kopie dient dem Datenzugang und kann nicht als Sicherung importiert werden.",
                )}
              </Typography>
            </Box>
            <Button
              variant="secondary"
              onClick={() => {
                void model.exportAccount();
              }}
              disabled={!account || model.exportAction.busy}
            >
              {t(
                "Download my personal data",
                "Télécharger mes données personnelles",
                "Meine persönlichen Daten herunterladen",
              )}
            </Button>
          </Stack>
          {model.exportAction.error && (
            <AppAlert severity="error">{model.exportAction.error}</AppAlert>
          )}
          <Link href="/privacy">
            {t(
              "Privacy policy",
              "Politique de confidentialité",
              "Datenschutzerklärung",
            )}
          </Link>
        </SettingsSection>
        <SettingsSection
          fullWidth
          title={t(
            "Inventory transfer",
            "Transfert d’inventaire",
            "Inventarübertragung",
          )}
          description={t(
            "Move local progress to your account or prepare your PTU inventory.",
            "Récupère ta progression locale dans ton compte ou prépare ton inventaire PTU.",
            "Übertrage lokalen Fortschritt in dein Konto oder bereite dein PTU-Inventar vor.",
          )}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t(
                  "Import from this device",
                  "Importer depuis cet appareil",
                  "Von diesem Gerät importieren",
                )}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 0.25, color: "text.secondary" }}
              >
                {model.localImportPlan.hasPendingImport
                  ? t(
                      `${pendingLocalCount} saved items can be added to your account. Review them before importing.`,
                      `${pendingLocalCount} éléments locaux peuvent être ajoutés à ton compte. Vérifie-les avant l’import.`,
                      `${pendingLocalCount} lokal gespeicherte Einträge können hinzugefügt werden. Prüfe sie vor dem Import.`,
                    )
                  : t(
                      "There are no local favorites, blueprints or resource batches waiting to be imported.",
                      "Aucun favori, blueprint ou lot de ressources local n’attend d’être importé.",
                      "Keine lokalen Favoriten, Blueprints oder Ressourcenposten warten auf den Import.",
                    )}
              </Typography>
            </Box>
            <Button
              variant="secondary"
              disabled={
                !model.localImportPlan.hasPendingImport ||
                model.importAction.busy
              }
              onClick={() => model.setImportModalDismissed(false)}
            >
              {t(
                "Review local import",
                "Revoir l’import local",
                "Lokalen Import prüfen",
              )}
            </Button>
          </Stack>
          <Divider />
          <Box
            sx={{
              p: 1.5,
              borderRadius: 1,
              backgroundColor: alpha(theme.palette.warning.main, 0.05),
              border: "1px solid",
              borderColor: alpha(theme.palette.warning.main, 0.2),
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
            >
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {t(
                    "Copy LIVE data to PTU",
                    "Copier les données LIVE vers PTU",
                    "LIVE-Daten nach PTU kopieren",
                  )}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 0.25, color: "text.secondary" }}
                >
                  {t(
                    "This replaces your current PTU inventory, favorites, planner, shares and craft requests with your LIVE data.",
                    "Cette copie remplace ton inventaire PTU, tes favoris, ton planner, tes partages et tes demandes de craft par les données LIVE.",
                    "Dies ersetzt dein aktuelles PTU-Inventar, Favoriten, deinen Planner, Freigaben und Craft-Anfragen durch deine LIVE-Daten.",
                  )}
                </Typography>
              </Box>
              <Button
                variant="secondary"
                disabled={
                  copyLiveToPtuAction.busy || activeDataset.channel !== "ptu"
                }
                onClick={() => {
                  void handleCopyLiveDataToPtu();
                }}
              >
                {copyLiveToPtuAction.busy
                  ? t("Copying…", "Copie…", "Kopiere…")
                  : t(
                      "Copy LIVE to PTU",
                      "Copier LIVE vers PTU",
                      "LIVE nach PTU kopieren",
                    )}
              </Button>
            </Stack>
            {activeDataset.channel !== "ptu" && (
              <Typography
                variant="body2"
                sx={{ mt: 1, color: "text.secondary" }}
              >
                {t(
                  "Select the PTU dataset in the app header to enable this action.",
                  "Sélectionne le dataset PTU dans l’en-tête de l’application pour activer cette action.",
                  "Wähle im App-Kopf den PTU-Datensatz aus, um diese Aktion zu aktivieren.",
                )}
              </Typography>
            )}
          </Box>
          {copyLiveToPtuAction.error && (
            <AppAlert severity="error">{copyLiveToPtuAction.error}</AppAlert>
          )}
        </SettingsSection>

        {isDesktop && (
          <SettingsSection
            fullWidth
            title={t(
              "Star Citizen installations",
              "Installations Star Citizen",
              "Star Citizen-Installationen",
            )}
            description={t(
              "Choose the game folders used to detect your blueprints.",
              "Choisis les dossiers du jeu utilisés pour détecter tes blueprints.",
              "Wähle die Spielordner für die Blueprint-Erkennung.",
            )}
          >
            <Box>
              <Typography component="h4" variant="subtitle2">
                {t("Detected folders", "Dossiers détectés", "Erkannte Ordner")}
              </Typography>
              <Stack spacing={1} sx={{ mt: 1 }}>
                {(
                  [
                    ["LIVE", sync.installPaths?.live],
                    ["PTU", sync.installPaths?.ptu],
                  ] as const
                )
                  .filter(([, path]) => path)
                  .map(([label, path]) => (
                    <Stack
                      key={label}
                      direction="row"
                      spacing={1}
                      alignItems="flex-start"
                    >
                      <AppChip size="sm" label={label} outlined />
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: FONT_MONO,
                          color: "text.secondary",
                          overflowWrap: "anywhere",
                          minWidth: 0,
                        }}
                      >
                        {path}
                      </Typography>
                    </Stack>
                  ))}
                {!sync.installPaths?.live && !sync.installPaths?.ptu && (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {sync.detecting
                      ? t(
                          "Looking for game installations…",
                          "Recherche des installations…",
                          "Suche nach Spielinstallationen…",
                        )
                      : t(
                          "No installation detected. Add your game folder below.",
                          "Aucune installation détectée. Ajoute le dossier de ton jeu ci-dessous.",
                          "Keine Installation erkannt. Füge unten deinen Spielordner hinzu.",
                        )}
                  </Typography>
                )}
              </Stack>
            </Box>
            {customPaths.length > 0 && (
              <Box>
                <Typography component="h4" variant="subtitle2">
                  {t(
                    "Custom folders",
                    "Dossiers personnalisés",
                    "Eigene Ordner",
                  )}
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {customPaths.map((path) => (
                    <Stack
                      key={path.id}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                    >
                      <AppChip size="sm" label={path.label} outlined />
                      <Typography
                        variant="body2"
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          overflowWrap: "anywhere",
                          fontFamily: FONT_MONO,
                          color: "text.secondary",
                        }}
                      >
                        {path.path}
                      </Typography>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeCustomPath(path.id)}
                        disabled={watcherBusy}
                        aria-label={t(
                          `Remove ${path.label} path ${path.path}`,
                          `Supprimer le chemin ${path.label} ${path.path}`,
                          `${path.label}-Pfad ${path.path} entfernen`,
                        )}
                      >
                        {t("Remove", "Retirer", "Entfernen")}
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}
            <Box
              component="form"
              onSubmit={(event) => {
                event.preventDefault();
                if (customPathInput.trim() && !watcherBusy) addCustomPath();
              }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1}
                alignItems={{ xs: "stretch", md: "flex-end" }}
              >
                <AppSelect
                  label={t("Game channel", "Canal de jeu", "Spielkanal")}
                  value={customPathLabel}
                  onValueChange={(value) => {
                    if (value) setCustomPathLabel(value);
                  }}
                  options={[
                    "LIVE",
                    "PTU",
                    "HOTFIX",
                    "TECH-PREVIEW",
                    "EVOCATI",
                  ].map((label) => ({
                    value: label,
                    label,
                  }))}
                  fieldSx={{ minWidth: { md: 165 } }}
                  disabled={watcherBusy}
                />
                <AppTextField
                  label={t(
                    "Path to the channel folder",
                    "Chemin du dossier du canal",
                    "Pfad zum Kanalordner",
                  )}
                  value={customPathInput}
                  onValueChange={setCustomPathInput}
                  placeholder={
                    "C:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE"
                  }
                  fieldSx={{ flex: 1 }}
                  disabled={watcherBusy}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={!customPathInput.trim() || watcherBusy}
                >
                  {t("Add folder", "Ajouter le dossier", "Ordner hinzufügen")}
                </Button>
              </Stack>
            </Box>
            <Divider />
            <AppSwitch
              label={t(
                "Detect new blueprints from LIVE logs",
                "Détecter les nouveaux blueprints dans les logs LIVE",
                "Neue Blueprints aus LIVE-Logs erkennen",
              )}
              description={t(
                "Watch the game log while SC Craft is running.",
                "Surveille le journal du jeu lorsque SC Craft est ouvert.",
                "Überwacht das Spielprotokoll, solange SC Craft läuft.",
              )}
              checked={watcher.running}
              disabled={watcherBusy || (!watcher.running && !resolvedLivePath)}
              onCheckedChange={(checked) => {
                void handleWatcherToggle(checked);
              }}
            />
            {resolvedLivePath ? (
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
              >
                {t(
                  `LIVE folder: ${resolvedLivePath}`,
                  `Dossier LIVE : ${resolvedLivePath}`,
                  `LIVE-Ordner: ${resolvedLivePath}`,
                )}
              </Typography>
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {t(
                  "Add a LIVE folder to enable log monitoring.",
                  "Ajoute un dossier LIVE pour activer la surveillance des logs.",
                  "Füge einen LIVE-Ordner hinzu, um die Protokollüberwachung zu aktivieren.",
                )}
              </Typography>
            )}
            <AppSwitch
              label={t(
                "Launch at Windows startup",
                "Lancer au démarrage de Windows",
                "Beim Windows-Start öffnen",
              )}
              description={t(
                "Open SC Craft automatically when you sign in to Windows.",
                "Ouvre SC Craft automatiquement à la connexion Windows.",
                "Öffnet SC Craft automatisch bei der Windows-Anmeldung.",
              )}
              checked={watcher.autoStartupEnabled}
              disabled={watcherBusy}
              onCheckedChange={(checked) => {
                void handleAutoStartupToggle(checked);
              }}
            />
            {(watcherError || watcher.error || sync.detectError) && (
              <AppAlert severity="error">
                {watcherError || watcher.error || sync.detectError}
              </AppAlert>
            )}
          </SettingsSection>
        )}

        <Paper
          component="section"
          variant="outlined"
          sx={{
            gridColumn: "1 / -1",
            p: { xs: 1.5, sm: 2 },
            borderColor: alpha(theme.palette.error.main, 0.3),
            backgroundColor: alpha(theme.palette.error.main, 0.025),
          }}
        >
          <Stack spacing={1.5}>
            <Typography
              component="h3"
              variant="h6"
              sx={{ color: "error.main" }}
            >
              {t("Delete account", "Supprimer le compte", "Konto löschen")}
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
            >
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", maxWidth: 760 }}
              >
                {t(
                  "Permanently delete your SC Craft cloud profile and account data in both LIVE and PTU, then sign out. Download a copy above if you want to keep your data.",
                  "Supprime définitivement ton profil cloud SC Craft et les données de ton compte LIVE et PTU, puis te déconnecte. Télécharge une copie ci-dessus si tu souhaites conserver tes données.",
                  "Löscht dein SC Craft-Cloudprofil sowie deine LIVE- und PTU-Kontodaten dauerhaft und meldet dich ab. Lade oben eine Kopie herunter, wenn du deine Daten behalten möchtest.",
                )}
              </Typography>
              <Button
                variant="danger"
                disabled={deleteAction.busy}
                onClick={() => {
                  void handleDeleteAccount();
                }}
              >
                {deleteAction.busy
                  ? t("Deleting…", "Suppression…", "Wird gelöscht…")
                  : t(
                      "Delete my account",
                      "Supprimer mon compte",
                      "Mein Konto löschen",
                    )}
              </Button>
            </Stack>
            {deleteAction.error && (
              <AppAlert severity="error">{deleteAction.error}</AppAlert>
            )}
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}
