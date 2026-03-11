import { useState, useCallback, useMemo, useEffect } from "react";
import { C, GROUPS, ADMIN_EMAIL } from "./lib/constants";
import { TRAININGS } from "./data/trainings";
import { auth, db, session } from "./lib/supabase";
import { calcProgress } from "./lib/helpers";
import { LangProvider } from "./lib/LangContext";
import { Header } from "./components/SharedUI";
import { LoginScreen } from "./components/Login";
import { TrainingTab } from "./components/TrainingTab";
import { CatalogTab } from "./components/CatalogTab";
import { ScheduleTab } from "./components/ScheduleTab";
import { MessagesTab } from "./components/MessagesTab";
import { ProfileTab } from "./components/ProfileTab";
import { AdminPanel } from "./components/AdminPanel";
import { TabBar } from "./components/TabBar";

export default function App() {
  const [user,         setUserRaw]       = useState(null);
  const [tab,          setTab]           = useState(0);
  const [completed,    setCompleted]     = useState([]);
  const [activeGroups, setActiveGroups]  = useState(["tech","ur","maszyny"]);
  const [notifReminder,setNotifReminder] = useState(true);
  const [notifCert,    setNotifCert]     = useState(true);
  const [dataLoading,  setDataLoading]   = useState(false);
  const [msgCount,     setMsgCount]      = useState(0);
  const [sessionChecked, setSessionChecked] = useState(false);

  // ── Przy starcie: spróbuj odtworzyć sesję z localStorage ──────────────────
  useEffect(() => {
    async function restoreSession() {
      const saved = session.load();
      if (!saved?.refreshToken) {
        setSessionChecked(true);
        return;
      }
      try {
        const refreshed = await auth.refreshSession(saved.refreshToken);
        // Zapisz nowe tokeny (refresh_token rotuje przy każdym odświeżeniu)
        session.save(refreshed.access_token, refreshed.refresh_token, refreshed.user);
        await handleLogin({
          id:          refreshed.user.id,
          accessToken: refreshed.access_token,
          email:       refreshed.user.email,
          _skipSessionSave: true, // już zapisane powyżej
        });
      } catch {
        // Token wygasł lub nieprawidłowy — wyczyść i pokaż ekran logowania
        session.clear();
      } finally {
        setSessionChecked(true);
      }
    }
    restoreSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogin(rawUser) {
    setDataLoading(true);
    try {
      console.log("[LOGIN] user.id =", rawUser.id, "| token preview:", rawUser.accessToken?.slice(0,20));

      let profile = null;
      try {
        const profiles = await db.get(rawUser.accessToken, "profiles", `id=eq.${rawUser.id}&select=*`);
        console.log("[LOGIN] profile from DB:", profiles);
        profile = profiles[0] || null;
      } catch(e) {
        console.error("[LOGIN] ERROR loading profile:", e.message);
      }

      const u = {
        id:           rawUser.id,
        email:        rawUser.email,
        accessToken:  rawUser.accessToken,
        name:         profile?.name         || rawUser.name         || rawUser.email,
        login:        profile?.login        || rawUser.login        || rawUser.email,
        role:         profile?.role         || rawUser.role         || null,
        firma:        profile?.firma        || rawUser.firma        || null,
        active_groups: profile?.active_groups || rawUser.active_groups || ["tech","ur","maszyny"],
        notif_reminder: profile?.notif_reminder ?? rawUser.notif_reminder ?? true,
        notif_cert:     profile?.notif_cert    ?? rawUser.notif_cert    ?? true,
        trainer_id:     profile?.trainer_id    ?? rawUser.trainer_id    ?? null,
      };
      u.displayName = u.name;
      u.displayRole = u.role || "";

      setUserRaw(u);

      if (Array.isArray(u.active_groups) && u.active_groups.length)
        setActiveGroups(u.active_groups);
      setNotifReminder(u.notif_reminder);
      setNotifCert(u.notif_cert);

      const comps = await db.get(u.accessToken, "completions", `user_id=eq.${u.id}&order=created_at.asc&select=*`);
      console.log("[LOGIN] completions loaded:", comps.length, comps);
      setCompleted(comps.map(c => ({ training:c.training_data, date:c.date, key:c.code_key, trainer:c.trainer||null, trainerNum:parseInt(c.code_key?.slice(-1))||1 })));

      try {
        const msgs = await db.get(u.accessToken, "messages", "select=id");
        setMsgCount(msgs.length);
      } catch {}

      try {
        const overrides = await db.get(u.accessToken, "training_overrides", "select=*");
        overrides.forEach(ov => {
          const t = TRAININGS.find(t => t.id === ov.training_id);
          if (t) {
            if (ov.title)       t.title    = ov.title;
            if (ov.description) t.desc     = ov.description;
            if (ov.duration)    t.duration = ov.duration;
            if (ov.level)       t.level    = ov.level;
          }
        });
      } catch {}

    } catch(e) {
      console.error("[LOGIN] ERROR loading data:", e.message, e);
    }
    finally { setDataLoading(false); }
  }

  async function handleComplete(entry) {
    setCompleted(p => {
      const filtered = p.filter(c => c.training.id !== entry.training.id);
      return [...filtered, entry];
    });
    try {
      const payload = {
        user_id: user.id,
        training_id: entry.training.id,
        training_data: entry.training,
        date: entry.date,
        code_key: entry.key,
        trainer: entry.trainer || null,
      };
      const existing = await db.get(user.accessToken, "completions", `user_id=eq.${user.id}&training_id=eq.${entry.training.id}&select=id`);
      if (existing && existing.length > 0) {
        const res = await db.update(user.accessToken, "completions", `user_id=eq.${user.id}&training_id=eq.${entry.training.id}`, payload);
        console.log("[COMPLETE] updated:", res);
        if (!res || res.length === 0) {
          alert("⚠️ BŁĄD ZAPISU: UPDATE nie zapisał danych. Sprawdź RLS w Supabase — tabela completions wymaga polityki UPDATE dla zalogowanych użytkowników.");
        }
      } else {
        const res = await db.insert(user.accessToken, "completions", payload);
        console.log("[COMPLETE] inserted:", res);
        if (!res || res.length === 0) {
          alert("⚠️ BŁĄD ZAPISU: INSERT nie zapisał danych. Sprawdź RLS w Supabase — tabela completions wymaga polityki INSERT dla zalogowanych użytkowników.");
        }
      }
    } catch(e) {
      console.error("[COMPLETE] ERROR saving:", e.message, e);
      alert("⚠️ BŁĄD ZAPISU: " + e.message);
    }
  }

  async function handleLogout() {
    try { await auth.signOut(user?.accessToken); } catch {}
    setUserRaw(null); setCompleted([]); setTab(0); setMsgCount(0);
    setActiveGroups(["tech","ur","maszyny"]); setNotifReminder(true); setNotifCert(true);
  }

  const progress = calcProgress(completed, activeGroups);
  const bannerSub = [user?.displayRole, user?.firma].filter(Boolean).join(" · ");

  // Czekaj na sprawdzenie sesji przed renderowaniem
  if (!sessionChecked) return (
    <LangProvider>
      <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:C.greyBg,fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif"}}>
        <div style={{textAlign:"center"}}>
          <div style={{width:40,height:40,border:`3px solid ${C.grey}`,borderTopColor:C.green,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 16px"}}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <span style={{color:C.greyDk,fontSize:14}}>Ładowanie...</span>
        </div>
      </div>
    </LangProvider>
  );

  if (!user) return <LangProvider><LoginScreen onLogin={handleLogin}/></LangProvider>;

  if (user.email === ADMIN_EMAIL) return (
    <LangProvider><AdminPanel user={user} onLogout={handleLogout}/></LangProvider>
  );

  return (
    <LangProvider>
    <div className="app-container" style={{height:"100%",display:"flex",flexDirection:"column",fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",background:C.greyBg,overflow:"hidden"}}>
      <Header onLogout={handleLogout}/>
      <div style={{background:C.greyBanner,borderBottom:`1px solid #D0D3D6`,padding:"9px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:13,color:C.greyDk,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginRight:8}}>
          {user.displayName}{bannerSub ? ` · ${bannerSub}` : ""}
        </span>
        {progress.active && <span style={{fontSize:13,fontWeight:700,color:C.green,flexShrink:0}}>{progress.pct}% ukończone</span>}
      </div>
      <div className="app-content" style={{flex:1,minHeight:0,overflowY:"auto",WebkitOverflowScrolling:"touch",display:"flex",flexDirection:"column",paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
        {tab===0 && <TrainingTab user={user} completed={completed} onComplete={handleComplete} activeGroups={activeGroups} loading={dataLoading}/>}
        {tab===1 && <CatalogTab  completed={completed} activeGroups={activeGroups}/>}
        {tab===2 && <ScheduleTab activeGroups={activeGroups} token={user.accessToken} trainerNum={user.trainer_id}/>}
        {tab===3 && <MessagesTab token={user.accessToken} userEmail={user.email} user={user}/>}
        {tab===4 && <ProfileTab  user={user} setUser={setUserRaw} completed={completed} activeGroups={activeGroups} setActiveGroups={setActiveGroups} onLogout={handleLogout}/>}
      </div>
      <TabBar tab={tab} setTab={setTab} completedCount={completed.length} msgCount={msgCount}/>
    </div>
    </LangProvider>
  );
}