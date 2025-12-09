import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@config/prisma.service';
import * as puppeteer from 'puppeteer';
import * as bwipjs from 'bwip-js';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import { ExtrajudicialNotificationHashService } from './extrajudicial-notification-hash.service';

interface NotificationData {
  id: string;
  token: string;
  notificationNumber: string;
  protocolNumber: string;
  type: string;
  status: string;
  priority: string;
  creditor: {
    name: string;
    document: string;
    address: string | null;
    email: string | null;
    phone: string | null;
  };
  debtor: {
    name: string;
    document: string;
    address: string | null;
    email: string | null;
    phone: string | null;
  };
  property: {
    address: string;
    city: string;
    state: string;
  };
  title: string;
  subject: string;
  description: string;
  legalBasis: string;
  demandedAction: string;
  financial: {
    principalAmount: number | null;
    fineAmount: number | null;
    interestAmount: number | null;
    correctionAmount: number | null;
    lawyerFees: number | null;
    totalAmount: number;
  };
  deadline: {
    days: number;
    date: Date;
    gracePeriodDays: number | null;
  };
  consequencesText: string | null;
  signatures?: {
    creditor?: { signature: string; signedAt: Date; ip: string; lat?: number; lng?: number };
    debtor?: { signature: string; signedAt: Date; ip: string; lat?: number; lng?: number };
    witness1?: { signature: string; signedAt: Date; name: string; document: string };
    witness2?: { signature: string; signedAt: Date; name: string; document: string };
  };
  createdAt: Date;
}

