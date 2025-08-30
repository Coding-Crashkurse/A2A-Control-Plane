// src/services/a2a/types.ts

/** ===== Task & Messaging (camelCase, UI-kompatibel) ===== */

export type TaskState =
  | "submitted"
  | "working"
  | "input-required"
  | "completed"
  | "canceled"
  | "failed"
  | "rejected"
  | "auth-required"
  | "unknown";

export interface PartBase {
  metadata?: Record<string, any>;
}

export interface TextPart extends PartBase {
  readonly kind: "text";
  text: string;
}

export interface FileBase {
  name?: string;
  mimeType?: string;
}

export interface FileWithBytes extends FileBase {
  /** base64 */
  bytes: string;
  uri?: never;
}

export interface FileWithUri extends FileBase {
  uri: string;
  bytes?: never;
}

export interface FilePart extends PartBase {
  readonly kind: "file";
  file: FileWithBytes | FileWithUri;
}

export interface DataPart extends PartBase {
  readonly kind: "data";
  data: Record<string, any>;
}

export type Part = TextPart | FilePart | DataPart;

export type Role = "user" | "agent";

export interface Message {
  readonly kind: "message";
  role: Role;
  parts: Part[];
  metadata?: Record<string, any>;
  extensions?: string[];
  referenceTaskIds?: string[];
  messageId: string;
  taskId?: string;
  contextId?: string;
}

export interface Artifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: Part[];
  metadata?: Record<string, any>;
  extensions?: string[];
}

export interface TaskStatus {
  state: TaskState;
  message?: Message;
  /** ISO 8601 */
  timestamp?: string;
}

export interface Task {
  readonly kind: "task";
  id: string;
  contextId?: string;
  status: TaskStatus;
  history?: Message[];
  artifacts?: Artifact[];
  metadata?: Record<string, any>;
}

/** ===== Streaming-Events (SSE) – optional, nützlich für :stream/subscribe ===== */

export interface StatusUpdateEvent {
  kind: "status-update";
  taskId: string;
  contextId: string;
  status: TaskStatus;
  final: boolean;
  metadata?: Record<string, any>;
}

export interface ArtifactUpdateEvent {
  kind: "artifact-update";
  taskId: string;
  contextId: string;
  artifact: Artifact;
  /** append = true => an bestehendes Artefakt anhängen */
  append?: boolean;
  /** lastChunk = true => letzter Chunk */
  lastChunk?: boolean;
  metadata?: Record<string, any>;
}

export type StreamingEvent = StatusUpdateEvent | ArtifactUpdateEvent;

/** ===== Send (message:send / message:stream) ===== */

export interface PushNotificationAuthenticationInfo {
  schemes: string[]; // z.B. ["Bearer"]
  credentials?: string;
}

export interface PushNotificationConfig {
  id?: string;
  token?: string;
  url: string;
  authentication?: PushNotificationAuthenticationInfo;
}

export interface MessageSendConfiguration {
  /** akzeptierte Output MIME-Types (z.B. ["application/json","text/plain"]) */
  acceptedOutputModes?: string[];
  /** blockierend warten, falls Agent das unterstützt */
  blocking?: boolean;
  /** Anzahl History-Nachrichten in der Antwort */
  historyLength?: number;
  /** Push-Notifications für Folge-Updates */
  pushNotificationConfig?: PushNotificationConfig;
}

/** Alias, damit dein REST-Client `SendParams` importieren kann */
export interface SendParams {
  message: Message;
  configuration?: MessageSendConfiguration;
  metadata?: Record<string, any>;
}

/** ===== AgentCard (camelCase – UI nutzt diese Namen) ===== */

export type TransportProtocol = "JSONRPC" | "GRPC" | "HTTP+JSON" | string;

export interface AgentInterface {
  url: string;
  transport: TransportProtocol;
}

export interface AgentProvider {
  organization: string;
  url?: string;
}

export interface AgentExtension {
  uri: string;
  description?: string;
  required?: boolean;
  params?: Record<string, any>;
}

export interface AgentCapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  stateTransitionHistory?: boolean;
  extensions?: AgentExtension[];
}

// OpenAPI SecuritySchemes (vereinfachtes Typset)
export type APIKeySecurityScheme = {
  type: "apiKey";
  name: string;
  in: "query" | "header" | "cookie";
  description?: string;
};
export type HTTPAuthSecurityScheme = {
  type: "http";
  scheme: string; // "basic" | "bearer" | ...
  bearerFormat?: string;
  description?: string;
};
export type OAuth2SecurityScheme = {
  type: "oauth2";
  flows: Record<string, any>;
  oauth2MetadataUrl?: string;
  description?: string;
};
export type OpenIdConnectSecurityScheme = {
  type: "openIdConnect";
  openIdConnectUrl: string;
  description?: string;
};
export type MutualTLSSecurityScheme = {
  type: "mutualTLS";
  description?: string;
};

export type SecurityScheme =
  | APIKeySecurityScheme
  | HTTPAuthSecurityScheme
  | OAuth2SecurityScheme
  | OpenIdConnectSecurityScheme
  | MutualTLSSecurityScheme;

export interface AgentCardSignature {
  protected: string; // JWS protected header (base64url)
  signature: string; // JWS signature (base64url)
  header?: Record<string, any>;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
  /** OR‑Liste von AND‑Listen (OpenAPI Security Requirement) */
  security?: Array<Record<string, string[]>>;
}

export interface AgentCard {
  /** z.B. "0.3.0" */
  protocolVersion?: string;
  name: string;
  description?: string;

  /** Haupt‑Endpoint und bevorzugter Transport */
  url: string;
  preferredTransport?: TransportProtocol;

  additionalInterfaces?: AgentInterface[];
  iconUrl?: string;

  provider?: AgentProvider;
  version?: string;
  documentationUrl?: string;

  capabilities?: AgentCapabilities;

  securitySchemes?: Record<string, SecurityScheme>;
  /** OR‑Liste von Security‑Anforderungen */
  security?: Array<Record<string, string[]>>;

  defaultInputModes?: string[];
  defaultOutputModes?: string[];

  skills?: AgentSkill[];

  supportsAuthenticatedExtendedCard?: boolean;
  signatures?: AgentCardSignature[];
}

/**
 * Optional: Rohform der AgentCard mit snake_case – falls du sie brauchst,
 * kannst du sie beim Einlesen auf die obige camelCase-Form mappen.
 */
export interface AgentCardRaw {
  protocol_version?: string;
  name: string;
  description?: string;

  url: string;
  preferred_transport?: TransportProtocol;

  additional_interfaces?: AgentInterface[];
  icon_url?: string;

  provider?: AgentProvider;
  version?: string;
  documentation_url?: string;

  capabilities?: {
    streaming?: boolean;
    push_notifications?: boolean;
    state_transition_history?: boolean;
    extensions?: AgentExtension[];
  };

  security_schemes?: Record<string, SecurityScheme>;
  security?: Array<Record<string, string[]>>;

  default_input_modes?: string[];
  default_output_modes?: string[];

  skills?: AgentSkill[];

  supports_authenticated_extended_card?: boolean;
  signatures?: AgentCardSignature[];
}
