#!/usr/bin/env node
//
// Regenerates legal/*.md and docs/*.html from constants/legal.js.
//
// Ante used to keep three hand-maintained copies of the privacy policy, and
// they drifted: the in-app one denied the existence of an export feature that
// had shipped, and sent users to an email address for a deletion the app could
// already do itself. That is the shape of a deceptive-practice claim, and it
// happened for the ordinary reason — three files, one edit.
//
// So there is one source now, constants/legal.js, and this script projects it
// into the two published formats. Run it after any edit there:
//
//   npm run legal:build
//
// constants/legal.js is an ES module and this script is CommonJS, which Node
// will not require() across. Rather than add a build step for one file, the
// source is read as text and the two exported arrays are evaluated in a
// sandbox. That is enough for a file of string literals, and it keeps the app
// bundle free of anything that exists only to serve this script.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'constants', 'legal.js');

function loadLegal() {
  const src = fs.readFileSync(SOURCE, 'utf8');
  // Strip the ES module syntax that a bare vm context cannot parse. Every
  // export in this file is a plain `export const`, so dropping the keyword
  // leaves valid script that declares the same bindings.
  const script = src.replace(/^export\s+/gm, '') + '\n;({ CONTACT_EMAIL, OPERATOR, LEGAL_VERSION, LEGAL_LAST_UPDATED, MINIMUM_AGE, HELPLINE, PRIVACY_SECTIONS, TERMS_SECTIONS });';
  return vm.runInNewContext(script, {}, { filename: SOURCE });
}

const legal = loadLegal();

// --- shared helpers -------------------------------------------------------

// The app renders these strings into <Text>, where every character is literal.
// HTML is not, so anything that could open a tag or an entity is escaped on
// the way out. The source is ours, not user input, but an unescaped ampersand
// in "Data & Privacy" is a rendering bug waiting for the first policy edit
// that adds one.
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Turn the one email address and any bare URL into links, after escaping, so
// the hosted pages stay clickable the way the hand-written ones were.
function linkify(s) {
  return s.replace(
    new RegExp(legal.CONTACT_EMAIL.replace(/[.]/g, '\\.'), 'g'),
    `<a href="mailto:${legal.CONTACT_EMAIL}">${legal.CONTACT_EMAIL}</a>`
  );
}

// Markdown treats a bare `_` or `*` as emphasis; none appear in the current
// text, but the arrows and quotes do, and those pass through untouched.
function md(doc, sections) {
  const out = [`# Ante ${doc}`, '', `**Last Updated: ${legal.LEGAL_LAST_UPDATED}**`, ''];
  for (const section of sections) {
    out.push(`## ${section.heading}`, '');
    for (const p of section.body || []) out.push(p, '');
    for (const b of section.bullets || []) out.push(`- ${b}`);
    if (section.bullets?.length) out.push('');
    for (const p of section.after || []) out.push(p, '');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function html(doc, sections, { slug, otherSlug, otherTitle }) {
  const body = [];
  for (const section of sections) {
    body.push(`    <h2>${escapeHtml(section.heading)}</h2>`);
    for (const p of section.body || []) body.push(`    <p>${linkify(escapeHtml(p))}</p>`);
    if (section.bullets?.length) {
      body.push('    <ul>');
      for (const b of section.bullets) body.push(`      <li>${linkify(escapeHtml(b))}</li>`);
      body.push('    </ul>');
    }
    for (const p of section.after || []) body.push(`    <p>${linkify(escapeHtml(p))}</p>`);
    body.push('');
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${doc} — Ante</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,600;1,6..96,500&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" />
<link rel="stylesheet" href="./assets/style.css" />
</head>
<body>
  <div class="wrap">
    <header class="site-head">
      <a class="mark" href="./index.html">
        <img src="./assets/logo.png" alt="" onerror="this.style.display='none'" />
        <span class="mark-text">
          <span class="brand">ANTE</span>
          <span class="brand-tag">Bankroll System</span>
        </span>
      </a>
      <nav class="site-nav">
        <a href="./privacy-policy.html"${slug === 'privacy-policy' ? ' aria-current="page"' : ''}>Privacy</a>
        <a href="./terms-of-service.html"${slug === 'terms-of-service' ? ' aria-current="page"' : ''}>Terms</a>
        <a href="./delete-account.html">Delete Account</a>
      </nav>
    </header>

    <h1>${doc}</h1>
    <div class="updated">Last Updated: ${legal.LEGAL_LAST_UPDATED}</div>

${body.join('\n')}
    <div class="links-row">
      <a href="./${otherSlug}.html">${otherTitle}</a>
      <a href="./index.html">Back to Ante</a>
    </div>
  </div>
</body>
</html>
`;
}

// --- write ----------------------------------------------------------------

const targets = [
  {
    doc: 'Privacy Policy',
    sections: legal.PRIVACY_SECTIONS,
    mdPath: path.join(ROOT, 'legal', 'PRIVACY_POLICY.md'),
    htmlPath: path.join(ROOT, 'docs', 'privacy-policy.html'),
    slug: 'privacy-policy',
    otherSlug: 'terms-of-service',
    otherTitle: 'Terms of Service',
  },
  {
    doc: 'Terms of Service',
    sections: legal.TERMS_SECTIONS,
    mdPath: path.join(ROOT, 'legal', 'TERMS_OF_SERVICE.md'),
    htmlPath: path.join(ROOT, 'docs', 'terms-of-service.html'),
    slug: 'terms-of-service',
    otherSlug: 'privacy-policy',
    otherTitle: 'Privacy Policy',
  },
];

for (const t of targets) {
  fs.writeFileSync(t.mdPath, md(t.doc, t.sections));
  fs.writeFileSync(t.htmlPath, html(t.doc, t.sections, t));
  console.log('wrote ' + path.relative(ROOT, t.mdPath) + ' and ' + path.relative(ROOT, t.htmlPath));
}

console.log('version ' + legal.LEGAL_VERSION + ' (' + legal.LEGAL_LAST_UPDATED + ')');
