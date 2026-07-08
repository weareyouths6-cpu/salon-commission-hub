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
      commission_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          category: string | null
          created_at: string
          id: string
          new_staff_percent: number | null
          new_stylist_percent: number | null
          notes: string | null
          old_staff_percent: number | null
          old_stylist_percent: number | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          category?: string | null
          created_at?: string
          id?: string
          new_staff_percent?: number | null
          new_stylist_percent?: number | null
          notes?: string | null
          old_staff_percent?: number | null
          old_stylist_percent?: number | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          category?: string | null
          created_at?: string
          id?: string
          new_staff_percent?: number | null
          new_stylist_percent?: number | null
          notes?: string | null
          old_staff_percent?: number | null
          old_stylist_percent?: number | null
        }
        Relationships: []
      }
      commission_records: {
        Row: {
          category: string
          commission_amount: number
          commission_percent: number
          created_at: string
          customer_package_id: string | null
          employee_id: string
          employee_role: string
          event_date: string
          id: string
          sale_amount: number
          source_type: string
          usage_log_id: string | null
        }
        Insert: {
          category: string
          commission_amount: number
          commission_percent: number
          created_at?: string
          customer_package_id?: string | null
          employee_id: string
          employee_role: string
          event_date: string
          id?: string
          sale_amount: number
          source_type: string
          usage_log_id?: string | null
        }
        Update: {
          category?: string
          commission_amount?: number
          commission_percent?: number
          created_at?: string
          customer_package_id?: string | null
          employee_id?: string
          employee_role?: string
          event_date?: string
          id?: string
          sale_amount?: number
          source_type?: string
          usage_log_id?: string | null
        }
        Relationships: []
      }
      commission_settings: {
        Row: {
          category: string
          created_at: string
          id: string
          staff_percent: number
          stylist_percent: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          staff_percent?: number
          stylist_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          staff_percent?: number
          stylist_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      customer_packages: {
        Row: {
          customer_id: string
          deposit_paid: boolean
          deposit_paid_at: string | null
          deposit_sessions_paid: number
          id: string
          package_id: string
          purchase_date: string
          sessions_remaining: number
          total_sessions: number
          warranty_expires_at: string | null
          warranty_years: number
        }
        Insert: {
          customer_id: string
          deposit_paid?: boolean
          deposit_paid_at?: string | null
          deposit_sessions_paid?: number
          id?: string
          package_id: string
          purchase_date?: string
          sessions_remaining: number
          total_sessions: number
          warranty_expires_at?: string | null
          warranty_years?: number
        }
        Update: {
          customer_id?: string
          deposit_paid?: boolean
          deposit_paid_at?: string | null
          deposit_sessions_paid?: number
          id?: string
          package_id?: string
          purchase_date?: string
          sessions_remaining?: number
          total_sessions?: number
          warranty_expires_at?: string | null
          warranty_years?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      package_promotions: {
        Row: {
          created_at: string
          id: string
          package_id: string
          promotion_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          package_id: string
          promotion_id: string
        }
        Update: {
          created_at?: string
          id?: string
          package_id?: string
          promotion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_promotions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_promotions_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          points_awarded: number
          price: number
          total_sessions: number
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          points_awarded?: number
          price?: number
          total_sessions?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          points_awarded?: number
          price?: number
          total_sessions?: number
        }
        Relationships: []
      }
      payrolls: {
        Row: {
          bonus: number
          created_at: string
          deduction: number
          employee_id: string
          employee_role: string
          id: string
          month: number
          net_pay: number
          payment_date: string | null
          payment_status: string
          remarks: string | null
          total_commission: number
          year: number
        }
        Insert: {
          bonus?: number
          created_at?: string
          deduction?: number
          employee_id: string
          employee_role: string
          id?: string
          month: number
          net_pay?: number
          payment_date?: string | null
          payment_status?: string
          remarks?: string | null
          total_commission?: number
          year: number
        }
        Update: {
          bonus?: number
          created_at?: string
          deduction?: number
          employee_id?: string
          employee_role?: string
          id?: string
          month?: number
          net_pay?: number
          payment_date?: string | null
          payment_status?: string
          remarks?: string | null
          total_commission?: number
          year?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          must_change_password: boolean
          name: string | null
          phone: string | null
          points: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          must_change_password?: boolean
          name?: string | null
          phone?: string | null
          points?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          must_change_password?: boolean
          name?: string | null
          phone?: string | null
          points?: number
        }
        Relationships: []
      }
      promotions: {
        Row: {
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          end_date: string
          id: string
          is_active: boolean
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value: number
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_staff: {
        Row: {
          created_at: string
          id: string
          staff_user_id: string
          usage_log_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          staff_user_id: string
          usage_log_id: string
        }
        Update: {
          created_at?: string
          id?: string
          staff_user_id?: string
          usage_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_staff_usage_log_id_fkey"
            columns: ["usage_log_id"]
            isOneToOne: false
            referencedRelation: "usage_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          admin_id: string | null
          customer_package_id: string
          id: string
          used_at: string
        }
        Insert: {
          admin_id?: string | null
          customer_package_id: string
          id?: string
          used_at?: string
        }
        Update: {
          admin_id?: string | null
          customer_package_id?: string
          id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_customer_package_id_fkey"
            columns: ["customer_package_id"]
            isOneToOne: false
            referencedRelation: "customer_packages"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "customer" | "staff" | "stylist"
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
      app_role: ["admin", "customer", "staff", "stylist"],
    },
  },
} as const
