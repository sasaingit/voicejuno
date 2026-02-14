import { createBrowserRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import LandingPage from '../pages/LandingPage';
import EntriesPage from '../pages/EntriesPage';
import AppHomePage from '../pages/AppHomePage';
import RequireAuth from './RequireAuth';
import { ROUTES } from './routes.constants';

export const router = createBrowserRouter([
  {
    path: ROUTES.login,
    element: <LoginPage />,
  },
  {
    path: ROUTES.appHome,
    element: (
      <RequireAuth>
        <AppHomePage />
      </RequireAuth>
    ),
  },
  {
    path: ROUTES.entries,
    element: (
      <RequireAuth>
        <EntriesPage />
      </RequireAuth>
    ),
  },
  {
    path: ROUTES.landing,
    element: <LandingPage />,
  },
]);
