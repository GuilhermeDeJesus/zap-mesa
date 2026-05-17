/**
 * Seed completo de dados de exemplo — Zap Mesa
 * Execute: node backend/seed.mjs
 */

const BASE = "http://localhost:3333";

async function post(path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { _raw: text }; }
}

async function login(email, password) {
  const d = await post("/auth/login", { email, password });
  if (!d.token) throw new Error(`Login falhou para ${email}: ${JSON.stringify(d)}`);
  return d.token;
}

async function register(restaurantName, restaurantSlug, phone, adminName, email, password) {
  const d = await post("/auth/register", { restaurantName, restaurantSlug, phone, name: adminName, email, password });
  if (d.message && d.message.includes("ja")) {
    console.log(`  ⚠  ${restaurantSlug} já existe, continuando...`);
    return null;
  }
  return d;
}

async function createCategory(token, name, position) {
  const d = await post("/categories", { name, position }, token);
  if (!d.id) throw new Error(`Categoria falhou: ${JSON.stringify(d)}`);
  console.log(`    categoria: ${name}`);
  return d.id;
}

async function createProduct(token, catId, { name, description, price, image }) {
  const d = await post("/products", { name, description, price, image, categoryId: catId, active: true }, token);
  if (!d.id) console.warn(`    ⚠ produto falhou: ${name} — ${JSON.stringify(d)}`);
  else console.log(`      produto: ${name} R$${price}`);
}

// ─── helpers de imagem ───────────────────────────────────────────────────────
const IMG = {
  // Quico — pratos autênticos nordestinos/brasileiros
  chapaBraseiro:    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80",
  chapaTerraeMar:   "https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&q=80",
  chapaNordestina:  "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80",
  chapa:            "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600&q=80",
  paoAlho:          "https://images.unsplash.com/photo-1619221882266-6284b0e1b77a?w=600&q=80",
  cevicheSalmao:    "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80",
  pipocaQueijo:     "https://images.unsplash.com/photo-1597858520171-563a8e8b9925?w=600&q=80",
  queijoCoalho:     "https://images.unsplash.com/photo-1576167669680-5eed7b0ba44a?w=600&q=80",
  parmegiana:       "https://images.unsplash.com/photo-1574484284002-952d92a03a52?w=600&q=80",
  batataFrita:      "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?w=600&q=80",
  batataQueijo:     "https://images.unsplash.com/photo-1604908177453-7462950a6a3b?w=600&q=80",
  iscaFile:         "https://images.unsplash.com/photo-1529042410759-befb1204b468?w=600&q=80",
  carneSolMandioca: "https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=600&q=80",
  camarao:          "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&q=80",
  taglioleCamarao:  "https://images.unsplash.com/photo-1551183053-bf91798d047b?w=600&q=80",
  risotoCamarao:    "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=600&q=80",
  camaraoBurrito:   "https://images.unsplash.com/photo-1543352634-a1c51d9f1fa7?w=600&q=80",
  peixeGrelhado:    "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&q=80",
  tilaPescador:     "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&q=80",
  salmaoGrelhado:   "https://images.unsplash.com/photo-1485963631004-f2f00b1d6606?w=600&q=80",
  pirarucuFrito:    "https://images.unsplash.com/photo-1448043552756-e747b7a2b2b8?w=600&q=80",
  fileMignon:       "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80",
  picanha:          "https://images.unsplash.com/photo-1558030006-450675393462?w=600&q=80",
  costelaRib:       "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80",
  entrecote:        "https://images.unsplash.com/photo-1588347818161-1bbf4559f44b?w=600&q=80",
  moquecaCamarao:   "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80",
  moquecaPirarucu:  "https://images.unsplash.com/photo-1574484284002-952d92a03a52?w=600&q=80",
  costelinhaSmoke:  "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600&q=80",
  cupimBato:        "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80",
  fileTradicional:  "https://images.unsplash.com/photo-1619221882266-6284b0e1b77a?w=600&q=80",
  fileParmegiana:   "https://images.unsplash.com/photo-1574484284002-952d92a03a52?w=600&q=80",
  carneSolArretada: "https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=600&q=80",
  sorvete:          "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=600&q=80",
  pudim:            "https://images.unsplash.com/photo-1464305795204-6f5bbfc7fb81?w=600&q=80",
  mousse:           "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&q=80",
  chopp:            "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=600&q=80",
  caipirinha:       "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&q=80",
  // Pizza
  pizzaMargherita:  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
  pizzaPepperoni:   "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&q=80",
  pizzaQuattro:     "https://images.unsplash.com/photo-1548369937-47519962c11a?w=600&q=80",
  pizzaCalzone:     "https://images.unsplash.com/photo-1555072956-7758afb20e8f?w=600&q=80",
  pasta:            "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=600&q=80",
  lasanha:          "https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=600&q=80",
  tiramisu:         "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&q=80",
  // Sushi
  sushiCombo:       "https://images.unsplash.com/photo-1562802378-063ec186a863?w=600&q=80",
  sashimi:          "https://images.unsplash.com/photo-1534482421-64566f976cfa?w=600&q=80",
  temaki:           "https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=600&q=80",
  uramaki:          "https://images.unsplash.com/photo-1559410545-0bdcd187e0a6?w=600&q=80",
  edamame:          "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80",
  // Hamburguer
  burger:           "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80",
  burgerDouble:     "https://images.unsplash.com/photo-1553979459-d2229ba7433a?w=600&q=80",
  burgerBacon:      "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&q=80",
  burgerChicken:    "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=600&q=80",
  batataFritaBurg:  "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?w=600&q=80",
  onionRings:       "https://images.unsplash.com/photo-1639024471283-03518883512d?w=600&q=80",
  // Café
  cafe:             "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80",
  croissant:        "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80",
  taost:            "https://images.unsplash.com/photo-1528736235302-52922df5c122?w=600&q=80",
  quiche:           "https://images.unsplash.com/photo-1572533596038-d0e47e6d53f7?w=600&q=80",
  salada:           "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
  sanduiche:        "https://images.unsplash.com/photo-1539252554453-80ab65ce3586?w=600&q=80",
};

