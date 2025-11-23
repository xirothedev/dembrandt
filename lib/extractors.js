/**
 * Brand Extraction Engine
 *
 * Core extraction logic with stealth mode, retry mechanisms, and parallel processing.
 * Handles bot detection, SPA hydration, and comprehensive design token extraction.
 */

import { chromium } from "playwright";
import chalk from "chalk";

/**
 * Main extraction function - orchestrates the entire brand analysis process
 *
 * @param {string} url - Target URL to analyze
 * @param {Object} spinner - Ora spinner instance for progress updates
 * @param {Object} passedBrowser - Optional pre-configured browser instance
 * @param {Object} options - Configuration options (navigationTimeout, etc.)
 * @returns {Object} Complete brand extraction data
 */
export async function extractBranding(
  url,
  spinner,
  passedBrowser = null,
  options = {}
) {
  const ownBrowser = !passedBrowser;
  let browser = passedBrowser;

  if (ownBrowser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-dev-shm-usage",
      ],
    });
  }

  spinner.text = "Creating browser context with stealth mode...";
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "en-US",
    permissions: ["clipboard-read", "clipboard-write"],
  });

  // Full stealth — kills 99% of Cloudflare bot detection
  spinner.text = "Injecting anti-detection scripts...";

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 });
    Object.defineProperty(navigator, "deviceMemory", { get: () => 8 });
    Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
    Object.defineProperty(navigator, "maxTouchPoints", { get: () => 0 });

    // Spoof Chrome runtime
    window.chrome = {
      runtime: {},
      loadTimes: () => {},
      csi: () => {},
      app: {},
    };

    // Remove Playwright traces
    delete navigator.__proto__.webdriver;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
  });

  const page = await context.newPage();

  try {
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      attempts++;
      spinner.text = `Navigating to ${url} (attempt ${attempts}/${maxAttempts})...`;
      try {
        const initialUrl = url;
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: options.navigationTimeout || 20000,
        });
        const finalUrl = page.url();

        // Check for redirects or domain changes
        if (initialUrl !== finalUrl) {
          const initialDomain = new URL(initialUrl).hostname;
          const finalDomain = new URL(finalUrl).hostname;

          if (initialDomain !== finalDomain) {
            console.log(
              chalk.yellow(`  ⚠ Page redirected to different domain:`)
            );
            console.log(chalk.dim(`    From: ${initialUrl}`));
            console.log(chalk.dim(`    To:   ${finalUrl}`));
          } else {
            console.log(chalk.cyan(`  ℹ Page redirected within same domain:`));
            console.log(chalk.dim(`    From: ${initialUrl}`));
            console.log(chalk.dim(`    To:   ${finalUrl}`));
          }
        }

        console.log(chalk.dim(`  ✓ Page loaded (domcontentloaded)`));

        // Give SPAs time to hydrate (Linear, Figma, Notion, etc.)
        spinner.text = "Waiting for SPA hydration...";
        await page.waitForTimeout(8000);
        console.log(chalk.dim(`  ✓ Hydration wait complete (8s)`));

        // Optional: wait for main content
        spinner.text = "Waiting for main content...";
        try {
          await page.waitForSelector("main, header, [data-hero], section", {
            timeout: 10000,
          });
          console.log(chalk.dim(`  ✓ Main content detected`));
        } catch {
          console.log(
            chalk.dim(`  ⚠ Main content selector timeout (continuing anyway)`)
          );
        }

        // Simulate human behavior
        spinner.text = "Simulating human interaction...";
        await page.mouse.move(
          300 + Math.random() * 400,
          200 + Math.random() * 300
        );
        await page.evaluate(() => window.scrollTo(0, 400));
        console.log(chalk.dim(`  ✓ Mouse movement and scroll simulated`));

        // Final hydration wait
        spinner.text = "Final content stabilization...";
        await page.waitForTimeout(4000);
        console.log(chalk.dim(`  ✓ Page fully loaded and stable`));

        spinner.text = "Validating page content...";
        const contentLength = await page.evaluate(
          () => document.body.textContent.length
        );
        console.log(chalk.dim(`  ✓ Content length: ${contentLength} chars`));

        if (contentLength > 500) break;

        spinner.warn(
          `Page seems empty (attempt ${attempts}/${maxAttempts}), retrying...`
        );
        console.log(
          chalk.yellow(
            `  ⚠ Content length: ${contentLength} chars (expected >500)`
          )
        );
        await page.waitForTimeout(3000);
      } catch (err) {
        if (attempts >= maxAttempts) {
          console.error(`  ↳ Failed after ${maxAttempts} attempts`);
          console.error(`  ↳ Last error: ${err.message}`);
          console.error(`  ↳ URL: ${url}`);
          throw err;
        }
        spinner.warn(
          `Navigation failed (attempt ${attempts}/${maxAttempts}), retrying...`
        );
        console.log(`  ↳ Error: ${err.message}`);
        await page.waitForTimeout(3000);
      }
    }

    console.log(
      chalk.dim("\n  Starting parallel extraction of design tokens...")
    );

    spinner.text = "Extracting logo and favicons...";
    console.log(chalk.dim(`  → Extracting logo and favicons`));
    const { logo, favicons } = await extractLogo(page, url);
    console.log(chalk.dim(`  ✓ Logo and favicons extracted`));

    spinner.text = "Analyzing design system in parallel...";
    console.log(
      chalk.dim(`  → Extracting colors, typography, spacing, shadows...`)
    );
    console.log(
      chalk.dim(`  → Analyzing components, breakpoints, frameworks...`)
    );

    const [
      colors,
      typography,
      spacing,
      borderRadius,
      shadows,
      buttons,
      inputs,
      links,
      breakpoints,
      iconSystem,
      frameworks,
    ] = await Promise.all([
      extractColors(page),
      extractTypography(page),
      extractSpacing(page),
      extractBorderRadius(page),
      extractShadows(page),
      extractButtonStyles(page),
      extractInputStyles(page),
      extractLinkStyles(page),
      extractBreakpoints(page),
      detectIconSystem(page),
      detectFrameworks(page),
    ]);

    console.log(chalk.dim(`  ✓ Colors: ${colors.palette.length} found`));
    console.log(
      chalk.dim(`  ✓ Typography: ${typography.styles.length} styles`)
    );
    console.log(
      chalk.dim(`  ✓ Spacing: ${spacing.commonValues.length} values`)
    );
    console.log(
      chalk.dim(`  ✓ Border radius: ${borderRadius.values.length} values`)
    );
    console.log(chalk.dim(`  ✓ Shadows: ${shadows.length} found`));
    console.log(chalk.dim(`  ✓ Buttons: ${buttons.length} variants`));
    console.log(chalk.dim(`  ✓ Inputs: ${inputs.length} styles`));
    console.log(chalk.dim(`  ✓ Links: ${links.length} styles`));
    console.log(chalk.dim(`  ✓ Breakpoints: ${breakpoints.length} detected`));
    console.log(chalk.dim(`  ✓ Icon systems: ${iconSystem.length} detected`));
    console.log(chalk.dim(`  ✓ Frameworks: ${frameworks.length} detected`));

    // Extract hover/focus state colors (always enabled - critical for finding real brand colors)
    spinner.text = "Extracting hover/focus state colors...";
    console.log(chalk.dim(`  → Extracting hover/focus state colors`));

    const hoverFocusColors = await page.evaluate(() => {
      const hoverColors = [];
      const interactiveElements = document.querySelectorAll('a, button, [role="button"], input, textarea, [tabindex]');

      interactiveElements.forEach((el, index) => {
        if (index > 50) return; // Limit to first 50 elements for performance

        // Get computed styles
        const computed = getComputedStyle(el);

        // Check for :hover and :focus pseudo-class styles
        // We'll look at CSS rules to find hover/focus colors
        const sheets = Array.from(document.styleSheets);

        sheets.forEach(sheet => {
          try {
            const rules = Array.from(sheet.cssRules || sheet.rules || []);

            rules.forEach(rule => {
              if (!rule.selectorText) return;

              // Check if this rule applies to our element and has :hover or :focus
              if (rule.selectorText.includes(':hover') || rule.selectorText.includes(':focus')) {
                // Try to match the selector to our element
                const baseSelector = rule.selectorText.replace(/:hover|:focus/g, '').trim();

                try {
                  if (el.matches(baseSelector) || baseSelector === '*') {
                    // Extract colors from this rule
                    const style = rule.style;

                    ['color', 'background-color', 'border-color'].forEach(prop => {
                      const value = style.getPropertyValue(prop);
                      if (value && value !== 'transparent' && value !== 'rgba(0, 0, 0, 0)') {
                        hoverColors.push({
                          color: value,
                          property: prop,
                          state: rule.selectorText.includes(':hover') ? 'hover' : 'focus',
                          element: el.tagName.toLowerCase(),
                        });
                      }
                    });
                  }
                } catch (e) {
                  // Selector might not be valid for matches(), skip
                }
              }
            });
          } catch (e) {
            // Cross-origin stylesheet, skip
          }
        });
      });

      return hoverColors;
    });

    // Merge hover/focus colors into palette
    hoverFocusColors.forEach(({ color }) => {
      const isDuplicate = colors.palette.some(c => c.color === color);
      if (!isDuplicate && color) {
        // Normalize and add to palette
        const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        let normalized = color.toLowerCase();
        if (rgbaMatch) {
          const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
          const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
          const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
          normalized = `#${r}${g}${b}`;
        }

        colors.palette.push({
          color,
          normalized,
          count: 1,
          confidence: 'medium',
          sources: ['hover/focus'],
        });
      }
    });

    console.log(chalk.dim(`  ✓ Hover/focus: ${hoverFocusColors.length} state colors found`));

    // Extract additional colors from dark mode if requested
    if (options.darkMode) {
      spinner.text = "Extracting dark mode colors...";
      console.log(chalk.dim(`  → Enabling dark mode and re-extracting colors`));

      // Try multiple methods to enable dark mode
      await page.evaluate(() => {
        // Method 1: Add data-theme attribute
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.setAttribute('data-mode', 'dark');
        document.body.setAttribute('data-theme', 'dark');

        // Method 2: Add dark mode classes
        document.documentElement.classList.add('dark', 'dark-mode', 'theme-dark');
        document.body.classList.add('dark', 'dark-mode', 'theme-dark');

        // Method 3: Trigger prefers-color-scheme media query
        // (Playwright can emulate this, but let's also try programmatically)
      });

      // Emulate prefers-color-scheme: dark
      await page.emulateMedia({ colorScheme: 'dark' });

      // Wait for transitions to complete
      await page.waitForTimeout(500);

      const darkModeColors = await extractColors(page);
      const darkModeButtons = await extractButtonStyles(page);
      const darkModeLinks = await extractLinkStyles(page);

      // Merge dark mode colors into main palette
      const mergedPalette = [...colors.palette];
      darkModeColors.palette.forEach(darkColor => {
        // Check if this color is already in the palette using perceptual similarity
        const isDuplicate = mergedPalette.some(existingColor => {
          // Simple check - could use delta-E here too
          return existingColor.normalized === darkColor.normalized;
        });

        if (!isDuplicate) {
          mergedPalette.push({ ...darkColor, source: 'dark-mode' });
        }
      });

      colors.palette = mergedPalette;

      // Merge semantic colors
      Object.assign(colors.semantic, darkModeColors.semantic);

      // Merge dark mode buttons and links
      buttons.push(...darkModeButtons.map(btn => ({ ...btn, source: 'dark-mode' })));
      links.push(...darkModeLinks.map(link => ({ ...link, source: 'dark-mode' })));

      console.log(chalk.dim(`  ✓ Dark mode: +${darkModeColors.palette.length} colors`));
    }

    // Extract additional colors from mobile viewport if requested
    if (options.mobile) {
      spinner.text = "Extracting mobile viewport colors...";
      console.log(chalk.dim(`  → Switching to mobile viewport (375x667)`));

      // Change viewport to mobile
      await page.setViewportSize({ width: 375, height: 667 });

      // Wait for responsive changes
      await page.waitForTimeout(500);

      const mobileColors = await extractColors(page);

      // Merge mobile colors into main palette
      const mergedPalette = [...colors.palette];
      mobileColors.palette.forEach(mobileColor => {
        const isDuplicate = mergedPalette.some(existingColor => {
          return existingColor.normalized === mobileColor.normalized;
        });

        if (!isDuplicate) {
          mergedPalette.push({ ...mobileColor, source: 'mobile' });
        }
      });

      colors.palette = mergedPalette;

      console.log(chalk.dim(`  ✓ Mobile: +${mobileColors.palette.length} colors`));
    }

    spinner.succeed("Brand extraction complete!");

    const result = {
      url: page.url(),
      extractedAt: new Date().toISOString(),
      logo,
      favicons,
      colors,
      typography,
      spacing,
      borderRadius,
      shadows,
      components: { buttons, inputs, links },
      breakpoints,
      iconSystem,
      frameworks,
    };

    // Detect canvas-only / WebGL sites (Tesla, Apple Vision Pro, etc.)
    const isCanvasOnly = await page.evaluate(() => {
      const canvases = document.querySelectorAll("canvas");
      const hasRealContent = document.body.textContent.trim().length > 200;
      const hasManyCanvases = canvases.length > 3;
      const hasWebGL = Array.from(canvases).some((c) => {
        const ctx = c.getContext("webgl") || c.getContext("webgl2");
        return !!ctx;
      });
      return hasManyCanvases && hasWebGL && !hasRealContent;
    });

    if (isCanvasOnly) {
      result.note =
        "This website uses canvas/WebGL rendering (e.g. Tesla, Apple Vision Pro). Design system cannot be extracted from DOM.";
      result.isCanvasOnly = true;
    }

    if (ownBrowser) await browser.close();

    return result;
  } catch (error) {
    if (ownBrowser) await browser.close();
    spinner.fail("Extraction failed");
    console.error(`  ↳ Error during extraction: ${error.message}`);
    console.error(`  ↳ URL: ${url}`);
    console.error(`  ↳ Stage: ${spinner.text || "unknown"}`);
    throw error;
  }
}

