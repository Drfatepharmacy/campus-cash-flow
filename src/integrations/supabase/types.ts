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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          ip: string | null
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      campuses: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          short_name: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          short_name?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          short_name?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          faculty_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          faculty_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          faculty_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculties"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_jobs: {
        Row: {
          created_at: string
          deposit_slip_url: string | null
          id: string
          notes: string | null
          reference: string
          runner_id: string | null
          settlement_id: string | null
          status: Database["public"]["Enums"]["settlement_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deposit_slip_url?: string | null
          id?: string
          notes?: string | null
          reference: string
          runner_id?: string | null
          settlement_id?: string | null
          status?: Database["public"]["Enums"]["settlement_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deposit_slip_url?: string | null
          id?: string
          notes?: string | null
          reference?: string
          runner_id?: string | null
          settlement_id?: string | null
          status?: Database["public"]["Enums"]["settlement_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_jobs_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      faculties: {
        Row: {
          campus_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          campus_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          campus_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faculties_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_ledger: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          entry_type: string
          id: string
          metadata: Json
          provider: string | null
          provider_event_id: string | null
          provider_ref: string | null
          reference: string
          transaction_id: string | null
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency?: string
          entry_type: string
          id?: string
          metadata?: Json
          provider?: string | null
          provider_event_id?: string | null
          provider_ref?: string | null
          reference: string
          transaction_id?: string | null
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          entry_type?: string
          id?: string
          metadata?: Json
          provider?: string | null
          provider_event_id?: string | null
          provider_ref?: string | null
          reference?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_ledger_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_requests: {
        Row: {
          active: boolean
          base_amount: number
          campus_id: string
          closes_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          opens_at: string | null
          target_department_id: string | null
          target_faculty_id: string | null
          target_level: number | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_amount: number
          campus_id: string
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          opens_at?: string | null
          target_department_id?: string | null
          target_faculty_id?: string | null
          target_level?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_amount?: number
          campus_id?: string
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          opens_at?: string | null
          target_department_id?: string | null
          target_faculty_id?: string | null
          target_level?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_target_department_id_fkey"
            columns: ["target_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_target_faculty_id_fkey"
            columns: ["target_faculty_id"]
            isOneToOne: false
            referencedRelation: "faculties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          campus_id: string | null
          created_at: string
          department_id: string | null
          email: string
          faculty_id: string | null
          full_name: string | null
          id: string
          level: number | null
          matric_no: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          campus_id?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          faculty_id?: string | null
          full_name?: string | null
          id: string
          level?: number | null
          matric_no?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          campus_id?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          faculty_id?: string | null
          full_name?: string | null
          id?: string
          level?: number | null
          matric_no?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculties"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_codes: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          encoded_value: string
          expires_at: string | null
          id: string
          label: string
          max_scans: number | null
          owner_id: string
          payload: Json
          scan_count: number
          single_use: boolean
          status: Database["public"]["Enums"]["qr_status"]
          style: Json
          token: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          encoded_value: string
          expires_at?: string | null
          id?: string
          label: string
          max_scans?: number | null
          owner_id: string
          payload: Json
          scan_count?: number
          single_use?: boolean
          status?: Database["public"]["Enums"]["qr_status"]
          style?: Json
          token: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          encoded_value?: string
          expires_at?: string | null
          id?: string
          label?: string
          max_scans?: number | null
          owner_id?: string
          payload?: Json
          scan_count?: number
          single_use?: boolean
          status?: Database["public"]["Enums"]["qr_status"]
          style?: Json
          token?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      qr_scans: {
        Row: {
          created_at: string
          id: string
          ip: string | null
          metadata: Json | null
          qr_id: string | null
          result: Database["public"]["Enums"]["qr_scan_result"]
          scanner_id: string | null
          token: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          qr_id?: string | null
          result: Database["public"]["Enums"]["qr_scan_result"]
          scanner_id?: string | null
          token: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          qr_id?: string | null
          result?: Database["public"]["Enums"]["qr_scan_result"]
          scanner_id?: string | null
          token?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_scans_qr_id_fkey"
            columns: ["qr_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          id: string
          issued_at: string
          qr_token: string
          transaction_id: string
        }
        Insert: {
          id?: string
          issued_at?: string
          qr_token: string
          transaction_id: string
        }
        Update: {
          id?: string
          issued_at?: string
          qr_token?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      service_charge_rules: {
        Row: {
          active: boolean
          created_at: string
          department_id: string | null
          id: string
          payment_request_id: string | null
          scope: string
          tiers: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          department_id?: string | null
          id?: string
          payment_request_id?: string | null
          scope?: string
          tiers: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          department_id?: string | null
          id?: string
          payment_request_id?: string | null
          scope?: string
          tiers?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_charge_rules_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_charge_rules_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          amount: number
          bank_reference: string | null
          created_at: string
          department_id: string | null
          id: string
          notes: string | null
          reference: string
          settled_at: string | null
          status: Database["public"]["Enums"]["settlement_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          bank_reference?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          notes?: string | null
          reference: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["settlement_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_reference?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          notes?: string | null
          reference?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["settlement_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          base_amount: number
          base_minor: number
          charge_minor: number
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          payment_request_id: string
          paystack_ref: string | null
          paystack_response: Json | null
          reference: string
          service_charge: number
          settlement_id: string | null
          status: Database["public"]["Enums"]["txn_status"]
          student_id: string
          total_amount: number
          total_minor: number
          updated_at: string
        }
        Insert: {
          base_amount: number
          base_minor: number
          charge_minor: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          payment_request_id: string
          paystack_ref?: string | null
          paystack_response?: Json | null
          reference: string
          service_charge?: number
          settlement_id?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          student_id: string
          total_amount: number
          total_minor: number
          updated_at?: string
        }
        Update: {
          base_amount?: number
          base_minor?: number
          charge_minor?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          payment_request_id?: string
          paystack_ref?: string | null
          paystack_response?: Json | null
          reference?: string
          service_charge?: number
          settlement_id?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          student_id?: string
          total_amount?: number
          total_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_student_id_profiles_fkey"
            columns: ["student_id"]
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
      webhook_events: {
        Row: {
          event_id: string
          event_type: string | null
          id: string
          outcome: string | null
          payload_hash: string
          processed_at: string
          provider: string
          reference: string | null
        }
        Insert: {
          event_id: string
          event_type?: string | null
          id?: string
          outcome?: string | null
          payload_hash: string
          processed_at?: string
          provider: string
          reference?: string | null
        }
        Update: {
          event_id?: string
          event_type?: string | null
          id?: string
          outcome?: string | null
          payload_hash?: string
          processed_at?: string
          provider?: string
          reference?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      finalize_payment: {
        Args: {
          _amount_minor: number
          _currency: string
          _customer_email: string
          _paid_at: string
          _provider: string
          _provider_event_id: string
          _provider_ref: string
          _raw: Json
          _reference: string
        }
        Returns: {
          outcome: string
          qr_token: string
          transaction_id: string
        }[]
      }
      gen_receipt_token: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      qr_log_scan: {
        Args: { _ip: string; _token: string; _ua: string }
        Returns: Database["public"]["Enums"]["qr_scan_result"]
      }
      qr_lookup: {
        Args: { _token: string }
        Returns: {
          created_at: string
          description: string
          encoded_value: string
          expires_at: string
          id: string
          label: string
          max_scans: number
          scan_count: number
          single_use: boolean
          status: Database["public"]["Enums"]["qr_status"]
          type: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "student"
        | "department_rep"
        | "faculty_rep"
        | "bank_runner"
      qr_scan_result:
        | "valid"
        | "expired"
        | "revoked"
        | "exhausted"
        | "not_found"
        | "archived"
      qr_status: "active" | "revoked" | "archived"
      settlement_status:
        | "pending"
        | "assigned"
        | "in_progress"
        | "deposited"
        | "confirmed"
        | "flagged"
      txn_status: "pending" | "paid" | "failed" | "refunded"
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
      app_role: [
        "admin",
        "student",
        "department_rep",
        "faculty_rep",
        "bank_runner",
      ],
      qr_scan_result: [
        "valid",
        "expired",
        "revoked",
        "exhausted",
        "not_found",
        "archived",
      ],
      qr_status: ["active", "revoked", "archived"],
      settlement_status: [
        "pending",
        "assigned",
        "in_progress",
        "deposited",
        "confirmed",
        "flagged",
      ],
      txn_status: ["pending", "paid", "failed", "refunded"],
    },
  },
} as const
