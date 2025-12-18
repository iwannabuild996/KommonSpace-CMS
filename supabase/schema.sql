-- Enums
CREATE TYPE subscription_status AS ENUM (
  'Advance Received',
  'Paper Collected',
  'Documents Ready',
  'Completed'
);

CREATE TYPE rubber_stamp_status AS ENUM (
  'Not Available',
  'Available',
  'With Client'
);

CREATE TYPE signatory_type AS ENUM (
  'company',
  'individual'
);

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_users (
  user_id uuid NOT NULL,
  role text DEFAULT 'admin'::text,
  CONSTRAINT admin_users_pkey PRIMARY KEY (user_id),
  CONSTRAINT admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric,
  features jsonb,
  status boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT plans_pkey PRIMARY KEY (id)
);
CREATE TABLE public.subscription_companies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL UNIQUE,
  name text,
  cin text,
  pan text,
  tan text,
  address text,
  created_at timestamp without time zone DEFAULT now(),
  coi_file_path text,
  coi_file_name text,
  CONSTRAINT subscription_companies_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_companies_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id)
);
CREATE TABLE public.subscription_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  label USER-DEFINED NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  file_size_bytes bigint,
  uploaded_by uuid,
  created_at timestamp without time zone DEFAULT now(),
  extracted_data jsonb,
  CONSTRAINT subscription_files_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_files_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id)
);
CREATE TABLE public.subscription_signatories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL UNIQUE,
  name text,
  designation text,
  aadhaar_number text,
  address text,
  created_at timestamp without time zone DEFAULT now(),
  aadhaar_file_path text,
  aadhaar_file_name text,
  CONSTRAINT subscription_signatories_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_signatories_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id)
);
CREATE TABLE public.subscription_status_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid,
  old_status USER-DEFINED,
  new_status USER-DEFINED NOT NULL,
  changed_by uuid,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT subscription_status_logs_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_status_logs_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id),
  CONSTRAINT subscription_status_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.admin_users(user_id)
);
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  plan_id uuid,
  purchased_date date,
  start_date date,
  expiry_date date,
  purchase_amount numeric,
  received_amount numeric,
  status USER-DEFINED DEFAULT 'Advance Received'::subscription_status,
  suite_number text,
  rubber_stamp USER-DEFINED DEFAULT 'Not Available'::rubber_stamp_status,
  signatory_type USER-DEFINED,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id)
);
CREATE TABLE public.suite_numbers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  suite_number text NOT NULL UNIQUE,
  status text DEFAULT 'available'::text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT suite_numbers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);