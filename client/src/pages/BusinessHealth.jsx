import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { adminApi, getAdminSecret } from "../lib/adminApi";
import { formatDateTime, formatMoney } from "../lib/format";
import { ATTENTION_LABELS, buildBusinessSummary } from "../lib/businessSummary";
import { IconChevron, IconAlert, IconBuilding } from "../components/Icons";

// One business's own health check — everything Naveen needs to diagnose a
// problem for them without ever seeing their client data (2026-09-15).
// Reached by clicking a business's name on the main Master Admin screen.
// Deliberately three separate reads (business profile, users, errors)
// rather than one giant endpoint, so each section can load and fail
// independently.
// Exported (not just used below) so the cross-business "Errors" feed on the
// main Master Admin screen can show the exact same row, with one addition —
// a Business column, since that feed isn't already scoped to one business
// the way this page's own Errors section is (2026-09-16).
export function ErrorRow({ error, onUpdated, showBusiness }) {
  const [resolving, setResolving] = useState(false);
  const [notes, setNotes] = useState(error.resolution_notes || "");
  const [busy, setBusy] = useState(false);
  const totalCols = showBusiness ? 7 : 6;

  const save = async (status) => {
    setBusy(true);
    try {
      const updated = await adminApi.setErrorStatus(error.id, status, notes);
      onUpdated(updated);
      setResolving(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <tr>
        {showBusiness && (
          <td>
            {error.business_id ? (
              <Link to={`/admin/businesses/${error.business_id}`}>{error.business_name || "Unknown business"}</Link>
            ) : (
              <span className="muted">No business (system)</span>
            )}
          </td>
        )}
        <td>{formatDateTime(error.created_at)}</td>
        <td>{error.source === "client" ? "Browser" : "Server"}</td>
        <td className="error-route-cell">{error.route || "—"}</td>
        <td style={{ whiteSpace: "pre-wrap" }}>{error.message}</td>
        <td><span className={`badge ${error.status === "open" ? "badge-attention" : "badge-resolved"}`}>{error.status === "open" ? "Open" : "Resolved"}</span></td>
        <td>
          {error.status === "open" ? (
            <button type="button" className="link-btn" onClick={() => setResolving((v) => !v)}>
              {resolving ? "Cancel" : "Resolve"}
            </button>
          ) : (
            <button type="button" className="link-btn" onClick={() => save("open")} disabled={busy}>Reopen</button>
          )}
        </td>
      </tr>
      {resolving && (
        <tr className="admin-detail-row">
          <td colSpan={totalCols}>
            <div className="admin-detail-panel" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <label>How was this fixed?
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Restarted the mail queue, was a stuck SMTP connection" />
              </label>
              <button type="button" className="btn admin-copy-btn" style={{ alignSelf: "flex-start" }} onClick={() => save("resolved")} disabled={busy}>
                {busy ? "Saving..." : "Mark resolved"}
              </button>
            </div>
          </td>
        </tr>
      )}
      {!resolving && error.status === "resolved" && error.resolution_notes && (
        <tr className="admin-detail-row">
          <td colSpan={totalCols}>
            <div className="admin-detail-panel">
              <span className="muted">Resolved {formatDateTime(error.resolved_at)}: {error.resolution_notes}</span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function BusinessHealth() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [business, setBusiness] = useState(null);
  const [users, setUsers] = useState(null);
  const [errors, setErrors] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const loadErrors = () => adminApi.getBusinessErrors(id).then(setErrors).catch((err) => setError(err.message));
  useEffect(() => {
    if (!getAdminSecret()) { navigate("/admin/login"); return; }
    adminApi.getBusiness(id).then(setBusiness).catch((err) => setError(err.message));
    adminApi.getBusinessUsers(id).then(setUsers).catch((err) => setError(err.message));
    loadErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const openErrorCount = errors?.filter((e) => e.status === "open").length || 0;
  const reasons = business?.attention || [];

  const copySummary = async () => {
    const text = buildBusinessSummary(business);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API can refuse (no permission, non-HTTPS context) — fall
      // back to something the browser always allows, rather than the button
      // silently doing nothing.
      window.prompt("Copy this:", text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!business) {
    return (
      <div className="admin-page">
        <div className="admin-content">{error ? <p className="error">{error}</p> : <p className="muted">Loading...</p>}</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <div className="admin-topbar-inner">
          <Link to="/admin" className="admin-back-link"><IconChevron direction="left" size={16} /> All businesses</Link>
        </div>
      </div>

      <div className="admin-content">
        {error && <p className="error">{error}</p>}

        <div className="business-health-header">
          {business.logo_data_url && <img src={business.logo_data_url} alt="" className="business-health-logo" />}
          <div>
            <h1>{business.name}</h1>
            <p className="muted">
              {[business.owner_email, business.owner_phone, business.state, business.gstin].filter(Boolean).join(" · ") || "No contact details on file"}
            </p>
            {business.owner_login_email && (
              <p className="muted">
                Owner login: <a href={`mailto:${business.owner_login_email}`}>{business.owner_login_email}</a>
                {business.sibling_firms?.length > 0 && (
                  <>
                    {" "}· also runs{" "}
                    {business.sibling_firms.map((f, i) => (
                      <span key={f.id}>
                        {i > 0 && ", "}
                        <Link to={`/admin/businesses/${f.id}`}>{f.name}</Link>
                      </span>
                    ))}
                  </>
                )}
              </p>
            )}
          </div>
          <span className={`badge ${business.plan === "premium" ? "badge-premium" : "badge-free"}`}>{business.plan === "premium" ? "Premium" : "Free"}</span>
        </div>

        {reasons.length > 0 && (
          <p className="error" style={{ marginTop: -8 }}>
            Needs attention: {reasons.map((r) => ATTENTION_LABELS[r] || r).join("; ")}
          </p>
        )}

        <div className="admin-section">
          <div className="admin-section-header">
            <span className="settings-card-icon"><IconBuilding size={19} /></span>
            <div>
              <h2>Business details</h2>
              <p className="muted">Everything about this business at a glance — no client data, just the account itself.</p>
            </div>
          </div>
          <div className="admin-table-card">
            <div className="admin-detail-panel">
              <div className="admin-detail-facts">
                <div><span className="muted">GSTIN</span><strong>{business.gstin || "Not set"}</strong></div>
                <div><span className="muted">State</span><strong>{business.state || "Not set"}</strong></div>
                <div><span className="muted">Customers</span><strong>{business.customer_count}</strong></div>
                <div><span className="muted">Invoices</span><strong>{business.invoice_count} (₹{formatMoney(business.invoiced_total)})</strong></div>
                <div><span className="muted">Last login</span><strong>{business.last_login_at ? formatDateTime(business.last_login_at) : "Never"}</strong></div>
                <div><span className="muted">Signed up</span><strong>{formatDateTime(business.created_at)}</strong></div>
                <div>
                  <span className="muted">Cloud backup</span>
                  <strong className={business.cloud_backup_status === "error" ? "admin-attention-text" : undefined}>
                    {business.cloud_backup_status === "error" ? "Connected, upload failing" : business.cloud_backup_status === "connected" ? "Connected" : "Not connected"}
                  </strong>
                </div>
                <button type="button" className="btn btn-secondary admin-copy-btn" onClick={copySummary}>
                  {copied ? "Copied" : "Copy details"}
                </button>
              </div>
              <div className="admin-detail-users">
                <span className="muted">Logins under this business</span>
                {users === null ? (
                  <p className="muted">Loading...</p>
                ) : users.length ? (
                  <table className="table admin-detail-users-table">
                    <thead>
                      <tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th></tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td>{u.name}</td>
                          <td>{u.email || "—"}</td>
                          <td>{u.role}</td>
                          <td>{u.last_login_at ? formatDateTime(u.last_login_at) : "Never"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="muted">No logins recorded.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="admin-section">
          <div className="admin-section-header">
            <span className="settings-card-icon"><IconAlert size={19} /></span>
            <div>
              <h2>Errors{openErrorCount > 0 && <span className="badge badge-attention admin-section-badge">{openErrorCount} open</span>}</h2>
              <p className="muted">Technical errors this business's requests hit — never their invoices, customers, or anything else they've typed in.</p>
            </div>
          </div>
          <div className="admin-table-card">
            {errors === null ? (
              <p className="muted">Loading...</p>
            ) : errors.length === 0 ? (
              <p className="muted">No errors recorded for this business. That's a good sign.</p>
            ) : (
              <table className="table">
                <thead><tr><th>When</th><th>Where</th><th>Route</th><th>Message</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {errors.map((e) => <ErrorRow key={e.id} error={e} onUpdated={loadErrors} />)}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
