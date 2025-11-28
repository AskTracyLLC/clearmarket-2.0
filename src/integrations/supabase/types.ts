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
          notes: string | null
          on_time_rating: number | null
          post_id: string | null
          quality_rating: number | null
          rep_interest_id: string
          reviewer_id: string
          source: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          communication_rating?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          on_time_rating?: number | null
          post_id?: string | null
          quality_rating?: number | null
          rep_interest_id: string
          reviewer_id: string
          source?: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          communication_rating?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          on_time_rating?: number | null
          post_id?: string | null
          quality_rating?: number | null
          rep_interest_id?: string
          reviewer_id?: string
          source?: string
          subject_id?: string
          updated_at?: string
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
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          is_pinned_for_one: boolean | null
          is_pinned_for_two: boolean | null
          last_message_at: string | null
          last_message_preview: string | null
          origin_post_id: string | null
          origin_type: string | null
          participant_one: string
          participant_two: string
          rep_interest_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_pinned_for_one?: boolean | null
          is_pinned_for_two?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          origin_post_id?: string | null
          origin_type?: string | null
          participant_one: string
          participant_two: string
          rep_interest_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_pinned_for_one?: boolean | null
          is_pinned_for_two?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          origin_post_id?: string | null
          origin_type?: string | null
          participant_one?: string
          participant_two?: string
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
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          has_signed_terms: boolean
          id: string
          is_admin: boolean
          is_fieldrep: boolean
          is_moderator: boolean
          is_support: boolean
          is_vendor_admin: boolean
          is_vendor_staff: boolean
          terms_signed_at: string | null
          terms_version: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          has_signed_terms?: boolean
          id: string
          is_admin?: boolean
          is_fieldrep?: boolean
          is_moderator?: boolean
          is_support?: boolean
          is_vendor_admin?: boolean
          is_vendor_staff?: boolean
          terms_signed_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          has_signed_terms?: boolean
          id?: string
          is_admin?: boolean
          is_fieldrep?: boolean
          is_moderator?: boolean
          is_support?: boolean
          is_vendor_admin?: boolean
          is_vendor_staff?: boolean
          terms_signed_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rep_coverage_areas: {
        Row: {
          base_price: number | null
          county_id: string | null
          county_name: string | null
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
          created_at: string
          id: string
          post_id: string
          rep_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          rep_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
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
      rep_profile: {
        Row: {
          anonymous_id: string | null
          bio: string | null
          business_name: string | null
          certifications: string[] | null
          city: string | null
          coverage_areas: string[] | null
          created_at: string
          id: string
          inspection_types: string[] | null
          is_accepting_new_vendors: boolean | null
          state: string | null
          systems_used: string[] | null
          updated_at: string
          user_id: string
          willing_to_travel_out_of_state: boolean | null
          zip_code: string | null
        }
        Insert: {
          anonymous_id?: string | null
          bio?: string | null
          business_name?: string | null
          certifications?: string[] | null
          city?: string | null
          coverage_areas?: string[] | null
          created_at?: string
          id?: string
          inspection_types?: string[] | null
          is_accepting_new_vendors?: boolean | null
          state?: string | null
          systems_used?: string[] | null
          updated_at?: string
          user_id: string
          willing_to_travel_out_of_state?: boolean | null
          zip_code?: string | null
        }
        Update: {
          anonymous_id?: string | null
          bio?: string | null
          business_name?: string | null
          certifications?: string[] | null
          city?: string | null
          coverage_areas?: string[] | null
          created_at?: string
          id?: string
          inspection_types?: string[] | null
          is_accepting_new_vendors?: boolean | null
          state?: string | null
          systems_used?: string[] | null
          updated_at?: string
          user_id?: string
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
      seeking_coverage_posts: {
        Row: {
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
          state_code: string | null
          status: string
          systems_required: string[] | null
          systems_required_array: string[]
          title: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
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
          state_code?: string | null
          status?: string
          systems_required?: string[] | null
          systems_required_array?: string[]
          title: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
