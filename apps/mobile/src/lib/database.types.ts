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
      event: {
        Row: {
          conduction_seq: number | null;
          conductor_id: string | null;
          consider_position: boolean;
          ended_at: string | null;
          ended_by: string | null;
          ended_by_system: boolean;
          game_mode: Database["public"]["Enums"]["game_mode"];
          id: string;
          is_paid: boolean;
          match_duration_min: number | null;
          max_consecutive_wins: number;
          outfield_per_team: number;
          payer_target: number | null;
          place: string;
          price: number | null;
          racha_id: string;
          reminder_lead_hours: number;
          spot_limit: number | null;
          starts_at: string;
          starts_on: string;
          status: Database["public"]["Enums"]["event_status"];
          tie_return_order: Database["public"]["Enums"]["tie_return_order"];
          tie_rule: Database["public"]["Enums"]["tie_rule"];
          yellow_card_mode: Database["public"]["Enums"]["yellow_card_mode"];
          yellow_out_min: number;
        };
        Insert: {
          conduction_seq?: number | null;
          conductor_id?: string | null;
          consider_position: boolean;
          ended_at?: string | null;
          ended_by?: string | null;
          ended_by_system?: boolean;
          game_mode: Database["public"]["Enums"]["game_mode"];
          id?: string;
          is_paid?: boolean;
          match_duration_min?: number | null;
          max_consecutive_wins: number;
          outfield_per_team: number;
          payer_target?: number | null;
          place: string;
          price?: number | null;
          racha_id: string;
          reminder_lead_hours: number;
          spot_limit?: number | null;
          starts_at: string;
          starts_on: string;
          status?: Database["public"]["Enums"]["event_status"];
          tie_return_order: Database["public"]["Enums"]["tie_return_order"];
          tie_rule: Database["public"]["Enums"]["tie_rule"];
          yellow_card_mode?: Database["public"]["Enums"]["yellow_card_mode"];
          yellow_out_min?: number;
        };
        Update: {
          conduction_seq?: number | null;
          conductor_id?: string | null;
          consider_position?: boolean;
          ended_at?: string | null;
          ended_by?: string | null;
          ended_by_system?: boolean;
          game_mode?: Database["public"]["Enums"]["game_mode"];
          id?: string;
          is_paid?: boolean;
          match_duration_min?: number | null;
          max_consecutive_wins?: number;
          outfield_per_team?: number;
          payer_target?: number | null;
          place?: string;
          price?: number | null;
          racha_id?: string;
          reminder_lead_hours?: number;
          spot_limit?: number | null;
          starts_at?: string;
          starts_on?: string;
          status?: Database["public"]["Enums"]["event_status"];
          tie_return_order?: Database["public"]["Enums"]["tie_return_order"];
          tie_rule?: Database["public"]["Enums"]["tie_rule"];
          yellow_card_mode?: Database["public"]["Enums"]["yellow_card_mode"];
          yellow_out_min?: number;
        };
        Relationships: [
          {
            foreignKeyName: "event_conductor_id_fkey";
            columns: ["conductor_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_ended_by_fkey";
            columns: ["ended_by"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_racha_id_fkey";
            columns: ["racha_id"];
            isOneToOne: false;
            referencedRelation: "racha";
            referencedColumns: ["id"];
          },
        ];
      };
      event_attendance: {
        Row: {
          did_attend: boolean;
          event_id: string;
          profile_id: string;
          status: Database["public"]["Enums"]["attendance_status"];
          waitlisted_at: string | null;
        };
        Insert: {
          did_attend?: boolean;
          event_id: string;
          profile_id: string;
          status: Database["public"]["Enums"]["attendance_status"];
          waitlisted_at?: string | null;
        };
        Update: {
          did_attend?: boolean;
          event_id?: string;
          profile_id?: string;
          status?: Database["public"]["Enums"]["attendance_status"];
          waitlisted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_attendance_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "event";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_attendance_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
        ];
      };
      event_bolinhas: {
        Row: {
          all_move: boolean;
          created_at: string;
          created_by: string | null;
          event_id: string;
          giver_team_id: string;
          id: string;
          receiver_team_id: string;
        };
        Insert: {
          all_move: boolean;
          created_at?: string;
          created_by?: string | null;
          event_id: string;
          giver_team_id: string;
          id?: string;
          receiver_team_id: string;
        };
        Update: {
          all_move?: boolean;
          created_at?: string;
          created_by?: string | null;
          event_id?: string;
          giver_team_id?: string;
          id?: string;
          receiver_team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_bolinhas_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_bolinhas_event_fk";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "event";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_bolinhas_giver_fk";
            columns: ["giver_team_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "event_sort_team";
            referencedColumns: ["id", "event_id"];
          },
          {
            foreignKeyName: "event_bolinhas_receiver_fk";
            columns: ["receiver_team_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "event_sort_team";
            referencedColumns: ["id", "event_id"];
          },
        ];
      };
      event_bolinhas_ball: {
        Row: {
          bolinhas_id: string;
          color: Database["public"]["Enums"]["event_bolinhas_color"];
          draw_order: number;
          guest_id: string | null;
          id: string;
          profile_id: string | null;
        };
        Insert: {
          bolinhas_id: string;
          color: Database["public"]["Enums"]["event_bolinhas_color"];
          draw_order: number;
          guest_id?: string | null;
          id?: string;
          profile_id?: string | null;
        };
        Update: {
          bolinhas_id?: string;
          color?: Database["public"]["Enums"]["event_bolinhas_color"];
          draw_order?: number;
          guest_id?: string | null;
          id?: string;
          profile_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_bolinhas_ball_bolinhas_id_fkey";
            columns: ["bolinhas_id"];
            isOneToOne: false;
            referencedRelation: "event_bolinhas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_bolinhas_ball_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "event_guest";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_bolinhas_ball_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
        ];
      };
      event_guest: {
        Row: {
          did_attend: boolean;
          display_name: string;
          event_id: string;
          id: string;
          is_paid: boolean;
          is_super_star: boolean;
          left_at: string | null;
          plays_as: Database["public"]["Enums"]["plays_as"];
          primary_position: Database["public"]["Enums"]["position"] | null;
          primary_position_detail:
            Database["public"]["Enums"]["position_detail"] | null;
          secondary_position: Database["public"]["Enums"]["position"] | null;
          secondary_position_detail:
            Database["public"]["Enums"]["position_detail"] | null;
          stars: number | null;
        };
        Insert: {
          did_attend?: boolean;
          display_name: string;
          event_id: string;
          id?: string;
          is_paid?: boolean;
          is_super_star?: boolean;
          left_at?: string | null;
          plays_as: Database["public"]["Enums"]["plays_as"];
          primary_position?: Database["public"]["Enums"]["position"] | null;
          primary_position_detail?:
            Database["public"]["Enums"]["position_detail"] | null;
          secondary_position?: Database["public"]["Enums"]["position"] | null;
          secondary_position_detail?:
            Database["public"]["Enums"]["position_detail"] | null;
          stars?: number | null;
        };
        Update: {
          did_attend?: boolean;
          display_name?: string;
          event_id?: string;
          id?: string;
          is_paid?: boolean;
          is_super_star?: boolean;
          left_at?: string | null;
          plays_as?: Database["public"]["Enums"]["plays_as"];
          primary_position?: Database["public"]["Enums"]["position"] | null;
          primary_position_detail?:
            Database["public"]["Enums"]["position_detail"] | null;
          secondary_position?: Database["public"]["Enums"]["position"] | null;
          secondary_position_detail?:
            Database["public"]["Enums"]["position_detail"] | null;
          stars?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_guest_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "event";
            referencedColumns: ["id"];
          },
        ];
      };
      event_match: {
        Row: {
          away_team_id: string;
          challenger_team_id: string | null;
          decided_by_penalties: boolean;
          ended_at: string | null;
          event_id: string;
          home_team_id: string;
          id: string;
          is_rematch: boolean;
          next_challenger_team_id: string | null;
          next_is_rematch: boolean;
          number: number;
          paused_at: string | null;
          paused_seconds: number;
          queue_before: Json;
          seq: number;
          started_at: string;
          started_by: string;
          status: Database["public"]["Enums"]["event_match_status"];
          winner_team_id: string | null;
        };
        Insert: {
          away_team_id: string;
          challenger_team_id?: string | null;
          decided_by_penalties?: boolean;
          ended_at?: string | null;
          event_id: string;
          home_team_id: string;
          id?: string;
          is_rematch?: boolean;
          next_challenger_team_id?: string | null;
          next_is_rematch?: boolean;
          number: number;
          paused_at?: string | null;
          paused_seconds?: number;
          queue_before: Json;
          seq?: number;
          started_at?: string;
          started_by: string;
          status?: Database["public"]["Enums"]["event_match_status"];
          winner_team_id?: string | null;
        };
        Update: {
          away_team_id?: string;
          challenger_team_id?: string | null;
          decided_by_penalties?: boolean;
          ended_at?: string | null;
          event_id?: string;
          home_team_id?: string;
          id?: string;
          is_rematch?: boolean;
          next_challenger_team_id?: string | null;
          next_is_rematch?: boolean;
          number?: number;
          paused_at?: string | null;
          paused_seconds?: number;
          queue_before?: Json;
          seq?: number;
          started_at?: string;
          started_by?: string;
          status?: Database["public"]["Enums"]["event_match_status"];
          winner_team_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_match_away_fk";
            columns: ["away_team_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "event_sort_team";
            referencedColumns: ["id", "event_id"];
          },
          {
            foreignKeyName: "event_match_challenger_fk";
            columns: ["challenger_team_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "event_sort_team";
            referencedColumns: ["id", "event_id"];
          },
          {
            foreignKeyName: "event_match_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "event_sort";
            referencedColumns: ["event_id"];
          },
          {
            foreignKeyName: "event_match_home_fk";
            columns: ["home_team_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "event_sort_team";
            referencedColumns: ["id", "event_id"];
          },
          {
            foreignKeyName: "event_match_next_challenger_fk";
            columns: ["next_challenger_team_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "event_sort_team";
            referencedColumns: ["id", "event_id"];
          },
          {
            foreignKeyName: "event_match_started_by_fkey";
            columns: ["started_by"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_match_winner_fk";
            columns: ["winner_team_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "event_sort_team";
            referencedColumns: ["id", "event_id"];
          },
        ];
      };
      event_match_card: {
        Row: {
          color: Database["public"]["Enums"]["event_match_card_color"];
          created_at: string;
          created_by: string;
          event_id: string;
          guest_id: string | null;
          id: string;
          is_goalkeeper: boolean;
          match_id: string;
          match_second: number;
          person_id: string | null;
          profile_id: string | null;
          red_reason:
            Database["public"]["Enums"]["event_match_card_red_reason"] | null;
          team_id: string;
        };
        Insert: {
          color: Database["public"]["Enums"]["event_match_card_color"];
          created_at?: string;
          created_by: string;
          event_id: string;
          guest_id?: string | null;
          id?: string;
          is_goalkeeper: boolean;
          match_id: string;
          match_second: number;
          person_id?: string | null;
          profile_id?: string | null;
          red_reason?:
            Database["public"]["Enums"]["event_match_card_red_reason"] | null;
          team_id: string;
        };
        Update: {
          color?: Database["public"]["Enums"]["event_match_card_color"];
          created_at?: string;
          created_by?: string;
          event_id?: string;
          guest_id?: string | null;
          id?: string;
          is_goalkeeper?: boolean;
          match_id?: string;
          match_second?: number;
          person_id?: string | null;
          profile_id?: string | null;
          red_reason?:
            Database["public"]["Enums"]["event_match_card_red_reason"] | null;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_match_card_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_match_card_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "event_guest";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_match_card_match_fk";
            columns: ["match_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "event_match";
            referencedColumns: ["id", "event_id"];
          },
          {
            foreignKeyName: "event_match_card_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_match_card_team_fk";
            columns: ["team_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "event_sort_team";
            referencedColumns: ["id", "event_id"];
          },
        ];
      };
      event_match_goal: {
        Row: {
          assist_guest_id: string | null;
          assist_id: string | null;
          assist_profile_id: string | null;
          conceded_goalkeeper_id: string | null;
          conceded_guest_id: string | null;
          conceded_profile_id: string | null;
          created_at: string;
          event_id: string;
          id: string;
          is_own_goal: boolean;
          match_id: string;
          request_key: string;
          scorer_guest_id: string | null;
          scorer_id: string | null;
          scorer_profile_id: string | null;
          team_id: string;
        };
        Insert: {
          assist_guest_id?: string | null;
          assist_id?: string | null;
          assist_profile_id?: string | null;
          conceded_goalkeeper_id?: string | null;
          conceded_guest_id?: string | null;
          conceded_profile_id?: string | null;
          created_at?: string;
          event_id: string;
          id?: string;
          is_own_goal?: boolean;
          match_id: string;
          request_key: string;
          scorer_guest_id?: string | null;
          scorer_id?: string | null;
          scorer_profile_id?: string | null;
          team_id: string;
        };
        Update: {
          assist_guest_id?: string | null;
          assist_id?: string | null;
          assist_profile_id?: string | null;
          conceded_goalkeeper_id?: string | null;
          conceded_guest_id?: string | null;
          conceded_profile_id?: string | null;
          created_at?: string;
          event_id?: string;
          id?: string;
          is_own_goal?: boolean;
          match_id?: string;
          request_key?: string;
          scorer_guest_id?: string | null;
          scorer_id?: string | null;
          scorer_profile_id?: string | null;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_match_goal_assist_guest_id_fkey";
            columns: ["assist_guest_id"];
            isOneToOne: false;
            referencedRelation: "event_guest";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_match_goal_assist_profile_id_fkey";
            columns: ["assist_profile_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_match_goal_conceded_guest_id_fkey";
            columns: ["conceded_guest_id"];
            isOneToOne: false;
            referencedRelation: "event_guest";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_match_goal_conceded_profile_id_fkey";
            columns: ["conceded_profile_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_match_goal_match_fk";
            columns: ["match_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "event_match";
            referencedColumns: ["id", "event_id"];
          },
          {
            foreignKeyName: "event_match_goal_scorer_guest_id_fkey";
            columns: ["scorer_guest_id"];
            isOneToOne: false;
            referencedRelation: "event_guest";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_match_goal_scorer_profile_id_fkey";
            columns: ["scorer_profile_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_match_goal_team_fk";
            columns: ["team_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "event_sort_team";
            referencedColumns: ["id", "event_id"];
          },
        ];
      };
      event_match_lineup: {
        Row: {
          entered_at: string;
          entry_kind: Database["public"]["Enums"]["event_match_lineup_entry_kind"];
          event_id: string;
          guest_id: string | null;
          id: string;
          left_at: string | null;
          left_by_red: boolean;
          left_by_self: boolean;
          match_id: string;
          person_id: string | null;
          profile_id: string | null;
          role: Database["public"]["Enums"]["event_match_role"];
          team_id: string;
        };
        Insert: {
          entered_at?: string;
          entry_kind?: Database["public"]["Enums"]["event_match_lineup_entry_kind"];
          event_id: string;
          guest_id?: string | null;
          id?: string;
          left_at?: string | null;
          left_by_red?: boolean;
          left_by_self?: boolean;
          match_id: string;
          person_id?: string | null;
          profile_id?: string | null;
          role: Database["public"]["Enums"]["event_match_role"];
          team_id: string;
        };
        Update: {
          entered_at?: string;
          entry_kind?: Database["public"]["Enums"]["event_match_lineup_entry_kind"];
          event_id?: string;
          guest_id?: string | null;
          id?: string;
          left_at?: string | null;
          left_by_red?: boolean;
          left_by_self?: boolean;
          match_id?: string;
          person_id?: string | null;
          profile_id?: string | null;
          role?: Database["public"]["Enums"]["event_match_role"];
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_match_lineup_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "event_guest";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_match_lineup_match_fk";
            columns: ["match_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "event_match";
            referencedColumns: ["id", "event_id"];
          },
          {
            foreignKeyName: "event_match_lineup_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_match_lineup_team_fk";
            columns: ["team_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "event_sort_team";
            referencedColumns: ["id", "event_id"];
          },
        ];
      };
      event_match_reinforcement: {
        Row: {
          created_at: string;
          entered_guest_id: string | null;
          entered_profile_id: string | null;
          event_id: string;
          from_team_id: string;
          id: string;
          left_guest_id: string | null;
          left_profile_id: string | null;
          match_id: string;
          team_drawn: boolean;
          to_team_id: string;
        };
        Insert: {
          created_at?: string;
          entered_guest_id?: string | null;
          entered_profile_id?: string | null;
          event_id: string;
          from_team_id: string;
          id?: string;
          left_guest_id?: string | null;
          left_profile_id?: string | null;
          match_id: string;
          team_drawn: boolean;
          to_team_id: string;
        };
        Update: {
          created_at?: string;
          entered_guest_id?: string | null;
          entered_profile_id?: string | null;
          event_id?: string;
          from_team_id?: string;
          id?: string;
          left_guest_id?: string | null;
          left_profile_id?: string | null;
          match_id?: string;
          team_drawn?: boolean;
          to_team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_match_reinforcement_entered_guest_id_fkey";
            columns: ["entered_guest_id"];
            isOneToOne: false;
            referencedRelation: "event_guest";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_match_reinforcement_entered_profile_id_fkey";
            columns: ["entered_profile_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_match_reinforcement_from_fk";
            columns: ["from_team_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "event_sort_team";
            referencedColumns: ["id", "event_id"];
          },
          {
            foreignKeyName: "event_match_reinforcement_left_guest_id_fkey";
            columns: ["left_guest_id"];
            isOneToOne: false;
            referencedRelation: "event_guest";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_match_reinforcement_left_profile_id_fkey";
            columns: ["left_profile_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_match_reinforcement_match_fk";
            columns: ["match_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "event_match";
            referencedColumns: ["id", "event_id"];
          },
          {
            foreignKeyName: "event_match_reinforcement_to_fk";
            columns: ["to_team_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "event_sort_team";
            referencedColumns: ["id", "event_id"];
          },
        ];
      };
      event_payment_fact: {
        Row: {
          cancelled_at: string | null;
          cash_paid_amount: number;
          credit_applied_amount: number;
          daily_amount_snapshot: number;
          did_attend: boolean;
          event_id: string;
          event_year_month: string;
          had_slot_since_payment: boolean;
          monthly_coverage_month: string | null;
          paid_marked_at: string | null;
          payment_cycle_id: string;
          profile_id: string;
          racha_id: string;
        };
        Insert: {
          cancelled_at?: string | null;
          cash_paid_amount?: number;
          credit_applied_amount?: number;
          daily_amount_snapshot: number;
          did_attend?: boolean;
          event_id: string;
          event_year_month: string;
          had_slot_since_payment?: boolean;
          monthly_coverage_month?: string | null;
          paid_marked_at?: string | null;
          payment_cycle_id?: string;
          profile_id: string;
          racha_id: string;
        };
        Update: {
          cancelled_at?: string | null;
          cash_paid_amount?: number;
          credit_applied_amount?: number;
          daily_amount_snapshot?: number;
          did_attend?: boolean;
          event_id?: string;
          event_year_month?: string;
          had_slot_since_payment?: boolean;
          monthly_coverage_month?: string | null;
          paid_marked_at?: string | null;
          payment_cycle_id?: string;
          profile_id?: string;
          racha_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_payment_fact_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_payment_fact_racha_id_fkey";
            columns: ["racha_id"];
            isOneToOne: false;
            referencedRelation: "racha";
            referencedColumns: ["id"];
          },
        ];
      };
      event_sort: {
        Row: {
          balance_diff: number;
          balance_label: string;
          balance_score: number;
          capped_by_super: boolean;
          confirmed_at: string | null;
          confirmed_by: string | null;
          event_id: string;
          generated_at: string;
          goalkeepers_per_team: boolean;
          leftover_ids: string[];
          mode: string;
          signature: string;
          status: Database["public"]["Enums"]["event_sort_status"];
          super_diff: number;
          super_warning: Json;
          version: number;
        };
        Insert: {
          balance_diff: number;
          balance_label: string;
          balance_score: number;
          capped_by_super: boolean;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          event_id: string;
          generated_at?: string;
          goalkeepers_per_team: boolean;
          leftover_ids?: string[];
          mode: string;
          signature: string;
          status?: Database["public"]["Enums"]["event_sort_status"];
          super_diff: number;
          super_warning?: Json;
          version?: number;
        };
        Update: {
          balance_diff?: number;
          balance_label?: string;
          balance_score?: number;
          capped_by_super?: boolean;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          event_id?: string;
          generated_at?: string;
          goalkeepers_per_team?: boolean;
          leftover_ids?: string[];
          mode?: string;
          signature?: string;
          status?: Database["public"]["Enums"]["event_sort_status"];
          super_diff?: number;
          super_warning?: Json;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "event_sort_confirmed_by_fkey";
            columns: ["confirmed_by"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_sort_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: true;
            referencedRelation: "event";
            referencedColumns: ["id"];
          },
        ];
      };
      event_sort_goalkeeper: {
        Row: {
          event_id: string;
          guest_id: string | null;
          id: string;
          person_id: string | null;
          profile_id: string | null;
          queue_order: number | null;
          team_id: string | null;
        };
        Insert: {
          event_id: string;
          guest_id?: string | null;
          id?: string;
          person_id?: string | null;
          profile_id?: string | null;
          queue_order?: number | null;
          team_id?: string | null;
        };
        Update: {
          event_id?: string;
          guest_id?: string | null;
          id?: string;
          person_id?: string | null;
          profile_id?: string | null;
          queue_order?: number | null;
          team_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_sort_goalkeeper_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "event_sort";
            referencedColumns: ["event_id"];
          },
          {
            foreignKeyName: "event_sort_goalkeeper_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "event_guest";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_sort_goalkeeper_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_sort_goalkeeper_team_fk";
            columns: ["team_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "event_sort_team";
            referencedColumns: ["id", "event_id"];
          },
        ];
      };
      event_sort_team: {
        Row: {
          event_id: string;
          id: string;
          queue_order: number | null;
          team_number: number;
          win_streak: number;
        };
        Insert: {
          event_id: string;
          id?: string;
          queue_order?: number | null;
          team_number: number;
          win_streak?: number;
        };
        Update: {
          event_id?: string;
          id?: string;
          queue_order?: number | null;
          team_number?: number;
          win_streak?: number;
        };
        Relationships: [
          {
            foreignKeyName: "event_sort_team_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "event_sort";
            referencedColumns: ["event_id"];
          },
        ];
      };
      event_sort_team_player: {
        Row: {
          entered_at: string;
          event_id: string;
          guest_id: string | null;
          id: string;
          is_super_star_snapshot: boolean;
          left_at: string | null;
          person_id: string | null;
          primary_position_detail_snapshot:
            Database["public"]["Enums"]["position_detail"] | null;
          primary_position_snapshot: Database["public"]["Enums"]["position"];
          profile_id: string | null;
          secondary_position_detail_snapshot:
            Database["public"]["Enums"]["position_detail"] | null;
          secondary_position_snapshot:
            Database["public"]["Enums"]["position"] | null;
          stars_snapshot: number;
          team_id: string;
        };
        Insert: {
          entered_at?: string;
          event_id: string;
          guest_id?: string | null;
          id?: string;
          is_super_star_snapshot: boolean;
          left_at?: string | null;
          person_id?: string | null;
          primary_position_detail_snapshot?:
            Database["public"]["Enums"]["position_detail"] | null;
          primary_position_snapshot: Database["public"]["Enums"]["position"];
          profile_id?: string | null;
          secondary_position_detail_snapshot?:
            Database["public"]["Enums"]["position_detail"] | null;
          secondary_position_snapshot?:
            Database["public"]["Enums"]["position"] | null;
          stars_snapshot: number;
          team_id: string;
        };
        Update: {
          entered_at?: string;
          event_id?: string;
          guest_id?: string | null;
          id?: string;
          is_super_star_snapshot?: boolean;
          left_at?: string | null;
          person_id?: string | null;
          primary_position_detail_snapshot?:
            Database["public"]["Enums"]["position_detail"] | null;
          primary_position_snapshot?: Database["public"]["Enums"]["position"];
          profile_id?: string | null;
          secondary_position_detail_snapshot?:
            Database["public"]["Enums"]["position_detail"] | null;
          secondary_position_snapshot?:
            Database["public"]["Enums"]["position"] | null;
          stars_snapshot?: number;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_sort_team_player_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "event_guest";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_sort_team_player_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_sort_team_player_team_fk";
            columns: ["team_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "event_sort_team";
            referencedColumns: ["id", "event_id"];
          },
        ];
      };
      join_request: {
        Row: {
          created_at: string;
          id: string;
          primary_position_detail:
            Database["public"]["Enums"]["position_detail"] | null;
          profile_id: string;
          racha_id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          secondary_position_detail:
            Database["public"]["Enums"]["position_detail"] | null;
          status: Database["public"]["Enums"]["join_request_status"];
        };
        Insert: {
          created_at?: string;
          id?: string;
          primary_position_detail?:
            Database["public"]["Enums"]["position_detail"] | null;
          profile_id?: string;
          racha_id: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          secondary_position_detail?:
            Database["public"]["Enums"]["position_detail"] | null;
          status?: Database["public"]["Enums"]["join_request_status"];
        };
        Update: {
          created_at?: string;
          id?: string;
          primary_position_detail?:
            Database["public"]["Enums"]["position_detail"] | null;
          profile_id?: string;
          racha_id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          secondary_position_detail?:
            Database["public"]["Enums"]["position_detail"] | null;
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
          primary_position_detail:
            Database["public"]["Enums"]["position_detail"] | null;
          profile_id: string;
          racha_id: string;
          role: Database["public"]["Enums"]["member_role"];
          secondary_position: Database["public"]["Enums"]["position"] | null;
          secondary_position_detail:
            Database["public"]["Enums"]["position_detail"] | null;
          stars: number | null;
        };
        Insert: {
          id?: string;
          is_active?: boolean;
          is_super_star?: boolean;
          joined_at?: string;
          plays_as: Database["public"]["Enums"]["plays_as"];
          primary_position?: Database["public"]["Enums"]["position"] | null;
          primary_position_detail?:
            Database["public"]["Enums"]["position_detail"] | null;
          profile_id: string;
          racha_id: string;
          role: Database["public"]["Enums"]["member_role"];
          secondary_position?: Database["public"]["Enums"]["position"] | null;
          secondary_position_detail?:
            Database["public"]["Enums"]["position_detail"] | null;
          stars?: number | null;
        };
        Update: {
          id?: string;
          is_active?: boolean;
          is_super_star?: boolean;
          joined_at?: string;
          plays_as?: Database["public"]["Enums"]["plays_as"];
          primary_position?: Database["public"]["Enums"]["position"] | null;
          primary_position_detail?:
            Database["public"]["Enums"]["position_detail"] | null;
          profile_id?: string;
          racha_id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          secondary_position?: Database["public"]["Enums"]["position"] | null;
          secondary_position_detail?:
            Database["public"]["Enums"]["position_detail"] | null;
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
          is_paid: boolean;
          kickoff_time: string | null;
          match_duration_min: number | null;
          max_consecutive_wins: number;
          min_age: number | null;
          monthly_price: number | null;
          name: string;
          outfield_per_team: number;
          payer_target: number | null;
          place: string;
          price: number | null;
          reminder_lead_hours: number;
          spot_limit: number | null;
          tie_return_order: Database["public"]["Enums"]["tie_return_order"];
          tie_rule: Database["public"]["Enums"]["tie_rule"];
          weekday: number | null;
          yellow_card_mode: Database["public"]["Enums"]["yellow_card_mode"];
          yellow_out_min: number;
        };
        Insert: {
          consider_position?: boolean;
          created_at?: string;
          game_mode?: Database["public"]["Enums"]["game_mode"];
          id?: string;
          invite_code: string;
          is_paid?: boolean;
          kickoff_time?: string | null;
          match_duration_min?: number | null;
          max_consecutive_wins?: number;
          min_age?: number | null;
          monthly_price?: number | null;
          name: string;
          outfield_per_team?: number;
          payer_target?: number | null;
          place: string;
          price?: number | null;
          reminder_lead_hours?: number;
          spot_limit?: number | null;
          tie_return_order?: Database["public"]["Enums"]["tie_return_order"];
          tie_rule?: Database["public"]["Enums"]["tie_rule"];
          weekday?: number | null;
          yellow_card_mode?: Database["public"]["Enums"]["yellow_card_mode"];
          yellow_out_min?: number;
        };
        Update: {
          consider_position?: boolean;
          created_at?: string;
          game_mode?: Database["public"]["Enums"]["game_mode"];
          id?: string;
          invite_code?: string;
          is_paid?: boolean;
          kickoff_time?: string | null;
          match_duration_min?: number | null;
          max_consecutive_wins?: number;
          min_age?: number | null;
          monthly_price?: number | null;
          name?: string;
          outfield_per_team?: number;
          payer_target?: number | null;
          place?: string;
          price?: number | null;
          reminder_lead_hours?: number;
          spot_limit?: number | null;
          tie_return_order?: Database["public"]["Enums"]["tie_return_order"];
          tie_rule?: Database["public"]["Enums"]["tie_rule"];
          weekday?: number | null;
          yellow_card_mode?: Database["public"]["Enums"]["yellow_card_mode"];
          yellow_out_min?: number;
        };
        Relationships: [];
      };
      racha_credit_entry: {
        Row: {
          amount_delta: number;
          created_at: string;
          entry_kind: string;
          expires_at: string | null;
          id: string;
          operation_key: string;
          profile_id: string;
          racha_id: string;
          source_event_id: string;
          source_grant_id: string | null;
        };
        Insert: {
          amount_delta: number;
          created_at?: string;
          entry_kind: string;
          expires_at?: string | null;
          id?: string;
          operation_key: string;
          profile_id: string;
          racha_id: string;
          source_event_id: string;
          source_grant_id?: string | null;
        };
        Update: {
          amount_delta?: number;
          created_at?: string;
          entry_kind?: string;
          expires_at?: string | null;
          id?: string;
          operation_key?: string;
          profile_id?: string;
          racha_id?: string;
          source_event_id?: string;
          source_grant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "racha_credit_entry_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "racha_credit_entry_racha_id_fkey";
            columns: ["racha_id"];
            isOneToOne: false;
            referencedRelation: "racha";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "racha_credit_entry_source_grant_id_fkey";
            columns: ["source_grant_id"];
            isOneToOne: false;
            referencedRelation: "racha_credit_entry";
            referencedColumns: ["id"];
          },
        ];
      };
      racha_monthly_pass: {
        Row: {
          profile_id: string;
          racha_id: string;
          year_month: string;
        };
        Insert: {
          profile_id: string;
          racha_id: string;
          year_month: string;
        };
        Update: {
          profile_id?: string;
          racha_id?: string;
          year_month?: string;
        };
        Relationships: [
          {
            foreignKeyName: "racha_monthly_pass_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "racha_monthly_pass_racha_id_fkey";
            columns: ["racha_id"];
            isOneToOne: false;
            referencedRelation: "racha";
            referencedColumns: ["id"];
          },
        ];
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
      add_event_match_card: {
        Args: {
          p_color: Database["public"]["Enums"]["event_match_card_color"];
          p_guest_id: string;
          p_match_id: string;
          p_profile_id: string;
        };
        Returns: Json;
      };
      add_event_match_goal: {
        Args: {
          p_assist?: string;
          p_match_id: string;
          p_own_goal?: boolean;
          p_request_key: string;
          p_scorer?: string;
          p_team_id: string;
        };
        Returns: Json;
      };
      add_guest: {
        Args: {
          p_display_name: string;
          p_event_id: string;
          p_is_super_star: boolean;
          p_plays_as: Database["public"]["Enums"]["plays_as"];
          p_primary_position: Database["public"]["Enums"]["position"];
          p_primary_position_detail?: Database["public"]["Enums"]["position_detail"];
          p_secondary_position: Database["public"]["Enums"]["position"];
          p_secondary_position_detail?: Database["public"]["Enums"]["position_detail"];
          p_stars: number;
        };
        Returns: string;
      };
      approve_join_request: {
        Args: { p_request_id: string; p_stars: number; p_super_star: boolean };
        Returns: undefined;
      };
      assume_event_conduction: {
        Args: { p_event_id: string };
        Returns: undefined;
      };
      cancel_attendance: { Args: { p_event_id: string }; Returns: undefined };
      cancel_event: { Args: { p_event_id: string }; Returns: undefined };
      confirm_attendance: { Args: { p_event_id: string }; Returns: undefined };
      confirm_event_sort: {
        Args: { p_event_id: string; p_version: number };
        Returns: Json;
      };
      create_event: {
        Args: {
          p_is_paid: boolean;
          p_payer_target: number;
          p_place: string;
          p_price: number;
          p_racha_id: string;
          p_spot_limit: number;
          p_starts_at: string;
          p_starts_on: string;
        };
        Returns: string;
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
          p_place: string;
          p_tie_return_order: Database["public"]["Enums"]["tie_return_order"];
          p_tie_rule: Database["public"]["Enums"]["tie_rule"];
          p_yellow_card_mode?: Database["public"]["Enums"]["yellow_card_mode"];
          p_yellow_out_min?: number;
        };
        Returns: {
          id: string;
          invite_code: string;
        }[];
      };
      delete_event_match_card: { Args: { p_card_id: string }; Returns: Json };
      delete_event_match_goal: { Args: { p_goal_id: string }; Returns: Json };
      discard_event_match: { Args: { p_match_id: string }; Returns: Json };
      draw_event_bolinhas: {
        Args: {
          p_event_id: string;
          p_giver_team_id: string;
          p_receiver_team_id: string;
        };
        Returns: Json;
      };
      email_available: { Args: { p_email: string }; Returns: boolean };
      expel_member: {
        Args: { p_profile_id: string; p_racha_id: string };
        Returns: undefined;
      };
      finish_event: {
        Args: { p_event_id: string; p_payments_reviewed?: boolean };
        Returns: undefined;
      };
      finish_event_match: {
        Args: { p_match_id: string; p_penalty_winner?: string };
        Returns: Json;
      };
      get_event_match: { Args: { p_event_id: string }; Returns: Json };
      get_event_sort: { Args: { p_event_id: string }; Returns: Json };
      get_event_sort_proposal: { Args: { p_event_id: string }; Returns: Json };
      get_invite: {
        Args: { p_code: string };
        Returns: {
          member_count: number;
          min_age: number;
          my_status: string;
          name: string;
          outfield_per_team: number;
          owner_name: string;
          racha_id: string;
        }[];
      };
      include_event_sort_guest: {
        Args: {
          p_display_name: string;
          p_event_id: string;
          p_is_super_star: boolean;
          p_plays_as: Database["public"]["Enums"]["plays_as"];
          p_primary_position: Database["public"]["Enums"]["position"];
          p_primary_position_detail?: Database["public"]["Enums"]["position_detail"];
          p_secondary_position: Database["public"]["Enums"]["position"];
          p_secondary_position_detail?: Database["public"]["Enums"]["position_detail"];
          p_stars: number;
        };
        Returns: Json;
      };
      include_event_sort_member: {
        Args: { p_event_id: string; p_profile_id: string };
        Returns: Json;
      };
      is_racha_member: { Args: { p_racha_id: string }; Returns: boolean };
      leave_event_sort: {
        Args: {
          p_event_id: string;
          p_guest_id?: string;
          p_profile_id?: string;
        };
        Returns: Json;
      };
      leave_racha: { Args: { p_racha_id: string }; Returns: undefined };
      list_event_attendance: {
        Args: { p_event_id: string };
        Returns: {
          avatar_path: string;
          cash_paid_amount: number;
          credit_applied_amount: number;
          credit_balance: number;
          did_attend: boolean;
          display_name: string;
          event_status: Database["public"]["Enums"]["event_status"];
          guest_id: string;
          is_monthly_pass: boolean;
          is_paid_effective: boolean;
          is_super_star: boolean;
          kind: string;
          my_credit_balance: number;
          payer_target: number;
          plays_as: Database["public"]["Enums"]["plays_as"];
          present_payer_count: number;
          primary_layer: string;
          primary_position: Database["public"]["Enums"]["position"];
          profile_id: string;
          queue_position: number;
          role: Database["public"]["Enums"]["member_role"];
          secondary_position: Database["public"]["Enums"]["position"];
          sort_confirmed: boolean;
          stars: number;
          status: Database["public"]["Enums"]["attendance_status"];
        }[];
      };
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
      list_my_racha_events: {
        Args: never;
        Returns: {
          confirmed_count: number;
          id: string;
          match_away_score: number;
          match_home_score: number;
          match_state: string;
          my_queue_position: number;
          my_status: string;
          next_away_team_number: number;
          next_home_team_number: number;
          place: string;
          racha_id: string;
          sort_confirmed: boolean;
          spot_limit: number;
          starts_at: string;
          starts_on: string;
          status: Database["public"]["Enums"]["event_status"];
        }[];
      };
      list_open_events: {
        Args: { p_racha_id: string };
        Returns: {
          conductor_id: string;
          conductor_name: string;
          confirmed_count: number;
          id: string;
          is_paid: boolean;
          match_away_score: number;
          match_home_score: number;
          match_state: string;
          my_queue_position: number;
          my_status: string;
          next_away_team_number: number;
          next_home_team_number: number;
          outfield_per_team: number;
          payer_target: number;
          place: string;
          price: number;
          sort_confirmed: boolean;
          spot_limit: number;
          starts_at: string;
          starts_on: string;
          status: Database["public"]["Enums"]["event_status"];
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
          primary_position_detail: Database["public"]["Enums"]["position_detail"];
          profile_id: string;
          role: Database["public"]["Enums"]["member_role"];
          secondary_position: Database["public"]["Enums"]["position"];
          secondary_position_detail: Database["public"]["Enums"]["position_detail"];
          stars: number;
        }[];
      };
      my_racha_role: {
        Args: { p_racha_id: string };
        Returns: Database["public"]["Enums"]["member_role"];
      };
      pause_event_match: { Args: { p_match_id: string }; Returns: Json };
      prepare_event_sort: { Args: { p_event_id: string }; Returns: Json };
      preview_finish_event_match: {
        Args: { p_match_id: string; p_penalty_winner?: string };
        Returns: Json;
      };
      racha_has_active_event: {
        Args: { p_racha_id: string };
        Returns: boolean;
      };
      refuse_join_request: {
        Args: { p_request_id: string };
        Returns: undefined;
      };
      reinforce_event_match: {
        Args: {
          p_donor_team_id?: string;
          p_guest_id?: string;
          p_match_id: string;
          p_profile_id?: string;
        };
        Returns: Json;
      };
      remove_guest: { Args: { p_guest_id: string }; Returns: undefined };
      resume_event_match: { Args: { p_match_id: string }; Returns: Json };
      return_event_sort_player: {
        Args: {
          p_event_id: string;
          p_guest_id?: string;
          p_profile_id?: string;
        };
        Returns: Json;
      };
      set_attendance_attended: {
        Args: {
          p_did_attend: boolean;
          p_event_id: string;
          p_guest_id: string;
          p_profile_id: string;
        };
        Returns: undefined;
      };
      set_attendance_for_member: {
        Args: {
          p_event_id: string;
          p_profile_id: string;
          p_status: Database["public"]["Enums"]["attendance_status"];
        };
        Returns: undefined;
      };
      set_attendance_paid: {
        Args: {
          p_event_id: string;
          p_guest_id: string;
          p_paid: boolean;
          p_profile_id: string;
        };
        Returns: undefined;
      };
      set_member_position_details: {
        Args: {
          p_primary: Database["public"]["Enums"]["position_detail"];
          p_profile_id: string;
          p_racha_id: string;
          p_secondary: Database["public"]["Enums"]["position_detail"];
        };
        Returns: undefined;
      };
      set_monthly_pass: {
        Args: {
          p_enabled: boolean;
          p_profile_id: string;
          p_racha_id: string;
          p_year_month: string;
        };
        Returns: undefined;
      };
      start_event_match: {
        Args: {
          p_away_goalkeeper?: string;
          p_event_id: string;
          p_home_goalkeeper?: string;
        };
        Returns: Json;
      };
      swap_event_match_goalkeeper: {
        Args: { p_goalkeeper: string; p_match_id: string; p_team_id: string };
        Returns: Json;
      };
      swap_event_sort_goalkeepers: {
        Args: {
          p_event_id: string;
          p_goalkeeper_a: string;
          p_goalkeeper_b: string;
          p_version: number;
        };
        Returns: Json;
      };
      transfer_ownership: {
        Args: { p_profile_id: string; p_racha_id: string };
        Returns: undefined;
      };
      update_event: {
        Args: {
          p_event_id: string;
          p_is_paid: boolean;
          p_payer_target: number;
          p_place: string;
          p_price: number;
          p_spot_limit: number;
          p_starts_at: string;
          p_starts_on: string;
        };
        Returns: undefined;
      };
      update_event_match_goal: {
        Args: { p_assist?: string; p_goal_id: string; p_scorer: string };
        Returns: Json;
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
      update_racha_logistics: {
        Args: {
          p_is_paid: boolean;
          p_kickoff_time: string;
          p_min_age: number;
          p_monthly_price: number;
          p_payer_target: number;
          p_place: string;
          p_price: number;
          p_racha_id: string;
          p_spot_limit: number;
          p_weekday: number;
        };
        Returns: undefined;
      };
    };
    Enums: {
      attendance_status: "confirmed" | "waitlisted" | "cancelled" | "left";
      event_bolinhas_color: "blue" | "red";
      event_match_card_color: "yellow" | "red";
      event_match_card_red_reason: "direct" | "second_yellow";
      event_match_lineup_entry_kind:
        "start" | "reinforcement" | "inclusion" | "return" | "goalkeeper";
      event_match_role: "OUTFIELD" | "GOALKEEPER";
      event_match_status: "open" | "finished" | "discarded";
      event_sort_status: "draft" | "confirmed";
      event_status: "upcoming" | "active" | "finished";
      game_mode: "WINNER_STAYS" | "ROTATION" | "MAX_WINS";
      join_request_status: "PENDING" | "APPROVED" | "REJECTED";
      member_role: "OWNER" | "ADMIN" | "PLAYER";
      plays_as: "OUTFIELD" | "GOALKEEPER";
      position: "ANY" | "DEFENDER" | "MIDFIELDER" | "FORWARD";
      position_detail:
        "CENTER_BACK" | "FULL_BACK" | "DEFENSIVE_MID" | "ATTACKING_MID";
      racha_notice_kind: "RACHA_DELETED" | "REMOVED" | "OWNERSHIP_RECEIVED";
      tie_return_order: "RANDOM" | "TEAM_ORDER";
      tie_rule: "BOTH_OUT" | "BOTH_STAY" | "PENALTIES" | "CHALLENGER_WINS";
      yellow_card_mode: "timed" | "mark";
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
      attendance_status: ["confirmed", "waitlisted", "cancelled", "left"],
      event_bolinhas_color: ["blue", "red"],
      event_match_card_color: ["yellow", "red"],
      event_match_card_red_reason: ["direct", "second_yellow"],
      event_match_lineup_entry_kind: [
        "start",
        "reinforcement",
        "inclusion",
        "return",
        "goalkeeper",
      ],
      event_match_role: ["OUTFIELD", "GOALKEEPER"],
      event_match_status: ["open", "finished", "discarded"],
      event_sort_status: ["draft", "confirmed"],
      event_status: ["upcoming", "active", "finished"],
      game_mode: ["WINNER_STAYS", "ROTATION", "MAX_WINS"],
      join_request_status: ["PENDING", "APPROVED", "REJECTED"],
      member_role: ["OWNER", "ADMIN", "PLAYER"],
      plays_as: ["OUTFIELD", "GOALKEEPER"],
      position: ["ANY", "DEFENDER", "MIDFIELDER", "FORWARD"],
      position_detail: [
        "CENTER_BACK",
        "FULL_BACK",
        "DEFENSIVE_MID",
        "ATTACKING_MID",
      ],
      racha_notice_kind: ["RACHA_DELETED", "REMOVED", "OWNERSHIP_RECEIVED"],
      tie_return_order: ["RANDOM", "TEAM_ORDER"],
      tie_rule: ["BOTH_OUT", "BOTH_STAY", "PENALTIES", "CHALLENGER_WINS"],
      yellow_card_mode: ["timed", "mark"],
    },
  },
} as const;
