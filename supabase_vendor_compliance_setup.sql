-- Run this in Supabase SQL Editor before using vendor compliance requests
-- and vendor application document uploads from the mobile app.

ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_notification_type_check
CHECK (
  notification_type IN (
    'billing_submitted',
    'billing_payment_reminder',
    'vendor_compliance_requested'
  )
);

CREATE TABLE IF NOT EXISTS public.vendor_compliance_requests (
  compliance_request_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_id bigint NOT NULL REFERENCES public.vendor(vendor_id) ON DELETE CASCADE,
  business_owner_id bigint NOT NULL REFERENCES public.business_owner(business_owner_id) ON DELETE CASCADE,
  requested_requirements text[] NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
  requested_by_staff_id bigint REFERENCES public.leeo_staff(staff_id),
  created_at timestamp without time zone NOT NULL DEFAULT timezone('Asia/Manila', now()),
  submitted_at timestamp without time zone
);

CREATE TABLE IF NOT EXISTS public.vendor_application_documents (
  document_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_id bigint NOT NULL REFERENCES public.vendor(vendor_id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  mime_type text,
  file_size bigint,
  created_at timestamp without time zone NOT NULL DEFAULT timezone('Asia/Manila', now())
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-documents', 'vendor-documents', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

ALTER TABLE public.vendor_application_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor documents metadata read" ON public.vendor_application_documents;
CREATE POLICY "vendor documents metadata read"
ON public.vendor_application_documents
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "vendor documents metadata insert" ON public.vendor_application_documents;
CREATE POLICY "vendor documents metadata insert"
ON public.vendor_application_documents
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.vendor
    WHERE vendor.vendor_id = vendor_application_documents.vendor_id
  )
);

DROP POLICY IF EXISTS "vendor documents metadata update" ON public.vendor_application_documents;
CREATE POLICY "vendor documents metadata update"
ON public.vendor_application_documents
FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.vendor
    WHERE vendor.vendor_id = vendor_application_documents.vendor_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.vendor
    WHERE vendor.vendor_id = vendor_application_documents.vendor_id
  )
);

DROP POLICY IF EXISTS "vendor documents metadata delete" ON public.vendor_application_documents;
CREATE POLICY "vendor documents metadata delete"
ON public.vendor_application_documents
FOR DELETE
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.vendor
    WHERE vendor.vendor_id = vendor_application_documents.vendor_id
  )
);

DROP POLICY IF EXISTS "vendor documents storage read" ON storage.objects;
CREATE POLICY "vendor documents storage read"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'vendor-documents'
);

DROP POLICY IF EXISTS "vendor documents storage upload" ON storage.objects;
CREATE POLICY "vendor documents storage upload"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'vendor-documents'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.vendor
    WHERE vendor.vendor_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "vendor documents storage update" ON storage.objects;
CREATE POLICY "vendor documents storage update"
ON storage.objects
FOR UPDATE
TO anon, authenticated
USING (
  bucket_id = 'vendor-documents'
  AND EXISTS (
    SELECT 1
    FROM public.vendor
    WHERE vendor.vendor_id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'vendor-documents'
  AND EXISTS (
    SELECT 1
    FROM public.vendor
    WHERE vendor.vendor_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "vendor documents storage delete" ON storage.objects;
CREATE POLICY "vendor documents storage delete"
ON storage.objects
FOR DELETE
TO anon, authenticated
USING (
  bucket_id = 'vendor-documents'
  AND EXISTS (
    SELECT 1
    FROM public.vendor
    WHERE vendor.vendor_id::text = (storage.foldername(name))[1]
  )
);

-- The mobile app currently uses a custom app login, not a Supabase Auth session.
-- Because of that, requests use the `anon` role. These policies allow the
-- mobile client to upload under an existing vendor-id folder, for example:
-- 123/1720000000000-government-id.pdf
