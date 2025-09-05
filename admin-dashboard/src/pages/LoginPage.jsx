// admin-dashboard/src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { Button, TextField, Container, Typography, Box, Alert, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import apiClient from '../api/apiClient.js';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  // --- MODIFICATION: Hardcode the phone number for the demo user ---
  // We no longer need a state for the phone number.
  const phone = '+918000000000';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    
    // Simple password validation
    if (!password) {
        setError('Password is required.');
        return;
    }

    setLoading(true);
    try {
      // The component now sends the hardcoded phone number and the entered password.
      console.log('Attempting login with:', { phone, password });
      const response = await apiClient.post('/api/admin/login', { phone, password });

      if (response.data?.token) {
        console.log('Login successful, token:', response.data.token);
        // Using localStorage to persist the token across browser sessions.
        localStorage.setItem('token', response.data.token);
        login(response.data.token);
        navigate('/dashboard');
      } else {
        // This case is unlikely if the backend is structured correctly, but good to have.
        setError('Login failed: No token received from server.');
      }
    } catch (err) {
      console.error('Login error:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      });

      // Provide more specific feedback to the user.
      if (err.response?.status === 401) {
        setError('Invalid password. Hint: try "admin123"');
      } else if (err.code === 'ECONNABORTED' || !err.response) {
        setError('Cannot connect to the server. Please ensure it is running.');
      } else {
        setError(err.response?.data?.message || 'An unknown error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography component="h1" variant="h5">
          🩸 BloodBridge AI Admin
        </Typography>
        <Box component="form" onSubmit={handleLogin} sx={{ mt: 3, width: '100%' }}>
          {/* --- MODIFICATION: The phone number input field has been removed --- */}
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{ mt: 3, mb: 2 }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default LoginPage;