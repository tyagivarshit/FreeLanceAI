/**
 * Tenant ID helper column for Row-Level Security (RLS) and data isolation.
 * Every multi-tenant user-facing table must include this column.
 */
export declare const tenantIdColumn: {
    tenantId: import("drizzle-orm").NotNull<import("drizzle-orm/pg-core").PgUUIDBuilderInitial<"tenant_id">>;
};
/**
 * Primary key definition utilizing standard PostgreSQL UUID structure.
 * Every table must use a standard UUID structure as its primary key.
 */
export declare const primaryKeyColumn: (name?: string) => {
    [x: string]: import("drizzle-orm").IsPrimaryKey<import("drizzle-orm").NotNull<import("drizzle-orm").HasDefault<import("drizzle-orm/pg-core").PgUUIDBuilderInitial<string>>>>;
};
/**
 * Audit timestamp columns recorded automatically on insert and updates.
 */
export declare const auditTimestamps: {
    createdAt: import("drizzle-orm").NotNull<import("drizzle-orm").HasDefault<import("drizzle-orm/pg-core").PgTimestampBuilderInitial<"created_at">>>;
    updatedAt: import("drizzle-orm").NotNull<import("drizzle-orm").HasDefault<import("drizzle-orm/pg-core").PgTimestampBuilderInitial<"updated_at">>>;
};
//# sourceMappingURL=helpers.d.ts.map