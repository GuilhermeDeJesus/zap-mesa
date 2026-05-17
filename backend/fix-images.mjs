/**
 * Verifica e corrige todos os produtos com imagens 404.
 * Execute: node backend/fix-images.mjs
 */

const BASE = "http://localhost:3333";

const RESTAURANTS = [
  { email: "guilherme@quico.com", password: "12345" },
  { email: "marco@napolitana.com", password: "senha123" },
  { email: "yuki@temakifusion.com", password: "senha123" },
  { email: "lucas@blackhole.com", password: "senha123" },
  { email: "mariana@cafevila.com", password: "senha123" },
];

// Imagens estáveis verificadas
const FALLBACK_BY_KEYWORD = {
  temaki: "https://images.unsplash.com/photo-1617196034099-b65e9aa8d40d?w=600&q=80",
  ramen: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80",
  udon: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80",
  katsu: "https://images.unsplash.com/photo-1607532941433-304659e8198a?w=600&q=80",
  frango: "https://images.unsplash.com/photo-1604908177522-0dfd92e30a9b?w=600&q=80",
  salmão: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&q=80",
  chapa: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80",
  batata: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&q=80",
  filé: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80",
  tagliolini: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=600&q=80",
};

const GENERIC_FALLBACK = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80";

function guessImage(name) {
  const lower = name.toLowerCase();
  for (const [kw, url] of Object.entries(FALLBACK_BY_KEYWORD)) {
    if (lower.includes(kw)) return url;
  }
  return GENERIC_FALLBACK;
}

async function checkUrl(url) {
  try {
    const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function login(email, password) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const d = await r.json();
  if (!d.token) throw new Error(`Login falhou: ${email}`);
  return d.token;
}

async function getProducts(token) {
  const r = await fetch(`${BASE}/products`, { headers: { Authorization: `Bearer ${token}` } });
  return r.json();
}

async function updateProduct(token, id, image) {
  await fetch(`${BASE}/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ image }),
  });
}

console.log("🔍  Verificando imagens quebradas...\n");

for (const r of RESTAURANTS) {
  const token = await login(r.email, r.password);
  const products = await getProducts(token);

  let fixed = 0;
  for (const p of products) {
    if (!p.image) {
      const img = guessImage(p.name);
      await updateProduct(token, p.id, img);
      console.log(`  [sem imagem] ${p.name} → corrigido`);
      fixed++;
      continue;
    }
    const ok = await checkUrl(p.image);
    if (!ok) {
      const img = guessImage(p.name);
      await updateProduct(token, p.id, img);
      console.log(`  [404] ${p.name} → ${img.slice(0, 60)}`);
      fixed++;
    }
  }
  console.log(`  ${r.email} → ${fixed} corrigidos de ${products.length}`);
}

console.log("\n✅  Correção concluída!");
