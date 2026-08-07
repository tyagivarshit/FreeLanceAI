export { isValidEmailFormat, normalizeEmailAddress, validatePasswordStrength, } from "./validation.js";
export { Client, CLIENT_CREATED, CLIENT_UPDATED, CLIENT_ARCHIVED, CLIENT_REACTIVATED, } from "./client.js";
export type { ClientStatus, ClientId, ClientProfile, BillingAddress, BillingDetails, PrimaryContact, SystemMetadata, ClientProperties, ClientQueryProjection, ClientDomainEventName, EventPublisher, DomainPersistenceContract, AggregateStore, } from "./client.js";
export { TimelineEntry, ClientTimeline, TIMELINE_ENTRY_APPENDED, TIMELINE_ARCHIVED, } from "./timeline.js";
export type { TimelineStatus, TimelineEventCategory, VisibilityClassification, TimelineDomainEventName, TimelineEventPublisher, TimelineEntryProperties, ClientTimelineProperties, TimelineAggregateStore, } from "./timeline.js";
export { Money, Payment, PAYMENT_CREATED, PAYMENT_AUTHORIZED, PAYMENT_CAPTURED, PAYMENT_COMPLETED, PAYMENT_FAILED, PAYMENT_CANCELLED, } from "./payment.js";
export type { PaymentState, PaymentDomainEventName, PaymentEventPublisher, MonetaryPolicy, PaymentProperties, PaymentPersistenceContract, PaymentAggregateStore, PaymentQueryProjection, } from "./payment.js";
export { ProjectMetadata, ProjectVisibility, Project, PROJECT_CREATED, PROJECT_UPDATED, PROJECT_STARTED, PROJECT_PAUSED, PROJECT_COMPLETED, PROJECT_CANCELLED, PROJECT_ARCHIVED, } from "./project.js";
export type { ProjectState, ProjectDomainEventName, ProjectEventPublisher, ProjectMetadataProperties, ProjectProperties, ProjectPersistenceContract, ProjectAggregateStore, ProjectQueryProjection, } from "./project.js";
export { AttachmentMetadata, AttachmentVisibility, Attachment, ATTACHMENT_CREATED, ATTACHMENT_UPDATED, ATTACHMENT_AVAILABLE, ATTACHMENT_ARCHIVED, ATTACHMENT_DELETED, } from "./attachment.js";
export type { AttachmentState, AttachmentDomainEventName, AttachmentEventPublisher, AttachmentMetadataProperties, AttachmentProperties, AttachmentPersistenceContract, AttachmentAggregateStore, AttachmentQueryProjection, } from "./attachment.js";
//# sourceMappingURL=index.d.ts.map