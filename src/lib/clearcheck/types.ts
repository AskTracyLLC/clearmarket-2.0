
export type ClearCheckImportType = 
  | 'EZ_NEEDS_UPDATE'
  | 'IA_NEEDS_UPDATE'
  | 'IA_FOLLOW_UP'
  | 'EZ_STATUS_REFRESH'
  | 'IA_SUBMITTED_REFRESH'
  | 'IA_CANCELED_REFRESH';

export interface ClearCheckOrder {
  id: string;
  order_instance_key: string;
  system: 'EZ' | 'IA';
  job_id: string;
  job_name?: string;
  service?: string;
  ect?: string; // date string
  street?: string;
  city?: string;
  state?: string;
  county?: string;
  zip?: string;
  rep_display_name?: string;
  status?: string; // Original system status
  client_primary?: string;
  subclient?: string;
  due_client?: string; // date string
  due_rep?: string; // date string
  start_date?: string; // date string
  created_date?: string; // date string
  completed_date?: string; // date string
  submitted_date?: string; // date string
  form?: string;
  
  // Computed/Logic
  is_open?: boolean;
  days_late?: number; // Computed by DB or Frontend

  // Operational
  current_ecd?: string; // date string
  current_delay_reason_code?: string;
  current_delay_reason_label?: string;

  updated_at?: string;
}

export interface ClearCheckOrderRow extends ClearCheckOrder {
  // Frontend specific logic helpers
  is_past_due_derived?: boolean;
}
