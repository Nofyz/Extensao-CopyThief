// Background script para CopyThief
// Gerencia autenticação e comunicação com a API

console.log("[CopyThief] Background script carregado");

class CopyThiefBackground {
  constructor() {
    // Configuração da extensão
    this.apiBaseUrl = "https://copythief.ai"; // URL da API principal
    // URL do serviço de vídeo (AWS Lambda) - pode ser sobrescrito via chrome.storage
    // Para desenvolvimento local, use: "http://localhost:4000"
    // Para produção, será: "https://copythief.ai" (mesma URL, roteado pelo backend)
    this.videoApiUrl = "https://5ab40bnfwi.execute-api.us-east-1.amazonaws.com/dev"; 
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
      if (request.action === "getGoogleAuthUrl") {
        this.getGoogleAuthUrl().then(sendResponse);
        return true;
      }
      if (request.action === "syncAuthFromWebsite") {
        this.syncAuthFromWebsite().then(sendResponse);
        return true;
      }
      if (request.action === "getFolders") {
        this.getFolders().then(sendResponse);
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
      return { success: false, error: "Connection error" };
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
        return { success: false, error: "User not authenticated" };
      }

      // Obtém token de acesso
      const { accessToken } = await chrome.storage.local.get(["accessToken"]);
      console.log(swipeData);

      // Verifica se é vídeo e tem videoUrl - usa o novo serviço de vídeo
      if (swipeData.adType === "VIDEO" && swipeData.videoUrl) {
        console.log("[CopyThief] Detectado vídeo, usando serviço de upload para S3");
        
        // Prepara dados para o serviço de vídeo
        const videoApiData = {
          video_src: swipeData.videoUrl,
          poster: swipeData.thumbnailUrl || swipeData.imageUrl || undefined,
          title: swipeData.title || "Untitled ad",
          platform_url: swipeData.url || swipeData.platformUrl || "",
          platform: swipeData.platform || "META_FACEBOOK",
          adType: swipeData.adType,
          description: swipeData.description || undefined,
          copyText: swipeData.copyText || undefined,
          callToAction: swipeData.callToAction || undefined,
          landingPageUrl: swipeData.landingPageUrl || undefined,
          platformAdId: swipeData.platformAdId || undefined,
          iconUrl: swipeData.iconUrl || undefined,
          folderId: swipeData.folderId || undefined,
          timestamp: swipeData.timestamp || new Date().toISOString(),
          metadata: swipeData.metadata || {},
        };

        // Log detalhado do que está sendo enviado
        console.log("=== DADOS ENVIADOS PARA SERVIÇO DE VÍDEO ===");
        console.log("URL da API:", `${this.videoApiUrl}/api/save-video`);
        console.log("Dados enviados:", JSON.stringify(videoApiData, null, 2));
        console.log("============================================");

        try {
          // Envia para o serviço de vídeo (AWS Lambda)
          const response = await fetch(`${this.videoApiUrl}/api/save-video`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(videoApiData),
          });

          const result = await response.json();

          // Log da resposta da API
          console.log("=== RESPOSTA DO SERVIÇO DE VÍDEO ===");
          console.log("Status:", response.status);
          console.log("Resposta:", JSON.stringify(result, null, 2));
          console.log("====================================");

          if (response.ok && result.success) {
            console.log("[CopyThief] Vídeo salvo no S3 e metadados salvos no Supabase:", result);
            // O serviço já salvou no Supabase, retorna sucesso com o swipe
            return { 
              success: true, 
              swipe: result.swipe,
              // Inclui a URL do S3 na resposta
              s3VideoUrl: result.swipe.content_url,
              s3ThumbnailUrl: result.swipe.thumbnail_url
            };
          } else {
            console.error("[CopyThief] Erro ao salvar vídeo:", result);
            return {
              success: false,
              error: result.error || "Erro ao salvar vídeo",
            };
          }
        } catch (videoError) {
          console.error("[CopyThief] Erro ao chamar serviço de vídeo:", videoError);
          // Se o serviço de vídeo falhar, tenta salvar normalmente (fallback)
          console.log("[CopyThief] Tentando salvar como swipe normal (fallback)");
          // Continua para o código de fallback abaixo
        }
      }

      // Fluxo para IMAGEM: envia para o mesmo serviço novo (S3 + Supabase)
      if (swipeData.adType === "IMAGE" && (swipeData.imageUrl || swipeData.contentUrl)) {
        console.log("[CopyThief] Detectada imagem, usando serviço de upload para S3");

        const imgSrc = swipeData.imageUrl || swipeData.contentUrl;
        const imageApiData = {
          image_url: imgSrc,
          title: swipeData.title || "Untitled",
          platform_url: swipeData.url || swipeData.platformUrl || "",
          platform: swipeData.platform || "META_FACEBOOK",
          adType: "IMAGE",
          description: swipeData.description || undefined,
          copyText: swipeData.copyText || undefined,
          callToAction: swipeData.callToAction || undefined,
          landingPageUrl: swipeData.landingPageUrl || undefined,
          platformAdId: swipeData.platformAdId || undefined,
          iconUrl: swipeData.iconUrl || undefined,
          folderId: swipeData.folderId || undefined,
          timestamp: swipeData.timestamp || new Date().toISOString(),
          metadata: swipeData.metadata || {},
        };

        console.log("=== DADOS ENVIADOS PARA SERVIÇO DE IMAGEM ===");
        console.log("URL da API:", `${this.videoApiUrl}/api/save-video`);
        console.log("Dados enviados:", JSON.stringify(imageApiData, null, 2));
        console.log("=============================================");

        const response = await fetch(`${this.videoApiUrl}/api/save-video`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(imageApiData),
        });

