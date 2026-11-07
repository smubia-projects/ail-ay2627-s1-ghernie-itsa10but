/**
 * The one piece of `next/server` the reused route handlers need (`NextResponse.json`), so the API bundle doesn't pull in Next.
 * esbuild maps `next/server` here (see the build:server script).
 */
export const NextResponse = {
  json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
};
