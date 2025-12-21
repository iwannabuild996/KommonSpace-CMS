import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/UsersPage';
import UserDetailPage from './pages/UserDetailPage';
import PlansPage from './pages/PlansPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import SubscriptionDetailPage from './pages/SubscriptionDetailPage';
import ServicesPage from './pages/ServicesPage';
import './styles/tailwind.css';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Routes (Wrapped in Layout) */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />

                <Route path="users" element={<UsersPage />} />
                <Route path="users/:id" element={<UserDetailPage />} />

                <Route path="plans" element={<PlansPage />} />
                <Route path="services" element={<ServicesPage />} />

                <Route path="subscriptions" element={<SubscriptionsPage />} />
                <Route path="subscriptions/:id" element={<SubscriptionDetailPage />} />
              </Route>
            </Route>


            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
