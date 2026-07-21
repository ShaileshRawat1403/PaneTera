import http from 'http';
import https from 'https';
import { Readable } from 'stream';
import type { FetchLike } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { HttpTransportSpec } from './types';
import { verifyHttpSpec } from './transportSecurity';
import { readBearerCredential } from './keychain';

const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_STREAM_MS = 10 * 60_000;

function requestBody(body: BodyInit | null | undefined): Buffer | undefined {
  if (body == null) return undefined;
  if (typeof body === 'string') return Buffer.from(body);
  if (body instanceof URLSearchParams) return Buffer.from(body.toString());
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (ArrayBuffer.isView(body)) return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  throw new Error('Streaming request bodies are not supported by the governed MCP transport.');
}

function headerRecord(headers: HeadersInit | undefined): Record<string, string> {
  const output: Record<string, string> = {};
  new Headers(headers).forEach((value, key) => { output[key] = value; });
  return output;
}

function crossOriginHeaders(headers: Record<string, string>): Record<string, string> {
  const safe = { ...headers };
  for (const name of Object.keys(safe)) {
    if (['authorization', 'cookie', 'proxy-authorization'].includes(name.toLowerCase())) delete safe[name];
  }
  return safe;
}

export function createDestinationBoundFetch(
  baseSpec: HttpTransportSpec,
  credentialReader: (authRef: string) => Promise<string> = readBearerCredential,
): FetchLike {
  const perform = async (
    input: string | URL,
    init: RequestInit = {},
    redirects = 0,
    previousOrigin: string | null = null,
    credentialsAllowed = true,
  ): Promise<Response> => {
    const target = new URL(input);
    const sameConfiguredOrigin = target.origin === new URL(baseSpec.url).origin;
    const verified = await verifyHttpSpec({
      ...baseSpec,
      url: target.toString(),
      authRef: credentialsAllowed && sameConfiguredOrigin ? baseSpec.authRef : null,
    });
    const address = verified.addresses[0];
    const body = requestBody(init.body);
    let headers = headerRecord(init.headers);
    if (!credentialsAllowed || (previousOrigin && previousOrigin !== target.origin)) headers = crossOriginHeaders(headers);
    if (credentialsAllowed && sameConfiguredOrigin && baseSpec.authRef) {
      headers.authorization = `Bearer ${await credentialReader(baseSpec.authRef)}`;
    }
    headers.host = target.host;
    if (body && !headers['content-length']) headers['content-length'] = String(body.length);

    return new Promise<Response>((resolve, reject) => {
      const client = target.protocol === 'https:' ? https : http;
      const request = client.request({
        protocol: target.protocol,
        hostname: address,
        port: target.port || undefined,
        method: init.method || 'GET',
        path: `${target.pathname}${target.search}`,
        headers,
        servername: target.hostname,
        rejectUnauthorized: true,
        timeout: 15_000,
      }, (response) => {
        const status = response.statusCode ?? 500;
        const location = response.headers.location;
        if (status >= 300 && status < 400 && location) {
          response.resume();
          if (redirects >= MAX_REDIRECTS) {
            reject(new Error('MCP endpoint exceeded the redirect limit.'));
            return;
          }
          const redirected = new URL(location, target);
          perform(
            redirected,
            { ...init, headers },
            redirects + 1,
            target.origin,
            credentialsAllowed && redirected.origin === target.origin,
          ).then(resolve, reject);
          return;
        }

        let bytes = 0;
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > MAX_RESPONSE_BYTES) response.destroy(new Error('MCP response exceeded the byte ceiling.'));
        });
        const timer = setTimeout(() => {
          response.destroy(new Error('MCP stream exceeded its duration limit.'));
        }, MAX_STREAM_MS);
        timer.unref();
        response.once('close', () => clearTimeout(timer));
        response.once('end', () => clearTimeout(timer));
        response.once('error', reject);

        const responseHeaders = new Headers();
        for (const [name, value] of Object.entries(response.headers)) {
          if (Array.isArray(value)) value.forEach((item) => responseHeaders.append(name, item));
          else if (typeof value === 'string') responseHeaders.set(name, value);
        }
        resolve(new Response(Readable.toWeb(response) as ReadableStream, {
          status,
          statusText: response.statusMessage,
          headers: responseHeaders,
        }));
      });
      request.once('timeout', () => request.destroy(new Error('MCP connection timed out.')));
      request.once('error', reject);
      if (init.signal) {
        if (init.signal.aborted) request.destroy(new Error('MCP request aborted.'));
        else init.signal.addEventListener('abort', () => request.destroy(new Error('MCP request aborted.')), { once: true });
      }
      if (body) request.write(body);
      request.end();
    });
  };
  return (url, init) => perform(url, init);
}
