// Background script para CopyThief
// Gerencia autenticação e comunicação com a API

class CopyThiefBackground {
  constructor() {
    // Configuração da extensão
    this.apiBaseUrl = "https://copythief.ai"; // URL da API principal
    // URL do serviço de vídeo (AWS Lambda) - pode ser sobrescrito via chrome.storage
    // Para desenvolvimento local, use: "http://localhost:4000"
    // Para produção, será: "https://copythief.ai" (mesma URL, roteado pelo backend)
    this.videoApiUrl = "https://p625iryn4j.execute-api.us-east-1.amazonaws.com/prod"; 
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
      if (request.action === "getAuthFromPage") {
        this.getAuthFromPage().then(sendResponse);
        return true;
      }
      if (request.action === "authDetectedOnPage") {
        this.handleAuthDetected(request.session, request.user).then(sendResponse);
        return true;
      }
    });
  }

  async login(credentials) {
    try {
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

  async persistSession(session, user) {
    if (!session || !session.access_token) {
      return null;
    }

    const normalizedUser = user || { email: "user@example.com" };

    await chrome.storage.local.set({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at,
      user: normalizedUser,
    });

    chrome.runtime
      .sendMessage({
        action: "authStateChanged",
        authenticated: true,
        user: normalizedUser,
      })
      .catch(() => {
        // Nenhum listener aberto - ignorar
      });

    return normalizedUser;
  }

  parseSessionPayload(rawValue) {
    if (!rawValue || typeof rawValue !== "string") {
      return null;
    }

    const attempts = [rawValue];
    if (rawValue.startsWith("base64-")) {
      try {
        const decoded = atob(rawValue.slice("base64-".length));
        attempts.push(decoded);
      } catch (error) {
        console.debug("[CopyThief] parseSessionPayload: failed to decode base64 payload", error?.message);
      }
    }

    for (const attempt of attempts) {
      try {
        return JSON.parse(attempt);
      } catch (error) {
        // Continue trying other formats
      }
    }

    return null;
  }

  normalizeSessionPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const nestedKeys = ["data", "session", "currentSession", "current", "value"];
    for (const key of nestedKeys) {
      if (payload[key]) {
        const nested = this.normalizeSessionPayload(payload[key]);
        if (nested) {
          if (!nested.user) {
            nested.user =
              payload.user ||
              payload.user_metadata ||
              payload.currentUser ||
              payload?.data?.user ||
              nested.user ||
              null;
          }
          return nested;
        }
      }
    }

    const accessToken =
      payload.access_token ||
      payload.accessToken ||
      null;

    if (!accessToken) {
      return null;
    }

    const refreshToken =
      payload.refresh_token ||
      payload.refreshToken ||
      null;

    const expiresCandidates = [
      payload.expires_at,
      payload.expiresAt,
      payload?.session?.expires_at,
      payload?.session?.expiresAt,
      payload?.currentSession?.expires_at,
      payload?.currentSession?.expiresAt,
      payload?.current?.expires_at,
      payload?.current?.expiresAt,
      payload?.data?.session?.expires_at,
      payload?.data?.session?.expiresAt,
    ];

    let expiresAt = null;
    for (const candidate of expiresCandidates) {
      const numericCandidate = Number(candidate);
      if (!Number.isNaN(numericCandidate) && Number.isFinite(numericCandidate)) {
        expiresAt = numericCandidate;
        break;
      }
    }

    const expiresIn =
      payload.expires_in ||
      payload.expiresIn ||
      payload?.session?.expires_in ||
      payload?.currentSession?.expires_in ||
      payload?.current?.expires_in ||
      payload?.data?.session?.expires_in ||
      null;

    if (!expiresAt && expiresIn) {
      const numericExpiresIn = Number(expiresIn);
      if (!Number.isNaN(numericExpiresIn) && Number.isFinite(numericExpiresIn)) {
        expiresAt = Math.floor(Date.now() / 1000) + numericExpiresIn;
      }
    }

    if (!expiresAt) {
      expiresAt = Math.floor(Date.now() / 1000) + 3600;
    }

    const user =
      payload.user ||
      payload.user_metadata ||
      payload.currentUser ||
      payload?.session?.user ||
      payload?.currentSession?.user ||
      payload?.current?.user ||
      payload?.data?.user ||
      null;

    return {
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
      },
      user,
    };
  }

  async captureSessionFromCookies() {
    try {
      if (!chrome.cookies?.getAll) {
        console.debug("[CopyThief] captureSessionFromCookies: cookies API not available");
        return null;
      }

      const cookies = await chrome.cookies.getAll({});
      const relevant = cookies.filter((cookie) => {
        if (!cookie?.name) {
          return false;
        }
        return cookie.name.includes("sb-") && cookie.name.includes("auth-token");
      });

      if (!relevant.length) {
        console.debug("[CopyThief] captureSessionFromCookies: no auth cookies found");
        return null;
      }

      const grouped = new Map();

      for (const cookie of relevant) {
        const [baseName, suffix] = cookie.name.split(".");
        const order = suffix ? Number(suffix) : 0;

        if (!grouped.has(baseName)) {
          grouped.set(baseName, []);
        }

        const bucket = grouped.get(baseName);
        let value = cookie.value || "";

        try {
          value = decodeURIComponent(value);
        } catch (error) {
          // keep original value
        }

        console.debug("[CopyThief] captureSessionFromCookies: found cookie segment", {
          name: cookie.name,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          order,
        });

        bucket[Number.isFinite(order) ? order : bucket.length] = value;
      }

      for (const [name, segments] of grouped.entries()) {
        if (!segments || !segments.length) {
          continue;
        }

        const combined = segments.filter(Boolean).join("");
        const attempts = [combined, ...segments.filter(Boolean)];

        for (const candidate of attempts) {
          if (!candidate) {
            continue;
          }
          const parsed = this.parseSessionPayload(candidate);
          if (!parsed) {
            continue;
          }

          const normalized = this.normalizeSessionPayload(parsed);
          if (normalized && normalized.session && normalized.session.access_token) {
            console.debug("[CopyThief] captureSessionFromCookies: session reconstructed from cookie", name);
            return normalized;
          }
        }
      }

      console.debug("[CopyThief] captureSessionFromCookies: no valid session found in cookies");
      return null;
    } catch (error) {
      console.error("[CopyThief] captureSessionFromCookies: failed to read cookies", error);
      return null;
    }
  }

  async ensureContentBridge(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["copythief-site-content.js"],
      });
      console.debug("[CopyThief] ensureContentBridge: injected content bridge into tab", tabId);
      return true;
    } catch (error) {
      console.debug("[CopyThief] ensureContentBridge: failed to inject content bridge", tabId, error?.message);
      return false;
    }
  }

  async saveSwipe(swipeData) {
    try {
      // Verifica autenticação
      const authResult = await this.checkAuth();
      if (!authResult.authenticated) {
        return { success: false, error: "User not authenticated" };
      }

      // Obtém token de acesso
      const { accessToken } = await chrome.storage.local.get(["accessToken"]);

      // Verifica se é vídeo e tem videoUrl - usa o novo serviço de vídeo
      if (swipeData.adType === "VIDEO" && swipeData.videoUrl) {
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

          if (response.ok && result.success) {
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
          // Continua para o código de fallback abaixo
        }
      }

      // Fluxo para IMAGEM: envia para o mesmo serviço novo (S3 + Supabase)
      if (swipeData.adType === "IMAGE" && (swipeData.imageUrl || swipeData.contentUrl)) {
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

        const response = await fetch(`${this.videoApiUrl}/api/save-video`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(imageApiData),
        });

        const result = await response.json();

        if (response.ok && result.success) {
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

      const response = await fetch(`${this.apiBaseUrl}/api/swipes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(apiData),
      });

      const result = await response.json();

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
      // Cria um AbortController para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

      try {
        // Usa a API do Supabase para gerar a URL de autenticação Google
        const response = await fetch(`${this.apiBaseUrl}/api/auth/google`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            redirectTo: `${this.apiBaseUrl}/auth/callback`
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data.url) {
            return { success: true, url: data.url };
          } else {
            return { success: false, error: "Invalid response from server" };
          }
        } else {
          let errorMessage = "Failed to generate auth URL";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (e) {
            // Se não conseguir fazer parse do JSON, usa a mensagem padrão
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
          console.error("[CopyThief] Erro ao gerar URL de autenticação:", response.status, errorMessage);
          return { success: false, error: errorMessage };
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      console.error("[CopyThief] Erro ao gerar URL de autenticação:", error);
      if (error.name === 'AbortError') {
        return { success: false, error: "Request timeout. Please check your connection." };
      }
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return { success: false, error: "Network error. Please check your internet connection." };
      }
      return { success: false, error: error.message || "Connection error" };
    }
  }

  async captureSessionFromTabs() {
    let tabs = await chrome.tabs.query({
      url: ["https://copythief.ai/*", "https://*.copythief.ai/*"],
    });

    if (!tabs || tabs.length === 0) {
      console.debug("[CopyThief] captureSessionFromTabs: no copythief.ai tabs found via url filter, scanning all tabs");
      const allTabs = await chrome.tabs.query({});
      tabs = allTabs.filter((tab) => {
        if (!tab.url) {
          return false;
        }
        return tab.url.includes("copythief.ai");
      });

      if (!tabs.length) {
        console.debug("[CopyThief] captureSessionFromTabs: still no copythief.ai tabs after full scan", {
          totalTabs: allTabs.length,
        });
        return null;
      }
    }

    for (const tab of tabs) {
      console.debug("[CopyThief] captureSessionFromTabs: checking tab", {
        id: tab.id,
        url: tab.url,
        status: tab.status,
      });
      let response = null;
      try {
        response = await chrome.tabs.sendMessage(tab.id, {
          action: "getAuthFromPage",
        });
      } catch (error) {
        console.debug("[CopyThief] captureSessionFromTabs: tab request failed", tab.id, error?.message);
      }

      if (!response || !response.success || !response.session) {
        console.debug("[CopyThief] captureSessionFromTabs: attempting content script reinjection", tab.id);
        const injected = await this.ensureContentBridge(tab.id);
        if (injected) {
          try {
            response = await chrome.tabs.sendMessage(tab.id, {
              action: "getAuthFromPage",
            });
          } catch (reinjectionError) {
            console.debug(
              "[CopyThief] captureSessionFromTabs: post-injection message failed",
              tab.id,
              reinjectionError?.message
            );
          }
        }
      }

      if (response && response.success && response.session) {
        console.debug("[CopyThief] captureSessionFromTabs: received session from tab", tab.id);
        return {
          session: response.session,
          user: response.user || null,
        };
      }
    }

    console.debug("[CopyThief] captureSessionFromTabs: no session returned from tabs");
    return null;
  }

  async syncAuthFromWebsite() {
    try {
      const captured = await this.captureSessionFromTabs();

      if (captured && captured.session) {
        console.debug("[CopyThief] syncAuthFromWebsite: persisting session from tabs");
        const normalizedUser = await this.persistSession(captured.session, captured.user);
        return { success: true, user: normalizedUser };
      }

      const cookieSession = await this.captureSessionFromCookies();
      if (cookieSession && cookieSession.session) {
        console.debug("[CopyThief] syncAuthFromWebsite: persisting session from cookies");
        const normalizedUser = await this.persistSession(cookieSession.session, cookieSession.user);
        return { success: true, user: normalizedUser };
      }

      try {
        const meResponse = await fetch(`${this.apiBaseUrl}/api/auth/me`, {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (meResponse.ok) {
          const meData = await meResponse.json();
          if (meData.success && meData.data && meData.data.user) {
            console.debug("[CopyThief] syncAuthFromWebsite: detected active cookie session but no tokens");
            return {
              success: false,
              error: "Active web session detected but the extension could not read it. Open copythief.ai and try again.",
            };
          }
        }
      } catch (cookieCheckError) {
        // Ignora erros ao verificar cookies
      }

      return { success: false, error: "No active session found" };
    } catch (error) {
      console.error("[CopyThief] Erro ao sincronizar autenticacao:", error);
      return { success: false, error: "Connection error" };
    }
  }

  async getAuthFromPage() {
    try {
      const captured = await this.captureSessionFromTabs();

      if (captured && captured.session) {
        console.debug("[CopyThief] getAuthFromPage: persisting session");
        const normalizedUser = await this.persistSession(captured.session, captured.user);
        return { success: true, user: normalizedUser };
      }

      const cookieSession = await this.captureSessionFromCookies();
      if (cookieSession && cookieSession.session) {
        console.debug("[CopyThief] getAuthFromPage: persisting session from cookies");
        const normalizedUser = await this.persistSession(cookieSession.session, cookieSession.user);
        return { success: true, user: normalizedUser };
      }

      return { success: false, error: "No active session found" };
    } catch (error) {
      console.error("[CopyThief] Erro ao obter auth da pagina:", error);
      return { success: false, error: "Connection error" };
    }
  }

  async handleAuthDetected(session, user) {
    try {
      if (!session || !session.access_token) {
        console.warn("[CopyThief] handleAuthDetected: invalid session payload", session);
        return { success: false, error: "Invalid session data" };
      }

      console.debug("[CopyThief] handleAuthDetected: persisting detected session");
      const normalizedUser = await this.persistSession(session, user);
      return { success: true, user: normalizedUser };
    } catch (error) {
      console.error("[CopyThief] Erro ao processar auth detectado:", error);
      return { success: false, error: error.message };
    }
  }

  async getFolders() {
    try {
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
