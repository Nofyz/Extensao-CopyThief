// Content Script para CopyThief
// Detecta anúncios e adiciona botões de swipe

// Detecta anúncios do Facebook Ads Library
function detectAds() {
  // Procura por diferentes seletores possíveis para os cards de anúncios
  const possibleSelectors = [
    "div.xh8yej3",
    "div[data-testid*='ad']",
    "div[role='article']",
    "div[class*='ad']",
    "div[class*='card']"
  ];
  
  let allDivs = [];
  possibleSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    allDivs = [...allDivs, ...elements];
  });
  
  // Remove duplicatas
  allDivs = [...new Set(allDivs)];
  
  allDivs.forEach((div, index) => {
    const detalhesBtn = Array.from(
      div.querySelectorAll('div[role="button"], button, a, span')
    ).find(
      (el) =>
        el.textContent &&
        (el.textContent.trim().includes("See ad details") ||
          el.textContent.trim().includes("See summary") ||
          el.textContent.trim().includes("Ver detalhes do anúncio") ||
          el.textContent.trim().includes("Ver resumo") ||
          el.textContent.trim().includes("View ad details") ||
          el.textContent.trim().includes("View summary"))
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

  // Cria container principal
  const buttonContainer = document.createElement("div");
  buttonContainer.className = "copythief-button-container";
  buttonContainer.style.cssText = `
    position: relative !important;
    width: 100% !important;
  `;

  // Adiciona o link do Google Fonts para Material Symbols
  const existingLink = document.querySelector('link[href*="Material+Symbols+Outlined"]');
  if (!existingLink) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=move_to_inbox';
    document.head.appendChild(link);
  }

  // Cria botão único com ícone integrado
  const button = document.createElement("button");
  button.className = "copythief-btn";
  button.innerHTML = '<span class="btn-text">Save to CopyThief</span><span class="btn-dropdown-icon material-symbols-outlined">move_to_inbox</span>';
  button.style.cssText = `
    width: 100% !important;
    height: 40px !important;
    background: #ffdd57 !important;
    color: #000000 !important;
    border: none !important;
    border-radius: 6px !important;
    padding: 2px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    font-size: 10px !important;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    opacity: 1 !important;
    position: relative !important;
    z-index: 10 !important;
    transition: background-color 0.2s ease !important;
    pointer-events: auto !important;
    visibility: visible !important;
    box-sizing: border-box !important;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    letter-spacing: -0.2px !important;
  `;

  // Adiciona CSS específico para o ícone Material Symbols
  const iconStyle = document.createElement('style');
  iconStyle.textContent = `
    .btn-dropdown-icon.material-symbols-outlined {
      font-family: 'Material Symbols Outlined' !important;
      font-weight: normal !important;
      font-style: normal !important;
      font-size: 20px !important;
      line-height: 1 !important;
      letter-spacing: normal !important;
      text-transform: none !important;
      display: inline-block !important;
      white-space: nowrap !important;
      word-wrap: normal !important;
      direction: ltr !important;
      -webkit-font-feature-settings: 'liga' !important;
      -webkit-font-smoothing: antialiased !important;
      font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20 !important;
      height: 36px !important;
      width: 36px !important;
      border-radius: 4px !important;
      background: transparent !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: background-color 0.2s ease !important;
    }
    
    .copythief-btn:hover .btn-dropdown-icon.material-symbols-outlined {
      background: rgba(0, 0, 0, 0.1) !important;
    }
    
    .copythief-btn .btn-text {
      position: absolute !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
    }
    
    .copythief-btn .btn-dropdown-icon {
      position: absolute !important;
      right: 2px !important;
      top: 2px !important;
    }
  `;
  document.head.appendChild(iconStyle);

  // Cria dropdown
  const dropdown = document.createElement("div");
  dropdown.className = "copythief-dropdown";
  dropdown.style.cssText = `
    position: absolute !important;
    top: 100% !important;
    left: 0 !important;
    right: 0 !important;
    background: #ffffff !important;
    border: 1px solid #e5e7eb !important;
    border-radius: 8px !important;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
    width: 100% !important;
    max-height: 200px !important;
    overflow-y: auto !important;
    z-index: 1000 !important;
    display: none !important;
    margin-top: 4px !important;
  `;

  // Adiciona elementos ao container
  buttonContainer.appendChild(button);
  buttonContainer.appendChild(dropdown);

  // Adiciona efeito hover (só se o botão não estiver salvo)
  button.addEventListener("mouseenter", () => {
    if (!button.classList.contains('copythief-saved') && button.style.background !== "#10b981" && button.style.background !== "rgb(16, 185, 129)") {
      button.style.background = "#ffed8a";
    }
  });
  
  button.addEventListener("mouseleave", () => {
    if (!button.classList.contains('copythief-saved') && button.style.background !== "#10b981" && button.style.background !== "rgb(16, 185, 129)") {
      button.style.background = "#ffdd57";
    }
  });

  // Armazena referência do botão no adElement para acesso posterior
  adElement._copythiefButton = button;

  // Event listener para o botão
  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Verifica se o clique foi no ícone do dropdown
    const dropdownIcon = button.querySelector('.btn-dropdown-icon');
    const rect = button.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const iconX = dropdownIcon.getBoundingClientRect().left - rect.left;
    
    // Se clicou na área do ícone (últimos 40px do botão), abre dropdown
    if (clickX > rect.width - 40) {
      toggleDropdown(dropdown, adElement, index);
    } else {
      // Se clicou no texto, salva na pasta padrão
      handleSwipe(adElement, index, null);
    }
  });

  // Fecha dropdown quando clica fora
  document.addEventListener("click", (e) => {
    if (!buttonContainer.contains(e.target)) {
      dropdown.style.display = "none";
    }
  });

  if (!parent.querySelector(".copythief-button-container")) {
    parent.appendChild(buttonContainer);
  }
}

