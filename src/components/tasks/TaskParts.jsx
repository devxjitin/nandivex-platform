import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { fetchItemFile, fetchLinkPreview } from '../../lib/tasksApi.js';
import { ACCEPT, STATUS, fileProblem, fileType, fmtSize } from '../../lib/taskRules.js';
import Dialog from '../admin/Dialog.jsx';
import AttachmentPreviewDialog from './AttachmentPreview.jsx';

const PdfThumbnail = lazy(() => import('./PdfThumbnail.jsx'));
const itemGrid = 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-3';

const ico = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
export const TrashIcon = () => <svg {...ico}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>;
const FileIcon = () => <svg {...ico}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5" /></svg>;
const TextIcon = () => <svg {...ico}><path d="M4 6h16M4 10h16M4 14h16M4 18h10" /></svg>;
const LinkIcon = () => <svg {...ico}><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></svg>;

export function StatusBadge({ status, className = '' }) {
  const s = STATUS[status] || STATUS.pending;
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.badge} ${className}`}>{s.label}</span>;
}

/** Fetch a saved attachment only once for the thumbnail and preview. */
function useSavedFile(taskId, itemId) {
  const [state, setState] = useState({ blob: null, error: '' });
  const pending = useRef(null);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  function load() {
    if (state.blob || pending.current) return;
    setState({ blob: null, error: '' });
    pending.current = fetchItemFile(taskId, itemId).then((blob) => {
      if (!active.current) return;
      if (!blob) throw new Error('File not found.');
      setState({ blob, error: '' });
    }).catch((err) => {
      if (active.current) setState({ blob: null, error: err.message || 'Could not load the file.' });
    }).finally(() => { pending.current = null; });
  }
  return { ...state, load };
}

function FileView({ taskId, item }) {
  const { blob, error, load } = useSavedFile(taskId, item.id);
  const type = item.contentType;
  const isPdf = type === 'application/pdf';
  const hasThumbnail = isPdf || type.startsWith('image/');
  const [showPreview, setShowPreview] = useState(false);
  const closePreview = useCallback(() => setShowPreview(false), []);

  useEffect(() => { if (hasThumbnail) load(); }, [hasThumbnail]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2">
      <FileTile file={blob} name={item.fileName} size={item.size} type={type} onClick={() => {
        setShowPreview(true);
        load();
      }} />
      {showPreview && <AttachmentPreviewDialog file={blob} name={item.fileName} type={type} error={error} onClose={closePreview} />}
      {error && !showPreview && <p role="alert" className="text-[13px] text-red-600">{error}</p>}
    </div>
  );
}

function ImageThumbnail({ file, type, fallback }) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const url = URL.createObjectURL(file.type === type ? file : file.slice(0, file.size, type));
    setSrc(url);
    setFailed(false);
    return () => URL.revokeObjectURL(url);
  }, [file, type]);
  return src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} className="size-full object-contain" /> : fallback;
}

function PreviewTile({ label, detail, icon, actionLabel, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-label={actionLabel} aria-haspopup="dialog"
      className="block w-full overflow-hidden rounded-xl border border-line bg-surface text-left transition hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
      <span className="flex h-28 justify-center overflow-hidden bg-soft">{children}</span>
      <span className="flex items-center gap-2 border-t border-line px-2.5 py-2 text-xs text-muted">
        {icon}<span className="min-w-0 flex-1 truncate font-semibold text-ink" title={label}>{label}</span>
        {detail && <span className="flex-none">{detail}</span>}
      </span>
    </button>
  );
}

function FileTile({ file, name, size, type, onClick }) {
  const format = (name.includes('.') ? name.split('.').pop() : '').slice(0, 5).toUpperCase() || 'FILE';
  const formatLabel = <span className="self-center rounded-md bg-tint px-2.5 py-1 text-xs font-semibold text-accent-dark">{format}</span>;
  return (
    <PreviewTile label={name} detail={fmtSize(size)} icon={<FileIcon />} actionLabel={`Preview ${name}`} onClick={onClick}>
      {file && type === 'application/pdf'
        ? <Suspense fallback={formatLabel}><PdfThumbnail key={name} file={file} name={name} /></Suspense>
        : file && type.startsWith('image/') ? <ImageThumbnail file={file} type={type} fallback={formatLabel} /> : formatLabel}
    </PreviewTile>
  );
}

function TextPreview({ text }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const sample = text.trim().replace(/\s+/g, ' ');
  const excerpt = sample.length > 200 ? `${sample.slice(0, 199).trimEnd()}…` : sample;
  return (
    <>
      <PreviewTile label="Text" icon={<TextIcon />} actionLabel={`Preview text ${sample.slice(0, 64)}`} onClick={() => setOpen(true)}>
        <span className="w-full px-3 py-3">
          <span className="line-clamp-4 break-words text-sm leading-5 text-ink">{excerpt}</span>
        </span>
      </PreviewTile>
      {open && (
        <Dialog title="Text" onClose={close} wide="xl" portal>
          <p tabIndex={0} className="max-h-[65dvh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-soft px-4 py-3 text-[15px] leading-relaxed text-ink">{text}</p>
        </Dialog>
      )}
    </>
  );
}

function parseLink(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function LinkPreview({ url }) {
  const [open, setOpen] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const [failedImage, setFailedImage] = useState('');
  const close = useCallback(() => setOpen(false), []);
  const parsed = parseLink(url);
  const host = parsed?.host || 'Link';
  const path = parsed?.pathname;
  const canOpen = parsed?.protocol === 'https:' || parsed?.protocol === 'http:';
  const preview = metadata?.url === url ? metadata.preview : null;
  const title = preview?.title || host;
  const image = preview?.image && failedImage !== preview.image ? preview.image : '';
  const cover = image && preview.imageKind === 'cover';

  useEffect(() => {
    if (!canOpen) return;
    let active = true;
    fetchLinkPreview(url).then((result) => {
      if (active) setMetadata({ url, preview: result });
    }).catch(() => {});
    return () => { active = false; };
  }, [url, canOpen]);

  const handleImageError = () => setFailedImage(image);
  return (
    <>
      <PreviewTile label={cover ? title : host} icon={<LinkIcon />} actionLabel={`Preview link to ${host}`} onClick={() => setOpen(true)}>
        {cover ? (
          <img src={image} alt="" onError={handleImageError} className="size-full object-cover" />
        ) : (
          <span className="flex w-full min-w-0 flex-col justify-center gap-1.5 px-3">
            {image && <img src={image} alt="" onError={handleImageError} className="size-7 rounded-md object-contain" />}
            <span className="truncate text-sm font-semibold text-accent-dark">{title}</span>
            {preview?.description
              ? <span className="truncate text-xs text-muted">{preview.description}</span>
              : path && path !== '/' && <span className="truncate text-xs text-muted">{path}</span>}
          </span>
        )}
      </PreviewTile>
      {open && (
        <Dialog title={title} onClose={close} wide="xl" portal>
          <div className="space-y-4">
            {image && <img src={image} alt="" onError={handleImageError} className={cover ? 'max-h-56 w-full rounded-xl bg-soft object-contain' : 'size-10 rounded-lg object-contain'} />}
            {preview?.description && <p className="break-words text-sm leading-relaxed text-ink">{preview.description}</p>}
            <div className="rounded-xl border border-line bg-soft px-4 py-3">
              <p className="mb-1 text-xs font-semibold text-muted">Full URL</p>
              <p className="break-all text-sm leading-relaxed text-ink">{url}</p>
            </div>
            {canOpen && <a href={parsed.href} target="_blank" rel="noopener noreferrer" className="btn-solid inline-flex">Open link</a>}
          </div>
        </Dialog>
      )}
    </>
  );
}

function PickedFile({ file }) {
  const [showPreview, setShowPreview] = useState(false);
  const closePreview = useCallback(() => setShowPreview(false), []);
  const type = fileType(file);
  return (
    <>
      <FileTile file={file} name={file.name} size={file.size} type={type} onClick={() => setShowPreview(true)} />
      {showPreview && <AttachmentPreviewDialog file={file} name={file.name} type={type} onClose={closePreview} />}
    </>
  );
}

/** One saved item: text, a link, or a file. */
export function ItemView({ taskId, item, version }) {
  if (item.kind === 'text') return <TextPreview text={item.text} />;
  if (item.kind === 'link') return <LinkPreview url={item.url} />;
  return <FileView key={`${taskId}:${item.id}:${version ?? ''}:${item.fileRevision ?? 0}`} taskId={taskId} item={item} />;
}

/** A framed item with an optional Remove button inside it. */
export function ItemCard({ children, onRemove, onEdit, editLabel, removing }) {
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex-1 px-4 py-3.5">{children}</div>
      {(onEdit || onRemove) && (
        <div className="flex flex-wrap justify-end gap-1 border-t border-line bg-soft/40 px-3 py-1.5">
          {onEdit && <button type="button" onClick={onEdit} disabled={removing} className="rounded-full px-3 py-1 text-[13px] font-semibold text-accent transition hover:bg-tint disabled:opacity-40">{editLabel}</button>}
          {onRemove && <button type="button" onClick={onRemove} disabled={removing} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold text-red-600 transition hover:bg-red-500/10 disabled:opacity-40"><TrashIcon /> Remove</button>}
        </div>
      )}
    </li>
  );
}

/** Saved items of a task. `onRemove(item)` shows a Remove button on each. */
export function ItemList({ taskId, items, onRemove, onEdit, busyId, version }) {
  if (items.length === 0) return null;
  return (
    <ul className={itemGrid}>
      {items.map((i) => (
        <ItemCard key={i.id} onRemove={onRemove && (() => onRemove(i))} onEdit={onEdit && (() => onEdit(i))} editLabel={i.kind === 'file' ? 'Replace file' : 'Edit'} removing={busyId === i.id}>
          <ItemView taskId={taskId} item={i} version={version} />
        </ItemCard>
      ))}
    </ul>
  );
}

const TABS = [['text', 'Text'], ['link', 'Link'], ['file', 'File']];

/** Add a piece of text, a link or a file. `onAdd({ kind, text, url, file })` may be async; a thrown error is shown here. */
export function ItemAdder({ onAdd, disabled = false, hint, item }) {
  const [kind, setKind] = useState(item?.kind ?? 'text');
  const [text, setText] = useState(item?.text ?? '');
  const [url, setUrl] = useState(item?.url ?? '');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

  function pick(e) {
    const f = e.target.files?.[0] || null;
    const problem = f ? fileProblem(f) : '';
    setError(problem);
    setFile(problem ? null : f);
    if (problem) e.target.value = '';
  }

  async function add() {
    setError('');
    if (kind === 'text' && !text.trim()) return setError('Write something first.');
    if (kind === 'link' && !/^https?:\/\/\S+$/i.test(url.trim())) return setError('Enter a full link that starts with http:// or https://');
    if (kind === 'file' && !file) return setError('Choose a file first.');
    setBusy(true);
    try {
      await onAdd({ kind, text: text.trim(), url: url.trim(), file });
      setText(''); setUrl(''); setFile(null);
      if (fileInput.current) fileInput.current.value = '';
    } catch (err) {
      setError(err.message || 'Could not save the item.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-line bg-soft/30 p-4">
      {!item && <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="What to add">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={kind === key} onClick={() => { setKind(key); setError(''); }}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${kind === key ? 'bg-accent text-white' : 'text-muted hover:bg-tint hover:text-accent'}`}>{label}</button>
        ))}
      </div>}
      <div className={item ? undefined : 'mt-3'}>
        {kind === 'text' && <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000} placeholder="Write here…" aria-label="Text" className="field resize-y" />}
        {kind === 'link' && <input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} placeholder="https://" aria-label="Link" className="field" />}
        {kind === 'file' && (
          <div>
            <input ref={fileInput} type="file" accept={ACCEPT} onChange={pick} aria-label="File"
              className="block w-full cursor-pointer rounded-xl border border-line bg-surface text-sm text-muted file:mr-4 file:cursor-pointer file:border-0 file:bg-tint file:px-4 file:py-3 file:text-sm file:font-semibold file:text-accent-dark hover:file:bg-accent/15" />
            <p className="mt-1.5 text-[13px] text-muted">Image, audio, video, PDF, document or zip. Up to 25 MB.</p>
          </div>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-[13px] text-red-500">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-muted">{hint}</p>
        <button type="button" onClick={add} disabled={disabled || busy} className="btn-line !py-2 text-[13px]">{item ? (busy ? 'Saving…' : 'Save') : (busy ? 'Adding…' : 'Add')}</button>
      </div>
    </div>
  );
}

/** Items picked but not saved yet (the new-task form): text, link or the chosen file. */
export function PendingList({ items, onRemove }) {
  if (items.length === 0) return null;
  return (
    <ul className={itemGrid}>
      {items.map((i) => (
        <ItemCard key={i.key} onRemove={() => onRemove(i.key)}>
          {i.kind === 'file' ? <PickedFile file={i.file} /> : <ItemView item={i} />}
        </ItemCard>
      ))}
    </ul>
  );
}
