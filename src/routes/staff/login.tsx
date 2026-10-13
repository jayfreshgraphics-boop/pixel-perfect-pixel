import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ClinicHeader } from "@/lib/clinic-ui";

export const Route = createFileRoute("/staff/login")({
  head: () => ({ meta: [{ title: "Staff login | Bright Smile Dental Clinic" }, { name: "robots", content: "noindex" }] }),
  component: StaffLogin,
});

function StaffLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError || !data.user) {
      setBusy(false);
      setError("Those details didn't match. Check your email and password and try again.");
      return;
    }
    const { data: isStaff } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "staff" });
    if (!isStaff) {
      await supabase.auth.signOut();
      setBusy(false);
      setError("This account does not have staff access.");
      return;
    }
    await navigate({ to: "/staff" });
  }

  return (
    <div className="clinic-site auth-page">
      <ClinicHeader staff />
      <main className="auth-main">
        <div className="auth-layout">
          <div className="auth-intro">
            <span className="eyebrow">Clinic staff</span>
            <h1>Manage today's appointments.</h1>
            <p>Sign in to confirm bookings, mark visits complete and send review requests to patients.</p>
            <div className="auth-hours"><Clock3 size={16} aria-hidden="true" /> Mon–Fri 9am–5pm · Sat 9am–2pm</div>
          </div>
          <form className="auth-form" onSubmit={onSubmit}>
            <h2>Staff sign in</h2>
            <p>Use the account the clinic manager created for you.</p>
            <div className="field">
              <label className="field-label" htmlFor="email">Email</label>
              <Input id="email" className="field-input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="password">Password</label>
              <Input id="password" className="field-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="form-error" role="alert" style={{ marginTop: 14 }}>{error}</p>}
            <Button type="submit" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</Button>
            <p className="auth-help">Accounts are created by the clinic manager. Self sign-up is switched off.</p>
          </form>
        </div>
      </main>
    </div>
  );
}
