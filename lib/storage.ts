// Chrome Extension Storage Manager for SwipeBuilder
// Handles local storage and sync operations

interface StorageData {
  totalSwipes: number;
  sessionSwipes: number;
  swipedAds: any[];
  supabaseSession: any;
  sessionExpiry: number;
  offlineQueue: any[];
  settings: {
    autoSync: boolean;
    syncInterval: number;
    maxLocalSwipes: number;
  };
}

class StorageManager {
  private defaultSettings = {
    autoSync: true,
    syncInterval: 5 * 60 * 1000, // 5 minutes
    maxLocalSwipes: 100
  };

  constructor() {
    this.initializeStorage();
  }

  private async initializeStorage() {
    try {
      const data = await chrome.storage.local.get(null);
      
      // Initialize default values if not present
      const updates: Partial<StorageData> = {};
      
      if (typeof data.totalSwipes !== 'number') {
        updates.totalSwipes = 0;
      }
      
      if (typeof data.sessionSwipes !== 'number') {
        updates.sessionSwipes = 0;
      }
      
      if (!Array.isArray(data.swipedAds)) {
        updates.swipedAds = [];
      }
      
      if (!Array.isArray(data.offlineQueue)) {
        updates.offlineQueue = [];
      }
      
      if (!data.settings) {
        updates.settings = this.defaultSettings;
      }

      if (Object.keys(updates).length > 0) {
        await chrome.storage.local.set(updates);
      }
    } catch (error) {
      console.error('Failed to initialize storage:', error);
    }
  }

  async saveLocally(key: string, value: any): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      console.error(`Failed to save ${key}:`, error);
      throw error;
    }
  }

  async getLocalData(key: string): Promise<any> {
    try {
      const result = await chrome.storage.local.get([key]);
      return result[key];
    } catch (error) {
      console.error(`Failed to get ${key}:`, error);
      throw error;
    }
  }

  async getAllData(): Promise<StorageData> {
    try {
      return await chrome.storage.local.get(null) as StorageData;
    } catch (error) {
      console.error('Failed to get all data:', error);
      throw error;
    }
  }

  async clearLocalData(): Promise<void> {
    try {
      await chrome.storage.local.clear();
      console.log('Local storage cleared');
    } catch (error) {
      console.error('Failed to clear local data:', error);
      throw error;
    }
  }

  async queueForSync(data: any): Promise<void> {
    try {
      const queue = await this.getLocalData('offlineQueue') || [];
      queue.push({
        ...data,
        timestamp: Date.now(),
        id: Date.now().toString()
      });

      // Keep queue size manageable
      if (queue.length > 50) {
        queue.splice(0, queue.length - 50);
      }

      await this.saveLocally('offlineQueue', queue);
      console.log('Data queued for sync:', data);
    } catch (error) {
      console.error('Failed to queue data for sync:', error);
      throw error;
    }
  }

  async getOfflineQueue(): Promise<any[]> {
    try {
      return await this.getLocalData('offlineQueue') || [];
    } catch (error) {
      console.error('Failed to get offline queue:', error);
      return [];
    }
  }

  async clearOfflineQueue(): Promise<void> {
    try {
      await this.saveLocally('offlineQueue', []);
      console.log('Offline queue cleared');
    } catch (error) {
      console.error('Failed to clear offline queue:', error);
      throw error;
    }
  }

  async updateStats(increment: number = 1): Promise<void> {
    try {
      const stats = await chrome.storage.local.get(['totalSwipes', 'sessionSwipes']);
      
      await chrome.storage.local.set({
        totalSwipes: (stats.totalSwipes || 0) + increment,
        sessionSwipes: (stats.sessionSwipes || 0) + increment
      });
    } catch (error) {
      console.error('Failed to update stats:', error);
      throw error;
    }
  }

  async getStats(): Promise<{ totalSwipes: number; sessionSwipes: number }> {
    try {
      const stats = await chrome.storage.local.get(['totalSwipes', 'sessionSwipes']);
      return {
        totalSwipes: stats.totalSwipes || 0,
        sessionSwipes: stats.sessionSwipes || 0
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return { totalSwipes: 0, sessionSwipes: 0 };
    }
  }

  async saveSwipe(swipeData: any): Promise<void> {
    try {
      const swipes = await this.getLocalData('swipedAds') || [];
      swipes.push({
        ...swipeData,
        id: Date.now().toString(),
        timestamp: Date.now()
      });

      // Keep only recent swipes
      const settings = await this.getLocalData('settings') || this.defaultSettings;
      if (swipes.length > settings.maxLocalSwipes) {
        swipes.splice(0, swipes.length - settings.maxLocalSwipes);
      }

      await this.saveLocally('swipedAds', swipes);
      await this.updateStats();
    } catch (error) {
      console.error('Failed to save swipe:', error);
      throw error;
    }
  }

  async getSwipes(): Promise<any[]> {
    try {
      return await this.getLocalData('swipedAds') || [];
    } catch (error) {
      console.error('Failed to get swipes:', error);
      return [];
    }
  }

  async saveSession(session: any): Promise<void> {
    try {
      await this.saveLocally('supabaseSession', session);
      await this.saveLocally('sessionExpiry', Date.now() + (session.expires_in * 1000));
    } catch (error) {
      console.error('Failed to save session:', error);
      throw error;
    }
  }

  async getSession(): Promise<any> {
    try {
      const session = await this.getLocalData('supabaseSession');
      const expiry = await this.getLocalData('sessionExpiry');
      
      if (session && expiry && Date.now() < expiry) {
        return session;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  async clearSession(): Promise<void> {
    try {
      await chrome.storage.local.remove(['supabaseSession', 'sessionExpiry']);
    } catch (error) {
      console.error('Failed to clear session:', error);
      throw error;
    }
  }

  async getSettings(): Promise<any> {
    try {
      return await this.getLocalData('settings') || this.defaultSettings;
    } catch (error) {
      console.error('Failed to get settings:', error);
      return this.defaultSettings;
    }
  }

  async updateSettings(newSettings: Partial<any>): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...newSettings };
      await this.saveLocally('settings', updatedSettings);
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  }

  async isStorageAvailable(): Promise<boolean> {
    try {
      await chrome.storage.local.get('test');
      return true;
    } catch (error) {
      console.error('Storage not available:', error);
      return false;
    }
  }

  async getStorageUsage(): Promise<{ used: number; total: number }> {
    try {
      const data = await chrome.storage.local.get(null);
      const used = JSON.stringify(data).length;
      
      // Chrome storage limit is typically 5MB
      const total = 5 * 1024 * 1024; // 5MB in bytes
      
      return { used, total };
    } catch (error) {
      console.error('Failed to get storage usage:', error);
      return { used: 0, total: 0 };
    }
  }
}

// Exportar instância singleton
export const storageManager = new StorageManager(); 