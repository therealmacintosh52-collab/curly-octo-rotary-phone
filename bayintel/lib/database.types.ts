
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "ai_messages": {
                  Row: {
                    "citations": NonNullable<Json>,"content": string,"created_at": string,"id": string,"input_tokens": number | null,"model": string | null,"output_tokens": number | null,"role": Database["public"]['Enums']["ai_role"],"session_id": string,"structured": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "citations"?: NonNullable<Json>,"content": string,"created_at"?: string,"id"?: string,"input_tokens"?: number | null,"model"?: string | null,"output_tokens"?: number | null,"role": Database["public"]['Enums']["ai_role"],"session_id": string,"structured"?: Json | null
                  }
                  Update: {
                    "citations"?: NonNullable<Json>,"content"?: string,"created_at"?: string,"id"?: string,"input_tokens"?: number | null,"model"?: string | null,"output_tokens"?: number | null,"role"?: Database["public"]['Enums']["ai_role"],"session_id"?: string,"structured"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_messages_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "ai_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_sessions": {
                  Row: {
                    "created_at": string,"id": string,"title": string,"user_id": string,"vehicle_id": string | null,"vehicle_snapshot": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"title"?: string,"user_id": string,"vehicle_id"?: string | null,"vehicle_snapshot"?: NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"title"?: string,"user_id"?: string,"vehicle_id"?: string | null,"vehicle_snapshot"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_sessions_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"dtc_codes": {
                  Row: {
                    "category": string,"code": string,"common_causes": (string)[],"description": string,"is_generic": boolean,"safety_flag": string | null,"source": Database["public"]['Enums']["source_label"],"system": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"code": string,"common_causes"?: (string)[],"description": string,"is_generic"?: boolean,"safety_flag"?: string | null,"source"?: Database["public"]['Enums']["source_label"],"system": string
                  }
                  Update: {
                    "category"?: string,"code"?: string,"common_causes"?: (string)[],"description"?: string,"is_generic"?: boolean,"safety_flag"?: string | null,"source"?: Database["public"]['Enums']["source_label"],"system"?: string
                  }
                  Relationships: [
                    
                  ]
                },"estimate_lines": {
                  Row: {
                    "description": string,"estimate_id": string,"hours": number | null,"id": string,"kind": Database["public"]['Enums']["estimate_line_kind"],"part_number": string | null,"quantity": number,"sort": number,"taxable": boolean | null,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"estimate_id": string,"hours"?: number | null,"id"?: string,"kind": Database["public"]['Enums']["estimate_line_kind"],"part_number"?: string | null,"quantity"?: number,"sort"?: number,"taxable"?: boolean | null,"unit_price"?: number
                  }
                  Update: {
                    "description"?: string,"estimate_id"?: string,"hours"?: number | null,"id"?: string,"kind"?: Database["public"]['Enums']["estimate_line_kind"],"part_number"?: string | null,"quantity"?: number,"sort"?: number,"taxable"?: boolean | null,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "estimate_lines_estimate_id_fkey"
      columns: ["estimate_id"]
isOneToOne: false
      referencedRelation: "estimates"
      referencedColumns: ["id"]
    }
                  ]
                },"estimates": {
                  Row: {
                    "author_id": string,"created_at": string,"customer_email": string | null,"customer_name": string | null,"customer_phone": string | null,"estimate_number": number,"id": string,"labor_rate": number,"notes": string | null,"repair_order_id": string | null,"share_token": string,"shop_id": string | null,"status": Database["public"]['Enums']["estimate_status"],"tax_labor": boolean,"tax_parts": boolean,"tax_rate": number,"updated_at": string,"valid_until": string | null,"vehicle_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"created_at"?: string,"customer_email"?: string | null,"customer_name"?: string | null,"customer_phone"?: string | null,"estimate_number"?: number,"id"?: string,"labor_rate"?: number,"notes"?: string | null,"repair_order_id"?: string | null,"share_token"?: string,"shop_id"?: string | null,"status"?: Database["public"]['Enums']["estimate_status"],"tax_labor"?: boolean,"tax_parts"?: boolean,"tax_rate"?: number,"updated_at"?: string,"valid_until"?: string | null,"vehicle_id"?: string | null
                  }
                  Update: {
                    "author_id"?: string,"created_at"?: string,"customer_email"?: string | null,"customer_name"?: string | null,"customer_phone"?: string | null,"estimate_number"?: number,"id"?: string,"labor_rate"?: number,"notes"?: string | null,"repair_order_id"?: string | null,"share_token"?: string,"shop_id"?: string | null,"status"?: Database["public"]['Enums']["estimate_status"],"tax_labor"?: boolean,"tax_parts"?: boolean,"tax_rate"?: number,"updated_at"?: string,"valid_until"?: string | null,"vehicle_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "estimates_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "estimates_repair_order_id_fkey"
      columns: ["repair_order_id"]
isOneToOne: false
      referencedRelation: "repair_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "estimates_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "estimates_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"fix_confirmations": {
                  Row: {
                    "created_at": string,"fix_id": string,"id": string,"note": string | null,"user_id": string,"verdict": Database["public"]['Enums']["confirmation_verdict"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"fix_id": string,"id"?: string,"note"?: string | null,"user_id": string,"verdict": Database["public"]['Enums']["confirmation_verdict"]
                  }
                  Update: {
                    "created_at"?: string,"fix_id"?: string,"id"?: string,"note"?: string | null,"user_id"?: string,"verdict"?: Database["public"]['Enums']["confirmation_verdict"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "fix_confirmations_fix_id_fkey"
      columns: ["fix_id"]
isOneToOne: false
      referencedRelation: "fixes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fix_confirmations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"fix_dtcs": {
                  Row: {
                    "code": string,"fix_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"fix_id": string
                  }
                  Update: {
                    "code"?: string,"fix_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fix_dtcs_fix_id_fkey"
      columns: ["fix_id"]
isOneToOne: false
      referencedRelation: "fixes"
      referencedColumns: ["id"]
    }
                  ]
                },"fix_media": {
                  Row: {
                    "caption": string | null,"created_at": string,"fix_id": string,"id": string,"storage_path": string,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "caption"?: string | null,"created_at"?: string,"fix_id": string,"id"?: string,"storage_path": string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "caption"?: string | null,"created_at"?: string,"fix_id"?: string,"id"?: string,"storage_path"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "fix_media_fix_id_fkey"
      columns: ["fix_id"]
isOneToOne: false
      referencedRelation: "fixes"
      referencedColumns: ["id"]
    }
                  ]
                },"fix_parts": {
                  Row: {
                    "brand": string | null,"fix_id": string,"id": string,"name": string,"part_number": string | null,"quantity": number,"sort": number,"unit_price": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "brand"?: string | null,"fix_id": string,"id"?: string,"name": string,"part_number"?: string | null,"quantity"?: number,"sort"?: number,"unit_price"?: number | null
                  }
                  Update: {
                    "brand"?: string | null,"fix_id"?: string,"id"?: string,"name"?: string,"part_number"?: string | null,"quantity"?: number,"sort"?: number,"unit_price"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "fix_parts_fix_id_fkey"
      columns: ["fix_id"]
isOneToOne: false
      referencedRelation: "fixes"
      referencedColumns: ["id"]
    }
                  ]
                },"fix_revisions": {
                  Row: {
                    "change_note": string | null,"created_at": string,"editor_id": string | null,"fix_id": string,"id": string,"snapshot": NonNullable<Json>,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "change_note"?: string | null,"created_at"?: string,"editor_id"?: string | null,"fix_id": string,"id"?: string,"snapshot": NonNullable<Json>,"version": number
                  }
                  Update: {
                    "change_note"?: string | null,"created_at"?: string,"editor_id"?: string | null,"fix_id"?: string,"id"?: string,"snapshot"?: NonNullable<Json>,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "fix_revisions_editor_id_fkey"
      columns: ["editor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fix_revisions_fix_id_fkey"
      columns: ["fix_id"]
isOneToOne: false
      referencedRelation: "fixes"
      referencedColumns: ["id"]
    }
                  ]
                },"fixes": {
                  Row: {
                    "author_id": string | null,"confirm_count": number,"created_at": string,"deny_count": number,"engine": string | null,"fix_description": string,"freeze_frame_notes": string | null,"id": string,"labor_hours": number | null,"make": string,"mileage": number | null,"model": string,"net_score": number,"repair_order_id": string | null,"root_cause": string,"search_tsv": unknown,"seed_confirm_count": number,"seed_deny_count": number,"source_label": Database["public"]['Enums']["source_label"],"status": Database["public"]['Enums']["fix_status"],"symptoms": string,"tests_performed": NonNullable<Json>,"title": string,"updated_at": string,"vehicle_id": string | null,"verified_at": string | null,"version": number,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"confirm_count"?: number,"created_at"?: string,"deny_count"?: number,"engine"?: string | null,"fix_description": string,"freeze_frame_notes"?: string | null,"id"?: string,"labor_hours"?: number | null,"make": string,"mileage"?: number | null,"model": string,"net_score"?: number,"repair_order_id"?: string | null,"root_cause": string,"search_tsv"?: never,"seed_confirm_count"?: number,"seed_deny_count"?: number,"source_label"?: Database["public"]['Enums']["source_label"],"status"?: Database["public"]['Enums']["fix_status"],"symptoms": string,"tests_performed"?: NonNullable<Json>,"title": string,"updated_at"?: string,"vehicle_id"?: string | null,"verified_at"?: string | null,"version"?: number,"year": number
                  }
                  Update: {
                    "author_id"?: string | null,"confirm_count"?: number,"created_at"?: string,"deny_count"?: number,"engine"?: string | null,"fix_description"?: string,"freeze_frame_notes"?: string | null,"id"?: string,"labor_hours"?: number | null,"make"?: string,"mileage"?: number | null,"model"?: string,"net_score"?: number,"repair_order_id"?: string | null,"root_cause"?: string,"search_tsv"?: never,"seed_confirm_count"?: number,"seed_deny_count"?: number,"source_label"?: Database["public"]['Enums']["source_label"],"status"?: Database["public"]['Enums']["fix_status"],"symptoms"?: string,"tests_performed"?: NonNullable<Json>,"title"?: string,"updated_at"?: string,"vehicle_id"?: string | null,"verified_at"?: string | null,"version"?: number,"year"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "fixes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fixes_repair_order_fk"
      columns: ["repair_order_id"]
isOneToOne: false
      referencedRelation: "repair_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fixes_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_queue": {
                  Row: {
                    "created_at": string,"fix_id": string | null,"id": string,"kind": Database["public"]['Enums']["moderation_kind"],"reason": string | null,"reported_by": string | null,"resolution_note": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": Database["public"]['Enums']["moderation_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"fix_id"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["moderation_kind"],"reason"?: string | null,"reported_by"?: string | null,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["moderation_status"]
                  }
                  Update: {
                    "created_at"?: string,"fix_id"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["moderation_kind"],"reason"?: string | null,"reported_by"?: string | null,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["moderation_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_queue_fix_id_fkey"
      columns: ["fix_id"]
isOneToOne: false
      referencedRelation: "fixes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_queue_reported_by_fkey"
      columns: ["reported_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "accepted_terms_at": string | null,"ai_queries_period_start": string,"ai_queries_used": number,"created_at": string,"display_name": string,"free_months_earned": number,"free_months_redeemed": number,"id": string,"reputation": number,"role": Database["public"]['Enums']["user_role"],"shop_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_terms_at"?: string | null,"ai_queries_period_start"?: string,"ai_queries_used"?: number,"created_at"?: string,"display_name"?: string,"free_months_earned"?: number,"free_months_redeemed"?: number,"id": string,"reputation"?: number,"role"?: Database["public"]['Enums']["user_role"],"shop_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "accepted_terms_at"?: string | null,"ai_queries_period_start"?: string,"ai_queries_used"?: number,"created_at"?: string,"display_name"?: string,"free_months_earned"?: number,"free_months_redeemed"?: number,"id"?: string,"reputation"?: number,"role"?: Database["public"]['Enums']["user_role"],"shop_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"provider_cache": {
                  Row: {
                    "cache_key": string,"expires_at": string,"fetched_at": string,"payload": NonNullable<Json>,"provider": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cache_key": string,"expires_at": string,"fetched_at"?: string,"payload": NonNullable<Json>,"provider": string
                  }
                  Update: {
                    "cache_key"?: string,"expires_at"?: string,"fetched_at"?: string,"payload"?: NonNullable<Json>,"provider"?: string
                  }
                  Relationships: [
                    
                  ]
                },"repair_order_media": {
                  Row: {
                    "caption": string | null,"created_at": string,"id": string,"repair_order_id": string,"storage_path": string,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "caption"?: string | null,"created_at"?: string,"id"?: string,"repair_order_id": string,"storage_path": string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "caption"?: string | null,"created_at"?: string,"id"?: string,"repair_order_id"?: string,"storage_path"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "repair_order_media_repair_order_id_fkey"
      columns: ["repair_order_id"]
isOneToOne: false
      referencedRelation: "repair_orders"
      referencedColumns: ["id"]
    }
                  ]
                },"repair_orders": {
                  Row: {
                    "author_id": string,"cause": string | null,"completed_at": string | null,"concern": string,"correction": string | null,"created_at": string,"customer_name": string | null,"dtc_codes": (string)[],"fix_id": string | null,"id": string,"labor_hours": number | null,"mileage": number | null,"notes": string | null,"parts": NonNullable<Json>,"ro_number": number,"shop_id": string | null,"status": Database["public"]['Enums']["ro_status"],"tests_performed": NonNullable<Json>,"updated_at": string,"vehicle_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"cause"?: string | null,"completed_at"?: string | null,"concern": string,"correction"?: string | null,"created_at"?: string,"customer_name"?: string | null,"dtc_codes"?: (string)[],"fix_id"?: string | null,"id"?: string,"labor_hours"?: number | null,"mileage"?: number | null,"notes"?: string | null,"parts"?: NonNullable<Json>,"ro_number"?: number,"shop_id"?: string | null,"status"?: Database["public"]['Enums']["ro_status"],"tests_performed"?: NonNullable<Json>,"updated_at"?: string,"vehicle_id": string
                  }
                  Update: {
                    "author_id"?: string,"cause"?: string | null,"completed_at"?: string | null,"concern"?: string,"correction"?: string | null,"created_at"?: string,"customer_name"?: string | null,"dtc_codes"?: (string)[],"fix_id"?: string | null,"id"?: string,"labor_hours"?: number | null,"mileage"?: number | null,"notes"?: string | null,"parts"?: NonNullable<Json>,"ro_number"?: number,"shop_id"?: string | null,"status"?: Database["public"]['Enums']["ro_status"],"tests_performed"?: NonNullable<Json>,"updated_at"?: string,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "repair_orders_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "repair_orders_fix_id_fkey"
      columns: ["fix_id"]
isOneToOne: false
      referencedRelation: "fixes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "repair_orders_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "repair_orders_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"shops": {
                  Row: {
                    "address": string | null,"created_at": string,"email": string | null,"id": string,"labor_rate": number,"name": string,"owner_id": string,"phone": string | null,"tax_rate": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"labor_rate"?: number,"name": string,"owner_id": string,"phone"?: string | null,"tax_rate"?: number,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"labor_rate"?: number,"name"?: string,"owner_id"?: string,"phone"?: string | null,"tax_rate"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"subscriptions": {
                  Row: {
                    "cancel_at_period_end": boolean,"created_at": string,"current_period_end": string | null,"id": string,"seats": number,"shop_id": string | null,"status": string,"stripe_customer_id": string | null,"stripe_subscription_id": string | null,"tier": Database["public"]['Enums']["subscription_tier"],"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_at_period_end"?: boolean,"created_at"?: string,"current_period_end"?: string | null,"id"?: string,"seats"?: number,"shop_id"?: string | null,"status"?: string,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"tier"?: Database["public"]['Enums']["subscription_tier"],"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "cancel_at_period_end"?: boolean,"created_at"?: string,"current_period_end"?: string | null,"id"?: string,"seats"?: number,"shop_id"?: string | null,"status"?: string,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"tier"?: Database["public"]['Enums']["subscription_tier"],"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"vehicles": {
                  Row: {
                    "body_class": string | null,"created_at": string,"cylinders": number | null,"displacement_l": number | null,"drive_type": string | null,"engine": string | null,"fuel_type": string | null,"id": string,"make": string,"mileage": number | null,"model": string,"nickname": string | null,"notes": string | null,"owner_id": string,"plant": string | null,"plate": string | null,"shop_id": string | null,"specs": NonNullable<Json>,"specs_source": Database["public"]['Enums']["source_label"],"transmission": string | null,"trim": string | null,"updated_at": string,"vin": string | null,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "body_class"?: string | null,"created_at"?: string,"cylinders"?: number | null,"displacement_l"?: number | null,"drive_type"?: string | null,"engine"?: string | null,"fuel_type"?: string | null,"id"?: string,"make": string,"mileage"?: number | null,"model": string,"nickname"?: string | null,"notes"?: string | null,"owner_id": string,"plant"?: string | null,"plate"?: string | null,"shop_id"?: string | null,"specs"?: NonNullable<Json>,"specs_source"?: Database["public"]['Enums']["source_label"],"transmission"?: string | null,"trim"?: string | null,"updated_at"?: string,"vin"?: string | null,"year": number
                  }
                  Update: {
                    "body_class"?: string | null,"created_at"?: string,"cylinders"?: number | null,"displacement_l"?: number | null,"drive_type"?: string | null,"engine"?: string | null,"fuel_type"?: string | null,"id"?: string,"make"?: string,"mileage"?: number | null,"model"?: string,"nickname"?: string | null,"notes"?: string | null,"owner_id"?: string,"plant"?: string | null,"plate"?: string | null,"shop_id"?: string | null,"specs"?: NonNullable<Json>,"specs_source"?: Database["public"]['Enums']["source_label"],"transmission"?: string | null,"trim"?: string | null,"updated_at"?: string,"vin"?: string | null,"year"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicles_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "cleanup_provider_cache":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"consume_ai_query":
{ Args: { "p_limit": number }; Returns: boolean
                           },
"dearmor":
{ Args: { "": string }; Returns: string
                           },
"gen_random_uuid":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"gen_salt":
{ Args: { "": string }; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"my_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"my_shop_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"pgp_armor_headers":
{ Args: { "": string }; Returns: Record<string, unknown>[]
                           },
"rank_fixes":
{ Args: { "p_codes"?: (string)[],"p_engine"?: string,"p_limit"?: number,"p_make": string,"p_model": string,"p_year": number }; Returns: {
              "fix_id": string,"match_level": string,"matched_codes": (string)[],"rank_score": number
            }[]
                           },
"recompute_fix_score":
{ Args: { "p_fix_id": string }; Returns: undefined
                           },
"recompute_reputation":
{ Args: { "p_user": string }; Returns: undefined
                           },
"redeem_free_month":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"search_fixes":
{ Args: { "p_limit"?: number,"p_make"?: string,"p_model"?: string,"p_query": string }; Returns: {
              "fix_id": string,"rank": number
            }[]
                           },
"show_limit":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"show_trgm":
{ Args: { "": string }; Returns: (string)[]
                           }
          }
          Enums: {
            "ai_role": "user"|"assistant","confirmation_verdict": "fixed"|"not_fixed","estimate_line_kind": "part"|"labor"|"fee","estimate_status": "draft"|"sent"|"approved"|"declined","fix_status": "pending"|"approved"|"rejected"|"flagged","moderation_kind": "new_fix"|"report"|"edit","moderation_status": "open"|"resolved"|"dismissed","ro_status": "open"|"in_progress"|"completed"|"invoiced","source_label": "NHTSA"|"COMMUNITY"|"OWNER"|"LICENSED"|"SAMPLE","subscription_tier": "free"|"pro_tech"|"shop","user_role": "diy"|"technician"|"shop_owner"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "ai_role": ["user", "assistant"],"confirmation_verdict": ["fixed", "not_fixed"],"estimate_line_kind": ["part", "labor", "fee"],"estimate_status": ["draft", "sent", "approved", "declined"],"fix_status": ["pending", "approved", "rejected", "flagged"],"moderation_kind": ["new_fix", "report", "edit"],"moderation_status": ["open", "resolved", "dismissed"],"ro_status": ["open", "in_progress", "completed", "invoiced"],"source_label": ["NHTSA", "COMMUNITY", "OWNER", "LICENSED", "SAMPLE"],"subscription_tier": ["free", "pro_tech", "shop"],"user_role": ["diy", "technician", "shop_owner", "admin"]
          }
        }
} as const
