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
      approval_requests: {
        Row: {
          action_type: string
          approved_at: string | null
          approved_by: string | null
          association_id: string
          created_at: string
          decision_reason: string | null
          executed_at: string | null
          id: string
          payload: Json
          reason: string | null
          requested_by: string
          requires_super_admin: boolean
          status: Database["public"]["Enums"]["approval_request_status"]
          updated_at: string
        }
        Insert: {
          action_type: string
          approved_at?: string | null
          approved_by?: string | null
          association_id: string
          created_at?: string
          decision_reason?: string | null
          executed_at?: string | null
          id?: string
          payload?: Json
          reason?: string | null
          requested_by: string
          requires_super_admin?: boolean
          status?: Database["public"]["Enums"]["approval_request_status"]
          updated_at?: string
        }
        Update: {
          action_type?: string
          approved_at?: string | null
          approved_by?: string | null
          association_id?: string
          created_at?: string
          decision_reason?: string | null
          executed_at?: string | null
          id?: string
          payload?: Json
          reason?: string | null
          requested_by?: string
          requires_super_admin?: boolean
          status?: Database["public"]["Enums"]["approval_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      association_financial_accounts: {
        Row: {
          account_last4: string
          account_name: string
          account_number: string
          association_id: string
          bank_name: string
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean
          officer_approved_at: string | null
          officer_approved_by: string | null
          rejection_reason: string | null
          status: string
          submitted_by: string | null
          updated_at: string
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_last4: string
          account_name: string
          account_number: string
          association_id: string
          bank_name: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          officer_approved_at?: string | null
          officer_approved_by?: string | null
          rejection_reason?: string | null
          status?: string
          submitted_by?: string | null
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_last4?: string
          account_name?: string
          account_number?: string
          association_id?: string
          bank_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          officer_approved_at?: string | null
          officer_approved_by?: string | null
          rejection_reason?: string | null
          status?: string
          submitted_by?: string | null
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "association_financial_accounts_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      association_memberships: {
        Row: {
          association_id: string
          created_at: string
          id: string
          joined_at: string | null
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          association_id: string
          created_at?: string
          id?: string
          joined_at?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          association_id?: string
          created_at?: string
          id?: string
          joined_at?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "association_memberships_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      association_role_assignments: {
        Row: {
          appointment_source: string
          approved_at: string | null
          approved_by: string | null
          association_id: string
          created_at: string
          ends_at: string | null
          id: string
          revocation_reason: string | null
          role_key: string
          starts_at: string
          status: Database["public"]["Enums"]["assignment_status"]
          term_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_source?: string
          approved_at?: string | null
          approved_by?: string | null
          association_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          revocation_reason?: string | null
          role_key: string
          starts_at?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          term_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_source?: string
          approved_at?: string | null
          approved_by?: string | null
          association_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          revocation_reason?: string | null
          role_key?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          term_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "association_role_assignments_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "association_role_assignments_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "association_roles"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "association_role_assignments_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "executive_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      association_roles: {
        Row: {
          created_at: string
          description: string | null
          is_head: boolean
          key: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_head?: boolean
          key: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          is_head?: boolean
          key?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      associations: {
        Row: {
          banner_url: string | null
          campus_id: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          faculty_id: string | null
          financials_enabled: boolean
          id: string
          institution: string
          logo_url: string | null
          name: string
          official_email: string | null
          official_phone: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          session_year: string | null
          short_name: string | null
          slug: string
          status: Database["public"]["Enums"]["association_status"]
          status_reason: string | null
          type: Database["public"]["Enums"]["association_type"]
          updated_at: string
          verification_documents: Json
        }
        Insert: {
          banner_url?: string | null
          campus_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          faculty_id?: string | null
          financials_enabled?: boolean
          id?: string
          institution: string
          logo_url?: string | null
          name: string
          official_email?: string | null
          official_phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_year?: string | null
          short_name?: string | null
          slug: string
          status?: Database["public"]["Enums"]["association_status"]
          status_reason?: string | null
          type?: Database["public"]["Enums"]["association_type"]
          updated_at?: string
          verification_documents?: Json
        }
        Update: {
          banner_url?: string | null
          campus_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          faculty_id?: string | null
          financials_enabled?: boolean
          id?: string
          institution?: string
          logo_url?: string | null
          name?: string
          official_email?: string | null
          official_phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_year?: string | null
          short_name?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["association_status"]
          status_reason?: string | null
          type?: Database["public"]["Enums"]["association_type"]
          updated_at?: string
          verification_documents?: Json
        }
        Relationships: [
          {
            foreignKeyName: "associations_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associations_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculties"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          association_id: string | null
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
          association_id?: string | null
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
          association_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
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
      executive_terms: {
        Row: {
          association_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_current: boolean
          label: string
          session_year: string | null
          starts_at: string
          updated_at: string
        }
        Insert: {
          association_id: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_current?: boolean
          label: string
          session_year?: string | null
          starts_at?: string
          updated_at?: string
        }
        Update: {
          association_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_current?: boolean
          label?: string
          session_year?: string | null
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "executive_terms_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
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
      leadership_nominations: {
        Row: {
          association_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          evidence: Json
          id: string
          nominee_email: string | null
          nominee_name: string
          nominee_user_id: string | null
          notes: string | null
          role_key: string
          status: Database["public"]["Enums"]["nomination_status"]
          submitted_by: string | null
          term_id: string | null
          updated_at: string
        }
        Insert: {
          association_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          evidence?: Json
          id?: string
          nominee_email?: string | null
          nominee_name: string
          nominee_user_id?: string | null
          notes?: string | null
          role_key: string
          status?: Database["public"]["Enums"]["nomination_status"]
          submitted_by?: string | null
          term_id?: string | null
          updated_at?: string
        }
        Update: {
          association_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          evidence?: Json
          id?: string
          nominee_email?: string | null
          nominee_name?: string
          nominee_user_id?: string | null
          notes?: string | null
          role_key?: string
          status?: Database["public"]["Enums"]["nomination_status"]
          submitted_by?: string | null
          term_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leadership_nominations_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leadership_nominations_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "association_roles"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "leadership_nominations_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "executive_terms"
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
          association_id: string | null
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
          association_id?: string | null
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
          association_id?: string | null
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
            foreignKeyName: "payment_requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
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
      permissions: {
        Row: {
          description: string
          key: string
          sensitive: boolean
        }
        Insert: {
          description: string
          key: string
          sensitive?: boolean
        }
        Update: {
          description?: string
          key?: string
          sensitive?: boolean
        }
        Relationships: []
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
      role_permissions: {
        Row: {
          permission_key: string
          role_key: string
        }
        Insert: {
          permission_key: string
          role_key: string
        }
        Update: {
          permission_key?: string
          role_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "association_roles"
            referencedColumns: ["key"]
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
          association_id: string | null
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
          association_id?: string | null
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
          association_id?: string | null
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
            foreignKeyName: "settlements_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
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
          association_id: string | null
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
          association_id?: string | null
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
          association_id?: string | null
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
            foreignKeyName: "transactions_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
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
      expire_role_assignments: { Args: never; Returns: number }
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
      has_assoc_permission: {
        Args: { _association_id: string; _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_association_member: {
        Args: { _association_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
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
        | "super_admin"
      approval_request_status:
        | "pending"
        | "approved"
        | "rejected"
        | "executed"
        | "cancelled"
      assignment_status:
        | "pending"
        | "active"
        | "expired"
        | "suspended"
        | "revoked"
      association_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "verified"
        | "active"
        | "suspended"
        | "archived"
        | "rejected"
      association_type:
        | "departmental"
        | "faculty"
        | "institutional"
        | "religious"
        | "social"
        | "professional"
        | "sports"
        | "other"
      membership_status: "pending" | "active" | "suspended" | "removed"
      nomination_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "withdrawn"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
        "super_admin",
      ],
      approval_request_status: [
        "pending",
        "approved",
        "rejected",
        "executed",
        "cancelled",
      ],
      assignment_status: [
        "pending",
        "active",
        "expired",
        "suspended",
        "revoked",
      ],
      association_status: [
        "draft",
        "submitted",
        "under_review",
        "verified",
        "active",
        "suspended",
        "archived",
        "rejected",
      ],
      association_type: [
        "departmental",
        "faculty",
        "institutional",
        "religious",
        "social",
        "professional",
        "sports",
        "other",
      ],
      membership_status: ["pending", "active", "suspended", "removed"],
      nomination_status: [
        "draft",
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "withdrawn",
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
