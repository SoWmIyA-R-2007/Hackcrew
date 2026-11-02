import { StrictMode, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, redirect } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { api, ApiError, safeNextPath } from '@/lib/api';
import { AppLoading } from '@/components/Loading';
import { RootLayout, RouteError } from '@/components/RootLayout';
import './index.css';

/** Whether the visitor has a session. Only "signed out" counts as no: a server that is down is shown as an error */
async function isSignedIn() {
  try {
    await api.me();
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return false;
    throw err;
  }
}

// Pages that need an account send signed-out visitors to /login (and back afterwards)
const requireAuth = async ({ request }: { request: Request }) => {
  if (!(await isSignedIn())) {
    const url = new URL(request.url);
    throw redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`);
  }
  return null;
};

// /login skips ahead when already signed in; if the server cannot be reached the form still shows
const redirectIfSignedIn = async ({ request }: { request: Request }) => {
  const next = safeNextPath(new URL(request.url).searchParams.get('next'));
  if (await isSignedIn().catch(() => false)) throw redirect(next ?? '/dashboard');
  return null;
};

// Each page's code is downloaded when it is first opened, so the app starts faster
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default });

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <AppLoading />,
    children: [
      { path: '/', loader: () => redirect('/dashboard') },
      { path: '/login', lazy: page(() => import('@/pages/LoginPage')), loader: redirectIfSignedIn },
      { path: '/dashboard', lazy: page(() => import('@/pages/DashboardPage')), loader: requireAuth },
      { path: '/dashboard/hackathons/:id', lazy: page(() => import('@/pages/HackathonPage')), loader: requireAuth },
      { path: '/projects', lazy: page(() => import('@/pages/ProjectsPage')), loader: requireAuth },
      { path: '/projects/:id', lazy: page(() => import('@/pages/ProjectPage')), loader: requireAuth },
      { path: '/profile', lazy: page(() => import('@/pages/ProfilePage')), loader: requireAuth },
      { path: '/tasks', lazy: page(() => import('@/pages/TasksPage')), loader: requireAuth },
      { path: '/stats', lazy: page(() => import('@/pages/StatsPage')), loader: requireAuth },
      { path: '/friends', lazy: page(() => import('@/pages/FriendsPage')), loader: requireAuth },
      // Reached from emails, so they work whether or not the person is signed in
      { path: '/verify-email', lazy: page(() => import('@/pages/VerifyEmailPage')) },
      { path: '/forgot-password', lazy: page(() => import('@/pages/ForgotPasswordPage')) },
      { path: '/reset-password', lazy: page(() => import('@/pages/ResetPasswordPage')) },
      { path: '/invite/:token', lazy: page(() => import('@/pages/InvitePage')) },
      // Public profiles can be read by anyone with the link
      { path: '/u/:handle', lazy: page(() => import('@/pages/PublicProfilePage')) },
      { path: '*', lazy: page(() => import('@/pages/NotFoundPage')) },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
