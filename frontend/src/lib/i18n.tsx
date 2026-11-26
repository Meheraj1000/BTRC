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
  "Route": "রুট",
  "Serial": "সিরিয়াল",
  "Vendor": "প্রস্তুতকারক",
  "Link": "সংযোগ",
  "Last seen": "সর্বশেষ দেখা",
  "Language": "ভাষা",
  "Bengali": "বাংলা",
  "English": "English",
  "Skip to content": "মূল বিষয়ে যান",
  "Signed in as": "আপনি প্রবেশ করেছেন",
  "Practice system. Bus locations are simulated. For a real emergency, call 999.":
    "এটি অনুশীলনের ব্যবস্থা। বাসের অবস্থান নমুনা। আসল জরুরি অবস্থায় ৯৯৯-এ কল করুন।",
  "Find a bus, follow a route, or ask for help.": "বাস খুঁজুন, রুট দেখুন, অথবা সাহায্য চান।",
  "This is a practice system for learning how public transport safety works in Bangladesh. It is not a live government service.":
    "এটি বাংলাদেশের গণপরিবহন নিরাপত্তা বোঝার একটি অনুশীলন। এটি সরাসরি সরকারি সেবা নয়।",
  "Create a passenger account": "যাত্রীর অ্যাকাউন্ট তৈরি করুন",
  "What do you want to do?": "আপনি কী করতে চান?",
  "I am a passenger": "আমি যাত্রী",
  "See buses near you, scan the code on a bus, and report a problem.":
    "কাছের বাস দেখুন, বাসের কোড স্ক্যান করুন, এবং সমস্যা জানান।",
  "I drive a bus": "আমি বাস চালাই",
  "Create an account, then see your bus, your route, and today's trip.":
    "অ্যাকাউন্ট তৈরি করুন, তারপর আপনার বাস, রুট এবং আজকের ট্রিপ দেখুন।",
  "I already have an account": "আমার অ্যাকাউন্ট আছে",
  "On the sign-in page, choose a role. The practice password is filled in for you.":
    "প্রবেশের পাতায় একটি ভূমিকা বেছে নিন। অনুশীলনের পাসওয়ার্ড আগে থেকেই বসানো আছে।",
  "Practice password for every sample account:": "প্রতিটি নমুনা অ্যাকাউন্টের পাসওয়ার্ড:",
  "Choose a role below, then press Sign in. The practice password is already filled in.":
    "নিচে একটি ভূমিকা বেছে নিন, তারপর প্রবেশ করুন চাপুন। অনুশীলনের পাসওয়ার্ড আগে থেকেই বসানো আছে।",
  "Show password": "পাসওয়ার্ড দেখুন",
  "Hide password": "পাসওয়ার্ড লুকান",
  "You can open every part of the system.": "আপনি ব্যবস্থার সব অংশ খুলতে পারবেন।",
  "You can watch buses and emergencies across the country.": "আপনি সারা দেশের বাস ও জরুরি অবস্থা দেখতে পারবেন।",
  "You can check fitness certificates, licenses, and violations.": "আপনি ফিটনেস, লাইসেন্স ও লঙ্ঘন যাচাই করতে পারবেন।",
  "You can look up a bus and respond to emergencies in Dhaka.": "আপনি ঢাকায় বাস খুঁজে জরুরি অবস্থায় সাড়া দিতে পারবেন।",
  "You can look up a bus and respond to emergencies in Chattogram.": "আপনি চট্টগ্রামে বাস খুঁজে জরুরি অবস্থায় সাড়া দিতে পারবেন।",
  "You can look up a bus and respond to emergencies in Sylhet.": "আপনি সিলেটে বাস খুঁজে জরুরি অবস্থায় সাড়া দিতে পারবেন।",
  "You can look up a bus and respond to emergencies in Rajshahi.": "আপনি রাজশাহীতে বাস খুঁজে জরুরি অবস্থায় সাড়া দিতে পারবেন।",
  "You can look up a bus and respond to emergencies in Khulna.": "আপনি খুলনায় বাস খুঁজে জরুরি অবস্থায় সাড়া দিতে পারবেন।",
  "You can see your company's buses, drivers, and complaints.": "আপনি আপনার কোম্পানির বাস, চালক ও অভিযোগ দেখতে পারবেন।",
  "You can see your bus, your route, and today's trip.": "আপনি আপনার বাস, রুট ও আজকের ট্রিপ দেখতে পারবেন।",
  "You can find a bus, scan its code, and ask for help.": "আপনি বাস খুঁজে তার কোড স্ক্যান করতে ও সাহায্য চাইতে পারবেন।",
  "Locations here are practice data, not a live government feed. For a real emergency, call 999.":
    "এখানের অবস্থান অনুশীলনের তথ্য, সরাসরি সরকারি ফিড নয়। আসল জরুরি অবস্থায় ৯৯৯-এ কল করুন।",
  "No buses are close to you right now. Search a route or open the map.":
    "এখন আপনার কাছে কোনো বাস নেই। একটি রুট খুঁজুন অথবা মানচিত্র খুলুন।",
  "Active": "সক্রিয়",
  "Inactive": "নিষ্ক্রিয়",
  "In maintenance": "রক্ষণাবেক্ষণে",
  "Offline": "বন্ধ",
  "Location is current": "অবস্থান হালনাগাদ",
  "Location is out of date": "অবস্থান পুরোনো",
  "On the route": "রুটে আছে",
  "Near the route": "রুটের কাছে",
  "Off the route": "রুটের বাইরে",
  "Left the route": "রুট ছেড়েছে",
  "Back on the route": "আবার রুটে",
  "Waiting for review": "পর্যালোচনার অপেক্ষায়",
  "Valid": "বৈধ",
  "Expired": "মেয়াদোত্তীর্ণ",
  "Suspended": "স্থগিত",
  "Fit to run": "চলাচলের উপযোগী",
  "Not fit to run": "চলাচলের অনুপযোগী",
  "Open": "খোলা",
  "Seen": "দেখা হয়েছে",
  "Resolved": "সমাধান হয়েছে",
  "Closed": "বন্ধ",
  "Low": "কম",
  "Medium": "মাঝারি",
  "High": "বেশি",
  "Critical": "অতি জরুরি",
  "Start here. This is a summary of buses, alerts, and complaints. Open a section in the menu when you need detail.":
    "এখান থেকে শুরু করুন। এটা বাস, সতর্কতা ও অভিযোগের সারাংশ। বিস্তারিত লাগলে মেনু থেকে একটি অংশ খুলুন।",
  "People who can sign in, and what each person is allowed to see.": "যারা প্রবেশ করতে পারেন, এবং কে কী দেখতে পারবেন।",
  "Driver records for every company.": "সব কোম্পানির চালকের তথ্য।",
  "Bus records for every company. Open a row to see its route and driver.": "সব কোম্পানির বাসের তথ্য। রুট ও চালক দেখতে একটি সারি খুলুন।",
  "Transport companies in this practice system.": "এই অনুশীলনে থাকা পরিবহন কোম্পানি।",
  "Routes a bus can be assigned to, including the stops along the way.": "বাসের জন্য নির্ধারিত রুট, পথের স্টপসহ।",
  "Devices that share a bus location. In this practice system they are simulated.": "যে যন্ত্র বাসের অবস্থান পাঠায়। এই অনুশীলনে সেগুলো নমুনা।",
  "Trips that have been started or finished.": "শুরু বা শেষ হওয়া ট্রিপ।",
  "Automatic warnings, such as a bus leaving its route.": "স্বয়ংক্রিয় সতর্কতা, যেমন একটি বাস রুট ছেড়ে যাওয়া।",
  "Emergency alerts sent by passengers and drivers. Open one to see who sent it and where.":
    "যাত্রী ও চালকের জরুরি বার্তা। কে পাঠিয়েছে ও কোথা থেকে, দেখতে একটি খুলুন।",
  "Problems passengers reported. Open one to read it and record a reply.": "যাত্রীদের জানানো সমস্যা। পড়ে উত্তর লিখতে একটি খুলুন।",
  "Street cameras in this practice system. These are not a live police network.": "এই অনুশীলনের রাস্তার ক্যামেরা। এটি সরাসরি পুলিশ নেটওয়ার্ক নয়।",
  "Messages sent to this account.": "এই অ্যাকাউন্টে আসা বার্তা।",
  "Download a table of buses, trips, or alerts.": "বাস, ট্রিপ বা সতর্কতার তালিকা ডাউনলোড করুন।",
  "Charts of trips and problems. The numbers come from this practice system.": "ট্রিপ ও সমস্যার চার্ট। সংখ্যাগুলো এই অনুশীলন থেকে।",
  "Choices that apply to the whole practice system.": "পুরো অনুশীলনের জন্য প্রযোজ্য নির্বাচন।",
  "A history of who changed a record, and when.": "কে কখন কোন তথ্য বদলেছে, তার ইতিহাস।",
  "A country-wide summary. Use the menu to open buses, the map, or emergencies.": "সারা দেশের সারাংশ। বাস, মানচিত্র বা জরুরি অবস্থা খুলতে মেনু ব্যবহার করুন।",
  "Where buses are right now. Select a bus to see its route and last update.": "বাসগুলো এখন কোথায়। রুট ও শেষ হালনাগাদ দেখতে একটি বাস বেছে নিন।",
  "Every registered bus. Search by registration number if you know it.": "নিবন্ধিত সব বাস। নম্বর জানলে দিয়ে খুঁজুন।",
  "Every registered driver and whether their license is in date.": "নিবন্ধিত সব চালক, এবং লাইসেন্স মেয়াদের মধ্যে আছে কি না।",
  "Routes buses are permitted to use.": "বাস যে রুটে চলতে পারে।",
  "Warnings that may need a decision, such as a bus leaving its route.": "যে সতর্কতায় সিদ্ধান্ত লাগতে পারে, যেমন বাস রুট ছাড়া।",
  "Emergency calls from passengers and drivers.": "যাত্রী ও চালকের জরুরি কল।",
  "Complaints from the public.": "জনগণের অভিযোগ।",
  "Street cameras in this practice system.": "এই অনুশীলনের রাস্তার ক্যামেরা।",
  "Download a summary you can share.": "শেয়ার করার মতো একটি সারাংশ ডাউনলোড করুন।",
  "Charts of trips and problems in this practice system.": "এই অনুশীলনের ট্রিপ ও সমস্যার চার্ট।",
  "Emergencies and buses that need attention. Open Vehicle lookup if you have a registration number.":
    "যে জরুরি অবস্থা ও বাসে নজর দরকার। নম্বর থাকলে যানবাহন খোঁজ খুলুন।",
  "Type a registration number to see the bus, the driver, and the last known place.":
    "বাস, চালক ও শেষ জানা জায়গা দেখতে নিবন্ধন নম্বর লিখুন।",
  "Buses on the map. A bus marked in red needs a closer look.": "মানচিত্রে বাস। লাল দাগের বাসটি ভালো করে দেখুন।",
  "Emergency alerts waiting for someone to respond.": "যে জরুরি বার্তার উত্তর এখনো বাকি।",
  "Warnings such as a bus leaving its route.": "সতর্কতা, যেমন একটি বাস রুট ছেড়ে যাওয়া।",
  "Complaints that mention safety or an emergency.": "নিরাপত্তা বা জরুরি অবস্থার অভিযোগ।",
  "Messages for this control room.": "এই নিয়ন্ত্রণ কক্ষের বার্তা।",
  "Incidents that have been recorded.": "যে ঘটনা লিপিবদ্ধ হয়েছে।",
  "Download a summary of what happened.": "কী ঘটেছে, তার সারাংশ ডাউনলোড করুন।",
  "Licenses, fitness certificates, and vehicles that need a check.": "লাইসেন্স, ফিটনেস ও যে যান যাচাই দরকার।",
  "Vehicle records, and whether each one is allowed to run.": "যানের তথ্য, এবং কোনটি চলতে পারে।",
  "Driver records and whether each license is valid.": "চালকের তথ্য, এবং লাইসেন্স বৈধ কি না।",
  "Routes that have been approved.": "অনুমোদিত রুট।",
  "Check whether a driving license is still valid.": "চালকের লাইসেন্স এখনো বৈধ কি না দেখুন।",
  "Check whether a vehicle fitness certificate is still valid.": "যানের ফিটনেস সনদ এখনো বৈধ কি না দেখুন।",
  "Rule breaks that have been recorded.": "যে নিয়মভঙ্গ লিপিবদ্ধ হয়েছে।",
  "Complaints about fitness, licensing, or a vehicle.": "ফিটনেস, লাইসেন্স বা যান নিয়ে অভিযোগ।",
  "A summary of your buses, drivers, and open complaints.": "আপনার বাস, চালক ও খোলা অভিযোগের সারাংশ।",
  "Buses registered to your company.": "আপনার কোম্পানির নিবন্ধিত বাস।",
  "Drivers who work for your company.": "আপনার কোম্পানির চালক।",
  "Routes your buses are allowed to run.": "আপনার বাস যে রুটে চলতে পারে।",
  "Trips your buses have made.": "আপনার বাসের করা ট্রিপ।",
  "Complaints passengers filed about your buses.": "যাত্রীরা আপনার বাস নিয়ে যে অভিযোগ করেছেন।",
  "Messages for your company.": "আপনার কোম্পানির বার্তা।",
  "Simple counts of trips and problems for your company.": "আপনার কোম্পানির ট্রিপ ও সমস্যার সহজ হিসাব।",
  "Your bus, today's trip, and anything that needs your attention.": "আপনার বাস, আজকের ট্রিপ, এবং যা আপনার নজর চায়।",
  "The bus assigned to you, and whether its location is being shared.": "আপনার জন্য নির্ধারিত বাস, এবং তার অবস্থান যাচ্ছে কি না।",
  "The stops you are expected to follow.": "আপনি যে স্টপগুলো অনুসরণ করবেন।",
  "Start the trip when you leave, and end it when you arrive.": "রওনা হলে ট্রিপ শুরু করুন, পৌঁছালে শেষ করুন।",
  "Shows whether this device is sharing the bus location.": "এই যন্ত্র বাসের অবস্থান পাঠাচ্ছে কি না।",
  "Send this only if you or the passengers are in danger. For a real emergency, also call 999.":
    "আপনি বা যাত্রীরা বিপদে থাকলেই এটি পাঠান। আসল জরুরি অবস্থায় ৯৯৯-এও কল করুন।",
  "Alerts sent to you.": "আপনার কাছে আসা সতর্কতা।",
  "Trips you have already finished.": "আপনি যে ট্রিপ শেষ করেছেন।",
  "See buses near you. To ride one, scan the code on the bus.": "কাছের বাস দেখুন। উঠতে বাসের কোড স্ক্যান করুন।",
  "Point the camera at the code on the bus, or type the code if you can see it.": "ক্যামেরা বাসের কোডের দিকে ধরুন, অথবা কোড দেখতে পেলে লিখুন।",
  "Buses that are sharing a location right now.": "যে বাসগুলো এখন অবস্থান পাঠাচ্ছে।",
  "Search for where you are going, then open a route to see its stops.": "কোথায় যাবেন খুঁজুন, তারপর স্টপ দেখতে রুট খুলুন।",
  "Look up a bus by its registration number.": "নিবন্ধন নম্বর দিয়ে একটি বাস খুঁজুন।",
  "Trips from buses you have boarded.": "আপনি যে বাসে উঠেছেন, সেই ট্রিপ।",
  "Tell us what went wrong. Replies appear here too.": "কী সমস্যা হয়েছে জানান। উত্তরও এখানে আসবে।",
  "Report something you lost on a bus, or read reports from other passengers.": "বাসে হারানো জিনিস জানান, অথবা অন্য যাত্রীর প্রতিবেদন পড়ুন।",
  "Use this only if you are in danger. For a real emergency, also call 999.":
    "বিপদে থাকলেই এটি ব্যবহার করুন। আসল জরুরি অবস্থায় ৯৯৯-এও কল করুন।",
  "Messages about your trips, complaints, and alerts.": "আপনার ট্রিপ, অভিযোগ ও সতর্কতার বার্তা।",
  "Your name and phone number. Update them if they change.": "আপনার নাম ও ফোন নম্বর। বদলালে হালনাগাদ করুন।",
  "Record what is wrong with a bus and who is handling it.": "বাসের কী সমস্যা এবং কে সেটা দেখছেন, তা লিখুন।",
  "The stops on this route, and buses that are assigned to it.": "এই রুটের স্টপ, এবং যে বাস এতে আছে।",
  "This bus, its driver, and the route it should be on.": "এই বাস, তার চালক, এবং যে রুটে থাকা উচিত।",
  "You are on this bus. You can report a problem from this page.": "আপনি এই বাসে আছেন। এই পাতা থেকে সমস্যা জানাতে পারেন।",
  "Use the menu to open the part you need. The title of each page says what you can do there.":
    "দরকারি অংশ খুলতে মেনু ব্যবহার করুন। প্রতিটি পাতার শিরোনাম বলে সেখানে কী করা যায়।",
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
