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
          el.textContent.trim().includes("Ver resumo"))
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

  // Copy text (mesmo que description)
  adData.copyText = adData.description;

  // Call to action
  let ctaBtn = Array.from(adElement.querySelectorAll("div, button, a")).find(
    (el) =>
      el.textContent &&
      (el.textContent.toLowerCase().includes("saiba mais") ||
        el.textContent.toLowerCase().includes("learn more") ||
        el.textContent.toLowerCase().includes("shop now"))
  );
  if (ctaBtn && ctaBtn.textContent) {
    adData.callToAction = ctaBtn.textContent.trim();
  }

  // Landing page URL
  const landingLink = adElement.querySelector(
    'a[target="_blank"][href*="l.facebook.com/l.php?u="]'
  );
  if (landingLink && landingLink.href) {
    const urlMatch = decodeURIComponent(
      landingLink.href.match(/u=([^&]+)/)?.[1] || ""
    );
    adData.landingPageUrl = urlMatch;
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

  console.log("[CopyThief] Dados coletados:", adData);

  // Envia para o background script
  chrome.runtime.sendMessage(
    {
      action: "saveSwipe",
      data: adData,
    },
    (response) => {
      console.log("[CopyThief] Resposta do background:", response);
      if (response && response.success) {
        showNotification("Swipe salvo com sucesso!", "success");
      } else {
        const errorMsg =
          response && response.error ? response.error : "Erro ao salvar swipe";
        showNotification(`Erro: ${errorMsg}`, "error");
      }
    }
  );
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
