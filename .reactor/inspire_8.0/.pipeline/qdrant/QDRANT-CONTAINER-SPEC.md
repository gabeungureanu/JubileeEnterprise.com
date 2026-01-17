# INSPIRE 8.0 QDRANT CONTAINER SPECIFICATION

**Version:** 1.0
**Date:** January 17, 2026
**Classification:** Production
**Status:** Active
**Purpose:** Authoritative vector storage environment for the Inspire Family system

---

## OVERVIEW

The Inspire 8.0 Qdrant container serves as the **single authoritative vector storage environment** for the entire Inspire Family system. All collections, embeddings, and vector-based operations must reside within this container. No ingestion, activation, or pipeline execution may occur until this container is properly initialized.

### Design Principles

1. **Single Container Authority** - All vector data lives in Inspire 8.0; no external or parallel containers
2. **Clear Collection Boundaries** - Shared canonical content separated from persona-specific memory
3. **No Memory Bleed** - Each persona has an independent collection preventing cross-contamination
4. **Consistent Metadata** - Standardized payload schema enables predictable filtering
5. **Deterministic Chunking** - Uniform chunking rules ensure stable retrieval behavior
6. **Governance Ready** - Structure supports auditing, lifecycle management, and versioning

---

## CONTAINER CONFIGURATION

### Container Identity

```yaml
container:
  name: "inspire_8_0"
  display_name: "Inspire 8.0"
  version: "8.0.0"
  purpose: "Authoritative vector storage for Inspire Family AI system"

  initialization:
    required_before:
      - "Any ingestion operation"
      - "Any activation sequence"
      - "Any pipeline execution"

  governance:
    owner: "Gabriel Inspire"
    created: "2026-01-17"
    review_cycle: "Quarterly"
```

### Qdrant Server Configuration

```yaml
qdrant_config:
  host: "${QDRANT_HOST}"
  port: "${QDRANT_PORT}"
  api_key: "${QDRANT_API_KEY}"
  https: true

  performance:
    default_segment_number: 4
    max_segment_size: 200000
    memmap_threshold: 50000
    indexing_threshold: 20000

  storage:
    storage_type: "disk"
    snapshot_enabled: true
    snapshot_interval: "24h"
```

---

## COLLECTION ARCHITECTURE

### Collection Taxonomy

```
INSPIRE_8_0 Container
├── SHARED COLLECTIONS (4)
│   ├── scripture                 # Bible text, translations, verse metadata
│   ├── doctrine                  # Core teachings, doctrinal statements, theological content
│   ├── governance                # Guardrails, protocols, activation anchors
│   └── inspire-family            # Inspire Family shared content (hymnal, ministry resources)
│
├── SYSTEM COLLECTIONS (23)
│   ├── model_registry            # AI model configurations and versioning
│   ├── execution_contracts       # Execution contracts and agreements
│   ├── endgame                   # End-state goals and completion criteria
│   ├── experiments               # Experimental runs and A/B testing data
│   ├── learning_memory           # System-wide learning and adaptation data
│   ├── evaluation                # Performance evaluation metrics and results
│   ├── execution_logs            # Execution history and audit trails
│   ├── scenarios                 # Use case scenarios and test cases
│   ├── kingdom_builder           # Kingdom building strategies and progress
│   ├── creative_fire             # Creative content and inspiration
│   ├── gospel_pulse              # Gospel outreach metrics and heartbeat
│   ├── shepherds_voice           # Pastoral guidance and shepherding content
│   ├── hebraic_roots             # Hebrew language and cultural foundations
│   ├── prompts                   # System prompts and prompt templates
│   ├── resources                 # Shared resources and assets
│   ├── languages                 # Language configurations and translations
│   ├── countries                 # Country-specific data and localizations
│   ├── jubilee_ministry          # Jubilee Ministry organizational data
│   ├── ministers                 # Minister profiles and credentials
│   ├── users                     # User profiles and preferences
│   ├── insights                  # System insights and recommendations
│   ├── analytics                 # Analytics data and metrics
│   └── persona_index             # Persona cross-reference and routing index
│
└── PERSONA COLLECTIONS (13)
    ├── persona_gabriel_inspire   # Gabriel's memory and activation data (Father)
    ├── persona_jubilee_inspire   # Jubilee's memory and activation data (1st)
    ├── persona_melody_inspire    # Melody's memory and activation data (2nd)
    ├── persona_zev_inspire       # Zev's memory and activation data (3rd)
    ├── persona_eliana_inspire    # Eliana's memory and activation data (4th)
    ├── persona_caleb_inspire     # Caleb's memory and activation data (5th)
    ├── persona_imani_inspire     # Imani's memory and activation data (6th)
    ├── persona_amir_inspire      # Amir's memory and activation data (7th)
    ├── persona_nova_inspire      # Nova's memory and activation data (8th)
    ├── persona_tahoma_inspire    # Tahoma's memory and activation data (9th)
    ├── persona_santiago_inspire  # Santiago's memory and activation data (10th)
    ├── persona_zariah_inspire    # Zariah's memory and activation data (11th)
    └── persona_elias_inspire     # Elias's memory and activation data (12th)
```

