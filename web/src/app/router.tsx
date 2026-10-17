import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
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
    element: <PublicLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'catalog', element: <CatalogPage /> },
      { path: 'portfolio', element: <Navigate to="/catalog" replace /> },
      { path: 'services', element: <ServicesPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
