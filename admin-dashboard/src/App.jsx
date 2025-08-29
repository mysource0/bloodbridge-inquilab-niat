// admin-dashboard/src/App.jsx
import React from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AuthProvider } from './context/AuthContext.jsx';
import { Routes, Route, Navigate } from 'react-router-dom'; // ✅ IMPORT ROUTER COMPONENTS
import theme from './theme.js';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/Dashboard.jsx';
import { useAuth } from './hooks/useAuth.js';

/**
 * A protected route component. If the user is not logged in,
 * it redirects them to the login page.
 */
const ProtectedRoute = ({ children }) => {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/" />;
};

/**
 * The main App component, now with a proper routing structure.
 */
function App() {
  return (
    <AuthProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;