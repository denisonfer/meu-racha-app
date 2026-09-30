export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      join_request: {
        Row: {
          created_at: string;
          id: string;
          profile_id: string;
          racha_id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["join_request_status"];
        };
        Insert: {
          created_at?: string;
          id?: string;
          profile_id?: string;
          racha_id: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["join_request_status"];
        };
        Update: {
          created_at?: string;
          id?: string;
          profile_id?: string;
          racha_id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["join_request_status"];
        };
        Relationships: [
          {
            foreignKeyName: "join_request_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "join_request_racha_id_fkey";
            columns: ["racha_id"];
            isOneToOne: false;
            referencedRelation: "racha";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "join_request_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
        ];
      };
      member: {
        Row: {
          id: string;
          is_active: boolean;
          is_super_star: boolean;
          joined_at: string;
          plays_as: Database["public"]["Enums"]["plays_as"];
          primary_position: Database["public"]["Enums"]["position"] | null;
          profile_id: string;
          racha_id: string;
          role: Database["public"]["Enums"]["member_role"];
          secondary_position: Database["public"]["Enums"]["position"] | null;
          stars: number | null;
        };
        Insert: {
          id?: string;
          is_active?: boolean;
          is_super_star?: boolean;
          joined_at?: string;
          plays_as: Database["public"]["Enums"]["plays_as"];
          primary_position?: Database["public"]["Enums"]["position"] | null;
          profile_id: string;
          racha_id: string;
          role: Database["public"]["Enums"]["member_role"];
          secondary_position?: Database["public"]["Enums"]["position"] | null;
          stars?: number | null;
        };
        Update: {
          id?: string;
          is_active?: boolean;
          is_super_star?: boolean;
          joined_at?: string;
          plays_as?: Database["public"]["Enums"]["plays_as"];
          primary_position?: Database["public"]["Enums"]["position"] | null;
          profile_id?: string;
          racha_id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          secondary_position?: Database["public"]["Enums"]["position"] | null;
          stars?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "member_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_racha_id_fkey";
            columns: ["racha_id"];
            isOneToOne: false;
            referencedRelation: "racha";
            referencedColumns: ["id"];
          },
        ];
      };
      profile: {
        Row: {
          anonymized_at: string | null;
          avatar_path: string | null;
          birth_date: string;
          created_at: string;
          display_name: string;
          id: string;
          plays_as: Database["public"]["Enums"]["plays_as"];
          primary_position: Database["public"]["Enums"]["position"] | null;
          secondary_position: Database["public"]["Enums"]["position"] | null;
          terms_accepted_at: string;
        };
        Insert: {
          anonymized_at?: string | null;
          avatar_path?: string | null;
          birth_date: string;
          created_at?: string;
          display_name: string;
          id: string;
          plays_as: Database["public"]["Enums"]["plays_as"];
          primary_position?: Database["public"]["Enums"]["position"] | null;
          secondary_position?: Database["public"]["Enums"]["position"] | null;
          terms_accepted_at: string;
        };
        Update: {
          anonymized_at?: string | null;
          avatar_path?: string | null;
          birth_date?: string;
          created_at?: string;
          display_name?: string;
          id?: string;
          plays_as?: Database["public"]["Enums"]["plays_as"];
          primary_position?: Database["public"]["Enums"]["position"] | null;
          secondary_position?: Database["public"]["Enums"]["position"] | null;
          terms_accepted_at?: string;
        };
        Relationships: [];
      };
      racha: {
        Row: {
          consider_position: boolean;
          created_at: string;
          game_mode: Database["public"]["Enums"]["game_mode"];
          id: string;
          invite_code: string;
          match_duration_min: number | null;
          max_consecutive_wins: number;
          min_age: number | null;
          name: string;
          outfield_per_team: number;
          tie_return_order: Database["public"]["Enums"]["tie_return_order"];
          tie_rule: Database["public"]["Enums"]["tie_rule"];
        };
        Insert: {
          consider_position?: boolean;
          created_at?: string;
          game_mode?: Database["public"]["Enums"]["game_mode"];
          id?: string;
          invite_code: string;
          match_duration_min?: number | null;
          max_consecutive_wins?: number;
          min_age?: number | null;
          name: string;
          outfield_per_team?: number;
          tie_return_order?: Database["public"]["Enums"]["tie_return_order"];
          tie_rule?: Database["public"]["Enums"]["tie_rule"];
        };
        Update: {
          consider_position?: boolean;
          created_at?: string;
          game_mode?: Database["public"]["Enums"]["game_mode"];
          id?: string;
          invite_code?: string;
          match_duration_min?: number | null;
          max_consecutive_wins?: number;
          min_age?: number | null;
          name?: string;
          outfield_per_team?: number;
          tie_return_order?: Database["public"]["Enums"]["tie_return_order"];
          tie_rule?: Database["public"]["Enums"]["tie_rule"];
        };
        Relationships: [];
      };
      racha_notice: {
        Row: {
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["racha_notice_kind"];
          profile_id: string;
          racha_id: string;
          racha_name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["racha_notice_kind"];
          profile_id: string;
          racha_id: string;
          racha_name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["racha_notice_kind"];
          profile_id?: string;
          racha_id?: string;
          racha_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "racha_notice_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
        ];
      };
      season: {
        Row: {
          closed: boolean;
          ends_on: string;
          id: string;
          number: number;
          racha_id: string;
          starts_on: string;
        };
        Insert: {
          closed?: boolean;
          ends_on: string;
          id?: string;
          number: number;
          racha_id: string;
          starts_on: string;
        };
        Update: {
          closed?: boolean;
          ends_on?: string;
          id?: string;
          number?: number;
          racha_id?: string;
          starts_on?: string;
        };
        Relationships: [
          {
            foreignKeyName: "season_racha_id_fkey";
            columns: ["racha_id"];
            isOneToOne: false;
            referencedRelation: "racha";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      approve_join_request: {
        Args: { p_request_id: string; p_stars: number; p_super_star: boolean };
        Returns: undefined;
      };
      create_racha: {
        Args: {
          p_consider_position: boolean;
          p_game_mode: Database["public"]["Enums"]["game_mode"];
          p_match_duration_min?: number;
          p_max_consecutive_wins: number;
          p_min_age?: number;
          p_name: string;
          p_outfield_per_team: number;
          p_tie_return_order: Database["public"]["Enums"]["tie_return_order"];
          p_tie_rule: Database["public"]["Enums"]["tie_rule"];
        };
        Returns: {
          id: string;
          invite_code: string;
        }[];
      };
      email_available: { Args: { p_email: string }; Returns: boolean };
      expel_member: {
        Args: { p_profile_id: string; p_racha_id: string };
        Returns: undefined;
      };
      get_invite: {
        Args: { p_code: string };
        Returns: {
          member_count: number;
          min_age: number;
          my_status: string;
          name: string;
          owner_name: string;
          racha_id: string;
        }[];
      };
      is_racha_member: { Args: { p_racha_id: string }; Returns: boolean };
      leave_racha: { Args: { p_racha_id: string }; Returns: undefined };
      list_join_requests: {
        Args: { p_racha_id: string };
        Returns: {
          age: number;
          avatar_path: string;
          display_name: string;
          id: string;
          plays_as: Database["public"]["Enums"]["plays_as"];
          primary_position: Database["public"]["Enums"]["position"];
          secondary_position: Database["public"]["Enums"]["position"];
        }[];
      };
      list_my_join_requests: {
        Args: never;
        Returns: {
          racha_id: string;
          racha_name: string;
        }[];
      };
      list_racha_members: {
        Args: { p_racha_id: string };
        Returns: {
          avatar_path: string;
          display_name: string;
          is_super_star: boolean;
          plays_as: Database["public"]["Enums"]["plays_as"];
          primary_position: Database["public"]["Enums"]["position"];
          profile_id: string;
          role: Database["public"]["Enums"]["member_role"];
          secondary_position: Database["public"]["Enums"]["position"];
          stars: number;
        }[];
      };
      my_racha_role: {
        Args: { p_racha_id: string };
        Returns: Database["public"]["Enums"]["member_role"];
      };
      refuse_join_request: {
        Args: { p_request_id: string };
        Returns: undefined;
      };
      update_member: {
        Args: {
          p_profile_id: string;
          p_racha_id: string;
          p_role: Database["public"]["Enums"]["member_role"];
          p_stars: number;
          p_super_star: boolean;
        };
        Returns: undefined;
      };
    };
    Enums: {
      game_mode: "WINNER_STAYS" | "ROTATION" | "MAX_WINS";
      join_request_status: "PENDING" | "APPROVED" | "REJECTED";
      member_role: "OWNER" | "ADMIN" | "PLAYER";
      plays_as: "OUTFIELD" | "GOALKEEPER";
      position: "ANY" | "DEFENDER" | "MIDFIELDER" | "FORWARD";
      racha_notice_kind: "RACHA_DELETED" | "REMOVED";
      tie_return_order: "RANDOM" | "TEAM_ORDER";
      tie_rule: "BOTH_OUT" | "BOTH_STAY" | "PENALTIES" | "CHALLENGER_WINS";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      game_mode: ["WINNER_STAYS", "ROTATION", "MAX_WINS"],
      join_request_status: ["PENDING", "APPROVED", "REJECTED"],
      member_role: ["OWNER", "ADMIN", "PLAYER"],
      plays_as: ["OUTFIELD", "GOALKEEPER"],
      position: ["ANY", "DEFENDER", "MIDFIELDER", "FORWARD"],
      racha_notice_kind: ["RACHA_DELETED", "REMOVED"],
      tie_return_order: ["RANDOM", "TEAM_ORDER"],
      tie_rule: ["BOTH_OUT", "BOTH_STAY", "PENALTIES", "CHALLENGER_WINS"],
    },
  },
} as const;
