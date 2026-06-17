import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import AssetList from './pages/AssetList';
import AssetQuery from './pages/AssetQuery';
import MyBorrowRequests from './pages/MyBorrowRequests';
import BorrowApproval from './pages/BorrowApproval';
import MyReturns from './pages/MyReturns';
import RepairManagement from './pages/RepairManagement';
import InventoryManagement from './pages/InventoryManagement';
import InventoryDetail from './pages/InventoryDetail';
import { auth } from './services/auth';
import type { User } from './services/auth';
import { useEffect, useState } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: 'admin' | 'employee';
}

function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const currentUser = auth.getUser();
    setUser(currentUser);
    setChecking(false);
  }, []);

  if (checking) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireRole && user.role !== requireRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function App() {
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    setIsAuth(auth.isAuthenticated());
  }, []);

  const defaultRedirect = () => {
    if (isAuth) {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/login" replace />;
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuth ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login />
            )
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route
            path="assets"
            element={
              <ProtectedRoute requireRole="admin">
                <AssetList />
              </ProtectedRoute>
            }
          />
          <Route
            path="assets/query"
            element={
              <ProtectedRoute requireRole="employee">
                <AssetQuery />
              </ProtectedRoute>
            }
          />
          <Route path="borrow-requests/my" element={<MyBorrowRequests />} />
          <Route
            path="borrow-requests/approve"
            element={
              <ProtectedRoute requireRole="admin">
                <BorrowApproval />
              </ProtectedRoute>
            }
          />
          <Route path="returns/my" element={<MyReturns />} />
          <Route
            path="returns/repair"
            element={
              <ProtectedRoute requireRole="admin">
                <RepairManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="inventory"
            element={
              <ProtectedRoute requireRole="admin">
                <InventoryManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="inventory/detail/:id"
            element={
              <ProtectedRoute requireRole="admin">
                <InventoryDetail />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={defaultRedirect()} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
