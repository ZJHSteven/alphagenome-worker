import { createPromiseClient } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { DnaModelService } from "./protos/alphagenome/protos/dna_model_service_connect";
import { PredictVariantRequest, Organism, OutputType, Strand } from "./protos/alphagenome/protos/dna_model_pb";

export interface Env {
  ALPHAGENOME_API_KEY: string;
}

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>AlphaGenome Demo</title>
<style>
body { font-family: Arial, sans-serif; margin: 2rem; }
form { display: flex; flex-direction: column; max-width: 400px; gap: 0.5rem; }
label { display: flex; flex-direction: column; }
button { width: fit-content; padding: 0.5rem 1rem; }
pre { background: #f4f4f4; padding: 1rem; }
</style>
</head>
<body>
<h1>AlphaGenome Variant Prediction</h1>
<form id="predictForm">
  <label>Chromosome <input name="chromosome" required></label>
  <label>Interval start <input name="start" type="number" required></label>
  <label>Interval end <input name="end" type="number" required></label>
  <label>Variant position <input name="position" type="number" required></label>
  <label>Reference bases <input name="ref" required></label>
  <label>Alternate bases <input name="alt" required></label>
  <button type="submit">Predict</button>
</form>
<pre id="output"></pre>
<script>
const form = document.getElementById('predictForm');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const res = await fetch('/api/predict', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data)
  });
  document.getElementById('output').textContent = await res.text();
});
</script>
</body>
</html>`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      return new Response(INDEX_HTML, { headers: { 'content-type': 'text/html; charset=UTF-8' } });
    }
    if (url.pathname === '/api/predict' && request.method === 'POST') {
      const body = await request.json();
      const transport = createGrpcWebTransport({
        baseUrl: 'https://gdmscience.googleapis.com',
        interceptors: [
          (next) => async (req) => {
            req.header.set('x-goog-api-key', env.ALPHAGENOME_API_KEY);
            return next(req);
          },
        ],
      });
      const client = createPromiseClient(DnaModelService, transport);
      const req: PredictVariantRequest = {
        interval: {
          chromosome: body.chromosome,
          start: Number(body.start),
          end: Number(body.end),
          strand: Strand.UNSPECIFIED,
        },
        variant: {
          chromosome: body.chromosome,
          position: Number(body.position),
          referenceBases: body.ref,
          alternateBases: body.alt,
        },
        organism: Organism.HOMO_SAPIENS,
        requestedOutputs: [OutputType.RNA_SEQ],
        ontologyTerms: [],
      };
      const responses: any[] = [];
      for await (const res of client.predictVariant(req)) {
        responses.push(res);
      }
      return new Response(JSON.stringify(responses), { headers: { 'content-type': 'application/json' } });
    }
    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
