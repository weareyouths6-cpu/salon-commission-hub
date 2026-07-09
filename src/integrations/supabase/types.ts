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
      assistants: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
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
          employee_id: string
          employee_role: string
          id: string
          invoice_date: string
          invoice_id: string
          invoice_item_id: string
          sale_amount: number
        }
        Insert: {
          category: string
          commission_amount: number
          commission_percent: number
          created_at?: string
          employee_id: string
          employee_role: string
          id?: string
          invoice_date: string
          invoice_id: string
          invoice_item_id: string
          sale_amount: number
        }
        Update: {
          category?: string
          commission_amount?: number
          commission_percent?: number
          created_at?: string
          employee_id?: string
          employee_role?: string
          id?: string
          invoice_date?: string
          invoice_id?: string
          invoice_item_id?: string
          sale_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_records_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_records_invoice_item_id_fkey"
            columns: ["invoice_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
        ]
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
          staff_percent: number
          stylist_percent: number
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
          id: string
          package_id: string
          purchase_date: string
          sessions_remaining: number
          total_sessions: number
        }
        Insert: {
          customer_id: string
          deposit_paid?: boolean
          deposit_paid_at?: string | null
          id?: string
          package_id: string
          purchase_date?: string
          sessions_remaining: number
          total_sessions: number
        }
        Update: {
          customer_id?: string
          deposit_paid?: boolean
          deposit_paid_at?: string | null
          id?: string
          package_id?: string
          purchase_date?: string
          sessions_remaining?: number
          total_sessions?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_packages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          item_type: string
          line_total: number
          name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          item_type: string
          line_total?: number
          name: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          item_type?: string
          line_total?: number
          name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          assistant_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          invoice_date: string
          invoice_no: string
          payment_status: string
          stylist_id: string | null
          total: number
        }
        Insert: {
          assistant_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_date?: string
          invoice_no: string
          payment_status?: string
          stylist_id?: string | null
          total?: number
        }
        Update: {
          assistant_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_date?: string
          invoice_no?: string
          payment_status?: string
          stylist_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_stylist_id_fkey"
            columns: ["stylist_id"]
            isOneToOne: false
            referencedRelation: "stylists"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
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
          updated_at: string
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
          updated_at?: string
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
          updated_at?: string
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
            foreignKeyName: "session_staff_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_staff_usage_log_id_fkey"
            columns: ["usage_log_id"]
            isOneToOne: false
            referencedRelation: "usage_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      stylists: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      usage_logs: {
        Row: {
          admin_id: string
          customer_package_id: string
          id: string
          used_at: string
        }
        Insert: {
          admin_id: string
          customer_package_id: string
          id?: string
          used_at?: string
        }
        Update: {
          admin_id?: string
          customer_package_id?: string
          id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
      app_role: "admin" | "customer" | "staff"
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
      app_role: ["admin", "customer", "staff"],
    },
  },
} as const
