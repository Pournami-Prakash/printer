export function getMemory() {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("guilt_memory") || "";
  }
  
  export function setMemory(text: string) {
    if (typeof window === "undefined") return;
    localStorage.setItem("guilt_memory", text.slice(0, 100));
  }
  
  export function getStreak() {
    if (typeof window === "undefined") return 1;
  
    const last = localStorage.getItem("last_used");
    const today = new Date().toDateString();
  
    if (last === today) {
      return parseInt(localStorage.getItem("streak") || "1");
    }
  
    let streak = 1;
  
    if (last) {
      const prev = new Date(last);
      const diff = (Date.now() - prev.getTime()) / (1000 * 60 * 60 * 24);
  
      if (diff <= 2) {
        streak = parseInt(localStorage.getItem("streak") || "1") + 1;
      }
    }
  
    localStorage.setItem("last_used", today);
    localStorage.setItem("streak", String(streak));
  
    return streak;
  }