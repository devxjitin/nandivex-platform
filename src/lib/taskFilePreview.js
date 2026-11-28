import { unzipSync } from 'fflate';

const MAX_TEXT = 12000;
const MAX_PART_BYTES = 1024 * 1024;
const childrenNamed = (node, name) => Array.from(node.getElementsByTagNameNS('*', name));
const runs = (node) => childrenNamed(node, 't').map((part) => part.textContent).join('');
const paragraphs = (node) => childrenNamed(node, 'p').slice(0, 80).map(runs).filter(Boolean).join('\n');

function readXml(bytes) {
  const xml = new TextDecoder().decode(bytes);
  if (xml.includes('<!DOCTYPE')) throw new Error('Unsupported document XML.');
  return new DOMParser().parseFromString(xml, 'application/xml');
}

/** Read a small text sample or the ZIP directory without expanding unrelated attachments. */
export async function readFilePreview(file, type) {
  if (type === 'text/plain' || type === 'text/csv') {
    return (await file.slice(0, MAX_TEXT).text()).trim();
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (type === 'application/zip') {
    const entries = [];
    let count = 0;
    unzipSync(bytes, { filter: ({ name }) => {
      if (!name.endsWith('/')) {
        count += 1;
        if (entries.length < 40) entries.push(name.slice(0, 240));
      }
      return false;
    } });
    if (count > entries.length) entries.push(`… and ${count - entries.length} more`);
    return entries.join('\n').slice(0, MAX_TEXT);
  }

  const parts = unzipSync(bytes, {
    filter: ({ name, size, originalSize }) => size <= MAX_PART_BYTES && originalSize <= MAX_PART_BYTES && (
      name === 'word/document.xml' || name === 'xl/sharedStrings.xml' || name === 'xl/worksheets/sheet1.xml' ||
      /^ppt\/slides\/slide[1-3]\.xml$/.test(name)
    ),
  });
  if (parts['word/document.xml']) return paragraphs(readXml(parts['word/document.xml'])).slice(0, MAX_TEXT);

  const worksheet = parts['xl/worksheets/sheet1.xml'];
  if (worksheet) {
    const shared = parts['xl/sharedStrings.xml'] ? childrenNamed(readXml(parts['xl/sharedStrings.xml']), 'si') : [];
    return childrenNamed(readXml(worksheet), 'row').slice(0, 12).map((row) =>
      childrenNamed(row, 'c').slice(0, 10).map((cell) => {
        const value = childrenNamed(cell, 'v')[0]?.textContent ?? '';
        const type = cell.getAttribute('t');
        if (type === 's') return shared[Number(value)] ? runs(shared[Number(value)]) : '';
        if (type === 'inlineStr') return runs(cell);
        return value;
      }).join('\t')
    ).join('\n').slice(0, MAX_TEXT).trim();
  }

  return Object.keys(parts).filter((name) => name.startsWith('ppt/slides/')).sort()
    .map((name) => paragraphs(readXml(parts[name]))).filter(Boolean).join('\n\n').slice(0, MAX_TEXT);
}
