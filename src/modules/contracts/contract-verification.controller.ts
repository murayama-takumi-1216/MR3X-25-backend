import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  Res,
  Req,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { Public } from '@common/decorators/public.decorator';
import { ContractsService } from './contracts.service';
import { ContractHashService } from './services/contract-hash.service';
import { SignatureLinkService } from './services/signature-link.service';

@ApiTags('Contract Verification (Public)')
@Controller('verify')
export class ContractVerificationController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly hashService: ContractHashService,
    private readonly signatureLinkService: SignatureLinkService,
  ) {}

  /**
   * Verify contract by token (public)
   */
  @Get(':token')
  @Public()
  @ApiOperation({ summary: 'Verify contract authenticity by token' })
  @ApiParam({ name: 'token', description: 'Contract verification token (MR3X-CTR-YEAR-XXXX-XXXX)' })
  async verifyContract(@Param('token') token: string) {
    const contract = await this.contractsService.findByToken(token);

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado');
    }

    return {
      success: true,
      data: {
        token: contract.token,
        status: contract.status,
        hashFinal: contract.hashFinal,
        createdAt: contract.createdAt,
        property: contract.property,
        signatures: contract.signatures,
        isValid: !!contract.hashFinal,
        message: contract.hashFinal
          ? 'Contrato válido e verificado'
          : 'Contrato ainda não foi finalizado',
      },
    };
  }

  /**
   * Validate PDF hash against stored hash (public)
   */
  @Post(':token/validate-hash')
  @Public()
  @ApiOperation({ summary: 'Validate uploaded PDF hash against stored hash' })
  @ApiParam({ name: 'token', description: 'Contract verification token' })
  @ApiBody({ schema: { properties: { hash: { type: 'string', description: 'SHA-256 hash to validate' } } } })
  async validateHash(
    @Param('token') token: string,
    @Body('hash') hash: string,
  ) {
    if (!hash) {
      throw new BadRequestException('Hash é obrigatório');
    }

    const result = await this.hashService.verifyHashByToken(token, hash);

    return {
      success: result.valid,
      data: {
        valid: result.valid,
        message: result.message,
      },
    };
  }

  /**
   * Upload PDF and validate its hash (public)
   */
  @Post(':token/validate-pdf')
  @Public()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload PDF file and validate its hash' })
  @ApiParam({ name: 'token', description: 'Contract verification token' })
  @ApiConsumes('multipart/form-data')
  async validatePdf(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo PDF é obrigatório');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Arquivo deve ser um PDF');
    }

    const result = await this.hashService.validateUploadedPdf(token, file.buffer);

    return {
      success: result.valid,
      data: {
        valid: result.valid,
        computedHash: result.computedHash,
        storedHash: result.storedHash,
        message: result.message,
      },
    };
  }
}

/**
 * Controller for external signing via invitation links
 */
@ApiTags('External Signing (Public)')
@Controller('sign')
export class ExternalSigningController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly signatureLinkService: SignatureLinkService,
  ) {}

  /**
   * Get contract data for signing page (via invitation link)
   */
  @Get(':linkToken')
  @Public()
  @ApiOperation({ summary: 'Get contract data for external signing' })
  @ApiParam({ name: 'linkToken', description: 'Signature invitation link token' })
  async getSigningData(@Param('linkToken') linkToken: string) {
    const validation = await this.signatureLinkService.validateSignatureLink(linkToken);

    if (!validation.valid) {
      throw new BadRequestException(validation.message);
    }

    const contractData = await this.signatureLinkService.getContractDataForSigning(linkToken);

    return {
      success: true,
      data: {
        ...contractData,
        signerType: validation.signerType,
        signerEmail: validation.signerEmail,
        signerName: validation.signerName,
      },
    };
  }

  /**
   * Submit signature via invitation link (public)
   */
  @Post(':linkToken/submit')
  @Public()
  @ApiOperation({ summary: 'Submit signature via external link' })
  @ApiParam({ name: 'linkToken', description: 'Signature invitation link token' })
  async submitSignature(
    @Param('linkToken') linkToken: string,
    @Body() body: {
      signature: string;
      geoLat: number;
      geoLng: number;
      geoConsent: boolean;
      witnessName?: string;
      witnessDocument?: string;
    },
    @Req() req: Request,
  ) {
    // Validate geolocation is provided (REQUIRED)
    if (!body.geoLat || !body.geoLng) {
      throw new BadRequestException('Geolocalização é obrigatória para assinar o contrato');
    }

    if (!body.geoConsent) {
      throw new BadRequestException('É necessário consentir com o compartilhamento de localização');
    }

    if (!body.signature) {
      throw new BadRequestException('Assinatura é obrigatória');
    }

    // Validate link
    const validation = await this.signatureLinkService.validateSignatureLink(linkToken);

    if (!validation.valid) {
      throw new BadRequestException(validation.message);
    }

    // Get client info
    const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Submit signature using a system user ID (since this is external)
    // In production, you might want to create a temporary user or use a service account
    const systemUserId = '1'; // System user for external signatures

    const contract = await this.contractsService.signContractWithGeo(
      validation.contractId!,
      validation.signerType as 'tenant' | 'owner' | 'agency' | 'witness',
      {
        signature: body.signature,
        clientIP,
        userAgent,
        geoLat: body.geoLat,
        geoLng: body.geoLng,
        geoConsent: body.geoConsent,
        witnessName: body.witnessName,
        witnessDocument: body.witnessDocument,
      },
      systemUserId,
    );

    // Mark link as used
    await this.signatureLinkService.markLinkUsed(linkToken);

    return {
      success: true,
      message: 'Assinatura registrada com sucesso',
      data: {
        contractToken: contract.contractToken,
        status: contract.status,
      },
    };
  }
}
