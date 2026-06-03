import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { NavBar } from "./components/NavBar";
import { Login } from "./pages/Login";
import { GroupSetup } from "./pages/GroupSetup";
import { Dashboard } from "./pages/Dashboard";
import { History } from "./pages/History";
import { Admin } from "./pages/Admin";
import { Profile } from "./pages/Profile";

export default function App() {
  const { firebaseUser, profile, loading } = useAuth();

  if (loading) {
    return <div className="centered muted">Loading…</div>;
  }

  // Not signed in.
  if (!firebaseUser) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  // Signed in but not in a group yet.
  if (profile && !profile.groupId) {
    return (
      <>
        <NavBar />
        <Routes>
          <Route path="/setup" element={<GroupSetup />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/setup" replace />} />
        </Routes>
      </>
    );
  }

  // Signed in and in a group.
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/history" element={<History />} />
        <Route path="/profile" element={<Profile />} />
        {profile?.isAdmin && <Route path="/admin" element={<Admin />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
