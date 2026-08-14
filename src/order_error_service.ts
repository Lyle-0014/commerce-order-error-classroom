import { createServer } from "node:http";
import { ZodError } from "zod";
import { captureOrderError, orderErrorSchema } from "./order_workflow.js";

const port = Number(process.env.PORT ?? 3000);

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/order-errors") {
    response.writeHead(404).end();
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = orderErrorSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await captureOrderError(input);
    response.writeHead(202, { "Content-Type": "application/json" }).end(JSON.stringify(result));
  } catch (error) {
    const status = error instanceof ZodError || error instanceof SyntaxError ? 400 : 502;
    const message = error instanceof Error ? error.message : "Request could not be processed";
    response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify({ message }));
  }
});

server.listen(port, () => console.log(`Order error service listening on http://localhost:${port}`));
