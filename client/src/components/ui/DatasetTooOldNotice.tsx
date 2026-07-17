import { Typography } from '../../ui/system';
import { useI18n } from '../../i18n/I18nContext';

export function DatasetTooOldNotice({
  variant = 'body2',
}: {
  variant?: 'body2' | 'caption';
}) {
  const { t } = useI18n();

  return (
    <Typography
      variant={variant}
      sx={{
        color: variant === 'caption' ? 'text.disabled' : 'text.secondary',
        fontStyle: 'italic',
      }}
    >
      {t('Dataset too old.', 'Dataset trop vieux.', 'Datensatz zu alt.')}
    </Typography>
  );
}
