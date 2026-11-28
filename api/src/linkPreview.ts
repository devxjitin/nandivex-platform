import { Resolver } from 'node:dns/promises';
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import { isIP } from 'node:net';
import { Parser } from 'htmlparser2';
import ipaddr from 'ipaddr.js';

const resolver = new Resolver({ timeout: 1500, tries: 1 });
const PAGE_TYPES = new Set(['text/html', 'application/xhtml+xml']);
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon']);
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const MAX_PREVIEWS = 48;
const MAX_ACTIVE = 16;

interface Preview {
  title: string;
  description: string;
  image: string;
  imageKind: 'cover' | 'icon' | null;
}

function publicWebUrl(url: URL) {
  return (url.protocol === 'https:' || url.protocol === 'http:') && !url.port && !url.username && !url.password;
}

function isPublicAddress(address: string) {
  const ip = ipaddr.parse(address);
  if (ip.range() !== 'unicast') return false;
  return ip instanceof ipaddr.IPv4 || ip.match(ipaddr.IPv6.parse('2000::'), 3);
}

async function resolveAddress(hostname: string) {
  const literal = hostname.replace(/^\[|\]$/g, '');
  if (isIP(literal)) return isPublicAddress(literal) ? literal : null;
  const records = await Promise.allSettled([resolver.resolve4(hostname), resolver.resolve6(hostname)]);
  const addresses = records.flatMap((record) => record.status === 'fulfilled' ? record.value : []);
  return addresses.length && addresses.every(isPublicAddress) ? addresses[0] : null;
}

type RemoteFile = { url: URL; type: string; body: Buffer };
type RemoteResponse = RemoteFile | { location: string } | null;

async function readRemote(start: URL, types: Set<string>, limit: number, signal: AbortSignal): Promise<RemoteFile | null> {
  let url = start;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    if (signal.aborted || !publicWebUrl(url) || url.href.length > 2048) return null;
    const address = await resolveAddress(url.hostname);
    if (!address || signal.aborted) return null;

    // Use the validated address for the connection while keeping the original host for HTTP and TLS.
    const get = url.protocol === 'https:' ? httpsGet : httpGet;
    const result = await new Promise<RemoteResponse>((resolve) => {
      const request = get(url, {
        agent: false,
        signal,
        family: isIP(address),
        lookup: (_host, _options, callback) => callback(null, address, isIP(address)),
        headers: { Accept: [...types].join(', '), 'Accept-Encoding': 'identity', 'User-Agent': 'NandiVex Link Preview' },
      }, (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        const type = String(response.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
        response.on('error', () => resolve(null));
        if (REDIRECTS.has(status) && location) {
          resolve({ location });
          response.destroy();
          return;
        }
        if (status !== 200 || !types.has(type)) {
          resolve(null);
          response.destroy();
          return;
        }
        let remaining = limit;
        const chunks: Buffer[] = [];
        const finish = () => resolve({ url, type, body: Buffer.concat(chunks) });
        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk.subarray(0, remaining));
          remaining -= chunk.length;
          if (remaining <= 0) {
            if (types === PAGE_TYPES) finish();
            else resolve(null);
            response.destroy();
          }
        });
        response.on('end', finish);
      });
      request.on('error', () => resolve(null));
    });
    if (!result || !('location' in result)) return result;
    url = new URL(result.location, url);
  }
  return null;
}

function pageMetadata(html: string) {
  const meta = new Map<string, string>();
  let title = '';
  let icon = '';
  let inTitle = false;
  const parser = new Parser({
    onopentag(tag, attrs) {
      if (tag === 'body') parser.pause();
      if (tag === 'meta') {
        const key = (attrs.property || attrs.name || '').toLowerCase();
        if (key && attrs.content && !meta.has(key)) meta.set(key, attrs.content);
      }
      if (tag === 'link' && !icon && (attrs.rel || '').toLowerCase().split(/\s+/).includes('icon')) icon = attrs.href || '';
      if (tag === 'title') inTitle = true;
    },
    ontext(value) { if (inTitle) title += value; },
    onclosetag(tag) { if (tag === 'title') inTitle = false; },
  });
  parser.end(html);
  const clean = (value: string, length: number) => value.replace(/\s+/g, ' ').trim().slice(0, length);
  return {
    title: clean(meta.get('og:title') || meta.get('twitter:title') || title, 160),
    description: clean(meta.get('og:description') || meta.get('twitter:description') || meta.get('description') || '', 400),
    cover: meta.get('og:image:secure_url') || meta.get('og:image') || meta.get('twitter:image') || meta.get('twitter:image:src'),
    icon,
  };
}

async function imageData(source: string | undefined, base: URL, signal: AbortSignal) {
  if (!source) return '';
  try {
    const asset = await readRemote(new URL(source, base), IMAGE_TYPES, 512 * 1024, signal);
    return asset?.body.length ? `data:${asset.type};base64,${asset.body.toString('base64')}` : '';
  } catch {
    return '';
  }
}

async function loadPreview(url: URL): Promise<Preview | null> {
  const page = await readRemote(url, PAGE_TYPES, 256 * 1024, AbortSignal.timeout(4000));
  if (!page) return null;
  const { title, description, cover, icon } = pageMetadata(page.body.toString('utf8'));
  const signal = AbortSignal.timeout(3000);
  const image = await imageData(cover, page.url, signal);
  if (image) return { title, description, image, imageKind: 'cover' };
  const favicon = await imageData(icon || '/favicon.ico', page.url, signal);
  return { title, description, image: favicon, imageKind: favicon ? 'icon' : null };
}

// Bound the size and lifetime of cached image data and share pending requests for the same URL.
const cached = new Map<string, { expires: number; preview: Preview | null }>();
const pending = new Map<string, Promise<Preview | null>>();

export async function getLinkPreview(value: string) {
  try {
    const url = new URL(value);
    if (!publicWebUrl(url)) return null;
    url.hash = '';
    const key = url.href;
    const previous = cached.get(key);
    if (previous && previous.expires > Date.now()) return previous.preview;
    const existing = pending.get(key);
    if (existing) return existing;
    if (pending.size >= MAX_ACTIVE) return null;

    const request = loadPreview(url).catch(() => null).then((preview) => {
      cached.delete(key);
      cached.set(key, { preview, expires: Date.now() + (preview ? 600_000 : 60_000) });
      if (cached.size > MAX_PREVIEWS) cached.delete(cached.keys().next().value!);
      return preview;
    }).finally(() => { pending.delete(key); });
    pending.set(key, request);
    return request;
  } catch {
    return null;
  }
}
