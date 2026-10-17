import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { CatalogPage } from '../features/public/CatalogPage';
import { ContactPage } from '../features/public/ContactPage';
import { HomePage } from '../features/public/HomePage';
import { PrivacyPage } from '../features/public/PrivacyPage';
import { ServicesPage } from '../features/public/ServicesPage';
import { PublicLayout } from './layouts/PublicLayout';
import { RequireAuth } from './guards';
import { ErrorPage } from './pages/ErrorPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const routes: RouteObject[] = [
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
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      {
        // Loaded on demand: the wizard is not needed for browsing.
        path: 'order',
        lazy: async () => ({ Component: (await import('../features/order-wizard/OrderWizardPage')).OrderWizardPage }),
      },
      {
        path: 'order/confirmation/:orderId',
        lazy: async () => {
          const { ConfirmationPage } = await import('../features/order-wizard/ConfirmationPage');
          return {
            Component: () => (
              <RequireAuth role="CUSTOMER">
                <ConfirmationPage />
              </RequireAuth>
            ),
          };
        },
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
