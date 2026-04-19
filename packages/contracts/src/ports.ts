import { Schema } from "effect";
import { TrimmedNonEmptyString } from "./baseSchemas.ts";

const PortNumberSchema = Schema.Int.check(Schema.isGreaterThan(0)).check(
  Schema.isLessThanOrEqualTo(65535),
);

export const DetectedPort = Schema.Struct({
  port: PortNumberSchema,
  pid: Schema.NullOr(Schema.Int.check(Schema.isGreaterThan(0))),
  processName: Schema.String,
  framework: Schema.NullOr(Schema.String),
  uptimeSeconds: Schema.NullOr(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
});
export type DetectedPort = typeof DetectedPort.Type;

export const PortForward = Schema.Struct({
  id: TrimmedNonEmptyString,
  localPort: PortNumberSchema,
  remotePort: PortNumberSchema,
  remoteHost: TrimmedNonEmptyString,
  label: Schema.NullOr(TrimmedNonEmptyString),
  createdAt: TrimmedNonEmptyString,
});
export type PortForward = typeof PortForward.Type;

export const PortForwardMetadataStreamEvent = Schema.Union([
  Schema.Struct({ type: Schema.Literal("snapshot"), forwards: Schema.Array(PortForward) }),
  Schema.Struct({ type: Schema.Literal("upsert"), forward: PortForward }),
  Schema.Struct({ type: Schema.Literal("remove"), forwardId: TrimmedNonEmptyString }),
]);
export type PortForwardMetadataStreamEvent = typeof PortForwardMetadataStreamEvent.Type;

export const PortsDetectResult = Schema.Struct({
  ports: Schema.Array(DetectedPort),
});
export type PortsDetectResult = typeof PortsDetectResult.Type;

export const PortsDetectInput = Schema.Struct({
  cwd: Schema.optional(TrimmedNonEmptyString),
});
export type PortsDetectInput = Schema.Codec.Encoded<typeof PortsDetectInput>;

export const PortsForwardCreateInput = Schema.Struct({
  remotePort: PortNumberSchema,
  remoteHost: Schema.optional(TrimmedNonEmptyString),
  localPort: Schema.optional(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)).check(Schema.isLessThanOrEqualTo(65535)),
  ),
  label: Schema.optional(TrimmedNonEmptyString),
});
export type PortsForwardCreateInput = Schema.Codec.Encoded<typeof PortsForwardCreateInput>;

export const PortsForwardRemoveInput = Schema.Struct({
  forwardId: TrimmedNonEmptyString,
});
export type PortsForwardRemoveInput = typeof PortsForwardRemoveInput.Type;

export class PortsError extends Schema.TaggedErrorClass<PortsError>()("PortsError", {
  reason: Schema.String,
  cause: Schema.optional(Schema.Defect),
}) {
  override get message() {
    return this.reason;
  }
}