/**
 * Extract logo information from the page
 * Looks for common logo patterns: img with logo in class/id, SVG logos, etc.
 * Includes safe zone estimation and favicon detection
 */
async function extractLogo(page, url) {
  return await page.evaluate((baseUrl) => {
    // Find logo - check img, svg, and svg elements containing <use> with logo references
    const candidates = Array.from(document.querySelectorAll("img, svg")).filter(
      (el) => {
        const className =
          typeof el.className === "string"
            ? el.className
            : el.className.baseVal || "";
        const attrs = (
          className +
          " " +
          (el.id || "") +
          " " +
          (el.getAttribute("alt") || "")
        ).toLowerCase();

        // Check element's own attributes
        if (attrs.includes("logo") || attrs.includes("brand")) {
          return true;
        }

        // For SVG elements, also check <use> children for logo references
        if (el.tagName === "svg" || el.tagName === "SVG") {
          const useElements = el.querySelectorAll("use");
          for (const use of useElements) {
            const href = use.getAttribute("href") || use.getAttribute("xlink:href") || "";
            if (href.toLowerCase().includes("logo") || href.toLowerCase().includes("brand")) {
              return true;
            }
          }
        }

        return false;
      }
    );

    let logoData = null;
    if (candidates.length > 0) {
      const logo = candidates[0];
      const computed = window.getComputedStyle(logo);
      const parent = logo.parentElement;
      const parentComputed = parent ? window.getComputedStyle(parent) : null;

      // Calculate safe zone from padding and margins
      const safeZone = {
        top: parseFloat(computed.marginTop) + (parentComputed ? parseFloat(parentComputed.paddingTop) : 0),
        right: parseFloat(computed.marginRight) + (parentComputed ? parseFloat(parentComputed.paddingRight) : 0),
        bottom: parseFloat(computed.marginBottom) + (parentComputed ? parseFloat(parentComputed.paddingBottom) : 0),
        left: parseFloat(computed.marginLeft) + (parentComputed ? parseFloat(parentComputed.paddingLeft) : 0),
      };

      if (logo.tagName === "IMG") {
        logoData = {
          source: "img",
          url: new URL(logo.src, baseUrl).href,
          width: logo.naturalWidth || logo.width,
          height: logo.naturalHeight || logo.height,
          alt: logo.alt,
          safeZone: safeZone,
        };
      } else {
        // SVG logo - try to get the parent link or closest anchor
        const parentLink = logo.closest('a');
        logoData = {
          source: "svg",
          url: parentLink ? parentLink.href : window.location.href,
          width: logo.width?.baseVal?.value,
          height: logo.height?.baseVal?.value,
          safeZone: safeZone,
        };
      }
    }

    // Extract all favicons
    const favicons = [];

    // Standard favicons
    document.querySelectorAll('link[rel*="icon"]').forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        favicons.push({
          type: link.getAttribute('rel'),
          url: new URL(href, baseUrl).href,
          sizes: link.getAttribute('sizes') || null,
        });
      }
    });

    // Apple touch icons
    document.querySelectorAll('link[rel="apple-touch-icon"]').forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        favicons.push({
          type: 'apple-touch-icon',
          url: new URL(href, baseUrl).href,
          sizes: link.getAttribute('sizes') || null,
        });
      }
    });

    // Open Graph image
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) {
      const content = ogImage.getAttribute('content');
      if (content) {
        favicons.push({
          type: 'og:image',
          url: new URL(content, baseUrl).href,
          sizes: null,
        });
      }
    }

    // Twitter card image
    const twitterImage = document.querySelector('meta[name="twitter:image"]');
    if (twitterImage) {
      const content = twitterImage.getAttribute('content');
      if (content) {
        favicons.push({
          type: 'twitter:image',
          url: new URL(content, baseUrl).href,
          sizes: null,
        });
      }
    }

    // Check for default /favicon.ico if not already included
    const hasFaviconIco = favicons.some(f => f.url.endsWith('/favicon.ico'));
    if (!hasFaviconIco) {
      favicons.push({
        type: 'favicon.ico',
        url: new URL('/favicon.ico', baseUrl).href,
        sizes: null,
      });
    }

    return {
      logo: logoData,
      favicons: favicons,
    };
  }, url);
}

