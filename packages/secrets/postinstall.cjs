// Smoke check that runs after `pnpm install`. If the @napi-rs/keyring native
// module didn't compile / didn't ship a prebuilt for this platform, fail
// loudly here rather than silently at runtime.
try {
  require('@napi-rs/keyring')
  // eslint-disable-next-line no-console
  console.log('[@speedy/secrets] @napi-rs/keyring loaded successfully.')
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[@speedy/secrets] FAILED to load @napi-rs/keyring native module.')
  console.error(err?.message ?? err)
  process.exit(1)
}
