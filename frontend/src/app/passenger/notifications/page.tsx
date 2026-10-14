"use client";

import { NotificationsInbox } from "@/components/NotificationsInbox";

export default function Page() {
  return <NotificationsInbox allow={["PASSENGER", "SUPER_ADMIN"]} />;
}