/**
 * Extract color palette with confidence scoring
 * Analyzes semantic colors, CSS variables, and visual frequency
 */
async function extractColors(page) {
  return await page.evaluate(() => {
    // Helper: Convert any color to normalized hex for deduplication
    function normalizeColor(color) {
      const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (rgbaMatch) {
        const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
        const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
        const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
      return color.toLowerCase();
    }

    // Helper: Check if value is a valid simple color (not calc/clamp/var)
    function isValidColorValue(value) {
      if (!value) return false;
      // Reject CSS functions unless they contain actual color values
      if (value.includes('calc(') || value.includes('clamp(') || value.includes('var(')) {
        // Only accept if it contains rgb/hsl/# inside
        return /#[0-9a-f]{3,6}|rgba?\(|hsla?\(/i.test(value);
      }
      // Accept hex, rgb, hsl, named colors
      return /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|[a-z]+)/i.test(value);
    }

    const colorMap = new Map(); // Normalized color -> original representations
    const semanticColors = {};
    const cssVariables = {};

    // Extract CSS variables - filter out framework presets
    const styles = getComputedStyle(document.documentElement);
    const domain = window.location.hostname;

    for (let i = 0; i < styles.length; i++) {
      const prop = styles[i];
      if (prop.startsWith("--")) {
        // Skip WordPress presets (they're almost never customized)
        if (prop.startsWith('--wp--preset')) {
          continue;
        }

        // Skip obvious system/default variables
        if (prop.includes('--system-') || prop.includes('--default-')) {
          continue;
        }

        // Skip cookie consent unless it's a cookie consent domain
        if (prop.includes('--cc-') && !domain.includes('cookie') && !domain.includes('consent')) {
          continue;
        }

        // For other frameworks, allow them through - brands often customize these
        // --tw-* (Tailwind), --bs-* (Bootstrap), --mdc-* (Material), --chakra-* are OK

        const value = styles.getPropertyValue(prop).trim();

        // Skip SCSS functions and invalid values
        if (
          value.includes('color.adjust(') ||
          value.includes('rgba(0, 0, 0, 0)') ||
          value.includes('rgba(0,0,0,0)') ||
          value.includes('lighten(') ||
          value.includes('darken(') ||
          value.includes('saturate(')
        ) {
          continue;
        }

        // Only include valid color values
        if (isValidColorValue(value) && (
          prop.includes("color") ||
          prop.includes("bg") ||
          prop.includes("text") ||
          prop.includes("brand")
        )) {
          cssVariables[prop] = value;
        }
      }
    }

    // Count total visible elements for threshold calculation
    const elements = document.querySelectorAll("*");
    const totalElements = elements.length;

    const contextScores = {
      logo: 3,
      brand: 3,
      primary: 3,
      hero: 2,
      button: 2,
      link: 2,
      header: 2,
      nav: 1,
    };

    elements.forEach((el) => {
      // Skip hidden elements
      const computed = getComputedStyle(el);
      if (computed.display === 'none' || computed.visibility === 'hidden' || computed.opacity === '0') {
        return;
      }

      const bgColor = computed.backgroundColor;
      const textColor = computed.color;

      const context = (el.className + " " + el.id).toLowerCase();
      let score = 1;

      for (const [keyword, weight] of Object.entries(contextScores)) {
        if (context.includes(keyword)) score = Math.max(score, weight);
      }

      [bgColor, textColor].forEach((color) => {
        if (color && color !== "rgba(0, 0, 0, 0)" && color !== "transparent") {
          const normalized = normalizeColor(color);
          const existing = colorMap.get(normalized) || {
            original: color, // Keep first seen format
            count: 0,
            score: 0,
            sources: new Set(),
          };
          existing.count++;
          existing.score += score;
          if (score > 1) {
            const source = context.split(" ")[0].substring(0, 30); // Limit source length
            if (source && !source.includes('__')) { // Skip auto-generated class names
              existing.sources.add(source);
            }
          }
          colorMap.set(normalized, existing);
        }
      });

      // Semantic color detection
      if (context.includes("primary") || el.matches('[class*="primary"]')) {
        semanticColors.primary =
          bgColor !== "rgba(0, 0, 0, 0)" && bgColor !== "transparent"
            ? bgColor
            : textColor;
      }
      if (context.includes("secondary")) {
        semanticColors.secondary = bgColor;
      }
    });

    // Calculate threshold: 1% of elements or minimum 3 occurrences
    const threshold = Math.max(3, Math.floor(totalElements * 0.01));

    // Helper: Check if a color is "structural" (used on >40% of elements)
    // Only filter blacks/whites/grays if they're clearly just scaffolding
    function isStructuralColor(data, totalElements) {
      const usagePercent = (data.count / totalElements) * 100;
      const normalized = normalizeColor(data.original);

      // Pure transparent - always structural
      if (data.original === 'rgba(0, 0, 0, 0)' || data.original === 'transparent') {
        return true;
      }

      // If a color is used on >40% of elements AND has very low semantic score, it's structural
      if (usagePercent > 40 && data.score < data.count * 1.2) {
        return true;
      }

      return false;
    }

    // Helper: Calculate delta-E color distance (simplified CIE76)
    function deltaE(rgb1, rgb2) {
      // Convert hex to RGB if needed
      function hexToRgb(hex) {
        if (!hex.startsWith('#')) return null;
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : null;
      }

      const c1 = hexToRgb(rgb1);
      const c2 = hexToRgb(rgb2);

      if (!c1 || !c2) return 999; // Very different if can't parse

      // Simple RGB distance (not true delta-E but good enough)
      const rDiff = c1.r - c2.r;
      const gDiff = c1.g - c2.g;
      const bDiff = c1.b - c2.b;

      return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
    }

    const palette = Array.from(colorMap.entries())
      .filter(([normalizedColor, data]) => {
        // Filter out colors below threshold
        if (data.count < threshold) return false;

        // Filter out structural colors (very high usage without semantic context)
        if (isStructuralColor(data, totalElements)) {
          return false;
        }

        return true;
      })
      .map(([normalizedColor, data]) => ({
        color: data.original,
        normalized: normalizedColor,
        count: data.count,
        confidence:
          data.score > 20 ? "high" : data.score > 5 ? "medium" : "low",
        sources: Array.from(data.sources).slice(0, 3),
      }))
      .sort((a, b) => b.count - a.count);

    // Apply perceptual deduplication using delta-E
    // Merge colors that are visually very similar (delta-E < 15)
    const perceptuallyDeduped = [];
    const merged = new Set();

    palette.forEach((color, index) => {
      if (merged.has(index)) return;

      // Find all similar colors
      const similar = [color];
      for (let i = index + 1; i < palette.length; i++) {
        if (merged.has(i)) continue;

        const distance = deltaE(color.normalized, palette[i].normalized);
        if (distance < 15) { // Threshold for "visually similar"
          similar.push(palette[i]);
          merged.add(i);
        }
      }

      // Keep the one with highest count (most common variant)
      const best = similar.sort((a, b) => b.count - a.count)[0];
      perceptuallyDeduped.push(best);
    });

    // Deduplicate and filter CSS variables
    const paletteNormalizedColors = new Set(perceptuallyDeduped.map(c => c.normalized));
    const cssVarsByColor = new Map(); // normalized color -> variable names

    Object.entries(cssVariables).forEach(([prop, value]) => {
      const normalized = normalizeColor(value);

      // Skip if this color is already in the palette
      if (paletteNormalizedColors.has(normalized)) {
        return;
      }

      // Apply perceptual deduplication to CSS variables too
      let isDuplicate = false;
      for (const paletteColor of perceptuallyDeduped) {
        if (deltaE(normalized, paletteColor.normalized) < 15) {
          isDuplicate = true;
          break;
        }
      }
      if (isDuplicate) return;

      if (!cssVarsByColor.has(normalized)) {
        cssVarsByColor.set(normalized, { value, vars: [] });
      }
      cssVarsByColor.get(normalized).vars.push(prop);
    });

    // Convert back to object with deduplicated values
    const filteredCssVariables = {};
    cssVarsByColor.forEach(({ value, vars }) => {
      // Only show first variable name if multiple have same value
      filteredCssVariables[vars[0]] = value;
    });

    return { semantic: semanticColors, palette: perceptuallyDeduped, cssVariables: filteredCssVariables };
  });
}

