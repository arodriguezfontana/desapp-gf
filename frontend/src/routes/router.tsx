import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootLayout } from './RootLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { PublicOnlyRoute } from '../components/PublicOnlyRoute';
import { AppLayout } from '../layout/AppLayout';
import { RegisterPage } from '../pages/RegisterPage';
import { LoginPage } from '../pages/LoginPage';
import { HomePage } from '../pages/HomePage';
import { AccountPage } from '../pages/AccountPage';
import { CatalogPage } from '../pages/CatalogPage';
import { PlayerDetailPage } from '../pages/PlayerDetailPage';
import { AdminPage } from '../pages/AdminPage';
import { PortfolioPage } from '../pages/PortfolioPage';
import { MyStrategiesPage } from '../pages/MyStrategiesPage';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <Navigate to="/home" replace />,
      },
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: '/register', element: <RegisterPage /> },
          { path: '/login', element: <LoginPage /> },
        ],
      },
      {
        element: <AppLayout />,
        children: [{ path: '/catalog', element: <CatalogPage /> }],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/home', element: <HomePage /> },
              { path: '/account', element: <AccountPage /> },
              { path: '/admin', element: <AdminPage /> },
              { path: '/portfolio', element: <PortfolioPage /> },
              { path: '/catalog/:id', element: <PlayerDetailPage /> },
              { path: '/my-strategies', element: <MyStrategiesPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
