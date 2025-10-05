<concept_spec>
concept ParsedDeadlineSuggestions

purpose
    represent extracted deadline candidates from documents, images, web pages, or Canvas; optionally AI-augmented

principle
    suggestions are produced via an LLM from uploaded files, web pages, or Canvas data;
    users confirm suggestions before they become official deadlines

state
    a set of ParsedDeadlineSuggestion with
        an optional UploadedDocument
        an optional canvasMetadata String
        an optional websiteUrl String
        a title String
        a due DateTime
        a source of SYLLABUS or IMAGE or WEBSITE or CANVAS
        an optional confirmed Boolean
        an optional confidence Number (0.0–1.0)
        an optional extractionMethod of CANVAS_JSON or LLM
        an optional provenance String
        an optional warnings set of String

    a set of ExtractionConfig with
        a modelVersion String
        a basePromptTemplate String
        a maxTokens Number
        a temperature Number
        a timezone String
        an optional timeout Number

actions

    parseFromCanvas(user: User): List<ParsedDeadlineSuggestion>
        requires user has valid Canvas connection
        effect parses assignment JSON directly from Canvas API
               sets extractionMethod = CANVAS_JSON, source = CANVAS

    llmExtractFromDocument(document: UploadedDocument, config: ExtractionConfig): List<ParsedDeadlineSuggestion>
        requires document contains extractable text or image content
        effect uses LLM to extract structured suggestions from document
               sets extractionMethod = LLM, confidence, provenance

    llmExtractFromMultipleDocuments(documents: List<UploadedDocument>, config: ExtractionConfig): List<ParsedDeadlineSuggestion>
        requires all documents contain extractable content
        effect sends ALL documents to LLM in SINGLE request
               enables LLM to cross-reference information across documents
               (e.g., combine dates from PDF calendar with times from PNG syllabus)
               sets extractionMethod = LLM, confidence, provenance with multi-source attribution

    llmExtractFromWebsite(url: String, config: ExtractionConfig): List<ParsedDeadlineSuggestion>
        requires url is reachable, non-empty, and starts with https://
        effect uses LLM to parse website content into deadline suggestions
               sets extractionMethod = LLM, provenance, confidence

    refineWithFeedback(suggestion: ParsedDeadlineSuggestion, feedback: String, config: ExtractionConfig): ParsedDeadlineSuggestion
        requires suggestion exists and feedback is non-empty
        effect re-prompts LLM using user feedback to refine fields
               updates title, due, warnings, or confidence

    validateSuggestions(source: UploadedDocument or String)
        requires source is non-null and has suggestions
        effect applies validation logic (e.g., duplicate detection, implausible dates, hallucination detection)
               adds warnings or raises error if issues are detected

    editSuggestion(suggestion: ParsedDeadlineSuggestion, newTitle: String, newDue: DateTime): ParsedDeadlineSuggestion
        requires suggestion exists and newTitle is non-empty and newDue is valid
        effect updates suggestion title and due date without calling LLM
               sets warnings to indicate manual editing

    updateSuggestionTitle(suggestion: ParsedDeadlineSuggestion, newTitle: String): ParsedDeadlineSuggestion
        requires suggestion exists and newTitle is non-empty
        effect updates suggestion title without calling LLM
               sets warnings to indicate manual editing

    updateSuggestionDate(suggestion: ParsedDeadlineSuggestion, newDue: DateTime): ParsedDeadlineSuggestion
        requires suggestion exists and newDue is valid
        effect updates suggestion due date without calling LLM
               sets warnings to indicate manual editing

    confirm(suggestion: ParsedDeadlineSuggestion): (course: Course, title: String, due: DateTime, source: SYLLABUS or IMAGE or WEBSITE or CANVAS, addedBy: User)
        requires suggestion is not already confirmed and has valid title and due
        effect marks suggestion as confirmed
               emits canonical data to Deadlines.create

notes
    This concept integrates LLMs to enhance deadline extraction from diverse inputs (PDFs, screenshots, URLs).
    Manual confirmation ensures control over noisy or ambiguous parsing.
    Manual editing capabilities allow direct correction of LLM errors without re-invoking the LLM.
    Suggestions remain independent of Deadlines until user approval.

</concept_spec>
