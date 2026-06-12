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

    /* Accent */
    --accent:          #cd6c32;   /* Vibrant Harissa Orange */
    --accent-hover:    #b55d28;
    --accent-light:    rgba(200, 104, 50, 0.10);
    --accent-glow:     rgba(200, 104, 50, 0.20);

    /* Status */
    --green:           #3d8a4a;
    --green-light:     rgba(61, 138, 74, 0.10);
    --red:             #c94040;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text-main);
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    height: 100vh;
    overflow: hidden;
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div className="card fade-up" style={{ width: 420, padding: "44px 40px", borderRadius: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>🫕</div>
          <h1 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 32, color: "var(--text-main)", marginBottom: 6, fontWeight: 600, letterSpacing: "0.01em" }}>ATLAS KITCHEN</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Your Moroccan culinary guide</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", background: "var(--bg)", borderRadius: 10, padding: 4, marginBottom: 24, border: "1px solid var(--border)" }}>
          {["login", "register"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
              flex: 1, padding: "9px", border: "none", borderRadius: 8, cursor: "pointer",
              fontFamily: "inherit", fontSize: 14, fontWeight: 600,
              background: mode === m ? "#fff" : "transparent",
              color: mode === m ? "var(--accent)" : "var(--text-muted)",
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
          width: "100%", padding: "13px", marginTop: 10, background: "var(--accent)", border: "none",
          borderRadius: 12, cursor: loading ? "not-allowed" : "pointer", color: "#fff",
          fontFamily: "inherit", fontSize: 15, fontWeight: 600, letterSpacing: "0.01em",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          opacity: loading ? 0.85 : 1, transition: "all .2s",
          boxShadow: "0 3px 12px var(--accent-glow)",
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
    width: "100%", padding: "12px 16px", background: "#faf7f2",
    border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-main)",
    fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box", transition: "border-color 0.2s"
  };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", backdropFilter: "blur(4px)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div className="card fade-up" style={{
        width: 500, maxHeight: "85vh", overflowY: "auto", background: "#ffffff",
        borderRadius: 24, padding: "36px 40px", boxShadow: "0 10px 40px rgba(0,0,0,0.15)"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <h2 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 26, color: "var(--text-main)", fontWeight: 600 }}>Dietary Profile</h2>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "50%", padding: 8, cursor: "pointer", color: "var(--text-muted)", display: "flex", transition: "background 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--surface-hover)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          ><IcX /></button>
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={labelStyle}>❤️ Dishes you love</label>
          <input value={liked} onChange={e => setLiked(e.target.value)} placeholder="e.g. Tagine, Couscous, Bastilla" style={fieldStyle}
            onFocus={e => e.target.style.borderColor = "var(--accent)"} onBlur={e => e.target.style.borderColor = "var(--border)"} />
          <p style={{ fontSize: 12, color: "var(--text-hint)", marginTop: 6 }}>Comma-separated values</p>
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={labelStyle}>🚫 Dishes you avoid</label>
          <input value={disliked} onChange={e => setDisliked(e.target.value)} placeholder="e.g. Tripe, Liver" style={fieldStyle}
            onFocus={e => e.target.style.borderColor = "var(--accent)"} onBlur={e => e.target.style.borderColor = "var(--border)"} />
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={labelStyle}>🌿 Dietary requirements</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {DIETARY_OPTS.map(opt => (
              <button key={opt} onClick={() => toggle(opt)} style={{
                padding: "8px 16px", borderRadius: 20, border: "1px solid",
                borderColor: dietary.includes(opt) ? "var(--accent)" : "var(--border)",
                background: dietary.includes(opt) ? "var(--accent)" : "var(--bg)",
                color: dietary.includes(opt) ? "#fff" : "var(--text-main)",
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
            onFocus={e => e.target.style.borderColor = "var(--accent)"} onBlur={e => e.target.style.borderColor = "var(--border)"}
          />
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 14, background: "#fff", border: "1px solid var(--border)",
            borderRadius: 14, cursor: "pointer", color: "var(--text-main)", fontFamily: "inherit", fontSize: 14, fontWeight: 500,
            transition: "background 0.2s"
          }} onMouseEnter={e => e.currentTarget.style.background = "var(--surface-hover)"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>Cancel</button>

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
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 8 }}>💡 Suggestions</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {msg.recommendedRecipes.slice(0, 3).map((r, i) => (
                    <span key={i} onClick={() => onSend && onSend(r.name)} style={{
                      padding: "6px 14px", background: "rgba(200,112,40,.08)",
                      border: "1px solid rgba(200, 104, 50, 0.2)", borderRadius: 20,
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
  { title: "Chicken Tagine", img: "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&q=80&w=400" },
  { title: "Royal Couscous", img: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&q=80&w=400" },
  { title: "Sweet Pastilla", img: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&q=80&w=400" }
];

function LandingPage({ onStartCooking, onCreateAccount }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", position: "relative", overflowX: "hidden", overflowY: "auto" }}>
      {/* Background faint stars */}
      <div style={{ position: "absolute", top: "5%", left: "5%", fontSize: 400, color: "var(--red)", opacity: 0.03, pointerEvents: "none", zIndex: 0 }}>★</div>
      <div style={{ position: "absolute", bottom: "10%", right: "20%", fontSize: 300, color: "var(--green)", opacity: 0.03, pointerEvents: "none", zIndex: 0 }}>★</div>
      <div style={{ position: "absolute", bottom: "-5%", left: "30%", fontSize: 200, color: "var(--red)", opacity: 0.02, pointerEvents: "none", zIndex: 0 }}>★</div>

      <div style={{ padding: "24px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>🫕</div>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 700, color: "var(--text-main)", letterSpacing: "0.02em" }}>ATLAS KITCHEN</div>
            <div style={{ fontSize: 11, color: "var(--red)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>MOROCCAN CULINARY AI</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button style={{ width: 40, height: 40, background: "var(--red)", borderRadius: 8, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(201, 64, 64, 0.2)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
          </button>
          <button onClick={onStartCooking} style={{ padding: "10px 24px", background: "var(--red)", color: "#fff", border: "none", borderRadius: 30, fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 4px 12px rgba(201, 64, 64, 0.2)" }} onMouseEnter={e => { e.currentTarget.style.background = "#a33434"; }} onMouseLeave={e => { e.currentTarget.style.background = "var(--red)"; }}>
            Get Started
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, padding: "48px 48px 80px", alignItems: "center", gap: 64, maxWidth: 1400, margin: "0 auto", width: "100%", zIndex: 1, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 400px", minWidth: 300 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(201, 64, 64, 0.08)", border: "1px solid rgba(201, 64, 64, 0.15)", padding: "6px 16px", borderRadius: 20, marginBottom: 32 }}>
            <span style={{ fontSize: 14 }}>🇲🇦</span>
            <span style={{ fontSize: 13, color: "var(--red)", fontWeight: 600 }}>Made with ❤️ in Morocco</span>
          </div>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 64, fontWeight: 700, lineHeight: 1.1, color: "var(--text-main)", marginBottom: 24 }}>
            Discover the<br />
            <span style={{ color: "var(--red)" }}>Magic of </span>
            <span style={{ color: "var(--green)" }}>Moroccan</span><br />
            Cuisine
          </h1>
          <p style={{ fontSize: 18, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 40, maxWidth: 500 }}>
            Your personal AI culinary assistant, steeped in centuries of Moroccan tradition. From aromatic tagines to fluffy couscous — let technology meet tradition.
          </p>
          <div style={{ display: "flex", gap: 16 }}>
            <button onClick={onStartCooking} style={{ padding: "16px 32px", background: "var(--red)", color: "#fff", border: "none", borderRadius: 30, fontSize: 16, fontWeight: 600, cursor: "pointer", boxShadow: "0 8px 24px rgba(201, 64, 64, 0.25)", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "#a33434"} onMouseLeave={e => e.currentTarget.style.background = "var(--red)"}>
              Start Cooking →
            </button>
            <button onClick={onCreateAccount} style={{ padding: "16px 32px", background: "transparent", color: "var(--green)", border: "2px solid var(--green)", borderRadius: 30, fontSize: 16, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.background = "var(--green)"; e.currentTarget.style.color = "#fff"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--green)"; }}>
              Create Account
            </button>
          </div>
        </div>
        <div style={{ flex: "1 1 500px", position: "relative", height: 600, minWidth: 300 }}>
          <img src="https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&q=80&w=600" style={{ position: "absolute", top: 20, right: 0, width: 440, height: 440, objectFit: "cover", borderRadius: 24, boxShadow: "0 20px 40px rgba(0,0,0,0.15)", zIndex: 1, animation: "floatSlow 6s ease-in-out infinite", border: "8px solid #fff" }} alt="Tagine" />

          {/* Floating Star badge */}
          <div style={{ position: "absolute", top: 0, right: -20, width: 70, height: 70, borderRadius: "50%", background: "linear-gradient(135deg, rgba(201, 64, 64, 0.85) 0%, rgba(61, 138, 74, 0.85) 100%)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4, color: "#fff", boxShadow: "0 10px 20px rgba(0,0,0,0.2)", animation: "floatFast 4s ease-in-out infinite" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
          </div>

          <img src="https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&q=80&w=400" style={{ position: "absolute", bottom: -20, left: 20, width: 280, height: 280, objectFit: "cover", borderRadius: 24, border: "8px solid #fff", boxShadow: "0 20px 40px rgba(0,0,0,0.15)", zIndex: 2, animation: "floatMedium 5s ease-in-out infinite" }} alt="Couscous" />
          <img src="https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&q=80&w=300" style={{ position: "absolute", bottom: 40, right: -40, width: 200, height: 200, objectFit: "cover", borderRadius: 24, border: "8px solid #fff", boxShadow: "0 20px 40px rgba(0,0,0,0.15)", zIndex: 3, animation: "floatFast 4.5s ease-in-out infinite" }} alt="Pastilla" />
        </div>
      </div>
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
                <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>MOROCCAN & BEYOND</div>
              </div>
            </div>
            <button onClick={createNewSession} style={{
              width: "100%", padding: "12px", borderRadius: 8, background: "var(--accent)",
              border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer",
              transition: "background 0.2s"
            }} onMouseEnter={e => e.currentTarget.style.background = "var(--accent-hover)"} onMouseLeave={e => e.currentTarget.style.background = "var(--accent)"}>
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
                    background: isActive ? "rgba(200, 104, 50, 0.1)" : "transparent",
                    border: `1px solid ${isActive ? "rgba(200, 104, 50, 0.3)" : "transparent"}`,
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
                    background: "transparent", border: "none", cursor: "pointer",
                    color: "var(--accent)", padding: 4, borderRadius: 6, display: "flex",
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
                width: 36, height: 36, borderRadius: 8, background: "var(--accent)",
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
          padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, zIndex: 10,
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
            cursor: "pointer", color: "var(--accent)", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "background 0.2s"
          }} onMouseEnter={e => e.currentTarget.style.background = "#fafafa"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
            <IcHeart f={prefs.liked?.length > 0} /> Profile {prefs.liked?.length > 0 && `(${prefs.liked.length})`}
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "32px 32px 16px" }}>
          {currentMsgs.length === 0 ? (
            <div className="fade-up" style={{ textAlign: "center", paddingTop: 60, maxWidth: 800, margin: "0 auto", position: "relative" }}>
              {/* Star faint background element */}
              <div style={{ position: "absolute", top: "10%", left: "-10%", fontSize: 300, color: "var(--accent)", opacity: 0.03, pointerEvents: "none", zIndex: 0 }}>★</div>
              <div style={{ position: "absolute", top: "50%", right: "-10%", fontSize: 200, color: "var(--green)", opacity: 0.03, pointerEvents: "none", zIndex: 0 }}>★</div>

              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(200, 104, 50, 0.08)", padding: "6px 16px", borderRadius: 20, marginBottom: 24, position: "relative", zIndex: 1 }}>
                <span style={{ fontSize: 14 }}>🇲🇦</span>
                <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700, letterSpacing: "0.05em" }}>ATLAS KITCHEN</span>
              </div>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 36, color: "var(--text-main)", fontWeight: 600, marginBottom: 16, position: "relative", zIndex: 1 }}>
                What shall we create today?
              </h2>
              <p style={{ color: "var(--text-muted)", marginBottom: 40, fontSize: 15, lineHeight: 1.6, maxWidth: 600, margin: "0 auto 40px", position: "relative", zIndex: 1 }}>
                Discover the rich flavors of Morocco. Ask for a traditional recipe, ingredient substitutions, or let me adapt your favorite dishes with a Moroccan twist.
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: 16, position: "relative", zIndex: 1 }}>
                {IMAGE_SUGGESTIONS.map((sug, i) => (
                  <button key={i} onClick={() => sendMessage(sug.title)} style={{
                    width: 220, padding: 0, borderRadius: 16, background: "#fff", border: "1px solid var(--border-strong)",
                    cursor: "pointer", transition: "all 0.2s", overflow: "hidden", display: "flex", flexDirection: "column",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.04)"
                  }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-4px)"} onMouseLeave={e => e.currentTarget.style.transform = "none"}>
                    <div style={{ height: 130, width: "100%", position: "relative" }}>
                      <img src={sug.img} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={sug.title} />
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: i === 0 ? "var(--red)" : i === 1 ? "var(--green)" : "var(--accent)" }} />
                    </div>
                    <div style={{ padding: "16px", fontWeight: 600, fontSize: 14, color: "var(--text-main)", textAlign: "center" }}>
                      {sug.title}
                    </div>
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
        <div style={{ padding: "0 24px 24px", maxWidth: 800, margin: "0 auto", width: "100%" }}>
          <div style={{
            display: "flex", gap: 12, alignItems: "center",
            borderRadius: 40, padding: "8px 8px 8px 24px",
            background: "#fff",
            border: "1px solid var(--border-strong)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
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
            <div style={{ display: "flex", gap: 8 }}>
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
                background: input.trim() && !loading ? "#e8e1d5" : "#f0ebe0",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: input.trim() && !loading ? "#7c6853" : "#b0a090",
                cursor: input.trim() && !loading ? "pointer" : "not-allowed", transition: "all .2s",
              }}>
                {loading ? <span className="spin"><IcLoader /></span> : <IcSend />}
              </button>
            </div>
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