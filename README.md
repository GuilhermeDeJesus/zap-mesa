# zap-mesa

## Go-live de domínio customizado (multi-tenant)

Guia prático para publicar com DNS + proxy + SSL:

- [docs/custom-domain-go-live.md](/home/guilherme/workspace/zap-mesa/docs/custom-domain-go-live.md)

## Hardening de produção (TLS, logs e backup)

- [docs/production-hardening.md](/home/guilherme/workspace/zap-mesa/docs/production-hardening.md)

## Produção com Docker (1 comando)

1. Criar arquivo de ambiente:

```bash
cp .env.prod.example .env.prod
```

2. Subir stack de produção:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

3. Aplicar schema Prisma no banco:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm migrate
```

Depois disso, app disponível em `http://SEU_HOST` (via Nginx).
