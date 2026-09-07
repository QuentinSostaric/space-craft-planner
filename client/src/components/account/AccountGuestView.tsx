import { useState } from 'react';
import { Box, Paper, Stack, Typography } from '../../ui/system';
import {
  CloudSyncOutlinedIcon,
  HubOutlinedIcon,
  SmartToyOutlinedIcon,
  VerifiedUserOutlinedIcon,
} from '../../ui/icons';
import { useI18n } from '../../i18n/I18nContext';
import { AppButton } from '../ui/controls/AppButton';
import { AppAlert } from '../ui/feedback';
import accountScreenOne from '../../assets/account_1.png';
import accountScreenTwo from '../../assets/account_2.png';
import accountScreenThree from '../../assets/account_3.png';
import discordSymbol from '../../assets/discord-symbol.svg';
import citizenIdLogoProd from '../../assets/citizenid/prod-logo-light.png';
import citizenIdIconProd from '../../assets/citizenid/prod-icon-light.png';
import citizenIdLogoDev from '../../assets/citizenid/dev-logo-light.png';
import citizenIdIconDev from '../../assets/citizenid/dev-icon-light.png';

interface AccountGuestViewProps {
  enabled: boolean;
  brandEnvironment: 'production' | 'unstable';
  onLogin: () => void;
  onInviteBot: () => void;
}

