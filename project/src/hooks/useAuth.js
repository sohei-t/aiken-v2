import { useState } from 'react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, logout } from '../services/firebase';
import { useAuthContext } from '../components/auth/AuthProvider';

export const useAuth = () => {
  const { user, userData, customerData, customerId, loading, isAdmin, isAuthenticated, refreshUserData } = useAuthContext();
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignIn = async (email, password) => {
    setAuthLoading(true);
    setError(null);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignUp = async (email, password, displayName) => {
    setAuthLoading(true);
    setError(null);
    try {
      await signUpWithEmail(email, password, displayName);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    setAuthLoading(true);
    setError(null);
    try {
      await logout();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  return {
    user,
    userData,
    customerData,
    customerId,
    loading: loading || authLoading,
    isAdmin,
    isAuthenticated,
    error,
    signInWithGoogle: handleGoogleSignIn,
    signInWithEmail: handleEmailSignIn,
    signUpWithEmail: handleEmailSignUp,
    logout: handleLogout,
    refreshUserData,
    clearError: () => setError(null)
  };
};

export default useAuth;
