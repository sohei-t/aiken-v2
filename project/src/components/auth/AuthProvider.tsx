import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth, getUserData, ensureUserDocument, getCustomer } from '../../services/firebase';
import type { UserData, CustomerData, AuthContextValue } from '../../types';

const AuthContext = createContext<AuthContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuthContext = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

        // Load customer data if user belongs to a customer
        if (data?.customerId) {
          const customer = await getCustomer(data.customerId);
          setCustomerData(customer);
        } else {
          setCustomerData(null);
        }
      } else {
        setUser(null);
        setUserData(null);
        setCustomerData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUserData = async (): Promise<void> => {
    if (user) {
      const data = await getUserData(user.uid);
      setUserData(data);
      if (data?.customerId) {
        const customer = await getCustomer(data.customerId);
        setCustomerData(customer);
      }
    }
  };

  const isAdmin = userData?.role === 'admin';
  const isAuthenticated = !!user;
  const customerId = userData?.customerId || null;

  const value: AuthContextValue = {
    user,
    userData,
    customerData,
    customerId,
    loading,
    isAdmin,
    isAuthenticated,
    refreshUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
