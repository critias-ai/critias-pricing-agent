// Lists the model IDs Pi knows for a provider, without making a model request.
// Usage: npm run models -- [openai|openrouter|google|anthropic]   (default: openrouter)
import {ModelRuntime} from '@earendil-works/pi-coding-agent';
const provider = process.argv[2] ?? 'openrouter';
const runtime = await ModelRuntime.create({modelsPath: null, allowModelNetwork: false});
const models = runtime.getModels(provider);
if (!models.length) {
  console.error(`No models known for "${provider}". Use openai, openrouter, google or anthropic.`);
  process.exit(1);
}
console.log(models.map(m => m.id).join('\n'));
