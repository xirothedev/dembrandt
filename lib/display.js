/**
 * Terminal Display Formatter
 *
 * Formats extracted brand data into clean, readable terminal output
 * with color swatches and minimal design.
 */

import chalk from 'chalk';

/**
 * Creates a clickable terminal link using ANSI escape codes
 * Supported in iTerm2, VSCode terminal, GNOME Terminal, Windows Terminal
 * @param {string} url - The URL to link to
 * @param {string} text - The text to display (defaults to url)
 * @returns {string} ANSI-formatted clickable link
 */
function terminalLink(url, text = url) {
  // OSC 8 hyperlink format: \x1b]8;;URL\x1b\\TEXT\x1b]8;;\x1b\\
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
}

/**
 * Main display function - outputs formatted extraction results to terminal
 * @param {Object} data - Extraction results from extractBranding()
 * @param {Object} options - Display options (verboseColors, etc.)
 */
export function displayResults(data, options = {}) {
  console.log('\n' + chalk.bold.cyan('Brand Extraction'));
  console.log(chalk.blue(terminalLink(data.url)));
  console.log(chalk.dim(data.extractedAt) + '\n');

  displayLogo(data.logo);
  displayFavicons(data.favicons);
  displayColors(data.colors, options.verboseColors);
  displayTypography(data.typography);
  displaySpacing(data.spacing);
  displayBorderRadius(data.borderRadius);
  displayShadows(data.shadows);
  displayButtons(data.components?.buttons);
  displayInputs(data.components?.inputs);
  displayLinks(data.components?.links);
  displayBreakpoints(data.breakpoints);
  displayIconSystem(data.iconSystem);
  displayFrameworks(data.frameworks);

  console.log('');
}

function displayLogo(logo) {
  if (!logo) return;

  console.log(chalk.bold('Logo'));

  if (logo.url) {
    console.log(`  ${terminalLink(logo.url)}`);
  }

  if (logo.width && logo.height) {
    console.log(chalk.dim(`  ${logo.width}×${logo.height}px`));
  }

  if (logo.safeZone) {
    const { top, right, bottom, left } = logo.safeZone;
    // Only show safe zone if there's meaningful spacing
    if (top > 0 || right > 0 || bottom > 0 || left > 0) {
      console.log(chalk.dim(`  Safe zone: ${top}px ${right}px ${bottom}px ${left}px (top right bottom left)`));
    }
  }

  console.log('');
}

function displayFavicons(favicons) {
  if (!favicons || favicons.length === 0) return;

  console.log(chalk.bold('Favicons'));

  favicons.forEach(favicon => {
    const sizeInfo = favicon.sizes ? chalk.dim(` · ${favicon.sizes}`) : '';
    console.log(`  ${chalk.cyan(favicon.type.padEnd(18))} ${terminalLink(favicon.url)}${sizeInfo}`);
  });

  console.log('');
}

function convertToHex(colorString) {
  // Convert rgb/rgba to hex for display
  const rgbaMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return colorString;
}

function convertToRgb(colorString) {
  // Convert hex to rgb for display
  const hexMatch = colorString.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hexMatch) {
    const r = parseInt(hexMatch[1], 16);
    const g = parseInt(hexMatch[2], 16);
    const b = parseInt(hexMatch[3], 16);
    return `rgb(${r}, ${g}, ${b})`;
  }
  return colorString;
}

function normalizeColorFormat(colorString) {
  // Return both hex and rgb formats
  const rgbaMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]);
    const g = parseInt(rgbaMatch[2]);
    const b = parseInt(rgbaMatch[3]);
    const a = rgbaMatch[4];

    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    const rgb = a ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`;

    return { hex, rgb, hasAlpha: !!a };
  }

  // Match 3-digit hex (#fff, #f0a, etc.)
  const hexMatch3 = colorString.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (hexMatch3) {
    // Expand 3-digit to 6-digit (#fff → #ffffff)
    const r = parseInt(hexMatch3[1] + hexMatch3[1], 16);
    const g = parseInt(hexMatch3[2] + hexMatch3[2], 16);
    const b = parseInt(hexMatch3[3] + hexMatch3[3], 16);

    return {
      hex: `#${hexMatch3[1]}${hexMatch3[1]}${hexMatch3[2]}${hexMatch3[2]}${hexMatch3[3]}${hexMatch3[3]}`.toLowerCase(),
      rgb: `rgb(${r}, ${g}, ${b})`,
      hasAlpha: false
    };
  }

  // Match 8-digit hex with alpha (#ffffff80, #00ff00ff, etc.)
  const hexMatch8 = colorString.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hexMatch8) {
    const r = parseInt(hexMatch8[1], 16);
    const g = parseInt(hexMatch8[2], 16);
    const b = parseInt(hexMatch8[3], 16);
    const a = (parseInt(hexMatch8[4], 16) / 255).toFixed(2);

    return {
      hex: `#${hexMatch8[1]}${hexMatch8[2]}${hexMatch8[3]}`.toLowerCase(),
      rgb: `rgba(${r}, ${g}, ${b}, ${a})`,
      hasAlpha: true
    };
  }

  // Match 6-digit hex (#ffffff, #f0a0b0, etc.)
  const hexMatch6 = colorString.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hexMatch6) {
    const r = parseInt(hexMatch6[1], 16);
    const g = parseInt(hexMatch6[2], 16);
    const b = parseInt(hexMatch6[3], 16);

    return {
      hex: colorString.toLowerCase(),
      rgb: `rgb(${r}, ${g}, ${b})`,
      hasAlpha: false
    };
  }

  return { hex: colorString, rgb: colorString, hasAlpha: false };
}