/**
 * Extract typography styles with context awareness
 * Samples headings, body text, buttons, and links
 */
async function extractTypography(page) {
  return await page.evaluate(() => {
    const styles = new Map();
    const sources = { googleFonts: [], adobeFonts: false, customFonts: [] };

    // Detect font sources
    const links = Array.from(
      document.querySelectorAll('link[href*="fonts.googleapis.com"]')
    );
    links.forEach((link) => {
      const match = link.href.match(/family=([^:&]+)/);
      if (match) sources.googleFonts.push(decodeURIComponent(match[1]));
    });

    if (document.querySelector('link[href*="typekit.net"]')) {
      sources.adobeFonts = true;
    }

    // Sample typography - comprehensive selectors including buttons and links
    const selectors = [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "span", "div",
      "a", "a[href]", ".link",
      "button", "button[type]", ".button", ".btn", "[role='button']",
      "label", "li", "td", "th",
      ".hero", ".title", ".heading", ".subtitle",
      ".text", ".caption", ".lead", ".body",
      "[class*='heading']", "[class*='title']",
      "[class*='text']", "[class*='body']",
      "[class*='btn']", "[class*='link']"
    ];
    const elements = document.querySelectorAll(selectors.join(","));

    elements.forEach((el) => {
      const computed = getComputedStyle(el);

      // Skip hidden elements
      if (computed.display === 'none' || computed.visibility === 'hidden') {
        return;
      }

      const key = `${computed.fontFamily}-${computed.fontSize}-${computed.fontWeight}-${computed.fontStyle}`;

      if (!styles.has(key)) {
        // Determine confidence based on element type
        let confidence = "medium";
        const tagName = el.tagName.toLowerCase();
        const className = el.className || "";

        // High confidence for:
        // - Headings (h1-h6)
        // - Buttons and links (key brand elements)
        // - Hero sections
        if (
          el.tagName.match(/H[1-6]/) ||
          tagName === "button" ||
          tagName === "a" ||
          className.includes("hero") ||
          className.includes("btn") ||
          className.includes("button") ||
          el.getAttribute("role") === "button"
        ) {
          confidence = "high";
        }

        styles.set(key, {
          fontFamily: computed.fontFamily,
          fontSize: computed.fontSize,
          fontSizeRem: (parseFloat(computed.fontSize) / 16).toFixed(2) + "rem",
          fontWeight: computed.fontWeight,
          fontStyle: computed.fontStyle,
          textDecoration: computed.textDecoration,
          letterSpacing: computed.letterSpacing,
          textTransform: computed.textTransform,
          lineHeight: computed.lineHeight,
          contexts: [],
          confidence: confidence,
        });
      }

      const style = styles.get(key);
      const context = el.tagName.toLowerCase();

      // Add more specific context for buttons and links
      let contextLabel = context;
      if (context === "button" || el.getAttribute("role") === "button") {
        contextLabel = "button";
      } else if (context === "a" && el.hasAttribute("href")) {
        contextLabel = "a";
      } else if (el.className && typeof el.className === "string") {
        if (el.className.includes("btn") || el.className.includes("button")) {
          contextLabel = "button";
        } else if (el.className.includes("link")) {
          contextLabel = "a";
        }
      }

      if (!style.contexts.includes(contextLabel)) {
        style.contexts.push(contextLabel);
      }
    });

    return { styles: Array.from(styles.values()), sources };
  });
}

