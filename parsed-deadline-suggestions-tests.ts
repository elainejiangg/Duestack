/**
 * ParsedDeadlineSuggestions Test Cases
 *
 * Demonstrates rule-based parsing, LLM-assisted extraction, and refinement workflows
 */

import {
  ParsedDeadlineSuggestions,
  UploadedDocument,
  User,
  ExtractionConfig,
} from "./parsed-deadline-suggestions";
import { GeminiLLM, Config } from "./gemini-llm";
import { validateSuggestions } from "./parsed-deadline-validators";

/**
 * Load configuration from config.json
 */
function loadConfig(): Config {
  try {
    const config = require("../config.json");
    return config;
  } catch (error) {
    console.error(
      "Error loading config.json. Please ensure it exists with your API key."
    );
    console.error("Error details:", (error as Error).message);
    process.exit(1);
  }
}

/**
 * Create mock user for testing
 */
function createMockUser(): User {
  return {
    id: "user1",
    name: "Tim Johnson",
    email: "tim@mit.edu",
    canvasApiKey: "mock_canvas_key",
  };
}

/**
 * Test case 1: Canvas data parsing
 * Demonstrates extracting deadlines from Canvas assignments
 */
export async function testCanvasParsing(): Promise<void> {
  console.log("\n TEST CASE 1: Canvas Data Parsing");
  console.log("===================================");

  const parser = new ParsedDeadlineSuggestions();
  const user = createMockUser();

  console.log("Parsing Canvas assignments...");
  const suggestions = parser.parseFromCanvas(user);

  console.log(`\nExtracted ${suggestions.length} Canvas suggestions:`);
  suggestions.forEach((suggestion) => {
    console.log(
      `  - "${suggestion.title}" due ${suggestion.due.toLocaleDateString()}`
    );
    console.log(
      `    Source: ${suggestion.source}, Confidence: ${suggestion.confidence}`
    );
  });

  // Display all suggestions
  parser.displaySuggestions();
}

/**
 * Test case 3: LLM-assisted document extraction
 * Demonstrates using AI to extract deadlines from documents
 */
export async function testLLMDocumentExtraction(): Promise<void> {
  console.log("\n TEST CASE 2: LLM-Assisted Document Extraction");
  console.log("================================================");

  const parser = new ParsedDeadlineSuggestions();
  const config = loadConfig();
  const llm = new GeminiLLM(config);

  // Load real sample syllabus document
  const fs = require("fs");
  const path = require("path");
  const syllabusPath = path.join(
    __dirname,
    "../test-assets/sample-syllabus.txt"
  );
  const syllabusContent = fs.readFileSync(syllabusPath, "utf8");

  const document: UploadedDocument = {
    id: "sample-syllabus",
    filename: "sample-syllabus.txt",
    content: syllabusContent,
    fileType: "txt" as const,
    uploadDate: new Date(),
  };

  console.log(" Using LLM to extract deadlines from document...");

  try {
    const extractionConfig: ExtractionConfig = {
      modelVersion: "gemini-2.5-flash-lite",
      basePromptTemplate: `You are an expert at extracting deadline information from academic documents. 
Extract all assignment deadlines, project due dates, and important dates from the provided content.

TIMEZONE INSTRUCTIONS:
- All times in the content are in EST (Eastern Standard Time / America/New_York)
- Common assignment times: 11:59 PM EST
- Common prep assignment times: 10:00 AM EST
- Output all dates in ISO 8601 format with timezone (e.g., 2025-09-07T23:59:00-05:00)

Return your response as a JSON object with this exact structure:
{
  "suggestions": [
    {
      "title": "Assignment or project name",
      "due": "YYYY-MM-DDTHH:mm:ss-05:00",
      "confidence": 0.0-1.0,
      "provenance": "Brief description of where this was found"
    }
  ]
}

Focus on academic deadlines, assignment due dates, project milestones, and exam dates.
Be conservative with confidence scores - only use high scores (0.8+) when you're very certain.`,
      maxTokens: 2000,
      temperature: 0.1,
      timezone: "America/New_York",
    };

    const suggestions = await parser.llmExtractFromDocument(
      document,
      extractionConfig,
      llm
    );
    console.log(
      `\n LLM extracted ${suggestions.length} suggestions from ${document.filename}`
    );
  } catch (error) {
    console.error(
      ` Error processing ${document.filename}:`,
      (error as Error).message
    );
  }

  // Display all suggestions
  parser.displaySuggestions();
}

/**
 * Test case 4: LLM-assisted website extraction
 * Demonstrates using AI to extract deadlines from websites
 */
export async function testLLMWebsiteExtraction(): Promise<void> {
  console.log("\n TEST CASE 3: LLM-Assisted Website Extraction");
  console.log("===============================================");

  const parser = new ParsedDeadlineSuggestions();
  const config = loadConfig();
  const llm = new GeminiLLM(config);

  console.log(" Using LLM to extract deadlines from website...");

  try {
    const extractionConfig: ExtractionConfig = {
      modelVersion: "gemini-2.5-flash-lite",
      basePromptTemplate: `You are an expert at extracting deadline information from academic web pages. 
Extract all assignment deadlines, project due dates, and important dates from the provided content.

TIMEZONE INSTRUCTIONS:
- All times are in America/New_York timezone (Eastern Time)
- Use correct daylight saving offsets:
  * Sep-Oct 2025: EDT (UTC-4) → -04:00
  * Nov-Dec 2025: EST (UTC-5) → -05:00
- Examples: 2025-09-07T23:59:00-04:00, 2025-12-09T23:59:00-05:00

Return your response as a JSON object with this exact structure:
{
  "suggestions": [
    {
      "title": "Assignment or project name",
      "due": "YYYY-MM-DDTHH:mm:ss-05:00",
      "confidence": 0.0-1.0,
      "provenance": "Brief description of where this was found"
    }
  ]
}

Focus on academic deadlines, assignment due dates, project milestones, and exam dates.
Be conservative with confidence scores - only use high scores (0.8+) when you're very certain.`,
      maxTokens: 2000,
      temperature: 0.1,
      timezone: "America/New_York",
    };

    const url = "https://61040-fa25.github.io/schedule";
    const suggestions = await parser.llmExtractFromWebsite(
      url,
      extractionConfig,
      llm
    );
    console.log(
      `\n LLM extracted ${suggestions.length} suggestions from website`
    );
  } catch (error) {
    console.error(" Error processing website:", (error as Error).message);
  }

  // Display all suggestions
  parser.displaySuggestions();
}

