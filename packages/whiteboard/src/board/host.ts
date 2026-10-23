/** Context supplied by an embedding host; it is informational until an adapter is wired. */
export type WhiteboardHostContext = Readonly<{
  user: Readonly<{ id: string; displayName: string }>;
  workspace: Readonly<{ id: string; name: string }>;
  permissions: readonly string[];
  theme: "light" | "dark";
  locale: string;
}>;

/** The sole boundary for future embedding; authorization remains the host server's job. */
export type WhiteboardHostAdapter = Readonly<{
  getContext: () => WhiteboardHostContext;
  navigateBack: () => void;
}>;
