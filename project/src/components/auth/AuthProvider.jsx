import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { auth, getUserData, ensureUserDocument } from '../../services/firebase';

const AuthContext = createContext(null);

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Handle redirect sign-in result (for in-app browsers like LINE)
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          await ensureUserDocument(result.user);
        }
      })
      .catch((err) => {
        console.error('Redirect sign-in error:', err);
      });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        await ensureUserDocument(firebaseUser);
        const data = await getUserData(firebaseUser.uid);
        setUserData(data);
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUserData = async () => {
    if (user) {
      const data = await getUserData(user.uid);
      setUserData(data);
    }
  };

  const isAdmin = userData?.role === 'admin';
  const isAuthenticated = !!user;
  const isSubscriber = userData?.subscriptionStatus === 'active';

  const value = {
    user,
    userData,
    loading,
    isAdmin,
    isAuthenticated,
    isSubscriber,
    refreshUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
