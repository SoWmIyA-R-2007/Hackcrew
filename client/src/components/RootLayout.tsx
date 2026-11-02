import { Outlet, ScrollRestoration, useRouteError } from 'react-router';
import { LoadingBar } from './Loading';
import { ErrorScreen } from './ErrorScreen';
import { UpdateNotice } from './InstallApp';

/** Wraps every page: the loading bar along the top, and scroll restored when going back */
export function RootLayout() {
  return (
    <>
      <LoadingBar />
      <Outlet />
      <UpdateNotice />
      <ScrollRestoration />
    </>
  );
}

/** Any error a page throws or a loader reports, shown with the screen for its kind */
export function RouteError() {
  return <ErrorScreen error={useRouteError()} />;
}
