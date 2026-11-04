import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AdminForgotPasswordPage } from '../features/auth/AdminForgotPasswordPage';
import { AdminLoginPage } from '../features/auth/AdminLoginPage';
import { AdminResetPasswordPage } from '../features/auth/AdminResetPasswordPage';
import { CatalogPage } from '../features/public/CatalogPage';
import { ContactPage } from '../features/public/ContactPage';
import { HomePage } from '../features/public/HomePage';
import { PrivacyPage } from '../features/public/PrivacyPage';
import { ServicesPage } from '../features/public/ServicesPage';
import { PublicLayout } from './layouts/PublicLayout';
import { ErrorPage } from './pages/ErrorPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const routes: RouteObject[] = [
  {
    // The artist's sign-in pages: own dark screen without the public navigation (§18.3).
    path: 'admin',
    errorElement: <ErrorPage />,
    children: [
      // The dashboard itself follows in phase 9; until then /admin leads to the login.
      { index: true, element: <Navigate to="/admin/login" replace /> },
      { path: 'login', element: <AdminLoginPage /> },
      { path: 'forgot-password', element: <AdminForgotPasswordPage /> },
      { path: 'reset-password', element: <AdminResetPasswordPage /> },
    ],
  },
  {
    element: <PublicLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'catalog', element: <CatalogPage /> },
      { path: 'portfolio', element: <Navigate to="/catalog" replace /> },
      { path: 'services', element: <ServicesPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      {
        // Loaded on demand: the order form is not needed for browsing.
        path: 'order',
        lazy: async () => ({ Component: (await import('../features/order/OrderPage')).OrderPage }),
      },
      {
        path: 'order/sent',
        lazy: async () => ({ Component: (await import('../features/order/ConfirmationPage')).ConfirmationPage }),
      },
      {
        // The customer's order: private link `/track#<token>` (customers have no account).
        path: 'track',
        lazy: async () => ({ Component: (await import('../features/order/TrackPage')).TrackPage }),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
