import { createBrowserRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import LandingPage from '../pages/LandingPage';
import EntriesPage from '../pages/EntriesPage';
import AppHomePage from '../pages/AppHomePage';
import RequireAuth from './RequireAuth';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/app',
    element: (
      <RequireAuth>
        <AppHomePage />
      </RequireAuth>
    ),
  },
  {
    path: '/app/entries',
    element: (
      <RequireAuth>
        <EntriesPage />
      </RequireAuth>
    ),
  },
  {
    path: '/',
    element: <LandingPage />,
  },
]);
