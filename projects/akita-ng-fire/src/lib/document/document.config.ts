export interface DocumentOptions {
  /** The path of the document in Firestore */
  path: string;
}

/** Set the configuration for the collection service */
export function DocumentConfig(options: Partial<DocumentOptions> = {}) {
  return (constructor) => {
    Object.keys(options).forEach(key => constructor[key] = options[key]);
  };
}