        const result = await response.json();

        console.log("=== RESPOSTA DO SERVIÇO DE IMAGEM ===");
        console.log("Status:", response.status);
        console.log("Resposta:", JSON.stringify(result, null, 2));
        console.log("=====================================");

        if (response.ok && result.success) {
          console.log("[CopyThief] Imagem salva no S3 e metadados salvos no Supabase:", result);
          return { success: true, swipe: result.swipe };
        }

        console.error("[CopyThief] Erro ao salvar imagem:", result);
        return { success: false, error: result.error || "Erro ao salvar imagem" };
      }

      // Fallback final: mantém compatibilidade se não for VIDEO nem IMAGE com fontes válidas
      const apiData = {
        title: swipeData.title || "Untitled ad",
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
        folderId: swipeData.folderId || undefined,
      };

      console.log("=== DADOS ENVIADOS PARA API (FALLBACK LEGADO) ===");
      console.log("URL da API:", `${this.apiBaseUrl}/api/swipes`);
      console.log("Dados enviados:", JSON.stringify(apiData, null, 2));
      console.log("================================================");

      const response = await fetch(`${this.apiBaseUrl}/api/swipes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(apiData),
      });

      const result = await response.json();

      console.log("=== RESPOSTA DA API (FALLBACK LEGADO) ===");
      console.log("Status:", response.status);
      console.log("Resposta:", JSON.stringify(result, null, 2));
      console.log("=========================================");

      if (response.ok) {
        return { success: true, swipe: result.swipe };
      }
      return { success: false, error: result.error || "Erro ao salvar swipe" };
    } catch (error) {
      console.error("[CopyThief] Erro ao salvar swipe:", error);
      return { success: false, error: "Connection error" };
    }
  }

  async getSwipesCount() {
    try {
      console.log("[CopyThief] Buscando contagem de swipes...");

      // Verifica autenticação
      const authResult = await this.checkAuth();
      if (!authResult.authenticated) {
        return { success: false, error: "User not authenticated" };
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
      return { success: false, error: "Connection error" };
    }
  }

  async getGoogleAuthUrl() {
    try {
      console.log("[CopyThief] Gerando URL de autenticação Google via API...");

      // Usa a API do Supabase para gerar a URL de autenticação Google
      const response = await fetch(`${this.apiBaseUrl}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          redirectTo: `${this.apiBaseUrl}/auth/callback`
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log("[CopyThief] URL de autenticação gerada:", data.url);
        return { success: true, url: data.url };
      } else {
        const errorData = await response.json();
        console.error("[CopyThief] Erro ao gerar URL de autenticação:", response.status, errorData);
        return { success: false, error: errorData.error || "Failed to generate auth URL" };
      }
    } catch (error) {
      console.error("[CopyThief] Erro ao gerar URL de autenticação:", error);
      return { success: false, error: "Connection error" };
    }
  }

  async syncAuthFromWebsite() {
    try {
      console.log("[CopyThief] Sincronizando autenticação do website...");

      // Tenta obter os tokens diretamente do callback do OAuth
      // Primeiro, verifica se há uma sessão ativa no website
      const response = await fetch(`${this.apiBaseUrl}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // Inclui cookies da sessão
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.data && data.data.session) {
          // Obtém informações do usuário
          const userResponse = await fetch(`${this.apiBaseUrl}/api/auth/me`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${data.data.session.access_token}`,
              'Content-Type': 'application/json',
            },
          });

          let user = null;
          if (userResponse.ok) {
            const userData = await userResponse.json();
            user = userData.data.user;
          }

          // Salva os tokens no storage da extensão
          await chrome.storage.local.set({
            accessToken: data.data.session.access_token,
            refreshToken: data.data.session.refresh_token,
            expiresAt: data.data.session.expires_at,
            user: user || { email: 'user@example.com' }, // Fallback se não conseguir obter dados do usuário
          });

          console.log("[CopyThief] Autenticação sincronizada com sucesso");
          return { success: true, user: user || { email: 'user@example.com' } };
        }
      }

      return { success: false, error: "No active session found" };
    } catch (error) {
      console.error("[CopyThief] Erro ao sincronizar autenticação:", error);
      return { success: false, error: "Connection error" };
    }
  }

  async getFolders() {
    try {
      console.log("[CopyThief] Buscando pastas do usuário...");

      // Verifica autenticação
      const authResult = await this.checkAuth();
      if (!authResult.authenticated) {
        return { success: false, error: "User not authenticated" };
      }

      // Obtém token de acesso
      const { accessToken } = await chrome.storage.local.get(["accessToken"]);

      // Busca pastas diretamente do Supabase
      const supabaseUrl = "https://hkjiafvofsckqqcmadtf.supabase.co";
      const response = await fetch(`${supabaseUrl}/rest/v1/folders?select=id,name,account_id`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhramlhZnZvZnNja3FxY21hdGRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAyNTcwMTEsImV4cCI6MjA2NTgzMzAxMX0.1FP59n2a3B4A2iKiKzPpbKqlXwCbyNimHujCRjzDZEI"
        },
      });

      if (response.ok) {
        const folders = await response.json();
        console.log("[CopyThief] Pastas encontradas:", folders);
        return { success: true, folders: folders || [] };
      } else {
        console.error("[CopyThief] Erro ao buscar pastas:", response.status, await response.text());
        return { success: false, error: "Erro ao buscar pastas" };
      }
    } catch (error) {
      console.error("[CopyThief] Erro ao buscar pastas:", error);
      return { success: false, error: "Connection error" };
    }
  }
}

// Inicializa o background script
new CopyThiefBackground();
