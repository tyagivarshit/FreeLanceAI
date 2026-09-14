/**
 * TAB-ISOLATED UNIDIRECTIONAL STATE MACHINE
 * Encapsulating state inside this service completely eliminates cross-tab screen bleeding.
 */
export class OverlayStateEngineService {
    state = {
        leaderboard: [],
        activeMatchId: null,
        explanationText: "",
        isStreaming: false,
        isOpen: true
    };
    listeners = [];
    getState() {
        return this.state;
    }
    dispatch(partialState) {
        this.state = { ...this.state, ...partialState };
        this.notifyListeners();
    }
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
    notifyListeners() {
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
    targetTextNode = null;
    mountStreamingContainer(containerElement) {
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
    appendTokenSurgically(tokenChunk) {
        if (!this.targetTextNode) {
            console.warn("[FreelanceOS] Streaming Node detached. Discarding token.");
            return;
        }
        // O(1) Memory mutation. Zero layout thrashing.
        this.targetTextNode.nodeValue = (this.targetTextNode.nodeValue || "") + tokenChunk;
    }
    resetStream() {
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
    shadowRoot;
    stateEngine;
    streamingRenderer;
    appContainer;
    streamContainer;
    constructor(shadowRoot, stateEngine, streamingRenderer) {
        this.shadowRoot = shadowRoot;
        this.stateEngine = stateEngine;
        this.streamingRenderer = streamingRenderer;
        this.appContainer = document.createElement("div");
        this.streamContainer = document.createElement("div");
    }
    mount() {
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
    render() {
        const state = this.stateEngine.getState();
        if (state.isOpen) {
            this.appContainer.classList.add("open");
        }
        else {
            this.appContainer.classList.remove("open");
        }
    }
}
