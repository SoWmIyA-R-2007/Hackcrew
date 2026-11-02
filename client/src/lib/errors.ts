import { isRouteErrorResponse } from 'react-router';
import { ApiError, NETWORK_ERROR } from './api';

export type ErrorKind =
  | 'not-found'
  | 'forbidden'
  | 'session'
  | 'offline'
  | 'unavailable'
  | 'rate-limited'
  | 'server'
  | 'update'
  | 'crash';

/** A failed page load after a deploy: the browser asked for a code file that no longer exists */
const isStaleChunk = (err: unknown) =>
  err instanceof Error &&
  /dynamically imported module|Importing a module script failed|error loading dynamically imported|ChunkLoadError/i.test(
    `${err.name} ${err.message}`
  );

function kindOfStatus(status: number): ErrorKind {
  if (status === NETWORK_ERROR) return 'offline';
  if (status === 401) return 'session';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 429) return 'rate-limited';
  if (status === 503) return 'unavailable';
  return 'server';
}

/** Which error screen fits an error thrown by the API, a route, or the code itself */
export function errorKindOf(err: unknown): ErrorKind {
  if (err instanceof ApiError) return kindOfStatus(err.status);
  if (isRouteErrorResponse(err)) return kindOfStatus(err.status);
  if (isStaleChunk(err)) return 'update';
  return 'crash';
}

/** The HTTP-style code shown large on the error screen */
export const ERROR_CODE: Record<ErrorKind, string> = {
  'not-found': '404',
  forbidden: '403',
  session: '401',
  offline: 'Offline',
  unavailable: '503',
  'rate-limited': '429',
  server: '500',
  update: 'New version',
  crash: 'Error',
};

export const ERROR_COPY: Record<ErrorKind, { title: string; message: string }> = {
  'not-found': {
    title: 'Page not found',
    message: 'The link may be wrong, or the page may have been moved or deleted.',
  },
  forbidden: {
    title: "You don't have access to this",
    message: 'It belongs to a team or project you are not on. Ask its owner to invite you.',
  },
  session: {
    title: 'Your session ended',
    message: 'For your security you were signed out. Sign in again to pick up where you left off.',
  },
  offline: {
    title: "Can't reach HackTrack",
    message: 'Check your internet connection. This page tries again by itself as soon as you are back online.',
  },
  unavailable: {
    title: 'HackTrack is temporarily unavailable',
    message: 'The server cannot reach its database right now. Your data is safe; try again in a minute.',
  },
  'rate-limited': {
    title: 'Too many requests',
    message: 'You did that a lot in a short time. Wait a minute, then try again.',
  },
  server: {
    title: 'Something went wrong on our side',
    message: 'The server ran into a problem. Try again; if it keeps happening, let the team know.',
  },
  update: {
    title: 'HackTrack has been updated',
    message: 'A newer version is available. Reload the page to get it.',
  },
  crash: {
    title: 'This page hit a problem',
    message: 'Something unexpected broke while showing this page. Reloading usually fixes it.',
  },
};
