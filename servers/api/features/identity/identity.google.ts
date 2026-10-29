import { hashOpaqueSecret } from "./identity.rules.js";
import { IdentityServiceFailure, type IdentityRepository } from "./identity.contracts.js";
import type { GoogleOAuthIntegration, OutgoingEmail } from "../../integrations/index.js";

type GoogleMailDependencies = Readonly<{
  decryptToken: (val: string) => string;
  encryptToken: (val: string) => string;
  encryptionKey: Buffer | null;
  generateSecret: () => string;
  google: GoogleOAuthIntegration | null;
  repository: IdentityRepository;
}>;

export const createGoogleMailOperations = ({
  decryptToken,
  encryptToken,
  encryptionKey,
  generateSecret,
  google,
  repository
}: GoogleMailDependencies) => {
  const startGoogleMailConnect = async (identityId: string, email: string): Promise<string> => {
    if (!google || !encryptionKey) throw new IdentityServiceFailure("delivery_unavailable");
    const state = generateSecret();
    try {
      await repository.createGoogleMailState({
        stateHash: hashOpaqueSecret(state),
        identityId,
        expiresAt: new Date(Date.now() + 10 * 60_000)
      });
      return google.authorizationUrl(state, email);
    } catch {
      throw new IdentityServiceFailure("storage_unavailable");
    }
  };

  const finishGoogleMailConnect = async (identityId: string, state: string, code: string): Promise<void> => {
    if (!google || !encryptionKey) throw new IdentityServiceFailure("delivery_unavailable");
    let isValid: boolean;
    try {
      isValid = await repository.consumeGoogleMailState(hashOpaqueSecret(state), identityId, new Date());
    } catch {
      throw new IdentityServiceFailure("storage_unavailable");
    }
    if (!isValid) throw new IdentityServiceFailure("invalid_or_expired_link");
    try {
      const account = await google.exchangeCode(code);
      const identity = await repository.getIdentityById(identityId);
      if (!identity || identity.email !== account.email) {
        await google.revokeToken(account.refreshToken).catch(() => undefined);
        throw new IdentityServiceFailure("google_account_mismatch");
      }
      await repository.saveGoogleMailAccount(identityId, account.email, encryptToken(account.refreshToken), new Date());
    } catch (error) {
      if (error instanceof IdentityServiceFailure) throw error;
      throw new IdentityServiceFailure("delivery_unavailable");
    }
  };

  const getGoogleMailStatus = async (
    identityId: string
  ): Promise<Readonly<{ configured: boolean; connected: boolean; email?: string }>> => {
    try {
      const account = await repository.getGoogleMailAccount(identityId);
      return account
        ? Object.freeze({ configured: google !== null && encryptionKey !== null, connected: true, email: account.email })
        : Object.freeze({ configured: google !== null && encryptionKey !== null, connected: false });
    } catch {
      throw new IdentityServiceFailure("storage_unavailable");
    }
  };

  const disconnectGoogleMail = async (identityId: string): Promise<void> => {
    try {
      const account = await repository.getGoogleMailAccount(identityId);
      if (account && google) {
        try {
          await google.revokeToken(decryptToken(account.encryptedRefreshToken));
        } catch {
          /* local token removal must remain available */
        }
      }
      await repository.removeGoogleMailAccount(identityId);
    } catch {
      throw new IdentityServiceFailure("storage_unavailable");
    }
  };

  const sendAsGoogleMail = async (identityId: string, email: OutgoingEmail): Promise<void> => {
    if (!google) throw new IdentityServiceFailure("delivery_unavailable");
    try {
      const account = await repository.getGoogleMailAccount(identityId);
      if (!account) throw new IdentityServiceFailure("delivery_unavailable");
      await google.sendEmail(
        { email: account.email, refreshToken: decryptToken(account.encryptedRefreshToken) },
        email
      );
    } catch (error) {
      if (error instanceof IdentityServiceFailure) throw error;
      throw new IdentityServiceFailure("delivery_unavailable");
    }
  };

  return {
    disconnectGoogleMail,
    finishGoogleMailConnect,
    getGoogleMailStatus,
    sendAsGoogleMail,
    startGoogleMailConnect
  };
};
