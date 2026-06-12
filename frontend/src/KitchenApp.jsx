import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ── Theme (light warm Moroccan palette — almond canvas + charcoal sidebar) ──
const theme = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

  :root {
    /* Canvas & surfaces */
    --bg:              #fbf9f4;   /* Very Light Almond — main canvas */
    --surface:         #251b15;   /* Deep Charcoal Brown — sidebar */
    --surface-card:    #ffffff;   /* Pure White — message cards */
    --surface-hover:   #f0ebe0;   /* Slightly darker almond on hover */

    /* Borders */
    --border:          #dfd3c3;   /* Cream/Clay — subtle dividers */
    --border-dark:     #3a2b23;   /* Sidebar internal separators */
    --border-strong:   #e2d9c8;   /* Stronger cream border */

    /* Text */
    --text-main:       #1a120b;   /* Espresso Black */
    --text-light:      #ffffff;   /* Pure White */
    --text-muted:      #8c7d70;   /* Muted Olive-Brown */
    --text-muted-dark: #a9927d;   /* Muted text inside sidebar */
    --text-hint:       #b0a090;   /* Placeholder / hints */

    /* Accent - Moroccan Gold */
    --accent:          #D4A574;   /* Warm Moroccan Gold */
    --accent-hover:    #C9956B;
    --accent-light:    rgba(212, 165, 116, 0.10);
    --accent-glow:     rgba(212, 165, 116, 0.20);

    /* Status - Moroccan Flag Colors */
    --green:           #007A5E;   /* Moroccan Green */
    --green-light:     rgba(0, 122, 94, 0.10);
    --red:             #C1121F;   /* Moroccan Red */
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text-main);
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 8px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

  /* Animations */
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes shimmer { 0%,100% { opacity:.5; } 50% { opacity:1; } }
  @keyframes floatSlow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }
  @keyframes floatMedium { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
  @keyframes floatFast { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

  .spin     { animation: spin .85s linear infinite; display: inline-block; }
  .fade-up  { animation: fadeUp .35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

  /* Markdown Styles for Light Theme */
  .markdown-body {
    line-height: 1.6;
    font-size: 14.5px;
  }
  .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
    margin-top: 1.2em;
    margin-bottom: 0.6em;
    font-family: 'Playfair Display', Georgia, serif;
    color: var(--accent);
    font-weight: 600;
  }
  .markdown-body h1 { font-size: 1.6em; }
  .markdown-body h2 { font-size: 1.4em; }
  .markdown-body h3 { font-size: 1.2em; }
  
  .markdown-body p { margin-bottom: 0.8em; }
  .markdown-body p:last-child { margin-bottom: 0; }
  
  .markdown-body ul, .markdown-body ol {
    margin-bottom: 1em;
    padding-left: 1.2em;
  }
  .markdown-body li { margin-bottom: 0.3em; }
  
  .markdown-body table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1em;
    margin-bottom: 1em;
    background: #fff;
    border-radius: 8px;
    overflow: hidden;
  }
  .markdown-body th, .markdown-body td {
    border: 1px solid var(--border);
    padding: 10px 14px;
    text-align: left;
  }
  .markdown-body th {
    background: var(--accent-light);
    color: var(--accent);
    font-weight: 600;
  }
  .markdown-body td {
    color: var(--text-main);
  }
  .markdown-body strong {
    color: var(--text-main);
    font-weight: 600;
  }
  
  /* Professionally highlight the dish title at the beginning of the response */
  .markdown-body > p:first-of-type > strong:first-child {
    font-family: 'Playfair Display', Georgia, serif;
    color: var(--accent);
    font-size: 1.4em;
    font-weight: 600;
    display: inline-block;
    margin-bottom: 0.3em;
  }
  .markdown-body em {
    color: var(--text-muted);
    font-style: italic;
  }
  .markdown-body blockquote {
    border-left: 3px solid var(--accent);
    padding: 8px 14px;
    margin: 1em 0;
    color: var(--text-muted);
    background: var(--accent-light);
    border-radius: 0 8px 8px 0;
  }
  .markdown-body hr {
    border: 0;
    height: 1px;
    background: var(--border-strong);
    margin: 1.5em 0;
  }
`;

function injectTheme() {
  if (!document.getElementById("kitchen-theme")) {
    const s = document.createElement("style");
    s.id = "kitchen-theme";
    s.textContent = theme;
    document.head.appendChild(s);
  }
}

// ── API helpers ───────────────────────────────────────────────────────────────
const API = "";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const Ic = ({ d, size = 18, fill = "none", sw = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const IcPlus = () => <Ic d="M12 5v14M5 12h14" />;
const IcTrash = () => <Ic d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />;
const IcSend = () => <Ic d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" fill="currentColor" sw={0} />;
const IcUser = () => <Ic d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />;
const IcLock = () => <Ic d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4" />;
const IcMenu = () => <Ic d="M3 12h18M3 6h18M3 18h18" />;
const IcX = () => <Ic d="M18 6L6 18M6 6l12 12" />;
const IcHeart = ({ f }) => <Ic d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill={f ? "currentColor" : "none"} />;
const IcChevron = () => <Ic d="M6 9l6 6 6-6" />;
const IcLogout = () => <Ic d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />;
const IcStop = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>;
const IcLoader = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

// ── Auth Screen ───────────────────────────────────────────────────────────────
function AuthScreen({ onAuth, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password.trim()) { setError("Please fill in all fields."); return; }
    setLoading(true); setError("");
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const data = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      onAuth({ userId: data.user_id, username: data.username });
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const field = {
    background: "#faf7f2", border: "1px solid var(--border)",
    borderRadius: 12, color: "var(--text-main)", fontSize: 15,
    padding: "13px 14px 13px 44px", width: "100%", outline: "none",
    fontFamily: "inherit", transition: "border-color 0.2s",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", position: "relative", overflow: "hidden" }}>
      {/* Background faint stars */}
      <div style={{ position: "absolute", top: "10%", left: "5%", fontSize: 300, color: "var(--red)", opacity: 0.02, pointerEvents: "none", zIndex: 0 }}>★</div>
      <div style={{ position: "absolute", bottom: "10%", right: "10%", fontSize: 240, color: "var(--green)", opacity: 0.02, pointerEvents: "none", zIndex: 0 }}>★</div>

      <div className="card fade-up" style={{ width: 420, padding: "44px 40px", borderRadius: 24, position: "relative", zIndex: 1, background: "#fff", boxShadow: "0 8px 32px rgba(0,0,0,0.06)" }}>
        {/* Back arrow */}
        <button style={{ position: "absolute", top: 24, left: 24, background: "transparent", border: "1px solid var(--border)", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-muted)", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "var(--surface-hover)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <span style={{ fontSize: 18 }}>←</span>
        </button>

        <div style={{ textAlign: "center", marginBottom: 32, marginTop: 12 }}>
          <div style={{ width: 72, height: 72, margin: "0 auto 16px", borderRadius: "50%", overflow: "hidden", border: "3px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
            <img src="/moroccan_tagine.png" alt="Atlas Kitchen" style={{ width: "120%", height: "120%", objectFit: "cover" }} />
          </div>
          <h1 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 32, color: "var(--text-main)", marginBottom: 6, fontWeight: 700, letterSpacing: "0.01em" }}>ATLAS KITCHEN</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Your Moroccan culinary guide</p>
          <div style={{ width: 80, height: 3, margin: "16px auto 0", display: "flex", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ flex: 1, background: "var(--red)" }} />
            <div style={{ flex: 1, background: "var(--green)" }} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", background: "var(--bg)", borderRadius: 10, padding: 4, marginBottom: 24, border: "1px solid var(--border)" }}>
          {["login", "register"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
              flex: 1, padding: "9px", border: "none", borderRadius: 8, cursor: "pointer",
              fontFamily: "inherit", fontSize: 14, fontWeight: 600,
              background: mode === m ? "#fff" : "transparent",
              color: mode === m ? "var(--red)" : "var(--text-muted)",
              boxShadow: mode === m ? "0 1px 4px rgba(26,18,11,0.10)" : "none",
              transition: "all .2s",
            }}>
              {m === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        {/* Fields */}
        {[
          { icon: <IcUser />, placeholder: "Username", value: username, set: setUsername, type: "text" },
          { icon: <IcLock />, placeholder: "Password", value: password, set: setPassword, type: "password" },
        ].map(({ icon, placeholder, value, set, type }) => (
          <div key={placeholder} style={{ position: "relative", marginBottom: 16 }}>
            <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none", display: "flex" }}>
              {icon}
            </span>
            <input type={type} placeholder={placeholder} value={value}
              onChange={e => set(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              style={field}
              onFocus={e => e.target.style.borderColor = "var(--accent)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"}
            />
          </div>
        ))}

        {error && <p style={{ color: "var(--red)", fontSize: 13, textAlign: "center", margin: "8px 0 12px" }}>{error}</p>}

        <button onClick={submit} disabled={loading} style={{
          width: "100%", padding: "14px", marginTop: 10, background: "var(--red)", border: "none",
          borderRadius: 12, cursor: loading ? "not-allowed" : "pointer", color: "#fff",
          fontFamily: "inherit", fontSize: 15, fontWeight: 600, letterSpacing: "0.01em",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          opacity: loading ? 0.85 : 1, transition: "all .2s",
          boxShadow: "0 4px 16px rgba(193,18,31,0.25)",
        }}
          onMouseEnter={e => !loading && (e.currentTarget.style.background = "#a33434")}
          onMouseLeave={e => !loading && (e.currentTarget.style.background = "var(--red)")}
        >
          {loading ? <><span className="spin"><IcLoader /></span> Authenticating…</> : mode === "login" ? "Sign In" : "Create Account"}
        </button>
      </div>
    </div>
  );
}

// ── Preferences Panel ─────────────────────────────────────────────────────────
const DIETARY_OPTS = ["Vegetarian", "Vegan", "Gluten-free", "Halal", "Dairy-free", "Nut-free", "Low-carb", "No pork"];

function PrefsPanel({ userId, prefs, onSaved, onClose }) {
  const [liked, setLiked] = useState(prefs.liked?.join(", ") || "");
  const [disliked, setDisliked] = useState(prefs.disliked?.join(", ") || "");
  const [dietary, setDietary] = useState(prefs.dietary || []);
  const [notes, setNotes] = useState(prefs.flavor_notes || "");
  const [saving, setSaving] = useState(false);

  const toggle = opt => setDietary(p => p.includes(opt) ? p.filter(d => d !== opt) : [...p, opt]);

  const save = async () => {
    setSaving(true);
    try {
      const parsedLiked = liked.split(",").map(s => s.trim()).filter(Boolean);
      const parsedDisliked = disliked.split(",").map(s => s.trim()).filter(Boolean);

      await apiFetch("/api/preferences", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          liked: parsedLiked,
          disliked: parsedDisliked,
          dietary,
          flavor_notes: notes,
        }),
      });
      onSaved({ liked: parsedLiked, disliked: parsedDisliked, dietary, flavor_notes: notes });
      onClose();
    } catch (e) {
      alert("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = {
    width: "100%", padding: "16px 20px", background: "rgba(0,0,0,0.02)",
    border: "1px solid rgba(0,0,0,0.06)", borderRadius: 16, color: "var(--text-main)",
    fontSize: 15, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
    transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
  };
  const labelStyle = { display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-main)", letterSpacing: ".02em", marginBottom: 12 };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(26, 18, 11, 0.3)", backdropFilter: "blur(12px)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "24px"
    }}>
      <div className="card fade-up" style={{
        width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto",
        background: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(40px)",
        borderRadius: 32, padding: "40px", border: "1px solid rgba(255,255,255,0.6)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(255,255,255,0.5)"
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 36 }}>
          <div>
            <h2 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 32, color: "var(--text-main)", fontWeight: 700, lineHeight: 1.2, marginBottom: 6 }}>Taste Profile</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 15, margin: 0 }}>Personalize your culinary experience</p>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(0,0,0,0.04)", border: "none", borderRadius: "50%",
            width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "var(--text-main)", transition: "all 0.2s"
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "scale(1.05)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "scale(1)"; }}
          ><IcX /></button>
        </div>

        <div style={{ marginBottom: 28 }}>
          <label style={labelStyle}>❤️ Dishes you love</label>
          <input value={liked} onChange={e => setLiked(e.target.value)} placeholder="e.g. Tagine, Couscous, Bastilla" style={fieldStyle}
            onFocus={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 4px var(--accent-light)"; e.target.style.background = "#fff"; }}
            onBlur={e => { e.target.style.borderColor = "rgba(0,0,0,0.06)"; e.target.style.boxShadow = "none"; e.target.style.background = "rgba(0,0,0,0.02)"; }} />
        </div>

        <div style={{ marginBottom: 28 }}>
          <label style={labelStyle}>🚫 Dishes you avoid</label>
          <input value={disliked} onChange={e => setDisliked(e.target.value)} placeholder="e.g. Tripe, Liver" style={fieldStyle}
            onFocus={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 4px var(--accent-light)"; e.target.style.background = "#fff"; }}
            onBlur={e => { e.target.style.borderColor = "rgba(0,0,0,0.06)"; e.target.style.boxShadow = "none"; e.target.style.background = "rgba(0,0,0,0.02)"; }} />
        </div>

        <div style={{ marginBottom: 28 }}>
          <label style={labelStyle}>🌿 Dietary requirements</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {DIETARY_OPTS.map(opt => {
              const active = dietary.includes(opt);
              return (
                <button key={opt} onClick={() => toggle(opt)} style={{
                  padding: "10px 18px", borderRadius: 24, border: "1px solid",
                  borderColor: active ? "var(--accent)" : "rgba(0,0,0,0.08)",
                  background: active ? "var(--accent)" : "#fff",
                  color: active ? "#fff" : "var(--text-muted)",
                  cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit",
                  transition: "all .3s cubic-bezier(0.16, 1, 0.3, 1)",
                  boxShadow: active ? "0 6px 16px var(--accent-glow)" : "0 2px 6px rgba(0,0,0,0.02)",
                }}
                  onMouseEnter={e => !active && (e.currentTarget.style.borderColor = "rgba(0,0,0,0.2)")}
                  onMouseLeave={e => !active && (e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)")}
                >{opt}</button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 40 }}>
          <label style={labelStyle}>✍️ Flavor notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. I love spicy food, prefer mild cumin, no coriander…"
            rows={3} style={{ ...fieldStyle, resize: "vertical" }}
            onFocus={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 4px var(--accent-light)"; e.target.style.background = "#fff"; }}
            onBlur={e => { e.target.style.borderColor = "rgba(0,0,0,0.06)"; e.target.style.boxShadow = "none"; e.target.style.background = "rgba(0,0,0,0.02)"; }}
          />
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "16px", background: "rgba(0,0,0,0.04)", border: "none",
            borderRadius: 16, cursor: "pointer", color: "var(--text-main)", fontFamily: "inherit", fontSize: 15, fontWeight: 600,
            transition: "all 0.2s"
          }} onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.08)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}>Cancel</button>

          <button onClick={save} disabled={saving} style={{
            flex: 2, padding: "16px", background: "linear-gradient(135deg, var(--accent) 0%, #C9956B 100%)", border: "none",
            borderRadius: 16, cursor: "pointer", color: "#fff", fontFamily: "inherit",
            fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: "0 8px 24px var(--accent-glow)", transition: "all 0.3s"
          }}
            onMouseEnter={e => !saving && (e.currentTarget.style.transform = "translateY(-2px)", e.currentTarget.style.boxShadow = "0 12px 32px var(--accent-glow)")}
            onMouseLeave={e => !saving && (e.currentTarget.style.transform = "none", e.currentTarget.style.boxShadow = "0 8px 24px var(--accent-glow)")}>
            {saving ? <><span className="spin"><IcLoader /></span> Saving…</> : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Recipe Card ───────────────────────────────────────────────────────────────
function RecipeCard({ recipe }) {
  const [open, setOpen] = useState(false);
  if (!recipe) return null;

  const renderIngredient = (ing) => {
    if (!ing) return "";
    if (typeof ing === "object") {
      const name = ing.name || ing.item || "";
      const amount = ing.amount || ing.quantity || "";
      const unit = ing.unit || "";
      return `${amount} ${unit} ${name}`.trim();
    }
    return String(ing);
  };

  const ingredientsArray = Array.isArray(recipe.ingredients) ? recipe.ingredients : recipe.ingredients ? [recipe.ingredients] : [];
  const stepsArray = Array.isArray(recipe.steps) ? recipe.steps : recipe.steps ? [recipe.steps] : [];
  const tipsArray = Array.isArray(recipe.tips) ? recipe.tips : recipe.tips ? [recipe.tips] : [];
  const adaptationsArray = Array.isArray(recipe.moroccan_adaptations) ? recipe.moroccan_adaptations : recipe.moroccan_adaptations ? [recipe.moroccan_adaptations] : [];

  const sectionLabel = {
    color: "var(--accent)", display: "block", marginBottom: 10,
    fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700,
  };
  return (
    <div style={{ marginTop: 16, background: "var(--surface-card)", borderRadius: 16, border: "1px solid var(--border-strong)", overflow: "hidden", transition: "all 0.3s", boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: open ? "rgba(205, 108, 50, 0.05)" : "transparent", border: "none", cursor: "pointer",
        color: "var(--text-main)", fontFamily: "inherit", fontSize: 15, fontWeight: 600, transition: "background 0.2s"
      }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"} onMouseLeave={e => e.currentTarget.style.background = open ? "rgba(255,255,255,0.03)" : "transparent"}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>📋</span> {recipe.name || recipe.title || "Recipe Overview"}
          {recipe.servings && <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>· {recipe.servings} servings</span>}
        </span>
        <span style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .3s cubic-bezier(0.16, 1, 0.3, 1)", display: "flex", color: "var(--accent)" }}><IcChevron /></span>
      </button>

      {open && (
        <div style={{ padding: "20px", fontSize: 14, color: "var(--text-main)", lineHeight: 1.7, borderTop: "1px solid var(--border-strong)", background: "var(--bg)" }}>

          {/* Cultural note */}
          {recipe.cultural_note && (
            <div style={{ background: "rgba(200,112,40,0.08)", padding: "12px 16px", borderRadius: 12, marginBottom: 20, border: "1px solid rgba(200, 104, 50, 0.2)" }}>
              <p style={{ color: "var(--accent)", fontStyle: "italic", fontSize: 13 }}>📖 {recipe.cultural_note}</p>
            </div>
          )}

          {/* Moroccan adaptations (for moroccan_twist style) */}
          {adaptationsArray.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <strong style={sectionLabel}>🌿 Moroccan Adaptations</strong>
              <ul style={{ paddingLeft: 0, margin: 0, listStyle: "none" }}>
                {adaptationsArray.map((adapt, i) => (
                  <li key={i} style={{ marginBottom: 6, display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ color: "var(--accent)", flexShrink: 0 }}>✦</span>
                    <span style={{ color: "var(--text-muted)" }}>{typeof adapt === "object" ? JSON.stringify(adapt) : String(adapt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ingredients */}
          {ingredientsArray.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <strong style={sectionLabel}>🛒 Ingredients</strong>
              <ul style={{ paddingLeft: 0, margin: 0, listStyle: "none" }}>
                {ingredientsArray.map((ing, i) => (
                  <li key={i} style={{ marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ color: "var(--accent)", flexShrink: 0 }}>•</span>
                    <span>{renderIngredient(ing)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cooking Steps */}
          {stepsArray.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <strong style={sectionLabel}>👨‍🍳 Cooking Steps</strong>
              <ol style={{ paddingLeft: 0, margin: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                {stepsArray.map((step, i) => {
                  if (!step) return null;
                  if (typeof step === "string") {
                    return (
                      <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <span style={{ minWidth: 24, height: 24, borderRadius: "50%", background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ paddingTop: 2 }}>{step}</span>
                      </li>
                    );
                  }
                  const title = step.title || step.name || `Step ${step.step_number || i + 1}`;
                  const instr = step.instruction || step.text || step.desc || "";
                  const dur = step.duration_minutes ? `${step.duration_minutes} min` : null;
                  return (
                    <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <span style={{ minWidth: 24, height: 24, borderRadius: "50%", background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                        {step.step_number || i + 1}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontWeight: 600, color: "var(--text-main)", fontSize: 13 }}>{title}</span>
                          {dur && <span style={{ fontSize: 11, color: "var(--text-hint)", background: "rgba(0,0,0,0.06)", padding: "1px 8px", borderRadius: 10 }}>⏱ {dur}</span>}
                        </div>
                        {instr && <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6 }}>{instr}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Chef Tips */}
          {tipsArray.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <strong style={sectionLabel}>💡 Chef Tips</strong>
              <ul style={{ paddingLeft: 0, margin: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                {tipsArray.map((tip, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(0,0,0,0.03)", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.05)" }}>
                    <span style={{ color: "var(--accent)", flexShrink: 0 }}>✦</span>
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{typeof tip === "object" ? JSON.stringify(tip) : String(tip)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pairing */}
          {recipe.pairing && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(200,112,40,0.06)", border: "1px solid rgba(200, 104, 50, 0.2)" }}>
              <strong style={{ color: "var(--accent)", fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>🍵 Suggested Pairing</strong>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>{recipe.pairing}</p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}


// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ msg, onSend }) {
  const isUser = msg.role === "user";

  return (
    <div className="fade-up" style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 24 }}>
      {!isUser && (
        <div style={{
          width: 36, height: 36, borderRadius: 12, background: "linear-gradient(135deg, var(--accent) 0%, #a85a1a 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, flexShrink: 0, marginRight: 14, marginTop: 4,
          boxShadow: "0 4px 12px var(--accent-glow)"
        }}>🧑‍🍳</div>
      )}
      <div style={{
        maxWidth: "78%",
        padding: isUser ? "14px 20px" : "18px 22px",
        borderRadius: isUser ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
        background: isUser ? "var(--accent)" : "#ffffff",
        border: isUser ? "none" : "1px solid var(--border-strong)",
        color: isUser ? "#fff" : "var(--text-main)",
        fontSize: 15, lineHeight: 1.7,
        boxShadow: isUser ? "0 6px 20px var(--accent-glow)" : "0 4px 16px rgba(0,0,0,0.03)",
      }}>
        {msg.thinking ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--accent)" }}>
            <span className="spin"><IcLoader /></span>
            <span style={{ fontSize: 14, animation: "shimmer 1.5s ease-in-out infinite", fontWeight: 500 }}>Chef thinking…</span>
          </div>
        ) : (
          <>
            {/* Main response text */}
            <div className="markdown-body" style={{ whiteSpace: "normal" }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>

            {/* Recommended dishes */}
            {msg.recommendedRecipes?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 8 }}>✨ Discover More</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {msg.recommendedRecipes.slice(0, 3).map((r, i) => {
                    const descriptions = {
                      "Chicken Tagine": "Tender & aromatic",
                      "Royal Couscous": "Fluffy & savory",
                      "Sweet Pastilla": "Crispy & elegant",
                      "Harira Soup": "Hearty & warming",
                      "Moroccan Salad": "Fresh & vibrant",
                      "Lamb Kofta": "Spiced & juicy",
                      "Vegetable Tagine": "Wholesome & colorful",
                      "Tagine de poulet aux citrons confits et olives": "Tender & aromatic",
                      "Tagine d'agneau aux pruneaux et amandes": "Rich & sweet",
                      "Couscous aux sept légumes": "Fluffy & savory",
                      "Pastilla de poulet et amandes": "Crispy & elegant",
                      "Soupe Harira": "Hearty & warming",
                      "Salade Marocaine": "Fresh & vibrant",
                      "Kefta": "Spiced & juicy",
                      "Tagine de légumes": "Wholesome & colorful"
                    };
                    const desc = descriptions[r.name] || "Must try";
                    return (
                      <span key={i} onClick={() => onSend && onSend(r.name)} style={{
                        padding: "8px 14px", background: "linear-gradient(135deg, rgba(193, 18, 31, 0.08) 0%, rgba(0, 122, 94, 0.08) 100%)",
                        border: "1px solid rgba(193, 18, 31, 0.2)", borderRadius: 20,
                        fontSize: 13, color: "var(--accent)", fontWeight: 500,
                        cursor: "pointer", transition: "all 0.2s", display: "flex", flexDirection: "column", alignItems: "flex-start"
                      }} onMouseEnter={e => e.currentTarget.style.background = "linear-gradient(135deg, rgba(193, 18, 31, 0.15) 0%, rgba(0, 122, 94, 0.15) 100%)"} onMouseLeave={e => e.currentTarget.style.background = "linear-gradient(135deg, rgba(193, 18, 31, 0.08) 0%, rgba(0, 122, 94, 0.08) 100%)"}>
                        <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{r.name}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{desc}{r.time_minutes ? ` · ${r.time_minutes}m` : ""}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recipe card */}
            {msg.recipe && <RecipeCard recipe={msg.recipe} />}

            {/* Nutrition */}
            {msg.nutrition?.per_serving && (
              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                {[
                  ["🔥", "Kcal", msg.nutrition.per_serving.calories, ""],
                  ["🌾", "Carbs", msg.nutrition.per_serving.carbs_g, "g"],
                  ["💪", "Protein", msg.nutrition.per_serving.protein_g, "g"],
                  ["🫒", "Fat", msg.nutrition.per_serving.fat_g, "g"],
                  ["🌿", "Fibre", msg.nutrition.per_serving.fibre_g, "g"],
                ].filter(([, , val]) => val != null).map(([icon, label, val, unit]) => (
                  <span key={label} style={{
                    padding: "5px 12px", background: "rgba(0,0,0,0.05)",
                    borderRadius: 20, border: "1px solid var(--border-strong)",
                    fontSize: 12, color: "var(--text-main)", fontWeight: 500,
                    display: "flex", alignItems: "center", gap: 4
                  }}>
                    <span style={{ fontSize: 14 }}>{icon}</span>
                    <span style={{ color: "var(--text-muted)" }}>{label}:</span>
                    <span style={{ color: "var(--accent)", fontWeight: 700 }}>{val}{unit}</span>
                  </span>
                ))}

                {msg.nutrition.mediterranean_score != null && (
                  <span style={{
                    padding: "5px 12px", background: "rgba(61, 138, 74, 0.1)", border: "1px solid rgba(69, 154, 83, 0.3)",
                    borderRadius: 20, fontSize: 12, color: "var(--green)", fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 4
                  }}>
                    🌍 Med. Score: {msg.nutrition.mediterranean_score}/10
                  </span>
                )}
              </div>
            )}

            {/* Waiting for choice */}
            {msg.waiting && (
              <div style={{ marginTop: 20, background: "rgba(200, 112, 40, 0.1)", padding: "16px", borderRadius: 16, border: "1px solid rgba(200, 104, 50, 0.2)" }}>
                <div style={{ fontSize: 13, color: "var(--text-main)", marginBottom: 12, fontWeight: 600 }}>
                  🌍 World Kitchen — Choose your style
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={() => onSend && onSend("Classic")} style={{
                    flex: 1, padding: "10px", borderRadius: 10,
                    background: "var(--accent)",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    transition: "background 0.2s"
                  }}>Classic
                  </button>

                  <button onClick={() => onSend && onSend("Moroccan Twist")} style={{
                    flex: 1, padding: "10px", borderRadius: 10,
                    background: "var(--accent)",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    transition: "background 0.2s"
                  }}>Moroccan Twist
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
const IMAGE_SUGGESTIONS = [
  { title: "Chicken Tagine", img: "/moroccan_tagine.png", desc: "Slow-cooked aromatic spiced chicken" },
  { title: "Royal Couscous", img: "/moroccan_couscous.png", desc: "Fluffy mounds with seven vegetables" },
  { title: "Sweet Pastilla", img: "/moroccan_pastilla.png", desc: "Crispy phyllo with almonds & cinnamon" }
];

// ── Scroll animation hook ─────────────────────────────────────────────────────
function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            // Staggered children
            const children = entry.target.querySelectorAll(".stagger-child");
            children.forEach((child, i) => {
              setTimeout(() => child.classList.add("visible"), i * 120);
            });
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".landing-section").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

// ── Capability card data ──────────────────────────────────────────────────────
const CAPABILITIES = [
  {
    icon: "🫕",
    title: "Authentic Moroccan Recipes",
    desc: "Get step-by-step traditional Moroccan recipes with cultural context, chef tips, ingredient pricing, and perfect pairings.",
    example: "\"Make me a chicken tagine\"",
    gradient: "linear-gradient(135deg, #C1121F 0%, #a33434 100%)",
  },
  {
    icon: "🌍",
    title: "World Kitchen Fusion",
    desc: "Cook any dish from any cuisine — choose between the classic original or a Moroccan twist with ras el hanout, harissa & preserved lemons.",
    example: "\"I want to make pizza\"",
    gradient: "linear-gradient(135deg, #007A5E 0%, #00a67d 100%)",
  },
  {
    icon: "✨",
    title: "Smart Recommendations",
    desc: "Personalized dish suggestions based on your taste profile, dietary needs, and what you've cooked before. Your AI learns your palate.",
    example: "\"What should I cook today?\"",
    gradient: "linear-gradient(135deg, #D4A574 0%, #C9956B 100%)",
  },
  {
    icon: "📊",
    title: "Nutrition Analysis",
    desc: "Automatic nutritional breakdown with calories, macros, Mediterranean diet score, and alerts for dietary conflicts.",
    example: "Included with every recipe",
    gradient: "linear-gradient(135deg, #8B5E3C 0%, #6B4226 100%)",
  },
  {
    icon: "💰",
    title: "Moroccan Market Pricing",
    desc: "Real-time Moroccan market prices (MAD) for every ingredient. Know exactly what your recipe costs before you shop at the souk.",
    example: "Calculated per ingredient",
    gradient: "linear-gradient(135deg, #b8860b 0%, #d4a017 100%)",
  },
  {
    icon: "📖",
    title: "Culinary Knowledge",
    desc: "Ask about techniques, spices, food culture, or cooking science. Get expert answers without needing a full recipe.",
    example: "\"What is ras el hanout?\"",
    gradient: "linear-gradient(135deg, #6B4226 0%, #8B5E3C 100%)",
  },
];

// ── Pipeline steps ────────────────────────────────────────────────────────────
const PIPELINE_STEPS = [
  { icon: "💬", title: "You Ask", desc: "Type any food question or recipe request" },
  { icon: "🧠", title: "AI Understands", desc: "Intent classified across 5 categories" },
  { icon: "🎯", title: "Smart Match", desc: "Personalized dishes recommended for you" },
  { icon: "👨‍🍳", title: "Chef Cooks", desc: "Full recipe with steps, tips & pricing" },
  { icon: "🔬", title: "Nutrition Check", desc: "Calories, macros & dietary analysis" },
  { icon: "⭐", title: "Quality Review", desc: "Critic scores & refines up to 3×" },
];

function LandingPage({ onStartCooking, onCreateAccount }) {
  useScrollReveal();

  return (
    <div style={{ background: "var(--bg)", position: "relative", overflowX: "hidden" }}>

      {/* ═══════════════ NAVBAR ═══════════════ */}
      <nav style={{
        padding: "20px 48px", display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 100, background: "rgba(251,249,244,0.92)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(223,211,195,0.5)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 4px 12px var(--accent-glow)" }}>🫕</div>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: "var(--text-main)", letterSpacing: "0.02em" }}>ATLAS KITCHEN</div>
            <div style={{ fontSize: 10, color: "var(--red)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>MOROCCAN CULINARY AI</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="#capabilities" style={{ fontSize: 14, color: "var(--text-muted)", textDecoration: "none", fontWeight: 500, padding: "8px 14px", borderRadius: 20, transition: "all 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--text-main)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
          >Features</a>
          <a href="#how-it-works" style={{ fontSize: 14, color: "var(--text-muted)", textDecoration: "none", fontWeight: 500, padding: "8px 14px", borderRadius: 20, transition: "all 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--text-main)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
          >How It Works</a>
          <a href="#dishes" style={{ fontSize: 14, color: "var(--text-muted)", textDecoration: "none", fontWeight: 500, padding: "8px 14px", borderRadius: 20, transition: "all 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--text-main)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
          >Dishes</a>
          <button onClick={onStartCooking} style={{ padding: "10px 24px", background: "var(--red)", color: "#fff", border: "none", borderRadius: 24, fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 4px 12px rgba(193,18,31,0.2)", marginLeft: 8 }}
            onMouseEnter={e => e.currentTarget.style.background = "#a33434"}
            onMouseLeave={e => e.currentTarget.style.background = "var(--red)"}
          >Get Started</button>
        </div>
      </nav>

      {/* ═══════════════ HERO ═══════════════ */}
      <section style={{ padding: "80px 48px 100px", maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", gap: 64, position: "relative", flexWrap: "wrap" }}>
        {/* Background stars */}
        <div style={{ position: "absolute", top: "5%", left: "2%", fontSize: 380, color: "var(--red)", opacity: 0.03, pointerEvents: "none", zIndex: 0 }}>★</div>
        <div style={{ position: "absolute", bottom: "0%", right: "15%", fontSize: 260, color: "var(--green)", opacity: 0.03, pointerEvents: "none", zIndex: 0 }}>★</div>

        <div className="fade-up" style={{ flex: "1 1 440px", minWidth: 300, position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(193,18,31,0.08)", border: "1px solid rgba(193,18,31,0.15)", padding: "6px 16px", borderRadius: 20, marginBottom: 28 }}>
            <span style={{ fontSize: 14 }}>🇲🇦</span>
            <span style={{ fontSize: 13, color: "var(--red)", fontWeight: 600 }}>Made with ❤️ in Morocco</span>
          </div>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(40px, 5vw, 64px)", fontWeight: 700, lineHeight: 1.1, color: "var(--text-main)", marginBottom: 20 }}>
            Discover the<br />
            <span style={{ color: "var(--red)" }}>Magic of </span>
            <span style={{ color: "var(--green)" }}>Moroccan</span><br />
            Cuisine
          </h1>
          <p style={{ fontSize: 18, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16, maxWidth: 520 }}>
            Your personal AI culinary assistant, steeped in centuries of Moroccan tradition. From aromatic tagines to fluffy couscous — let technology meet tradition.
          </p>
          <p style={{ fontSize: 15, color: "var(--text-hint)", lineHeight: 1.6, marginBottom: 36, maxWidth: 520, fontStyle: "italic" }}>
            6 AI agents working together — recipes, nutrition, pricing, and quality review, all in one conversation.
          </p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <button onClick={onStartCooking} style={{ padding: "16px 36px", background: "var(--red)", color: "#fff", border: "none", borderRadius: 30, fontSize: 16, fontWeight: 600, cursor: "pointer", boxShadow: "0 8px 28px rgba(193,18,31,0.25)", transition: "all 0.3s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#a33434"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 36px rgba(193,18,31,0.3)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--red)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(193,18,31,0.25)"; }}
            >Start Cooking →</button>
            <button onClick={onCreateAccount} style={{ padding: "16px 36px", background: "transparent", color: "var(--green)", border: "2px solid var(--green)", borderRadius: 30, fontSize: 16, fontWeight: 600, cursor: "pointer", transition: "all 0.3s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--green)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--green)"; e.currentTarget.style.transform = "none"; }}
            >Create Account</button>
          </div>
        </div>

        {/* Hero images — real dish photos */}
        <div className="fade-up" style={{ flex: "1 1 500px", position: "relative", height: 560, minWidth: 300 }}>
          {/* Main large image — Tagine */}
          <div style={{ position: "absolute", top: 0, right: 20, width: 380, height: 380, borderRadius: 28, zIndex: 2, animation: "floatSlow 6s ease-in-out infinite", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", border: "8px solid #fff" }}>
            <img src="/moroccan_tagine.png" alt="Moroccan Tagine" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          {/* Star badge */}
          <div style={{ position: "absolute", top: -10, right: 0, width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #C1121F 0%, #007A5E 100%)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4, color: "#fff", boxShadow: "0 12px 28px rgba(0,0,0,0.25)", animation: "floatFast 4s ease-in-out infinite" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
          </div>
          {/* Couscous — bottom left */}
          <div style={{ position: "absolute", bottom: 0, left: 0, width: 280, height: 280, borderRadius: 24, border: "8px solid #fff", boxShadow: "0 16px 48px rgba(0,0,0,0.15)", zIndex: 1, animation: "floatMedium 5s ease-in-out infinite", overflow: "hidden" }}>
            <img src="/moroccan_couscous.png" alt="Royal Couscous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          {/* Pastilla — bottom right */}
          <div style={{ position: "absolute", bottom: 40, right: -10, width: 220, height: 220, borderRadius: 24, border: "8px solid #fff", boxShadow: "0 16px 48px rgba(0,0,0,0.15)", zIndex: 3, animation: "floatFast 4.5s ease-in-out infinite", overflow: "hidden" }}>
            <img src="/moroccan_pastilla.png" alt="Sweet Pastilla" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </div>
      </section>

      {/* ═══════════════ CAPABILITIES ═══════════════ */}
      <section id="capabilities" className="landing-section" style={{ padding: "100px 48px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64, position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--accent-light)", padding: "6px 18px", borderRadius: 20, marginBottom: 20 }}>
            <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700, letterSpacing: "0.06em" }}>POWERED BY 6 AI AGENTS</span>
          </div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 700, color: "var(--text-main)", marginBottom: 16 }}>
            What Can <span style={{ color: "var(--red)" }}>Atlas Kitchen</span> Do?
          </h2>
          <p style={{ fontSize: 17, color: "var(--text-muted)", maxWidth: 600, margin: "0 auto", lineHeight: 1.7 }}>
            From discovering recipes to calculating nutrition and market prices — everything happens in one intelligent conversation.
          </p>
          <a href="#" style={{ position: "absolute", top: 0, right: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 20, border: "1px solid var(--border)", textDecoration: "none", color: "var(--text-muted)", fontSize: 14, fontWeight: 600, transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "#fff"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>↑ Back</a>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24 }}>
          {CAPABILITIES.map((cap, i) => (
            <div key={i} className="stagger-child" style={{
              background: "#fff", borderRadius: 20, padding: "32px 28px", border: "1px solid var(--border)",
              transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)", cursor: "default",
              boxShadow: "0 2px 12px rgba(0,0,0,0.04)", position: "relative", overflow: "hidden"
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(0,0,0,0.10)"; e.currentTarget.style.borderColor = "var(--accent)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              {/* Faint background glow */}
              <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: cap.gradient, opacity: 0.06, pointerEvents: "none" }} />

              <div style={{ width: 52, height: 52, borderRadius: 14, background: cap.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 20, boxShadow: "0 6px 16px rgba(0,0,0,0.12)" }}>
                {cap.icon}
              </div>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 600, color: "var(--text-main)", marginBottom: 10 }}>{cap.title}</h3>
              <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>{cap.desc}</p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "var(--bg)", borderRadius: 12, border: "1px solid var(--border)" }}>
                <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, fontStyle: "italic" }}>{cap.example}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <section id="how-it-works" className="landing-section" style={{ padding: "100px 48px", background: "linear-gradient(180deg, rgba(37,27,21,0.03) 0%, rgba(37,27,21,0) 100%)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64, position: "relative" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,122,94,0.08)", padding: "6px 18px", borderRadius: 20, marginBottom: 20 }}>
              <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 700, letterSpacing: "0.06em" }}>MULTI-AGENT PIPELINE</span>
            </div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 700, color: "var(--text-main)", marginBottom: 16 }}>
              How It <span style={{ color: "var(--green)" }}>Works</span>
            </h2>
            <p style={{ fontSize: 17, color: "var(--text-muted)", maxWidth: 600, margin: "0 auto", lineHeight: 1.7 }}>
              Behind every recipe, 6 specialized AI agents collaborate to deliver a perfect result — automatically.
            </p>
            <a href="#" style={{ position: "absolute", top: 0, right: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 20, border: "1px solid var(--border)", textDecoration: "none", color: "var(--text-muted)", fontSize: 14, fontWeight: 600, transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "#fff"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>↑ Back</a>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, position: "relative" }}>
            {/* Connecting line behind the cards */}
            <div style={{ position: "absolute", top: 44, left: "8%", right: "8%", height: 3, background: "linear-gradient(90deg, var(--red) 0%, var(--accent) 33%, var(--green) 66%, var(--accent) 100%)", borderRadius: 2, zIndex: 0, opacity: 0.2 }} />

            {PIPELINE_STEPS.map((step, i) => (
              <div key={i} className="stagger-child" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", position: "relative", zIndex: 1 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%", background: "#fff", border: "3px solid var(--accent)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 16,
                  boxShadow: "0 6px 20px rgba(0,0,0,0.08)", position: "relative"
                }}>
                  {step.icon}
                  <div style={{
                    position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%",
                    background: i < 2 ? "var(--red)" : i < 4 ? "var(--accent)" : "var(--green)",
                    color: "#fff", fontSize: 11, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                  }}>{i + 1}</div>
                </div>
                <h4 style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "var(--text-main)", marginBottom: 6 }}>{step.title}</h4>
                <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, maxWidth: 140 }}>{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Quality note */}
          <div style={{
            maxWidth: 640, margin: "48px auto 0", padding: "20px 28px", borderRadius: 16,
            background: "rgba(212,165,116,0.08)", border: "1px solid rgba(212,165,116,0.2)",
            textAlign: "center"
          }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
              <span style={{ color: "var(--accent)", fontWeight: 700 }}>⭐ Quality Guarantee</span> — Our AI critic reviews every recipe and may refine it up to <strong>3 times</strong> before serving it to you, ensuring accuracy, taste, and cultural authenticity.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════ DISH SHOWCASE ═══════════════ */}
      <section id="dishes" className="landing-section" style={{ padding: "100px 48px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64, position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(193,18,31,0.08)", padding: "6px 18px", borderRadius: 20, marginBottom: 20 }}>
            <span style={{ fontSize: 12, color: "var(--red)", fontWeight: 700, letterSpacing: "0.06em" }}>TRADITIONAL MOROCCAN</span>
          </div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 700, color: "var(--text-main)", marginBottom: 16 }}>
            Iconic <span style={{ color: "var(--red)" }}>Dishes</span> to Explore
          </h2>
          <p style={{ fontSize: 17, color: "var(--text-muted)", maxWidth: 560, margin: "0 auto", lineHeight: 1.7 }}>
            Start your journey with these beloved Moroccan classics — each one a gateway to centuries of culinary tradition.
          </p>
          <a href="#" style={{ position: "absolute", top: 0, right: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 20, border: "1px solid var(--border)", textDecoration: "none", color: "var(--text-muted)", fontSize: 14, fontWeight: 600, transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "#fff"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>↑ Back</a>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 28 }}>
          {[
            { name: "Chicken Tagine", img: "/moroccan_tagine.png", desc: "Slow-cooked chicken with preserved lemons, olives, and aromatic spices in a traditional clay pot. A cornerstone of Moroccan hospitality.", time: "90 min", difficulty: "Medium", region: "Nationwide" },
            { name: "Royal Couscous", img: "/moroccan_couscous.png", desc: "Hand-rolled semolina steamed to perfection, crowned with seven seasonal vegetables and tender meat. The Friday family feast.", time: "120 min", difficulty: "Medium", region: "Fes" },
            { name: "Sweet Pastilla", img: "/moroccan_pastilla.png", desc: "Crispy layers of warqa pastry filled with spiced almonds, cinnamon, and powdered sugar. A sweet-savory Moroccan masterpiece.", time: "75 min", difficulty: "Hard", region: "Fes" },
          ].map((dish, i) => (
            <div key={i} className="stagger-child" onClick={onStartCooking} style={{
              borderRadius: 24, overflow: "hidden", background: "#fff", border: "1px solid var(--border)",
              cursor: "pointer", transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.06)"
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-8px)"; e.currentTarget.style.boxShadow = "0 20px 48px rgba(0,0,0,0.14)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.06)"; }}
            >
              <div style={{ height: 220, overflow: "hidden", position: "relative" }}>
                <img src={dish.img} alt={dish.name} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }}
                  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.08)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                />
                <div style={{ position: "absolute", bottom: 12, left: 12, display: "flex", gap: 6 }}>
                  <span style={{ padding: "4px 12px", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", borderRadius: 12, fontSize: 11, color: "#fff", fontWeight: 600 }}>⏱ {dish.time}</span>
                  <span style={{ padding: "4px 12px", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", borderRadius: 12, fontSize: 11, color: "#fff", fontWeight: 600 }}>{dish.difficulty}</span>
                </div>
              </div>
              <div style={{ padding: "24px 24px 28px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 600, color: "var(--text-main)" }}>{dish.name}</h3>
                  <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, background: "var(--accent-light)", padding: "3px 10px", borderRadius: 10 }}>📍 {dish.region}</span>
                </div>
                <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>{dish.desc}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--red)", fontSize: 14, fontWeight: 600 }}>
                  Try this recipe
                  <span style={{ transition: "transform 0.2s" }}>→</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ PERSONALIZATION ═══════════════ */}
      <section className="landing-section" style={{ padding: "100px 48px", background: "linear-gradient(180deg, rgba(37,27,21,0.03) 0%, rgba(37,27,21,0) 100%)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 64, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 380px", minWidth: 280 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--accent-light)", padding: "6px 18px", borderRadius: 20, marginBottom: 24 }}>
              <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700, letterSpacing: "0.06em" }}>PERSONALIZED FOR YOU</span>
            </div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(28px, 3.5vw, 44px)", fontWeight: 700, color: "var(--text-main)", marginBottom: 16, lineHeight: 1.2 }}>
              Your Kitchen,<br /><span style={{ color: "var(--accent)" }}>Your Rules</span>
            </h2>
            <p style={{ fontSize: 16, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 28, maxWidth: 440 }}>
              Tell Atlas Kitchen what you love, what you avoid, and your dietary needs. Every recipe and recommendation adapts to your unique taste profile.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { icon: "❤️", label: "Favorite dishes", desc: "Track dishes you love for smarter recommendations" },
                { icon: "🚫", label: "Dishes to avoid", desc: "Never get suggested something you dislike" },
                { icon: "🌿", label: "Dietary needs", desc: "Halal, vegan, gluten-free — always respected" },
                { icon: "✍️", label: "Flavor notes", desc: "Love spicy? Prefer mild? We remember" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "#fff", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-main)", marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual tag mockup */}
          <div style={{ flex: "1 1 400px", minWidth: 280, display: "flex", justifyContent: "center" }}>
            <div style={{
              background: "#fff", borderRadius: 24, padding: "36px 32px", border: "1px solid var(--border)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.06)", maxWidth: 400, width: "100%"
            }}>
              <h4 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 600, color: "var(--text-main)", marginBottom: 20 }}>Your Taste Profile</h4>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 10 }}>❤️ Dishes you love</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {["Tagine", "Couscous", "Bastilla", "Harira"].map(tag => (
                    <span key={tag} style={{ padding: "6px 14px", borderRadius: 16, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 500, boxShadow: "0 2px 8px var(--accent-glow)" }}>{tag}</span>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 10 }}>🌿 Dietary requirements</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {["Halal", "Nut-free"].map(tag => (
                    <span key={tag} style={{ padding: "6px 14px", borderRadius: 16, background: "var(--green)", color: "#fff", fontSize: 13, fontWeight: 500, boxShadow: "0 2px 8px rgba(0,122,94,0.2)" }}>{tag}</span>
                  ))}
                  {["Vegetarian", "Gluten-free", "Low-carb"].map(tag => (
                    <span key={tag} style={{ padding: "6px 14px", borderRadius: 16, background: "var(--bg)", color: "var(--text-main)", fontSize: 13, fontWeight: 500, border: "1px solid var(--border)" }}>{tag}</span>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 10 }}>✍️ Flavor notes</div>
                <div style={{ padding: "10px 14px", borderRadius: 12, background: "var(--bg)", border: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>
                  "I love spicy food, prefer preserved lemons, and enjoy cinnamon in desserts…"
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ FOOTER CTA ═══════════════ */}
      <section className="landing-section" style={{ padding: "100px 48px", textAlign: "center", position: "relative" }}>
        <div style={{ position: "absolute", top: "20%", left: "10%", fontSize: 260, color: "var(--red)", opacity: 0.02, pointerEvents: "none" }}>★</div>
        <div style={{ position: "absolute", bottom: "10%", right: "15%", fontSize: 200, color: "var(--green)", opacity: 0.02, pointerEvents: "none" }}>★</div>

        <div style={{ maxWidth: 640, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>🫕</div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 700, color: "var(--text-main)", marginBottom: 16 }}>
            Ready to Start <span style={{ color: "var(--red)" }}>Cooking</span>?
          </h2>
          <p style={{ fontSize: 17, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 36, maxWidth: 480, margin: "0 auto 36px" }}>
            Join Atlas Kitchen and discover the rich flavors of Morocco — guided by AI, rooted in tradition.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onStartCooking} style={{ padding: "18px 44px", background: "var(--red)", color: "#fff", border: "none", borderRadius: 30, fontSize: 17, fontWeight: 600, cursor: "pointer", boxShadow: "0 8px 28px rgba(193,18,31,0.25)", transition: "all 0.3s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#a33434"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--red)"; e.currentTarget.style.transform = "none"; }}
            >Get Started — It's Free</button>
          </div>
        </div>

        {/* Bottom footer line */}
        <div style={{ marginTop: 80, paddingTop: 28, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🇲🇦</span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Atlas Kitchen — Made with ❤️ in Morocco</span>
        </div>
      </section>
    </div>
  );
}

export default function KitchenApp() {
  injectTheme();

  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("kitchen_user");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState({ liked: [], disliked: [], dietary: [], flavor_notes: "" });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");

  const bottomRef = useRef(null);
  const taRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, activeSession]);
  useEffect(() => { taRef.current?.focus(); }, [activeSession]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const prefsData = await apiFetch(`/api/preferences/${user.userId}`);
        setPrefs(prefsData);
      } catch (e) {
        console.error("Failed to load preferences:", e);
      }

      // Fetch saved sessions from backend
      try {
        const sessData = await apiFetch(`/api/sessions/${user.userId}`);
        if (sessData.sessions && sessData.sessions.length > 0) {
          setSessions(sessData.sessions.map(s => ({ session_id: s.session_id, title: s.title, created_at: s.created_at })));
          const msgs = {};
          sessData.sessions.forEach(s => {
            msgs[s.session_id] = (s.messages || []).map(m => {
              if (m.role === "assistant") {
                return {
                  ...m,
                  id: m.id || crypto.randomUUID(),
                  content: m.content || m.final_response || "No response.",
                  recommendedRecipes: m.recommendedRecipes || m.recommended_recipes || [],
                  iterationCount: m.iterationCount ?? m.iteration_count ?? null,
                  styleChoice: m.styleChoice ?? m.style_choice ?? "",
                };
              }
              return { ...m, id: m.id || crypto.randomUUID() };
            });
          });
          setMessages(msgs);
          setActiveSession(sessData.sessions[0].session_id);
        } else {
          createNewSession();
        }
      } catch (e) {
        console.error("Failed to load sessions:", e);
        createNewSession();
      }
    })();
  }, [user]);

  const createNewSession = () => {
    const id = crypto.randomUUID();
    const sess = { session_id: id, title: "New Culinary Journey", created_at: new Date().toISOString() };
    setSessions(prev => [sess, ...prev]);
    setActiveSession(id);
    setMessages(prev => ({ ...prev, [id]: [] }));
    return id;
  };

  const deleteSession = async (id, e) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/sessions/${user.userId}/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete session from backend:", err);
    }

    // Safely update state without nesting setters
    const nextSessions = sessions.filter(s => s.session_id !== id);

    if (activeSession === id) {
      if (nextSessions.length > 0) {
        setActiveSession(nextSessions[0].session_id);
      } else {
        const newId = crypto.randomUUID();
        const sess = { session_id: newId, title: "New Culinary Journey", created_at: new Date().toISOString() };
        setSessions([sess]);
        setActiveSession(newId);
        setMessages(prev => ({ ...prev, [id]: undefined, [newId]: [] }));
        return;
      }
    }

    setSessions(nextSessions);
    setMessages(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput("");
    if (taRef.current) { taRef.current.style.height = "auto"; }

    const sessId = activeSession;
    const userMsg = { role: "user", content, id: crypto.randomUUID() };
    setMessages(prev => ({ ...prev, [sessId]: [...(prev[sessId] || []), userMsg] }));

    setSessions(prev => prev.map(s =>
      s.session_id === sessId && s.title.includes("New")
        ? { ...s, title: content.slice(0, 35) + (content.length > 35 ? "…" : "") }
        : s
    ));

    const thinkMsg = { role: "assistant", content: "", thinking: true, id: crypto.randomUUID() };
    setMessages(prev => ({ ...prev, [sessId]: [...(prev[sessId] || []), thinkMsg] }));
    setLoading(true);
    abortControllerRef.current = new AbortController();

    try {
      const data = await apiFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ user_id: user.userId, session_id: sessId, message: content }),
        signal: abortControllerRef.current.signal
      });

      const aiMsg = {
        role: "assistant",
        content: data.final_response || "No response.",
        id: crypto.randomUUID(),
        recipe: data.recipe || null,
        recommendedRecipes: data.recommended_recipes || [],
        nutrition: data.nutrition || null,
        iterationCount: data.iteration_count ?? null,
        waiting: data.waiting ?? false,
        styleChoice: data.style_choice ?? "",
      };

      setMessages(prev => {
        const arr = [...(prev[sessId] || [])];
        arr[arr.length - 1] = aiMsg;
        return { ...prev, [sessId]: arr };
      });

      if (data.recipe?.name || data.recipe?.title) {
        setSessions(prev => prev.map(s => s.session_id === sessId ? { ...s, title: `🍴 ${data.recipe.name || data.recipe.title}` } : s));
      }

    } catch (e) {
      if (e.name === "AbortError") {
        setMessages(prev => {
          const arr = [...(prev[sessId] || [])];
          // remove thinking msg
          const filtered = arr.filter(m => !m.thinking);
          return { ...prev, [sessId]: [...filtered, { role: "assistant", content: "*Process stopped by user.*", id: crypto.randomUUID() }] };
        });
      } else {
        setMessages(prev => {
          const arr = [...(prev[sessId] || [])];
          arr[arr.length - 1] = { role: "assistant", content: `System Error: ${e.message}`, id: crypto.randomUUID() };
          return { ...prev, [sessId]: arr };
        });
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [input, loading, activeSession, user]);

  const handleAuth = (u) => {
    localStorage.setItem("kitchen_user", JSON.stringify(u));
    setUser(u);
  };

  const handleSignOut = () => {
    localStorage.removeItem("kitchen_user");
    setUser(null);
    setSessions([]);
    setMessages({});
  };

  if (!user) {
    if (showAuth) {
      return (
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowAuth(false)} style={{ position: "absolute", top: 24, left: 24, padding: "10px 16px", borderRadius: 20, border: "1px solid var(--border)", background: "#fff", cursor: "pointer", zIndex: 100, display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
            <span style={{ display: "flex", transform: "rotate(90deg)" }}><IcChevron /></span> Back
          </button>
          <AuthScreen onAuth={handleAuth} initialMode={authMode} />
        </div>
      );
    }
    return <LandingPage onStartCooking={() => { setAuthMode("login"); setShowAuth(true); }} onCreateAccount={() => { setAuthMode("register"); setShowAuth(true); }} />;
  }

  const currentMsgs = messages[activeSession] || [];

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <div style={{
        width: sidebarOpen ? 280 : 0, minWidth: sidebarOpen ? 280 : 0,
        transition: "all .4s cubic-bezier(0.16, 1, 0.3, 1)",
        overflow: "hidden", display: "flex", flexDirection: "column", flexShrink: 0,
        background: "var(--surface)"
      }}>
        <div style={{ width: 280, display: "flex", flexDirection: "column", height: "100%" }}>

          {/* Brand + New Chat */}
          <div style={{ padding: "24px 20px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
              <span style={{ fontSize: 24 }}>🫕</span>
              <div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: "var(--text-light)", letterSpacing: "0.02em", fontWeight: 600 }}>ATLAS KITCHEN</div>
                <div style={{ fontSize: 10, color: "var(--red)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>MOROCCAN & BEYOND</div>
              </div>
            </div>
            <button onClick={createNewSession} style={{
              width: "100%", padding: "12px", borderRadius: 8, background: "var(--red)",
              border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer",
              transition: "background 0.2s"
            }} onMouseEnter={e => e.currentTarget.style.background = "#a33434"} onMouseLeave={e => e.currentTarget.style.background = "var(--red)"}>
              <IcPlus /> New Culinary Journey
            </button>
          </div>

          {/* Session list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, padding: "0 8px 12px" }}>
              RECENT SESSIONS
            </div>
            {sessions.map(sess => {
              const isActive = sess.session_id === activeSession;
              const cleanTitle = sess.title.replace(/^[\p{Emoji}]\s*/u, "");
              return (
                <div key={sess.session_id} onClick={() => setActiveSession(sess.session_id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                    borderRadius: 8, marginBottom: 4, cursor: "pointer", transition: "all .2s cubic-bezier(0.16, 1, 0.3, 1)",
                    background: isActive ? "rgba(193, 18, 31, 0.1)" : "transparent",
                    border: `1px solid ${isActive ? "rgba(193, 18, 31, 0.3)" : "transparent"}`,
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,.03)"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{
                    flex: 1, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    color: isActive ? "var(--red)" : "var(--text-muted)",
                    fontWeight: isActive ? 600 : 400,
                  }}>
                    {cleanTitle}
                  </span>
                  <button onClick={e => deleteSession(sess.session_id, e)} style={{
                    background: "transparent", border: "none", cursor: "pointer",
                    color: "var(--red)", padding: 4, borderRadius: 6, display: "flex",
                    opacity: isActive ? 1 : 0, transition: "opacity .2s",
                  }}>
                    <IcTrash />
                  </button>
                </div>
              );
            })}
          </div>

          {/* User footer */}
          <div style={{ padding: "16px 20px", background: "#1c130d" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: "var(--red)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700, fontSize: 15, flexShrink: 0
              }}>
                {user.username[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-light)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.username}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Gourmet Member</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { label: "Preferences", action: () => setShowPrefs(true) },
                { label: "Sign out", action: handleSignOut, icon: <IcLogout /> },
              ].map(({ label, action, icon }) => (
                <button key={label} onClick={action} style={{
                  flex: 1, padding: "8px", background: "transparent", border: "1px solid #33251a",
                  borderRadius: 8, cursor: "pointer", color: "var(--text-muted)", fontFamily: "inherit",
                  fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all 0.2s"
                }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Main area ────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>

        {/* Header */}
        <div style={{
          padding: "20px 32px", display: "flex", alignItems: "center", gap: 16, zIndex: 10,
          borderBottom: "1px solid var(--border-strong)"
        }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "#fff", border: "1px solid var(--border-strong)", cursor: "pointer", color: "var(--text-muted)", padding: 8, borderRadius: 8, display: "flex", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "#f9f9f9"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
            <IcMenu />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: "var(--text-main)", fontWeight: 600, letterSpacing: "0.02em" }}>
              {sessions.find(s => s.session_id === activeSession)?.title?.replace(/^[\p{Emoji}]\s*/u, "") || "New Culinary Journey"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>Always ready to cook and inspire</div>
          </div>
          <button onClick={() => setShowPrefs(true)} style={{
            padding: "8px 16px", borderRadius: 20, background: "#fff", border: "1px solid var(--border-strong)",
            cursor: "pointer", color: "var(--red)", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "background 0.2s"
          }} onMouseEnter={e => e.currentTarget.style.background = "#fafafa"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
            <IcHeart f={prefs.liked?.length > 0} /> Profile
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "40px 32px 16px" }}>
          {currentMsgs.length === 0 ? (
            <div className="fade-up" style={{ textAlign: "center", paddingTop: 40, maxWidth: 900, margin: "0 auto", position: "relative" }}>
              {/* Star faint background element */}
              <div style={{ position: "absolute", top: "10%", left: "-10%", fontSize: 300, color: "var(--accent)", opacity: 0.02, pointerEvents: "none", zIndex: 0 }}>★</div>
              <div style={{ position: "absolute", top: "50%", right: "-10%", fontSize: 200, color: "var(--green)", opacity: 0.02, pointerEvents: "none", zIndex: 0 }}>★</div>

              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(193, 18, 31, 0.08)", padding: "8px 18px", borderRadius: 24, marginBottom: 28, position: "relative", zIndex: 1 }}>
                <span style={{ fontSize: 14 }}>🇲🇦</span>
                <span style={{ fontSize: 12, color: "var(--red)", fontWeight: 700, letterSpacing: "0.05em" }}>ATLAS KITCHEN</span>
              </div>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 44, color: "var(--text-main)", fontWeight: 600, marginBottom: 18, position: "relative", zIndex: 1, letterSpacing: "0.01em" }}>
                What shall we create today?
              </h2>
              <p style={{ color: "var(--text-muted)", marginBottom: 44, fontSize: 16, lineHeight: 1.6, maxWidth: 620, margin: "0 auto 44px", position: "relative", zIndex: 1 }}>
                Discover the rich flavors of Morocco. Ask for a traditional recipe, ingredient substitutions, or let me adapt your favorite dishes with a Moroccan twist.
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: 20, position: "relative", zIndex: 1, flexWrap: "wrap" }}>
                {IMAGE_SUGGESTIONS.map((sug, i) => (
                  <button key={i} onClick={() => sendMessage(sug.title)} style={{
                    width: 200, padding: 0, borderRadius: 18, background: "#fff", border: "1px solid var(--border-strong)",
                    cursor: "pointer", transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)", overflow: "hidden", display: "flex", flexDirection: "column",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.05)"
                  }} onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = "0 12px 28px rgba(0,0,0,0.12)"; }} onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.05)"; }}>
                    <div style={{ height: 140, width: "100%", position: "relative", overflow: "hidden" }}>
                      <img src={sug.img} alt={sug.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, display: "flex" }}>
                        <div style={{ flex: 1, background: "var(--red)" }} />
                        <div style={{ flex: 1, background: "var(--green)" }} />
                      </div>
                    </div>
                    <div style={{ padding: "16px", fontWeight: 600, fontSize: 14, color: "var(--text-main)", textAlign: "center" }}>
                      {sug.title}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", paddingBottom: 12 }}>{sug.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            currentMsgs.map(msg => <Bubble key={msg.id} msg={msg} onSend={sendMessage} />)
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div style={{ padding: "20px 32px 28px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
          <div style={{
            display: "flex", gap: 12, alignItems: "flex-end",
            borderRadius: 24, padding: "12px 20px 12px 24px",
            background: "#fff",
            border: "1px solid var(--border-strong)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.04)"
          }}>
            <textarea ref={taRef} value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask for a recipe or ingredient swap..."
              rows={1}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                resize: "none", color: "var(--text-main)", fontSize: 15, lineHeight: 1.5,
                maxHeight: 120, overflow: "auto", fontFamily: "inherit"
              }}
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {loading && (
                <button onClick={() => {
                  if (abortControllerRef.current) {
                    abortControllerRef.current.abort();
                  }
                }} style={{
                  width: 40, height: 40, borderRadius: "50%", flexShrink: 0, border: "none",
                  background: "rgba(201, 64, 64, 0.1)", color: "var(--red)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s"
                }}>
                  <IcStop />
                </button>
              )}
              <button onClick={() => sendMessage()} disabled={!input.trim() || loading} style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0, border: "none",
                background: input.trim() && !loading ? "var(--accent)" : "#f0ebe0",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: input.trim() && !loading ? "#fff" : "#b0a090",
                cursor: input.trim() && !loading ? "pointer" : "not-allowed", transition: "all .2s",
                boxShadow: input.trim() && !loading ? "0 4px 12px var(--accent-glow)" : "none"
              }} onMouseEnter={e => input.trim() && !loading && (e.currentTarget.style.background = "var(--accent-hover)")} onMouseLeave={e => input.trim() && !loading && (e.currentTarget.style.background = "var(--accent)")}>
                {loading ? <span className="spin"><IcLoader /></span> : <IcSend />}
              </button>
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "var(--text-hint)" }}>
            Enter to send · Shift+Enter for new line
          </div>
        </div>

      </div>

      {showPrefs && (
        <PrefsPanel
          userId={user.userId}
          prefs={prefs}
          onSaved={p => setPrefs(p)}
          onClose={() => setShowPrefs(false)}
        />
      )}
    </div>
  );
}