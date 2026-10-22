"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { packDash } from "./i18n/pack-dash";
import { packErrors } from "./i18n/pack-errors";
import { packDesks } from "./i18n/pack-desks";
import { packOps } from "./i18n/pack-ops";
import { packPassenger } from "./i18n/pack-passenger";

export type Locale = "en" | "bn";

const STORAGE_KEY = "nt_locale";

const bn: Record<string, string> = {
  "Sign in": "প্রবেশ করুন",
  "Sign out": "প্রস্থান",
  "Passenger register": "যাত্রী নিবন্ধন",
  "Driver register": "চালক নিবন্ধন",
  "Create passenger account": "যাত্রী অ্যাকাউন্ট তৈরি",
  "Creates a passenger role account only.": "শুধু যাত্রী অ্যাকাউন্ট তৈরি হবে।",
  "Passenger registration": "যাত্রী নিবন্ধন",
  "Full name": "পূর্ণ নাম",
  "Email": "ইমেইল",
  "Phone": "ফোন",
  "Password": "পাসওয়ার্ড",
  "Minimum 8 characters": "কমপক্ষে ৮ অক্ষর",
  "Create account": "অ্যাকাউন্ট তৈরি",
  "Creating…": "তৈরি হচ্ছে…",
  "Back to sign in": "প্রবেশ পাতায় ফিরুন",
  "Loading…": "লোড হচ্ছে…",
  "Loading session…": "সেশন লোড হচ্ছে…",
  "Navigation": "মেনু",
  "Close menu": "মেনু বন্ধ",
  "Close": "বন্ধ",
  "Open menu": "মেনু খুলুন",
  "Notifications": "বিজ্ঞপ্তি",
  "DEMO / SIMULATION — Not connected to a live government API or physical GPS device.":
    "ডেমো / সিমুলেশন — এটি সরাসরি সরকারি এপিআই বা বাস্তব জিপিএস যন্ত্রের সাথে যুক্ত নয়।",
  "Dashboard": "ড্যাশবোর্ড",
  "Users": "ব্যবহারকারী",
  "Drivers": "চালক",
  "Buses": "বাস",
  "Companies": "কোম্পানি",
  "Routes": "রুট",
  "GPS devices": "জিপিএস যন্ত্র",
  "Trips": "ট্রিপ",
  "Alerts": "সতর্কতা",
  "SOS": "জরুরি সংকেত",
  "Complaints": "অভিযোগ",
  "Reports": "প্রতিবেদন",
  "Analytics": "বিশ্লেষণ",
  "Settings": "সেটিংস",
  "Audit logs": "নিরীক্ষা লগ",
  "Live map": "লাইভ মানচিত্র",
  "Emergencies": "জরুরি অবস্থা",
  "Incidents": "ঘটনা",
  "Vehicles": "যানবাহন",
  "Licenses": "লাইসেন্স",
  "Fitness": "ফিটনেস",
  "Violations": "লঙ্ঘন",
  "Home": "হোম",
  "Scan bus": "বাস স্ক্যান",
  "Map": "মানচিত্র",
  "Lost & Found": "হারানো ও পাওয়া",
  "Profile": "প্রোফাইল",
  "My bus": "আমার বাস",
  "My route": "আমার রুট",
  "Trip": "ট্রিপ",
  "GPS": "জিপিএস",
  "History": "ইতিহাস",
  "Vehicle lookup": "যানবাহন খোঁজ",
  "Super Admin": "সুপার অ্যাডমিন",
  "Government": "সরকার",
  "BRTA": "বিআরটিএ",
  "Police": "পুলিশ",
  "Operator": "অপারেটর",
  "Driver": "চালক",
  "Passenger": "যাত্রী",
  "Admin dashboard": "অ্যাডমিন ড্যাশবোর্ড",
  "Government dashboard": "সরকারি ড্যাশবোর্ড",
  "BRTA dashboard": "বিআরটিএ ড্যাশবোর্ড",
  "Operator dashboard": "অপারেটর ড্যাশবোর্ড",
  "Driver dashboard": "চালক ড্যাশবোর্ড",
  "Police & emergency monitoring": "পুলিশ ও জরুরি নজরদারি",
  "Nationwide buses": "সারাদেশের বাস",
  "Company buses": "কোম্পানির বাস",
  "Vehicle registration": "যানবাহন নিবন্ধন",
  "Vehicle fitness": "যানবাহনের ফিটনেস",
  "Company drivers": "কোম্পানির চালক",
  "Driver information": "চালকের তথ্য",
  "License verification": "লাইসেন্স যাচাই",
  "Driver statistics": "চালক পরিসংখ্যান",
  "Live bus map": "বাস লাইভ মানচিত্র",
  "Police live map": "পুলিশ লাইভ মানচিত্র",
  "Nationwide live map": "সারাদেশের লাইভ মানচিত্র",
  "GPS sharing view": "জিপিএস শেয়ার",
  "Trip history": "ট্রিপ ইতিহাস",
  "Trip information": "ট্রিপের তথ্য",
  "Assigned bus": "নির্ধারিত বাস",
  "Assigned route": "নির্ধারিত রুট",
  "Driver SOS": "চালকের জরুরি সংকেত",
  "Emergency SOS": "জরুরি সংকেত",
  "Operational alerts": "কার্যকরী সতর্কতা",
  "Incident foundation": "ঘটনার তালিকা",
  "Transport companies": "পরিবহন কোম্পানি",
  "Violation history": "লঙ্ঘনের ইতিহাস",
  "Passenger home": "যাত্রীর হোম",
  "Search routes": "রুট খুঁজুন",
  "Route details": "রুটের বিবরণ",
  "Find a bus": "বাস খুঁজুন",
  "Bus details": "বাসের বিবরণ",
  "Scan bus QR": "বাসের কিউআর স্ক্যান",
  "Boarded bus": "উঠা বাস",
  "Save": "সংরক্ষণ",
  "Saving…": "সংরক্ষণ হচ্ছে…",
  "Cancel": "বাতিল",
  "Previous": "পূর্ববর্তী",
  "Next": "পরবর্তী",
  "Refresh": "রিফ্রেশ",
  "Search": "খুঁজুন",
  "Edit": "সম্পাদনা",
  "Archive": "আর্কাইভ",
  "Register vehicle": "যানবাহন নিবন্ধন",
  "Register driver": "চালক নিবন্ধন",
  "Register device": "যন্ত্র নিবন্ধন",
  "Submit": "জমা দিন",
  "Submit complaint": "অভিযোগ জমা",
  "Submit for review": "পর্যালোচনার জন্য জমা",
  "Submitting…": "জমা হচ্ছে…",
  "Signing in…": "প্রবেশ হচ্ছে…",
  "Back": "পেছনে",
  "Copy link": "লিংক কপি",
  "Copy key": "কী কপি",
  "Download QR": "কিউআর ডাউনলোড",
  "Open page": "পাতা খুলুন",
  "Connect device": "যন্ত্র সংযোগ",
  "Disconnect": "সংযোগ বিচ্ছিন্ন",
  "Accept registration": "নিবন্ধন গ্রহণ",
  "Reject": "প্রত্যাখ্যান",
  "Pending reviews": "অপেক্ষমাণ পর্যালোচনা",
  "Active": "সক্রিয়",
  "ACTIVE": "সক্রিয়",
  "INACTIVE": "নিষ্ক্রিয়",
  "PENDING": "অপেক্ষমাণ",
  "PENDING_REVIEW": "পর্যালোচনাধীন",
  "APPROVED": "গৃহীত",
  "REJECTED": "প্রত্যাখ্যাত",
  "SUSPENDED": "স্থগিত",
  "VALID": "বৈধ",
  "EXPIRED": "মেয়াদোত্তীর্ণ",
  "FIT": "ফিট",
  "UNFIT": "আনফিট",
  "ONLINE": "অনলাইন",
  "STALE": "পুরনো",
  "CONNECTED": "সংযুক্ত",
  "UNBOUND": "অসংযুক্ত",
  "Ready": "প্রস্তুত",
  "None": "নেই",
  "Unassigned": "নির্ধারিত নয়",
  "No route assigned": "কোনো রুট নেই",
  "No driver assigned": "কোনো চালক নেই",
  "Bangladesh · National transport safety": "বাংলাদেশ · জাতীয় পরিবহন নিরাপত্তা",
  "Bangladesh · Safe public transport": "বাংলাদেশ · নিরাপদ গণপরিবহন",
  "Safe public transport monitoring for Bangladesh — GPS tracking, compliance, and emergency workflows in one civic platform.":
    "বাংলাদেশের নিরাপদ গণপরিবহন নজরদারি — জিপিএস, নিয়ম মেনে চলা এবং জরুরি কার্যক্রম এক প্ল্যাটফর্মে।",
  "Research / FYDP prototype. GPS is simulated unless a real device feed is configured. Demo accounts are not government credentials.":
    "গবেষণা / এফওয়াইডিপি প্রোটোটাইপ। বাস্তব যন্ত্র না থাকলে জিপিএস সিমুলেটেড। ডেমো অ্যাকাউন্ট সরকারি পরিচয় নয়।",
  "Who it serves": "যাদের জন্য",
  "One national brand across passenger, operator, and authority experiences.":
    "যাত্রী, অপারেটর ও কর্তৃপক্ষের জন্য একই জাতীয় সেবা।",
  "Passengers": "যাত্রী",
  "Nearby buses, live map, route search, SOS, and complaints.":
    "কাছের বাস, লাইভ মানচিত্র, রুট খোঁজা, জরুরি সংকেত ও অভিযোগ।",
  "Operators & drivers": "অপারেটর ও চালক",
  "Fleet, assignments, trips, GPS sharing, and alerts.":
    "বহর, দায়িত্ব, ট্রিপ, জিপিএস ও সতর্কতা।",
  "Authorities": "কর্তৃপক্ষ",
  "Government, BRTA, and police monitoring with role-based access.":
    "সরকার, বিআরটিএ ও পুলিশের ভূমিকাভিত্তিক নজরদারি।",
  "Role-based access for the national transport command demo.":
    "জাতীয় পরিবহন ডেমোর জন্য ভূমিকাভিত্তিক প্রবেশ।",
  "Demo accounts": "ডেমো অ্যাকাউন্ট",
  "Demo password for all seeded accounts:": "সব ডেমো অ্যাকাউন্টের পাসওয়ার্ড:",
  "Already registered?": "আগেই নিবন্ধিত?",
  "Register as a driver": "চালক হিসেবে নিবন্ধন",
  "Driver self-registration": "চালকের নিজস্ব নিবন্ধন",
  "Submit your details for Super Admin review. You cannot sign in until the registration is accepted.":
    "তথ্য জমা দিন। সুপার অ্যাডমিন গ্রহণ না করা পর্যন্ত প্রবেশ করা যাবে না।",
  "Phone (01XXXXXXXXX)": "ফোন (০১XXXXXXXXX)",
  "Driving license number": "ড্রাইভিং লাইসেন্স নম্বর",
  "License expiry": "লাইসেন্সের মেয়াদ",
  "Experience (years)": "অভিজ্ঞতা (বছর)",
  "Preferred operator (optional)": "পছন্দের অপারেটর (ঐচ্ছিক)",
  "Select later / Super Admin will assign": "পরে বাছাই / সুপার অ্যাডমিন নির্ধারণ করবেন",
  "Boarded a bus?": "বাসে উঠেছেন?",
  "Scan the QR on the vehicle to see bus and driver details, lodge a complaint, or report an emergency.":
    "যানের কিউআর স্ক্যান করলে বাস ও চালকের তথ্য দেখা যাবে, অভিযোগ বা জরুরি সংকেত দেওয়া যাবে।",
  "My complaints": "আমার অভিযোগ",
  "Search all routes": "সব রুট খুঁজুন",
  "Live monitoring map": "লাইভ নজরদারি মানচিত্র",
  "Vehicle monitoring": "যানবাহন নজরদারি",
  "Driver monitoring": "চালক নজরদারি",
  "Route overview": "রুট সংক্ষেপ",
  "Recent alerts / compliance": "সাম্প্রতিক সতর্কতা",
  "Recent administrative activity": "সাম্প্রতিক প্রশাসনিক কাজ",
  "Live emergency map": "জরুরি লাইভ মানচিত্র",
  "Vehicle search": "যানবাহন খোঁজ",
  "Important events": "গুরুত্বপূর্ণ ঘটনা",
  "Full vehicle lookup": "পূর্ণ যানবাহন খোঁজ",
  "Point of origin": "যাত্রার উৎপত্তি",
  "Operating driver": "দায়িত্বরত চালক",
  "Vehicle information": "যানের তথ্য",
  "Last known location": "সর্বশেষ অবস্থান",
  "Open complaint": "অভিযোগ খুলুন",
  "Lodge a complaint": "অভিযোগ দায়ের",
  "Trigger SOS": "জরুরি সংকেত পাঠান",
  "Confirm SOS": "জরুরি সংকেত নিশ্চিত",
  "Scan another": "আরেকটি স্ক্যান",
  "Camera scan": "ক্যামেরা স্ক্যান",
  "Enter code manually": "কোড হাতে লিখুন",
  "Open bus details": "বাসের তথ্য খুলুন",
  "Registration": "নিবন্ধন",
  "Type": "ধরন",
  "Status": "অবস্থা",
  "Verification": "যাচাই",
  "QR": "কিউআর",
  "Name": "নাম",
  "License": "লাইসেন্স",
  "Validity": "বৈধতা",
  "Vehicle": "যান",
  "Origin": "উৎপত্তি",
  "Destination": "গন্তব্য",
  "Operator": "অপারেটর",
  "Route": "রুট",
  "Serial": "সিরিয়াল",
  "Vendor": "প্রস্তুতকারক",
  "Link": "সংযোগ",
  "Last seen": "সর্বশেষ দেখা",
  "Language": "ভাষা",
  "Bengali": "বাংলা",
  "English": "English",
};

