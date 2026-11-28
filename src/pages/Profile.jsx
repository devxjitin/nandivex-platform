import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useBlocker } from 'react-router-dom';
import AdminLayout from '../components/admin/AdminLayout.jsx';
import Dialog from '../components/admin/Dialog.jsx';
import Avatar from '../components/Avatar.jsx';
import Checkbox from '../components/Checkbox.jsx';
import DatePicker from '../components/DatePicker.jsx';
import ProfileProgress, { checklist } from '../components/ProfileProgress.jsx';
import Select from '../components/Select.jsx';
import { COUNTRIES, INDIAN_STATES, lookupPincode } from '../lib/places.js';
import { BLOOD_GROUPS, GENDERS, normalizePhone, todayYmd, validateProfile } from '../lib/profileRules.js';
import { getProfile, removePhoto, resizeImage, saveProfile, uploadPhoto } from '../lib/profileApi.js';
import { useToast } from '../components/Toast.jsx';
import { useSession } from '../lib/session.jsx';

const ADDRESS_FIELDS = [
  ['line1', 'Address line 1', 'sm:col-span-2'],
  ['line2', 'Address line 2', 'sm:col-span-2'],
  ['pincode', 'Pincode', ''],
  ['city', 'City', ''],
  ['state', 'State', ''],
  ['country', 'Country', ''],
];

const sameAddress = (a, b) => ['line1', 'line2', 'city', 'state', 'pincode', 'country'].every((k) => (a[k] || '').trim() === (b[k] || '').trim());
const isEmptyAddress = (a) => ['line1', 'line2', 'city', 'state', 'pincode'].every((k) => !(a[k] || '').trim());

function Card({ title, error, children }) {
  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card">
      <h2 className="border-b border-line px-6 py-4 text-base sm:px-8">{title}</h2>
      <div className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
        {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-600 sm:col-span-2">{error}</p>}
        {children}
      </div>
    </section>
  );
}

function Field({ id, label, error, className = '', children }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      {children}
      {error && <p className="mt-1.5 text-[13px] text-red-500">{error}</p>}
    </div>
  );
}

/** A saved secret (PAN, account number) shows only its last four characters until the person chooses to change it. */
function SecretField({ id, label, saved, last4, editing, onEdit, onCancel, value, onChange, placeholder, error, upper, onBlur }) {
  if (saved && !editing) {
    return (
      <Field id={id} label={label}>
        <div className="flex items-center gap-3">
          <input id={id} readOnly value={`••••••${last4}`} className="field bg-soft/60 font-mono" aria-label={`${label}, saved`} />
          <button type="button" onClick={onEdit} className="flex-none text-[13px] font-semibold text-accent hover:text-accent-dark">Change</button>
        </div>
      </Field>
    );
  }
  return (
    <Field id={id} label={label} error={error}>
      <div className="flex items-center gap-3">
        <input
          id={id} value={value} onChange={(e) => onChange(upper ? e.target.value.toUpperCase() : e.target.value)} autoComplete="off" placeholder={placeholder} onBlur={onBlur}
          aria-invalid={!!error} className={`field font-mono ${error ? 'field-error' : ''}`}
        />
        {saved && <button type="button" onClick={onCancel} className="flex-none text-[13px] font-semibold text-muted hover:text-accent">Cancel</button>}
      </div>
    </Field>
  );
}

// A saved value that is not in the list (older free-text entries) is kept as an option so it is not lost.
const withCurrent = (list, current) => (current && !list.includes(current) ? [current, ...list] : list);

