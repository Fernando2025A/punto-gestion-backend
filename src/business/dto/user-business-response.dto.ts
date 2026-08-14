import { EmployeeRole, Permission } from 'generated/prisma/enums';

export interface UserBusinessAccessDto {
  businessId: number;
  businessName: string;
  businessDescription?: string | null;
  isOwner: boolean;
  role: EmployeeRole;
  isActive: boolean;
  permissions: Permission[];
}
