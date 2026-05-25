import Box from '@mui/material/Box';
import Button, { type ButtonProps } from '@mui/material/Button';

export type CitizenIdBrandEnvironment = 'production' | 'unstable';

const CITIZENID_ASSETS = {
  production: {
    iconLight: 'https://citizenid.space/assets/prod/citizenid-icon-light.png',
    iconDark: 'https://citizenid.space/assets/prod/citizenid-icon-dark.png',
  },
  unstable: {
    iconLight: 'https://citizenid.dev/assets/dev/citizenid-icon-light.png',
    iconDark: 'https://citizenid.dev/assets/dev/citizenid-icon-dark.png',
  },
} satisfies Record<CitizenIdBrandEnvironment, Record<'iconLight' | 'iconDark', string>>;

type CitizenIdIconProps = {
  environment?: CitizenIdBrandEnvironment;
  size?: number;
  variant?: 'light' | 'dark';
};

export function CitizenIdIcon({
  environment = 'production',
  size = 24,
  variant = 'light',
}: CitizenIdIconProps) {
  const assetSet = CITIZENID_ASSETS[environment] ?? CITIZENID_ASSETS.production;
  const src = variant === 'dark' ? assetSet.iconDark : assetSet.iconLight;

  return (
    <Box
      component="img"
      src={src}
      alt=""
      aria-hidden="true"
      sx={{
        width: size,
        height: size,
        display: 'block',
        objectFit: 'contain',
        flexShrink: 0,
      }}
    />
  );
}

type CitizenIdSignInButtonProps = Omit<ButtonProps, 'children' | 'startIcon'> & {
  environment?: CitizenIdBrandEnvironment;
};

export function CitizenIdSignInButton({
  environment = 'production',
  sx,
  ...buttonProps
}: CitizenIdSignInButtonProps) {
  return (
    <Button
      variant="contained"
      startIcon={<CitizenIdIcon environment={environment} size={24} variant="light" />}
      sx={[
        {
          backgroundColor: '#212126',
          color: '#F0F0F0',
          textTransform: 'none',
          fontWeight: 800,
          border: '1px solid rgba(240, 240, 240, 0.18)',
          boxShadow: 'none',
          '&:hover': {
            backgroundColor: '#0E0E0F',
            boxShadow: 'none',
          },
          '&.Mui-disabled': {
            backgroundColor: '#212126',
            color: 'rgba(240, 240, 240, 0.42)',
          },
          '& .MuiButton-startIcon': {
            mr: 1,
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...buttonProps}
    >
      Sign in with Citizen iD
    </Button>
  );
}
