import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AsaasCustomer,
  CreateCustomerDto,
  AsaasPayment,
  CreatePaymentDto,
  AsaasPixQrCode,
  AsaasSubscription,
  CreateSubscriptionDto,
  AsaasListResponse,
  AsaasBillingType,
  PaymentCreationResult,
  CustomerSyncResult,
} from './interfaces/asaas.interfaces';

@Injectable()
export class AsaasService implements OnModuleInit {
  private readonly logger = new Logger(AsaasService.name);
  private apiKey: string;
  private baseUrl: string;
  private isConfigured = false;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.apiKey = this.configService.get<string>('ASAAS_API_KEY') || '';
    const environment = this.configService.get<string>('ASAAS_ENVIRONMENT') || 'sandbox';

    this.baseUrl = environment === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    this.isConfigured = !!this.apiKey;

    if (this.isConfigured) {
      this.logger.log(`Asaas API configured for ${environment} environment`);
    } else {
      this.logger.warn('Asaas API key not configured. Payment processing will be disabled.');
    }
  }

  /**
   * Check if Asaas is properly configured
   */
  isEnabled(): boolean {
    return this.isConfigured;
  }

  /**
   * Make HTTP request to Asaas API
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: any,
  ): Promise<T> {
    if (!this.isConfigured) {
      throw new Error('Asaas API is not configured');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'access_token': this.apiKey,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    try {
      this.logger.debug(`Asaas API ${method} ${endpoint}`);
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.logger.error(`Asaas API error: ${response.status}`, errorData);
        throw new Error(
          errorData.errors?.[0]?.description ||
          `Asaas API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      this.logger.error(`Asaas API request failed: ${error.message}`);
      throw error;
    }
  }

  // ==================== CUSTOMER MANAGEMENT ====================

  /**
   * Create a new customer in Asaas
   */
  async createCustomer(data: CreateCustomerDto): Promise<AsaasCustomer> {
    return this.request<AsaasCustomer>('POST', '/customers', data);
  }

  /**
   * Update an existing customer
   */
  async updateCustomer(customerId: string, data: Partial<CreateCustomerDto>): Promise<AsaasCustomer> {
    return this.request<AsaasCustomer>('PUT', `/customers/${customerId}`, data);
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<AsaasCustomer> {
    return this.request<AsaasCustomer>('GET', `/customers/${customerId}`);
  }

  /**
   * Find customer by CPF/CNPJ
   */
  async findCustomerByCpfCnpj(cpfCnpj: string): Promise<AsaasCustomer | null> {
    const cleanCpfCnpj = cpfCnpj.replace(/\D/g, '');
    const response = await this.request<AsaasListResponse<AsaasCustomer>>(
      'GET',
      `/customers?cpfCnpj=${cleanCpfCnpj}`,
    );
    return response.data.length > 0 ? response.data[0] : null;
  }

  /**
   * Find customer by external reference
   */
  async findCustomerByExternalReference(externalReference: string): Promise<AsaasCustomer | null> {
    const response = await this.request<AsaasListResponse<AsaasCustomer>>(
      'GET',
      `/customers?externalReference=${externalReference}`,
    );
    return response.data.length > 0 ? response.data[0] : null;
  }

  /**
   * List all customers with pagination
   */
  async listCustomers(offset: number = 0, limit: number = 10): Promise<AsaasListResponse<AsaasCustomer>> {
    return this.request<AsaasListResponse<AsaasCustomer>>(
      'GET',
      `/customers?offset=${offset}&limit=${limit}`,
    );
  }

  /**
   * Delete a customer
   */
  async deleteCustomer(customerId: string): Promise<{ deleted: boolean; id: string }> {
    return this.request<{ deleted: boolean; id: string }>('DELETE', `/customers/${customerId}`);
  }

  /**
   * Sync a user to Asaas (create or update)
   */
  async syncCustomer(userData: {
    id: string;
    name: string;
    email: string;
    document: string;
    phone?: string;
    address?: string;
    addressNumber?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  }): Promise<CustomerSyncResult> {
    try {
      // Check if customer already exists by external reference (our user ID)
      let customer = await this.findCustomerByExternalReference(`user_${userData.id}`);

      const customerData: CreateCustomerDto = {
        name: userData.name,
        email: userData.email,
        cpfCnpj: userData.document.replace(/\D/g, ''),
        phone: userData.phone?.replace(/\D/g, ''),
        address: userData.address,
        addressNumber: userData.addressNumber,
        city: userData.city,
        state: userData.state,
        postalCode: userData.postalCode?.replace(/\D/g, ''),
        externalReference: `user_${userData.id}`,
        notificationDisabled: false,
      };

      if (customer) {
        // Update existing customer
        customer = await this.updateCustomer(customer.id, customerData);
      } else {
        // Try to find by CPF/CNPJ
        customer = await this.findCustomerByCpfCnpj(userData.document);

        if (customer) {
          // Update existing customer found by CPF
          customer = await this.updateCustomer(customer.id, customerData);
        } else {
          // Create new customer
          customer = await this.createCustomer(customerData);
        }
      }

      return {
        success: true,
        customerId: customer.id,
      };
    } catch (error) {
      this.logger.error(`Failed to sync customer: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ==================== PAYMENT MANAGEMENT ====================

  /**
   * Create a new payment (single charge)
   */
  async createPayment(data: CreatePaymentDto): Promise<AsaasPayment> {
    return this.request<AsaasPayment>('POST', '/payments', data);
  }

  /**
   * Get payment by ID
   */
  async getPayment(paymentId: string): Promise<AsaasPayment> {
    return this.request<AsaasPayment>('GET', `/payments/${paymentId}`);
  }

  /**
   * List payments with filters
   */
  async listPayments(filters: {
    customer?: string;
    status?: string;
    billingType?: AsaasBillingType;
    externalReference?: string;
    offset?: number;
    limit?: number;
  }): Promise<AsaasListResponse<AsaasPayment>> {
    const params = new URLSearchParams();
    if (filters.customer) params.append('customer', filters.customer);
    if (filters.status) params.append('status', filters.status);
    if (filters.billingType) params.append('billingType', filters.billingType);
    if (filters.externalReference) params.append('externalReference', filters.externalReference);
    params.append('offset', String(filters.offset || 0));
    params.append('limit', String(filters.limit || 10));

    return this.request<AsaasListResponse<AsaasPayment>>('GET', `/payments?${params.toString()}`);
  }

  /**
   * Update a payment
   */
  async updatePayment(paymentId: string, data: Partial<CreatePaymentDto>): Promise<AsaasPayment> {
    return this.request<AsaasPayment>('PUT', `/payments/${paymentId}`, data);
  }

  /**
   * Delete/Cancel a payment
   */
  async deletePayment(paymentId: string): Promise<{ deleted: boolean; id: string }> {
    return this.request<{ deleted: boolean; id: string }>('DELETE', `/payments/${paymentId}`);
  }

  /**
   * Get PIX QR Code for a payment
   */
  async getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
    return this.request<AsaasPixQrCode>('GET', `/payments/${paymentId}/pixQrCode`);
  }

  /**
   * Get bank slip line (linha digitável)
   */
  async getBankSlipLine(paymentId: string): Promise<{ identificationField: string; nossoNumero: string; barCode: string }> {
    return this.request<{ identificationField: string; nossoNumero: string; barCode: string }>(
      'GET',
      `/payments/${paymentId}/identificationField`,
    );
  }

  /**
   * Mark payment as received in cash
   */
  async receiveInCash(paymentId: string, paymentDate: string, value: number): Promise<AsaasPayment> {
    return this.request<AsaasPayment>('POST', `/payments/${paymentId}/receiveInCash`, {
      paymentDate,
      value,
    });
  }

  /**
   * Refund a payment
   */
  async refundPayment(paymentId: string, value?: number): Promise<AsaasPayment> {
    const body = value ? { value } : {};
    return this.request<AsaasPayment>('POST', `/payments/${paymentId}/refund`, body);
  }

  /**
   * Create a complete payment with all payment method details
   */
  async createCompletePayment(params: {
    customerId: string;
    value: number;
    dueDate: string;
    description: string;
    externalReference: string;
    billingType?: AsaasBillingType;
    installmentCount?: number;
    discount?: { value: number; dueDateLimitDays: number; type: 'FIXED' | 'PERCENTAGE' };
    interest?: { value: number };
    fine?: { value: number; type: 'FIXED' | 'PERCENTAGE' };
  }): Promise<PaymentCreationResult> {
    try {
      const paymentData: CreatePaymentDto = {
        customer: params.customerId,
        billingType: params.billingType || 'UNDEFINED', // UNDEFINED allows customer to choose
        value: params.value,
        dueDate: params.dueDate,
        description: params.description,
        externalReference: params.externalReference,
        discount: params.discount,
        interest: params.interest,
        fine: params.fine,
      };

      // Handle installments
      if (params.installmentCount && params.installmentCount > 1) {
        paymentData.installmentCount = params.installmentCount;
        paymentData.installmentValue = Math.ceil((params.value / params.installmentCount) * 100) / 100;
      }

      const payment = await this.createPayment(paymentData);

      const result: PaymentCreationResult = {
        success: true,
        paymentId: payment.id,
        invoiceUrl: payment.invoiceUrl,
        bankSlipUrl: payment.bankSlipUrl,
      };

      // If payment is PIX, get QR code
      if (payment.billingType === 'PIX') {
        try {
          const pixData = await this.getPixQrCode(payment.id);
          result.pixQrCode = pixData.encodedImage;
          result.pixCopyPaste = pixData.payload;
        } catch (e) {
          this.logger.warn(`Could not get PIX QR code: ${e.message}`);
        }
      }

      // If payment is BOLETO, get line
      if (payment.billingType === 'BOLETO') {
        try {
          const boletoData = await this.getBankSlipLine(payment.id);
          result.digitableLine = boletoData.identificationField;
          result.barcode = boletoData.barCode;
        } catch (e) {
          this.logger.warn(`Could not get boleto line: ${e.message}`);
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to create payment: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ==================== SUBSCRIPTION MANAGEMENT ====================

  /**
   * Create a subscription
   */
  async createSubscription(data: CreateSubscriptionDto): Promise<AsaasSubscription> {
    return this.request<AsaasSubscription>('POST', '/subscriptions', data);
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<AsaasSubscription> {
    return this.request<AsaasSubscription>('GET', `/subscriptions/${subscriptionId}`);
  }

  /**
   * Update subscription
   */
  async updateSubscription(subscriptionId: string, data: Partial<CreateSubscriptionDto>): Promise<AsaasSubscription> {
    return this.request<AsaasSubscription>('PUT', `/subscriptions/${subscriptionId}`, data);
  }

  /**
   * Delete/Cancel subscription
   */
  async deleteSubscription(subscriptionId: string): Promise<{ deleted: boolean; id: string }> {
    return this.request<{ deleted: boolean; id: string }>('DELETE', `/subscriptions/${subscriptionId}`);
  }

  /**
   * List subscription payments
   */
  async listSubscriptionPayments(subscriptionId: string): Promise<AsaasListResponse<AsaasPayment>> {
    return this.request<AsaasListResponse<AsaasPayment>>(
      'GET',
      `/subscriptions/${subscriptionId}/payments`,
    );
  }

  // ==================== INSTALLMENT MANAGEMENT ====================

  /**
   * Create installment payment
   */
  async createInstallmentPayment(params: {
    customerId: string;
    value: number;
    installmentCount: number;
    dueDate: string;
    description: string;
    externalReference: string;
    billingType?: AsaasBillingType;
  }): Promise<{ installmentId: string; payments: AsaasPayment[] }> {
    const installmentValue = Math.ceil((params.value / params.installmentCount) * 100) / 100;

    const paymentData: CreatePaymentDto = {
      customer: params.customerId,
      billingType: params.billingType || 'BOLETO',
      value: params.value,
      dueDate: params.dueDate,
      description: params.description,
      externalReference: params.externalReference,
      installmentCount: params.installmentCount,
      installmentValue,
    };

    const firstPayment = await this.createPayment(paymentData);

    // List all installment payments
    const payments = await this.listPayments({
      externalReference: params.externalReference,
      limit: params.installmentCount,
    });

    return {
      installmentId: firstPayment.id.split('_')[0], // Asaas uses format installmentId_number
      payments: payments.data,
    };
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Format date for Asaas API (YYYY-MM-DD)
   */
  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Calculate due date from today
   */
  calculateDueDate(daysFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return this.formatDate(date);
  }

  /**
   * Map payment status to internal status
   */
  mapPaymentStatus(asaasStatus: string): 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED' {
    switch (asaasStatus) {
      case 'RECEIVED':
      case 'CONFIRMED':
      case 'RECEIVED_IN_CASH':
      case 'DUNNING_RECEIVED':
        return 'PAID';
      case 'OVERDUE':
      case 'DUNNING_REQUESTED':
        return 'OVERDUE';
      case 'REFUNDED':
      case 'PARTIALLY_REFUNDED':
        return 'REFUNDED';
      case 'DELETED':
        return 'CANCELLED';
      case 'PENDING':
      case 'AWAITING_RISK_ANALYSIS':
      default:
        return 'PENDING';
    }
  }
}
