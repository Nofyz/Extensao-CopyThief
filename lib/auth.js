// Chrome Extension Auth Manager for SwipeBuilder
// Simple version without ES6 modules

(function () {
  'use strict';

  // Global auth manager instance
  let authManagerInstance = null;

  function AuthManager() {
    // Usar as mesmas variáveis de ambiente do webapp
    this.config = {
      supabaseUrl: 'http://localhost:54321',
      supabaseAnonKey:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    };

    // Inicializar cliente Supabase
    this.initClient();
  }

  AuthManager.prototype.initClient = function () {
    var self = this;
    // For now, just log that we're trying to initialize
    console.log(
      '[SwipeBuilder] Auth manager initialized (Supabase client will be loaded when needed)',
    );
  };

  AuthManager.prototype.login = function (email, password) {
    console.log('[SwipeBuilder] Login attempt:', email);
    // For now, return a mock response
    return Promise.resolve({
      user: { id: 'mock-user-id', email: email },
      session: { access_token: 'mock-token' },
    });
  };

  AuthManager.prototype.logout = function () {
    console.log('[SwipeBuilder] Logout');
    return this.clearSession();
  };

  AuthManager.prototype.getCurrentUser = function () {
    console.log('[SwipeBuilder] Getting current user');
    // For now, return null (not authenticated)
    return Promise.resolve(null);
  };

  AuthManager.prototype.getSession = function () {
    console.log('[SwipeBuilder] Getting session');
    // For now, return null (no session)
    return Promise.resolve(null);
  };

  AuthManager.prototype.refreshSession = function () {
    console.log('[SwipeBuilder] Refreshing session');
    return Promise.resolve(null);
  };

  AuthManager.prototype.onAuthStateChange = function (callback) {
    console.log('[SwipeBuilder] Auth state change listener registered');
    // For now, do nothing
  };

  AuthManager.prototype.saveSession = function (session) {
    console.log('[SwipeBuilder] Saving session');
    return chrome.storage.local.set({
      supabaseSession: session,
      sessionExpiry: session.expires_at ? session.expires_at * 1000 : null,
    });
  };

  AuthManager.prototype.clearSession = function () {
    console.log('[SwipeBuilder] Clearing session');
    return chrome.storage.local.remove(['supabaseSession', 'sessionExpiry']);
  };

  AuthManager.prototype.isAuthenticated = function () {
    console.log('[SwipeBuilder] Checking authentication');
    return Promise.resolve(false);
  };

  AuthManager.prototype.getAccessToken = function () {
    console.log('[SwipeBuilder] Getting access token');
    // For now, return null (no token)
    return Promise.resolve(null);
  };

  // Create singleton instance
  authManagerInstance = new AuthManager();

  // Make it available globally
  if (typeof window !== 'undefined') {
    window.authManager = authManagerInstance;
  }

  // Also make it available for background script
  if (typeof globalThis !== 'undefined') {
    globalThis.authManager = authManagerInstance;
  }

  console.log('[SwipeBuilder] Auth manager loaded successfully');
})();
