// Touch-based drag and drop for mobile (HTML5 DnD doesn't support touch)

let dragData: { taskId: string; projectId: string; element: HTMLElement } | null = null;
let ghost: HTMLElement | null = null;
let currentDropTarget: HTMLElement | null = null;
let longPressTimer: ReturnType<typeof setTimeout> | null = null;

const DROP_ATTR = 'data-drop-project';

export function touchDrag(node: HTMLElement, params: { taskId: string; projectId: string }) {
	let startX = 0, startY = 0;
	let dragging = false;

	function onTouchStart(e: TouchEvent) {
		const touch = e.touches[0];
		startX = touch.clientX;
		startY = touch.clientY;
		dragging = false;

		longPressTimer = setTimeout(() => {
			dragging = true;
			dragData = { taskId: params.taskId, projectId: params.projectId, element: node };

			// Create ghost
			ghost = node.cloneNode(true) as HTMLElement;
			ghost.style.cssText = `position:fixed;top:${touch.clientY - 20}px;left:${touch.clientX - 20}px;width:${node.offsetWidth}px;opacity:0.8;pointer-events:none;z-index:9999;transform:scale(1.02);box-shadow:0 8px 30px rgba(0,0,0,0.15);border-radius:12px;background:var(--color-bg);`;
			document.body.appendChild(ghost);
			node.style.opacity = '0.3';

			// Haptic feedback if available
			navigator.vibrate?.(30);
		}, 300);
	}

	function onTouchMove(e: TouchEvent) {
		const touch = e.touches[0];
		const dx = touch.clientX - startX;
		const dy = touch.clientY - startY;

		if (!dragging && Math.abs(dx) + Math.abs(dy) > 10) {
			// Cancel long press if user scrolls
			if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
			return;
		}

		if (!dragging) return;
		e.preventDefault();

		if (ghost) {
			ghost.style.top = `${touch.clientY - 20}px`;
			ghost.style.left = `${touch.clientX - 20}px`;
		}

		// Find drop target
		const target = document.elementFromPoint(touch.clientX, touch.clientY);
		const dropTarget = target?.closest(`[${DROP_ATTR}]`) as HTMLElement | null;

		if (currentDropTarget && currentDropTarget !== dropTarget) {
			currentDropTarget.style.outline = '';
			currentDropTarget.style.outlineOffset = '';
		}

		if (dropTarget && dropTarget.getAttribute(DROP_ATTR) !== params.projectId) {
			dropTarget.style.outline = '2px solid var(--color-accent)';
			dropTarget.style.outlineOffset = '-2px';
			currentDropTarget = dropTarget;
		} else {
			currentDropTarget = null;
		}
	}

	function onTouchEnd() {
		if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }

		if (dragging && currentDropTarget && dragData) {
			const toProjectId = currentDropTarget.getAttribute(DROP_ATTR);
			if (toProjectId && toProjectId !== dragData.projectId) {
				node.dispatchEvent(new CustomEvent('touchdrop', {
					bubbles: true,
					detail: { taskId: dragData.taskId, fromProjectId: dragData.projectId, toProjectId },
				}));
			}
			currentDropTarget.style.outline = '';
			currentDropTarget.style.outlineOffset = '';
		}

		if (ghost) { ghost.remove(); ghost = null; }
		if (dragData?.element) dragData.element.style.opacity = '';
		dragData = null;
		currentDropTarget = null;
		dragging = false;
	}

	node.addEventListener('touchstart', onTouchStart, { passive: true });
	node.addEventListener('touchmove', onTouchMove, { passive: false });
	node.addEventListener('touchend', onTouchEnd);
	node.addEventListener('touchcancel', onTouchEnd);

	return {
		update(newParams: { taskId: string; projectId: string }) {
			params = newParams;
		},
		destroy() {
			node.removeEventListener('touchstart', onTouchStart);
			node.removeEventListener('touchmove', onTouchMove);
			node.removeEventListener('touchend', onTouchEnd);
			node.removeEventListener('touchcancel', onTouchEnd);
		},
	};
}
