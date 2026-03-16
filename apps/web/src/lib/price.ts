const CENTS_PER_UNIT = 100;

export function priceToCents(price: string): number {
	return Math.round(Number.parseFloat(price) * CENTS_PER_UNIT);
}

export function centsToPrice(cents: number): number {
	return cents / CENTS_PER_UNIT;
}

export function formatCentsAsPrice(cents: number): string {
	return centsToPrice(cents).toFixed(2);
}
