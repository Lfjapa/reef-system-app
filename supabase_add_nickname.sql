-- Migration: adiciona coluna nickname na tabela bio_entries
-- Execute no Supabase SQL Editor

ALTER TABLE bio_entries
  ADD COLUMN IF NOT EXISTS nickname text NOT NULL DEFAULT '';