function AddressFields({ prefix, value, onChange, onTouch, errors }) {
  const [lookup, setLookup] = useState(''); // '', 'busy' or 'missing'
  const ctl = useRef(null);
  useEffect(() => () => ctl.current?.abort(), []);
  const isIndia = value.country === 'India';

  // Typing a full 6-digit Indian pincode fills in the city and state.
  function onPincode(raw) {
    const pin = isIndia ? raw.replace(/\D/g, '').slice(0, 6) : raw.replace(/[^A-Za-z0-9 -]/g, '').slice(0, 10);
    onChange('pincode', pin);
    ctl.current?.abort();
    if (pin.length !== 6 || !isIndia) { setLookup(''); return; }
    const c = new AbortController();
    ctl.current = c;
    setLookup('busy');
    lookupPincode(pin, c.signal).then((r) => {
      if (c.signal.aborted) return;
      if (!r) { setLookup('missing'); return; }
      if (r.city) onChange('city', r.city);
      if (r.state) onChange('state', r.state);
      setLookup('');
    });
  }

  const LIMITS = { line1: 120, line2: 120, city: 60, state: 60 };
  return ADDRESS_FIELDS.map(([key, label, span]) => {
    const id = `${prefix}-${key}`;
    const err = errors[`${prefix}.${key}`];
    let control;
    if (key === 'country') {
      control = (
        <Select
          id={id} value={value.country} placeholder="Select country" invalid={!!err}
          onChange={(v) => { onChange('country', v); if ((v === 'India') !== isIndia) { onChange('state', ''); onChange('pincode', ''); } }}
          options={withCurrent(COUNTRIES, value.country).map((c) => ({ value: c, label: c }))}
        />
      );
    } else if (key === 'state' && isIndia) {
      control = (
        <Select
          id={id} value={value.state} placeholder="Select state" clearLabel="Not specified" invalid={!!err} onChange={(v) => onChange('state', v)}
          options={withCurrent(INDIAN_STATES, value.state).map((st) => ({ value: st, label: st }))}
        />
      );
    } else if (key === 'pincode') {
      control = (
        <input
          id={id} value={value.pincode} onChange={(e) => onPincode(e.target.value)} onBlur={() => onTouch(`${prefix}.pincode`)} autoComplete="postal-code" inputMode={isIndia ? 'numeric' : 'text'}
          maxLength={isIndia ? 6 : 10} placeholder={isIndia ? '6-digit pincode' : 'Postal code'} aria-invalid={!!err} className={`field ${err ? 'field-error' : ''}`}
        />
      );
    } else {
      control = (
        <input
          id={id} value={value[key]} onChange={(e) => onChange(key, e.target.value)} onBlur={() => onTouch(`${prefix}.${key}`)} autoComplete="off" maxLength={LIMITS[key]}
          aria-invalid={!!err} className={`field ${err ? 'field-error' : ''}`}
        />
      );
    }
    return (
      <Field key={key} id={id} label={label} className={span} error={err}>
        {control}
        {key === 'pincode' && !err && lookup && (
          <p className="mt-1.5 text-[13px] text-muted">{lookup === 'busy' ? 'Finding city and state…' : 'Could not find this pincode. Enter city and state yourself.'}</p>
        )}
      </Field>
    );
  });
}

