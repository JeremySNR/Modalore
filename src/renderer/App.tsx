import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  Download,
  FolderOpen,
  Gamepad2,
  Hammer,
  Library,
  LoaderCircle,
  Menu,
  MoreHorizontal,
  Play,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Square,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import type { Progress, Project, Recipe, Snapshot } from "./api";

type Sample = Recipe & {
  id: string;
  subtitle: string;
  theme: "grove" | "ember" | "night";
};
const samples: Sample[] = [
  {
    id: "wildwood",
    title: "The Wildwood",
    subtitle: "More enemy health, more coins",
    description:
      "Make every expedition feel rewarding with higher enemy health and more generous coin drops.",
    theme: "grove",
    schemaVersion: 1,
    damageMultiplier: 1.15,
    coinMultiplier: 1.5,
    enemyHealthMultiplier: 1.25,
  },
  {
    id: "embers",
    title: "After the embers",
    subtitle: "More enemy health, higher damage",
    description: "Turn up the challenge and make each hard-won victory count.",
    theme: "ember",
    schemaVersion: 1,
    damageMultiplier: 1.35,
    coinMultiplier: 1.4,
    enemyHealthMultiplier: 1.5,
  },
  {
    id: "moonlit",
    title: "Moonlit wanderer",
    subtitle: "Lower enemy health, more coins",
    description:
      "A gentler starting point with lower enemy health and more coins.",
    theme: "night",
    schemaVersion: 1,
    damageMultiplier: 1.15,
    coinMultiplier: 1.25,
    enemyHealthMultiplier: 0.9,
  },
];
type Page = "discover" | "library" | "detail" | "studio" | "setup";
const initial: Snapshot = { projects: [] };

function Art({
  theme,
  className = "",
}: {
  theme: Sample["theme"];
  className?: string;
}) {
  const colors =
    theme === "grove"
      ? ["#d2a566", "#7b8060", "#344d42", "#1e302a"]
      : theme === "ember"
        ? ["#d6a278", "#9f6654", "#5d443e", "#302d2b"]
        : ["#c1b7a0", "#77788a", "#454a5b", "#292e3b"];
  return (
    <svg
      className={`art ${className}`}
      viewBox="0 0 800 420"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Original illustrated landscape, not game footage"
    >
      <rect width="800" height="420" fill={colors[0]} />
      <circle cx="586" cy="115" r="57" fill="#f2d8a2" opacity=".75" />
      <path
        d="M0 220L88 162 146 199 250 115 366 222 447 157 534 214 644 140 800 229V420H0Z"
        fill={colors[1]}
      />
      <path
        d="M0 278L95 224 167 257 251 190 335 255 444 197 553 270 651 214 800 255V420H0Z"
        fill={colors[2]}
      />
      <path
        d="M0 320L104 280 205 303 310 259 420 303 504 265 610 300 705 267 800 294V420H0Z"
        fill={colors[3]}
      />
      <path
        d="M0 353L145 330 268 350 386 320 507 344 634 314 800 336V420H0Z"
        fill="#172521"
        opacity=".78"
      />
      {[55, 112, 192, 665, 728, 773].map((x, i) => (
        <g
          key={x}
          transform={`translate(${x} ${i % 2 ? 245 : 230})`}
          fill="#1e3029"
        >
          <rect x="-3" y="26" width="7" height="95" />
          <path d="M0 0L-25 44H-15L-34 72H34L15 44H25Z" />
        </g>
      ))}
      {theme === "ember" && (
        <g fill="#443631">
          <path d="M560 290V172h35v118h-35zm-9-118 26-30 27 30z" />
          <rect x="572" y="191" width="9" height="18" fill="#e6b47c" />
          <path d="M612 292v-78h25v78z" />
        </g>
      )}
      {theme === "night" && (
        <g fill="#bcbdb0" opacity=".7">
          <rect x="132" y="65" width="4" height="4" />
          <rect x="270" y="42" width="3" height="3" />
          <rect x="370" y="90" width="4" height="4" />
          <rect x="700" y="45" width="4" height="4" />
          <path d="M90 291h96v6H90z" />
        </g>
      )}
      <g transform="translate(389 282)">
        <rect x="-8" y="-30" width="16" height="17" fill="#e9c18b" />
        <rect x="-12" y="-15" width="24" height="25" fill="#d5a35f" />
        <rect x="-11" y="9" width="9" height="17" fill="#242e2a" />
        <rect x="3" y="9" width="9" height="17" fill="#242e2a" />
        <rect x="-12" y="-32" width="24" height="7" fill="#3c342d" />
      </g>
      <g fill="#f2d8a2" opacity=".65">
        <rect x="142" y="143" width="3" height="3" />
        <rect x="455" y="110" width="4" height="4" />
        <rect x="700" y="88" width="3" height="3" />
      </g>
    </svg>
  );
}

