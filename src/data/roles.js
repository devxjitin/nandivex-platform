/* Roles are not a fixed list. They come from the API: an admin picks one that was used before or types a
   new name when adding someone, and it is saved for next time. Only the names below carry extra rights,
   and the API enforces them too. */
const key = (role) => String(role || '').trim().toLowerCase();

/** May add, reset and remove employees. */
export const isManagerRole = (role) => ['founder', 'co-founder', 'admin'].includes(key(role));

/** Highlighted in the employee list. */
export const isLeadership = (role) => ['founder', 'co-founder'].includes(key(role));
