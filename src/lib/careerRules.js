/* Rules for a Careers role. The API checks the same things (api/src/routes/careers.ts), so keep them in step. */

export const KINDS = ['Career', 'Internship'];
// Stored values stay 'Career' / 'Internship' (API + website use them); the portal shows 'Job'.
export const KIND_LABEL = { Career: 'Job', Internship: 'Internship' };
export const STATUSES = [
  { value: 'open', label: 'Open: hiring now' },
  { value: 'upcoming', label: 'Coming soon' },
  { value: 'hidden', label: 'Hidden: not on the website' },
];
export const STATUS_LABEL = { open: 'Open', upcoming: 'Coming soon', hidden: 'Hidden' };

export const emptyRole = () => ({
  kind: 'Career', status: 'upcoming', title: '', blurb: '', skills: [],
  department: '', location: '', type: '', experience: '', overview: '', responsibilities: [], requirements: [],
});

const tooLong = (max) => `Keep this under ${max} characters. You have ${'{n}'}.`;
const over = (v, max) => (v.trim().length > max ? tooLong(max).replace('{n}', String(v.trim().length)) : '');

/** Returns { field: message }. Keys: title, blurb, skills, department, location, type, experience, overview, responsibilities, requirements. */
export function validateRole(r) {
  const e = {};
  const title = r.title.trim();
  if (title.length < 2) e.title = title ? 'The title is too short. Enter at least 2 characters.' : 'Enter the role title.';
  else if (title.length > 80) e.title = over(title, 80);

  const blurb = r.blurb.trim();
  if (blurb.length < 10) e.blurb = `Add a short description of at least 10 characters. You have ${blurb.length}.`;
  else if (blurb.length > 300) e.blurb = over(blurb, 300);

  const skills = r.skills.map((s) => s.trim()).filter(Boolean);
  if (skills.length > 12) e.skills = 'At most 12 skills.';
  else if (skills.some((s) => s.length > 40)) e.skills = 'Keep each skill under 40 characters.';

  for (const [key, max] of [['department', 60], ['location', 60], ['type', 40], ['experience', 40]]) {
    if (r[key].trim().length > max) e[key] = over(r[key], max);
  }
  if (r.overview.trim().length > 2000) e.overview = over(r.overview, 2000);
  for (const key of ['responsibilities', 'requirements']) {
    const list = r[key].map((s) => s.trim()).filter(Boolean);
    if (list.length > 15) e[key] = 'At most 15 items.';
    else if (list.some((s) => s.length > 300)) e[key] = 'Keep each item under 300 characters.';
  }

  // A role that is open needs everything the page prints for it.
  if (r.status === 'open') {
    if (!r.department.trim()) e.department = 'An open role needs a department.';
    if (!r.location.trim()) e.location = 'An open role needs a location.';
    if (!r.type.trim()) e.type = 'An open role needs a type, like Full-time.';
    if (!r.experience.trim()) e.experience = 'An open role needs the experience level.';
    if (r.overview.trim().length < 20) e.overview = `An open role needs an overview of at least 20 characters. You have ${r.overview.trim().length}.`;
    if (!r.responsibilities.some((s) => s.trim())) e.responsibilities = 'Add at least one responsibility.';
    if (!r.requirements.some((s) => s.trim())) e.requirements = 'Add at least one requirement.';
  }
  return e;
}

/** What is sent to the API: text trimmed, empty list items dropped. */
export function cleanRole(r) {
  const list = (xs) => xs.map((s) => s.trim()).filter(Boolean);
  return {
    kind: r.kind, status: r.status, title: r.title.trim(), blurb: r.blurb.trim(), skills: list(r.skills),
    department: r.department.trim(), location: r.location.trim(), type: r.type.trim(), experience: r.experience.trim(),
    overview: r.overview.trim(), responsibilities: list(r.responsibilities), requirements: list(r.requirements),
  };
}
