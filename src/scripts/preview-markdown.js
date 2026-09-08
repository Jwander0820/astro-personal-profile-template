import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { toHast } from 'mdast-util-to-hast';
import { toHtml } from 'hast-util-to-html';
import GithubSlugger from 'github-slugger';
import { enforceContentSafety, isSafeMarkdownUrl } from '../../scripts/content-safety.mjs';

function keepUnsafeLinksReadable(node, source) {
  if (['link', 'image', 'definition'].includes(node.type) && !isSafeMarkdownUrl(node.url)) {
    const value = source.slice(node.position.start.offset, node.position.end.offset);
    Object.keys(node).forEach((key) => delete node[key]);
    Object.assign(node, { type: 'text', value });
    return;
  }
  node.children?.forEach((child) => keepUnsafeLinksReadable(child, source));
}

function headingText(node) {
  return node.type === 'text' ? node.value : (node.children || []).map(headingText).join('');
}

function addHeadingIds(node, slugger) {
  if (node.type === 'element' && /^h[1-6]$/.test(node.tagName) && !('id' in node.properties)) {
    // Formal Astro heading IDs use rendered text, which excludes image alt.
    node.properties.id = slugger.slug(headingText(node));
  }
  node.children?.forEach((child) => addHeadingIds(child, slugger));
}

export function renderPreviewMarkdown(source) {
  const text = String(source || '');
  const tree = fromMarkdown(text, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
  keepUnsafeLinksReadable(tree, text);
  enforceContentSafety(tree);
  // Standard MDAST conversion provides the same footnotes, return links and
  // escaping as the formal document without enabling raw HTML.
  const htmlTree = toHast(tree);
  addHeadingIds(htmlTree, new GithubSlugger());
  return toHtml(htmlTree, { characterReferences: { useNamedReferences: true } });
}

export function markdownFragment(source) {
  const template = document.createElement('template');
  template.innerHTML = renderPreviewMarkdown(source);
  return template.content;
}
