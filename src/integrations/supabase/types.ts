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
      evaluations: {
        Row: {
          answer_id: string
          concept_coverage: number | null
          evaluated_at: string | null
          explanation: string | null
          final_score: number | null
          id: string
          marks: number | null
          missing_concepts: string[] | null
          model_version: string | null
          similarity_score: number | null
          strengths: string | null
          suggestions: string | null
          weaknesses: string | null
        }
        Insert: {
          answer_id: string
          concept_coverage?: number | null
          evaluated_at?: string | null
          explanation?: string | null
          final_score?: number | null
          id?: string
          marks?: number | null
          missing_concepts?: string[] | null
          model_version?: string | null
          similarity_score?: number | null
          strengths?: string | null
          suggestions?: string | null
          weaknesses?: string | null
        }
        Update: {
          answer_id?: string
          concept_coverage?: number | null
          evaluated_at?: string | null
          explanation?: string | null
          final_score?: number | null
          id?: string
          marks?: number | null
          missing_concepts?: string[] | null
          model_version?: string | null
          similarity_score?: number | null
          strengths?: string | null
          suggestions?: string | null
          weaknesses?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "student_answers"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string | null
          evaluation_id: string
          explanation_helpful: number | null
          id: string
          score_accurate: boolean | null
          teacher_feedback: string | null
          teacher_id: string
          teacher_score: number | null
          what_ai_got_wrong: string | null
          what_ai_missed: string | null
        }
        Insert: {
          created_at?: string | null
          evaluation_id: string
          explanation_helpful?: number | null
          id?: string
          score_accurate?: boolean | null
          teacher_feedback?: string | null
          teacher_id: string
          teacher_score?: number | null
          what_ai_got_wrong?: string | null
          what_ai_missed?: string | null
        }
        Update: {
          created_at?: string | null
          evaluation_id?: string
          explanation_helpful?: number | null
          id?: string
          score_accurate?: boolean | null
          teacher_feedback?: string | null
          teacher_id?: string
          teacher_score?: number | null
          what_ai_got_wrong?: string | null
          what_ai_missed?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          institution: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          institution?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          institution?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          created_at: string | null
          created_by: string | null
          difficulty: string | null
          id: string
          ideal_answer: string
          max_marks: number
          question_text: string
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          difficulty?: string | null
          id?: string
          ideal_answer: string
          max_marks?: number
          question_text: string
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          difficulty?: string | null
          id?: string
          ideal_answer?: string
          max_marks?: number
          question_text?: string
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      student_answers: {
        Row: {
          id: string
          image_path: string
          ocr_confidence: number | null
          ocr_text: string | null
          question_id: string
          student_name: string | null
          uploaded_at: string | null
          uploaded_by: string
        }
        Insert: {
          id?: string
          image_path: string
          ocr_confidence?: number | null
          ocr_text?: string | null
          question_id: string
          student_name?: string | null
          uploaded_at?: string | null
          uploaded_by: string
        }
        Update: {
          id?: string
          image_path?: string
          ocr_confidence?: number | null
          ocr_text?: string | null
          question_id?: string
          student_name?: string | null
          uploaded_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_dashboard_stats: {
        Args: Record<string, never>
        Returns: {
          total_questions: number
          total_answers: number
          total_evaluations: number
          avg_score: number
          avg_ocr_confidence: number
          score_distribution: Json
          confidence_trend: Json
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "teacher"
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
      app_role: ["admin", "teacher"],
    },
  },
} as const