function displayColors(colors, verboseColors = false) {
  console.log(chalk.bold('Colors'));

  // All colors in one list with consistent formatting
  const allColors = [];

  // Add semantic colors
  if (colors.semantic) {
    Object.entries(colors.semantic)
      .filter(([_, color]) => color)
      .forEach(([role, color]) => {
        const formats = normalizeColorFormat(color);
        allColors.push({
          hex: formats.hex,
          rgb: formats.rgb,
          hasAlpha: formats.hasAlpha,
          label: role,
          type: 'semantic',
          confidence: 'high'
        });
      });
  }

  // Add CSS variables
  if (colors.cssVariables) {
    const limit = verboseColors ? 30 : 15;
    Object.entries(colors.cssVariables).slice(0, limit).forEach(([name, value]) => {
      try {
        const formats = normalizeColorFormat(value);
        allColors.push({
          hex: formats.hex,
          rgb: formats.rgb,
          hasAlpha: formats.hasAlpha,
          label: name,
          type: 'variable',
          confidence: 'high'
        });
      } catch {
        // Skip invalid colors
      }
    });
  }

  // Add palette colors - filter based on verboseColors flag
  if (colors.palette) {
    const limit = verboseColors ? 40 : 20;
    const filtered = verboseColors
      ? colors.palette  // Show all confidence levels in verbose mode
      : colors.palette.filter(c => c.confidence === 'high' || c.confidence === 'medium');

    filtered.slice(0, limit).forEach(c => {
      const formats = normalizeColorFormat(c.color);
      allColors.push({
        hex: formats.hex,
        rgb: formats.rgb,
        hasAlpha: formats.hasAlpha,
        label: '',
        type: 'palette',
        confidence: c.confidence
      });
    });
  }

  // Display all colors with both hex and RGB in grid format
  allColors.forEach(({ hex, rgb, label, confidence }) => {
    try {
      const colorBlock = chalk.bgHex(hex)('  ');
      let conf;
      if (confidence === 'high') conf = chalk.green('●');
      else if (confidence === 'medium') conf = chalk.yellow('●');
      else conf = chalk.gray('●'); // low confidence

      const labelText = label ? chalk.dim(label) : '';

      // Show hex and RGB side by side for easy copying
      console.log(`  ${conf} ${colorBlock} ${hex.padEnd(9)} ${rgb.padEnd(22)} ${labelText}`);
    } catch {
      console.log(`  ${hex.padEnd(9)} ${rgb.padEnd(22)} ${label ? chalk.dim(label) : ''}`);
    }
  });

  const cssVarLimit = verboseColors ? 30 : 15;
  const paletteLimit = verboseColors ? 40 : 20;
  const remaining = (colors.cssVariables ? Math.max(0, Object.keys(colors.cssVariables).length - cssVarLimit) : 0) +
                   (colors.palette ? Math.max(0, colors.palette.length - paletteLimit) : 0);
  if (remaining > 0) {
    console.log(chalk.dim(`  +${remaining} more in JSON`));
  }
  console.log('');
}

