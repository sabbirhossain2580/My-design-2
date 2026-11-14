// netlify/functions/api.ts
import serverless from 'serverless-http';
import app from '../../server.ts';

const baseHandler = serverless(app);

export const handler = async (event: any, context: any) => {
  // Prevent Lambda from hanging on pooled idle PostgreSQL sockets
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  // Normalize path so Express /api/* routes match regardless of Netlify redirect rewriting
  const rawPath: string = event?.path || '/';
  let normalizedPath = rawPath;

  if (normalizedPath.startsWith('/.netlify/functions/api')) {
    const stripped = normalizedPath.slice('/.netlify/functions/api'.length);
    normalizedPath = stripped.startsWith('/api')
      ? stripped
      : `/api${stripped.startsWith('/') ? stripped : `/${stripped}`}`;
  } else if (!normalizedPath.startsWith('/api')) {
    normalizedPath = `/api${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
  }

  if (normalizedPath.length > 4 && normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath.slice(0, -1);
  }

  return baseHandler({ ...event, path: normalizedPath }, context);
};
