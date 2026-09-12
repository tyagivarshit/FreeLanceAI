export interface IngestedJobPayload {
  title: string;
  description: string;
  sourcePlatform: "UPWORK" | "LINKEDIN";
  externalJobId: string;
  rawMetadata: Record<string, any>;
  budgetFilter?: {
    isFixed: boolean;
    minCents: number;
    maxCents: number;
  };
}

export abstract class BasePlatformAdapter {
  /**
   * Abstract signature enforcing the extraction of specific structural footprints.
   */
  abstract extractJobData(): Promise<IngestedJobPayload>;

  /**
   * Abstract signature for securely mounting the isolated widget into the specific host UI.
   */
  abstract injectSidebarWidget(shadowRoot: ShadowRoot): Promise<void>;
}
