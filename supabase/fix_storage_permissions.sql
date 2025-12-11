-- 1. Create the bucket 'kommonspace' if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('kommonspace', 'kommonspace', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop potential conflicting policies on storage.objects
-- Note: Modifying storage.objects policies requires appropriate permissions
DROP POLICY IF EXISTS "Kommonspace Upload" ON storage.objects;
DROP POLICY IF EXISTS "Kommonspace Select" ON storage.objects;
DROP POLICY IF EXISTS "Kommonspace Update" ON storage.objects;
DROP POLICY IF EXISTS "Kommonspace Delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated downloads" ON storage.objects;

-- 3. Create comprehensive policies for authenticated users
-- INSERT
CREATE POLICY "Kommonspace Upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK ( bucket_id = 'kommonspace' );

-- SELECT
CREATE POLICY "Kommonspace Select" ON storage.objects
FOR SELECT TO authenticated
USING ( bucket_id = 'kommonspace' );

-- UPDATE
CREATE POLICY "Kommonspace Update" ON storage.objects
FOR UPDATE TO authenticated
USING ( bucket_id = 'kommonspace' );

-- DELETE
CREATE POLICY "Kommonspace Delete" ON storage.objects
FOR DELETE TO authenticated
USING ( bucket_id = 'kommonspace' );
