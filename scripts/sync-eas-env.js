#!/usr/bin/env node
/**
 * Pushes the EXPO_PUBLIC_* keys from the local .env up to EAS as project
 * environment variables, so cloud builds get the same configuration the
 * local dev server has.
 *
 * This exists because .env is gitignored: EAS Build only ever sees what is
 * in the repo, so without this a production build ships with
 * EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY / EXPO_PUBLIC_REVENUECAT_API_KEY all
 * undefined — which does not crash, it just silently disables sync and
 * leaves Ante+ permanently locked (see purchasesService.configurePurchases).
 *
 * Usage:
 *   node scripts/sync-eas-env.js                     # production + preview + development
 *   node scripts/sync-eas-env.js production          # one environment
 *
 * Values are read straight from .env and handed to the eas CLI as argv —
 * they are never printed, so this is safe to run with the output shared.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ENV_FILE = path.join(__dirname, '..', '.env');
const DEFAULT_ENVIRONMENTS = ['production', 'preview', 'development'];

// Only EXPO_PUBLIC_-prefixed keys are worth syncing: they are the ones Expo
// inlines into the JS bundle at build time, which is exactly the set the app
// reads at runtime via process.env. Anything else in .env is tooling-local.
const PREFIX = 'EXPO_PUBLIC_';

// Never synced from .env, because EAS keys a variable by NAME across every
// environment — `env:set --environment development` overwrites the value
// production sees too. So anything whose value must differ between local dev
// and shipped builds has to be managed by hand with `eas env:set`, or a
// routine sync would silently swap it out from under a release build.
//
// The RevenueCat key is exactly that: .env holds the Test Store key
// (test_...) so `expo start` has a working paywall locally, while EAS holds
// the real Play key (goog_...) so shipped builds take real money. Syncing it
// would replace the second with the first and produce a build that fakes
// purchases on a live Play track — a failure that looks like success.
const NEVER_SYNC = new Set(['EXPO_PUBLIC_REVENUECAT_API_KEY']);

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`No .env found at ${filePath}. Nothing to sync.`);
    process.exit(1);
  }
  const vars = new Map();
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const name = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip one matching pair of surrounding quotes, if present.
    if (value.length >= 2 && /^(".*"|'.*')$/s.test(value)) {
      value = value.slice(1, -1);
    }
    if (name.startsWith(PREFIX) && value && !NEVER_SYNC.has(name)) vars.set(name, value);
  }
  return vars;
}

// Double quotes neutralise every shell metacharacter that matters on both
// cmd.exe and POSIX shells except these — cmd expands %VAR% and, with delayed
// expansion on, !VAR! even inside quotes, and a literal quote would end the
// quoting entirely. API keys and URLs never contain them, so rather than
// attempt cross-shell escaping we refuse the value and say so, instead of
// silently uploading a truncated key that would fail at runtime.
function isShellQuotable(value) {
  return !/["%!\r\n]/.test(value);
}

function quoteForShell(arg) {
  return `"${arg}"`;
}

function main() {
  const environments = process.argv.slice(2).length
    ? process.argv.slice(2)
    : DEFAULT_ENVIRONMENTS;

  const invalid = environments.filter((e) => !DEFAULT_ENVIRONMENTS.includes(e));
  if (invalid.length) {
    console.error(`Unknown environment(s): ${invalid.join(', ')}`);
    console.error(`Valid environments: ${DEFAULT_ENVIRONMENTS.join(', ')}`);
    process.exit(1);
  }

  const vars = parseEnvFile(ENV_FILE);
  if (!vars.size) {
    console.error(`No ${PREFIX}* keys with values found in .env. Nothing to sync.`);
    process.exit(1);
  }

  console.log(
    `Syncing ${vars.size} variable(s) to EAS [${environments.join(', ')}]: ${[...vars.keys()].join(', ')}`
  );
  console.log(`Not synced (managed by hand): ${[...NEVER_SYNC].join(', ')}\n`);

  const unquotable = [...vars].filter(([, value]) => !isShellQuotable(value));
  if (unquotable.length) {
    console.error(
      `These values contain characters this script cannot safely quote (\" % ! or a newline): ${unquotable
        .map(([name]) => name)
        .join(', ')}`
    );
    console.error('Set those by hand with `eas env:set` and re-run for the rest.');
    process.exit(1);
  }

  let failed = 0;
  for (const [name, value] of vars) {
    const args = [
      'eas',
      'env:set',
      '--scope', 'project',
      '--name', name,
      '--value', value,
      '--type', 'string',
      // plaintext, not secret: these end up inside the shipped JS bundle
      // either way (that is what EXPO_PUBLIC_ means), and marking them secret
      // would only hide them from you, not from anyone holding the APK.
      '--visibility', 'plaintext',
      '--environment', ...environments,
      '--non-interactive',
    ];
    // `eas` is a .cmd shim on Windows, and Node (>= 18.20 / 20.12, after
    // CVE-2024-27980) refuses to spawn .cmd without a shell — so shell:true
    // is not optional here. Node does not escape argv when shelling out,
    // hence quoteForShell below.
    const result = spawnSync(args.map(quoteForShell).join(' '), {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });
    const ok = result.status === 0;
    if (!ok) {
      failed += 1;
      const stderr = (result.stderr || '').toString().trim();
      console.error(`  ✗ ${name}`);
      // Echo the CLI's own error, but never the line we sent it.
      if (stderr) console.error(`    ${stderr.split('\n').slice(0, 4).join('\n    ')}`);
    } else {
      console.log(`  ✓ ${name}`);
    }
  }

  if (failed) {
    console.error(`\n${failed} variable(s) failed. Run \`eas whoami\` to confirm you are logged in.`);
    process.exit(1);
  }
  console.log('\nDone. Verify with: eas env:list --environment production');
}

main();
