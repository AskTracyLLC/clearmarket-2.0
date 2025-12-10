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
      community_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          helpful_count: number
          id: string
          not_helpful_count: number
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
          is_read: boolean
          ref_id: string | null
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
          is_read?: boolean
          ref_id?: string | null
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
          is_read?: boolean
          ref_id?: string | null
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
          completed_at: string | null
          created_at: string
          credit_pack_id: string
          credits_to_add: number
          id: string
          status: string
          stripe_checkout_session_id: string
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          credit_pack_id: string
          credits_to_add: number
          id?: string
          status?: string
          stripe_checkout_session_id: string
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          credit_pack_id?: string
          credits_to_add?: number
          id?: string
          status?: string
          stripe_checkout_session_id?: string
          stripe_payment_intent_id?: string | null
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
          id: string
          last_reminder_sent_at: string | null
          post_id: string
          rep_id: string
          status: string
          updated_at: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          id?: string
          last_reminder_sent_at?: string | null
          post_id: string
          rep_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          id?: string
          last_reminder_sent_at?: string | null
          post_id?: string
          rep_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
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
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          direction: string
          exclude_from_trust_score: boolean
          feedback_marked_at: string | null
          feedback_marked_by_user_id: string | null
          id: string
          is_exit_review: boolean
          is_feedback: boolean
          is_hidden: boolean
          is_verified: boolean
          moderation_notes: string | null
          rating_communication: number | null
          rating_on_time: number | null
          rating_quality: number | null
          rep_interest_id: string | null
          reviewee_id: string
          reviewer_id: string
          status: string
          updated_at: string
          would_work_again: boolean | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          direction: string
          exclude_from_trust_score?: boolean
          feedback_marked_at?: string | null
          feedback_marked_by_user_id?: string | null
          id?: string
          is_exit_review?: boolean
          is_feedback?: boolean
          is_hidden?: boolean
          is_verified?: boolean
          moderation_notes?: string | null
          rating_communication?: number | null
          rating_on_time?: number | null
          rating_quality?: number | null
          rep_interest_id?: string | null
          reviewee_id: string
          reviewer_id: string
          status?: string
          updated_at?: string
          would_work_again?: boolean | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          direction?: string
          exclude_from_trust_score?: boolean
          feedback_marked_at?: string | null
          feedback_marked_by_user_id?: string | null
          id?: string
          is_exit_review?: boolean
          is_feedback?: boolean
          is_hidden?: boolean
          is_verified?: boolean
          moderation_notes?: string | null
          rating_communication?: number | null
          rating_on_time?: number | null
          rating_quality?: number | null
          rep_interest_id?: string | null
          reviewee_id?: string
          reviewer_id?: string
          status?: string
          updated_at?: string
          would_work_again?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_feedback_marked_by_user_id_fkey"
            columns: ["feedback_marked_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          county_fips: string | null
          county_id: string | null
          covers_entire_state: boolean
          created_at: string
          deleted_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          inspection_type: string | null
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
          county_fips?: string | null
          county_id?: string | null
          covers_entire_state?: boolean
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          inspection_type?: string | null
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
          county_fips?: string | null
          county_id?: string | null
          covers_entire_state?: boolean
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          inspection_type?: string | null
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
      vendor_alerts: {
        Row: {
          affected_end_date: string | null
          affected_start_date: string | null
          alert_type: string
          created_at: string
          id: string
          message: string
          recipient_vendor_ids: string[]
          rep_user_id: string
        }
        Insert: {
          affected_end_date?: string | null
          affected_start_date?: string | null
          alert_type: string
          created_at?: string
          id?: string
          message: string
          recipient_vendor_ids?: string[]
          rep_user_id: string
        }
        Update: {
          affected_end_date?: string | null
          affected_start_date?: string | null
          alert_type?: string
          created_at?: string
          id?: string
          message?: string
          recipient_vendor_ids?: string[]
          rep_user_id?: string
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
          field_rep_id: string
          id: string
          pricing_summary: string | null
          states_covered: string[] | null
          status: Database["public"]["Enums"]["vendor_rep_agreement_status"]
          updated_at: string
          vendor_id: string
        }
        Insert: {
          base_rate?: number | null
          coverage_summary?: string | null
          created_at?: string
          currency?: string | null
          field_rep_id: string
          id?: string
          pricing_summary?: string | null
          states_covered?: string[] | null
          status?: Database["public"]["Enums"]["vendor_rep_agreement_status"]
          updated_at?: string
          vendor_id: string
        }
        Update: {
          base_rate?: number | null
          coverage_summary?: string | null
          created_at?: string
          currency?: string | null
          field_rep_id?: string
          id?: string
          pricing_summary?: string | null
          states_covered?: string[] | null
          status?: Database["public"]["Enums"]["vendor_rep_agreement_status"]
          updated_at?: string
          vendor_id?: string
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
            foreignKeyName: "vendor_rep_agreements_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      [_ in never]: never
    }
    Functions: {
      calculate_community_score: {
        Args: { p_user_id: string }
        Returns: number
      }
      is_admin_user: { Args: { user_id: string }; Returns: boolean }
      is_staff_user: { Args: { user_id: string }; Returns: boolean }
      refresh_community_score_for_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      unlock_rep_contact: {
        Args: { p_rep_user_id: string; p_vendor_user_id: string }
        Returns: Json
      }
    }
    Enums: {
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