@Injectable()
export class ExtrajudicialNotificationPdfService {
  private readonly uploadsDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hashService: ExtrajudicialNotificationHashService,
  ) {
    this.uploadsDir = path.join(process.cwd(), 'uploads', 'extrajudicial-notifications');
    this.ensureDirectoryExists(path.join(this.uploadsDir, 'provisional'));
    this.ensureDirectoryExists(path.join(this.uploadsDir, 'final'));
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Generate barcode as base64 PNG
   */
  async generateBarcodeBase64(token: string): Promise<string> {
    try {
      const png = await bwipjs.toBuffer({
        bcid: 'code128',
        text: token,
        scale: 3,
        height: 10,
        includetext: true,
        textxalign: 'center',
      });
      return `data:image/png;base64,${png.toString('base64')}`;
    } catch (error) {
      console.error('Error generating barcode:', error);
      throw error;
    }
  }

  /**
   * Generate QR code as base64 PNG
   */
  async generateQRCodeBase64(url: string): Promise<string> {
    try {
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 150,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
      return qrDataUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  }

  /**
   * Get notification data for PDF generation
   */
  private async getNotificationData(notificationId: bigint): Promise<NotificationData> {
    const notification = await this.prisma.extrajudicialNotification.findUnique({
      where: { id: notificationId },
      include: {
        property: true,
        creditor: true,
        debtor: true,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notificacao extrajudicial nao encontrada');
    }

    return {
      id: notification.id.toString(),
      token: notification.notificationToken,
      notificationNumber: notification.notificationNumber || '',
      protocolNumber: notification.protocolNumber || '',
      type: notification.type,
      status: notification.status,
      priority: notification.priority,
      creditor: {
        name: notification.creditorName,
        document: notification.creditorDocument,
        address: notification.creditorAddress,
        email: notification.creditorEmail,
        phone: notification.creditorPhone,
      },
      debtor: {
        name: notification.debtorName,
        document: notification.debtorDocument,
        address: notification.debtorAddress,
        email: notification.debtorEmail,
        phone: notification.debtorPhone,
      },
      property: {
        address: notification.property.address,
        city: notification.property.city,
        state: '',
      },
      title: notification.title,
      subject: notification.subject,
      description: notification.description,
      legalBasis: notification.legalBasis,
      demandedAction: notification.demandedAction,
      financial: {
        principalAmount: notification.principalAmount ? Number(notification.principalAmount) : null,
        fineAmount: notification.fineAmount ? Number(notification.fineAmount) : null,
        interestAmount: notification.interestAmount ? Number(notification.interestAmount) : null,
        correctionAmount: notification.correctionAmount ? Number(notification.correctionAmount) : null,
        lawyerFees: notification.lawyerFees ? Number(notification.lawyerFees) : null,
        totalAmount: Number(notification.totalAmount),
      },
      deadline: {
        days: notification.deadlineDays,
        date: notification.deadlineDate,
        gracePeriodDays: notification.gracePeriodDays,
      },
      consequencesText: notification.consequencesText,
      signatures: {
        creditor: notification.creditorSignature
          ? {
              signature: notification.creditorSignature,
              signedAt: notification.creditorSignedAt!,
              ip: notification.creditorSignedIP || 'N/A',
              lat: notification.creditorGeoLat || undefined,
              lng: notification.creditorGeoLng || undefined,
            }
          : undefined,
        debtor: notification.debtorSignature
          ? {
              signature: notification.debtorSignature,
              signedAt: notification.debtorSignedAt!,
              ip: notification.debtorSignedIP || 'N/A',
              lat: notification.debtorGeoLat || undefined,
              lng: notification.debtorGeoLng || undefined,
            }
          : undefined,
        witness1: notification.witness1Signature
          ? {
              signature: notification.witness1Signature,
              signedAt: notification.witness1SignedAt!,
              name: notification.witness1Name || '',
              document: notification.witness1Document || '',
            }
          : undefined,
        witness2: notification.witness2Signature
          ? {
              signature: notification.witness2Signature,
              signedAt: notification.witness2SignedAt!,
              name: notification.witness2Name || '',
              document: notification.witness2Document || '',
            }
          : undefined,
      },
      createdAt: notification.createdAt,
    };
  }

  private getTypeLabel(type: string): string {
    const types: Record<string, string> = {
      COBRANCA_ALUGUEL: 'Cobranca de Aluguel',
      COBRANCA_CONDOMINIO: 'Cobranca de Condominio',
      COBRANCA_IPTU: 'Cobranca de IPTU',
      COBRANCA_MULTAS: 'Cobranca de Multas',
      COBRANCA_DANOS: 'Cobranca de Danos',
      RESCISAO_CONTRATO: 'Rescisao de Contrato',
      DESOCUPACAO: 'Desocupacao',
      DIVERGENCIA_VISTORIA: 'Divergencia de Vistoria',
      OUTROS: 'Outros',
    };
    return types[type] || type;
  }

  private getStatusLabel(status: string): string {
    const statuses: Record<string, string> = {
      RASCUNHO: 'Rascunho',
      AGUARDANDO_ENVIO: 'Aguardando Envio',
      ENVIADA: 'Enviada',
      VISUALIZADA: 'Visualizada',
      RESPONDIDA: 'Respondida',
      ACEITA: 'Aceita',
      REJEITADA: 'Rejeitada',
      PRAZO_EXPIRADO: 'Prazo Expirado',
      ENCAMINHADA_JUDICIAL: 'Encaminhada ao Judicial',
      CANCELADA: 'Cancelada',
    };
    return statuses[status] || status;
  }

  private getPriorityLabel(priority: string): string {
    const priorities: Record<string, string> = {
      URGENT: 'Urgente',
      HIGH: 'Alta',
      NORMAL: 'Normal',
      LOW: 'Baixa',
    };
    return priorities[priority] || priority;
  }

  private getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      URGENT: '#dc2626',
      HIGH: '#ea580c',
      NORMAL: '#2563eb',
      LOW: '#6b7280',
    };
    return colors[priority] || '#2563eb';
  }

  private formatCurrency(value: number | null): string {
    if (value === null) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('pt-BR');
  }

  private formatDateTime(date: Date): string {
    return new Date(date).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }

  /**
   * Render HTML template with data
   */
  private async renderHtmlTemplate(data: NotificationData, isProvisional: boolean): Promise<string> {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/notification/${data.token}`;
    const barcodeBase64 = await this.generateBarcodeBase64(data.token);
    const qrCodeBase64 = await this.generateQRCodeBase64(verificationUrl);

    const templateData = {
      ...data,
      isProvisional,
      barcodeBase64,
      qrCodeBase64,
      verificationUrl,
      generatedAt: this.formatDateTime(new Date()),
      typeLabel: this.getTypeLabel(data.type),
      statusLabel: this.getStatusLabel(data.status),
      priorityLabel: this.getPriorityLabel(data.priority),
      priorityColor: this.getPriorityColor(data.priority),
      deadlineDateFormatted: this.formatDate(data.deadline.date),
      createdAtFormatted: this.formatDate(data.createdAt),
    };

    return this.getNotificationHtmlTemplate(templateData);
  }

  /**
   * Generate provisional PDF (with watermark)
   */
  async generateProvisionalPdf(notificationId: bigint): Promise<Buffer> {
    const data = await this.getNotificationData(notificationId);
    const html = await this.renderHtmlTemplate(data, true);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', right: '12mm', bottom: '15mm', left: '12mm' },
      });

      const pdfBuffer = Buffer.from(pdfUint8Array);

      // Save provisional PDF
      const timestamp = Date.now();
      const filename = `notification-provisional-${timestamp}.pdf`;
      const filePath = path.join(this.uploadsDir, 'provisional', data.id, filename);

      this.ensureDirectoryExists(path.dirname(filePath));
      fs.writeFileSync(filePath, pdfBuffer);

      // Generate and store provisional hash
      const hash = this.hashService.generateHash(pdfBuffer);
      await this.prisma.extrajudicialNotification.update({
        where: { id: notificationId },
        data: {
          provisionalPdfPath: filePath,
          provisionalHash: hash,
        },
      });

      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }

  /**
   * Generate final PDF (no watermark, with all signatures)
   */
  async generateFinalPdf(notificationId: bigint): Promise<Buffer> {
    const data = await this.getNotificationData(notificationId);
    const html = await this.renderHtmlTemplate(data, false);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', right: '12mm', bottom: '15mm', left: '12mm' },
      });

      const pdfBuffer = Buffer.from(pdfUint8Array);

      // Save final PDF
      const timestamp = Date.now();
      const filename = `notification-final-${timestamp}.pdf`;
      const filePath = path.join(this.uploadsDir, 'final', data.id, filename);

      this.ensureDirectoryExists(path.dirname(filePath));
      fs.writeFileSync(filePath, pdfBuffer);

      // Generate and store final hash
      const hash = this.hashService.generateHash(pdfBuffer);
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/notification/${data.token}`;

      await this.prisma.extrajudicialNotification.update({
        where: { id: notificationId },
        data: {
          finalPdfPath: filePath,
          hashFinal: hash,
          verificationUrl,
          pdfGeneratedAt: new Date(),
        },
      });

      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }

  /**
   * Get stored PDF file
   */
  async getStoredPdf(notificationId: bigint, type: 'provisional' | 'final'): Promise<Buffer | null> {
    const notification = await this.prisma.extrajudicialNotification.findUnique({
      where: { id: notificationId },
      select: { provisionalPdfPath: true, finalPdfPath: true },
    });

    if (!notification) {
      throw new NotFoundException('Notificacao nao encontrada');
    }

    const filePath = type === 'provisional' ? notification.provisionalPdfPath : notification.finalPdfPath;

    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }

    return fs.readFileSync(filePath);
  }

  /**
   * Get notification HTML template
   */
  private getNotificationHtmlTemplate(data: any): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notificacao Extrajudicial - ${data.notificationNumber}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a1a;
      background: white;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 20mm 18mm;
      position: relative;
    }

    ${
      data.isProvisional
        ? `
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 48px;
      color: rgba(200, 200, 200, 0.2);
      font-weight: bold;
      white-space: nowrap;
      pointer-events: none;
      z-index: 1000;
    }
    `
        : ''
    }

    .sidebar-barcode {
      position: fixed;
      right: 3mm;
      top: 50%;
      transform: rotate(90deg) translateX(-50%);
      z-index: 100;
    }

    .sidebar-barcode img {
      max-width: 50mm;
      height: auto;
    }

    .qrcode-container {
      position: fixed;
      bottom: 15mm;
      right: 15mm;
      text-align: center;
      z-index: 100;
    }

    .qrcode-container img {
      width: 20mm;
      height: 20mm;
    }

    .qrcode-container p {
      font-size: 6pt;
      color: #666;
      margin-top: 1mm;
    }

    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 3px double #333;
      padding-bottom: 15px;
    }

    .header h1 {
      font-size: 16pt;
      font-weight: bold;
      color: #1a1a1a;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 8px;
    }

    .header .subtitle {
      font-size: 12pt;
      color: #333;
      font-weight: 600;
    }

    .header .doc-info {
      margin-top: 10px;
      font-size: 9pt;
      color: #555;
    }

    .header .doc-info span {
      margin: 0 10px;
    }

    .priority-badge {
      display: inline-block;
      padding: 3px 12px;
      border-radius: 3px;
      font-size: 9pt;
      font-weight: bold;
      color: white;
      background-color: ${data.priorityColor};
      margin-top: 8px;
    }

    .parties-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }

    .party-box {
      border: 1px solid #ccc;
      padding: 12px;
      background: #fafafa;
    }

    .party-box h3 {
      font-size: 10pt;
      font-weight: bold;
      color: #333;
      text-transform: uppercase;
      border-bottom: 1px solid #ccc;
      padding-bottom: 5px;
      margin-bottom: 8px;
    }

    .party-box p {
      font-size: 9pt;
      margin-bottom: 3px;
    }

    .party-box .label {
      font-weight: 600;
      color: #555;
    }

    .property-box {
      border: 1px solid #ccc;
      padding: 12px;
      margin-bottom: 20px;
      background: #f9f9f9;
    }

    .property-box h3 {
      font-size: 10pt;
      font-weight: bold;
      color: #333;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .content-section {
      margin-bottom: 20px;
    }

    .content-section h3 {
      font-size: 11pt;
      font-weight: bold;
      color: #1a1a1a;
      text-transform: uppercase;
      border-bottom: 2px solid #333;
      padding-bottom: 5px;
      margin-bottom: 12px;
    }

    .content-section p {
      text-align: justify;
      margin-bottom: 10px;
    }

    .legal-text {
      background: #f5f5f5;
      border-left: 3px solid #666;
      padding: 10px 15px;
      font-style: italic;
      margin: 10px 0;
    }

    .financial-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }

    .financial-table th,
    .financial-table td {
      border: 1px solid #ccc;
      padding: 8px 12px;
      text-align: left;
      font-size: 9pt;
    }

    .financial-table th {
      background: #eee;
      font-weight: 600;
    }

    .financial-table .total-row {
      background: #ddd;
      font-weight: bold;
      font-size: 10pt;
    }

    .financial-table .amount {
      text-align: right;
      font-family: 'Courier New', monospace;
    }

    .deadline-box {
      background: #fff3cd;
      border: 2px solid #e6a700;
      padding: 15px;
      margin: 20px 0;
      text-align: center;
    }

    .deadline-box h4 {
      font-size: 11pt;
      color: #856404;
      margin-bottom: 8px;
    }

    .deadline-box .date {
      font-size: 14pt;
      font-weight: bold;
      color: #664d03;
    }

    .deadline-box .days {
      font-size: 9pt;
      color: #856404;
      margin-top: 5px;
    }

    .consequences-box {
      background: #f8d7da;
      border: 1px solid #f5c6cb;
      padding: 12px;
      margin: 15px 0;
    }

    .consequences-box h4 {
      font-size: 10pt;
      color: #721c24;
      margin-bottom: 8px;
    }

    .consequences-box p {
      font-size: 9pt;
      color: #721c24;
    }

    .signatures {
      margin-top: 30px;
      page-break-inside: avoid;
    }

    .signatures h3 {
      font-size: 11pt;
      font-weight: bold;
      text-transform: uppercase;
      border-bottom: 2px solid #333;
      padding-bottom: 5px;
      margin-bottom: 20px;
    }

    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
    }

    .signature-box {
      text-align: center;
      padding: 15px;
    }

    .signature-image {
      height: 45px;
      margin-bottom: 5px;
    }

    .signature-image img {
      max-height: 45px;
      max-width: 140px;
    }

    .signature-line {
      border-top: 1px solid #333;
      margin-top: 50px;
      padding-top: 8px;
    }

    .signature-name {
      font-weight: bold;
      font-size: 10pt;
    }

    .signature-role {
      font-size: 8pt;
      color: #666;
      text-transform: uppercase;
    }

    .signature-meta {
      font-size: 6pt;
      color: #888;
      margin-top: 5px;
      font-family: 'Courier New', monospace;
    }

    .footer {
      position: fixed;
      bottom: 8mm;
      left: 18mm;
      right: 45mm;
      font-size: 6pt;
      color: #666;
      border-top: 1px solid #ddd;
      padding-top: 5px;
    }

    .footer p {
      margin-bottom: 1px;
    }

    .hash {
      font-family: 'Courier New', monospace;
      font-size: 5pt;
      word-break: break-all;
    }

    .demanded-action {
      background: #e8f4fd;
      border: 1px solid #b8daff;
      padding: 12px;
      margin: 15px 0;
    }

    .demanded-action h4 {
      font-size: 10pt;
      color: #004085;
      margin-bottom: 8px;
    }

    .demanded-action p {
      font-size: 10pt;
      color: #004085;
    }
  </style>
