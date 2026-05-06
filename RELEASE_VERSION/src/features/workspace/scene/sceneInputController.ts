import * as THREE from 'three';
import { MOVEMENT_CODES } from './sceneConstants';
import { clamp } from './sceneHelpers';
import type { WorkspaceSceneRuntimeState } from './sceneTypes';
import type { WorkspaceSceneCameraController } from './sceneCameraController';

export interface SceneInputControllerOptions {
  canvas: HTMLCanvasElement;
  host: HTMLElement;
  getState: () => WorkspaceSceneRuntimeState;
  getCameraController: () => WorkspaceSceneCameraController;
}

export class SceneInputController {
  readonly pointer = new THREE.Vector2(0, 0);
  readonly pointerTarget = new THREE.Vector2(0, 0);

  private readonly canvas: HTMLCanvasElement;
  private readonly host: HTMLElement;
  private readonly getState: () => WorkspaceSceneRuntimeState;
  private readonly getCameraController: () => WorkspaceSceneCameraController;

  private dragging = false;
  private activePointerId: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private _pointerInfluenceActive = false;
  private cachedCanvasRect: DOMRect | null = null;
  private suppressPointerInfluenceUntil = 0;
  private syncPointerOnNextMove = false;

  constructor(options: SceneInputControllerOptions) {
    this.canvas = options.canvas;
    this.host = options.host;
    this.getState = options.getState;
    this.getCameraController = options.getCameraController;
  }

  isDragging() {
    return this.dragging;
  }

  isPointerInfluenceActive() {
    return this._pointerInfluenceActive;
  }

  updateCachedRect(rect: DOMRect) {
    this.cachedCanvasRect = rect;
  }

  suppressPointerInfluence(durationMs = 260) {
    this._pointerInfluenceActive = false;
    this.suppressPointerInfluenceUntil = performance.now() + durationMs;
    this.syncPointerOnNextMove = true;
  }

  resetDrag() {
    this.canvas.style.cursor = this.getState().flightMode ? 'grab' : '';
    this.dragging = false;
    this.activePointerId = null;
    this._pointerInfluenceActive = false;
    this.pointerTarget.set(0, 0);
  }

  bind() {
    this.canvas.addEventListener('pointerdown', this.handleCanvasPointerDown);
    this.host.addEventListener('pointerdown', this.handleHostPointerDown);
    window.addEventListener('pointermove', this.handleWindowPointerMove);
    window.addEventListener('pointerup', this.handleWindowPointerUp);
    window.addEventListener('pointercancel', this.handleWindowPointerUp);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
  }

  unbind() {
    this.canvas.removeEventListener('pointerdown', this.handleCanvasPointerDown);
    this.host.removeEventListener('pointerdown', this.handleHostPointerDown);
    window.removeEventListener('pointermove', this.handleWindowPointerMove);
    window.removeEventListener('pointerup', this.handleWindowPointerUp);
    window.removeEventListener('pointercancel', this.handleWindowPointerUp);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
  }

  dispose() {
    this.unbind();
  }

  private readonly handleCanvasPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;

    this.dragging = true;
    this.activePointerId = event.pointerId;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.canvas.style.cursor = 'grabbing';
    this.canvas.setPointerCapture(event.pointerId);
    if (this.getState().flightMode) {
      this.getCameraController().markInteraction();
    }
    event.preventDefault();
  };

  private readonly handleHostPointerDown = (event: PointerEvent) => {
    if (this.getState().flightMode || event.button !== 0) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (
      target.closest('[data-workspace-tile="true"]')
      || target.closest('[data-scene-control="true"]')
      || target.closest('[data-workspace-ui="true"]')
    ) {
      return;
    }

    this.dragging = true;
    this.activePointerId = event.pointerId;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
  };

  private readonly handleWindowPointerMove = (event: PointerEvent) => {
    const pointerInfluenceSuppressed = performance.now() < this.suppressPointerInfluenceUntil;

    if (pointerInfluenceSuppressed || this.shouldIgnorePointerTarget(event.target, event.buttons)) {
      this.pointerTarget.set(0, 0);
      this._pointerInfluenceActive = false;
    } else {
      const rect = this.cachedCanvasRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
        const clampedX = clamp(nx, -1, 1);
        const clampedY = clamp(ny, -1, 1);
        if (this.syncPointerOnNextMove) {
          this.pointer.set(clampedX, clampedY);
          this.syncPointerOnNextMove = false;
        }
        this.pointerTarget.set(clampedX, clampedY);
        this._pointerInfluenceActive = true;
      }
    }

    if (!this.dragging || this.activePointerId !== event.pointerId) return;

    const deltaX = event.clientX - this.lastPointerX;
    const deltaY = event.clientY - this.lastPointerY;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.getCameraController().applyPointerDrag(deltaX, deltaY, this.getState().flightMode);
  };

  private readonly handleWindowPointerUp = (event: PointerEvent) => {
    if (!this.dragging || (this.activePointerId !== null && event.pointerId !== this.activePointerId)) {
      return;
    }

    this.dragging = false;
    this.activePointerId = null;
    this.canvas.style.cursor = this.getState().flightMode ? 'grab' : '';
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
  };

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (!this.getState().flightMode || !MOVEMENT_CODES.has(event.code) || this.isTextInputTarget(event.target)) {
      return;
    }
    this.getCameraController().addMovementKey(event.code);
    event.preventDefault();
  };

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    this.getCameraController().removeMovementKey(event.code);
  };

  private readonly handleBlur = () => {
    this.dragging = false;
    this.activePointerId = null;
    this.getCameraController().clearMovementKeys();
    this._pointerInfluenceActive = false;
    this.pointerTarget.set(0, 0);
    this.canvas.style.cursor = this.getState().flightMode ? 'grab' : '';
  };

  private shouldIgnorePointerTarget(target: EventTarget | null, buttons: number) {
    if (!(target instanceof HTMLElement)) return true;
    if (!target.closest('[data-workspace-viewport="true"]')) return true;
    if (
      target.closest('[data-scene-control="true"]')
      || target.closest('[data-workspace-ui="true"]')
    ) {
      return true;
    }
    return !this.getState().flightMode && buttons !== 0;
  }

  private isTextInputTarget(target: EventTarget | null) {
    return target instanceof HTMLElement
      && (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.isContentEditable
        || Boolean(target.closest('[contenteditable="true"]'))
      );
  }
}
