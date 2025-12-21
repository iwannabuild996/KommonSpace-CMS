-- Add unique constraint to phone column
-- This will fail if there are existing duplicates. 
-- Run check_duplicate_phones.sql first to identify and resolve duplicates.

ALTER TABLE users 
ADD CONSTRAINT users_phone_key UNIQUE (phone);
