import { Elysia } from "elysia";

import { discordEndpoint } from "./src/discordEndpoint";
import { siteEndpoints } from "./src/siteEndpoints";

try {
  const server = new Elysia()
    .use(siteEndpoints)
    .use(discordEndpoint)
    .onError((err) => console.error(err))
    .listen(3000);
} catch (err) {
  console.error(err);
}
