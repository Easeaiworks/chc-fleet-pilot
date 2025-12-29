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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          created_at: string
          id: string
          location: string | null
          name: string
          tire_notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          name: string
          tire_notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          tire_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          expense_id: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          uploaded_by: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          expense_id?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_by?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string
          expense_id?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_by?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          id: string
          manager_approver_id: string | null
          modified_at: string | null
          modified_by: string | null
          odometer_reading: number | null
          receipt_scanned: boolean | null
          rejection_reason: string | null
          staff_name: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          updated_at: string
          vehicle_id: string
          vendor_id: string | null
          vendor_name: string | null
        }
        Insert: {
          amount: number
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          manager_approver_id?: string | null
          modified_at?: string | null
          modified_by?: string | null
          odometer_reading?: number | null
          receipt_scanned?: boolean | null
          rejection_reason?: string | null
          staff_name?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          updated_at?: string
          vehicle_id: string
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          manager_approver_id?: string | null
          modified_at?: string | null
          modified_by?: string | null
          odometer_reading?: number | null
          receipt_scanned?: boolean | null
          rejection_reason?: string | null
          staff_name?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          updated_at?: string
          vehicle_id?: string
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_manager_approver_id_fkey"
            columns: ["manager_approver_id"]
            isOneToOne: false
            referencedRelation: "manager_approvers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_uploads: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          gps_vehicle_name: string | null
          id: string
          kilometers: number
          notes: string | null
          upload_month: string
          uploaded_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          gps_vehicle_name?: string | null
          id?: string
          kilometers?: number
          notes?: string | null
          upload_month: string
          uploaded_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          gps_vehicle_name?: string | null
          id?: string
          kilometers?: number
          notes?: string | null
          upload_month?: string
          uploaded_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gps_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_uploads_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_approvers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          block_reason: string | null
          blocked_at: string | null
          blocked_by: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_approved: boolean
          is_blocked: boolean
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          block_reason?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_approved?: boolean
          is_blocked?: boolean
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          block_reason?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_approved?: boolean
          is_blocked?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tire_changes: {
        Row: {
          branch_id: string | null
          change_date: string
          completed_by: string | null
          created_at: string
          current_tire_type: string | null
          id: string
          notes: string | null
          summer_tire_location: string | null
          tire_type: string
          updated_at: string
          vehicle_id: string | null
          winter_tire_location: string | null
        }
        Insert: {
          branch_id?: string | null
          change_date?: string
          completed_by?: string | null
          created_at?: string
          current_tire_type?: string | null
          id?: string
          notes?: string | null
          summer_tire_location?: string | null
          tire_type: string
          updated_at?: string
          vehicle_id?: string | null
          winter_tire_location?: string | null
        }
        Update: {
          branch_id?: string | null
          change_date?: string
          completed_by?: string | null
          created_at?: string
          current_tire_type?: string | null
          id?: string
          notes?: string | null
          summer_tire_location?: string | null
          tire_type?: string
          updated_at?: string
          vehicle_id?: string | null
          winter_tire_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tire_changes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tire_changes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tire_claim_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          created_at: string
          id: string
          inventory_item_id: string
          notes: string | null
          rejection_reason: string | null
          requested_by: string | null
          status: string
          tire_type: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          inventory_item_id: string
          notes?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          status?: string
          tire_type: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          inventory_item_id?: string
          notes?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          status?: string
          tire_type?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tire_claim_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tire_claim_requests_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "tire_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tire_claim_requests_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tire_inventory: {
        Row: {
          bolt_pattern: string | null
          branch_id: string
          brand: string
          condition: string
          created_at: string
          created_by: string | null
          id: string
          measurements: string
          notes: string | null
          on_rim: boolean
          quantity: number
          tire_type: string
          updated_at: string
        }
        Insert: {
          bolt_pattern?: string | null
          branch_id: string
          brand: string
          condition: string
          created_at?: string
          created_by?: string | null
          id?: string
          measurements: string
          notes?: string | null
          on_rim?: boolean
          quantity?: number
          tire_type?: string
          updated_at?: string
        }
        Update: {
          bolt_pattern?: string | null
          branch_id?: string
          brand?: string
          condition?: string
          created_at?: string
          created_by?: string | null
          id?: string
          measurements?: string
          notes?: string | null
          on_rim?: boolean
          quantity?: number
          tire_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tire_inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      vehicle_inspections: {
        Row: {
          brakes_notes: string | null
          brakes_pass: boolean
          branch_id: string | null
          completed_by: string | null
          created_at: string
          engine_notes: string | null
          engine_pass: boolean
          headlights_notes: string | null
          headlights_pass: boolean
          id: string
          inspection_date: string
          inspection_month: string
          kilometers: number | null
          oil_level_notes: string | null
          oil_level_pass: boolean
          signal_lights_notes: string | null
          signal_lights_pass: boolean
          tires_notes: string | null
          tires_pass: boolean
          transmission_notes: string | null
          transmission_pass: boolean
          updated_at: string
          vehicle_id: string
          windshield_fluid_notes: string | null
          windshield_fluid_pass: boolean
          wipers_notes: string | null
          wipers_pass: boolean
        }
        Insert: {
          brakes_notes?: string | null
          brakes_pass?: boolean
          branch_id?: string | null
          completed_by?: string | null
          created_at?: string
          engine_notes?: string | null
          engine_pass?: boolean
          headlights_notes?: string | null
          headlights_pass?: boolean
          id?: string
          inspection_date?: string
          inspection_month?: string
          kilometers?: number | null
          oil_level_notes?: string | null
          oil_level_pass?: boolean
          signal_lights_notes?: string | null
          signal_lights_pass?: boolean
          tires_notes?: string | null
          tires_pass?: boolean
          transmission_notes?: string | null
          transmission_pass?: boolean
          updated_at?: string
          vehicle_id: string
          windshield_fluid_notes?: string | null
          windshield_fluid_pass?: boolean
          wipers_notes?: string | null
          wipers_pass?: boolean
        }
        Update: {
          brakes_notes?: string | null
          brakes_pass?: boolean
          branch_id?: string | null
          completed_by?: string | null
          created_at?: string
          engine_notes?: string | null
          engine_pass?: boolean
          headlights_notes?: string | null
          headlights_pass?: boolean
          id?: string
          inspection_date?: string
          inspection_month?: string
          kilometers?: number | null
          oil_level_notes?: string | null
          oil_level_pass?: boolean
          signal_lights_notes?: string | null
          signal_lights_pass?: boolean
          tires_notes?: string | null
          tires_pass?: boolean
          transmission_notes?: string | null
          transmission_pass?: boolean
          updated_at?: string
          vehicle_id?: string
          windshield_fluid_notes?: string | null
          windshield_fluid_pass?: boolean
          wipers_notes?: string | null
          wipers_pass?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_inspections_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_inspections_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          branch_id: string | null
          created_at: string
          current_tire_type: string | null
          id: string
          last_oil_change_km: number | null
          last_tire_change_date: string | null
          make: string | null
          model: string | null
          notes: string | null
          odometer_km: number | null
          plate: string
          status: string | null
          summer_tire_brand: string | null
          summer_tire_condition: string | null
          summer_tire_location: string | null
          summer_tire_measurements: string | null
          tire_notes: string | null
          transponder_407: string | null
          updated_at: string
          vin: string
          winter_tire_brand: string | null
          winter_tire_condition: string | null
          winter_tire_location: string | null
          winter_tire_measurements: string | null
          year: number | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          current_tire_type?: string | null
          id?: string
          last_oil_change_km?: number | null
          last_tire_change_date?: string | null
          make?: string | null
          model?: string | null
          notes?: string | null
          odometer_km?: number | null
          plate: string
          status?: string | null
          summer_tire_brand?: string | null
          summer_tire_condition?: string | null
          summer_tire_location?: string | null
          summer_tire_measurements?: string | null
          tire_notes?: string | null
          transponder_407?: string | null
          updated_at?: string
          vin: string
          winter_tire_brand?: string | null
          winter_tire_condition?: string | null
          winter_tire_location?: string | null
          winter_tire_measurements?: string | null
          year?: number | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          current_tire_type?: string | null
          id?: string
          last_oil_change_km?: number | null
          last_tire_change_date?: string | null
          make?: string | null
          model?: string | null
          notes?: string | null
          odometer_km?: number | null
          plate?: string
          status?: string | null
          summer_tire_brand?: string | null
          summer_tire_condition?: string | null
          summer_tire_location?: string | null
          summer_tire_measurements?: string | null
          tire_notes?: string | null
          transponder_407?: string | null
          updated_at?: string
          vin?: string
          winter_tire_brand?: string | null
          winter_tire_condition?: string | null
          winter_tire_location?: string | null
          winter_tire_measurements?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          category: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          category?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_admin_or_manager: { Args: { _user_id: string }; Returns: boolean }
      is_user_approved: { Args: { _user_id: string }; Returns: boolean }
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