/**
 * Test case 5: LLM refinement with user feedback
 * Demonstrates refining suggestions based on user input
 */
export async function testLLMRefinement(): Promise<void> {
  console.log("\n TEST CASE 4: LLM Refinement with User Feedback");
  console.log("=================================================");

  const parser = new ParsedDeadlineSuggestions();
  const config = loadConfig();
  const llm = new GeminiLLM(config);

  // First, create a suggestion using LLM from real document
  console.log(" Creating initial suggestion with LLM...");

  // Load real sample syllabus document
  const fs = require("fs");
  const path = require("path");
  const syllabusPath = path.join(
    __dirname,
    "../test-assets/sample-syllabus.txt"
  );
  const syllabusContent = fs.readFileSync(syllabusPath, "utf8");

  const document: UploadedDocument = {
    id: "sample-syllabus",
    filename: "sample-syllabus.txt",
    content: syllabusContent,
    fileType: "txt",
    uploadDate: new Date(),
  };

  try {
    const extractionConfig: ExtractionConfig = {
      modelVersion: "gemini-2.5-flash-lite",
      basePromptTemplate: `You are an expert at extracting deadline information from academic documents. 
Extract all assignment deadlines, project due dates, and important dates from the provided content.

TIMEZONE INSTRUCTIONS:
- All times in the content are in EST (Eastern Standard Time / America/New_York)
- Common assignment times: 11:59 PM EST
- Common prep assignment times: 10:00 AM EST
- Output all dates in ISO 8601 format with timezone (e.g., 2025-09-07T23:59:00-05:00)

Return your response as a JSON object with this exact structure:
{
  "suggestions": [
    {
      "title": "Assignment or project name",
      "due": "YYYY-MM-DDTHH:mm:ss-05:00",
      "confidence": 0.0-1.0,
      "provenance": "Brief description of where this was found"
    }
  ]
}

Focus on academic deadlines, assignment due dates, project milestones, and exam dates.
Be conservative with confidence scores - only use high scores (0.8+) when you're very certain.`,
      maxTokens: 2000,
      temperature: 0.1,
      timezone: "America/New_York",
    };

    const suggestions = await parser.llmExtractFromDocument(
      document,
      extractionConfig,
      llm
    );

    console.log(`\n Initial extraction: ${suggestions.length} suggestions`);
    console.log("─────────────────────────────────────────────────────");
    suggestions.forEach((s, i) => {
      console.log(`${i + 1}. "${s.title}"`);
    });

    // Demonstrate natural language refinement with pattern application
    console.log(
      "\n\n═══════════════════════════════════════════════════════════"
    );
    console.log(" Scenario: User wants consistent naming across ALL deadlines");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("\n 📝 User feedback (natural language):");
    console.log("    \"Please use consistent naming: abbreviate 'Homework' to");
    console.log("     'HW' everywhere, and remove the word 'Exam' from exam");
    console.log("     titles (just use 'Midterm' and 'Final').\"");

    console.log("\n Why use LLM refinement instead of manual editing?");
    console.log(" → Applies pattern to ALL items with ONE command");
    console.log(" → Understands natural language instructions");
    console.log(" → Faster than editing each title individually");

    console.log("\n Applying pattern via LLM refinement...");

    // Apply the natural language feedback to multiple items
    if (suggestions.length > 0) {
      const patternFeedback =
        "Please apply these naming conventions: " +
        "1) Abbreviate 'Homework' to 'HW' (e.g., 'Homework 1' becomes 'HW 1'), " +
        "2) Remove the word 'Exam' from exam titles (e.g., 'Midterm Exam' becomes 'Midterm', 'Final Exam' becomes 'Final'). " +
        "Apply this pattern consistently.";

      console.log("─────────────────────────────────────────────────────");

      // Refine all Homework items
      const homeworks = suggestions.filter((s) => s.title.includes("Homework"));
      for (const hw of homeworks) {
        const refined = await parser.refineWithFeedback(
          hw,
          patternFeedback,
          extractionConfig,
          llm
        );
        console.log(`  ✓ "${hw.title}" → "${refined.title}"`);
      }

      // Refine exam items
      const exams = suggestions.filter((s) => s.title.includes("Exam"));
      for (const exam of exams) {
        const refined = await parser.refineWithFeedback(
          exam,
          patternFeedback,
          extractionConfig,
          llm
        );
        console.log(`  ✓ "${exam.title}" → "${refined.title}"`);
      }

      console.log("\n 💡 Key Insight: Same pattern feedback applied to");
      console.log(
        `    ${homeworks.length + exams.length} items automatically!`
      );
      console.log("    Much faster than manually editing each one.");
    }
  } catch (error) {
    console.error(" Error in refinement test:", (error as Error).message);
  }

  // Display all suggestions
  parser.displaySuggestions();
}

/**
 * Test case 6: LLM Connection and Configuration Testing
 * Demonstrates the enhanced LLM features and connectivity testing
 */
