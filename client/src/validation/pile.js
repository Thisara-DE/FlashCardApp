// Same limit and messages as the server, so users see one wording.
export const MAX_PILE_NAME = 40;

// The catch-all pile that kept cards move into when their pile is deleted (same name as the server).
export const GENERAL_PILE_NAME = 'General';

export function isGeneralPile(name) {
  return name.toLowerCase() === GENERAL_PILE_NAME.toLowerCase();
}

// Returns an error message, or undefined when the name is fine.
// toLowerCase() (not a locale-specific fold) matches the server, so both agree on duplicates.
export function validatePileName(name, existingPiles, { ignoreId } = {}) {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Pile name is required';
  if (trimmed.length > MAX_PILE_NAME) return `Pile name must be ${MAX_PILE_NAME} characters or fewer`;

  const duplicate = existingPiles.find(
    (pile) => pile.id !== ignoreId && pile.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (duplicate) return `You already have a pile called "${duplicate.name}"`;

  return undefined;
}
