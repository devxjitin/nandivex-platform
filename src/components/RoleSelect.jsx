import { useEffect, useState } from 'react';
import { listRoles } from '../lib/employeesApi.js';
import Select from './Select.jsx';

const OTHER = '__other__';
export const roleNameOk = (s) => /^[\p{L}\p{N} &/.+()-]{2,40}$/u.test(String(s).trim().replace(/\s+/g, ' '));

/** Pick one of the roles used so far, or choose "Other…" and type a new name. */
export default function RoleSelect({ id, value, onChange, invalid }) {
  const [saved, setSaved] = useState([]);
  const [custom, setCustom] = useState(false);
  // If the list cannot load, a role can still be typed through "Other".
  useEffect(() => { listRoles().then(setSaved).catch(() => {}); }, []);

  const options = saved.includes(value) || !value ? saved : [value, ...saved];
  return (
    <div className="space-y-2">
      <Select
        id={id} value={custom ? OTHER : value} placeholder="Select a role" invalid={invalid && !custom}
        onChange={(v) => { if (v === OTHER) { setCustom(true); onChange(''); } else { setCustom(false); onChange(v); } }}
        options={[...options.map((r) => ({ value: r, label: r })), { value: OTHER, label: 'Other…' }]}
      />
      {custom && (
        <input
          aria-label="New role name" value={value} onChange={(e) => onChange(e.target.value)} autoFocus autoComplete="off"
          placeholder="e.g. Marketing Lead" aria-invalid={invalid || undefined} className={`field ${invalid ? 'field-error' : ''}`}
        />
      )}
    </div>
  );
}
