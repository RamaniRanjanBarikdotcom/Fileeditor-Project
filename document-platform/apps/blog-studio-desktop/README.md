# Blog Studio Desktop

This is the standalone Windows application for AppToolkitLab Blog Studio. It loads only packaged renderer files, reuses the shared checkpointed blog engine, stores local data in SQLite, encrypts provider keys with Electron `safeStorage`, verifies an offline activation certificate, and exposes a narrow validated IPC surface.

Development starts with `pnpm --filter @docconv/blog-studio-desktop dev`. A Windows x64 NSIS installer is produced with `pnpm --filter @docconv/blog-studio-desktop package:win` from the signed Windows release environment.

Public release remains blocked by `FEATURE_BLOG_DESKTOP_SALES=false` until the installer and updates are code-signed and the clean Windows VM smoke test passes.

The release pipeline must inject the AppToolkitLab Ed25519 public key as `BLOG_STUDIO_LICENSE_PUBLIC_KEY`. The matching private key remains server-only.
