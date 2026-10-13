/**
 * API Service Client for Digital Banking System
 */

// Dynamically resolve backend API endpoint
// When frontend is running on port 3000 and backend on port 5000, routes to http://localhost:5000/api
const API_BASE = window.API_BASE || (
  window.location.port !== '5000' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000/api'
    : '/api'
);

class ApiClient {
  getToken() {
    return localStorage.getItem('dbs_token');
  }

  setToken(token) {
    localStorage.setItem('dbs_token', token);
  }

  removeToken() {
    localStorage.removeItem('dbs_token');
    localStorage.removeItem('dbs_user');
  }

  getCurrentStoredUser() {
    try {
      const u = localStorage.getItem('dbs_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }

  setStoredUser(user) {
    localStorage.setItem('dbs_user', JSON.stringify(user));
  }

  generateIdempotencyKey() {
    return 'idemp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/register')) {
          this.removeToken();
          this.showToast('Session expired. Please log in again.', 'danger');
          setTimeout(() => {
            window.location.href = '/login.html';
          }, 1500);
        }
        const error = new Error(data.message || `Request failed with status ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      throw err;
    }
  }

  // Auth Endpoints
  async register(fullName, email, password) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ fullName, email, password }),
    });
  }

  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe() {
    return this.request('/auth/me', { method: 'GET' });
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore network error on logout
    }
    this.removeToken();
    window.location.href = '/login.html';
  }

  // Account Endpoints
  async getDashboard() {
    return this.request('/accounts/me/dashboard', { method: 'GET' });
  }

  async getBalance() {
    return this.request('/accounts/me/balance', { method: 'GET' });
  }

  // Transfer Endpoints
  async createTransfer({ recipientAccountNumber, amount, description, idempotencyKey }) {
    const key = idempotencyKey || this.generateIdempotencyKey();
    return this.request('/transfers', {
      method: 'POST',
      headers: {
        'Idempotency-Key': key,
      },
      body: JSON.stringify({
        recipientAccountNumber,
        amount,
        description,
        idempotencyKey: key,
      }),
    });
  }

  async getTransfers() {
    return this.request('/transfers', { method: 'GET' });
  }

  async getTransferById(id) {
    return this.request(`/transfers/${id}`, { method: 'GET' });
  }

  // Transactions Endpoints
  async getTransactions(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page);
    if (params.limit) searchParams.append('limit', params.limit);
    if (params.type && params.type !== 'all') searchParams.append('type', params.type);
    if (params.status && params.status !== 'all') searchParams.append('status', params.status);
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);

    const queryString = searchParams.toString();
    return this.request(`/transactions${queryString ? '?' + queryString : ''}`, { method: 'GET' });
  }

  // Beneficiaries Endpoints
  async getBeneficiaries() {
    return this.request('/beneficiaries', { method: 'GET' });
  }

  async addBeneficiary(accountNumber, displayName) {
    return this.request('/beneficiaries', {
      method: 'POST',
      body: JSON.stringify({ accountNumber, displayName }),
    });
  }

  async deleteBeneficiary(id) {
    return this.request(`/beneficiaries/${id}`, { method: 'DELETE' });
  }

  // Notifications Endpoints
  async getNotifications() {
    return this.request('/notifications', { method: 'GET' });
  }

  async markNotificationRead(id) {
    return this.request(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  async markAllNotificationsRead() {
    return this.request('/notifications/read-all', { method: 'PATCH' });
  }

  // Admin Endpoints
  async getAdminUsers() {
    return this.request('/admin/users', { method: 'GET' });
  }

  async updateAdminUserStatus(userId, status) {
    return this.request(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async getAdminTransfers(page = 1, limit = 20) {
    return this.request(`/admin/transfers?page=${page}&limit=${limit}`, { method: 'GET' });
  }

  async getAdminAuditLogs(page = 1, limit = 50) {
    return this.request(`/admin/audit-logs?page=${page}&limit=${limit}`, { method: 'GET' });
  }

  // UI Toast Utility
  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast alert-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'danger') icon = '⚠️';
    if (type === 'warning') icon = '🔔';

    toast.innerHTML = `<span>${icon}</span><span style="flex:1;">${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

const api = new ApiClient();
