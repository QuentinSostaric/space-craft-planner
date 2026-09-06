import { Box, Paper, Stack, Typography } from '../../ui/system';
import { AppAlert } from '../ui/feedback';
import {
  CloudSyncOutlinedIcon,
  ForumOutlinedIcon,
  HubOutlinedIcon,
  Inventory2OutlinedIcon,
  MarkEmailUnreadOutlinedIcon,
  SmartToyOutlinedIcon,
  VerifiedUserOutlinedIcon,
} from '../../ui/icons';
import { useState } from 'react';
import accountScreenOne from '../../assets/account_1.png';
import accountScreenTwo from '../../assets/account_2.png';
import accountScreenThree from '../../assets/account_3.png';
import discordSymbol from '../../assets/discord-symbol.svg';
import citizenIdLogoProd from '../../assets/citizenid/prod-logo-light.png';
import citizenIdIconProd from '../../assets/citizenid/prod-icon-light.png';
import citizenIdLogoDev from '../../assets/citizenid/dev-logo-light.png';
import citizenIdIconDev from '../../assets/citizenid/dev-icon-light.png';
import { useI18n } from '../../i18n/I18nContext';
import { AppButton } from '../ui/controls/AppButton';

interface AccountGuestViewProps {
  enabled: boolean;
  brandEnvironment: 'production' | 'unstable';
  onLogin: () => void;
  onInviteBot: () => void;
}

