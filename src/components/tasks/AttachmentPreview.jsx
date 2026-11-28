import { useEffect, useState } from 'react';
import Dialog from '../admin/Dialog.jsx';

const supportsTextPreview = (type) => type === 'text/plain' || type === 'text/csv' || type === 'application/zip' ||
  type.startsWith('application/vnd.openxmlformats-officedocument.');

async function prepare(file, type) {
  if (type === 'application/pdf') {
    const signature = await file.slice(0, 5).text();
    if (signature !== '%PDF-') return {};
  }
  if (type === 'application/pdf' || /^(image|audio|video)\//.test(type)) {
    return { url: URL.createObjectURL(file.type === type ? file : file.slice(0, file.size, type)) };
  }
  if (supportsTextPreview(type)) {
    const { readFilePreview } = await import('../../lib/taskFilePreview.js');
    return { text: await readFilePreview(file, type) };
  }
  return {};
}

function AttachmentPreview({ file, name, type }) {
  const [preview, setPreview] = useState(null);
  const [failed, setFailed] = useState(null);
  useEffect(() => {
    let active = true;
    let objectUrl;
    prepare(file, type).then((result) => {
      objectUrl = result.url;
      if (active) setPreview({ file, ...result });
      else if (objectUrl) URL.revokeObjectURL(objectUrl);
    }).catch(() => { if (active) setPreview({ file }); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, type]);

  const unavailable = <p className="text-sm text-muted">Preview is unavailable for this file.</p>;
  if (preview?.file !== file) return <p role="status" className="text-[13px] text-muted">Preparing preview…</p>;
  if (failed === preview) return unavailable;
  if (preview.text) {
    const label = type === 'application/zip' ? 'Archive contents' : 'Content preview';
    return (
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted">{label}</p>
        <pre tabIndex={0} aria-label={label} className="max-h-[65dvh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-soft p-3 text-sm text-ink">{preview.text}</pre>
      </div>
    );
  }

  const { url } = preview;
  if (!url) return unavailable;
  const onError = () => setFailed(preview);
  if (type.startsWith('image/')) return <img src={url} alt={name} onError={onError} className="mx-auto max-h-[65dvh] rounded-xl border border-line object-contain" />;
  if (type.startsWith('audio/')) return <audio src={url} aria-label={name} onError={onError} controls preload="metadata" className="w-full" />;
  if (type.startsWith('video/')) return <video src={url} aria-label={name} onError={onError} controls preload="metadata" className="max-h-[65dvh] w-full rounded-xl bg-night" />;
  return navigator.pdfViewerEnabled === false ? unavailable : (
    <iframe src={url} title={`Preview of ${name}`} className="h-[65dvh] w-full rounded-xl border border-line" />
  );
}

export default function AttachmentPreviewDialog({ file, name, type, error, onClose }) {
  const [downloadUrl, setDownloadUrl] = useState('');

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <Dialog title={name} onClose={onClose} wide="2xl" portal>
      {downloadUrl && (
        <div className="mb-3 flex justify-end">
          <a href={downloadUrl} download={name} aria-label={`Download ${name}`} className="btn-line !py-2 text-[13px]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4v11m-5-4 5 5 5-5M5 20h14" />
            </svg>
            Download
          </a>
        </div>
      )}
      {file ? <AttachmentPreview file={file} name={name} type={type} /> : error
        ? <p role="alert" className="text-sm text-red-600">{error}</p>
        : <p role="status" className="text-sm text-muted">Loading preview…</p>}
    </Dialog>
  );
}
