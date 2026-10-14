(() => {
  const tolerance = 2;
  const pages = [...document.querySelectorAll("[data-slide]")];
  const issues = [];
  const label = element => element.id || element.getAttribute("aria-label") || element.tagName.toLowerCase();
  const visible = element => {
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
  };
  const outside = (rect, bounds) => rect.left < bounds.left - tolerance || rect.right > bounds.right + tolerance || rect.top < bounds.top - tolerance || rect.bottom > bounds.bottom + tolerance;
  const clips = value => ["hidden", "clip", "scroll", "auto"].includes(value);
  if (!pages.length) issues.push({ type: "no-pages" });
  for (const [index, page] of pages.entries()) {
    const pageNumber = index + 1;
    const bounds = page.getBoundingClientRect();
    if (!visible(page) || !bounds.width || !bounds.height) {
      issues.push({ page: pageNumber, type: "hidden-page" });
      continue;
    }
    for (const element of [page, ...page.querySelectorAll("*")]) {
      if (!visible(element) || element.closest("[data-screen-only]")) continue;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      // Only artwork inside an explicitly identified crop may exceed its wrapper.
      const artwork = Boolean(element.closest("img, svg, canvas"));
      const croppedArtwork = artwork && Boolean(element.closest("[data-intentional-crop]"));
      if (!croppedArtwork && outside(rect, bounds)) {
        issues.push({ page: pageNumber, type: "outside-page", element: label(element) });
      }
      const style = getComputedStyle(element);
      if (!artwork && !element.hasAttribute("data-intentional-crop") &&
          ((clips(style.overflowX) && element.scrollWidth > element.clientWidth + tolerance) ||
           (clips(style.overflowY) && element.scrollHeight > element.clientHeight + tolerance))) {
        issues.push({ page: pageNumber, type: "overflow", element: label(element) });
      }
      // Text ranges catch clipped lines even when the element's own box fits.
      for (const child of element.childNodes) {
        if (child.nodeType !== Node.TEXT_NODE || !child.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(child);
        const rectangles = [...range.getClientRects()];
        if (rectangles.some(textRect => outside(textRect, bounds))) {
          issues.push({ page: pageNumber, type: "text-outside-page", element: label(element) });
        }
        for (let ancestor = element; ancestor && ancestor !== page.parentElement; ancestor = ancestor.parentElement) {
          const ancestorStyle = getComputedStyle(ancestor);
          const clipX = clips(ancestorStyle.overflowX);
          const clipY = clips(ancestorStyle.overflowY);
          if (!clipX && !clipY) continue;
          const clip = ancestor.getBoundingClientRect();
          const clipped = rectangles.some(textRect =>
            (clipX && (textRect.left < clip.left - tolerance || textRect.right > clip.right + tolerance)) ||
            (clipY && (textRect.top < clip.top - tolerance || textRect.bottom > clip.bottom + tolerance)));
          if (clipped) {
            issues.push({ page: pageNumber, type: "clipped-text", element: label(element), container: label(ancestor) });
            break;
          }
        }
      }
    }
  }
  const brokenImages = [...document.images].filter(image => image.closest("[data-slide]") && (!image.complete || !image.naturalWidth)).map(image => image.alt || image.getAttribute("src"));
  const fonts = [...document.fonts].map(font => ({ family: font.family, weight: font.weight, status: font.status }));
  return {
    pages: pages.length,
    issues,
    brokenImages,
    fonts,
    ok: pages.length > 0 && !issues.length && !brokenImages.length && fonts.every(font => font.status === "loaded"),
  };
})()
