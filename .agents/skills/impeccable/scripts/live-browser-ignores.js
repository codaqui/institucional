/**
 * Browser-side resolution of project detector waivers for Impeccable live mode.
 *
 * The live server serializes `.impeccable/config.json` + `config.local.json`
 * detector ignores (plus the served-root prefixes from the inject config's
 * `files` globs) into `window.__IMPECCABLE_PROJECT_IGNORES__`. This part
 * resolves that config against the current page's URL path when a detect scan
 * starts, so the overlay suppresses the same findings the CLI and the edit
 * hook do (issue #639).
 *
 * Mirrors filterDetectionFindings in cli/lib/impeccable-config.mjs:
 *   1. `ignoreRules` suppress a rule project-wide.
 *   2. `ignoreValues` entries with `value: "*"` suppress their rule in the
 *      files their globs name. The CLI never applies an unscoped wildcard
 *      (isIgnoredFindingValue returns false for it), so neither does this.
 *   3. Remaining `ignoreValues` entries match on the finding's own value;
 *      those are forwarded as `disabledValues` for the detector bundle to
 *      apply where the findings are assembled.
 *   4. `ignoreFiles` globs that name the page waive it wholesale: the
 *      resolver reports `skipScan: true` and the detector answers the scan
 *      with zero findings, mirroring shouldIgnoreDetectionFile in the CLI
 *      and the edit hook's own ignoreFiles gate.
 *
 * `pageFiles`, when the server could resolve it, lists the real project
 * files the inject config serves. A URL that suffix-matches exactly one of
 * them takes that file as its only project identity; an ambiguous or absent
 * match falls back to the served-root common ancestor below.
 *
 * Known gap, unchanged from PR #645: framework apps inject into source files
 * (src/routes/about/+page.svelte) while scans see route URLs (/about), so
 * entries scoped to source or asset paths never match a page candidate and
 * are dropped. That shows the finding, which is the conservative direction.
 *
 * Kept separate from live-browser.js so the glob and page-scope logic can be
 * unit tested in Node (tests/live-browser-ignores.test.mjs) without the full
 * overlay UI bundle.
 */
