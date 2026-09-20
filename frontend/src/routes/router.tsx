import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootLayout } from './RootLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AppLayout } from '../layout/AppLayout';
import { RegisterPage } from '../pages/RegisterPage';
import { LoginPage } from '../pages/LoginPage';
import { HomePage } from '../pages/HomePage';
import { AccountPage } from '../pages/AccountPage';
import { CatalogPage } from '../pages/CatalogPage';
import { PlayerDetailPage } from '../pages/PlayerDetailPage';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <Navigate to="/catalog" replace />,
      },
      {
        path: '/register',
        element: <RegisterPage />,
      },
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        element: <AppLayout />,
        children: [
          { path: '/catalog', element: <CatalogPage /> },
          { path: '/catalog/:id', element: <PlayerDetailPage /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/home', element: <HomePage /> },
              { path: '/account', element: <AccountPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
