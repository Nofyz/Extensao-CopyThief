// Background script para CopyThief
// Gerencia autenticação e comunicação com a API

console.log("[CopyThief] Background script carregado");

class CopyThiefBackground {
  constructor() {
    // Configuração da extensão
    this.apiBaseUrl = "https://copythief.ai"; // URL da API
    this.debug = true;
    this.requestTimeout = 10000;

    this.init();
  }

  async init() {
    this.bindMessageListener();
    await this.checkAuth();
  }

  bindMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "saveSwipe") {
        this.saveSwipe(request.data).then(sendResponse);
        return true;
      }
      if (request.action === "login") {
        this.login(request.data).then(sendResponse);
        return true;
      }
      if (request.action === "logout") {
        this.logout().then(sendResponse);
        return true;
      }
      if (request.action === "checkAuth") {
        this.checkAuth().then(sendResponse);
        return true;
      }
      if (request.action === "getSwipesCount") {
        this.getSwipesCount().then(sendResponse);
        return true;
      }
    });
  }

  async login(credentials) {
    try {
      console.log("[CopyThief] Fazendo login...");

      const response = await fetch(`${this.apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Salva tokens no storage
        await chrome.storage.local.set({
          accessToken: data.data.session.access_token,
          refreshToken: data.data.session.refresh_token,
          expiresAt: data.data.session.expires_at,
          user: data.data.user,
        });

        console.log("[CopyThief] Login realizado com sucesso");
        return { success: true, user: data.data.user };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("[CopyThief] Erro no login:", error);
      return { success: false, error: "Erro de conexão" };
    }
  }

  async logout() {
    try {
      const { accessToken } = await chrome.storage.local.get(["accessToken"]);

      if (accessToken) {
        await fetch(`${this.apiBaseUrl}/api/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
      }

      // Limpa tokens do storage
      await chrome.storage.local.remove([
        "accessToken",
        "refreshToken",
        "expiresAt",
        "user",
      ]);

      return { success: true };
    } catch (error) {
      console.error("[CopyThief] Erro no logout:", error);
      return { success: false, error: "Erro no logout" };
    }
  }

  async checkAuth() {
    try {
      const { accessToken, expiresAt } = await chrome.storage.local.get([
        "accessToken",
        "expiresAt",
      ]);

      if (!accessToken) {
        return { authenticated: false };
      }

      // Verifica se o token expirou
      if (expiresAt && Date.now() > expiresAt * 1000) {
        console.log("[CopyThief] Token expirado, tentando renovar...");
        const refreshResult = await this.refreshToken();
        if (!refreshResult.success) {
          return { authenticated: false };
        }
      }

      // Verifica se o token ainda é válido
      const response = await fetch(`${this.apiBaseUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return { authenticated: true, user: data.data.user };
      } else {
        return { authenticated: false };
      }
    } catch (error) {
      console.error("[CopyThief] Erro ao verificar auth:", error);
      return { authenticated: false };
    }
  }

  async refreshToken() {
    try {
      const { refreshToken } = await chrome.storage.local.get(["refreshToken"]);

      if (!refreshToken) {
        return { success: false };
      }

      const response = await fetch(`${this.apiBaseUrl}/api/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Atualiza tokens no storage
        await chrome.storage.local.set({
          accessToken: data.data.session.access_token,
          refreshToken: data.data.session.refresh_token,
          expiresAt: data.data.session.expires_at,
        });

        return { success: true };
      } else {
        return { success: false };
      }
    } catch (error) {
      console.error("[CopyThief] Erro ao renovar token:", error);
      return { success: false };
    }
  }

  async saveSwipe(swipeData) {
    try {
      console.log("[CopyThief] Salvando swipe:", swipeData);

      // Verifica autenticação
      const authResult = await this.checkAuth();
      if (!authResult.authenticated) {
        return { success: false, error: "Usuário não autenticado" };
      }

      // Obtém token de acesso
      const { accessToken } = await chrome.storage.local.get(["accessToken"]);
      console.log(swipeData);
      // Prepara dados para a API conforme documentação
      const apiData = {
        title: swipeData.title || "Anúncio sem título",
        platform: swipeData.platform,
        description: swipeData.description || "",
        url: swipeData.url,
        imageUrl: swipeData.imageUrl || undefined,
        timestamp: swipeData.timestamp,
        tags: swipeData.tags || [],
        contentUrl: swipeData.contentUrl || undefined,
        thumbnailUrl: swipeData.contentUrl || undefined,
        copyText: swipeData.copyText || undefined,
        callToAction: swipeData.callToAction || undefined,
        landingPageUrl: swipeData.landingPageUrl || undefined,
        adType: swipeData.adType || undefined,
        platformAdId: swipeData.platformAdId || undefined,
        platformUrl: swipeData.platformUrl || undefined,
        iconUrl: swipeData.iconUrl || undefined,
        metadata: swipeData.metadata || {},
      };

      // Log detalhado do que está sendo enviado
      console.log("=== DADOS ENVIADOS PARA API ===");
      console.log("URL da API:", `${this.apiBaseUrl}/api/swipes`);
      console.log("Dados enviados:", JSON.stringify(apiData, null, 2));
      console.log("================================");

      // Envia para a API
      const response = await fetch(`${this.apiBaseUrl}/api/swipes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(apiData),
      });

      const result = await response.json();

      // Log da resposta da API
      console.log("=== RESPOSTA DA API ===");
      console.log("Status:", response.status);
      console.log("Resposta:", JSON.stringify(result, null, 2));
      console.log("========================");

      if (response.ok) {
        console.log("[CopyThief] Swipe salvo com sucesso:", result);
        return { success: true, swipe: result.swipe };
      } else {
        console.error("[CopyThief] Erro ao salvar swipe:", result);
        return {
          success: false,
          error: result.error || "Erro ao salvar swipe",
        };
      }
    } catch (error) {
      console.error("[CopyThief] Erro ao salvar swipe:", error);
      return { success: false, error: "Erro de conexão" };
    }
  }

  async getSwipesCount() {
    try {
      console.log("[CopyThief] Buscando contagem de swipes...");

      // Verifica autenticação
      const authResult = await this.checkAuth();
      if (!authResult.authenticated) {
        return { success: false, error: "Usuário não autenticado" };
      }

      // Obtém token de acesso
      const { accessToken } = await chrome.storage.local.get(["accessToken"]);

      // Busca swipes da API
      const response = await fetch(`${this.apiBaseUrl}/api/swipes`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const swipesCount = data.swipes ? data.swipes.length : 0;

        console.log("[CopyThief] Total de swipes na API:", swipesCount);
        return { success: true, count: swipesCount };
      } else {
        console.error("[CopyThief] Erro ao buscar swipes:", response.status);
        return { success: false, error: "Erro ao buscar swipes" };
      }
    } catch (error) {
      console.error("[CopyThief] Erro ao buscar contagem de swipes:", error);
      return { success: false, error: "Erro de conexão" };
    }
  }
}

// Inicializa o background script
new CopyThiefBackground();