/**
 * Extract spacing scale and detect grid system
 */
async function extractSpacing(page) {
  return await page.evaluate(() => {
    const spacings = new Map();

    document.querySelectorAll("*").forEach((el) => {
      const computed = getComputedStyle(el);
      ["marginTop", "marginBottom", "paddingTop", "paddingBottom"].forEach(
        (prop) => {
          const value = parseFloat(computed[prop]);
          if (value > 0) {
            spacings.set(value, (spacings.get(value) || 0) + 1);
          }
        }
      );
    });

    const values = Array.from(spacings.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by count first to get most common
      .slice(0, 20)
      .map(([px, count]) => ({
        px: px + "px",
        rem: (px / 16).toFixed(2) + "rem",
        count,
        numericValue: px
      }))
      .sort((a, b) => a.numericValue - b.numericValue); // Then sort by numeric value

    // Detect grid system
    const is4px = values.some((v) => parseFloat(v.px) % 4 === 0);
    const is8px = values.some((v) => parseFloat(v.px) % 8 === 0);
    const scaleType = is8px ? "8px" : is4px ? "4px" : "custom";

    return { scaleType, commonValues: values };
  });
}

/**
 * Extract border radius patterns
 */
async function extractBorderRadius(page) {
  return await page.evaluate(() => {
    const radii = new Map();

    document.querySelectorAll("*").forEach((el) => {
      const radius = getComputedStyle(el).borderRadius;
      if (radius && radius !== "0px") {
        radii.set(radius, (radii.get(radius) || 0) + 1);
      }
    });

    const values = Array.from(radii.entries())
      .map(([value, count]) => ({
        value,
        count,
        confidence: count > 10 ? "high" : count > 3 ? "medium" : "low",
        numericValue: parseFloat(value) || 0 // Extract numeric value for sorting
      }))
      .sort((a, b) => {
        // Sort by numeric value, with percentage last
        if (a.value.includes('%') && !b.value.includes('%')) return 1;
        if (!a.value.includes('%') && b.value.includes('%')) return -1;
        return a.numericValue - b.numericValue;
      });

    return { values };
  });
}

/**
 * Extract box shadow patterns for elevation systems
 */
async function extractShadows(page) {
  return await page.evaluate(() => {
    const shadows = new Map();

    document.querySelectorAll("*").forEach((el) => {
      const shadow = getComputedStyle(el).boxShadow;
      if (shadow && shadow !== "none") {
        shadows.set(shadow, (shadows.get(shadow) || 0) + 1);
      }
    });

    return Array.from(shadows.entries())
      .map(([shadow, count]) => ({
        shadow,
        count,
        confidence: count > 5 ? "high" : count > 2 ? "medium" : "low",
      }))
      .sort((a, b) => b.count - a.count);
  });
}

/**
 * Extract button component styles and variants
 */
async function extractButtonStyles(page) {
  return await page.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll('button, .btn, [class*="button"]')
    );

    return buttons
      .slice(0, 10)
      .map((btn) => {
        const computed = getComputedStyle(btn);
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          padding: computed.padding,
          borderRadius: computed.borderRadius,
          border: computed.border,
          fontWeight: computed.fontWeight,
          fontSize: computed.fontSize,
          classes: btn.className,
          confidence: btn.tagName === "BUTTON" ? "high" : "medium",
        };
      })
      .filter(
        (btn, i, arr) =>
          arr.findIndex((b) => b.backgroundColor === btn.backgroundColor) === i
      );
  });
}

