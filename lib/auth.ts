// Chrome Extension Auth Manager for SwipeBuilder
// Based on the same Supabase configuration used in the webapp

import type { Session } from '@supabase/supabase-js';

interface AuthConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

interface User {
  id: string;
  email: string;
  created_at: string;
}

class AuthManager {
  private client: any;
  private config: AuthConfig;

  constructor() {
    // Usar as mesmas variáveis de ambiente do webapp
    this.config = {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhramlhZnZvZnNja3FxY21hdGRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAyNTcwMTEsImV4cCI6MjA2NTgzMzAxMX0.1FP59n2a3B4A2iKiKzPpbKqlXwCbyNimHujCRjzDZEI'
    };
    
    // Inicializar cliente Supabase
    this.initClient();
  }

  private initClient() {
    // Importar createBrowserClient dinamicamente
    import('@supabase/supabase-js').then(({ createClient }) => {
      this.client = createClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
    }).catch(error => {
      console.error('Failed to initialize Supabase client:', error);
    });
  }

  async login(email: string, password: string): Promise<{ user: User; session: Session }> {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }

    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    // Salvar sessão no storage local da extensão
    await this.saveSession(data.session);
    
    return data;
  }

  async logout(): Promise<void> {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }

    const { error } = await this.client.auth.signOut();
    if (error) throw error;
    
    // Limpar sessão do storage local
    await this.clearSession();
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }

    const { data: { user }, error } = await this.client.auth.getUser();
    if (error) throw error;
    return user;
  }

  async getSession(): Promise<Session | null> {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }

    const { data: { session }, error } = await this.client.auth.getSession();
    if (error) throw error;
    return session;
  }

  async refreshSession(): Promise<Session | null> {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }

    const { data: { session }, error } = await this.client.auth.refreshSession();
    if (error) throw error;
    
    if (session) {
      await this.saveSession(session);
    }
    
    return session;
  }

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }

    return this.client.auth.onAuthStateChange(callback);
  }

  private async saveSession(session: Session): Promise<void> {
    await chrome.storage.local.set({
      supabaseSession: session,
      sessionExpiry: session.expires_at ? session.expires_at * 1000 : null
    });
  }

  private async clearSession(): Promise<void> {
    await chrome.storage.local.remove(['supabaseSession', 'sessionExpiry']);
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      return !!user;
    } catch (error) {
      return false;
    }
  }

  async getAccessToken(): Promise<string | null> {
    try {
      const session = await this.getSession();
      return session?.access_token || null;
    } catch (error) {
      return null;
    }
  }
}

// Exportar instância singleton
export const authManager = new AuthManager(); 