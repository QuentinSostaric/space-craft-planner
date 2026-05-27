import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Divider from '@mui/material/Divider';
import { useI18n } from '../i18n/I18nContext';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="section" sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, lineHeight: 1.7 }}>
      {children}
    </Typography>
  );
}

function Ul({ children }: { children: React.ReactNode }) {
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1 }}>
      {children}
    </Box>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <Typography component="li" variant="body2" sx={{ color: 'text.secondary', mb: 0.5, lineHeight: 1.7 }}>
      {children}
    </Typography>
  );
}

export function PrivacyPolicyPage() {
  const { t } = useI18n();

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, sm: 4 } }}>
      <Box sx={{ maxWidth: 760, mx: 'auto' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          {t('Privacy Policy', 'Politique de confidentialité', 'Datenschutzerklärung')}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 3 }}>
          {t('Last updated: May 2026', 'Dernière mise à jour : mai 2026', 'Letzte Aktualisierung: Mai 2026')}
        </Typography>

        <Divider sx={{ mb: 3 }} />

        <Section title={t('1. Who we are', '1. Qui sommes-nous', '1. Wer wir sind')}>
          <P>
            {t(
              'Item Fabricator is an unofficial fan tool for Star Citizen players, created by ',
              'Item Fabricator est un outil de fan non officiel pour les joueurs de Star Citizen, créé par ',
              'Item Fabricator ist ein inoffizielles Fan-Tool für Star-Citizen-Spieler, erstellt von ',
            )}
            <Link href="https://x.com/ThSamon" target="_blank" rel="noopener noreferrer">@ThSamon</Link>
            {t(
              '. This site is not affiliated with Cloud Imperium Games.',
              '. Ce site n\'est pas affilié à Cloud Imperium Games.',
              '. Diese Website ist nicht mit Cloud Imperium Games verbunden.',
            )}
          </P>
        </Section>

        <Section title={t('2. Data we collect', '2. Données collectées', '2. Erhobene Daten')}>
          <P>
            {t(
              'When you create an account via Discord OAuth, we collect and store:',
              'Lorsque vous créez un compte via Discord OAuth, nous collectons et stockons :',
              'Wenn Sie ein Konto über Discord OAuth erstellen, erheben und speichern wir:',
            )}
          </P>
          <Ul>
            <Li>
              <strong>{t('Discord profile', 'Profil Discord', 'Discord-Profil')}</strong>
              {t(
                ': your username, display name, and avatar URL, used solely to identify your account.',
                ' : votre nom d\'utilisateur, votre nom d\'affichage et l\'URL de votre avatar, utilisés uniquement pour identifier votre compte.',
                ': Benutzername, Anzeigename und Avatar-URL, ausschließlich zur Kontoidentifikation.',
              )}
            </Li>
            <Li>
              <strong>{t('Game data you save', 'Données de jeu sauvegardées', 'Gespeicherte Spieldaten')}</strong>
              {t(
                ': your favorite blueprints, planner goals and tasks, resource inventory, and organization memberships.',
                ' : vos plans favoris, vos objectifs et tâches de planification, votre inventaire de ressources et vos adhésions à des organisations.',
                ': Lieblings-Baupläne, Planungsziele und -aufgaben, Ressourceninventar und Organisationsmitgliedschaften.',
              )}
            </Li>
            <Li>
              <strong>{t('RSI profile link', 'Lien de profil RSI', 'RSI-Profilverknüpfung')}</strong>
              {t(
                ': if you choose to link your RSI account (via RSI profile verification or Citizen iD), we store your RSI handle and affiliated organizations.',
                ' : si vous liez votre compte RSI (via la vérification de profil RSI ou Citizen iD), nous stockons votre pseudo RSI et vos organisations affiliées.',
                ': Wenn Sie Ihr RSI-Konto verknüpfen (über RSI-Profilverifizierung oder Citizen iD), speichern wir Ihren RSI-Handle und zugehörige Organisationen.',
              )}
            </Li>
            <Li>
              <strong>{t('Session credentials', 'Identifiants de session', 'Sitzungsdaten')}</strong>
              {t(
                ': a signed session token stored in a browser cookie (web, expires after 30 days) or in your operating system\'s secure credential store and a local file (desktop app, expires after 7 days).',
                ' : un jeton de session signé stocké dans un cookie de navigateur (web, expire après 30 jours) ou dans le magasin d\'identifiants sécurisé de votre système d\'exploitation et un fichier local (application desktop, expire après 7 jours).',
                ': Ein signiertes Sitzungs-Token, gespeichert in einem Browser-Cookie (Web, läuft nach 30 Tagen ab) oder im sicheren Anmeldedatenspeicher des Betriebssystems und einer lokalen Datei (Desktop-App, läuft nach 7 Tagen ab).',
              )}
            </Li>
          </Ul>
          <P>
            {t(
              'Your browser\'s local storage also holds your language preference, color theme, navigation state, and cookie/data consent acknowledgement. This data never leaves your device.',
              'Le stockage local de votre navigateur contient également votre préférence de langue, votre thème de couleur, l\'état de la navigation et votre consentement. Ces données ne quittent jamais votre appareil.',
              'Im lokalen Browserspeicher werden außerdem Spracheinstellung, Farbthema, Navigationsstatus und Einwilligung gespeichert. Diese Daten verlassen Ihr Gerät nie.',
            )}
          </P>
        </Section>

        <Section title={t('3. How we use your data', '3. Utilisation des données', '3. Verwendung der Daten')}>
          <P>
            {t(
              'We use your data exclusively to provide the service: synchronising your saved preferences across your devices and sessions. We do not sell, share, or use your data for advertising or analytics purposes.',
              'Nous utilisons vos données exclusivement pour fournir le service : synchroniser vos préférences sauvegardées entre vos appareils et vos sessions. Nous ne vendons, ne partageons ni n\'utilisons vos données à des fins publicitaires ou analytiques.',
              'Wir verwenden Ihre Daten ausschließlich zur Bereitstellung des Dienstes: zur Synchronisierung Ihrer gespeicherten Einstellungen auf Ihren Geräten und Sitzungen. Wir verkaufen, teilen oder verwenden Ihre Daten nicht für Werbung oder Analysen.',
            )}
          </P>
        </Section>

        <Section title={t('4. Third-party services', '4. Services tiers', '4. Drittanbieter')}>
          <Ul>
            <Li>
              <strong>Discord</strong>
              {t(
                ': We use Discord OAuth to authenticate you. Discord collects data as described in its ',
                ' : nous utilisons Discord OAuth pour vous authentifier. Discord collecte des données conformément à sa ',
                ': Wir verwenden Discord OAuth zur Authentifizierung. Discord erhebt Daten gemäß seiner ',
              )}
              <Link href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer">
                {t('Privacy Policy', 'politique de confidentialité', 'Datenschutzrichtlinie')}
              </Link>
              {'.'}
            </Li>
            <Li>
              <strong>Cloudflare</strong>
              {t(
                ': Our backend runs on Cloudflare Workers and stores account data in Cloudflare R2. See Cloudflare\'s ',
                ' : notre backend fonctionne sur Cloudflare Workers et stocke les données de compte dans Cloudflare R2. Voir la ',
                ': Unser Backend läuft auf Cloudflare Workers und speichert Kontodaten in Cloudflare R2. Siehe die ',
              )}
              <Link href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">
                {t('Privacy Policy', 'politique de confidentialité de Cloudflare', 'Datenschutzrichtlinie von Cloudflare')}
              </Link>
              {'.'}
            </Li>
          </Ul>
        </Section>

        <Section title={t('5. Your rights', '5. Vos droits', '5. Ihre Rechte')}>
          <P>
            {t(
              'You can delete your account and all associated data at any time from the Account page. Deletion is immediate and permanent.',
              'Vous pouvez supprimer votre compte et toutes les données associées à tout moment depuis la page Compte. La suppression est immédiate et définitive.',
              'Sie können Ihr Konto und alle zugehörigen Daten jederzeit über die Kontoseite löschen. Die Löschung erfolgt sofort und dauerhaft.',
            )}
          </P>
          <P>
            {t(
              'You may also contact us (see below) to request access to, correction, or portability of your personal data.',
              'Vous pouvez également nous contacter (voir ci-dessous) pour demander l\'accès, la correction ou la portabilité de vos données personnelles.',
              'Sie können uns auch kontaktieren (siehe unten), um Zugang zu Ihren personenbezogenen Daten, deren Berichtigung oder Übertragbarkeit zu beantragen.',
            )}
          </P>
        </Section>

        <Section title={t('6. Contact', '6. Contact', '6. Kontakt')}>
          <P>
            {t(
              'For privacy-related inquiries, open an issue on ',
              'Pour toute question relative à la vie privée, ouvrez une issue sur ',
              'Für datenschutzbezogene Anfragen öffnen Sie ein Issue auf ',
            )}
            <Link href="https://github.com/QuentinSostaric/space-craft-planner" target="_blank" rel="noopener noreferrer">
              GitHub
            </Link>
            {t(
              ' or reach out to ',
              ' ou contactez ',
              ' oder kontaktieren Sie ',
            )}
            <Link href="https://x.com/ThSamon" target="_blank" rel="noopener noreferrer">
              @ThSamon
            </Link>
            {t(' on X.', ' sur X.', ' auf X.')}
          </P>
        </Section>
      </Box>
    </Box>
  );
}
