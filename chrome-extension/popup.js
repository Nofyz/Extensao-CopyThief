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
      // 1) Obtenha a URL de início com redirect da extensão
      const start = await chrome.runtime.sendMessage({ action: "getGoogleAuthStartUrl" });
      if (!start?.success || !start?.url) {
        throw new Error(start?.error || "Failed to get auth URL");
      }

      // 2) Abra o fluxo via identity mantendo o gesto do usuário
      const redirectUrl = await chrome.identity.launchWebAuthFlow({ url: start.url, interactive: true });

      // 3) Parse dos params de retorno
      const params = this.parseParamsFromUrl(redirectUrl);

      // 4) Solicita ao background para completar/armazenar sessão
      const result = await chrome.runtime.sendMessage({ action: "completeGoogleLogin", data: { params, redirectUri: start.redirectUri } });
      if (result?.success) {
        this.showMainSection(result.user);
        this.showSuccess("Logged in with Google");
        return;
      }

      // 5) Tenta sincronizar via cookies (sem abrir nova aba) por ~10s
      const pollTry = async () => {
        const sync = await chrome.runtime.sendMessage({ action: "syncAuthFromWebsite" });
        if (sync?.success) {
          this.showMainSection(sync.user);
          this.showSuccess("Logged in with Google");
          return true;
        }
        const check = await chrome.runtime.sendMessage({ action: "checkAuth" });
        if (check?.authenticated) {
          this.showMainSection(check.user);
          this.showSuccess("Logged in with Google");
          return true;
        }
        return false;
      };

      let ok = false; let attempts = 0;
      while (attempts < 5 && !ok) { // ~10s
        // eslint-disable-next-line no-await-in-loop
        ok = await pollTry();
        // eslint-disable-next-line no-await-in-loop
        if (!ok) await new Promise(r => setTimeout(r, 2000));
        attempts++;
      }
      if (ok) return;

      // 6) Último fallback: abre a URL de login do backend em uma aba e monitora
      const authUrl = await chrome.runtime.sendMessage({ action: "getGoogleAuthUrl" });
      if (authUrl?.success && authUrl?.url) {
        chrome.tabs.create({ url: authUrl.url });
        this.monitorGoogleAuth();
        this.showSuccess("Complete Google login in the new tab...");
      } else {
        this.showLoginError(result?.error || authUrl?.error || "Failed to login with Google");
      }
    } catch (error) {
      console.error("Google login error:", error);
      this.showLoginError("Connection error");
    } finally {
      googleLoginBtn.querySelector('.btn-text').textContent = originalText;
      googleLoginBtn.disabled = false;
    }
  }

  parseParamsFromUrl(url) {
    try {
      const hasHash = url.includes('#');
      const queryString = hasHash ? url.split('#')[1] : (url.split('?')[1] || "");
      const params = new URLSearchParams(queryString);
      const obj = {};
      params.forEach((v, k) => { obj[k] = v; });
      return obj;
    } catch (_e) {
      return {};
    }
  }

  async monitorGoogleAuth() {
    // Verifica periodicamente se o usuário foi autenticado
    const checkAuth = async () => {
      try {
        // Primeiro tenta sincronizar com o website
        const syncResponse = await chrome.runtime.sendMessage({
          action: "syncAuthFromWebsite",
        });

        if (syncResponse.success) {
          this.showMainSection(syncResponse.user);
          return true;
        }

        // Se não conseguiu sincronizar, verifica o auth local
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

    // Verifica a cada 2 segundos por até 30 segundos
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
