import { Menu } from 'primereact/menu';
import type { MenuItem } from 'primereact/menuitem';
import { cloneElement, useId, useMemo, useRef, type MouseEvent, type ReactElement, type ReactNode } from 'react';
import { useTheme, type SxValue } from '../../../ui/system';
import { compilePrimePartClasses, compilePrimeRootClass, type PrimePartStyles } from '../../../ui/prime/passThrough';

type AppMenuPart = 'root' | 'menu' | 'menuitem' | 'action' | 'icon' | 'label' | 'separator';

export interface AppMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface AppMenuProps {
  items: readonly AppMenuItem[];
  children: ReactElement<{
    id?: string;
    onClick?: (event: MouseEvent<HTMLElement>) => void;
    'aria-controls'?: string;
    'aria-haspopup'?: 'menu';
  }>;
  className?: string;
  sx?: SxValue;
  partSx?: PrimePartStyles<AppMenuPart>;
}

export function AppMenu({ items, children, className, sx, partSx }: AppMenuProps) {
  const menuRef = useRef<Menu>(null);
  const generatedId = useId().replace(/:/g, '');
  const menuId = `app-menu-${generatedId}`;
  const theme = useTheme();

  const model = useMemo<MenuItem[]>(() => items.map((item) => ({
    id: item.key,
    label: item.label,
    disabled: item.disabled,
    className: item.active ? 'app-menu-item-active' : undefined,
    command: item.onSelect,
    template: (_primeItem, options) => (
      <button
        type="button"
        className={options.className}
        onClick={options.onClick}
        aria-current={item.active ? 'page' : undefined}
      >
        {item.icon ? <span className="p-menuitem-icon" aria-hidden="true">{item.icon}</span> : null}
        <span className="p-menuitem-text">{item.label}</span>
      </button>
    ),
  })), [items]);

  return (
    <>
      {cloneElement(children, {
        id: children.props.id ?? `${menuId}-trigger`,
        'aria-controls': menuId,
        'aria-haspopup': 'menu',
        onClick: (event) => {
          children.props.onClick?.(event);
          menuRef.current?.toggle(event);
        },
      })}
      <Menu
        id={menuId}
        ref={menuRef}
        model={model}
        popup
        popupAlignment="right"
        className={compilePrimeRootClass(theme, sx, className)}
        pt={compilePrimePartClasses(theme, partSx)}
      />
    </>
  );
}
