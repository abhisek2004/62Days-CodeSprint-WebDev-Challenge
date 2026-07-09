const SAMPLES = {
  good: `<!DOCTYPE html>
<html lang="en">
<head><title>Accessible Blog</title></head>
<body>
  <header>
    <h1>Accessible Blog</h1>
    <nav aria-label="Main navigation">
      <a href="#posts">Posts</a>
      <a href="#about">About</a>
    </nav>
  </header>
  <main>
    <h2>Latest Posts</h2>
    <article>
      <h3>Learning Web Accessibility</h3>
      <img src="https://via.placeholder.com/320x180" alt="Person coding on a laptop" />
      <p style="color:#1a1a1a;background:#ffffff">Clear contrast makes content readable for everyone.</p>
      <button type="button">Read more</button>
    </article>
  </main>
  <footer><p>&copy; 2026 Accessible Blog</p></footer>
</body>
</html>`,

  bad: `<!DOCTYPE html>
<html>
<body>
  <h3>Welcome</h3>
  <h1>Broken Heading Order</h1>
  <img src="https://via.placeholder.com/200" />
  <p style="color:#cccccc;background:#ffffff">Hard to read gray text on white.</p>
  <a href="#">Click</a>
  <input type="text" placeholder="Email" />
  <div tabindex="0" style="outline:none">Custom focus trap</div>
</body>
</html>`,

  form: `<!DOCTYPE html>
<html lang="en">
<body>
  <h1>Contact Form</h1>
  <form>
    <label for="name">Name</label>
    <input id="name" type="text" />
    <label for="email">Email</label>
    <input id="email" type="email" />
    <button type="submit">Send</button>
  </form>
  <img src="logo.png" alt="" />
</body>
</html>`,
};

const DEBOUNCE_MS = 300;

const htmlInput = document.getElementById("htmlInput");
const previewFrame = document.getElementById("previewFrame");
const reportSections = document.getElementById("reportSections");
const auditStatus = document.getElementById("auditStatus");
const scoreCard = document.getElementById("scoreCard");
const scoreValue = document.getElementById("scoreValue");
const scoreRing = document.getElementById("scoreRing");
const errorCount = document.getElementById("errorCount");
const warnCount = document.getElementById("warnCount");
const passCount = document.getElementById("passCount");
const sampleSelect = document.getElementById("sampleSelect");
const clearBtn = document.getElementById("clearBtn");
const focusTestBtn = document.getElementById("focusTestBtn");
const focusOverlay = document.getElementById("focusOverlay");
const themeToggle = document.getElementById("themeToggle");

let debounceTimer = null;
let focusTestActive = false;
let focusInHandler = null;

function handleEscapeKey(e) {
  if (e.key !== "Escape" || !focusTestActive) return;
  e.preventDefault();
  e.stopPropagation();
  exitFocusTest();
}

function attachFocusTestListeners() {
  detachFocusTestListeners();

  document.addEventListener("keydown", handleEscapeKey, true);
  previewFrame.addEventListener("keydown", handleEscapeKey, true);

  const doc = getPreviewDocument();
  if (!doc) return;

  doc.addEventListener("keydown", handleEscapeKey, true);

  if (!focusInHandler) {
    focusInHandler = (e) => {
      if (!focusTestActive) return;
      e.target.style.outline = "3px solid #7c3aed";
      e.target.style.outlineOffset = "2px";
    };
  }

  doc.addEventListener("focusin", focusInHandler);
}

function detachFocusTestListeners() {
  document.removeEventListener("keydown", handleEscapeKey, true);
  previewFrame.removeEventListener("keydown", handleEscapeKey, true);

  const doc = getPreviewDocument();
  if (!doc) return;

  doc.removeEventListener("keydown", handleEscapeKey, true);
  if (focusInHandler) doc.removeEventListener("focusin", focusInHandler);
}

function enterFocusTest() {
  focusTestActive = true;
  focusOverlay.classList.remove("hidden");
  focusTestBtn.textContent = "Exit focus test";
  previewFrame.setAttribute("tabindex", "0");

  attachFocusTestListeners();

  const doc = getPreviewDocument();
  const first = doc?.querySelector(
    'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  if (first) {
    first.focus();
  } else {
    previewFrame.focus();
  }
}

function exitFocusTest() {
  if (!focusTestActive) return;

  focusTestActive = false;
  focusOverlay.classList.add("hidden");
  focusTestBtn.textContent = "Test keyboard focus";
  previewFrame.removeAttribute("tabindex");

  detachFocusTestListeners();
  focusTestBtn.focus();
}

