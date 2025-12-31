import { Link } from 'react-router-dom';

export default function EntriesPage() {
  return (
    <div className="container">
      <h1>Entries</h1>
      <p>Entries split view will go here (placeholder).</p>
      <nav>
        <Link to="/app">Back to App</Link> | <Link to="/login">Login</Link>
      </nav>
    </div>
  );
}
