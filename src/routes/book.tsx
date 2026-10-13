import { useMemo, useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ClinicContactDetails, ClinicFooter, ClinicHeader, PageTitle } from "@/lib/clinic-ui";
import {
  CLINIC_SERVICES,
  formatClinicTime,
  formatDateLabel,
  formatLagosTime,
  getBookableDates,
  getClinicSlots,
  getLagosDate,
  isValidNigerianPhone,
} from "@/lib/clinic-domain";
import { bookAppointment, getBookedSlots } from "@/lib/appointments.functions";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Book an appointment | Bright Smile Dental Clinic" },
      { name: "description", content: "Choose a service, date and time to book your visit at Bright Smile Dental Clinic in Port Harcourt." },
    ],
  }),
  component: BookingPage,
});

type Confirmation = { reference: string; service: string; date: string; time: string };

function BookingPage() {
  const queryClient = useQueryClient();
  const today = getLagosDate();
  const dates = useMemo(() => getBookableDates(today), [today]);

  const [service, setService] = useState("");
  const [date, setDate] = useState(dates[0] ?? "");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const bookedQuery = useQuery({
    queryKey: ["booked-slots", date],
    queryFn: () => getBookedSlots({ data: { date } }),
    enabled: Boolean(date),
    staleTime: 0,
  });

  const nowLagos = formatLagosTime();
  const availableSlots = getClinicSlots(date).filter((slot) => {
    if (bookedQuery.data?.includes(slot)) return false;
    if (date === today && slot <= nowLagos) return false;
    return true;
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!service) return setError("Please choose a service.");
    if (!date || !time) return setError("Please choose a date and an available time.");
    if (name.trim().length < 2) return setError("Please enter your full name.");
    if (!isValidNigerianPhone(phone)) return setError("Enter a valid Nigerian phone number, for example 08012345678 or +2348012345678.");

    setSubmitting(true);
    try {
      const result = await bookAppointment({ data: { name, phone, service, date, time, notes: notes || undefined } });
      if (!result.ok) {
        setError(result.message);
        setTime("");
        await queryClient.invalidateQueries({ queryKey: ["booked-slots", date] });
        return;
      }
      setConfirmation({ reference: result.reference, service, date, time });
    } catch {
      setError("We couldn't save your appointment. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="clinic-site booking-page">
      <ClinicHeader />
      <main className="booking-main">
        <div className="booking-layout">
          <div>
            <PageTitle eyebrow="Book a visit" title="Find a time that suits you">
              <p>Choose your service and an available time. We will contact you on the number you give to confirm.</p>
            </PageTitle>

            {confirmation ? (
              <div className="booking-form confirmation-view" role="status">
                <div className="confirmation-mark"><Check size={28} aria-hidden="true" /></div>
                <h2>Request received</h2>
                <p>Thank you. Please keep your reference number. Our team will confirm your appointment shortly.</p>
                <span className="reference-number">{confirmation.reference}</span>
                <div className="confirmation-details">
                  <p><span>Service</span><strong>{confirmation.service}</strong></p>
                  <p><span>Date</span><strong>{formatDateLabel(confirmation.date)}</strong></p>
                  <p><span>Time</span><strong>{formatClinicTime(confirmation.time)}</strong></p>
                </div>
                <Button asChild variant="outline"><Link to="/">Back to home</Link></Button>
              </div>
            ) : (
              <form className="booking-form" onSubmit={onSubmit} noValidate>
                <div className="form-grid">
                  <div className="field field-full">
                    <label className="field-label" htmlFor="service">Service</label>
                    <select
                      id="service"
                      className="field-input flex w-full rounded-md border px-3 text-sm"
                      value={service}
                      onChange={(e) => setService(e.target.value)}
                    >
                      <option value="">Choose a service</option>
                      {CLINIC_SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div className="field field-full">
                    <label className="field-label" htmlFor="date">Date</label>
                    <select
                      id="date"
                      className="field-input flex w-full rounded-md border px-3 text-sm"
                      value={date}
                      onChange={(e) => { setDate(e.target.value); setTime(""); }}
                    >
                      {dates.map((d) => <option key={d} value={d}>{formatDateLabel(d, { year: "numeric" })}</option>)}
                    </select>
                    <span className="field-hint">The clinic is closed on Sundays.</span>
                  </div>

                  <div className="field field-full">
                    <span className="field-label" id="time-label">Time</span>
                    <div className="time-slot-group" role="group" aria-labelledby="time-label">
                      {availableSlots.map((slot) => (
                        <Button
                          key={slot}
                          type="button"
                          size="sm"
                          variant={time === slot ? "default" : "outline"}
                          aria-pressed={time === slot}
                          onClick={() => setTime(slot)}
                        >
                          {formatClinicTime(slot)}
                        </Button>
                      ))}
                    </div>
                    <p className="availability-message" aria-live="polite">
                      {bookedQuery.isLoading
                        ? "Checking available times..."
                        : bookedQuery.isError
                          ? "We couldn't check availability. Please refresh the page."
                          : availableSlots.length === 0
                            ? "No times left on this day. Please choose another date."
                            : `${availableSlots.length} time${availableSlots.length === 1 ? "" : "s"} available.`}
                    </p>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="name">Full name</label>
                    <Input id="name" className="field-input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="phone">Phone number</label>
                    <Input id="phone" className="field-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="08012345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    <span className="field-hint">We use this to confirm your visit.</span>
                  </div>
                  <div className="field field-full">
                    <label className="field-label" htmlFor="notes">Notes (optional)</label>
                    <Textarea id="notes" className="field-input" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                </div>

                {error && <p className="form-error" role="alert" style={{ marginTop: 18 }}>{error}</p>}

                <Button type="submit" size="lg" className="form-submit" disabled={submitting}>
                  {submitting ? "Booking..." : "Request appointment"} <ArrowUpRight size={18} aria-hidden="true" />
                </Button>
              </form>
            )}
          </div>

          <aside className="booking-sidebar">
            <span className="eyebrow">Before you come</span>
            <h2>We look forward to seeing you.</h2>
            <p>Bring any previous dental records you have. If you need to change your time, call the clinic and quote your reference number.</p>
            <ClinicContactDetails />
          </aside>
        </div>
      </main>
      <ClinicFooter />
    </div>
  );
}
