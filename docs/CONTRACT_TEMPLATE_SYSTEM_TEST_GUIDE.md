# Contract Template System - Test Guide

**Version:** 1.0
**Date:** December 2025
**Author:** Claude Code

This guide provides comprehensive testing instructions for the Contract Template System implementation, covering all 4 logical steps:

1. Template Variable Processor
2. Contract Validation
3. QR Code/Barcode Verification
4. Contract Immutability

---

## Prerequisites

### 1. Start the Backend Server
```bash
cd backend
npm run start:dev
```

### 2. Get Authentication Token
```bash
# Login to get JWT token
curl -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "your_password"}'
```

Save the `access_token` for subsequent requests:
```bash
export TOKEN="your_jwt_token_here"
```

### 3. Database Setup
Ensure you have:
- At least 1 property
- At least 1 tenant user
- At least 1 owner user
- Optionally 1 agency

---

## Step 1: Template Variable Processor Testing

### 1.1 Get All Contract Templates
```bash
curl -X GET http://localhost:8081/contract-templates \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
[
  {
    "id": "residential-pf-pf",
    "name": "Locação Residencial - CPF x CPF",
    "description": "Contrato entre pessoas físicas para imóvel residencial",
    "type": "CTR",
    "content": "**CONTRATO DE LOCAÇÃO RESIDENCIAL...[NOME_LOCADOR]...[CPF_LOCATARIO]..."
  },
  ...
]
```

### 1.2 Get Template by ID
```bash
curl -X GET http://localhost:8081/contract-templates/residential-pf-pf \
  -H "Authorization: Bearer $TOKEN"
```

### 1.3 Get Templates by Type
```bash
# Get rental contracts (CTR)
curl -X GET http://localhost:8081/contract-templates/type/CTR \
  -H "Authorization: Bearer $TOKEN"

# Get agreements (ACD)
curl -X GET http://localhost:8081/contract-templates/type/ACD \
  -H "Authorization: Bearer $TOKEN"

# Get inspections (VST)
curl -X GET http://localhost:8081/contract-templates/type/VST \
  -H "Authorization: Bearer $TOKEN"
```

### 1.4 Test Variable Extraction (Manual Test)

Check that templates contain the expected variables:
- `[NOME_LOCADOR]` - Owner name
- `[CPF_LOCADOR]` - Owner CPF
- `[NOME_LOCATARIO]` - Tenant name
- `[CPF_LOCATARIO]` - Tenant CPF
- `[ENDERECO_IMOVEL]` - Property address
- `[VALOR_ALUGUEL]` - Monthly rent
- `[DATA_INICIO]` - Start date
- `[DATA_FIM]` - End date
- `[INDICE_REAJUSTE]` - Readjustment index (IGPM, IPCA, etc.)
- `[COMARCA]` - Jurisdiction/Forum

---

## Step 2: Contract Validation Testing

### 2.1 Create a Contract with Missing Required Fields
```bash
curl -X POST http://localhost:8081/contracts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "1",
    "tenantId": "2",
    "startDate": "2025-01-01",
    "endDate": "2026-01-01",
    "monthlyRent": 1500.00,
    "status": "PENDENTE"
  }'
```

Save the contract ID:
```bash
export CONTRACT_ID="returned_contract_id"
```

### 2.2 Validate Contract Before Signing
```bash
curl -X GET http://localhost:8081/contracts/$CONTRACT_ID/validate \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (with missing fields):**
```json
{
  "valid": false,
  "errors": [
    {
      "field": "dueDay",
      "label": "Dia de Vencimento",
      "message": "Campo obrigatório não preenchido: Dia de Vencimento",
      "category": "financial"
    },
    {
      "field": "ownerId",
      "label": "Locador",
      "message": "Campo obrigatório não preenchido: Locador",
      "category": "parties"
    }
  ],
  "warnings": [
    {
      "field": "tenantDocument",
      "label": "Documento do Locatário",
      "message": "Locatário sem CPF/CNPJ cadastrado",
      "recommendation": "O CPF/CNPJ é essencial para validade jurídica do contrato"
    }
  ],
  "checkedFields": 11,
  "passedFields": 9,
  "score": 82
}
```

### 2.3 Update Contract with All Required Fields
```bash
curl -X PUT http://localhost:8081/contracts/$CONTRACT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ownerId": "3",
    "dueDay": 10,
    "readjustmentIndex": "IGPM",
    "lateFeePercent": 10,
    "interestRatePercent": 1,
    "earlyTerminationPenaltyPercent": 3,
    "deposit": 3000.00
  }'
