import { UserRole } from '@prisma/client';

export enum AgreementAction {
  VIEW = 'view',
  CREATE = 'create',
  EDIT = 'edit',
  DELETE = 'delete',
  SIGN = 'sign',
  SEND_FOR_SIGNATURE = 'send_for_signature',
  APPROVE = 'approve',
  REJECT = 'reject',
  CANCEL = 'cancel',
}

export enum AgreementStatusValue {
  RASCUNHO = 'RASCUNHO',
  AGUARDANDO_ASSINATURA = 'AGUARDANDO_ASSINATURA',
  ASSINADO = 'ASSINADO',
  CONCLUIDO = 'CONCLUIDO',
  REJEITADO = 'REJEITADO',
  CANCELADO = 'CANCELADO',
}

export enum SignatureType {
  TENANT = 'tenant',
  OWNER = 'owner',
  AGENCY = 'agency',
  BROKER = 'broker',
  WITNESS = 'witness',
}

export enum AccessScope {
  ALL = 'all',
  AGENCY = 'agency',
  OWN_CREATED = 'own_created',
  PARTY_TO = 'party_to',
  NONE = 'none',
}

export interface RolePermissions {
  view: AccessScope;
  create: boolean;
  edit: boolean;
  delete: boolean;
  sign: boolean;
  signatureTypes: SignatureType[];
  approve: boolean;
  reject: boolean;
  cancel: boolean;
  sendForSignature: boolean;
  requiresCreci?: boolean;
}

export const AGREEMENT_PERMISSION_MATRIX: Record<UserRole, RolePermissions> = {
  [UserRole.CEO]: {
    view: AccessScope.ALL,
    create: false,
    edit: false,
    delete: false,
    sign: false,
    signatureTypes: [],
    approve: false,
    reject: false,
    cancel: false,
    sendForSignature: false,
  },

  [UserRole.ADMIN]: {
    view: AccessScope.ALL,
    create: false,
    edit: false,
    delete: false,
    sign: false,
    signatureTypes: [],
    approve: false,
    reject: false,
    cancel: false,
    sendForSignature: false,
  },

  [UserRole.PLATFORM_MANAGER]: {
    view: AccessScope.ALL,
    create: false,
    edit: false,
    delete: false,
    sign: false,
    signatureTypes: [],
    approve: false,
    reject: false,
    cancel: false,
    sendForSignature: false,
  },

  [UserRole.AGENCY_ADMIN]: {
    view: AccessScope.AGENCY,
    create: true,
    edit: true,
    delete: true,
    sign: true,
    signatureTypes: [SignatureType.AGENCY, SignatureType.OWNER],
    approve: true,
    reject: true,
    cancel: true,
    sendForSignature: true,
  },

  [UserRole.AGENCY_MANAGER]: {
    view: AccessScope.AGENCY,
    create: true,
    edit: true,
    delete: true,
    sign: true,
    signatureTypes: [SignatureType.AGENCY],
    approve: true,
    reject: true,
    cancel: true,
    sendForSignature: true,
  },

  [UserRole.BROKER]: {
    view: AccessScope.OWN_CREATED,
    create: true,
    edit: true,
    delete: true,
    sign: true,
    signatureTypes: [SignatureType.BROKER, SignatureType.WITNESS],
    approve: false,
    reject: false,
    cancel: true,
    sendForSignature: true,
    requiresCreci: true,
  },

  [UserRole.PROPRIETARIO]: {
    view: AccessScope.PARTY_TO,
    create: false,
    edit: false,
    delete: false,
    sign: true,
    signatureTypes: [SignatureType.OWNER],
    approve: false,
    reject: false,
    cancel: false,
    sendForSignature: false,
  },

  [UserRole.INDEPENDENT_OWNER]: {
    view: AccessScope.OWN_CREATED,
    create: true,
    edit: true,
    delete: true,
    sign: true,
    signatureTypes: [SignatureType.OWNER, SignatureType.AGENCY],
    approve: true,
    reject: true,
    cancel: true,
    sendForSignature: true,
  },

  [UserRole.INQUILINO]: {
    view: AccessScope.PARTY_TO,
    create: false,
    edit: false,
    delete: false,
    sign: true,
    signatureTypes: [SignatureType.TENANT],
    approve: false,
    reject: false,
    cancel: false,
    sendForSignature: false,
  },

  [UserRole.BUILDING_MANAGER]: {
    view: AccessScope.PARTY_TO,
    create: false,
    edit: false,
    delete: false,
    sign: true,
    signatureTypes: [],
    approve: false,
    reject: false,
    cancel: false,
    sendForSignature: false,
  },

  [UserRole.LEGAL_AUDITOR]: {
    view: AccessScope.ALL,
    create: false,
    edit: false,
    delete: false,
    sign: false,
    signatureTypes: [],
    approve: false,
    reject: false,
    cancel: false,
    sendForSignature: false,
  },

  [UserRole.REPRESENTATIVE]: {
    view: AccessScope.NONE,
    create: false,
    edit: false,
    delete: false,
    sign: false,
    signatureTypes: [],
    approve: false,
    reject: false,
    cancel: false,
    sendForSignature: false,
  },

  [UserRole.API_CLIENT]: {
    view: AccessScope.AGENCY,
    create: false,
    edit: false,
    delete: false,
    sign: false,
    signatureTypes: [],
    approve: false,
    reject: false,
    cancel: false,
    sendForSignature: false,
  },
};