function toggleFocusTest() {
  if (focusTestActive) {
    exitFocusTest();
  } else {
    enterFocusTest();
  }
}

function debounceAudit() {
  clearTimeout(debounceTimer);
  auditStatus.textContent = "Auditing…";
  auditStatus.className = "status-badge status-running";
  debounceTimer = setTimeout(runAudit, DEBOUNCE_MS);
}

function getPreviewDocument() {
  const doc = previewFrame.contentDocument;
  if (!doc || !doc.body) return null;
  return doc;
}

function getCurrentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function getPreviewThemeCSS(theme) {
  if (theme === "dark") {
    return `
      html, body {
        background: #1e2433;
        color: #eef1f7;
        font-family: system-ui, sans-serif;
      }
      h1, h2, h3, h4, h5, h6, p, li, span, label, nav, footer, header, main, article, div {
        color: #eef1f7;
      }
      a { color: #9aadff; }
      button, input, select, textarea {
        background: #2a3145;
        color: #eef1f7;
        border: 1px solid #4a5675;
      }
      ::placeholder { color: #9aa3b8; }
    `;
  }

  return `
    html, body {
      background: #ffffff;
      color: #141824;
      font-family: system-ui, sans-serif;
    }
    h1, h2, h3, h4, h5, h6, p, li, span, label, nav, footer, header, main, article, div {
      color: #141824;
    }
    a { color: #3b56d1; }
    button, input, select, textarea {
      background: #ffffff;
      color: #141824;
      border: 1px solid #d5dbe8;
    }
    ::placeholder { color: #6b7280; }
  `;
}

function injectPreviewTheme(doc) {
  if (!doc) return;

  const themeCSS = getPreviewThemeCSS(getCurrentTheme());
  let styleEl = doc.getElementById("a11y-preview-theme");

  if (!styleEl) {
    styleEl = doc.createElement("style");
    styleEl.id = "a11y-preview-theme";
    (doc.head || doc.documentElement).appendChild(styleEl);
  }

  styleEl.textContent = themeCSS;
}

function updatePreview(html) {
  const doc = previewFrame.contentDocument;
  if (!doc) return;

  doc.open();
  doc.write(html || "<!DOCTYPE html><html><head></head><body><p></p></body></html>");
  doc.close();
  injectPreviewTheme(doc);

  if (focusTestActive) {
    attachFocusTestListeners();
  }
}

function parseColor(value) {
  if (!value || value === "transparent" || value === "rgba(0, 0, 0, 0)") return null;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  if (a === 0) return null;
  return { r, g, b };
}