// Função para alternar o dropdown
function toggleDropdown(dropdown, adElement, index) {
  if (dropdown.style.display === "none" || dropdown.style.display === "") {
    loadFolders(dropdown, adElement, index);
    dropdown.style.display = "block";
  } else {
    dropdown.style.display = "none";
  }
}

// Função para carregar as pastas do usuário
function loadFolders(dropdown, adElement, index) {
  // Limpa o dropdown
  dropdown.innerHTML = "";
  
  // Adiciona loading
  const loadingItem = document.createElement("div");
  loadingItem.style.cssText = `
    padding: 12px 16px !important;
    color: #6b7280 !important;
    font-size: 14px !important;
    text-align: center !important;
  `;
  loadingItem.textContent = "Loading folders...";
  dropdown.appendChild(loadingItem);

  // Busca as pastas do usuário
  chrome.runtime.sendMessage(
    { action: "getFolders" },
    (response) => {
      dropdown.innerHTML = ""; // Remove loading
      
      if (chrome.runtime.lastError) {
        console.error("[CopyThief] Erro ao buscar pastas:", chrome.runtime.lastError);
        const errorItem = document.createElement("div");
        errorItem.style.cssText = `
          padding: 12px 16px !important;
          color: #ef4444 !important;
          font-size: 14px !important;
          text-align: center !important;
        `;
        errorItem.textContent = "Error loading folders";
        dropdown.appendChild(errorItem);
        return;
      }

      if (response && response.folders && response.folders.length > 0) {
        // Adiciona opção "Default Folder"
        const defaultItem = document.createElement("div");
        defaultItem.className = "copythief-folder-item";
        defaultItem.style.cssText = `
          padding: 12px 16px !important;
          cursor: pointer !important;
          border-bottom: 1px solid #f3f4f6 !important;
          font-size: 14px !important;
          color: #374151 !important;
          transition: background-color 0.2s ease !important;
        `;
        defaultItem.textContent = "📁 Default Folder";
        defaultItem.addEventListener("click", () => {
          dropdown.style.display = "none";
          handleSwipe(adElement, index, null, null);
        });
        defaultItem.addEventListener("mouseenter", () => {
          defaultItem.style.backgroundColor = "#f9fafb";
        });
        defaultItem.addEventListener("mouseleave", () => {
          defaultItem.style.backgroundColor = "transparent";
        });
        dropdown.appendChild(defaultItem);

        // Adiciona as pastas do usuário
        response.folders.forEach(folder => {
          const folderItem = document.createElement("div");
          folderItem.className = "copythief-folder-item";
          folderItem.style.cssText = `
            padding: 12px 16px !important;
            cursor: pointer !important;
            border-bottom: 1px solid #f3f4f6 !important;
            font-size: 14px !important;
            color: #374151 !important;
            transition: background-color 0.2s ease !important;
          `;
          folderItem.textContent = `📁 ${folder.name}`;
          folderItem.addEventListener("click", () => {
            dropdown.style.display = "none";
            handleSwipe(adElement, index, folder.id, null);
          });
          folderItem.addEventListener("mouseenter", () => {
            folderItem.style.backgroundColor = "#f9fafb";
          });
          folderItem.addEventListener("mouseleave", () => {
            folderItem.style.backgroundColor = "transparent";
          });
          dropdown.appendChild(folderItem);
        });
      } else {
        // Nenhuma pasta encontrada
        const noFoldersItem = document.createElement("div");
        noFoldersItem.style.cssText = `
          padding: 12px 16px !important;
          color: #6b7280 !important;
          font-size: 14px !important;
          text-align: center !important;
        `;
        noFoldersItem.textContent = "No folders found";
        dropdown.appendChild(noFoldersItem);
      }
    }
  );
}

