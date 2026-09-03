import { useEffect, useRef } from 'react';

interface TouchDrop {
  taskId: string;
  fromProjectId: string;
  toProjectId: string;
}

interface TouchDragOptions {
  taskId: string;
  projectId: string;
  onDrop: (detail: TouchDrop) => void;
}

const DROP_ATTRIBUTE = 'data-drop-project';

export function useTouchDrag<T extends HTMLElement>({ taskId, projectId, onDrop }: TouchDragOptions) {
  const elementRef = useRef<T>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    let startX = 0;
    let startY = 0;
    let dragging = false;
    let longPressTimer: number | undefined;
    let ghost: HTMLElement | undefined;
    let currentDropTarget: HTMLElement | undefined;

    const clearDropTarget = () => {
      if (!currentDropTarget) return;
      currentDropTarget.style.outline = '';
      currentDropTarget.style.outlineOffset = '';
      currentDropTarget = undefined;
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      dragging = false;
      longPressTimer = window.setTimeout(() => {
        dragging = true;
        ghost = element.cloneNode(true) as HTMLElement;
        ghost.style.cssText = `position:fixed;top:${touch.clientY - 20}px;left:${touch.clientX - 20}px;width:${element.offsetWidth}px;opacity:.85;pointer-events:none;z-index:9999;transform:scale(1.02);box-shadow:0 16px 50px rgba(0,0,0,.28);border-radius:14px;background:var(--color-elevated);`;
        document.body.appendChild(ghost);
        element.style.opacity = '0.3';
        navigator.vibrate?.(30);
      }, 300);
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!dragging && Math.abs(touch.clientX - startX) + Math.abs(touch.clientY - startY) > 10) {
        if (longPressTimer) window.clearTimeout(longPressTimer);
        return;
      }
      if (!dragging) return;
      event.preventDefault();
      if (ghost) {
        ghost.style.top = `${touch.clientY - 20}px`;
        ghost.style.left = `${touch.clientX - 20}px`;
      }
      const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest(`[${DROP_ATTRIBUTE}]`) as HTMLElement | null;
      if (target !== currentDropTarget) clearDropTarget();
      if (target && target.getAttribute(DROP_ATTRIBUTE) !== projectId) {
        target.style.outline = '2px solid var(--color-accent)';
        target.style.outlineOffset = '-2px';
        currentDropTarget = target;
      }
    };

    const finish = () => {
      if (longPressTimer) window.clearTimeout(longPressTimer);
      if (dragging && currentDropTarget) {
        const toProjectId = currentDropTarget.getAttribute(DROP_ATTRIBUTE);
        if (toProjectId && toProjectId !== projectId) {
          onDrop({
            taskId,
            fromProjectId: projectId,
            toProjectId,
          });
        }
      }
      clearDropTarget();
      ghost?.remove();
      ghost = undefined;
      element.style.opacity = '';
      dragging = false;
    };

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', finish);
    element.addEventListener('touchcancel', finish);
    return () => {
      if (longPressTimer) window.clearTimeout(longPressTimer);
      clearDropTarget();
      ghost?.remove();
      element.style.opacity = '';
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', finish);
      element.removeEventListener('touchcancel', finish);
    };
  }, [onDrop, projectId, taskId]);

  return elementRef;
}
