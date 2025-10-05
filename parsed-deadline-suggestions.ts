/**
 * ParsedDeadlineSuggestions Concept - AI Augmented Version
 */

import { GeminiLLM, LLMConfig } from "./gemini-llm";
import {
  validateLLMResponse,
  validateSuggestions,
} from "./parsed-deadline-validators";
import {
  createDocumentExtractionPrompt,
  createWebsiteExtractionPrompt,
  createRefinementPrompt,
} from "./parsed-deadline-prompts";
import {
  editSuggestion,
  updateSuggestionTime,
  batchUpdateTiming,
} from "./parsed-deadline-editing";
import { ParsedDeadlineState } from "./parsed-deadline-state";

// Source types for deadline suggestions
export type SourceType = "SYLLABUS" | "IMAGE" | "WEBSITE" | "CANVAS";
export type ExtractionMethod = "RULES" | "LLM";

// TODO: make sure matches with concept spec
// Core suggestion interface
export interface ParsedDeadlineSuggestion {
  id: string;
  title: string;
  due: Date;
  source: SourceType;
  confirmed?: boolean;
  confidence?: number;
  extractionMethod?: ExtractionMethod;
  provenance?: string;
  warnings?: string[];
  // Optional source references
  uploadedDocument?: UploadedDocument;
  canvasMetadata?: string;
  websiteUrl?: string;
}

// Mock document interface (in real implementation, this would be more complex, e.g., more valid file types, etc.)
export interface UploadedDocument {
  id: string;
  filename: string;
  content: string; // For text documents, this would be the extracted text
  fileType: "pdf" | "png" | "jpg" | "txt";
  uploadDate: Date;
}

// Configuration for LLM extraction
export interface ExtractionConfig {
  modelVersion: string;
  basePromptTemplate: string;
  maxTokens: number;
  temperature: number;
  timezone: string;
  timeout?: number;
}

// Mock user interface
export interface User {
  id: string;
  name: string;
  email: string;
  canvasApiKey?: string;
}

export class ParsedDeadlineSuggestions {
  private state: ParsedDeadlineState;

  constructor() {
    this.state = new ParsedDeadlineState();
  }

  /**
   * Parse deadlines from Canvas using mock data
   *
   * requires user has valid Canvas connection
   * effect parses assignment JSON from Canvas
   *        sets extractionMethod = RULES, source = CANVAS
   *
   * @param user - User with Canvas connection
   * @returns Array of parsed deadline suggestions from Canvas
   */
  parseFromCanvas(user: User): ParsedDeadlineSuggestion[] {
    console.log(`Parsing Canvas data for user: ${user.name}`);

    // Mock Canvas data - in real implementation, this would call Canvas API
    const mockCanvasData = [
      {
        title: "Problem Set 3",
        due_date: "2024-12-15T23:59:59Z",
        course_name: "6.1040",
      },
      {
        title: "Final Project",
        due_date: "2024-12-20T17:00:00Z",
        course_name: "6.1040",
      },
    ];

    const suggestions: ParsedDeadlineSuggestion[] = mockCanvasData.map(
      (item) => ({
        id: this.generateId(),
        title: item.title,
        due: new Date(item.due_date),
        source: "CANVAS",
        extractionMethod: "RULES",
        confidence: 0.9, // High confidence for Canvas data
        provenance: `Canvas assignment from ${item.course_name}`,
        canvasMetadata: JSON.stringify(item),
      })
    );

    this.state.addSuggestions(suggestions);
    console.log(`Extracted ${suggestions.length} Canvas deadline suggestions`);
    return suggestions;
  }

