import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import {
  OwnerAction,
  canOwnerPerformAction,
  isAgencyManagedOwner,
} from '../constants/owner-permissions.constants';

export const OWNER_PERMISSION_KEY = 'owner_permission';

export interface OwnerPermissionMetadata {
  module: string;
  action: OwnerAction;
}

@Injectable()
export class OwnerPermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permissionMeta = this.reflector.getAllAndOverride<OwnerPermissionMetadata>(
      OWNER_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!permissionMeta) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const userRole = user.role as UserRole;

    if (!isAgencyManagedOwner(userRole) && userRole !== UserRole.INDEPENDENT_OWNER) {
      return true;
    }

    const { module, action } = permissionMeta;
    const result = canOwnerPerformAction(userRole, module, action);

    if (!result.allowed) {
      throw new ForbiddenException(
        result.message || `Proprietário não pode realizar esta ação`,
      );
    }

    return true;
  }
}
