#!/usr/bin/env node
//
// Regenerates legal/THIRD_PARTY_NOTICES.md from the installed production
// dependency tree.
//
//   npm run legal:notices
//
// Why this file has to exist: Ante ships React Native, Expo, Ionicons,
// aes-js and several hundred other packages, and the MIT licence — the one
// most of them use — requires that its copyright notice and permission
// notice be included in "all copies or substantial portions of the Software."
// Apache-2.0 s.4 says the same and adds the NOTICE-file requirement.
// Distributing a binary with none of that reproduced anywhere is a licence
// breach on every one of them. It is rarely litigated and trivially avoided,
// which is a bad combination to be on the wrong side of.
//
// Scope is the production tree only. devDependencies (jest, eslint, babel)
// are build tooling and are not distributed in the app binary, so their
// licences do not travel with it and listing them would only pad the file.
//
// The full licence text is reproduced where the package ships one, because
// "MIT" as a bare string is not the notice the licence asks you to include.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'legal', 'THIRD_PARTY_NOTICES.md');

// `npm ls --parseable` prints one absolute path per installed package in the
// tree. It is the only listing that reflects what npm actually resolved,
// including hoisting and deduping, which walking package.json by hand does
// not. It exits non-zero on peer-dependency warnings while still printing a
// perfectly good tree, so the exit code is ignored and the output is used.
function installedPaths() {
  let out = '';
  try {
    // execSync rather than execFileSync: npm is npm.cmd on Windows, and
    // recent Node refuses to spawn a .cmd without a shell.
    out = execSync('npm ls --omit=dev --all --parseable', {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (err) {
    out = err.stdout || '';
    if (!out) {
      console.error('npm ls produced no output; is node_modules installed?');
      process.exit(1);
    }
  }
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l !== ROOT && l.includes('node_modules'));
}

const LICENSE_FILENAMES = [
  'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md', 'LICENCE.txt',
  'License', 'License.md', 'License.txt', 'license', 'license.md', 'license.txt',
  'LICENSE-MIT', 'LICENSE-MIT.txt', 'LICENSE.BSD', 'COPYING', 'NOTICE',
];

function readLicenseText(dir) {
  for (const name of LICENSE_FILENAMES) {
    const p = path.join(dir, name);
    try {
      if (fs.statSync(p).isFile()) {
        const text = fs.readFileSync(p, 'utf8').trim();
        if (text) return text;
      }
    } catch {
      // Missing file, or a directory called LICENSE — try the next candidate.
    }
  }
  return null;
}

function declaredLicense(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license?.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses)) {
    return pkg.licenses.map((l) => l.type || l).filter(Boolean).join(' OR ');
  }
  return 'See package';
}

const seen = new Map();

for (const dir of installedPaths()) {
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  } catch {
    continue;
  }
  if (!pkg.name) continue;
  // Several versions of the same package can be installed at once. Key by
  // name+version so each distinct one is credited exactly once.
  const key = `${pkg.name}@${pkg.version}`;
  if (seen.has(key)) continue;
  seen.set(key, {
    name: pkg.name,
    version: pkg.version,
    license: declaredLicense(pkg),
    homepage: pkg.homepage || (typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url) || null,
    text: readLicenseText(dir),
  });
}

const entries = [...seen.values()].sort((a, b) =>
  a.name.localeCompare(b.name) || a.version.localeCompare(b.version)
);

const byLicense = entries.reduce((acc, e) => {
  acc[e.license] = (acc[e.license] || 0) + 1;
  return acc;
}, {});

const out = [];
out.push('# Third-Party Notices');
out.push('');
out.push('Ante incorporates the open-source packages listed below. Each remains the');
out.push('property of its authors and is used under the licence shown with it. The');
out.push('licence texts are reproduced in full, as those licences require.');
out.push('');
out.push('This file is generated — run `npm run legal:notices` after changing a');
out.push('dependency rather than editing it by hand. It covers the production');
out.push('dependency tree only; build-time tooling is not distributed with the app.');
out.push('');
out.push(`**${entries.length} packages.** Licence breakdown:`);
out.push('');
for (const [lic, count] of Object.entries(byLicense).sort((a, b) => b[1] - a[1])) {
  out.push(`- ${lic} — ${count}`);
}
out.push('');
out.push('---');
out.push('');

for (const e of entries) {
  out.push(`## ${e.name} ${e.version}`);
  out.push('');
  out.push(`Licence: ${e.license}`);
  if (e.homepage) out.push(`Source: ${e.homepage.replace(/^git\+/, '').replace(/\.git$/, '')}`);
  out.push('');
  if (e.text) {
    out.push('```');
    // Fence-safe: a licence file containing a ``` line would end the block early.
    out.push(e.text.replace(/```/g, "'''"));
    out.push('```');
  } else {
    out.push(`_No licence file shipped with this package; the declared licence is ${e.license}._`);
  }
  out.push('');
}

fs.writeFileSync(OUT, out.join('\n'));
console.log(`wrote legal/THIRD_PARTY_NOTICES.md — ${entries.length} packages`);

const missing = entries.filter((e) => !e.text);
if (missing.length) {
  console.log(`note: ${missing.length} package(s) ship no licence file: ${missing.slice(0, 8).map((m) => m.name).join(', ')}${missing.length > 8 ? '…' : ''}`);
}
