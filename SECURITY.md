# Security Policy

## Reporting Vulnerabilities

Please report security issues privately to the maintainers instead of opening a public issue.

Include:

- affected endpoint, workflow, or package
- steps to reproduce
- expected and observed behavior
- any relevant logs with secrets removed

## Secrets

Do not commit local `.env`, `.dev.vars`, Cloudflare credentials, Discord tokens, Tauri signing keys, or extracted game files. Rotate any credential that was ever committed, even if it was later removed.