```

### 2.4 Validate Again (Should Pass)
```bash
curl -X GET http://localhost:8081/contracts/$CONTRACT_ID/validate \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "valid": true,
  "errors": [],
  "warnings": [],
  "checkedFields": 11,
  "passedFields": 11,
  "score": 100
}
```

### 2.5 Test Validation Warnings

#### Late Fee > 10%
```bash
curl -X PUT http://localhost:8081/contracts/$CONTRACT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"lateFeePercent": 15}'
```

**Expected Warning:**
```json
{
  "warnings": [
    {
      "field": "lateFeePercent",
      "label": "Multa por Atraso",
      "message": "Multa superior a 10% pode ser considerada abusiva",
      "recommendation": "Art. 413 CC - A penalidade deve ser reduzida equitativamente pelo juiz"
    }
  ]
}
```

#### Interest Rate > 1%
```bash
curl -X PUT http://localhost:8081/contracts/$CONTRACT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"interestRatePercent": 2}'
```

**Expected Warning:**
```json
{
  "warnings": [
    {
      "field": "interestRatePercent",
      "message": "Juros superiores a 1% ao mês podem ser considerados usura"
    }
  ]
}
```

---

## Step 3: QR Code/Barcode & Verification Testing

### 3.1 Prepare Contract for Signing (Generates Token)
```bash
curl -X POST http://localhost:8081/contracts/$CONTRACT_ID/prepare-signing \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "message": "Contrato preparado para assinatura",
  "contractToken": "MR3X-CTR-2025-ABCD-EFGH",
  "provisionalPdfSize": 123456
}
```

Save the token:
```bash
export CONTRACT_TOKEN="MR3X-CTR-2025-ABCD-EFGH"
```

### 3.2 Download Provisional PDF (with QR Code & Barcode)
```bash
curl -X GET http://localhost:8081/contracts/$CONTRACT_ID/pdf/provisional \
  -H "Authorization: Bearer $TOKEN" \
  --output contract_provisional.pdf
```

**Verify in PDF:**
- QR Code in bottom-right corner
- Barcode on the side
- "AGUARDANDO ASSINATURAS" watermark
- Contract token in header
- Verification URL in footer

### 3.3 Public Verification by Token (No Auth Required)
```bash
curl -X GET http://localhost:8081/contracts/verify/$CONTRACT_TOKEN
```

**Expected Response:**
```json
{
  "valid": false,
  "message": "⏳ Contrato aguardando assinaturas",
  "details": {
    "tokenValid": true,
    "hashValid": false,
    "signaturesValid": false,
    "contractActive": false
  },
  "contract": {
    "token": "MR3X-CTR-2025-ABCD-EFGH",
    "hash": null,
    "status": "AGUARDANDO_ASSINATURAS",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "verificationUrl": "http://localhost:5173/verify/MR3X-CTR-2025-ABCD-EFGH",
    "signatures": {
      "tenant": null,
      "owner": null,
      "agency": null,
      "witness": null
    }
  }
}
```

### 3.4 Verify Invalid Token
```bash
curl -X GET http://localhost:8081/contracts/verify/INVALID-TOKEN-123
```

**Expected Response:**
```json
{
  "valid": false,
  "message": "Contrato não encontrado",
  "details": {
    "tokenValid": false,
    "hashValid": false,
    "signaturesValid": false,
    "contractActive": false
  }
}
```

---

## Step 4: Contract Immutability Testing

### 4.1 Check Immutability Status (PENDENTE)
```bash
# First, create a new contract in PENDENTE status
curl -X POST http://localhost:8081/contracts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "1",
    "tenantId": "2",
    "ownerId": "3",
    "startDate": "2025-01-01",
    "endDate": "2026-01-01",
    "monthlyRent": 2000.00,
    "dueDay": 5,
    "status": "PENDENTE"
  }'

export NEW_CONTRACT_ID="returned_id"

# Check immutability
curl -X GET http://localhost:8081/contracts/$NEW_CONTRACT_ID/immutability \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "canEdit": true,
  "canDelete": true,
  "canAddSignature": false,
  "canRevoke": true,
  "canFinalize": false,
  "reason": "Contrato em modo rascunho - todas as edições permitidas",
  "currentStatus": "PENDENTE"
}
```

### 4.2 Test Full Editing in PENDENTE Status
```bash
# All fields should be editable
curl -X PUT http://localhost:8081/contracts/$NEW_CONTRACT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "monthlyRent": 2500.00,
    "dueDay": 10,
    "description": "Updated description"
  }'