function getTypographicModifiers(style) {
  const modifiers = [];

  // Weight description
  const weight = parseInt(style.fontWeight);
  if (weight >= 700) modifiers.push('bold');
  else if (weight >= 600) modifiers.push('semibold');
  else if (weight >= 500) modifiers.push('medium');
  else if (weight <= 300) modifiers.push('light');

  // Style
  if (style.fontStyle === 'italic') modifiers.push('italic');

  // Text decoration
  if (style.textDecoration && style.textDecoration !== 'none' && !style.textDecoration.includes('none')) {
    const decorations = style.textDecoration.split(' ');
    if (decorations.some(d => d.includes('underline'))) modifiers.push('underline');
    if (decorations.some(d => d.includes('line-through'))) modifiers.push('strikethrough');
  }

  // Text transform
  if (style.textTransform && style.textTransform !== 'none') {
    modifiers.push(style.textTransform);
  }

  // Letter spacing (only if significant)
  if (style.letterSpacing && style.letterSpacing !== 'normal' && style.letterSpacing !== '0px') {
    const spacing = parseFloat(style.letterSpacing);
    if (Math.abs(spacing) >= 0.5) {
      modifiers.push(`spacing:${style.letterSpacing}`);
    }
  }

  return modifiers;
}

function getSemanticContext(contexts) {
  // Prioritize semantic meaning
  const semantic = {
    h1: 'heading-1',
    h2: 'heading-2',
    h3: 'heading-3',
    h4: 'heading-4',
    h5: 'heading-5',
    h6: 'heading-6',
    p: 'body',
    a: 'link',
    button: 'button',
    '.hero': 'hero',
    '.title': 'title'
  };

  for (const ctx of contexts) {
    if (semantic[ctx]) return semantic[ctx];
  }
  return contexts[0] || 'text';
}