export const EDITABLE_STATUSES = [
  AgreementStatusValue.RASCUNHO,
  AgreementStatusValue.AGUARDANDO_ASSINATURA,
];

export const DELETABLE_STATUSES = [
  AgreementStatusValue.RASCUNHO,
];

export const SIGNABLE_STATUSES = [
  AgreementStatusValue.RASCUNHO,
  AgreementStatusValue.AGUARDANDO_ASSINATURA,
];

export const SIGNED_STATUSES = [
  AgreementStatusValue.ASSINADO,
  AgreementStatusValue.CONCLUIDO,
];

export const IMMUTABLE_STATUSES = [
  AgreementStatusValue.CONCLUIDO,
  AgreementStatusValue.REJEITADO,
];

export const AUDIT_VIEW_ROLES = [
  UserRole.CEO,
  UserRole.ADMIN,
  UserRole.LEGAL_AUDITOR,
];

export const MR3X_ROLES: UserRole[] = [
  UserRole.CEO,
  UserRole.ADMIN,
  UserRole.PLATFORM_MANAGER,
  UserRole.LEGAL_AUDITOR,
  UserRole.REPRESENTATIVE,
];

export const AGENCY_OPERATIONAL_ROLES: UserRole[] = [
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_MANAGER,
  UserRole.BROKER,
];

export function isMR3XRole(role: UserRole): boolean {
  return MR3X_ROLES.includes(role);
}

export function isAgencyRole(role: UserRole): boolean {
  return AGENCY_OPERATIONAL_ROLES.includes(role);
}

export const DEFAULT_NO_ACCESS_PERMISSIONS: RolePermissions = {
  view: AccessScope.NONE,
  create: false,
  edit: false,
  delete: false,
  sign: false,
  signatureTypes: [],
  approve: false,
  reject: false,
  cancel: false,
  sendForSignature: false,
};

export function getPermissionsForRole(role: UserRole): RolePermissions {
  if (!role || !AGREEMENT_PERMISSION_MATRIX[role]) {
    return DEFAULT_NO_ACCESS_PERMISSIONS;
  }
  return AGREEMENT_PERMISSION_MATRIX[role];
}

export function isEditableStatus(status: string): boolean {
  return EDITABLE_STATUSES.includes(status as AgreementStatusValue);
}

export function isDeletableStatus(status: string): boolean {
  return DELETABLE_STATUSES.includes(status as AgreementStatusValue);
}

export function hasBeenSigned(agreement: any): boolean {
  return !!(
    agreement.tenantSignature ||
    agreement.ownerSignature ||
    agreement.agencySignature
  );
}

export function isImmutableStatus(status: string): boolean {
  return IMMUTABLE_STATUSES.includes(status as AgreementStatusValue);
}
