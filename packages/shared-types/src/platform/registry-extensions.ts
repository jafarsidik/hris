export interface ConfigurationSchemaSummary {
  readonly id: string;
  readonly resourceKey: string;
  readonly name: string;
  readonly description: string | null;
  readonly schemaJson: Record<string, unknown>;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ConfigurationSchemaInput {
  readonly resourceKey: string;
  readonly name: string;
  readonly description?: string | null;
  readonly schemaJson?: Record<string, unknown>;
  readonly isActive?: boolean;
}

export interface ExtensionSummary {
  readonly id: string;
  readonly extensionKey: string;
  readonly name: string;
  readonly description: string | null;
  readonly version: string;
  readonly manifest: Record<string, unknown>;
  readonly isEnabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ExtensionInput {
  readonly extensionKey: string;
  readonly name: string;
  readonly description?: string | null;
  readonly version: string;
  readonly manifest?: Record<string, unknown>;
  readonly isEnabled?: boolean;
}
