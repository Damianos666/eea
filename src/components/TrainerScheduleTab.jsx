import { useState, useEffect, useMemo, useRef } from "react";
import { C, GROUPS, TRAINERS } from "../lib/constants";
import { TRAININGS } from "../data/trainings";
import { db } from "../lib/supabase";

const MONTHS_PL = ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec",
                   "Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];
const ALL_TRAINERS = [1,2,3,4,5];
const LS_KEY = "eea_active_trainers";

function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function loadActiveTrainers(trainerNum) {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved !== null) return JSON.parse(saved);
  } catch {}
  return trainerNum != null ? [Number(trainerNum)] : ALL_TRAINERS;
}

export function TrainerScheduleTab({ token, trainerNum }) {
  const now = new Date();
  const [scheduled,   setScheduled]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [viewYear,    setViewYear]    = useState(now.getFullYear());
  const [viewMonth,   setViewMonth]   = useState(now.getMonth());
  const [notesModal,  setNotesModal]  = useState(null); // { title, notes, participants }
  const [activeTrainers, setActiveTrainers] = useState(() => loadActiveTrainers(trainerNum));

  function toggleTrainer(n) {
    setActiveTrainers(prev => {
      const next = prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n];
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const timelineRef = useRef(null);
  const pressTimers = useRef({});

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthISO    = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}`;
  const todayISO    = toISO(now);

  const [cellW, setCellW] = useState(20);

  useEffect(() => {
    if (!timelineRef.current) return;
    function recalc() {
      if (!timelineRef.current) return;
      const available = timelineRef.current.clientWidth - 46;
      const natural = daysInMonth * 20;
      setCellW(available > natural ? available / daysInMonth : 20);
    }
    const ro = new ResizeObserver(() => recalc());
    ro.observe(timelineRef.current);
    function onOrient() { setTimeout(recalc, 50); setTimeout(recalc, 150); setTimeout(recalc, 400); }
    window.addEventListener("orientationchange", onOrient);
    window.addEventListener("resize", recalc);
    recalc();
    return () => { ro.disconnect(); window.removeEventListener("orientationchange", onOrient); window.removeEventListener("resize", recalc); };
  }, [daysInMonth, viewYear, viewMonth]);

  // Scroll today to 1/4
  useEffect(() => {
    if (!timelineRef.current) return;
    const today = new Date();
    if (today.getFullYear() !== viewYear || today.getMonth() !== viewMonth) return;
    const todayLeft = 46 + (today.getDate() - 1) * cellW;
    const scrollTo = todayLeft - timelineRef.current.clientWidth / 4;
    timelineRef.current.scrollLeft = Math.max(0, scrollTo);
  }, [viewYear, viewMonth, loading, cellW]);

  useEffect(() => {
    setLoading(true);
    db.get(token, "scheduled_trainings", "order=date.asc&select=*")
      .then(data => setScheduled(Array.isArray(data) ? data : []))
      .catch(() => setScheduled([]))
      .finally(() => setLoading(false));
  }, [token]);

  // Long press handlers
  function handlePressStart(entry, e) {
    if (e.type === "touchstart") e.preventDefault();
    pressTimers.current[entry.id] = setTimeout(() => {
      delete pressTimers.current[entry.id];
      const isST = entry.training_id === "ST";
      const t = isST ? null : TRAININGS.find(x => x.id === entry.training_id);
      const title = isST ? (entry.custom_name || "ST") : (t?.title || entry.training_id);
      setNotesModal({
        title,
        notes: entry.notes || "",
        participants: entry.participants_count,
        date: entry.date,
        endDate: entry.end_date,
        trainer: entry.trainer_id,
      });
    }, 650);
  }

  function handlePressEnd(id) {
    if (pressTimers.current[id]) {
      clearTimeout(pressTimers.current[id]);
      delete pressTimers.current[id];
    }
  }

  // Build timeline bars
  const timelineData = useMemo(() => {
    const trainersToShow = activeTrainers.length > 0 ? activeTrainers : ALL_TRAINERS;
    return trainersToShow.map(trainerId => {
      const entries = scheduled.filter(s => Number(s.trainer_id) === trainerId);
      const bars = entries.map(s => {
        const isST = s.training_id === "ST";
        const training = isST ? null : TRAININGS.find(t => t.id === s.training_id);
        const grp = GROUPS.find(g => g.id === training?.group);
        const isPlanned = (s.status || "active") === "planned";
        const baseColor = isST ? "#8E44AD" : (grp?.color || "#2980B9");
        const color = isPlanned ? "#BBBBBB" : baseColor;
        const title = isST ? (s.custom_name || "ST") : (training?.short || s.training_id);
        const startISO = s.date || "";
        const endISO   = s.end_date || s.date || "";
        if (!startISO) return null;
        const monthStart = monthISO + "-01";
        const monthEnd   = monthISO + "-" + String(daysInMonth).padStart(2,"0");
        if (endISO < monthStart || startISO > monthEnd) return null;
        const clippedStart = startISO < monthStart ? monthStart : startISO;
        const clippedEnd   = endISO   > monthEnd   ? monthEnd   : endISO;
        const startDay = parseInt(clippedStart.slice(8)) || 1;
        const endDay   = parseInt(clippedEnd.slice(8))   || daysInMonth;
        if (isNaN(startDay) || isNaN(endDay) || startDay > endDay) return null;
        return { startDay, endDay, color, title, id: s.id, isPlanned,
                 isHidden: s.is_hidden || false,
                 isOutgoing: s.is_outgoing || false,
                 participantsCount: s.participants_count, entry: s };
      }).filter(Boolean);
      return { trainerId, bars };
    });
  }, [scheduled, viewYear, viewMonth, daysInMonth, monthISO, activeTrainers]);

  return (
    <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",background:C.greyBg,display:"flex",flexDirection:"column"}}>

      {/* Timeline */}
      <div style={{background:C.white,margin:"12px 12px 0",borderRadius:8,boxShadow:"0 1px 4px rgba(0,0,0,.1)"}}>

        {/* Nawigacja miesiąca */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 10px",borderBottom:`1px solid ${C.grey}`}}>
          <button onClick={()=>{if(viewMonth===0){setViewYear(y=>y-1);setViewMonth(11);}else setViewMonth(m=>m-1);}}
            style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.greyDk,padding:"4px 10px",lineHeight:1}}>‹</button>
          <span style={{fontSize:13,fontWeight:700,color:C.black}}>{MONTHS_PL[viewMonth]} {viewYear}</span>
          <button onClick={()=>{if(viewMonth===11){setViewYear(y=>y+1);setViewMonth(0);}else setViewMonth(m=>m+1);}}
            style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.greyDk,padding:"4px 10px",lineHeight:1}}>›</button>
        </div>

        <div ref={timelineRef} style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <div style={{display:"inline-block",minWidth:"100%",verticalAlign:"top"}}>

            {/* Nagłówek dni */}
            <div style={{display:"flex",borderBottom:`2px solid ${C.grey}`}}>
              <div style={{width:46,minWidth:46,flexShrink:0,background:"#f7f7f7",borderRight:`1px solid ${C.grey}`,fontSize:9,fontWeight:700,color:C.greyMid,display:"flex",alignItems:"center",justifyContent:"center",height:22}}>T</div>
              <div style={{display:"flex",flex:1}}>
                {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>{
                  const iso=`${monthISO}-${String(d).padStart(2,"0")}`;
                  const isToday=iso===todayISO;
                  const isWe=new Date(iso+"T12:00:00").getDay()%6===0;
                  return (
                    <div key={d} style={{width:cellW,minWidth:cellW,flexShrink:0,height:22,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:isToday?700:400,color:isToday?C.greenDk:isWe?"#aaa":C.greyMid,background:isToday?C.greenBg:isWe?"#e8e8e8":"transparent",borderRight:"1px solid #efefef",boxSizing:"border-box"}}>
                      {d}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Wiersze trenerów */}
            {timelineData.map(({trainerId, bars}) => (
              <div key={trainerId} style={{display:"flex",borderBottom:`1px solid ${C.grey}`}}>
                <div style={{width:46,minWidth:46,flexShrink:0,background:"#f7f7f7",borderRight:`1px solid ${C.grey}`,fontSize:9,fontWeight:700,color:C.greyDk,display:"flex",alignItems:"center",justifyContent:"center",height:30}}>T{trainerId}</div>
                <div style={{position:"relative",height:30,flex:1,minWidth:daysInMonth*cellW}}>
                  {/* Tło dni */}
                  {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>{
                    const iso=`${monthISO}-${String(d).padStart(2,"0")}`;
                    const isToday=iso===todayISO;
                    const isWe=new Date(iso+"T12:00:00").getDay()%6===0;
                    return <div key={d} style={{position:"absolute",left:(d-1)*cellW,top:0,width:cellW,height:"100%",background:isToday?"rgba(138,183,62,.12)":isWe?"rgba(0,0,0,.05)":"transparent",pointerEvents:"none"}}/>;
                  })}
                  {/* Linie pionowe */}
                  {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>(
                    <div key={d} style={{position:"absolute",left:d*cellW,top:0,width:1,height:"100%",background:"#efefef",pointerEvents:"none"}}/>
                  ))}
                  {/* Paski */}
                  {bars.map((bar, bi) => {
                    const w = Math.max(cellW-2, (bar.endDay-bar.startDay+1)*cellW-2);
                    return (
                      <div key={bi}
                        onMouseDown={e => handlePressStart(bar.entry, e)}
                        onMouseUp={() => handlePressEnd(bar.id)}
                        onMouseLeave={() => handlePressEnd(bar.id)}
                        onTouchStart={e => handlePressStart(bar.entry, e)}
                        onTouchEnd={() => handlePressEnd(bar.id)}
                        onTouchMove={() => handlePressEnd(bar.id)}
                        onContextMenu={e => e.preventDefault()}
                        title="Przytrzymaj → notatki"
                        style={{
                          position:"absolute",left:(bar.startDay-1)*cellW,top:4,height:22,width:w,zIndex:2,
                          background:bar.color,borderRadius:3,display:"flex",alignItems:"center",
                          padding:"0 3px",gap:2,cursor:"pointer",overflow:"hidden",boxSizing:"border-box",
                          opacity:bar.isPlanned?0.75:1,
                          border:bar.isHidden?"1px solid rgba(0,0,0,.35)":"none",
                        }}>
                        {bar.isHidden && <span style={{flexShrink:0,fontSize:7,color:"rgba(255,255,255,.85)"}}>🔒</span>}
                        {bar.isOutgoing && !bar.isHidden && <span style={{flexShrink:0,fontSize:7,color:"rgba(255,255,255,.85)"}}>✈️</span>}
                        <span style={{fontSize:8,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flex:1}}>
                          {bar.title}{bar.isPlanned?" ···":""}
                        </span>
                        {bar.participantsCount != null ? (
                          <span style={{flexShrink:0,background:"rgba(0,0,0,.35)",borderRadius:"50%",width:12,height:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"#fff",lineHeight:"12px",fontWeight:700}}>
                            {bar.participantsCount > 99 ? "99+" : bar.participantsCount}
                          </span>
                        ) : (
                          <span style={{flexShrink:0,background:"rgba(0,0,0,.35)",borderRadius:"50%",width:12,height:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#fff",lineHeight:"12px",fontWeight:700}}>
                            {bar.entry.trainer_id}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filtr trenerów — poniżej kalendarza */}
      <div style={{background:C.white,margin:"8px 12px 0",borderRadius:8,boxShadow:"0 1px 3px rgba(0,0,0,.07)",padding:"10px 12px"}}>
        <div style={{fontSize:10,fontWeight:700,color:C.greyMid,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Widok trenerów</div>
        <div style={{display:"flex",gap:6}}>
          {ALL_TRAINERS.map(n => {
            const active = activeTrainers.includes(n);
            return (
              <button key={n} onClick={() => toggleTrainer(n)}
                style={{flex:1,padding:"10px 0",fontSize:15,fontWeight:700,cursor:"pointer",
                  border:`1.5px solid ${active ? C.black : C.grey}`,
                  background:active ? C.black : C.white,
                  color:active ? C.white : C.greyDk,
                  borderRadius:6,transition:"background .15s,border-color .15s"}}>
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista nadchodzących */}
      <div style={{margin:"8px 12px 12px",background:C.white,borderRadius:8,padding:14,boxShadow:"0 1px 3px rgba(0,0,0,.07)"}}>
        <div style={{fontSize:11,fontWeight:700,color:C.greyMid,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>
          Nadchodzące
        </div>
        {scheduled
          .filter(s => (s.end_date||s.date) >= todayISO && (activeTrainers.length === 0 || activeTrainers.includes(Number(s.trainer_id))))
          .slice(0,20)
          .map(s => {
            const isST = s.training_id === "ST";
            const t = isST ? null : TRAININGS.find(x => x.id === s.training_id);
            const grp = GROUPS.find(g => g.id === t?.group);
            const barColor = isST ? "#8E44AD" : (grp?.color || C.grey);
            const isPlanned = (s.status||"active") === "planned";
            return (
              <div key={s.id}
                onMouseDown={e => handlePressStart(s, e)}
                onMouseUp={() => handlePressEnd(s.id)}
                onMouseLeave={() => handlePressEnd(s.id)}
                onTouchStart={e => handlePressStart(s, e)}
                onTouchEnd={() => handlePressEnd(s.id)}
                onTouchMove={() => handlePressEnd(s.id)}
                onContextMenu={e => e.preventDefault()}
                style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.grey}`,opacity:isPlanned?0.6:1,cursor:"pointer"}}>
                <div style={{width:4,alignSelf:"stretch",background:isPlanned?"#BBBBBB":barColor,borderRadius:2,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.black,marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                    {isST?(s.custom_name||"ST"):(t?.title||s.training_id)}
                    {isPlanned&&<span style={{fontSize:10,fontWeight:400,color:C.greyMid}}> · planowane</span>}
                    {s.is_hidden&&<span style={{fontSize:10,color:C.amber}}> 🔒</span>}
                    {s.is_outgoing&&!s.is_hidden&&<span style={{fontSize:10}}> ✈️</span>}
                  </div>
                  <div style={{fontSize:11,color:C.greyMid,display:"flex",gap:6,flexWrap:"wrap"}}>
                    <span>{s.date}{s.end_date&&s.end_date!==s.date?` → ${s.end_date}`:""}</span>
                    {s.trainer_id&&<span>· T{s.trainer_id} {TRAINERS[s.trainer_id]}</span>}
                    {s.participants_count!=null&&<span>· 👥 {s.participants_count}</span>}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Modal notatek */}
      {notesModal && (
        <div onClick={() => setNotesModal(null)}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div onClick={e => e.stopPropagation()}
            style={{background:C.white,borderRadius:12,padding:20,width:"100%",maxWidth:360,boxShadow:"0 8px 32px rgba(0,0,0,.25)"}}>
            <div style={{fontSize:13,fontWeight:700,color:C.black,marginBottom:4}}>{notesModal.title}</div>
            <div style={{fontSize:11,color:C.greyMid,marginBottom:12,display:"flex",gap:8,flexWrap:"wrap"}}>
              <span>📅 {notesModal.date}{notesModal.endDate&&notesModal.endDate!==notesModal.date?` → ${notesModal.endDate}`:""}</span>
              {notesModal.trainer&&<span>· T{notesModal.trainer} {TRAINERS[notesModal.trainer]}</span>}
              {notesModal.participants!=null&&<span>· 👥 {notesModal.participants}</span>}
            </div>
            <div style={{fontSize:11,fontWeight:700,color:C.greyMid,letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>Notatki</div>
            <div style={{fontSize:13,color:notesModal.notes?C.black:C.greyMid,lineHeight:1.6,minHeight:60,whiteSpace:"pre-wrap"}}>
              {notesModal.notes || "Brak notatek"}
            </div>
            <button onClick={() => setNotesModal(null)}
              style={{width:"100%",marginTop:16,background:C.black,color:C.white,border:"none",padding:12,fontSize:13,fontWeight:600,borderRadius:6,cursor:"pointer"}}>
              Zamknij
            </button>
          </div>
        </div>
      )}
    </div>
  );
}