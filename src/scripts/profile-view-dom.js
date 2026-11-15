const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

// Browser counterpart of viewToHtml in scripts/profile-view.mjs: the same view
// tree becomes DOM nodes. Text and attributes are never parsed as markup; only
// `raw` (built-in icon bodies) goes through the HTML parser.
export function viewToDom(view, namespace) {
  if (Array.isArray(view)) {
    const fragment = document.createDocumentFragment();
    view.forEach((child) => fragment.append(viewToDom(child, namespace)));
    return fragment;
  }
  if (view === null || view === undefined || view === false || view === '') return document.createDocumentFragment();
  if (typeof view === 'string' || typeof view === 'number') return document.createTextNode(String(view));
  if ('dom' in view) return view.dom ?? document.createDocumentFragment();
  if ('slot' in view) return document.createDocumentFragment();
  if ('raw' in view) {
    const template = document.createElement('template');
    if (namespace !== SVG_NAMESPACE) {
      template.innerHTML = view.raw;
      return template.content;
    }
    template.innerHTML = `<svg xmlns="${SVG_NAMESPACE}">${view.raw}</svg>`;
    const fragment = document.createDocumentFragment();
    fragment.append(...template.content.firstElementChild.childNodes);
    return fragment;
  }
  const elementNamespace = view.tag === 'svg' ? SVG_NAMESPACE : namespace;
  const element = elementNamespace
    ? document.createElementNS(elementNamespace, view.tag)
    : document.createElement(view.tag);
  for (const [name, value] of Object.entries(view.attrs)) {
    if (value === undefined || value === null || value === false) continue;
    element.setAttribute(name, value === true ? '' : String(value));
  }
  view.children.forEach((child) => element.append(viewToDom(child, elementNamespace)));
  return element;
}
