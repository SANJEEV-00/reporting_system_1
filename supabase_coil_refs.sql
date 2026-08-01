-- Migration: Add Coil Reference columns to project table
ALTER TABLE public.project 
ADD COLUMN IF NOT EXISTS "Coil_Ref_1" TEXT,
ADD COLUMN IF NOT EXISTS "Coil_Ref_2" TEXT,
ADD COLUMN IF NOT EXISTS "Coil_Ref_3" TEXT,
ADD COLUMN IF NOT EXISTS "Coil_Ref_4" TEXT;

-- Optional: Create index on these columns for faster uniqueness verification queries
CREATE INDEX IF NOT EXISTS idx_project_coil_ref_1 ON public.project("Coil_Ref_1");
CREATE INDEX IF NOT EXISTS idx_project_coil_ref_2 ON public.project("Coil_Ref_2");
CREATE INDEX IF NOT EXISTS idx_project_coil_ref_3 ON public.project("Coil_Ref_3");
CREATE INDEX IF NOT EXISTS idx_project_coil_ref_4 ON public.project("Coil_Ref_4");
