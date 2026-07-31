/**
 * ContainerIQ - Interactive CSS Container Queries & Style Debugger Studio
 * JavaScript Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // ------------------------------------------------------------------------
  // 1. DOM Element References
  // ------------------------------------------------------------------------
  const resizableContainer = document.getElementById('resizableContainer');
  const containerTarget = document.getElementById('containerTarget');
  const widthNumInput = document.getElementById('widthNumInput');
  const heightNumInput = document.getElementById('heightNumInput');
  const dimWidthPx = document.getElementById('dimWidthPx');
  const dimHeightPx = document.getElementById('dimHeightPx');
  const aspectRatioTag = document.getElementById('aspectRatioTag');
  const breakpointToast = document.getElementById('breakpointToast');
  const activeBreakpointText = document.getElementById('activeBreakpointText');

  const rulerBar = document.getElementById('rulerBar');
  const rulerTicks = document.getElementById('rulerTicks');
  const rulerMarkers = document.getElementById('rulerMarkers');
  const toggleRulerBtn = document.getElementById('toggleRulerBtn');
  const toggleGridBtn = document.getElementById('toggleGridBtn');
  const stageCanvas = document.getElementById('stageCanvas');

  const liveCssEditor = document.getElementById('liveCssEditor');
  const lineNumbers = document.getElementById('lineNumbers');
  const dynamicCqStyles = document.getElementById('dynamicCqStyles');
  const queryRulesList = document.getElementById('queryRulesList');
  const parsedRulesCount = document.getElementById('parsedRulesCount');

  const cqSupportBadge = document.getElementById('cqSupportBadge');
  const houdiniSupportBadge = document.getElementById('houdiniSupportBadge');
  const houdiniStatusBadge = document.getElementById('houdiniStatusBadge');

  const unitValueInput = document.getElementById('unitValueInput');
  const unitTypeSelect = document.getElementById('unitTypeSelect');
  const unitBarsContainer = document.getElementById('unitBarsContainer');

  const containerTypeSelect = document.getElementById('containerTypeSelect');
  const containerNameInput = document.getElementById('containerNameInput');

  const copyCssBtn = document.getElementById('copyCssBtn');
  const resetPlaygroundBtn = document.getElementById('resetPlaygroundBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  // Computed metrics spans
  const val100cqw = document.getElementById('val100cqw');
  const val1cqw = document.getElementById('val1cqw');
  const val100cqh = document.getElementById('val100cqh');
  const val1cqh = document.getElementById('val1cqh');
  const val1cqmin = document.getElementById('val1cqmin');
  const val1cqmax = document.getElementById('val1cqmax');

  // Computed styles table spans
  const csFontSize = document.getElementById('csFontSize');
  const csDisplay = document.getElementById('csDisplay');
  const csFlexDir = document.getElementById('csFlexDir');
  const csGridCols = document.getElementById('csGridCols');

  // ------------------------------------------------------------------------
  // 2. Templates Data Store
  // ------------------------------------------------------------------------
  const TEMPLATES = {
    productCard: {
      name: 'E-commerce Card',
      html: `
        <div class="product-card">
          <div class="product-image-box">
            <i class="fa-solid fa-headset"></i>
            <span class="product-badge">25% OFF</span>
          </div>
          <div class="product-details">
            <h2 class="product-title">Studio Wireless Headphones Pro</h2>
            <p class="product-desc">High-fidelity acoustic isolation with dynamic spatial audio tracking and ultra-soft memory foam ear cushions.</p>
            <div class="product-price-row">
              <span class="product-price">$299.99</span>
              <button class="product-buy-btn"><i class="fa-solid fa-cart-plus"></i> Add to Cart</button>
            </div>
          </div>
        </div>
      `,
      css: `/* Container Queries for E-commerce Card */
@container card-container (min-width: 440px) {
  .product-card {
    flex-direction: row;
    align-items: center;
  }
  .product-image-box {
    width: 45%;
    height: 100%;
    min-height: 220px;
  }
}