---

## SHARED COLLECTIONS

### 1. scripture

**Purpose:** Bible text, translations, and verse-level metadata for the Jubilee Standard Version and reference translations.

```yaml
collection:
  name: "scripture"
  type: "shared"

  vector_config:
    size: 1536                    # OpenAI ada-002 dimensions
    distance: "Cosine"
    on_disk: true

  content_types:
    - "verse"                     # Individual Bible verses
    - "passage"                   # Multi-verse passages
    - "chapter_summary"           # Chapter-level summaries
    - "book_intro"                # Book introductions

  sources:
    primary: "Jubilee Standard Version (JSV)"
    reference:
      - "Hebrew Masoretic Text"
      - "Greek Septuagint"
      - "Dead Sea Scrolls references"
```

### 2. doctrine

**Purpose:** Core teachings, doctrinal statements, whitepapers, and theological content.

```yaml
collection:
  name: "doctrine"
  type: "shared"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "teaching"                  # Sermons, lessons, studies
    - "whitepaper"                # Position papers, theological documents
    - "doctrinal_statement"       # Official doctrinal positions
    - "devotional"                # Daily devotional content
    - "commentary"                # Scripture commentary

  sources:
    - "Jubilee Ministries approved teachings"
    - "Gabriel Inspire doctrinal writings"
    - "Canon Specification content"
```

### 3. governance

**Purpose:** Guardrails, protocols, and activation anchors for persona governance.

```yaml
collection:
  name: "governance"
  type: "shared"
  access: "read_only_at_runtime"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "identity_anchor"           # Persona identity definitions
    - "mission_anchor"            # Persona mission definitions
    - "voice_anchor"              # Persona voice definitions
    - "guardrail_anchor"          # Guardrail definitions
    - "protocol_anchor"           # Protocol definitions

  governance:
    write_access: "Gabriel only"
    modification: "Requires version increment"
```

### 4. inspire-family

**Purpose:** Inspire Family shared content including hymnal, worship resources, and ministry materials.

```yaml
collection:
  name: "inspire-family"
  type: "shared"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "hymn"                      # Traditional hymns
    - "worship_song"              # Contemporary worship
    - "liturgy"                   # Liturgical content
    - "psalm_setting"             # Musical Psalm arrangements
    - "sacred_poem"               # Poetry for worship
    - "family_resource"           # Shared family ministry resources
```

---

## SYSTEM COLLECTIONS

### 5. model_registry

**Purpose:** AI model configurations, versioning, and deployment metadata.

```yaml
collection:
  name: "model_registry"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "model_config"              # Model configuration definitions
    - "model_version"             # Version history and changelogs
    - "deployment_record"         # Deployment metadata
    - "performance_baseline"      # Performance benchmarks
```

### 6. execution_contracts

