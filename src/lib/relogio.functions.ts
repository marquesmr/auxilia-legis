import { createServerFn } from "@tanstack/react-start";

export const horaDaRede = createServerFn({ method: "GET" }).handler(async () => ({
  epoch: Date.now(),
}));
