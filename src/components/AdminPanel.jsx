import { useState, useEffect, useMemo } from "react";
import { C, GROUPS, LVL_COLOR, LVL_LABEL, MSG_TYPES, TRAINERS } from "../lib/constants";
import { TRAININGS } from "../data/trainings";
import { db, authHeaders, SB_URL } from "../lib/supabase";
import { formatDate } from "../lib/helpers";
import { Spinner, SecTitle, Toggle } from "./SharedUI";

const LOGO_URL = "/logo.png";

export function AdminPanel({ user, onLogout }) {
  const [tab, setTab] = useState(0);
  const adminTabs = [["Terminarz","📅"],["Wiadomości","✉"],["Edytor szkoleń","📋"],["Generator kodów","🔑"]];

  return (
    <div className="app-container" style={{height:"100%",display:"flex",flexDirection:"column",fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",background:C.greyBg,overflow:"hidden"}}>
      <div style={{background:C.darkHdr,paddingTop:"calc(12px + env(safe-area-inset-top, 0px))",paddingBottom:"12px",paddingLeft:"16px",paddingRight:"16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,boxSizing:"border-box"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <img src={LOGO_URL} alt="ENGEL" style={{height:22,mixBlendMode:"screen"}}/>
          <span style={{color:C.green,fontSize:11,fontWeight:700,letterSpacing:2}}>ADMIN</span>
        </div>
        <button onClick={onLogout} style={{background:"none",border:`1px solid rgba(255,255,255,.3)`,color:"#ccc",padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Wyloguj</button>
      </div>
      <div style={{height:3,background:C.green,flexShrink:0}}/>

      <div style={{display:"flex",background:C.white,borderBottom:`1px solid ${C.grey}`,flexShrink:0}}>
        {adminTabs.map(([label,icon],i) => (
          <button key={i} onClick={() => setTab(i)}
            style={{flex:1,background:"none",border:"none",borderBottom:`3px solid ${tab===i?C.green:"transparent"}`,padding:"10px 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer"}}>
            <span style={{fontSize:16,color:tab===i?C.black:C.greyMid}}>{icon}</span>
            <span style={{fontSize:9,fontWeight:700,color:tab===i?C.black:C.greyMid,letterSpacing:.5,textTransform:"uppercase"}}>{label}</span>
          </button>
        ))}
      </div>

      <div style={{flex:1,minHeight:0,overflowY:"auto",display:"flex",flexDirection:"column",WebkitOverflowScrolling:"touch",paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
        {tab===0 && <AdminSchedule token={user.accessToken}/>}
        {tab===1 && <AdminMessages token={user.accessToken}/>}
        {tab===2 && <AdminTrainings token={user.accessToken}/>}
        {tab===3 && <AdminCodeGen/>}
      </div>
    </div>
  );
}

/* ── Admin: Generator kodów ── */
export function AdminCodeGen() {
  const [mode,        setMode]        = useState("normal"); // "normal" | "special"
  const [selGroup,    setSelGroup]    = useState(GROUPS[0].id);
  const [selTraining, setSelTraining] = useState(TRAININGS.find(t=>t.group===GROUPS[0].id)?.id || TRAININGS[0].id);
  const [selTrainer,  setSelTrainer]  = useState(1);
  const [copied,      setCopied]      = useState(false);

  function handleGroupChange(gid) {
    setSelGroup(gid);
    const first = TRAININGS.find(t => t.group===gid);
    if (first) setSelTraining(first.id);
  }

  function getEnc() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yy = String(d.getFullYear()).slice(2);
    return (dd+mm+yy).split("").map(c => String((parseInt(c)+3)%10)).join("");
  }

  function getCode(prefix) {
    const enc = getEnc();
    const short = mode === "special"
      ? "ST"
      : (TRAININGS.find(t => t.id === selTraining)?.short || selTraining.replace(/-/g,""));
    return `${prefix||""}${short}${enc}${selTrainer}`;
  }

  function decodeForDisplay() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
  }

  const code  = getCode();
  const groupTrainings = TRAININGS.filter(t => t.group===selGroup);
  const short = mode === "special" ? "ST" : (TRAININGS.find(t => t.id === selTraining)?.short || selTraining.replace(/-/g,""));

  function copyCode(val, setCb) {
    navigator.clipboard.writeText(val).then(() => { setCb(true); setTimeout(() => setCb(false), 2000); });
  }

  return (
    <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{background:C.white,padding:18,borderTop:`3px solid ${C.green}`}}>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:C.greyDk,marginBottom:14,textTransform:"uppercase"}}>Generator kodów szkoleniowych</div>

        {/* Przełącznik trybu */}
        <div style={{display:"flex",gap:0,marginBottom:18,border:`1px solid ${C.grey}`,overflow:"hidden"}}>
          {[["normal","📋 Standardowe"],["special","⭐ Specjalne (ST)"]].map(([val,label]) => (
            <button key={val} onClick={() => setMode(val)}
              style={{flex:1,padding:"9px 0",fontSize:11,fontWeight:700,cursor:"pointer",border:"none",
                background:mode===val?C.black:C.white, color:mode===val?C.white:C.greyDk}}>
              {label}
            </button>
          ))}
        </div>

        {mode === "normal" && (
          <>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:8,letterSpacing:.5}}>KROK 1 — KATEGORIA</label>
              <select value={selGroup} onChange={e => handleGroupChange(e.target.value)}
                style={{width:"100%",padding:"11px 14px",fontSize:13,border:`1.5px solid ${C.green}`,background:C.white,color:C.black,cursor:"pointer"}}>
                {GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:8,letterSpacing:.5}}>KROK 2 — SZKOLENIE</label>
              <select value={selTraining} onChange={e => setSelTraining(e.target.value)}
                style={{width:"100%",padding:"11px 14px",fontSize:13,border:`1.5px solid ${C.green}`,background:C.white,color:C.black,cursor:"pointer"}}>
                {groupTrainings.map(t => (
                  <option key={t.id} value={t.id}>{t.short} — {t.title}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {mode === "special" && (
          <div style={{marginBottom:14,background:"#FEF3E2",border:`1px solid ${C.amber}`,padding:"10px 14px",fontSize:11,color:C.greyDk,lineHeight:1.6}}>
            ⭐ Kod ST — uczestnik sam wpisze nazwę szkolenia po zeskanowaniu kodu.
          </div>
        )}

        <div style={{marginBottom:18}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:8,letterSpacing:.5}}>{mode==="normal"?"KROK 3":"KROK 2"} — TRENER</label>
          <select value={selTrainer} onChange={e => setSelTrainer(Number(e.target.value))}
            style={{width:"100%",padding:"11px 14px",fontSize:13,border:`1.5px solid ${C.green}`,background:C.white,color:C.black,cursor:"pointer"}}>
            {Object.entries(TRAINERS).map(([num, name]) => (
              <option key={num} value={num}>{name}</option>
            ))}
          </select>
        </div>

        {/* Kod dzienny */}
        <div style={{background:C.greyBg,border:`2px solid ${C.green}`,padding:16,marginBottom:8}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:C.greyMid,marginBottom:8}}>WYGENEROWANY KOD</div>
          <div style={{fontFamily:"monospace",fontSize:26,fontWeight:700,color:C.black,letterSpacing:4,marginBottom:10,wordBreak:"break-all"}}>{code}</div>
          <div style={{fontSize:11,color:C.greyMid,display:"flex",flexDirection:"column",gap:3}}>
            <span>📅 Data: <strong>{decodeForDisplay()}</strong> (ważny tylko dziś)</span>
            <span>🎓 Prefix: <strong>{short}</strong></span>
            <span>👤 Trener: <strong>{TRAINERS[selTrainer]}</strong></span>
          </div>
        </div>
        <button onClick={() => copyCode(code, setCopied)}
          style={{width:"100%",background:copied?C.greenDk:C.black,border:"none",color:C.white,padding:12,fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:12}}>
          {copied ? "✓ Skopiowano!" : "Kopiuj kod"}
        </button>

        <div style={{background:"#EBF5FB",border:`1px solid ${C.blue}`,padding:"10px 14px",fontSize:11,color:C.greyDk,lineHeight:1.6}}>
          ℹ️ Każdy trener ma unikalną cyfrę zakodowaną w kodzie. Dodaj <strong>D</strong> na początku aby pominąć weryfikację daty.
        </div>
      </div>
    </div>
  );
}

/* ── Admin: Wiadomości ── */
export function AdminMessages({ token }) {
  const [messages, setMessages] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [fTitle,   setFTitle]   = useState("");
  const [fBody,    setFBody]    = useState("");
  const [fType,    setFType]    = useState("info");
  const [fPinned,  setFPinned]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState("");
  const [deleting, setDeleting] = useState(null);

  async function loadMessages() {
    setLoading(true);
    try {
      const data = await db.get(token, "messages", "order=pinned.desc,created_at.desc&select=*");
      setMessages(data);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { loadMessages(); }, []);

  async function sendMessage() {
    if (!fTitle.trim()) { setFormErr("Tytuł jest wymagany"); return; }
    if (!fBody.trim())  { setFormErr("Treść jest wymagana"); return; }
    setSaving(true); setFormErr("");
    try {
      await db.insert(token, "messages", { title:fTitle.trim(), body:fBody.trim(), type:fType, pinned:fPinned });
      setFTitle(""); setFBody(""); setFType("info"); setFPinned(false); setShowForm(false);
      await loadMessages();
    } catch(e) { setFormErr("Błąd wysyłania: " + e.message); }
    finally { setSaving(false); }
  }

  async function deleteMessage(id) {
    if (!window.confirm("Usunąć tę wiadomość?")) return;
    setDeleting(id);
    try {
      await db.remove(token, "messages", `id=eq.${id}`);
      setMessages(p => p.filter(m => m.id !== id));
    } catch(e) { alert("Błąd usuwania: " + e.message); }
    finally { setDeleting(null); }
  }

  if (loading) return <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner/></div>;

  return (
    <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{background:C.white,padding:18,borderTop:`3px solid ${C.green}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showForm?16:0}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:C.greyDk,textTransform:"uppercase"}}>Wyślij wiadomość</div>
          <button onClick={() => { setShowForm(p=>!p); setFormErr(""); }}
            style={{background:showForm?"none":C.black,border:`1px solid ${showForm?C.grey:C.black}`,color:showForm?C.greyDk:C.white,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
            {showForm ? "Anuluj" : "+ Nowa"}
          </button>
        </div>
        {showForm && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:5,letterSpacing:.5}}>TYTUŁ *</label>
              <input style={{width:"100%",border:`1.5px solid ${C.grey}`,padding:"9px 12px",fontSize:14,color:C.black,outline:"none",boxSizing:"border-box"}}
                value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="Tytuł wiadomości"/>
            </div>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:5,letterSpacing:.5}}>TREŚĆ *</label>
              <textarea style={{width:"100%",border:`1.5px solid ${C.grey}`,padding:"9px 12px",fontSize:13,color:C.black,outline:"none",boxSizing:"border-box",minHeight:90,resize:"vertical",fontFamily:"inherit"}}
                value={fBody} onChange={e => setFBody(e.target.value)} placeholder="Treść wiadomości..."/>
            </div>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:8,letterSpacing:.5}}>TYP</label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {Object.entries(MSG_TYPES).map(([key,mt]) => (
                  <button key={key} onClick={() => setFType(key)}
                    style={{padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",border:`2px solid ${fType===key?mt.color:C.grey}`,background:fType===key?mt.bg:C.white,color:fType===key?mt.color:C.greyDk}}>
                    {mt.icon} {key.charAt(0).toUpperCase()+key.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <Toggle value={fPinned} color={C.green} onChange={() => setFPinned(p=>!p)}/>
              <span style={{fontSize:13,color:C.black}}>Przypnij wiadomość na górze</span>
            </div>
            {(fTitle||fBody) && (
              <div>
                <div style={{fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:6,letterSpacing:.5}}>PODGLĄD</div>
                <div style={{background:fPinned?(MSG_TYPES[fType]||MSG_TYPES.info).bg:C.greyBg,border:`1px solid ${(MSG_TYPES[fType]||MSG_TYPES.info).color+"44"}`,padding:14}}>
                  <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                    <span style={{fontSize:18}}>{(MSG_TYPES[fType]||MSG_TYPES.info).icon}</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:C.black,marginBottom:4}}>{fTitle||"(brak tytułu)"}</div>
                      <div style={{fontSize:12,color:C.greyDk,lineHeight:1.6}}>{fBody||"(brak treści)"}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {formErr && <div style={{color:C.red,fontSize:12}}>{formErr}</div>}
            <button onClick={sendMessage} disabled={saving}
              style={{background:saving?C.greyDk:C.black,border:"none",color:C.white,padding:12,fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>
              {saving ? "Wysyłanie..." : "Wyślij wiadomość"}
            </button>
          </div>
        )}
      </div>

      <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:C.greyDk,textTransform:"uppercase",padding:"4px 2px"}}>Wszystkie wiadomości ({messages.length})</div>
      {messages.length === 0 && <div style={{background:C.white,padding:24,textAlign:"center",color:C.greyMid,fontSize:13}}>Brak wiadomości</div>}
      {messages.map(m => {
        const mt = MSG_TYPES[m.type] || MSG_TYPES.info;
        return (
          <div key={m.id} style={{background:m.pinned?mt.bg:C.white,border:`1px solid ${m.pinned?mt.color+"44":"rgba(0,0,0,.06)"}`,padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:16}}>{mt.icon}</span>
                <span style={{fontSize:13,fontWeight:700,color:C.black}}>{m.title}</span>
                {m.pinned && <span style={{fontSize:9,fontWeight:700,color:mt.color,background:`${mt.color}22`,padding:"2px 6px",letterSpacing:1}}>PRZYPIĘTE</span>}
              </div>
              <button onClick={() => deleteMessage(m.id)} disabled={deleting===m.id}
                style={{background:"none",border:`1px solid ${C.red}`,color:C.red,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer",flexShrink:0}}>
                {deleting===m.id ? "..." : "🗑 Usuń"}
              </button>
            </div>
            <div style={{fontSize:12,color:C.greyDk,lineHeight:1.6,marginBottom:6}}>{m.body}</div>
            <div style={{fontSize:10,color:C.greyMid}}>{formatDate(m.created_at)}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Admin: Edytor szkoleń ── */
export function AdminTrainings({ token }) {
  const [trainings, setTrainings] = useState(() => JSON.parse(JSON.stringify(TRAININGS)));
  const [editId,    setEditId]    = useState(null);
  const [editData,  setEditData]  = useState({});
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("all");

  useEffect(() => {
    db.get(token, "training_overrides", "select=*")
      .then(overrides => {
        if (overrides.length) {
          setTrainings(TRAININGS.map(t => {
            const ov = overrides.find(o => o.training_id === t.id);
            return ov ? { ...t, title:ov.title||t.title, desc:ov.description||t.desc, duration:ov.duration||t.duration, level:ov.level||t.level } : t;
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function startEdit(t) {
    setEditId(t.id);
    setEditData({ title:t.title, desc:t.desc, duration:t.duration, level:t.level });
  }

  async function saveEdit(id) {
    setSaving(true);
    try {
      const h = { ...authHeaders(token), "Prefer":"resolution=merge-duplicates,return=representation" };
      const r = await fetch(`${SB_URL}/rest/v1/training_overrides`, {
        method: "POST", headers: h,
        body: JSON.stringify({ training_id:id, title:editData.title, description:editData.desc, duration:editData.duration, level:editData.level, updated_at: new Date().toISOString() })
      });
      if (!r.ok) throw new Error(await r.text());
      setTrainings(p => p.map(t => t.id===id ? {...t, ...editData} : t));
      const globalT = TRAININGS.find(t => t.id===id);
      if (globalT) { globalT.title=editData.title; globalT.desc=editData.desc; globalT.duration=editData.duration; globalT.level=editData.level; }
      setEditId(null); setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch(e) {
      alert("Błąd zapisu: " + e.message);
    } finally { setSaving(false); }
  }

  function cancelEdit() { setEditId(null); setEditData({}); }

  const list = filter==="all" ? trainings : trainings.filter(t => t.group===filter);

  if (loading) return <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner/></div>;

  return (
    <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{background:C.white,padding:"12px 16px",borderTop:`3px solid ${C.green}`}}>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:C.greyDk,marginBottom:12,textTransform:"uppercase"}}>Edytor szkoleń</div>
        {saved && <div style={{color:C.greenDk,fontSize:12,marginBottom:8,fontWeight:600}}>✓ Zmiany zapisane — widoczne dla wszystkich użytkowników</div>}
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[["all","Wszystkie"],...GROUPS.map(g=>[g.id,g.label])].map(([id,label]) => (
            <button key={id} onClick={() => setFilter(id)}
              style={{padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${filter===id?C.black:C.grey}`,background:filter===id?C.black:C.white,color:filter===id?C.white:C.greyDk}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {list.map(t => {
        const grp = GROUPS.find(g => g.id===t.group);
        const isEditing = editId === t.id;
        const orig = TRAININGS.find(o => o.id===t.id);
        const isModified = orig && (orig.title !== t.title || orig.desc !== t.desc);
        return (
          <div key={t.id} style={{background:C.white,border:`1px solid ${isEditing?C.green:"rgba(0,0,0,.06)"}`,boxShadow:"0 1px 3px rgba(0,0,0,.06)"}}>
            <div style={{borderLeft:`4px solid ${grp?.color||C.grey}`,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                    <span style={{fontSize:10,fontWeight:700,color:C.greyMid,letterSpacing:1}}>{t.id} · {grp?.label}</span>
                    {isModified && <span style={{fontSize:9,fontWeight:700,color:C.amber,background:"#FEF3E2",padding:"1px 6px"}}>EDYTOWANE</span>}
                  </div>
                  {isEditing ? (
                    <input style={{width:"100%",border:`1.5px solid ${C.green}`,padding:"6px 10px",fontSize:14,fontWeight:700,color:C.black,outline:"none",boxSizing:"border-box",marginBottom:8}}
                      value={editData.title} onChange={e => setEditData(p=>({...p,title:e.target.value}))}/>
                  ) : (
                    <div style={{fontSize:13,fontWeight:700,color:C.black,lineHeight:1.3,marginBottom:4}}>{t.title}</div>
                  )}
                  <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                    {isEditing ? (
                      <>
                        <select value={editData.level} onChange={e => setEditData(p=>({...p,level:Number(e.target.value)}))}
                          style={{border:`1px solid ${C.grey}`,padding:"4px 8px",fontSize:11,color:C.black,background:C.white}}>
                          {[1,2,3].map(l => <option key={l} value={l}>{LVL_LABEL[l]}</option>)}
                        </select>
                        <input value={editData.duration} onChange={e => setEditData(p=>({...p,duration:e.target.value}))}
                          placeholder="czas trwania"
                          style={{border:`1px solid ${C.grey}`,padding:"4px 8px",fontSize:11,color:C.black,width:90}}/>
                      </>
                    ) : (
                      <>
                        <span style={{fontSize:11,color:LVL_COLOR[t.level],fontWeight:600}}>{LVL_LABEL[t.level]}</span>
                        <span style={{fontSize:11,color:C.greyMid}}>📅 {t.duration}</span>
                      </>
                    )}
                  </div>
                </div>
                {!isEditing && (
                  <button onClick={() => startEdit(t)}
                    style={{background:"none",border:`1px solid ${C.grey}`,color:C.greyDk,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer",flexShrink:0}}>
                    ✏️ Edytuj
                  </button>
                )}
              </div>

              {isEditing && (
                <div style={{marginTop:8}}>
                  <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:5,letterSpacing:.5}}>OPIS SZKOLENIA</label>
                  <textarea value={editData.desc} onChange={e => setEditData(p=>({...p,desc:e.target.value}))}
                    style={{width:"100%",border:`1.5px solid ${C.grey}`,padding:"9px 12px",fontSize:12,color:C.black,outline:"none",boxSizing:"border-box",minHeight:110,resize:"vertical",fontFamily:"inherit",lineHeight:1.6}}/>
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    <button onClick={() => saveEdit(t.id)} disabled={saving}
                      style={{flex:1,background:saving?C.greyDk:C.greenDk,border:"none",color:C.white,padding:10,fontSize:12,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>
                      {saving?"Zapisywanie...":"✓ Zapisz dla wszystkich"}
                    </button>
                    <button onClick={cancelEdit}
                      style={{flex:1,background:"none",border:`1px solid ${C.grey}`,color:C.greyDk,padding:10,fontSize:12,fontWeight:600,cursor:"pointer"}}>
                      Anuluj
                    </button>
                  </div>
                </div>
              )}

              {!isEditing && (
                <div style={{fontSize:12,color:C.greyDk,lineHeight:1.6,marginTop:4}}>{t.desc.length>120?t.desc.slice(0,120)+"…":t.desc}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Admin: Terminarz (FullCalendar Planner) ── */
const MONTHS_PL = ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec",
                   "Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];
const TIMELINE_TRAINERS = [1,2,3,4];

function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function parseDays(durationStr) {
  const m = String(durationStr || "1").match(/(\d+)/);
  return m ? parseInt(m[1]) : 1;
}

function addDays(isoDate, n) {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function AdminSchedule({ token }) {
  const now = new Date();
  const [scheduled,    setScheduled]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [msg,          setMsg]          = useState(null);
  const [showForm,     setShowForm]     = useState(false);

  // Form state
  const [selDate,      setSelDate]      = useState(toISO(now));
  const [selTrainer,   setSelTrainer]   = useState(null);
  const [trainingMode, setTrainingMode] = useState("normal");
  const [selGroup,     setSelGroup]     = useState(GROUPS[0].id);
  const [selTraining,  setSelTraining]  = useState(TRAININGS.find(t=>t.group===GROUPS[0].id)?.id || TRAININGS[0].id);
  const [stName,       setStName]       = useState("");
  const [stDays,       setStDays]       = useState(2);

  // Calendar nav
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  useEffect(() => { loadScheduled(); }, []);

  async function loadScheduled() {
    setLoading(true);
    try {
      const data = await db.get(token, "scheduled_trainings", "order=date.asc&select=*");
      setScheduled(Array.isArray(data) ? data : []);
    } catch { setScheduled([]); }
    setLoading(false);
  }

  const groupTrainings = TRAININGS.filter(t => t.group === selGroup);
  useEffect(() => {
    const first = TRAININGS.find(t => t.group === selGroup);
    if (first) setSelTraining(first.id);
  }, [selGroup]);

  const previewDays = trainingMode === "ST"
    ? stDays
    : parseDays(TRAININGS.find(t => t.id === selTraining)?.duration);
  const previewEndDate = addDays(selDate, previewDays - 1);

  async function addEntry() {
    if (!selDate || !selTrainer) return;
    if (trainingMode === "ST" && !stName.trim()) {
      setMsg({ ok: false, text: "Wpisz nazwę szkolenia ST" }); return;
    }
    setSaving(true); setMsg(null);
    try {
      const days = trainingMode === "ST" ? stDays : parseDays(TRAININGS.find(t=>t.id===selTraining)?.duration);
      const endDate = addDays(selDate, days - 1);
      const payload = {
        date: selDate,
        room: "-",
        training_id: trainingMode === "ST" ? "ST" : selTraining,
        trainer_id: selTrainer,
        end_date: endDate,
        custom_name: trainingMode === "ST" ? stName.trim() : null,
        duration_days: days,
      };
      await db.insert(token, "scheduled_trainings", payload);
      setMsg({ ok: true, text: "✓ Dodano szkolenie do planerza!" });
      setShowForm(false);
      await loadScheduled();
    } catch(e) {
      setMsg({ ok: false, text: "Błąd zapisu: " + e.message });
    }
    setSaving(false);
  }

  async function deleteEntry(id) {
    if (!window.confirm("Usunąć to szkolenie z terminarza?")) return;
    try {
      await db.remove(token, "scheduled_trainings", `id=eq.${id}`);
      setScheduled(s => s.filter(x => x.id !== id));
    } catch(e) { alert("Błąd usuwania: " + e.message); }
  }


  // ── Własny timeline (zamiana za FullCalendar resource-timeline) ──
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthISO = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}`;

  // Dla każdej sali zbuduj listę eventów na aktualny miesiąc
  const timelineData = useMemo(() => {
    const allEntries = [...scheduled];
    if (showForm && selDate) {
      const isST = trainingMode === "ST";
      const training = isST ? null : TRAININGS.find(t => t.id === selTraining);
      const grp = GROUPS.find(g => g.id === training?.group);
      const color = isST ? "#8E44AD" : (grp?.color || "#2980B9");
      const title = isST ? (stName || "ST") : (training?.short || "?");
      allEntries.push({
        id: "__preview__",
        date: selDate,
        end_date: previewEndDate,
        training_id: isST ? "ST" : selTraining,
        trainer_id: selTrainer,
        custom_name: isST ? (stName||"ST") : null,
        __preview: true,
        __color: color,
        __title: title,
      });
    }
    return TIMELINE_TRAINERS.map(trainerId => {
      const roomEntries = allEntries.filter(s => Number(s.trainer_id) === trainerId);
      const bars = roomEntries.map(s => {
        const isST = s.training_id === "ST";
        const training = isST ? null : TRAININGS.find(t => t.id === s.training_id);
        const grp = GROUPS.find(g => g.id === training?.group);
        const color = s.__color || (isST ? "#8E44AD" : (grp?.color || "#2980B9"));
        const title = s.__title || (isST ? (s.custom_name||"ST") : (training?.short || s.training_id));
        const startISO = s.date || "";
        const endISO   = s.end_date || s.date || "";

        if (!startISO) return null;

        // Pomija jeśli szkolenie jest całkowicie poza bieżącym miesiącem
        const monthStart = monthISO + "-01";
        const monthEnd   = monthISO + "-" + String(daysInMonth).padStart(2,"0");
        if (endISO < monthStart || startISO > monthEnd) return null;

        // Obetnij do granic miesiąca
        const clippedStart = startISO < monthStart ? monthStart : startISO;
        const clippedEnd   = endISO   > monthEnd   ? monthEnd   : endISO;

        const startDay = parseInt(clippedStart.slice(8)) || 1;
        const endDay   = parseInt(clippedEnd.slice(8))   || daysInMonth;

        if (isNaN(startDay) || isNaN(endDay) || startDay > endDay) return null;

        return { startDay, endDay, color, title, trainerId: s.trainer_id, id: s.id, isPreview: !!s.__preview };
      }).filter(Boolean);
      return { trainerId, bars };
    });
  }, [scheduled, viewYear, viewMonth, showForm, selDate, selTraining, trainingMode, stName, previewEndDate, selTrainer]);

  const todayISO = toISO(now);
  const listToShow = scheduled.filter(s => (s.end_date || s.date) >= todayISO).slice(0, 20);

  return (
    <div style={{background:C.greyBg,padding:"12px",display:"flex",flexDirection:"column",gap:12}}>
      {/* ── Własny Timeline ── */}
      <div style={{background:C.white,borderRadius:8,boxShadow:"0 1px 4px rgba(0,0,0,.1)"}}>
        {/* Nawigacja miesiąca */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 10px",borderBottom:`1px solid ${C.grey}`}}>
          <button onClick={()=>{if(viewMonth===0){setViewYear(y=>y-1);setViewMonth(11);}else setViewMonth(m=>m-1);}}
            style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.greyDk,padding:"4px 10px",lineHeight:1}}>‹</button>
          <span style={{fontSize:13,fontWeight:700,color:C.black}}>{MONTHS_PL[viewMonth]} {viewYear}</span>
          <button onClick={()=>{if(viewMonth===11){setViewYear(y=>y+1);setViewMonth(0);}else setViewMonth(m=>m+1);}}
            style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.greyDk,padding:"4px 10px",lineHeight:1}}>›</button>
        </div>

        {/* Siatka — przewijalna poziomo, czyste divy (bez <table>) */}
        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <div style={{display:"inline-block",minWidth:"100%",verticalAlign:"top"}}>

            {/* Wiersz nagłówka z numerami dni */}
            <div style={{display:"flex",borderBottom:`2px solid ${C.grey}`}}>
              <div style={{width:46,minWidth:46,flexShrink:0,background:"#f7f7f7",borderRight:`1px solid ${C.grey}`,fontSize:9,fontWeight:700,color:C.greyMid,display:"flex",alignItems:"center",justifyContent:"center",height:22}}>
                T
              </div>
              <div style={{display:"flex",flex:1}}>
                {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>{
                  const iso=`${monthISO}-${String(d).padStart(2,"0")}`;
                  const isToday=iso===todayISO;
                  const dow=new Date(iso+"T12:00:00").getDay(); // 0=nd,6=sob
                  const isWeekend=dow===0||dow===6;
                  return (
                    <div key={d} style={{width:20,minWidth:20,flexShrink:0,height:22,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:isToday?700:400,color:isToday?C.greenDk:isWeekend?"#aaa":C.greyMid,background:isToday?C.greenBg:isWeekend?"#e8e8e8":"transparent",borderRight:"1px solid #efefef",boxSizing:"border-box"}}>
                      {d}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Wiersze sal */}
            {TIMELINE_TRAINERS.map(tid=>{
              const roomBars=(timelineData.find(r=>r.trainerId===tid)||{bars:[]}).bars;
              return (
                <div key={tid} style={{display:"flex",borderBottom:`1px solid ${C.grey}`}}>
                  {/* Etykieta trenera */}
                  <div style={{width:46,minWidth:46,flexShrink:0,background:"#f7f7f7",borderRight:`1px solid ${C.grey}`,fontSize:9,fontWeight:700,color:C.greyDk,display:"flex",alignItems:"center",justifyContent:"center",height:30}}>
                    T{tid}
                  </div>
                  {/* Obszar z paskami — position:relative na div, nie na td */}
                  <div style={{position:"relative",height:30,flex:1,minWidth:daysInMonth*20}}>
                    {/* Tło kolumn — weekendy szare, dziś zielone */}
                    {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>{
                      const iso=`${monthISO}-${String(d).padStart(2,"0")}`;
                      const isToday=iso===todayISO;
                      const dow=new Date(iso+"T12:00:00").getDay();
                      const isWeekend=dow===0||dow===6;
                      if(!isToday&&!isWeekend) return null;
                      return <div key={d} style={{position:"absolute",left:(d-1)*20,top:0,width:20,height:"100%",background:isToday?"rgba(138,183,62,.12)":"rgba(0,0,0,.05)",pointerEvents:"none",zIndex:0}}/>;
                    })}
                    {/* Pionowe linie */}
                    {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>(
                      <div key={d} style={{position:"absolute",left:d*20,top:0,width:1,height:"100%",background:"#efefef",pointerEvents:"none",zIndex:0}}/>
                    ))}
                    {/* Paski szkoleń */}
                    {roomBars.map((bar,bi)=>{
                      const left=(bar.startDay-1)*20;
                      const width=Math.max(18,(bar.endDay-bar.startDay+1)*20-2);
                      return (
                        <div key={bi}
                          onClick={()=>{ if(!bar.isPreview&&window.confirm(`Usunąć "${bar.title}"?`)) deleteEntry(bar.id); }}
                          title={bar.title}
                          style={{
                            position:"absolute",left,top:4,height:22,width,zIndex:2,
                            background:bar.isPreview?bar.color+"99":bar.color,
                            borderRadius:3,display:"flex",alignItems:"center",
                            padding:"0 3px",gap:2,
                            cursor:bar.isPreview?"default":"pointer",
                            overflow:"hidden",boxSizing:"border-box",
                            border:bar.isPreview?`1px dashed ${bar.color}`:"none",
                          }}>
                          <span style={{fontSize:8,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flex:1,fontStyle:bar.isPreview?"italic":"normal"}}>
                            {bar.title}
                          </span>
                          {bar.trainerId&&(
                            <span style={{flexShrink:0,background:"rgba(0,0,0,.35)",borderRadius:"50%",width:12,height:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#fff",lineHeight:"12px",fontWeight:700}}>
                              {bar.trainerId}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{padding:"5px 10px",fontSize:10,color:C.greyMid,borderTop:`1px solid ${C.grey}`}}>
          💡 Dotknij paska → usuń &nbsp;·&nbsp; ● = nr trenera
        </div>
      </div>

      {/* ── Przycisk Dodaj ── */}
      <button onClick={() => { setShowForm(p=>!p); setMsg(null); }}
        style={{background:showForm?C.greyDk:C.black,color:C.white,border:"none",padding:"13px 0",fontSize:13,fontWeight:700,cursor:"pointer",borderRadius:6,letterSpacing:.5}}>
        {showForm ? "✕ Anuluj" : "+ Dodaj szkolenie"}
      </button>

      {msg && (
        <div style={{padding:"10px 14px",borderRadius:6,background:msg.ok?"#E8F8E8":"#FDEDEC",color:msg.ok?C.greenDk:C.red,fontSize:13,fontWeight:600}}>
          {msg.text}
        </div>
      )}

      {/* ── Formularz ── */}
      {showForm && (
        <div style={{background:C.white,borderRadius:8,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,.1)",display:"flex",flexDirection:"column",gap:14}}>

          {/* DATA */}
          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.greyMid,letterSpacing:1,marginBottom:8,textTransform:"uppercase"}}>Data rozpoczęcia</div>
            <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)}
              style={{width:"100%",padding:"10px 12px",border:`1.5px solid ${C.green}`,borderRadius:6,fontSize:14,color:C.black,background:C.white,boxSizing:"border-box"}}/>
            {selDate && previewDays > 0 && (
              <div style={{fontSize:11,color:C.greyMid,marginTop:5}}>
                📅 Szkolenie trwa <strong>{previewDays} {previewDays===1?"dzień":"dni"}</strong> — do <strong>{previewEndDate}</strong>
              </div>
            )}
          </div>



          {/* TRENER */}
          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.greyMid,letterSpacing:1,marginBottom:8,textTransform:"uppercase"}}>Trener</div>
            <div style={{display:"flex",gap:8}}>
              {[1,2,3,4,5].map(n=>(
                <button key={n} onClick={()=>setSelTrainer(n)}
                  style={{flex:1,padding:"10px 0",background:selTrainer===n?C.green:C.white,color:selTrainer===n?C.white:C.greyDk,border:`1.5px solid ${selTrainer===n?C.green:C.grey}`,borderRadius:6,fontSize:16,fontWeight:700,cursor:"pointer",transition:"all .15s"}}>
                  {n}
                </button>
              ))}
            </div>
            {selTrainer && (
              <div style={{fontSize:11,color:C.greyMid,marginTop:5}}>
                👤 {TRAINERS[selTrainer]}
              </div>
            )}
          </div>

          {/* TYP SZKOLENIA */}
          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.greyMid,letterSpacing:1,marginBottom:8,textTransform:"uppercase"}}>Rodzaj szkolenia</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {GROUPS.map(g=>(
                <button key={g.id} onClick={()=>{ setTrainingMode("normal"); setSelGroup(g.id); }}
                  style={{padding:"7px 14px",background:trainingMode==="normal"&&selGroup===g.id?g.color:"transparent",color:trainingMode==="normal"&&selGroup===g.id?C.white:g.color,border:`1.5px solid ${g.color}`,borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer"}}>
                  {g.label}
                </button>
              ))}
              <button onClick={()=>setTrainingMode("ST")}
                style={{padding:"7px 14px",background:trainingMode==="ST"?"#8E44AD":"transparent",color:trainingMode==="ST"?C.white:"#8E44AD",border:"1.5px solid #8E44AD",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer"}}>
                ⭐ ST
              </button>
            </div>
          </div>

          {/* SZKOLENIE — normalne */}
          {trainingMode === "normal" && (
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.greyMid,letterSpacing:1,marginBottom:8,textTransform:"uppercase"}}>Szkolenie</div>
              <select value={selTraining} onChange={e=>setSelTraining(e.target.value)}
                style={{width:"100%",padding:"10px 12px",border:`1.5px solid ${C.grey}`,borderRadius:6,fontSize:13,color:C.black,background:C.white,boxSizing:"border-box"}}>
                {groupTrainings.map(t=>(
                  <option key={t.id} value={t.id}>{t.short} — {t.title}</option>
                ))}
              </select>
              <div style={{fontSize:11,color:C.greyMid,marginTop:5}}>
                📅 Czas trwania: <strong>{TRAININGS.find(t=>t.id===selTraining)?.duration || "—"}</strong>
              </div>
            </div>
          )}

          {/* SZKOLENIE — ST specjalne */}
          {trainingMode === "ST" && (
            <div style={{display:"flex",flexDirection:"column",gap:12,background:"#F9F0FF",border:"1px solid rgba(142,68,173,.25)",borderRadius:8,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,color:"#8E44AD",letterSpacing:1}}>⭐ SZKOLENIE SPECJALNE (ST)</div>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:6,textTransform:"uppercase"}}>Nazwa szkolenia</label>
                <input value={stName} onChange={e=>setStName(e.target.value)}
                  placeholder="Wpisz nazwę szkolenia…"
                  style={{width:"100%",padding:"10px 12px",border:"1.5px solid #8E44AD",borderRadius:6,fontSize:13,color:C.black,background:C.white,boxSizing:"border-box"}}/>
              </div>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:6,textTransform:"uppercase"}}>Czas trwania (dni)</label>
                <div style={{display:"flex",gap:8}}>
                  {[1,2,3,4,5].map(d=>(
                    <button key={d} onClick={()=>setStDays(d)}
                      style={{flex:1,padding:"10px 0",background:stDays===d?"#8E44AD":C.white,color:stDays===d?C.white:C.greyDk,border:`1.5px solid ${stDays===d?"#8E44AD":C.grey}`,borderRadius:6,fontSize:15,fontWeight:700,cursor:"pointer"}}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Zapisz */}
          <button onClick={addEntry} disabled={saving}
            style={{width:"100%",background:saving?C.greyDk:C.black,color:C.white,border:"none",padding:14,fontSize:13,fontWeight:700,borderRadius:6,cursor:saving?"not-allowed":"pointer",letterSpacing:.5}}>
            {saving ? "Zapisywanie…" : "✓ Dodaj do planerza"}
          </button>
        </div>
      )}

      {/* ── Lista nadchodzących ── */}
      {!loading && (
        <div style={{background:C.white,borderRadius:8,padding:14,boxShadow:"0 1px 3px rgba(0,0,0,.07)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
            <div style={{fontSize:11,fontWeight:700,color:C.greyMid,letterSpacing:1,textTransform:"uppercase"}}>
              Nadchodzące szkolenia ({listToShow.length})
            </div>
            {scheduled.length > 0 && (
              <button onClick={() => {
                const now = new Date().toISOString().replace(/[-:.]/g,"").slice(0,15)+"Z";
                const events = scheduled.map(s => {
                  const isST = s.training_id === "ST";
                  const t = isST ? null : TRAININGS.find(x=>x.id===s.training_id);
                  const title = isST ? (s.custom_name||"ST") : (t?.title||s.training_id);
                  const startDate = (s.date||"").replace(/-/g,"");
                  const endDate = ((s.end_date||s.date)||"").replace(/-/g,"");
                  return [
                    "BEGIN:VEVENT",
                    `UID:${s.id}-${startDate}@engel-academy`,
                    `DTSTAMP:${now}`,
                    `DTSTART;VALUE=DATE:${startDate}`,
                    `DTEND;VALUE=DATE:${endDate}`,
                    `SUMMARY:${title}`,
                    s.trainer_id ? `DESCRIPTION:Trener: ${TRAINERS[s.trainer_id]||s.trainer_id}` : "DESCRIPTION:ENGEL Expert Academy",
                    "END:VEVENT"
                  ].join("\r\n");
                }).join("\r\n");
                const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//ENGEL Expert Academy//PL\r\n${events}\r\nEND:VCALENDAR`;
                const blob = new Blob([ics],{type:"text/calendar;charset=utf-8"});
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href=url; a.download="terminarz-engel.ics"; a.click();
                URL.revokeObjectURL(url);
              }}
                style={{fontSize:11,fontWeight:700,padding:"5px 10px",background:C.black,color:C.white,border:"none",borderRadius:4,cursor:"pointer"}}>
                📅 Eksportuj .ics
              </button>
            )}
          </div>
          {listToShow.length === 0 && (
            <div style={{textAlign:"center",padding:20,color:C.greyMid,fontSize:13}}>Brak nadchodzących szkoleń</div>
          )}
          {listToShow.map(s => {
            const isST = s.training_id === "ST";
            const t = isST ? null : TRAININGS.find(x=>x.id===s.training_id);
            const grp = GROUPS.find(g=>g.id===t?.group);
            const barColor = isST ? "#8E44AD" : (grp?.color || C.grey);
            return (
              <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.grey}`}}>
                <div style={{width:4,alignSelf:"stretch",background:barColor,borderRadius:2,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.black,marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                    {isST ? (s.custom_name || "ST") : (t?.title || s.training_id)}
                  </div>
                  <div style={{fontSize:11,color:C.greyMid,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                    <span>{s.date}{s.end_date&&s.end_date!==s.date?` → ${s.end_date}`:""}</span>
                    {s.trainer_id && <span>· <strong style={{color:C.black}}>T{s.trainer_id}</strong> {TRAINERS[s.trainer_id]}</span>}
                    {grp && !isST && <span style={{color:grp.color,fontWeight:600}}>· {grp.label}</span>}
                    {isST && <span style={{color:"#8E44AD",fontWeight:600}}>· ST</span>}
                  </div>
                </div>
                <button onClick={()=>deleteEntry(s.id)}
                  style={{background:"none",border:"none",color:C.red,fontSize:20,cursor:"pointer",padding:"0 4px",flexShrink:0,lineHeight:1}}>
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}