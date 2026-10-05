import { db } from '../database/index.js';
import { initializeDatabase } from '../database/boot.js';
import { devicePrincipalRepository } from '../repositories/devicePrincipalRepository.js';

export const resolveRepositoryPrincipal = async () => {
  await initializeDatabase();
  const principal = await devicePrincipalRepository.get();
  if (!principal?.principalId) throw new Error('Device Principal has not been initialized.');
  return principal.principalId;
};
