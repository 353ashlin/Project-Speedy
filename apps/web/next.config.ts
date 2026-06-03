import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Native Node modules — don't try to bundle them through webpack.
  serverExternalPackages: [
    '@napi-rs/keyring',
    'better-sqlite3',
    'google-auth-library',
    '@googleapis/gmail',
    '@googleapis/calendar',
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Belt-and-braces: even with serverExternalPackages, webpack still
      // traces transitively through workspace packages and encounters the
      // .node binary. Mark the native modules as commonjs externals so
      // they're require()d at runtime instead of bundled.
      const existing = Array.isArray(config.externals) ? config.externals : []
      config.externals = [
        ...existing,
        { '@napi-rs/keyring': 'commonjs @napi-rs/keyring' },
        { 'better-sqlite3': 'commonjs better-sqlite3' },
        { 'google-auth-library': 'commonjs google-auth-library' },
        { '@googleapis/gmail': 'commonjs @googleapis/gmail' },
        { '@googleapis/calendar': 'commonjs @googleapis/calendar' },
      ]
    }
    return config
  },
}

export default nextConfig