// ─── QUICO PRATO E PROSA ─────────────────────────────────────────────────────
async function seedQuico() {
  console.log("\n🍖  Quico Prato e Prosa");
  const token = await login("guilherme@quico.com", "12345");

  // Limpar categorias existentes (serão recriadas)
  // Criar categorias na ordem certa
  const cats = {};

  cats.happyHour  = await createCategory(token, "Happy Hour", 1);
  cats.chapas     = await createCategory(token, "Chapas", 2);
  cats.petiscos   = await createCategory(token, "Petiscos", 3);
  cats.camarao    = await createCategory(token, "Pratos com Camarão", 4);
  cats.peixes     = await createCategory(token, "Peixes", 5);
  cats.cortesNobres = await createCategory(token, "Cortes Nobres", 6);
  cats.moquecas   = await createCategory(token, "Moquecas", 7);
  cats.defumadas  = await createCategory(token, "Carnes Defumadas", 8);
  cats.tradicionais = await createCategory(token, "Tradicionais", 9);
  cats.sobremesas = await createCategory(token, "Sobremesas", 10);

  // Happy Hour
  for (const p of [
    { name: "Chopp Brahma 600ml", description: "Chopp gelado servido em caneca de 600ml. Ideal para compartilhar momentos especiais.", price: 14.90, image: IMG.chopp },
    { name: "Cerveja Original 600ml", description: "Cerveja Original bem gelada na garrafa long neck 600ml.", price: 12.90, image: IMG.chopp },
    { name: "Caipirinha da Casa", description: "Cachaça artesanal, limão, açúcar e muito gelo. A clássica que nunca sai de moda.", price: 19.90, image: IMG.caipirinha },
    { name: "Gin Hibisco", description: "Gin premium, xarope de hibisco, água tônica e fatia de laranja. Refrescante e sofisticado.", price: 35.90, image: IMG.caipirinha },
    { name: "Aperol Spritz", description: "Aperol, Prosecco e água com gás. O clássico italiano que conquistou o mundo.", price: 32.90, image: IMG.caipirinha },
    { name: "Gin Clássico", description: "Gin London Dry com água tônica premium, rodela de limão e folha de hortelã.", price: 29.90, image: IMG.caipirinha },
    { name: "Petisco do Happy Hour", description: "Mix de petiscos para acompanhar seus drinques: batata, linguiça e bolinho de bacalhau.", price: 39.90, image: IMG.batataQueijo },
  ]) await createProduct(token, cats.happyHour, p);

  // Chapas
  for (const p of [
    { name: "Chapa Braseiro", description: "Sabores marcantes direto da brasa: ancho macio, pão de alho dourado, linguiça artesanal, batatas fritas e nosso delicioso molho chimichurri — uma para dividir.", price: 89.90, image: IMG.chapaBraseiro },
    { name: "Chapa Terra e Mar", description: "Para quem gosta de variedade: ancho suculento, camarões empanados crocantes, batata chips fininhos e crocantes, acompanhados do nosso molho verde.", price: 89.90, image: IMG.chapaTerraeMar },
    { name: "Chapa Nordestina", description: "Uma viagem gastronômica ao Nordeste: carne de sol acebolada e suculenta, mandioca coada puxada na manteiga de garrafa, linguiça grelhada direta da brasa.", price: 129.90, image: IMG.chapaNordestina },
    { name: "Chapa de Boteco", description: "A escolha perfeita para compartilhar: 4 pastéis de queijo douradinhos, frango e pereirinho temperado e crocante, iscas de peixe sequinhas e batatas fritas.", price: 119.90, image: IMG.chapa },
  ]) await createProduct(token, cats.chapas, p);

  // Petiscos
  for (const p of [
    { name: "Pão de Alho", description: "Baguete dourada recheada com um irresistível creme de alho da casa e finalizada com queijo gratinado. Crocância, aroma e sabor marcante!", price: 14.90, image: IMG.paoAlho },
    { name: "Ceviche de Salmão", description: "Cubos de salmão fresco marinado com limão, cebola roxa, pimenta dedo de moça, coentro e um toque de leite de coco. Refrescante, leve e cheio de personalidade.", price: 44.90, image: IMG.cevicheSalmao },
    { name: "Pipoca de Queijo Coalho", description: "Pipoca de queijo coalho acompanhada de melado de cana. A combinação perfeita de salgado e doce que vai conquistar o seu paladar.", price: 44.90, image: IMG.pipocaQueijo },
    { name: "Queijo Coalho com Bacon", description: "Delice-se com um delicioso queijo coalho, coberto com bacon crocante e servido com um irresistível molho de goiabada. Uma experiência de sabor inesquecível.", price: 44.90, image: IMG.queijoCoalho },
    { name: "Parmegiana à Palito", description: "O tradicional filé à parmegiana servido como petisco. Filé empanado, molho pomodoro com toque especial do Quico e bastante muçarela.", price: 79.90, image: IMG.parmegiana },
    { name: "Batata Frita", description: "A tradicional batata frita servida com molho especial de ervas finas. Dourada por fora, macia por dentro.", price: 29.90, image: IMG.batataFrita },
    { name: "Batata com Queijo e Farofa de Bacon", description: "Batatas rústicas ao molho de queijo, cobertas de uma crocante farofa de bacon. Uma combinação irresistível.", price: 49.90, image: IMG.batataQueijo },
    { name: "Batata Frita com Iscas de Filé", description: "Batatas fritas cobertas com iscas de filé mignon e molho especial, gratinadas com queijo muçarela.", price: 79.90, image: IMG.batataQueijo },
    { name: "Isca de Filé ao Molho de Queijo", description: "Saborosas iscas de filé mignon ao molho de queijo, acompanhadas de tempero muçarelo gratinado.", price: 79.90, image: IMG.iscaFile },
    { name: "Carne de Sol com Mandioca", description: "Deliciosa carne de sol na manteiga feita pelo Quico, acompanha mandioca cozida no capricho.", price: 84.90, image: IMG.carneSolMandioca },
    { name: "Bolinho de Bacalhau", description: "Bolinhos crocantes de bacalhau com recheio cremoso, servidos com molho de azeitonas e alcaparras.", price: 52.90, image: IMG.iscaFile },
  ]) await createProduct(token, cats.petiscos, p);

  // Pratos com Camarão
  for (const p of [
    { name: "Camarão na Chapa", description: "Camarões grelhados na manteiga com alho, limão e ervas, servidos com arroz branco e farofa crocante.", price: 89.90, image: IMG.camarao },
    { name: "Tagliolini com Camarão", description: "Massa fresca com camarões ao molho de manteiga e vinho branco, finalizada com queijo parmesão ralado na hora.", price: 79.90, image: IMG.taglioleCamarao },
    { name: "Risoto de Camarão", description: "Arroz arbóreo cremoso com camarões, tomate seco, manteiga e parmesão. Sofisticado e delicioso.", price: 84.90, image: IMG.risotoCamarao },
    { name: "Camarão Empanado", description: "Camarões empanados crocantes, servidos com molho de ervas finas e limão. Petisco irresistível.", price: 69.90, image: IMG.camarao },
    { name: "Moqueca de Camarão (2 Pessoas)", description: "Camarões refogados no azeite, alho, cebola, mix de pimentões e leite de coco. Para acompanhar: arroz branco, pirão do próprio molho e farofa de dendê.", price: 129.90, image: IMG.moquecaCamarao },
    { name: "Bobó de Camarão", description: "Camarões frescos em creme de mandioca com leite de coco, dendê e pimentões. Prato típico baiano com toda a riqueza de sabores.", price: 79.90, image: IMG.camarao },
  ]) await createProduct(token, cats.camarao, p);

  // Peixes
  for (const p of [
    { name: "Tilápia do Pescador", description: "Filé de tilápia grelhado com temperos da casa, servido com pirão de peixe, arroz branco e farofa de banana.", price: 69.90, image: IMG.tilaPescador },
    { name: "Salmão Grelhado", description: "Salmão fresco grelhado com crust de ervas, molho de maracujá e acompanhamentos da temporada.", price: 98.90, image: IMG.salmaoGrelhado },
    { name: "Pirarucu Frito", description: "Pirarucu frito na medida certa, crocante por fora e suculento por dentro. Acompanha vinagrete, arroz e farofa.", price: 84.90, image: IMG.pirarucuFrito },
    { name: "Filé de Robalo na Brasa", description: "Robalo fresco grelhado com manteiga de ervas, limão siciliano e acompanhamentos da casa.", price: 110.90, image: IMG.peixeGrelhado },
    { name: "Tucunaré na Brasa", description: "Tucunaré amazônico grelhado na brasa com temperos regionais, acompanha arroz, feijão e farofa.", price: 79.90, image: IMG.pirarucuFrito },
  ]) await createProduct(token, cats.peixes, p);

  // Cortes Nobres
  for (const p of [
    { name: "Filé Mignon à Parmegiana", description: "Filé mignon à milanesa, regado com um delicioso molho pomodoro, gratinado com bastante queijo muçarela e parmesão. Acompanha arroz cremoso.", price: 119.90, image: IMG.fileParmegiana },
    { name: "Filé de Frango à Parmegiana", description: "Filé de peito de frango à milanesa, regado com delicioso molho pomodoro, gratinado com bastante queijo muçarela e parmesão. Acompanha arroz.", price: 99.90, image: IMG.fileParmegiana },
    { name: "Picanha na Brasa", description: "Picanha suína ou bovina grelhada na brasa, temperada só com sal grosso, acompanha arroz, feijão e vinagrete.", price: 135.90, image: IMG.picanha },
    { name: "Ancho ao Ponto", description: "Ancho maturado 21 dias, grelhado ao ponto na brasa, com manteiga aromatizada e flor de sal. Acompanha fritas e salada.", price: 155.90, image: IMG.fileMignon },
    { name: "Entrecôte Grelhado", description: "Entrecôte com marmoreio especial, grelhado à perfeição. Servido com batatas assadas e molho madeira.", price: 138.90, image: IMG.entrecote },
    { name: "T-Bone 500g", description: "Corte especial com filé e contra-filé ao mesmo tempo, temperado na brasa. Uma experiência única.", price: 178.90, image: IMG.fileMignon },
  ]) await createProduct(token, cats.cortesNobres, p);

  // Moquecas
  for (const p of [
    { name: "Moqueca de Pirarucu (2 Pessoas)", description: "Postas de Pirarucu refogadas, alho, cebola, mix de pimentões e leite de coco. Para acompanhar: arroz branco, pirão do próprio molho e farofa de dendê.", price: 119.90, image: IMG.moquecaPirarucu },
    { name: "Moqueca de Pirarucu com Camarão (2 Pessoas)", description: "Postas de Pirarucu e camarão refogados, alho, cebola, mix de pimentões e leite de coco. Para acompanhar: arroz branco, pirão do próprio molho e farofa de dendê.", price: 139.90, image: IMG.moquecaPirarucu },
    { name: "Moqueca de Camarão (2 Pessoas)", description: "Camarões refogados no azeite, alho, cebola, mix de pimentões e leite de coco. Acompanha arroz branco, pirão do próprio molho e farofa de dendê.", price: 129.90, image: IMG.moquecaCamarao },
    { name: "Moqueca de Pirarucu (4 Pessoas)", description: "Postas de Pirarucu refogadas, alho, cebola, mix de pimentões e leite de coco. Para acompanhar: arroz branco, pirão do próprio molho e farofa de dendê.", price: 209.90, image: IMG.moquecaPirarucu },
    { name: "Moqueca de Pirarucu com Camarão (4 Pessoas)", description: "Postas de Pirarucu e camarão refogados para 4 pessoas. Acompanha arroz branco, pirão do próprio molho e farofa de dendê.", price: 239.90, image: IMG.moquecaPirarucu },
    { name: "Moqueca de Camarão (4 Pessoas)", description: "Camarões refogados no azeite para 4 pessoas. Acompanha arroz branco, pirão do próprio molho e farofa de dendê.", price: 219.90, image: IMG.moquecaCamarao },
  ]) await createProduct(token, cats.moquecas, p);

  // Carnes Defumadas
  for (const p of [
    { name: "Costelinha Suína com Barbecue", description: "Costela suína defumada lentamente por horas, servida com nosso molho barbecue artesanal e acompanhamentos da temporada. Serve de 2 a 3 pessoas.", price: 119.90, image: IMG.costelinhaSmoke },
    { name: "Cupim Assado no Bafo", description: "Cupim bovino assado lentamente no bafo por mais de 8 horas, resultando em uma carne incrivelmente macia. Serve de 2 a 3 pessoas.", price: 139.90, image: IMG.cupimBato },
    { name: "Costela no Bafo", description: "Costela bovina assada no bafo por 12 horas, desfiando no garfo com sabor defumado único. Serve de 3 a 4 pessoas.", price: 198.90, image: IMG.costelinhaSmoke },
    { name: "Paleta Suína Defumada", description: "Paleta de porco defumada por 6 horas em madeira frutífera, servida desfiada com farofa e molho agridoce.", price: 159.90, image: IMG.costelaRib },
  ]) await createProduct(token, cats.defumadas, p);

  // Tradicionais
  for (const p of [
    { name: "Filé Mignon à Parmegiana", description: "Filé mignon à milanesa gratinado com molho pomodoro e queijo muçarela. Prato clássico que nunca decepciona.", price: 119.90, image: IMG.fileTradicional },
    { name: "Filé de Frango à Parmegiana", description: "Suculento filé de frango à milanesa com molho de tomate fresco e bastante queijo. Acompanha arroz e fritas.", price: 99.90, image: IMG.fileParmegiana },
    { name: "Carne de Sol Arretada", description: "Carne de sol desfiada, puxada na manteiga de garrafa, queijo coalho em cubos e arroz de leite finalizado com bastante queijo muçarelo gratinado. Um prato premium.", price: 89.90, image: IMG.carneSolArretada },
    { name: "Filé Mignon ao Molho de Vinho", description: "Filé mignon em redução de vinho tinto Bordeaux, servido com delicioso risoto de queijo parmesão.", price: 119.90, image: IMG.fileMignon },
    { name: "Frango Recheado Grelhado", description: "Peito de frango recheado com queijo e presunto, grelhado e servido com arroz, salada e batatas.", price: 72.90, image: IMG.fileTradicional },
    { name: "Macarrão ao Bolonhesa", description: "Massa al dente com ragù de carne bovina moída, tomates pelados, ervas frescas e parmesão.", price: 55.90, image: IMG.pasta },
  ]) await createProduct(token, cats.tradicionais, p);

  // Sobremesas
  for (const p of [
    { name: "Pudim de Leite Condensado", description: "Pudim cremoso feito na casa, com calda de caramelo dourado. A sobremesa clássica brasileira que todo mundo ama.", price: 22.90, image: IMG.pudim },
    { name: "Sorvete Artesanal 3 Bolas", description: "Três bolas de sorvete artesanal nos sabores da temporada, com calda e granola crocante.", price: 26.90, image: IMG.sorvete },
    { name: "Mousse de Maracujá", description: "Mousse aerado e refrescante de maracujá fresco, coberto com calda da própria fruta. Leveza garantida.", price: 19.90, image: IMG.mousse },
    { name: "Torta de Limão", description: "Base de biscoito, recheio cremoso de limão e merengue italiano maçaricado. Equilíbrio perfeito entre doce e azedo.", price: 24.90, image: IMG.mousse },
    { name: "Brownie com Sorvete", description: "Brownie quentinho de chocolate 70% cacau servido com bola de sorvete de creme e calda de chocolate.", price: 29.90, image: IMG.sorvete },
  ]) await createProduct(token, cats.sobremesas, p);

  console.log("  ✅ Quico concluído");
}

