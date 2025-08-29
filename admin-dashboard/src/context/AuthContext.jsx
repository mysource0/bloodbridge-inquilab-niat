// src/context/AuthContext.jsx
import React, { createContext, useState } from 'react';

// 1. Create the context
// This object will be used by other components to access the auth state.
export const AuthContext = createContext(null);

// 2. Create the Provider component
// This component will wrap our application and provide the auth state.
export const AuthProvider = ({ children }) => {
  // Initialize the token state by reading from localStorage.
  // This ensures that the user remains logged in even after a page refresh.
  const [token, setToken] = useState(localStorage.getItem('token'));

  // The login function saves the token to both localStorage and the state.
  const login = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  // The logout function removes the token from localStorage and the state.
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  // 3. Define the value to be provided by the context
  // We derive `isLoggedIn` directly from the presence of a token.
  const value = {
    token,
    isLoggedIn: !!token,
    login,
    logout,
  };

  // 4. Return the provider with the value, wrapping any child components.
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};