/**
 * Extract input field styles
 */
async function extractInputStyles(page) {
  return await page.evaluate(() => {
    const inputs = Array.from(
      document.querySelectorAll("input, textarea, select")
    );

    const uniqueStyles = new Map();

    inputs.forEach((input) => {
      const computed = getComputedStyle(input);
      const key = `${input.tagName.toLowerCase()}-${computed.border}-${computed.borderRadius}-${computed.padding}`;

      if (!uniqueStyles.has(key)) {
        uniqueStyles.set(key, {
          type: input.tagName.toLowerCase(),
          border: computed.border,
          borderRadius: computed.borderRadius,
          padding: computed.padding,
          backgroundColor: computed.backgroundColor,
          focusStyles: {
            outline: computed.outline,
          },
        });
      }
    });

    return Array.from(uniqueStyles.values()).slice(0, 8);
  });
}

/**
 * Extract link styles including hover states
 */
async function extractLinkStyles(page) {
  return await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("a"));
    const uniqueStyles = new Map();

    links.slice(0, 20).forEach((link) => {
      const computed = getComputedStyle(link);
      const key = `${computed.color}-${computed.textDecoration}`;

      if (!uniqueStyles.has(key)) {
        uniqueStyles.set(key, {
          color: computed.color,
          textDecoration: computed.textDecoration,
          fontWeight: computed.fontWeight,
          hoverColor: null,
          hoverDecoration: null,
        });
      }
    });

    return Array.from(uniqueStyles.values()).slice(0, 8);
  });
}

