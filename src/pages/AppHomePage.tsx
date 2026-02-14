import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function AppHomePage() {
  const { user, signOut } = useAuth();

  return (
    <div className="container">
      <h1>App</h1>

      <p style={{ color: '#666', fontSize: 12 }}>
        Logged in as <code>{user?.email ?? user?.id}</code>
      </p>

      <nav style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Link to="/app/entries">Entries</Link>
        <button onClick={() => void signOut()}>Logout</button>
      </nav>
    </div>
  );
}