export default function Profile() {
  const { user, setUser } = useSession();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null); // the profile as last loaded or saved, for the completion card
  const [meta, setMeta] = useState(null); // read-only parts: email, role, createdAt, saved PAN / account
  const [same, setSame] = useState(true);
  const [editPan, setEditPan] = useState(false);
  const [editAccount, setEditAccount] = useState(false);
  const [touched, setTouched] = useState({}); // fields the person has left, so their mistakes can be shown
  const [attempted, setAttempted] = useState(false); // after the first Save click, mistakes are shown as they are fixed
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const fileRef = useRef(null);
  // The slot in the top bar that holds this page's buttons (it exists once the layout has rendered).
  const [actionsSlot, setActionsSlot] = useState(null);
  useEffect(() => { setActionsSlot(document.getElementById('shell-actions')); }, []);
  // What the form looked like when it was loaded or last saved, to tell whether anything has changed.
  const [snapshot, setSnapshot] = useState('');

  function apply(p) {
    setSaved(p);
    setMeta({ email: p.email, role: p.role, createdAt: p.createdAt, pan: p.pan, accountSaved: p.bank.accountSaved, accountLast4: p.bank.accountLast4 });
    const next = {
      dateOfBirth: p.dateOfBirth, gender: p.gender, bloodGroup: p.bloodGroup, phone: p.phone,
      emergencyName: p.emergencyName, emergencyRelation: p.emergencyRelation, emergencyPhone: p.emergencyPhone,
      currentAddress: { ...p.currentAddress, country: p.currentAddress.country || 'India' },
      permanentAddress: { ...p.permanentAddress, country: p.permanentAddress.country || 'India' },
      pan: '', bankAccountNumber: '',
      bankHolder: p.bank.holder, bankName: p.bank.name, bankIfsc: p.bank.ifsc, bankBranch: p.bank.branch,
    };
    const nextSame = isEmptyAddress(p.permanentAddress) || sameAddress(p.currentAddress, p.permanentAddress);
    setForm(next);
    setSame(nextSame);
    setSnapshot(JSON.stringify({ form: next, same: nextSame }));
    setEditPan(false);
    setEditAccount(false);
    setTouched({});
    setAttempted(false);
  }

  useEffect(() => {
    getProfile().then(apply).catch((err) => setLoadError(err.message));
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setValue = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const setAddr = (which) => (key, value) => { setForm((f) => ({ ...f, [which]: { ...f[which], [key]: value } })); };
  const touch = (key) => setTouched((t) => (t[key] ? t : { ...t, [key]: true }));

  const check = useCallback((f) => validateProfile(f, { same, savedPan: !!meta?.pan.saved, savedAccount: !!meta?.accountSaved, editPan, editAccount }), [same, meta, editPan, editAccount]);
  const allErrors = useMemo(() => (form ? check(form) : {}), [form, check]);
  // A mistake shows once the field was left or Save was pressed. An entry that can never be right, like a mobile
  // number starting with 5 ("Invalid …"), shows as soon as it is typed. Half-filled card banners wait for Save.
  const errors = useMemo(() => {
    const out = {};
    for (const [k, msg] of Object.entries(allErrors)) {
      if (attempted || (!k.startsWith('card.') && (touched[k] || msg.startsWith('Invalid')))) out[k] = msg;
    }
    return out;
  }, [allErrors, attempted, touched]);
  const cls = (key, extra = '') => `field ${extra} ${errors[key] ? 'field-error' : ''}`;

  async function onSave(e) {
    e.preventDefault();
    const found = check(form);
    setAttempted(true);
    if (Object.keys(found).length) {
      // Take the person to the first thing that needs fixing.
      setTimeout(() => {
        const first = document.querySelector('#profile-form [aria-invalid="true"]') || document.querySelector('#profile-form [role="alert"]');
        first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        first?.focus?.({ preventScroll: true });
      }, 0);
      return;
    }
    setBusy(true);
    try {
      const body = {
        ...form,
        phone: normalizePhone(form.phone),
        permanentAddress: same ? form.currentAddress : form.permanentAddress,
        pan: editPan ? form.pan.trim() : '',
        bankAccountNumber: editAccount ? form.bankAccountNumber.trim() : '',
      };
      apply(await saveProfile(body));
      toast.success('Profile saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onPickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError('');
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setPhotoError('Choose a JPG, PNG or WebP picture.'); return; }
    if (file.size > 10 * 1024 * 1024) { setPhotoError('That picture is too large. Choose one under 10 MB.'); return; }
    setPhotoBusy(true);
    try {
      setUser(await uploadPhoto(await resizeImage(file)));
    } catch (err) {
      setPhotoError(err.message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onRemovePhoto() {
    setPhotoError('');
    setPhotoBusy(true);
    try {
      setUser(await removePhoto());
    } catch (err) {
      setPhotoError(err.message);
    } finally {
      setPhotoBusy(false);
    }
  }

  const progress = useMemo(() => (saved ? checklist(saved, !!user?.photoVersion) : null), [saved, user?.photoVersion]);

  const dirty = !!form && snapshot !== '' && JSON.stringify({ form, same }) !== snapshot;

  // Leaving this page (a link, the back button) with unsaved changes asks first.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  const blockerRef = useRef(blocker);
  blockerRef.current = blocker;
  const stay = useCallback(() => blockerRef.current.reset?.(), []);
  const leave = useCallback(() => blockerRef.current.proceed?.(), []);

  // Closing or reloading the tab with unsaved changes shows the browser's own warning.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Puts every field back to how it was when the page loaded or was last saved.
  function discard() {
    const snap = JSON.parse(snapshot);
    setForm(snap.form);
    setSame(snap.same);
    setEditPan(false);
    setEditAccount(false);
    setTouched({});
    setAttempted(false);
  }

  const memberSince = meta ? new Date(meta.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  return (
    <AdminLayout>
      {/* Save, Discard and the saved note live in the top bar, so they are always in reach on a long page. */}
      {form && actionsSlot && createPortal(
        <>
          {dirty && !busy && <button type="button" onClick={discard} className="text-[13px] font-semibold text-muted transition hover:text-accent">Discard</button>}
          <button type="submit" form="profile-form" disabled={!dirty || busy} className="btn-solid !px-5 !py-2 text-[13px]">{busy ? 'Saving…' : 'Save changes'}</button>
        </>,
        actionsSlot,
      )}

      {loadError && <p role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-600">{loadError}</p>}

      {form && meta && (
        <div className="space-y-6">
          <ProfileProgress items={progress} />

          {/* Picture and who this is */}
          <section className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 shadow-card sm:flex-row sm:items-center sm:p-8">
            <Avatar user={user} className="grid h-24 w-24 flex-none place-items-center overflow-hidden rounded-full bg-accent font-display text-3xl font-bold text-white" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl">{user?.name}</h2>
              <p className="mt-1 truncate text-sm text-muted">{meta.email}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-tint px-3 py-1 text-xs font-semibold text-accent-dark">{meta.role}</span>
                <span className="text-xs text-muted">Member since {memberSince}</span>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <div className="flex gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={photoBusy} className="btn-line !py-2.5">
                  {photoBusy ? 'Please wait…' : user?.photoVersion ? 'Change photo' : 'Upload photo'}
                </button>
                {user?.photoVersion && !photoBusy && <button type="button" onClick={onRemovePhoto} className="btn-line !py-2.5">Remove</button>}
              </div>
              <Link to="/change-password" className="text-[13px] font-semibold text-accent hover:underline">Change password</Link>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onPickPhoto} className="hidden" aria-label="Choose a profile picture" />
              {photoError && <p role="alert" className="text-[13px] text-red-500">{photoError}</p>}
            </div>
          </section>

          <form id="profile-form" onSubmit={onSave} noValidate className="space-y-6">
            <Card title="Personal" error={errors['card.personal']}>
              <Field id="pf-name" label="Full name"><input id="pf-name" readOnly value={user?.name || ''} className="field bg-soft/60" /></Field>
              <Field id="pf-email" label="Email"><input id="pf-email" readOnly value={meta.email} className="field bg-soft/60" /></Field>
              <Field id="pf-dob" label="Date of birth" error={errors.dateOfBirth}>
                <DatePicker id="pf-dob" value={form.dateOfBirth} max={todayYmd()} placeholder="Select date" invalid={!!errors.dateOfBirth} onChange={setValue('dateOfBirth')} />
              </Field>
              <Field id="pf-phone" label="Mobile number" error={errors.phone}>
                <input
                  id="pf-phone" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/[^\d+\s-]/g, '') }))}
                  autoComplete="tel" placeholder="9876543210" maxLength={14} onBlur={() => touch('phone')} aria-invalid={!!errors.phone} className={cls('phone')}
                />
              </Field>
              <Field id="pf-gender" label="Gender" error={errors.gender}>
                <Select id="pf-gender" value={form.gender} invalid={!!errors.gender} onChange={setValue('gender')} placeholder="Select gender" clearLabel="Not specified" options={GENDERS.map((g) => ({ value: g, label: g }))} />
              </Field>
              <Field id="pf-blood" label="Blood group" error={errors.bloodGroup}>
                <Select id="pf-blood" value={form.bloodGroup} invalid={!!errors.bloodGroup} onChange={setValue('bloodGroup')} placeholder="Select blood group" clearLabel="Not specified" options={BLOOD_GROUPS.map((g) => ({ value: g, label: g }))} />
              </Field>
            </Card>

            <Card title="Current address" error={errors['card.current']}>
              <AddressFields prefix="current" value={form.currentAddress} onChange={setAddr('currentAddress')} onTouch={touch} errors={errors} />
            </Card>

            <Card title="Permanent address" error={errors['card.permanent']}>
              <Checkbox checked={same} onChange={(e) => { setSame(e.target.checked); }} className="sm:col-span-2">Same as current address</Checkbox>
              {!same && <AddressFields prefix="permanent" value={form.permanentAddress} onChange={setAddr('permanentAddress')} onTouch={touch} errors={errors} />}
            </Card>

            <Card title="PAN and bank details" error={errors['card.bank']}>
              <SecretField
                id="pf-pan" label="PAN number" saved={meta.pan.saved} last4={meta.pan.last4} editing={editPan} placeholder="ABCDE1234F" upper
                value={form.pan} error={errors.pan} onBlur={() => touch('pan')}
                onChange={(v) => setForm((f) => ({ ...f, pan: v.replace(/[^A-Za-z0-9]/g, '').slice(0, 10) }))}
                onEdit={() => setEditPan(true)} onCancel={() => { setEditPan(false); setForm((f) => ({ ...f, pan: '' })); }}
              />
              <div className="hidden sm:block" />
              <Field id="pf-bank-holder" label="Account holder name" error={errors.bankHolder}>
                <input id="pf-bank-holder" value={form.bankHolder} onChange={set('bankHolder')} autoComplete="off" maxLength={80} onBlur={() => touch('bankHolder')} aria-invalid={!!errors.bankHolder} className={cls('bankHolder')} />
              </Field>
              <Field id="pf-bank-name" label="Bank name" error={errors.bankName}>
                <input id="pf-bank-name" value={form.bankName} onChange={set('bankName')} autoComplete="off" maxLength={80} onBlur={() => touch('bankName')} aria-invalid={!!errors.bankName} className={cls('bankName')} />
              </Field>
              <SecretField
                id="pf-bank-account" label="Account number" saved={meta.accountSaved} last4={meta.accountLast4} editing={editAccount} placeholder="Account number"
                value={form.bankAccountNumber} error={errors.bankAccountNumber} onBlur={() => touch('bankAccountNumber')}
                onChange={(v) => setForm((f) => ({ ...f, bankAccountNumber: v.replace(/\D/g, '').slice(0, 18) }))}
                onEdit={() => setEditAccount(true)} onCancel={() => { setEditAccount(false); setForm((f) => ({ ...f, bankAccountNumber: '' })); }}
              />
              <Field id="pf-bank-ifsc" label="IFSC code" error={errors.bankIfsc}>
                <input
                  id="pf-bank-ifsc" value={form.bankIfsc} onChange={(e) => setForm((f) => ({ ...f, bankIfsc: e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 11) }))}
                  autoComplete="off" placeholder="HDFC0001234" maxLength={11} onBlur={() => touch('bankIfsc')} aria-invalid={!!errors.bankIfsc} className={cls('bankIfsc', 'font-mono')}
                />
              </Field>
              <Field id="pf-bank-branch" label="Branch" error={errors.bankBranch}>
                <input id="pf-bank-branch" value={form.bankBranch} onChange={set('bankBranch')} autoComplete="off" maxLength={80} onBlur={() => touch('bankBranch')} aria-invalid={!!errors.bankBranch} className={cls('bankBranch')} />
              </Field>
            </Card>
          </form>
        </div>
      )}

      {blocker.state === 'blocked' && (
        <Dialog title="Discard changes?" description="You have unsaved changes. If you leave now, they will be lost." onClose={stay}>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={stay} className="btn-line">Cancel</button>
            <button type="button" onClick={leave} className="btn border-red-600 bg-red-600 text-white hover:bg-red-700">Discard changes</button>
          </div>
        </Dialog>
      )}
    </AdminLayout>
  );
}
