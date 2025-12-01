import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly skipEmailSending: boolean;

  constructor(private configService: ConfigService) {
    // Skip email if SKIP_EMAIL_SENDING=true
    this.skipEmailSending = this.configService.get('SKIP_EMAIL_SENDING') === 'true';

    if (!this.skipEmailSending) {
      this.initializeTransporter();
    } else {
      this.logger.warn('Email sending is disabled (SKIP_EMAIL_SENDING=true)');
    }
  }

  private initializeTransporter() {
    const host = this.configService.get('MAIL_HOST');
    const port = parseInt(this.configService.get('MAIL_PORT') || '465', 10);
    const user = this.configService.get('MAIL_USER');
    const pass = this.configService.get('MAIL_PASS');

    if (!host || !user || !pass) {
      this.logger.warn('Email configuration incomplete. Email sending will be disabled.');
      return;
    }

    this.logger.log(`Initializing email transporter: ${host}:${port} with user: ${user}`);

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: true, // Use SSL for port 465
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Verify connection asynchronously
    this.transporter.verify()
      .then(() => {
        this.logger.log('✅ Email transporter is ready to send messages');
      })
      .catch((error) => {
        this.logger.error(`❌ Email transporter verification failed: ${error.message}`);
      });
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const fromEmail = this.configService.get('MAIL_USER') || 'noreply@mr3x.com.br';

    // Always log the email content for debugging/development
    this.logger.log(`📧 Email to ${options.to}: ${options.subject}`);
    this.logger.log(`📧 Content: ${options.text}`);

    if (this.skipEmailSending) {
      this.logger.log(`[SKIP] Email sending disabled`);
      return true;
    }

    if (!this.transporter) {
      this.logger.error('Email transporter not initialized');
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"MR3X Rental" <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      this.logger.log(`Email sent successfully to ${options.to}: ${info.messageId}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${options.to}: ${error.message}`);
      return false;
    }
  }

  async sendVerificationCode(email: string, code: string): Promise<boolean> {
    const subject = 'MR3X - Código de Verificação';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .code { font-size: 32px; font-weight: bold; color: #2563eb; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; letter-spacing: 8px; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MR3X Rental</h1>
          </div>
          <div class="content">
            <h2>Código de Verificação</h2>
            <p>Olá!</p>
            <p>Use o código abaixo para verificar seu email:</p>
            <div class="code">${code}</div>
            <p>Este código expira em <strong>10 minutos</strong>.</p>
            <p>Se você não solicitou este código, ignore este email.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} MR3X Rental. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `MR3X - Código de Verificação\n\nSeu código de verificação é: ${code}\n\nEste código expira em 10 minutos.\n\nSe você não solicitou este código, ignore este email.`;

    return this.sendEmail({ to: email, subject, html, text });
  }

  async sendPasswordResetCode(email: string, code: string): Promise<boolean> {
    const subject = 'MR3X - Redefinição de Senha';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .code { font-size: 32px; font-weight: bold; color: #dc2626; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; letter-spacing: 8px; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px 15px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MR3X Rental</h1>
          </div>
          <div class="content">
            <h2>Redefinição de Senha</h2>
            <p>Olá!</p>
            <p>Recebemos uma solicitação para redefinir sua senha. Use o código abaixo:</p>
            <div class="code">${code}</div>
            <p>Este código expira em <strong>15 minutos</strong>.</p>
            <div class="warning">
              <strong>Atenção:</strong> Se você não solicitou a redefinição de senha, ignore este email e sua conta permanecerá segura.
            </div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} MR3X Rental. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `MR3X - Redefinição de Senha\n\nSeu código de redefinição é: ${code}\n\nEste código expira em 15 minutos.\n\nSe você não solicitou a redefinição de senha, ignore este email.`;

    return this.sendEmail({ to: email, subject, html, text });
  }
}
