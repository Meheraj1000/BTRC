"use client";
import { useParams } from "next/navigation";
import { PassengerBusDetail } from "@/components/PassengerViews";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <PassengerBusDetail id={String(params.id)} />;
}
