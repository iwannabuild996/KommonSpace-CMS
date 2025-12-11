-- Enable Storage Policies for 'kommonspace' bucket

-- 1. Create Bucket (if not exists - handled via UI usually but good to have script)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('kommonspace', 'kommonspace', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow Authenticated users to upload
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK ( bucket_id = 'kommonspace' );

-- 3. Allow Authenticated users to view/download
CREATE POLICY "Allow authenticated downloads" ON storage.objects
FOR SELECT TO authenticated
USING ( bucket_id = 'kommonspace' );

-- 4. Allow Authenticated users to update (optional)
-- CREATE POLICY "Allow authenticated updates" ON storage.objects
-- FOR UPDATE TO authenticated
-- USING ( bucket_id = 'kommonspace' );

-- 5. Allow Authenticated users to delete (optional)
-- CREATE POLICY "Allow authenticated delete" ON storage.objects
-- FOR DELETE TO authenticated
-- USING ( bucket_id = 'kommonspace' );