@container card-container (min-width: 680px) {
  .product-card {
    background: linear-gradient(135deg, rgba(31, 41, 55, 0.9), rgba(99, 102, 241, 0.2));
    border-color: #6366f1;
    padding: 24px;
  }
  .product-image-box {
    width: 40%;
  }
  .product-buy-btn {
    padding: 12px 24px;
    font-size: 1rem;
  }
}`
    },

    profileCard: {
      name: 'User Profile Widget',
      html: `
        <div class="profile-card">
          <div class="profile-avatar">
            <i class="fa-solid fa-user-astronaut"></i>
          </div>
          <div class="profile-info-col">
            <h2 class="profile-name">Alex Rivera</h2>
            <p class="profile-role">Senior Design Technologist</p>
            
            <div class="profile-stats-grid">
              <div class="stat-box">
                <div class="stat-num">142</div>
                <div class="stat-lbl">Projects</div>
              </div>
              <div class="stat-box">
                <div class="stat-num">18.4k</div>
                <div class="stat-lbl">Followers</div>
              </div>
              <div class="stat-box">
                <div class="stat-num">4.9 ★</div>
                <div class="stat-lbl">Rating</div>
              </div>
            </div>
          </div>
        </div>
      `,
      css: `/* Container Queries for Profile Card */
@container card-container (min-width: 480px) {
  .profile-card {
    flex-direction: row;
    text-align: left;
    align-items: flex-start;
  }
  .profile-avatar {
    margin-right: 12px;
  }
}

@container card-container (min-width: 640px) {
  .profile-card {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(31, 41, 55, 0.9));
    border-color: #10b981;
  }
}`
    },

    newsFeed: {
      name: 'News Feed Card',
      html: `
        <div class="news-card">
          <span class="news-tag">BREAKING TECH</span>
          <h2 class="news-headline">CSS Container Queries & Style Queries Reach Full Cross-Browser Baseline Standard</h2>
          <p class="news-excerpt">Modern responsive web design evolves beyond screen dimensions. Developers can now craft context-aware UI components that respond seamlessly to their parent container size.</p>
          <div class="news-meta">
            <span><i class="fa-regular fa-clock"></i> 4 min read</span>
            <span><i class="fa-regular fa-user"></i> Tech Desk</span>
          </div>
        </div>
      `,
      css: `/* Container Queries for News Feed Card */
@container card-container (min-width: 520px) {
  .news-card {
    padding: 24px;
    background: linear-gradient(180deg, var(--bg-tertiary), rgba(16, 185, 129, 0.08));
    border-color: rgba(16, 185, 129, 0.4);
  }
}`
    },

    customSandbox: {
      name: 'Custom HTML Sandbox',
      html: `
        <div class="sandbox-card">
          <div class="sandbox-box">
            <h3>Custom Container Sandbox</h3>
            <p>Resize container to test container relative units (cqw, cqh) and container query breakpoints!</p>
          </div>
        </div>
      `,
      css: `/* Custom Sandbox Rules */