(function (root) {
  'use strict';
  if (!root) return;

  function normalizeIgnoreRule(rule) {
    return String(rule || '').trim().toLowerCase();
  }

  function stripWrappingQuotes(value) {
    const trimmed = String(value || '').trim();
    const quote = trimmed.at(0);
    const hasPair = (quote === '"' || quote === "'") && trimmed.at(-1) === quote;
    return hasPair ? trimmed.slice(1, -1) : trimmed;
  }

  function normalizeIgnoreValue(value) {
    return stripWrappingQuotes(value)
      .replaceAll('+', ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function escapeRegexToken(value) {
    return value.replace(/[.+^$()|[\]\\]/g, String.raw`\$&`);
  }

  function appendBraceAlternation(glob, start, re) {
    const end = glob.indexOf('}', start);
    if (end === -1) return { re: re + String.raw`\{`, i: start + 1 };
    const parts = glob.slice(start + 1, end).split(',').map(escapeRegexToken);
    return { re: `${re}(?:${parts.join('|')})`, i: end + 1 };
  }

  function appendGlobToken(glob, i, re) {
    const c = glob[i];
    if (c === '{') return appendBraceAlternation(glob, i, re);
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i += 2;
        if (glob[i] === '/') {
          re += '(?:.*/)?';
          i += 1;
        } else {
          re += '.*';
        }
      } else {
        re += '[^/]*';
        i += 1;
      }
    } else if (c === '?') {
      re += '[^/]';
      i += 1;
    } else if (/[.+^$()|[\]\\]/.test(c)) {
      re += `\\${c}`;
      i += 1;
    } else {
      re += c;
      i += 1;
    }
    return { re, i };
  }

  function globToRegex(glob) {
    let re = '^';
    let i = 0;
    while (i < glob.length) {
      const next = appendGlobToken(glob, i, re);
      re = next.re;
      i = next.i;
    }
    re += '$';
    return new RegExp(re);
  }

  function normalizePagePath(pathname) {
    let pagePath = String(pathname || '');
    try {
      pagePath = decodeURIComponent(pagePath);
    } catch {
      // Malformed percent-escape: match on the raw path rather than throwing.
    }
    pagePath = pagePath.replace(/^\/+/, '');
    if (pagePath === '' || pagePath.endsWith('/')) pagePath += 'index.html';
    return pagePath;
  }

  function addSuffixes(candidates, fullPath) {
    const parts = fullPath.split('/').filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      candidates.add(parts.slice(i).join('/'));
    }
  }

  function findKnownPages(pageFiles, pagePath) {
    const knownPages = [];
    for (const entry of Array.isArray(pageFiles) ? pageFiles : []) {
      if (typeof entry !== 'string' || !entry) continue;
      if (entry === pagePath || entry.endsWith('/' + pagePath)) knownPages.push(entry);
    }
    return knownPages;
  }

  function findCommonPrefix(roots) {
    const prefixes = [];
    for (const entry of Array.isArray(roots) ? roots : []) {
      if (typeof entry !== 'string') continue;
      prefixes.push(entry.split('/').filter(Boolean));
    }
    let common = prefixes.length > 0 ? prefixes[0] : [];
    for (const segments of prefixes.slice(1)) {
      let i = 0;
      while (i < common.length && i < segments.length && common[i] === segments[i]) i += 1;
      common = common.slice(0, i);
    }
    return common;
  }

  function pageCandidates(pathname, roots, pageFiles) {
    const pagePath = normalizePagePath(pathname);
    const candidates = new Set();
    addSuffixes(candidates, pagePath);

    const knownPages = findKnownPages(pageFiles, pagePath);
    if (knownPages.length === 1) {
      addSuffixes(candidates, knownPages[0]);
      return [...candidates];
    }

    const common = findCommonPrefix(roots);
    if (common.length > 0) addSuffixes(candidates, common.join('/') + '/' + pagePath);
    return [...candidates];
  }

  function matchesScope(globs, candidates) {
    return globs.some((glob) => {
      let re;
      try {
        re = globToRegex(String(glob));
      } catch {
        return false;
      }
      return candidates.some((candidate) => re.test(candidate));
    });
  }

  function nonEmptyStrings(value) {
    return Array.isArray(value)
      ? value.filter((item) => typeof item === 'string' && item.trim())
      : [];
  }

  function scopedFiles(entry) {
    return [
      ...(typeof entry.file === 'string' && entry.file.trim() ? [entry.file.trim()] : []),
      ...nonEmptyStrings(entry.files),
    ];
  }

  function resolveDisabledRules(config, candidates) {
    const disabledRules = new Set(
      nonEmptyStrings(config.ignoreRules)
        .map(normalizeIgnoreRule)
        .filter(Boolean),
    );
    for (const entry of Array.isArray(config.ignoreValues) ? config.ignoreValues : []) {
      if (!entry || typeof entry !== 'object') continue;
      const rule = normalizeIgnoreRule(entry.rule);
      const value = normalizeIgnoreValue(entry.value);
      if (!rule || value !== '*') continue;
      const files = scopedFiles(entry);
      if (files.length > 0 && matchesScope(files, candidates)) disabledRules.add(rule);
    }
    return disabledRules;
  }

  function resolveDisabledValues(config, candidates) {
    const disabledValues = [];
    for (const entry of Array.isArray(config.ignoreValues) ? config.ignoreValues : []) {
      if (!entry || typeof entry !== 'object') continue;
      const rule = normalizeIgnoreRule(entry.rule);
      const value = normalizeIgnoreValue(entry.value);
      if (!rule || !value || value === '*') continue;
      const files = scopedFiles(entry);
      if (files.length > 0 && !matchesScope(files, candidates)) continue;
      disabledValues.push({ rule, value });
    }
    return disabledValues;
  }

  /**
   * Resolve the serialized project ignores for one page.
   *
   * @param {object} options
   * @param {object} options.ignores  window.__IMPECCABLE_PROJECT_IGNORES__,
   *   in whatever state it arrived: absent, null, or hand-edited into the
   *   wrong shape. Every read tolerates that and degrades to no filtering.
   * @param {string} options.pathname  location.pathname of the scanned page.
   * @returns {{ disabledRules: string[], disabledValues: Array<{rule: string, value: string}>, skipScan: boolean }}
   */
  function resolveDetectIgnores({ ignores, pathname } = {}) {
    const config = ignores && typeof ignores === 'object' ? ignores : {};
    const candidates = pageCandidates(pathname, config.roots, config.pageFiles);
    const ignoreFileGlobs = nonEmptyStrings(config.ignoreFiles);
    if (ignoreFileGlobs.length > 0 && matchesScope(ignoreFileGlobs, candidates)) {
      return { disabledRules: [], disabledValues: [], skipScan: true };
    }

    return {
      disabledRules: [...resolveDisabledRules(config, candidates)],
      disabledValues: resolveDisabledValues(config, candidates),
      skipScan: false,
    };
  }

  root.__IMPECCABLE_LIVE_IGNORES__ = {
    version: 1,
    resolveDetectIgnores,
  };
})(typeof window !== 'undefined' ? window : globalThis);
