import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ── Theme (dark, warm Moroccan palette, premium glassmorphism) ──────────────
const theme = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700&display=swap');
  
  :root {
    --bg-dark: #0f0b08;
    --bg-gradient: radial-gradient(circle at top right, #24140c 0%, #0f0b08 60%);
    
    --surface-glass: rgba(30, 22, 17, 0.65);
    --surface-glass-hover: rgba(45, 33, 26, 0.75);
    --surface-glass-solid: rgba(26, 19, 15, 0.95);
    
    --border-glass: rgba(200, 112, 40, 0.15);
    --border-glass-strong: rgba(200, 112, 40, 0.3);
    
    --text-main: #fcf8f2;
    --text-muted: #b8aba2;
    --text-hint: #7d7065;
    
    --accent: #d87c2a;
    --accent-hover: #e88c3a;
    --accent-glow: rgba(216, 124, 42, 0.25);
    
    --green: #459a53;
    --green-glow: rgba(69, 154, 83, 0.15);
    --red: #c94040;
  }
  
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  body {
    background: var(--bg-dark);
    background-image: var(--bg-gradient);
    color: var(--text-main);
    font-family: 'Outfit', sans-serif;
    height: 100vh;
    overflow: hidden;
  }
  
  /* Modern scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { 
    background: rgba(255,255,255,0.1); 
    border-radius: 10px; 
  }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
  
  /* Animations */
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { 
    from { opacity: 0; transform: translateY(15px); filter: blur(4px); } 
    to { opacity: 1; transform: none; filter: blur(0); } 
  }
  @keyframes shimmer { 0%,100% { opacity:.4; } 50% { opacity:1; } }
  @keyframes pulseGlow {
    0% { box-shadow: 0 0 0 0 var(--accent-glow); }
    70% { box-shadow: 0 0 0 10px rgba(0,0,0,0); }
    100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); }
  }
  
  .spin { animation: spin .85s linear infinite; display: inline-block; }
  .fade-up { animation: fadeUp .4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  
  /* Glass pane utility */
  .glass-pane {
    background: var(--surface-glass);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--border-glass);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  /* Markdown Styles */
  .markdown-body {
    line-height: 1.6;
    font-size: 15px;
  }
  .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
    margin-top: 1.2em;
    margin-bottom: 0.6em;
    font-family: 'DM Serif Display', serif;
    color: var(--accent);
    font-weight: 500;
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
    background: rgba(0,0,0,0.15);
    border-radius: 8px;
    overflow: hidden;
  }
  .markdown-body th, .markdown-body td {
    border: 1px solid var(--border-glass);
    padding: 10px 14px;
    text-align: left;
  }
  .markdown-body th {
    background: rgba(216, 124, 42, 0.15);
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
  .markdown-body em {
    color: var(--text-muted);
    font-style: italic;
  }
  .markdown-body blockquote {
    border-left: 3px solid var(--accent);
    padding: 8px 14px;
    margin: 1em 0;
    color: var(--text-hint);
    background: rgba(216, 124, 42, 0.05);
    border-radius: 0 8px 8px 0;
  }
  .markdown-body hr {
    border: 0;
    height: 1px;
    background: var(--border-glass-strong);
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
const IcLoader = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

// ── Auth Screen ───────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
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
    background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-glass-strong)",
    borderRadius: 14, color: "var(--text-main)", fontSize: 15,
    padding: "14px 14px 14px 46px", width: "100%", outline: "none",
    fontFamily: "inherit", transition: "border-color 0.2s"
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="glass-pane fade-up" style={{
        width: 440, padding: "50px 40px", borderRadius: 28,
      }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 52, marginBottom: 16, filter: "drop-shadow(0 4px 12px var(--accent-glow))" }}>✨</div>
          <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 34, color: "var(--text-main)", marginBottom: 8, letterSpacing: "0.02em" }}>Kitchen AI</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 15, fontWeight: 300 }}>Your premium Moroccan culinary guide</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: 5, marginBottom: 28, border: "1px solid var(--border-glass)" }}>
          {["login", "register"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
              flex: 1, padding: "10px", border: "none", borderRadius: 8, cursor: "pointer",
              fontFamily: "inherit", fontSize: 14, fontWeight: 600,
              background: mode === m ? "var(--accent)" : "transparent",
              color: mode === m ? "#fff" : "var(--text-muted)",
              transition: "all .2s cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: mode === m ? "0 4px 12px var(--accent-glow)" : "none",
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
              onBlur={e => e.target.style.borderColor = "var(--border-glass-strong)"}
            />
          </div>
        ))}

        {error && <p style={{ color: "var(--red)", fontSize: 13, textAlign: "center", margin: "8px 0 12px" }}>{error}</p>}

        <button onClick={submit} disabled={loading} style={{
          width: "100%", padding: "15px", marginTop: 12, background: "var(--accent)", border: "none",
          borderRadius: 14, cursor: loading ? "not-allowed" : "pointer", color: "#fff",
          fontFamily: "inherit", fontSize: 15, fontWeight: 600, letterSpacing: "0.02em",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          opacity: loading ? 0.8 : 1, transition: "all .2s",
          boxShadow: "0 4px 20px var(--accent-glow)",
        }}
          onMouseEnter={e => !loading && (e.currentTarget.style.background = "var(--accent-hover)")}
          onMouseLeave={e => !loading && (e.currentTarget.style.background = "var(--accent)")}
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
    width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.25)",
    border: "1px solid var(--border-glass-strong)", borderRadius: 12, color: "var(--text-main)",
    fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box", transition: "border-color 0.2s"
  };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", backdropFilter: "blur(6px)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div className="glass-pane fade-up" style={{
        width: 500, maxHeight: "85vh", overflowY: "auto",
        borderRadius: 24, padding: "36px 40px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 26, color: "var(--text-main)", fontWeight: 400 }}>Dietary Profile</h2>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: "50%", padding: 8, cursor: "pointer", color: "var(--text-muted)", display: "flex", transition: "background 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          ><IcX /></button>
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={labelStyle}>❤️ Dishes you love</label>
          <input value={liked} onChange={e => setLiked(e.target.value)} placeholder="e.g. Tagine, Couscous, Bastilla" style={fieldStyle}
            onFocus={e => e.target.style.borderColor = "var(--accent)"} onBlur={e => e.target.style.borderColor = "var(--border-glass-strong)"} />
          <p style={{ fontSize: 12, color: "var(--text-hint)", marginTop: 6 }}>Comma-separated values</p>
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={labelStyle}>🚫 Dishes you avoid</label>
          <input value={disliked} onChange={e => setDisliked(e.target.value)} placeholder="e.g. Tripe, Liver" style={fieldStyle}
            onFocus={e => e.target.style.borderColor = "var(--accent)"} onBlur={e => e.target.style.borderColor = "var(--border-glass-strong)"} />
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={labelStyle}>🌿 Dietary requirements</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {DIETARY_OPTS.map(opt => (
              <button key={opt} onClick={() => toggle(opt)} style={{
                padding: "8px 16px", borderRadius: 20, border: "1px solid",
                borderColor: dietary.includes(opt) ? "var(--accent)" : "var(--border-glass-strong)",
                background: dietary.includes(opt) ? "var(--accent)" : "rgba(0,0,0,0.2)",
                color: dietary.includes(opt) ? "#fff" : "var(--text-muted)",
                cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "inherit", transition: "all .2s cubic-bezier(0.16, 1, 0.3, 1)",
                boxShadow: dietary.includes(opt) ? "0 4px 12px var(--accent-glow)" : "none",
              }}>{opt}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 32 }}>
          <label style={labelStyle}>✍️ Flavor notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. I love spicy food, prefer mild cumin, no coriander…"
            rows={3} style={{ ...fieldStyle, resize: "vertical" }}
            onFocus={e => e.target.style.borderColor = "var(--accent)"} onBlur={e => e.target.style.borderColor = "var(--border-glass-strong)"}
          />
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 14, background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-glass-strong)",
            borderRadius: 14, cursor: "pointer", color: "var(--text-main)", fontFamily: "inherit", fontSize: 14, fontWeight: 500,
            transition: "background 0.2s"
          }} onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.5)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.3)"}>Cancel</button>

          <button onClick={save} disabled={saving} style={{
            flex: 2, padding: 14, background: "var(--accent)", border: "none",
            borderRadius: 14, cursor: "pointer", color: "#fff", fontFamily: "inherit",
            fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: "0 4px 16px var(--accent-glow)", transition: "all 0.2s"
          }} onMouseEnter={e => !saving && (e.currentTarget.style.background = "var(--accent-hover)")} onMouseLeave={e => !saving && (e.currentTarget.style.background = "var(--accent)")}>
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
  const totalPrice = recipe.total_price;

  const sectionLabel = {
    color: "var(--accent)", display: "block", marginBottom: 10,
    fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700,
  };

  return (
    <div style={{ marginTop: 16, background: "rgba(0,0,0,0.2)", borderRadius: 16, border: "1px solid var(--border-glass-strong)", overflow: "hidden", transition: "all 0.3s" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: open ? "rgba(255,255,255,0.03)" : "transparent", border: "none", cursor: "pointer",
        color: "var(--text-main)", fontFamily: "inherit", fontSize: 15, fontWeight: 600, transition: "background 0.2s"
      }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"} onMouseLeave={e => e.currentTarget.style.background = open ? "rgba(255,255,255,0.03)" : "transparent"}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>📋</span> {recipe.name || recipe.title || "Recipe Overview"}
          {recipe.servings && <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>· {recipe.servings} servings</span>}
        </span>
        <span style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .3s cubic-bezier(0.16, 1, 0.3, 1)", display: "flex", color: "var(--accent)" }}><IcChevron /></span>
      </button>

      {open && (
        <div style={{ padding: "20px", fontSize: 14, color: "var(--text-main)", lineHeight: 1.7, borderTop: "1px solid var(--border-glass-strong)", background: "rgba(0,0,0,0.1)" }}>

          {/* Cultural note */}
          {recipe.cultural_note && (
            <div style={{ background: "rgba(200,112,40,0.08)", padding: "12px 16px", borderRadius: 12, marginBottom: 20, border: "1px solid var(--border-glass)" }}>
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

              {/* Total price banner */}
              {totalPrice?.amount != null && (
                <div style={{
                  marginTop: 14, padding: "10px 14px", borderRadius: 10,
                  background: "rgba(200,112,40,0.1)", border: "1px solid var(--border-glass-strong)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span style={{ fontSize: 16 }}>💰</span>
                  <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Estimated recipe cost:</span>
                  <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>
                    ~{totalPrice.amount} {totalPrice.currency || "MAD"}
                  </span>
                  <span style={{ color: "var(--text-hint)", fontSize: 11 }}>(market estimate)</span>
                </div>
              )}
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
                          {dur && <span style={{ fontSize: 11, color: "var(--text-hint)", background: "rgba(255,255,255,0.06)", padding: "1px 8px", borderRadius: 10 }}>⏱ {dur}</span>}
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
                  <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(255,255,255,0.03)", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border-glass)" }}>
                    <span style={{ color: "var(--accent)", flexShrink: 0 }}>✦</span>
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{typeof tip === "object" ? JSON.stringify(tip) : String(tip)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pairing */}
          {recipe.pairing && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(200,112,40,0.06)", border: "1px solid var(--border-glass)" }}>
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
        background: isUser ? "var(--accent)" : "var(--surface-glass)",
        backdropFilter: isUser ? "none" : "blur(12px)",
        border: isUser ? "none" : "1px solid var(--border-glass-strong)",
        color: isUser ? "#fff" : "var(--text-main)",
        fontSize: 15, lineHeight: 1.7,
        boxShadow: isUser ? "0 6px 20px var(--accent-glow)" : "0 4px 16px rgba(0,0,0,0.2)",
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

            {/* Quality badge */}
            {msg.criticScore != null && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12,
                padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: msg.criticScore >= 7 ? "var(--green-glow)" : msg.criticScore >= 5 ? "var(--accent-glow)" : "rgba(201, 64, 64, 0.15)",
                color: msg.criticScore >= 7 ? "var(--green)" : msg.criticScore >= 5 ? "var(--accent)" : "var(--red)",
                border: `1px solid ${msg.criticScore >= 7 ? "rgba(69, 154, 83, 0.3)" : msg.criticScore >= 5 ? "var(--border-glass-strong)" : "rgba(201, 64, 64, 0.3)"}`
              }}>
                ⭐ Quality Score: {msg.criticScore}/10 {msg.iterationCount != null ? `| Revisions: ${msg.iterationCount}` : ""}
              </div>
            )}

            {/* Recommended dishes */}
            {msg.recommendedRecipes?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 8 }}>💡 Suggestions</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {msg.recommendedRecipes.slice(0, 3).map((r, i) => (
                    <span key={i} style={{
                      padding: "6px 14px", background: "rgba(200,112,40,.08)",
                      border: "1px solid var(--border-glass-strong)", borderRadius: 20,
                      fontSize: 13, color: "var(--accent)", fontWeight: 500,
                      cursor: "pointer", transition: "all 0.2s"
                    }} onMouseEnter={e => e.currentTarget.style.background = "rgba(200,112,40,.15)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(200,112,40,.08)"}>
                      {r.name}{r.time_minutes ? ` · ${r.time_minutes}m` : ""}
                    </span>
                  ))}
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
                    padding: "5px 12px", background: "rgba(0,0,0,0.2)",
                    borderRadius: 20, border: "1px solid var(--border-glass-strong)",
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
                    padding: "5px 12px", background: "var(--green-glow)", border: "1px solid rgba(69, 154, 83, 0.3)",
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
              <div style={{ marginTop: 20, background: "rgba(200, 112, 40, 0.1)", padding: "16px", borderRadius: 16, border: "1px solid var(--border-glass-strong)" }}>
                <div style={{ fontSize: 13, color: "var(--text-main)", marginBottom: 12, fontWeight: 600 }}>
                  🌍 World Kitchen — Choose your style
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={() => onSend && onSend("Classic")} style={{
                    flex: 1, padding: "10px", borderRadius: 10, background: "rgba(0,0,0,0.3)",
                    border: "1px solid var(--border-glass-strong)", color: "var(--text-main)", cursor: "pointer", transition: "background 0.2s"
                  }} onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.5)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.3)"}>Classic</button>
                  <button onClick={() => onSend && onSend("Moroccan Twist")} style={{
                    flex: 1, padding: "10px", borderRadius: 10, background: "var(--accent)",
                    border: "none", color: "#fff", cursor: "pointer", boxShadow: "0 4px 12px var(--accent-glow)", transition: "background 0.2s"
                  }} onMouseEnter={e => e.currentTarget.style.background = "var(--accent-hover)"} onMouseLeave={e => e.currentTarget.style.background = "var(--accent)"}>Moroccan Twist</button>
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
const SUGGESTIONS = [
  "🫕 Chicken tagine recipe", "🍚 Authentic couscous",
  "🥗 Moroccan salad ideas", "🍕 I want pizza tonight",
  "🧆 Best kefta recipe", "🌿 Vegetarian Moroccan dish",
];

export default function KitchenApp() {
  injectTheme();

  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState({ liked: [], disliked: [], dietary: [], flavor_notes: "" });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const bottomRef = useRef(null);
  const taRef = useRef(null);

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
      } finally {
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

  const deleteSession = (id, e) => {
    e.stopPropagation();
    setSessions(prev => {
      const next = prev.filter(s => s.session_id !== id);
      if (activeSession === id) {
        if (next.length) setActiveSession(next[0].session_id);
        else { const newId = createNewSession(); setActiveSession(newId); }
      }
      return next;
    });
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

    try {
      const data = await apiFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ user_id: user.userId, session_id: sessId, message: content }),
      });

      const aiMsg = {
        role: "assistant",
        content: data.final_response || "No response.",
        id: crypto.randomUUID(),
        recipe: data.recipe || null,
        recommendedRecipes: data.recommended_recipes || [],
        nutrition: data.nutrition || null,
        criticScore: data.critic_score ?? null,
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
      setMessages(prev => {
        const arr = [...(prev[sessId] || [])];
        arr[arr.length - 1] = { role: "assistant", content: `System Error: ${e.message}`, id: crypto.randomUUID() };
        return { ...prev, [sessId]: arr };
      });
    } finally {
      setLoading(false);
    }
  }, [input, loading, activeSession, user]);

  if (!user) return <AuthScreen onAuth={u => { setUser(u); }} />;

  const currentMsgs = messages[activeSession] || [];

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <div className="glass-pane" style={{
        width: sidebarOpen ? 280 : 0, minWidth: sidebarOpen ? 280 : 0,
        transition: "all .4s cubic-bezier(0.16, 1, 0.3, 1)",
        overflow: "hidden", display: "flex", flexDirection: "column", flexShrink: 0,
        borderTop: "none", borderBottom: "none", borderLeft: "none", borderRadius: 0
      }}>
        <div style={{ width: 280, display: "flex", flexDirection: "column", height: "100%" }}>

          {/* Brand + New Chat */}
          <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid var(--border-glass)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ fontSize: 28, filter: "drop-shadow(0 2px 8px var(--accent-glow))" }}>✨</span>
              <div>
                <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, color: "var(--text-main)", letterSpacing: "0.02em" }}>Kitchen AI</div>
                <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>Moroccan Guide</div>
              </div>
            </div>
            <button onClick={createNewSession} style={{
              width: "100%", padding: "12px", borderRadius: 12, background: "var(--accent)",
              border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer",
              boxShadow: "0 4px 16px var(--accent-glow)", transition: "background 0.2s"
            }} onMouseEnter={e => e.currentTarget.style.background = "var(--accent-hover)"} onMouseLeave={e => e.currentTarget.style.background = "var(--accent)"}>
              <IcPlus /> New Culinary Journey
            </button>
          </div>

          {/* Session list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px" }}>
            <div style={{ fontSize: 11, color: "var(--text-hint)", textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, padding: "0 8px 12px" }}>
              Recent Sessions
            </div>
            {sessions.map(sess => {
              const isActive = sess.session_id === activeSession;
              const cleanTitle = sess.title.replace(/^[\p{Emoji}]\s*/u, "");
              return (
                <div key={sess.session_id} onClick={() => setActiveSession(sess.session_id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                    borderRadius: 12, marginBottom: 4, cursor: "pointer", transition: "all .2s cubic-bezier(0.16, 1, 0.3, 1)",
                    background: isActive ? "var(--surface-glass-solid)" : "transparent",
                    border: `1px solid ${isActive ? "var(--border-glass-strong)" : "transparent"}`,
                    boxShadow: isActive ? "0 4px 12px rgba(0,0,0,0.1)" : "none"
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,.03)"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{
                    flex: 1, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    color: isActive ? "var(--accent)" : "var(--text-muted)",
                    fontWeight: isActive ? 600 : 400,
                  }}>
                    {cleanTitle}
                  </span>
                  <button onClick={e => deleteSession(sess.session_id, e)} style={{
                    background: "rgba(201, 64, 64, 0.1)", border: "1px solid rgba(201, 64, 64, 0.2)", cursor: "pointer",
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
          <div style={{ borderTop: "1px solid var(--border-glass)", padding: "16px 20px", background: "rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 12, background: "linear-gradient(135deg, var(--accent) 0%, #a85a1a 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700, fontSize: 15, flexShrink: 0,
                boxShadow: "0 2px 8px var(--accent-glow)"
              }}>
                {user.username[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.username}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Gourmet Member</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { label: "Preferences", action: () => setShowPrefs(true) },
                { label: "Sign out", action: () => { setUser(null); setSessions([]); setMessages({}); }, icon: <IcLogout /> },
              ].map(({ label, action, icon }) => (
                <button key={label} onClick={action} style={{
                  flex: 1, padding: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-glass)",
                  borderRadius: 10, cursor: "pointer", color: "var(--text-muted)", fontFamily: "inherit",
                  fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all 0.2s"
                }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}>
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
        <div className="glass-pane" style={{
          padding: "16px 24px", display: "flex", alignItems: "center", gap: 16,
          borderTop: "none", borderRight: "none", borderLeft: "none", borderRadius: 0, zIndex: 10
        }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-glass)", cursor: "pointer", color: "var(--text-main)", padding: 8, borderRadius: 10, display: "flex", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}>
            <IcMenu />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, color: "var(--text-main)", fontWeight: 400, letterSpacing: "0.02em" }}>
              {sessions.find(s => s.session_id === activeSession)?.title?.replace(/^[\p{Emoji}]\s*/u, "") || "New Culinary Journey"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Always ready to cook and inspire</div>
          </div>
          <button onClick={() => setShowPrefs(true)} style={{
            padding: "10px 16px", borderRadius: 12, background: "rgba(200,112,40,0.1)", border: "1px solid var(--border-glass-strong)",
            cursor: "pointer", color: "var(--accent)", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "background 0.2s"
          }} onMouseEnter={e => e.currentTarget.style.background = "rgba(200,112,40,0.15)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(200,112,40,0.1)"}>
            <IcHeart f={prefs.liked?.length > 0} /> Profile {prefs.liked?.length > 0 && `(${prefs.liked.length})`}
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "32px 32px 16px" }}>
          {currentMsgs.length === 0 ? (
            <div className="fade-up" style={{ textAlign: "center", paddingTop: 80, maxWidth: 600, margin: "0 auto" }}>
              <div style={{ fontSize: 64, marginBottom: 24, filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.5))" }}>🧑‍🍳</div>
              <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 36, color: "var(--text-main)", fontWeight: 400, marginBottom: 16, letterSpacing: "0.02em" }}>
                What shall we create today?
              </h2>
              <p style={{ color: "var(--text-muted)", marginBottom: 40, fontSize: 16, lineHeight: 1.6 }}>
                Discover the rich flavors of Morocco. Ask for a traditional recipe, ingredient substitutions, or let me adapt your favorite dishes with a Moroccan twist.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => sendMessage(s)} style={{
                    padding: "12px 20px", borderRadius: 24, background: "var(--surface-glass)",
                    border: "1px solid var(--border-glass)", cursor: "pointer",
                    color: "var(--text-main)", fontFamily: "inherit", fontSize: 14, fontWeight: 500, transition: "all .2s cubic-bezier(0.16, 1, 0.3, 1)",
                    backdropFilter: "blur(12px)"
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 4px 12px var(--accent-glow)"; e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-glass)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.color = "var(--text-main)"; e.currentTarget.style.transform = "none"; }}
                  >
                    {s}
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
        <div style={{ padding: "0 24px 24px" }}>
          <div className="glass-pane" style={{
            display: "flex", gap: 12, alignItems: "flex-end",
            borderRadius: 20, padding: "12px 16px",
            border: "1px solid var(--border-glass-strong)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)"
          }}>
            <textarea ref={taRef} value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask for a recipe or ingredient swap…"
              rows={1}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                resize: "none", color: "var(--text-main)", fontSize: 15, lineHeight: 1.6,
                maxHeight: 120, overflow: "auto", fontFamily: "inherit",
                padding: "4px 4px 4px 8px"
              }}
            />
            <button onClick={() => sendMessage()} disabled={!input.trim() || loading} style={{
              width: 44, height: 44, borderRadius: 14, flexShrink: 0, border: "none",
              background: input.trim() && !loading ? "var(--accent)" : "rgba(255,255,255,0.05)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: input.trim() && !loading ? "#fff" : "var(--text-muted)",
              cursor: input.trim() && !loading ? "pointer" : "not-allowed", transition: "all .2s cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: input.trim() && !loading ? "0 4px 12px var(--accent-glow)" : "none"
            }}>
              {loading ? <span className="spin"><IcLoader /></span> : <IcSend />}
            </button>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-hint)", textAlign: "center", marginTop: 12, fontWeight: 500 }}>
            Enter to send · Shift+Enter for new line
          </p>
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