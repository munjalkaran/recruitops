import { useAuth } from "../../contexts/AuthContext";

export default function ProtectedRoute({ children, fallback = null, bypass = false }) {
  const { session, profile, loading } = useAuth();
  if (bypass) return children;
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-app text-primary">
        <div className="rounded-lg border border-app bg-surface px-5 py-4 text-sm font-bold text-secondary">
          Checking RecruitOps access...
        </div>
      </main>
    );
  }
  return session && profile ? children : fallback;
}