function App() {
  const [page, setPage] = useState<Page>("discover");
  const [selected, setSelected] = useState(samples[0]);
  const [snapshot, setSnapshot] = useState<Snapshot>(initial);
  const [project, setProject] = useState<Project | null>(null);
  const [draft, setDraft] = useState<Sample>(samples[0]);
  const [prompt, setPrompt] = useState("");
  const [filter, setFilter] = useState("All games");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [details, setDetails] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [review, setReview] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const native = !!window.modalore;
  const refresh = async () => {
    if (window.modalore) {
      try {
        setSnapshot(await window.modalore.snapshot());
      } catch (e) {
        setNotice(error(e));
      }
    }
  };
  useEffect(() => {
    void refresh();
    return window.modalore?.onProgress?.(setProgress);
  }, []);
  useEffect(() => {
    if (!confirm && !review) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previous?.focus();
  }, [confirm, review]);
  const error = (e: unknown) => (e instanceof Error ? e.message : String(e));
  const action = async <T,>(
    fn: () => Promise<T>,
    success?: string,
  ): Promise<T | undefined> => {
    setBusy(true);
    setNotice("");
    try {
      const result = await fn();
      if (success) setNotice(success);
      await refresh();
      return result;
    } catch (e) {
      setNotice(error(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  const unavailable = () =>
    setNotice(
      "Desktop connection unavailable. Open Modalore as a desktop app to use this action.",
    );
  const openDetail = (recipe: Sample) => {
    setProgress(null);
    setSelected(recipe);
    setPage("detail");
    setNotice("");
  };
  const startStudio = async () => {
    setProgress(null);
    setDraft(selected);
    setPrompt("");
    setProject(null);
    setPage("studio");
  };
  const cleanRecipe = (r: Sample): Recipe => ({
    schemaVersion: 1,
    title: r.title,
    description: r.description,
    damageMultiplier: r.damageMultiplier,
    enemyHealthMultiplier: r.enemyHealthMultiplier,
    coinMultiplier: r.coinMultiplier,
  });
  const create = async () => {
    if (!window.modalore) return unavailable();
    const p = await action(() =>
      project
        ? window.modalore!.updateProject(project.id, cleanRecipe(draft))
        : window.modalore!.createProject(cleanRecipe(draft)),
    );
    if (p) {
      setProject(p);
      setDraft((d) => ({ ...d, ...p.recipe }));
      setNotice("Project saved to your library.");
    }
  };
  const remix = async () => {
    if (!window.modalore) return unavailable();
    if (!project) {
      setNotice("Create this project first, then describe your change.");
      return;
    }
    if (!prompt.trim()) {
      setNotice("Describe what you would like to change first.");
      return;
    }
    setProgress({
      stage: "Starting",
      message: "Sending your request to Codex…",
      status: "running",
    });
    const p = await action(() =>
      window.modalore!.remix(project.id, prompt.trim()),
    );
    if (p) {
      setProject(p);
      setDraft((d) => ({ ...d, ...p.recipe }));
      setPrompt("");
    }
  };
  const detailAction = async (kind: "play" | "exportProject") => {
    if (!window.modalore) return unavailable();
    const p = await action(() =>
      window.modalore!.createProject(cleanRecipe(selected)),
    );
    if (!p) return;
    setProject(p);
    setDraft({ ...selected, ...p.recipe });
    setPage("studio");
    const result = await action(() => window.modalore![kind](p.id));
    if (result && "message" in result && result.message)
      setNotice(result.message);
  };
  const runProject = async (kind: "play" | "exportProject" | "restore") => {
    if (!window.modalore) return unavailable();
    if (!project) {
      setNotice("Create a project first.");
      return;
    }
    const result = await action(() => window.modalore![kind](project.id));
    if (result && "message" in result && result.message)
      setNotice(result.message);
    if (kind === "restore") {
      const fresh = await window.modalore.snapshot();
      const restored = fresh.projects?.find((p) => p.id === project.id);
      if (restored) {
        setProject(restored);
        setDraft((d) => ({ ...d, ...restored.recipe }));
      }
    }
  };
  const nav = (p: Page) => {
    setProgress(null);
    setPage(p);
    setMenu(false);
    setNotice("");
  };
  const showProject = (p: Project) => {
    setProgress(null);
    setProject(p);
    setDraft({ ...samples[0], ...p.recipe });
    setSelected({ ...samples[0], ...p.recipe });
    setPage("studio");
  };
  return (
    <div className="shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <button
          className="brand"
          onClick={() => nav("discover")}
          aria-label="Modalore home"
        >
          <span className="brandmark">
            <i />
            <i />
            <i />
          </span>
          <span>
            modalore<span className="branddot">.</span>
          </span>
        </button>
        <p className="side-label">Modalore</p>
        <nav aria-label="Main navigation">
          <button
            className={page === "discover" || page === "detail" ? "active" : ""}
            aria-current={
              page === "discover" || page === "detail" ? "page" : undefined
            }
            onClick={() => nav("discover")}
          >
            <Compass size={19} /> Discover
          </button>
          <button
            className={page === "library" ? "active" : ""}
            aria-current={page === "library" ? "page" : undefined}
            onClick={() => nav("library")}
          >
            <Library size={19} /> My library
          </button>
          <button
            className={page === "studio" ? "active" : ""}
            aria-current={page === "studio" ? "page" : undefined}
            onClick={() => {
              setProject(null);
              setDraft(samples[0]);
              nav("studio");
            }}
          >
            <WandSparkles size={19} /> Remix studio
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="side-note">
            <span className="side-spark">
              <Sparkles size={16} />
            </span>
            <div>
              <strong>Your creations</strong>
              <p>Create, adjust, and export recipes.</p>
            </div>
          </div>
          <button
            className={`setup-link ${page === "setup" ? "active" : ""}`}
            onClick={() => nav("setup")}
          >
            <Settings2 size={18} /> Setup <ArrowRight size={15} />
          </button>
          <div className="version">
            MODALORE <span>Preview</span>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            onClick={() => setMenu(!menu)}
            aria-label="Toggle navigation"
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumbs">
            <span>Modalore</span>
            <span className="crumb-divider">/</span>
            <strong>
              {page === "detail"
                ? "Creation"
                : page === "studio"
                  ? "Remix studio"
                  : page === "library"
                    ? "My library"
                    : page === "setup"
                      ? "Setup"
                      : "Discover"}
            </strong>
          </div>
          <div className="top-right">
            <span className="top-status">
              <span className={`status-dot ${native ? "" : "muted"}`} />
              {native ? "Desktop app" : "Preview mode"}
            </span>
            <button
              className="icon-button"
              title="Setup and help"
              aria-label="Setup and help"
              onClick={() => nav("setup")}
            >
              <CircleHelp size={19} />
            </button>
          </div>
        </header>
        {!native && (
          <div className="preview-banner">
            <span>
              <strong>Desktop connection unavailable.</strong> You’re viewing a
              preview with sample recipes.
            </span>
            <button onClick={() => nav("setup")}>
              About setup <ArrowRight size={14} />
            </button>
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button
              className="icon-button"
              aria-label="Dismiss message"
              onClick={() => setNotice("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {page === "discover" && (
          <div className="content discover">
            <div className="page-heading">
              <div>
                <span className="eyebrow">Discover</span>
                <h1>Your games. Your rules.</h1>
                <p>
                  Explore sample recipes for Terraria, then adjust them to suit
                  your game.
                </p>
              </div>
              <div className="heading-index"></div>
            </div>
            <div className="section-line">
              <div>
                <span className="eyebrow">Explore</span>
                <h2>
                  Featured recipes <span>↗</span>
                </h2>
              </div>
              <div className="filter-wrap">
                <label htmlFor="game-filter">Game</label>
                <select
                  id="game-filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option>All games</option>
                  <option>Terraria</option>
                </select>
                <ChevronDown size={14} />
              </div>
            </div>
            <button className="feature" onClick={() => openDetail(samples[0])}>
              <div className="feature-art">
                <Art theme="grove" />
                <span className="art-label">
                  Original concept art · not game footage
                </span>
                <span className="feature-number">01</span>
              </div>
              <div className="feature-copy">
                <div>
                  <div className="tag-row">
                    <span className="tag">Sample recipe</span>
                    <span className="tag subtle">Terraria / tModLoader</span>
                  </div>
                  <p className="feature-kicker">Featured sample</p>
                  <h3>The Wildwood</h3>
                  <p className="feature-description">
                    A starting recipe with higher enemy health and increased
                    coin rewards.
                  </p>
                </div>
                <div className="feature-footer">
                  <span>View recipe</span>
                  <span className="round-arrow">
                    <ArrowUpRight size={20} />
                  </span>
                </div>
              </div>
            </button>
            <div className="below-heading">
              <div>
                <span className="eyebrow">More samples</span>
                <h2>More recipes</h2>
              </div>
              <span>CURATED IDEAS / 02—03</span>
            </div>
            <div className="collection">
              {samples.slice(1).map((s, i) => (
                <button
                  className="collection-item"
                  key={s.id}
                  onClick={() => openDetail(s)}
                >
                  <div className="collection-art">
                    <Art theme={s.theme} />
                    <span>Concept art</span>
                  </div>
                  <div className="collection-copy">
                    <div className="collection-meta">
                      <span>Sample recipe · TERRARIA</span>
                      <span>0{i + 2}</span>
                    </div>
                    <h3>{s.title}</h3>
                    <p>{s.subtitle}</p>
                    <span className="collection-link">
                      Explore idea <ArrowRight size={15} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <p className="footnote">
              These are concept recipes, not verified gameplay. Availability
              depends on your setup and supported mechanics.
            </p>
          </div>
        )}
        {page === "detail" && (
          <div className="content detail">
            <button className="text-back" onClick={() => nav("discover")}>
              <ArrowLeft size={16} /> All discoveries
            </button>
            <div className="detail-hero">
              <Art theme={selected.theme} />
              <span className="art-label">
                Original concept art · not game footage
              </span>
            </div>
            <div className="detail-layout">
              <div>
                <div className="tag-row">
                  <span className="tag">Sample recipe</span>
                  <span className="tag subtle">Terraria / tModLoader</span>
                </div>
                <h1>{selected.title}</h1>
                <p className="detail-lede">{selected.description}</p>
                <div className="rule" />
                <span className="eyebrow">About this recipe</span>
                <h2>What this recipe changes</h2>
                <p className="body-copy">
                  Start with a suggested balance, then adjust it to suit the way
                  you like to play. This is a concept recipe; its effects and
                  compatibility have not been verified in a game session.
                </p>
                <div className="stats">
                  <div>
                    <strong>
                      {Math.round(selected.enemyHealthMultiplier * 100)}%
                    </strong>
                    <span>Enemy health</span>
                  </div>
                  <div>
                    <strong>
                      {Math.round(selected.damageMultiplier * 100)}%
                    </strong>
                    <span>Damage</span>
                  </div>
                  <div>
                    <strong>
                      {Math.round(selected.coinMultiplier * 100)}%
                    </strong>
                    <span>Coins</span>
                  </div>
                </div>
              </div>
              <aside className="detail-aside">
                <span className="eyebrow">Get started</span>
                <h3>Create from this recipe</h3>
                <p>
                  Use this idea as a starting point. Adjust the details before
                  you create a project.
                </p>
                <button className="button primary full" onClick={startStudio}>
                  <Sparkles size={17} /> Make it mine <ArrowRight size={17} />
                </button>
                <div className="detail-actions">
                  <button
                    className="button secondary full"
                    disabled={busy}
                    onClick={() => void detailAction("play")}
                  >
                    <Play size={17} /> Play sample
                  </button>
                  <button
                    className="button secondary full"
                    disabled={busy}
                    onClick={() => void detailAction("exportProject")}
                  >
                    <Download size={17} /> Share as a file
                  </button>
                </div>
                <p className="aside-small">
                  These actions first save this sample as your project. Gameplay
                  is unverified. Play requires Terraria and tModLoader; sharing
                  exports a recipe file.
                </p>
                <button className="text-link" onClick={() => nav("setup")}>
                  Check your setup <ArrowUpRight size={15} />
                </button>
              </aside>
            </div>
          </div>
        )}
        {page === "library" && (
          <div className="content inner">
            <div className="inner-heading">
              <div>
                <span className="eyebrow">Your projects</span>
                <h1>
                  My library<span className="accent">.</span>
                </h1>
                <p>
                  Your creations and works in progress live here. Open one to
                  see its current version and recovery options.
                </p>
              </div>
              <button
                className="button secondary"
                disabled={busy}
                onClick={async () => {
                  if (!window.modalore) return unavailable();
                  const p = await action(() =>
                    window.modalore!.importProject(),
                  );
                  if (p) showProject(p);
                }}
              >
                <Upload size={17} /> Import project
              </button>
            </div>
            {snapshot.projects?.length ? (
              <div className="project-list">
                {snapshot.projects.map((p) => (
                  <button
                    key={p.id}
                    className="project-row"
                    onClick={() => showProject(p)}
                  >
                    <div className="project-thumb">
                      <Art theme={"grove"} />
                    </div>
                    <div>
                      <span className="eyebrow">Project</span>
                      <h3>{p.name}</h3>
                      <p>{p.status || "Open project"}</p>
                    </div>
                    <ArrowUpRight size={20} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty">
                <div className="empty-icon">
                  <Library size={26} />
                </div>
                <h2>Your library is empty</h2>
                <p>
                  When you make an idea your own, you’ll find it here. Start
                  with a sample or import a project.
                </p>
                <button
                  className="button primary"
                  onClick={() => nav("discover")}
                >
                  Explore ideas <ArrowRight size={17} />
                </button>
              </div>
            )}
          </div>
        )}
        {page === "studio" && (
          <div className="content inner">
            <button className="text-back" onClick={() => nav("discover")}>
              <ArrowLeft size={16} /> Back to discover
            </button>
            <div className="inner-heading studio-heading">
              <div>
                <span className="eyebrow">Remix studio</span>
                <h1>
                  Make it yours<span className="accent">.</span>
                </h1>
                <p>Adjust a recipe or describe a supported change.</p>
              </div>
              {project && (
                <span className="saved-badge">
                  <Check size={14} /> Project saved
                </span>
              )}
            </div>
            <div className="studio-grid">
              <div>
                <div className="studio-preview">
                  <Art theme={draft.theme} />
                  <span className="art-label">
                    Concept art · not game footage
                  </span>
                </div>
                <div className="studio-title">
                  <div>
                    <span className="eyebrow">
                      {project ? "Project" : "Sample recipe"}
                    </span>
                    <h2>{draft.title || "Untitled project"}</h2>
                    <p>Terraria / tModLoader</p>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Choose another idea"
                    onClick={() => nav("discover")}
                  >
                    <MoreHorizontal size={21} />
                  </button>
                </div>
                <div className="studio-section">
                  <label className="name-field" htmlFor="project-name">
                    <span>Project name</span>
                    <input
                      id="project-name"
                      type="text"
                      maxLength={80}
                      value={draft.title}
                      onChange={(e) =>
                        setDraft({ ...draft, title: e.target.value })
                      }
                    />
                  </label>
                  <div className="section-title">
                    <div>
                      <span className="eyebrow">Recipe settings</span>
                      <h3>Adjust values</h3>
                    </div>
                    <SlidersHorizontal size={19} />
                  </div>
                  <p>
                    Choose a starting balance. 100% is the unmodified value.
                  </p>
                  {(
                    [
                      ["enemyHealthMultiplier", "Enemy health"],
                      ["damageMultiplier", "Damage"],
                      ["coinMultiplier", "Coins"],
                    ] as const
                  ).map(([key, label]) => (
                    <label className="slider-row" key={key}>
                      <span>
                        {label}
                        <strong>{Math.round(draft[key] * 100)}%</strong>
                      </span>
                      <input
                        type="range"
                        min="0.5"
                        max="3"
                        step="0.05"
                        value={draft[key]}
                        onChange={(e) =>
                          setDraft({ ...draft, [key]: Number(e.target.value) })
                        }
                      />
                    </label>
                  ))}
                  <button
                    className="button secondary"
                    disabled={busy || !draft.title.trim()}
                    onClick={create}
                  >
                    {project ? "Save adjustments" : "Create project"}{" "}
                    <ArrowRight size={16} />
                  </button>
                  <p className="small-hint">
                    Save adjustments to your project before building or playing.
                    They are not applied to a running game.
                  </p>
                </div>
              </div>
              <div>
                <div className="prompt-panel">
                  <span className="panel-icon">
                    <Sparkles size={19} />
                  </span>
                  <span className="eyebrow">Codex</span>
                  <h2>Describe a change</h2>
                  <p>
                    Describe a change to player damage, enemy health, or enemy
                    coin rewards. Codex will work on your saved project. Other
                    mechanics are not supported yet; for an army idea, try
                    adjusting enemy health instead.
                  </p>
                  <label className="sr-only" htmlFor="remix-prompt">
                    Describe your change
                  </label>
                  <textarea
                    id="remix-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="What would make this adventure more fun?"
                  />
                  <div className="suggestions">
                    <span>Suggestions</span>
                    <button
                      onClick={() =>
                        setPrompt(
                          "Give enemies more health and make coin rewards more generous.",
                        )
                      }
                    >
                      More enemy health <ArrowUpRight size={13} />
                    </button>
                    <button
                      onClick={() =>
                        setPrompt(
                          "Reduce enemy health and increase player damage for a new player.",
                        )
                      }
                    >
                      A gentler start <ArrowUpRight size={13} />
                    </button>
                  </div>
                  <button
                    className="button primary full"
                    disabled={busy}
                    onClick={() => setReview(true)}
                  >
                    <WandSparkles size={17} /> Build my change{" "}
                    <ArrowRight size={17} />
                  </button>
                  <p className="small-hint">
                    Uses your local Codex account and its applicable usage
                    allowance. Review results before playing.
                  </p>
                </div>
                {progress && (
                  <div className="progress-panel" aria-live="polite">
                    <div className="progress-title">
                      {progress.status === "running" ? (
                        <LoaderCircle className="spin" size={18} />
                      ) : (
                        <span className="status-dot" />
                      )}
                      <strong>{progress.stage}</strong>
                    </div>
                    <p>{progress.message}</p>
                    {progress.status === "running" && (
                      <button
                        className="text-link"
                        onClick={() =>
                          window.modalore
                            ? void action(() => window.modalore!.cancel())
                            : unavailable()
                        }
                      >
                        <Square size={13} /> Stop build
                      </button>
                    )}
                    {progress.status === "error" && (
                      <button className="text-link" onClick={remix}>
                        <RotateCcw size={14} /> Retry
                      </button>
                    )}
                    {progress.detail && (
                      <>
                        <button
                          className="text-link"
                          onClick={() => setDetails(!details)}
                        >
                          Technical details <ChevronDown size={14} />
                        </button>
                        {details && <pre>{progress.detail}</pre>}
                      </>
                    )}
                  </div>
                )}
                {project && (
                  <div className="project-actions">
                    <span className="eyebrow">Project</span>
                    <button
                      className="button secondary full"
                      onClick={() => void runProject("play")}
                      disabled={busy}
                    >
                      <Play size={17} /> Play
                    </button>
                    <button
                      className="button secondary full"
                      onClick={() => void runProject("exportProject")}
                      disabled={busy}
                    >
                      <Download size={17} /> Export this version
                    </button>
                    <button
                      className="text-link"
                      onClick={() => setConfirm(true)}
                    >
                      <RotateCcw size={15} /> Recovery options
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {page === "setup" && (
          <div className="content inner">
            <div className="inner-heading">
              <div>
                <span className="eyebrow">Getting started</span>
                <h1>
                  Setup<span className="accent">.</span>
                </h1>
                <p>
                  Find your game and connect Codex when you are ready to create.
                </p>
              </div>
            </div>
            <div className="setup-list">
              <section className="setup-row">
                <div className="setup-icon">
                  <Gamepad2 size={22} />
                </div>
                <div>
                  <div className="setup-title">
                    <h2>Terraria & tModLoader</h2>
                    <span className="state-pill">
                      {snapshot.game?.found ? "FOUND" : "NOT DETECTED"}
                    </span>
                  </div>
                  <p>
                    Modalore needs your own game installation and tModLoader to
                    play a creation. Your original saves should stay separate
                    from experiments.
                  </p>
                  {snapshot.game?.message && (
                    <p className="setup-message">{snapshot.game.message}</p>
                  )}
                  {snapshot.game?.path && (
                    <p className="setup-message">{snapshot.game.path}</p>
                  )}
                  <div className="button-row">
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={async () => {
                        if (!window.modalore) return unavailable();
                        const game = await action(() =>
                          window.modalore!.detectGame(),
                        );
                        if (game) setSnapshot((s) => ({ ...s, game }));
                      }}
                    >
                      Detect game
                    </button>
                    <button
                      className="text-link"
                      onClick={async () => {
                        if (!window.modalore) return unavailable();
                        const game = await action(() =>
                          window.modalore!.pickGame(),
                        );
                        if (game) setSnapshot((s) => ({ ...s, game }));
                      }}
                    >
                      <FolderOpen size={16} /> Choose folder
                    </button>
                    <button
                      className="text-link"
                      onClick={() =>
                        window.modalore
                          ? void action(() =>
                              window.modalore!.openExternal("tmodloader"),
                            )
                          : unavailable()
                      }
                    >
                      Get tModLoader <ArrowUpRight size={15} />
                    </button>
                  </div>
                </div>
              </section>
              <section className="setup-row">
                <div className="setup-icon">
                  <Sparkles size={22} />
                </div>
                <div>
                  <div className="setup-title">
                    <h2>Codex connection</h2>
                    <span className="state-pill">
                      {snapshot.codex?.available
                        ? snapshot.codex.signedIn
                          ? "CONNECTED"
                          : "AVAILABLE"
                        : "NOT CONNECTED"}
                    </span>
                  </div>
                  <p>
                    Needed for natural-language creation, not for browsing.
                    Modalore uses your local Codex installation and your
                    account’s applicable allowance.
                  </p>
                  {snapshot.codex?.message && (
                    <p className="setup-message">{snapshot.codex.message}</p>
                  )}
                  <div className="button-row">
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={async () => {
                        if (!window.modalore) return unavailable();
                        const codex = await action(() =>
                          window.modalore!.connectCodex(),
                        );
                        if (codex) setSnapshot((s) => ({ ...s, codex }));
                      }}
                    >
                      Check connection
                    </button>
                    <button
                      className="text-link"
                      onClick={() =>
                        window.modalore
                          ? void action(() =>
                              window.modalore!.openExternal("codex"),
                            )
                          : unavailable()
                      }
                    >
                      Get Codex <ArrowUpRight size={15} />
                    </button>
                  </div>
                </div>
              </section>
            </div>
            <p className="footnote">
              Modalore does not ask for or store your Codex credentials.
            </p>
          </div>
        )}
      </main>
      {review && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setReview(false);
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-title"
            tabIndex={-1}
            ref={dialogRef}
            onKeyDown={(e) => {
              if (e.key === "Escape") setReview(false);
              if (e.key === "Tab") {
                const items = Array.from(
                  e.currentTarget.querySelectorAll<HTMLButtonElement>(
                    "button:not(:disabled)",
                  ),
                );
                const i = items.indexOf(
                  document.activeElement as HTMLButtonElement,
                );
                if (e.shiftKey && i <= 0) {
                  e.preventDefault();
                  items[items.length - 1]?.focus();
                } else if (!e.shiftKey && i === items.length - 1) {
                  e.preventDefault();
                  items[0]?.focus();
                }
              }
            }}
          >
            <button
              className="icon-button modal-close"
              aria-label="Close"
              onClick={() => setReview(false)}
            >
              <X size={20} />
            </button>
            <span className="eyebrow">Review request</span>
            <h2 id="review-title">Review your change</h2>
            <p>
              {prompt.trim() ||
                "Add a description of your change before continuing."}
            </p>
            <p>
              Codex will work on your saved project using your local account and
              its applicable allowance. You can stop the build while it runs.
            </p>
            <div className="button-row">
              <button
                className="button secondary"
                onClick={() => setReview(false)}
              >
                Go back
              </button>
              <button
                className="button primary"
                disabled={!prompt.trim() || !project}
                onClick={() => {
                  setReview(false);
                  void remix();
                }}
              >
                Start build
              </button>
            </div>
            {!project && <p className="small-hint">Create a project first.</p>}
          </div>
        </div>
      )}
      {confirm && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirm(false);
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recovery-title"
            tabIndex={-1}
            ref={dialogRef}
            onKeyDown={(e) => {
              if (e.key === "Escape") setConfirm(false);
              if (e.key === "Tab") {
                const items = Array.from(
                  e.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
                );
                const i = items.indexOf(
                  document.activeElement as HTMLButtonElement,
                );
                if (e.shiftKey && i <= 0) {
                  e.preventDefault();
                  items[items.length - 1]?.focus();
                } else if (!e.shiftKey && i === items.length - 1) {
                  e.preventDefault();
                  items[0]?.focus();
                }
              }
            }}
          >
            <button
              className="icon-button modal-close"
              aria-label="Close"
              onClick={() => setConfirm(false)}
            >
              <X size={20} />
            </button>
            <span className="eyebrow">Recovery</span>
            <h2 id="recovery-title">Restore a previous version?</h2>
            <p>
              Recovery depends on what was saved for this project. Restoring a
              save checkpoint can discard progress made after that checkpoint.
              Check the result carefully.
            </p>
            <div className="button-row">
              <button
                className="button secondary"
                onClick={() => setConfirm(false)}
              >
                Go back
              </button>
              <button
                className="button primary"
                onClick={() => {
                  setConfirm(false);
                  void runProject("restore");
                }}
              >
                Continue to restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
