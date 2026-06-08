import { createOpenAI } from '@ai-sdk/openai';
import type { Session } from '@multi-genie/auth';

export type MasProviderConfig = {
  host: string;          // e.g. https://fe-vm-jdub-vm-serverless.cloud.databricks.com
  endpoint: string;      // MAS endpoint name (e.g. mas-cfcbc058-endpoint)
  session: Session;      // OBO session for Authorization header
};

/**
 * Returns a Vercel AI SDK provider configured for a Databricks MAS endpoint
 * that speaks the Responses API.
 *
 * The Databricks invocation URL is /serving-endpoints/{ep}/invocations regardless of
 * the OpenAI-compatible path the SDK assembles (which would be e.g. /responses). We
 * use a custom fetch to rewrite outgoing URLs.
 */
export function createMasProvider(cfg: MasProviderConfig) {
  const baseURL = `${cfg.host.replace(/\/$/, '')}/serving-endpoints/${cfg.endpoint}/v1`;
  const invocationsURL = `${cfg.host.replace(/\/$/, '')}/serving-endpoints/${cfg.endpoint}/invocations`;

  const databricksFetch: typeof fetch = (input, init) => {
    // Force every outbound request to /invocations regardless of what the SDK appended.
    const url = typeof input === 'string' ? input : (input as Request).url ?? String(input);
    const rewritten = url.replace(/\/serving-endpoints\/[^/]+\/v1\/.*/, '') === url
      ? invocationsURL
      : invocationsURL;
    return fetch(rewritten, init);
  };

  return createOpenAI({
    name: 'databricks-mas',
    apiKey: cfg.session.accessToken,
    baseURL,
    fetch: databricksFetch,
  });
}

/**
 * Returns an AI SDK responses-model handle pointed at the MAS endpoint.
 * Use this with `streamText({ model, messages })` in routes that need streaming.
 */
export function masResponsesModel(cfg: MasProviderConfig) {
  const provider = createMasProvider(cfg);
  // The model name passed to .responses() is sent in the body as `model`. The MAS
  // endpoint ignores it (the endpoint name selects the model), but it must be a string.
  return provider.responses(cfg.endpoint);
}