// ─── PIZZARIA NAPOLITANA ──────────────────────────────────────────────────────
async function seedNapolitana() {
  console.log("\n🍕  Pizzaria Napolitana");
  await register("Pizzaria Napolitana", "napolitana", "(11) 3456-7890", "Marco Russo", "marco@napolitana.com", "senha123");
  const token = await login("marco@napolitana.com", "senha123");

  const antipasti  = await createCategory(token, "Antipasti", 1);
  const pizzas     = await createCategory(token, "Pizzas Tradicionais", 2);
  const especiais  = await createCategory(token, "Pizzas Especiais", 3);
  const massas     = await createCategory(token, "Massas", 4);
  const dolci      = await createCategory(token, "Dolci (Sobremesas)", 5);
  const bebidas    = await createCategory(token, "Bebidas", 6);

  for (const p of [
    { name: "Bruschetta Clássica", description: "Pão artesanal tostado, tomate fresco, azeite extra-virgem, alho e manjericão fresco.", price: 28.90, image: IMG.paoAlho },
    { name: "Burrata com Tomate", description: "Queijo burrata fresco com tomates heirloom, pesto genovês e azeite siciliano.", price: 48.90, image: IMG.queijoCoalho },
    { name: "Carpaccio di Manzo", description: "Finas fatias de filé mignon cru marinado com limão, azeite, alcaparras e lascas de parmesão.", price: 52.90, image: IMG.fileMignon },
  ]) await createProduct(token, antipasti, p);

  for (const p of [
    { name: "Margherita D.O.P.", description: "Molho San Marzano D.O.P., muçarela de búfala, manjericão fresco e fio de azeite extra-virgem. A rainha das pizzas.", price: 52.90, image: IMG.pizzaMargherita },
    { name: "Pepperoni Clássico", description: "Molho de tomate artesanal, muçarela, generosa quantidade de pepperoni importado e orégano fresco.", price: 58.90, image: IMG.pizzaPepperoni },
    { name: "Quattro Formaggi", description: "Gorgonzola, parmesão, muçarela de búfala e pecorino. Para os verdadeiros amantes de queijo.", price: 65.90, image: IMG.pizzaQuattro },
    { name: "Napolitana", description: "Molho San Marzano, anchovas, azeitonas pretas, alcaparras e orégano. Sabores intensos do Mediterrâneo.", price: 58.90, image: IMG.pizzaMargherita },
  ]) await createProduct(token, pizzas, p);

  for (const p of [
    { name: "Trufa Negra e Cogumelos", description: "Creme de trufa negra, mix de cogumelos silvestres, muçarela e cebolinha tostada. Exclusiva e sofisticada.", price: 89.90, image: IMG.pizzaQuattro },
    { name: "Pistacchio e Mortadela", description: "Base de creme de pistache, muçarela, mortadela italiana, rúcula e raspas de limão.", price: 79.90, image: IMG.pizzaMargherita },
    { name: "Calzone de Ricota e Espinafre", description: "Calzone recheado com ricota cremosa, espinafre refogado, parmesão e pinoles.", price: 68.90, image: IMG.pizzaCalzone },
    { name: "Nduja e Mel de Trufa", description: "Nduja calabresa picante, muçarela, mel de trufa e rúcula selvagem. Aventura de sabores.", price: 82.90, image: IMG.pizzaPepperoni },
  ]) await createProduct(token, especiais, p);

  for (const p of [
    { name: "Spaghetti al Pomodoro", description: "Spaghetti artesanal ao molho de tomate San Marzano com manjericão fresco e parmesão.", price: 48.90, image: IMG.pasta },
    { name: "Penne all'Arrabbiata", description: "Penne com molho picante de tomate, alho, pimenta calabresa e azeite de qualidade.", price: 48.90, image: IMG.pasta },
    { name: "Lasagna alla Bolognese", description: "Lasanha clássica com ragù de carne bovina, béchamel cremoso e parmesão gratinado.", price: 64.90, image: IMG.lasanha },
    { name: "Fettuccine al Funghi Porcini", description: "Fettuccine fresco com cogumelos porcini secos, creme de leite fresco e ervas aromáticas.", price: 68.90, image: IMG.pasta },
  ]) await createProduct(token, massas, p);

  for (const p of [
    { name: "Tiramisù Clássico", description: "Camadas de biscoito savoiardo embebido em café espresso, creme de mascarpone e cacau em pó. Receita original italiana.", price: 34.90, image: IMG.tiramisu },
    { name: "Panna Cotta di Fragole", description: "Panna cotta cremosa de baunilha com coulis de morango fresco e folhas de hortelã.", price: 28.90, image: IMG.mousse },
    { name: "Cannoli Siciliani", description: "Massa crocante recheada com creme de ricota, gotas de chocolate e pistache.", price: 26.90, image: IMG.mousse },
  ]) await createProduct(token, dolci, p);

  for (const p of [
    { name: "Vinho Tinto Casa (Taça)", description: "Vinho tinto importado da casa, encorpado e com final equilibrado. Ideal para acompanhar as pizzas.", price: 28.90, image: IMG.caipirinha },
    { name: "Sangria da Casa", description: "Vinho tinto com frutas frescas da temporada, licor de laranja e especiarias. Refrescante.", price: 42.90, image: IMG.caipirinha },
    { name: "Água com Gás San Pellegrino", description: "Água mineral italiana com gás, 500ml.", price: 12.90, image: IMG.chopp },
  ]) await createProduct(token, bebidas, p);

  console.log("  ✅ Napolitana concluída");
}

