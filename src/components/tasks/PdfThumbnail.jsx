import { useEffect, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&url';

GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfThumbnail({ file, name }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let documentTask;
    let renderTask;

    async function renderFirstPage() {
      const data = new Uint8Array(await file.arrayBuffer());
      if (!active) return;
      documentTask = getDocument({ data, useSystemFonts: true, maxImageSize: 25000000 });
      const document = await documentTask.promise;
      const page = await document.getPage(1);
      if (!active) return;
      const canvas = canvasRef.current;
      const original = page.getViewport({ scale: 1 });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const scale = Math.min(224 / original.width, 450 / original.height);
      const viewport = page.getViewport({ scale: scale * pixelRatio });
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      canvas.style.width = `${Math.ceil(viewport.width / pixelRatio)}px`;
      renderTask = page.render({ canvas, viewport });
      await renderTask.promise;
      renderTask = undefined;
      if (active) setReady(true);
    }

    function closeDocument() {
      const task = documentTask;
      documentTask = undefined;
      return task?.destroy().catch(() => {});
    }

    renderFirstPage().catch(() => { if (active) setFailed(true); }).finally(closeDocument);
    return () => {
      active = false;
      renderTask?.cancel();
      closeDocument();
    };
  }, [file]);

  return (
    <>
      {!ready && <span className="self-center text-xs font-semibold text-muted">{failed ? 'PDF' : 'Loading page…'}</span>}
      <canvas ref={canvasRef} role="img" aria-label={`First page of ${name}`} hidden={!ready} className="max-w-full" />
    </>
  );
}
