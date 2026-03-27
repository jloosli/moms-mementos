import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "../lib/firebase";

interface UserProfile {
  email: string;
  displayName: string;
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>(null!);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data() as UserProfile);
          await setDoc(
            doc(db, "users", firebaseUser.uid),
            { lastLogin: serverTimestamp() },
            { merge: true }
          );
        } else {
          const profile: UserProfile = {
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || "",
            isAdmin: false,
          };
          await setDoc(doc(db, "users", firebaseUser.uid), {
            ...profile,
            lastLogin: serverTimestamp(),
          });
          setUserProfile(profile);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signInWithGoogle() {
    await signInWithPopup(auth, googleProvider);
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{ user, userProfile, loading, signInWithGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
