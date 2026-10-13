import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Check, Clock3, HeartPulse, MapPin, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import clinicPhoto from "@/assets/bright-smile-clinic.jpg";
import { Button } from "@/components/ui/button";
import { ClinicContactDetails, ClinicFooter, ClinicHeader } from "@/lib/clinic-ui";
import { CLINIC_SERVICES } from "@/lib/clinic-domain";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bright Smile Dental Clinic | Port Harcourt" },
      { name: "description", content: "Thoughtful dental care for the whole family in Umueme, Port Harcourt. Book your visit with Bright Smile Dental Clinic." },
      { property: "og:title", content: "Bright Smile Dental Clinic | Port Harcourt" },
      { property: "og:description", content: "Thoughtful dental care for the whole family in Umueme, Port Harcourt." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="clinic-site">
      <ClinicHeader />
      <main>
        <section className="home-hero">
          <div className="home-hero-inner">
            <div className="hero-copy">
              <span className="eyebrow"><span className="status-dot" /> Dental care in Port Harcourt</span>
              <h1>Bright Smile<br /><span>Dental Clinic</span></h1>
              <p className="hero-lede">A little more comfort. A lot more reason to smile.</p>
              <p className="hero-description">Thoughtful dental care for you and your family, in a welcoming clinic close to home.</p>
              <div className="hero-actions">
                <Button asChild size="lg"><Link to="/book">Book an appointment <ArrowUpRight size={18} aria-hidden="true" /></Link></Button>
                <a className="text-link" href="#services">Explore our care <ArrowRight size={16} aria-hidden="true" /></a>
              </div>
              <div className="hero-trust"><span><Check size={15} aria-hidden="true" /> Family-friendly</span><span><Check size={15} aria-hidden="true" /> Easy online booking</span></div>
            </div>
            <div className="hero-image-wrap">
              <img className="hero-image" src={clinicPhoto} alt="A dentist talking through treatment with a patient in a bright clinic" width={1536} height={1024} fetchPriority="high" />
              <div className="hero-image-caption"><span className="caption-icon"><HeartPulse size={19} aria-hidden="true" /></span><span>Gentle care, every visit</span></div>
            </div>
          </div>
          <div className="hero-bottom-line"><span>CARE THAT STARTS WITH A CONVERSATION</span><span>UMUEME · PORT HARCOURT</span></div>
        </section>

        <section className="service-section" id="services">
          <div className="section-inner">
            <div className="section-heading-row">
              <div><span className="eyebrow">Care for every smile</span><h2>All the care you need,<br />in one welcoming place.</h2></div>
              <p>From routine check-ups to a little extra support, we're here to help you feel at ease at every step.</p>
            </div>
            <ul className="service-list">
              {CLINIC_SERVICES.map((service, index) => <li key={service}><span className="service-number">{String(index + 1).padStart(2, "0")}</span><span>{service}</span><ArrowUpRight size={17} aria-hidden="true" /></li>)}
            </ul>
            <Button variant="outline" asChild><Link to="/book">Find a time that works <ArrowRight size={16} aria-hidden="true" /></Link></Button>
          </div>
        </section>

        <section className="why-section">
          <div className="why-inner">
            <div className="why-intro"><span className="eyebrow eyebrow-light">A better kind of dental visit</span><h2>Care that puts<br />you at ease.</h2><p>We believe feeling heard is part of feeling well cared for.</p></div>
            <div className="why-points">
              <article><span className="why-icon"><HeartPulse size={20} aria-hidden="true" /></span><h3>A gentler approach</h3><p>Clear conversations and thoughtful care, at a pace that feels right to you.</p></article>
              <article><span className="why-icon"><ShieldCheck size={20} aria-hidden="true" /></span><h3>Care you can trust</h3><p>We explain your options so you can feel confident about your next step.</p></article>
              <article><span className="why-icon"><Sparkles size={20} aria-hidden="true" /></span><h3>Made for your family</h3><p>Friendly dental care for growing smiles, busy parents and everyone in between.</p></article>
            </div>
          </div>
        </section>

        <section className="visit-section" id="visit">
          <div className="visit-inner">
            <div className="visit-copy"><span className="eyebrow">Come say hello</span><h2>Right here<br />in Umueme.</h2><p>Easy to find on Aba Road, beside Fidelity Bank by Genesis Bus stop.</p><ClinicContactDetails compact /><a className="text-link" href="https://maps.google.com/?q=238+Aba+Road+Umueme+Port+Harcourt+Rivers+Nigeria" target="_blank" rel="noreferrer">Open directions <ArrowUpRight size={16} aria-hidden="true" /></a></div>
            <div className="visit-hours"><div className="visit-hours-title"><span className="visit-icon"><Clock3 size={20} aria-hidden="true" /></span><div><span className="eyebrow">Plan your visit</span><h3>Opening hours</h3></div></div><div className="hours-row"><span>Monday – Friday</span><strong>9:00 am – 5:00 pm</strong></div><div className="hours-row"><span>Saturday</span><strong>9:00 am – 2:00 pm</strong></div><div className="hours-row hours-closed"><span>Sunday</span><strong>Closed</strong></div><div className="hours-note"><MapPin size={15} aria-hidden="true" /><span>Umueme, Port Harcourt</span></div></div>
          </div>
        </section>

        <section className="home-cta"><div><span className="eyebrow eyebrow-light">Your next visit starts here</span><h2>Ready to feel good<br />about your smile?</h2></div><Button variant="hero" asChild size="lg"><Link to="/book">Book an appointment <ArrowUpRight size={18} aria-hidden="true" /></Link></Button></section>
      </main>
      <ClinicFooter />
    </div>
  );
}