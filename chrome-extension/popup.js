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
      console.error("Falha na inicialização do popup:", error);
      this.showError("Falha ao inicializar extensão");
    }
  }

  bindEvents() {
    // Login
    const loginBtn = document.getElementById("login-btn");
    if (loginBtn) {
      loginBtn.addEventListener("click", () => this.handleLogin());
    }

    // Logout
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => this.handleLogout());
    }

    // Swipe button
    const swipeBtn = document.getElementById("swipe-btn");
    if (swipeBtn) {
      swipeBtn.addEventListener("click", () => this.handleSwipe());
    }

    // Dashboard link
    const dashboardLink = document.querySelector(".dashboard-link");
    if (dashboardLink) {
      dashboardLink.addEventListener("click", () => {
        chrome.tabs.create({ url: "http://localhost:3000/dashboard" });
      });
    }

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
      console.error("Erro ao verificar autenticação:", error);
      this.showLoginSection();
    }
  }

  async handleLogin() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const loginBtn = document.getElementById("login-btn");
    const errorDiv = document.getElementById("login-error");

    if (!email || !password) {
      this.showLoginError("Preencha email e senha");
      return;
    }

    // Mostra loading
    loginBtn.textContent = "Entrando...";
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
        this.showLoginError(response.error || "Erro no login");
      }
    } catch (error) {
      console.error("Erro no login:", error);
      this.showLoginError("Erro de conexão");
    } finally {
      loginBtn.textContent = "Entrar";
      loginBtn.disabled = false;
    }
  }

  async handleLogout() {
    try {
      const response = await chrome.runtime.sendMessage({ action: "logout" });
      if (response.success) {
        this.showLoginSection();
      }
    } catch (error) {
      console.error("Erro no logout:", error);
    }
  }

  async handleSwipe() {
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id) {
        this.showError("Nenhuma aba ativa encontrada");
        return;
      }

      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "swipeAd",
      });

      if (response && response.success) {
        await this.updateStats();
        this.showSuccess("Anúncio salvo com sucesso!");
      } else {
        this.showError(response?.error || "Falha ao salvar anúncio");
      }
    } catch (error) {
      console.error("Falha no swipe:", error);
      this.showError("Nenhum anúncio detectado nesta página");
    }
  }

  async updateStats() {
    try {
      const stats = await chrome.storage.local.get(["totalSwipes"]);

      const totalSwipesElement = document.getElementById("total-swipes");
      if (totalSwipesElement) {
        totalSwipesElement.textContent = stats.totalSwipes || 0;
      }
    } catch (error) {
      console.error("Falha ao atualizar estatísticas:", error);
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
    document.getElementById("main-section").style.display = "block";

    // Mostra email do usuário
    const userEmailElement = document.getElementById("user-email");
    if (userEmailElement && user) {
      userEmailElement.textContent = user.email;
    }

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
