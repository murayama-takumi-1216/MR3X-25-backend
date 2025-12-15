import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AGREEMENT_PERMISSION_KEY,
  AgreementPermissionMetadata,
} from '../decorators/agreement-permission.decorator';
import {
  AgreementPermissionService,
  UserContext,
} from '../services/agreement-permission.service';
import { AgreementAction, SignatureType } from '../constants/agreement-permissions.constants';

@Injectable()
export class AgreementPermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionService: AgreementPermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissionMeta = this.reflector.getAllAndOverride<AgreementPermissionMetadata>(
      AGREEMENT_PERMISSION_KEY,
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

    const userContext: UserContext = {
      sub: user.sub,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId?.toString(),
      brokerId: user.brokerId?.toString(),
      creci: user.creci,
      document: user.document,
    };

    console.log('[AgreementPermissionGuard] User context:', {
      sub: userContext.sub,
      email: userContext.email,
      role: userContext.role,
      agencyId: userContext.agencyId,
      action: permissionMeta.action,
    });

    const { action, requiresAgreementId } = permissionMeta;
    let { signatureType } = permissionMeta;

    if (action === AgreementAction.SIGN && !signatureType && request.body) {
      if (request.body.tenantSignature) {
        signatureType = SignatureType.TENANT;
      } else if (request.body.ownerSignature) {
        signatureType = SignatureType.OWNER;
      } else if (request.body.agencySignature) {
        signatureType = SignatureType.AGENCY;
      }
      console.log('[AgreementPermissionGuard] Derived signatureType from body:', signatureType);
    }

    if (requiresAgreementId) {
      const agreementId = request.params.id;

      if (!agreementId) {
        throw new ForbiddenException('Agreement ID is required for this action');
      }

      try {
        const agreement = await this.permissionService.validateAction(
          userContext,
          agreementId,
          action,
          signatureType,
        );

        request.agreement = agreement;
        request.userContext = userContext;

        return true;
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw error;
        }
        if (error instanceof ForbiddenException) {
          throw error;
        }
        throw new ForbiddenException('Permission check failed');
      }
    }

    const result = this.permissionService.canPerformAction(userContext, action);

    if (!result.allowed) {
      throw new ForbiddenException(result.reason || 'Action not allowed');
    }

    request.userContext = userContext;

    return true;
  }
}

import { createParamDecorator } from '@nestjs/common';

export const LoadedAgreement = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const agreement = request.agreement;

    return data ? agreement?.[data] : agreement;
  },
);

export const AgreementUserContext = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const userContext = request.userContext;

    return data ? userContext?.[data] : userContext;
  },
);