export async function testLLMConnection(): Promise<void> {
  console.log("\n TEST CASE 5: LLM Connection and Configuration Testing");
  console.log("=======================================================");

  const parser = new ParsedDeadlineSuggestions();
  const config = loadConfig();
  const llm = new GeminiLLM(config);

  console.log(" Testing LLM connection and configuration...");

  try {
    // Test connection
    const connectionResult = await parser.testLLMConnection(llm);
    console.log(`\n Connection Test Result: ${connectionResult.message}`);

    // Get model information
    console.log("\n LLM Model Information:");
    const modelInfo = parser.getLLMInfo(llm);

    // Test prompt validation
    console.log("\n Testing prompt validation...");
    const testPrompt = `You are an expert at extracting deadline information from academic documents. 
Extract all assignment deadlines, project due dates, and important dates from the provided content.
Return your response as a JSON object with this exact structure:
{
  "suggestions": [
    {
      "title": "Assignment or project name",
      "due": "YYYY-MM-DDTHH:mm:ssZ",
      "confidence": 0.0-1.0,
      "provenance": "Brief description of where this was found"
    }
  ]
}

CONTENT TO ANALYZE:
This is a test document with multiple deadlines:
- Problem Set 1: Due October 15th at 11:59 PM
- Design Critique: Due October 25th at 5:00 PM
- Final Project: Due December 10th at 11:59 PM
- Final Exam: December 18th at 9:00 AM`;

    const validation = parser.validatePrompt(llm, testPrompt);
    console.log(
      `Validation Result: ${validation.isValid ? "PASSED" : "WARNINGS"}`
    );

    // Test actual extraction with enhanced error handling
    if (connectionResult.success) {
      console.log("\n Testing actual LLM extraction...");

      // Load real sample syllabus document
      const fs = require("fs");
      const path = require("path");
      const syllabusPath = path.join(
        __dirname,
        "../test-assets/sample-syllabus.txt"
      );
      const syllabusContent = fs.readFileSync(syllabusPath, "utf8");

      const document: UploadedDocument = {
        id: "sample-syllabus",
        filename: "sample-syllabus.txt",
        content: syllabusContent,
        fileType: "txt" as const,
        uploadDate: new Date(),
      };

      const extractionConfig: ExtractionConfig = {
        modelVersion: "gemini-2.5-flash-lite",
        basePromptTemplate: `You are an expert at extracting deadline information from academic documents. 
Extract all assignment deadlines, project due dates, and important dates from the provided content.

TIMEZONE INSTRUCTIONS:
- All times in the content are in EST (Eastern Standard Time / America/New_York)
- Common assignment times: 11:59 PM EST
- Common prep assignment times: 10:00 AM EST
- Output all dates in ISO 8601 format with timezone (e.g., 2025-09-07T23:59:00-05:00)

Return your response as a JSON object with this exact structure:
{
  "suggestions": [
    {
      "title": "Assignment or project name",
      "due": "YYYY-MM-DDTHH:mm:ss-05:00",
      "confidence": 0.0-1.0,
      "provenance": "Brief description of where this was found"
    }
  ]
}

Focus on academic deadlines, assignment due dates, project milestones, and exam dates.
Be conservative with confidence scores - only use high scores (0.8+) when you're very certain.`,
        maxTokens: 2000,
        temperature: 0.1,
        timezone: "America/New_York",
        timeout: 30000,
      };

      const suggestions = await parser.llmExtractFromDocument(
        document,
        extractionConfig,
        llm
      );
      console.log(
        `\n Enhanced LLM extraction completed: ${suggestions.length} suggestions extracted`
      );

      // Display results
      parser.displaySuggestions();
    }
  } catch (error) {
    console.error(" Error in LLM connection test:", (error as Error).message);
  }
}

/**
 * Test case 7: Manual Editing and Direct Updates
 * Demonstrates manual editing of suggestions without LLM involvement
 */
