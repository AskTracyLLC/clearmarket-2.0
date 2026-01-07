export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action_details: Json | null
          action_summary: string
          action_type: string
          actor_user_id: string
          created_at: string
          id: string
          ip_address: string | null
          source_page: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action_details?: Json | null
          action_summary: string
          action_type: string
          actor_user_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          source_page?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action_details?: Json | null
          action_summary?: string
          action_type?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          source_page?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_broadcast_feedback: {
        Row: {
          allow_name: boolean
          allow_spotlight: boolean
          created_at: string
          dislike_text: string | null
          id: string
          like_text: string | null
          rating: number
          recipient_id: string
          suggestion_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_name?: boolean
          allow_spotlight?: boolean
          created_at?: string
          dislike_text?: string | null
          id?: string
          like_text?: string | null
          rating: number
          recipient_id: string
          suggestion_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_name?: boolean
          allow_spotlight?: boolean
          created_at?: string
          dislike_text?: string | null
          id?: string
          like_text?: string | null
          rating?: number
          recipient_id?: string
          suggestion_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_broadcast_feedback_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: true
            referencedRelation: "admin_broadcast_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_broadcast_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_broadcast_recipients: {
        Row: {
          broadcast_id: string
          created_at: string
          email_error: string | null
          email_provider_id: string | null
          emailed_at: string | null
          id: string
          notification_id: string | null
          opened_at: string | null
          responded_at: string | null
          user_id: string
        }
        Insert: {
          broadcast_id: string
          created_at?: string
          email_error?: string | null
          email_provider_id?: string | null
          emailed_at?: string | null
          id?: string
          notification_id?: string | null
          opened_at?: string | null
          responded_at?: string | null
          user_id: string
        }
        Update: {
          broadcast_id?: string
          created_at?: string
          email_error?: string | null
          email_provider_id?: string | null
          emailed_at?: string | null
          id?: string
          notification_id?: string | null
          opened_at?: string | null
          responded_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_broadcast_recipients_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "admin_broadcast_metrics"
            referencedColumns: ["broadcast_id"]
          },
          {
            foreignKeyName: "admin_broadcast_recipients_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "admin_broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_broadcast_recipients_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_broadcast_recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_broadcasts: {
        Row: {
          audience: Json
          created_at: string
          created_by: string | null
          cta_label: string
          email_subject: string | null
          id: string
          message_md: string
          send_at: string | null
          sent_at: string | null
          stats: Json
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          audience?: Json
          created_at?: string
          created_by?: string | null
          cta_label?: string
          email_subject?: string | null
          id?: string
          message_md: string
          send_at?: string | null
          sent_at?: string | null
          stats?: Json
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: Json
          created_at?: string
          created_by?: string | null
          cta_label?: string
          email_subject?: string | null
          id?: string
          message_md?: string
          send_at?: string | null
          sent_at?: string | null
          stats?: Json
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_broadcasts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      background_checks: {
        Row: {
          check_id: string
          created_at: string
          expiration_date: string | null
          field_rep_id: string
          id: string
          provider: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          screenshot_url: string
          status: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          check_id: string
          created_at?: string
          expiration_date?: string | null
          field_rep_id: string
          id?: string
          provider: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          screenshot_url: string
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          check_id?: string
          created_at?: string
          expiration_date?: string | null
          field_rep_id?: string
          id?: string
          provider?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          screenshot_url?: string
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "background_checks_field_rep_id_fkey"
            columns: ["field_rep_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_checks_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "beta_invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_assignment_events: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          notes: string | null
          source: string
          template_id: string
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          source: string
          template_id: string
          user_id: string
          vendor_id?: string | null
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          source?: string
          template_id?: string
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_assignment_events_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_assignment_events_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_assignment_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_assignment_events_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_item_feedback: {
        Row: {
          attachment_urls: string[] | null
          created_at: string
          feedback_type: Database["public"]["Enums"]["checklist_feedback_type"]
          fixed_at: string | null
          id: string
          item_id: string
          message: string
          resolved_at: string | null
          resolved_by: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["checklist_feedback_status"]
          template_id: string
          user_checklist_item_id: string | null
          user_id: string
        }
        Insert: {
          attachment_urls?: string[] | null
          created_at?: string
          feedback_type: Database["public"]["Enums"]["checklist_feedback_type"]
          fixed_at?: string | null
          id?: string
          item_id: string
          message: string
          resolved_at?: string | null
          resolved_by?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["checklist_feedback_status"]
          template_id: string
          user_checklist_item_id?: string | null
          user_id: string
        }
        Update: {
          attachment_urls?: string[] | null
          created_at?: string
          feedback_type?: Database["public"]["Enums"]["checklist_feedback_type"]
          fixed_at?: string | null
          id?: string
          item_id?: string
          message?: string
          resolved_at?: string | null
          resolved_by?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["checklist_feedback_status"]
          template_id?: string
          user_checklist_item_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_item_feedback_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_item_feedback_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_item_feedback_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_item_feedback_user_checklist_item_id_fkey"
            columns: ["user_checklist_item_id"]
            isOneToOne: false
            referencedRelation: "user_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_item_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          auto_track_key: string | null
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          role: Database["public"]["Enums"]["checklist_role"]
          sort_order: number
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          auto_track_key?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          role?: Database["public"]["Enums"]["checklist_role"]
          sort_order?: number
          template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          auto_track_key?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          role?: Database["public"]["Enums"]["checklist_role"]
          sort_order?: number
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          auto_assign_on_connect: boolean | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          owner_id: string | null
          owner_type: Database["public"]["Enums"]["checklist_owner_type"]
          requires_paid_plan: boolean
          role: Database["public"]["Enums"]["checklist_role"]
          updated_at: string
        }
        Insert: {
          auto_assign_on_connect?: boolean | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          owner_id?: string | null
          owner_type?: Database["public"]["Enums"]["checklist_owner_type"]
          requires_paid_plan?: boolean
          role: Database["public"]["Enums"]["checklist_role"]
          updated_at?: string
        }
        Update: {
          auto_assign_on_connect?: boolean | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          owner_id?: string | null
          owner_type?: Database["public"]["Enums"]["checklist_owner_type"]
          requires_paid_plan?: boolean
          role?: Database["public"]["Enums"]["checklist_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          helpful_count: number
          id: string
          not_helpful_count: number
          parent_comment_id: string | null
          post_id: string
          status: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          helpful_count?: number
          id?: string
          not_helpful_count?: number
          parent_comment_id?: string | null
          post_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          helpful_count?: number
          id?: string
          not_helpful_count?: number
          parent_comment_id?: string | null
          post_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_watchers: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_watchers_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_post_watchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_anonymous_id: string | null
          author_id: string
          author_role: string | null
          body: string
          category: string
          channel: string
          comments_count: number
          created_at: string
          helpful_count: number
          id: string
          image_urls: string[] | null
          not_helpful_count: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_anonymous_id?: string | null
          author_id: string
          author_role?: string | null
          body: string
          category: string
          channel?: string
          comments_count?: number
          created_at?: string
          helpful_count?: number
          id?: string
          image_urls?: string[] | null
          not_helpful_count?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_anonymous_id?: string | null
          author_id?: string
          author_role?: string | null
          body?: string
          category?: string
          channel?: string
          comments_count?: number
          created_at?: string
          helpful_count?: number
          id?: string
          image_urls?: string[] | null
          not_helpful_count?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_votes: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_type: string
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          target_type: string
          user_id: string
          vote_type: string
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_agreement_areas: {
        Row: {
          base_rate: number | null
          connection_id: string
          county_name: string | null
          created_at: string
          effective_end: string | null
          effective_start: string
          id: string
          inspection_category: string | null
          inspection_type_id: string | null
          rush_rate: number | null
          source_working_terms_row_id: string | null
          state_code: string
          status: string
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          base_rate?: number | null
          connection_id: string
          county_name?: string | null
          created_at?: string
          effective_end?: string | null
          effective_start?: string
          id?: string
          inspection_category?: string | null
          inspection_type_id?: string | null
          rush_rate?: number | null
          source_working_terms_row_id?: string | null
          state_code: string
          status?: string
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          base_rate?: number | null
          connection_id?: string
          county_name?: string | null
          created_at?: string
          effective_end?: string | null
          effective_start?: string
          id?: string
          inspection_category?: string | null
          inspection_type_id?: string | null
          rush_rate?: number | null
          source_working_terms_row_id?: string | null
          state_code?: string
          status?: string
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connection_agreement_areas_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "vendor_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_agreement_areas_inspection_type_id_fkey"
            columns: ["inspection_type_id"]
            isOneToOne: false
            referencedRelation: "inspection_type_options"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_notes: {
        Row: {
          author_id: string
          created_at: string
          id: string
          note: string
          rep_id: string
          side: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          note: string
          rep_id: string
          side: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          note?: string
          rep_id?: string
          side?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_notes_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_notes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_reviews: {
        Row: {
          communication_rating: number | null
          created_at: string
          id: string
          is_flagged: boolean
          is_public: boolean
          notes: string | null
          on_time_rating: number | null
          post_id: string | null
          quality_rating: number | null
          rating_communication: number | null
          rating_on_time: number | null
          rating_quality: number | null
          rep_interest_id: string
          rep_user_id: string
          reviewer_id: string
          reviewer_role: string
          source: string
          subject_id: string
          summary_comment: string | null
          updated_at: string
          vendor_user_id: string
        }
        Insert: {
          communication_rating?: number | null
          created_at?: string
          id?: string
          is_flagged?: boolean
          is_public?: boolean
          notes?: string | null
          on_time_rating?: number | null
          post_id?: string | null
          quality_rating?: number | null
          rating_communication?: number | null
          rating_on_time?: number | null
          rating_quality?: number | null
          rep_interest_id: string
          rep_user_id: string
          reviewer_id: string
          reviewer_role: string
          source?: string
          subject_id: string
          summary_comment?: string | null
          updated_at?: string
          vendor_user_id: string
        }
        Update: {
          communication_rating?: number | null
          created_at?: string
          id?: string
          is_flagged?: boolean
          is_public?: boolean
          notes?: string | null
          on_time_rating?: number | null
          post_id?: string | null
          quality_rating?: number | null
          rating_communication?: number | null
          rating_on_time?: number | null
          rating_quality?: number | null
          rep_interest_id?: string
          rep_user_id?: string
          reviewer_id?: string
          reviewer_role?: string
          source?: string
          subject_id?: string
          summary_comment?: string | null
          updated_at?: string
          vendor_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_reviews_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "seeking_coverage_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_reviews_rep_interest_id_fkey"
            columns: ["rep_interest_id"]
            isOneToOne: false
            referencedRelation: "rep_interest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_reviews_rep_user_id_fkey"
            columns: ["rep_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_reviews_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_reviews_vendor_user_id_fkey"
            columns: ["vendor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          hidden_for_one: boolean
          hidden_for_two: boolean
          id: string
          is_pinned_for_one: boolean | null
          is_pinned_for_two: boolean | null
          last_message_at: string | null
          last_message_preview: string | null
          origin_post_id: string | null
          origin_type: string | null
          participant_one: string
          participant_two: string
          post_title_snapshot: string | null
          rep_interest_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          hidden_for_one?: boolean
          hidden_for_two?: boolean
          id?: string
          is_pinned_for_one?: boolean | null
          is_pinned_for_two?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          origin_post_id?: string | null
          origin_type?: string | null
          participant_one: string
          participant_two: string
          post_title_snapshot?: string | null
          rep_interest_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          hidden_for_one?: boolean
          hidden_for_two?: boolean
          id?: string
          is_pinned_for_one?: boolean | null
          is_pinned_for_two?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          origin_post_id?: string | null
          origin_type?: string | null
          participant_one?: string
          participant_two?: string
          post_title_snapshot?: string | null
          rep_interest_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_origin_post_id_fkey"
            columns: ["origin_post_id"]
            isOneToOne: false
            referencedRelation: "seeking_coverage_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_one_fkey"
            columns: ["participant_one"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_two_fkey"
            columns: ["participant_two"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_rep_interest_id_fkey"
            columns: ["rep_interest_id"]
            isOneToOne: false
            referencedRelation: "rep_interest"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          document_type: string
          id: string
          metadata: Json | null
          signature_timestamp: string | null
          signed_name: string | null
          storage_path: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type: string
          id?: string
          metadata?: Json | null
          signature_timestamp?: string | null
          signed_name?: string | null
          storage_path?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          id?: string
          metadata?: Json | null
          signature_timestamp?: string | null
          signed_name?: string | null
          storage_path?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_template: string
          category: string
          created_at: string
          description: string | null
          id: string
          key: string
          placeholders_hint: string | null
          subject_template: string
          updated_at: string
        }
        Insert: {
          body_template: string
          category: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
          placeholders_hint?: string | null
          subject_template: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          placeholders_hint?: string | null
          subject_template?: string
          updated_at?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          beta_note: string | null
          created_at: string
          description: string | null
          id: string
          is_enabled: boolean
          is_paid: boolean
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          beta_note?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          is_paid?: boolean
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          beta_note?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          is_paid?: boolean
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      help_center_articles: {
        Row: {
          category: string
          content: string
          created_at: string
          display_order: number
          id: string
          is_published: boolean
          last_updated_at: string
          last_updated_by: string | null
          slug: string
          title: string
        }
        Insert: {
          category: string
          content?: string
          created_at?: string
          display_order?: number
          id?: string
          is_published?: boolean
          last_updated_at?: string
          last_updated_by?: string | null
          slug: string
          title: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          display_order?: number
          id?: string
          is_published?: boolean
          last_updated_at?: string
          last_updated_by?: string | null
          slug?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_center_articles_last_updated_by_fkey"
            columns: ["last_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_categories: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      inspection_type_options: {
        Row: {
          applies_to: string
          category: string
          category_id: string | null
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          applies_to?: string
          category: string
          category_id?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          applies_to?: string
          category?: string
          category_id?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_type_options_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inspection_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string | null
          created_at: string
          id: string
          read: boolean
          recipient_id: string
          sender_id: string
          subject: string | null
        }
        Insert: {
          body: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          read?: boolean
          recipient_id: string
          sender_id: string
          subject?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string
          sender_id?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          digest_connections: boolean
          digest_messages: boolean
          digest_reviews: boolean
          digest_system: boolean
          email_connections: boolean
          email_messages: boolean
          email_reviews: boolean
          email_system: boolean
          notify_connection_accepted: boolean
          notify_connection_request: boolean
          notify_credits_events: boolean
          notify_new_message: boolean
          notify_review_received: boolean
          notify_system_updates: boolean
          sound_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digest_connections?: boolean
          digest_messages?: boolean
          digest_reviews?: boolean
          digest_system?: boolean
          email_connections?: boolean
          email_messages?: boolean
          email_reviews?: boolean
          email_system?: boolean
          notify_connection_accepted?: boolean
          notify_connection_request?: boolean
          notify_credits_events?: boolean
          notify_new_message?: boolean
          notify_review_received?: boolean
          notify_system_updates?: boolean
          sound_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          digest_connections?: boolean
          digest_messages?: boolean
          digest_reviews?: boolean
          digest_system?: boolean
          email_connections?: boolean
          email_messages?: boolean
          email_reviews?: boolean
          email_system?: boolean
          notify_connection_accepted?: boolean
          notify_connection_request?: boolean
          notify_credits_events?: boolean
          notify_new_message?: boolean
          notify_review_received?: boolean
          notify_system_updates?: boolean
          sound_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          digest_sent_at: string | null
          email_sent_at: string | null
          id: string
          is_deleted: boolean
          is_read: boolean
          metadata: Json | null
          read_at: string | null
          ref_id: string | null
          review_later: boolean
          status: string | null
          target_url: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          digest_sent_at?: string | null
          email_sent_at?: string | null
          id?: string
          is_deleted?: boolean
          is_read?: boolean
          metadata?: Json | null
          read_at?: string | null
          ref_id?: string | null
          review_later?: boolean
          status?: string | null
          target_url?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          digest_sent_at?: string | null
          email_sent_at?: string | null
          id?: string
          is_deleted?: boolean
          is_read?: boolean
          metadata?: Json | null
          read_at?: string | null
          ref_id?: string | null
          review_later?: boolean
          status?: string | null
          target_url?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_credit_purchases: {
        Row: {
          amount_cents: number | null
          completed_at: string | null
          confirmation_email_id: string | null
          confirmation_email_sent_at: string | null
          created_at: string
          credit_pack_id: string
          credits_to_add: number
          currency: string | null
          id: string
          status: string
          stripe_checkout_session_id: string
          stripe_payment_intent_id: string | null
          stripe_price_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          completed_at?: string | null
          confirmation_email_id?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string
          credit_pack_id: string
          credits_to_add: number
          currency?: string | null
          id?: string
          status?: string
          stripe_checkout_session_id: string
          stripe_payment_intent_id?: string | null
          stripe_price_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          completed_at?: string | null
          confirmation_email_id?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string
          credit_pack_id?: string
          credits_to_add?: number
          currency?: string | null
          id?: string
          status?: string
          stripe_checkout_session_id?: string
          stripe_payment_intent_id?: string | null
          stripe_price_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_credit_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_saves: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          active_role: string | null
          community_score: number
          community_score_last_calculated: string | null
          created_at: string
          deactivated_at: string | null
          deactivated_reason: string | null
          email: string
          email_opt_in_admin_updates: boolean
          full_name: string | null
          has_signed_terms: boolean
          id: string
          is_admin: boolean
          is_fieldrep: boolean
          is_moderator: boolean
          is_super_admin: boolean
          is_support: boolean
          is_vendor_admin: boolean
          is_vendor_staff: boolean
          last_seen_at: string | null
          share_profile_enabled: boolean | null
          share_profile_last_generated_at: string | null
          share_profile_slug: string | null
          staff_anonymous_id: string | null
          staff_invite_note: string | null
          staff_invite_sent_at: string | null
          staff_invited_at: string | null
          staff_role: string | null
          terms_signed_at: string | null
          terms_version: string | null
          updated_at: string
          used_invite_code: string | null
        }
        Insert: {
          account_status?: string
          active_role?: string | null
          community_score?: number
          community_score_last_calculated?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivated_reason?: string | null
          email: string
          email_opt_in_admin_updates?: boolean
          full_name?: string | null
          has_signed_terms?: boolean
          id: string
          is_admin?: boolean
          is_fieldrep?: boolean
          is_moderator?: boolean
          is_super_admin?: boolean
          is_support?: boolean
          is_vendor_admin?: boolean
          is_vendor_staff?: boolean
          last_seen_at?: string | null
          share_profile_enabled?: boolean | null
          share_profile_last_generated_at?: string | null
          share_profile_slug?: string | null
          staff_anonymous_id?: string | null
          staff_invite_note?: string | null
          staff_invite_sent_at?: string | null
          staff_invited_at?: string | null
          staff_role?: string | null
          terms_signed_at?: string | null
          terms_version?: string | null
          updated_at?: string
          used_invite_code?: string | null
        }
        Update: {
          account_status?: string
          active_role?: string | null
          community_score?: number
          community_score_last_calculated?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivated_reason?: string | null
          email?: string
          email_opt_in_admin_updates?: boolean
          full_name?: string | null
          has_signed_terms?: boolean
          id?: string
          is_admin?: boolean
          is_fieldrep?: boolean
          is_moderator?: boolean
          is_super_admin?: boolean
          is_support?: boolean
          is_vendor_admin?: boolean
          is_vendor_staff?: boolean
          last_seen_at?: string | null
          share_profile_enabled?: boolean | null
          share_profile_last_generated_at?: string | null
          share_profile_slug?: string | null
          staff_anonymous_id?: string | null
          staff_invite_note?: string | null
          staff_invite_sent_at?: string | null
          staff_invited_at?: string | null
          staff_role?: string | null
          terms_signed_at?: string | null
          terms_version?: string | null
          updated_at?: string
          used_invite_code?: string | null
        }
        Relationships: []
      }
      rep_availability: {
        Row: {
          auto_reply_enabled: boolean
          auto_reply_message: string | null
          created_at: string
          end_date: string
          id: string
          reason: string | null
          rep_user_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          auto_reply_enabled?: boolean
          auto_reply_message?: string | null
          created_at?: string
          end_date: string
          id?: string
          reason?: string | null
          rep_user_id: string
          start_date: string
          updated_at?: string
        }
        Update: {
          auto_reply_enabled?: boolean
          auto_reply_message?: string | null
          created_at?: string
          end_date?: string
          id?: string
          reason?: string | null
          rep_user_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_availability_rep_user_id_fkey"
            columns: ["rep_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_contact_unlocks: {
        Row: {
          created_at: string
          id: string
          rep_user_id: string
          vendor_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rep_user_id: string
          vendor_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rep_user_id?: string
          vendor_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_contact_unlocks_rep_user_id_fkey"
            columns: ["rep_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_contact_unlocks_vendor_user_id_fkey"
            columns: ["vendor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_coverage_areas: {
        Row: {
          base_price: number | null
          county_id: string | null
          county_name: string | null
          coverage_mode: string | null
          covers_entire_county: boolean
          covers_entire_state: boolean
          created_at: string
          id: string
          inspection_types: string[] | null
          region_note: string | null
          rush_price: number | null
          state_code: string
          state_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_price?: number | null
          county_id?: string | null
          county_name?: string | null
          coverage_mode?: string | null
          covers_entire_county?: boolean
          covers_entire_state?: boolean
          created_at?: string
          id?: string
          inspection_types?: string[] | null
          region_note?: string | null
          rush_price?: number | null
          state_code: string
          state_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_price?: number | null
          county_id?: string | null
          county_name?: string | null
          coverage_mode?: string | null
          covers_entire_county?: boolean
          covers_entire_state?: boolean
          created_at?: string
          id?: string
          inspection_types?: string[] | null
          region_note?: string | null
          rush_price?: number | null
          state_code?: string
          state_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_coverage_areas_county_id_fkey"
            columns: ["county_id"]
            isOneToOne: false
            referencedRelation: "us_counties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_coverage_areas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_interest: {
        Row: {
          connected_at: string | null
          created_at: string
          declined_at: string | null
          declined_by_user_id: string | null
          declined_reason: string | null
          id: string
          last_reminder_sent_at: string | null
          not_interested_reason: string | null
          post_id: string
          rep_id: string
          status: string
          updated_at: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          declined_at?: string | null
          declined_by_user_id?: string | null
          declined_reason?: string | null
          id?: string
          last_reminder_sent_at?: string | null
          not_interested_reason?: string | null
          post_id: string
          rep_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          declined_at?: string | null
          declined_by_user_id?: string | null
          declined_reason?: string | null
          id?: string
          last_reminder_sent_at?: string | null
          not_interested_reason?: string | null
          post_id?: string
          rep_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_interest_declined_by_user_id_fkey"
            columns: ["declined_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_interest_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "seeking_coverage_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_interest_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "rep_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_match_settings: {
        Row: {
          created_at: string
          id: string
          inspection_types: string[] | null
          minimum_pay: number | null
          notify_email: boolean
          notify_in_app: boolean
          states_interested: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inspection_types?: string[] | null
          minimum_pay?: number | null
          notify_email?: boolean
          notify_in_app?: boolean
          states_interested?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inspection_types?: string[] | null
          minimum_pay?: number | null
          notify_email?: boolean
          notify_in_app?: boolean
          states_interested?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_match_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_network_alerts: {
        Row: {
          body: string
          created_at: string
          error_message: string | null
          id: string
          recipient_count: number | null
          scheduled_at: string | null
          send_mode: string
          sent_at: string | null
          status: string
          target_scope: string
          target_state_codes: string[] | null
          title: string
          vendor_id: string
        }
        Insert: {
          body: string
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_count?: number | null
          scheduled_at?: string | null
          send_mode?: string
          sent_at?: string | null
          status?: string
          target_scope?: string
          target_state_codes?: string[] | null
          title: string
          vendor_id: string
        }
        Update: {
          body?: string
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_count?: number | null
          scheduled_at?: string | null
          send_mode?: string
          sent_at?: string | null
          status?: string
          target_scope?: string
          target_state_codes?: string[] | null
          title?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_network_alerts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_profile: {
        Row: {
          anonymous_id: string | null
          background_check_expires_on: string | null
          background_check_id: string | null
          background_check_is_active: boolean | null
          background_check_provider: string | null
          background_check_provider_other_name: string | null
          background_check_screenshot_url: string | null
          bio: string | null
          business_name: string | null
          certifications: string[] | null
          city: string | null
          coverage_areas: string[] | null
          created_at: string
          equipment_notes: string | null
          has_hud_keys: boolean | null
          hud_keys_details: string | null
          id: string
          inspection_types: string[] | null
          is_accepting_new_vendors: boolean | null
          open_to_new_systems: boolean
          state: string | null
          systems_used: string[] | null
          unavailable_from: string | null
          unavailable_note: string | null
          unavailable_to: string | null
          updated_at: string
          user_id: string
          willing_to_obtain_background_check: boolean | null
          willing_to_travel_out_of_state: boolean | null
          zip_code: string | null
        }
        Insert: {
          anonymous_id?: string | null
          background_check_expires_on?: string | null
          background_check_id?: string | null
          background_check_is_active?: boolean | null
          background_check_provider?: string | null
          background_check_provider_other_name?: string | null
          background_check_screenshot_url?: string | null
          bio?: string | null
          business_name?: string | null
          certifications?: string[] | null
          city?: string | null
          coverage_areas?: string[] | null
          created_at?: string
          equipment_notes?: string | null
          has_hud_keys?: boolean | null
          hud_keys_details?: string | null
          id?: string
          inspection_types?: string[] | null
          is_accepting_new_vendors?: boolean | null
          open_to_new_systems?: boolean
          state?: string | null
          systems_used?: string[] | null
          unavailable_from?: string | null
          unavailable_note?: string | null
          unavailable_to?: string | null
          updated_at?: string
          user_id: string
          willing_to_obtain_background_check?: boolean | null
          willing_to_travel_out_of_state?: boolean | null
          zip_code?: string | null
        }
        Update: {
          anonymous_id?: string | null
          background_check_expires_on?: string | null
          background_check_id?: string | null
          background_check_is_active?: boolean | null
          background_check_provider?: string | null
          background_check_provider_other_name?: string | null
          background_check_screenshot_url?: string | null
          bio?: string | null
          business_name?: string | null
          certifications?: string[] | null
          city?: string | null
          coverage_areas?: string[] | null
          created_at?: string
          equipment_notes?: string | null
          has_hud_keys?: boolean | null
          hud_keys_details?: string | null
          id?: string
          inspection_types?: string[] | null
          is_accepting_new_vendors?: boolean | null
          open_to_new_systems?: boolean
          state?: string | null
          systems_used?: string[] | null
          unavailable_from?: string | null
          unavailable_note?: string | null
          unavailable_to?: string | null
          updated_at?: string
          user_id?: string
          willing_to_obtain_background_check?: boolean | null
          willing_to_travel_out_of_state?: boolean | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rep_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_vendor_contacts: {
        Row: {
          company_name: string | null
          contact_name: string | null
          converted_vendor_id: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean
          is_converted_to_vendor: boolean
          notes: string | null
          phone: string | null
          potential_vendor_profile_id: string | null
          rep_user_id: string
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          contact_name?: string | null
          converted_vendor_id?: string | null
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          is_converted_to_vendor?: boolean
          notes?: string | null
          phone?: string | null
          potential_vendor_profile_id?: string | null
          rep_user_id: string
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          contact_name?: string | null
          converted_vendor_id?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          is_converted_to_vendor?: boolean
          notes?: string | null
          phone?: string | null
          potential_vendor_profile_id?: string | null
          rep_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_vendor_contacts_converted_vendor_id_fkey"
            columns: ["converted_vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_vendor_contacts_potential_vendor_profile_id_fkey"
            columns: ["potential_vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_vendor_contacts_rep_user_id_fkey"
            columns: ["rep_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reputation_share_links: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          last_viewed_at: string | null
          role_type: string
          slug: string
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_viewed_at?: string | null
          role_type: string
          slug: string
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_viewed_at?: string | null
          role_type?: string
          slug?: string
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "reputation_share_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_settings: {
        Row: {
          created_at: string
          enforce_waiting_period: boolean
          id: string
          min_days_between_reviews: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enforce_waiting_period?: boolean
          id?: string
          min_days_between_reviews?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enforce_waiting_period?: boolean
          id?: string
          min_days_between_reviews?: number
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          accepted_at: string | null
          agreement_area_id: string | null
          coaching_note: string | null
          comment: string | null
          connection_id: string | null
          converted_to_coaching_at: string | null
          converted_to_coaching_by: string | null
          county_name: string | null
          created_at: string
          direction: string
          dispute_note: string | null
          dispute_reason: string | null
          disputed_at: string | null
          exclude_from_trust_score: boolean
          feedback_marked_at: string | null
          feedback_marked_by_user_id: string | null
          id: string
          inspection_category: string | null
          inspection_type_id: string | null
          is_exit_review: boolean
          is_feedback: boolean
          is_hidden: boolean
          is_spotlighted: boolean | null
          is_verified: boolean
          moderation_notes: string | null
          rating_communication: number | null
          rating_on_time: number | null
          rating_quality: number | null
          rep_interest_id: string | null
          reviewee_id: string
          reviewer_id: string
          state_code: string | null
          status: string
          updated_at: string
          workflow_status: string | null
          would_work_again: boolean | null
          zip_code: string | null
        }
        Insert: {
          accepted_at?: string | null
          agreement_area_id?: string | null
          coaching_note?: string | null
          comment?: string | null
          connection_id?: string | null
          converted_to_coaching_at?: string | null
          converted_to_coaching_by?: string | null
          county_name?: string | null
          created_at?: string
          direction: string
          dispute_note?: string | null
          dispute_reason?: string | null
          disputed_at?: string | null
          exclude_from_trust_score?: boolean
          feedback_marked_at?: string | null
          feedback_marked_by_user_id?: string | null
          id?: string
          inspection_category?: string | null
          inspection_type_id?: string | null
          is_exit_review?: boolean
          is_feedback?: boolean
          is_hidden?: boolean
          is_spotlighted?: boolean | null
          is_verified?: boolean
          moderation_notes?: string | null
          rating_communication?: number | null
          rating_on_time?: number | null
          rating_quality?: number | null
          rep_interest_id?: string | null
          reviewee_id: string
          reviewer_id: string
          state_code?: string | null
          status?: string
          updated_at?: string
          workflow_status?: string | null
          would_work_again?: boolean | null
          zip_code?: string | null
        }
        Update: {
          accepted_at?: string | null
          agreement_area_id?: string | null
          coaching_note?: string | null
          comment?: string | null
          connection_id?: string | null
          converted_to_coaching_at?: string | null
          converted_to_coaching_by?: string | null
          county_name?: string | null
          created_at?: string
          direction?: string
          dispute_note?: string | null
          dispute_reason?: string | null
          disputed_at?: string | null
          exclude_from_trust_score?: boolean
          feedback_marked_at?: string | null
          feedback_marked_by_user_id?: string | null
          id?: string
          inspection_category?: string | null
          inspection_type_id?: string | null
          is_exit_review?: boolean
          is_feedback?: boolean
          is_hidden?: boolean
          is_spotlighted?: boolean | null
          is_verified?: boolean
          moderation_notes?: string | null
          rating_communication?: number | null
          rating_on_time?: number | null
          rating_quality?: number | null
          rep_interest_id?: string | null
          reviewee_id?: string
          reviewer_id?: string
          state_code?: string | null
          status?: string
          updated_at?: string
          workflow_status?: string | null
          would_work_again?: boolean | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_agreement_area_id_fkey"
            columns: ["agreement_area_id"]
            isOneToOne: false
            referencedRelation: "connection_agreement_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "vendor_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_converted_to_coaching_by_fkey"
            columns: ["converted_to_coaching_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_feedback_marked_by_user_id_fkey"
            columns: ["feedback_marked_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_inspection_type_id_fkey"
            columns: ["inspection_type_id"]
            isOneToOne: false
            referencedRelation: "inspection_type_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_rep_interest_id_fkey"
            columns: ["rep_interest_id"]
            isOneToOne: false
            referencedRelation: "rep_interest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_search_matches: {
        Row: {
          created_at: string
          id: string
          saved_search_id: string
          target_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          saved_search_id: string
          target_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          saved_search_id?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_search_matches_saved_search_id_fkey"
            columns: ["saved_search_id"]
            isOneToOne: false
            referencedRelation: "saved_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_run_at: string | null
          name: string
          role_context: string
          search_filters: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name: string
          role_context: string
          search_filters: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          role_context?: string
          search_filters?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seeking_coverage_posts: {
        Row: {
          allow_willing_to_obtain_background_check: boolean | null
          auto_expires_at: string | null
          closed_reason: string | null
          county_fips: string | null
          county_id: string | null
          covers_entire_state: boolean
          created_at: string
          deleted_at: string | null
          description: string | null
          expires_at: string | null
          filled_at: string | null
          filled_by_rep_id: string | null
          has_pending_assignment: boolean | null
          id: string
          inspection_type: string | null
          inspection_type_ids: string[] | null
          inspection_types: string[]
          is_accepting_responses: boolean
          location: string | null
          pay_max: number | null
          pay_min: number | null
          pay_notes: string | null
          pay_type: string | null
          requires_aspen_grove: boolean | null
          requires_background_check: boolean | null
          state_code: string | null
          status: string
          systems_required: string[] | null
          systems_required_array: string[]
          title: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          allow_willing_to_obtain_background_check?: boolean | null
          auto_expires_at?: string | null
          closed_reason?: string | null
          county_fips?: string | null
          county_id?: string | null
          covers_entire_state?: boolean
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          expires_at?: string | null
          filled_at?: string | null
          filled_by_rep_id?: string | null
          has_pending_assignment?: boolean | null
          id?: string
          inspection_type?: string | null
          inspection_type_ids?: string[] | null
          inspection_types?: string[]
          is_accepting_responses?: boolean
          location?: string | null
          pay_max?: number | null
          pay_min?: number | null
          pay_notes?: string | null
          pay_type?: string | null
          requires_aspen_grove?: boolean | null
          requires_background_check?: boolean | null
          state_code?: string | null
          status?: string
          systems_required?: string[] | null
          systems_required_array?: string[]
          title: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          allow_willing_to_obtain_background_check?: boolean | null
          auto_expires_at?: string | null
          closed_reason?: string | null
          county_fips?: string | null
          county_id?: string | null
          covers_entire_state?: boolean
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          expires_at?: string | null
          filled_at?: string | null
          filled_by_rep_id?: string | null
          has_pending_assignment?: boolean | null
          id?: string
          inspection_type?: string | null
          inspection_type_ids?: string[] | null
          inspection_types?: string[]
          is_accepting_responses?: boolean
          location?: string | null
          pay_max?: number | null
          pay_min?: number | null
          pay_notes?: string | null
          pay_type?: string | null
          requires_aspen_grove?: boolean | null
          requires_background_check?: boolean | null
          state_code?: string | null
          status?: string
          systems_required?: string[] | null
          systems_required_array?: string[]
          title?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seeking_coverage_posts_county_id_fkey"
            columns: ["county_id"]
            isOneToOne: false
            referencedRelation: "us_counties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seeking_coverage_posts_filled_by_rep_id_fkey"
            columns: ["filled_by_rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seeking_coverage_posts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_pages: {
        Row: {
          announced_on: string | null
          content: string
          created_at: string
          effective_at: string | null
          id: string
          is_published: boolean
          last_updated_at: string
          last_updated_by: string | null
          page_type: Database["public"]["Enums"]["site_page_type"]
          slug: string
          title: string
        }
        Insert: {
          announced_on?: string | null
          content?: string
          created_at?: string
          effective_at?: string | null
          id?: string
          is_published?: boolean
          last_updated_at?: string
          last_updated_by?: string | null
          page_type: Database["public"]["Enums"]["site_page_type"]
          slug: string
          title: string
        }
        Update: {
          announced_on?: string | null
          content?: string
          created_at?: string
          effective_at?: string | null
          id?: string
          is_published?: boolean
          last_updated_at?: string
          last_updated_by?: string | null
          page_type?: Database["public"]["Enums"]["site_page_type"]
          slug?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_pages_last_updated_by_fkey"
            columns: ["last_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string
          event_type: string | null
          id: string
          payload_summary: Json | null
          processed_at: string | null
          signature_valid: boolean | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id: string
          event_type?: string | null
          id?: string
          payload_summary?: Json | null
          processed_at?: string | null
          signature_valid?: boolean | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_type?: string | null
          id?: string
          payload_summary?: Json | null
          processed_at?: string | null
          signature_valid?: boolean | null
          status?: string
        }
        Relationships: []
      }
      support_articles: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          is_published: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          category: string
          created_at?: string
          id?: string
          is_published?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_published?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_internal_note: boolean
          sender_id: string
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_internal_note?: boolean
          sender_id: string
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_internal_note?: boolean
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          closed_at: string | null
          created_at: string
          id: string
          image_urls: string[] | null
          last_admin_reply_at: string | null
          last_user_reply_at: string | null
          message: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          closed_at?: string | null
          created_at?: string
          id?: string
          image_urls?: string[] | null
          last_admin_reply_at?: string | null
          last_user_reply_at?: string | null
          message: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          image_urls?: string[] | null
          last_admin_reply_at?: string | null
          last_user_reply_at?: string | null
          message?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      territory_assignments: {
        Row: {
          agreed_rate: number
          conversation_id: string | null
          county_id: string | null
          county_name: string | null
          created_at: string
          created_by: string
          decline_reason: string | null
          effective_date: string
          id: string
          inspection_types: string[] | null
          notes: string | null
          rate_override: boolean
          rate_override_at: string | null
          rate_override_reason: string | null
          rep_confirmed_at: string | null
          rep_confirmed_by: string | null
          rep_id: string
          seeking_coverage_post_id: string | null
          source: string
          state_code: string
          state_name: string
          status: string
          systems_required: string[] | null
          updated_at: string
          vendor_confirmed_at: string | null
          vendor_id: string
        }
        Insert: {
          agreed_rate: number
          conversation_id?: string | null
          county_id?: string | null
          county_name?: string | null
          created_at?: string
          created_by: string
          decline_reason?: string | null
          effective_date?: string
          id?: string
          inspection_types?: string[] | null
          notes?: string | null
          rate_override?: boolean
          rate_override_at?: string | null
          rate_override_reason?: string | null
          rep_confirmed_at?: string | null
          rep_confirmed_by?: string | null
          rep_id: string
          seeking_coverage_post_id?: string | null
          source?: string
          state_code: string
          state_name: string
          status?: string
          systems_required?: string[] | null
          updated_at?: string
          vendor_confirmed_at?: string | null
          vendor_id: string
        }
        Update: {
          agreed_rate?: number
          conversation_id?: string | null
          county_id?: string | null
          county_name?: string | null
          created_at?: string
          created_by?: string
          decline_reason?: string | null
          effective_date?: string
          id?: string
          inspection_types?: string[] | null
          notes?: string | null
          rate_override?: boolean
          rate_override_at?: string | null
          rate_override_reason?: string | null
          rep_confirmed_at?: string | null
          rep_confirmed_by?: string | null
          rep_id?: string
          seeking_coverage_post_id?: string | null
          source?: string
          state_code?: string
          state_name?: string
          status?: string
          systems_required?: string[] | null
          updated_at?: string
          vendor_confirmed_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "territory_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_assignments_county_id_fkey"
            columns: ["county_id"]
            isOneToOne: false
            referencedRelation: "us_counties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_assignments_rep_confirmed_by_fkey"
            columns: ["rep_confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_assignments_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_assignments_seeking_coverage_post_id_fkey"
            columns: ["seeking_coverage_post_id"]
            isOneToOne: false
            referencedRelation: "seeking_coverage_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_assignments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      us_counties: {
        Row: {
          county_fips: string | null
          county_name: string
          created_at: string
          id: string
          state_code: string
          state_name: string
        }
        Insert: {
          county_fips?: string | null
          county_name: string
          created_at?: string
          id?: string
          state_code: string
          state_name: string
        }
        Update: {
          county_fips?: string | null
          county_name?: string
          created_at?: string
          id?: string
          state_code?: string
          state_name?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_user_id: string
          blocker_user_id: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_user_id: string
          blocker_user_id: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_user_id?: string
          blocker_user_id?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_user_id_fkey"
            columns: ["blocked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_user_id_fkey"
            columns: ["blocker_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_checklist_assignments: {
        Row: {
          assigned_at: string
          created_at: string
          id: string
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          id?: string
          template_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          id?: string
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_checklist_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_checklist_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_checklist_items: {
        Row: {
          assignment_id: string
          completed_at: string | null
          completed_by:
            | Database["public"]["Enums"]["checklist_completed_by"]
            | null
          created_at: string
          id: string
          item_id: string
          status: Database["public"]["Enums"]["checklist_item_status"]
          updated_at: string
        }
        Insert: {
          assignment_id: string
          completed_at?: string | null
          completed_by?:
            | Database["public"]["Enums"]["checklist_completed_by"]
            | null
          created_at?: string
          id?: string
          item_id: string
          status?: Database["public"]["Enums"]["checklist_item_status"]
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          completed_at?: string | null
          completed_by?:
            | Database["public"]["Enums"]["checklist_completed_by"]
            | null
          created_at?: string
          id?: string
          item_id?: string
          status?: Database["public"]["Enums"]["checklist_item_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_checklist_items_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "user_checklist_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_checklist_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reports: {
        Row: {
          admin_notes: string | null
          conversation_id: string | null
          created_at: string
          id: string
          reason_category: string
          reason_details: string | null
          reported_user_id: string
          reporter_user_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          admin_notes?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          reason_category: string
          reason_details?: string | null
          reported_user_id: string
          reporter_user_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          admin_notes?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          reason_category?: string
          reason_details?: string | null
          reported_user_id?: string
          reporter_user_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_table_preferences: {
        Row: {
          created_at: string
          id: string
          table_key: string
          updated_at: string
          user_id: string
          visible_columns: Json
        }
        Insert: {
          created_at?: string
          id?: string
          table_key: string
          updated_at?: string
          user_id: string
          visible_columns?: Json
        }
        Update: {
          created_at?: string
          id?: string
          table_key?: string
          updated_at?: string
          user_id?: string
          visible_columns?: Json
        }
        Relationships: [
          {
            foreignKeyName: "user_table_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_wallet: {
        Row: {
          created_at: string
          credits: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_wallet_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_alert_kudos: {
        Row: {
          alert_id: string
          created_at: string
          id: string
          rep_id: string
          vendor_id: string
        }
        Insert: {
          alert_id: string
          created_at?: string
          id?: string
          rep_id: string
          vendor_id: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          id?: string
          rep_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_alert_kudos_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "vendor_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_alert_kudos_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_alert_kudos_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_alerts: {
        Row: {
          affected_end_date: string | null
          affected_start_date: string | null
          alert_type: string
          created_at: string
          id: string
          is_scheduled: boolean
          message: string
          recipient_vendor_ids: string[]
          rep_user_id: string
          route_counties: string[] | null
          route_date: string | null
          route_state: string | null
          scheduled_status: string | null
          sent_at: string | null
        }
        Insert: {
          affected_end_date?: string | null
          affected_start_date?: string | null
          alert_type: string
          created_at?: string
          id?: string
          is_scheduled?: boolean
          message: string
          recipient_vendor_ids?: string[]
          rep_user_id: string
          route_counties?: string[] | null
          route_date?: string | null
          route_state?: string | null
          scheduled_status?: string | null
          sent_at?: string | null
        }
        Update: {
          affected_end_date?: string | null
          affected_start_date?: string | null
          alert_type?: string
          created_at?: string
          id?: string
          is_scheduled?: boolean
          message?: string
          recipient_vendor_ids?: string[]
          rep_user_id?: string
          route_counties?: string[] | null
          route_date?: string | null
          route_state?: string | null
          scheduled_status?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_alerts_rep_user_id_fkey"
            columns: ["rep_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_calendar_events: {
        Row: {
          created_at: string
          description: string | null
          event_date: string
          event_type: string
          id: string
          is_recurring: boolean
          recurrence_type: string | null
          recurrence_until: string | null
          title: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_date: string
          event_type: string
          id?: string
          is_recurring?: boolean
          recurrence_type?: string | null
          recurrence_until?: string | null
          title: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_date?: string
          event_type?: string
          id?: string
          is_recurring?: boolean
          recurrence_type?: string | null
          recurrence_until?: string | null
          title?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_calendar_events_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_connections: {
        Row: {
          conversation_id: string | null
          created_at: string
          field_rep_id: string
          id: string
          requested_at: string
          requested_by: Database["public"]["Enums"]["vendor_connection_initiator"]
          responded_at: string | null
          status: Database["public"]["Enums"]["vendor_connection_status"]
          updated_at: string
          vendor_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          field_rep_id: string
          id?: string
          requested_at?: string
          requested_by: Database["public"]["Enums"]["vendor_connection_initiator"]
          responded_at?: string | null
          status?: Database["public"]["Enums"]["vendor_connection_status"]
          updated_at?: string
          vendor_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          field_rep_id?: string
          id?: string
          requested_at?: string
          requested_by?: Database["public"]["Enums"]["vendor_connection_initiator"]
          responded_at?: string | null
          status?: Database["public"]["Enums"]["vendor_connection_status"]
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_connections_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_connections_field_rep_id_fkey"
            columns: ["field_rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_connections_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_coverage_areas: {
        Row: {
          county_id: string | null
          county_name: string | null
          coverage_mode: string | null
          covers_entire_county: boolean
          covers_entire_state: boolean
          created_at: string
          excluded_county_ids: string[] | null
          id: string
          included_county_ids: string[] | null
          inspection_types: string[] | null
          region_note: string | null
          state_code: string
          state_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          county_id?: string | null
          county_name?: string | null
          coverage_mode?: string | null
          covers_entire_county?: boolean
          covers_entire_state?: boolean
          created_at?: string
          excluded_county_ids?: string[] | null
          id?: string
          included_county_ids?: string[] | null
          inspection_types?: string[] | null
          region_note?: string | null
          state_code: string
          state_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          county_id?: string | null
          county_name?: string | null
          coverage_mode?: string | null
          covers_entire_county?: boolean
          covers_entire_state?: boolean
          created_at?: string
          excluded_county_ids?: string[] | null
          id?: string
          included_county_ids?: string[] | null
          inspection_types?: string[] | null
          region_note?: string | null
          state_code?: string
          state_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_coverage_areas_county_id_fkey"
            columns: ["county_id"]
            isOneToOne: false
            referencedRelation: "us_counties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_coverage_areas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_credit_transactions: {
        Row: {
          action: string
          amount: number
          created_at: string
          id: string
          metadata: Json | null
          related_entity_id: string | null
          related_entity_type: string | null
          user_id: string
        }
        Insert: {
          action: string
          amount: number
          created_at?: string
          id?: string
          metadata?: Json | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          user_id: string
        }
        Update: {
          action?: string
          amount?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_message_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          name: string
          scope: string
          target_role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          name: string
          scope?: string
          target_role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          name?: string
          scope?: string
          target_role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_message_templates_vendor_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_office_hours: {
        Row: {
          close_time: string | null
          created_at: string
          id: string
          open_time: string | null
          timezone: string
          updated_at: string
          vendor_id: string
          weekday: number
        }
        Insert: {
          close_time?: string | null
          created_at?: string
          id?: string
          open_time?: string | null
          timezone?: string
          updated_at?: string
          vendor_id: string
          weekday: number
        }
        Update: {
          close_time?: string | null
          created_at?: string
          id?: string
          open_time?: string | null
          timezone?: string
          updated_at?: string
          vendor_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendor_office_hours_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_profile: {
        Row: {
          anonymous_id: string | null
          city: string | null
          company_description: string | null
          company_name: string
          created_at: string
          id: string
          is_accepting_new_reps: boolean | null
          primary_inspection_types: string[] | null
          regions_covered: string[] | null
          state: string | null
          systems_used: string[] | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          anonymous_id?: string | null
          city?: string | null
          company_description?: string | null
          company_name: string
          created_at?: string
          id?: string
          is_accepting_new_reps?: boolean | null
          primary_inspection_types?: string[] | null
          regions_covered?: string[] | null
          state?: string | null
          systems_used?: string[] | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          anonymous_id?: string | null
          city?: string | null
          company_description?: string | null
          company_name?: string
          created_at?: string
          id?: string
          is_accepting_new_reps?: boolean | null
          primary_inspection_types?: string[] | null
          regions_covered?: string[] | null
          state?: string | null
          systems_used?: string[] | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_rep_agreements: {
        Row: {
          base_rate: number | null
          coverage_summary: string | null
          created_at: string
          currency: string | null
          effective_date: string | null
          field_rep_id: string
          id: string
          pricing_summary: string | null
          source_seeking_coverage_post_id: string | null
          states_covered: string[] | null
          status: Database["public"]["Enums"]["vendor_rep_agreement_status"]
          updated_at: string
          vendor_id: string
          work_type: string | null
        }
        Insert: {
          base_rate?: number | null
          coverage_summary?: string | null
          created_at?: string
          currency?: string | null
          effective_date?: string | null
          field_rep_id: string
          id?: string
          pricing_summary?: string | null
          source_seeking_coverage_post_id?: string | null
          states_covered?: string[] | null
          status?: Database["public"]["Enums"]["vendor_rep_agreement_status"]
          updated_at?: string
          vendor_id: string
          work_type?: string | null
        }
        Update: {
          base_rate?: number | null
          coverage_summary?: string | null
          created_at?: string
          currency?: string | null
          effective_date?: string | null
          field_rep_id?: string
          id?: string
          pricing_summary?: string | null
          source_seeking_coverage_post_id?: string | null
          states_covered?: string[] | null
          status?: Database["public"]["Enums"]["vendor_rep_agreement_status"]
          updated_at?: string
          vendor_id?: string
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_rep_agreements_field_rep_id_fkey"
            columns: ["field_rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_rep_agreements_source_seeking_coverage_post_id_fkey"
            columns: ["source_seeking_coverage_post_id"]
            isOneToOne: false
            referencedRelation: "seeking_coverage_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_rep_agreements_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_staff_emails: {
        Row: {
          applies_to_all_states: boolean
          created_at: string
          email: string
          id: string
          is_active: boolean
          receive_direct_messages: boolean
          receive_network_alerts: boolean
          role_label: string | null
          staff_name: string | null
          updated_at: string
          vendor_profile_id: string
        }
        Insert: {
          applies_to_all_states?: boolean
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          receive_direct_messages?: boolean
          receive_network_alerts?: boolean
          role_label?: string | null
          staff_name?: string | null
          updated_at?: string
          vendor_profile_id: string
        }
        Update: {
          applies_to_all_states?: boolean
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          receive_direct_messages?: boolean
          receive_network_alerts?: boolean
          role_label?: string | null
          staff_name?: string | null
          updated_at?: string
          vendor_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_staff_emails_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "vendor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_staff_state_coverage: {
        Row: {
          created_at: string
          id: string
          state_code: string
          vendor_staff_email_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          state_code: string
          vendor_staff_email_id: string
        }
        Update: {
          created_at?: string
          id?: string
          state_code?: string
          vendor_staff_email_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_staff_state_coverage_vendor_staff_email_id_fkey"
            columns: ["vendor_staff_email_id"]
            isOneToOne: false
            referencedRelation: "vendor_staff_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      working_terms_change_requests: {
        Row: {
          created_at: string
          decline_reason: string | null
          effective_from: string
          id: string
          new_rate: number | null
          new_turnaround_days: number | null
          old_rate: number | null
          old_turnaround_days: number | null
          reason: string
          requested_by_role: string
          requested_by_user_id: string
          responded_at: string | null
          responded_by_user_id: string | null
          status: string
          updated_at: string
          working_terms_row_id: string
        }
        Insert: {
          created_at?: string
          decline_reason?: string | null
          effective_from?: string
          id?: string
          new_rate?: number | null
          new_turnaround_days?: number | null
          old_rate?: number | null
          old_turnaround_days?: number | null
          reason: string
          requested_by_role: string
          requested_by_user_id: string
          responded_at?: string | null
          responded_by_user_id?: string | null
          status?: string
          updated_at?: string
          working_terms_row_id: string
        }
        Update: {
          created_at?: string
          decline_reason?: string | null
          effective_from?: string
          id?: string
          new_rate?: number | null
          new_turnaround_days?: number | null
          old_rate?: number | null
          old_turnaround_days?: number | null
          reason?: string
          requested_by_role?: string
          requested_by_user_id?: string
          responded_at?: string | null
          responded_by_user_id?: string | null
          status?: string
          updated_at?: string
          working_terms_row_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "working_terms_change_requests_requested_by_user_id_fkey"
            columns: ["requested_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_terms_change_requests_responded_by_user_id_fkey"
            columns: ["responded_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_terms_change_requests_working_terms_row_id_fkey"
            columns: ["working_terms_row_id"]
            isOneToOne: false
            referencedRelation: "working_terms_rows"
            referencedColumns: ["id"]
          },
        ]
      }
      working_terms_requests: {
        Row: {
          created_at: string
          decline_reason: string | null
          id: string
          message_from_vendor: string | null
          rep_id: string
          requested_counties: string[] | null
          requested_states: string[]
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          decline_reason?: string | null
          id?: string
          message_from_vendor?: string | null
          rep_id: string
          requested_counties?: string[] | null
          requested_states?: string[]
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          decline_reason?: string | null
          id?: string
          message_from_vendor?: string | null
          rep_id?: string
          requested_counties?: string[] | null
          requested_states?: string[]
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "working_terms_requests_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_terms_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      working_terms_rows: {
        Row: {
          county_name: string | null
          created_at: string
          effective_from: string
          id: string
          inactivated_at: string | null
          inactivated_by: string | null
          inactivated_reason: string | null
          included: boolean
          inspection_type: string
          rate: number | null
          rep_id: string
          source: string
          state_code: string
          status: string
          turnaround_days: number | null
          updated_at: string
          vendor_id: string
          working_terms_request_id: string
        }
        Insert: {
          county_name?: string | null
          created_at?: string
          effective_from?: string
          id?: string
          inactivated_at?: string | null
          inactivated_by?: string | null
          inactivated_reason?: string | null
          included?: boolean
          inspection_type: string
          rate?: number | null
          rep_id: string
          source?: string
          state_code: string
          status?: string
          turnaround_days?: number | null
          updated_at?: string
          vendor_id: string
          working_terms_request_id: string
        }
        Update: {
          county_name?: string | null
          created_at?: string
          effective_from?: string
          id?: string
          inactivated_at?: string | null
          inactivated_by?: string | null
          inactivated_reason?: string | null
          included?: boolean
          inspection_type?: string
          rate?: number | null
          rep_id?: string
          source?: string
          state_code?: string
          status?: string
          turnaround_days?: number | null
          updated_at?: string
          vendor_id?: string
          working_terms_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "working_terms_rows_inactivated_by_fkey"
            columns: ["inactivated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_terms_rows_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_terms_rows_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_terms_rows_working_terms_request_id_fkey"
            columns: ["working_terms_request_id"]
            isOneToOne: false
            referencedRelation: "working_terms_requests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_broadcast_metrics: {
        Row: {
          avg_rating: number | null
          broadcast_id: string | null
          emails_sent: number | null
          recipients_total: number | null
          responses: number | null
          spotlight_ready: number | null
        }
        Relationships: []
      }
      public_state_network_counts: {
        Row: {
          last_updated_at: string | null
          rep_count: number | null
          rep_count_display: string | null
          state_code: string | null
          state_name: string | null
          total_count: number | null
          total_count_display: string | null
          vendor_count: number | null
          vendor_count_display: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_territory_assignment: {
        Args: { p_assignment_id: string; p_rep_user_id: string }
        Returns: Json
      }
      assign_default_checklists: {
        Args: { p_role: string; p_user_id: string }
        Returns: undefined
      }
      backfill_working_terms_from_territory_assignments: {
        Args: never
        Returns: Json
      }
      calculate_community_score: {
        Args: { p_user_id: string }
        Returns: number
      }
      complete_checklist_item_by_key: {
        Args: { p_auto_track_key: string; p_user_id: string }
        Returns: undefined
      }
      deduct_credit_for_post: {
        Args: { p_amount?: number; p_user_id: string }
        Returns: boolean
      }
      get_user_vendor_profile_id: {
        Args: { p_user_id: string }
        Returns: string
      }
      is_admin_user: { Args: { user_id: string }; Returns: boolean }
      is_staff_user: { Args: { user_id: string }; Returns: boolean }
      refresh_community_score_for_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      send_admin_broadcast: { Args: { p_broadcast_id: string }; Returns: Json }
      unlock_rep_contact: {
        Args: { p_rep_user_id: string; p_vendor_user_id: string }
        Returns: Json
      }
      update_broadcast_stats: {
        Args: { p_broadcast_id: string }
        Returns: undefined
      }
    }
    Enums: {
      checklist_completed_by: "system" | "user"
      checklist_feedback_status: "open" | "reviewed" | "fixed"
      checklist_feedback_type:
        | "bug"
        | "confusing"
        | "completed_not_marked"
        | "suggestion"
        | "other"
      checklist_item_status: "pending" | "completed"
      checklist_owner_type: "system" | "vendor"
      checklist_role: "field_rep" | "vendor" | "both"
      site_page_type: "tos" | "privacy" | "support"
      vendor_connection_initiator: "vendor" | "field_rep"
      vendor_connection_status:
        | "pending"
        | "connected"
        | "declined"
        | "blocked"
        | "ended"
      vendor_rep_agreement_status: "active" | "paused" | "ended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      checklist_completed_by: ["system", "user"],
      checklist_feedback_status: ["open", "reviewed", "fixed"],
      checklist_feedback_type: [
        "bug",
        "confusing",
        "completed_not_marked",
        "suggestion",
        "other",
      ],
      checklist_item_status: ["pending", "completed"],
      checklist_owner_type: ["system", "vendor"],
      checklist_role: ["field_rep", "vendor", "both"],
      site_page_type: ["tos", "privacy", "support"],
      vendor_connection_initiator: ["vendor", "field_rep"],
      vendor_connection_status: [
        "pending",
        "connected",
        "declined",
        "blocked",
        "ended",
      ],
      vendor_rep_agreement_status: ["active", "paused", "ended"],
    },
  },
} as const
