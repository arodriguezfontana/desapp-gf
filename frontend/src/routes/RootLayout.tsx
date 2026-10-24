import { Outlet } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationsProvider } from '../contexts/NotificationsContext';

export function RootLayout() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <Outlet />
      </NotificationsProvider>
    </AuthProvider>
  );
}