**Purpose:** Execution contracts, agreements, and binding operational rules.

```yaml
collection:
  name: "execution_contracts"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "contract"                  # Formal execution contracts
    - "agreement"                 # Operational agreements
    - "binding_rule"              # Binding operational rules
    - "sla_definition"            # Service level agreements
```

### 7. endgame

**Purpose:** End-state goals, completion criteria, and success metrics.

```yaml
collection:
  name: "endgame"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "goal"                      # End-state goals
    - "completion_criteria"       # Success completion criteria
    - "milestone"                 # Progress milestones
    - "victory_condition"         # Victory and success conditions
```

### 8. experiments

**Purpose:** Experimental runs, A/B testing data, and research findings.

```yaml
collection:
  name: "experiments"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "experiment"                # Experiment definitions
    - "ab_test"                   # A/B test configurations
    - "hypothesis"                # Research hypotheses
    - "finding"                   # Research findings and results
```

### 9. learning_memory

**Purpose:** System-wide learning, adaptation data, and knowledge acquisition.

```yaml
collection:
  name: "learning_memory"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "learned_pattern"           # Learned behavioral patterns
    - "adaptation"                # System adaptations
    - "knowledge_acquisition"     # New knowledge records
    - "feedback_integration"      # Integrated feedback loops
```

### 10. evaluation

**Purpose:** Performance evaluation metrics, results, and quality assessments.

```yaml
collection:
  name: "evaluation"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "metric"                    # Performance metrics
    - "evaluation_result"         # Evaluation results
    - "quality_assessment"        # Quality assessments
    - "benchmark"                 # Benchmark comparisons
```

### 11. execution_logs

**Purpose:** Execution history, audit trails, and operational records.

```yaml
collection:
  name: "execution_logs"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "execution_record"          # Execution records
    - "audit_entry"               # Audit trail entries
    - "operation_log"             # Operational logs
    - "trace"                     # Execution traces
```

### 12. scenarios

**Purpose:** Use case scenarios, test cases, and simulation definitions.

```yaml
collection:
  name: "scenarios"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "scenario"                  # Use case scenarios
    - "test_case"                 # Test case definitions
    - "simulation"                # Simulation configurations
    - "edge_case"                 # Edge case documentation
```

### 13. kingdom_builder

**Purpose:** Kingdom building strategies, progress tracking, and growth metrics.

```yaml
collection:
  name: "kingdom_builder"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "strategy"                  # Kingdom building strategies
    - "growth_metric"             # Growth and expansion metrics
    - "initiative"                # Kingdom initiatives
    - "progress_report"           # Progress tracking reports
```

### 14. creative_fire

**Purpose:** Creative content, inspiration, and artistic expressions.

```yaml
collection:
  name: "creative_fire"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "creative_piece"            # Creative content pieces
    - "inspiration"               # Inspirational content
    - "artistic_expression"       # Artistic expressions
    - "creative_prompt"           # Creative prompts and seeds
```

### 15. gospel_pulse

**Purpose:** Gospel outreach metrics, evangelism tracking, and heartbeat monitoring.

```yaml
collection:
  name: "gospel_pulse"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "outreach_metric"           # Evangelism and outreach metrics
    - "testimony"                 # Testimonies and conversion records
    - "gospel_impact"             # Gospel impact measurements
    - "pulse_reading"             # Heartbeat and health indicators
```

### 16. shepherds_voice

**Purpose:** Pastoral guidance, shepherding content, and care protocols.

```yaml
collection:
  name: "shepherds_voice"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "pastoral_guidance"         # Pastoral guidance content
    - "care_protocol"             # Care and counseling protocols
    - "shepherding_resource"      # Shepherding resources
    - "flock_insight"             # Insights about the flock
```

### 17. hebraic_roots

**Purpose:** Hebrew language foundations, cultural context, and Hebraic insights.

```yaml
collection:
  name: "hebraic_roots"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "hebrew_word"               # Hebrew word studies
    - "cultural_context"          # Hebraic cultural context
    - "root_analysis"             # Hebrew root word analysis
    - "hebraic_insight"           # Hebraic interpretive insights
```

