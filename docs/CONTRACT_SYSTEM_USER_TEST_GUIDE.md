# Contract System - User Testing Guide (No Code)

This guide explains how to test the contract system through the frontend interface, organized by user role and page location.

---

## User Roles & Permissions

| Role | Can Create | Can Edit | Can Sign | Can Delete | Can View All |
|------|-----------|----------|----------|------------|--------------|
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ All contracts |
| **Agency** | ✅ | ✅ Own agency | ✅ | ✅ Own agency | ✅ Agency contracts |
| **Owner** | ❌ | ❌ | ✅ As owner | ❌ | ✅ Own contracts |
| **Tenant** | ❌ | ❌ | ✅ As tenant | ❌ | ✅ Own contract |
| **Broker** | ✅ | ✅ Created by self | ❌ | ✅ Created by self | ✅ Own created |

---

## Test Scenario 1: Template Selection

### Who: Admin or Agency user
### Where: Contracts → New Contract page

**Steps:**
1. Login as Admin or Agency user
2. Go to sidebar → **Contratos** → **Novo Contrato**
3. You should see a dropdown or list of contract templates:
   - "Locação Residencial - CPF x CPF"
   - "Locação Residencial - CPF x CNPJ"
   - "Locação Residencial - CNPJ x CPF"
   - "Locação Comercial - CNPJ x CNPJ"
   - etc.

**What to verify:**
- [ ] All templates are listed
- [ ] Clicking a template shows preview with `[VARIABLE]` placeholders
- [ ] Variables like `[NOME_LOCADOR]`, `[CPF_LOCATARIO]` are visible in preview

---

## Test Scenario 2: Contract Creation with Validation

### Who: Admin or Agency user
### Where: Contracts → New Contract page

**Steps:**
1. Login as Admin or Agency user
2. Go to **Contratos** → **Novo Contrato**
3. Select a template
4. Fill in the form:
   - **Property**: Select a property from dropdown
   - **Tenant**: Select a tenant from dropdown
   - **Owner**: Select an owner from dropdown (or auto-filled from property)
   - **Start Date**: Pick a date
   - **End Date**: Pick a date (must be after start date)
   - **Monthly Rent**: Enter value (e.g., R$ 2.000,00)
   - **Due Day**: Enter 1-31 (e.g., 10)
   - **Deposit**: Enter value (optional)

5. **Leave some fields empty intentionally** to test validation

**What to verify:**
- [ ] Form shows required field indicators (*)
- [ ] Validation errors appear for missing required fields
- [ ] Error messages are in Portuguese
- [ ] Contract cannot be saved without required fields

---

## Test Scenario 3: Contract Validation Before Signing

### Who: Admin or Agency user
### Where: Contract Details page

**Steps:**
1. Login as Admin or Agency user
2. Go to **Contratos** → Click on a contract with status "PENDENTE"
3. Look for a **"Validar Contrato"** or **"Verificar"** button
4. Click it to see validation results

**What to verify:**
- [ ] Shows validation score (e.g., "85% completo")
- [ ] Lists missing required fields with icons
- [ ] Shows warnings for legal limits:
  - "Multa superior a 10% pode ser abusiva"
  - "Juros acima de 1% ao mês"
  - "Caução acima de 3 meses de aluguel"
- [ ] Shows which index is selected (IGPM, IPCA, etc.)

---

## Test Scenario 4: Edit Contract (PENDENTE Status)

### Who: Admin or Agency user (or creator)
### Where: Contract Details page

**Steps:**
1. Login as Admin or Agency user
2. Go to **Contratos** → Click on a contract with status **"PENDENTE"**
3. Click **"Editar"** button
4. Try to change:
   - Monthly rent value
   - Due day
   - Start/End dates
   - Description/clauses
5. Save changes

**What to verify:**
- [ ] All fields are editable
- [ ] Save button works
- [ ] Changes are reflected after saving
- [ ] "Última atualização" timestamp changes

---

## Test Scenario 5: Prepare Contract for Signing

### Who: Admin or Agency user
### Where: Contract Details page

**Steps:**
1. Login as Admin or Agency user
2. Go to **Contratos** → Click on a contract with status **"PENDENTE"**
3. Ensure all required fields are filled
4. Click **"Preparar para Assinatura"** button
5. Confirm the action

**What to verify:**
- [ ] If validation fails, shows error with missing fields
- [ ] If validation passes, status changes to **"AGUARDANDO ASSINATURAS"**
- [ ] A contract token is generated (e.g., "MR3X-CTR-2025-ABCD-EFGH")
- [ ] A provisional PDF is generated
- [ ] "Edit" button is now disabled or hidden

---

## Test Scenario 6: Blocked Editing After Preparation

### Who: Admin or Agency user
### Where: Contract Details page

**Steps:**
1. Login as Admin or Agency user
2. Go to **Contratos** → Click on a contract with status **"AGUARDANDO ASSINATURAS"**
3. Try to click "Editar" button (if visible)
4. Or check if edit fields are disabled

