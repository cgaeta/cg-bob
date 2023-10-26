export const players = ["azrael", "grey", "ludwig", "riminar"] as const;

export let tokens = players.reduce((acc, cur) => {
  acc[cur] = 0;
  return acc;
}, {} as Record<(typeof players)[number], number>);