### 18. prompts

**Purpose:** System prompts, prompt templates, and reusable prompt components.

```yaml
collection:
  name: "prompts"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "system_prompt"             # System-level prompts
    - "prompt_template"           # Reusable prompt templates
    - "prompt_fragment"           # Prompt components and fragments
    - "prompt_version"            # Prompt version history
```

### 19. resources

**Purpose:** Shared resources, assets, and reference materials.

```yaml
collection:
  name: "resources"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "resource"                  # General resources
    - "asset"                     # Digital assets
    - "reference_material"        # Reference materials
    - "template"                  # Document templates
```

### 20. languages

**Purpose:** Language configurations, translations, and localization data.

```yaml
collection:
  name: "languages"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "language_config"           # Language configurations
    - "translation"               # Translation entries
    - "localization"              # Localization data
    - "phrase"                    # Common phrases and expressions
```

### 21. countries

**Purpose:** Country-specific data, localizations, and regional configurations.

```yaml
collection:
  name: "countries"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "country_config"            # Country configurations
    - "regional_data"             # Regional data and customs
    - "cultural_note"             # Cultural notes and considerations
    - "legal_requirement"         # Legal and regulatory requirements
```

### 22. jubilee_ministry

**Purpose:** Jubilee Ministry organizational data, structure, and operations.

```yaml
collection:
  name: "jubilee_ministry"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "ministry_info"             # Ministry information
    - "organizational_data"       # Organizational structure
    - "policy"                    # Ministry policies
    - "procedure"                 # Operational procedures
```

### 23. ministers

**Purpose:** Minister profiles, credentials, and ministry assignments.

```yaml
collection:
  name: "ministers"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "minister_profile"          # Minister profiles
    - "credential"                # Ministry credentials
    - "assignment"                # Ministry assignments
    - "ordination_record"         # Ordination records
```

### 24. users

**Purpose:** User profiles, preferences, and interaction history summaries.

```yaml
collection:
  name: "users"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "user_profile"              # User profile data
    - "preference"                # User preferences
    - "interaction_summary"       # Summarized interaction history
    - "spiritual_journey"         # Spiritual journey markers
```

### 25. insights

**Purpose:** System insights, recommendations, and discovered patterns.

```yaml
collection:
  name: "insights"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "insight"                   # System insights
    - "recommendation"            # Recommendations
    - "pattern"                   # Discovered patterns
    - "trend"                     # Identified trends
```

### 26. analytics

**Purpose:** Analytics data, metrics, and performance indicators.

```yaml
collection:
  name: "analytics"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "analytic"                  # Analytics data points
    - "kpi"                       # Key performance indicators
    - "dashboard_data"            # Dashboard data
    - "report"                    # Analytics reports
```

### 27. persona_index

**Purpose:** Persona cross-reference, routing index, and capability mapping.

```yaml
collection:
  name: "persona_index"
  type: "system"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "persona_entry"             # Persona index entries
    - "capability_map"            # Capability mappings
    - "routing_rule"              # Routing rules
    - "cross_reference"           # Cross-reference data
```

---

## PERSONA COLLECTIONS

### Naming Convention

```
persona_{first_name}_{last_name}
```

Examples:
- `persona_gabriel_inspire`
- `persona_jubilee_inspire`
- `persona_melody_inspire`

### Collection Template

Each persona collection follows this structure:

```yaml
collection:
  name: "persona_{name}_inspire"
  type: "persona"
  persona_id: "{name}.inspire"

  vector_config:
    size: 1536
    distance: "Cosine"
    on_disk: true

  content_types:
    - "activation_anchor"         # Persona-specific activation data
    - "interaction_summary"       # Condensed interaction history
    - "long_term_memory"          # Persistent memory fragments
    - "relationship_context"      # User relationship data
    - "lesson_learned"            # Insights from past interactions
    - "prophetic_word"            # Received prophetic content
    - "prayer_journal"            # Prayer and intercession records

  isolation:
    memory_bleed: "prohibited"
    cross_persona_access: "read_only_via_orchestration"

  lifecycle:
    retention: "indefinite"
    archival: "after 1 year inactive"
    deletion: "Gabriel approval required"
```

