export type RoleCode =
  | "SUPER_ADMIN"
  | "GOVERNMENT"
  | "BRTA"
  | "POLICE"
  | "TRANSPORT_OWNER"
  | "DRIVER"
  | "PASSENGER";

export type ApiOk<T> = { success: true; message: string; data: T };
export type ApiFail = { success: false; message: string; data: unknown };

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  status: string;
  roles: RoleCode[];
  areas?: string[];
  driver?: { id: string; licenseNumber: string; licenseStatus: string } | null;
  company?: { id: string; name: string } | null;
  passenger?: {
    emergencyContact?: string | null;
    emergencyName?: string | null;
    preferredLanguage?: string | null;
  } | null;
};

export type BusLive = {
  busId: string;
  registrationNo?: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: string;
  statusColor?: "GREEN" | "YELLOW" | "RED";
  hasIssue?: boolean;
  operationalStatus?: string | null;
  source?: string;
  dataLabel?: string;
  allowedSpeed?: number;
  trackingState?: "ONLINE" | "STALE";
  complianceStatus?: string;
  deviationM?: number;
  routeId?: string;
  routeName?: string;
  bus?: {
    id: string;
    registrationNo: string;
    operationalStatus: string;
    route?: { name: string; allowedSpeed: number; city: string } | null;
  };
};

export type Overview = {
  dataLabel: string;
  cards: Record<string, number>;
  scope?: string;
  method?: string;
  verificationLabel?: string;
};
