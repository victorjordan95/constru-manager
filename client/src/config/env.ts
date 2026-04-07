// All VITE_ prefixed vars are injected at build time by Vite — never use process.env here
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error('VITE_API_BASE_URL is not defined. Add it to your .env file.');
}

export const config = {
  apiBaseUrl: apiBaseUrl as string,
} as const;
