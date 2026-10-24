"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { primaryRole } from "@/lib/nav";
import type { RoleCode } from "@/lib/types";

const KINDS = ["OFF_ROUTE", "DEVIATING", "OVERSPEED", "SOS", "COMPLAINT", "ALERT", "MAINTENANCE", "OFFLINE"] as const;

type Desk = { alerts?: string; sos?: string; complaints?: string; buses?: string };

const DESKS: Record<RoleCode, Desk> = {
  SUPER_ADMIN: { alerts: "/admin/alerts", sos: "/admin/sos", complaints: "/admin/complaints", buses: "/admin/buses" },
  GOVERNMENT: { alerts: "/government/alerts", sos: "/government/sos", complaints: "/government/complaints", buses: "/government/buses" },
  POLICE: { alerts: "/police/alerts", sos: "/police/emergencies", complaints: "/police/complaints", buses: "/police/buses" },
  BRTA: { complaints: "/brta/complaints", buses: "/brta/vehicles" },
  TRANSPORT_OWNER: { complaints: "/owner/complaints", buses: "/owner/buses" },
  DRIVER: { sos: "/driver/sos", buses: "/driver/my-bus" },
  PASSENGER: { sos: "/passenger/sos", complaints: "/passenger/complaints", buses: "/passenger/buses" },
};

function DeskLinks({ desk, keys }: { desk: Desk; keys: Array<keyof Desk> }) {
  const { t } = useI18n();
  const labels: Record<keyof Desk, string> = {
    alerts: "Open alerts",
    sos: "Open SOS desk",
    complaints: "Open complaints",
    buses: "Open vehicles",
  };
  const links = keys.filter((key) => desk[key]);
  if (!links.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {links.map((key) => (
        <Link key={key} className="btn btn-primary" href={desk[key] as string}>
          {t(labels[key])}
        </Link>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <section className="card p-4">
      <h2 className="font-display text-base font-semibold">{t(title)}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-[var(--text-secondary)]">{children}</div>
    </section>
  );
}

function ResolveIssue() {
  const { t } = useI18n();
  const { user } = useAuth();
  const params = useSearchParams();
  const registration = params.get("registration");
  const requested = (params.get("kinds") ?? "").split(",").map((kind) => kind.trim()).filter(Boolean);
  const visible = new Set(requested.length ? requested : KINDS);
  const role = primaryRole(user?.roles ?? []);
  const desk = DESKS[role];

  return (
    <AppShell allow={["SUPER_ADMIN", "GOVERNMENT", "POLICE", "BRTA", "TRANSPORT_OWNER", "DRIVER", "PASSENGER"]} title="Resolve a bus issue">
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-secondary)]">
          {registration
            ? `${t("Instructions for")} ${registration}. `
            : ""}
          {t("These steps explain how to clear a bus issue inside Nirapad Transit. An SOS here does not call 999 or send police or an ambulance. GPS stays simulated unless a real tracker is sending positions.")}
        </p>

        {visible.has("OFF_ROUTE") && (
          <Section title="Off route">
            <p>{t("The vehicle is outside its assigned road.")}</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>{t("Check the live map against the assigned route.")}</li>
              <li>{t("The driver returns the bus to that road, or the operator assigns the route the bus is actually running.")}</li>
              <li>{t("A monitor opens Alerts, acknowledges the route alert, and resolves it once the bus is back on the road and the record is no longer true.")}</li>
            </ol>
            <DeskLinks desk={desk} keys={["alerts", "buses"]} />
          </Section>
        )}

        {visible.has("DEVIATING") && (
          <Section title="Route drift">
            <p>{t("The vehicle is leaving its assigned road.")}</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>{t("Watch the next positions. A single noisy point is not yet off route.")}</li>
              <li>{t("If it keeps leaving the road, treat it as off route: return the bus or correct the assigned route.")}</li>
              <li>{t("Acknowledge the alert while it is being checked, then resolve it when the bus is back on the road.")}</li>
            </ol>
            <DeskLinks desk={desk} keys={["alerts", "buses"]} />
          </Section>
        )}

        {visible.has("OVERSPEED") && (
          <Section title="Overspeed">
            <p>{t("Current speed is above the route limit.")}</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>{t("The driver slows to the limit set on the route.")}</li>
              <li>{t("A monitor acknowledges the overspeed alert, then resolves it after the speed stays within the limit.")}</li>
            </ol>
            <DeskLinks desk={desk} keys={["alerts"]} />
          </Section>
        )}

        {visible.has("SOS") && (
          <Section title="Open SOS">
            <p>{t("An SOS is recorded in this application. This is not a live 999 dispatch.")}</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>{t("Open the SOS desk and read the bus, driver, and recorded location.")}</li>
              <li>{t("Acknowledge it, then mark it investigating or responding while someone checks the vehicle.")}</li>
              <li>{t("Resolve it when the situation is finished, or mark a false alarm, then close the record.")}</li>
              <li>{t("The person who sent it can cancel it while it is still open.")}</li>
            </ol>
            <DeskLinks desk={desk} keys={["sos"]} />
          </Section>
        )}

        {visible.has("COMPLAINT") && (
          <Section title="Open complaint">
            <p>{t("A passenger complaint is still open.")}</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>{t("Open Complaints and find the reference for this bus.")}</li>
              <li>{t("Set it under review and write an internal note about what was checked.")}</li>
              <li>{t("Resolve it with the outcome, or reject it when it does not stand. The red highlight clears after every open complaint on the bus is closed.")}</li>
            </ol>
            <DeskLinks desk={desk} keys={["complaints"]} />
          </Section>
        )}

        {visible.has("ALERT") && (
          <Section title="Open alert">
            <p>{t("An alert is still open.")}</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>{t("Open Alerts and filter by this registration number.")}</li>
              <li>{t("Acknowledge each open alert while it is being checked.")}</li>
              <li>{t("Resolve an alert only after the condition it describes has ended. Old unresolved alerts keep the bus red.")}</li>
            </ol>
            <DeskLinks desk={desk} keys={["alerts"]} />
          </Section>
        )}

        {visible.has("MAINTENANCE") && (
          <Section title="Marked in maintenance">
            <p>{t("This vehicle is marked in maintenance.")}</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>{t("Finish the workshop work and confirm the vehicle is fit to carry passengers.")}</li>
              <li>{t("On the vehicle desk, set the operational status back to active.")}</li>
            </ol>
            <DeskLinks desk={desk} keys={["buses"]} />
          </Section>
        )}

        {visible.has("OFFLINE") && (
          <Section title="Marked offline">
            <p>{t("This vehicle is marked offline.")}</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>{t("Check that its tracker is connected, or that the simulated feed is running for this demo.")}</li>
              <li>{t("Set the operational status back to active when the vehicle should be in service.")}</li>
            </ol>
            <DeskLinks desk={desk} keys={["buses"]} />
          </Section>
        )}
      </div>
    </AppShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResolveIssue />
    </Suspense>
  );
}
