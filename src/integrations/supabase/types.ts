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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_bundle_prices: {
        Row: {
          active: boolean
          agent_id: string
          bundle_id: string
          created_at: string
          id: string
          sell_price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          agent_id: string
          bundle_id: string
          created_at?: string
          id?: string
          sell_price: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          agent_id?: string
          bundle_id?: string
          created_at?: string
          id?: string
          sell_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_bundle_prices_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_bundle_prices_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_profiles: {
        Row: {
          activation_paid: boolean
          activation_paid_at: string | null
          created_at: string
          custom_domain: string | null
          id: string
          parent_agent_id: string | null
          referred_by_agent_id: string | null
          store_brand_color: string | null
          store_dark_mode: boolean | null
          store_font_family: string | null
          store_logo_url: string | null
          store_name: string
          store_promo_banner: string | null
          store_promo_banner_style: string | null
          store_slug: string
          store_tagline: string | null
          store_template_theme: string | null
          support_phone: string | null
          support_whatsapp: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activation_paid?: boolean
          activation_paid_at?: string | null
          created_at?: string
          custom_domain?: string | null
          id?: string
          parent_agent_id?: string | null
          referred_by_agent_id?: string | null
          store_brand_color?: string | null
          store_dark_mode?: boolean | null
          store_font_family?: string | null
          store_logo_url?: string | null
          store_name?: string
          store_promo_banner?: string | null
          store_promo_banner_style?: string | null
          store_slug: string
          store_tagline?: string | null
          store_template_theme?: string | null
          support_phone?: string | null
          support_whatsapp?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activation_paid?: boolean
          activation_paid_at?: string | null
          created_at?: string
          custom_domain?: string | null
          id?: string
          parent_agent_id?: string | null
          referred_by_agent_id?: string | null
          store_brand_color?: string | null
          store_dark_mode?: boolean | null
          store_font_family?: string | null
          store_logo_url?: string | null
          store_name?: string
          store_promo_banner?: string | null
          store_promo_banner_style?: string | null
          store_slug?: string
          store_tagline?: string | null
          store_template_theme?: string | null
          support_phone?: string | null
          support_whatsapp?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_profiles_referred_by_agent_id_fkey"
            columns: ["referred_by_agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_notifications: {
        Row: {
          created_at: string
          id: string
          is_global: boolean
          message: string
          sound_name: string
          target_user_id: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_global?: boolean
          message: string
          sound_name?: string
          target_user_id?: string | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_global?: boolean
          message?: string
          sound_name?: string
          target_user_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_notifications_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      bundles: {
        Row: {
          active: boolean
          base_price: number
          created_at: string
          id: string
          network_id: string
          size_label: string
          size_mb: number
          sort_order: number
          updated_at: string
          user_price: number
        }
        Insert: {
          active?: boolean
          base_price: number
          created_at?: string
          id?: string
          network_id: string
          size_label: string
          size_mb: number
          sort_order?: number
          updated_at?: string
          user_price: number
        }
        Update: {
          active?: boolean
          base_price?: number
          created_at?: string
          id?: string
          network_id?: string
          size_label?: string
          size_mb?: number
          sort_order?: number
          updated_at?: string
          user_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "bundles_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean | null
          agent_id: string | null
          code: string
          created_at: string | null
          current_uses: number | null
          discount_amount: number
          id: string
          max_uses: number | null
        }
        Insert: {
          active?: boolean | null
          agent_id?: string | null
          code: string
          created_at?: string | null
          current_uses?: number | null
          discount_amount?: number
          id?: string
          max_uses?: number | null
        }
        Update: {
          active?: boolean | null
          agent_id?: string | null
          code?: string
          created_at?: string | null
          current_uses?: number | null
          discount_amount?: number
          id?: string
          max_uses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      momo_subscriptions: {
        Row: {
          agent_id: string | null
          bundle_id: string | null
          created_at: string | null
          frequency: string
          id: string
          next_billing_at: string
          recipient_phone: string
          status: string
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          bundle_id?: string | null
          created_at?: string | null
          frequency: string
          id?: string
          next_billing_at: string
          recipient_phone: string
          status?: string
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          bundle_id?: string | null
          created_at?: string | null
          frequency?: string
          id?: string
          next_billing_at?: string
          recipient_phone?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "momo_subscriptions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "momo_subscriptions_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "momo_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      networks: {
        Row: {
          active: boolean
          code: string
          color: string
          created_at: string
          id: string
          logo_emoji: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          color?: string
          created_at?: string
          id?: string
          logo_emoji?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          color?: string
          created_at?: string
          id?: string
          logo_emoji?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          agent_id: string | null
          agent_profit: number
          base_price: number
          bundle_id: string
          created_at: string
          customer_phone: string
          customer_user_id: string | null
          id: string
          network_id: string
          notes: string | null
          parent_agent_id: string | null
          parent_agent_profit: number
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          recipient_phone: string
          reference: string
          sell_price: number
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          agent_profit?: number
          base_price: number
          bundle_id: string
          created_at?: string
          customer_phone: string
          customer_user_id?: string | null
          id?: string
          network_id: string
          notes?: string | null
          parent_agent_id?: string | null
          parent_agent_profit?: number
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          recipient_phone: string
          reference?: string
          sell_price: number
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          agent_profit?: number
          base_price?: number
          bundle_id?: string
          created_at?: string
          customer_phone?: string
          customer_user_id?: string | null
          id?: string
          network_id?: string
          notes?: string | null
          parent_agent_id?: string | null
          parent_agent_profit?: number
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          recipient_phone?: string
          reference?: string
          sell_price?: number
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_parent_agent_id_fkey"
            columns: ["parent_agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          order_id: string | null
          payload: Json | null
          purpose: string
          reference: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string | null
          payload?: Json | null
          purpose: string
          reference: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string | null
          payload?: Json | null
          purpose?: string
          reference?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          last_notification_check: string | null
          phone: string | null
          referral_code: string | null
          referred_by: string | null
          updated_at: string
          username: string | null
          wallet_balance: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          last_notification_check?: string | null
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          username?: string | null
          wallet_balance?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          last_notification_check?: string | null
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          username?: string | null
          wallet_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      storefront_analytics: {
        Row: {
          agent_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          session_token: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          session_token: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          session_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_analytics_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_hidden_notifications: {
        Row: {
          created_at: string
          notification_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          notification_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          notification_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_hidden_notifications_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "app_notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_hidden_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          related_order_id: string | null
          status: Database["public"]["Enums"]["wallet_tx_status"]
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          related_order_id?: string | null
          status?: Database["public"]["Enums"]["wallet_tx_status"]
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          related_order_id?: string | null
          status?: Database["public"]["Enums"]["wallet_tx_status"]
          type?: Database["public"]["Enums"]["wallet_tx_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          momo_name: string
          momo_network: string
          momo_number: string
          processed_at: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          momo_name: string
          momo_network: string
          momo_number: string
          processed_at?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          momo_name?: string
          momo_network?: string
          momo_number?: string
          processed_at?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_referral_code: { Args: { user_id: string }; Returns: string }
      get_wallet_balance: { Args: { _user_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_wallet_balance: {
        Args: { amount_param: number; user_id_param: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "agent" | "user"
      order_source: "direct" | "agent_store"
      order_status:
        | "pending"
        | "processing"
        | "delivered"
        | "failed"
        | "refunded"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      wallet_tx_status: "pending" | "completed" | "failed" | "reversed"
      wallet_tx_type:
        | "earning"
        | "withdrawal"
        | "refund"
        | "activation_fee"
        | "adjustment"
        | "deposit"
        | "purchase"
        | "affiliate_commission"
      withdrawal_status: "pending" | "approved" | "rejected" | "paid"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "agent", "user"],
      order_source: ["direct", "agent_store"],
      order_status: [
        "pending",
        "processing",
        "delivered",
        "failed",
        "refunded",
      ],
      payment_status: ["pending", "paid", "failed", "refunded"],
      wallet_tx_status: ["pending", "completed", "failed", "reversed"],
      wallet_tx_type: [
        "earning",
        "withdrawal",
        "refund",
        "activation_fee",
        "adjustment",
        "deposit",
        "purchase",
        "affiliate_commission",
      ],
      withdrawal_status: ["pending", "approved", "rejected", "paid"],
    },
  },
} as const
