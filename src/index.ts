import { NewApp } from "./app";
import { NewContainer } from "./container/container";

const container = NewContainer();
const app = NewApp(container);

export default {
  port: container.config.port,
  fetch: app.fetch,
};
