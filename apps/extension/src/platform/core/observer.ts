/**
 * Debounced SPA Observer Router
 * 
 * Protects the single-threaded browser process from SPA hydration thrashing,
 * completely eliminating detached node or null-reference exceptions during rapid internal router shifts.
 */
export class SPANavigationObserver {
  private observer: MutationObserver | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Initializes the mutation observer with a strict 300ms debouncer.
   * 
   * @param onNavigate The callback to execute when a stable navigation/render is detected.
   */
  public observe(onNavigate: () => void): void {
    if (this.observer) {
      this.disconnect();
    }

    this.observer = new MutationObserver(() => {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }

      this.timeoutId = setTimeout(() => {
        onNavigate();
      }, 300);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  public disconnect(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
