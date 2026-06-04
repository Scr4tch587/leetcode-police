import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Login } from "@/pages/Login";
import { GroupSetup } from "@/pages/GroupSetup";
import { Dashboard } from "@/pages/Dashboard";
import { History } from "@/pages/History";
import { Admin } from "@/pages/Admin";
import { Profile } from "@/pages/Profile";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

export default function App() {
  const { firebaseUser, profile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!firebaseUser) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  if (profile && !profile.groupId) {
    return (
      <AppShell>
        <Routes>
          <Route path="/setup" element={<GroupSetup />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/setup" replace />} />
        </Routes>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/history" element={<History />} />
        <Route path="/profile" element={<Profile />} />
        {profile?.isAdmin && <Route path="/admin" element={<Admin />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
