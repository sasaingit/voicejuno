import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="container">
      <h1>Voice Journaling</h1>
      <p>Welcome! This is the landing page placeholder.</p>
      <nav>
        <Link to="/login">Login</Link> | <Link to="/app/entries">Entries</Link>
      </nav>
    </div>
  );
}
