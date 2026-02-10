/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALLOW_DANGEROUS_CLAUDE_PERMISSIONS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
