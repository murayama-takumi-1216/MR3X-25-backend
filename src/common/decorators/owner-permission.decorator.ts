import { SetMetadata } from '@nestjs/common';
import { OwnerAction } from '../constants/owner-permissions.constants';
import {
  OWNER_PERMISSION_KEY,
  OwnerPermissionMetadata,
} from '../guards/owner-permission.guard';

export const OwnerPermission = (module: string, action: OwnerAction) =>
  SetMetadata<string, OwnerPermissionMetadata>(OWNER_PERMISSION_KEY, {
    module,
    action,
  });