```

**Expected:** Success (200 OK)

### 4.3 Prepare for Signing (Freezes Contract)
```bash
curl -X POST http://localhost:8081/contracts/$NEW_CONTRACT_ID/prepare-signing \
  -H "Authorization: Bearer $TOKEN"
```

### 4.4 Check Immutability Status (AGUARDANDO_ASSINATURAS)
```bash
curl -X GET http://localhost:8081/contracts/$NEW_CONTRACT_ID/immutability \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "canEdit": false,
  "canDelete": true,
  "canAddSignature": true,
  "canRevoke": true,
  "canFinalize": false,
  "reason": "Aguardando coleta de assinaturas - cláusulas congeladas",
  "currentStatus": "AGUARDANDO_ASSINATURAS"
}
```

### 4.5 Test Blocked Edit After Freezing
```bash
curl -X PUT http://localhost:8081/contracts/$NEW_CONTRACT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"monthlyRent": 3000.00}'
```

**Expected Response (403 Forbidden):**
```json
{
  "statusCode": 403,
  "message": "Os seguintes campos não podem ser modificados no status \"AGUARDANDO_ASSINATURAS\": monthlyRent"
}
```

### 4.6 Sign Contract as Tenant (with Geolocation)
```bash
curl -X POST http://localhost:8081/contracts/$NEW_CONTRACT_ID/sign-geo \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "signatureType": "tenant",
    "signatureData": {
      "signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "clientIP": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "geoLat": -23.5505,
      "geoLng": -46.6333,
      "geoConsent": true
    }
  }'
```

### 4.7 Sign Contract as Owner
```bash
curl -X POST http://localhost:8081/contracts/$NEW_CONTRACT_ID/sign-geo \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "signatureType": "owner",
    "signatureData": {
      "signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "clientIP": "192.168.1.101",
      "userAgent": "Mozilla/5.0...",
      "geoLat": -23.5489,
      "geoLng": -46.6388,
      "geoConsent": true
    }
  }'
```

### 4.8 Check Immutability After Full Signing (ASSINADO)
```bash
curl -X GET http://localhost:8081/contracts/$NEW_CONTRACT_ID/immutability \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "canEdit": false,
  "canDelete": true,
  "canAddSignature": false,
  "canRevoke": true,
  "canFinalize": false,
  "reason": "Contrato assinado - documento imutável. Apenas exclusão ou revogação permitida.",
  "currentStatus": "ASSINADO"
}
```

### 4.9 Test Blocked Edit After Signing
```bash
curl -X PUT http://localhost:8081/contracts/$NEW_CONTRACT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"monthlyRent": 5000.00}'
```

**Expected Response (403 Forbidden):**
```json
{
  "statusCode": 403,
  "message": "Contrato assinado com hash final é imutável. Campos bloqueados: monthlyRent"
}
```

### 4.10 Create Amended Contract (When Original is Immutable)
```bash
curl -X POST http://localhost:8081/contracts/$NEW_CONTRACT_ID/amend \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "monthlyRent": 2750.00,
    "readjustmentIndex": "IPCA"
  }'
```

**Expected Response:**
```json
{
  "newContractId": "123",
  "message": "Aditivo contratual criado com sucesso. Novo token: MR3X-CTR-2025-WXYZ-AMD1"
}
```

### 4.11 Verify Final PDF with Hash
```bash
curl -X GET http://localhost:8081/contracts/$NEW_CONTRACT_ID/pdf/final \
  -H "Authorization: Bearer $TOKEN" \
  --output contract_final.pdf
```

**Verify in PDF:**
- No watermark
- All signatures displayed with metadata
- SHA-256 hash in footer
- IP addresses and geolocation for each signature

### 4.12 Verify PDF by Uploading
```bash
curl -X POST http://localhost:8081/contracts/verify-pdf/$CONTRACT_TOKEN \
  -H "Content-Type: multipart/form-data" \
  -F "file=@contract_final.pdf"
