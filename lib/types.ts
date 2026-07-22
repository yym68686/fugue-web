export interface User {
  email: string;
  name: string;
  picture_url: string | null;
  provider: string;
  provider_id: string;
  verified: boolean;
  is_admin: boolean;
  status: string;
  last_login_at: Date | null;
  session_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface Workspace {
  user_email: string;
  tenant_id: string;
  tenant_name: string;
  default_project_id: string | null;
  default_project_name: string | null;
  first_app_id: string | null;
  admin_key_id: string;
  admin_key_label: string;
  admin_key_prefix: string | null;
  admin_key_scopes: string[];
  admin_key_secret_sealed: string;
  created_at: Date;
  updated_at: Date;
}

export interface ApiKey {
  fugue_key_id: string;
  user_email: string;
  tenant_id: string;
  label: string;
  prefix: string | null;
  scopes: string[];
  secret_sealed: string | null;
  status: 'active' | 'disabled' | 'deleted';
  source: 'workspace-admin' | 'managed' | 'external';
  is_workspace_admin: boolean;
  last_used_at: Date | null;
  disabled_at: Date | null;
  deleted_at: Date | null;
  last_synced_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface BillingTopup {
  request_id: string;
  provider: string;
  user_email: string;
  tenant_id: string;
  product_id: string | null;
  units: number;
  amount_cents: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  checkout_id: string | null;
  order_id: string | null;
  currency: string | null;
  payer_email: string | null;
  completed_at: Date | null;
  failed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface NodeKey {
  fugue_node_key_id: string;
  user_email: string;
  tenant_id: string;
  label: string;
  prefix: string | null;
  status: 'active' | 'revoked';
  source: 'managed' | 'external';
  last_used_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface AdminUser {
  email: string;
  name: string | null;
  picture_url: string | null;
  provider: string;
  verified: boolean;
  is_admin: boolean;
  status: string;
  last_login_at: Date | null;
  created_at: Date;
}

export interface AuditEvent {
  id: string;
  action: string;
  actor_email: string | null;
  target_email: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface ClusterNode {
  name: string;
  region: string;
  role: string;
  cpu: number;
  mem: number;
  status: string;
}

export interface PlatformOverview {
  totals: {
    users: number;
    workspaces: number;
    apiKeys: number;
    nodeKeys: number;
    activeNodes: number;
  };
  revenue: {
    last30dCents: number;
    allTimeCents: number;
    currency: string;
  };
  activity: {
    deploysLast24h: number;
    activeUsersLast7d: number;
  };
}