export async function testManualEditing(): Promise<void> {
  console.log("\n TEST CASE 6: Manual Editing and Direct Updates");
  console.log("================================================");

  const parser = new ParsedDeadlineSuggestions();
  const user = createMockUser();

  console.log("\n Scenario: LLM extracted suggestions with various issues");
  console.log("───────────────────────────────────────────────────────────");

  // Create test suggestions with realistic LLM extraction issues
  const suggestions = [
    {
      id: "ps1",
      title: "PS1 Due (L1)", // Issue: Abbreviated title
      due: new Date("2024-09-17T23:59:00Z"),
      source: "SYLLABUS" as const,
      confidence: 0.85,
      extractionMethod: "LLM" as const,
      provenance: "Extracted from 63700-Calendar_F2025-v1.pdf",
    },
    {
      id: "ps2",
      title: "PS2 Due (L2, L3)", // Issue: Abbreviated title
      due: new Date("2024-09-24T12:00:00Z"), // Issue: Wrong time (noon instead of 11:59 PM)
      source: "SYLLABUS" as const,
      confidence: 0.75,
      extractionMethod: "LLM" as const,
      provenance: "Extracted from 63700-Calendar_F2025-v1.pdf",
    },
    {
      id: "ps3",
      title: "PS3 Due (L4, L5)", // Issue: Abbreviated title
      due: new Date("2024-10-01T23:59:00Z"), // Issue: Wrong date (Oct 1 instead of Oct 2)
      source: "SYLLABUS" as const,
      confidence: 0.8,
      extractionMethod: "LLM" as const,
      provenance: "Extracted from 63700-Calendar_F2025-v1.pdf",
    },
    {
      id: "midterm",
      title: "Midterm Exam",
      due: new Date("2024-10-22T09:00:00Z"), // Issue: Missing "in class" context
      source: "SYLLABUS" as const,
      confidence: 0.9,
      extractionMethod: "LLM" as const,
      provenance: "Extracted from 63700-Calendar_F2025-v1.pdf",
    },
    {
      id: "final-project",
      title: "Final Project",
      due: new Date("2024-12-10T17:00:00Z"), // Correct
      source: "SYLLABUS" as const,
      confidence: 0.95,
      extractionMethod: "LLM" as const,
      provenance: "Extracted from 63700-Calendar_F2025-v1.pdf",
    },
  ];

  // Add suggestions to parser
  parser.addSuggestions(suggestions);

  console.log("\n Initial LLM-extracted suggestions (with issues):");
  parser.displaySuggestions();

  console.log(
    "\n\n═══════════════════════════════════════════════════════════"
  );
  console.log("User Tim starts manually correcting the issues:");
  console.log("═══════════════════════════════════════════════════════════");

  // Fix 1: Correct PS3 date
  console.log("\n 1. Correcting PS3 date (Oct 1 → Oct 2)...");
  const ps3Success = parser.updateSuggestionDate(
    "ps3",
    new Date("2024-10-02T23:59:00Z")
  );
  console.log(`    ✓ PS3 date corrected: ${ps3Success ? "Success" : "Failed"}`);

  // Fix 2: Correct PS2 time
  console.log("\n 2. Correcting PS2 time (12:00 PM → 11:59 PM)...");
  const ps2Success = parser.updateSuggestionDate(
    "ps2",
    new Date("2024-09-24T23:59:00Z")
  );
  console.log(`    ✓ PS2 time corrected: ${ps2Success ? "Success" : "Failed"}`);

  // Fix 3: Expand all abbreviated problem set titles
  console.log("\n 3. Expanding abbreviated titles...");
  const ps1TitleSuccess = parser.updateSuggestionTitle(
    "ps1",
    "Problem Set 1 (Lectures 1)"
  );
  console.log(
    `    ✓ PS1 title expanded: ${ps1TitleSuccess ? "Success" : "Failed"}`
  );

  const ps2TitleSuccess = parser.updateSuggestionTitle(
    "ps2",
    "Problem Set 2 (Lectures 2-3)"
  );
  console.log(
    `    ✓ PS2 title expanded: ${ps2TitleSuccess ? "Success" : "Failed"}`
  );

  const ps3TitleSuccess = parser.updateSuggestionTitle(
    "ps3",
    "Problem Set 3 (Lectures 4-5)"
  );
  console.log(
    `    ✓ PS3 title expanded: ${ps3TitleSuccess ? "Success" : "Failed"}`
  );

  // Fix 4: Add context to midterm
  console.log("\n 4. Adding context to Midterm...");
  const midtermSuccess = parser.updateSuggestionTitle(
    "midterm",
    "Midterm Exam (In-Class)"
  );
  console.log(
    `    ✓ Midterm title updated: ${midtermSuccess ? "Success" : "Failed"}`
  );

  console.log(
    "\n\n═══════════════════════════════════════════════════════════"
  );
  console.log("Final suggestions after manual corrections:");
  console.log("═══════════════════════════════════════════════════════════");
  parser.displaySuggestions();

  console.log("\n\n Summary of Manual Edits:");
  console.log("─────────────────────────────");
  console.log("  ✓ Fixed 1 incorrect date (PS3)");
  console.log("  ✓ Fixed 1 incorrect time (PS2)");
  console.log("  ✓ Expanded 3 abbreviated titles (PS1, PS2, PS3)");
  console.log("  ✓ Added context to 1 title (Midterm)");
  console.log("  Total: 6 manual corrections without calling LLM");

  console.log("\n✅ Manual editing test completed successfully!");
  console.log("\n Key Takeaway: Users can quickly fix LLM errors directly");
  console.log(" without waiting for API calls or re-processing documents.");
}

/**
 * Test case 8: Vague Academic Terms
 * Tests LLM with vague academic terms that could have multiple interpretations
 */
