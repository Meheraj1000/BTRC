"use client";

import { useParams } from "next/navigation";
import { PassengerBoardedBus } from "@/components/PassengerBoardedBus";

export default function Page() {
  const params = useParams<{ token: string }>();
  const token = String(params.token ?? "");
  return <PassengerBoardedBus token={token} />;
}
