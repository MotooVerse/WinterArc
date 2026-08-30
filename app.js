/**
 * Winter Arc — Premium Habit Tracker
 * Fully client-side, localStorage-backed, GitHub Pages ready.
 */

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const STORAGE_KEY = "winterarc:v4";
  const ARC_LENGTH = 90;
  const XP_PER_LEVEL = 400;
  const RANKS = [
    "Frost Initiate",
    "Ice Apprentice",
    "Cold Forge",
    "Winter Guard",
    "Frost Warden",
    "Glacier Mind",
    "Winter Legend",
  ];
  const DEFAULT_HABITS = [
    { id: "h_workout", name: "Workout", icon: "dumbbell", category: "fitness" },
    { id: "h_water", name: "Drink water", icon: "droplets", category: "health" },
    { id: "h_sleep", name: "Sleep on time", icon: "moon", category: "health" },
    { id: "h_stretch", name: "Stretch", icon: "target", category: "fitness" },
    { id: "h_read", name: "Read", icon: "book", category: "mind" },
  ];
  const CATEGORIES = [
    { id: "fitness", label: "Fitness", color: "#79D6FF" },
    { id: "health", label: "Health", color: "#6EE7C6" },
    { id: "mind", label: "Mind", color: "#F5B971" },
    { id: "productivity", label: "Productivity", color: "#5B8CFF" },
    { id: "custom", label: "Custom", color: "#9FB4C6" },
  ];
  const ICONS = [
    "dumbbell", "droplets", "moon", "target", "book", "flame", "sparkles",
    "zap", "trophy", "sunrise", "sun", "award", "check-circle", "trending-up",
  ];
  const QUOTES = [
    "Show up.",
    "One day at a time.",
    "Discipline is built, not found.",
    "Your arc. Your pace.",
    "Small reps. Long arc.",
    "Consistency compounds.",
    "The work is the reward.",
  ];
  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: "home" },
    { id: "habits", label: "Habits", icon: "check-circle" },
    { id: "calendar", label: "Calendar", icon: "clock" },
    { id: "stats", label: "Statistics", icon: "trending-up" },
    { id: "goals", label: "Goals", icon: "target" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];

  // ---------------------------------------------------------------------------
  // Utils
  // ---------------------------------------------------------------------------
  const pad = (n) => String(n).padStart(2, "0");
  const dateKey = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayKey = () => dateKey(new Date());
  const parseKey = (k) => new Date(k + "T12:00:00");
  const addDays = (d, n) => {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + n);
    return nd;
  };
  const startOfDay = (d) => {
    const nd = new Date(d);
    nd.setHours(0, 0, 0, 0);
    return nd;
  };
  const daysBetween = (a, b) =>
    Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const uid = () =>
    "id_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const formatDate = (k) => {
    const d = parseKey(k);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };
  const monthLabel = (y, m) =>
    new Date(y, m, 1).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });

  function defaultState() {
    return {
      version: 4,
      onboarded: false,
      profile: null,
      habits: [],
      days: {}, // { "YYYY-MM-DD": { completed: { habitId: true }, note: "" } }
      goals: [],
      achievements: {},
      settings: { sound: true, reducedMotion: false },
      startDate: null,
      order: [], // habit id order
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p === "object") {
          return { ...defaultState(), ...p, version: 4 };
        }
      }
    } catch (e) {
      console.warn("Failed to load state", e);
    }
    return defaultState();
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Failed to save state", e);
    }
  }

  // ---------------------------------------------------------------------------
  // Scoring & streaks
  // ---------------------------------------------------------------------------
  function dayCompletion(day, habits) {
    if (!habits.length) return { done: 0, total: 0, pct: 0 };
    const completed = day?.completed || {};
    let done = 0;
    habits.forEach((h) => {
      if (completed[h.id]) done++;
    });
    return {
      done,
      total: habits.length,
      pct: habits.length ? Math.round((done / habits.length) * 100) : 0,
    };
  }

  function computeStreak(days, habits) {
    if (!habits.length) return 0;
    let streak = 0;
    let cursor = new Date();
    const today = todayKey();
    // If today has 0%, start from yesterday
    const todayData = days[today];
    if (dayCompletion(todayData, habits).pct === 0) {
      cursor = addDays(cursor, -1);
    }
    while (true) {
      const k = dateKey(cursor);
      const c = dayCompletion(days[k], habits);
      if (c.pct > 0) {
        streak++;
        cursor = addDays(cursor, -1);
      } else break;
    }
    return streak;
  }

  function computeBestStreak(days, habits) {
    const keys = Object.keys(days)
      .filter((k) => dayCompletion(days[k], habits).pct > 0)
      .sort();
    let best = 0,
      cur = 0,
      prev = null;
    keys.forEach((k) => {
      const d = parseKey(k);
      if (prev && daysBetween(prev, d) === 1) cur++;
      else cur = 1;
      if (cur > best) best = cur;
      prev = d;
    });
    return best;
  }

  function habitStreak(days, habitId) {
    let streak = 0;
    let cursor = new Date();
    const today = todayKey();
    if (!(days[today]?.completed?.[habitId])) {
      cursor = addDays(cursor, -1);
    }
    while (true) {
      const k = dateKey(cursor);
      if (days[k]?.completed?.[habitId]) {
        streak++;
        cursor = addDays(cursor, -1);
      } else break;
    }
    return streak;
  }

  function habitBestStreak(days, habitId) {
    const keys = Object.keys(days)
      .filter((k) => days[k]?.completed?.[habitId])
      .sort();
    let best = 0,
      cur = 0,
      prev = null;
    keys.forEach((k) => {
      const d = parseKey(k);
      if (prev && daysBetween(prev, d) === 1) cur++;
      else cur = 1;
      if (cur > best) best = cur;
      prev = d;
    });
    return best;
  }

  function xpFromState(days, habits) {
    let xp = 0;
    Object.values(days).forEach((day) => {
      const completed = day.completed || {};
      habits.forEach((h) => {
        if (completed[h.id]) xp += 10;
      });
    });
    return xp;
  }

  function greetingForHour(h) {
    if (h < 5) return { text: "Still up. Rest matters too.", icon: "moon" };
    if (h < 12) return { text: "Good morning.", icon: "sunrise" };
    if (h < 17) return { text: "Good afternoon.", icon: "sun" };
    if (h < 21) return { text: "Good evening.", icon: "sunset" };
    return { text: "Winding down.", icon: "moon" };
  }

  // ---------------------------------------------------------------------------
  // Sound
  // ---------------------------------------------------------------------------
  let _audioCtx = null;
  function beep(freq = 880, dur = 0.12, delay = 0) {
    try {
      _audioCtx =
        _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (_audioCtx.state === "suspended") _audioCtx.resume();
      const t = _audioCtx.currentTime + delay;
      const o = _audioCtx.createOscillator();
      const g = _audioCtx.createGain();
      o.connect(g);
      g.connect(_audioCtx.destination);
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.04);
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // Icons (inline SVG)
  // ---------------------------------------------------------------------------
  const ICON_PATHS = {
    snowflake:
      '<g><line x1="12" y1="2" x2="12" y2="22"/><line x1="4.5" y1="7" x2="19.5" y2="17"/><line x1="19.5" y1="7" x2="4.5" y2="17"/><line x1="12" y1="2" x2="9" y2="5"/><line x1="12" y1="2" x2="15" y2="5"/><line x1="12" y1="22" x2="9" y2="19"/><line x1="12" y1="22" x2="15" y2="19"/></g>',
    flame:
      '<path d="M12 2c1 3-3 4-3 8a3 3 0 0 0 6 0c0-1-1-2-1-2 2 1 3 3 3 5a5 5 0 0 1-10 0c0-5 3-6 5-11z"/>',
    droplets:
      '<path d="M12 3c2.5 4 6 7.5 6 11a6 6 0 1 1-12 0c0-3.5 3.5-7 6-11z"/>',
    moon: '<path d="M21 12.5A8.5 8.5 0 1 1 11.5 3a7 7 0 0 0 9.5 9.5z"/>',
    dumbbell:
      '<g><rect x="2" y="9" width="3" height="6" rx="1"/><rect x="19" y="9" width="3" height="6" rx="1"/><line x1="7" y1="12" x2="17" y2="12"/><rect x="5" y="7" width="2" height="10" rx="1"/><rect x="17" y="7" width="2" height="10" rx="1"/></g>',
    target:
      '<g><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></g>',
    trophy:
      '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4zM7 5H4a3 3 0 0 0 3 4M17 5h3a3 3 0 0 1-3 4"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM19 19a2 2 0 0 1-2 2H6"/>',
    settings:
      '<g><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></g>',
    "chevron-right": '<polyline points="9 18 15 12 9 6"/>',
    "chevron-left": '<polyline points="15 18 9 12 15 6"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    x: '<g><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></g>',
    plus: '<g><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></g>',
    home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
    "trending-up":
      '<g><polyline points="3 17 9 11 13 15 21 6"/><polyline points="14 6 21 6 21 13"/></g>',
    sparkles:
      '<path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2zM19 15l.9 2.6L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.4z"/>',
    zap: '<polygon points="13 2 3 14 11 14 9 22 21 10 13 10 13 2"/>',
    award:
      '<g><circle cx="12" cy="8" r="6"/><polyline points="9 13.5 7 22 12 19 17 22 15 13.5"/></g>',
    lock: '<g><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/></g>',
    download:
      '<g><path d="M12 3v12"/><polyline points="7 10 12 15 17 10"/><path d="M4 19h16"/></g>',
    "alert-triangle":
      '<g><path d="M12 3l10 18H2L12 3z"/><line x1="12" y1="9" x2="12" y2="14"/><line x1="12" y1="17" x2="12.01" y2="17"/></g>',
    sunrise:
      '<g><line x1="12" y1="2" x2="12" y2="9"/><path d="M5.6 12a6.4 6.4 0 0 1 12.8 0"/><line x1="1" y1="18" x2="23" y2="18"/><line x1="1" y1="22" x2="23" y2="22"/><polyline points="8 6 12 2 16 6"/></g>',
    sun: '<g><circle cx="12" cy="12" r="4.5"/><line x1="12" y1="1" x2="12" y2="3.5"/><line x1="12" y1="20.5" x2="12" y2="23"/><line x1="3.5" y1="12" x2="1" y2="12"/><line x1="23" y1="12" x2="20.5" y2="12"/><line x1="5" y1="5" x2="6.7" y2="6.7"/><line x1="17.3" y1="17.3" x2="19" y2="19"/><line x1="19" y1="5" x2="17.3" y2="6.7"/><line x1="6.7" y1="17.3" x2="5" y2="19"/></g>',
    sunset:
      '<g><line x1="12" y1="10" x2="12" y2="2"/><path d="M5.6 12a6.4 6.4 0 0 1 12.8 0"/><line x1="1" y1="18" x2="23" y2="18"/><line x1="1" y1="22" x2="23" y2="22"/><polyline points="16 6 12 10 8 6"/></g>',
    trash:
      '<g><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></g>',
    "check-circle":
      '<g><circle cx="12" cy="12" r="9"/><polyline points="8 12.5 11 15.5 16 9"/></g>',
    "arrow-right":
      '<g><line x1="4" y1="12" x2="20" y2="12"/><polyline points="14 6 20 12 14 18"/></g>',
    edit: '<g><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></g>',
    clock:
      '<g><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></g>',
    grip: '<g><circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/></g>',
    upload:
      '<g><path d="M12 15V3"/><polyline points="7 8 12 3 17 8"/><path d="M4 19h16"/></g>',
  };

  function icon(name, size = 16, color = "currentColor") {
    const d = ICON_PATHS[name];
    if (!d) return "";
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${d}</svg>`;
  }

  // ---------------------------------------------------------------------------
  // App state
  // ---------------------------------------------------------------------------
  let state = loadState();
  let page = "dashboard";
  let toast = null;
  let toastTimer = null;
  let modal = null; // { type, data }
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();
  let selectedDate = todayKey();
  let dragId = null;

  function setState(partial) {
    state = { ...state, ...partial };
    saveState(state);
    render();
  }

  function showToast(msg) {
    toast = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast = null;
      renderToast();
    }, 2600);
    renderToast();
  }

  function ensureToday() {
    const t = todayKey();
    if (!state.days[t]) {
      state.days = { ...state.days, [t]: { completed: {}, note: "" } };
    }
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  function completeOnboarding(profile) {
    const habits = DEFAULT_HABITS.map((h) => ({ ...h }));
    setState({
      onboarded: true,
      profile,
      habits,
      order: habits.map((h) => h.id),
      startDate: todayKey(),
      days: { [todayKey()]: { completed: {}, note: "" } },
    });
    showToast("Your Winter Arc begins. Show up.");
  }

  function toggleHabit(habitId, date = todayKey()) {
    ensureToday();
    const day = state.days[date] || { completed: {}, note: "" };
    const completed = { ...(day.completed || {}) };
    const was = !!completed[habitId];
    if (was) delete completed[habitId];
    else completed[habitId] = true;
    const newDays = {
      ...state.days,
      [date]: { ...day, completed },
    };
    setState({ days: newDays });
    if (state.settings.sound && !was) beep(660, 0.08);
    const habits = orderedHabits();
    const c = dayCompletion(newDays[date], habits);
    if (c.pct === 100 && habits.length) {
      if (state.settings.sound) {
        beep(880, 0.12);
        beep(1175, 0.15, 0.12);
      }
      showToast("Perfect day — all habits done.");
    }
  }

  function orderedHabits() {
    const map = Object.fromEntries(state.habits.map((h) => [h.id, h]));
    const order = state.order?.length
      ? state.order
      : state.habits.map((h) => h.id);
    return order.map((id) => map[id]).filter(Boolean);
  }

  function addHabit(data) {
    const h = {
      id: uid(),
      name: data.name.trim(),
      icon: data.icon || "sparkles",
      category: data.category || "custom",
      createdAt: Date.now(),
    };
    const habits = [...state.habits, h];
    const order = [...(state.order || state.habits.map((x) => x.id)), h.id];
    setState({ habits, order });
    showToast(`"${h.name}" added.`);
  }

  function editHabit(id, data) {
    const habits = state.habits.map((h) =>
      h.id === id
        ? {
            ...h,
            name: data.name.trim(),
            icon: data.icon || h.icon,
            category: data.category || h.category,
          }
        : h
    );
    setState({ habits });
    showToast("Habit updated.");
  }

  function deleteHabit(id) {
    const habits = state.habits.filter((h) => h.id !== id);
    const order = (state.order || []).filter((x) => x !== id);
    // clean completions
    const days = { ...state.days };
    Object.keys(days).forEach((k) => {
      if (days[k].completed && days[k].completed[id]) {
        const c = { ...days[k].completed };
        delete c[id];
        days[k] = { ...days[k], completed: c };
      }
    });
    setState({ habits, order, days });
    showToast("Habit removed.");
  }

  function reorderHabits(fromId, toId) {
    if (fromId === toId) return;
    const order = [...(state.order || state.habits.map((h) => h.id))];
    const fromIdx = order.indexOf(fromId);
    const toIdx = order.indexOf(toId);
    if (fromIdx < 0 || toIdx < 0) return;
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, fromId);
    setState({ order });
  }

  function addGoal(data) {
    const g = {
      id: uid(),
      title: data.title.trim(),
      targetDate: data.targetDate || null,
      progress: 0,
      done: false,
      createdAt: Date.now(),
    };
    setState({ goals: [...state.goals, g] });
    showToast("Goal created.");
  }

  function updateGoal(id, updates) {
    const goals = state.goals.map((g) =>
      g.id === id ? { ...g, ...updates } : g
    );
    setState({ goals });
  }

  function deleteGoal(id) {
    setState({ goals: state.goals.filter((g) => g.id !== id) });
    showToast("Goal removed.");
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `winter-arc-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup downloaded.");
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || typeof data !== "object" || !data.habits) {
          showToast("Invalid backup file.");
          return;
        }
        const merged = { ...defaultState(), ...data, version: 4 };
        state = merged;
        saveState(state);
        page = "dashboard";
        showToast("Data restored successfully.");
        render();
      } catch (err) {
        showToast("Could not read file.");
      }
    };
    reader.readAsText(file);
  }

  function resetAll() {
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    page = "dashboard";
    modal = null;
    render();
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  function btn(label, opts = {}) {
    const {
      variant = "primary",
      size = "md",
      iconName,
      onClick,
      disabled,
      style = "",
      type = "button",
    } = opts;
    const cls = `wa-btn wa-btn-base wa-btn-${size} wa-btn-${variant}`;
    return `<button type="${type}" class="${cls}" ${
      disabled ? "disabled" : ""
    } style="${style}" data-action="${onClick || ""}">${
      iconName ? icon(iconName, size === "lg" ? 18 : 15) : ""
    }${label}</button>`;
  }

  function progressBar(pct, height = 8) {
    return `<div class="wa-progress" style="height:${height}px"><div style="width:${clamp(
      pct,
      0,
      100
    )}%"></div></div>`;
  }

  function arcRing(percent, size = 110, label, sub) {
    const stroke = 9;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const gap = 0.22;
    const usable = c * (1 - gap);
    const offset = usable - (usable * clamp(percent, 0, 100)) / 100;
    const rot = 90 + (360 * gap) / 2;
    const id = "g" + Math.random().toString(36).slice(2, 7);
    return `<div class="wa-arcring" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <defs>
          <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#8FE1FF"/><stop offset="100%" stop-color="#5B8CFF"/>
          </linearGradient>
        </defs>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
          stroke="rgba(255,255,255,0.07)" stroke-width="${stroke}"
          stroke-dasharray="${usable} ${c}" stroke-linecap="round"
          transform="rotate(${rot} ${size / 2} ${size / 2})"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
          stroke="url(#${id})" stroke-width="${stroke}"
          stroke-dasharray="${usable} ${c}" stroke-dashoffset="${offset}"
          stroke-linecap="round" transform="rotate(${rot} ${size / 2} ${size / 2})"/>
      </svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
        ${
          label != null
            ? `<div style="font-family:var(--font-mono);font-weight:700;font-size:${
                size * 0.17
              }px;color:#F2F8FC;line-height:1">${label}</div>`
            : ""
        }
        ${
          sub
            ? `<div style="font-size:10px;color:#7E97AC;margin-top:4px;letter-spacing:1.2px">${sub}</div>`
            : ""
        }
      </div>
    </div>`;
  }

  function pageHead(eyebrow, title, sub) {
    return `<div class="wa-pagehead">
      ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ""}
      <h2>${title}</h2>
      ${sub ? `<div class="sub">${sub}</div>` : ""}
    </div>`;
  }

  function snowField(count = 28) {
    if (state.settings.reducedMotion) return "";
    let html = '<div class="wa-snow" aria-hidden="true">';
    for (let i = 0; i < count; i++) {
      const left = Math.random() * 100;
      const size = 2 + Math.random() * 3;
      const dur = 14 + Math.random() * 18;
      const delay = -(Math.random() * 20);
      const drift = (Math.random() - 0.5) * 60;
      const op = 0.12 + Math.random() * 0.28;
      html += `<span style="left:${left}%;width:${size}px;height:${size}px;opacity:${op};animation-duration:${dur}s;animation-delay:${delay}s;--drift:${drift}px"></span>`;
    }
    return html + "</div>";
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------
  function renderLanding() {
    const greet = greetingForHour(new Date().getHours());
    return `
    <div class="wa-landing">
      ${snowField(42)}
      <div style="position:relative;z-index:1;max-width:1180px;margin:0 auto;padding:0 24px">
        <div style="display:flex;align-items:center;padding:26px 0;gap:10px">
          ${icon("snowflake", 20, "#79D6FF")}
          <span style="font-family:var(--font-display);font-weight:700;letter-spacing:3px;font-size:14px;color:#EAF4FB">WINTER ARC</span>
        </div>
        <div class="wa-hero-grid">
          <div class="wa-fadein">
            <div style="display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;border:1px solid rgba(127,216,255,0.25);background:rgba(127,216,255,0.06);font-size:12px;color:#8FD4FF;margin-bottom:26px">
              ${icon(greet.icon, 13)} ${greet.text}
            </div>
            <h1 style="font-size:clamp(40px,5.4vw,64px);line-height:1.05;letter-spacing:-1px;color:#F5FAFD;margin:0">
              ENTER YOUR<br/>
              <span style="background:linear-gradient(135deg,#8FE1FF,#5B8CFF);-webkit-background-clip:text;background-clip:text;color:transparent">WINTER ARC.</span>
            </h1>
            <p style="font-size:17px;color:#93A8BB;margin-top:20px;max-width:440px;line-height:1.6">
              Build discipline. Track habits. Become stronger — one day at a time.
            </p>
            <div style="margin-top:32px">
              ${btn("START YOUR ARC", {
                size: "lg",
                iconName: "arrow-right",
                onClick: "start-onboard",
              })}
            </div>
            <div style="display:flex;gap:28px;margin-top:44px">
              ${[
                ["90", "day arc"],
                ["∞", "habits"],
                ["100%", "local"],
              ]
                .map(
                  ([n, l]) => `
                <div>
                  <div style="font-family:var(--font-mono);font-size:22px;color:#EAF4FB;font-weight:700">${n}</div>
                  <div style="font-size:11px;color:#6E8296;letter-spacing:0.5px;text-transform:uppercase">${l}</div>
                </div>`
                )
                .join("")}
            </div>
          </div>
          <div class="wa-fadein" style="animation-delay:.12s">
            <div class="wa-glass" style="padding:24px;box-shadow:0 30px 80px -30px rgba(0,0,0,0.7)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <div style="font-size:11px;letter-spacing:1.5px;color:#6E8296">LIVE PREVIEW</div>
                <div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:#6EE7C6">
                  <span style="width:6px;height:6px;border-radius:99px;background:#6EE7C6;display:inline-block;animation:wa-blink 2s infinite"></span> Streak active
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:18px;margin-bottom:18px">
                ${arcRing(72, 96, "72", "TODAY")}
                <div>
                  <div style="font-size:13px;color:#8FA4B8;margin-bottom:8px">Day 14 of 90</div>
                  ${progressBar(15.5)}
                  <div style="font-size:11px;color:#6E8296;margin-top:6px">Ice Apprentice · Level 3</div>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                ${[
                  ["Habits", "5/7", "#6EE7C6"],
                  ["Streak", "12 days", "#FF8A8A"],
                  ["XP", "1,240", "#F5B971"],
                  ["Score", "72%", "#79D6FF"],
                ]
                  .map(
                    ([l, v, c]) => `
                  <div style="padding:10px 12px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07)">
                    <div style="font-size:10px;color:#6E8296">${l}</div>
                    <div style="font-size:13px;color:${c};font-weight:600;margin-top:2px">${v}</div>
                  </div>`
                  )
                  .join("")}
              </div>
            </div>
          </div>
        </div>
        <div class="wa-feature-grid">
          ${[
            {
              icon: "check-circle",
              title: "Daily Habits",
              desc: "Create, edit, reorder and check off habits every day.",
            },
            {
              icon: "trending-up",
              title: "Streaks & Stats",
              desc: "Current & best streaks, completion rates, trends.",
            },
            {
              icon: "clock",
              title: "Calendar History",
              desc: "See completed, partial and missed days at a glance.",
            },
            {
              icon: "target",
              title: "Personal Goals",
              desc: "Set deadlines and track progress toward bigger aims.",
            },
            {
              icon: "award",
              title: "XP & Ranks",
              desc: "Earn XP from every check. Climb the Winter ranks.",
            },
            {
              icon: "lock",
              title: "100% Local",
              desc: "No accounts. No servers. Your data stays on device.",
            },
          ]
            .map(
              (f) => `
            <div class="wa-glass" style="padding:22px">
              <div style="width:36px;height:36px;border-radius:10px;background:rgba(127,216,255,0.1);display:flex;align-items:center;justify-content:center;margin-bottom:12px">
                ${icon(f.icon, 18, "#79D6FF")}
              </div>
              <div style="font-weight:600;font-size:15px;color:#EAF4FB;margin-bottom:6px">${f.title}</div>
              <div style="font-size:13px;color:#8FA4B8;line-height:1.5">${f.desc}</div>
            </div>`
            )
            .join("")}
        </div>
      </div>
    </div>`;
  }

  function renderOnboarding() {
    // Simple 2-step: name + optional habits selection
    return `
    <div style="min-height:100vh;display:flex;flex-direction:column">
      ${snowField(18)}
      <div style="position:relative;z-index:1;flex:1;max-width:560px;margin:0 auto;padding:56px 24px 40px;width:100%">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:36px">
          ${icon("snowflake", 18, "#79D6FF")}
          <span style="font-family:var(--font-display);font-weight:700;letter-spacing:3px;font-size:13px;color:#EAF4FB">WINTER ARC</span>
        </div>
        <div id="onboard-step">
          ${pageHead("STEP 1", "What's your name?", "This is your arc. Make it personal.")}
          <input class="wa-input" id="ob-name" placeholder="Enter your name" style="font-size:17px;padding:15px 16px;max-width:360px" maxlength="40" />
          <div style="margin-top:28px">
            ${btn("BEGIN ARC", {
              size: "lg",
              iconName: "check",
              onClick: "finish-onboard",
            })}
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderSidebar() {
    const streak = computeStreak(state.days, orderedHabits());
    return `
    <nav class="wa-sidebar">
      <div style="display:flex;align-items:center;gap:10px;padding:0 8px;margin-bottom:18px">
        ${icon("snowflake", 18, "#79D6FF")}
        <span style="font-family:var(--font-display);font-weight:700;letter-spacing:3px;font-size:13px;color:#EAF4FB">WINTER ARC</span>
      </div>
      ${NAV.map(
        (n) => `
        <button class="wa-navitem ${page === n.id ? "active" : ""}" data-nav="${n.id}">
          ${icon(n.icon, 16)}${n.label}
        </button>`
      ).join("")}
      <div style="margin-top:auto;padding:14px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08)">
        <div style="font-size:12px;color:#6E8296">${
          state.profile?.name || "Athlete"
        }</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:6px">
          <span style="width:7px;height:7px;border-radius:99px;background:${
            streak > 0 ? "#6EE7C6" : "#5C7082"
          }"></span>
          <span style="font-size:12px;color:#8FA4B8">${
            streak > 0 ? streak + "-day streak" : "No active streak"
          }</span>
        </div>
      </div>
    </nav>`;
  }

  function renderMobileNav() {
    return `
    <div class="wa-mobilenav">
      ${NAV.map(
        (n) => `
        <button class="${page === n.id ? "active" : ""}" data-nav="${n.id}">
          ${icon(n.icon, 18)}${n.label}
        </button>`
      ).join("")}
    </div>`;
  }

  function renderDashboard() {
    const habits = orderedHabits();
    const today = todayKey();
    ensureToday();
    const day = state.days[today] || { completed: {} };
    const { done, total, pct } = dayCompletion(day, habits);
    const streak = computeStreak(state.days, habits);
    const best = computeBestStreak(state.days, habits);
    const xp = xpFromState(state.days, habits);
    const level = Math.floor(xp / XP_PER_LEVEL) + 1;
    const rank = RANKS[Math.min(level - 1, RANKS.length - 1)];
    const quote = QUOTES[new Date().getDate() % QUOTES.length];
    const greet = greetingForHour(new Date().getHours());
    const dayIndex = state.startDate
      ? Math.min(
          ARC_LENGTH,
          daysBetween(parseKey(state.startDate), new Date()) + 1
        )
      : 1;

    return `
    <div class="wa-main-inner wa-fadein">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:13px;color:#6E8296;margin-bottom:4px">${
            greet.text
          }</div>
          <h1 style="font-size:26px;color:#F2F8FC">${
            state.profile?.name || "Athlete"
          }</h1>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:#6E8296;letter-spacing:1.5px">LEVEL ${level}</div>
          <div style="font-size:13px;color:#79D6FF;font-weight:600">${rank}</div>
        </div>
      </div>

      <div style="font-style:italic;font-size:14px;color:#6E8296;margin-bottom:24px;padding:12px 16px;border-radius:12px;background:rgba(255,255,255,0.02);border-left:3px solid rgba(127,214,255,0.3)">
        "${quote}"
      </div>

      <div class="wa-grid-2" style="margin-bottom:18px">
        <div class="wa-glass" style="padding:22px">
          <div style="display:flex;align-items:center;gap:18px">
            ${arcRing(pct, 108, String(pct), "SCORE")}
            <div style="flex:1">
              <div style="font-size:11px;letter-spacing:1.5px;color:#6E8296;margin-bottom:6px">TODAY · ${formatDate(
                today
              )}</div>
              ${progressBar(pct, 10)}
              <div style="display:flex;gap:16px;margin-top:14px;flex-wrap:wrap">
                <div>
                  <div style="font-size:10px;color:#6E8296">Streak</div>
                  <div style="font-size:15px;font-weight:600;color:#FF8A8A">${streak}d</div>
                </div>
                <div>
                  <div style="font-size:10px;color:#6E8296">Best</div>
                  <div style="font-size:15px;font-weight:600;color:#F5B971">${best}d</div>
                </div>
                <div>
                  <div style="font-size:10px;color:#6E8296">XP</div>
                  <div style="font-size:15px;font-weight:600;color:#79D6FF">${xp}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="wa-glass" style="padding:22px">
          <div style="font-size:11px;letter-spacing:1.5px;color:#6E8296;margin-bottom:10px">WINTER ARC</div>
          <div style="font-size:22px;font-weight:700;color:#F2F8FC;margin-bottom:6px">Day ${dayIndex} of ${ARC_LENGTH}</div>
          ${progressBar((dayIndex / ARC_LENGTH) * 100, 10)}
          <div style="font-size:12px;color:#6E8296;margin-top:10px">${done}/${total} habits today</div>
        </div>
      </div>

      <div class="wa-glass" style="padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-size:11px;letter-spacing:1.5px;color:#6E8296">TODAY'S HABITS</div>
          <div style="font-size:13px;color:#79D6FF">${done}/${total}</div>
        </div>
        ${
          habits.length === 0
            ? `<div class="wa-empty">
                <p>No habits yet.</p>
                ${btn("Add your first habit", {
                  variant: "secondary",
                  onClick: "goto-habits",
                })}
              </div>`
            : `<div style="display:flex;flex-direction:column;gap:6px">
                ${habits
                  .map((h) => {
                    const isDone = !!(day.completed || {})[h.id];
                    return `
                    <button class="wa-habit-row ${
                      isDone ? "done" : ""
                    }" data-toggle-habit="${h.id}" data-date="${today}">
                      <span class="wa-habit-check">${
                        isDone ? icon("check", 14, "#04121F") : ""
                      }</span>
                      <span style="flex:1;font-size:14px;color:${
                        isDone ? "#EAF4FB" : "#8FA4B8"
                      }">${h.name}</span>
                      ${icon(h.icon || "sparkles", 15, isDone ? "#6EE7C6" : "#5C7082")}
                    </button>`;
                  })
                  .join("")}
              </div>`
        }
      </div>
    </div>`;
  }

  function renderHabits() {
    const habits = orderedHabits();
    return `
    <div class="wa-main-inner wa-fadein">
      ${pageHead(
        "HABITS",
        "Manage your habits",
        "Create, edit, reorder and track daily."
      )}
      <div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap">
        ${btn("Add habit", {
          iconName: "plus",
          onClick: "open-add-habit",
        })}
      </div>
      ${
        habits.length === 0
          ? `<div class="wa-glass wa-empty">
              <div style="margin-bottom:8px">${icon("sparkles", 32, "#5C7082")}</div>
              <p>No habits yet. Add one to start your arc.</p>
            </div>`
          : `<div class="wa-glass" style="padding:12px" id="habit-list">
              ${habits
                .map((h, idx) => {
                  const st = habitStreak(state.days, h.id);
                  const best = habitBestStreak(state.days, h.id);
                  const cat = CATEGORIES.find((c) => c.id === h.category);
                  return `
                  <div class="wa-habit-row" style="cursor:default;margin-bottom:6px" data-habit-id="${h.id}" draggable="true">
                    <span class="wa-drag" data-drag="${h.id}" title="Drag to reorder">${icon(
                      "grip",
                      16
                    )}</span>
                    <span style="width:32px;height:32px;border-radius:9px;background:rgba(127,216,255,0.1);display:flex;align-items:center;justify-content:center">
                      ${icon(h.icon || "sparkles", 15, "#79D6FF")}
                    </span>
                    <div style="flex:1;min-width:0">
                      <div style="font-size:14px;font-weight:600;color:#EAF4FB">${h.name}</div>
                      <div style="font-size:11.5px;color:#6E8296;margin-top:2px">
                        ${cat ? cat.label : "Custom"} · Streak ${st}d · Best ${best}d
                      </div>
                    </div>
                    <button class="wa-btn wa-btn-base wa-btn-sm wa-btn-ghost" data-edit-habit="${h.id}" title="Edit">${icon(
                      "edit",
                      15
                    )}</button>
                    <button class="wa-btn wa-btn-base wa-btn-sm wa-btn-ghost" data-delete-habit="${h.id}" title="Delete" style="color:#FF8A8A">${icon(
                      "trash",
                      15
                    )}</button>
                  </div>`;
                })
                .join("")}
            </div>`
      }
    </div>`;
  }

  function renderCalendar() {
    const habits = orderedHabits();
    const first = new Date(calYear, calMonth, 1);
    const startPad = first.getDay(); // 0 Sun
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const today = todayKey();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push({ empty: true });
    for (let d = 1; d <= daysInMonth; d++) {
      const k = `${calYear}-${pad(calMonth + 1)}-${pad(d)}`;
      const c = dayCompletion(state.days[k], habits);
      const isFuture = parseKey(k) > startOfDay(new Date());
      let cls = "wa-cal-day";
      if (isFuture) cls += " future";
      else if (c.pct === 100) cls += " full";
      else if (c.pct >= 70) cls += " high";
      else if (c.pct >= 40) cls += " mid";
      else if (c.pct > 0) cls += " low";
      else if (state.days[k]) cls += " missed";
      if (k === today) cls += " today";
      if (k === selectedDate) cls += " selected";
      cells.push({ k, d, cls, pct: c.pct, isFuture });
    }

    const selDay = state.days[selectedDate] || { completed: {} };
    const selComp = dayCompletion(selDay, habits);

    return `
    <div class="wa-main-inner wa-fadein">
      ${pageHead("CALENDAR", "History & review", monthLabel(calYear, calMonth))}
      <div class="wa-glass" style="padding:20px;margin-bottom:18px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <button class="wa-btn wa-btn-base wa-btn-sm wa-btn-secondary" data-action="cal-prev">${icon(
            "chevron-left",
            16
          )}</button>
          <div style="font-weight:600;font-size:15px;color:#EAF4FB">${monthLabel(
            calYear,
            calMonth
          )}</div>
          <button class="wa-btn wa-btn-base wa-btn-sm wa-btn-secondary" data-action="cal-next">${icon(
            "chevron-right",
            16
          )}</button>
        </div>
        <div class="wa-cal-grid" style="margin-bottom:8px">
          ${["S", "M", "T", "W", "T", "F", "S"]
            .map(
              (d) =>
                `<div style="text-align:center;font-size:11px;color:#6E8296;padding:4px 0">${d}</div>`
            )
            .join("")}
        </div>
        <div class="wa-cal-grid">
          ${cells
            .map((c) => {
              if (c.empty)
                return `<div class="wa-cal-day empty"></div>`;
              return `<button class="${c.cls}" data-select-date="${c.k}" ${
                c.isFuture ? "disabled" : ""
              }>
                <span>${c.d}</span>
                ${
                  !c.isFuture && c.pct > 0
                    ? `<span class="wa-cal-dot"></span>`
                    : ""
                }
              </button>`;
            })
            .join("")}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:14px;font-size:10.5px;color:#6E8296;flex-wrap:wrap">
          <span>LESS</span>
          ${["rgba(255,255,255,0.05)", "rgba(127,214,255,0.12)", "rgba(127,214,255,0.28)", "rgba(127,214,255,0.5)", "#8FE1FF"]
            .map(
              (bg) =>
                `<span style="width:12px;height:12px;border-radius:3px;background:${bg};display:inline-block"></span>`
            )
            .join("")}
          <span>MORE</span>
        </div>
      </div>

      <div class="wa-glass" style="padding:20px">
        <div style="font-size:11px;letter-spacing:1.5px;color:#6E8296;margin-bottom:10px">
          ${formatDate(selectedDate)} · ${selComp.done}/${selComp.total} (${selComp.pct}%)
        </div>
        ${
          habits.length === 0
            ? `<p style="color:#6E8296;font-size:14px">No habits configured.</p>`
            : `<div style="display:flex;flex-direction:column;gap:6px">
                ${habits
                  .map((h) => {
                    const isDone = !!(selDay.completed || {})[h.id];
                    return `
                    <button class="wa-habit-row ${
                      isDone ? "done" : ""
                    }" data-toggle-habit="${h.id}" data-date="${selectedDate}">
                      <span class="wa-habit-check">${
                        isDone ? icon("check", 14, "#04121F") : ""
                      }</span>
                      <span style="flex:1;font-size:14px;color:${
                        isDone ? "#EAF4FB" : "#8FA4B8"
                      }">${h.name}</span>
                    </button>`;
                  })
                  .join("")}
              </div>`
        }
      </div>
    </div>`;
  }

  function renderStats() {
    const habits = orderedHabits();
    const streak = computeStreak(state.days, habits);
    const best = computeBestStreak(state.days, habits);
    const xp = xpFromState(state.days, habits);
    const level = Math.floor(xp / XP_PER_LEVEL) + 1;
    const xpIn = xp % XP_PER_LEVEL;

    // overall completion
    let totalPossible = 0;
    let totalDone = 0;
    Object.keys(state.days).forEach((k) => {
      const c = dayCompletion(state.days[k], habits);
      totalPossible += c.total;
      totalDone += c.done;
    });
    const overallPct = totalPossible
      ? Math.round((totalDone / totalPossible) * 100)
      : 0;

    // last 7 / 30
    const lastN = (n) => {
      let done = 0,
        total = 0;
      for (let i = 0; i < n; i++) {
        const k = dateKey(addDays(new Date(), -i));
        const c = dayCompletion(state.days[k], habits);
        done += c.done;
        total += c.total;
      }
      return total ? Math.round((done / total) * 100) : 0;
    };
    const weekPct = lastN(7);
    const monthPct = lastN(30);

    // most consistent habits
    const habitStats = habits
      .map((h) => {
        let count = 0;
        Object.values(state.days).forEach((d) => {
          if (d.completed?.[h.id]) count++;
        });
        return {
          h,
          count,
          streak: habitStreak(state.days, h.id),
          best: habitBestStreak(state.days, h.id),
        };
      })
      .sort((a, b) => b.count - a.count);

    return `
    <div class="wa-main-inner wa-fadein">
      ${pageHead("STATISTICS", "Your numbers", "Consistency over intensity.")}
      <div class="wa-stats" style="margin-bottom:18px">
        ${[
          { label: "Current streak", value: streak + "d", color: "#FF8A8A", icon: "flame" },
          { label: "Best streak", value: best + "d", color: "#F5B971", icon: "award" },
          { label: "Overall", value: overallPct + "%", color: "#79D6FF", icon: "trending-up" },
          { label: "Total XP", value: String(xp), color: "#6EE7C6", icon: "zap" },
        ]
          .map(
            (s) => `
          <div class="wa-glass" style="padding:16px">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:34px;height:34px;border-radius:10px;background:rgba(127,216,255,0.09);display:flex;align-items:center;justify-content:center">
                ${icon(s.icon, 15, s.color)}
              </div>
              <div>
                <div style="font-size:10.5px;color:#6E8296">${s.label}</div>
                <div style="font-size:16px;font-weight:600;color:#EAF4FB">${s.value}</div>
              </div>
            </div>
          </div>`
          )
          .join("")}
      </div>

      <div class="wa-glass" style="padding:20px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:10px">
          <div style="font-size:11px;letter-spacing:1.5px;color:#6E8296">LEVEL ${level} — ${
      RANKS[Math.min(level - 1, RANKS.length - 1)]
    }</div>
          <div style="font-size:12px;color:#79D6FF">${xpIn} / ${XP_PER_LEVEL} XP</div>
        </div>
        ${progressBar((xpIn / XP_PER_LEVEL) * 100, 11)}
      </div>

      <div class="wa-grid-2" style="margin-bottom:16px">
        <div class="wa-glass" style="padding:18px">
          <div style="font-size:11px;letter-spacing:1.5px;color:#6E8296;margin-bottom:8px">LAST 7 DAYS</div>
          <div style="font-size:28px;font-weight:700;color:#EAF4FB">${weekPct}%</div>
          ${progressBar(weekPct, 8)}
        </div>
        <div class="wa-glass" style="padding:18px">
          <div style="font-size:11px;letter-spacing:1.5px;color:#6E8296;margin-bottom:8px">LAST 30 DAYS</div>
          <div style="font-size:28px;font-weight:700;color:#EAF4FB">${monthPct}%</div>
          ${progressBar(monthPct, 8)}
        </div>
      </div>

      <div class="wa-glass" style="padding:20px">
        <div style="font-size:11px;letter-spacing:1.5px;color:#6E8296;margin-bottom:14px">HABIT CONSISTENCY</div>
        ${
          habitStats.length === 0
            ? `<p style="color:#6E8296;font-size:14px">No data yet.</p>`
            : habitStats
                .map(
                  (s) => `
              <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
                <span style="width:28px;height:28px;border-radius:8px;background:rgba(127,216,255,0.1);display:flex;align-items:center;justify-content:center">
                  ${icon(s.h.icon || "sparkles", 14, "#79D6FF")}
                </span>
                <div style="flex:1">
                  <div style="font-size:13.5px;color:#EAF4FB">${s.h.name}</div>
                  <div style="font-size:11px;color:#6E8296">${s.count} days · streak ${s.streak} · best ${s.best}</div>
                </div>
              </div>`
                )
                .join("")
        }
      </div>
    </div>`;
  }

  function renderGoals() {
    const goals = state.goals || [];
    return `
    <div class="wa-main-inner wa-fadein">
      ${pageHead("GOALS", "Bigger targets", "Set deadlines and track progress.")}
      <div style="margin-bottom:16px">
        ${btn("New goal", { iconName: "plus", onClick: "open-add-goal" })}
      </div>
      ${
        goals.length === 0
          ? `<div class="wa-glass wa-empty">
              <div style="margin-bottom:8px">${icon("target", 32, "#5C7082")}</div>
              <p>No goals yet. Create one to aim higher.</p>
            </div>`
          : `<div style="display:flex;flex-direction:column;gap:12px">
              ${goals
                .map((g) => {
                  const pct = clamp(g.progress || 0, 0, 100);
                  const overdue =
                    g.targetDate &&
                    !g.done &&
                    parseKey(g.targetDate) < startOfDay(new Date());
                  return `
                  <div class="wa-glass" style="padding:18px">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
                      <div style="flex:1">
                        <div style="font-size:15px;font-weight:600;color:${
                          g.done ? "#6EE7C6" : "#EAF4FB"
                        };text-decoration:${g.done ? "line-through" : "none"}">${g.title}</div>
                        <div style="font-size:12px;color:#6E8296;margin-top:4px">
                          ${
                            g.targetDate
                              ? "Due " + formatDate(g.targetDate)
                              : "No deadline"
                          }
                          ${overdue ? ' · <span style="color:#FF8A8A">Overdue</span>' : ""}
                        </div>
                      </div>
                      <div style="display:flex;gap:6px">
                        ${
                          !g.done
                            ? `<button class="wa-btn wa-btn-base wa-btn-sm wa-btn-secondary" data-goal-done="${g.id}">${icon(
                                "check",
                                14
                              )}</button>`
                            : ""
                        }
                        <button class="wa-btn wa-btn-base wa-btn-sm wa-btn-ghost" data-delete-goal="${g.id}" style="color:#FF8A8A">${icon(
                          "trash",
                          14
                        )}</button>
                      </div>
                    </div>
                    ${
                      !g.done
                        ? `<div style="margin-top:12px">
                            <div style="display:flex;justify-content:space-between;font-size:11px;color:#6E8296;margin-bottom:4px">
                              <span>Progress</span><span>${pct}%</span>
                            </div>
                            ${progressBar(pct, 7)}
                            <input type="range" min="0" max="100" step="5" value="${pct}" data-goal-progress="${g.id}" style="margin-top:10px" />
                          </div>`
                        : ""
                    }
                  </div>`;
                })
                .join("")}
            </div>`
      }
    </div>`;
  }

  function renderSettings() {
    const p = state.profile || {};
    return `
    <div class="wa-main-inner wa-fadein">
      ${pageHead("SETTINGS", "Preferences", "Data stays on this device.")}
      <div class="wa-glass" style="padding:20px;margin-bottom:14px">
        <div style="font-size:11px;letter-spacing:1.5px;color:#6E8296;margin-bottom:14px">PROFILE</div>
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#79D6FF,#5B8CFF);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#04121F">
            ${(p.name || "?")[0].toUpperCase()}
          </div>
          <div>
            <div style="font-size:17px;font-weight:600;color:#EAF4FB">${
              p.name || "Unknown"
            }</div>
            <div style="font-size:12px;color:#6E8296">Started ${
              state.startDate ? formatDate(state.startDate) : "—"
            }</div>
          </div>
        </div>
      </div>

      <div class="wa-glass" style="padding:20px;margin-bottom:14px">
        <div style="font-size:11px;letter-spacing:1.5px;color:#6E8296;margin-bottom:14px">PREFERENCES</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div>
            <div style="font-size:14px;color:#EAF4FB">Sound effects</div>
            <div style="font-size:12px;color:#6E8296">Play tones on check-off</div>
          </div>
          <button class="wa-switch ${
            state.settings.sound ? "on" : ""
          }" data-action="toggle-sound" aria-label="Toggle sound"><span></span></button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:14px;color:#EAF4FB">Reduce motion</div>
            <div style="font-size:12px;color:#6E8296">Disable snow & animations</div>
          </div>
          <button class="wa-switch ${
            state.settings.reducedMotion ? "on" : ""
          }" data-action="toggle-motion" aria-label="Toggle motion"><span></span></button>
        </div>
      </div>

      <div class="wa-glass" style="padding:20px;margin-bottom:14px">
        <div style="font-size:11px;letter-spacing:1.5px;color:#6E8296;margin-bottom:14px">DATA</div>
        <div style="display:flex;flex-wrap:wrap;gap:10px">
          ${btn("Export backup", {
            variant: "secondary",
            iconName: "download",
            onClick: "export-data",
          })}
          <label class="wa-btn wa-btn-base wa-btn-md wa-btn-secondary" style="cursor:pointer">
            ${icon("upload", 15)} Import
            <input type="file" accept="application/json,.json" id="import-file" style="display:none" />
          </label>
        </div>
      </div>

      <div class="wa-glass" style="padding:20px;border:1px solid rgba(255,90,90,0.22)">
        <div style="font-size:11px;letter-spacing:1.5px;color:#FF8A8A;margin-bottom:12px">DANGER ZONE</div>
        ${btn("Reset all data", {
          variant: "danger",
          iconName: "trash",
          onClick: "confirm-reset",
        })}
      </div>
    </div>`;
  }

  function renderModal() {
    if (!modal) return "";
    if (modal.type === "add-habit" || modal.type === "edit-habit") {
      const h = modal.data || {};
      const isEdit = modal.type === "edit-habit";
      return `
      <div class="wa-modal-backdrop wa-overlay" data-close-modal>
        <div class="wa-modal wa-modalcard" onclick="event.stopPropagation()">
          <div class="wa-glass" style="padding:24px">
            <div style="font-family:var(--font-display);font-weight:700;font-size:17px;margin-bottom:16px">${
              isEdit ? "Edit habit" : "New habit"
            }</div>
            <label class="wa-label">Name</label>
            <input class="wa-input" id="modal-habit-name" value="${(
              h.name || ""
            ).replace(/"/g, "&quot;")}" placeholder="e.g. Morning run" maxlength="48" />
            <label class="wa-label" style="margin-top:14px">Category</label>
            <div style="display:flex;flex-wrap:wrap;gap:8px" id="modal-cats">
              ${CATEGORIES.map(
                (c) => `
                <button type="button" class="wa-chip ${
                  (h.category || "custom") === c.id ? "sel" : ""
                }" data-cat="${c.id}">${c.label}</button>`
              ).join("")}
            </div>
            <label class="wa-label" style="margin-top:14px">Icon</label>
            <div style="display:flex;flex-wrap:wrap;gap:6px" id="modal-icons">
              ${ICONS.map(
                (ic) => `
                <button type="button" class="wa-chip ${
                  (h.icon || "sparkles") === ic ? "sel" : ""
                }" data-icon="${ic}" style="padding:8px">${icon(
                  ic,
                  16
                )}</button>`
              ).join("")}
            </div>
            <div style="display:flex;gap:10px;margin-top:22px;justify-content:flex-end">
              ${btn("Cancel", {
                variant: "ghost",
                size: "sm",
                onClick: "close-modal",
              })}
              ${btn(isEdit ? "Save" : "Add", {
                size: "sm",
                onClick: isEdit ? "save-edit-habit" : "save-add-habit",
              })}
            </div>
          </div>
        </div>
      </div>`;
    }
    if (modal.type === "add-goal") {
      return `
      <div class="wa-modal-backdrop wa-overlay" data-close-modal>
        <div class="wa-modal wa-modalcard" onclick="event.stopPropagation()">
          <div class="wa-glass" style="padding:24px">
            <div style="font-family:var(--font-display);font-weight:700;font-size:17px;margin-bottom:16px">New goal</div>
            <label class="wa-label">Title</label>
            <input class="wa-input" id="modal-goal-title" placeholder="e.g. Run a 5K" maxlength="80" />
            <label class="wa-label" style="margin-top:14px">Target date (optional)</label>
            <input class="wa-input" type="date" id="modal-goal-date" />
            <div style="display:flex;gap:10px;margin-top:22px;justify-content:flex-end">
              ${btn("Cancel", {
                variant: "ghost",
                size: "sm",
                onClick: "close-modal",
              })}
              ${btn("Create", { size: "sm", onClick: "save-add-goal" })}
            </div>
          </div>
        </div>
      </div>`;
    }
    if (modal.type === "confirm-reset") {
      return `
      <div class="wa-modal-backdrop wa-overlay" data-close-modal>
        <div class="wa-modal wa-modalcard" onclick="event.stopPropagation()">
          <div class="wa-glass" style="padding:24px">
            <div style="display:flex;gap:12px;align-items:flex-start">
              ${icon("alert-triangle", 20, "#FF8A8A")}
              <div>
                <div style="font-family:var(--font-display);font-weight:700;font-size:17px">Reset everything?</div>
                <div style="font-size:13.5px;color:#8FA4B8;margin-top:8px;line-height:1.5">
                  This permanently deletes all habits, history, goals and settings. Cannot be undone.
                </div>
              </div>
            </div>
            <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end">
              ${btn("Cancel", {
                variant: "ghost",
                size: "sm",
                onClick: "close-modal",
              })}
              ${btn("RESET", {
                variant: "danger",
                size: "sm",
                onClick: "do-reset",
              })}
            </div>
          </div>
        </div>
      </div>`;
    }
    if (modal.type === "confirm-delete-habit") {
      return `
      <div class="wa-modal-backdrop wa-overlay" data-close-modal>
        <div class="wa-modal wa-modalcard" onclick="event.stopPropagation()">
          <div class="wa-glass" style="padding:24px">
            <div style="font-family:var(--font-display);font-weight:700;font-size:17px;margin-bottom:8px">Delete habit?</div>
            <div style="font-size:13.5px;color:#8FA4B8;margin-bottom:18px">"${(
              modal.data?.name || ""
            ).replace(
              /"/g,
              "&quot;"
            )}" and its history will be removed.</div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
              ${btn("Cancel", {
                variant: "ghost",
                size: "sm",
                onClick: "close-modal",
              })}
              ${btn("Delete", {
                variant: "danger",
                size: "sm",
                onClick: "do-delete-habit",
              })}
            </div>
          </div>
        </div>
      </div>`;
    }
    return "";
  }

  function renderToast() {
    const el = document.getElementById("toast-root");
    if (!el) return;
    if (!toast) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = `
      <div class="wa-toast wa-glass wa-modalcard">
        ${icon("check-circle", 16, "#6EE7C6")}
        <span>${toast}</span>
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  function render() {
    const root = document.getElementById("root");
    if (!root) return;

    if (!state.onboarded) {
      root.innerHTML = renderLanding();
      bindEvents(root);
      return;
    }
    if (state.onboarded === "starting") {
      root.innerHTML = renderOnboarding();
      bindEvents(root);
      return;
    }

    let body = "";
    switch (page) {
      case "dashboard":
        body = renderDashboard();
        break;
      case "habits":
        body = renderHabits();
        break;
      case "calendar":
        body = renderCalendar();
        break;
      case "stats":
        body = renderStats();
        break;
      case "goals":
        body = renderGoals();
        break;
      case "settings":
        body = renderSettings();
        break;
      default:
        body = renderDashboard();
    }

    root.innerHTML = `
      ${snowField(22)}
      ${renderSidebar()}
      <main class="wa-main">${body}</main>
      ${renderMobileNav()}
      <div id="toast-root"></div>
      ${renderModal()}
    `;
    renderToast();
    bindEvents(root);
  }

  // ---------------------------------------------------------------------------
  // Event binding
  // ---------------------------------------------------------------------------
  function bindEvents(root) {
    // Nav
    root.querySelectorAll("[data-nav]").forEach((el) => {
      el.addEventListener("click", () => {
        page = el.getAttribute("data-nav");
        render();
      });
    });

    // Generic actions
    root.querySelectorAll("[data-action]").forEach((el) => {
      el.addEventListener("click", (e) => {
        const a = el.getAttribute("data-action");
        handleAction(a, el, e);
      });
    });

    // Toggle habit
    root.querySelectorAll("[data-toggle-habit]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.getAttribute("data-toggle-habit");
        const date = el.getAttribute("data-date") || todayKey();
        toggleHabit(id, date);
      });
    });

    // Select date
    root.querySelectorAll("[data-select-date]").forEach((el) => {
      el.addEventListener("click", () => {
        selectedDate = el.getAttribute("data-select-date");
        render();
      });
    });

    // Habit edit / delete
    root.querySelectorAll("[data-edit-habit]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = el.getAttribute("data-edit-habit");
        const h = state.habits.find((x) => x.id === id);
        if (h) {
          modal = { type: "edit-habit", data: { ...h } };
          render();
        }
      });
    });
    root.querySelectorAll("[data-delete-habit]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = el.getAttribute("data-delete-habit");
        const h = state.habits.find((x) => x.id === id);
        if (h) {
          modal = { type: "confirm-delete-habit", data: h };
          render();
        }
      });
    });

    // Goals
    root.querySelectorAll("[data-goal-done]").forEach((el) => {
      el.addEventListener("click", () => {
        updateGoal(el.getAttribute("data-goal-done"), {
          done: true,
          progress: 100,
        });
        showToast("Goal completed!");
      });
    });
    root.querySelectorAll("[data-delete-goal]").forEach((el) => {
      el.addEventListener("click", () => {
        deleteGoal(el.getAttribute("data-delete-goal"));
      });
    });
    root.querySelectorAll("[data-goal-progress]").forEach((el) => {
      el.addEventListener("input", () => {
        const id = el.getAttribute("data-goal-progress");
        updateGoal(id, { progress: parseInt(el.value, 10) });
      });
    });

    // Modal close
    root.querySelectorAll("[data-close-modal]").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target === el) {
          modal = null;
          render();
        }
      });
    });

    // Category / icon chips in modal
    root.querySelectorAll("#modal-cats .wa-chip").forEach((el) => {
      el.addEventListener("click", () => {
        root.querySelectorAll("#modal-cats .wa-chip").forEach((c) =>
          c.classList.remove("sel")
        );
        el.classList.add("sel");
      });
    });
    root.querySelectorAll("#modal-icons .wa-chip").forEach((el) => {
      el.addEventListener("click", () => {
        root.querySelectorAll("#modal-icons .wa-chip").forEach((c) =>
          c.classList.remove("sel")
        );
        el.classList.add("sel");
      });
    });

    // Import file
    const importInput = root.querySelector("#import-file");
    if (importInput) {
      importInput.addEventListener("change", (e) => {
        const f = e.target.files?.[0];
        if (f) importData(f);
      });
    }

    // Drag reorder
    root.querySelectorAll("[draggable=true]").forEach((el) => {
      el.addEventListener("dragstart", (e) => {
        dragId = el.getAttribute("data-habit-id");
        el.classList.add("wa-habit-dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      el.addEventListener("dragend", () => {
        el.classList.remove("wa-habit-dragging");
        dragId = null;
      });
      el.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      });
      el.addEventListener("drop", (e) => {
        e.preventDefault();
        const toId = el.getAttribute("data-habit-id");
        if (dragId && toId) reorderHabits(dragId, toId);
      });
    });
  }

  function handleAction(a, el, e) {
    switch (a) {
      case "start-onboard":
        setState({ onboarded: "starting" });
        break;
      case "finish-onboard": {
        const name = (
          document.getElementById("ob-name")?.value || ""
        ).trim();
        if (!name) {
          showToast("Please enter your name.");
          return;
        }
        completeOnboarding({ name });
        break;
      }
      case "goto-habits":
        page = "habits";
        render();
        break;
      case "open-add-habit":
        modal = {
          type: "add-habit",
          data: { name: "", icon: "sparkles", category: "custom" },
        };
        render();
        break;
      case "save-add-habit": {
        const name = document.getElementById("modal-habit-name")?.value;
        const cat =
          document.querySelector("#modal-cats .wa-chip.sel")?.getAttribute(
            "data-cat"
          ) || "custom";
        const ic =
          document.querySelector("#modal-icons .wa-chip.sel")?.getAttribute(
            "data-icon"
          ) || "sparkles";
        if (!name || !name.trim()) {
          showToast("Name is required.");
          return;
        }
        addHabit({ name, category: cat, icon: ic });
        modal = null;
        render();
        break;
      }
      case "save-edit-habit": {
        const name = document.getElementById("modal-habit-name")?.value;
        const cat =
          document.querySelector("#modal-cats .wa-chip.sel")?.getAttribute(
            "data-cat"
          ) || "custom";
        const ic =
          document.querySelector("#modal-icons .wa-chip.sel")?.getAttribute(
            "data-icon"
          ) || "sparkles";
        if (!name || !name.trim()) {
          showToast("Name is required.");
          return;
        }
        editHabit(modal.data.id, { name, category: cat, icon: ic });
        modal = null;
        render();
        break;
      }
      case "do-delete-habit":
        if (modal?.data?.id) deleteHabit(modal.data.id);
        modal = null;
        render();
        break;
      case "open-add-goal":
        modal = { type: "add-goal" };
        render();
        break;
      case "save-add-goal": {
        const title = document.getElementById("modal-goal-title")?.value;
        const targetDate =
          document.getElementById("modal-goal-date")?.value || null;
        if (!title || !title.trim()) {
          showToast("Title is required.");
          return;
        }
        addGoal({ title, targetDate });
        modal = null;
        render();
        break;
      }
      case "cal-prev":
        calMonth--;
        if (calMonth < 0) {
          calMonth = 11;
          calYear--;
        }
        render();
        break;
      case "cal-next":
        calMonth++;
        if (calMonth > 11) {
          calMonth = 0;
          calYear++;
        }
        render();
        break;
      case "toggle-sound":
        setState({
          settings: {
            ...state.settings,
            sound: !state.settings.sound,
          },
        });
        break;
      case "toggle-motion":
        setState({
          settings: {
            ...state.settings,
            reducedMotion: !state.settings.reducedMotion,
          },
        });
        break;
      case "export-data":
        exportData();
        break;
      case "confirm-reset":
        modal = { type: "confirm-reset" };
        render();
        break;
      case "do-reset":
        resetAll();
        break;
      case "close-modal":
        modal = null;
        render();
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    // Auto day index / ensure today exists
    if (state.onboarded === true) {
      ensureToday();
    }
    render();
  });
})();
