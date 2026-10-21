import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api, setSession } from "../lib/api";

// Login screen layout is intentionally compact; login-* styles keep it
// separate from Signup and the other authentication pages.
export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const expired = searchParams.get("expired") === "1";
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, user } = await api.login(form);
      setSession(token, user);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-shell">
      <main className="login-page-main">
        <form className="login-form-card" onSubmit={handleSubmit}>
          <img src="/tradeledger-logo.svg" alt="TradeLedger" className="login-form-logo" />
          <h1>Log in to TradeLedger</h1>
          <p className="login-subtitle">Enter your details to access your business.</p>

          {expired && !error && (
            <p className="login-error-banner">Your session had expired, so you were logged out. Please log in again.</p>
          )}
          {error && <p className="login-error-banner">{error}</p>}

          <div className="login-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoFocus
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? "Logging in..." : "Log in"}
          </button>

          <Link to="/forgot-password" className="login-forgot-link">Forgot your password?</Link>

          <div className="login-divider"><span>New to TradeLedger?</span></div>

          <Link to="/signup" className="login-signup-cta">Set up TradeLedger</Link>
        </form>
      </main>
      <footer className="login-page-footer">
        <Link to="/terms">Terms &amp; Privacy</Link>
      </footer>
    </div>
  );
}
