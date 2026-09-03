import { Box, Typography, Paper } from '../ui/system';
import { AppButton } from './ui/controls';
import { Component, type ReactNode, type ErrorInfo } from 'react';
import { FONT_HEADING } from '../theme';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Box
          role="alert"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            p: 4,
            minHeight: '100dvh',
            backgroundColor: 'background.default',
          }}
        >
          <Paper
            variant="outlined"
            sx={{
              p: 4,
              textAlign: 'center',
              maxWidth: 480,
              borderColor: 'error.main',
              backgroundColor: 'rgba(248, 71, 71, 0.05)',
            }}
          >
            <Typography
              variant="h5"
              sx={{
                fontFamily: FONT_HEADING,
                fontWeight: 700,
                mb: 2,
                color: 'error.main',
              }}
            >
              Something went wrong
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, lineHeight: 1.6 }}>
              We couldn&apos;t load this part of the app. Try again or reload the page.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
              <AppButton
                variant="secondary"
                onClick={() => this.setState({ error: null })}
                sx={{ minHeight: 44 }}
              >
                Try again
              </AppButton>
              <AppButton
                variant="primary"
                onClick={() => window.location.reload()}
                sx={{ minHeight: 44 }}
              >
                Reload page
              </AppButton>
            </Box>
          </Paper>
        </Box>
      );
    }
    return this.props.children;
  }
}
