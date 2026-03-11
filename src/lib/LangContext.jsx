import { createContext, useContext, useState } from "react";
import { translations } from "./translations";

const LangContext = createContext("pl");

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("eea_lang") || "pl"; } catch { return "pl"; }
  });

  function switchLang(l) {
    setLang(l);
    try { localStorage.setItem("eea_lang", l); } catch {}
  }

  return (
    <LangContext.Provider value={{ lang, switchLang, T: translations[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useT() {
  const { T } = useContext(LangContext);
  return T;
}

export function useLang() {
  return useContext(LangContext);
}