export async function testVagueAcademicTerms(): Promise<void> {
  console.log("\n TEST CASE 8: Vague Academic Terms - Full User Scenario");
  console.log("==========================================================");

  const parser = new ParsedDeadlineSuggestions();
  const config = loadConfig();
  const llm = new GeminiLLM(config);
  const user = createMockUser();

  console.log("\n FULL SCENARIO:");
  console.log(
    " Student uploads syllabus with vague terms → Initial extraction"
  );
  console.log(
    " → Reviews results → Notices hallucinations → Provides feedback"
  );
  console.log(" → System re-extracts with improved prompts\n");

  // USER ACTION 1: Upload document
  console.log(" [USER ACTION 1] Student uploads syllabus with vague terms");
  const fs = require("fs");
  const path = require("path");
  const syllabusPath = path.join(
    __dirname,
    "../test-assets/sample-syllabus.txt"
  );
  const syllabusContent = fs.readFileSync(syllabusPath, "utf8");

  const ambiguousDocument: UploadedDocument = {
    id: "sample-syllabus",
    filename: "sample-syllabus.txt",
    content: syllabusContent,
    fileType: "txt" as const,
    uploadDate: new Date(),
  };
  console.log(" ✓ Uploaded: sample-syllabus.txt");

  // LLM ACTION 1: Initial extraction with basic prompt
  console.log(
    "\n [LLM ACTION 1] Initial extraction with basic prompt (Variant A)"
  );
  const basicConfig = {
    modelVersion: "gemini-2.5-flash-lite",
    basePromptTemplate: `Extract deadline information from the following document. Return a JSON object with a "suggestions" array. Each suggestion should have: title, due (ISO date), confidence (0.0-1.0), and provenance.`,
    maxTokens: 1000,
    temperature: 0.1,
    timezone: "America/New_York",
  };

  let initialSuggestions: any[] = [];
  try {
    initialSuggestions = await parser.llmExtractFromDocument(
      ambiguousDocument,
      basicConfig,
      llm
    );
    console.log(` ✓ Extracted ${initialSuggestions.length} suggestions`);
    parser.displaySuggestions();
  } catch (error) {
    console.error(" ✗ Basic extraction failed:", (error as Error).message);
  }

  // USER ACTION 2: Review results and notice hallucinations
  console.log("\n [USER ACTION 2] Student reviews results and notices issues");
  const vagueTerms = initialSuggestions.filter(
    (s) =>
      s.title.toLowerCase().includes("tbd") ||
      s.title.toLowerCase().includes("soon") ||
      s.title.toLowerCase().includes("later")
  );
  console.log(
    ` ⚠ Found ${vagueTerms.length} suggestions with vague terms that may be hallucinated`
  );
  if (vagueTerms.length > 0) {
    vagueTerms.forEach((s) => {
      console.log(`    - "${s.title}" with confidence ${s.confidence}`);
    });
  }

  // USER ACTION 3: Provide feedback
  console.log("\n [USER ACTION 3] Student provides feedback:");
  console.log(
    ' "Please reject vague terms like TBD and Soon - only extract explicit dates"'
  );

  parser.clearSuggestions();

  // LLM ACTION 2: Re-extract with improved prompt (Variant C)
  console.log(
    "\n [LLM ACTION 2] Re-extract with conservative prompt (Variant C)"
  );
  console.log(" System applies feedback to use stricter rejection rules");
  const conservativeConfig = {
    modelVersion: "gemini-2.5-flash-lite",
    basePromptTemplate: `Extract ONLY deadlines with explicit dates or very clear academic calendar references. 

    REJECT these ambiguous terms:
    - "TBD", "will be announced", "soon", "later", "next week"
    - Any deadline without a specific date or clear academic calendar reference

    ACCEPT only:
    - Explicit dates (e.g., "October 15th", "Dec 10")
    - Clear academic calendar references (e.g., "end of semester", "finals week")
    - Specific day references (e.g., "Monday", "Friday")

    Return JSON with "suggestions" array. Be extremely conservative - it's better to miss a deadline than to hallucinate one.`,
    maxTokens: 1200,
    temperature: 0.05,
    timezone: "America/New_York",
  };

  try {
    const refinedSuggestions = await parser.llmExtractFromDocument(
      ambiguousDocument,
      conservativeConfig,
      llm
    );
    console.log(` ✓ Re-extracted ${refinedSuggestions.length} suggestions`);
    const vagueTermsAfter = refinedSuggestions.filter(
      (s) =>
        s.title.toLowerCase().includes("tbd") ||
        s.title.toLowerCase().includes("soon") ||
        s.title.toLowerCase().includes("later")
    );
    console.log(
      ` ✓ Hallucinations reduced: ${vagueTermsAfter.length} vague terms remaining (down from ${vagueTerms.length})`
    );
    parser.displaySuggestions();
  } catch (error) {
    console.error(" ✗ Re-extraction failed:", (error as Error).message);
  }

  // USER ACTION 4: Validate and confirm results
  console.log("\n [USER ACTION 4] Student validates improved results");
  const currentSuggestions = parser.getAllSuggestions();
  const confirmedCount = currentSuggestions.filter(
    (s: any) => !s.warnings || s.warnings.length === 0
  ).length;
  console.log(` ✓ ${confirmedCount} clean suggestions ready to confirm`);
  console.log("\n SCENARIO COMPLETE: Full user-LLM interaction demonstrated");
}

/**
 * Test case 9: MIT Course Date Formats
 * Tests LLM with various date formats commonly found in MIT course materials
 */
