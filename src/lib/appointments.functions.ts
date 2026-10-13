import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/integrations/supabase/types";
import { z } from "zod";

const bookingInput = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(10).max(16),
  service: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:00$/),
  notes: z.string().max(1000).optional(),
});

const appointmentIdInput = z.object({ id: z.string().uuid() });
const staffListInput = z.object({ view: z.enum(["today", "upcoming", "past"]), search: z.string().max(100).default("") });
const statusInput = z.object({ id: z.string().uuid(), status: z.enum(["confirmed", "cancelled", "no_show"]) });

type AppointmentRow = Tables<"appointments">;
type AppointmentView = Pick<
  AppointmentRow,
  "id" | "ref" | "name" | "phone" | "service" | "date" | "time" | "notes" | "status" | "completed_at" | "review_requested" | "created_at"
>;

export const getBookedSlots = createServerFn({ method: "GET" })
  .inputValidator((input: { date: string }) => z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(input))
  .handler(async ({ data }) => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: slots, error } = await supabase.rpc("get_booked_slots", { p_date: data.date });
    if (error) throw new Error("Could not check available appointments. Please try again.");
    return slots ?? [];
  });

export const bookAppointment = createServerFn({ method: "POST" })
  .inputValidator((input: z.input<typeof bookingInput>) => bookingInput.parse(input))
  .handler(async ({ data }) => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: reference, error } = await supabase.rpc("create_appointment", {
      p_name: data.name,
      p_phone: data.phone.replace(/[\s()-]/g, ""),
      p_service: data.service,
      p_date: data.date,
      p_time: data.time,
      p_notes: data.notes?.trim() ?? "",
    });
    if (error) {
      if (error.code === "23505") return { ok: false as const, message: "That time was just taken. Please choose another available time." };
      if (error.code === "22023") return { ok: false as const, message: "That time is no longer available. Please choose another time." };
      throw new Error("We couldn't save your appointment. Please try again.");
    }
    return { ok: true as const, reference: reference ?? "" };
  });

async function assertStaff(supabase: SupabaseClient<Database>, userId: string) {
  const { data: isStaff, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "staff" });
  if (error || !isStaff) throw new Error("You do not have staff access.");
}

export const getStaffAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof staffListInput>) => staffListInput.parse(input))
  .handler(async ({ data, context }): Promise<AppointmentView[]> => {
    await assertStaff(context.supabase, context.userId);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    let query = context.supabase.from("appointments").select("id,ref,name,phone,service,date,time,notes,status,completed_at,review_requested,created_at").order("date", { ascending: data.view !== "past" }).order("time");
    if (data.view === "today") query = query.eq("date", today);
    if (data.view === "upcoming") query = query.gte("date", today).neq("date", today);
    if (data.view === "past") query = query.lt("date", today);
    if (data.search.trim()) {
      const term = data.search.trim().replace(/[,%()]/g, " ").replace(/\s+/g, " ");
      query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%,ref.ilike.%${term}%`);
    }
    const { data: rows, error } = await query.limit(250);
    if (error) throw new Error("Appointments could not be loaded. Please try again.");
    return rows ?? [];
  });

export const updateAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof statusInput>) => statusInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase.from("appointments").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error("That appointment couldn't be updated. Please refresh and try again.");
    return { ok: true };
  });

export const completeAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof appointmentIdInput>) => appointmentIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: appointment, error } = await context.supabase
      .from("appointments")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", data.id)
      .select("id,ref,name,phone,review_requested,review_sending_at")
      .single();
    if (error || !appointment) throw new Error("That appointment couldn't be marked complete. Please refresh and try again.");
    if (appointment.review_requested) return { ok: true as const, reviewSent: true as const };

    const { data: claim } = await context.supabase
      .from("appointments")
      .update({ review_sending_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("review_requested", false)
      .is("review_sending_at", null)
      .select("id")
      .maybeSingle();
    if (!claim) return { ok: false as const, reviewSent: false as const, message: "A review message is already being sent. Refresh to check its status." };

    const webhookUrl = process.env["N8N_WEBHOOK_URL"];
    const webhookSecret = process.env["N8N_WEBHOOK_SECRET"];
    if (!webhookUrl || !webhookSecret) {
      await context.supabase.from("appointments").update({ review_sending_at: null }).eq("id", data.id).eq("review_requested", false);
      return { ok: false as const, reviewSent: false as const, message: "Marked completed, but the review message did not send. Configure the review-message connection and retry." };
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": webhookSecret },
        body: JSON.stringify({ name: appointment.name, phone: appointment.phone, appointment_id: appointment.ref }),
      });
      if (!response.ok) throw new Error("Review message request failed");
      const { error: markError } = await context.supabase
        .from("appointments")
        .update({ review_requested: true, review_sending_at: null })
        .eq("id", data.id)
        .eq("review_requested", false);
      if (markError) return { ok: false as const, reviewSent: false as const, message: "The review message was sent, but its status could not be confirmed. Please check before retrying." };
      return { ok: true as const, reviewSent: true as const };
    } catch {
      await context.supabase.from("appointments").update({ review_sending_at: null }).eq("id", data.id).eq("review_requested", false);
      return { ok: false as const, reviewSent: false as const, message: "Marked completed, but the review message did not send." };
    }
  });