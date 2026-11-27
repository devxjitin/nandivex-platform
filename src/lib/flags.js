/* Everything behind the login runs against the local API for now, so it is built only for local dev
   (or when VITE_ENABLE_APP=true). In the deployed site this is false and only the sign-in page is served. */
export const APP_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_APP === 'true';
