import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiForbiddenResponse } from '@nestjs/swagger';
import { AgreementAction, SignatureType } from '../constants/agreement-permissions.constants';

export const AGREEMENT_PERMISSION_KEY = 'agreement_permission';

export interface AgreementPermissionMetadata {
  action: AgreementAction;
  signatureType?: SignatureType;
  requiresAgreementId?: boolean;
}

export const AgreementPermission = (
  action: AgreementAction,
  signatureType?: SignatureType,
  requiresAgreementId?: boolean
) => {
  const actionsRequiringId = [
    AgreementAction.EDIT,
    AgreementAction.DELETE,
    AgreementAction.SIGN,
    AgreementAction.APPROVE,
    AgreementAction.REJECT,
    AgreementAction.CANCEL,
    AgreementAction.SEND_FOR_SIGNATURE,
  ];

  const metadata: AgreementPermissionMetadata = {
    action,
    signatureType,
    requiresAgreementId: requiresAgreementId !== undefined
      ? requiresAgreementId
      : actionsRequiringId.includes(action),
  };

  return applyDecorators(
    SetMetadata(AGREEMENT_PERMISSION_KEY, metadata),
    ApiForbiddenResponse({
      description: `Requires permission for action: ${action}${signatureType ? ` with signature type: ${signatureType}` : ''}`,
    }),
  );
};

export const CanViewAgreement = () => AgreementPermission(AgreementAction.VIEW, undefined, true);
export const CanCreateAgreement = () => AgreementPermission(AgreementAction.CREATE);
export const CanEditAgreement = () => AgreementPermission(AgreementAction.EDIT);
export const CanDeleteAgreement = () => AgreementPermission(AgreementAction.DELETE);
export const CanApproveAgreement = () => AgreementPermission(AgreementAction.APPROVE);
export const CanRejectAgreement = () => AgreementPermission(AgreementAction.REJECT);
export const CanCancelAgreement = () => AgreementPermission(AgreementAction.CANCEL);
export const CanSendForSignature = () => AgreementPermission(AgreementAction.SEND_FOR_SIGNATURE);

export const CanSignAsTenant = () => AgreementPermission(AgreementAction.SIGN, SignatureType.TENANT);
export const CanSignAsOwner = () => AgreementPermission(AgreementAction.SIGN, SignatureType.OWNER);
export const CanSignAsAgency = () => AgreementPermission(AgreementAction.SIGN, SignatureType.AGENCY);
export const CanSignAsBroker = () => AgreementPermission(AgreementAction.SIGN, SignatureType.BROKER);
export const CanSignAsWitness = () => AgreementPermission(AgreementAction.SIGN, SignatureType.WITNESS);
