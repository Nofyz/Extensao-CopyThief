// Chrome Extension API Client for SwipeBuilder
// Handles communication with the webapp API

import { authManager } from './auth';

interface SwipeData {
  title: string;
  description?: string;
  platform: string;
  url: string;
  imageUrl?: string;
  videoUrl?: string;
  timestamp: string;
  tags?: string[];
}

interface SwipeResponse {
  id: string;
  platform: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface UploadResponse {
  url: string;
  path: string;
}

class SwipeAPI {
  private baseUrl: string;

  constructor() {
    // Usar a URL base do webapp
    this.baseUrl = 'https://copythief.ai';
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = await authManager.getAccessToken();
    
    if (!token) {
      throw new Error('No authentication token available');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async saveSwipe(swipeData: SwipeData): Promise<SwipeResponse> {
    try {
      console.log('Attempting to save swipe with data:', swipeData);
      console.log('API URL:', `${this.baseUrl}/api/swipes`);
      
      const headers = await this.getAuthHeaders();
      console.log('Auth headers:', headers);
      
      const response = await fetch(`${this.baseUrl}/api/swipes`, {
        method: 'POST',
        headers,
        body: JSON.stringify(swipeData)
      });

      const responseBody = await response.text();
      console.log('saveSwipe response status:', response.status, 'body:', responseBody);
      if (!response.ok) {
        throw new Error(responseBody);
      }

      return JSON.parse(responseBody);
    } catch (error) {
      console.error('Failed to save swipe:', error);
      throw error;
    }
  }

  async uploadMedia(file: File): Promise<UploadResponse> {
    try {
      const token = await authManager.getAccessToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${this.baseUrl}/api/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to upload media:', error);
      throw error;
    }
  }

  async uploadFromUrl(url: string, filename?: string): Promise<UploadResponse> {
    try {
      // Download the file from URL
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file from URL: ${response.statusText}`);
      }

      const blob = await response.blob();
      const file = new File([blob], filename || 'media.jpg', { type: blob.type });
      
      return await this.uploadMedia(file);
    } catch (error) {
      console.error('Failed to upload from URL:', error);
      throw error;
    }
  }

  async getSwipes(): Promise<SwipeResponse[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.baseUrl}/api/swipes`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.swipes || [];
    } catch (error) {
      console.error('Failed to get swipes:', error);
      throw error;
    }
  }

  async deleteSwipe(swipeId: string): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.baseUrl}/api/swipes/${swipeId}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to delete swipe:', error);
      throw error;
    }
  }

  async syncOfflineSwipes(offlineSwipes: SwipeData[]): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.baseUrl}/api/swipes/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ swipes: offlineSwipes })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to sync offline swipes:', error);
      throw error;
    }
  }

  async getAccountInfo(): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.baseUrl}/api/account`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to get account info:', error);
      throw error;
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET'
      });
      
      return response.ok;
    } catch (error) {
      console.error('Connection check failed:', error);
      return false;
    }
  }
}

// Exportar instância singleton
export const swipeAPI = new SwipeAPI(); 