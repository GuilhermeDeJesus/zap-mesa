"use client";

import { useParams } from "next/navigation";
import { MenuClient } from "../../_components/menu-client";

export default function MenuBySlugPage() {
  const params = useParams();
  const slug = params.slug as string;
  const tableNumber = Number(params.table as string);

  return <MenuClient mode="slug" slug={slug} tableNumber={tableNumber} />;
}
