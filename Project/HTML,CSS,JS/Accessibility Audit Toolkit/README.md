# ♿ Accessibility Audit Toolkit (A11y Checker)

A **real-time**, beginner-friendly accessibility auditing tool built with **HTML, CSS, and JavaScript**.

Paste HTML markup and instantly see accessibility results for headings, image alt text, color contrast, and keyboard focus — no backend required.

---

## ✨ Features

- **Real-time auditing** — results update automatically as you type (300ms debounce)
- **Live preview** — sandboxed iframe renders your HTML safely
- **Heading structure check** — missing `h1`, skipped levels, empty headings
- **Image alt text check** — missing, empty, or valid `alt` attributes
- **Color contrast check** — WCAG AA contrast ratios for text elements
- **Keyboard & focus check** — labels, focus outlines, tabindex, link names
- **Sample pages** — load accessible vs problematic examples
- **Focus test mode** — tab through preview to verify keyboard navigation
- **Dark / light theme** — persisted in `localStorage`
- **Accessibility score** — summary with errors, warnings, and passes

---

## 🚀 How to Run

No installation needed.

1. Open `index.html` in any modern browser (Chrome, Firefox, Edge).
2. Paste HTML into the input panel **or** load a sample from the dropdown.
3. Watch the audit report update in real time on the right.

### Optional — local server

```bash
# From this folder
npx serve .
# or
python -m http.server 8080
```

Then visit `http://localhost:8080`

---

## 📁 Project Structure

```text
Accessibility Audit Toolkit/
├── index.html    # App layout
├── style.css     # UI styles (light/dark theme)
├── script.js     # Real-time audit engine
└── README.md     # Documentation
```

---

## 🧪 What It Checks

| Category | Checks |
|----------|--------|
| Headings | Missing `h1`, multiple `h1`, skipped levels, empty headings |
| Images | Missing `alt`, whitespace-only alt, decorative `alt=""` |
| Contrast | Text/background ratio vs WCAG AA (4.5:1 normal, 3:1 large) |
| Keyboard | Missing labels, removed focus styles, positive tabindex, unnamed links |

---

## 📸 Usage

1. **Paste HTML** → audit runs automatically
2. **Load sample** → compare good vs bad pages
3. **Test keyboard focus** → press Tab inside preview, Esc to exit

---

## ⚠️ Note

This is an **educational tool** for learning common accessibility patterns. It does not replace professional tools like axe, Lighthouse, or WAVE for production audits.

---

## 🛠 Tech Stack

- HTML5
- CSS3 (custom properties, responsive grid)
- Vanilla JavaScript (DOM parsing, WCAG contrast math)

---

## 📄 License

Educational project for [62Days-CodeSprint-WebDev-Challenge](https://github.com/abhisek2004/62Days-CodeSprint-WebDev-Challenge).
