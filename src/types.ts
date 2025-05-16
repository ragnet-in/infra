import { Request } from "express";

export interface User {
  id: string;
  email: string;
  password: string; // Hashed
  created_at: Date;
}

export interface Repository {
  id: string;
  name: string;
  org_name: string;
  repo_name: string;
  user_id: string;
  created_at: Date;
}

export interface AuthRequest extends Request {
  user?: User;
}
