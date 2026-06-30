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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      agent_access_requests: {
        Row: {
          business_name: string
          city: string | null
          completed_at: string | null
          country_code: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          invited_at: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          business_name: string
          city?: string | null
          completed_at?: string | null
          country_code?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          invited_at?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          business_name?: string
          city?: string | null
          completed_at?: string | null
          country_code?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          invited_at?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      invite_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          metadata: Json
          role: string
          token: string
          used: boolean
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          metadata?: Json
          role?: string
          token: string
          used?: boolean
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          metadata?: Json
          role?: string
          token?: string
          used?: boolean
          used_at?: string | null
        }
        Relationships: []
      }
      agent_articles: {
        Row: {
          agent_id: string
          body: string
          created_at: string
          featured_image: string | null
          id: string
          is_pinned: boolean
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          slug: string
          status: string
          tags: string[]
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          agent_id: string
          body?: string
          created_at?: string
          featured_image?: string | null
          id?: string
          is_pinned?: boolean
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          agent_id?: string
          body?: string
          created_at?: string
          featured_image?: string | null
          id?: string
          is_pinned?: boolean
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      agent_availability: {
        Row: {
          agent_id: string
          auto_reply: string | null
          return_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          auto_reply?: string | null
          return_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          auto_reply?: string | null
          return_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_badges: {
        Row: {
          agent_id: string
          badge_type: string
          created_at: string
          document_url: string | null
          expires_at: string | null
          id: string
          rejection_reason: string | null
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          agent_id: string
          badge_type: string
          created_at?: string
          document_url?: string | null
          expires_at?: string | null
          id?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          agent_id?: string
          badge_type?: string
          created_at?: string
          document_url?: string | null
          expires_at?: string | null
          id?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_badges_badge_type_fkey"
            columns: ["badge_type"]
            isOneToOne: false
            referencedRelation: "badge_types"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_metrics: {
        Row: {
          agent_id: string
          bookings: number
          date: string
          enquiries: number
          quotes_sent: number
          revenue: number
          updated_at: string
          views: number
        }
        Insert: {
          agent_id: string
          bookings?: number
          date: string
          enquiries?: number
          quotes_sent?: number
          revenue?: number
          updated_at?: string
          views?: number
        }
        Update: {
          agent_id?: string
          bookings?: number
          date?: string
          enquiries?: number
          quotes_sent?: number
          revenue?: number
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      agents: {
        Row: {
          avg_rating: number
          avg_response_mins: number | null
          bio: string | null
          business_name: string
          city: string | null
          country_code: string | null
          cover_image_url: string | null
          created_at: string
          id: string
          logo_url: string | null
          slug: string | null
          specialisations: string[] | null
          status: string
          subscription_tier: string
          total_reviews: number
          trust_score: number
          updated_at: string
          user_id: string
          verification_level: string
          years_active: number
        }
        Insert: {
          avg_rating?: number
          avg_response_mins?: number | null
          bio?: string | null
          business_name: string
          city?: string | null
          country_code?: string | null
          cover_image_url?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          slug?: string | null
          specialisations?: string[] | null
          status?: string
          subscription_tier?: string
          total_reviews?: number
          trust_score?: number
          updated_at?: string
          user_id: string
          verification_level?: string
          years_active?: number
        }
        Update: {
          avg_rating?: number
          avg_response_mins?: number | null
          bio?: string | null
          business_name?: string
          city?: string | null
          country_code?: string | null
          cover_image_url?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          slug?: string | null
          specialisations?: string[] | null
          status?: string
          subscription_tier?: string
          total_reviews?: number
          trust_score?: number
          updated_at?: string
          user_id?: string
          verification_level?: string
          years_active?: number
        }
        Relationships: []
      }
      badge_types: {
        Row: {
          authority: string
          color_hex: string
          created_at: string
          description: string | null
          help_url: string | null
          icon_name: string
          id: string
          name: string
        }
        Insert: {
          authority: string
          color_hex: string
          created_at?: string
          description?: string | null
          help_url?: string | null
          icon_name: string
          id: string
          name: string
        }
        Update: {
          authority?: string
          color_hex?: string
          created_at?: string
          description?: string | null
          help_url?: string | null
          icon_name?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          agent_id: string
          created_at: string
          currency: string
          id: string
          package_id: string | null
          pilgrim_id: string
          quote_id: string | null
          rfq_id: string | null
          status: string
          total_amount: number | null
          trip_end: string | null
          trip_start: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          currency?: string
          id?: string
          package_id?: string | null
          pilgrim_id: string
          quote_id?: string | null
          rfq_id?: string | null
          status?: string
          total_amount?: number | null
          trip_end?: string | null
          trip_start?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          currency?: string
          id?: string
          package_id?: string | null
          pilgrim_id?: string
          quote_id?: string | null
          rfq_id?: string | null
          status?: string
          total_amount?: number | null
          trip_end?: string | null
          trip_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_packages: {
        Row: {
          campaign_id: string
          created_at: string
          package_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          package_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          package_id?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          agent_id: string
          created_at: string
          discount_type: string
          discount_value: number
          end_date: string
          id: string
          name: string
          start_date: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          discount_type: string
          discount_value: number
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      checklist_templates: {
        Row: {
          country_code: string
          created_at: string
          id: string
          items: Json
          locale: string
          trip_type: string
          updated_at: string
        }
        Insert: {
          country_code: string
          created_at?: string
          id?: string
          items?: Json
          locale?: string
          trip_type: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          items?: Json
          locale?: string
          trip_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          country_code: string
          country_name: string
          created_at: string
          id: string
          name: string
          population: number | null
        }
        Insert: {
          country_code: string
          country_name: string
          created_at?: string
          id?: string
          name: string
          population?: number | null
        }
        Update: {
          country_code?: string
          country_name?: string
          created_at?: string
          id?: string
          name?: string
          population?: number | null
        }
        Relationships: []
      }
      cms_content: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          locale: string
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          locale?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          locale?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          decimals: number
          flag_emoji: string | null
          name: string
          sort_order: number
          symbol: string
        }
        Insert: {
          code: string
          created_at?: string
          decimals?: number
          flag_emoji?: string | null
          name: string
          sort_order?: number
          symbol: string
        }
        Update: {
          code?: string
          created_at?: string
          decimals?: number
          flag_emoji?: string | null
          name?: string
          sort_order?: number
          symbol?: string
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          address: string | null
          contact_type: string
          country_code: string
          created_at: string
          email: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          phone: string | null
          sort_order: number
        }
        Insert: {
          address?: string | null
          contact_type: string
          country_code: string
          created_at?: string
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          sort_order?: number
        }
        Update: {
          address?: string | null
          contact_type?: string
          country_code?: string
          created_at?: string
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      enforcement_actions: {
        Row: {
          agent_id: string
          evidence: Json
          expires_at: string | null
          id: string
          issued_at: string
          issued_by: string
          level: number
          reason: string
          status: string
        }
        Insert: {
          agent_id: string
          evidence?: Json
          expires_at?: string | null
          id?: string
          issued_at?: string
          issued_by: string
          level: number
          reason: string
          status?: string
        }
        Update: {
          agent_id?: string
          evidence?: Json
          expires_at?: string | null
          id?: string
          issued_at?: string
          issued_by?: string
          level?: number
          reason?: string
          status?: string
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          base_currency: string
          created_at: string
          fetched_at: string
          id: string
          rate: number
          target_currency: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          fetched_at?: string
          id?: string
          rate: number
          target_currency: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          fetched_at?: string
          id?: string
          rate?: number
          target_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_base_currency_fkey"
            columns: ["base_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "exchange_rates_target_currency_fkey"
            columns: ["target_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      featured_campaigns: {
        Row: {
          agent_id: string
          bid_amount: number
          budget: number
          created_at: string
          end_date: string
          id: string
          name: string | null
          package_id: string
          start_date: string
          status: string
          target_markets: string[]
          updated_at: string
        }
        Insert: {
          agent_id: string
          bid_amount?: number
          budget?: number
          created_at?: string
          end_date: string
          id?: string
          name?: string | null
          package_id: string
          start_date: string
          status?: string
          target_markets?: string[]
          updated_at?: string
        }
        Update: {
          agent_id?: string
          bid_amount?: number
          budget?: number
          created_at?: string
          end_date?: string
          id?: string
          name?: string | null
          package_id?: string
          start_date?: string
          status?: string
          target_markets?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      featured_metrics: {
        Row: {
          campaign_id: string
          clicks: number
          cost: number
          date: string
          impressions: number
          rfqs: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          clicks?: number
          cost?: number
          date: string
          impressions?: number
          rfqs?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          clicks?: number
          cost?: number
          date?: string
          impressions?: number
          rfqs?: number
          updated_at?: string
        }
        Relationships: []
      }
      fraud_reports: {
        Row: {
          agent_id: string
          created_at: string
          description: string
          id: string
          package_id: string | null
          report_type: string
          reporter_id: string
          resolution_note: string | null
          resolved_at: string | null
          severity: string
          status: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          description: string
          id?: string
          package_id?: string | null
          report_type: string
          reporter_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          description?: string
          id?: string
          package_id?: string | null
          report_type?: string
          reporter_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
        }
        Relationships: []
      }
      guide_rituals: {
        Row: {
          common_mistakes: string[]
          created_at: string
          description: string | null
          guide_type: string
          header_image_url: string | null
          id: string
          locale: string
          name: string
          slug: string
          sort_order: number
          steps: Json
          updated_at: string
        }
        Insert: {
          common_mistakes?: string[]
          created_at?: string
          description?: string | null
          guide_type: string
          header_image_url?: string | null
          id?: string
          locale?: string
          name: string
          slug: string
          sort_order?: number
          steps?: Json
          updated_at?: string
        }
        Update: {
          common_mistakes?: string[]
          created_at?: string
          description?: string | null
          guide_type?: string
          header_image_url?: string | null
          id?: string
          locale?: string
          name?: string
          slug?: string
          sort_order?: number
          steps?: Json
          updated_at?: string
        }
        Relationships: []
      }
      lead_notes: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          note: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          note: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          note?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          agent_id: string
          budget_range: string | null
          created_at: string
          departure_date: string | null
          first_response_at: string | null
          group_size: number | null
          id: string
          lost_reason: string | null
          pilgrim_id: string | null
          pilgrim_name: string | null
          rfq_id: string | null
          score: number
          snoozed_until: string | null
          source: string
          source_detail: Json | null
          status: string
          tags: string[] | null
          trip_type: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          budget_range?: string | null
          created_at?: string
          departure_date?: string | null
          first_response_at?: string | null
          group_size?: number | null
          id?: string
          lost_reason?: string | null
          pilgrim_id?: string | null
          pilgrim_name?: string | null
          rfq_id?: string | null
          score?: number
          snoozed_until?: string | null
          source?: string
          source_detail?: Json | null
          status?: string
          tags?: string[] | null
          trip_type?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          budget_range?: string | null
          created_at?: string
          departure_date?: string | null
          first_response_at?: string | null
          group_size?: number | null
          id?: string
          lost_reason?: string | null
          pilgrim_id?: string | null
          pilgrim_name?: string | null
          rfq_id?: string | null
          score?: number
          snoozed_until?: string | null
          source?: string
          source_detail?: Json | null
          status?: string
          tags?: string[] | null
          trip_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: string[]
          body: string
          created_at: string
          id: string
          is_read: boolean
          rfq_id: string
          sender_id: string | null
          sender_type: string
        }
        Insert: {
          attachments?: string[]
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          rfq_id: string
          sender_id?: string | null
          sender_type: string
        }
        Update: {
          attachments?: string[]
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          rfq_id?: string
          sender_id?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link_url: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link_url?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link_url?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      package_availability: {
        Row: {
          available_slots: number
          booked_slots: number
          created_at: string
          date: string
          id: string
          is_blackout: boolean
          package_id: string
          price_override: number | null
          updated_at: string
        }
        Insert: {
          available_slots?: number
          booked_slots?: number
          created_at?: string
          date: string
          id?: string
          is_blackout?: boolean
          package_id: string
          price_override?: number | null
          updated_at?: string
        }
        Update: {
          available_slots?: number
          booked_slots?: number
          created_at?: string
          date?: string
          id?: string
          is_blackout?: boolean
          package_id?: string
          price_override?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      package_media: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          label: string | null
          media_type: string
          moderation_status: string
          package_id: string
          sort_order: number
          thumbnail_url: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          media_type?: string
          moderation_status?: string
          package_id: string
          sort_order?: number
          thumbnail_url?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          media_type?: string
          moderation_status?: string
          package_id?: string
          sort_order?: number
          thumbnail_url?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_media_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      package_templates: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          name: string
          template_data: Json
          updated_at: string
          usage_count: number
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          name: string
          template_data?: Json
          updated_at?: string
          usage_count?: number
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          name?: string
          template_data?: Json
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      package_tiers: {
        Row: {
          created_at: string
          currency: string
          description_override: string | null
          hotel_override: string | null
          id: string
          is_highlighted: boolean
          meal_override: string | null
          package_id: string
          price_adult: number
          price_child: number | null
          room_type: string | null
          sort_order: number
          status: string
          tier_name: string
          transport_override: string | null
          updated_at: string
          zone_override: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          description_override?: string | null
          hotel_override?: string | null
          id?: string
          is_highlighted?: boolean
          meal_override?: string | null
          package_id: string
          price_adult: number
          price_child?: number | null
          room_type?: string | null
          sort_order?: number
          status?: string
          tier_name: string
          transport_override?: string | null
          updated_at?: string
          zone_override?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          description_override?: string | null
          hotel_override?: string | null
          id?: string
          is_highlighted?: boolean
          meal_override?: string | null
          package_id?: string
          price_adult?: number
          price_child?: number | null
          room_type?: string | null
          sort_order?: number
          status?: string
          tier_name?: string
          transport_override?: string | null
          updated_at?: string
          zone_override?: string | null
        }
        Relationships: []
      }
      packages: {
        Row: {
          accessibility: boolean
          agent_id: string
          base_price: number | null
          created_at: string
          currency: string
          date_end: string | null
          date_start: string | null
          departure_city: string
          departure_country: string
          distance_to_haram_m: number | null
          group_size_max: number | null
          group_size_min: number | null
          hotel_name: string | null
          hotel_stars: number | null
          hotel_zone: string | null
          id: string
          is_agent_active: boolean
          meals_included: string | null
          slug: string | null
          status: string
          thumbnail_url: string | null
          title: string
          transport_type: string | null
          type: string
          updated_at: string
          visa_included: boolean
        }
        Insert: {
          accessibility?: boolean
          agent_id: string
          base_price?: number | null
          created_at?: string
          currency?: string
          date_end?: string | null
          date_start?: string | null
          departure_city: string
          departure_country: string
          distance_to_haram_m?: number | null
          group_size_max?: number | null
          group_size_min?: number | null
          hotel_name?: string | null
          hotel_stars?: number | null
          hotel_zone?: string | null
          id?: string
          is_agent_active?: boolean
          meals_included?: string | null
          slug?: string | null
          status?: string
          thumbnail_url?: string | null
          title: string
          transport_type?: string | null
          type: string
          updated_at?: string
          visa_included?: boolean
        }
        Update: {
          accessibility?: boolean
          agent_id?: string
          base_price?: number | null
          created_at?: string
          currency?: string
          date_end?: string | null
          date_start?: string | null
          departure_city?: string
          departure_country?: string
          distance_to_haram_m?: number | null
          group_size_max?: number | null
          group_size_min?: number | null
          hotel_name?: string | null
          hotel_stars?: number | null
          hotel_zone?: string | null
          id?: string
          is_agent_active?: boolean
          meals_included?: string | null
          slug?: string | null
          status?: string
          thumbnail_url?: string | null
          title?: string
          transport_type?: string | null
          type?: string
          updated_at?: string
          visa_included?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "packages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          page_type: string
          viewer_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          page_type: string
          viewer_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          page_type?: string
          viewer_id?: string | null
        }
        Relationships: []
      }
      pilgrim_checklists: {
        Row: {
          created_at: string
          id: string
          items_status: Json
          pilgrim_id: string
          template_id: string
          trip_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          items_status?: Json
          pilgrim_id: string
          template_id: string
          trip_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          items_status?: Json
          pilgrim_id?: string
          template_id?: string
          trip_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilgrim_checklists_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      price_alerts: {
        Row: {
          created_at: string
          currency: string
          id: string
          is_active: boolean
          package_id: string
          pilgrim_id: string
          target_price: number
          triggered_at: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          package_id: string
          pilgrim_id: string
          target_price: number
          triggered_at?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          package_id?: string
          pilgrim_id?: string
          target_price?: number
          triggered_at?: string | null
        }
        Relationships: []
      }
      price_history: {
        Row: {
          currency: string
          id: string
          package_id: string
          price: number
          recorded_at: string
        }
        Insert: {
          currency?: string
          id?: string
          package_id: string
          price: number
          recorded_at?: string
        }
        Update: {
          currency?: string
          id?: string
          package_id?: string
          price?: number
          recorded_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          country_code: string | null
          created_at: string
          deleted_at: string | null
          full_name: string | null
          id: string
          preferred_currency: string
          preferred_locale: string
          role: string
          session_revoked_at: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          deleted_at?: string | null
          full_name?: string | null
          id: string
          preferred_currency?: string
          preferred_locale?: string
          role?: string
          session_revoked_at?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string
          deleted_at?: string | null
          full_name?: string | null
          id?: string
          preferred_currency?: string
          preferred_locale?: string
          role?: string
          session_revoked_at?: string | null
        }
        Relationships: []
      }
      quote_templates: {
        Row: {
          agent_id: string | null
          created_at: string
          design_id: number
          html_template: string
          id: string
          is_default: boolean
          is_starter: boolean
          merge_fields: string[]
          name: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          design_id?: number
          html_template?: string
          id?: string
          is_default?: boolean
          is_starter?: boolean
          merge_fields?: string[]
          name: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          design_id?: number
          html_template?: string
          id?: string
          is_default?: boolean
          is_starter?: boolean
          merge_fields?: string[]
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_templates_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          agent_id: string
          created_at: string
          hotel_name: string | null
          hotel_zone: string | null
          id: string
          notes: string | null
          package_id: string | null
          price_breakdown: Json | null
          price_currency: string
          price_total: number
          rfq_id: string
          status: string
          valid_until: string | null
          version: number
          viewed_at: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          hotel_name?: string | null
          hotel_zone?: string | null
          id?: string
          notes?: string | null
          package_id?: string | null
          price_breakdown?: Json | null
          price_currency?: string
          price_total: number
          rfq_id: string
          status?: string
          valid_until?: string | null
          version?: number
          viewed_at?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          hotel_name?: string | null
          hotel_zone?: string | null
          id?: string
          notes?: string | null
          package_id?: string | null
          price_breakdown?: Json | null
          price_currency?: string
          price_total?: number
          rfq_id?: string
          status?: string
          valid_until?: string | null
          version?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          agent_id: string
          code: string
          created_at: string
        }
        Insert: {
          agent_id: string
          code: string
          created_at?: string
        }
        Update: {
          agent_id?: string
          code?: string
          created_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          agent_id: string
          created_at: string
          credit_amount: number | null
          id: string
          pilgrim_id: string
          status: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          credit_amount?: number | null
          id?: string
          pilgrim_id: string
          status?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          credit_amount?: number | null
          id?: string
          pilgrim_id?: string
          status?: string
        }
        Relationships: []
      }
      regulatory_updates: {
        Row: {
          body: string
          countries: string[]
          created_at: string
          id: string
          published_at: string | null
          severity: string
          title: string
        }
        Insert: {
          body?: string
          countries?: string[]
          created_at?: string
          id?: string
          published_at?: string | null
          severity?: string
          title: string
        }
        Update: {
          body?: string
          countries?: string[]
          created_at?: string
          id?: string
          published_at?: string | null
          severity?: string
          title?: string
        }
        Relationships: []
      }
      review_media: {
        Row: {
          created_at: string
          id: string
          label: string | null
          media_type: string
          moderation_status: string
          review_id: string
          thumbnail_url: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          media_type?: string
          moderation_status?: string
          review_id: string
          thumbnail_url?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          media_type?: string
          moderation_status?: string
          review_id?: string
          thumbnail_url?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_media_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          agent_id: string
          agent_responded_at: string | null
          agent_response: string | null
          booking_id: string
          created_at: string
          dimensions: Json
          id: string
          is_highlighted: boolean
          is_verified: boolean
          moderation_note: string | null
          moderation_status: string
          overall_rating: number
          package_id: string | null
          pilgrim_id: string
          review_text: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          agent_responded_at?: string | null
          agent_response?: string | null
          booking_id: string
          created_at?: string
          dimensions: Json
          id?: string
          is_highlighted?: boolean
          is_verified?: boolean
          moderation_note?: string | null
          moderation_status?: string
          overall_rating: number
          package_id?: string | null
          pilgrim_id: string
          review_text?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          agent_responded_at?: string | null
          agent_response?: string | null
          booking_id?: string
          created_at?: string
          dimensions?: Json
          id?: string
          is_highlighted?: boolean
          is_verified?: boolean
          moderation_note?: string | null
          moderation_status?: string
          overall_rating?: number
          package_id?: string | null
          pilgrim_id?: string
          review_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_agent_matches: {
        Row: {
          agent_id: string
          delivered_at: string
          id: string
          responded: boolean
          responded_at: string | null
          rfq_id: string
        }
        Insert: {
          agent_id: string
          delivered_at?: string
          id?: string
          responded?: boolean
          responded_at?: string | null
          rfq_id: string
        }
        Update: {
          agent_id?: string
          delivered_at?: string
          id?: string
          responded?: boolean
          responded_at?: string | null
          rfq_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_agent_matches_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_agent_matches_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          accessibility_needs: string | null
          adults: number
          budget_currency: string | null
          budget_max: number | null
          budget_min: number | null
          children: number | null
          children_ages: number[] | null
          created_at: string
          date_from: string | null
          date_to: string | null
          departure_city: string
          departure_country: string
          expires_at: string
          id: string
          matched_agents: number
          meal_pref: string | null
          notes: string | null
          pilgrim_id: string
          status: string
          transport_pref: string | null
          type: string
          updated_at: string
          zone_pref: string | null
        }
        Insert: {
          accessibility_needs?: string | null
          adults?: number
          budget_currency?: string | null
          budget_max?: number | null
          budget_min?: number | null
          children?: number | null
          children_ages?: number[] | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          departure_city: string
          departure_country: string
          expires_at?: string
          id?: string
          matched_agents?: number
          meal_pref?: string | null
          notes?: string | null
          pilgrim_id: string
          status?: string
          transport_pref?: string | null
          type: string
          updated_at?: string
          zone_pref?: string | null
        }
        Update: {
          accessibility_needs?: string | null
          adults?: number
          budget_currency?: string | null
          budget_max?: number | null
          budget_min?: number | null
          children?: number | null
          children_ages?: number[] | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          departure_city?: string
          departure_country?: string
          expires_at?: string
          id?: string
          matched_agents?: number
          meal_pref?: string | null
          notes?: string | null
          pilgrim_id?: string
          status?: string
          transport_pref?: string | null
          type?: string
          updated_at?: string
          zone_pref?: string | null
        }
        Relationships: []
      }
      search_logs: {
        Row: {
          created_at: string
          id: string
          pilgrim_id: string | null
          query_params: Json
          results_count: number
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pilgrim_id?: string | null
          query_params?: Json
          results_count?: number
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pilgrim_id?: string | null
          query_params?: Json
          results_count?: number
          session_id?: string
        }
        Relationships: []
      }
      seo_pages: {
        Row: {
          agent_count: number
          city: string
          created_at: string
          faq: Json
          hero_image_url: string | null
          id: string
          locale: string
          meta_description: string
          price_max: number | null
          price_min: number | null
          slug: string
          status: string
          title: string
          trip_type: string
          updated_at: string
        }
        Insert: {
          agent_count?: number
          city: string
          created_at?: string
          faq?: Json
          hero_image_url?: string | null
          id?: string
          locale?: string
          meta_description: string
          price_max?: number | null
          price_min?: number | null
          slug: string
          status?: string
          title: string
          trip_type: string
          updated_at?: string
        }
        Update: {
          agent_count?: number
          city?: string
          created_at?: string
          faq?: Json
          hero_image_url?: string | null
          id?: string
          locale?: string
          meta_description?: string
          price_max?: number | null
          price_min?: number | null
          slug?: string
          status?: string
          title?: string
          trip_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          currency: string
          features: Json
          id: string
          is_custom: boolean
          lead_limit: number | null
          name: string
          price_monthly: number
          sort_order: number
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          features?: Json
          id: string
          is_custom?: boolean
          lead_limit?: number | null
          name: string
          price_monthly?: number
          sort_order?: number
          tier: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          features?: Json
          id?: string
          is_custom?: boolean
          lead_limit?: number | null
          name?: string
          price_monthly?: number
          sort_order?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      trust_scores: {
        Row: {
          agent_id: string
          computed_at: string
          factors: Json
          tips: string[]
          total_score: number
        }
        Insert: {
          agent_id: string
          computed_at?: string
          factors?: Json
          tips?: string[]
          total_score?: number
        }
        Update: {
          agent_id?: string
          computed_at?: string
          factors?: Json
          tips?: string[]
          total_score?: number
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          created_at: string
          id: string
          package_id: string
          pilgrim_id: string
          price_at_save: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          package_id: string
          pilgrim_id: string
          price_at_save?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          package_id?: string
          pilgrim_id?: string
          price_at_save?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      agent_analytics_daily: {
        Args: { _agent_id: string; _from: string; _to: string }
        Returns: {
          bookings: number
          date: string
          enquiries: number
          quotes_sent: number
          revenue: number
          views: number
        }[]
      }
      agent_lead_sources: {
        Args: { _agent_id: string; _from: string; _to: string }
        Returns: {
          count: number
          source: string
        }[]
      }
      agent_revenue_by_package: {
        Args: { _agent_id: string; _from: string; _to: string }
        Returns: {
          bookings: number
          package_id: string
          revenue: number
          title: string
        }[]
      }
      aggregate_agent_metrics: {
        Args: { target_date?: string }
        Returns: number
      }
      can_review_booking: { Args: { _booking_id: string }; Returns: boolean }
      compute_agent_response_time: {
        Args: { agent_uuid: string }
        Returns: number
      }
      compute_trust_score: { Args: { agent_uuid: string }; Returns: number }
      convert_currency: {
        Args: { amount: number; from_curr: string; to_curr: string }
        Returns: number
      }
      create_package_from_template: {
        Args: { template_uuid: string }
        Returns: string
      }
      duplicate_package: { Args: { package_uuid: string }; Returns: string }
      expire_ended_campaigns: { Args: never; Returns: number }
      expire_enforcement_actions: { Args: never; Returns: number }
      featured_metrics_for_campaigns: {
        Args: { _campaign_ids: string[] }
        Returns: {
          campaign_id: string
          clicks: number
          cost: number
          impressions: number
          rfqs: number
        }[]
      }
      generate_referral_code: { Args: never; Returns: string }
      get_agent_id: { Args: never; Returns: string }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_active_agent: { Args: { _agent_id: string }; Returns: boolean }
      is_agent_matched_to_rfq: { Args: { _rfq_id: string }; Returns: boolean }
      is_agent_owner: { Args: { _agent_id: string }; Returns: boolean }
      is_campaign_owner: { Args: { _campaign_id: string }; Returns: boolean }
      is_lead_owner: { Args: { _lead_id: string }; Returns: boolean }
      is_media_package_owner: {
        Args: { _package_id: string }
        Returns: boolean
      }
      is_package_owner: { Args: { _agent_id: string }; Returns: boolean }
      is_review_owner: { Args: { _review_id: string }; Returns: boolean }
      is_rfq_owner: { Args: { _rfq_id: string }; Returns: boolean }
      market_conversion_benchmark: {
        Args: { _country_code: string; _from: string; _to: string }
        Returns: number
      }
      match_agents_to_rfq: { Args: { _rfq_id: string }; Returns: number }
      process_badge_expirations: { Args: never; Returns: Json }
      recompute_seo_pages: { Args: never; Returns: number }
      slugify: { Args: { _input: string }; Returns: string }
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
