import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import MuiButton from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MobileStepper from '@mui/material/MobileStepper';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import Typography from '@mui/material/Typography';
import CloudSyncOutlinedIcon from '@mui/icons-material/CloudSyncOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import MarkEmailUnreadOutlinedIcon from '@mui/icons-material/MarkEmailUnreadOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import { alpha, useTheme } from '@mui/material/styles';
import accountScreenOne from '../../assets/account_1.png';
import accountScreenTwo from '../../assets/account_2.png';
import discordSymbol from '../../assets/discord-symbol.svg';
import discordWordmark from '../../assets/discord-wordmark.svg';
import { useI18n } from '../../i18n/I18nContext';

interface AccountGuestViewProps {
  enabled: boolean;
  onLogin: () => void;
  onInviteBot: () => void;
}

export function AccountGuestView({
  enabled,
  onLogin,
  onInviteBot,
}: AccountGuestViewProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);

  const discordIcon = (
    <Box
      component="img"
      src={discordSymbol}
      alt=""
      aria-hidden="true"
      sx={{ width: 18, height: 18, display: 'block' }}
    />
  );

  const accountJourneySteps = [
    {
      title: t('Authenticate once with Discord', 'Authentifie-toi une fois avec Discord', 'Melde dich einmal mit Discord an'),
      body: t(
        'Discord is the entry point for the account layer. Right after login, the app can detect local favorites or inventory and propose a safe cloud import.',
        'Discord est la porte d entree du compte. Juste apres la connexion, l appli peut detecter les favoris ou l inventaire locaux et proposer un import cloud securise.',
        'Discord ist der Einstiegspunkt fur die Kontoebene. Direkt nach der Anmeldung kann die App lokale Favoriten oder Inventare erkennen und einen sicheren Cloud-Import anbieten.',
      ),
      icon: <VerifiedUserOutlinedIcon fontSize="small" />,
    },
    {
      title: t('Keep your blueprint library synced', 'Synchronise ta bibliotheque de blueprints', 'Halte deine Blueprint-Bibliothek synchron'),
      body: t(
        'Favorites, inventory and planner progress stop depending on one browser only. Your account becomes the shared source of truth.',
        'Favoris, inventaire et progression planner ne dependent plus d un seul navigateur. Ton compte devient la source de verite partagee.',
        'Favoriten, Inventar und Planner-Fortschritt hangen nicht mehr an nur einem Browser. Dein Konto wird zur gemeinsamen Quelle der Wahrheit.',
      ),
      icon: <CloudSyncOutlinedIcon fontSize="small" />,
    },
    {
      title: t('Unlock org collaboration', 'Debloque la collaboration d organisation', 'Schalte Org-Zusammenarbeit frei'),
      body: t(
        'Link your RSI identity, access your organizations, share selected blueprints and make craft requests actionable instead of purely informational.',
        'Lie ton identite RSI, accede a tes organisations, partage des blueprints choisis et rends les demandes de craft actionnables plutot que seulement informatives.',
        'Verknupfe deine RSI-Identitat, greife auf deine Organisationen zu, teile ausgewahlte Blueprints und mache Craft-Anfragen wirklich nutzbar statt nur informativ.',
      ),
      icon: <HubOutlinedIcon fontSize="small" />,
    },
  ];

  const botWorkflowItems = [
    {
      title: t('The owner gets a Discord DM', 'Le proprietaire recoit un DM Discord', 'Der Besitzer erhalt eine Discord-DM'),
      body: t(
        'When someone requests a shared blueprint, the bot opens the workflow in private with the owner and includes the blueprint, the organization, the comment and the resource arrangement.',
        'Quand quelqu un demande un blueprint partage, le bot ouvre le workflow en prive avec le proprietaire et inclut le blueprint, l organisation, le commentaire et l arrangement sur les ressources.',
        'Wenn jemand einen geteilten Blueprint anfragt, startet der Bot den Workflow privat mit dem Besitzer und zeigt Blueprint, Organisation, Kommentar und Ressourcenabsprache an.',
      ),
      icon: <MarkEmailUnreadOutlinedIcon fontSize="small" />,
    },
    {
      title: t('The bot keeps the request in sync', 'Le bot garde la demande synchronisee', 'Der Bot halt die Anfrage synchron'),
      body: t(
        'Accept and deny can happen from Discord or from the site. The DM reflects the current status, and it disappears once the request is denied or closed.',
        'Accepter et refuser peut se faire depuis Discord ou depuis le site. Le DM reflete le statut courant, puis disparait une fois la demande refusee ou cloturee.',
        'Annehmen und ablehnen geht in Discord oder auf der Seite. Die DM zeigt immer den aktuellen Status und verschwindet, sobald die Anfrage abgelehnt oder geschlossen ist.',
      ),
      icon: <SmartToyOutlinedIcon fontSize="small" />,
    },
    {
      title: t('Get in touch without leaking context', 'Mets les gens en relation sans perdre le contexte', 'Bringt die Leute zusammen, ohne Kontext zu verlieren'),
      body: t(
        'The Get in touch action lets the bot introduce the requester and the crafter directly while leaving the request tracked in the account until it is resolved.',
        'L action Get in touch laisse le bot presenter directement le demandeur et le crafteur tout en laissant la demande suivie dans le compte jusqu a sa resolution.',
        'Die Aktion Get in touch lasst den Bot Anfragenden und Crafter direkt zusammenbringen, wahrend die Anfrage im Konto bis zur Auflosung weiterverfolgt wird.',
      ),
      icon: <ForumOutlinedIcon fontSize="small" />,
    },
  ];

  const unlockHighlights = [
    {
      icon: <Inventory2OutlinedIcon fontSize="small" />,
      title: t('Cloud inventory', 'Inventaire cloud', 'Cloud-Inventar'),
      body: t(
        'Your inventory and favorites stay attached to the account instead of the current browser only.',
        'Ton inventaire et tes favoris restent rattaches au compte plutot qu au navigateur courant uniquement.',
        'Dein Inventar und deine Favoriten bleiben am Konto statt nur am aktuellen Browser.',
      ),
    },
    {
      icon: <HubOutlinedIcon fontSize="small" />,
      title: t('Organization access', 'Acces organisations', 'Organisationszugang'),
      body: t(
        'Use your linked RSI profile to join org spaces, share blueprints selectively and manage claims.',
        'Utilise ton profil RSI lie pour rejoindre les espaces d organisation, partager tes blueprints selectivement et gerer les claims.',
        'Nutze dein verknupftes RSI-Profil, um Org-Bereiche zu betreten, Blueprints gezielt zu teilen und Claims zu verwalten.',
      ),
    },
    {
      icon: <SmartToyOutlinedIcon fontSize="small" />,
      title: t('Craft requests', 'Demandes de craft', 'Craft-Anfragen'),
      body: t(
        'Craft requests stay visible in the app while the Discord bot handles the private back-and-forth.',
        'Les demandes de craft restent visibles dans l appli pendant que le bot Discord gere les echanges prives.',
        'Craft-Anfragen bleiben in der App sichtbar, wahrend der Discord-Bot den privaten Austausch ubernimmt.',
      ),
    },
  ];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.35fr) minmax(340px, 0.9fr)' },
        gap: { xs: 2, md: 3 },
        alignItems: 'start',
      }}
    >
      <Stack spacing={2.5}>
        <Card
          variant="outlined"
          sx={{
            overflow: 'hidden',
            borderColor: alpha(theme.palette.primary.main, 0.24),
            background: `linear-gradient(150deg, ${alpha(theme.palette.secondary.main, 0.14)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 46%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
          }}
        >
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={2.5}>
              <Stack
                direction={{ xs: 'column', lg: 'row' }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', lg: 'flex-start' }}
              >
                <Box sx={{ minWidth: 0, maxWidth: 840 }}>
                  <Typography
                    variant="overline"
                    sx={{ color: 'secondary.main', letterSpacing: '0.16em' }}
                  >
                    {t('Connected workspace', 'Workspace connecte', 'Verbundener Workspace')}
                  </Typography>
                  <Typography variant="h3" sx={{ mt: 0.6, lineHeight: 0.94 }}>
                    {t(
                      'Turn your account page into the command center for blueprints, organizations and craft coordination.',
                      'Transforme ta page compte en centre de pilotage pour les blueprints, les organisations et la coordination des crafts.',
                      'Mach deine Kontoseite zum Leitstand fur Blueprints, Organisationen und Craft-Koordination.',
                    )}
                  </Typography>
                  <Typography sx={{ mt: 1.5, maxWidth: 780, color: 'text.secondary' }}>
                    {t(
                      'The account layer keeps your blueprint state persistent, brings RSI organizations into the app and lets the Discord bot carry craft requests into direct conversations.',
                      'La couche compte garde l etat de tes blueprints persistant, fait entrer les organisations RSI dans l appli et laisse le bot Discord transporter les demandes de craft jusqu a la conversation directe.',
                      'Die Kontoebene macht deinen Blueprint-Status dauerhaft, bringt RSI-Organisationen in die App und lasst den Discord-Bot Craft-Anfragen in direkte Gesprache uberfuhren.',
                    )}
                  </Typography>
                </Box>

                <Box
                  component="img"
                  src={discordWordmark}
                  alt="Discord"
                  sx={{
                    width: { xs: 132, md: 188 },
                    opacity: 0.95,
                    filter: `drop-shadow(0 12px 26px ${alpha(theme.palette.primary.main, 0.22)})`,
                  }}
                />
              </Stack>

              {!enabled && (
                <Alert severity="warning" variant="outlined">
                  {t(
                    'Discord OAuth is not configured in the current environment yet, so the login call-to-action is temporarily disabled.',
                    'Le OAuth Discord n est pas encore configure dans cet environnement, donc le bouton de connexion est temporairement desactive.',
                    'Discord OAuth ist in dieser Umgebung noch nicht konfiguriert, daher ist die Login-Aktion vorubergehend deaktiviert.',
                  )}
                </Alert>
              )}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} useFlexGap flexWrap="wrap">
                <MuiButton
                  variant="contained"
                  disableElevation
                  disabled={!enabled}
                  startIcon={discordIcon}
                  onClick={onLogin}
                  sx={{
                    minHeight: 48,
                    px: 2.2,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 700,
                    backgroundColor: '#5865F2',
                    '&:hover': {
                      backgroundColor: '#4752C4',
                    },
                  }}
                >
                  {t('Continue with Discord', 'Continuer avec Discord', 'Mit Discord fortfahren')}
                </MuiButton>
                <MuiButton
                  variant="outlined"
                  startIcon={discordIcon}
                  onClick={onInviteBot}
                  sx={{
                    minHeight: 48,
                    px: 2.2,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 700,
                    color: 'text.primary',
                    borderColor: alpha(theme.palette.primary.main, 0.28),
                    backgroundColor: alpha(theme.palette.background.default, 0.32),
                    '&:hover': {
                      borderColor: '#5865F2',
                      backgroundColor: alpha(theme.palette.primary.main, 0.08),
                    },
                  }}
                >
                  {t('Add the Discord bot', 'Ajouter le bot Discord', 'Discord-Bot hinzufugen')}
                </MuiButton>
              </Stack>

              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t(
                  'If blueprint data already exists locally, the app can detect it after login and propose a cloud import instead of leaving it stranded in one browser.',
                  'Si des blueprints existent deja en local, l appli peut les detecter apres connexion et proposer un import cloud au lieu de les laisser bloques dans un seul navigateur.',
                  'Wenn lokal bereits Blueprint-Daten existieren, kann die App sie nach der Anmeldung erkennen und einen Cloud-Import anbieten, statt sie in einem Browser gefangen zu lassen.',
                )}
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack spacing={1.5}>
            <Box>
              <Typography
                variant="overline"
                sx={{ color: 'secondary.main', letterSpacing: '0.14em' }}
              >
                {t('Account workflow', 'Workflow du compte', 'Konto-Workflow')}
              </Typography>
              <Typography variant="h5" sx={{ mt: 0.35 }}>
                {t(
                  'What happens after sign-in',
                  'Ce qui se passe apres la connexion',
                  'Was nach der Anmeldung passiert',
                )}
              </Typography>
            </Box>

            <Stepper orientation="vertical" sx={{ '& .MuiStepConnector-line': { borderColor: alpha(theme.palette.primary.main, 0.22) } }}>
              {accountJourneySteps.map((step) => (
                <Step key={step.title} expanded>
                  <StepLabel StepIconComponent={() => (
                    <Box
                      sx={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'primary.main',
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.24)}`,
                        backgroundColor: alpha(theme.palette.primary.main, 0.08),
                      }}
                    >
                      {step.icon}
                    </Box>
                  )}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {step.title}
                    </Typography>
                  </StepLabel>
                  <Box sx={{ ml: 5.5, mt: -0.35, pb: 1.75 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 760 }}>
                      {step.body}
                    </Typography>
                  </Box>
                </Step>
              ))}
            </Stepper>
          </Stack>
        </Paper>

        <Card
          variant="outlined"
          sx={{
            overflow: 'hidden',
            borderColor: alpha(theme.palette.primary.main, 0.18),
          }}
        >
          {activeStep === 0 && (
            <>
              <Box
                sx={{
                  p: { xs: 1, md: 1.25 },
                  background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.background.default, 0.24)} 100%)`,
                  borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                }}
              >
                <Box
                  sx={{
                    width: '100%',
                    aspectRatio: '16 / 9',
                    borderRadius: 1.75,
                    overflow: 'hidden',
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                    backgroundColor: alpha(theme.palette.common.black, 0.16),
                    boxShadow: `0 18px 32px ${alpha(theme.palette.common.black, 0.16)}`,
                  }}
                >
                  <Box
                    component="img"
                    src={accountScreenOne}
                    alt={t(
                      'Account library screenshot',
                      'Capture de la bibliotheque du compte',
                      'Screenshot der Konto-Bibliothek',
                    )}
                    sx={{
                      display: 'block',
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      objectPosition: 'top center',
                      backgroundColor: alpha(theme.palette.background.paper, 0.9),
                    }}
                  />
                </Box>
              </Box>
              <CardContent>
                <Typography variant="h6" sx={{ lineHeight: 1.08 }}>
                  {t('Your blueprint state follows you', 'Tes blueprints te suivent', 'Dein Blueprint-Status folgt dir')}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.75, color: 'text.secondary' }}>
                  {t(
                    'Inventory and favorites stop being local-only shortcuts and become part of your account layer.',
                    'Inventaire et favoris cessent d etre de simples raccourcis locaux pour devenir une vraie couche compte.',
                    'Inventar und Favoriten horen auf, nur lokale Shortcuts zu sein, und werden Teil deiner Kontoebene.',
                  )}
                </Typography>
              </CardContent>
            </>
          )}

          {activeStep === 1 && (
            <>
              <Box
                sx={{
                  p: { xs: 1, md: 1.25 },
                  background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.background.default, 0.24)} 100%)`,
                  borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                }}
              >
                <Box
                  sx={{
                    width: '100%',
                    aspectRatio: '16 / 9',
                    borderRadius: 1.75,
                    overflow: 'hidden',
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                    backgroundColor: alpha(theme.palette.common.black, 0.16),
                    boxShadow: `0 18px 32px ${alpha(theme.palette.common.black, 0.16)}`,
                  }}
                >
                  <Box
                    component="img"
                    src={accountScreenTwo}
                    alt={t(
                      'Organization sharing screenshot',
                      'Capture du partage d organisation',
                      'Screenshot der Organisationsfreigabe',
                    )}
                    sx={{
                      display: 'block',
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      objectPosition: 'center',
                      backgroundColor: alpha(theme.palette.background.paper, 0.9),
                    }}
                  />
                </Box>
              </Box>
              <CardContent>
                <Typography variant="h6" sx={{ lineHeight: 1.08 }}>
                  {t('Choose exactly who gets access', 'Choisis exactement qui a acces', 'Wahle genau aus, wer Zugriff erhalt')}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.75, color: 'text.secondary' }}>
                  {t(
                    'Blueprint sharing is scoped organization by organization, so you control what stays private and what becomes collaborative.',
                    'Le partage se fait organisation par organisation, donc tu controles ce qui reste prive et ce qui devient collaboratif.',
                    'Blueprint-Freigaben sind organisationsweise aufgebaut, sodass du kontrollierst, was privat bleibt und was gemeinsam genutzt wird.',
                  )}
                </Typography>
              </CardContent>
            </>
          )}

          {activeStep === 2 && (
            <CardContent>
              <Stack spacing={1.25}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      backgroundColor: '#5865F2',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Box
                      component="img"
                      src={discordSymbol}
                      alt=""
                      aria-hidden="true"
                      sx={{ width: 18, height: 18, filter: 'brightness(0) invert(1)' }}
                    />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      ItemFab Bot
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {t('Private DM preview', 'Apercu DM prive', 'Private DM-Vorschau')}
                    </Typography>
                  </Box>
                </Stack>

                <Box
                  sx={{
                    p: { xs: 1, md: 1.25 },
                    borderRadius: 2,
                    border: `1px dashed ${alpha(theme.palette.primary.main, 0.26)}`,
                    backgroundColor: alpha(theme.palette.background.default, 0.32),
                  }}
                >
                  <Box
                    sx={{
                      width: '100%',
                      aspectRatio: '16 / 9',
                      borderRadius: 1.75,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.background.paper, 0.94)} 100%)`,
                      display: 'grid',
                      placeItems: 'center',
                      textAlign: 'center',
                      p: 2,
                    }}
                  >
                    <Stack spacing={1} alignItems="center" sx={{ maxWidth: 520 }}>
                      <Typography variant="h6" sx={{ lineHeight: 1.08 }}>
                        {t(
                          'The real bot DM screenshot will go here',
                          'Le vrai screenshot du DM du bot viendra ici',
                          'Der echte Bot-DM-Screenshot kommt hierhin',
                        )}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {t(
                          'Once you drop the capture into the assets folder, this block is the right size to showcase the message flow without cropping it.',
                          'Une fois la capture ajoutee dans les assets, ce bloc a la bonne taille pour montrer le message sans le rogner.',
                          'Sobald du den Screenshot in den Assets ablegst, hat dieser Block die richtige Grösse, um den Nachrichtenfluss ohne Beschnitt zu zeigen.',
                        )}
                      </Typography>
                    </Stack>
                  </Box>
                </Box>

                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {t(
                    'This section is reserved for the Discord-side view of the same workflow described above.',
                    'Cette section est reservee a la vue Discord du meme workflow decrit plus haut.',
                    'Dieser Bereich ist fur die Discord-Ansicht desselben oben beschriebenen Workflows reserviert.',
                  )}
                </Typography>
              </Stack>
            </CardContent>
          )}

          <MobileStepper
            variant="dots"
            steps={3}
            position="static"
            activeStep={activeStep}
            nextButton={
              <MuiButton
                size="small"
                onClick={() => setActiveStep((s) => s + 1)}
                disabled={activeStep === 2}
              >
                {t('Next', 'Suivant', 'Weiter')}
                <KeyboardArrowRight />
              </MuiButton>
            }
            backButton={
              <MuiButton
                size="small"
                onClick={() => setActiveStep((s) => s - 1)}
                disabled={activeStep === 0}
              >
                <KeyboardArrowLeft />
                {t('Back', 'Précédent', 'Zurück')}
              </MuiButton>
            }
          />
        </Card>
      </Stack>

      <Stack spacing={2.5}>
        <Card
          variant="outlined"
          sx={{
            borderColor: alpha(theme.palette.primary.main, 0.2),
            background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.background.paper, 1)} 100%)`,
          }}
        >
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={1.75}>
              <Stack direction="row" spacing={1.1} alignItems="center">
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: 1.6,
                    display: 'grid',
                    placeItems: 'center',
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
                  }}
                >
                  <SmartToyOutlinedIcon />
                </Box>
                <Box>
                  <Typography
                    variant="overline"
                    sx={{ color: 'secondary.main', letterSpacing: '0.14em' }}
                  >
                    {t('Discord bot', 'Bot Discord', 'Discord-Bot')}
                  </Typography>
                  <Typography variant="h5">
                    {t('How the bot actually works', 'Comment le bot fonctionne vraiment', 'So funktioniert der Bot wirklich')}
                  </Typography>
                </Box>
              </Stack>

              <Typography sx={{ color: 'text.secondary' }}>
                {t(
                  'The bot is not decorative. It extends the craft workflow outside the site while keeping the request state consistent inside the account.',
                  'Le bot n est pas decoratif. Il prolonge le workflow de craft hors du site tout en gardant l etat de la demande coherent dans le compte.',
                  'Der Bot ist nicht dekorativ. Er erweitert den Craft-Workflow uber die Seite hinaus und halt den Anfragezustand im Konto konsistent.',
                )}
              </Typography>

              <Divider />

              <List disablePadding sx={{ display: 'grid', gap: 1.25 }}>
                {botWorkflowItems.map((item) => (
                  <ListItem
                    key={item.title}
                    disableGutters
                    sx={{
                      alignItems: 'flex-start',
                      gap: 1.2,
                      p: 1.25,
                      borderRadius: 2,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                      backgroundColor: alpha(theme.palette.background.default, 0.22),
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 34, color: 'primary.main', mt: 0.2 }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.title}
                      primaryTypographyProps={{ fontWeight: 700, lineHeight: 1.15 }}
                      secondary={item.body}
                      secondaryTypographyProps={{ color: 'text.secondary', sx: { mt: 0.45 } }}
                    />
                  </ListItem>
                ))}
              </List>

              <Alert severity="info" variant="outlined">
                {t(
                  'The bot can DM people who either share a Discord server with it or install it as an app. That is why the owner invite link still matters for organization workflows.',
                  'Le bot peut envoyer des DM aux personnes qui partagent un serveur Discord avec lui ou qui l installent comme application. C est pour cela que le lien d ajout du bot reste important pour les workflows d organisation.',
                  'Der Bot kann Personen direkt anschreiben, die entweder einen Discord-Server mit ihm teilen oder ihn als App installieren. Deshalb bleibt der Einladungslink fur Organisations-Workflows wichtig.',
                )}
              </Alert>

              <MuiButton
                variant="outlined"
                startIcon={discordIcon}
                onClick={onInviteBot}
                sx={{
                  alignSelf: 'flex-start',
                  minHeight: 46,
                  px: 2.2,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  borderColor: alpha(theme.palette.primary.main, 0.28),
                }}
              >
                {t('Add the bot to a Discord server', 'Ajouter le bot sur un serveur Discord', 'Bot zu einem Discord-Server hinzufugen')}
              </MuiButton>
            </Stack>
          </CardContent>
        </Card>

        <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack spacing={1.5}>
            <Typography
              variant="overline"
              sx={{ color: 'secondary.main', letterSpacing: '0.14em' }}
            >
              {t('What the account unlocks', 'Ce que le compte debloque', 'Was das Konto freischaltet')}
            </Typography>
            <Stack spacing={1.1}>
              {unlockHighlights.map((item) => (
                <Paper
                  key={item.title}
                  variant="outlined"
                  sx={{
                    p: 1.25,
                    display: 'flex',
                    gap: 1.1,
                    alignItems: 'flex-start',
                    backgroundColor: alpha(theme.palette.background.default, 0.22),
                  }}
                >
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: 1.2,
                      flexShrink: 0,
                      display: 'grid',
                      placeItems: 'center',
                      color: 'primary.main',
                      backgroundColor: alpha(theme.palette.primary.main, 0.08),
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.35, color: 'text.secondary' }}>
                      {item.body}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
