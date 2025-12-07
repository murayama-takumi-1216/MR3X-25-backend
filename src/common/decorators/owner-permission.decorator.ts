import { SetMetadata } from '@nestjs/common';
import { OwnerAction } from '../constants/owner-permissions.constants';
import {
  OWNER_PERMISSION_KEY,
  OwnerPermissionMetadata,
} from '../guards/owner-permission.guard';

/**
 * Decorator to restrict owner actions on specific modules
 *
 * Usage:
 * @OwnerPermission('payments', OwnerAction.CREATE)
 * @Post()
 * createPayment() { ... }
 *
 * This will prevent PROPRIETARIO (agency-managed owner) from creating payments
 * while allowing INDEPENDENT_OWNER full access.
 */
export const OwnerPermission = (module: string, action: OwnerAction) =>
  SetMetadata<string, OwnerPermissionMetadata>(OWNER_PERMISSION_KEY, {
    module,
    action,
  });
