/** What a complete profile has, worked out from the saved profile. */
export function checklist(p, hasPhoto) {
  const addressed = ['line1', 'city', 'state', 'pincode'].every((k) => (p.currentAddress[k] || '').trim());
  return [
    { label: 'Profile photo', done: hasPhoto },
    { label: 'Date of birth', done: !!p.dateOfBirth },
    { label: 'Mobile number', done: !!p.phone },
    { label: 'Current address', done: addressed },
    { label: 'PAN number', done: p.pan.saved },
    { label: 'Bank details', done: !!(p.bank.accountSaved && p.bank.ifsc && p.bank.holder) },
  ];
}

function Tick({ done }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={done ? 'text-emerald-600' : 'text-muted/50'}>
      {done ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <circle cx="12" cy="12" r="3" />}
    </svg>
  );
}

/** Shows how much of the profile is filled in. Renders nothing once every item is done. */
export default function ProfileProgress({ items }) {
  if (!items || items.length === 0) return null;
  const done = items.filter((i) => i.done).length;
  const percent = Math.round((done / items.length) * 100);
  if (percent >= 100) return null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
      <div>
        <h2 className="text-lg">Complete your profile</h2>
        <p className="mt-1 text-sm text-muted">{done} of {items.length} done</p>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completed">
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
      <ul className="mt-5 grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {items.map((i) => (
          <li key={i.label} className={`flex items-center gap-2 ${i.done ? 'text-ink' : 'text-muted'}`}>
            <Tick done={i.done} />
            {i.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
