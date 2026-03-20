export interface Role {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserRoleAssignment {
  userId: string;
  roleId: string;
  roleName: string;
  assignedAt: string;
}