// ─── TEMAKI FUSION ────────────────────────────────────────────────────────────
async function seedTemaki() {
  console.log("\n🍣  Temaki Fusion");
  await register("Temaki Fusion", "temaki-fusion", "(11) 9876-5432", "Yuki Tanaka", "yuki@temakifusion.com", "senha123");
  const token = await login("yuki@temakifusion.com", "senha123");

  const entradas   = await createCategory(token, "Entradas Japonesas", 1);
  const sushis     = await createCategory(token, "Sushis & Sashimis", 2);
  const uramakis   = await createCategory(token, "Uramakis Especiais", 3);
  const temakis    = await createCategory(token, "Temakis", 4);
  const quentes    = await createCategory(token, "Pratos Quentes", 5);
  const sobremesasJ = await createCategory(token, "Sobremesas", 6);

  for (const p of [
    { name: "Edamame Tostado", description: "Vagens de soja tostadas no shoyu e gergelim torrado. Entrada tradicional japonesa.", price: 22.90, image: IMG.edamame },
    { name: "Gyoza Crispy (8 un)", description: "Pastel japonês grelhado de um lado e cozido no vapor, recheio de frango e gengibre. Crocante e suculento.", price: 36.90, image: IMG.sushiCombo },
    { name: "Missoshiru", description: "Sopa tradicional de missô com tofu sedoso, wakame e cebolinha. Conforto japonês em cada colherada.", price: 18.90, image: IMG.edamame },
    { name: "Tataki de Salmão", description: "Salmão grelhado por fora, cru por dentro, com molho ponzu, cebola crispy e gengibre fresco.", price: 52.90, image: IMG.sashimi },
  ]) await createProduct(token, entradas, p);

  for (const p of [
    { name: "Combinado Premium 30 Peças", description: "Seleção especial com nigiri de salmão, atum e robalo, sashimi variado e uramakis da temporada.", price: 128.90, image: IMG.sushiCombo },
    { name: "Sashimi de Salmão (12 fatias)", description: "Salmão fresco cortado na faca em fatias grossas, servido com wasabi, gengibre e molho shoyu.", price: 62.90, image: IMG.sashimi },
    { name: "Nigiri de Atum (6 un)", description: "Bolinho de arroz japonês temperado, coberto com fatia generosa de atum rabilho.", price: 48.90, image: IMG.sashimi },
    { name: "Combinado Clássico 20 Peças", description: "Variedade de nigiris com salmão, atum, robalo e camarão. Tradicional e delicioso.", price: 78.90, image: IMG.sushiCombo },
  ]) await createProduct(token, sushis, p);

  for (const p of [
    { name: "Hot Philadelphia", description: "Salmão, cream cheese e pepino por dentro, coberto com salmão temperado e maionese defumada. Servido quente.", price: 42.90, image: IMG.uramaki },
    { name: "Rainbow Roll (8 un)", description: "Base de caranguejo e abacate coberta com fatias coloridas de salmão, atum, robalo e camarão.", price: 56.90, image: IMG.uramaki },
    { name: "Dragon Roll", description: "Camarão empanado e pepino por dentro, coberto com abacate fatiado e molho especial da casa.", price: 52.90, image: IMG.uramaki },
    { name: "Volcano Roll (8 un)", description: "Salmão e cream cheese cobertos com mistura de frutos do mar gratinados e maionese picante.", price: 62.90, image: IMG.uramaki },
  ]) await createProduct(token, uramakis, p);

  for (const p of [
    { name: "Temaki de Salmão", description: "Cone de alga crocante com arroz japonês, salmão fresco, cream cheese e cebolinha.", price: 32.90, image: IMG.temaki },
    { name: "Temaki de Camarão Empanado", description: "Cone de alga com arroz, camarão empanado crocante, pepino, cream cheese e molho teriyaki.", price: 34.90, image: IMG.temaki },
    { name: "Temaki de Atum", description: "Cone de alga com arroz japonês, atum fresco, avocado e molho ponzu.", price: 34.90, image: IMG.temaki },
    { name: "Temaki Especial da Casa", description: "Cone de alga com arroz, mix de salmão, atum, cream cheese, pepino e ovas de peixe voador.", price: 42.90, image: IMG.temaki },
  ]) await createProduct(token, temakis, p);

  for (const p of [
    { name: "Udon com Frutos do Mar", description: "Massa udon grossa em caldo dashi com camarões, lula, vieira e legumes da temporada.", price: 68.90, image: IMG.taglioleCamarao },
    { name: "Ramen Tonkotsu", description: "Caldo de ossos de porco cozido por 12 horas, macarrão ramen, chashu de porco, ovo marinado e nori.", price: 72.90, image: IMG.taglioleCamarao },
    { name: "Katsu Curry", description: "Costeleta de frango empanada servida com curry japonês e arroz japonês. Comfort food clássico.", price: 58.90, image: IMG.fileTradicional },
  ]) await createProduct(token, quentes, p);

  for (const p of [
    { name: "Mochi de Matcha", description: "Bolinha de massa de arroz glutinoso recheada com sorvete de matcha premium. Delicioso contraste.", price: 24.90, image: IMG.sorvete },
    { name: "Dorayaki de Chocolate", description: "Mini panquecas fofas recheadas com creme de chocolate ao estilo japonês tradicional.", price: 19.90, image: IMG.mousse },
  ]) await createProduct(token, sobremesasJ, p);

  console.log("  ✅ Temaki Fusion concluído");
}

