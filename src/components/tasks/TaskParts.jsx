import { useEffect, useRef, useState } from 'react';
import { fetchItemFile } from '../../lib/tasksApi.js';
import { ACCEPT, STATUS, fileProblem, fmtSize } from '../../lib/taskRules.js';

const ico = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
export const TrashIcon = () => <svg {...ico}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>;
const PlayIcon = () => <svg {...ico} fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
const DownloadIcon = () => <svg {...ico}><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>;
const FileIcon = () => <svg {...ico}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5" /></svg>;
const LinkIcon = () => <svg {...ico}><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></svg>;

export function StatusBadge({ status, className = '' }) {
  const s = STATUS[status] || STATUS.pending;
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.badge} ${className}`}>{s.label}</span>;
}

/** The bytes of a saved file, fetched with the session cookie and shown from an object URL. */
function useFileUrl(taskId, itemId) {
  const [state, setState] = useState({ url: '', loading: false, error: '' });
  const urlRef = useRef('');
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  async function load() {
    if (urlRef.current) return urlRef.current;
    setState({ url: '', loading: true, error: '' });
    try {
      const blob = await fetchItemFile(taskId, itemId);
      if (!blob) throw new Error('File not found.');
      urlRef.current = URL.createObjectURL(blob);
      setState({ url: urlRef.current, loading: false, error: '' });
      return urlRef.current;
    } catch (err) {
      setState({ url: '', loading: false, error: err.message || 'Could not load the file.' });
      return '';
    }
  }
  return { ...state, load };
}

function FileView({ taskId, item }) {
  const { url, loading, error, load } = useFileUrl(taskId, item.id);
  const type = item.contentType;
  const isImage = type.startsWith('image/');
  const isAv = type.startsWith('audio/') || type.startsWith('video/');
  const isPdf = type === 'application/pdf';

  // Pictures are small enough to show straight away; audio and video load when someone presses play.
  useEffect(() => { if (isImage) load(); }, [isImage]); // eslint-disable-line react-hooks/exhaustive-deps

  async function open(download) {
    const u = await load();
    if (!u) return;
    const a = document.createElement('a');
    a.href = u;
    a.rel = 'noreferrer';
    if (download || !isPdf) a.download = item.fileName; else a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-[13px] text-muted"><FileIcon /><span className="min-w-0 truncate font-semibold text-ink">{item.fileName}</span><span className="flex-none">{fmtSize(item.size)}</span></p>
      {isImage && (url ? <img src={url} alt={item.fileName} className="max-h-72 rounded-xl border border-line object-contain" /> : !error && <div className="h-24 animate-pulse rounded-xl bg-soft" />)}
      {isAv && url && (type.startsWith('video/')
        ? <video src={url} controls autoPlay className="max-h-80 w-full rounded-xl bg-night" />
        : <audio src={url} controls autoPlay className="w-full" />)}
      {isAv && !url && (
        <button type="button" onClick={load} disabled={loading} className="btn-line !py-2 text-[13px]"><PlayIcon /> {loading ? 'Loading…' : `Play ${type.startsWith('video/') ? 'video' : 'audio'}`}</button>
      )}
      {!isImage && !isAv && (
        <div className="flex flex-wrap gap-2">
          {isPdf && <button type="button" onClick={() => open(false)} disabled={loading} className="btn-line !py-2 text-[13px]">{loading ? 'Loading…' : 'Open PDF'}</button>}
          <button type="button" onClick={() => open(true)} disabled={loading} className="btn-line !py-2 text-[13px]"><DownloadIcon /> Download</button>
        </div>
      )}
      {error && <p role="alert" className="text-[13px] text-red-600">{error}</p>}
    </div>
  );
}

/** One saved item: text, a link, or a file. */
export function ItemView({ taskId, item }) {
  if (item.kind === 'text') return <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{item.text}</p>;
  if (item.kind === 'link') {
    return (
      <a href={item.url} target="_blank" rel="noreferrer noopener" className="inline-flex max-w-full items-center gap-2 break-all text-[15px] font-semibold text-accent hover:underline">
        <LinkIcon /><span className="min-w-0">{item.url}</span>
      </a>
    );
  }
  return <FileView taskId={taskId} item={item} />;
}

/** A framed item with an optional Remove button inside it. */
export function ItemCard({ children, onRemove, removing }) {
  return (
    <li className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="px-4 py-3.5">{children}</div>
      {onRemove && (
        <div className="flex justify-end border-t border-line bg-soft/40 px-3 py-1.5">
          <button type="button" onClick={onRemove} disabled={removing} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold text-red-600 transition hover:bg-red-500/10 disabled:opacity-40"><TrashIcon /> Remove</button>
        </div>
      )}
    </li>
  );
}

/** Saved items of a task. `onRemove(item)` shows a Remove button on each. */
export function ItemList({ taskId, items, onRemove, busyId }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <ItemCard key={i.id} onRemove={onRemove ? () => onRemove(i) : undefined} removing={busyId === i.id}>
          <ItemView taskId={taskId} item={i} />
        </ItemCard>
      ))}
    </ul>
  );
}

const TABS = [['text', 'Text'], ['link', 'Link'], ['file', 'File']];

/** Add a piece of text, a link or a file. `onAdd({ kind, text, url, file })` may be async; a thrown error is shown here. */
export function ItemAdder({ onAdd, disabled = false, hint }) {
  const [kind, setKind] = useState('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
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
      setError(err.message || 'Could not add that.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-line bg-soft/30 p-4">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="What to add">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={kind === key} onClick={() => { setKind(key); setError(''); }}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${kind === key ? 'bg-accent text-white' : 'text-muted hover:bg-tint hover:text-accent'}`}>{label}</button>
        ))}
      </div>
      <div className="mt-3">
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
        <button type="button" onClick={add} disabled={disabled || busy} className="btn-line !py-2 text-[13px]">{busy ? 'Adding…' : 'Add'}</button>
      </div>
    </div>
  );
}

/** Items picked but not saved yet (the new-task form): text, link or the chosen file. */
export function PendingList({ items, onRemove }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <ItemCard key={i.key} onRemove={() => onRemove(i.key)}>
          {i.kind === 'text' && <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{i.text}</p>}
          {i.kind === 'link' && <p className="flex items-center gap-2 break-all text-[15px] font-semibold text-accent"><LinkIcon />{i.url}</p>}
          {i.kind === 'file' && <p className="flex items-center gap-2 text-[13px] text-muted"><FileIcon /><span className="min-w-0 truncate font-semibold text-ink">{i.file.name}</span><span className="flex-none">{fmtSize(i.file.size)}</span></p>}
        </ItemCard>
      ))}
    </ul>
  );
}