/**
 * Detect responsive breakpoints from CSS
 */
async function extractBreakpoints(page) {
  return await page.evaluate(() => {
    const breakpoints = new Set();

    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules || []) {
          if (rule.media) {
            const match = rule.media.mediaText.match(/(\d+)px/g);
            if (match) match.forEach((m) => breakpoints.add(parseInt(m)));
          }
        }
      } catch (e) {
        // Cross-origin stylesheets may throw errors
      }
    }

    return Array.from(breakpoints)
      .sort((a, b) => a - b)
      .map((px) => ({ px: px + "px" }));
  });
}

/**
 * Detect icon systems in use
 */
async function detectIconSystem(page) {
  return await page.evaluate(() => {
    const systems = [];

    if (document.querySelector('[class*="fa-"]')) {
      systems.push({ name: "Font Awesome", type: "icon-font" });
    }
    if (document.querySelector('[class*="material-icons"]')) {
      systems.push({ name: "Material Icons", type: "icon-font" });
    }
    if (document.querySelector('svg[class*="icon"]')) {
      systems.push({ name: "SVG Icons", type: "svg" });
    }

    return systems;
  });
}

/**
 * Detect CSS frameworks and libraries
 */
async function detectFrameworks(page) {
  return await page.evaluate(() => {
    const frameworks = [];
    const html = document.documentElement.outerHTML;

    const checks = [
      {
        name: "Tailwind CSS",
        pattern: /class="[^"]*\b(flex|grid|p-\d|m-\d|bg-\w+)/,
      },
      {
        name: "Bootstrap",
        pattern: /class="[^"]*\b(container|row|col-|btn-|nav-)/,
      },
      { name: "Material-UI", pattern: /class="[^"]*\bMui/ },
      { name: "Chakra UI", pattern: /class="[^"]*\bchakra/ },
    ];

    checks.forEach(({ name, pattern }) => {
      if (pattern.test(html)) {
        frameworks.push({
          name,
          confidence: "high",
          evidence: "class patterns",
        });
      }
    });

    return frameworks;
  });
}
