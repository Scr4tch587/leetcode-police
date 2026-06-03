import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function NavBar() {
  const { profile, group, signOut } = useAuth();
  const inGroup = !!profile?.groupId;

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="brand">🏆 Problem Club</div>
        <nav className="nav-links">
          {inGroup && (
            <>
              <NavLink to="/" end>
                Dashboard
              </NavLink>
              <NavLink to="/history">History</NavLink>
              {profile?.isAdmin && <NavLink to="/admin">Admin</NavLink>}
            </>
          )}
          <NavLink to="/profile">Profile</NavLink>
          <button className="link-btn" onClick={() => void signOut()}>
            Sign out
          </button>
        </nav>
      </div>
      {group && <div className="group-tag">{group.name}</div>}
    </header>
  );
}
