-- Migration: Add Public Read Access to Lots Table
-- Description: Allows anonymous users to view lots data for their client
-- Date: 2025-11-29

-- ============================================================================
-- Add public read policy for lots table
-- ============================================================================

-- This policy allows anonymous (unauthenticated) users to SELECT lots
-- The client_id filter is handled by the application layer when querying
CREATE POLICY "Allow public read access to lots"
ON lots
FOR SELECT
USING (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Allow public read access to lots" ON lots IS 'Allows anonymous users to view lots data - client filtering handled by application layer';
