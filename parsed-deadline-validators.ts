/**
 * Validation utilities for ParsedDeadlineSuggestions
 */

import {
  ParsedDeadlineSuggestion,
  UploadedDocument,
} from "./parsed-deadline-suggestions";

/**
 * Validate LLM response structure and content
 *
 * requires response is non-null and has suggestions
 * effect applies rule-based validation (e.g., duplicate detection, implausible dates)
 *        adds warnings or raises error if issues are detected
 *
 * @param response - The LLM response to validate
 * @param source - Source identifier for error messages
 * @returns void
 */
export function validateLLMResponse(response: any, source: string): void {
  console.log("Validating LLM response structure...");
  const issues: string[] = [];

  // Check if response is valid JSON
  if (!response || typeof response !== "object") {
    throw new Error("LLM response is not a valid JSON object");
  }

  // Check for required suggestions array
  if (!response.suggestions || !Array.isArray(response.suggestions)) {
    throw new Error("LLM response missing 'suggestions' array");
  }

  // Validate each suggestion structure
  response.suggestions.forEach((suggestion: any, index: number) => {
    // Check required fields
    if (!suggestion.title || typeof suggestion.title !== "string") {
      issues.push(`Suggestion ${index}: Missing or invalid 'title' field`);
    }

    if (!suggestion.due) {
      issues.push(`Suggestion ${index}: Missing 'due' field`);
    } else {
      // Validate date format
      const dueDate = new Date(suggestion.due);
      if (isNaN(dueDate.getTime())) {
        issues.push(
          `Suggestion ${index}: Invalid date format '${suggestion.due}'`
        );
      }
    }

    // Check confidence score if present
    if (suggestion.confidence !== undefined) {
      if (
        typeof suggestion.confidence !== "number" ||
        suggestion.confidence < 0 ||
        suggestion.confidence > 1
      ) {
        issues.push(
          `Suggestion ${index}: Invalid confidence score '${suggestion.confidence}' (must be 0.0-1.0)`
        );
      }
    }

    // Check for LLM hallucination indicators
    if (suggestion.title && suggestion.title.toLowerCase().includes("tbd")) {
      issues.push(
        `Suggestion ${index}: LLM may have hallucinated date for TBD item`
      );
    }

    if (suggestion.title && suggestion.title.toLowerCase().includes("soon")) {
      issues.push(
        `Suggestion ${index}: LLM may have hallucinated date for vague 'soon' item`
      );
    }
  });

  if (issues.length > 0) {
    console.log("LLM response validation issues:");
    issues.forEach((issue) => console.log(`  - ${issue}`));
  } else {
    console.log("LLM response structure is valid");
  }
}

/**
 * Validate suggestions for common issues
 *
 * requires source is non-null and has suggestions
 * effect applies rule-based validation (e.g., duplicate detection, implausible dates)
 *        adds warnings or raises error if issues are detected
 *
 * @param suggestions - Array of suggestions to validate
 * @param source - Source document or URL
 * @param allSuggestions - All existing suggestions for duplicate checking
 * @returns void
 */
export function validateSuggestions(
  suggestions: ParsedDeadlineSuggestion[],
  source: UploadedDocument | string,
  allSuggestions: ParsedDeadlineSuggestion[] = []
): void {
  console.log("Validating suggestions...");

  const issues: string[] = [];

  for (const suggestion of suggestions) {
    // Check for implausible dates
    const now = new Date();
    const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    if (suggestion.due < now) {
      issues.push(
        `Suggestion "${
          suggestion.title
        }" has a date in the past: ${suggestion.due.toISOString()}`
      );
      suggestion.warnings = [
        ...(suggestion.warnings || []),
        "Date is in the past",
      ];
    }

    if (suggestion.due > oneYearFromNow) {
      issues.push(
        `Suggestion "${
          suggestion.title
        }" has a date more than a year in the future: ${suggestion.due.toISOString()}`
      );
      suggestion.warnings = [
        ...(suggestion.warnings || []),
        "Date is very far in the future",
      ];
    }

    // Check for duplicate titles
    const duplicates = allSuggestions.filter(
      (s) =>
        s.title.toLowerCase() === suggestion.title.toLowerCase() &&
        s.id !== suggestion.id
    );

    if (duplicates.length > 0) {
      issues.push(`Duplicate suggestion found: "${suggestion.title}"`);
      suggestion.warnings = [
        ...(suggestion.warnings || []),
        "Potential duplicate",
      ];
    }

    // Check confidence scores
    if (suggestion.confidence && suggestion.confidence < 0.3) {
      issues.push(
        `Low confidence suggestion: "${suggestion.title}" (${suggestion.confidence})`
      );
      suggestion.warnings = [
        ...(suggestion.warnings || []),
        "Low confidence score",
      ];
    }

    // Check for academic calendar logic violations
    validateAcademicCalendarLogic(suggestion, issues);

    // Check for LLM hallucination patterns
    validateForHallucination(suggestion, issues);
  }

  if (issues.length > 0) {
    console.log("Validation issues found:");
    issues.forEach((issue) => console.log(`  - ${issue}`));
  } else {
    console.log("All suggestions passed validation");
  }
}

