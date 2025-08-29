// admin-dashboard/src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { Button, TextField, Container, Typography, Box, Alert, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import apiClient from '../api/apiClient.js';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');

    // Validate phone number
    if (!/^\+91\d{10}$/.test(phone)) {
      setError('Please enter a valid phone number with +91 (e.g., +918000000000).');
      return;
    }

    setLoading(true);
    try {
      console.log('Attempting login with:', { phone, password });

      const response = await apiClient.post('/api/admin/login', { phone, password });

      if (response.data?.token) {
        console.log('Login successful, token:', response.data.token);
        localStorage.setItem('token', response.data.token);
        login(response.data.token);
        navigate('/dashboard');
      } else {
        setError('Login failed: No token received from server.');
      }
    } catch (err) {
      console.error('Login error:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      });

      if (err.code === 'ECONNABORTED') {
        setError('Request timed out. Is the backend running on http://localhost:3001?');
      } else if (err.response?.status === 401) {
        setError('Invalid phone number or password.');
      } else if (err.response?.status === 500) {
        setError('Server error. Check backend logs for details.');
      } else {
        setError(err.response?.data?.message || 'Network error. Please try again.');
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
        <Box component="form" onSubmit={handleLogin} sx={{ mt: 3 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="phone"
            label="Phone Number"
            name="phone"
            autoComplete="tel"
            autoFocus
            placeholder="+918000000000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <Alert severity="error" sx={{ mt: 2, width: '100%' }}>{error}</Alert>}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{ mt: 3, mb: 2 }}
          >
            {loading ? (
              <>
                <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} />
                Signing In...
              </>
            ) : 'Sign In'}
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default LoginPage;
