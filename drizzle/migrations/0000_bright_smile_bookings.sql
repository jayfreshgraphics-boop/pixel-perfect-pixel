CREATE TYPE public.app_role AS ENUM ('staff');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read their own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Staff can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own staff role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = _role
  );
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_staff_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''), split_part(COALESCE(NEW.email, 'Clinic staff'), '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'staff')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_staff_user() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created_add_bright_smile_staff
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_staff_user();

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL UNIQUE,
  name text NOT NULL,
  phone text NOT NULL,
  service text NOT NULL,
  date date NOT NULL,
  time text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'confirmed', 'completed', 'cancelled', 'no_show')),
  completed_at timestamptz,
  review_requested boolean NOT NULL DEFAULT false,
  review_sending_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_ref_format CHECK (ref ~ '^BS-[0-9]{4}$')
);
GRANT INSERT ON public.appointments TO anon;
GRANT SELECT, UPDATE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anonymous visitors can only create booked appointments" ON public.appointments FOR INSERT TO anon WITH CHECK (status = 'booked');
CREATE POLICY "Staff can view appointments" ON public.appointments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff can update appointments" ON public.appointments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'staff')) WITH CHECK (public.has_role(auth.uid(), 'staff'));
CREATE UNIQUE INDEX appointments_active_slot_unique ON public.appointments (date, time) WHERE status NOT IN ('cancelled', 'no_show');
CREATE INDEX appointments_date_time_idx ON public.appointments (date, time);
COMMENT ON TABLE public.appointments IS 'Patient data is restricted to staff; anonymous callers can only create appointments.';

CREATE OR REPLACE FUNCTION public.is_valid_clinic_slot(slot_date date, slot_time text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN extract(isodow FROM slot_date) BETWEEN 1 AND 5 THEN slot_time ~ '^(0[9]|1[0-6]):00$'
    WHEN extract(isodow FROM slot_date) = 6 THEN slot_time ~ '^(09|1[0-3]):00$'
    ELSE false
  END;
$$;
REVOKE ALL ON FUNCTION public.is_valid_clinic_slot(date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_clinic_slot(date, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_public_appointment_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  lagos_today date := (now() AT TIME ZONE 'Africa/Lagos')::date;
BEGIN
  IF auth.role() = 'anon' THEN
    IF NEW.date < lagos_today OR NEW.date > lagos_today + 29 OR NOT public.is_valid_clinic_slot(NEW.date, NEW.time) THEN
      RAISE EXCEPTION 'Choose an available clinic date and time' USING ERRCODE = '22023';
    END IF;
    IF NEW.date = lagos_today AND NEW.time::time <= (now() AT TIME ZONE 'Africa/Lagos')::time THEN
      RAISE EXCEPTION 'Choose a future clinic time' USING ERRCODE = '22023';
    END IF;
    IF length(trim(NEW.name)) NOT BETWEEN 2 AND 100
      OR NEW.phone !~ '^(\+234|0)(70|80|81|90|91)[0-9]{8}$'
      OR length(trim(NEW.service)) = 0
      OR (NEW.notes IS NOT NULL AND length(NEW.notes) > 1000) THEN
      RAISE EXCEPTION 'Check the appointment details and try again' USING ERRCODE = '22023';
    END IF;
    IF NEW.service NOT IN ('General check-up and cleaning', 'Scaling and polishing', 'Fillings', 'Tooth extraction', 'Root canal treatment', 'Teeth whitening', 'Braces and aligners consultation', 'Children''s dentistry') THEN
      RAISE EXCEPTION 'Choose a listed clinic service' USING ERRCODE = '22023';
    END IF;
    NEW.status := 'booked';
    NEW.completed_at := NULL;
    NEW.review_requested := false;
    NEW.review_sending_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_public_appointment_insert() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enforce_public_appointment_insert
  BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_public_appointment_insert();

CREATE OR REPLACE FUNCTION public.get_booked_slots(p_date date)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT a.time
  FROM public.appointments AS a
  WHERE a.date = p_date AND a.status NOT IN ('cancelled', 'no_show')
  ORDER BY a.time;
$$;
REVOKE ALL ON FUNCTION public.get_booked_slots(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(date) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_appointment(
  p_name text,
  p_phone text,
  p_service text,
  p_date date,
  p_time text,
  p_notes text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  generated_ref text;
  lagos_today date := (now() AT TIME ZONE 'Africa/Lagos')::date;
BEGIN
  IF p_date < lagos_today OR p_date > lagos_today + 29
    OR NOT public.is_valid_clinic_slot(p_date, p_time)
    OR (p_date = lagos_today AND p_time::time <= (now() AT TIME ZONE 'Africa/Lagos')::time) THEN
    RAISE EXCEPTION 'That clinic time is not available' USING ERRCODE = '22023';
  END IF;
  IF length(trim(p_name)) NOT BETWEEN 2 AND 100
    OR p_phone !~ '^(\+234|0)(70|80|81|90|91)[0-9]{8}$'
    OR (p_notes IS NOT NULL AND length(p_notes) > 1000) THEN
    RAISE EXCEPTION 'Check the appointment details and try again' USING ERRCODE = '22023';
  END IF;
  IF p_service NOT IN ('General check-up and cleaning', 'Scaling and polishing', 'Fillings', 'Tooth extraction', 'Root canal treatment', 'Teeth whitening', 'Braces and aligners consultation', 'Children''s dentistry') THEN
    RAISE EXCEPTION 'Choose a listed clinic service' USING ERRCODE = '22023';
  END IF;
  LOOP
    generated_ref := 'BS-' || lpad(floor(random() * 10000)::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.appointments WHERE ref = generated_ref);
  END LOOP;
  INSERT INTO public.appointments (ref, name, phone, service, date, time, notes, status)
  VALUES (generated_ref, trim(p_name), p_phone, p_service, p_date, p_time, NULLIF(trim(COALESCE(p_notes, '')), ''), 'booked');
  RETURN generated_ref;
END;
$$;
REVOKE ALL ON FUNCTION public.create_appointment(text, text, text, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_appointment(text, text, text, date, text, text) TO anon, authenticated;
