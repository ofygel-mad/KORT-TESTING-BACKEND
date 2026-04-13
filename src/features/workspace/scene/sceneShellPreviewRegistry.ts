interface PreviewEntry {
  element: HTMLElement;
  canvas: HTMLCanvasElement;
  requestedRevision: number;
  snapshotRevision: number;
  captureQueued: boolean;
  capturing: boolean;
  frameHandle: number;
  mutationObserver: MutationObserver;
  resizeObserver: ResizeObserver;
}

export interface WorkspaceShellPreviewSnapshot {
  canvas: HTMLCanvasElement;
  revision: number;
}

function readElementSize(element: HTMLElement) {
  const width = Math.max(
    1,
    Math.round(
      Math.max(
        element.clientWidth,
        element.offsetWidth,
        element.scrollWidth,
      ),
    ),
  );
  const height = Math.max(
    1,
    Math.round(
      Math.max(
        element.clientHeight,
        element.offsetHeight,
        element.scrollHeight,
      ),
    ),
  );
  return { width, height };
}

function copyComputedStyles(source: Element, target: Element) {
  const computed = window.getComputedStyle(source);
  const targetStyle = (target as HTMLElement | SVGElement).style;

  for (let index = 0; index < computed.length; index += 1) {
    const property = computed[index];
    targetStyle.setProperty(
      property,
      computed.getPropertyValue(property),
      computed.getPropertyPriority(property),
    );
  }
}

function cloneNodeWithInlineStyles(sourceNode: Node): Node {
  const clone = sourceNode.cloneNode(false);

  if (sourceNode instanceof Element && clone instanceof Element) {
    copyComputedStyles(sourceNode, clone);

    if (sourceNode instanceof HTMLTextAreaElement && clone instanceof HTMLTextAreaElement) {
      clone.value = sourceNode.value;
    } else if (sourceNode instanceof HTMLInputElement && clone instanceof HTMLInputElement) {
      clone.value = sourceNode.value;
      if (sourceNode.checked) {
        clone.checked = true;
      }
    } else if (sourceNode instanceof HTMLSelectElement && clone instanceof HTMLSelectElement) {
      clone.value = sourceNode.value;
    } else if (sourceNode instanceof HTMLCanvasElement && clone instanceof HTMLCanvasElement) {
      clone.width = sourceNode.width;
      clone.height = sourceNode.height;
      const context = clone.getContext('2d');
      if (context) {
        context.drawImage(sourceNode, 0, 0);
      }
    }

    sourceNode.childNodes.forEach((childNode) => {
      clone.appendChild(cloneNodeWithInlineStyles(childNode));
    });
  }

  return clone;
}

function buildSvgMarkup(element: HTMLElement, width: number, height: number) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  foreignObject.setAttribute('x', '0');
  foreignObject.setAttribute('y', '0');
  foreignObject.setAttribute('width', '100%');
  foreignObject.setAttribute('height', '100%');

  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.overflow = 'hidden';
  wrapper.style.background = 'transparent';
  wrapper.appendChild(cloneNodeWithInlineStyles(element));

  foreignObject.appendChild(wrapper);
  svg.appendChild(foreignObject);
  return new XMLSerializer().serializeToString(svg);
}

async function renderElementIntoCanvas(element: HTMLElement, canvas: HTMLCanvasElement) {
  const { width, height } = readElementSize(element);
  const textureWidth = Math.max(512, Math.min(1440, Math.round(width * 2.4)));
  const textureHeight = Math.max(320, Math.min(1024, Math.round((textureWidth / width) * height)));

  const svgMarkup = buildSvgMarkup(element, width, height);
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    if ('fonts' in document) {
      await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
    }

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.decoding = 'async';
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('Failed to decode shell preview SVG.'));
      nextImage.src = url;
    });

    canvas.width = textureWidth;
    canvas.height = textureHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      return false;
    }

    context.clearRect(0, 0, textureWidth, textureHeight);
    context.drawImage(image, 0, 0, textureWidth, textureHeight);
    return true;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export class WorkspaceShellPreviewRegistry {
  private readonly entries = new Map<string, PreviewEntry>();

  register(tileId: string, element: HTMLElement) {
    this.unregister(tileId);

    const entry: PreviewEntry = {
      element,
      canvas: document.createElement('canvas'),
      requestedRevision: 1,
      snapshotRevision: 0,
      captureQueued: false,
      capturing: false,
      frameHandle: 0,
      mutationObserver: new MutationObserver(() => {
        this.invalidate(tileId);
      }),
      resizeObserver: new ResizeObserver(() => {
        this.invalidate(tileId);
      }),
    };

    entry.mutationObserver.observe(element, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    entry.resizeObserver.observe(element);
    this.entries.set(tileId, entry);
    this.invalidate(tileId);

    return () => {
      this.unregister(tileId, element);
    };
  }

  unregister(tileId: string, element?: HTMLElement) {
    const entry = this.entries.get(tileId);
    if (!entry || (element && entry.element !== element)) {
      return;
    }

    entry.mutationObserver.disconnect();
    entry.resizeObserver.disconnect();
    if (entry.frameHandle) {
      cancelAnimationFrame(entry.frameHandle);
    }
    this.entries.delete(tileId);
  }

  invalidate(tileId: string) {
    const entry = this.entries.get(tileId);
    if (!entry) {
      return;
    }

    entry.requestedRevision += 1;
    entry.captureQueued = true;
    if (entry.frameHandle || entry.capturing) {
      return;
    }

    entry.frameHandle = requestAnimationFrame(() => {
      entry.frameHandle = 0;
      void this.capture(tileId, entry);
    });
  }

  requestCapture(tileId: string) {
    this.invalidate(tileId);
  }

  getSnapshot(tileId: string): WorkspaceShellPreviewSnapshot | null {
    const entry = this.entries.get(tileId);
    if (!entry || entry.snapshotRevision <= 0) {
      return null;
    }

    return {
      canvas: entry.canvas,
      revision: entry.snapshotRevision,
    };
  }

  private async capture(tileId: string, entry: PreviewEntry) {
    if (!entry.captureQueued || entry.capturing) {
      return;
    }

    entry.captureQueued = false;
    entry.capturing = true;
    const revision = entry.requestedRevision;

    try {
      const rendered = await renderElementIntoCanvas(entry.element, entry.canvas);
      const currentEntry = this.entries.get(tileId);
      if (!rendered || currentEntry !== entry) {
        return;
      }

      entry.snapshotRevision = revision;
    } catch {
      // Capture failures should fall back to the synthetic shell texture.
    } finally {
      entry.capturing = false;
      if (entry.captureQueued && this.entries.get(tileId) === entry) {
        entry.frameHandle = requestAnimationFrame(() => {
          entry.frameHandle = 0;
          void this.capture(tileId, entry);
        });
      }
    }
  }
}

export const workspaceShellPreviewRegistry = new WorkspaceShellPreviewRegistry();
