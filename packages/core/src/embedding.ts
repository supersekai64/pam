import { pipeline, env } from '@xenova/transformers'
import type { FeatureExtractionPipeline } from '@xenova/transformers'

env.allowLocalModels = false
env.useBrowserCache = false

export interface EmbeddingProvider {
  generate(text: string): Promise<number[]>
  getDimensions(): number
}

export class LocalEmbeddingProvider implements EmbeddingProvider {
  private model: FeatureExtractionPipeline | null = null
  private modelName: string
  private dimensions: number

  constructor(modelName = 'Xenova/all-MiniLM-L6-v2', dimensions = 384) {
    this.modelName = modelName
    this.dimensions = dimensions
  }

  async generate(text: string): Promise<number[]> {
    if (!this.model) {
      this.model = await pipeline('feature-extraction', this.modelName)
    }

    const model = this.model
    const output = await model(text, {
      pooling: 'mean',
      normalize: true,
    })

    return Array.from(output.data, Number)
  }

  getDimensions(): number {
    return this.dimensions
  }
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string
  private model: string
  private dimensions: number

  constructor(apiKey?: string, model = 'text-embedding-3-small', dimensions = 1536) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || ''
    this.model = model
    this.dimensions = dimensions

    if (!this.apiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.')
    }
  }

  async generate(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: text,
        model: this.model,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>
    }
    return data.data[0].embedding
  }

  getDimensions(): number {
    return this.dimensions
  }
}

export function createEmbeddingProvider(config?: {
  type?: 'local' | 'openai'
  openaiApiKey?: string
  openaiModel?: string
}): EmbeddingProvider {
  const type = config?.type || process.env.EMBEDDING_PROVIDER || 'local'

  if (type === 'openai') {
    return new OpenAIEmbeddingProvider(config?.openaiApiKey, config?.openaiModel)
  }

  return new LocalEmbeddingProvider()
}
