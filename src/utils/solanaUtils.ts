
/**
 * Checks if the user has sufficient balance for a transaction.
 * @param balance - The user's current token balance
 * @param amount - The amount required for the transaction
 * @returns Object containing sufficient boolean and shortfall amount
 */
export const checkSufficientBalance = (balance: number, amount: number) => {
    // Handle edge cases where inputs might be undefined/null effectively treating them as 0
    const safeBalance = balance || 0;
    const safeAmount = amount || 0;

    const shortfall = safeAmount - safeBalance;
    const sufficient = safeBalance >= safeAmount;

    return {
        sufficient,
        shortfall: shortfall > 0 ? shortfall : 0
    };
};
