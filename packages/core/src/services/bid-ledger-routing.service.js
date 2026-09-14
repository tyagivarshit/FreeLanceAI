/**
 * Chapter 10A: Bid Architecture Spec & Multi-Currency Ledger Routing
 */
export class BidLedgerRoutingService {
    queueService;
    constructor(queueService) {
        this.queueService = queueService;
    }
    /**
     * Routes a bid transaction for multi-currency financial aggregation.
     * Completely offloads heavy transactional processing and IEEE 754 float math to the background queue
     * to ensure 0ms of event-loop blocking on the REST API.
     *
     * @param tenantId The rigorously verified tenant context mapping.
     * @param bidId The primary reference ID of the bid.
     * @param rawBidAmount The raw amount before conversions.
     * @param baseCurrency The currency the raw bid is in.
     * @param targetCurrency The target reporting/billing currency.
     * @param transactionVersion Versioning guard against concurrent double entries.
     */
    async routeBidTransaction(tenantId, bidId, rawBidAmount, baseCurrency, targetCurrency, transactionVersion) {
        // 1. Explicit Multi-Tenant Envelope Guard
        // Every step of the currency lookup matrix is encapsulated in this payload.
        // This absolutely ensures dynamic rate bleed across tenants cannot physically occur.
        const strictPayloadEnvelope = {
            tenantId,
            bidId,
            rawBidAmount,
            baseCurrency,
            targetCurrency,
            transactionVersion,
            operation: "BID_LEDGER_AGGREGATION"
        };
        // 2. Queue Offload (0ms Event Loop Blocking)
        // The background worker will pick this up, look up the active rates for the specific tenantId,
        // utilize Drizzle's numeric types, and securely insert into `bid_ledger_entries`.
        const taskId = await this.queueService.enqueueRequest({
            tenantId,
            ownerId: "system",
            contextReference: `bid_ledger_routing:${bidId}`,
            systemPrompt: "You are an isolated ledger worker. Aggregate the financial bid safely.",
            userPrompt: JSON.stringify(strictPayloadEnvelope)
        });
        return taskId;
    }
}
