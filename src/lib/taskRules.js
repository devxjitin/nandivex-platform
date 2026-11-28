/* Shared bits for the Tasks pages. Keep the file types and size in step with api/src/routes/tasks.ts. */

export const MAX_FILE_MB = 25;

export const STATUS = {
  pending: { label: 'To do', badge: 'bg-soft text-muted' },
  submitted: { label: 'Under review', badge: 'bg-amber-500/10 text-amber-700' },
  rejected: { label: 'Needs rework', badge: 'bg-red-500/10 text-red-600' },
  approved: { label: 'Approved', badge: 'bg-emerald-500/10 text-emerald-700' },
  // Not stored: a task still not handed in (or sent back) after its due date. See statusOf.
  missed: { label: 'Missed', badge: 'bg-red-500/10 text-red-600' },
};

const BY_EXTENSION = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', ogv: 'video/ogg',
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', zip: 'application/zip',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
const ALLOWED = new Set(Object.values(BY_EXTENSION).concat(['audio/x-m4a', 'audio/x-wav']));

export const ACCEPT = Object.keys(BY_EXTENSION).map((e) => `.${e}`).join(',');

/** The type to send for a picked file: its own when allowed, else guessed from the extension. null when not allowed. */
export function fileType(file) {
  const own = (file.type || '').toLowerCase();
  if (ALLOWED.has(own)) return own;
  return BY_EXTENSION[(file.name.split('.').pop() || '').toLowerCase()] || null;
}

/** An error message for a picked file, or '' when it is fine. */
export function fileProblem(file) {
  if (!fileType(file)) return 'That file type is not supported. Use an image, audio, video, PDF, text, Office document or zip file.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `That file is too large. The limit is ${MAX_FILE_MB} MB.`;
  return '';
}

export function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDateTime = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const todayYmd = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };

/** Past its due date and still not handed in or approved. */
export const isOverdue = (task) => !!task.dueDate && task.dueDate < todayYmd() && (task.status === 'pending' || task.status === 'rejected');
export const today = todayYmd;

/** What to show in lists and counts: the task's status, or 'missed' once it is overdue. */
export const statusOf = (task) => (isOverdue(task) ? 'missed' : task.status);