@container card-container (min-width: 500px) {
  .sandbox-box {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.1);
  }
}`
    }
  };

  let activeTemplateKey = 'productCard';
  let activeWidth = 640;
  let activeHeight = 480;
  let lastMatchedBreakpoints = new Set();

  // ------------------------------------------------------------------------
  // 3. Feature Support Check & Houdini Initializer
  // ------------------------------------------------------------------------
  function checkBrowserSupport() {
    const cqSupported = CSS.supports('container-type', 'inline-size');
    if (cqSupported) {
      cqSupportBadge.className = 'support-item supported';
      cqSupportBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> CQ Supported';
    } else {
      cqSupportBadge.className = 'support-item unsupported';
      cqSupportBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> CQ Polyfill Active';
    }

    const houdiniSupported = 'registerProperty' in CSS;
    if (houdiniSupported) {
      houdiniSupportBadge.className = 'support-item supported';
      houdiniSupportBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Houdini Active';
      houdiniStatusBadge.textContent = 'Active';
      houdiniStatusBadge.className = 'badge badge-success';

      // Register Houdini Custom Property if supported
      try {
        CSS.registerProperty({
          name: '--card-accent',
          syntax: '<color>',
          inherits: true,
          initialValue: '#6366f1'
        });
      } catch (e) {
        // Property already registered or fallback
      }
    } else {
      houdiniSupportBadge.className = 'support-item unsupported';
      houdiniSupportBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Houdini Limited';
      houdiniStatusBadge.textContent = 'Fallback';
      houdiniStatusBadge.className = 'badge badge-info';
    }
  }

  // ------------------------------------------------------------------------
  // 4. Tab Navigation & Snippet Inserters
  // ------------------------------------------------------------------------
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Snippets
  const SNIPPETS = {
    'width-400': '@container card-container (min-width: 400px) {\n  /* Your styles here */\n}\n',
    'width-600': '@container card-container (min-width: 600px) {\n  /* Your styles here */\n}\n',
    'cqw-units': 'font-size: clamp(1rem, 4cqw, 2rem);\npadding: 2cqw;\n',
    'style-query': '@container card-container style(--card-theme: emerald) {\n  /* Theme overrides */\n}\n'
  };

  document.querySelectorAll('.snippet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-snippet');
      if (SNIPPETS[type]) {
        liveCssEditor.value += '\n' + SNIPPETS[type];
        onCssEditorChange();
      }
    });
  });

  // ------------------------------------------------------------------------
  // 5. Template Switcher Logic
  // ------------------------------------------------------------------------
  document.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.template-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const templateKey = card.getAttribute('data-template');
      loadTemplate(templateKey);
    });
  });

  function loadTemplate(key) {
    if (!TEMPLATES[key]) return;
    activeTemplateKey = key;
    const template = TEMPLATES[key];

    containerTarget.innerHTML = template.html;
    liveCssEditor.value = template.css;
    onCssEditorChange();
    updateComputedStyles();
  }

  // ------------------------------------------------------------------------
  // 6. Live CSS Editor & Dynamic Injections
  // ------------------------------------------------------------------------
  function onCssEditorChange() {
    const cssText = liveCssEditor.value;
    dynamicCqStyles.textContent = cssText;
    updateLineNumbers();
    parseAndInspectQueries(cssText);
  }

  function updateLineNumbers() {
    const lines = liveCssEditor.value.split('\n').length;
    let numbersHtml = '';
    for (let i = 1; i <= lines; i++) {
      numbersHtml += `${i}<br>`;
    }
    lineNumbers.innerHTML = numbersHtml;
  }

  liveCssEditor.addEventListener('input', onCssEditorChange);
  liveCssEditor.addEventListener('scroll', () => {
    lineNumbers.scrollTop = liveCssEditor.scrollTop;
  });

  // ------------------------------------------------------------------------
  // 7. Resizable Container Controls & Drag Handles Logic
  // ------------------------------------------------------------------------
  let isDragging = false;
  let activeHandle = null;
  let startX = 0;
  let startY = 0;
  let startW = 0;
  let startH = 0;

  document.querySelectorAll('.resize-handle').forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      activeHandle = handle.getAttribute('data-handle');
      startX = e.clientX;
      startY = e.clientY;
      startW = resizableContainer.offsetWidth;
      startH = resizableContainer.offsetHeight;
      resizableContainer.classList.add('resizing');

      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragEnd);
    });
  });

  function onDragMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let newW = startW;
    let newH = startH;

    if (activeHandle === 'e' || activeHandle === 'se') {
      newW = Math.max(220, Math.min(1200, startW + dx));
    }
    if (activeHandle === 's' || activeHandle === 'se') {
      newH = Math.max(200, Math.min(900, startH + dy));
    }

    setContainerDimensions(newW, newH);
  }

  function onDragEnd() {
    isDragging = false;
    resizableContainer.classList.remove('resizing');
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
  }

  // Presets & Direct Number Inputs
  document.querySelectorAll('.preset-pills .btn-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-pills .btn-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const w = parseInt(btn.getAttribute('data-width'), 10);
      setContainerDimensions(w, activeHeight);
    });
  });

  widthNumInput.addEventListener('input', () => {
    const val = parseInt(widthNumInput.value, 10);
    if (!isNaN(val)) setContainerDimensions(val, activeHeight);
  });

  heightNumInput.addEventListener('input', () => {
    const val = parseInt(heightNumInput.value, 10);
    if (!isNaN(val)) setContainerDimensions(activeWidth, val);
  });

  function setContainerDimensions(w, h) {
    activeWidth = Math.round(w);
    activeHeight = Math.round(h);

    resizableContainer.style.width = `${activeWidth}px`;
    resizableContainer.style.height = `${activeHeight}px`;

    widthNumInput.value = activeWidth;
    heightNumInput.value = activeHeight;
    dimWidthPx.textContent = `${activeWidth}px`;
    dimHeightPx.textContent = `${activeHeight}px`;

    // Calculate Aspect Ratio
    const gcdVal = gcd(activeWidth, activeHeight);
    const aspectW = Math.round(activeWidth / gcdVal);
    const aspectH = Math.round(activeHeight / gcdVal);
    aspectRatioTag.textContent = `${aspectW}:${aspectH}`;

    updateMetricsAndInspector();
  }

  function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
  }

  // ------------------------------------------------------------------------
  // 8. Container Configuration Controls
  // ------------------------------------------------------------------------
  containerTypeSelect.addEventListener('change', () => {
    containerTarget.style.containerType = containerTypeSelect.value;
    updateComputedStyles();
  });

  containerNameInput.addEventListener('input', () => {
    containerTarget.style.containerName = containerNameInput.value || 'card-container';
    onCssEditorChange();
  });

  // Houdini Theme Chip Switcher
  document.querySelectorAll('.theme-preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.theme-preset-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const themeColor = chip.getAttribute('data-color');
      containerTarget.style.setProperty('--card-theme', themeColor);
      onCssEditorChange();
    });
  });

  document.getElementById('cardDensitySelect').addEventListener('change', (e) => {
    containerTarget.style.setProperty('--card-mode', e.target.value);
  });

  // ------------------------------------------------------------------------
  // 9. ResizeObserver & Inspector Updates
  // ------------------------------------------------------------------------
  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      const cr = entry.contentRect;
      if (cr.width > 0 && cr.height > 0) {
        updateMetricsAndInspector();
      }
    }
  });
  resizeObserver.observe(resizableContainer);

  function updateMetricsAndInspector() {
    const w = resizableContainer.offsetWidth;
    const h = resizableContainer.offsetHeight;

    // CQ Units Calculation
    val100cqw.textContent = `${w.toFixed(1)}px`;
    val1cqw.textContent = `${(w / 100).toFixed(1)}px`;
    val100cqh.textContent = `${h.toFixed(1)}px`;
    val1cqh.textContent = `${(h / 100).toFixed(1)}px`;

    const cqmin = Math.min(w, h) / 100;
    const cqmax = Math.max(w, h) / 100;
    val1cqmin.textContent = `${cqmin.toFixed(1)}px`;
    val1cqmax.textContent = `${cqmax.toFixed(1)}px`;

    updateCalculatorBars();
    updateComputedStyles();
    parseAndInspectQueries(liveCssEditor.value);
    renderRulerTicks();
  }

  function updateComputedStyles() {
    const firstChild = containerTarget.firstElementChild;
    if (!firstChild) return;
    const cs = window.getComputedStyle(firstChild);
    csFontSize.textContent = cs.fontSize || '16px';
    csDisplay.textContent = cs.display || 'block';
    csFlexDir.textContent = cs.flexDirection || 'row';
    csGridCols.textContent = cs.gridTemplateColumns || 'none';
  }

  // ------------------------------------------------------------------------
  // 10. Container Unit Comparison Calculator
  // ------------------------------------------------------------------------
  unitValueInput.addEventListener('input', updateCalculatorBars);
  unitTypeSelect.addEventListener('change', updateCalculatorBars);

  function updateCalculatorBars() {
    const val = parseFloat(unitValueInput.value) || 50;
    const mode = unitTypeSelect.value;
    const w = activeWidth;
    const h = activeHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let items = [];

    if (mode === 'width') {
      const cqwPx = (w * val) / 100;
      const vwPx = (vw * val) / 100;
      items = [
        { label: `${val}cqw (Container Width)`, px: cqwPx, fillClass: 'fill-cqw' },
        { label: `${val}vw (Viewport Width)`, px: vwPx, fillClass: 'fill-vw' }
      ];
    } else if (mode === 'height') {
      const cqhPx = (h * val) / 100;
      const vhPx = (vh * val) / 100;
      items = [
        { label: `${val}cqh (Container Height)`, px: cqhPx, fillClass: 'fill-cqh' },
        { label: `${val}vh (Viewport Height)`, px: vhPx, fillClass: 'fill-vh' }
      ];
    } else {
      const cqminPx = (Math.min(w, h) * val) / 100;
      const vminPx = (Math.min(vw, vh) * val) / 100;
      items = [
        { label: `${val}cqmin (Container Min)`, px: cqminPx, fillClass: 'fill-cqw' },
        { label: `${val}vmin (Viewport Min)`, px: vminPx, fillClass: 'fill-vw' }
      ];
    }

    const maxPx = Math.max(...items.map(i => i.px), 1);

    unitBarsContainer.innerHTML = items.map(item => {
      const pct = Math.min(100, (item.px / maxPx) * 100);
      return `
        <div class="unit-bar-group">
          <div class="unit-bar-header">
            <span class="unit-bar-label">${item.label}</span>
            <span class="unit-bar-val">${item.px.toFixed(1)}px</span>
          </div>
          <div class="unit-bar-track">
            <div class="unit-bar-fill ${item.fillClass}" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ------------------------------------------------------------------------
  // 11. CSS Container Query Parser & Inspector Engine
  // ------------------------------------------------------------------------
  function parseAndInspectQueries(cssText) {
    // Regex for parsing `@container [name] (query)`
    const cqRegex = /@container\s+([^{]+)\{/g;
    let match;
    const rules = [];

    while ((match = cqRegex.exec(cssText)) !== null) {
      const queryExpr = match[1].trim();
      rules.push(queryExpr);
    }

    parsedRulesCount.textContent = `${rules.length} rule${rules.length === 1 ? '' : 's'}`;

    let html = '';
    const currentW = activeWidth;
    const currentH = activeHeight;
    const currentMatchedBreakpoints = new Set();
    const breakpointsForRuler = [];

    rules.forEach((ruleExpr, index) => {
      let isMatch = false;
      const minWMatch = ruleExpr.match(/min-width:\s*(\d+)px/);
      const maxWMatch = ruleExpr.match(/max-width:\s*(\d+)px/);
      const minHMatch = ruleExpr.match(/min-height:\s*(\d+)px/);

      if (minWMatch) {
        const threshold = parseInt(minWMatch[1], 10);
        breakpointsForRuler.push(threshold);
        if (currentW >= threshold) isMatch = true;
      }
      if (maxWMatch) {
        const threshold = parseInt(maxWMatch[1], 10);
        breakpointsForRuler.push(threshold);
        if (currentW <= threshold) isMatch = true;
      }
      if (minHMatch) {
        const threshold = parseInt(minHMatch[1], 10);
        if (currentH >= threshold) isMatch = true;
      }

      // Check style query match
      if (ruleExpr.includes('style(')) {
        isMatch = true; // Style query indicator
      }

      if (isMatch) {
        currentMatchedBreakpoints.add(ruleExpr);
      }

      html += `
        <div class="rule-status-item ${isMatch ? 'active' : 'inactive'}">
          <span class="rule-name">@container ${ruleExpr}</span>
          <span class="rule-badge ${isMatch ? 'match' : 'no-match'}">
            ${isMatch ? 'MATCH' : 'INACTIVE'}
          </span>
        </div>
      `;
    });

    queryRulesList.innerHTML = html || '<div style="color:var(--text-muted); font-size:0.8rem;">No @container rules detected in editor</div>';

    // Trigger Toast Notification on Breakpoint Crossing
    currentMatchedBreakpoints.forEach(bp => {
      if (!lastMatchedBreakpoints.has(bp)) {
        showBreakpointToast(`@container ${bp}`);
      }
    });
    lastMatchedBreakpoints = currentMatchedBreakpoints;

    renderRulerMarkers(breakpointsForRuler);
  }

  function showBreakpointToast(text) {
    activeBreakpointText.textContent = text;
    breakpointToast.classList.add('show');
    setTimeout(() => {
      breakpointToast.classList.remove('show');
    }, 2200);
  }

  // ------------------------------------------------------------------------
  // 12. Visual Ruler & Toggles
  // ------------------------------------------------------------------------
  function renderRulerTicks() {
    let ticksHtml = '';
    const step = 50;
    const max = 1200;
    for (let x = 0; x <= max; x += 10) {
      const isMajor = x % step === 0;
      const pct = (x / max) * 100;
      ticksHtml += `
        <div class="ruler-tick ${isMajor ? 'major' : 'minor'}" style="left: ${pct}%;"></div>
      `;
      if (isMajor && x > 0 && x < max) {
        ticksHtml += `<div class="ruler-label" style="left: ${pct}%;">${x}</div>`;
      }
    }
    rulerTicks.innerHTML = ticksHtml;
  }

  function renderRulerMarkers(breakpoints) {
    const max = 1200;
    rulerMarkers.innerHTML = breakpoints.map(bp => {
      const pct = (bp / max) * 100;
      const active = activeWidth >= bp;
      return `
        <div class="ruler-marker-flag ${active ? 'active' : ''}" style="left: ${pct}%;">
          ${bp}px
        </div>
      `;
    }).join('');
  }

  toggleRulerBtn.addEventListener('click', () => {
    toggleRulerBtn.classList.toggle('active');
    rulerBar.style.display = toggleRulerBtn.classList.contains('active') ? 'flex' : 'none';
  });

  toggleGridBtn.addEventListener('click', () => {
    toggleGridBtn.classList.toggle('active');
    stageCanvas.classList.toggle('show-grid', toggleGridBtn.classList.contains('active'));
  });

  // ------------------------------------------------------------------------
  // 13. Header Actions (Copy CSS, Reset, Theme Toggle)
  // ------------------------------------------------------------------------
  copyCssBtn.addEventListener('click', () => {
    const textToCopy = liveCssEditor.value;
    navigator.clipboard.writeText(textToCopy).then(() => {
      copyCssBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
      setTimeout(() => {
        copyCssBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy CSS';
      }, 2000);
    });
  });

  resetPlaygroundBtn.addEventListener('click', () => {
    setContainerDimensions(640, 480);
    loadTemplate('productCard');
  });

  themeToggleBtn.addEventListener('click', () => {
    const htmlEl = document.documentElement;
    const currentTheme = htmlEl.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    htmlEl.setAttribute('data-theme', newTheme);
    themeToggleBtn.querySelector('i').className = newTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  });

  // ------------------------------------------------------------------------
  // 14. Initial App Bootstrapping
  // ------------------------------------------------------------------------
  checkBrowserSupport();
  setContainerDimensions(640, 480);
  loadTemplate('productCard');
  renderRulerTicks();
});
