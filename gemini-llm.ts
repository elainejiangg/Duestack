/**
 * LLM Integration for DueStack Concepts
 *
 * Handles LLM functionality for ParsedDeadlineSuggestions concepts.
 * Provides flexible configuration and error handling for various use cases.
 */

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

/**
 * Configuration for API access
 */
export interface Config {
  apiKey: string;
}

/**
 * Extended configuration for LLM requests
 */
export interface LLMConfig {
  modelVersion?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

/**
 * Response metadata for debugging and analysis
 */
export interface LLMResponse {
  text: string;
  usage?: {
    promptTokens: number;
    responseTokens: number;
  };
  model: string;
  timestamp: Date;
  duration?: number;
}

export class GeminiLLM {
  private apiKey: string;
  private defaultConfig: LLMConfig;

  constructor(config: Config, defaultLLMConfig?: LLMConfig) {
    this.apiKey = config.apiKey;
    this.defaultConfig = {
      modelVersion: "gemini-2.5-flash-lite",
      maxTokens: 2000,
      temperature: 0.1,
      timeout: 30000, // 30 seconds
      ...defaultLLMConfig,
    };
  }

  /**
   * Execute LLM with custom configuration
   */
  async executeLLM(
    prompt: string,
    config?: Partial<LLMConfig>
  ): Promise<string> {
    try {
      const mergedConfig = { ...this.defaultConfig, ...config };
      const timeout = mergedConfig.timeout || 30000; // Ensure timeout is always defined

      console.log(
        `Executing LLM request with model: ${mergedConfig.modelVersion}`
      );

      // Initialize Gemini AI
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({
        model: mergedConfig.modelVersion!,
        generationConfig: {
          maxOutputTokens: mergedConfig.maxTokens,
          temperature: mergedConfig.temperature,
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              suggestions: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    title: { type: SchemaType.STRING },
                    due: { type: SchemaType.STRING, format: "date-time" },
                    confidence: { type: SchemaType.NUMBER },
                    provenance: { type: SchemaType.STRING },
                  },
                  required: ["title", "due", "confidence", "provenance"],
                },
              },
            },
            required: ["suggestions"],
          },
        },
      });

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`LLM request timed out after ${timeout}ms`));
        }, timeout);
      });

      // Execute the LLM with timeout
      const llmPromise = model.generateContent(prompt);
      const result = await Promise.race([llmPromise, timeoutPromise]);

      const response = result.response;
      const text = response.text();

      // Log usage information if available
      const usage = response.usageMetadata;
      if (usage) {
        console.log(
          `Token usage: ${usage.promptTokenCount} prompt + ${usage.candidatesTokenCount} response`
        );
      }

      return text;
    } catch (error) {
      console.error("Error calling Gemini API:", (error as Error).message);

      // Provide more specific error messages
      if ((error as Error).message.includes("timeout")) {
        throw new Error(
          `LLM request timed out. Try reducing the prompt length or increasing timeout.`
        );
      } else if ((error as Error).message.includes("API_KEY")) {
        throw new Error(`Invalid API key. Please check your config.json file.`);
      } else if ((error as Error).message.includes("quota")) {
        throw new Error(
          `API quota exceeded. Please check your Gemini API usage limits.`
        );
      } else if ((error as Error).message.includes("safety")) {
        throw new Error(
          `Content was blocked by safety filters. Please modify your prompt.`
        );
      }

      throw error;
    }
  }

  /**
   * Execute LLM with detailed response metadata
   */
  async executeLLMWithMetadata(
    prompt: string,
    config?: Partial<LLMConfig>
  ): Promise<LLMResponse> {
    try {
      const mergedConfig = { ...this.defaultConfig, ...config };

      console.log(`Executing LLM request with metadata tracking`);

      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({
        model: mergedConfig.modelVersion!,
        generationConfig: {
          maxOutputTokens: mergedConfig.maxTokens,
          temperature: mergedConfig.temperature,
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              suggestions: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    title: { type: SchemaType.STRING },
                    due: { type: SchemaType.STRING, format: "date-time" },
                    confidence: { type: SchemaType.NUMBER },
                    provenance: { type: SchemaType.STRING },
                  },
                  required: ["title", "due", "confidence", "provenance"],
                },
              },
            },
            required: ["suggestions"],
          },
        },
      });

      const startTime = Date.now();
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const endTime = Date.now();
      const duration = endTime - startTime;

      const usage = response.usageMetadata;

      return {
        text,
        usage: usage
          ? {
              promptTokens: usage.promptTokenCount || 0,
              responseTokens: usage.candidatesTokenCount || 0,
            }
          : undefined,
        model: mergedConfig.modelVersion!,
        timestamp: new Date(),
        duration: duration,
      };
    } catch (error) {
      console.error(
        "Error in LLM execution with metadata:",
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * Validate prompt length and complexity
   */
  validatePrompt(prompt: string): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    if (prompt.length > 50000) {
      warnings.push("Prompt is very long (>50k chars), may hit token limits");
    }

    if (prompt.includes("```") && prompt.split("```").length > 10) {
      warnings.push("Prompt contains many code blocks, may affect parsing");
    }

    if (prompt.includes("http") && prompt.split("http").length > 20) {
      warnings.push("Prompt contains many URLs, may affect processing");
    }

    return {
      isValid: warnings.length === 0,
      warnings,
    };
  }

  /**
   * Get current model capabilities and limits
   */
  getModelInfo(): { model: string; maxTokens: number; capabilities: string[] } {
    return {
      model: this.defaultConfig.modelVersion!,
      maxTokens: this.defaultConfig.maxTokens!,
      capabilities: [
        "Text generation",
        "JSON parsing",
        "Date extraction",
        "Academic content analysis",
        "Structured data extraction",
        "Multi-language support",
      ],
    };
  }

  /**
   * Test API connectivity and configuration
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const testPrompt = "Respond with exactly: 'API connection successful'";
      const response = await this.executeLLM(testPrompt, { maxTokens: 50 });

      if (response.includes("API connection successful")) {
        return {
          success: true,
          message: "API connection test passed",
        };
      } else {
        return {
          success: false,
          message: "Unexpected response from API",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `API connection test failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Execute LLM with image input
   *
   * @param prompt - The prompt to send to the LLM
   * @param imageData - Image data as buffer
   * @param mimeType - Image MIME type
   * @param config - Optional LLM configuration
   * @returns Promise resolving to LLMResponse with metadata
   */
  async executeLLMWithImage(
    prompt: string,
    imageData: Buffer,
    mimeType: string,
    config?: Partial<LLMConfig>
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const mergedConfig = { ...this.defaultConfig, ...config };

    try {
      console.log(`Executing LLM with image (${mimeType})`);

      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({
        model: mergedConfig.modelVersion!,
        generationConfig: {
          maxOutputTokens: mergedConfig.maxTokens,
          temperature: mergedConfig.temperature,
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              suggestions: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    title: { type: SchemaType.STRING },
                    due: { type: SchemaType.STRING, format: "date-time" },
                    confidence: { type: SchemaType.NUMBER },
                    provenance: { type: SchemaType.STRING },
                  },
                  required: ["title", "due", "confidence", "provenance"],
                },
              },
            },
            required: ["suggestions"],
          },
        },
      });

      const imagePart = {
        inlineData: {
          data: imageData.toString("base64"),
          mimeType: mimeType,
        },
      };

      const result = await model.generateContent([imagePart, prompt]);
      const response = await result.response;
      const endTime = Date.now();
      const duration = endTime - startTime;

      const usage = response.usageMetadata;
      const text = response.text();

      console.log(
        `LLM Image Response (${duration}ms): ${text.substring(0, 100)}...`
      );
      console.log(
        `Token usage: ${usage?.promptTokenCount || 0} prompt + ${
          usage?.candidatesTokenCount || 0
        } response`
      );

      return {
        text,
        usage: {
          promptTokens: usage?.promptTokenCount || 0,
          responseTokens: usage?.candidatesTokenCount || 0,
        },
        model: mergedConfig.modelVersion!,
        timestamp: new Date(),
        duration: duration,
      };
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.error(
        `LLM image request failed after ${duration}ms:`,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * Execute LLM with PDF input
   *
   * @param prompt - The prompt to send to the LLM
   * @param pdfData - PDF data as buffer
   * @param config - Optional LLM configuration
   * @returns Promise resolving to LLMResponse with metadata
   */
  async executeLLMWithPDF(
    prompt: string,
    pdfData: Buffer,
    config?: Partial<LLMConfig>
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const mergedConfig = { ...this.defaultConfig, ...config };

    try {
      console.log(`Executing LLM with PDF (${pdfData.length} bytes)`);

      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({
        model: mergedConfig.modelVersion!,
        generationConfig: {
          maxOutputTokens: mergedConfig.maxTokens,
          temperature: mergedConfig.temperature,
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              suggestions: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    title: { type: SchemaType.STRING },
                    due: { type: SchemaType.STRING, format: "date-time" },
                    confidence: { type: SchemaType.NUMBER },
                    provenance: { type: SchemaType.STRING },
                  },
                  required: ["title", "due", "confidence", "provenance"],
                },
              },
            },
            required: ["suggestions"],
          },
        },
      });

      const pdfPart = {
        inlineData: {
          data: pdfData.toString("base64"),
          mimeType: "application/pdf",
        },
      };

      const result = await model.generateContent([pdfPart, prompt]);
      const response = await result.response;
      const endTime = Date.now();
      const duration = endTime - startTime;

      const usage = response.usageMetadata;
      const text = response.text();

      console.log(
        `LLM PDF Response (${duration}ms): ${text.substring(0, 100)}...`
      );
      console.log(
        `Token usage: ${usage?.promptTokenCount || 0} prompt + ${
          usage?.candidatesTokenCount || 0
        } response`
      );

      return {
        text,
        usage: {
          promptTokens: usage?.promptTokenCount || 0,
          responseTokens: usage?.candidatesTokenCount || 0,
        },
        model: mergedConfig.modelVersion!,
        timestamp: new Date(),
        duration: duration,
      };
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.error(
        `LLM PDF request failed after ${duration}ms:`,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * Execute LLM with multiple documents (PDFs, images) in a single request
   * This allows the LLM to cross-reference information across multiple sources
   *
   * @param prompt - The prompt to send to the LLM
   * @param documents - Array of documents with their data and MIME types
   * @param config - Optional LLM configuration
   * @returns Promise resolving to LLMResponse with metadata
   */
  async executeLLMWithMultipleDocuments(
    prompt: string,
    documents: Array<{ data: Buffer; mimeType: string; filename?: string }>,
    config?: Partial<LLMConfig>
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const mergedConfig = { ...this.defaultConfig, ...config };

    try {
      console.log(
        `Executing LLM with ${documents.length} documents in SINGLE request`
      );
      documents.forEach((doc, i) => {
        const name = doc.filename || `Document ${i + 1}`;
        console.log(
          `   ${i + 1}. ${name} (${doc.mimeType}, ${doc.data.length} bytes)`
        );
      });

      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({
        model: mergedConfig.modelVersion!,
        generationConfig: {
          maxOutputTokens: mergedConfig.maxTokens,
          temperature: mergedConfig.temperature,
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              suggestions: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    title: { type: SchemaType.STRING },
                    due: { type: SchemaType.STRING, format: "date-time" },
                    confidence: { type: SchemaType.NUMBER },
                    provenance: { type: SchemaType.STRING },
                  },
                  required: ["title", "due", "confidence", "provenance"],
                },
              },
            },
            required: ["suggestions"],
          },
        },
      });

      // Build content array with all documents followed by the prompt
      const contentParts = documents.map((doc) => ({
        inlineData: {
          data: doc.data.toString("base64"),
          mimeType: doc.mimeType,
        },
      }));

      // Add prompt after all documents
      contentParts.push(prompt as any);

      const result = await model.generateContent(contentParts);
      const response = await result.response;
      const endTime = Date.now();
      const duration = endTime - startTime;

      const usage = response.usageMetadata;
      const text = response.text();

      console.log(
        `LLM Multi-Document Response (${duration}ms): ${text.substring(
          0,
          100
        )}...`
      );
      console.log(
        `Token usage: ${usage?.promptTokenCount || 0} prompt + ${
          usage?.candidatesTokenCount || 0
        } response`
      );

      return {
        text,
        usage: {
          promptTokens: usage?.promptTokenCount || 0,
          responseTokens: usage?.candidatesTokenCount || 0,
        },
        model: mergedConfig.modelVersion!,
        timestamp: new Date(),
        duration: duration,
      };
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.error(
        `LLM multi-document request failed after ${duration}ms:`,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * Execute LLM with URL context by fetching actual website content
   * Fetches the webpage and sends its HTML to the LLM for analysis
   *
   * @param prompt - The prompt to send to the LLM
   * @param url - URL to analyze
   * @param config - Optional LLM configuration
   * @returns Promise resolving to LLMResponse with metadata
   */
  async executeLLMWithURL(
    prompt: string,
    url: string,
    config?: Partial<LLMConfig>
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const mergedConfig = { ...this.defaultConfig, ...config };

    try {
      console.log(`Fetching actual content from URL: ${url}`);

      // Fetch the actual website content
      const https = require("https");
      const http = require("http");

      const webContent = await new Promise<string>((resolve, reject) => {
        const client = url.startsWith("https") ? https : http;

        const request = client.get(url, (res: any) => {
          let data = "";

          // Handle redirects
          if (res.statusCode === 301 || res.statusCode === 302) {
            const redirectUrl = res.headers.location;
            console.log(`Redirecting to: ${redirectUrl}`);
            const redirectClient = redirectUrl.startsWith("https")
              ? https
              : http;
            redirectClient
              .get(redirectUrl, (redirectRes: any) => {
                redirectRes.on("data", (chunk: any) => {
                  data += chunk;
                });
                redirectRes.on("end", () => {
                  resolve(data);
                });
              })
              .on("error", (err: Error) => {
                reject(err);
              });
            return;
          }

          res.on("data", (chunk: any) => {
            data += chunk;
          });

          res.on("end", () => {
            resolve(data);
          });
        });

        request.on("error", (err: Error) => {
          reject(err);
        });

        // Set timeout
        request.setTimeout(mergedConfig.timeout || 30000, () => {
          request.destroy();
          reject(new Error("URL fetch timeout"));
        });
      });

      console.log(`✓ Fetched ${webContent.length} characters from ${url}`);
      console.log(`Analyzing website content with LLM...`);

      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({
        model: mergedConfig.modelVersion!,
        generationConfig: {
          maxOutputTokens: mergedConfig.maxTokens,
          temperature: mergedConfig.temperature,
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              suggestions: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    title: { type: SchemaType.STRING },
                    due: { type: SchemaType.STRING, format: "date-time" },
                    confidence: { type: SchemaType.NUMBER },
                    provenance: { type: SchemaType.STRING },
                  },
                  required: ["title", "due", "confidence", "provenance"],
                },
              },
            },
            required: ["suggestions"],
          },
        },
      });

      // Send the actual website content to the LLM
      const fullPrompt = `${prompt}

Website URL: ${url}

CRITICAL TIMEZONE INFORMATION:
- All times in the website are in America/New_York timezone (Eastern Time)
- Eastern Time uses DAYLIGHT SAVING TIME:
  * September-October 2025: Use EDT (UTC-4) → format: -04:00
  * November 2-December 2025: Use EST (UTC-5) → format: -05:00
- Extract the EXACT time from the content - do NOT adjust or convert
- Output format examples:
  * Sept 7 at 11:59pm → 2025-09-07T23:59:00-04:00
  * Oct 2 at 10:00am → 2025-10-02T10:00:00-04:00
  * Dec 9 at 11:59pm → 2025-12-09T23:59:00-05:00

Website HTML Content:
${webContent}`;
      const result = await model.generateContent(fullPrompt);

      const response = result.response;
      const endTime = Date.now();
      const duration = endTime - startTime;

      const usage = response.usageMetadata;
      const text = response.text();

      console.log(
        `LLM URL Response (${duration}ms): ${text.substring(0, 100)}...`
      );
      console.log(
        `Token usage: ${usage?.promptTokenCount || 0} prompt + ${
          usage?.candidatesTokenCount || 0
        } response`
      );

      return {
        text,
        usage: {
          promptTokens: usage?.promptTokenCount || 0,
          responseTokens: usage?.candidatesTokenCount || 0,
        },
        model: mergedConfig.modelVersion!,
        timestamp: new Date(),
        duration: duration,
      };
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.error(
        `LLM URL request failed after ${duration}ms:`,
        (error as Error).message
      );
      throw error;
    }
  }
}