function relativeLuminance({ r, g, b }) {
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(fg, bg) {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getEffectiveBackground(el, doc) {
  let node = el;
  while (node && node !== doc.documentElement) {
    const bg = parseColor(node.ownerDocument.defaultView.getComputedStyle(node).backgroundColor);
    if (bg) return bg;
    node = node.parentElement;
  }
  return { r: 255, g: 255, b: 255 };
}

function describeElement(el) {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const text = (el.textContent || "").trim().slice(0, 40);
  return `<${tag}${id}>${text ? ` "${text}"` : ""}`;
}

function auditHeadings(doc) {
  const findings = [];
  const headings = [...doc.querySelectorAll("h1, h2, h3, h4, h5, h6")];

  if (headings.length === 0) {
    findings.push({
      level: "warn",
      title: "No headings found",
      message: "Pages should use headings to structure content.",
      tip: "Add an <h1> for the main topic and nested headings below it.",
    });
    return findings;
  }

  const h1s = headings.filter((h) => h.tagName === "H1");
  if (h1s.length === 0) {
    findings.push({
      level: "error",
      title: "Missing <h1>",
      message: "Every page should have exactly one main heading.",
      tip: "Add a single <h1> that describes the page purpose.",
    });
  } else if (h1s.length > 1) {
    findings.push({
      level: "warn",
      title: "Multiple <h1> elements",
      message: `Found ${h1s.length} h1 tags.`,
      tip: "Use one <h1> per page; use h2–h6 for subsections.",
    });
  } else {
    findings.push({
      level: "pass",
      title: "Single <h1> present",
      message: describeElement(h1s[0]),
    });
  }

  let lastLevel = 0;
  headings.forEach((heading) => {
    const level = Number(heading.tagName[1]);
    const text = heading.textContent.trim();

    if (!text) {
      findings.push({
        level: "error",
        title: "Empty heading",
        message: describeElement(heading),
        tip: "Headings must contain visible text for screen readers.",
      });
    }

    if (lastLevel && level > lastLevel + 1) {
      findings.push({
        level: "warn",
        title: "Skipped heading level",
        message: `Jumped from h${lastLevel} to h${level} (${describeElement(heading)})`,
        tip: "Don't skip levels (e.g. h2 → h4). Keep a logical outline.",
      });
    }
    lastLevel = level;
  });

  return findings;
}

function auditImages(doc) {
  const findings = [];
  const images = [...doc.querySelectorAll("img")];

  if (images.length === 0) {
    findings.push({
      level: "pass",
      title: "No images to check",
      message: "No <img> elements in this markup.",
    });
    return findings;
  }

  images.forEach((img) => {
    const hasAlt = img.hasAttribute("alt");
    const alt = img.getAttribute("alt");

    if (!hasAlt) {
      findings.push({
        level: "error",
        title: "Missing alt attribute",
        message: describeElement(img),
        tip: 'Add alt="" for decorative images or descriptive alt text for content images.',
      });
    } else if (alt === "") {
      findings.push({
        level: "pass",
        title: "Decorative image (empty alt)",
        message: describeElement(img),
      });
    } else if (!alt.trim()) {
      findings.push({
        level: "warn",
        title: "Empty alt text (whitespace only)",
        message: describeElement(img),
        tip: "Provide meaningful alt text or use alt=\"\" if decorative.",
      });
    } else {
      findings.push({
        level: "pass",
        title: "Image has alt text",
        message: `${describeElement(img)} — alt: "${alt.slice(0, 60)}"`,
      });
    }
  });

  return findings;
}

function auditContrast(doc) {
  const findings = [];
  const win = doc.defaultView;
  const textSelectors = "p, span, a, li, label, button, h1, h2, h3, h4, h5, h6, td, th";
  const elements = [...doc.querySelectorAll(textSelectors)].filter((el) => el.textContent.trim());

  if (elements.length === 0) {
    findings.push({
      level: "pass",
      title: "No text elements",
      message: "No visible text nodes to evaluate contrast.",
    });
    return findings;
  }

  let checked = 0;
  const maxChecks = 12;

  for (const el of elements) {
    if (checked >= maxChecks) break;

    const style = win.getComputedStyle(el);
    const fg = parseColor(style.color);
    const bg = getEffectiveBackground(el, doc);
    if (!fg) continue;

    const ratio = contrastRatio(fg, bg);
    const fontSize = parseFloat(style.fontSize);
    const isLarge = fontSize >= 18 || (fontSize >= 14 && style.fontWeight >= 700);
    const required = isLarge ? 3 : 4.5;

    checked += 1;

    if (ratio < required) {
      findings.push({
        level: "error",
        title: "Low color contrast",
        message: `${describeElement(el)} — ratio ${ratio.toFixed(2)}:1 (needs ${required}:1)`,
        tip: "Increase contrast between text and background colors.",
      });
    }
  }

  if (findings.length === 0) {
    findings.push({
      level: "pass",
      title: "Contrast looks good",
      message: `Checked ${checked} text element(s). All met WCAG AA thresholds.`,
    });
  }

  return findings;
}

function auditKeyboard(doc) {
  const findings = [];
  const win = doc.defaultView;
  const focusableSelector =
    'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const focusable = [...doc.querySelectorAll(focusableSelector)];

  if (focusable.length === 0) {
    findings.push({
      level: "warn",
      title: "No focusable elements",
      message: "Interactive pages should include keyboard-accessible controls.",
    });
    return findings;
  }

  focusable.forEach((el) => {
    const style = win.getComputedStyle(el);
    const tag = el.tagName.toLowerCase();

    if (style.outlineStyle === "none" || style.outlineWidth === "0px") {
      const hasAltFocus =
        style.boxShadow !== "none" ||
        style.borderColor !== style.getPropertyValue("border-top-color");
      if (!hasAltFocus) {
        findings.push({
          level: "warn",
          title: "Focus outline removed",
          message: describeElement(el),
          tip: "Never remove focus styles without a visible custom :focus indicator.",
        });
      }
    }

    if (tag === "input" || tag === "select" || tag === "textarea") {
      const id = el.id;
      const hasLabel = id && doc.querySelector(`label[for="${CSS.escape(id)}"]`);
      const ariaLabel = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
      if (!hasLabel && !ariaLabel && !el.getAttribute("placeholder")) {
        findings.push({
          level: "error",
          title: "Form control missing label",
          message: describeElement(el),
          tip: "Associate a <label> or aria-label with every form field.",
        });
      }
    }

    const tabindex = el.getAttribute("tabindex");
    if (tabindex && Number(tabindex) > 0) {
      findings.push({
        level: "warn",
        title: "Positive tabindex",
        message: `${describeElement(el)} tabindex="${tabindex}"`,
        tip: "Avoid tabindex > 0; use natural DOM order instead.",
      });
    }
  });

  const links = [...doc.querySelectorAll("a")];
  links.forEach((a) => {
    const text = a.textContent.trim();
    if (!text && !a.getAttribute("aria-label")) {
      findings.push({
        level: "error",
        title: "Link without accessible name",
        message: describeElement(a),
        tip: "Links need visible text or an aria-label.",
      });
    }
  });

  if (findings.length === 0) {
    findings.push({
      level: "pass",
      title: "Keyboard basics look good",
      message: `${focusable.length} focusable element(s) with labels and focus styles.`,
    });
  }

  return findings;
}

function sectionStatus(findings) {
  if (findings.some((f) => f.level === "error")) return "error";
  if (findings.some((f) => f.level === "warn")) return "warn";
  return "pass";
}

function renderReport(sections) {
  const allFindings = sections.flatMap((s) => s.findings);
  const errors = allFindings.filter((f) => f.level === "error").length;
  const warnings = allFindings.filter((f) => f.level === "warn").length;
  const passes = allFindings.filter((f) => f.level === "pass").length;
  const total = errors + warnings + passes;
  const score = total ? Math.round((passes / total) * 100) : 0;

  scoreCard.classList.remove("hidden");
  scoreValue.textContent = score;
  scoreRing.style.setProperty("--score", score);
  errorCount.textContent = `${errors} error${errors !== 1 ? "s" : ""}`;
  warnCount.textContent = `${warnings} warning${warnings !== 1 ? "s" : ""}`;
  passCount.textContent = `${passes} passed`;

  reportSections.innerHTML = sections
    .map((section) => {
      const status = sectionStatus(section.findings);
      const badgeClass =
        status === "pass" ? "badge-pass" : status === "warn" ? "badge-warn" : "badge-error";

      const items = section.findings
        .map(
          (f) => `
        <li class="finding finding-${f.level}">
          <strong>${f.title}</strong>
          ${f.message}
          ${f.tip ? `<span class="finding-tip">💡 ${f.tip}</span>` : ""}
        </li>`
        )
        .join("");

      return `
      <article class="report-section">
        <div class="section-header">
          <h3>${section.title}</h3>
          <span class="section-badge ${badgeClass}">${status}</span>
        </div>
        <ul class="finding-list">${items}</ul>
      </article>`;
    })
    .join("");

  auditStatus.textContent = "Audit complete";
  auditStatus.className = "status-badge status-done";
}

function runAudit() {
  const html = htmlInput.value.trim();

  if (!html) {
    scoreCard.classList.add("hidden");
    reportSections.innerHTML =
      '<p class="empty-state">Paste HTML or load a sample to see real-time results.</p>';
    auditStatus.textContent = "Waiting for input";
    auditStatus.className = "status-badge status-idle";
    updatePreview("");
    return;
  }

  updatePreview(html);

  const doc = getPreviewDocument();
  if (!doc) return;

  const sections = [
    { title: "Heading Structure", findings: auditHeadings(doc) },
    { title: "Image Alt Text", findings: auditImages(doc) },
    { title: "Color Contrast", findings: auditContrast(doc) },
    { title: "Keyboard & Focus", findings: auditKeyboard(doc) },
  ];

  renderReport(sections);
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  themeToggle.textContent = isDark ? "☀️" : "🌙";
  themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  localStorage.setItem("a11y-theme", theme);

  const html = htmlInput.value.trim();
  updatePreview(html);
  if (html) debounceAudit();
}

function initTheme() {
  const saved = localStorage.getItem("a11y-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
}

themeToggle.addEventListener("click", () => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  applyTheme(isDark ? "light" : "dark");
});

htmlInput.addEventListener("input", debounceAudit);

sampleSelect.addEventListener("change", (e) => {
  const key = e.target.value;
  if (!key || !SAMPLES[key]) return;
  htmlInput.value = SAMPLES[key];
  debounceAudit();
});

clearBtn.addEventListener("click", () => {
  htmlInput.value = "";
  sampleSelect.value = "";
  runAudit();
});

focusTestBtn.addEventListener("click", toggleFocusTest);

previewFrame.addEventListener("load", () => {
  if (focusTestActive) attachFocusTestListeners();
});

initTheme();
updatePreview("");
runAudit();