export async function testInternationalDateFormats(): Promise<void> {
  console.log("\n TEST CASE 9: MIT Course Date Formats");
  console.log("=======================================");

  const parser = new ParsedDeadlineSuggestions();
  const config = loadConfig();
  const llm = new GeminiLLM(config);
  const user = createMockUser();

  console.log(" Testing with various date formats...");

  // Load real sample syllabus document
  const fs = require("fs");
  const path = require("path");
  const syllabusPath = path.join(
    __dirname,
    "../test-assets/sample-syllabus.txt"
  );
  const syllabusContent = fs.readFileSync(syllabusPath, "utf8");

  const multiFormatDocument: UploadedDocument = {
    id: "sample-syllabus",
    filename: "sample-syllabus.txt",
    content: syllabusContent,
    fileType: "txt" as const,
    uploadDate: new Date(),
  };

  // Test with basic prompt (Variant 1)
  console.log("\n Variant 1: Basic Date Parsing");
  const basicConfig = {
    modelVersion: "gemini-2.5-flash-lite",
    basePromptTemplate: `Extract deadline information from the following document. Parse all dates and return a JSON object with a "suggestions" array. Each suggestion should have: title, due (ISO date), confidence (0.0-1.0), and provenance.`,
    maxTokens: 1500,
    temperature: 0.1,
    timezone: "America/New_York",
  };

  try {
    await parser.llmExtractFromDocument(multiFormatDocument, basicConfig, llm);
    console.log(" Basic date parsing results:");
    parser.displaySuggestions();
  } catch (error) {
    console.error(" Basic date parsing failed:", (error as Error).message);
  }

  // Clear suggestions for next test
  parser.clearSuggestions();

  // Test with enhanced prompt (Variant 2)
  console.log("\n Variant 2: Enhanced Date Format Recognition");
  const enhancedConfig = {
    modelVersion: "gemini-2.5-flash-lite",
    basePromptTemplate: `You are an expert at parsing dates in multiple formats commonly found in MIT course materials. Extract deadline information from the following document.

    DATE FORMAT RECOGNITION RULES:
    - MM/DD/YYYY (e.g., 10/15/2024 = October 15, 2024)
    - MM-DD-YYYY (e.g., 10-15-2024 = October 15, 2024)
    - YYYY-MM-DD (e.g., 2024-10-15 = October 15, 2024)
    - American format: Oct 15, 2024 = October 15, 2024
    - British format: 15th October 2024 = October 15, 2024
    - Relative dates: "Next Monday" = Calculate from today
    - Relative dates: "In 2 weeks" = Calculate from today
    - Relative dates: "Due Wednesday" = Calculate from today
    - Relative dates: "End of week" = Calculate from today

    Convert ALL dates to ISO format (YYYY-MM-DDTHH:MM:SSZ).
    For relative dates, calculate based on current date.
    Return JSON with "suggestions" array.`,
    maxTokens: 2000,
    temperature: 0.1,
    timezone: "America/New_York",
  };

  try {
    await parser.llmExtractFromDocument(
      multiFormatDocument,
      enhancedConfig,
      llm
    );
    console.log(" Enhanced date parsing results:");
    parser.displaySuggestions();
  } catch (error) {
    console.error(" Enhanced date parsing failed:", (error as Error).message);
  }

  // Clear suggestions for next test
  parser.clearSuggestions();

  // Test with conservative prompt (Variant 3)
  console.log("\n Variant 3: Conservative Date Parsing");
  const conservativeConfig = {
    modelVersion: "gemini-2.5-flash-lite",
    basePromptTemplate: `Extract deadline information, but ONLY for dates in unambiguous formats commonly found in MIT courses.

    ACCEPT these formats:
    - ISO format: 2024-10-15
    - American format: Oct 15, 2024
    - British format: 15th October 2024

    REJECT these ambiguous formats:
    - MM/DD/YYYY vs DD/MM/YYYY (ambiguous)
    - MM-DD-YYYY vs DD-MM-YYYY (ambiguous)
    - Relative dates: "Next Monday", "In 2 weeks", "Due Wednesday", "End of week"

    Only extract deadlines with unambiguous date formats.
    Return JSON with "suggestions" array.`,
    maxTokens: 1200,
    temperature: 0.05,
    timezone: "America/New_York",
  };

  try {
    await parser.llmExtractFromDocument(
      multiFormatDocument,
      conservativeConfig,
      llm
    );
    console.log(" Conservative date parsing results:");
    parser.displaySuggestions();
  } catch (error) {
    console.error(
      " Conservative date parsing failed:",
      (error as Error).message
    );
  }

  console.log("\n Analysis of Multi-Format Date Parsing Test:");
  console.log("==============================================");
  console.log(" Variant 1 (Basic): May misinterpret ambiguous date formats");
  console.log(
    " Variant 2 (Enhanced): Better format recognition, but may still make errors"
  );
  console.log(
    " Variant 3 (Conservative): Most reliable, but misses some valid dates"
  );
  console.log(
    "  Key Issue: Date format ambiguity is a major source of LLM errors"
  );
  console.log(" Best Approach: Enhanced prompting with explicit format rules");
}

/**
 * Test case 10: Academic Calendar Context
 * Tests LLM with ambiguous context requiring domain knowledge
 */
export async function testAcademicCalendarContext(): Promise<void> {
  console.log("\n TEST CASE 10: Academic Calendar Context");
  console.log("===========================================");

  const parser = new ParsedDeadlineSuggestions();
  const config = loadConfig();
  const llm = new GeminiLLM(config);
  const user = createMockUser();

  console.log(" Testing with context-dependent interpretation...");

  // Load real sample syllabus document
  const fs = require("fs");
  const path = require("path");
  const syllabusPath = path.join(
    __dirname,
    "../test-assets/sample-syllabus.txt"
  );
  const syllabusContent = fs.readFileSync(syllabusPath, "utf8");

  const contextDocument: UploadedDocument = {
    id: "sample-syllabus",
    filename: "sample-syllabus.txt",
    content: syllabusContent,
    fileType: "txt" as const,
    uploadDate: new Date(),
  };

  // Test with basic prompt (Variant 1)
  console.log("\n Variant 1: Basic Context Extraction");
  const basicConfig = {
    modelVersion: "gemini-2.5-flash-lite",
    basePromptTemplate: `Extract deadline information from the following document. Return a JSON object with a "suggestions" array. Each suggestion should have: title, due (ISO date), confidence (0.0-1.0), and provenance.`,
    maxTokens: 1500,
    temperature: 0.1,
    timezone: "America/New_York",
  };

  try {
    await parser.llmExtractFromDocument(contextDocument, basicConfig, llm);
    console.log(" Basic context extraction results:");
    parser.displaySuggestions();
  } catch (error) {
    console.error(
      " Basic context extraction failed:",
      (error as Error).message
    );
  }

  // Clear suggestions for next test
  parser.clearSuggestions();

  // Test with enhanced prompt (Variant 2)
  console.log("\n Variant 2: Enhanced Academic Context Prompt");
  const enhancedConfig = {
    modelVersion: "gemini-2.5-flash-lite",
    basePromptTemplate: `You are an expert academic scheduler. Extract deadline information from course documents, considering academic context and patterns.

    ACADEMIC CONTEXT RULES:
    - "Every Tuesday" = Calculate specific Tuesdays from course start date
    - "Last day of class" = Use last day of semester (December 15th)
    - "Week 12" = Calculate 12 weeks from course start (October 15th)
    - "Before final project" = Use date before final project deadline
    - "After each lecture" = Calculate based on lecture schedule
    - "Weekly" = Calculate based on course schedule

    ASSUMPTIONS:
    - Course starts: September 3rd (typical fall semester)
    - Semester ends: December 15th
    - Classes meet: Tuesdays and Thursdays
    - Lectures: Tuesday and Thursday

    Return JSON with "suggestions" array. Make reasonable academic calendar assumptions.`,
    maxTokens: 2000,
    temperature: 0.1,
    timezone: "America/New_York",
  };

  try {
    await parser.llmExtractFromDocument(contextDocument, enhancedConfig, llm);
    console.log(" Enhanced context extraction results:");
    parser.displaySuggestions();
  } catch (error) {
    console.error(
      " Enhanced context extraction failed:",
      (error as Error).message
    );
  }

  // Clear suggestions for next test
  parser.clearSuggestions();

  // Test with conservative prompt (Variant 3)
  console.log("\n Variant 3: Conservative Context Extraction");
  const conservativeConfig = {
    modelVersion: "gemini-2.5-flash-lite",
    basePromptTemplate: `Extract ONLY deadlines with explicit dates or very clear academic calendar references.

    ACCEPT:
    - Explicit dates: "October 15th"
    - Clear academic references: "Last day of class" (use December 15th)

    REJECT:
    - Relative references: "Every Tuesday", "Week 12", "Before final project"
    - Vague references: "After each lecture", "Weekly"
    - Context-dependent: "Individual paper: Before final project"

    Only extract deadlines with unambiguous dates or clear academic calendar references.
    Return JSON with "suggestions" array.`,
    maxTokens: 1200,
    temperature: 0.05,
    timezone: "America/New_York",
  };

  try {
    await parser.llmExtractFromDocument(
      contextDocument,
      conservativeConfig,
      llm
    );
    console.log(" Conservative context extraction results:");
    parser.displaySuggestions();
  } catch (error) {
    console.error(
      " Conservative context extraction failed:",
      (error as Error).message
    );
  }

  console.log("\n Analysis of Context-Dependent Interpretation Test:");
  console.log("======================================================");
  console.log(" Variant 1 (Basic): Likely to miss context-dependent deadlines");
  console.log(
    " Variant 2 (Enhanced): Better at academic context, but may make wrong assumptions"
  );
  console.log(
    " Variant 3 (Conservative): Most reliable, but misses many valid deadlines"
  );
  console.log(
    "  Key Issue: Academic context requires domain knowledge and assumptions"
  );
  console.log(
    " Best Approach: Enhanced prompting with explicit academic calendar assumptions"
  );
}

