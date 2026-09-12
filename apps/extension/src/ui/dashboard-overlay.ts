// Define explicit state boundaries
export interface OverlayState {
  leaderboard: any[];
  activeMatchId: string | null;
  explanationText: string;
  isStreaming: boolean;
  isOpen: boolean;
}

/**
 * TAB-ISOLATED UNIDIRECTIONAL STATE MACHINE
 * Encapsulating state inside this service completely eliminates cross-tab screen bleeding.
 */
export class OverlayStateEngineService {
  private state: OverlayState = {
    leaderboard: [],
    activeMatchId: null,
    explanationText: "",
    isStreaming: false,
    isOpen: true
  };

  private listeners: Array<() => void> = [];

  public getState(): Readonly<OverlayState> {
    return this.state;
  }

  public dispatch(partialState: Partial<OverlayState>): void {
    this.state = { ...this.state, ...partialState };
    this.notifyListeners();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

/**
 * SURGICAL TEXTNODE MUTATION ENGINE
 * Rejects innerHTML append loops. Executes direct node.nodeValue updates.
 */
export class StreamingViewRenderer {
  private targetTextNode: Text | null = null;
  
  public mountStreamingContainer(containerElement: HTMLElement): void {
    containerElement.innerHTML = ""; 
    const wrapper = document.createElement("div");
    wrapper.style.whiteSpace = "pre-wrap";
    wrapper.style.fontFamily = "sans-serif";
    wrapper.style.fontSize = "14px";
    wrapper.style.lineHeight = "1.5";
    wrapper.style.color = "#334155";
    
    // Create an empty text node for surgical mutations
    this.targetTextNode = document.createTextNode("");
    wrapper.appendChild(this.targetTextNode);
    containerElement.appendChild(wrapper);
  }

  public appendTokenSurgically(tokenChunk: string): void {
    if (!this.targetTextNode) {
      console.warn("[FreelanceOS] Streaming Node detached. Discarding token.");
      return;
    }
    // O(1) Memory mutation. Zero layout thrashing.
    this.targetTextNode.nodeValue = (this.targetTextNode.nodeValue || "") + tokenChunk;
  }

  public resetStream(): void {
    if (this.targetTextNode) {
      this.targetTextNode.nodeValue = "";
    }
  }
}

/**
 * DECOUPLED DASHBOARD OVERLAY WIDGET
 * Hardware-Accelerated Hard Layer Lock layout rendering component.
 */
export class DashboardOverlayWidget {
  private appContainer: HTMLElement;
  private streamContainer: HTMLElement;

  constructor(
    private readonly shadowRoot: ShadowRoot,
    private readonly stateEngine: OverlayStateEngineService,
    private readonly streamingRenderer: StreamingViewRenderer
  ) {
    this.appContainer = document.createElement("div");
    this.streamContainer = document.createElement("div");
  }

  public mount(): void {
    // 3. HARDWARE-ACCELERATED HARD LAYER LOCK
    // Styles injected at the shadow root to win Z-Index wars and prevent reflow thrashing.
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      #freelanceos-overlay-container {
        pointer-events: auto;
        position: fixed;
        right: 0;
        top: 0;
        height: 100vh;
        width: 400px;
        z-index: 2147483647; /* Absolute maximum z-index layer */
        background-color: #ffffff;
        box-shadow: -4px 0 15px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        border-left: 1px solid #e2e8f0;
        
        /* Hardware accelerated drawer animation to bypass CSS reflow thrashing */
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        will-change: transform;
      }
      
      #freelanceos-overlay-container.open {
        transform: translateX(0);
      }
    `;
    this.shadowRoot.appendChild(styleSheet);

    this.appContainer.id = "freelanceos-overlay-container";
    
    // ISOLATED EVENT MESH: Block bubbling chokes
    this.appContainer.addEventListener("click", (e) => e.stopPropagation());
    this.appContainer.addEventListener("keydown", (e) => e.stopPropagation());
    
    const header = document.createElement("div");
    header.style.padding = "20px";
    header.style.fontFamily = "sans-serif";
    header.style.color = "#334155";
    header.style.fontWeight = "bold";
    header.style.borderBottom = "1px solid #e2e8f0";
    header.textContent = "FreelanceOS B2B Mesh Active";
    this.appContainer.appendChild(header);

    this.streamContainer.style.padding = "20px";
    this.streamContainer.style.flex = "1";
    this.streamContainer.style.overflowY = "auto";
    this.appContainer.appendChild(this.streamContainer);
    
    // Wire up the surgical text node mutation renderer
    this.streamingRenderer.mountStreamingContainer(this.streamContainer);

    this.shadowRoot.appendChild(this.appContainer);

    // Subscribe to unidirectional state updates for layout toggles
    this.stateEngine.subscribe(() => {
      this.render();
    });
    
    // Initial paint
    this.render();
  }

  private render(): void {
    const state = this.stateEngine.getState();
    
    if (state.isOpen) {
      this.appContainer.classList.add("open");
    } else {
      this.appContainer.classList.remove("open");
    }
  }
}
