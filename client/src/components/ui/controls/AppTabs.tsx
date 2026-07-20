import { TabPanel, TabView } from 'primereact/tabview';
import type { ReactNode } from 'react';
import { useTheme, type SxValue } from '../../../ui/system';
import {
  compilePrimePartClasses,
  compilePrimeRootClass,
  type PrimePartStyles,
} from '../../../ui/prime/passThrough';

type AppTabsPart = 'root' | 'navContainer' | 'navContent' | 'nav' | 'inkbar' | 'panelContainer';

export interface AppTabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface AppTabsProps {
  tabs: readonly AppTabItem[];
  activeId: string;
  onActiveIdChange: (id: string) => void;
  ariaLabel?: string;
  className?: string;
  sx?: SxValue;
  partSx?: PrimePartStyles<AppTabsPart>;
}

export function AppTabs({
  tabs,
  activeId,
  onActiveIdChange,
  ariaLabel,
  className,
  sx,
  partSx,
}: AppTabsProps) {
  const theme = useTheme();
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === activeId));
  const pt = compilePrimePartClasses(theme, partSx);

  return (
    <TabView
      activeIndex={activeIndex}
      onTabChange={(event) => {
        const tab = tabs[event.index];
        if (tab) onActiveIdChange(tab.id);
      }}
      aria-label={ariaLabel}
      className={compilePrimeRootClass(theme, sx, className)}
      pt={pt}
    >
      {tabs.map((tab) => (
        <TabPanel key={tab.id} header={tab.label} disabled={tab.disabled}>
          {tab.content}
        </TabPanel>
      ))}
    </TabView>
  );
}
