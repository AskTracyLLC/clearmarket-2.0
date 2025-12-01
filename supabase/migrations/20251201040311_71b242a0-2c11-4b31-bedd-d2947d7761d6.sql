-- Add 'ended' status to vendor_connection_status enum
ALTER TYPE vendor_connection_status ADD VALUE IF NOT EXISTS 'ended';

-- Add 'ended' status to vendor_rep_agreement_status enum  
ALTER TYPE vendor_rep_agreement_status ADD VALUE IF NOT EXISTS 'ended';