/**
 * Test case 11: Mixed workflow - Canvas + LLM + confirmation
 * Demonstrates a complete workflow combining different extraction methods
 */
export async function testMixedWorkflow(): Promise<void> {
  console.log("\n TEST CASE 11: Mixed Workflow");
  console.log("==============================");

  const parser = new ParsedDeadlineSuggestions();
  const config = loadConfig();
  const llm = new GeminiLLM(config);
  const user = createMockUser();

  console.log(" Running mixed workflow: Canvas + LLM + confirmation...");

  try {
    // Step 1: Canvas parsing
    console.log("\n Step 1: Canvas data parsing...");
    parser.parseFromCanvas(user);

    // Step 2: LLM website extraction
    console.log("\n Step 2: LLM website extraction...");
    const extractionConfig: ExtractionConfig = {
      modelVersion: "gemini-2.5-flash-lite",
      basePromptTemplate: `You are an expert at extracting deadline information from academic web pages. 
Extract all assignment deadlines, project due dates, and important dates from the provided content.

TIMEZONE INSTRUCTIONS:
- All times in the content are in EST (Eastern Standard Time / America/New_York)
- Common assignment times: 11:59 PM EST
- Common prep assignment times: 10:00 AM EST
- Output all dates in ISO 8601 format with timezone (e.g., 2025-09-07T23:59:00-05:00)

Return your response as a JSON object with this exact structure:
{
  "suggestions": [
    {
      "title": "Assignment or project name",
      "due": "YYYY-MM-DDTHH:mm:ss-05:00",
      "confidence": 0.0-1.0,
      "provenance": "Brief description of where this was found"
    }
  ]
}

Focus on academic deadlines, assignment due dates, project milestones, and exam dates.
Be conservative with confidence scores - only use high scores (0.8+) when you're very certain.`,
      maxTokens: 2000,
      temperature: 0.1,
      timezone: "America/New_York",
    };

    const url = "https://web.mit.edu/6.1040/www/schedule.html";
    await parser.llmExtractFromWebsite(url, extractionConfig, llm);

    // Step 3: Display all suggestions
    console.log("\n Step 3: All extracted suggestions:");
    parser.displaySuggestions();

    // Step 4: Confirm some suggestions
    console.log("\n Step 4: Confirming high-confidence suggestions...");
    const allSuggestions = parser.getAllSuggestions();
    const highConfidenceSuggestions = allSuggestions.filter(
      (s) => !s.confirmed && s.confidence && s.confidence > 0.8
    );

    for (const suggestion of highConfidenceSuggestions.slice(0, 2)) {
      // Confirm first 2
      try {
        const confirmed = parser.confirm(suggestion, user);
        console.log(
          ` Confirmed: "${confirmed.title}" for course ${confirmed.course}`
        );
      } catch (error) {
        console.log(
          ` Could not confirm "${suggestion.title}": ${
            (error as Error).message
          }`
        );
      }
    }

    // Final display
    console.log("\n Final state after confirmations:");
    parser.displaySuggestions();
  } catch (error) {
    console.error(" Error in mixed workflow:", (error as Error).message);
  }
}

/**
 * Main function to run all test cases
 */
async function main(): Promise<void> {
  console.log(" ParsedDeadlineSuggestions Test Suite");
  console.log("=======================================\n");

  try {
    // Run Canvas parsing test
    await testCanvasParsing();

    // Run LLM document extraction test
    await testLLMDocumentExtraction();

    // Run LLM website extraction test
    await testLLMWebsiteExtraction();

    // Run LLM refinement test
    await testLLMRefinement();

    // Run LLM connection test
    await testLLMConnection();

    // Run manual editing test
    await testManualEditing();

    // Run PDF+PNG multi-document extraction test
    await testPdfPngExtraction();

    // Run challenging test cases
    await testVagueAcademicTerms();
    await testInternationalDateFormats();
    await testAcademicCalendarContext();

    // Run mixed workflow test
    await testMixedWorkflow();

    console.log("\n All test cases completed successfully!");
  } catch (error) {
    console.error(" Test error:", (error as Error).message);
    process.exit(1);
  }
}

