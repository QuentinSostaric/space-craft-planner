import { useI18n } from '../i18n/I18nContext';

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="site-footer__inner">
        <p className="site-footer__disclaimer">
          {t(
            'This is an unofficial Star Citizen fan site, not affiliated with the Cloud Imperium group of companies. All game content and materials are copyright Cloud Imperium Rights LLC and Cloud Imperium Rights Ltd.',
            'Ceci est un site de fan Star Citizen non officiel, non affilie au groupe Cloud Imperium. Tout le contenu et les materiaux du jeu sont la propriete de Cloud Imperium Rights LLC et Cloud Imperium Rights Ltd.',
          )}
          {' '}
          Star Citizen\u00AE, Squadron 42\u00AE, Roberts Space Industries\u00AE,{' '}
          {t('and', 'et')} Cloud Imperium\u00AE{' '}
          {t(
            'are registered trademarks of Cloud Imperium Rights LLC.',
            'sont des marques deposees de Cloud Imperium Rights LLC.',
          )}
        </p>
        <div className="site-footer__credits">
          <a
            href="https://robertsspaceindustries.com"
            target="_blank"
            rel="noopener noreferrer"
            className="site-footer__rsi-link"
          >
            robertsspaceindustries.com
          </a>
          <span className="site-footer__sep" aria-hidden="true">|</span>
          <span className="site-footer__author">
            {t('Made by', 'Fait par')}{' '}
            <a
              href="https://x.com/ThSamon"
              target="_blank"
              rel="noopener noreferrer"
            >
              @ThSamon
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
