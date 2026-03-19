import { Component, type ReactNode, type ErrorInfo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';

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
                fontFamily: "'Khand', sans-serif",
                fontWeight: 700,
                mb: 2,
                color: 'error.main',
              }}
            >
              Something went wrong
            </Typography>
            <Typography
              component="pre"
              variant="caption"
              sx={{
                display: 'block',
                fontSize: '.75rem',
                opacity: 0.7,
                mb: 3,
                whiteSpace: 'pre-wrap',
                textAlign: 'left',
                p: 1.5,
                backgroundColor: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {this.state.error.message}
            </Typography>
            <Button
              variant="contained"
              color="error"
              onClick={() => this.setState({ error: null })}
            >
              Retry
            </Button>
          </Paper>
        </Box>
      );
    }
    return this.props.children;
  }
}