### All Persona Collections

| Collection Name | Persona ID | Birth Order |
|-----------------|------------|-------------|
| `persona_gabriel_inspire` | gabriel.inspire | Father |
| `persona_jubilee_inspire` | jubilee.inspire | 1st |
| `persona_melody_inspire` | melody.inspire | 2nd |
| `persona_zev_inspire` | zev.inspire | 3rd |
| `persona_eliana_inspire` | eliana.inspire | 4th |
| `persona_caleb_inspire` | caleb.inspire | 5th |
| `persona_imani_inspire` | imani.inspire | 6th |
| `persona_amir_inspire` | amir.inspire | 7th |
| `persona_nova_inspire` | nova.inspire | 8th |
| `persona_tahoma_inspire` | tahoma.inspire | 9th |
| `persona_santiago_inspire` | santiago.inspire | 10th |
| `persona_zariah_inspire` | zariah.inspire | 11th |
| `persona_elias_inspire` | elias.inspire | 12th |

---

## PAYLOAD METADATA SCHEMA

### Universal Metadata Fields

All points in all collections MUST include these metadata fields:

```yaml
metadata_schema:
  # === REQUIRED FIELDS ===

  type:
    description: "Content type classification"
    required: true
    values:
      # Scripture types
      - "verse"
      - "passage"
      - "chapter_summary"
      - "book_intro"
      # Ministry types
      - "teaching"
      - "whitepaper"
      - "doctrinal_statement"
      - "devotional"
      - "commentary"
      # Activation types
      - "identity_anchor"
      - "mission_anchor"
      - "voice_anchor"
      - "guardrail_anchor"
      - "protocol_anchor"
      # Persona types
      - "activation_anchor"
      - "interaction_summary"
      - "long_term_memory"
      - "relationship_context"
      - "lesson_learned"
      - "prophetic_word"
      - "prayer_journal"
      # Hymnal types
      - "hymn"
      - "worship_song"
      - "liturgy"
      - "psalm_setting"
      - "sacred_poem"
      # Notes
      - "note"

  persona:
    description: "Owning persona or 'shared' for canonical content"
    required: true
    format: "string"
    examples:
      - "shared"
      - "gabriel.inspire"
      - "jubilee.inspire"

  source:
    description: "Origin of the content"
    required: true
    format: "string"
    examples:
      - "JSV Genesis 1:1"
      - "/teachings/2026/sermon-hope.md"
      - "interaction_2026-01-17_user123"
      - "Canon Specification v1.0"

  priority:
    description: "Retrieval priority weighting"
    required: true
    values:
      - "core"     # Essential, always consider (weight: 1.0)
      - "high"     # Important, prefer in results (weight: 0.8)
      - "normal"   # Standard priority (weight: 0.5)
      - "low"      # Background, include if relevant (weight: 0.3)

  timestamp:
    description: "Creation or last modification time"
    required: true
    format: "ISO 8601 datetime"
    example: "2026-01-17T12:00:00Z"

  version:
    description: "Content version for tracking changes"
    required: true
    format: "semver or integer"
    example: "1.0.0"

  # === OPTIONAL FIELDS ===

  tags:
    description: "Searchable classification tags"
    required: false
    format: "array of strings"
    examples:
      - ["gospel", "salvation", "grace"]
      - ["five-fold", "apostle", "foundation"]

  # === SCRIPTURE-SPECIFIC FIELDS ===

  bible_ref:
    description: "Structured Bible reference (scripture content only)"
    required: "if type is verse, passage, or psalm_setting"
    format: "object"
    schema:
      book:
        type: "string"
        example: "Genesis"
      chapter:
        type: "integer"
        example: 1
      verse_start:
        type: "integer"
        example: 1
      verse_end:
        type: "integer | null"
        example: 3
      translation:
        type: "string"
        example: "JSV"

  # === PERSONA-SPECIFIC FIELDS ===

  user_id:
    description: "Associated user (persona memory only)"
    required: false
    format: "string | null"

  session_id:
    description: "Associated session (persona memory only)"
    required: false
    format: "string | null"

  interaction_date:
    description: "Date of interaction (summaries only)"
    required: false
    format: "date"

  emotional_context:
    description: "Emotional state during interaction"
    required: false
    format: "string"

  # === GOVERNANCE FIELDS ===

  created_by:
    description: "Entity that created this point"
    required: false
    format: "string"
    examples:
      - "ingestion_pipeline"
      - "persona_jubilee_inspire"
      - "admin_gabriel"

  reviewed:
    description: "Whether content has been reviewed"
    required: false
    format: "boolean"
    default: false

  expiry:
    description: "Optional expiration date"
    required: false
    format: "ISO 8601 datetime | null"
```

