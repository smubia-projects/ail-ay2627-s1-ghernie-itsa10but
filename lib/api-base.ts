/** The itsa10but API on Cloud Run (NEXT_PUBLIC_API_BASE, set on Vercel). Local dev: http://localhost:8080 with `npm run build:server && npm run start:server`. */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080").replace(/\/+$/, "");
