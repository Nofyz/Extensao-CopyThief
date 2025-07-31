// Content Script para CopyThief
// Detecta anúncios e adiciona botões de swipe

console.log("[CopyThief] Content script carregado");

// Detecta anúncios do Facebook Ads Library
function detectAds() {
  const allDivs = document.querySelectorAll("div.xh8yej3");
  allDivs.forEach((div, index) => {
    const detalhesBtn = Array.from(
      div.querySelectorAll('div[role="button"], button, a, span')
    ).find(
      (el) =>
        el.textContent &&
        (el.textContent.trim().includes("Ver detalhes do anúncio") ||
          el.textContent.trim().includes("Ver resumo") ||
          el.textContent.trim().includes("See ad details") ||
          el.textContent.trim().includes("See summary details"))
    );

    if (detalhesBtn && !div.querySelector(".copythief-btn")) {
      addSwipeButton(div, detalhesBtn, index);
    }
  });
}

function addSwipeButton(adElement, detalhesBtn, index) {
  // Cria wrapper se necessário
  let parent = detalhesBtn.parentNode;
  if (parent && !parent.classList.contains("copythief-wrapper")) {
    const wrapper = document.createElement("div");
    wrapper.className = "copythief-wrapper";
    wrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
      width: 100%;
    `;

    parent.insertBefore(wrapper, detalhesBtn);
    wrapper.appendChild(detalhesBtn);
    parent = wrapper;
  }

  const button = document.createElement("button");
  button.className = "copythief-btn";
  button.textContent = "💾 Salvar no CopyThief";
  button.style.cssText = `
    margin-top: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    background: #a78bfa !important;
    color: #fff !important;
    border: none !important;
    border-radius: 8px !important;
    padding: 10px 0 !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    font-size: 1rem !important;
    box-shadow: 0 2px 8px #0002 !important;
    display: block !important;
    opacity: 1 !important;
    position: relative !important;
    z-index: 10 !important;
    animation: none !important;
    transition: none !important;
    pointer-events: auto !important;
    visibility: visible !important;
    box-sizing: border-box !important;
  `;

  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleSwipe(adElement, index);
  });

  if (!parent.querySelector(".copythief-btn")) {
    parent.appendChild(button);
    console.log("[CopyThief] Botão de swipe inserido.");
  }
}

function handleSwipe(adElement, index) {
  // Coleta dados do anúncio
  const adData = {
    platform: "META_FACEBOOK",
    url: window.location.href,
    timestamp: new Date().toISOString(),
    title: null,
    description: null,
    imageUrl: null,
    videoUrl: null,
    contentUrl: null,
    thumbnailUrl: null,
    copyText: null,
    callToAction: null,
    landingPageUrl: null,
    adType: null,
    platformAdId: null,
    platformUrl: null,
    iconUrl: null,
    metadata: {},
    tags: [],
  };

  // Título do anúncio
  let titleEl = adElement.querySelector(
    'div._4ik4._4ik5[style*="line-height: 14px"], div._4ik4._4ik5[style*="line-height: 16px"], div._4ik4._4ik5[style*="line-height: 12px"]'
  );
  if (!titleEl) {
    titleEl = adElement.querySelector(
      "h2, h3, span.x14vqqas, span.x117nqv4, span.x6s0dn4"
    );
  }
  if (titleEl && titleEl.textContent) {
    adData.title = titleEl.textContent.trim();
  }

  // Descrição/copy
  let descEl = adElement.querySelector(
    'div._4ik4._4ik5[style*="-webkit-line-clamp: 7"] span'
  );
  if (!descEl) {
    descEl = Array.from(adElement.querySelectorAll("div._4ik4._4ik5")).find(
      (el) => el.textContent && el.textContent.length > 30
    );
  }
  if (descEl && descEl.textContent) {
    adData.description = descEl.textContent.trim();
  }

  // Imagem principal
  const image = adElement.querySelector("img");
  if (image && image.src) {
    adData.imageUrl = image.src;
  }

  // Vídeo
  const video = adElement.querySelector("video");
  if (video && video.src) {
    adData.videoUrl = video.src;
    adData.contentUrl = video.src;
    adData.adType = "VIDEO";
  }

  // Define contentUrl e thumbnailUrl baseado no tipo de mídia
  if (adData.imageUrl && !adData.adType) {
    adData.contentUrl = adData.imageUrl;
    adData.thumbnailUrl = adData.imageUrl;
    adData.adType = "IMAGE";
  }

  // Se não encontrou nem imagem nem vídeo, define como IMAGE por padrão
  if (!adData.adType) {
    adData.adType = "IMAGE";
  }
  // Busca o ID da biblioteca no span com classe específica
  const libIdSpan = adElement.querySelector(
    "span.x8t9es0.xw23nyj.xo1l8bm.x63nzvj.x108nfp6.xq9mrsl.x1h4wwuj.xeuugli"
  );
  if (libIdSpan && libIdSpan.textContent) {
    const match =
      libIdSpan.textContent.match(/Library ID: (\d+)/) ||
      libIdSpan.textContent.match(/ID da biblioteca: (\d+)/);
    if (match && match[1]) {
      adData.platformAdId = match[1];
    }
  }

  // Copy text (mesmo que description)
  adData.copyText = adData.description;

  // Call to action (botão de call to action do ad)
  // Procura especificamente por botões que ficam ao final do anúncio
  let ctaBtn = null;

  // Primeiro, tenta encontrar botões com role="button" que são típicos do Facebook
  const allButtons = Array.from(
    adElement.querySelectorAll(
      'div[role="button"], button[role="button"], a[role="button"]'
    )
  );

  // Filtra botões que têm estrutura típica de CTA (com span ou div filho)
  const ctaButtons = allButtons.filter((el) => {
    const hasChildElements = el.querySelector("span, div");
    const hasText = el.textContent && el.textContent.trim().length > 0;
    const isNotProfileButton =
      !el.textContent?.toLowerCase().includes("profile") &&
      !el.textContent?.toLowerCase().includes("perfil") &&
      !el.textContent?.toLowerCase().includes("avatar");

    return hasChildElements && hasText && isNotProfileButton;
  });

  // Pega o último botão encontrado (que geralmente é o CTA ao final do anúncio)
  if (ctaButtons.length > 0) {
    ctaBtn = ctaButtons[ctaButtons.length - 1];
  }

  // Se não encontrou botão com role="button", tenta encontrar por texto conhecido
  if (!ctaBtn) {
    ctaBtn = Array.from(adElement.querySelectorAll("div, button, a")).find(
      (el) =>
        el.textContent &&
        (el.textContent.toLowerCase().includes("saiba mais") ||
          el.textContent.toLowerCase().includes("learn more") ||
          el.textContent.toLowerCase().includes("shop now") ||
          el.textContent.toLowerCase().includes("comprar agora") ||
          el.textContent.toLowerCase().includes("inscrever-se") ||
          el.textContent.toLowerCase().includes("sign up") ||
          el.textContent.toLowerCase().includes("ver mais") ||
          el.textContent.toLowerCase().includes("see more") ||
          el.textContent.toLowerCase().includes("baixar") ||
          el.textContent.toLowerCase().includes("download") ||
          el.textContent.toLowerCase().includes("experimentar") ||
          el.textContent.toLowerCase().includes("try now") ||
          el.textContent.toLowerCase().includes("visit") ||
          el.textContent.toLowerCase().includes("visitar"))
    );
  }

  if (ctaBtn && ctaBtn.textContent) {
    adData.callToAction = ctaBtn.textContent.trim();
  } else {
    adData.callToAction = undefined; // Se não encontrar, fica vazio
  }

  // Landing page URL (página de redirecionamento do ad)
  // Pega o link do botão de call to action
  if (ctaBtn) {
    // Se o próprio botão é um link
    if (ctaBtn.tagName === "A" && ctaBtn.href) {
      adData.landingPageUrl = ctaBtn.href;
    } else {
      // Se não é um link, procura por um link filho do botão
      const linkInsideButton = ctaBtn.querySelector("a[href]");
      if (linkInsideButton && linkInsideButton.href) {
        adData.landingPageUrl = linkInsideButton.href;
      } else {
        // Se não encontrar link no botão, procura por qualquer link no anúncio
        const landingPageLink = adElement.querySelector(
          'a[target="_blank"][href*="l.facebook.com/l.php?u="]'
        );
        if (landingPageLink && landingPageLink.href) {
          const urlMatch = decodeURIComponent(
            landingPageLink.href.match(/u=([^&]+)/)?.[1] || ""
          );
          adData.landingPageUrl = urlMatch;
        }
      }
    }
  } else {
    // Se não encontrou botão de CTA, procura por qualquer link no anúncio
    const landingPageLink = adElement.querySelector(
      'a[target="_blank"][href*="l.facebook.com/l.php?u="]'
    );
    if (landingPageLink && landingPageLink.href) {
      const urlMatch = decodeURIComponent(
        landingPageLink.href.match(/u=([^&]+)/)?.[1] || ""
      );
      adData.landingPageUrl = urlMatch;
    }
  }

  // Platform Ad ID
  const idMatch = adElement.innerHTML.match(
    /Identificação da biblioteca: (\d+)/
  );
  if (idMatch) {
    adData.platformAdId = idMatch[1];
  }

  // Platform URL (link do perfil/página)
  const adLink = adElement.querySelector('a[target="_blank"]');
  if (adLink && adLink.href) {
    adData.platformUrl = adLink.href;
  }

  // Icon URL (foto de perfil do anunciante)
  const profileImage = adElement.querySelector(
    'img[alt*="profile"], img[alt*="perfil"], img[alt*="avatar"], img[alt*="Profile"], img[alt*="Perfil"]'
  );
  if (profileImage && profileImage.src) {
    adData.iconUrl = profileImage.src;
  } else {
    // Tenta encontrar a primeira imagem pequena (geralmente é o avatar)
    const smallImages = Array.from(adElement.querySelectorAll("img")).filter(
      (img) => {
        const rect = img.getBoundingClientRect();
        return rect.width <= 50 && rect.height <= 50; // Imagens pequenas são geralmente avatars
      }
    );
    if (smallImages.length > 0) {
      adData.iconUrl = smallImages[0].src;
    }
  }

  // Metadata (veiculação, tempo ativo)
  const veicEl = Array.from(adElement.querySelectorAll("span")).find(
    (el) => el.textContent && el.textContent.includes("Veiculação iniciada")
  );
  if (veicEl && veicEl.textContent) {
    const [veiculacao, tempo_ativo] = veicEl.textContent
      .split("·")
      .map((s) => s.trim());
    adData.metadata.veiculacao = veiculacao?.replace(
      "Veiculação iniciada em ",
      ""
    );
    adData.metadata.tempo_ativo = tempo_ativo?.replace(
      "Tempo total ativo: ",
      ""
    );
  }

  console.log(adData);
  // Envia para o background script
  try {
    chrome.runtime.sendMessage(
      {
        action: "saveSwipe",
        data: adData,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[CopyThief] Erro ao enviar dados:",
            chrome.runtime.lastError
          );
          showNotification("Erro de conexão com a extensão", "error");
          return;
        }
        console.log("[CopyThief] Resposta do background:", response);
        if (response && response.success) {
          showNotification("Swipe salvo com sucesso!", "success");
        } else {
          const errorMsg =
            response && response.error
              ? response.error
              : "Erro ao salvar swipe";
          showNotification(`Erro: ${errorMsg}`, "error");
        }
      }
    );
  } catch (error) {
    console.error("[CopyThief] Erro ao enviar mensagem:", error);
    showNotification("Erro de conexão com a extensão", "error");
    // Se a extensão foi invalidada, recarrega a página para reinicializar
    if (error.message.includes("Extension context invalidated")) {
      console.log("[CopyThief] Extensão invalidada, recarregando página...");
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  }
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.textContent = message;

  let backgroundColor;
  switch (type) {
    case "success":
      backgroundColor = "#10b981";
      break;
    case "error":
      backgroundColor = "#ef4444";
      break;
    case "info":
      backgroundColor = "#3b82f6";
      break;
    default:
      backgroundColor = "#6b7280";
  }

  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 16px;
    border-radius: 6px;
    color: white;
    font-size: 14px;
    z-index: 10000;
    background: ${backgroundColor};
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

// Listener para mensagens do popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === "swipeAd") {
      const ads = document.querySelectorAll(
        '[data-testid="ad_card"], .adsmanager-ad-card, [role="article"]'
      );
      if (ads.length > 0) {
        handleSwipe(ads[0], 0);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "Nenhum anúncio detectado" });
      }
    }
  } catch (error) {
    console.error("[CopyThief] Erro no listener de mensagens:", error);
    sendResponse({ success: false, error: "Erro interno da extensão" });
  }
});

// Detecção inicial
setTimeout(detectAds, 2000);

// Observa novos anúncios
const observer = new MutationObserver(() => {
  detectAds();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

console.log("[CopyThief] Content script inicializado");
