# CopyThief - Extensão Chrome

Extensão simples para salvar anúncios do Facebook, TikTok e Google Ads.

## Funcionalidades

- ✅ Login via API
- ✅ Detecção automática de anúncios
- ✅ Botões de swipe nos anúncios
- ✅ Salvamento via API
- ✅ Interface simples e intuitiva

## Instalação

1. Abra o Chrome e vá para `chrome://extensions/`
2. Ative o "Modo desenvolvedor"
3. Clique em "Carregar sem compactação"
4. Selecione a pasta `chrome-extension`

## Configuração

Antes de usar, configure a URL da API no arquivo `background.js`:

```javascript
this.apiBaseUrl = "https://copythief.ai"; // Mude para sua URL da API
```

## Uso

1. Faça login com suas credenciais
2. Navegue até a biblioteca de anúncios do Facebook
3. Clique nos botões "💾 Salvar no CopyThief" que aparecem nos anúncios
4. Os anúncios serão salvos na sua conta

## Estrutura

```
chrome-extension/
├── manifest.json      # Configuração da extensão
├── background.js      # Script de fundo (API e auth)
├── content.js         # Script de conteúdo (detecção de anúncios)
├── popup.html         # Interface do popup
├── popup.js           # Lógica do popup
├── popup.css          # Estilos do popup
├── content.css        # Estilos dos botões
└── icons/             # Ícones da extensão
```

## API Endpoints

A extensão usa os seguintes endpoints:

- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Verificar sessão
- `POST /api/auth/refresh` - Renovar token
- `POST /api/swipes` - Salvar swipe

## Desenvolvimento

Para desenvolvimento local:

1. Configure a API para rodar em `https://copythief.ai`
2. Recarregue a extensão após mudanças
3. Use o DevTools da extensão para debug 