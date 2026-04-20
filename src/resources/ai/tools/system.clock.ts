export interface Clock {
  now(): Date;
}

export const NewSystemClock = (): Clock => {
  return {
    now: (): Date => {
      return new Date();
    },
  };
};
