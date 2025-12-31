import { createBrowserRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import LandingPage from '../pages/LandingPage';
import EntriesPage from '../pages/EntriesPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/app',
    element: <LandingPage />,
  },
  {
    path: '/app/entries',
    element: <EntriesPage />,
  },
  {
    path: '/',
    element: <LandingPage />,
  },
]);
