-- Astrologer's chosen app (interface) language; separate from the languages they consult in.
ALTER TABLE astrologer_profiles ADD COLUMN app_language text NOT NULL DEFAULT 'en';
