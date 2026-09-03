export interface User {
  id: string;
  email: string;
  username: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  parent_id: string | null;
  is_archived: boolean;
  position: number;
  created_at?: string;
  updated_at?: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  weight: string;
  position: number;
  is_done: boolean;
  done_at: string | null;
  due_date: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Label {
  id: string;
  project_id: string;
  title: string;
  color: string;
  created_at?: string;
}

export interface Attachment {
  name: string;
  size: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}