  /**
   * Extract deadlines from document using LLM
   *
   * requires document contains extractable text or image content
   * effect uses LLM to extract structured suggestions from document
   *        sets extractionMethod = LLM, confidence, provenance
   *
   * @param document - The uploaded document to extract from
   * @param config - LLM extraction configuration
   * @param llm - LLM instance for processing
   * @returns Promise resolving to array of extracted deadline suggestions
   */
  async llmExtractFromDocument(
    document: UploadedDocument,
    config: ExtractionConfig,
    llm: GeminiLLM
  ): Promise<ParsedDeadlineSuggestion[]> {
    try {
      console.log(`Using LLM to extract deadlines from: ${document.filename}`);

      const prompt = createDocumentExtractionPrompt(document, config);

      // Validate prompt before sending
      this.validatePrompt(llm, prompt);

      // Convert ExtractionConfig to LLMConfig
      const llmConfig: Partial<LLMConfig> = {
        modelVersion: config.modelVersion,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        timeout: config.timeout,
      };

      const response = await llm.executeLLM(prompt, llmConfig);

      console.log("Received LLM response for document extraction");
      console.log("\nRAW LLM RESPONSE");
      console.log("===================");
      console.log(response);
      console.log("===================\n");

      const suggestions = this.parseLLMResponse(response, document, "SYLLABUS");
      validateSuggestions(
        suggestions,
        document,
        this.state.getAllSuggestions()
      );

      this.state.addSuggestions(suggestions);
      console.log(`LLM extracted ${suggestions.length} deadline suggestions`);
      return suggestions;
    } catch (error) {
      console.error(
        "Error in LLM document extraction:",
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * Extract deadlines from website using LLM
   *
   * requires url is reachable, non-empty, and starts with https://
   * effect uses LLM to parse website content into deadline suggestions
   *        sets extractionMethod = LLM, provenance, confidence
   *
   * @param url - Website URL to extract from
   * @param config - LLM extraction configuration
   * @param llm - LLM instance for processing
   * @returns Promise resolving to array of extracted deadline suggestions
   */
  async llmExtractFromWebsite(
    url: string,
    config: ExtractionConfig,
    llm: GeminiLLM
  ): Promise<ParsedDeadlineSuggestion[]> {
    try {
      console.log(`Using LLM to extract deadlines from website: ${url}`);

      const prompt = createWebsiteExtractionPrompt(url, "", config);

      // Validate prompt before sending
      this.validatePrompt(llm, prompt);

      // Convert ExtractionConfig to LLMConfig
      const llmConfig: Partial<LLMConfig> = {
        modelVersion: config.modelVersion,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        timeout: config.timeout,
      };

      // Use URL context tool for real website analysis
      const llmResponse = await llm.executeLLMWithURL(prompt, url, llmConfig);
      const response = llmResponse.text;

      console.log("Received LLM response for website extraction");
      console.log("\nRAW LLM RESPONSE");
      console.log("===================");
      console.log(response);
      console.log("===================\n");

      const suggestions = this.parseLLMResponse(
        response,
        undefined,
        "WEBSITE",
        url
      );
      validateSuggestions(suggestions, url, this.state.getAllSuggestions());

      this.state.addSuggestions(suggestions);
      console.log(
        `LLM extracted ${suggestions.length} deadline suggestions from website`
      );
      return suggestions;
    } catch (error) {
      console.error(
        "Error in LLM website extraction:",
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * Refine a suggestion using user feedback
   *
   * requires suggestion exists and feedback is non-empty
   * effect re-prompts LLM using user feedback to refine fields
   *        updates title, due, warnings, or confidence
   *
   * @param suggestion - The suggestion to refine
   * @param feedback - User feedback for refinement
   * @param config - LLM extraction configuration
   * @param llm - LLM instance for processing
   * @returns Promise resolving to refined suggestion
   */
  async refineWithFeedback(
    suggestion: ParsedDeadlineSuggestion,
    feedback: string,
    config: ExtractionConfig,
    llm: GeminiLLM
  ): Promise<ParsedDeadlineSuggestion> {
    try {
      console.log(
        `Refining suggestion "${suggestion.title}" with user feedback`
      );

      const prompt = createRefinementPrompt(suggestion, feedback, config);

      // Validate prompt before sending
      this.validatePrompt(llm, prompt);

      // Convert ExtractionConfig to LLMConfig
      const llmConfig: Partial<LLMConfig> = {
        modelVersion: config.modelVersion,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        timeout: config.timeout,
      };

      const response = await llm.executeLLM(prompt, llmConfig);

      console.log("Received LLM response for refinement");
      console.log("\nRAW LLM RESPONSE");
      console.log("===================");
      console.log(response);
      console.log("===================\n");

      const refinedSuggestions = this.parseLLMResponse(
        response,
        suggestion.uploadedDocument,
        suggestion.source,
        suggestion.websiteUrl
      );

      if (refinedSuggestions.length === 0) {
        throw new Error("No refined suggestions returned from LLM");
      }

      const refinedSuggestion = refinedSuggestions[0];
      refinedSuggestion.id = suggestion.id; // Keep original ID
      refinedSuggestion.warnings = [
        ...(suggestion.warnings || []),
        "Refined with user feedback",
      ];

      // Update the original suggestion
      this.state.updateSuggestion(suggestion.id, refinedSuggestion);

      console.log(`Refined suggestion: "${refinedSuggestion.title}"`);
      return refinedSuggestion;
    } catch (error) {
      console.error("Error refining suggestion:", (error as Error).message);
      throw error;
    }
  }

  /**
   * Manually edit a suggestion without calling the LLM
   * This is for direct user edits like correcting dates, times, or titles
   *
   * requires suggestion exists and newTitle is non-empty and newDue is valid
   * effect updates suggestion title and due date without calling LLM
   *        sets warnings to indicate manual editing
   *
   * @param suggestionId - ID of suggestion to edit
   * @param updates - Updates to apply to the suggestion
   * @returns Updated suggestion or null if not found
   */
  editSuggestion(
    suggestionId: string,
    updates: {
      title?: string;
      due?: Date;
      confidence?: number;
      provenance?: string;
    }
  ): ParsedDeadlineSuggestion | null {
    const suggestion = this.state.getSuggestionById(suggestionId);
    if (!suggestion) {
      console.error(`Suggestion with ID ${suggestionId} not found`);
      return null;
    }

    const updatedSuggestion = editSuggestion(suggestion, updates);
    this.state.updateSuggestion(suggestionId, updatedSuggestion);
    return updatedSuggestion;
  }

  /**
   * Update suggestion title directly
   *
   * requires suggestion exists and newTitle is non-empty
   * effect updates suggestion title without calling LLM
   *        sets warnings to indicate manual editing
   *
   * @param suggestionId - ID of suggestion to update
   * @param newTitle - New title for the suggestion
   * @returns true if successful, false otherwise
   */
  updateSuggestionTitle(suggestionId: string, newTitle: string): boolean {
    const suggestion = this.editSuggestion(suggestionId, { title: newTitle });
    return suggestion !== null;
  }

  /**
   * Update suggestion due date directly
   *
   * requires suggestion exists and newDue is valid
   * effect updates suggestion due date without calling LLM
   *        sets warnings to indicate manual editing
   *
   * @param suggestionId - ID of suggestion to update
   * @param newDate - New due date for the suggestion
   * @returns true if successful, false otherwise
   */
  updateSuggestionDate(suggestionId: string, newDate: Date): boolean {
    const suggestion = this.editSuggestion(suggestionId, { due: newDate });
    return suggestion !== null;
  }

  /**
   * Update suggestion time directly (keeps date, changes time)
   *
   * requires suggestion exists and newTime is valid time format
   * effect updates suggestion time without calling LLM
   *        sets warnings to indicate manual editing
   *
   * @param suggestionId - ID of suggestion to update
   * @param newTime - New time string (e.g., "11:59 PM", "23:59", "11:59pm")
   * @returns true if successful, false otherwise
   */
  updateSuggestionTime(suggestionId: string, newTime: string): boolean {
    const suggestion = this.state.getSuggestionById(suggestionId);
    if (!suggestion) {
      console.error(`Suggestion with ID ${suggestionId} not found`);
      return false;
    }

    const success = updateSuggestionTime(suggestion, newTime);
    if (success) {
      this.state.updateSuggestion(suggestionId, suggestion);
    }
    return success;
  }

  /**
   * Batch update multiple suggestions with timing rules
   * Useful for applying consistent timing to multiple assignments
   *
   * requires suggestionIds is non-empty array and timeRule is valid time format
   * effect updates multiple suggestions with consistent timing
   *        returns success/failure counts
   *
   * @param suggestionIds - Array of suggestion IDs to update
   * @param timeRule - Time rule to apply (e.g., "11:59 PM")
   * @returns Object with success and failed counts
   */
  batchUpdateTiming(
    suggestionIds: string[],
    timeRule: string
  ): { success: number; failed: number } {
    return batchUpdateTiming(
      this.state.getAllSuggestions(),
      suggestionIds,
      timeRule
    );
  }

  /**
   * Get a suggestion by ID for editing
   *
   * requires suggestionId is non-empty string
   * effect returns suggestion if found, null otherwise
   *
   * @param suggestionId - ID of suggestion to retrieve
   * @returns Suggestion if found, null otherwise
   */
  getSuggestionById(suggestionId: string): ParsedDeadlineSuggestion | null {
    return this.state.getSuggestionById(suggestionId);
  }

  /**
   * Confirm a suggestion (marks it as confirmed)
   *
   * requires suggestion is not already confirmed and has valid title and due
   * effect marks suggestion as confirmed
   *        emits canonical data to Deadlines.create
   *
   * @param suggestion - Suggestion to confirm
   * @param user - User confirming the suggestion
   * @returns Confirmation data for creating deadline
   */
  confirm(
    suggestion: ParsedDeadlineSuggestion,
    user: User
  ): {
    course: string;
    title: string;
    due: Date;
    source: SourceType;
    addedBy: User;
  } {
    if (suggestion.confirmed) {
      throw new Error("Suggestion is already confirmed");
    }

    if (!suggestion.title || !suggestion.due) {
      throw new Error("Suggestion must have valid title and due date");
    }

    // Update the suggestion
    suggestion.confirmed = true;
    this.state.updateSuggestion(suggestion.id, suggestion);

    console.log(
      `Confirmed suggestion: "${
        suggestion.title
      }" due ${suggestion.due.toLocaleDateString("en-US", {
        timeZone: "America/New_York",
      })} at ${suggestion.due.toLocaleTimeString("en-US", {
        timeZone: "America/New_York",
      })}`
    );

    return {
      course: this.extractCourseFromSuggestion(suggestion),
      title: suggestion.title,
      due: suggestion.due,
      source: suggestion.source,
      addedBy: user,
    };
  }

  /**
   * Get all suggestions
   *
   * requires none
   * effect returns copy of all suggestions
   *
   * @returns Copy of all suggestions
   */
  getAllSuggestions(): ParsedDeadlineSuggestion[] {
    return this.state.getAllSuggestions();
  }

  /**
   * Get suggestions by source
   *
   * requires source is valid SourceType
   * effect returns filtered suggestions by source
   *
   * @param source - Source type to filter by
   * @returns Filtered suggestions by source
   */
  getSuggestionsBySource(source: SourceType): ParsedDeadlineSuggestion[] {
    return this.state.getSuggestionsBySource(source);
  }

  /**
   * Get unconfirmed suggestions
   *
   * requires none
   * effect returns suggestions where confirmed is false or undefined
   *
   * @returns Unconfirmed suggestions
   */
  getUnconfirmedSuggestions(): ParsedDeadlineSuggestion[] {
    return this.state.getUnconfirmedSuggestions();
  }

  /**
   * Test LLM connectivity and configuration
   *
   * requires llm instance is valid and configured
   * effect tests API connectivity and returns success status
   *
   * @param llm - LLM instance to test
   * @returns Promise resolving to test result
   */
  async testLLMConnection(
    llm: GeminiLLM
  ): Promise<{ success: boolean; message: string }> {
    console.log("Testing LLM connection...");

    try {
      const result = await llm.testConnection();
      if (result.success) {
        console.log("LLM connection test passed");
      } else {
        console.log("LLM connection test failed:", result.message);
      }
      return result;
    } catch (error) {
      const errorMessage = `LLM connection test failed: ${
        (error as Error).message
      }`;
      console.error(errorMessage);
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Get LLM model information and capabilities
   *
   * requires llm instance is valid
   * effect returns model metadata and capabilities
   *
   * @param llm - LLM instance to get info for
   * @returns Model information and capabilities
   */
  getLLMInfo(llm: GeminiLLM): {
    model: string;
    maxTokens: number;
    capabilities: string[];
  } {
    const info = llm.getModelInfo();
    console.log(`LLM Model: ${info.model}`);
    console.log(`Max Tokens: ${info.maxTokens}`);
    console.log(`Capabilities: ${info.capabilities.join(", ")}`);
    return info;
  }

  /**
   * Validate prompt before sending to LLM
   *
   * requires llm instance is valid and prompt is non-empty
   * effect validates prompt length and complexity
   *        returns validation status and warnings
   *
   * @param llm - LLM instance to validate prompt for
   * @param prompt - Prompt to validate
   * @returns Validation result with status and warnings
   */
  validatePrompt(
    llm: GeminiLLM,
    prompt: string
  ): { isValid: boolean; warnings: string[] } {
    const validation = llm.validatePrompt(prompt);
    if (!validation.isValid) {
      console.log("Prompt validation warnings:");
      validation.warnings.forEach((warning) => console.log(`  - ${warning}`));
    } else {
      console.log("Prompt validation passed");
    }
    return validation;
  }

  /**
   * Display all suggestions in a readable format
   *
   * requires none
   * effect prints formatted suggestions to console
   *
   * @returns void
   */
  /**
   * Add suggestions directly (for testing purposes)
   *
   * @param suggestions - Array of suggestions to add
   * @returns void
   */
  addSuggestions(suggestions: ParsedDeadlineSuggestion[]): void {
    this.state.addSuggestions(suggestions);
  }

  /**
   * Clear all suggestions (for testing purposes)
   *
   * @returns void
   */
  clearSuggestions(): void {
    this.state.clearSuggestions();
  }

  /**
   * Display all suggestions in a readable format
   *
   * requires none
   * effect prints formatted suggestions to console
   *
   * @returns void
   */
  displaySuggestions(): void {
    console.log("\nDeadline Suggestions");
    console.log("========================");

    const suggestions = this.state.getAllSuggestions();
    if (suggestions.length === 0) {
      console.log("No suggestions available.");
      return;
    }

    const groupedBySource = suggestions.reduce((acc, suggestion) => {
      if (!acc[suggestion.source]) acc[suggestion.source] = [];
      acc[suggestion.source].push(suggestion);
      return acc;
    }, {} as Record<SourceType, ParsedDeadlineSuggestion[]>);

    for (const [source, suggestions] of Object.entries(groupedBySource)) {
      console.log(`\n${source} (${suggestions.length} suggestions)`);
      console.log("─".repeat(30));

      suggestions.forEach((suggestion) => {
        const status = suggestion.confirmed ? "Confirmed" : "Pending";
        const confidence = suggestion.confidence
          ? ` (${Math.round(suggestion.confidence * 100)}% confidence)`
          : "";
        const warnings =
          suggestion.warnings && suggestion.warnings.length > 0
            ? ` [${suggestion.warnings.length} warning(s)]`
            : "";

        console.log(`${status} "${suggestion.title}"`);
        console.log(
          `   Due: ${suggestion.due.toLocaleDateString("en-US", {
            timeZone: "America/New_York",
          })} at ${suggestion.due.toLocaleTimeString("en-US", {
            timeZone: "America/New_York",
          })}`
        );
        console.log(
          `   Method: ${suggestion.extractionMethod}${confidence}${warnings}`
        );
        if (suggestion.provenance) {
          console.log(`   Source: ${suggestion.provenance}`);
        }
        console.log("");
      });
    }
  }

  // Private helper methods

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private parseDateString(dateStr: string): Date {
    // Simple date parsing - in real implementation, this would be more robust
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    // For demo purposes, create a date in the future
    const futureDate = new Date(
      year,
      month,
      now.getDate() + Math.floor(Math.random() * 30) + 1
    );
    return futureDate;
  }

  private parseLLMResponse(
    response: string,
    document?: UploadedDocument,
    source: SourceType = "SYLLABUS",
    websiteUrl?: string
  ): ParsedDeadlineSuggestion[] {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in LLM response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate LLM response structure before processing
      validateLLMResponse(
        parsed,
        document?.filename || websiteUrl || "unknown"
      );

      if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
        throw new Error("Invalid response format - missing suggestions array");
      }

      const suggestions: ParsedDeadlineSuggestion[] = [];

      for (const item of parsed.suggestions) {
        if (!item.title || !item.due) {
          console.warn("Skipping invalid suggestion item:", item);
          continue;
        }

        const suggestion: ParsedDeadlineSuggestion = {
          id: this.generateId(),
          title: item.title,
          due: new Date(item.due),
          source,
          extractionMethod: "LLM",
          confidence: item.confidence || 0.5,
          provenance: item.provenance || "LLM extraction",
          warnings: [],
        };

        if (document) {
          suggestion.uploadedDocument = document;
        }

        if (websiteUrl) {
          suggestion.websiteUrl = websiteUrl;
        }

        suggestions.push(suggestion);
      }

      return suggestions;
    } catch (error) {
      console.error("Error parsing LLM response:", (error as Error).message);
      console.log("Response was:", response);
      throw error;
    }
  }

  private extractCourseFromSuggestion(
    suggestion: ParsedDeadlineSuggestion
  ): string {
    // Simple course extraction - in real implementation, this would be more sophisticated
    if (suggestion.canvasMetadata) {
      const metadata = JSON.parse(suggestion.canvasMetadata);
      return metadata.course_name || "Unknown Course";
    }

    if (suggestion.provenance && suggestion.provenance.includes("6.1040")) {
      return "6.1040";
    }

    return "Unknown Course";
  }
}