function displayTypography(typography) {
  console.log(chalk.bold('Typography'));

  // Font sources
  const sources = [];
  if (typography.sources.googleFonts.length > 0) {
    sources.push(...typography.sources.googleFonts);
  }
  if (typography.sources.customFonts.length > 0) {
    sources.push(...typography.sources.customFonts);
  }
  if (sources.length > 0) {
    console.log(chalk.dim(`  Fonts: ${sources.slice(0, 3).join(', ')}`));
    if (sources.length > 3) console.log(chalk.dim(`  +${sources.length - 3} more`));
  }

  // Font styles sorted by size (larger to smaller)
  if (typography.styles.length > 0) {
    const highConfidenceFonts = typography.styles.filter(s => s.confidence === 'high');

    const sortedFonts = highConfidenceFonts.map(style => ({
      style,
      semantic: getSemanticContext(style.contexts),
      sizeValue: parseFloat(style.fontSize) // For sorting
    })).sort((a, b) => b.sizeValue - a.sizeValue); // Larger to smaller

    sortedFonts.slice(0, 15).forEach(({ style, semantic }) => {
      const font = style.fontFamily.split(',')[0].replace(/['"]/g, '');
      const modifiers = getTypographicModifiers(style);
      const modifierStr = modifiers.length > 0 ? ` [${modifiers.join(', ')}]` : '';

      console.log(`  ${chalk.cyan(semantic.padEnd(11))} ${font} · ${style.fontSize} (${style.fontSizeRem})${chalk.dim(modifierStr)}`);
    });

    if (highConfidenceFonts.length > 15) {
      console.log(chalk.dim(`  +${highConfidenceFonts.length - 15} more`));
    }
  }
  console.log('');
}

function displaySpacing(spacing) {
  console.log(chalk.bold('Spacing'));
  console.log(chalk.dim(`  System: ${spacing.scaleType}`));
  spacing.commonValues.slice(0, 15).forEach(v => {
    console.log(`  ${v.px.padEnd(8)} ${chalk.dim(v.rem)}`);
  });
  console.log('');
}

function displayBorderRadius(borderRadius) {
  if (!borderRadius || borderRadius.values.length === 0) return;

  const highConfRadius = borderRadius.values.filter(r => r.confidence === 'high' || r.confidence === 'medium');
  if (highConfRadius.length === 0) return;

  console.log(chalk.bold('Border Radius'));
  console.log(`  ${highConfRadius.slice(0, 12).map(v => v.value).join(', ')}`);
  console.log('');
}

function displayShadows(shadows) {
  if (!shadows || shadows.length === 0) return;

  const highConfShadows = shadows.filter(s => s.confidence === 'high' || s.confidence === 'medium');
  if (highConfShadows.length === 0) return;

  // Sort by blur radius (extract from shadow string)
  const sorted = highConfShadows.sort((a, b) => {
    const aBlur = parseFloat(a.shadow.match(/(\d+)px/g)?.[2] || '0');
    const bBlur = parseFloat(b.shadow.match(/(\d+)px/g)?.[2] || '0');
    return aBlur - bBlur; // Smaller to larger
  });

  console.log(chalk.bold('Shadows'));
  sorted.slice(0, 8).forEach(s => {
    const conf = s.confidence === 'high' ? chalk.green('●') : chalk.yellow('●');
    console.log(`  ${conf} ${s.shadow}`);
  });
  if (highConfShadows.length > 8) {
    console.log(chalk.dim(`  +${highConfShadows.length - 8} more`));
  }
  console.log('');
}

function displayButtons(buttons) {
  if (!buttons || buttons.length === 0) return;

  const highConfButtons = buttons.filter(b => b.confidence === 'high');
  if (highConfButtons.length === 0) return;

  console.log(chalk.bold('Buttons'));
  highConfButtons.slice(0, 8).forEach(btn => {
    try {
      const isTransparent = btn.backgroundColor.includes('rgba(0, 0, 0, 0)') ||
                           btn.backgroundColor === 'transparent';

      if (isTransparent) {
        // For transparent backgrounds, show without color block
        console.log(`  ${btn.backgroundColor.padEnd(24)}`);
        console.log(`     ${chalk.dim(`padding: ${btn.padding} · radius: ${btn.borderRadius}`)}`);
      } else {
        const hexColor = convertToHex(btn.backgroundColor);
        const colorBlock = chalk.bgHex(hexColor)('  ');
        console.log(`  ${colorBlock} ${btn.backgroundColor.padEnd(24)}`);
        console.log(`     ${chalk.dim(`padding: ${btn.padding} · radius: ${btn.borderRadius}`)}`);
      }

      if (btn.hoverBackground) {
        console.log(`     ${chalk.dim(`hover: ${btn.hoverBackground}`)}`);
      }
    } catch {
      console.log(`  ${btn.backgroundColor}`);
    }
  });
  if (highConfButtons.length > 8) {
    console.log(chalk.dim(`  +${highConfButtons.length - 8} more`));
  }
  console.log('');
}

function displayInputs(inputs) {
  if (!inputs || inputs.length === 0) return;

  console.log(chalk.bold('Inputs'));
  inputs.slice(0, 8).forEach(input => {
    console.log(`  ${input.type}`);
    console.log(`     ${chalk.dim(`border: ${input.border}`)}`);
    console.log(`     ${chalk.dim(`padding: ${input.padding} · radius: ${input.borderRadius}`)}`);
    if (input.focusStyles && input.focusStyles.outline !== 'none') {
      console.log(`     ${chalk.dim(`focus: ${input.focusStyles.outline}`)}`);
    }
  });
  if (inputs.length > 8) {
    console.log(chalk.dim(`  +${inputs.length - 8} more`));
  }
  console.log('');
}

function displayBreakpoints(breakpoints) {
  if (!breakpoints || breakpoints.length === 0) return;

  // Sort from larger to smaller
  const sorted = [...breakpoints].sort((a, b) => {
    const aVal = parseFloat(a.px);
    const bVal = parseFloat(b.px);
    return bVal - aVal;
  });

  console.log(chalk.bold('Breakpoints'));
  console.log(`  ${sorted.map(bp => bp.px).join(' → ')}`);
  console.log('');
}

function displayLinks(links) {
  if (!links || links.length === 0) return;

  console.log(chalk.bold('Links'));
  links.slice(0, 5).forEach(link => {
    console.log(`  ${link.color}`);
    if (link.textDecoration && link.textDecoration !== 'none') {
      console.log(`     ${chalk.dim(`decoration: ${link.textDecoration}`)}`);
    }
    if (link.hoverColor && link.hoverColor !== link.color) {
      console.log(`     ${chalk.dim(`hover: ${link.hoverColor}`)}`);
    }
    if (link.hoverDecoration && link.hoverDecoration !== link.textDecoration) {
      console.log(`     ${chalk.dim(`hover decoration: ${link.hoverDecoration}`)}`);
    }
  });
  console.log('');
}

function displayIconSystem(iconSystem) {
  if (!iconSystem || iconSystem.length === 0) return;

  console.log(chalk.bold('Icon System'));
  iconSystem.forEach(system => {
    const sizes = system.sizes ? ` · ${system.sizes.join(', ')}` : '';
    console.log(`  ${system.name} ${chalk.dim(system.type)}${sizes}`);
  });
  console.log('');
}

function displayFrameworks(frameworks) {
  if (!frameworks || frameworks.length === 0) return;

  console.log(chalk.bold('Frameworks'));
  frameworks.forEach(fw => {
    const conf = fw.confidence === 'high' ? chalk.green('●') : chalk.yellow('●');
    console.log(`  ${conf} ${fw.name} ${chalk.dim(fw.evidence)}`);
  });
  console.log('');
}
