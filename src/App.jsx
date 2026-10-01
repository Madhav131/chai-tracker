import React, { useState, useEffect, useMemo } from "react";
import {
  Coffee,
  Sun,
  Sunset,
  Calendar,
  DollarSign,
  Printer,
  Share2,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  BookOpen,
  Table as TableIcon,
  Sparkles,
  CheckCircle2,
  FileText,
  Clock,
  Settings,
  HelpCircle,
  Copy,
  Check,
  Languages,
  Cloud,
  CloudOff
} from "lucide-react";
import { db, isFirebaseConfigured } from "./firebase";
import { doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";

// Month names in English & Gujarati
const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTHS_GU = [
  "જાન્યુઆરી", "ફેબ્રુઆરી", "માર્ચ", "એપ્રિલ", "મે", "જૂન",
  "જુલાઇ", "ઓગસ્ટ", "સપ્ટેમ્બર", "ઓક્ટોબર", "નવેમ્બર", "ડિસેમ્બર"
];

const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_GU = ["રવિ", "સોમ", "મંગળ", "બુધ", "ગુરુ", "શુક્ર", "શનિ"];

export default function App() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-11
  const [activeView, setActiveView] = useState("notebook"); // "notebook" | "table"
  const [lang, setLang] = useState("en"); // "en" | "gu"

  const [ratePerCup, setRatePerCup] = useState(() => {
    const saved = localStorage.getItem("chai_tracker_rate");
    return saved ? Number(saved) : 10;
  });

  const [officeName, setOfficeName] = useState(() => {
    return localStorage.getItem("chai_tracker_office") || "Office Tea Log";
  });

  const [vendorName, setVendorName] = useState(() => {
    return localStorage.getItem("chai_tracker_vendor") || "Tea Vendor (Chai Stall)";
  });

  // Storage key for the selected month
  const storageKey = `chai_data_${currentYear}_${currentMonth}`;

  const [monthData, setMonthData] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  // Sync settings with Firestore
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    const settingsRef = doc(db, "chai_tracker", "app_settings");
    const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.ratePerCup !== undefined) {
          setRatePerCup(data.ratePerCup);
          localStorage.setItem("chai_tracker_rate", data.ratePerCup);
        }
        if (data.officeName !== undefined) {
          setOfficeName(data.officeName);
          localStorage.setItem("chai_tracker_office", data.officeName);
        }
        if (data.vendorName !== undefined) {
          setVendorName(data.vendorName);
          localStorage.setItem("chai_tracker_vendor", data.vendorName);
        }
      }
    }, (err) => {
      console.error("Firestore settings sync error:", err);
    });

    return () => unsubscribe();
  }, []);

  // Load / Real-time sync data when year/month changes
  useEffect(() => {
    // 1. Initial load from localStorage
    try {
      const saved = localStorage.getItem(storageKey);
      setMonthData(saved ? JSON.parse(saved) : {});
    } catch (e) {
      setMonthData({});
    }

    // 2. Real-time sync from Firestore if enabled
    if (isFirebaseConfigured && db) {
      setIsCloudSyncing(true);
      const monthDocRef = doc(db, "chai_records", `${currentYear}_${currentMonth}`);
      const unsubscribe = onSnapshot(monthDocRef, (docSnap) => {
        setIsCloudSyncing(false);
        if (docSnap.exists()) {
          const cloudData = docSnap.data()?.days || {};
          setMonthData(cloudData);
          localStorage.setItem(storageKey, JSON.stringify(cloudData));
        }
      }, (err) => {
        setIsCloudSyncing(false);
        console.error("Firestore month sync error:", err);
      });

      return () => unsubscribe();
    }
  }, [storageKey, currentYear, currentMonth]);

  // Save data to localStorage and Firestore
  const updateDay = async (day, field, value) => {
    const numVal = Math.max(0, parseInt(value, 10) || 0);
    const updated = {
      ...monthData,
      [day]: {
        ...monthData[day],
        [field]: numVal,
      },
    };

    setMonthData(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));

    if (isFirebaseConfigured && db) {
      try {
        const monthDocRef = doc(db, "chai_records", `${currentYear}_${currentMonth}`);
        await setDoc(monthDocRef, { days: updated, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (err) {
        console.error("Firestore save error:", err);
      }
    }
  };

  const incrementDay = (day, field, delta = 1) => {
    const current = monthData[day]?.[field] || 0;
    const nextVal = Math.max(0, current + delta);
    updateDay(day, field, nextVal);
  };

  // Total days in current month
  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  }, [currentYear, currentMonth]);

  // Calculations
  const totals = useMemo(() => {
    let morningTotal = 0;
    let afternoonTotal = 0;
    let activeDaysCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const d = monthData[day] || { morning: 0, afternoon: 0 };
      const m = Number(d.morning) || 0;
      const a = Number(d.afternoon) || 0;

      morningTotal += m;
      afternoonTotal += a;

      if (m > 0 || a > 0) {
        activeDaysCount++;
      }
    }

    const grandTotalCups = morningTotal + afternoonTotal;
    const grandTotalAmount = grandTotalCups * ratePerCup;
    const avgCupsPerDay = activeDaysCount > 0 ? (grandTotalCups / activeDaysCount).toFixed(1) : 0;

    return {
      morningTotal,
      afternoonTotal,
      grandTotalCups,
      grandTotalAmount,
      activeDaysCount,
      avgCupsPerDay,
    };
  }, [monthData, daysInMonth, ratePerCup]);

  // Today helpers
  const isCurrentMonthThisMonth =
    today.getFullYear() === currentYear && today.getMonth() === currentMonth;
  const currentTodayDate = today.getDate();

  // Navigation
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const goToThisMonth = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  // Quick fill helper
  const fillDefaultWeekday = async (morningCups = 2, afternoonCups = 2) => {
    const confirmMsg = lang === "en" 
      ? "Set default 2 morning & 2 afternoon cups for all weekdays (Mon-Sat) this month?" 
      : "શું તમે આખા મહિનાના કામકાજના દિવસોમાં ડિફોલ્ટ ૨ સવાર + ૨ બપોર ચા સેટ કરવા માંગો છો?";
    if (!window.confirm(confirmMsg)) return;

    const updated = { ...monthData };
    for (let d = 1; d <= daysInMonth; d++) {
      const dayOfWeek = new Date(currentYear, currentMonth, d).getDay();
      if (dayOfWeek !== 0) { // Skip Sunday
        updated[d] = {
          morning: morningCups,
          afternoon: afternoonCups,
        };
      }
    }
    setMonthData(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));

    if (isFirebaseConfigured && db) {
      try {
        const monthDocRef = doc(db, "chai_records", `${currentYear}_${currentMonth}`);
        await setDoc(monthDocRef, { days: updated, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (err) {
        console.error("Firestore fill weekday error:", err);
      }
    }
  };

  const clearMonthData = async () => {
    const confirmMsg = lang === "en"
      ? "Are you sure you want to clear all tea entries for this month?"
      : "ચેતવણી: શું તમે આ મહિનાનો બધો ચા હિસાબ કાઢી નાખવા માંગો છો?";
    if (window.confirm(confirmMsg)) {
      setMonthData({});
      localStorage.removeItem(storageKey);

      if (isFirebaseConfigured && db) {
        try {
          const monthDocRef = doc(db, "chai_records", `${currentYear}_${currentMonth}`);
          await deleteDoc(monthDocRef);
        } catch (err) {
          console.error("Firestore delete error:", err);
        }
      }
    }
  };

  const updateSettingValue = async (key, val) => {
    if (key === "rate") {
      setRatePerCup(val);
      localStorage.setItem("chai_tracker_rate", val);
      if (isFirebaseConfigured && db) {
        setDoc(doc(db, "chai_tracker", "app_settings"), { ratePerCup: val }, { merge: true }).catch(console.error);
      }
    } else if (key === "office") {
      setOfficeName(val);
      localStorage.setItem("chai_tracker_office", val);
      if (isFirebaseConfigured && db) {
        setDoc(doc(db, "chai_tracker", "app_settings"), { officeName: val }, { merge: true }).catch(console.error);
      }
    } else if (key === "vendor") {
      setVendorName(val);
      localStorage.setItem("chai_tracker_vendor", val);
      if (isFirebaseConfigured && db) {
        setDoc(doc(db, "chai_tracker", "app_settings"), { vendorName: val }, { merge: true }).catch(console.error);
      }
    }
  };

  // Export to CSV
  const exportCSV = () => {
    const monthName = MONTHS_EN[currentMonth];
    let csv = "Date,Day,Morning (Savar),Afternoon (Bopar),Total Cups,Amount (INR)\\n";
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(currentYear, currentMonth, d);
      const dayName = WEEKDAYS_EN[dt.getDay()];
      const m = monthData[d]?.morning || 0;
      const a = monthData[d]?.afternoon || 0;
      const total = m + a;
      const amt = total * ratePerCup;
      csv += `${d}/${currentMonth + 1}/${currentYear},${dayName},${m},${a},${total},${amt}\\n`;
    }
    csv += `\\nTotal Morning,${totals.morningTotal}\\nTotal Afternoon,${totals.afternoonTotal}\\nGrand Total Cups,${totals.grandTotalCups}\\nRate per Cup,INR ${ratePerCup}\\nTotal Bill Amount,INR ${totals.grandTotalAmount}\\n`;

    const blob = new Blob(["\\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Chai_Tracker_${monthName}_${currentYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy WhatsApp Summary
  const copyWhatsAppReport = () => {
    const monthName = lang === "en" ? MONTHS_EN[currentMonth] : MONTHS_GU[currentMonth];
    const text = lang === "en" 
      ? `☕ *Monthly Tea Bill & Tally (Chai Log)* ☕\\n🏢 *Office / Team:* ${officeName}\\n🏪 *Vendor:* ${vendorName}\\n📅 *Month:* ${monthName} ${currentYear}\\n---------------------------------\\n🌅 Morning Tea (Savar): *${totals.morningTotal} Cups*\\n☀️ Afternoon Tea (Bopar): *${totals.afternoonTotal} Cups*\\n---------------------------------\\n🍵 *Total Cups:* *${totals.grandTotalCups} Cups*\\n💰 *Rate per Cup:* *₹${ratePerCup}*\\n💵 *Total Payable Amount:* *₹${totals.grandTotalAmount.toLocaleString("en-IN")}*\\n---------------------------------\\n(Days 1 to ${daysInMonth} Summary)\\nGenerated via Chai Tracker App`
      : `☕ *ચા નો માસિક હિસાબ (Tea Diary)* ☕\\n🏢 *ઓફિસ:* ${officeName}\\n🏪 *ચા વાળા:* ${vendorName}\\n📅 *મહિનો:* ${monthName} ${currentYear}\\n---------------------------------\\n🌅 સવારની કુલ ચા: *${totals.morningTotal} કપ*\\n☀️ બપોરની કુલ ચા: *${totals.afternoonTotal} કપ*\\n---------------------------------\\n🍵 *કુલ કપ:* *${totals.grandTotalCups}*\\n💰 *ચા નો ભાવ:* *₹${ratePerCup} / કપ*\\n💵 *કુલ ચૂકવવાપાત્ર રકમ:* *₹${totals.grandTotalAmount.toLocaleString("en-IN")}*\\n---------------------------------\\n(તારીખ 1 થી ${daysInMonth} સુધીનો હિસાબ)\\nજનરેટ કરેલ: Chai Tracker App`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 pb-16 font-sans">
      {/* Top Header Navigation */}
      <header className="bg-gradient-to-r from-amber-800 via-amber-900 to-stone-900 text-white shadow-xl sticky top-0 z-30 no-print border-b border-amber-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-600/50 rounded-2xl shadow-inner border border-amber-400/30 flex items-center justify-center">
              <Coffee className="w-7 h-7 text-amber-200" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                <span>{lang === "en" ? "Daily Tea Tracker" : "ચા હિસાબ ડાયરી"}</span>
                <span className="text-[10px] uppercase px-2 py-0.5 bg-amber-500 text-stone-950 font-black rounded-full shadow-sm">
                  Chai Counter
                </span>
              </h1>
              <p className="text-xs text-amber-200/80 font-medium">
                {officeName} • {vendorName}
              </p>
            </div>
          </div>

          {/* Quick Actions & Settings */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Cloud Sync Status Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border ${
                isFirebaseConfigured
                  ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/60"
                  : "bg-amber-950/80 text-amber-300 border-amber-700/60"
              }`}
              title={
                isFirebaseConfigured
                  ? "Firebase Firestore Connected (Real-time Cloud Sync)"
                  : "Local Mode (Saved in this browser only). Configure Firebase in .env to sync across all office devices."
              }
            >
              {isFirebaseConfigured ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isCloudSyncing ? "Syncing..." : (lang === "en" ? "Cloud Sync" : "ક્લાઉડ સિન્ક")}</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>{lang === "en" ? "Local Mode" : "લોકલ મોડ"}</span>
                </>
              )}
            </div>

            {/* Language Switcher */}
            <button
              onClick={() => setLang(lang === "en" ? "gu" : "en")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/90 hover:bg-stone-900 text-amber-200 text-xs font-bold rounded-xl border border-amber-700/60 transition-all shadow-sm"
              title="Switch Language"
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "ગુજરાતી" : "English"}</span>
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/80 hover:bg-amber-950 text-amber-200 text-xs font-semibold rounded-xl border border-amber-700/60 transition-all shadow-sm"
              title="Change Rate & Settings"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Rate: ₹{ratePerCup}</span>
            </button>

            <button
              onClick={copyWhatsAppReport}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95"
              title="Copy WhatsApp Summary"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? (lang === "en" ? "Copied!" : "કોપી થઈ ગયું!") : "WhatsApp Bill"}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-amber-50 text-xs font-semibold rounded-xl border border-amber-500/50 transition-all shadow-sm"
              title="Print Monthly Bill"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl border border-stone-600 transition-all"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Month Selector Strip */}
        <div className="bg-stone-950/90 border-t border-amber-900/50 px-4 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg bg-amber-900/80 hover:bg-amber-800 text-amber-200 border border-amber-700/60 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 px-3.5 py-1 bg-amber-900/90 rounded-xl border border-amber-700 font-bold text-amber-100 text-sm shadow-inner">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>{lang === "en" ? MONTHS_EN[currentMonth] : MONTHS_GU[currentMonth]}</span>
                <span className="text-amber-300 font-black">{currentYear}</span>
              </div>

              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg bg-amber-900/80 hover:bg-amber-800 text-amber-200 border border-amber-700/60 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {!isCurrentMonthThisMonth && (
                <button
                  onClick={goToThisMonth}
                  className="text-xs text-amber-300 underline font-medium hover:text-amber-100 ml-2"
                >
                  {lang === "en" ? "Go to Current Month" : "આ મહિનો"}
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-stone-900 p-1 rounded-xl border border-stone-800">
              <button
                onClick={() => setActiveView("notebook")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeView === "notebook"
                    ? "bg-amber-500 text-stone-950 shadow-md"
                    : "text-stone-300 hover:text-white"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{lang === "en" ? "Diary Ledger (1-31)" : "ચોપડો (1-31)"}</span>
              </button>
              <button
                onClick={() => setActiveView("table")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeView === "table"
                    ? "bg-amber-500 text-stone-950 shadow-md"
                    : "text-stone-300 hover:text-white"
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>{lang === "en" ? "Full Table List" : "સંપૂર્ણ ટેબલ"}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Settings Modal */}
      {showSettings && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 my-4 no-print">
          <div className="bg-amber-50 border-2 border-amber-300 p-5 rounded-2xl shadow-lg">
            <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-700" />
              <span>{lang === "en" ? "Settings & Defaults" : "સેટિંગ્સ અને ડિફોલ્ટ વિકલ્પો"}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === "en" ? "Tea Rate per Cup (₹)" : "ચા નો ભાવ પ્રતિ કપ (₹)"}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500 font-bold">₹</span>
                  <input
                    type="number"
                    min="1"
                    value={ratePerCup}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 1;
                      updateSettingValue("rate", val);
                    }}
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === "en" ? "Office / Team Name" : "ઓફિસનું નામ"}
                </label>
                <input
                  type="text"
                  value={officeName}
                  onChange={(e) => updateSettingValue("office", e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === "en" ? "Tea Vendor / Stall Name" : "ચા વાળા ભાઈનું નામ"}
                </label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => updateSettingValue("vendor", e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>

            {/* Cloud Database Status Info */}
            <div className="mt-3 p-3 bg-amber-100/70 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-900">
              <div className="flex items-center gap-2">
                {isFirebaseConfigured ? (
                  <Cloud className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <CloudOff className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span>
                  {isFirebaseConfigured
                    ? (lang === "en"
                        ? "🟢 Firebase Firestore Connected: All changes are synced in real-time across all office devices."
                        : "🟢 Firebase Firestore કનેક્ટેડ: તમામ ફેરફારો ઓફિસના દરેક ડિવાઇસ પર રીયલ-ટાઇમ અપડેટ થાય છે.")
                    : (lang === "en"
                        ? "🟡 Local Storage Mode: To sync between multiple PCs/phones, add your Firebase keys in .env file."
                        : "🟡 લોકલ સ્ટોરેજ મોડ: બીજા PC કે મોબાઈલ સાથે સિન્ક કરવા માટે .env ફાઈલમાં Firebase કી ઉમેરો.")}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-amber-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => fillDefaultWeekday(2, 2)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-sm"
                >
                  {lang === "en" ? "⚡ Auto-Fill Mon-Sat (2 Morning + 2 Afternoon)" : "⚡ ઓટો ફીલ: સોમ-શનિ ૨ સવાર + ૨ બપોર"}
                </button>
                <button
                  onClick={clearMonthData}
                  className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-semibold rounded-xl border border-rose-300"
                >
                  {lang === "en" ? "🗑️ Reset Month Data" : "🗑️ આ મહિનો સાફ કરો"}
                </button>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl"
              >
                {lang === "en" ? "Save & Close" : "સાચવો"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-5">
        {/* Printable Header */}
        <div className="hidden print-only mb-6 border-b-2 border-slate-800 pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black text-slate-900">Monthly Tea Bill & Tally Ledger</h1>
              <p className="text-sm font-bold text-slate-600">Office: {officeName} | Vendor: {vendorName}</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-slate-900">{MONTHS_EN[currentMonth]} {currentYear}</div>
              <div className="text-xs text-slate-600">Rate per Cup: ₹{ratePerCup}</div>
            </div>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {/* Morning Total Card */}
          <div className="bg-white border border-orange-200 p-4 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-orange-700 flex items-center gap-1">
                <Sun className="w-3.5 h-3.5 text-orange-600" />
                <span>{lang === "en" ? "Morning Tea" : "સવારની કુલ ચા"}</span>
              </span>
              <div className="text-2xl sm:text-3xl font-black text-orange-950 mt-1">
                {totals.morningTotal} <span className="text-sm font-semibold text-orange-700">{lang === "en" ? "Cups" : "કપ"}</span>
              </div>
              <span className="text-[11px] text-orange-600/90 font-medium">Savar Total</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xl border border-orange-200">
              🌅
            </div>
          </div>

          {/* Afternoon Total Card */}
          <div className="bg-white border border-sky-200 p-4 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-sky-700 flex items-center gap-1">
                <Sunset className="w-3.5 h-3.5 text-sky-600" />
                <span>{lang === "en" ? "Afternoon Tea" : "બપોરની કુલ ચા"}</span>
              </span>
              <div className="text-2xl sm:text-3xl font-black text-sky-950 mt-1">
                {totals.afternoonTotal} <span className="text-sm font-semibold text-sky-700">{lang === "en" ? "Cups" : "કપ"}</span>
              </div>
              <span className="text-[11px] text-sky-600/90 font-medium">Bopar Total</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-sky-100 flex items-center justify-center text-sky-700 font-bold text-xl border border-sky-200">
              ☀️
            </div>
          </div>

          {/* Grand Total Cups */}
          <div className="bg-white border border-amber-300 p-4 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                <Coffee className="w-3.5 h-3.5 text-amber-700" />
                <span>{lang === "en" ? "Total Month Cups" : "મહિનાના કુલ કપ"}</span>
              </span>
              <div className="text-2xl sm:text-3xl font-black text-amber-950 mt-1">
                {totals.grandTotalCups} <span className="text-sm font-semibold text-amber-700">{lang === "en" ? "Cups" : "કપ"}</span>
              </div>
              <span className="text-[11px] text-amber-700 font-medium">
                {totals.activeDaysCount} active days • avg {totals.avgCupsPerDay}/day
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 font-bold text-xl border border-amber-300">
              ☕
            </div>
          </div>

          {/* Total Bill Amount */}
          <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 text-white p-4 rounded-2xl shadow-md flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-200 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-300" />
                <span>{lang === "en" ? "Total Bill Amount" : "કુલ ચૂકવવાપાત્ર રકમ"}</span>
              </span>
              <div className="text-2xl sm:text-3xl font-black text-white mt-1">
                ₹{totals.grandTotalAmount.toLocaleString("en-IN")}
              </div>
              <span className="text-[11px] text-emerald-200 font-medium">
                {totals.grandTotalCups} Cups × ₹{ratePerCup} Rate
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/40 flex items-center justify-center text-emerald-100 font-black text-2xl border border-emerald-400/40">
              ₹
            </div>
          </div>
        </div>

        {/* Quick Today Logger Card */}
        {isCurrentMonthThisMonth && (
          <div className="mb-6 bg-white border border-amber-300 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4 no-print">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500 text-stone-950 font-black text-xl flex items-center justify-center shadow-md">
                {currentTodayDate}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <span>
                    {lang === "en"
                      ? `Today's Entry (Day ${currentTodayDate}, ${MONTHS_EN[currentMonth]})`
                      : `આજની ચા એન્ટ્રી (તારીખ ${currentTodayDate} ${MONTHS_GU[currentMonth]})`}
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-full">
                    TODAY
                  </span>
                </h4>
                <p className="text-xs text-slate-500">
                  {lang === "en"
                    ? "Quickly log today's morning & afternoon tea count:"
                    : "આજના દિવસ માટે સરળતાથી સવાર અને બપોરના કપ ઉમેરો:"}
                </p>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-3">
              {/* Morning Quick Stepper */}
              <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl">
                <span className="text-xs font-bold text-orange-800">
                  {lang === "en" ? "🌅 Morning (Savar):" : "🌅 સવાર:"}
                </span>
                <button
                  onClick={() => incrementDay(currentTodayDate, "morning", -1)}
                  className="w-7 h-7 bg-white hover:bg-orange-100 border border-orange-300 rounded-lg text-orange-800 font-bold flex items-center justify-center text-sm active:scale-95"
                >
                  -
                </button>
                <span className="w-8 text-center font-black text-orange-900 text-base">
                  {monthData[currentTodayDate]?.morning || 0}
                </span>
                <button
                  onClick={() => incrementDay(currentTodayDate, "morning", 1)}
                  className="w-7 h-7 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold flex items-center justify-center text-sm shadow-sm active:scale-95"
                >
                  +
                </button>
              </div>

              {/* Afternoon Quick Stepper */}
              <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-xl">
                <span className="text-xs font-bold text-sky-800">
                  {lang === "en" ? "☀️ Afternoon (Bopar):" : "☀️ બપોર:"}
                </span>
                <button
                  onClick={() => incrementDay(currentTodayDate, "afternoon", -1)}
                  className="w-7 h-7 bg-white hover:bg-sky-100 border border-sky-300 rounded-lg text-sky-800 font-bold flex items-center justify-center text-sm active:scale-95"
                >
                  -
                </button>
                <span className="w-8 text-center font-black text-sky-900 text-base">
                  {monthData[currentTodayDate]?.afternoon || 0}
                </span>
                <button
                  onClick={() => incrementDay(currentTodayDate, "afternoon", 1)}
                  className="w-7 h-7 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold flex items-center justify-center text-sm shadow-sm active:scale-95"
                >
                  +
                </button>
              </div>

              <div className="px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 border border-slate-200">
                {lang === "en" ? "Today Total: " : "આજનો સરવાળો: "}
                <span className="text-slate-900 font-extrabold text-sm">
                  {(monthData[currentTodayDate]?.morning || 0) + (monthData[currentTodayDate]?.afternoon || 0)} {lang === "en" ? "Cups" : "કપ"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 1: NOTEBOOK CHOPDO VIEW (1-16 and 17-31 two-column tally sheet matching diary photo) */}
        {activeView === "notebook" && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-300 overflow-hidden">
            {/* Diary Notebook Title Banner */}
            <div className="bg-gradient-to-r from-amber-800 to-amber-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between border-b border-amber-950">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-300" />
                <h2 className="text-base font-bold tracking-wide">
                  {lang === "en" ? "Daily Tea Diary Ledger" : "દૈનિક ચા ચોપડો"} • {lang === "en" ? MONTHS_EN[currentMonth] : MONTHS_GU[currentMonth]} {currentYear}
                </h2>
              </div>
              <div className="text-xs text-amber-200 font-medium">
                {lang === "en" ? "💡 Enter numbers directly in boxes or use +/- buttons" : "💡 બોક્સમાં સીધા નંબર લખો અથવા +/- કરો"}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-300 bg-slate-50/50">
              {/* Column 1: Days 1 to 16 */}
              <div className="p-3 sm:p-5">
                <div className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2.5 flex items-center justify-between pb-1.5 border-b border-slate-300">
                  <span className="text-amber-900 font-black">
                    {lang === "en" ? "PART 1: DAYS 1 TO 16" : "ભાગ ૧: તારીખ ૧ થી ૧૬"}
                  </span>
                  <span className="text-slate-500 font-medium">
                    {lang === "en" ? "Morning / Afternoon" : "સવાર / બપોર હિસાબ"}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="bg-amber-100 text-slate-800 text-xs font-black uppercase border-b-2 border-amber-300">
                        <th className="py-2.5 px-2 text-center w-12">{lang === "en" ? "Date" : "તારીખ"}</th>
                        <th className="py-2.5 px-2 text-center w-14">{lang === "en" ? "Day" : "વાર"}</th>
                        <th className="py-2.5 px-3 text-center bg-orange-100 text-orange-950">
                          {lang === "en" ? "🌅 Morning (Savar)" : "🌅 સવાર"}
                        </th>
                        <th className="py-2.5 px-3 text-center bg-sky-100 text-sky-950">
                          {lang === "en" ? "☀️ Afternoon (Bopar)" : "☀️ બપોર"}
                        </th>
                        <th className="py-2.5 px-2 text-center w-16 bg-amber-200/80 text-amber-950">
                          {lang === "en" ? "Total" : "કુલ"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {Array.from({ length: 16 }, (_, i) => i + 1).map((day) => {
                        const dayDate = new Date(currentYear, currentMonth, day);
                        const weekdayIdx = dayDate.getDay();
                        const isSunday = weekdayIdx === 0;
                        const isToday =
                          isCurrentMonthThisMonth && currentTodayDate === day;
                        const m = monthData[day]?.morning ?? "";
                        const a = monthData[day]?.afternoon ?? "";
                        const rowTotal = (Number(m) || 0) + (Number(a) || 0);

                        return (
                          <tr
                            key={day}
                            className={`hover:bg-amber-50/50 transition-colors ${
                              isToday
                                ? "bg-amber-100/70 font-bold"
                                : isSunday
                                ? "bg-rose-50/50"
                                : ""
                            }`}
                          >
                            <td className="py-2 px-2 text-center">
                              <span
                                className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm font-black ${
                                  isToday
                                    ? "bg-amber-600 text-white shadow-sm"
                                    : "bg-slate-200 text-slate-800"
                                }`}
                              >
                                {day}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-center text-xs">
                              <span
                                className={`px-1.5 py-0.5 rounded font-bold ${
                                  isSunday
                                    ? "text-rose-600 bg-rose-100"
                                    : "text-slate-600"
                                }`}
                              >
                                {lang === "en" ? WEEKDAYS_EN[weekdayIdx] : WEEKDAYS_GU[weekdayIdx]}
                              </span>
                            </td>
                            {/* Morning Box */}
                            <td className="py-1.5 px-2 bg-orange-50/30">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => incrementDay(day, "morning", -1)}
                                  className="w-5 h-6 rounded bg-slate-200 hover:bg-orange-200 text-slate-700 text-xs font-bold no-print"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={m}
                                  onChange={(e) => updateDay(day, "morning", e.target.value)}
                                  className="w-12 text-center py-1 bg-white border border-orange-300 rounded-md font-bold text-orange-950 focus:ring-2 focus:ring-orange-400 outline-none text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => incrementDay(day, "morning", 1)}
                                  className="w-5 h-6 rounded bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold no-print"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            {/* Afternoon Box */}
                            <td className="py-1.5 px-2 bg-sky-50/30">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => incrementDay(day, "afternoon", -1)}
                                  className="w-5 h-6 rounded bg-slate-200 hover:bg-sky-200 text-slate-700 text-xs font-bold no-print"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={a}
                                  onChange={(e) => updateDay(day, "afternoon", e.target.value)}
                                  className="w-12 text-center py-1 bg-white border border-sky-300 rounded-md font-bold text-sky-950 focus:ring-2 focus:ring-sky-400 outline-none text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => incrementDay(day, "afternoon", 1)}
                                  className="w-5 h-6 rounded bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold no-print"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            {/* Row Total */}
                            <td className="py-2 px-2 text-center font-black text-slate-800 bg-amber-50/60">
                              {rowTotal > 0 ? (
                                <span className="inline-block px-2 py-0.5 bg-amber-200 text-amber-950 rounded-md text-xs font-black">
                                  {rowTotal}
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Column 2: Days 17 to End of Month (30/31) */}
              <div className="p-3 sm:p-5">
                <div className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2.5 flex items-center justify-between pb-1.5 border-b border-slate-300">
                  <span className="text-amber-900 font-black">
                    {lang === "en" ? `PART 2: DAYS 17 TO ${daysInMonth}` : `ભાગ ૨: તારીખ ૧૭ થી ${daysInMonth}`}
                  </span>
                  <span className="text-slate-500 font-medium">
                    {lang === "en" ? "Morning / Afternoon" : "સવાર / બપોર હિસાબ"}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="bg-amber-100 text-slate-800 text-xs font-black uppercase border-b-2 border-amber-300">
                        <th className="py-2.5 px-2 text-center w-12">{lang === "en" ? "Date" : "તારીખ"}</th>
                        <th className="py-2.5 px-2 text-center w-14">{lang === "en" ? "Day" : "વાર"}</th>
                        <th className="py-2.5 px-3 text-center bg-orange-100 text-orange-950">
                          {lang === "en" ? "🌅 Morning (Savar)" : "🌅 સવાર"}
                        </th>
                        <th className="py-2.5 px-3 text-center bg-sky-100 text-sky-950">
                          {lang === "en" ? "☀️ Afternoon (Bopar)" : "☀️ બપોર"}
                        </th>
                        <th className="py-2.5 px-2 text-center w-16 bg-amber-200/80 text-amber-950">
                          {lang === "en" ? "Total" : "કુલ"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {Array.from({ length: daysInMonth - 16 }, (_, i) => i + 17).map((day) => {
                        const dayDate = new Date(currentYear, currentMonth, day);
                        const weekdayIdx = dayDate.getDay();
                        const isSunday = weekdayIdx === 0;
                        const isToday =
                          isCurrentMonthThisMonth && currentTodayDate === day;
                        const m = monthData[day]?.morning ?? "";
                        const a = monthData[day]?.afternoon ?? "";
                        const rowTotal = (Number(m) || 0) + (Number(a) || 0);

                        return (
                          <tr
                            key={day}
                            className={`hover:bg-amber-50/50 transition-colors ${
                              isToday
                                ? "bg-amber-100/70 font-bold"
                                : isSunday
                                ? "bg-rose-50/50"
                                : ""
                            }`}
                          >
                            <td className="py-2 px-2 text-center">
                              <span
                                className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm font-black ${
                                  isToday
                                    ? "bg-amber-600 text-white shadow-sm"
                                    : "bg-slate-200 text-slate-800"
                                }`}
                              >
                                {day}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-center text-xs">
                              <span
                                className={`px-1.5 py-0.5 rounded font-bold ${
                                  isSunday
                                    ? "text-rose-600 bg-rose-100"
                                    : "text-slate-600"
                                }`}
                              >
                                {lang === "en" ? WEEKDAYS_EN[weekdayIdx] : WEEKDAYS_GU[weekdayIdx]}
                              </span>
                            </td>
                            {/* Morning Box */}
                            <td className="py-1.5 px-2 bg-orange-50/30">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => incrementDay(day, "morning", -1)}
                                  className="w-5 h-6 rounded bg-slate-200 hover:bg-orange-200 text-slate-700 text-xs font-bold no-print"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={m}
                                  onChange={(e) => updateDay(day, "morning", e.target.value)}
                                  className="w-12 text-center py-1 bg-white border border-orange-300 rounded-md font-bold text-orange-950 focus:ring-2 focus:ring-orange-400 outline-none text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => incrementDay(day, "morning", 1)}
                                  className="w-5 h-6 rounded bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold no-print"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            {/* Afternoon Box */}
                            <td className="py-1.5 px-2 bg-sky-50/30">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => incrementDay(day, "afternoon", -1)}
                                  className="w-5 h-6 rounded bg-slate-200 hover:bg-sky-200 text-slate-700 text-xs font-bold no-print"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={a}
                                  onChange={(e) => updateDay(day, "afternoon", e.target.value)}
                                  className="w-12 text-center py-1 bg-white border border-sky-300 rounded-md font-bold text-sky-950 focus:ring-2 focus:ring-sky-400 outline-none text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => incrementDay(day, "afternoon", 1)}
                                  className="w-5 h-6 rounded bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold no-print"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            {/* Row Total */}
                            <td className="py-2 px-2 text-center font-black text-slate-800 bg-amber-50/60">
                              {rowTotal > 0 ? (
                                <span className="inline-block px-2 py-0.5 bg-amber-200 text-amber-950 rounded-md text-xs font-black">
                                  {rowTotal}
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Bottom Total Footer Bar */}
            <div className="bg-amber-900 text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border-t-2 border-amber-700">
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div>
                  <span className="text-amber-300 text-xs block font-medium">
                    {lang === "en" ? "Morning Total:" : "સવારની કુલ ચા:"}
                  </span>
                  <span className="text-xl font-black text-white">{totals.morningTotal} {lang === "en" ? "Cups" : "કપ"}</span>
                </div>
                <div className="border-l border-amber-700/80 pl-6">
                  <span className="text-amber-300 text-xs block font-medium">
                    {lang === "en" ? "Afternoon Total:" : "બપોરની કુલ ચા:"}
                  </span>
                  <span className="text-xl font-black text-white">{totals.afternoonTotal} {lang === "en" ? "Cups" : "કપ"}</span>
                </div>
                <div className="border-l border-amber-700/80 pl-6">
                  <span className="text-amber-300 text-xs block font-medium">
                    {lang === "en" ? "Total Month Cups:" : "મહિનાના કુલ કપ:"}
                  </span>
                  <span className="text-2xl font-black text-amber-300">{totals.grandTotalCups} {lang === "en" ? "Cups" : "કપ"}</span>
                </div>
              </div>

              <div className="bg-amber-950/90 px-5 py-2.5 rounded-xl border border-amber-600/70 text-right">
                <span className="text-xs text-amber-200 uppercase font-bold block">
                  {lang === "en" ? "Total Month Bill" : "મહિનાનું કુલ બિલ"}
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                  ₹{totals.grandTotalAmount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: FULL TABLE DETAILED VIEW */}
        {activeView === "table" && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-300 overflow-hidden">
            <div className="p-4 bg-amber-900 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2">
                <TableIcon className="w-5 h-5 text-amber-300" />
                <span>
                  {lang === "en"
                    ? `Full Monthly List (1 to ${daysInMonth} ${MONTHS_EN[currentMonth]})`
                    : `સંપૂર્ણ માસિક યાદી (1 થી ${daysInMonth} ${MONTHS_GU[currentMonth]})`}
                </span>
              </h3>
              <span className="text-xs text-amber-200">
                Rate: ₹{ratePerCup} / cup
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-xs uppercase font-black border-b border-slate-300">
                    <th className="py-3 px-3 text-center">{lang === "en" ? "Date" : "તારીખ"}</th>
                    <th className="py-3 px-3 text-center">{lang === "en" ? "Day" : "વાર"}</th>
                    <th className="py-3 px-4 text-center bg-orange-100 text-orange-950">
                      {lang === "en" ? "🌅 Morning Tea (Savar)" : "🌅 સવારની ચા"}
                    </th>
                    <th className="py-3 px-4 text-center bg-sky-100 text-sky-950">
                      {lang === "en" ? "☀️ Afternoon Tea (Bopar)" : "☀️ બપોરની ચા"}
                    </th>
                    <th className="py-3 px-3 text-center bg-amber-200/80 text-amber-950">
                      {lang === "en" ? "Day Total" : "દિવસનો કુલ કપ"}
                    </th>
                    <th className="py-3 px-3 text-center bg-emerald-100 text-emerald-950">
                      {lang === "en" ? "Daily Amount (₹)" : "દૈનિક રકમ (₹)"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const dayDate = new Date(currentYear, currentMonth, day);
                    const weekdayIdx = dayDate.getDay();
                    const isSunday = weekdayIdx === 0;
                    const isToday = isCurrentMonthThisMonth && currentTodayDate === day;
                    const m = monthData[day]?.morning || 0;
                    const a = monthData[day]?.afternoon || 0;
                    const dayTotal = m + a;
                    const dayAmt = dayTotal * ratePerCup;

                    return (
                      <tr
                        key={day}
                        className={`hover:bg-amber-50/40 ${
                          isToday ? "bg-amber-100/50 font-bold" : isSunday ? "bg-rose-50/30" : ""
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black ${
                              isToday
                                ? "bg-amber-600 text-white"
                                : "bg-slate-200 text-slate-800"
                            }`}
                          >
                            {day}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`text-xs font-bold ${
                              isSunday ? "text-rose-600" : "text-slate-600"
                            }`}
                          >
                            {lang === "en" ? WEEKDAYS_EN[weekdayIdx] : WEEKDAYS_GU[weekdayIdx]}
                          </span>
                        </td>
                        {/* Morning */}
                        <td className="py-2 px-3 text-center bg-orange-50/20">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => incrementDay(day, "morning", -1)}
                              className="w-6 h-6 rounded bg-slate-200 hover:bg-orange-200 text-slate-700 text-xs font-bold"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={m || ""}
                              placeholder="0"
                              onChange={(e) => updateDay(day, "morning", e.target.value)}
                              className="w-12 text-center py-1 bg-white border border-orange-300 rounded font-bold text-orange-950 text-sm"
                            />
                            <button
                              onClick={() => incrementDay(day, "morning", 1)}
                              className="w-6 h-6 rounded bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        {/* Afternoon */}
                        <td className="py-2 px-3 text-center bg-sky-50/20">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => incrementDay(day, "afternoon", -1)}
                              className="w-6 h-6 rounded bg-slate-200 hover:bg-sky-200 text-slate-700 text-xs font-bold"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={a || ""}
                              placeholder="0"
                              onChange={(e) => updateDay(day, "afternoon", e.target.value)}
                              className="w-12 text-center py-1 bg-white border border-sky-300 rounded font-bold text-sky-950 text-sm"
                            />
                            <button
                              onClick={() => incrementDay(day, "afternoon", 1)}
                              className="w-6 h-6 rounded bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        {/* Day Total */}
                        <td className="py-2.5 px-3 text-center font-black text-amber-900 bg-amber-50/40">
                          {dayTotal > 0 ? `${dayTotal} ${lang === "en" ? "Cups" : "કપ"}` : "-"}
                        </td>
                        {/* Day Amount */}
                        <td className="py-2.5 px-3 text-center font-bold text-emerald-800 bg-emerald-50/30">
                          {dayAmt > 0 ? `₹${dayAmt}` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-black text-sm border-t-2 border-slate-700">
                    <td colSpan={2} className="py-3 px-3 text-center text-amber-300">
                      {lang === "en" ? "Total" : "કુલ સરવાળો"}
                    </td>
                    <td className="py-3 px-3 text-center text-orange-300">
                      {totals.morningTotal} {lang === "en" ? "Cups" : "કપ"}
                    </td>
                    <td className="py-3 px-3 text-center text-sky-300">
                      {totals.afternoonTotal} {lang === "en" ? "Cups" : "કપ"}
                    </td>
                    <td className="py-3 px-3 text-center text-amber-300 text-base">
                      {totals.grandTotalCups} {lang === "en" ? "Cups" : "કપ"}
                    </td>
                    <td className="py-3 px-3 text-center text-emerald-400 text-base">
                      ₹{totals.grandTotalAmount.toLocaleString("en-IN")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Printable Signature & Stamp area */}
        <div className="hidden print-only mt-12 pt-8 border-t-2 border-slate-400 grid grid-cols-2 gap-8 text-center text-sm font-bold text-slate-800">
          <div>
            <div className="h-16"></div>
            <div className="border-t border-slate-800 pt-2">Office Manager Signature / Stamp</div>
          </div>
          <div>
            <div className="h-16"></div>
            <div className="border-t border-slate-800 pt-2">Tea Vendor Signature (Chai Stall)</div>
          </div>
        </div>
      </main>
    </div>
  );
}
