import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/staff/login" });
    const { data: isStaff, error: roleError } = await supabase.rpc("has_role", {
      _user_id: data.user.id,
      _role: "staff",
    });
    if (roleError || !isStaff) {
      await supabase.auth.signOut();
      throw redirect({ to: "/staff/login" });
    }
  },
  component: () => <Outlet />,
});