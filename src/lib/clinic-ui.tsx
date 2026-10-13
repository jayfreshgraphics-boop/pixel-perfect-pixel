import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock3, MapPin, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ClinicBrand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="brand-lockup" aria-label="Bright Smile Dental Clinic home">
      <span className="brand-mark" aria-hidden="true"><Smile size={22} strokeWidth={2.2} /></span>
      <span className="brand-name">Bright Smile<span>{compact ? "" : "Dental Clinic"}</span></span>
    </Link>
  );
}

export function ClinicHeader({ staff = false }: { staff?: boolean }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <ClinicBrand />
        <nav className="site-nav" aria-label="Main navigation">
          {staff ? <span className="nav-context">Staff appointments</span> : <>
            <a href="/#services">Services</a>
            <a href="/#visit">Visit us</a>
            <Button asChild><Link to="/book">Book a visit <ArrowUpRight size={16} aria-hidden="true" /></Link></Button>
          </>}
        </nav>
      </div>
    </header>
  );
}

export function ClinicFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main"><ClinicBrand /><span>Care you can feel good about.</span><a href="/staff/login" className="staff-login-link">Staff login</a></div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Bright Smile Dental Clinic</span><span>Port Harcourt, Rivers State</span></div>
    </footer>
  );
}

export function ClinicContactDetails({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "contact-details contact-details-compact" : "contact-details"}>
      <p><MapPin size={18} aria-hidden="true" /> <span>238 Aba Rd, beside Fidelity Bank by Genesis Bus stop,<br className="desktop-break" /> Umueme, Port Harcourt, Rivers, Nigeria</span></p>
      <p><Clock3 size={18} aria-hidden="true" /> <span>Mon–Fri, 9am–5pm <span className="hours-divider">·</span> Sat, 9am–2pm</span></p>
    </div>
  );
}

export function PageTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="page-title"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{children}</div>;
}