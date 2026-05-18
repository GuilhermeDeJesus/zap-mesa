"use client";

import { useParams } from "next/navigation";
import { MenuClient } from "../../_components/menu-client";

export default function MenuByDomainPage() {
  const params = useParams();
  const tableNumber = Number(params.table as string);

  return <MenuClient mode="host" tableNumber={tableNumber} />;
}
