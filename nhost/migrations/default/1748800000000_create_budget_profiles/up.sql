-- Table de budget par utilisateur (1 ligne / compte Nhost Auth)
CREATE TABLE IF NOT EXISTS public.budget_profiles (
  user_id uuid PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{"salary":0,"savings":0,"charges":[],"spends":[]}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_budget_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_budget_profiles_updated_at ON public.budget_profiles;
CREATE TRIGGER set_budget_profiles_updated_at
  BEFORE UPDATE ON public.budget_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_budget_profiles_updated_at();

COMMENT ON TABLE public.budget_profiles IS 'Budget Cagnotte Jour — une ligne par utilisateur auth.users';
