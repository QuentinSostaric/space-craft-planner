import { useState, type MouseEvent } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import type { ButtonProps } from '@mui/material/Button';
import type { SxProps, Theme } from '@mui/material/styles';
import { useI18n } from '../i18n/I18nContext';
import { FONT_MONO } from '../theme';
import { getDesktopInstallerUrl, getDetectedPlatform, getFlatpakInstallUri } from '../services/apiBaseUrl';

export type DesktopDownloadTarget = 'default' | 'appimage' | 'flatpak';

interface DesktopDownloadButtonProps {
  label: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  fullWidth?: boolean;
  sx?: SxProps<Theme>;
  /** Fired when the user picks an installer (for analytics). */
  onDownload?: (target: DesktopDownloadTarget) => void;
  'aria-label'?: string;
}

/**
 * Desktop install CTA. On Linux it opens a dropdown letting the user choose
 * between the AppImage (direct download) and the Flatpak (opens the system
 * software center via `appstream://`). On every other platform it is a plain
 * link to the latest installer.
 */
export function DesktopDownloadButton({
  label,
  variant = 'outlined',
  size,
  fullWidth,
  sx,
  onDownload,
  'aria-label': ariaLabel,
}: DesktopDownloadButtonProps) {
  const { t } = useI18n();
  const isLinux = getDetectedPlatform() === 'linux';
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  if (!isLinux) {
    return (
      <Button
        component="a"
        href={getDesktopInstallerUrl()}
        onClick={() => onDownload?.('default')}
        size={size}
        variant={variant}
        fullWidth={fullWidth}
        startIcon={<DownloadOutlinedIcon sx={{ fontSize: 13 }} />}
        aria-label={ariaLabel}
        sx={sx}
      >
        {label}
      </Button>
    );
  }

  const handleAppImage = () => {
    setAnchorEl(null);
    onDownload?.('appimage');
    window.location.href = getDesktopInstallerUrl({ platform: 'linux', format: 'appimage' });
  };

  const handleFlatpak = () => {
    setAnchorEl(null);
    onDownload?.('flatpak');
    // Hands the URI to the OS, which opens the registered software center.
    window.location.href = getFlatpakInstallUri();
  };

  return (
    <>
      <Button
        onClick={(e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)}
        size={size}
        variant={variant}
        fullWidth={fullWidth}
        startIcon={<DownloadOutlinedIcon sx={{ fontSize: 13 }} />}
        endIcon={<ArrowDropDownIcon sx={{ fontSize: 16 }} />}
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        sx={sx}
      >
        {label}
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={handleAppImage} sx={{ fontFamily: FONT_MONO }}>
          <ListItemText
            primary="AppImage"
            secondary={t('Portable, runs anywhere', 'Portable, fonctionne partout', 'Portabel, läuft überall')}
            slotProps={{ secondary: { sx: { fontSize: '0.7rem' } } }}
          />
        </MenuItem>
        <MenuItem onClick={handleFlatpak} sx={{ fontFamily: FONT_MONO }}>
          <ListItemText
            primary="Flatpak"
            secondary={t('Install via Software', 'Installer via Logiciel', 'Über Software installieren')}
            slotProps={{ secondary: { sx: { fontSize: '0.7rem' } } }}
          />
        </MenuItem>
      </Menu>
    </>
  );
}
