/**
 * Strict check for uploaded SVG logos (PROMPT.md §18.1).
 *
 * An SVG is a document, not just a picture: opened directly it can run scripts. Instead of
 * rewriting the file, anything that could be active or load something from elsewhere is
 * rejected, so the owner gets a clear error and the stored file is exactly what was uploaded.
 *
 * Rejected: scripts and other active/embedding elements, event handler attributes, links or
 * `url()` references that are not in-document fragments (`#id`), `javascript:` and similar
 * schemes, CSS `@import`, DOCTYPE/ENTITY declarations, processing instructions, and anything
 * that does not tokenize as plain XML markup.
 */

/** Element local names (lower-cased) that are never allowed. */
const FORBIDDEN_ELEMENTS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'frame',
  'frameset',
  'embed',
  'object',
  'applet',
  'audio',
  'video',
  'canvas',
  'handler',
  'listener',
  'a',
  'base',
  'link',
  'meta',
  // Animation can rewrite `href` to a script URL at runtime.
  'animate',
  'animatemotion',
  'animatetransform',
  'animatecolor',
  'set',
  'discard',
]);

const FORBIDDEN_TEXT: Array<[RegExp, string]> = [
  [/javascript\s*:/i, 'script URL'],
  [/vbscript\s*:/i, 'script URL'],
  [/@import/i, 'CSS @import'],
  [/expression\s*\(/i, 'CSS expression'],
  [/-moz-binding/i, 'CSS binding'],
  [/behavior\s*:/i, 'CSS behavior'],
];

const NAME = String.raw`[A-Za-z_][\w:.-]*`;
const ATTRIBUTE = String.raw`(${NAME})(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'<>=\x60]+))?`;
const TAG = new RegExp(String.raw`<(\/?)(${NAME})((?:\s+${ATTRIBUTE})*)\s*(\/?)>`, 'y');
const ATTRIBUTES = new RegExp(ATTRIBUTE, 'g');

const NAMED_ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** Resolves XML character and predefined entity references, as an SVG parser would. */
function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, ref: string) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    return NAMED_ENTITIES[ref.toLowerCase()] ?? match;
  });
}

function localName(name: string): string {
  return (name.split(':').pop() ?? name).toLowerCase();
}

/** Every `url(...)` must point inside the document (`url(#id)`). */
function hasExternalUrl(text: string): boolean {
  for (const match of text.matchAll(/url\s*\(\s*(['"]?)\s*([^)'"]*)/gi)) {
    if (!(match[2] ?? '').startsWith('#')) return true;
  }
  return false;
}

function checkAttribute(element: string, rawName: string, rawValue: string | undefined): string | null {
  const name = rawName.toLowerCase();
  const value = decodeEntities((rawValue ?? '').replace(/^["']|["']$/g, '')).trim();

  if (name.startsWith('on')) return `event handler "${rawName}" on <${element}>`;
  // Namespace declarations are identifiers, not fetched.
  if (name === 'xmlns' || name.startsWith('xmlns:')) return null;
  if (localName(name) === 'href' || name === 'src' || name === 'xml:base') {
    if (!value.startsWith('#')) return `external reference in "${rawName}" on <${element}>`;
  }
  if (hasExternalUrl(value)) return `external url() in "${rawName}" on <${element}>`;
  return null;
}

/** Returns a short reason when the SVG is unsafe or malformed, or `null` when it may be stored. */
export function findUnsafeSvgContent(svg: string): string | null {
  if (svg.includes('\u0000')) return 'binary content';
  const text = svg.replace(/^﻿/, '');

  if (/<!DOCTYPE|<!ENTITY|<!ATTLIST|<!ELEMENT/i.test(text)) return 'DOCTYPE or ENTITY declaration';
  const decoded = decodeEntities(text);
  for (const [pattern, reason] of FORBIDDEN_TEXT) {
    if (pattern.test(decoded)) return reason;
  }

  let rootSeen = false;
  let position = 0;
  while (position < text.length) {
    const next = text.indexOf('<', position);
    if (next === -1) break;
    const rest = text.slice(next);

    if (rest.startsWith('<!--')) {
      const end = text.indexOf('-->', next + 4);
      if (end === -1) return 'unterminated comment';
      position = end + 3;
      continue;
    }
    if (rest.startsWith('<![CDATA[')) {
      const end = text.indexOf(']]>', next + 9);
      if (end === -1) return 'unterminated CDATA section';
      const content = text.slice(next + 9, end);
      if (hasExternalUrl(content)) return 'external url() in CDATA';
      position = end + 3;
      continue;
    }
    if (rest.startsWith('<?')) {
      // Only the XML declaration, and only before the root element.
      const end = text.indexOf('?>', next + 2);
      if (end === -1 || rootSeen || !/^<\?xml\s/i.test(rest)) return 'processing instruction';
      position = end + 2;
      continue;
    }

    TAG.lastIndex = next;
    const tag = TAG.exec(text);
    if (!tag) return 'malformed markup';
    const [whole, closing, name = '', attributes = ''] = tag;
    const element = localName(name);

    if (!closing) {
      if (!rootSeen) {
        if (element !== 'svg') return 'root element is not <svg>';
        rootSeen = true;
      }
      if (FORBIDDEN_ELEMENTS.has(element)) return `<${element}> element`;
      for (const attribute of attributes.matchAll(ATTRIBUTES)) {
        const problem = checkAttribute(element, attribute[1] ?? '', attribute[2]);
        if (problem) return problem;
      }
    }
    position = next + whole.length;
  }

  if (!rootSeen) return 'no <svg> root element';
  // Text between tags may hold CSS inside <style>.
  if (hasExternalUrl(decoded.replace(/<!--[\s\S]*?-->/g, ''))) return 'external url()';
  return null;
}

/** Decodes the upload as strict UTF-8; returns null for invalid byte sequences. */
export function decodeSvg(buffer: Buffer): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return null;
  }
}