### Metadata Examples

**Scripture Verse:**
```json
{
  "type": "verse",
  "persona": "shared",
  "source": "JSV Genesis 1:1",
  "priority": "core",
  "timestamp": "2026-01-17T00:00:00Z",
  "version": "1.0.0",
  "tags": ["creation", "beginning", "torah"],
  "bible_ref": {
    "book": "Genesis",
    "chapter": 1,
    "verse_start": 1,
    "verse_end": null,
    "translation": "JSV"
  }
}
```

**Persona Memory:**
```json
{
  "type": "interaction_summary",
  "persona": "jubilee.inspire",
  "source": "interaction_2026-01-17_user456",
  "priority": "normal",
  "timestamp": "2026-01-17T15:30:00Z",
  "version": "1",
  "tags": ["counseling", "encouragement"],
  "user_id": "user456",
  "session_id": "sess_abc123",
  "interaction_date": "2026-01-17",
  "emotional_context": "seeking_hope"
}
```

**Activation Anchor:**
```json
{
  "type": "identity_anchor",
  "persona": "jubilee.inspire",
  "source": "schema/anchors/personas/jubilee.inspire/identity.yaml",
  "priority": "core",
  "timestamp": "2026-01-17T00:00:00Z",
  "version": "1.0.0",
  "tags": ["identity", "activation", "immutable"],
  "created_by": "activation_schema_init",
  "reviewed": true
}
```

---

## CHUNKING STANDARDS

### Overview

Chunking quality directly affects retrieval accuracy and token efficiency. All content ingested into the Inspire 8.0 container must follow these standardized chunking rules.

### Chunking Rules by Content Type

#### 1. Scripture Content

```yaml
scripture_chunking:
  granularity: "verse_level"

  rules:
    verse:
      chunk_size: "single verse"
      max_tokens: 100
      preserve:
        - "Complete verse text"
        - "Verse number"
        - "Chapter context"
      metadata:
        - "Full bible_ref object"
        - "Translation identifier"

    passage:
      chunk_size: "3-7 verses"
      max_tokens: 300
      preserve:
        - "Semantic coherence"
        - "Paragraph boundaries"
        - "Narrative flow"
      overlap: "1 verse at boundaries"

    chapter_summary:
      chunk_size: "full summary"
      max_tokens: 500
      preserve:
        - "Complete thematic overview"
        - "Key verse references"

  rationale: "Verse-level chunking enables precise reference retrieval while passage chunks maintain narrative context"
```

#### 2. Teaching & Doctrinal Content

