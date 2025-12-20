export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      distributors: {
        Row: {
          airtable_id: string
          commission_percentage: number | null
          contact_number: string | null
          created_at: string | null
          id: number
          is_active: boolean | null
          last_synced_at: string | null
          last_update_date: string | null
          name: string
          notes: string | null
          sync_version: number | null
          updated_at: string | null
          web_address: string | null
        }
        Insert: {
          airtable_id: string
          commission_percentage?: number | null
          contact_number?: string | null
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          last_synced_at?: string | null
          last_update_date?: string | null
          name: string
          notes?: string | null
          sync_version?: number | null
          updated_at?: string | null
          web_address?: string | null
        }
        Update: {
          airtable_id?: string
          commission_percentage?: number | null
          contact_number?: string | null
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          last_synced_at?: string | null
          last_update_date?: string | null
          name?: string
          notes?: string | null
          sync_version?: number | null
          updated_at?: string | null
          web_address?: string | null
        }
        Relationships: []
      }
      editions: {
        Row: {
          airtable_id: string
          commission_percentage: number | null
          created_at: string | null
          date_in_gallery: string | null
          date_sold: string | null
          distributor_id: number | null
          edition_display_name: string
          edition_number: number | null
          frame_type: string | null
          id: number
          is_active: boolean | null
          is_printed: boolean | null
          is_settled: boolean | null
          is_sold: boolean | null
          is_stock_checked: boolean | null
          last_synced_at: string | null
          notes: string | null
          payment_note: string | null
          print_id: number
          retail_price: number | null
          size: string | null
          sync_version: number | null
          to_check_in_detail: boolean | null
          updated_at: string | null
          variation: string | null
        }
        Insert: {
          airtable_id: string
          commission_percentage?: number | null
          created_at?: string | null
          date_in_gallery?: string | null
          date_sold?: string | null
          distributor_id?: number | null
          edition_display_name: string
          edition_number?: number | null
          frame_type?: string | null
          id?: number
          is_active?: boolean | null
          is_printed?: boolean | null
          is_settled?: boolean | null
          is_sold?: boolean | null
          is_stock_checked?: boolean | null
          last_synced_at?: string | null
          notes?: string | null
          payment_note?: string | null
          print_id: number
          retail_price?: number | null
          size?: string | null
          sync_version?: number | null
          to_check_in_detail?: boolean | null
          updated_at?: string | null
          variation?: string | null
        }
        Update: {
          airtable_id?: string
          commission_percentage?: number | null
          created_at?: string | null
          date_in_gallery?: string | null
          date_sold?: string | null
          distributor_id?: number | null
          edition_display_name?: string
          edition_number?: number | null
          frame_type?: string | null
          id?: number
          is_active?: boolean | null
          is_printed?: boolean | null
          is_settled?: boolean | null
          is_sold?: boolean | null
          is_stock_checked?: boolean | null
          last_synced_at?: string | null
          notes?: string | null
          payment_note?: string | null
          print_id?: number
          retail_price?: number | null
          size?: string | null
          sync_version?: number | null
          to_check_in_detail?: boolean | null
          updated_at?: string | null
          variation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "editions_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "editions_print_id_fkey"
            columns: ["print_id"]
            isOneToOne: false
            referencedRelation: "prints"
            referencedColumns: ["id"]
          },
        ]
      }
      prints: {
        Row: {
          airtable_id: string
          created_at: string | null
          description: string | null
          id: number
          image_urls: string[] | null
          is_active: boolean | null
          last_synced_at: string | null
          name: string
          notes: string | null
          primary_image_path: string | null
          sync_version: number | null
          total_editions: number | null
          updated_at: string | null
          web_link: string | null
        }
        Insert: {
          airtable_id: string
          created_at?: string | null
          description?: string | null
          id?: number
          image_urls?: string[] | null
          is_active?: boolean | null
          last_synced_at?: string | null
          name: string
          notes?: string | null
          primary_image_path?: string | null
          sync_version?: number | null
          total_editions?: number | null
          updated_at?: string | null
          web_link?: string | null
        }
        Update: {
          airtable_id?: string
          created_at?: string | null
          description?: string | null
          id?: number
          image_urls?: string[] | null
          is_active?: boolean | null
          last_synced_at?: string | null
          name?: string
          notes?: string | null
          primary_image_path?: string | null
          sync_version?: number | null
          total_editions?: number | null
          updated_at?: string | null
          web_link?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: number
          records_created: number | null
          records_deleted: number | null
          records_failed: number | null
          records_processed: number | null
          records_updated: number | null
          source_file: string | null
          source_hash: string | null
          started_at: string
          status: string | null
          sync_id: string
          sync_type: string | null
          table_name: string | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: number
          records_created?: number | null
          records_deleted?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          source_file?: string | null
          source_hash?: string | null
          started_at: string
          status?: string | null
          sync_id: string
          sync_type?: string | null
          table_name?: string | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: number
          records_created?: number | null
          records_deleted?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          source_file?: string | null
          source_hash?: string | null
          started_at?: string
          status?: string | null
          sync_id?: string
          sync_type?: string | null
          table_name?: string | null
        }
        Relationships: []
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

// Convenience types for table rows
export type Edition = Database['public']['Tables']['editions']['Row']
export type EditionInsert = Database['public']['Tables']['editions']['Insert']
export type EditionUpdate = Database['public']['Tables']['editions']['Update']

export type Print = Database['public']['Tables']['prints']['Row']
export type PrintInsert = Database['public']['Tables']['prints']['Insert']
export type PrintUpdate = Database['public']['Tables']['prints']['Update']

export type Distributor = Database['public']['Tables']['distributors']['Row']
export type DistributorInsert = Database['public']['Tables']['distributors']['Insert']
export type DistributorUpdate = Database['public']['Tables']['distributors']['Update']

export type Profile = Database['public']['Tables']['profiles']['Row']

// Edition with joined relations
export type EditionWithRelations = Edition & {
  prints: Print | null
  distributors: Distributor | null
}

// Filter types for editions
export type EditionFilters = {
  search?: string
  printId?: number
  distributorId?: number
  size?: 'Small' | 'Large' | 'Extra Large' | null
  frameType?: 'Framed' | 'Tube only' | 'Mounted' | null
  isPrinted?: boolean | null
  isSold?: boolean | null
  isSettled?: boolean | null
}

// Pagination
export type PaginationParams = {
  page: number
  pageSize: number
}

export type PaginatedResult<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