// ─── BLACK HOLE BURGERS ───────────────────────────────────────────────────────
async function seedBlackHole() {
  console.log("\n🍔  Black Hole Burgers");
  await register("Black Hole Burgers", "blackhole-burgers", "(11) 5555-0001", "Lucas Freitas", "lucas@blackhole.com", "senha123");
  const token = await login("lucas@blackhole.com", "senha123");

  const smash     = await createCategory(token, "Smash Burgers", 1);
  const classicos = await createCategory(token, "Clássicos", 2);
  const chicken   = await createCategory(token, "Chicken Burgers", 3);
  const sides     = await createCategory(token, "Acompanhamentos", 4);
  const milkshake = await createCategory(token, "Milkshakes", 5);

  for (const p of [
    { name: "Black Smash Duplo", description: "Dois smash patties de wagyu 150g cada, queijo americano fundido, cebola caramelizada, picles e molho secreto da casa. Pão brioché tostado.", price: 52.90, image: IMG.burgerDouble },
    { name: "Truffle Smash", description: "Smash patty de angus, queijo brie, cogumelos salteados, maionese de trufa e rúcula. Sofisticação no palco.", price: 58.90, image: IMG.burgerBacon },
    { name: "Bacon Inferno Smash", description: "Smash triplo com bacon defumado, jalapeño em conserva, queijo cheddar extra e molho chipotle de pimenta.", price: 62.90, image: IMG.burgerBacon },
  ]) await createProduct(token, smash, p);

  for (const p of [
    { name: "Classic Cheeseburger", description: "Blend de angus 180g, queijo americano, alface americana, tomate, cebola e molho especial.", price: 38.90, image: IMG.burger },
    { name: "BBQ Ranch", description: "Blend 180g, queijo cheddar, anéis de cebola crocantes, bacon e molho barbecue defumado artesanal.", price: 44.90, image: IMG.burgerBacon },
    { name: "Mushroom Swiss", description: "Blend 180g, queijo suíço, cogumelos Paris e Shiitake salteados, molho Worcestershire.", price: 46.90, image: IMG.burger },
    { name: "Veggie Burger", description: "Blend de grão-de-bico e beterraba 180g, queijo vegano, abacate amassado, tomate e alface.", price: 39.90, image: IMG.burger },
  ]) await createProduct(token, classicos, p);

  for (const p of [
    { name: "Crispy Chicken Clássico", description: "Frango empanado em buttermilk, queijo americano, pickles e molho ranch cremoso.", price: 42.90, image: IMG.burgerChicken },
    { name: "Nashville Hot Chicken", description: "Frango frito banhado em pasta de pimenta Nashville, repolho coleslaw e picles. Para os corajosos.", price: 46.90, image: IMG.burgerChicken },
    { name: "Chicken Parmegiana Burger", description: "Frango empanado crocante com molho pomodoro, queijo muçarela gratinado e manjericão.", price: 44.90, image: IMG.burgerChicken },
  ]) await createProduct(token, chicken, p);

  for (const p of [
    { name: "Batata Frita Artesanal", description: "Batatas cortadas na hora, fritas duas vezes e temperadas com blend de especiarias da casa.", price: 24.90, image: IMG.batataFritaBurg },
    { name: "Anéis de Cebola Crocante", description: "Cebola em anéis empanada em massa crocante, servida com molho chipotle.", price: 26.90, image: IMG.onionRings },
    { name: "Mac n' Cheese Cremoso", description: "Macarrão cotovelo em molho bechamel com queijo cheddar, parmesão e bacon crocante.", price: 32.90, image: IMG.batataQueijo },
    { name: "Batata Bacon & Cheddar", description: "Batatas fritas cobertas com queijo cheddar extra derretido e bacon defumado.", price: 34.90, image: IMG.batataQueijo },
  ]) await createProduct(token, sides, p);

  for (const p of [
    { name: "Milkshake de Nutella", description: "Sorvete de baunilha, Nutella, leite integral, chantilly e granulado. Indulgência máxima.", price: 28.90, image: IMG.sorvete },
    { name: "Milkshake Oreo", description: "Sorvete de creme, Oreos trituradas, leite e chantilly generoso.", price: 28.90, image: IMG.sorvete },
    { name: "Milkshake Red Velvet", description: "Sorvete, red velvet cake, cream cheese e cobertura de veludo.", price: 32.90, image: IMG.sorvete },
  ]) await createProduct(token, milkshake, p);

  console.log("  ✅ Black Hole concluído");
}

