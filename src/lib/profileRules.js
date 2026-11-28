/* Rules for the profile form. The API checks the same things (api/src/routes/profile.ts), so keep them in step.
   Every card is either left completely empty or filled in completely; Address line 2 is the only optional field.

   Messages that start with "Invalid" mean what was typed can never become correct by adding more characters
   (a mobile number starting with 5), so the form shows them straight away. The others, like "Enter all 10 digits",
   wait until the person leaves the field or presses Save. */

export const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const PLACE_RE = /^[\p{L}][\p{L} .'()-]{1,59}$/u;
const HOLDER_RE = /^[\p{L}][\p{L} .'-]{1,79}$/u;
const BANK_RE = /^[\p{L}\p{N}][\p{L}\p{N} &.'()-]{1,79}$/u;
const BRANCH_RE = /^[\p{L}\p{N}][\p{L}\p{N} &.,'()/-]{1,79}$/u;
const INDIAN_PINCODE = /^[1-9]\d{5}$/;
const OTHER_POSTCODE = /^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$/;

export const todayYmd = () => new Date().toISOString().slice(0, 10);

const filled = (v) => String(v ?? '').trim() !== '';
const REQUIRED = 'Required.';
const cardMessage = (title) => `Fill in every field in ${title}, or leave all of them empty.`;

/** Spaces and hyphens people type between digits are dropped before saving. */
export const normalizePhone = (raw) => String(raw).trim().replace(/[\s-]/g, '');

/** An Indian mobile number: 10 digits starting with 6, 7, 8 or 9, with an optional +91. Returns a message, or '' when fine. */
export function phoneError(raw) {
  let v = normalizePhone(raw);
  if (v.startsWith('+91')) v = v.slice(3);
  else if (v.startsWith('+')) return 'Invalid number. Only Indian (+91) numbers are supported.';
  if (!/^\d*$/.test(v)) return 'Invalid number. Use digits only.';
  if (!/^[6-9]/.test(v)) return 'Invalid number. Indian mobile numbers start with 6, 7, 8 or 9.';
  if (v.length < 10) return `Enter all 10 digits. You have entered ${v.length}.`;
  if (v.length > 10) return 'Too many digits. A mobile number has 10 digits.';
  if (/^(\d)\1{9}$/.test(v)) return 'Invalid number. Enter a real mobile number.';
  return '';
}

/** PAN: 5 letters, 4 digits, 1 letter (ABCDE1234F). Checks character by character so a wrong one shows at once. */
export function panError(raw) {
  const v = String(raw).trim().toUpperCase();
  for (let i = 0; i < v.length; i += 1) {
    const letter = i < 5 || i === 9;
    if (!(letter ? /[A-Z]/ : /\d/).test(v[i])) return `Invalid PAN. Character ${i + 1} must be a ${letter ? 'letter' : 'digit'} (format ABCDE1234F).`;
  }
  if (v.length < 10) return `A PAN has 10 characters. You have entered ${v.length}.`;
  return '';
}

/** IFSC: 4 letters, a zero, then 6 letters or digits (HDFC0001234). */
export function ifscError(raw) {
  const v = String(raw).trim().toUpperCase();
  for (let i = 0; i < v.length; i += 1) {
    if (i < 4 && !/[A-Z]/.test(v[i])) return `Invalid IFSC. Character ${i + 1} must be a letter (format HDFC0001234).`;
    if (i === 4 && v[i] !== '0') return 'Invalid IFSC. The 5th character must be the digit 0 (format HDFC0001234).';
    if (i > 4 && !/[A-Z0-9]/.test(v[i])) return `Invalid IFSC. Character ${i + 1} must be a letter or digit.`;
  }
  if (v.length < 11) return `An IFSC code has 11 characters. You have entered ${v.length}.`;
  return '';
}

function accountError(raw) {
  const v = String(raw).trim();
  if (!/^\d*$/.test(v)) return 'Invalid account number. Use digits only.';
  if (v.length < 9) return `An account number has 9 to 18 digits. You have entered ${v.length}.`;
  if (v.length > 18) return 'An account number has at most 18 digits.';
  return '';
}

/** A name or place: letters with spaces and a few marks. `what` is used in the message ("City"). */
function wordsError(raw, re, what, allowed) {
  const v = String(raw).trim();
  if (v.length > 0 && !re.test(v)) {
    if (v.length < 2) return `${what} is too short. Enter at least 2 characters.`;
    return `Invalid ${what.toLowerCase()}. Use ${allowed}.`;
  }
  return '';
}

function pincodeError(raw, india) {
  const v = String(raw).trim();
  if (india) {
    if (!/^\d*$/.test(v)) return 'Invalid pincode. Use digits only.';
    if (v.startsWith('0')) return 'Invalid pincode. Indian pincodes do not start with 0.';
    if (v.length < 6) return `Enter all 6 digits of the pincode. You have entered ${v.length}.`;
    return INDIAN_PINCODE.test(v) ? '' : 'Invalid pincode.';
  }
  return OTHER_POSTCODE.test(v) ? '' : 'Invalid postal code. Use 3 to 10 letters, digits, spaces or hyphens.';
}

function checkAddress(e, prefix, title, a) {
  const key = (k) => `${prefix}.${k}`;
  const required = ['line1', 'pincode', 'city', 'state', 'country'];
  if (['line1', 'line2', 'pincode', 'city', 'state'].some((k) => filled(a[k]))) {
    let missing = false;
    for (const k of required) if (!filled(a[k])) { e[key(k)] = REQUIRED; missing = true; }
    if (missing) e[`card.${prefix}`] = cardMessage(title);
  }
  const india = a.country === 'India';
  const line1 = a.line1.trim();
  if (line1 && !/[\p{L}\p{N}]/u.test(line1)) e[key('line1')] = 'Invalid address. Use letters or numbers.';
  else if (line1 && line1.length < 3) e[key('line1')] = 'Address line 1 is too short. Enter at least 3 characters.';
  const line2 = a.line2.trim();
  if (line2 && !/[\p{L}\p{N}]/u.test(line2)) e[key('line2')] = 'Invalid address. Use letters or numbers.';
  if (filled(a.pincode)) { const m = pincodeError(a.pincode, india); if (m) e[key('pincode')] = m; }
  const city = wordsError(a.city, PLACE_RE, 'City', 'letters and spaces only');
  if (city) e[key('city')] = city;
  const state = wordsError(a.state, PLACE_RE, 'State', 'letters and spaces only');
  if (state) e[key('state')] = state;
}

/**
 * Returns { fieldKey: message }. Field keys: dateOfBirth, phone, gender, bloodGroup, current.<field>, permanent.<field>,
 * pan, bankHolder, bankName, bankAccountNumber, bankIfsc, bankBranch. A card that is half filled also gets card.<name>.
 * `saved*` say a PAN or account number is already on file; `edit*` say the person chose to change it.
 */
export function validateProfile(f, { same, savedPan, savedAccount, editPan, editAccount }) {
  const e = {};

  // Personal
  const personal = ['dateOfBirth', 'gender', 'bloodGroup', 'phone'];
  if (personal.some((k) => filled(f[k]))) {
    let missing = false;
    for (const k of personal) if (!filled(f[k])) { e[k] = REQUIRED; missing = true; }
    if (missing) e['card.personal'] = cardMessage('Personal');
  }
  if (f.dateOfBirth) {
    if (f.dateOfBirth > todayYmd()) e.dateOfBirth = 'Date of birth cannot be in the future.';
    else if (f.dateOfBirth < '1900-01-01') e.dateOfBirth = 'Enter a valid date of birth.';
  }
  if (filled(f.phone)) { const m = phoneError(f.phone); if (m) e.phone = m; }

  // Addresses
  checkAddress(e, 'current', 'Current address', f.currentAddress);
  if (!same) checkAddress(e, 'permanent', 'Permanent address', f.permanentAddress);

  // PAN and bank details
  const hasPan = (savedPan && !editPan) || filled(f.pan);
  const hasAccount = (savedAccount && !editAccount) || filled(f.bankAccountNumber);
  const bankAny = hasPan || hasAccount || ['bankHolder', 'bankName', 'bankIfsc', 'bankBranch'].some((k) => filled(f[k]));
  if (bankAny) {
    let missing = false;
    if (!hasPan) { e.pan = REQUIRED; missing = true; }
    if (!hasAccount) { e.bankAccountNumber = REQUIRED; missing = true; }
    for (const k of ['bankHolder', 'bankName', 'bankIfsc', 'bankBranch']) if (!filled(f[k])) { e[k] = REQUIRED; missing = true; }
    if (missing) e['card.bank'] = cardMessage('PAN and bank details');
  }
  if (filled(f.pan)) { const m = panError(f.pan); if (m) e.pan = m; }
  const holder = wordsError(f.bankHolder, HOLDER_RE, 'Name', 'letters and spaces only');
  if (holder) e.bankHolder = holder;
  const bank = wordsError(f.bankName, BANK_RE, 'Bank name', 'letters, numbers and spaces only');
  if (bank) e.bankName = bank;
  if (filled(f.bankAccountNumber)) { const m = accountError(f.bankAccountNumber); if (m) e.bankAccountNumber = m; }
  if (filled(f.bankIfsc)) { const m = ifscError(f.bankIfsc); if (m) e.bankIfsc = m; }
  const branch = wordsError(f.bankBranch, BRANCH_RE, 'Branch', 'letters, numbers and spaces only');
  if (branch) e.bankBranch = branch;

  return e;
}
