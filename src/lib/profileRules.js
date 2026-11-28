/* Rules for the profile form. The API checks the same things (api/src/routes/profile.ts), so keep them in step.
   Every card is either left completely empty or filled in completely; Address line 2 is the only optional field. */

export const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const PHONE_RE = /^(\+91[\s-]?)?[6-9]\d{9}$/;
const PLACE_RE = /^[\p{L}][\p{L} .'()-]{1,59}$/u;
const HOLDER_RE = /^[\p{L}][\p{L} .'-]{1,79}$/u;
const BANK_RE = /^[\p{L}\p{N}][\p{L}\p{N} &.'()-]{1,79}$/u;
const BRANCH_RE = /^[\p{L}\p{N}][\p{L}\p{N} &.,'()/-]{1,79}$/u;
const INDIAN_PINCODE = /^[1-9]\d{5}$/;
const OTHER_POSTCODE = /^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$/;
const PAN_RE = /^[A-Za-z]{5}\d{4}[A-Za-z]$/;
const IFSC_RE = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/;

export const todayYmd = () => new Date().toISOString().slice(0, 10);

const filled = (v) => String(v ?? '').trim() !== '';
const REQUIRED = 'Required.';

function cardMessage(title) {
  return `Fill in every field in ${title}, or leave all of them empty.`;
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
  if (line1 && (line1.length < 3 || !/[\p{L}\p{N}]/u.test(line1))) e[key('line1')] = 'Address line 1 is too short.';
  else if (line1.length > 120) e[key('line1')] = 'Keep this under 120 characters.';
  const line2 = a.line2.trim();
  if (line2 && !/[\p{L}\p{N}]/u.test(line2)) e[key('line2')] = 'Address line 2 needs letters or numbers.';
  else if (line2.length > 120) e[key('line2')] = 'Keep this under 120 characters.';
  const pin = a.pincode.trim();
  if (pin && !(india ? INDIAN_PINCODE : OTHER_POSTCODE).test(pin)) e[key('pincode')] = india ? 'Pincode must be 6 digits and cannot start with 0.' : 'Enter a valid postal code.';
  if (a.city.trim() && !PLACE_RE.test(a.city.trim())) e[key('city')] = 'City can only have letters and spaces.';
  if (a.state.trim() && !PLACE_RE.test(a.state.trim())) e[key('state')] = 'State can only have letters and spaces.';
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
  if (filled(f.phone) && !PHONE_RE.test(f.phone.trim())) e.phone = 'Enter a 10-digit mobile number.';

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
  if (filled(f.pan) && !PAN_RE.test(f.pan.trim())) e.pan = 'PAN looks like ABCDE1234F.';
  if (filled(f.bankHolder) && !HOLDER_RE.test(f.bankHolder.trim())) e.bankHolder = 'Account holder name can only have letters and spaces.';
  if (filled(f.bankName) && !BANK_RE.test(f.bankName.trim())) e.bankName = 'Enter a valid bank name.';
  if (filled(f.bankAccountNumber) && !/^\d{9,18}$/.test(f.bankAccountNumber.trim())) e.bankAccountNumber = 'Account number is 9 to 18 digits.';
  if (filled(f.bankIfsc) && !IFSC_RE.test(f.bankIfsc.trim())) e.bankIfsc = 'IFSC looks like HDFC0001234.';
  if (filled(f.bankBranch) && !BRANCH_RE.test(f.bankBranch.trim())) e.bankBranch = 'Enter a valid branch name.';

  return e;
}