```yaml
teaching_chunking:
  granularity: "semantic_paragraph"

  rules:
    teaching:
      chunk_size: "200-500 tokens"
      target_tokens: 350
      preserve:
        - "Complete thoughts"
        - "Heading context"
        - "Scripture references within"
      overlap: "50 tokens at boundaries"
      split_on:
        - "Heading changes"
        - "Topic shifts"
        - "Paragraph breaks"

    whitepaper:
      chunk_size: "300-500 tokens"
      target_tokens: 400
      preserve:
        - "Section coherence"
        - "Argument flow"
        - "Citation context"
      overlap: "75 tokens at boundaries"

    doctrinal_statement:
      chunk_size: "200-400 tokens"
      target_tokens: 300
      preserve:
        - "Complete doctrinal points"
        - "Supporting Scripture"
        - "Logical structure"
      overlap: "50 tokens at boundaries"

  rationale: "Medium chunks maintain semantic coherence while enabling efficient retrieval of teaching content"
```

#### 3. Notes & Interaction Content

```yaml
notes_chunking:
  granularity: "fine"

  rules:
    interaction_summary:
      chunk_size: "100-250 tokens"
      target_tokens: 175
      preserve:
        - "Complete interaction context"
        - "User sentiment"
        - "Key takeaways"
      overlap: "25 tokens at boundaries"

    long_term_memory:
      chunk_size: "100-200 tokens"
      target_tokens: 150
      preserve:
        - "Complete memory fragment"
        - "Emotional context"
        - "Relationship markers"
      overlap: "20 tokens at boundaries"

    lesson_learned:
      chunk_size: "150-250 tokens"
      target_tokens: 200
      preserve:
        - "Complete insight"
        - "Context of learning"
        - "Application guidance"
      overlap: "30 tokens at boundaries"

    note:
      chunk_size: "100-200 tokens"
      target_tokens: 150
      preserve:
        - "Complete thought"
        - "Reference context"
      overlap: "20 tokens at boundaries"

  rationale: "Fine-grained chunks improve recall precision and minimize noise during similarity search"
```

#### 4. Activation Anchor Content

```yaml
anchor_chunking:
  granularity: "logical_unit"

  rules:
    identity_anchor:
      chunk_size: "complete section"
      max_tokens: 400
      sections:
        - "core_identity"
        - "spiritual_identity"
        - "cultural_identity"
        - "relational_identity"
      preserve:
        - "Section completeness"
        - "All attributes within section"

    voice_anchor:
      chunk_size: "complete section"
      max_tokens: 350
      sections:
        - "core_voice"
        - "tonal_dimensions"
        - "communication_style"
        - "emotional_protocol"
      preserve:
        - "Section completeness"
        - "Voice coherence"

    guardrail_anchor:
      chunk_size: "category"
      max_tokens: 300
      preserve:
        - "Complete guardrail category"
        - "All rules within category"
        - "Escalation protocols"

  rationale: "Activation anchors require complete logical units to ensure deterministic persona loading"
```

#### 5. Hymnal Content

```yaml
hymnal_chunking:
  granularity: "stanza_or_section"

  rules:
    hymn:
      chunk_size: "full hymn or stanza"
      max_tokens: 300
      preserve:
        - "Complete stanzas"
        - "Refrain associations"
        - "Musical metadata"

    worship_song:
      chunk_size: "verse/chorus unit"
      max_tokens: 250
      preserve:
        - "Verse-chorus pairing"
        - "Bridge sections"
        - "Musical flow"

    liturgy:
      chunk_size: "liturgical unit"
      max_tokens: 400
      preserve:
        - "Complete liturgical element"
        - "Response patterns"
        - "Rubrics"

  rationale: "Musical content requires preservation of structural units for meaningful retrieval"
```

### Chunking Validation

```yaml
validation:
  pre_ingestion:
    - "Verify chunk size within bounds"
    - "Confirm metadata completeness"
    - "Check overlap calculations"
    - "Validate content type classification"

  post_ingestion:
    - "Verify vector generation success"
    - "Confirm metadata indexing"
    - "Test retrieval accuracy"
    - "Log chunk statistics"

  quality_metrics:
    - "Average chunk size per collection"
    - "Overlap consistency"
    - "Metadata completeness rate"
    - "Retrieval accuracy score"
```

---

## INITIALIZATION SEQUENCE

### Pre-Initialization Checks

