-- Add leave tracking columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS on_leave BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS leave_date DATE;
