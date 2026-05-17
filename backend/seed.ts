import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create platform owner
  const ownerPassword = await bcrypt.hash("admin123", 10);
  const owner = await prisma.user.create({
    data: {
      name: "Admin Plataforma",
      email: "admin@zapmesa.com",
      password: ownerPassword,
      role: "PLATFORM_OWNER",
    },
  });

  console.log("✅ Platform owner created:", owner.email);

  // Create a test restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Churrascaria do João",
      slug: "churrascaria-joao",
      phone: "(11) 98765-4321",
      users: {
        create: {
          name: "João Silva",
          email: "joao@churrascaria.com",
          password: await bcrypt.hash("admin123", 10),
          role: "RESTAURANT_ADMIN",
        },
      },
    },
  });

  console.log("✅ Test restaurant created:", restaurant.name);

  // Create categories
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: "Carnes",
        position: 1,
        restaurantId: restaurant.id,
      },
    }),
    prisma.category.create({
      data: {
        name: "Acompanhamentos",
        position: 2,
        restaurantId: restaurant.id,
      },
    }),
    prisma.category.create({
      data: {
        name: "Bebidas",
        position: 3,
        restaurantId: restaurant.id,
      },
    }),
  ]);

  console.log("✅ Categories created:", categories.length);

  // Create products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Picanha Premium",
        description: "Picanha de primeira qualidade",
        price: 89.9,
        restaurantId: restaurant.id,
        categoryId: categories[0].id,
      },
    }),
    prisma.product.create({
      data: {
        name: "Arroz",
        description: "Arroz branco cremoso",
        price: 15.0,
        restaurantId: restaurant.id,
        categoryId: categories[1].id,
      },
    }),
    prisma.product.create({
      data: {
        name: "Chopp",
        description: "Chopp Brahma gelado",
        price: 8.5,
        restaurantId: restaurant.id,
        categoryId: categories[2].id,
      },
    }),
  ]);

  console.log("✅ Products created:", products.length);

  // Create tables
  const tables = await Promise.all([
    prisma.table.create({
      data: {
        number: 1,
        qrCode: "table-1",
        restaurantId: restaurant.id,
      },
    }),
    prisma.table.create({
      data: {
        number: 2,
        qrCode: "table-2",
        restaurantId: restaurant.id,
      },
    }),
  ]);

  console.log("✅ Tables created:", tables.length);

  // Create some test orders
  const order = await prisma.order.create({
    data: {
      total: 179.8,
      status: "delivered",
      restaurantId: restaurant.id,
      tableId: tables[0].id,
      items: {
        create: [
          {
            productId: products[0].id,
            quantity: 2,
            price: 89.9,
            notes: "Bem passado",
          },
        ],
      },
    },
  });

  console.log("✅ Test order created");

  console.log("\n🎉 Database seeded successfully!");
  console.log("\n📝 Login credentials:");
  console.log("  Platform Owner:");
  console.log("    Email: admin@zapmesa.com");
  console.log("    Password: admin123");
  console.log("\n  Restaurant Admin:");
  console.log("    Email: joao@churrascaria.com");
  console.log("    Password: admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
