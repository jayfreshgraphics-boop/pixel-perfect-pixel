import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { ClinicHeader, PageTitle } from "@/lib/clinic-ui";
import { formatClinicTime, formatDateLabel } from "@/lib/clinic-domain";
import { completeAppointment, getStaffAppointments, updateAppointmentStatus } from "@/lib/appointments.functions";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Appointments | Bright Smile staff" }, { name: "robots", content: "noindex" }] }),
  component: StaffDashboard,
});

type View = "today" | "upcoming" | "past";
type Row = Awaited<ReturnType<typeof getStaffAppointments>>[number];
type Action = "confirmed" | "completed" | "cancelled" | "no_show";

const ACTION_COPY: Record<Action, { label: string; title: string; body: string }> = {
  confirmed: { label: "Confirm", title: "Confirm this appointment?", body: "The booking will be marked as confirmed." },
  completed: { label: "Mark completed", title: "Mark this visit as completed?", body: "This also sends the patient a message asking how their visit went." },
  cancelled: { label: "Cancel", title: "Cancel this appointment?", body: "The time slot will become available again." },
  no_show: { label: "No-show", title: "Mark as no-show?", body: "The time slot will become available again." },
};

function StaffDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("today");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<{ row: Row; action: Action } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchText), 300);
    return () => clearTimeout(t);
  }, [searchText]);

  const list = useQuery({ queryKey: ["staff", view, search], queryFn: () => getStaffAppointments({ data: { view, search } }) });
  const todayAll = useQuery({ queryKey: ["staff", "today", ""], queryFn: () => getStaffAppointments({ data: { view: "today", search: "" } }) });
  const upcomingAll = useQuery({ queryKey: ["staff", "upcoming", ""], queryFn: () => getStaffAppointments({ data: { view: "upcoming", search: "" } }) });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["staff"] });

  async function runComplete(id: string) {
    try {
      const result = await completeAppointment({ data: { id } });
      if (result.ok) toast.success("Visit completed. The review message has been sent.");
      else toast.error(result.message, { action: { label: "Retry", onClick: () => void runComplete(id) } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    }
    await refresh();
  }

  const statusMutation = useMutation({
    mutationFn: async ({ row, action }: { row: Row; action: Action }) => {
      if (action === "completed") return runComplete(row.id);
      await updateAppointmentStatus({ data: { id: row.id, status: action } });
      toast.success(`${row.ref} updated.`);
      await refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed."),
    onSettled: () => setPending(null),
  });

  async function signOut() {
    await supabase.auth.signOut();
    await navigate({ to: "/staff/login" });
  }

  const todayRows = todayAll.data ?? [];
  const active = (r: Row) => r.status === "booked" || r.status === "confirmed";
  const rows = list.data ?? [];

  return (
    <div className="clinic-site staff-page">
      <ClinicHeader staff />
      <main className="staff-main">
        <div className="staff-heading">
          <PageTitle eyebrow="Staff" title="Appointments" />
          <div className="staff-actions">
            <Button variant="outline" onClick={() => void refresh()}><RefreshCw size={15} aria-hidden="true" /> Refresh</Button>
            <Button variant="outline" onClick={() => void signOut()}><LogOut size={15} aria-hidden="true" /> Sign out</Button>
          </div>
        </div>

        <div className="staff-counts">
          <div className="stat-item"><span>Today</span><strong>{todayRows.length}</strong></div>
          <div className="stat-item"><span>Waiting today</span><strong>{todayRows.filter(active).length}</strong></div>
          <div className="stat-item"><span>Upcoming</span><strong>{upcomingAll.data?.length ?? 0}</strong></div>
        </div>

        <div className="staff-workspace">
          <div className="staff-toolbar">
            <div className="staff-tabs" role="tablist">
              {(["today", "upcoming", "past"] as View[]).map((v) => (
                <Button key={v} role="tab" aria-selected={view === v} size="sm" variant={view === v ? "default" : "ghost"} onClick={() => setView(v)} className="capitalize">{v}</Button>
              ))}
            </div>
            <div className="staff-search">
              <Search size={15} aria-hidden="true" />
              <Input className="field-input" placeholder="Search name, phone or reference" aria-label="Search appointments" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
            </div>
          </div>

          {list.isLoading ? (
            <p className="table-loading">Loading appointments...</p>
          ) : list.isError ? (
            <div className="empty-table"><h3>Couldn't load appointments</h3><p>Please refresh and try again.</p></div>
          ) : rows.length === 0 ? (
            <div className="empty-table"><h3>No appointments here</h3><p>Nothing found for this view{search ? " and search" : ""}.</p></div>
          ) : (
            <div className="table-wrap">
              <table className="appointments-table">
                <thead><tr><th>Ref</th><th>Patient</th><th>Service</th><th>When</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.ref}</td>
                      <td><div className="patient-cell"><strong>{row.name}</strong><span>{row.phone}</span></div></td>
                      <td>{row.service}</td>
                      <td>{formatDateLabel(row.date)} · {formatClinicTime(row.time)}</td>
                      <td><span className={`status-badge status-${row.status}`}>{row.status.replace("_", "-")}</span></td>
                      <td>
                        <div className="row-actions">
                          {row.status === "booked" && <Button size="sm" variant="outline" onClick={() => setPending({ row, action: "confirmed" })}>Confirm</Button>}
                          {active(row) && <Button size="sm" onClick={() => setPending({ row, action: "completed" })}>Complete</Button>}
                          {active(row) && <Button size="sm" variant="ghost" onClick={() => setPending({ row, action: "no_show" })}>No-show</Button>}
                          {active(row) && <Button size="sm" variant="ghost" onClick={() => setPending({ row, action: "cancelled" })}>Cancel</Button>}
                          {row.status === "completed" && !row.review_requested && <Button size="sm" variant="outline" onClick={() => void runComplete(row.id)}>Retry review message</Button>}
                          {row.status === "completed" && row.review_requested && <span className="field-hint">Review message sent</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <Dialog open={pending !== null} onOpenChange={(open) => { if (!open && !statusMutation.isPending) setPending(null); }}>
        <DialogContent>
          {pending && (
            <>
              <DialogHeader>
                <DialogTitle>{ACTION_COPY[pending.action].title}</DialogTitle>
                <DialogDescription className="dialog-copy">
                  {pending.row.name} · {pending.row.ref}. {ACTION_COPY[pending.action].body}
                </DialogDescription>
              </DialogHeader>
              <div className="confirm-dialog-actions">
                <Button variant="outline" onClick={() => setPending(null)} disabled={statusMutation.isPending}>Back</Button>
                <Button onClick={() => statusMutation.mutate(pending)} disabled={statusMutation.isPending}>
                  {statusMutation.isPending ? "Working..." : ACTION_COPY[pending.action].label}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
