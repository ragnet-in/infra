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
  type: string;
  url: string;
  last_sync_at?: Date;
  created_at: Date;
}
export interface AuthRequest extends Request {
  user?: User;
}