export function AccountGuestView({ enabled, brandEnvironment, onLogin, onInviteBot }: AccountGuestViewProps) {
  const { t } = useI18n();
  const [activePreview, setActivePreview] = useState(0);
  // Keep the official light assets unaltered on the required #212126 surface.
  // Non-production environments use Citizen iD's red-star unstable branding.
  const isUnstable = brandEnvironment === 'unstable';
  const previews = [
    {
      label: t('Your inventory', 'Votre inventaire', 'Dein Inventar'),
      title: t(
        'Pick up where you left off',
        'Reprenez là où vous en étiez',
        'Mach dort weiter, wo du aufgehört hast',
      ),
      body: t(
        'Keep your blueprints, favorites and crafting plans available across devices. After signing in, you can review and import data saved in this browser.',
        'Retrouvez vos blueprints, favoris et plans de craft sur tous vos appareils. Après la connexion, vous pouvez consulter et importer les données enregistrées dans ce navigateur.',
        'Nutze deine Blueprints, Favoriten und Crafting-Pläne auf allen Geräten. Nach der Anmeldung kannst du die in diesem Browser gespeicherten Daten prüfen und importieren.',
      ),
      icon: <CloudSyncOutlinedIcon fontSize="small" />,
      image: accountScreenOne,
      imageAlt: t(
        'Preview of the account blueprint inventory',
        'Aperçu de l’inventaire de blueprints du compte',
        'Vorschau des Blueprint-Inventars im Konto',
      ),
    },
    {
      label: t('Your organizations', 'Vos organisations', 'Deine Organisationen'),
      title: t('Share on your terms', 'Partagez selon vos besoins', 'Teile nach deinen Regeln'),
      body: t(
        'Link your RSI identity through Citizen iD, find your organizations and choose which blueprints and resources to share with each one.',
        'Liez votre identité RSI via Citizen iD, retrouvez vos organisations et choisissez les blueprints et ressources à partager avec chacune.',
        'Verknüpfe deine RSI-Identität über Citizen iD, finde deine Organisationen und wähle für jede aus, welche Blueprints und Ressourcen du teilst.',
      ),
      icon: <HubOutlinedIcon fontSize="small" />,
      image: accountScreenTwo,
      imageAlt: t(
        'Preview of organization blueprint sharing',
        'Aperçu du partage de blueprints en organisation',
        'Vorschau der Blueprint-Freigaben für Organisationen',
      ),
    },
    {
      label: t('Your craft requests', 'Vos demandes de craft', 'Deine Craft-Anfragen'),
      title: t(
        'Turn a request into a finished craft',
        'De la demande au craft terminé',
        'Von der Anfrage zum fertigen Craft',
      ),
      body: t(
        'Track incoming and outgoing requests in one place. Review resources and comments, respond on the site or in Discord, then close completed requests.',
        'Suivez les demandes reçues et envoyées au même endroit. Consultez les ressources et commentaires, répondez sur le site ou dans Discord, puis clôturez les demandes terminées.',
        'Verfolge eingehende und ausgehende Anfragen an einem Ort. Prüfe Ressourcen und Kommentare, antworte auf der Website oder in Discord und schließe erledigte Anfragen.',
      ),
      icon: <SmartToyOutlinedIcon fontSize="small" />,
      image: accountScreenThree,
      imageAlt: t(
        'Preview of craft request coordination in Discord',
        'Aperçu de la coordination des demandes de craft dans Discord',
        'Vorschau der Craft-Koordination in Discord',
      ),
    },
  ];
  const selectedPreview = previews[activePreview];

  return (
    <Stack spacing={2.5}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 360px' },
          gap: 2.5,
          alignItems: 'stretch',
        }}
      >
        <Paper
          sx={{ p: { xs: 2.5, md: 4 }, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
        >
          <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: '0.12em' }}>
            {t('YOUR SC CRAFT WORKSPACE', 'VOTRE ESPACE SC CRAFT', 'DEIN SC CRAFT ARBEITSPLATZ')}
          </Typography>
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: '1.8rem', md: '2.3rem' },
              fontWeight: 750,
              lineHeight: 1.15,
              mt: 1,
              maxWidth: 620,
            }}
          >
            {t(
              'Your crafts. Your crew. All in one place.',
              'Vos crafts. Votre équipage. Tout au même endroit.',
              'Deine Crafts. Deine Crew. Alles an einem Ort.',
            )}
          </Typography>
          <Typography sx={{ color: 'text.secondary', lineHeight: 1.7, mt: 2, maxWidth: 650 }}>
            {t(
              'Connect your account to keep your inventory in sync, choose what you share and organize your next craft together.',
              'Connectez votre compte pour synchroniser votre inventaire, choisir ce que vous partagez et organiser vos prochains crafts ensemble.',
              'Verbinde dein Konto, um dein Inventar zu synchronisieren, Freigaben selbst zu bestimmen und eure nächsten Crafts gemeinsam zu planen.',
            )}
          </Typography>
          <Box component="ul" sx={{ display: 'grid', gap: 1.5, listStyle: 'none', p: 0, mt: 3, mb: 0 }}>
            {[
              [
                <CloudSyncOutlinedIcon fontSize="small" />,
                t(
                  'Find your saved data on every device',
                  'Retrouvez vos données sur chaque appareil',
                  'Deine gespeicherten Daten auf jedem Gerät',
                ),
              ],
              [
                <HubOutlinedIcon fontSize="small" />,
                t(
                  'Choose what each organization can access',
                  'Choisissez les accès de chaque organisation',
                  'Bestimme die Freigaben für jede Organisation',
                ),
              ],
              [
                <SmartToyOutlinedIcon fontSize="small" />,
                t(
                  'Keep craft requests and responses together',
                  'Centralisez les demandes de craft et les réponses',
                  'Craft-Anfragen und Antworten an einem Ort',
                ),
              ],
            ].map(([icon, label], index) => (
              <Box component="li" key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box component="span" sx={{ color: 'primary.main', display: 'flex' }}>
                  {icon}
                </Box>
                <Typography variant="body2">{label}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>

        <Paper sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              backgroundColor: '#212126',
              borderRadius: 1,
              p: 2.5,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Box
              component="img"
              src={isUnstable ? citizenIdLogoDev : citizenIdLogoProd}
              alt="Citizen iD"
              sx={{ display: 'block', width: '100%', maxWidth: 220, height: 48, objectFit: 'contain' }}
            />
          </Box>
          <Box>
            <Typography component="h2" sx={{ fontSize: '1.125rem', fontWeight: 700 }}>
              {t('Connect your account', 'Connectez votre compte', 'Verbinde dein Konto')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75, lineHeight: 1.6 }}>
              {t(
                'Use Citizen iD with a linked Discord account.',
                'Utilisez Citizen iD avec un compte Discord lié.',
                'Nutze Citizen iD mit einem verknüpften Discord-Konto.',
              )}
            </Typography>
          </Box>
          <AppButton
            disabled={!enabled}
            onClick={onLogin}
            fullWidth
            icon={
              <Box
                component="img"
                src={isUnstable ? citizenIdIconDev : citizenIdIconProd}
                alt=""
                aria-hidden="true"
                sx={{ width: 24, height: 24 }}
              />
            }
            sx={{
              minHeight: 48,
              backgroundColor: '#212126',
              color: '#F0F0F0',
              border: '1px solid rgba(240,240,240,0.18)',
              '&:hover': { backgroundColor: '#0E0E0F' },
            }}
          >
            Sign in with Citizen iD
          </AppButton>
          {!enabled && (
            <AppAlert severity="warning">
              {t(
                'Sign-in is temporarily unavailable in this environment.',
                'La connexion est temporairement indisponible dans cet environnement.',
                'Die Anmeldung ist in dieser Umgebung vorübergehend nicht verfügbar.',
              )}
            </AppAlert>
          )}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', color: 'text.secondary' }}>
            <VerifiedUserOutlinedIcon fontSize="small" />
            <Typography variant="body2">
              {t(
                'You choose whether to import your local data after signing in.',
                'Après la connexion, vous choisissez d’importer ou non vos données locales.',
                'Nach der Anmeldung entscheidest du, ob du deine lokalen Daten importierst.',
              )}
            </Typography>
          </Box>
          <details className="workspace-disclosure">
            <summary>
              {t(
                'What happens when I sign in?',
                'Que se passe-t-il à la connexion ?',
                'Was passiert bei der Anmeldung?',
              )}
            </summary>
            <Typography
              component="div"
              className="workspace-disclosure-body"
              variant="body2"
              sx={{ color: 'text.secondary', lineHeight: 1.7 }}
            >
              {t(
                'Citizen iD authenticates your identity. SC CRAFT then loads your cloud account and offers an import if it finds local favorites or blueprints. You manage organization sharing from your account.',
                'Citizen iD authentifie votre identité. SC CRAFT charge ensuite votre compte cloud et propose un import si des favoris ou blueprints locaux sont détectés. Vous gérez le partage avec vos organisations depuis votre compte.',
                'Citizen iD bestätigt deine Identität. SC CRAFT lädt anschließend dein Cloud-Konto und bietet einen Import an, wenn lokale Favoriten oder Blueprints gefunden werden. Organisationsfreigaben verwaltest du in deinem Konto.',
              )}
            </Typography>
          </details>
        </Paper>
      </Box>

      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: { xs: 2, md: 2.5 }, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography component="h2" sx={{ fontSize: '1.125rem', fontWeight: 700, mb: 1.5 }}>
            {t(
              'Explore your connected tools',
              'Découvrez vos outils connectés',
              'Entdecke deine verbundenen Werkzeuge',
            )}
          </Typography>
          <Box
            role="group"
            aria-label={t('Account previews', 'Aperçus du compte', 'Kontovorschau')}
            sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
          >
            {previews.map((preview, index) => (
              <AppButton
                key={preview.label}
                icon={preview.icon}
                variant={index === activePreview ? 'secondary' : 'ghost'}
                ariaPressed={index === activePreview}
                onClick={() => setActivePreview(index)}
                sx={{ minHeight: 44 }}
              >
                {preview.label}
              </AppButton>
            ))}
          </Box>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 0.8fr) minmax(0, 1.2fr)' },
            alignItems: 'center',
          }}
        >
          <Box sx={{ p: { xs: 2.5, md: 4 } }} aria-live="polite" aria-atomic="true">
            <Typography variant="overline" sx={{ color: 'primary.main' }}>
              0{activePreview + 1} / 03
            </Typography>
            <Typography component="h3" sx={{ fontSize: '1.4rem', lineHeight: 1.3, fontWeight: 700, mt: 1 }}>
              {selectedPreview.title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5, lineHeight: 1.8 }}>
              {selectedPreview.body}
            </Typography>
          </Box>
          <Box sx={{ p: { xs: 1.5, md: 2.5 }, backgroundColor: 'background.default' }}>
            <Box
              component="img"
              src={selectedPreview.image}
              alt={selectedPreview.imageAlt}
              loading="lazy"
              sx={{ width: '100%', maxHeight: 340, objectFit: 'contain', display: 'block' }}
            />
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box sx={{ flex: '1 1 280px' }}>
            <Typography component="h2" sx={{ fontWeight: 700, fontSize: '1rem' }}>
              {t(
                'Coordinate in Discord, too',
                'Coordonnez-vous aussi dans Discord',
                'Koordiniert euch auch in Discord',
              )}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', mt: 0.75, maxWidth: 850, lineHeight: 1.7 }}
            >
              {t(
                'The bot sends craft requests privately and keeps their status in sync. To receive its messages, share a server with the bot or install it as an app.',
                'Le bot transmet les demandes de craft en privé et synchronise leur statut. Pour recevoir ses messages, partagez un serveur avec le bot ou installez-le comme application.',
                'Der Bot sendet Craft-Anfragen privat und synchronisiert ihren Status. Teile einen Server mit dem Bot oder installiere ihn als App, um seine Nachrichten zu erhalten.',
              )}
            </Typography>
          </Box>
          <AppButton
            variant="secondary"
            onClick={onInviteBot}
            icon={
              <Box
                component="img"
                src={discordSymbol}
                alt=""
                aria-hidden="true"
                sx={{ width: 20, height: 20 }}
              />
            }
            sx={{ minHeight: 44 }}
          >
            {t('Add the Discord bot', 'Ajouter le bot Discord', 'Discord-Bot hinzufügen')}
          </AppButton>
        </Box>
      </Paper>
    </Stack>
  );
}
