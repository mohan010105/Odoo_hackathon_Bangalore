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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          attendance_date: string
          check_in: string | null
          check_out: string | null
          created_at: string
          employee_id: string
          extra_hours: number
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          work_hours: number
        }
        Insert: {
          attendance_date: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          employee_id: string
          extra_hours?: number
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          work_hours?: number
        }
        Update: {
          attendance_date?: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          employee_id?: string
          extra_hours?: number
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          work_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          summary: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          summary?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          summary?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_login_sequences: {
        Row: {
          joining_year: number
          last_serial: number
        }
        Insert: {
          joining_year: number
          last_serial?: number
        }
        Update: {
          joining_year?: number
          last_serial?: number
        }
        Relationships: []
      }
      employee_private_info: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          employee_id: string
          gender: string | null
          id: string
          marital_status: string | null
          national_id: string | null
          notes: string | null
          personal_email: string | null
          personal_phone: string | null
          postal_code: string | null
          state: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          employee_id: string
          gender?: string | null
          id?: string
          marital_status?: string | null
          national_id?: string | null
          notes?: string | null
          personal_email?: string | null
          personal_phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          employee_id?: string
          gender?: string | null
          id?: string
          marital_status?: string | null
          national_id?: string | null
          notes?: string | null
          personal_email?: string | null
          personal_phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_private_info_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          company_id: string | null
          created_at: string
          department: string | null
          department_id: string | null
          email: string
          first_name: string
          id: string
          job_position: string | null
          joining_date: string
          last_name: string
          location: string | null
          login_id: string
          manager: string | null
          phone: string | null
          position_id: string | null
          profile_picture: string | null
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          email: string
          first_name: string
          id?: string
          job_position?: string | null
          joining_date: string
          last_name: string
          location?: string | null
          login_id: string
          manager?: string | null
          phone?: string | null
          position_id?: string | null
          profile_picture?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          email?: string
          first_name?: string
          id?: string
          job_position?: string | null
          joining_date?: string
          last_name?: string
          location?: string | null
          login_id?: string
          manager?: string | null
          phone?: string | null
          position_id?: string | null
          profile_picture?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "job_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlement_changes: {
        Row: {
          change_type: string
          changed_by: string | null
          created_at: string
          effective_from: string | null
          effective_to: string | null
          employee_id: string
          id: string
          label: string
          new_value: Json | null
          previous_value: Json | null
        }
        Insert: {
          change_type: string
          changed_by?: string | null
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          employee_id: string
          id?: string
          label: string
          new_value?: Json | null
          previous_value?: Json | null
        }
        Update: {
          change_type?: string
          changed_by?: string | null
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          employee_id?: string
          id?: string
          label?: string
          new_value?: Json | null
          previous_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "entitlement_changes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      export_jobs: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_label: string
          id: string
          idempotency_key: string
          kind: string
          record_count: number
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_label: string
          id?: string
          idempotency_key: string
          kind: string
          record_count?: number
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_label?: string
          id?: string
          idempotency_key?: string
          kind?: string
          record_count?: number
        }
        Relationships: []
      }
      job_positions: {
        Row: {
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_allocations: {
        Row: {
          allocated_days: number
          created_at: string
          employee_id: string
          id: string
          leave_type_id: string
          remaining_days: number | null
          updated_at: string
          used_days: number
          valid_from: string
          valid_to: string
        }
        Insert: {
          allocated_days?: number
          created_at?: string
          employee_id: string
          id?: string
          leave_type_id: string
          remaining_days?: number | null
          updated_at?: string
          used_days?: number
          valid_from: string
          valid_to: string
        }
        Update: {
          allocated_days?: number
          created_at?: string
          employee_id?: string
          id?: string
          leave_type_id?: string
          remaining_days?: number | null
          updated_at?: string
          used_days?: number
          valid_from?: string
          valid_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_allocations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_allocations_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          attachment_url: string | null
          created_at: string
          employee_id: string
          end_date: string
          id: string
          leave_type_id: string
          remarks: string | null
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          total_days: number
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          employee_id: string
          end_date: string
          id?: string
          leave_type_id: string
          remarks?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          total_days?: number
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          employee_id?: string
          end_date?: string
          id?: string
          leave_type_id?: string
          remarks?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          total_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          annual_quota: number
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_paid: boolean
          name: string
          requires_attachment: boolean
          updated_at: string
        }
        Insert: {
          annual_quota?: number
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          name: string
          requires_attachment?: boolean
          updated_at?: string
        }
        Update: {
          annual_quota?: number
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          name?: string
          requires_attachment?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      odoo_mappings: {
        Row: {
          created_at: string
          entity_type: Database["public"]["Enums"]["integration_entity"]
          error_code: string | null
          error_message: string | null
          id: string
          last_attempt_at: string | null
          last_synced_at: string | null
          local_id: string
          odoo_id: number | null
          sync_status: Database["public"]["Enums"]["integration_sync_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_type: Database["public"]["Enums"]["integration_entity"]
          error_code?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          last_synced_at?: string | null
          local_id: string
          odoo_id?: number | null
          sync_status?: Database["public"]["Enums"]["integration_sync_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_type?: Database["public"]["Enums"]["integration_entity"]
          error_code?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          last_synced_at?: string | null
          local_id?: string
          odoo_id?: number | null
          sync_status?: Database["public"]["Enums"]["integration_sync_status"]
          updated_at?: string
        }
        Relationships: []
      }
      odoo_sync_logs: {
        Row: {
          actor_id: string | null
          created_at: string
          direction: string
          duration_ms: number | null
          entity_type: Database["public"]["Enums"]["integration_entity"]
          error_code: string | null
          error_message: string | null
          id: string
          local_id: string | null
          odoo_id: number | null
          record_label: string | null
          status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          direction?: string
          duration_ms?: number | null
          entity_type: Database["public"]["Enums"]["integration_entity"]
          error_code?: string | null
          error_message?: string | null
          id?: string
          local_id?: string | null
          odoo_id?: number | null
          record_label?: string | null
          status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          direction?: string
          duration_ms?: number | null
          entity_type?: Database["public"]["Enums"]["integration_entity"]
          error_code?: string | null
          error_message?: string | null
          id?: string
          local_id?: string | null
          odoo_id?: number | null
          record_label?: string | null
          status?: string
        }
        Relationships: []
      }
      payroll_records: {
        Row: {
          attendance_summary: Json
          basic_salary: number
          created_at: string
          currency: string
          deductions: Json
          earnings: Json
          employee_id: string
          generated_at: string
          generated_by: string | null
          gross_earnings: number
          id: string
          leave_summary: Json
          net_salary: number
          notes: string | null
          paid_at: string | null
          period_end: string
          period_month: number
          period_start: string
          period_year: number
          processed_at: string | null
          status: Database["public"]["Enums"]["payroll_status"]
          total_deductions: number
          updated_at: string
        }
        Insert: {
          attendance_summary?: Json
          basic_salary?: number
          created_at?: string
          currency?: string
          deductions?: Json
          earnings?: Json
          employee_id: string
          generated_at?: string
          generated_by?: string | null
          gross_earnings?: number
          id?: string
          leave_summary?: Json
          net_salary?: number
          notes?: string | null
          paid_at?: string | null
          period_end: string
          period_month: number
          period_start: string
          period_year: number
          processed_at?: string | null
          status?: Database["public"]["Enums"]["payroll_status"]
          total_deductions?: number
          updated_at?: string
        }
        Update: {
          attendance_summary?: Json
          basic_salary?: number
          created_at?: string
          currency?: string
          deductions?: Json
          earnings?: Json
          employee_id?: string
          generated_at?: string
          generated_by?: string | null
          gross_earnings?: number
          id?: string
          leave_summary?: Json
          net_salary?: number
          notes?: string | null
          paid_at?: string | null
          period_end?: string
          period_month?: number
          period_start?: string
          period_year?: number
          processed_at?: string | null
          status?: Database["public"]["Enums"]["payroll_status"]
          total_deductions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          location: string | null
          must_change_password: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          location?: string | null
          must_change_password?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          location?: string | null
          must_change_password?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      salary_components: {
        Row: {
          calculation_method: Database["public"]["Enums"]["salary_calculation_method"]
          code: string
          component_type: Database["public"]["Enums"]["salary_component_type"]
          created_at: string
          default_value: number
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          calculation_method?: Database["public"]["Enums"]["salary_calculation_method"]
          code: string
          component_type: Database["public"]["Enums"]["salary_component_type"]
          created_at?: string
          default_value?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          calculation_method?: Database["public"]["Enums"]["salary_calculation_method"]
          code?: string
          component_type?: Database["public"]["Enums"]["salary_component_type"]
          created_at?: string
          default_value?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      salary_structure_components: {
        Row: {
          component_id: string
          created_at: string
          id: string
          is_active: boolean
          structure_id: string
          updated_at: string
          value: number
        }
        Insert: {
          component_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          structure_id: string
          updated_at?: string
          value?: number
        }
        Update: {
          component_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          structure_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_structure_components_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "salary_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_structure_components_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "salary_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_structures: {
        Row: {
          basic_salary: number
          created_at: string
          currency: string
          effective_from: string
          employee_id: string
          id: string
          is_active: boolean
          notes: string | null
          updated_at: string
        }
        Insert: {
          basic_salary?: number
          created_at?: string
          currency?: string
          effective_from?: string
          employee_id: string
          id?: string
          is_active?: boolean
          notes?: string | null
          updated_at?: string
        }
        Update: {
          basic_salary?: number
          created_at?: string
          currency?: string
          effective_from?: string
          employee_id?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_structures_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
      attendance_admin_update: {
        Args: {
          _check_in: string
          _check_out: string
          _id: string
          _notes: string
          _status: Database["public"]["Enums"]["attendance_status"]
        }
        Returns: {
          attendance_date: string
          check_in: string | null
          check_out: string | null
          created_at: string
          employee_id: string
          extra_hours: number
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          work_hours: number
        }
        SetofOptions: {
          from: "*"
          to: "attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      attendance_check_in: {
        Args: never
        Returns: {
          attendance_date: string
          check_in: string | null
          check_out: string | null
          created_at: string
          employee_id: string
          extra_hours: number
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          work_hours: number
        }
        SetofOptions: {
          from: "*"
          to: "attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      attendance_check_out: {
        Args: never
        Returns: {
          attendance_date: string
          check_in: string | null
          check_out: string | null
          created_at: string
          employee_id: string
          extra_hours: number
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          work_hours: number
        }
        SetofOptions: {
          from: "*"
          to: "attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      attendance_extra_hours: { Args: { _work_hours: number }; Returns: number }
      attendance_work_hours: {
        Args: { _check_in: string; _check_out: string }
        Returns: number
      }
      business_today: { Args: never; Returns: string }
      current_employee_id: { Args: never; Returns: string }
      email_for_login_id: { Args: { _login_id: string }; Returns: string }
      export_job_claim: {
        Args: {
          _entity_label: string
          _idempotency_key: string
          _kind: string
          _record_count: number
        }
        Returns: boolean
      }
      generate_employee_login_id: {
        Args: { _first_name: string; _joining_date: string; _last_name: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      leave_allocation_upsert: {
        Args: {
          _allocated_days: number
          _allocation_id?: string
          _employee_id: string
          _leave_type_id: string
          _valid_from: string
          _valid_to: string
        }
        Returns: {
          allocated_days: number
          created_at: string
          employee_id: string
          id: string
          leave_type_id: string
          remaining_days: number | null
          updated_at: string
          used_days: number
          valid_from: string
          valid_to: string
        }
        SetofOptions: {
          from: "*"
          to: "leave_allocations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      leave_balance: {
        Args: { _employee_id: string; _on_date?: string }
        Returns: {
          allocated_days: number
          allocation_id: string
          code: string
          description: string
          is_paid: boolean
          leave_type_id: string
          name: string
          pending_days: number
          remaining_days: number
          requires_attachment: boolean
          used_days: number
          valid_from: string
          valid_to: string
        }[]
      }
      leave_calendar_days: {
        Args: { _end: string; _start: string }
        Returns: number
      }
      leave_cancel: {
        Args: { _id: string }
        Returns: {
          attachment_url: string | null
          created_at: string
          employee_id: string
          end_date: string
          id: string
          leave_type_id: string
          remarks: string | null
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          total_days: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "leave_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      leave_review: {
        Args: {
          _comment: string
          _decision: Database["public"]["Enums"]["leave_status"]
          _id: string
        }
        Returns: {
          attachment_url: string | null
          created_at: string
          employee_id: string
          end_date: string
          id: string
          leave_type_id: string
          remarks: string | null
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          total_days: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "leave_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      leave_submit: {
        Args: {
          _attachment_url?: string
          _end: string
          _leave_type_id: string
          _remarks: string
          _start: string
        }
        Returns: {
          attachment_url: string | null
          created_at: string
          employee_id: string
          end_date: string
          id: string
          leave_type_id: string
          remarks: string | null
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          total_days: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "leave_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      leave_type_upsert: {
        Args: {
          _code: string
          _description: string
          _id?: string
          _is_active: boolean
          _is_paid: boolean
          _name: string
          _requires_attachment: boolean
        }
        Returns: {
          annual_quota: number
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_paid: boolean
          name: string
          requires_attachment: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "leave_types"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      leave_working_days: {
        Args: { _end: string; _start: string }
        Returns: number
      }
      my_entitlement_history: {
        Args: never
        Returns: {
          change_type: string
          changed_by: string | null
          created_at: string
          effective_from: string | null
          effective_to: string | null
          employee_id: string
          id: string
          label: string
          new_value: Json | null
          previous_value: Json | null
        }[]
        SetofOptions: {
          from: "*"
          to: "entitlement_changes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      my_salary_structure: { Args: never; Returns: Json }
      notify_user: {
        Args: {
          _body: string
          _category: string
          _link: string
          _title: string
          _user_id: string
        }
        Returns: undefined
      }
      payroll_attendance_summary: {
        Args: { _employee_id: string; _month: number; _year: number }
        Returns: Json
      }
      payroll_calculate: { Args: { _structure_id: string }; Returns: Json }
      payroll_component_amount: {
        Args: {
          _basic: number
          _method: Database["public"]["Enums"]["salary_calculation_method"]
          _value: number
        }
        Returns: number
      }
      payroll_generate: {
        Args: {
          _employee_ids?: string[]
          _include_inactive?: boolean
          _month: number
          _year: number
        }
        Returns: Json
      }
      payroll_leave_summary: {
        Args: { _employee_id: string; _month: number; _year: number }
        Returns: Json
      }
      payroll_period_end: {
        Args: { _month: number; _year: number }
        Returns: string
      }
      payroll_period_start: {
        Args: { _month: number; _year: number }
        Returns: string
      }
      payroll_preview: {
        Args: { _include_inactive?: boolean; _month: number; _year: number }
        Returns: {
          attendance_summary: Json
          basic_salary: number
          deductions: Json
          department: string
          earnings: Json
          employee_id: string
          employee_name: string
          employee_status: Database["public"]["Enums"]["employee_status"]
          exception_reason: string
          existing_payroll_id: string
          existing_status: Database["public"]["Enums"]["payroll_status"]
          gross_earnings: number
          job_position: string
          leave_summary: Json
          login_id: string
          net_salary: number
          structure_id: string
          total_deductions: number
        }[]
      }
      payroll_set_status: {
        Args: {
          _id: string
          _status: Database["public"]["Enums"]["payroll_status"]
        }
        Returns: {
          attendance_summary: Json
          basic_salary: number
          created_at: string
          currency: string
          deductions: Json
          earnings: Json
          employee_id: string
          generated_at: string
          generated_by: string | null
          gross_earnings: number
          id: string
          leave_summary: Json
          net_salary: number
          notes: string | null
          paid_at: string | null
          period_end: string
          period_month: number
          period_start: string
          period_year: number
          processed_at: string | null
          status: Database["public"]["Enums"]["payroll_status"]
          total_deductions: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payroll_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      payroll_working_days: {
        Args: { _month: number; _year: number }
        Returns: number
      }
      record_entitlement_change: {
        Args: {
          _body: string
          _category: string
          _change_type: string
          _effective_from: string
          _effective_to: string
          _employee_id: string
          _label: string
          _link: string
          _new: Json
          _previous: Json
          _title: string
        }
        Returns: undefined
      }
      salary_component_save: {
        Args: {
          _calculation_method: Database["public"]["Enums"]["salary_calculation_method"]
          _code: string
          _component_type: Database["public"]["Enums"]["salary_component_type"]
          _default_value: number
          _description?: string
          _id: string
          _is_active: boolean
          _name: string
        }
        Returns: {
          calculation_method: Database["public"]["Enums"]["salary_calculation_method"]
          code: string
          component_type: Database["public"]["Enums"]["salary_component_type"]
          created_at: string
          default_value: number
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "salary_components"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      salary_structure_detail: { Args: { _employee_id: string }; Returns: Json }
      salary_structure_save: {
        Args: {
          _basic_salary: number
          _components: Json
          _effective_from: string
          _employee_id: string
          _notes?: string
        }
        Returns: {
          basic_salary: number
          created_at: string
          currency: string
          effective_from: string
          employee_id: string
          id: string
          is_active: boolean
          notes: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "salary_structures"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "ADMIN" | "EMPLOYEE"
      attendance_status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE"
      employee_status:
        | "ACTIVE"
        | "INACTIVE"
        | "ON_LEAVE"
        | "PROBATION"
        | "RESIGNED"
        | "TERMINATED"
      integration_entity: "EMPLOYEE" | "ATTENDANCE" | "LEAVE" | "PAYROLL"
      integration_sync_status: "PENDING" | "SYNCED" | "FAILED"
      leave_status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
      payroll_status: "DRAFT" | "GENERATED" | "PROCESSED" | "PAID"
      salary_calculation_method: "FIXED" | "PERCENTAGE"
      salary_component_type: "EARNING" | "DEDUCTION"
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
      app_role: ["ADMIN", "EMPLOYEE"],
      attendance_status: ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE"],
      employee_status: [
        "ACTIVE",
        "INACTIVE",
        "ON_LEAVE",
        "PROBATION",
        "RESIGNED",
        "TERMINATED",
      ],
      integration_entity: ["EMPLOYEE", "ATTENDANCE", "LEAVE", "PAYROLL"],
      integration_sync_status: ["PENDING", "SYNCED", "FAILED"],
      leave_status: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
      payroll_status: ["DRAFT", "GENERATED", "PROCESSED", "PAID"],
      salary_calculation_method: ["FIXED", "PERCENTAGE"],
      salary_component_type: ["EARNING", "DEDUCTION"],
    },
  },
} as const
