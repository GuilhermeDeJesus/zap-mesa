# Acessos Rápidos - ZapMesa

Este arquivo concentra os principais links e credenciais de desenvolvimento local.

## URLs do sistema

- Frontend (principal): http://localhost:3000
- Login: http://localhost:3000/login
- Dashboard Super Admin: http://localhost:3000/platform/admin/dashboard
- Restaurantes Super Admin: http://localhost:3000/platform/admin/restaurants
- Mensalidades Super Admin: http://localhost:3000/platform/admin/billing
- API Backend: http://localhost:3333
- PostgreSQL (Docker): localhost:5432

## Usuários de teste

### Super Admin (PLATFORM_OWNER)
- Email: admin@zapmesa.com
- Senha: admin123
- Acesso esperado após login: /platform/admin/dashboard

### Admin de Restaurante (RESTAURANT_ADMIN)

#### Quico Prato e Prosa (`/menu/quico/:mesa`)
- Email: guilherme@quico.com
- Senha: 12345

#### Churrascaria (pré-existente)
- Email: joao@churrascaria.com
- Senha: admin123

#### Pizzaria Napolitana (`/menu/napolitana/:mesa`)
- Email: marco@napolitana.com
- Senha: senha123

#### Temaki Fusion (`/menu/temaki-fusion/:mesa`)
- Email: yuki@temakifusion.com
- Senha: senha123

#### Black Hole Burgers (`/menu/blackhole-burgers/:mesa`)
- Email: lucas@blackhole.com
- Senha: senha123

#### Café Vila Bistrô (`/menu/cafe-vila/:mesa`)
- Email: mariana@cafevila.com
- Senha: senha123

Acesso esperado após login: /dashboard

## Rotas úteis para validação

- Teste de analytics (precisa token de PLATFORM_OWNER):
  - GET /platform/analytics
- Listagem global de restaurantes (precisa token de PLATFORM_OWNER):
  - GET /platform/restaurants
- Detalhe de restaurante (precisa token de PLATFORM_OWNER):
  - GET /platform/restaurants/:id

## Observações

- Essas credenciais são do ambiente local de desenvolvimento (seed).
- Se o banco for resetado e o seed rodar novamente, os acessos tendem a ser recriados.
- Para ambiente de produção, nunca use essas senhas.
