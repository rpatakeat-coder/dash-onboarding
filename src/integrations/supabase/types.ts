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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          summary: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          summary?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          summary?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      dash_operacoes: {
        Row: {
          agente_ativacao: string | null
          data_criacao: string | null
          data_entrada_fase: string | null
          etapa_negocio: string | null
          id_deal: number
          mrr: string | null
          nome_negocio: string | null
          perfil_cliente: string | null
          sla_dias: string | null
        }
        Insert: {
          agente_ativacao?: string | null
          data_criacao?: string | null
          data_entrada_fase?: string | null
          etapa_negocio?: string | null
          id_deal: number
          mrr?: string | null
          nome_negocio?: string | null
          perfil_cliente?: string | null
          sla_dias?: string | null
        }
        Update: {
          agente_ativacao?: string | null
          data_criacao?: string | null
          data_entrada_fase?: string | null
          etapa_negocio?: string | null
          id_deal?: number
          mrr?: string | null
          nome_negocio?: string | null
          perfil_cliente?: string | null
          sla_dias?: string | null
        }
        Relationships: []
      }
      dash_operacoes_snapshots: {
        Row: {
          band_alerta: number
          band_atencao: number
          band_critico: number
          band_saudavel: number
          created_at: string
          id: string
          mrr_total: number
          pct_no_prazo: number
          por_ativador: Json
          por_etapa: Json
          sla_medio: number
          snapshot_date: string
          total: number
        }
        Insert: {
          band_alerta?: number
          band_atencao?: number
          band_critico?: number
          band_saudavel?: number
          created_at?: string
          id?: string
          mrr_total?: number
          pct_no_prazo?: number
          por_ativador?: Json
          por_etapa?: Json
          sla_medio?: number
          snapshot_date: string
          total?: number
        }
        Update: {
          band_alerta?: number
          band_atencao?: number
          band_critico?: number
          band_saudavel?: number
          created_at?: string
          id?: string
          mrr_total?: number
          pct_no_prazo?: number
          por_ativador?: Json
          por_etapa?: Json
          sla_medio?: number
          snapshot_date?: string
          total?: number
        }
        Relationships: []
      }
      "Leads Criados Hubspot": {
        Row: {
          data_criacao: string | null
          id_deal: number
          nome_deal: string | null
          seller: string | null
        }
        Insert: {
          data_criacao?: string | null
          id_deal?: number
          nome_deal?: string | null
          seller?: string | null
        }
        Update: {
          data_criacao?: string | null
          id_deal?: number
          nome_deal?: string | null
          seller?: string | null
        }
        Relationships: []
      }
      "Ligações Realizadas": {
        Row: {
          data_criacao: string
          data_realizada: string | null
          duracao_chamada: string | null
          id_chamada: number
          id_deal: string | null
          nome_tarefa: string | null
          resultado_chamada: string | null
          seller: string | null
        }
        Insert: {
          data_criacao: string
          data_realizada?: string | null
          duracao_chamada?: string | null
          id_chamada?: number
          id_deal?: string | null
          nome_tarefa?: string | null
          resultado_chamada?: string | null
          seller?: string | null
        }
        Update: {
          data_criacao?: string
          data_realizada?: string | null
          duracao_chamada?: string | null
          id_chamada?: number
          id_deal?: string | null
          nome_tarefa?: string | null
          resultado_chamada?: string | null
          seller?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      "Relatório Perdidos": {
        Row: {
          data_criacao: string | null
          data_perda: string | null
          etapa: string | null
          id_deal: number
          motivo_perda: string | null
          mrr: string | null
          nome_deal: string | null
          seller: string | null
        }
        Insert: {
          data_criacao?: string | null
          data_perda?: string | null
          etapa?: string | null
          id_deal?: number
          motivo_perda?: string | null
          mrr?: string | null
          nome_deal?: string | null
          seller?: string | null
        }
        Update: {
          data_criacao?: string | null
          data_perda?: string | null
          etapa?: string | null
          id_deal?: number
          motivo_perda?: string | null
          mrr?: string | null
          nome_deal?: string | null
          seller?: string | null
        }
        Relationships: []
      }
      "Reuniões Marcadas": {
        Row: {
          data_reuniao: string
          data_reuniao_realizada: string | null
          id_deal: number
          nome_deal: string | null
          reuniao_realizada: string | null
          seller: string | null
        }
        Insert: {
          data_reuniao: string
          data_reuniao_realizada?: string | null
          id_deal?: number
          nome_deal?: string | null
          reuniao_realizada?: string | null
          seller?: string | null
        }
        Update: {
          data_reuniao?: string
          data_reuniao_realizada?: string | null
          id_deal?: number
          nome_deal?: string | null
          reuniao_realizada?: string | null
          seller?: string | null
        }
        Relationships: []
      }
      sync_control: {
        Row: {
          last_run_at: string
          sync_name: string
          updated_at: string
        }
        Insert: {
          last_run_at: string
          sync_name: string
          updated_at?: string
        }
        Update: {
          last_run_at?: string
          sync_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      Vendas: {
        Row: {
          id_seller: number
          id_unico: number
          leads: string | null
          mes_referencia: string | null
          meta_clientes: string | null
          meta_mrr: string | null
          meta_receita: string | null
          mrr_total: string | null
          novos_clientes: string | null
          receita_total: string | null
          seller: string | null
          time: string | null
          tm_mrr: string | null
          tm_receita: string | null
        }
        Insert: {
          id_seller: number
          id_unico?: number
          leads?: string | null
          mes_referencia?: string | null
          meta_clientes?: string | null
          meta_mrr?: string | null
          meta_receita?: string | null
          mrr_total?: string | null
          novos_clientes?: string | null
          receita_total?: string | null
          seller?: string | null
          time?: string | null
          tm_mrr?: string | null
          tm_receita?: string | null
        }
        Update: {
          id_seller?: number
          id_unico?: number
          leads?: string | null
          mes_referencia?: string | null
          meta_clientes?: string | null
          meta_mrr?: string | null
          meta_receita?: string | null
          mrr_total?: string | null
          novos_clientes?: string | null
          receita_total?: string | null
          seller?: string | null
          time?: string | null
          tm_mrr?: string | null
          tm_receita?: string | null
        }
        Relationships: []
      }
      "Vendas Hubspot": {
        Row: {
          assinatura: string | null
          created_at: string
          id_deal: number
          mrr: string | null
          nome_deal: string | null
          pacote: string | null
          perfil: string | null
          seller: string | null
          url: string | null
          valor_total: string | null
        }
        Insert: {
          assinatura?: string | null
          created_at?: string
          id_deal?: number
          mrr?: string | null
          nome_deal?: string | null
          pacote?: string | null
          perfil?: string | null
          seller?: string | null
          url?: string | null
          valor_total?: string | null
        }
        Update: {
          assinatura?: string | null
          created_at?: string
          id_deal?: number
          mrr?: string | null
          nome_deal?: string | null
          pacote?: string | null
          perfil?: string | null
          seller?: string | null
          url?: string | null
          valor_total?: string | null
        }
        Relationships: []
      }
      vendedores: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_first_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_admin_users: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          full_name: string
          id: string
          roles: string[]
        }[]
      }
      match_documents: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      match_imoveis_vixtates: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
