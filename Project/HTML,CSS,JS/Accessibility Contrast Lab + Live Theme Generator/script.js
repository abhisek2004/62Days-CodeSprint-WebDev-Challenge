(function() {
    'use strict';

    // ----- DOM refs -----
    const bgColor = document.getElementById('bgColor');
    const bgColorHex = document.getElementById('bgColorHex');
    const textPrimaryColor = document.getElementById('textPrimaryColor');
    const textPrimaryColorHex = document.getElementById('textPrimaryColorHex');
    const textSecondaryColor = document.getElementById('textSecondaryColor');
    const textSecondaryColorHex = document.getElementById('textSecondaryColorHex');
    const accentColor = document.getElementById('accentColor');
    const accentColorHex = document.getElementById('accentColorHex');
    const successColor = document.getElementById('successColor');
    const successColorHex = document.getElementById('successColorHex');
    const errorColor = document.getElementById('errorColor');
    const errorColorHex = document.getElementById('errorColorHex');
    const warningColor = document.getElementById('warningColor');
    const warningColorHex = document.getElementById('warningColorHex');
    const borderColor = document.getElementById('borderColor');
    const borderColorHex = document.getElementById('borderColorHex');

    const ratioPrimary = document.getElementById('ratioPrimary');
    const ratioSecondary = document.getElementById('ratioSecondary');
    const ratioAccent = document.getElementById('ratioAccent');
    const badgePrimaryAA = document.getElementById('badgePrimaryAA');
    const badgePrimaryAAA = document.getElementById('badgePrimaryAAA');
    const badgeSecondaryAA = document.getElementById('badgeSecondaryAA');
    const badgeSecondaryAAA = document.getElementById('badgeSecondaryAAA');
    const badgeAccentAA = document.getElementById('badgeAccentAA');
    const badgeAccentAAA = document.getElementById('badgeAccentAAA');
    const fixPrimary = document.getElementById('fixPrimary');
    const fixSecondary = document.getElementById('fixSecondary');
    const fixAccent = document.getElementById('fixAccent');
    const contrastSummary = document.getElementById('contrastSummary');
    const cssVariablesOutput = document.getElementById('cssVariablesOutput');
    const copyCssBtn = document.getElementById('copyCssBtn');
    const resetColorsBtn = document.getElementById('resetColorsBtn');
    const previewContainer = document.getElementById('previewContainer');
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const themeLabel = document.getElementById('themeLabel');

    // ----- Default theme -----
    const DEFAULT_THEME = {
        bg: '#1a1a2e',
        textPrimary: '#e2e8f0',
        textSecondary: '#94a3b8',
        accent: '#3b82f6',
        success: '#22c55e',
        error: '#ef4444',
        warning: '#f59e0b',
        border: '#334155'
    };

    let currentTheme = { ...DEFAULT_THEME };

    // ----- Theme -----
    function setTheme(dark) {
        document.body.classList.toggle('dark', dark);
        themeIcon.textContent = dark ? '☀️' : '🌙';
        themeLabel.textContent = dark ? 'Light' : 'Dark';
    }

    themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark');
        setTheme(!isDark);
    });

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme(true);
    }

    // ----- WCAG Contrast Calculation -----
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    function luminance(r, g, b) {
        const [rs, gs, bs] = [r, g, b].map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    function contrastRatio(color1, color2) {
        const rgb1 = hexToRgb(color1);
        const rgb2 = hexToRgb(color2);
        const l1 = luminance(rgb1.r, rgb1.g, rgb1.b);
        const l2 = luminance(rgb2.r, rgb2.g, rgb2.b);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    function getContrastLevel(ratio) {
        const aa = ratio >= 4.5;
        const aaLarge = ratio >= 3;
        const aaa = ratio >= 7;
        const aaaLarge = ratio >= 4.5;
        return { aa, aaLarge, aaa, aaaLarge };
    }

    function suggestFix(color1, color2, target = 4.5) {
        // Simple suggestion: lighten/darken based on luminance
        const rgb1 = hexToRgb(color1);
        const rgb2 = hexToRgb(color2);
        const l1 = luminance(rgb1.r, rgb1.g, rgb1.b);
        const l2 = luminance(rgb2.r, rgb2.g, rgb2.b);
        
        if (l1 > l2) {
            // color1 is lighter, try darkening color2 or lightening color1
            return 'Try making the text color lighter or background darker.';
        } else {
            return 'Try making the text color darker or background lighter.';
        }
    }

    // ----- Update contrast -----
    function updateContrast() {
        const bg = bgColor.value;
        const textPrimary = textPrimaryColor.value;
        const textSecondary = textSecondaryColor.value;
        const accent = accentColor.value;

        // Primary contrast
        const ratio1 = contrastRatio(bg, textPrimary);
        const level1 = getContrastLevel(ratio1);
        ratioPrimary.textContent = ratio1.toFixed(2) + ' : 1';
        updateBadge(badgePrimaryAA, level1.aa);
        updateBadgeAAA(badgePrimaryAAA, level1.aaa);
        updateFix(fixPrimary, ratio1, bg, textPrimary);

        // Secondary contrast
        const ratio2 = contrastRatio(bg, textSecondary);
        const level2 = getContrastLevel(ratio2);
        ratioSecondary.textContent = ratio2.toFixed(2) + ' : 1';
        updateBadge(badgeSecondaryAA, level2.aa);
        updateBadgeAAA(badgeSecondaryAAA, level2.aaa);
        updateFix(fixSecondary, ratio2, bg, textSecondary);

        // Accent contrast
        const ratio3 = contrastRatio(bg, accent);
        const level3 = getContrastLevel(ratio3);
        ratioAccent.textContent = ratio3.toFixed(2) + ' : 1';
        updateBadge(badgeAccentAA, level3.aa);
        updateBadgeAAA(badgeAccentAAA, level3.aaa);
        updateFix(fixAccent, ratio3, bg, accent);

        // Summary
        const allAA = level1.aa && level2.aa && level3.aa;
        const allAAA = level1.aaa && level2.aaa && level3.aaa;
        contrastSummary.textContent = `WCAG AA: ${allAA ? '✅' : '❌'} · AAA: ${allAAA ? '✅' : '❌'}`;
        contrastSummary.style.background = allAA ? '#d1fae5' : '#fee2e2';
        contrastSummary.style.color = allAA ? '#065f46' : '#991b1b';

        // Update CSS variables preview
        updateCSSVariables();
        updatePreview();
    }

    function updateBadge(badge, pass) {
        if (pass) {
            badge.textContent = '✅ Pass';
            badge.className = 'badge pass';
        } else {
            badge.textContent = '❌ Fail';
            badge.className = 'badge fail';
        }
    }

    function updateBadgeAAA(badge, pass) {
        if (pass) {
            badge.textContent = '✅ Pass';
            badge.className = 'badge pass';
        } else {
            badge.textContent = '⚠️ Fail';
            badge.className = 'badge warning';
        }
    }

    function updateFix(fixEl, ratio, bg, text) {
        if (ratio < 4.5) {
            fixEl.textContent = '💡 ' + suggestFix(bg, text);
            fixEl.className = 'contrast-fix show suggest';
        } else if (ratio < 7) {
            fixEl.textContent = '💡 Good for AA, consider improving for AAA (7:1)';
            fixEl.className = 'contrast-fix show suggest';
        } else {
            fixEl.textContent = '✅ Excellent contrast!';
            fixEl.className = 'contrast-fix show';
            fixEl.style.borderLeftColor = '#22c55e';
        }
    }

    // ----- Update CSS variables -----
    function updateCSSVariables() {
        const css = `:root {\n  --bg-color: ${bgColor.value};\n  --text-primary: ${textPrimaryColor.value};\n  --text-secondary: ${textSecondaryColor.value};\n  --accent: ${accentColor.value};\n  --success: ${successColor.value};\n  --error: ${errorColor.value};\n  --warning: ${warningColor.value};\n  --border: ${borderColor.value};\n}`;
        cssVariablesOutput.textContent = css;
    }

    // ----- Update preview -----
    function updatePreview() {
        previewContainer.style.setProperty('--bg-color', bgColor.value);
        previewContainer.style.setProperty('--text-primary', textPrimaryColor.value);
        previewContainer.style.setProperty('--text-secondary', textSecondaryColor.value);
        previewContainer.style.setProperty('--accent', accentColor.value);
        previewContainer.style.setProperty('--success', successColor.value);
        previewContainer.style.setProperty('--error', errorColor.value);
        previewContainer.style.setProperty('--warning', warningColor.value);
        previewContainer.style.setProperty('--border', borderColor.value);
    }

    // ----- Sync color inputs -----
    function syncColorInputs() {
        bgColorHex.value = bgColor.value;
        textPrimaryColorHex.value = textPrimaryColor.value;
        textSecondaryColorHex.value = textSecondaryColor.value;
        accentColorHex.value = accentColor.value;
        successColorHex.value = successColor.value;
        errorColorHex.value = errorColor.value;
        warningColorHex.value = warningColor.value;
        borderColorHex.value = borderColor.value;
    }

    // ----- Reset colors -----
    function resetColors() {
        bgColor.value = DEFAULT_THEME.bg;
        textPrimaryColor.value = DEFAULT_THEME.textPrimary;
        textSecondaryColor.value = DEFAULT_THEME.textSecondary;
        accentColor.value = DEFAULT_THEME.accent;
        successColor.value = DEFAULT_THEME.success;
        errorColor.value = DEFAULT_THEME.error;
        warningColor.value = DEFAULT_THEME.warning;
        borderColor.value = DEFAULT_THEME.border;
        syncColorInputs();
        updateContrast();
    }

    // ----- Copy CSS -----
    function copyCSS() {
        const css = cssVariablesOutput.textContent;
        navigator.clipboard.writeText(css).then(() => {
            const original = copyCssBtn.textContent;
            copyCssBtn.textContent = '✅ Copied!';
            setTimeout(() => {
                copyCssBtn.textContent = original;
            }, 2000);
        });
    }
})();