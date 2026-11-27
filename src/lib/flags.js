/* Everything behind the login talks to the API. The deploy workflow sets VITE_ENABLE_APP=true and
   VITE_API_URL=https://api.nandivex.in; local dev enables it automatically and proxies /api to the API container.
   When it is false only the sign-in page is built. */
export const APP_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_APP === 'true';
