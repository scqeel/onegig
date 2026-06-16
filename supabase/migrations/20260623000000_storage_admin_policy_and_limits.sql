-- Increase file size limit for store-logos bucket to 50MB (52,428,800 bytes)
UPDATE storage.buckets 
SET file_size_limit = 52428800 
WHERE id = 'store-logos';

-- Allow admins to manage all objects in store-logos bucket
DROP POLICY IF EXISTS "Admins manage all store logos" ON storage.objects;

CREATE POLICY "Admins manage all store logos" 
ON storage.objects 
FOR ALL 
TO authenticated 
USING (
  bucket_id = 'store-logos'::text 
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'store-logos'::text 
  AND public.has_role(auth.uid(), 'admin')
);
