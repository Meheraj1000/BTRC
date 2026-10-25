export type DemoCamera = {
  code: string;
  name: string;
  city: string;
  area: string;
  latitude: number;
  longitude: number;
  status: "ONLINE" | "OFFLINE" | "MAINTENANCE";
  facing: string;
};

/** Demonstration cameras only. They are not connected to a street camera. */
export const DEMO_CAMERAS: DemoCamera[] = [
  { code: "DMP-CAM-GUL-01", name: "Gulshan 1 Circle (Demo)", city: "Dhaka", area: "Gulshan", latitude: 23.7806, longitude: 90.4167, status: "ONLINE", facing: "North" },
  { code: "DMP-CAM-MOT-02", name: "Shapla Chattar (Demo)", city: "Dhaka", area: "Motijheel", latitude: 23.7295, longitude: 90.4175, status: "ONLINE", facing: "East" },
  { code: "DMP-CAM-MIR-03", name: "Mirpur 10 (Demo)", city: "Dhaka", area: "Mirpur", latitude: 23.8069, longitude: 90.3686, status: "ONLINE", facing: "South" },
  { code: "DMP-CAM-FAR-04", name: "Farmgate (Demo)", city: "Dhaka", area: "Tejgaon", latitude: 23.7561, longitude: 90.3872, status: "OFFLINE", facing: "West" },
  { code: "CMP-CAM-GEC-01", name: "GEC Circle (Demo)", city: "Chattogram", area: "Khulshi", latitude: 22.3594, longitude: 91.8214, status: "ONLINE", facing: "North" },
  { code: "CMP-CAM-AGR-02", name: "Agrabad (Demo)", city: "Chattogram", area: "Agrabad", latitude: 22.3236, longitude: 91.8126, status: "ONLINE", facing: "East" },
  { code: "CMP-CAM-OXY-03", name: "Oxygen Square (Demo)", city: "Chattogram", area: "Bayezid", latitude: 22.392, longitude: 91.825, status: "MAINTENANCE", facing: "South" },
  { code: "SMP-CAM-AMB-01", name: "Ambarkhana (Demo)", city: "Sylhet", area: "Sylhet Sadar", latitude: 24.899, longitude: 91.8705, status: "ONLINE", facing: "North" },
  { code: "SMP-CAM-ZIN-02", name: "Zindabazar (Demo)", city: "Sylhet", area: "Sylhet Sadar", latitude: 24.8912, longitude: 91.868, status: "ONLINE", facing: "West" },
  { code: "RMP-CAM-SHA-01", name: "Shaheb Bazar (Demo)", city: "Rajshahi", area: "Rajshahi Sadar", latitude: 24.3667, longitude: 88.6, status: "ONLINE", facing: "East" },
  { code: "RMP-CAM-RAJ-02", name: "Railgate (Demo)", city: "Rajshahi", area: "Rajshahi Sadar", latitude: 24.374, longitude: 88.6045, status: "ONLINE", facing: "South" },
  { code: "KMP-CAM-RUP-01", name: "Rupsha Bridge Approach (Demo)", city: "Khulna", area: "Khalishpur", latitude: 22.815, longitude: 89.567, status: "ONLINE", facing: "North" },
  { code: "KMP-CAM-DKE-02", name: "Dakbangla (Demo)", city: "Khulna", area: "Khulna Sadar", latitude: 22.8135, longitude: 89.5672, status: "ONLINE", facing: "East" },
];
