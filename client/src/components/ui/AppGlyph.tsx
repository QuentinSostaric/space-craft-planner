import { Box } from '../../ui/system';
import type { SxProps, Theme } from '../../ui/system';

const GLYPH_URLS = {
  'arrow-left': '/icons/ui/arrow-left.svg',
  'caret-up': '/icons/ui/caret-up.svg',
  checkmark: '/icons/ui/checkmark.svg',
  search: '/icons/ui/search.svg',
} as const;

export type AppGlyphName = keyof typeof GLYPH_URLS;

interface AppGlyphProps {
  name: AppGlyphName;
  size?: number;
  className?: string;
  sx?: SxProps<Theme>;
  ariaLabel?: string;
}

export function AppGlyph({
  name,
  size = 20,
  className,
  sx,
  ariaLabel,
}: AppGlyphProps) {
  const url = GLYPH_URLS[name];

  return (
    <Box
      component="span"
      className={className}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : 'true'}
      sx={[{
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
        backgroundColor: 'currentColor',
        maskImage: `url(${url})`,
        WebkitMaskImage: `url(${url})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }, sx]}
    />
  );
}
