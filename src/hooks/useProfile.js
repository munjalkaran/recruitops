import { useAuth } from "../contexts/AuthContext";

export function useProfile() {
  const { profile, loading, error } = useAuth();
  return { profile, loading, error };
}

