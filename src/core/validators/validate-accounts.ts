import type { Account, Owner } from "../models";

export function validateAccounts(
	accounts: Account[],
	owners: Owner[],
): string[] {
	const errors: string[] = [];
	const ownerIds = new Set(owners.map((o) => o.id));
	const seenIds = new Set<string>();

	for (const account of accounts) {
		if (seenIds.has(account.id)) {
			errors.push(`Duplicate account ID found: "${account.id}".`);
		} else {
			seenIds.add(account.id);
		}

		if (!account.owners || account.owners.length === 0) {
			errors.push(`Account "${account.id}" must have at least one owner.`);
		} else {
			for (const ownerId of account.owners) {
				if (!ownerIds.has(ownerId)) {
					errors.push(
						`Account "${account.id}" references non-existent owner ID: "${ownerId}".`,
					);
				}
			}
		}
	}

	return errors;
}