**What to verify:**
- [ ] Cannot edit contract clauses
- [ ] Cannot change monthly rent
- [ ] Cannot change dates
- [ ] Shows message: "Contrato congelado para assinatura"
- [ ] Only signature-related actions are available

---

## Test Scenario 7: Download Provisional PDF

### Who: Any user with access to the contract
### Where: Contract Details page

**Steps:**
1. Login and go to a contract with status **"AGUARDANDO ASSINATURAS"**
2. Look for **"Baixar PDF"** or **"Ver Minuta"** button
3. Click to download

**What to verify in the PDF:**
- [ ] **Watermark**: "AGUARDANDO ASSINATURAS" appears diagonally
- [ ] **QR Code**: Appears in bottom-right corner
- [ ] **Barcode**: Appears on the side of the document
- [ ] **Token**: Visible in header (MR3X-CTR-2025-XXXX-XXXX)
- [ ] **Verification URL**: Visible in footer
- [ ] **Variables replaced**: Shows actual names, CPFs, values (not [NOME_LOCADOR])

---

## Test Scenario 8: Send Signature Invitation

### Who: Admin or Agency user
### Where: Contract Details page

**Steps:**
1. Login as Admin or Agency user
2. Go to a contract with status **"AGUARDANDO ASSINATURAS"**
3. Look for **"Enviar Convite"** or **"Convidar para Assinar"**
4. Select party: Tenant, Owner, or Witness
5. Enter email address
6. Click send

**What to verify:**
- [ ] Email is sent to the specified address
- [ ] Link in email contains unique token
- [ ] Link expires after set period (usually 7 days)
- [ ] Can send to multiple parties

---

## Test Scenario 9: Sign as Tenant

### Who: Tenant user
### Where: My Contract page OR Email link

**Option A - Through Dashboard:**
1. Login as Tenant
2. Go to **"Meu Contrato"** or **"Minha Locação"**
3. Click on pending contract
4. Click **"Assinar Contrato"**

**Option B - Through Email Link:**
1. Open email with signature invitation
2. Click the signature link
3. View contract details

**Signing Process:**
1. Review contract terms
2. Scroll to signature area
3. **Allow location access** (browser will ask for permission)
4. Draw signature on canvas or type name
5. Check the consent checkbox
6. Click **"Assinar"**

**What to verify:**
- [ ] Must allow geolocation (cannot proceed without)
- [ ] Shows consent checkbox for location sharing
- [ ] Signature is captured
- [ ] Shows confirmation message
- [ ] Status updates (if only tenant signed, shows "Aguardando proprietário")

---

## Test Scenario 10: Sign as Owner

### Who: Owner user
### Where: My Properties → Contract OR Email link

**Steps:**
1. Login as Owner
2. Go to **"Meus Imóveis"** → Select property → **"Contrato"**
3. Or click signature link from email
4. Click **"Assinar como Proprietário"**
5. Allow location access
6. Draw signature
7. Confirm

**What to verify:**
- [ ] Can only sign as owner (not as tenant)
- [ ] Geolocation is required
- [ ] After both sign, status changes to **"ASSINADO"**

---

## Test Scenario 11: View Signed Contract (Immutable)

### Who: Any user with access
### Where: Contract Details page

**Steps:**
1. Login and go to a contract with status **"ASSINADO"** or **"ATIVO"**
2. Try to find edit button
3. Check the interface

**What to verify:**
- [ ] **No edit button** visible
- [ ] All fields are read-only
- [ ] Shows message: "Contrato assinado - documento imutável"
- [ ] Shows all signature details:
  - Date/time of each signature
  - IP address (partially hidden)
  - Location (city/region)
- [ ] **"Baixar PDF Final"** button is available

---

## Test Scenario 12: Download Final Signed PDF

### Who: Any user with access
### Where: Contract Details page

**Steps:**
1. Login and go to a contract with status **"ASSINADO"**
2. Click **"Baixar PDF Final"**
3. Open the downloaded PDF

**What to verify in the PDF:**
- [ ] **No watermark** (clean document)
- [ ] **All signatures visible** with images
- [ ] **Signature metadata** for each party:
  - Date and time
  - IP address
  - Geolocation coordinates
- [ ] **QR Code** for verification
- [ ] **SHA-256 Hash** in footer
- [ ] **Verification URL** in footer

---

## Test Scenario 13: Public Contract Verification

### Who: Anyone (no login required)
### Where: Verification page (public)

**Steps:**
1. Open the verification URL from the PDF
   - Example: `https://app.mr3x.com.br/verify/MR3X-CTR-2025-ABCD-EFGH`
2. Or go to website → **"Verificar Documento"** → Enter token

**What to verify:**
- [ ] Works without login
- [ ] Shows contract status (Assinado, Ativo, etc.)
- [ ] Shows signature information (anonymized)
- [ ] Shows property location (city/neighborhood only)
- [ ] Does NOT show sensitive data (full names, CPFs)
- [ ] Shows verification timestamp

---

## Test Scenario 14: PDF Hash Verification

### Who: Anyone (no login required)
### Where: Verification page

**Steps:**
1. Go to verification page
2. Look for **"Verificar Arquivo PDF"** option
3. Upload the PDF file you downloaded
4. Wait for verification

