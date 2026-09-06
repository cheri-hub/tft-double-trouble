export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export function requireValidDate(value: Date): Date {
  if (Number.isNaN(value.getTime())) {
    throw new TypeError('now must be a valid Date');
  }

  return new Date(value.getTime());
}
