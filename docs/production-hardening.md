# Hardening de Producao

Este guia cobre os itens operacionais minimos para colocar o Zap Mesa em producao com mais seguranca:

- TLS (HTTPS) no Nginx
- Rotacao de logs dos containers
- Backup automatico do PostgreSQL com retencao
- Restore de backup

## 1) TLS no Nginx

O compose de producao ja expoe as portas 80 e 443 e monta certificados em `deploy/certs`.

### Estrutura esperada

- `deploy/certs/fullchain.pem`
- `deploy/certs/privkey.pem`

### Ativar configuracao SSL

1. Copie `deploy/nginx/default.ssl.conf` para `deploy/nginx/default.conf`.
2. Garanta que os arquivos de certificado estejam presentes em `deploy/certs`.
3. Recrie apenas o Nginx:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --force-recreate nginx
```

## 2) Rotacao de logs

A stack de producao usa `logging.driver=json-file` com limites de tamanho/arquivo em todos os servicos principais.

Para validar:

```bash
docker inspect zap-mesa-backend-prod --format='{{json .HostConfig.LogConfig}}'
```

## 3) Backup automatico

O servico `backup` gera dumps compactados em `deploy/backups` com o padrao:

- `zapmesa-YYYYMMDD-HHMMSS.sql.gz`

Variaveis no `.env.prod`:

- `BACKUP_INTERVAL_SECONDS` (padrao: `86400`)
- `BACKUP_RETENTION_DAYS` (padrao: `7`)

Para acompanhar:

```bash
docker logs -f zap-mesa-backup-prod
```

## 4) Restore de backup

Exemplo restaurando um arquivo especifico:

```bash
gunzip -c deploy/backups/zapmesa-20250101-010101.sql.gz | \
  docker exec -i zap-mesa-postgres-prod psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

## 5) Checklist rapido

- `APP_URL` e `PUBLIC_API_URL` apontando para dominio publico em `.env.prod`.
- `JWT_SECRET` forte e unico.
- Certificados validos em `deploy/certs`.
- Validacao periodica de restore (nao apenas backup).
