/**
 * Atualiza imagens de todos os produtos que não têm imagem.
 * Execute: node backend/update-images.mjs
 */

const BASE = "http://localhost:3333";

async function post(path, body, token) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return r.json();
}
async function get(path, token) {
  const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return r.json();
}
async function put(path, body, token) {
  const r = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function login(email, password) {
  const d = await post("/auth/login", { email, password });
  if (!d.token) throw new Error(`Login falhou: ${email} → ${JSON.stringify(d)}`);
  return d.token;
}

// ── Banco de imagens por keyword ─────────────────────────────────────────────
const IMGS = {
  // bebidas
  chopp: "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=600&q=80",
  cerveja: "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=600&q=80",
  caipirinha: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&q=80",
  gin: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&q=80",
  aperol: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&q=80",
  sangria: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&q=80",
  vinho: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&q=80",
  cafe: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80",
  espresso: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80",
  cappuccino: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80",
  latte: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80",
  "flat white": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80",
  "cold brew": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&q=80",
  matcha: "https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=600&q=80",
  limonada: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=600&q=80",
  açaí: "https://images.unsplash.com/photo-1590301157890-4810ed352733?w=600&q=80",
  vitamina: "https://images.unsplash.com/photo-1590301157890-4810ed352733?w=600&q=80",
  milkshake: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&q=80",
  chá: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=80",
  água: "https://images.unsplash.com/photo-1536939459926-301728717817?w=600&q=80",
  // carnes
  picanha: "https://images.unsplash.com/photo-1558030006-450675393462?w=600&q=80",
  ancho: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80",
  entrecôte: "https://images.unsplash.com/photo-1588347818161-1bbf4559f44b?w=600&q=80",
  "t-bone": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80",
  mignon: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80",
  filé: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80",
  costela: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80",
  costelinha: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600&q=80",
  cupim: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80",
  paleta: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600&q=80",
  "carne de sol": "https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=600&q=80",
  linguiça: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80",
  frango: "https://images.unsplash.com/photo-1607532941433-304659e8198a?w=600&q=80",
  "katsu": "https://images.unsplash.com/photo-1607532941433-304659e8198a?w=600&q=80",
  parmegiana: "https://images.unsplash.com/photo-1574484284002-952d92a03a52?w=600&q=80",
  // frutos do mar
  camarão: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&q=80",
  moqueca: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80",
  bobó: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80",
  peixe: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&q=80",
  salmão: "https://images.unsplash.com/photo-1485963631004-f2f00b1d6606?w=600&q=80",
  tilápia: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&q=80",
  robalo: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&q=80",
  pirarucu: "https://images.unsplash.com/photo-1448043552756-e747b7a2b2b8?w=600&q=80",
  tucunaré: "https://images.unsplash.com/photo-1448043552756-e747b7a2b2b8?w=600&q=80",
  bacalhau: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&q=80",
  sashimi: "https://images.unsplash.com/photo-1534482421-64566f976cfa?w=600&q=80",
  temaki: "https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=600&q=80",
  uramaki: "https://images.unsplash.com/photo-1559410545-0bdcd187e0a6?w=600&q=80",
  nigiri: "https://images.unsplash.com/photo-1562802378-063ec186a863?w=600&q=80",
  sushi: "https://images.unsplash.com/photo-1562802378-063ec186a863?w=600&q=80",
  combinado: "https://images.unsplash.com/photo-1562802378-063ec186a863?w=600&q=80",
  gyoza: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=600&q=80",
  edamame: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80",
  missoshiru: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80",
  tataki: "https://images.unsplash.com/photo-1534482421-64566f976cfa?w=600&q=80",
  ramen: "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=600&q=80",
  udon: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80",
  mochi: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&q=80",
  dorayaki: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&q=80",
  // pizzas
  pizza: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
  margherita: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
  pepperoni: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&q=80",
  calzone: "https://images.unsplash.com/photo-1555072956-7758afb20e8f?w=600&q=80",
  quattro: "https://images.unsplash.com/photo-1548369937-47519962c11a?w=600&q=80",
  trufa: "https://images.unsplash.com/photo-1548369937-47519962c11a?w=600&q=80",
  // massas
  pasta: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=600&q=80",
  spaghetti: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=600&q=80",
  penne: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=600&q=80",
  fettuccine: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=600&q=80",
  lasanha: "https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=600&q=80",
  tagliolini: "https://images.unsplash.com/photo-1551183053-bf91798d047b?w=600&q=80",
  risoto: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=600&q=80",
  macarrão: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=600&q=80",
  // hambúrgueres
  burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80",
  hambúrguer: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80",
  smash: "https://images.unsplash.com/photo-1553979459-d2229ba7433a?w=600&q=80",
  bacon: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&q=80",
  crispy: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=600&q=80",
  chicken: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=600&q=80",
  "anéis de cebola": "https://images.unsplash.com/photo-1639024471283-03518883512d?w=600&q=80",
  "mac n": "https://images.unsplash.com/photo-1604908177453-7462950a6a3b?w=600&q=80",
  // petiscos / entradas
  bruschetta: "https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=600&q=80",
  burrata: "https://images.unsplash.com/photo-1626200413538-e3fbb7c90e2f?w=600&q=80",
  carpaccio: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80",
  "pão de alho": "https://images.unsplash.com/photo-1619221882266-6284b0e1b77a?w=600&q=80",
  ceviche: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80",
  pipoca: "https://images.unsplash.com/photo-1597858520171-563a8e8b9925?w=600&q=80",
  "queijo coalho": "https://images.unsplash.com/photo-1576167669680-5eed7b0ba44a?w=600&q=80",
  isca: "https://images.unsplash.com/photo-1529042410759-befb1204b468?w=600&q=80",
  bolinho: "https://images.unsplash.com/photo-1529042410759-befb1204b468?w=600&q=80",
  batata: "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?w=600&q=80",
  mandioca: "https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=600&q=80",
  petisco: "https://images.unsplash.com/photo-1604908177453-7462950a6a3b?w=600&q=80",
  // café da manhã / brunch
  croissant: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80",
  waffle: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80",
  tapioca: "https://images.unsplash.com/photo-1528736235302-52922df5c122?w=600&q=80",
  pão: "https://images.unsplash.com/photo-1528736235302-52922df5c122?w=600&q=80",
  ovos: "https://images.unsplash.com/photo-1513442542250-854d436a73f2?w=600&q=80",
  benedict: "https://images.unsplash.com/photo-1519975258993-60b42d1c2ee2?w=600&q=80",
  scramble: "https://images.unsplash.com/photo-1513442542250-854d436a73f2?w=600&q=80",
  // almoço leve / saladas
  salada: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
  quiche: "https://images.unsplash.com/photo-1572533596038-d0e47e6d53f7?w=600&q=80",
  sanduíche: "https://images.unsplash.com/photo-1539252554453-80ab65ce3586?w=600&q=80",
  club: "https://images.unsplash.com/photo-1539252554453-80ab65ce3586?w=600&q=80",
  sopa: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80",
  // sobremesas
  sorvete: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=600&q=80",
  pudim: "https://images.unsplash.com/photo-1464305795204-6f5bbfc7fb81?w=600&q=80",
  mousse: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&q=80",
  torta: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&q=80",
  brownie: "https://images.unsplash.com/photo-1515037893149-de7f840978e2?w=600&q=80",
  cheesecake: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600&q=80",
  tiramisù: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&q=80",
  tiramisu: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&q=80",
  "panna cotta": "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&q=80",
  cannoli: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&q=80",
  éclair: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&q=80",
  bolo: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&q=80",
};

function findImage(name) {
  const lower = name.toLowerCase();
  for (const [kw, url] of Object.entries(IMGS)) {
    if (lower.includes(kw)) return url;
  }
  // fallback genérico por restaurante
  return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80";
}

// ── Restaurantes ─────────────────────────────────────────────────────────────
const RESTAURANTS = [
  { email: "guilherme@quico.com", password: "12345" },
  { email: "marco@napolitana.com", password: "senha123" },
  { email: "yuki@temakifusion.com", password: "senha123" },
  { email: "lucas@blackhole.com", password: "senha123" },
  { email: "mariana@cafevila.com", password: "senha123" },
];

console.log("🖼️  Atualizando imagens dos produtos sem imagem...\n");

for (const r of RESTAURANTS) {
  try {
    const token = await login(r.email, r.password);
    const products = await get("/products", token);

    const sem = products.filter((p) => !p.image);
    console.log(`  ${r.email} → ${products.length} produtos, ${sem.length} sem imagem`);

    for (const p of sem) {
      const image = findImage(p.name);
      await put(`/products/${p.id}`, { image }, token);
      console.log(`    ✔ ${p.name} → imagem atribuída`);
    }
  } catch (err) {
    console.error(`  ❌ Erro em ${r.email}:`, err.message);
  }
}

console.log("\n✅  Atualização concluída!");
