import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Header() {
  const { user, userProfile, logout } = useAuth();

  return (
    <header className="bg-purple-700 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold hover:text-purple-200 transition-colors">
          Mom's Mementos
        </Link>
        <div className="flex items-center gap-4">
          {userProfile?.isAdmin && (
            <Link
              to="/admin"
              className="text-sm bg-purple-600 hover:bg-purple-500 px-3 py-1.5 rounded transition-colors"
            >
              Admin
            </Link>
          )}
          <span className="text-sm text-purple-200 hidden sm:inline">
            {user?.displayName || user?.email}
          </span>
          <button
            onClick={logout}
            className="text-sm bg-purple-800 hover:bg-purple-900 px-3 py-1.5 rounded transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
