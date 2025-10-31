// Popup Manager para CopyThief
// Gerencia interface do popup e autenticação

class PopupManager {
  constructor() {
    this.init();
  }

  async init() {
    try {
      this.bindEvents();
      await this.checkAuthStatus();
      this.hideLoading();
      
      // Listener para mudanças de auth vindas do background
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "authStateChanged") {
          if (message.authenticated) {
            this.showMainSection(message.user);
          } else {
            this.showLoginSection();
          }
        }
      });
    } catch (error) {
      console.error("Popup initialization failed:", error);
      this.showError("Failed to initialize extension");
    }
  }

  bindEvents() {
    // Login
    const loginBtn = document.getElementById("login-btn");
    if (loginBtn) {
      loginBtn.addEventListener("click", () => this.handleLogin());
    }

    // Google Login
    const googleLoginBtn = document.getElementById("google-login-btn");
    if (googleLoginBtn) {
      googleLoginBtn.addEventListener("click", () => this.handleGoogleLogin());
    }

    // Logout
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => this.handleLogout());
    }



    // Platform buttons
    const platformBtns = document.querySelectorAll(".platform-btn");
    platformBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const platform = e.currentTarget.getAttribute("data-platform");
        this.handlePlatformClick(platform);
      });
    });

    // Enter key no login
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");

    if (emailInput && passwordInput) {
      [emailInput, passwordInput].forEach((input) => {
        input.addEventListener("keypress", (e) => {
          if (e.key === "Enter") {
            this.handleLogin();
          }
        });
      });
    }
  }

  async checkAuthStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "checkAuth",
      });

      if (response.authenticated) {
        this.showMainSection(response.user);
      } else {
        this.showLoginSection();
      }
    } catch (error) {
      console.error("Error checking authentication:", error);
      this.showLoginSection();
    }
  }

  async handleLogin() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const loginBtn = document.getElementById("login-btn");
    const errorDiv = document.getElementById("login-error");

    if (!email || !password) {
      this.showLoginError("Please fill in email and password");
      return;
    }

    // Show loading
    loginBtn.textContent = "Signing in...";
    loginBtn.disabled = true;
    this.hideLoginError();

    try {
      const response = await chrome.runtime.sendMessage({
        action: "login",
        data: { email, password },
      });

      if (response.success) {
        this.showMainSection(response.user);
      } else {
        this.showLoginError(response.error || "Login error");
      }
    } catch (error) {
      console.error("Erro no login:", error);
      this.showLoginError("Connection error");
    } finally {
      loginBtn.textContent = "Sign In";
      loginBtn.disabled = false;
    }
  }

  async handleGoogleLogin() {
    const googleLoginBtn = document.getElementById("google-login-btn");
    const originalText = googleLoginBtn.querySelector('.btn-text').textContent;
    
    // Show loading
    googleLoginBtn.querySelector('.btn-text').textContent = "Opening...";
    googleLoginBtn.disabled = true;
    this.hideLoginError();

    try {
      // Obtém a URL de autenticação Google
      const authUrlResponse = await chrome.runtime.sendMessage({ action: "getGoogleAuthUrl" });
      
      if (!authUrlResponse?.success || !authUrlResponse?.url) {
        throw new Error(authUrlResponse?.error || "Failed to get auth URL");
      }

      // Abre a URL em uma nova aba e armazena o ID da aba
      const tab = await chrome.tabs.create({ url: authUrlResponse.url });
      
      // Mostra mensagem para o usuário
      this.showSuccess("Complete Google login in the new tab...");
      
      // Monitora a aba de callback e a autenticação
      this.monitorGoogleAuthTab(tab.id);
    } catch (error) {
      console.error("Google login error:", error);
      this.showLoginError(error.message || "Connection error");
    } finally {
      googleLoginBtn.querySelector('.btn-text').textContent = originalText;
      googleLoginBtn.disabled = false;
    }
  }

  async monitorGoogleAuthTab(tabId) {
    // Monitora quando a aba de callback completa o login
    const checkTabAndAuth = async () => {
      try {
        // Verifica se a aba ainda está aberta
        try {
          const tab = await chrome.tabs.get(tabId);
          const url = tab.url || '';
          
          // Se a URL contém o callback, tenta sincronizar imediatamente
          if (url.includes('/auth/callback') || (url.includes('copythief.ai') && !url.includes('/auth/google'))) {
            // Aguarda um pouco para garantir que o site processou o callback
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Tenta obter auth da página primeiro (método mais confiável)
            const pageAuthResponse = await chrome.runtime.sendMessage({
              action: "getAuthFromPage",
            });

            if (pageAuthResponse.success) {
              // Fecha a aba de callback após login bem-sucedido
              try {
                await chrome.tabs.remove(tabId);
              } catch (e) {
                // Ignora erro se a aba já foi fechada
              }
              this.showMainSection(pageAuthResponse.user);
              this.showSuccess("Logged in with Google successfully!");
              return true;
            }
            
            // Fallback: tenta sincronizar via API
            const syncResponse = await chrome.runtime.sendMessage({
              action: "syncAuthFromWebsite",
            });

            if (syncResponse.success) {
              // Fecha a aba de callback após login bem-sucedido
              try {
                await chrome.tabs.remove(tabId);
              } catch (e) {
                // Ignora erro se a aba já foi fechada
              }
              this.showMainSection(syncResponse.user);
              this.showSuccess("Logged in with Google successfully!");
              return true;
            }
          }
        } catch (e) {
          // Tab pode ter sido fechada, continua verificando auth
        }

        // Tenta obter auth da página primeiro (método mais confiável)
        const pageAuthResponse = await chrome.runtime.sendMessage({
          action: "getAuthFromPage",
        });

        if (pageAuthResponse.success) {
          try {
            await chrome.tabs.remove(tabId);
          } catch (e) {
            // Ignora erro se a aba já foi fechada
          }
          this.showMainSection(pageAuthResponse.user);
          this.showSuccess("Logged in with Google successfully!");
          return true;
        }

        // Tenta sincronizar mesmo se a aba ainda estiver aberta
        const syncResponse = await chrome.runtime.sendMessage({
          action: "syncAuthFromWebsite",
        });

        if (syncResponse.success) {
          try {
            await chrome.tabs.remove(tabId);
          } catch (e) {
            // Ignora erro se a aba já foi fechada
          }
          this.showMainSection(syncResponse.user);
          this.showSuccess("Logged in with Google successfully!");
          return true;
        }

        // Verifica auth local
        const response = await chrome.runtime.sendMessage({
          action: "checkAuth",
        });

        if (response.authenticated) {
          try {
            await chrome.tabs.remove(tabId);
          } catch (e) {
            // Ignora erro se a aba já foi fechada
          }
          this.showMainSection(response.user);
          this.showSuccess("Logged in with Google successfully!");
          return true;
        }
        return false;
      } catch (error) {
        console.error("Error checking auth status:", error);
        return false;
      }
    };

    // Adiciona listener para mudanças na aba
    const tabUpdateListener = async (changedTabId, changeInfo, updatedTab) => {
      if (changedTabId === tabId && changeInfo.status === 'complete') {
        // Quando a aba termina de carregar, verifica imediatamente
        if (await checkTabAndAuth()) {
          chrome.tabs.onUpdated.removeListener(tabUpdateListener);
          clearInterval(pollInterval);
        }
      }
    };

    chrome.tabs.onUpdated.addListener(tabUpdateListener);

    // Verifica imediatamente
    if (await checkTabAndAuth()) {
      chrome.tabs.onUpdated.removeListener(tabUpdateListener);
      return;
    }

    // Polling de backup a cada 2 segundos por até 60 segundos
    let attempts = 0;
    const maxAttempts = 30;
    
    const pollInterval = setInterval(async () => {
      attempts++;
      
      if (await checkTabAndAuth() || attempts >= maxAttempts) {
        chrome.tabs.onUpdated.removeListener(tabUpdateListener);
        clearInterval(pollInterval);
        if (attempts >= maxAttempts) {
          this.showLoginError("Login timeout. Please try again.");
        }
      }
    }, 2000);
  }

  async monitorGoogleAuth() {
    // Método de fallback sem monitoramento de aba
    const checkAuth = async () => {
      try {
        const syncResponse = await chrome.runtime.sendMessage({
          action: "syncAuthFromWebsite",
        });

        if (syncResponse.success) {
          this.showMainSection(syncResponse.user);
          return true;
        }

        const response = await chrome.runtime.sendMessage({
          action: "checkAuth",
        });

        if (response.authenticated) {
          this.showMainSection(response.user);
          return true;
        }
        return false;
      } catch (error) {
        console.error("Error checking auth status:", error);
        return false;
      }
    };

    let attempts = 0;
    const maxAttempts = 15;
    
    const interval = setInterval(async () => {
      attempts++;
      
      if (await checkAuth() || attempts >= maxAttempts) {
        clearInterval(interval);
        if (attempts >= maxAttempts) {
          this.showLoginError("Login timeout. Please try again.");
        }
      }
    }, 2000);
  }

  async handleLogout() {
    try {
      const response = await chrome.runtime.sendMessage({ action: "logout" });
      if (response.success) {
        this.showLoginSection();
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  handlePlatformClick(platform) {
    const platformUrls = {
      meta: "https://www.facebook.com/ads/library/",
      tiktok: "https://ads.tiktok.com/marketing_api/docs"
    };

    const url = platformUrls[platform];
    if (url) {
      chrome.tabs.create({ url });
    }
  }

  async updateStats() {
    try {
      // Busca swipes locais
      const stats = await chrome.storage.local.get(["totalSwipes"]);
      const localSwipes = stats.totalSwipes || 0;

      // Busca swipes da API
      const apiResponse = await chrome.runtime.sendMessage({
        action: "getSwipesCount",
      });

      const totalSwipesElement = document.getElementById("total-swipes");
      if (totalSwipesElement) {
        if (apiResponse.success) {
          // Mostra swipes da API
          totalSwipesElement.textContent = apiResponse.count;
        } else {
          // Fallback para swipes locais se API falhar
          totalSwipesElement.textContent = localSwipes;
        }
      }
    } catch (error) {
      console.error("Failed to update statistics:", error);
      // Fallback para swipes locais em caso de erro
      const stats = await chrome.storage.local.get(["totalSwipes"]);
      const totalSwipesElement = document.getElementById("total-swipes");
      if (totalSwipesElement) {
        totalSwipesElement.textContent = stats.totalSwipes || 0;
      }
    }
  }

  showLoginSection() {
    document.getElementById("loading-section").style.display = "none";
    document.getElementById("main-section").style.display = "none";
    document.getElementById("login-section").style.display = "block";
  }

  showMainSection(user) {
    document.getElementById("loading-section").style.display = "none";
    document.getElementById("login-section").style.display = "none";
    document.getElementById("main-section").style.display = "flex";

    // Mostra email do usuário
    const emailAddressElement = document.querySelector(".email-address");
    if (emailAddressElement && user) {
      emailAddressElement.textContent = user.email;
    }

    // Atualiza estatísticas com dados da API
    this.updateStats();
  }

  hideLoading() {
    // Loading será escondido quando mostrar login ou main
  }

  showLoginError(message) {
    const errorDiv = document.getElementById("login-error");
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = "block";
    }
  }

  hideLoginError() {
    const errorDiv = document.getElementById("login-error");
    if (errorDiv) {
      errorDiv.style.display = "none";
    }
  }

  showSuccess(message) {
    this.showNotification(message, "success");
  }

  showError(message) {
    this.showNotification(message, "error");
  }

  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      padding: 12px 16px;
      border-radius: 6px;
      color: white;
      font-size: 14px;
      z-index: 1000;
      max-width: 280px;
      word-wrap: break-word;
      ${type === "success" ? "background: #10b981;" : "background: #ef4444;"}
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }
}

// Inicializa popup quando DOM carregar
document.addEventListener("DOMContentLoaded", () => {
  new PopupManager();
});
