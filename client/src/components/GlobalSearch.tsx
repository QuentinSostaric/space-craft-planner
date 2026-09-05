import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { createSearchIndex, searchIndex } from '../utils/searchIndex';

export interface SearchOption {
  key: string;
  label: string;
  description: string;
  kind: 'blueprint' | 'resource' | 'mission';
}

/** Local input state isolates typing from the application header and craft store.
 * Selection happens only on an explicit click or Enter, never on blur.
 */
export function GlobalSearch<T extends SearchOption>({
  options,
  onSelect,
  onActivate,
}: {
  options: readonly T[];
  onSelect: (option: T) => void;
  onActivate: () => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = `search-results-${useId()}`;
  const index = useMemo(() => createSearchIndex(options), [options]);
  const matches = useMemo(() => searchIndex(index, query), [index, query]);
  const activeIndex = Math.max(
    0,
    matches.findIndex((option) => option.key === active),
  );
  const kindLabels = {
    blueprint: t('Blueprint', 'Blueprint', 'Bauplan'),
    resource: t('Resource', 'Ressource', 'Ressource'),
    mission: t('Mission', 'Mission', 'Mission'),
  };
  const kindIcons = { blueprint: 'pi-file', resource: 'pi-box', mission: 'pi-flag' };

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);
  useEffect(() => {
    const onNavigate = () => {
      setOpen(false);
      setQuery('');
      setActive(null);
    };
    window.addEventListener('popstate', onNavigate);
    return () => window.removeEventListener('popstate', onNavigate);
  }, []);
  const select = (option: T) => {
    setOpen(false);
    setQuery('');
    setActive(null);
    onSelect(option);
    requestAnimationFrame(() => {
      const main = document.getElementById('main-content');
      main?.scrollTo({ top: 0 });
      main?.focus({ preventScroll: true });
    });
  };
  const activate = () => {
    setOpen(true);
    onActivate();
  };
  return (
    <div
      ref={root}
      className="global-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="global-search-field" data-open={open}>
        <i className="pi pi-search" aria-hidden="true" />
        <input
          ref={input}
          id="workspace-global-search"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-label={t('Global search', 'Recherche globale', 'Globale Suche')}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && matches.length ? `${listId}-${activeIndex}` : undefined}
          placeholder={t(
            'Search an item, resource, mission…',
            'Rechercher un objet, une ressource, une mission…',
            'Objekt, Ressource, Mission suchen…',
          )}
          value={query}
          onFocus={activate}
          onClick={activate}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(null);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
              return;
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              const next = !open
                ? 0
                : (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) %
                  Math.max(matches.length, 1);
              setOpen(true);
              setActive(matches[next]?.key ?? null);
              requestAnimationFrame(() =>
                document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: 'nearest' }),
              );
            }
            if (event.key === 'Enter' && open && matches[activeIndex]) {
              event.preventDefault();
              select(matches[activeIndex]);
            }
          }}
        />
        {query ? (
          <button
            type="button"
            className="global-search-clear"
            aria-label={t('Clear search', 'Effacer la recherche', 'Suche löschen')}
            onClick={() => {
              setQuery('');
              setActive(null);
              input.current?.focus();
            }}
          >
            <i className="pi pi-times" aria-hidden="true" />
          </button>
        ) : (
          <kbd aria-hidden="true">⌘ / Ctrl K</kbd>
        )}
      </div>
      {open && (
        <div className="global-search-popup">
          <div className="global-search-heading">
            {query.trim()
              ? t('Search results', 'Résultats de recherche', 'Suchergebnisse')
              : t('Quick access', 'Accès rapide', 'Schnellzugriff')}
            <span>{matches.length}</span>
          </div>
          <ul
            id={listId}
            role="listbox"
            aria-label={t('Search results', 'Résultats de recherche', 'Suchergebnisse')}
          >
            {matches.map((option, i) => (
              <li
                key={option.key}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(option)}
                onMouseMove={() => setActive(option.key)}
              >
                <span className={`global-search-kind global-search-kind-${option.kind}`}>
                  <i className={`pi ${kindIcons[option.kind]}`} aria-hidden="true" />
                </span>
                <span className="global-search-copy">
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </span>
                <span className="global-search-type">{kindLabels[option.kind]}</span>
                <i className="pi pi-arrow-up-right" aria-hidden="true" />
              </li>
            ))}
          </ul>
          {!matches.length && (
            <div className="global-search-empty">
              <strong>
                {t('No matching result', 'Aucun résultat correspondant', 'Kein passendes Ergebnis')}
              </strong>
              <span>
                {t(
                  'Try a shorter name or another keyword.',
                  'Essayez un nom plus court ou un autre mot-clé.',
                  'Kürzeren Namen oder anderes Suchwort versuchen.',
                )}
              </span>
            </div>
          )}
          <div className="global-search-footer">
            {t(
              '↑ ↓ navigate · Enter open · Esc close',
              '↑ ↓ naviguer · Entrée ouvrir · Échap fermer',
              '↑ ↓ navigieren · Enter öffnen · Esc schließen',
            )}
          </div>
        </div>
      )}
    </div>
  );
}
