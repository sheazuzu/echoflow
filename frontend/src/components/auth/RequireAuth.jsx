import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { buildLanguagePath } from '../../i18n/utils.js';
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function RequireAuth({ children, requireAdmin = false }) {
  const auth = useAuth();
  const location = useLocation();
  const { lang = 'zh' } = useParams();

  if (!auth.isReady) {
    return null;
  }

  if (!auth.isAuthenticated) {
    return <Navigate to={buildLanguagePath(lang, '/login')} replace state={{ from: location }} />;
  }

  if (requireAdmin && String(auth.user?.role || '').toLowerCase() !== 'admin') {
    return <Navigate to={buildLanguagePath(lang, '/')} replace />;
  }

  return children;
}