// Test Case 7: Combined PDF + PNG Extraction (Single LLM Request)
export async function testPdfPngExtraction() {
  console.log("\n TEST CASE 7: Combined PDF + PNG Extraction");
  console.log("==============================================");

  try {
    const parser = new ParsedDeadlineSuggestions();

    // Load API key from config.json
    const fs = require("fs");
    const path = require("path");
    const configPath = path.join(__dirname, "../config.json");
    const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));

    const llm = new GeminiLLM({
      apiKey: configData.apiKey,
    });

    console.log("\n📂 Loading course materials...");
    console.log("────────────────────────────────");

    // Load Calendar PDF
    const calendarPdfPath = path.join(
      __dirname,
      "../test-assets/63700-Calendar_F2025-v1.pdf"
    );
    const pdfBuffer = fs.readFileSync(calendarPdfPath);
    console.log(
      `   ✓ Loaded PDF: 63700-Calendar_F2025-v1.pdf (${pdfBuffer.length} bytes)`
    );

    // Load General Info PNG
    const generalInfoPngPath = path.join(
      __dirname,
      "../test-assets/63700-General-Info-f25-v1.png"
    );
    const pngBuffer = fs.readFileSync(generalInfoPngPath);
    console.log(
      `   ✓ Loaded PNG: 63700-General-Info-f25-v1.png (${pngBuffer.length} bytes)`
    );

    console.log("\n🤖 Processing both documents in a SINGLE LLM request...");
    console.log("   (LLM can cross-reference information from both sources)");

    const prompt = `You are an expert at extracting deadline information from academic documents. 
I am providing you with TWO documents simultaneously:
1. A CALENDAR PDF with assignment due DATES
2. A GENERAL INFO PNG with timing SPECIFICATIONS

IMPORTANT: Cross-reference information from BOTH documents to create complete deadline suggestions.
- Extract dates from the calendar PDF
- Extract timing information from the general info PNG  
- Combine them intelligently (e.g., if calendar says "PS1 due Wednesday Sept 17" and general info says "homework due at 11:59 PM", output "Sept 17 at 11:59 PM")

TIMEZONE INSTRUCTIONS:
- All times are in America/New_York timezone (Eastern Time)
- Use correct daylight saving offsets:
  * Sep-Oct 2025: EDT (UTC-4) → -04:00
  * Nov-Dec 2025: EST (UTC-5) → -05:00
- Examples: 2025-09-17T23:59:00-04:00, 2025-12-09T23:59:00-05:00

Return your response as a JSON object with this exact structure:
{
  "suggestions": [
    {
      "title": "Assignment or project name",
      "due": "YYYY-MM-DDTHH:mm:ss-04:00 or -05:00",
      "confidence": 0.0-1.0,
      "provenance": "Brief description citing which document(s) this came from"
    }
  ]
}

Focus on academic deadlines, assignment due dates, project milestones, and exam dates.
Be conservative with confidence scores - only use high scores (0.8+) when you're very certain.`;

    // Create combined request with both PDF and PNG
    const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(configData.apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        maxOutputTokens: 3000,
        temperature: 0.1,
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

    // Send both documents in a single request
    const result = await model.generateContent([
      {
        inlineData: {
          data: pdfBuffer.toString("base64"),
          mimeType: "application/pdf",
        },
      },
      {
        inlineData: {
          data: pngBuffer.toString("base64"),
          mimeType: "image/png",
        },
      },
      prompt,
    ]);

    const response = result.response;
    const text = response.text();

    console.log("\n✅ LLM Response received!");
    console.log(
      `   Token usage: ${
        response.usageMetadata?.promptTokenCount || 0
      } prompt + ${response.usageMetadata?.candidatesTokenCount || 0} response`
    );

    // Parse the response
    const parsed = JSON.parse(text);
    const suggestions = parsed.suggestions || [];

    console.log(`\n📊 Extracted ${suggestions.length} combined suggestions:`);
    console.log("─────────────────────────────────────────────");

    // Add suggestions to parser
    const formattedSuggestions = suggestions.map((item: any) => ({
      id: parser["generateId"](),
      title: item.title,
      due: new Date(item.due),
      source: "SYLLABUS" as const,
      extractionMethod: "LLM" as const,
      confidence: item.confidence || 0.5,
      provenance: item.provenance || "PDF + PNG extraction",
      warnings: [],
    }));

    parser.addSuggestions(formattedSuggestions);

    // Display results
    formattedSuggestions.forEach((s: any, i: number) => {
      console.log(`\n${i + 1}. ${s.title}`);
      console.log(
        `   Due: ${s.due.toLocaleDateString("en-US", {
          timeZone: "America/New_York",
        })} at ${s.due.toLocaleTimeString("en-US", {
          timeZone: "America/New_York",
        })}`
      );
      console.log(`   Confidence: ${(s.confidence || 0) * 100}%`);
      console.log(`   Source: ${s.provenance}`);
    });

    console.log("\n💡 Intelligent Cross-Referencing Demonstration:");
    console.log("═════════════════════════════════════════════════");
    console.log("   ✓ Single LLM request with BOTH documents");
    console.log(
      "   ✓ LLM cross-references: Calendar dates + General info times"
    );
    console.log(
      "   ✓ Result: Complete deadline suggestions with dates AND times"
    );

    // Display all suggestions in detail
    console.log("");
    parser.displaySuggestions();

    console.log(
      "\n✅ Combined PDF + PNG extraction test completed successfully!"
    );
  } catch (error) {
    console.error(
      "\n❌ Combined extraction test failed:",
      (error as Error).message
    );
    throw error;
  }
}

// Run the tests if this file is executed directly
if (require.main === module) {
  main();
}