/**
 * Validate academic calendar logic
 *
 * @param suggestion - Suggestion to validate
 * @param issues - Array to add issues to
 * @returns void
 */
export function validateAcademicCalendarLogic(
  suggestion: ParsedDeadlineSuggestion,
  issues: string[]
): void {
  const dueDate = suggestion.due;
  const dayOfWeek = dueDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Check for weekend deadlines (unusual for academic assignments)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    issues.push(
      `Suggestion "${
        suggestion.title
      }" has a weekend deadline (${dueDate.toDateString()}) - unusual for academic assignments`
    );
    suggestion.warnings = [
      ...(suggestion.warnings || []),
      "Weekend deadline - verify if correct",
    ];
  }

  // Check for very early morning deadlines (before 6 AM)
  const hour = dueDate.getHours();
  if (hour < 6) {
    issues.push(
      `Suggestion "${suggestion.title}" has very early morning deadline (${hour}:00) - unusual for academic assignments`
    );
    suggestion.warnings = [
      ...(suggestion.warnings || []),
      "Very early morning deadline - verify if correct",
    ];
  }

  // Check for late evening deadlines (after 11 PM)
  if (hour > 23) {
    issues.push(
      `Suggestion "${suggestion.title}" has very late evening deadline (${hour}:00) - unusual for academic assignments`
    );
    suggestion.warnings = [
      ...(suggestion.warnings || []),
      "Very late evening deadline - verify if correct",
    ];
  }
}

/**
 * Validate for LLM hallucination patterns
 *
 * @param suggestion - Suggestion to validate
 * @param issues - Array to add issues to
 * @returns void
 */
export function validateForHallucination(
  suggestion: ParsedDeadlineSuggestion,
  issues: string[]
): void {
  // Check for vague terms with high confidence (likely hallucination)
  const vagueTerms = ["tbd", "soon", "later", "eventually", "sometime"];
  const hasVagueTerms = vagueTerms.some((term) =>
    suggestion.title.toLowerCase().includes(term)
  );

  if (hasVagueTerms && suggestion.confidence && suggestion.confidence > 0.7) {
    issues.push(
      `Suggestion "${suggestion.title}" has high confidence (${suggestion.confidence}) for vague term - possible LLM hallucination`
    );
    suggestion.warnings = [
      ...(suggestion.warnings || []),
      "High confidence on vague term - possible hallucination",
    ];
  }

  // Check for impossible date combinations
  const now = new Date();
  const timeDiff = suggestion.due.getTime() - now.getTime();
  const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

  // Check for dates that are too close (less than 1 day from now)
  if (daysDiff < 1 && daysDiff > 0) {
    issues.push(
      `Suggestion "${suggestion.title}" has deadline less than 1 day away - verify if correct`
    );
    suggestion.warnings = [
      ...(suggestion.warnings || []),
      "Very short deadline - verify if correct",
    ];
  }

  // Check for suspiciously round dates (likely generated, not real)
  const day = suggestion.due.getDate();
  const month = suggestion.due.getMonth() + 1;
  if (day === 1 || day === 15 || day === 30 || day === 31) {
    if (suggestion.confidence && suggestion.confidence > 0.8) {
      issues.push(
        `Suggestion "${
          suggestion.title
        }" has high confidence for round date (${suggestion.due.toDateString()}) - possible LLM generation`
      );
      suggestion.warnings = [
        ...(suggestion.warnings || []),
        "High confidence on round date - possible generation",
      ];
    }
  }
}
