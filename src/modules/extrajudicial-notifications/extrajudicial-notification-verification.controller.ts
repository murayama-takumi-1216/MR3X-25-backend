import { Controller, Get, Post, Param, Body, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { ExtrajudicialNotificationHashService } from './services/extrajudicial-notification-hash.service';
import { ExtrajudicialNotificationPdfService } from './services/extrajudicial-notification-pdf.service';
import { ExtrajudicialNotificationsService } from './extrajudicial-notifications.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Extrajudicial Notification Verification')
@Controller('verify/notification')
@Public()
export class ExtrajudicialNotificationVerificationController {
  constructor(
    private readonly hashService: ExtrajudicialNotificationHashService,
    private readonly pdfService: ExtrajudicialNotificationPdfService,
    private readonly notificationsService: ExtrajudicialNotificationsService,
  ) {}

  @Get(':token')
  @ApiOperation({ summary: 'Verify notification by token (public endpoint)' })
  async verifyByToken(@Param('token') token: string) {
    const verification = await this.hashService.verifyHashByToken(token);
    const notification = await this.notificationsService.findByToken(token);

    return {
      verification,
      notification: {
        id: notification.id,
        token: notification.notificationToken,
        notificationNumber: notification.notificationNumber,
        protocolNumber: notification.protocolNumber,
        type: notification.type,
        status: notification.status,
        priority: notification.priority,
        title: notification.title,
        creditor: {
          name: notification.creditorName,
        },
        debtor: {
          name: notification.debtorName,
        },
        totalAmount: notification.totalAmount,
        deadlineDate: notification.deadlineDate,
        createdAt: notification.createdAt,
        signatures: {
          creditorSigned: !!notification.creditorSignedAt,
          debtorSigned: !!notification.debtorSignedAt,
          witness1Signed: !!notification.witness1SignedAt,
          witness2Signed: !!notification.witness2SignedAt,
        },
      },
    };
  }

  @Get(':token/pdf')
  @ApiOperation({ summary: 'Download PDF by token (public endpoint)' })
  async downloadPdfByToken(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const notification = await this.notificationsService.findByToken(token);
    const pdfBuffer = await this.pdfService.getStoredPdf(
      BigInt(notification.id),
      notification.hashFinal ? 'final' : 'provisional',
    );

    if (!pdfBuffer) {
      res.status(404).json({ message: 'PDF nao encontrado' });
      return;
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="notificacao-${notification.notificationNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Post('validate-pdf')
  @ApiOperation({ summary: 'Validate uploaded PDF against stored hash' })
  async validatePdf(
    @Body() body: { token: string; pdfBase64: string },
  ) {
    const pdfBuffer = Buffer.from(body.pdfBase64, 'base64');
    return this.hashService.validateUploadedPdf(body.token, pdfBuffer);
  }

  @Get(':token/status')
  @ApiOperation({ summary: 'Get notification status (public endpoint)' })
  async getStatus(@Param('token') token: string) {
    const notification = await this.notificationsService.findByToken(token);

    return {
      token: notification.notificationToken,
      notificationNumber: notification.notificationNumber,
      status: notification.status,
      priority: notification.priority,
      deadlineDate: notification.deadlineDate,
      isExpired: new Date(notification.deadlineDate) < new Date(),
      signatures: {
        creditorSigned: !!notification.creditorSignedAt,
        creditorSignedAt: notification.creditorSignedAt,
        debtorSigned: !!notification.debtorSignedAt,
        debtorSignedAt: notification.debtorSignedAt,
      },
      sentAt: notification.sentAt,
      viewedAt: notification.viewedAt,
      responseAt: notification.responseAt,
      responseAccepted: notification.responseAccepted,
    };
  }
}
