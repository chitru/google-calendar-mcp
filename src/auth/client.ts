import { OAuth2Client } from "google-auth-library";
import * as fs from "fs/promises";
import {
  getKeysFilePath,
  generateCredentialsErrorMessage,
  OAuthCredentials,
} from "./utils.js";

async function loadCredentialsFromFile(): Promise<OAuthCredentials> {
  const keysContent = await fs.readFile(getKeysFilePath(), "utf-8");
  const keys = JSON.parse(keysContent);

  if (keys.installed) {
    // Standard OAuth credentials file format
    const { client_id, client_secret, redirect_uris } = keys.installed;
    return { client_id, client_secret, redirect_uris };
  } else if (keys.client_id && keys.client_secret) {
    // Direct format
    return {
      client_id: keys.client_id,
      client_secret: keys.client_secret,
      redirect_uris: keys.redirect_uris || [
        "http://localhost:3000/oauth2callback",
      ],
    };
  } else {
    throw new Error(
      'Invalid credentials file format. Expected either "installed" object or direct client_id/client_secret fields.'
    );
  }
}

async function loadCredentialsFromEnv(): Promise<OAuthCredentials> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth2callback";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing required environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET"
    );
  }

  return {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uris: [redirectUri],
  };
}

async function loadCredentialsWithFallback(): Promise<OAuthCredentials> {
  // Priority 1: Try environment variables first
  try {
    return await loadCredentialsFromEnv();
  } catch (envError) {
    // Priority 2: Fall back to file-based credentials
    try {
      return await loadCredentialsFromFile();
    } catch (fileError) {
      // Generate helpful error message
      const errorMessage = generateCredentialsErrorMessage();
      throw new Error(
        `${errorMessage}\n\nOriginal errors:\nEnv: ${
          envError instanceof Error ? envError.message : envError
        }\nFile: ${fileError instanceof Error ? fileError.message : fileError}`
      );
    }
  }
}

export async function initializeOAuth2Client(): Promise<OAuth2Client> {
  // Always use real OAuth credentials - no mocking.
  // Unit tests should mock at the handler level, integration tests need real credentials.
  try {
    const credentials = await loadCredentialsWithFallback();

    // Use the first redirect URI as the default for the base client
    return new OAuth2Client({
      clientId: credentials.client_id,
      clientSecret: credentials.client_secret,
      redirectUri: credentials.redirect_uris[0],
    });
  } catch (error) {
    throw new Error(
      `Error loading OAuth keys: ${
        error instanceof Error ? error.message : error
      }`
    );
  }
}

export async function loadCredentials(): Promise<{
  client_id: string;
  client_secret: string;
}> {
  try {
    const credentials = await loadCredentialsWithFallback();

    if (!credentials.client_id || !credentials.client_secret) {
      throw new Error("Client ID or Client Secret missing in credentials.");
    }
    return {
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
    };
  } catch (error) {
    throw new Error(
      `Error loading credentials: ${
        error instanceof Error ? error.message : error
      }`
    );
  }
}
