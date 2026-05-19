# Makefile para iniciar a aplicação com Docker e verificar conflitos de portas

# Variáveis de ambiente
DOCKER_COMPOSE=docker compose
DOCKER_COMPOSE_FILE=docker-compose.mysql.yml
CPANEL_COMPOSE_FILE=docker-compose.cpanel.yml

# Lista de portas utilizadas na stack local atual
PORTS=8080 3333 3306

.PHONY: up down check-ports seed sync-db-from-prod compare-docker-prod deploy-cpanel

# Verifica conflitos de portas locais
check-ports:
	@echo "Verificando conflitos de portas locais..."
	@for port in $(PORTS); do \
	  if lsof -i :$$port | grep LISTEN; then \
	    echo "Porta $$port está em uso!"; \
	    exit 1; \
	  fi; \
	done
	@echo "Nenhum conflito de portas encontrado."

# Sobe a aplicação com Docker Compose
up: check-ports
	@echo "Iniciando aplicação com Docker Compose..."
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) up --build -d

down:
	@echo "Parando stack local..."
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) down

seed:
	@echo "Populando banco local com dados de seed..."
	docker exec zap-mesa-backend node seed.mjs

sync-db-from-prod:
	@echo "Sincronizando banco remoto (ssh loterica) para local com backup..."
	@mkdir -p .tmp-sync
	docker exec zap-mesa_mysql sh -lc 'mysqldump -uzapmesa -pzapmesa123 --single-transaction --routines --triggers zapmesa' > .tmp-sync/local-backup-before-sync.sql
	ssh loterica 'set -e; cd /home/zapmesa/zap-mesa; DB_URL=$$(grep -E "^DATABASE_URL=" .env.prod | sed -E "s/^DATABASE_URL=//" | tr -d "\""); AUTH_AND_HOST=$$(echo "$$DB_URL" | sed -E "s#^mysql2?://([^/]+)/.*#\1#"); DB_NAME=$$(echo "$$DB_URL" | sed -E "s#^mysql2?://[^/]+/([^?]+).*$#\1#"); USER=$$(echo "$$AUTH_AND_HOST" | cut -d@ -f1 | cut -d: -f1); PASS=$$(echo "$$AUTH_AND_HOST" | cut -d@ -f1 | cut -d: -f2-); HOSTPORT=$$(echo "$$AUTH_AND_HOST" | cut -d@ -f2); HOST=$$(echo "$$HOSTPORT" | cut -d: -f1); PORT=$$(echo "$$HOSTPORT" | cut -d: -f2); [ -z "$$PORT" ] && PORT=3306; mysqldump -h"$$HOST" -P"$$PORT" -u"$$USER" -p"$$PASS" --single-transaction --routines --triggers "$$DB_NAME"' > .tmp-sync/remote-prod.sql
	docker exec zap-mesa_mysql sh -lc 'mysql -uzapmesa -pzapmesa123 -e "DROP DATABASE IF EXISTS zapmesa; CREATE DATABASE zapmesa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"'
	docker exec -i zap-mesa_mysql sh -lc 'mysql -uzapmesa -pzapmesa123 zapmesa' < .tmp-sync/remote-prod.sql
	@echo "Banco local sincronizado com produção."

compare-docker-prod:
	@echo "Comparando compose local com os arquivos do servidor..."
	@mkdir -p .tmp-sync
	ssh loterica 'cat /home/zapmesa/zap-mesa/docker-compose.yml' > .tmp-sync/remote-docker-compose.yml
	ssh loterica 'cat /home/zapmesa/zap-mesa/$(CPANEL_COMPOSE_FILE)' > .tmp-sync/remote-docker-compose.cpanel.yml
	diff -u .tmp-sync/remote-docker-compose.yml docker-compose.yml || true
	diff -u .tmp-sync/remote-docker-compose.cpanel.yml $(CPANEL_COMPOSE_FILE) || true

deploy-cpanel:
	@echo "Aplicando stack versionada do cPanel no servidor remoto..."
	ssh loterica 'set -e; cd /home/zapmesa/zap-mesa; docker compose down || true; docker compose -f $(CPANEL_COMPOSE_FILE) --env-file .env.prod up -d --build; docker compose -f $(CPANEL_COMPOSE_FILE) --env-file .env.prod --profile tools up migrate'