const dictionary: Record<string, string> = {
  ...packDesks,
  ...packPassenger,
  ...packOps,
  ...packDash,
  ...packErrors,
  ...bn,
};

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (text: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

function readInitial(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "bn" || stored === "en") return stored;
  return navigator.language.toLowerCase().startsWith("bn") ? "bn" : "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLocaleState(readInitial());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = locale === "bn" ? "bn" : "en";
    localStorage.setItem(STORAGE_KEY, locale);
  }, [locale, ready]);

  const value = useMemo<I18nValue>(() => {
    return {
      locale,
      setLocale: setLocaleState,
      t: (text: string) => (locale === "bn" ? dictionary[text] ?? text : text),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: "en" as Locale,
      setLocale: (_locale: Locale) => undefined,
      t: (text: string) => text,
    };
  }
  return ctx;
}

export function AuthLoading() {
  const { t } = useI18n();
  return <div className="auth-shell text-sm text-slate-300">{t("Loading…")}</div>;
}

export function LanguageToggle({ invert = false }: { invert?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  const idle = invert
    ? "border-white/25 text-white/80 hover:bg-white/10"
    : "border-[var(--border)] text-[var(--text-secondary)] hover:border-brand-600";
  const on = invert
    ? "border-white bg-white text-ink-950"
    : "border-brand-600 bg-[var(--surface-secondary)] text-brand-700";
  return (
    <div className="inline-flex rounded-full border border-transparent" role="group" aria-label={t("Language")}>
      <button
        type="button"
        className={`rounded-l-full border px-3 py-1 text-xs font-semibold ${locale === "bn" ? on : idle}`}
        aria-pressed={locale === "bn"}
        onClick={() => setLocale("bn")}
      >
        বাংলা
      </button>
      <button
        type="button"
        className={`rounded-r-full border px-3 py-1 text-xs font-semibold ${locale === "en" ? on : idle}`}
        aria-pressed={locale === "en"}
        onClick={() => setLocale("en")}
      >
        English
      </button>
    </div>
  );
}
