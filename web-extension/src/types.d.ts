declare module "*.js";

type RuntimeApi = {
  getURL(path: string): string;
  sendMessage?(message: unknown, callback?: (response: unknown) => void): Promise<unknown> | void;
};

type MinimalExtensionApi = {
  runtime?: RuntimeApi;
};