export function AccountGuestView({
  enabled,
  brandEnvironment,
  onLogin,
  onInviteBot,
}: AccountGuestViewProps) {
  const { t } = useI18n();
  const [activeStep, setActiveStep] = useState(0);

  // Official Citizen iD brand assets. Light variants are mandated for the dark
  // gray (#212126) sign-in surface. Production uses the orange-star assets; dev/
  // staging environments must use the red-star "unstable" assets per the brand
  // guidelines. Assets must never be recolored, distorted, or shadowed.
  const isUnstable = brandEnvironment === 'unstable';
  const citizenIdLogo = isUnstable ? citizenIdLogoDev : citizenIdLogoProd;
  const citizenIdIcon = isUnstable ? citizenIdIconDev : citizenIdIconProd;

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
      title: t(
        'Authenticate once with Citizen iD',
        'Authentifie-toi une fois avec Citizen iD',
        'Melde dich einmal mit Citizen iD an',
      ),
      body: t(
        'Citizen iD is the entry point for the account layer. Your Citizen iD profile must have a linked Discord account. Right after login, the app can detect local favorites or inventory and propose a safe cloud import.',
        'Citizen iD est la porte d entree du compte. Ton profil Citizen iD doit avoir un compte Discord lie. Juste apres la connexion, l appli peut detecter les favoris ou l inventaire locaux et proposer un import cloud securise.',
        'Citizen iD ist der Einstiegspunkt fur die Kontoebene. Dein Citizen iD-Profil muss ein verknupftes Discord-Konto haben. Direkt nach der Anmeldung kann die App lokale Favoriten oder Inventare erkennen und einen sicheren Cloud-Import anbieten.',
      ),
      icon: <VerifiedUserOutlinedIcon fontSize="small" />,
    },
    {
      title: t(
        'Keep your blueprint library synced',
        'Synchronise ta bibliotheque de blueprints',
        'Halte deine Blueprint-Bibliothek synchron',
      ),
      body: t(
        'Favorites, inventory and planner progress stop depending on one browser only. Your account becomes the shared source of truth.',
        'Favoris, inventaire et progression planner ne dependent plus d un seul navigateur. Ton compte devient la source de verite partagee.',
        'Favoriten, Inventar und Planner-Fortschritt hangen nicht mehr an nur einem Browser. Dein Konto wird zur gemeinsamen Quelle der Wahrheit.',
      ),
      icon: <CloudSyncOutlinedIcon fontSize="small" />,
    },
    {
      title: t(
        'Unlock org collaboration',
        'Debloque la collaboration d organisation',
        'Schalte Org-Zusammenarbeit frei',
      ),
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
      title: t(
        'The owner gets a Discord DM',
        'Le proprietaire recoit un DM Discord',
        'Der Besitzer erhalt eine Discord-DM',
      ),
      body: t(
        'When someone requests a shared blueprint, the bot opens the workflow in private with the owner and includes the blueprint, the organization, the comment and the resource arrangement.',
        'Quand quelqu un demande un blueprint partage, le bot ouvre le workflow en prive avec le proprietaire et inclut le blueprint, l organisation, le commentaire et l arrangement sur les ressources.',
        'Wenn jemand einen geteilten Blueprint anfragt, startet der Bot den Workflow privat mit dem Besitzer und zeigt Blueprint, Organisation, Kommentar und Ressourcenabsprache an.',
      ),
      icon: <MarkEmailUnreadOutlinedIcon fontSize="small" />,
    },
    {
      title: t(
        'The bot keeps the request in sync',
        'Le bot garde la demande synchronisee',
        'Der Bot halt die Anfrage synchron',
      ),
      body: t(
        'Accept and deny can happen from Discord or from the site. The DM reflects the current status, and it disappears once the request is denied or closed.',
        'Accepter et refuser peut se faire depuis Discord ou depuis le site. Le DM reflete le statut courant, puis disparait une fois la demande refusee ou cloturee.',
        'Annehmen und ablehnen geht in Discord oder auf der Seite. Die DM zeigt immer den aktuellen Status und verschwindet, sobald die Anfrage abgelehnt oder geschlossen ist.',
      ),
      icon: <SmartToyOutlinedIcon fontSize="small" />,
    },
    {
      title: t(
        'Get in touch without leaking context',
        'Mets les gens en relation sans perdre le contexte',
        'Bringt die Leute zusammen, ohne Kontext zu verlieren',
      ),
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

  const previewDescriptions = [accountJourneySteps[1], accountJourneySteps[2], botWorkflowItems[0]];
  const previews = [accountScreenOne, accountScreenTwo, accountScreenThree];
  const previewLabels = [
    t('Inventory', 'Inventaire', 'Inventar'),
    t('Sharing', 'Partage', 'Freigaben'),
    t('Discord', 'Discord', 'Discord'),
  ];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '320px minmax(0, 1fr)' },
        gap: 'var(--workspace-gap)',
        alignItems: 'start',
      }}
    >
      <Paper sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ p: 2, backgroundColor: '#212126', borderRadius: '4px' }}>
          <Box
            component="img"
            src={citizenIdLogo}
            alt="Citizen iD"
            sx={{ width: '100%', maxWidth: 210, height: 42, objectFit: 'contain' }}
          />
        </Box>
        <Typography component="h2" sx={{ fontSize: '1.125rem', fontWeight: 700 }}>
          {t('Connect your workspace', 'Connectez votre espace', 'Arbeitsplatz verbinden')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t(
            'Keep your inventory, favorites and plans with you across devices.',
            'Retrouvez votre inventaire, vos favoris et vos plans sur tous vos appareils.',
            'Inventar, Favoriten und Pläne auf allen Geräten nutzen.',
          )}
        </Typography>
        <AppButton
          disabled={!enabled}
          onClick={onLogin}
          icon={<Box component="img" src={citizenIdIcon} alt="" sx={{ width: 24, height: 24 }} />}
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
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {t('Requires a Discord account linked to Citizen iD.', 'Un compte Discord lié à Citizen iD est requis.', 'Ein mit Citizen iD verbundenes Discord-Konto ist erforderlich.')}
        </Typography>
        <details className="workspace-disclosure">
          <summary>{t('Sign-in & saved data', 'Connexion et données sauvegardées', 'Anmeldung und gespeicherte Daten')}</summary>
          <div className="workspace-disclosure-body"><Typography variant="body2" sx={{ color: 'text.secondary' }}>{accountJourneySteps[0].body}</Typography></div>
        </details>
        <Box sx={{ display: 'grid', gap: 0.5 }}>
          {unlockHighlights.map((item, index) => <AppButton
            key={item.title} variant={activeStep === index ? 'secondary' : 'ghost'} icon={item.icon}
            ariaPressed={activeStep === index} onClick={() => setActiveStep(index)} sx={{ justifyContent: 'flex-start', minHeight: 40 }}
          >{item.title}</AppButton>)}
        </Box>
      </Paper>
      <Stack spacing={2}>
        <Paper sx={{ overflow: 'hidden' }}>
          <Box
            sx={{
              p: 1.5,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: 1,
              alignItems: 'center',
              borderBottom: '1px solid',
              borderColor: 'divider',
              backgroundColor: 'ui.bgElev',
            }}
          >
            <Typography component="h2" sx={{ fontWeight: 700, fontSize: '0.875rem' }}>
              {t('Connected tools', 'Outils connectés', 'Verbundene Werkzeuge')}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{previewLabels[activeStep]}</Typography>
          </Box>
          <Box
            component="img"
            src={previews[activeStep]}
            alt={previewLabels[activeStep]}
            sx={{
              display: 'block',
              width: '100%',
              maxHeight: 300,
              objectFit: 'contain',
              p: 1.5,
              backgroundColor: 'background.default',
            }}
          />
          <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography component="h3" sx={{ fontWeight: 700, fontSize: '0.875rem' }}>
              {previewDescriptions[activeStep].title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>{unlockHighlights[activeStep].body}</Typography>
            <details className="workspace-disclosure" style={{ marginTop: 12 }}>
              <summary>{t('How it works', 'Comment ça fonctionne', 'So funktioniert es')}</summary>
              <div className="workspace-disclosure-body"><Typography variant="body2" sx={{ color: 'text.secondary' }}>{previewDescriptions[activeStep].body}</Typography></div>
            </details>
          </Box>
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              mb: 2,
            }}
          >
            <Typography component="h2" sx={{ fontWeight: 700, fontSize: '0.875rem' }}>
              {t(
                'Craft coordination · Discord',
                'Coordination des crafts · Discord',
                'Craft-Koordination · Discord',
              )}
            </Typography>
            <AppButton variant="secondary" size="sm" icon={discordIcon} onClick={onInviteBot}>
              {t('Add the bot', 'Ajouter le bot', 'Bot hinzufügen')}
            </AppButton>
          </Box>
          <details className="workspace-disclosure">
            <summary>{t('Request → response → coordination', 'Demande → réponse → coordination', 'Anfrage → Antwort → Koordination')}</summary>
          <Box component="ol" className="workspace-disclosure-body" sx={{ display: 'grid', gap: 1.5, listStyle: 'none', m: 0 }}>
            {botWorkflowItems.map((item, index) => (
              <Box
                component="li"
                key={item.title}
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  pt: 1.5,
                }}
              >
                <Box sx={{ color: 'primary.main', fontSize: '0.75rem' }}>0{index + 1}</Box>
                <Box>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    {item.body}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
          </details>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1.5 }}>
            {t(
              'To receive DMs, share a server with the bot or install it as an app.',
              'Pour recevoir les DM, partagez un serveur avec le bot ou installez-le comme application.',
              'Für DMs einen Server mit dem Bot teilen oder ihn als App installieren.',
            )}
          </Typography>
        </Paper>
      </Stack>
    </Box>
  );
}
