import { Request } from "express";
export interface User {
  id: string;
  email: string;
  password: string;
  created_at: Date;
}

export interface Organization {
  id: string;
  name: string;
  description: string;
  created_at: Date;
}

export interface UserOrganization {
  user_id: string;
  org_id: string;
  created_at: Date;
}

export interface Source {
  id: string;
  org_id: string;
  name: string;
  type: SourceType;
  config: SourceConfig;
  last_sync_at?: Date;
  created_at: Date;
}

export type SourceType = "github" | "discord" | "webpage";

export interface SourceConfig {
  // GitHub config
  github?: {
    url: string;
  };

  // Discord config
  discord?: {
    guild_id: string;
  };

  // Webpage config
  webpage?: {
    url: string;
  };
}

export interface VectorIndex {
  id: string;
  source_id: string;
  index_name: string;
  dimension: number;
  created_at: Date;
}

export interface AuthRequest extends Request {
  user?: User;
}