**Test Case A - Original PDF:**
- [ ] Shows: "✓ Documento autêntico"
- [ ] Hash matches stored hash

**Test Case B - Modified PDF:**
1. Open PDF in editor
2. Make any small change (even add a space)
3. Save and upload
- [ ] Shows: "✗ ALERTA: Documento foi modificado"
- [ ] Hash does NOT match

---

## Test Scenario 15: Create Contract Amendment

### Who: Admin or Agency user
### Where: Contract Details page (signed contract)

**Steps:**
1. Login as Admin or Agency
2. Go to a contract with status **"ASSINADO"** or **"ATIVO"**
3. Look for **"Criar Aditivo"** or **"Alterar Contrato"** button
4. Click it
5. Enter the changes:
   - New monthly rent
   - New end date
   - etc.
6. Save

**What to verify:**
- [ ] Original contract remains unchanged
- [ ] New contract is created with:
  - New token ending in "-AMD1" (first amendment)
  - Status "PENDENTE"
  - Reference to original contract
- [ ] New contract needs new signatures
- [ ] Audit shows "Amendment created from contract #X"

---

## Test Scenario 16: Delete Contract

### Who: Admin or creator
### Where: Contract Details page

**Test Case A - Delete PENDENTE contract:**
1. Go to contract with status "PENDENTE"
2. Click "Excluir" button
3. Confirm deletion
- [ ] Contract is deleted (soft delete)
- [ ] No longer appears in list

**Test Case B - Delete ASSINADO contract:**
1. Go to contract with status "ASSINADO"
2. Click "Excluir" button
3. Confirm deletion
- [ ] Contract is marked as deleted
- [ ] Audit trail preserved
- [ ] Original PDF still accessible for legal purposes

**Test Case C - Delete ENCERRADO/REVOGADO contract:**
1. Go to archived contract
2. Try to delete
- [ ] Should be blocked
- [ ] Shows: "Contratos arquivados não podem ser excluídos"

---

## Test Scenario 17: Revoke Contract

### Who: Admin or Agency user
### Where: Contract Details page

**Steps:**
1. Login as Admin or Agency
2. Go to contract with status "AGUARDANDO ASSINATURAS" or "ASSINADO"
3. Click **"Revogar Contrato"**
4. Enter reason for revocation
5. Confirm

**What to verify:**
- [ ] Status changes to **"REVOGADO"**
- [ ] All pending signature links are invalidated
- [ ] Cannot be edited or signed anymore
- [ ] Audit shows revocation reason
- [ ] Users receive notification (if enabled)

---

## Test Scenario 18: View Audit Trail

### Who: Admin or Agency user
### Where: Contract Details page → Audit/History tab

**Steps:**
1. Login as Admin or Agency
2. Go to any contract
3. Click **"Histórico"** or **"Auditoria"** tab

**What to verify:**
- [ ] Shows all actions in chronological order
- [ ] Each entry shows:
  - Action type (Created, Updated, Signed, etc.)
  - Who performed it
  - When (date/time)
  - Details (what changed)
- [ ] Shows blocked modification attempts
- [ ] Shows IP addresses for signatures

---

## Summary: Contract Status Flow

```
PENDENTE (Draft)
    ↓ [Prepare for Signing]
AGUARDANDO ASSINATURAS (Frozen)
    ↓ [All parties sign]
ASSINADO (Signed)
    ↓ [Activate]
ATIVO (Active)
    ↓ [End date reached or manual close]
ENCERRADO (Ended)

At any point before ENCERRADO:
    → REVOGADO (Revoked) - Terminal state
```

---

## Quick Reference: What Each Status Allows

| Action | PENDENTE | AGUARDANDO | ASSINADO | ATIVO | REVOGADO | ENCERRADO |
|--------|----------|------------|----------|-------|----------|-----------|
| Edit clauses | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edit values | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Add signature | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete | ✅ | ✅* | ✅ | ✅ | ❌ | ❌ |
| Revoke | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Download PDF | ✅ Provisional | ✅ Provisional | ✅ Final | ✅ Final | ✅ Final | ✅ Final |
| Create amendment | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |

*Can delete if no signatures collected yet

---

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Campos obrigatórios não preenchidos" | Missing required fields | Fill all required fields |
| "Contrato deve estar PENDENTE" | Trying to prepare already prepared contract | Check contract status |
| "Geolocalização é obrigatória" | Browser blocked location | Allow location access |
| "Contrato já assinado" | Trying to sign twice | Already signed, no action needed |
| "Documento imutável" | Trying to edit signed contract | Create amendment instead |
| "Link expirado" | Signature link expired | Request new invitation |

---

## Browser Requirements for Signing

- **Location Services**: Must be enabled
- **JavaScript**: Must be enabled
- **Canvas Support**: For signature drawing
- **Supported Browsers**: Chrome, Firefox, Safari, Edge (latest versions)

---

## Contact for Issues

If you encounter any issues during testing:
1. Check the audit trail for error details
2. Verify user role permissions
3. Check contract status
4. Clear browser cache and try again
