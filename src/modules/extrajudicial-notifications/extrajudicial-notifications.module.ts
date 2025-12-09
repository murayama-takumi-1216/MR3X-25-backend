import { Module } from '@nestjs/common';
import { ExtrajudicialNotificationsController } from './extrajudicial-notifications.controller';
import { ExtrajudicialNotificationsService } from './extrajudicial-notifications.service';
import { ExtrajudicialNotificationVerificationController } from './extrajudicial-notification-verification.controller';
import { ExtrajudicialNotificationHashService } from './services/extrajudicial-notification-hash.service';
import { ExtrajudicialNotificationPdfService } from './services/extrajudicial-notification-pdf.service';

@Module({
  controllers: [
    ExtrajudicialNotificationsController,
    ExtrajudicialNotificationVerificationController,
  ],
  providers: [
    ExtrajudicialNotificationsService,
    ExtrajudicialNotificationHashService,
    ExtrajudicialNotificationPdfService,
  ],
  exports: [
    ExtrajudicialNotificationsService,
    ExtrajudicialNotificationHashService,
    ExtrajudicialNotificationPdfService,
  ],
})
export class ExtrajudicialNotificationsModule {}