function handleSwipe(adElement, index, folderId = null, buttonElement = null) {
  // Obtém a referência do botão se não foi passada
  const button = buttonElement || adElement._copythiefButton;
  
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
    folderId: folderId, // Adiciona o ID da pasta selecionada
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

  // Page Name (nome da página do Facebook)
  // Procura por link que aponta para o perfil da página do Facebook
  // Tenta múltiplos seletores para maior compatibilidade
  let pageLink = adElement.querySelector('a[href*="facebook.com/"][target="_blank"]');
  if (!pageLink) {
    // Tenta sem target="_blank"
    pageLink = adElement.querySelector('a[href*="facebook.com/"]');
  }
  
  if (pageLink) {
    // Procura pelo texto dentro do link, tentando diferentes seletores
    let pageNameSpan = pageLink.querySelector('span.x117nqv4'); // Classe comum para nome da página
    if (!pageNameSpan) {
      // Tenta qualquer span dentro do link
      pageNameSpan = pageLink.querySelector('span');
    }
    
    if (pageNameSpan && pageNameSpan.textContent && pageNameSpan.textContent.trim()) {
      adData.pageName = pageNameSpan.textContent.trim();
    } else if (pageLink.textContent && pageLink.textContent.trim()) {
      // Fallback: usa o texto do próprio link se não encontrar span
      adData.pageName = pageLink.textContent.trim();
    }
  }

  // Page Photo (foto de perfil da página)
  // Procura especificamente pela imagem com classes _8nqq img (foto de perfil)
  // Tenta múltiplos seletores
  let pagePhotoImg = adElement.querySelector('img._8nqq.img');
  if (!pagePhotoImg) {
    // Tenta apenas com uma das classes
    pagePhotoImg = adElement.querySelector('img._8nqq');
  }
  if (!pagePhotoImg) {
    // Tenta por alt text que geralmente contém o nome da página
    pagePhotoImg = Array.from(adElement.querySelectorAll("img")).find(
      (img) => img.alt && img.alt.trim() && img.classList.contains('_8nqq')
    );
  }
  
  if (pagePhotoImg && pagePhotoImg.src) {
    adData.pagePhoto = pagePhotoImg.src;
  } else {
    // Fallback: procura imagem pequena no topo do card (geralmente 60x60px)
    const profileImages = Array.from(adElement.querySelectorAll("img")).filter(
      (img) => {
        const rect = img.getBoundingClientRect();
        // Imagens de perfil geralmente têm entre 40-80px
        return rect.width >= 40 && rect.width <= 80 && rect.height >= 40 && rect.height <= 80;
      }
    );
    if (profileImages.length > 0) {
      // Pega a primeira imagem pequena encontrada (geralmente é a foto de perfil no topo)
      adData.pagePhoto = profileImages[0].src;
    } else if (adData.iconUrl) {
      // Se não encontrar foto específica, usa o iconUrl como fallback
      adData.pagePhoto = adData.iconUrl;
    }
  }

  // Debug: log dos dados extraídos
  console.log("[CopyThief] Page data extracted:", {
    pageName: adData.pageName,
    pagePhoto: adData.pagePhoto
  });

  // Metadata (veiculação, tempo ativo)
  const veicEl = Array.from(adElement.querySelectorAll("span")).find(
    (el) => el.textContent && el.textContent.includes("Started running")
  );
  if (veicEl && veicEl.textContent) {
    const [veiculacao, tempo_ativo] = veicEl.textContent
      .split("·")
      .map((s) => s.trim());
    adData.metadata.veiculacao = veiculacao?.replace(
      "Started running on ",
      ""
    );
    adData.metadata.tempo_ativo = tempo_ativo?.replace(
      "Total active time: ",
      ""
    );
  }

  // Mostra estado de loading no botão durante o salvamento
  if (button && !button.classList.contains('copythief-saved')) {
    button.style.background = "#6b7280";
    button.style.color = "#ffffff";
    button.style.cursor = "wait";
    const btnText = button.querySelector('.btn-text');
    if (btnText) {
      btnText.textContent = "Saving...";
    }
  }

  // Envia para o background script
  try {
    chrome.runtime.sendMessage(
      {
        action: "saveSwipe",
        data: adData,
      },
      (response) => {
        // Obtém o botão novamente dentro do callback para garantir que temos a referência correta
        const currentButton = adElement._copythiefButton || adElement.querySelector('.copythief-btn');
        
        if (chrome.runtime.lastError) {
          console.error(
            "[CopyThief] Erro ao enviar dados:",
            chrome.runtime.lastError
          );
          // Restaura o botão em caso de erro
          if (currentButton && !currentButton.classList.contains('copythief-saved')) {
            currentButton.style.background = "#ffdd57";
            currentButton.style.color = "#000000";
            currentButton.style.cursor = "pointer";
            const btnText = currentButton.querySelector('.btn-text');
            if (btnText) {
              btnText.textContent = "Save to CopyThief";
            }
          }
          showNotification("Extension connection error", "error");
          return;
        }
        
        if (response && response.success) {
          // Muda o botão para verde quando salvo com sucesso (ANTES de mostrar o toast)
          if (currentButton) {
            // Força a mudança de cor para verde usando setProperty com !important
            currentButton.style.setProperty('background-color', '#10b981', 'important');
            currentButton.style.setProperty('background', '#10b981', 'important');
            currentButton.style.setProperty('color', '#ffffff', 'important');
            currentButton.style.cursor = "pointer";
            currentButton.classList.add('copythief-saved');
            
            // Atualiza o texto
            const btnText = currentButton.querySelector('.btn-text');
            if (btnText) {
              btnText.textContent = "Saved!";
            }
            
            // Força uma atualização visual
            currentButton.offsetHeight; // Trigger reflow
          }
          
          const folderName = folderId ? ` na pasta selecionada` : " na pasta padrão";
          showNotification(`Swipe salvo com sucesso${folderName}!`, "success");
        } else {
          // Restaura o botão em caso de erro (se não estiver salvo)
          if (currentButton && !currentButton.classList.contains('copythief-saved')) {
            currentButton.style.background = "#ffdd57";
            currentButton.style.color = "#000000";
            currentButton.style.cursor = "pointer";
            const btnText = currentButton.querySelector('.btn-text');
            if (btnText) {
              btnText.textContent = "Save to CopyThief";
            }
          }
          
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
    showNotification("Extension connection error", "error");
    // Se a extensão foi invalidada, recarrega a página para reinicializar
    if (error.message.includes("Extension context invalidated")) {
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
        handleSwipe(ads[0], 0, null, null);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "No ads detected" });
      }
    }
  } catch (error) {
    console.error("[CopyThief] Erro no listener de mensagens:", error);
    sendResponse({ success: false, error: "Internal extension error" });
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