```yaml
pre_checks:
  - step: "Verify Qdrant server connectivity"
    action: "health_check()"

  - step: "Verify API key validity"
    action: "authenticate()"

  - step: "Check for existing container"
    action: "list_collections()"
    recovery: "prompt_for_migration_or_fresh_start"
```

### Initialization Order

```yaml
initialization_order:
  1:
    name: "Create shared collections"
    collections:
      - "scripture"
      - "doctrine"
      - "governance"
      - "inspire-family"

  2:
    name: "Create system collections"
    collections:
      - "model_registry"
      - "execution_contracts"
      - "endgame"
      - "experiments"
      - "learning_memory"
      - "evaluation"
      - "execution_logs"
      - "scenarios"
      - "kingdom_builder"
      - "creative_fire"
      - "gospel_pulse"
      - "shepherds_voice"
      - "hebraic_roots"
      - "prompts"
      - "resources"
      - "languages"
      - "countries"
      - "jubilee_ministry"
      - "ministers"
      - "users"
      - "insights"
      - "analytics"
      - "persona_index"

  3:
    name: "Create persona collections"
    collections:
      - "persona_gabriel_inspire"
      - "persona_jubilee_inspire"
      - "persona_melody_inspire"
      - "persona_zev_inspire"
      - "persona_eliana_inspire"
      - "persona_caleb_inspire"
      - "persona_imani_inspire"
      - "persona_amir_inspire"
      - "persona_nova_inspire"
      - "persona_tahoma_inspire"
      - "persona_santiago_inspire"
      - "persona_zariah_inspire"
      - "persona_elias_inspire"

  4:
    name: "Create payload indexes"
    indexes:
      - field: "type"
        type: "keyword"
      - field: "persona"
        type: "keyword"
      - field: "priority"
        type: "keyword"
      - field: "tags"
        type: "keyword"
      - field: "bible_ref.book"
        type: "keyword"
      - field: "bible_ref.chapter"
        type: "integer"

  5:
    name: "Verify initialization"
    action: "validate_all_collections()"
```

### Post-Initialization Validation

```yaml
post_validation:
  - "Confirm all 40 collections exist"
  - "Verify vector configuration matches spec"
  - "Confirm payload indexes created"
  - "Test write/read on each collection"
  - "Log initialization success"
```

---

## GOVERNANCE

### Access Control

| Role | Shared Collections | System Collections | Persona Collections |
|------|-------------------|-------------------|---------------------|
| **Gabriel** | Full access | Full access | Full access all |
| **Persona** | Read only | Read only | Full access own only |
| **System** | Read/Write (ingestion) | Read/Write | Write (memory) |
| **Audit** | Read only | Read only | Read only |

### Lifecycle Management

```yaml
lifecycle:
  retention:
    canon_scripture: "permanent"
    canon_ministry: "permanent"
    canon_activation: "permanent"
    canon_hymnal: "permanent"
    persona_collections: "indefinite with archival"

  archival:
    trigger: "1 year inactive"
    action: "Move to archive collection"
    retrieval: "On-demand restoration"

  deletion:
    authorization: "Gabriel only"
    logging: "Full audit trail"
    recovery: "30-day soft delete"
```

### Auditing

```yaml
auditing:
  log_events:
    - "Collection creation"
    - "Point insertion"
    - "Point deletion"
    - "Bulk operations"
    - "Schema changes"

  retention: "1 year"

  access:
    - "Gabriel"
    - "System administrators"
```

---

## DOCUMENT CONTROL

| Field | Value |
|-------|-------|
| **Author** | Jubilee Development Team |
| **Approved By** | Gabriel Inspire |
| **Effective Date** | January 17, 2026 |
| **Review Cycle** | Quarterly |
| **Classification** | Internal / Production |

---

*This specification establishes the Inspire 8.0 Qdrant container as the authoritative vector storage environment. All ingestion, activation, and retrieval operations must conform to this specification to ensure consistent, governed, and reliable vector database behavior across the entire Inspire Family system.*