</head>
<body>
  ${data.isProvisional ? '<div class="watermark">MINUTA - AGUARDANDO ASSINATURAS</div>' : ''}

  <div class="sidebar-barcode">
    <img src="${data.barcodeBase64}" alt="Codigo de barras">
  </div>

  <div class="qrcode-container">
    <img src="${data.qrCodeBase64}" alt="QR Code de verificacao">
    <p>Verifique este documento</p>
  </div>

  <div class="page">
    <div class="header">
      <h1>Notificacao Extrajudicial</h1>
      <p class="subtitle">${data.typeLabel}</p>
      <div class="doc-info">
        <span><strong>N:</strong> ${data.notificationNumber}</span>
        <span><strong>Protocolo:</strong> ${data.protocolNumber}</span>
        <span><strong>Data:</strong> ${data.createdAtFormatted}</span>
      </div>
      <span class="priority-badge">${data.priorityLabel}</span>
    </div>

    <div class="parties-grid">
      <div class="party-box">
        <h3>Notificante (Credor)</h3>
        <p><span class="label">Nome:</span> ${data.creditor.name}</p>
        <p><span class="label">CPF/CNPJ:</span> ${data.creditor.document}</p>
        ${data.creditor.address ? `<p><span class="label">Endereco:</span> ${data.creditor.address}</p>` : ''}
        ${data.creditor.email ? `<p><span class="label">E-mail:</span> ${data.creditor.email}</p>` : ''}
        ${data.creditor.phone ? `<p><span class="label">Telefone:</span> ${data.creditor.phone}</p>` : ''}
      </div>
      <div class="party-box">
        <h3>Notificado (Devedor)</h3>
        <p><span class="label">Nome:</span> ${data.debtor.name}</p>
        <p><span class="label">CPF/CNPJ:</span> ${data.debtor.document}</p>
        ${data.debtor.address ? `<p><span class="label">Endereco:</span> ${data.debtor.address}</p>` : ''}
        ${data.debtor.email ? `<p><span class="label">E-mail:</span> ${data.debtor.email}</p>` : ''}
        ${data.debtor.phone ? `<p><span class="label">Telefone:</span> ${data.debtor.phone}</p>` : ''}
      </div>
    </div>

    <div class="property-box">
      <h3>Imovel Objeto</h3>
      <p><span class="label">Endereco:</span> ${data.property.address}</p>
      <p><span class="label">Cidade/UF:</span> ${data.property.city}${data.property.state ? '/' + data.property.state : ''}</p>
    </div>

    <div class="content-section">
      <h3>${data.title}</h3>

      <p><strong>Objeto:</strong> ${data.subject}</p>

      <p>${data.description}</p>

      <div class="legal-text">
        <strong>Fundamentacao Legal:</strong><br>
        ${data.legalBasis}
      </div>
    </div>

    <div class="content-section">
      <h3>Valores Devidos</h3>
      <table class="financial-table">
        <tbody>
          ${
            data.financial.principalAmount
              ? `
          <tr>
            <td>Valor Principal</td>
            <td class="amount">${this.formatCurrency(data.financial.principalAmount)}</td>
          </tr>
          `
              : ''
          }
          ${
            data.financial.fineAmount
              ? `
          <tr>
            <td>Multa</td>
            <td class="amount">${this.formatCurrency(data.financial.fineAmount)}</td>
          </tr>
          `
              : ''
          }
          ${
            data.financial.interestAmount
              ? `
          <tr>
            <td>Juros</td>
            <td class="amount">${this.formatCurrency(data.financial.interestAmount)}</td>
          </tr>
          `
              : ''
          }
          ${
            data.financial.correctionAmount
              ? `
          <tr>
            <td>Correcao Monetaria</td>
            <td class="amount">${this.formatCurrency(data.financial.correctionAmount)}</td>
          </tr>
          `
              : ''
          }
          ${
            data.financial.lawyerFees
              ? `
          <tr>
            <td>Honorarios Advocaticios</td>
            <td class="amount">${this.formatCurrency(data.financial.lawyerFees)}</td>
          </tr>
          `
              : ''
          }
          <tr class="total-row">
            <td><strong>TOTAL DEVIDO</strong></td>
            <td class="amount"><strong>${this.formatCurrency(data.financial.totalAmount)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="demanded-action">
      <h4>ACAO REQUERIDA</h4>
      <p>${data.demandedAction}</p>
    </div>

    <div class="deadline-box">
      <h4>PRAZO PARA CUMPRIMENTO</h4>
      <p class="date">${data.deadlineDateFormatted}</p>
      <p class="days">(${data.deadline.days} dias${data.deadline.gracePeriodDays ? ` + ${data.deadline.gracePeriodDays} dias de carencia` : ''})</p>
    </div>

    ${
      data.consequencesText
        ? `
    <div class="consequences-box">
      <h4>CONSEQUENCIAS DO NAO CUMPRIMENTO</h4>
      <p>${data.consequencesText}</p>
    </div>
    `
        : ''
    }

    <div class="signatures">
      <h3>Assinaturas</h3>

      <div class="signature-grid">
        <div class="signature-box">
          ${
            data.signatures?.creditor?.signature
              ? `
          <div class="signature-image">
            <img src="${data.signatures.creditor.signature}" alt="Assinatura do Credor">
          </div>
          `
              : ''
          }
          <div class="signature-line">
            <p class="signature-name">${data.creditor.name}</p>
            <p class="signature-role">Notificante / Credor</p>
            ${
              data.signatures?.creditor
                ? `
            <p class="signature-meta">
              ${this.formatDateTime(data.signatures.creditor.signedAt)}<br>
              IP: ${data.signatures.creditor.ip}
              ${data.signatures.creditor.lat ? `<br>Geo: ${data.signatures.creditor.lat.toFixed(6)}, ${data.signatures.creditor.lng?.toFixed(6)}` : ''}
            </p>
            `
                : ''
            }
          </div>
        </div>

        <div class="signature-box">
          ${
            data.signatures?.debtor?.signature
              ? `
          <div class="signature-image">
            <img src="${data.signatures.debtor.signature}" alt="Assinatura do Devedor">
          </div>
          `
              : ''
          }
          <div class="signature-line">
            <p class="signature-name">${data.debtor.name}</p>
            <p class="signature-role">Notificado / Devedor</p>
            ${
              data.signatures?.debtor
                ? `
            <p class="signature-meta">
              ${this.formatDateTime(data.signatures.debtor.signedAt)}<br>
              IP: ${data.signatures.debtor.ip}
              ${data.signatures.debtor.lat ? `<br>Geo: ${data.signatures.debtor.lat.toFixed(6)}, ${data.signatures.debtor.lng?.toFixed(6)}` : ''}
            </p>
            `
                : ''
            }
          </div>
        </div>

        ${
          data.signatures?.witness1
            ? `
        <div class="signature-box">
          <div class="signature-image">
            <img src="${data.signatures.witness1.signature}" alt="Assinatura Testemunha 1">
          </div>
          <div class="signature-line">
            <p class="signature-name">${data.signatures.witness1.name}</p>
            <p class="signature-role">Testemunha 1 - ${data.signatures.witness1.document}</p>
            <p class="signature-meta">${this.formatDateTime(data.signatures.witness1.signedAt)}</p>
          </div>
        </div>
        `
            : ''
        }

        ${
          data.signatures?.witness2
            ? `
        <div class="signature-box">
          <div class="signature-image">
            <img src="${data.signatures.witness2.signature}" alt="Assinatura Testemunha 2">
          </div>
          <div class="signature-line">
            <p class="signature-name">${data.signatures.witness2.name}</p>
            <p class="signature-role">Testemunha 2 - ${data.signatures.witness2.document}</p>
            <p class="signature-meta">${this.formatDateTime(data.signatures.witness2.signedAt)}</p>
          </div>
        </div>
        `
            : ''
        }
      </div>
    </div>

    <div class="footer">
      <p><strong>Token:</strong> ${data.token}</p>
      <p><strong>Protocolo:</strong> ${data.protocolNumber}</p>
      <p><strong>Gerado em:</strong> ${data.generatedAt}</p>
      <p><strong>Verificacao:</strong> ${data.verificationUrl}</p>
      ${!data.isProvisional ? `<p class="hash"><strong>Hash SHA-256:</strong> Calculado apos geracao final</p>` : ''}
    </div>
  </div>
</body>
</html>
    `;
  }
}