// ─── CAFÉ VILA BISTRÔ ─────────────────────────────────────────────────────────
async function seedCafeVila() {
  console.log("\n☕  Café Vila Bistrô");
  await register("Café Vila Bistrô", "cafe-vila", "(11) 4444-2222", "Mariana Costa", "mariana@cafevila.com", "senha123");
  const token = await login("mariana@cafevila.com", "senha123");

  const cafes     = await createCategory(token, "Cafés & Bebidas Quentes", 1);
  const frios     = await createCategory(token, "Bebidas Frias", 2);
  const cafe_da_manha = await createCategory(token, "Café da Manhã", 3);
  const brunch    = await createCategory(token, "Brunch", 4);
  const almocoL   = await createCategory(token, "Almoço Leve", 5);
  const doces     = await createCategory(token, "Doces & Patisserie", 6);

  for (const p of [
    { name: "Espresso Duplo", description: "Dois shots de espresso de blend especial da casa, tostado suave. Aroma intenso e cremosidade perfeita.", price: 9.90, image: IMG.cafe },
    { name: "Cappuccino Italiano", description: "Espresso, leite vaporizado e espuma densa de leite. Finalizado com leve toque de canela.", price: 14.90, image: IMG.cafe },
    { name: "Latte Art", description: "Espresso com leite vaporizado suave e arte latte desenhada pelo barista.", price: 16.90, image: IMG.cafe },
    { name: "Flat White", description: "Dois shots de espresso com microespuma de leite. Mais intenso que o latte, menor que o cappuccino.", price: 14.90, image: IMG.cafe },
    { name: "Chá de Ervas Premium", description: "Seleção de chás premium: camomila, cidreira, hortelã ou hibisco. Servido com mel.", price: 12.90, image: IMG.cafe },
  ]) await createProduct(token, cafes, p);

  for (const p of [
    { name: "Cold Brew 24h", description: "Café extraído a frio por 24 horas, servido com gelo em cubo e leite de aveia opcional.", price: 18.90, image: IMG.cafe },
    { name: "Iced Matcha Latte", description: "Matcha premium com leite gelado e xarope de baunilha. Antioxidante e energizante.", price: 22.90, image: IMG.cafe },
    { name: "Limonada Suíça", description: "Limão tahiti, leite condensado, creme de leite e muito gelo. Cremosa e refrescante.", price: 19.90, image: IMG.caipirinha },
    { name: "Vitamina de Açaí", description: "Açaí puro da Amazônia, banana, granola artesanal e mel de flores silvestres.", price: 24.90, image: IMG.sorvete },
  ]) await createProduct(token, frios, p);

  for (const p of [
    { name: "Croissant de Manteiga", description: "Croissant laminado artesanal com 27 camadas, manteiga francesa e mel de flores. Crocante e amanteigado.", price: 14.90, image: IMG.croissant },
    { name: "Pão na Chapa com Queijo", description: "Pão artesanal de fermentação natural na chapa, recheado com queijo minas e manteiga.", price: 16.90, image: IMG.taost },
    { name: "Tapioca Cremosa", description: "Tapioca sequinha recheada com queijo coalho e manteiga de garrafa. Café da manhã nordestino.", price: 18.90, image: IMG.taost },
    { name: "Bowl de Açaí", description: "Açaí cremoso da Amazônia com banana, morango, granola artesanal e mel.", price: 26.90, image: IMG.sorvete },
  ]) await createProduct(token, cafe_da_manha, p);

  for (const p of [
    { name: "Ovos Benedict", description: "Dois ovos pochê sobre muffin inglês com bacon canadense e hollandaise clássico. Brunch perfeito.", price: 38.90, image: IMG.taost },
    { name: "Scramble de Trufas", description: "Ovos mexidos cremosos com trufa negra ralada na hora, tosta de pão de fermentação natural.", price: 42.90, image: IMG.taost },
    { name: "Açaí Bowl Completo", description: "Açaí cremoso com granola, morangos, bananas, kiwi, chia e fio de mel. Colorido e nutritivo.", price: 34.90, image: IMG.sorvete },
    { name: "Waffles Belgas", description: "Waffles crocantes servidos com manteiga, frutas frescas da temporada e calda de maple.", price: 36.90, image: IMG.sorvete },
  ]) await createProduct(token, brunch, p);

  for (const p of [
    { name: "Salada Niçoise", description: "Atum albacore, ovos cozidos, vagem, azeitonas niçoise, alcaparras e vinagrete de mostarda Dijon.", price: 46.90, image: IMG.salada },
    { name: "Quiche Lorraine", description: "Quiche com recheio de bacon, queijo gruyère e creme de leite fresco. Clássico francês.", price: 32.90, image: IMG.quiche },
    { name: "Club Sandwich Premium", description: "Pão de forma artesanal, frango defumado, bacon, queijo suíço, tomate e alface americana.", price: 42.90, image: IMG.sanduiche },
    { name: "Sopa do Dia", description: "Sopa cremosa do dia preparada com ingredientes frescos da temporada. Consulte o cardápio do dia.", price: 28.90, image: IMG.edamame },
  ]) await createProduct(token, almocoL, p);

  for (const p of [
    { name: "Croissant de Chocolate", description: "Pain au chocolat recheado com chocolate belga 70%, finalizado com flor de sal.", price: 19.90, image: IMG.croissant },
    { name: "Bolo de Limão com Calda", description: "Bolo fofo de limão siciliano com calda de glacê e raspas de limão fresco.", price: 16.90, image: IMG.mousse },
    { name: "Éclair de Baunilha", description: "Massa choux com recheio de creme de baunilha bourbon e cobertura de fondant.", price: 18.90, image: IMG.mousse },
    { name: "Brownie Fudge de Chocolate", description: "Brownie denso e úmido com chocolate 70% cacau, nozes e sal defumado.", price: 22.90, image: IMG.mousse },
    { name: "Cheesecake de Frutas Vermelhas", description: "Base de biscoito, cream cheese cremoso e cobertura de coulis de frutas vermelhas frescas.", price: 28.90, image: IMG.mousse },
  ]) await createProduct(token, doces, p);

  console.log("  ✅ Café Vila concluído");
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
console.log("🌱  Iniciando seed da base de dados Zap Mesa...\n");

try {
  await seedQuico();
  await seedNapolitana();
  await seedTemaki();
  await seedBlackHole();
  await seedCafeVila();
  console.log("\n✅  Seed completo! Todos os restaurantes foram populados com sucesso.");
} catch (err) {
  console.error("\n❌  Erro no seed:", err);
  process.exit(1);
}