```

**Expected Response (Valid):**
```json
{
  "valid": true,
  "computedHash": "abc123...",
  "storedHash": "abc123...",
  "message": "✓ Documento autêntico - O hash corresponde ao original"
}
```

**Expected Response (Modified PDF):**
```json
{
  "valid": false,
  "computedHash": "xyz789...",
  "storedHash": "abc123...",
  "message": "✗ ALERTA: Documento foi modificado - O hash não corresponde ao original"
}
```

---

## Audit Trail Testing

### View Contract Audit Log
```bash
curl -X GET http://localhost:8081/contracts/$NEW_CONTRACT_ID/audit \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
[
  {
    "id": "1",
    "action": "PREPARE_FOR_SIGNING",
    "performedBy": { "id": "1", "name": "Admin" },
    "performedAt": "2025-01-01T10:00:00.000Z",
    "details": { "contractToken": "MR3X-CTR-2025-ABCD-EFGH" }
  },
  {
    "id": "2",
    "action": "SIGNATURE_CAPTURED_TENANT",
    "performedBy": { "id": "2", "name": "Tenant Name" },
    "performedAt": "2025-01-01T11:00:00.000Z",
    "details": { "geoLat": -23.5505, "geoLng": -46.6333, "clientIP": "192.168.1.100" }
  },
  {
    "id": "3",
    "action": "SIGNATURE_CAPTURED_OWNER",
    "performedBy": { "id": "3", "name": "Owner Name" },
    "performedAt": "2025-01-01T12:00:00.000Z",
    "details": { "geoLat": -23.5489, "geoLng": -46.6388, "clientIP": "192.168.1.101" }
  },
  {
    "id": "4",
    "action": "CONTRACT_FINALIZED",
    "performedAt": "2025-01-01T12:00:01.000Z",
    "details": { "finalPdfSize": 234567 }
  }
]
```

---

## Error Cases to Test

### 1. Invalid Template Type
```bash
curl -X GET http://localhost:8081/contract-templates/type/INVALID \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** 400 Bad Request

### 2. Prepare Signing Without Required Fields
```bash
# Create contract without dueDay
curl -X POST http://localhost:8081/contracts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"propertyId": "1", "tenantId": "2", "startDate": "2025-01-01", "endDate": "2026-01-01", "monthlyRent": 1000, "status": "PENDENTE"}'

# Try to prepare for signing
curl -X POST http://localhost:8081/contracts/{id}/prepare-signing \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** 400 Bad Request with validation errors

### 3. Sign Without Geolocation Consent
```bash
curl -X POST http://localhost:8081/contracts/$CONTRACT_ID/sign-geo \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "signatureType": "tenant",
    "signatureData": {
      "signature": "base64...",
      "geoConsent": false
    }
  }'
```
**Expected:** 400 Bad Request - "É necessário consentir com o compartilhamento de localização"

### 4. Delete Revoked/Ended Contract
```bash
# Revoke a contract first
curl -X POST http://localhost:8081/contracts/$CONTRACT_ID/revoke \
  -H "Authorization: Bearer $TOKEN"

# Try to delete
curl -X DELETE http://localhost:8081/contracts/$CONTRACT_ID \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** 403 Forbidden - "Contrato revogado - documento arquivado e imutável"

---

## Quick Test Checklist

- [ ] Templates load correctly with variable placeholders
- [ ] Contract validation catches missing required fields
- [ ] Contract validation returns warnings for legal limits
- [ ] QR Code and Barcode appear in provisional PDF
- [ ] Token verification works without authentication
- [ ] Contract in PENDENTE status allows full editing
- [ ] Contract in AGUARDANDO_ASSINATURAS blocks clause editing
- [ ] Contract in ASSINADO is completely immutable
- [ ] Amended contracts get new token (ending in -AMD1, -AMD2, etc.)
- [ ] PDF hash verification correctly identifies modified documents
- [ ] Audit trail captures all actions with timestamps

---

## Useful Database Queries

### Check Contract Status
```sql
SELECT id, contract_token, status, hash_final,
       tenant_signature IS NOT NULL as has_tenant_sig,
       owner_signature IS NOT NULL as has_owner_sig
FROM contracts
WHERE id = ?;
```

### View Audit Trail
```sql
SELECT ca.*, u.name as performed_by_name
FROM contract_audit ca
JOIN users u ON u.id = ca.performed_by
WHERE ca.contract_id = ?
ORDER BY ca.performed_at DESC;
```

### Check Blocked Modifications
```sql
SELECT * FROM contract_audit
WHERE contract_id = ? AND action = 'MODIFICATION_BLOCKED';
```
