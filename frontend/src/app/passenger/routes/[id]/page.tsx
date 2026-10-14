"use client";
import { useParams } from "next/navigation";
import { PassengerRouteDetail } from "@/components/PassengerViews";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <PassengerRouteDetail id={String(params.id)} />;
}
