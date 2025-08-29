// src/hooks/useAuth.js
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

/**
 * A custom hook for accessing the AuthContext.
 * This simplifies the process in any component that needs auth data,
 * as we can just call `useAuth()` instead of `useContext(AuthContext)`.
 */
export const useAuth = () => {
  return useContext(AuthContext);
};