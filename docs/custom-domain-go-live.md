# Go-live: domínio customizado por restaurante (multi-tenant)

Este guia ativa o fluxo de domínio customizado que já está implementado no app.

## Como funciona hoje no sistema

- Cada restaurante salva `customDomain` no módulo `Restaurante`.
- O backend resolve o tenant pelo header `Host`.
- Endpoints usados por domínio:
  - `GET /menu/tenant/host`
  - `POST /menu/tenant/host/orders`
- Frontend público por domínio usa a rota: `/menu/domain/:table`

Exemplo final para cliente:

- `https://menu.churrascariateste.com.br/menu/domain/1`

## 1) DNS (obrigatório)

No provedor de DNS do restaurante:

1. Criar subdomínio (exemplo: `menu.churrascariateste.com.br`).
2. Se seu servidor tem IP fixo:
   - Registro `A` apontando para o IP público.
3. Se quiser apontar para outro host:
   - Registro `CNAME` para o host de destino.

## 2) Proxy reverso (Nginx) com SSL

Exemplo de `server` para o domínio do restaurante:

```nginx
server {
  listen 80;
  server_name menu.churrascariateste.com.br;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name menu.churrascariateste.com.br;

  ssl_certificate     /etc/letsencrypt/live/menu.churrascariateste.com.br/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/menu.churrascariateste.com.br/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

Observação:

- O `Host` e `X-Forwarded-Host` precisam ser repassados para o backend identificar o tenant.

## 3) SSL (Let's Encrypt)

Exemplo com Certbot (Ubuntu/Nginx):

```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d menu.churrascariateste.com.br
```

## 4) Cloudflare (opcional, recomendado)

Se usar Cloudflare:

1. Ativar proxy laranja no DNS.
2. SSL mode: `Full (strict)`.
3. Criar regra de cache leve para assets (`/_next/static/*`).
4. Não remover `Host` original no tráfego até sua origem.

## 5) Cadastro no admin do ZapMesa

No painel admin:

1. Acessar `Restaurante`.
2. Preencher `Domínio customizado` com o host completo.
3. Salvar.

Exemplo:

- `menu.churrascariateste.com.br`

## 6) Checklist de validação

1. DNS resolveu para seu servidor:

```bash
dig +short menu.churrascariateste.com.br
```

2. Endpoint por host responde tenant correto:

```bash
curl -s http://SEU_BACKEND:3333/menu/tenant/host \
  -H "Host: menu.churrascariateste.com.br"
```

3. Página pública abre no domínio:

- `https://menu.churrascariateste.com.br/menu/domain/1`

4. Pedido por domínio cria no tenant certo:

- Testar no navegador e validar no painel de pedidos.

## 7) Operação para muitos restaurantes

- Estratégia recomendada: um subdomínio por restaurante (`menu.restaurante.com`).
- Para escala maior, considerar wildcard + automação de emissão SSL.
- Monitorar conflitos de domínio (já protegido por unicidade no banco).

## 8) Limites atuais do MVP

- O fluxo de domínio está pronto, mas não há automação de onboarding DNS.
- Não existe validação de propriedade do domínio via token TXT ainda.

Próximo passo natural (fase pós-MVP):

1. validação de domínio (challenge DNS/HTTP),
2. status do domínio no admin (`pendente`, `ativo`, `erro SSL`),
3. automação de certificados por tenant.