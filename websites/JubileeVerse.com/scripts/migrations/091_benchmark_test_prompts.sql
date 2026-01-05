-- Migration: Add test prompts for each Benchmark Criterion
-- These prompts can be used to evaluate Bible verses against each criterion

-- Update existing criteria items to add test prompts in content_json field
-- Each item will have both description (content) and test_prompt (content_json)

DO $$
DECLARE
  benchmark_cat_id UUID;
  scripture_coll_id UUID;
BEGIN
  -- Get the Scripture collection ID
  SELECT id INTO scripture_coll_id FROM collections WHERE slug = 'scripture-jubilee-bible';

  -- Get the Benchmark Criteria category ID
  SELECT cc.id INTO benchmark_cat_id
  FROM collection_categories cc
  JOIN collections c ON c.id = cc.collection_id
  WHERE c.slug = 'scripture-jubilee-bible'
    AND cc.slug = 'benchmark_criteria';

  -- 1. Hebraic Worldview & Covenant Fidelity
  UPDATE category_items SET content_json = '{
  "test_prompt": "Analyze this Bible verse translation for Hebraic Worldview & Covenant Fidelity.\n\nVerse: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\nEvaluate on a scale of 1-10 based on:\n1. Does it preserve covenant-centered theology?\n2. Does it maintain concepts of corporate identity and community?\n3. Does it reflect the relational nature of YAHUAH with His people?\n4. Does it preserve Torah-positive framing?\n5. Does it avoid imposing Western individualistic concepts?\n\nProvide:\n- Score (1-10)\n- Strengths identified\n- Weaknesses identified\n- Specific Hebrew concepts preserved or lost\n- Recommendations for improvement",
  "scoring_guide": {
    "1-3": "Poor - Significantly obscures Hebraic worldview, imposes foreign concepts",
    "4-5": "Below Average - Some Hebraic elements preserved but notable losses",
    "6-7": "Average - Adequate preservation with room for improvement",
    "8-9": "Good - Strong Hebraic worldview preservation with minor issues",
    "10": "Excellent - Fully preserves Hebraic covenant-centered theology"
  },
  "key_indicators": ["covenant language", "corporate identity", "Torah references", "relational terminology", "Hebraic idioms"]
}'::jsonb
WHERE slug = 'hebraic_worldview_covenant_fidelity' AND category_id = benchmark_cat_id;

-- 2. Accuracy to Original Languages
UPDATE category_items SET content_json = '{
  "test_prompt": "Analyze this Bible verse translation for Accuracy to Original Languages.\n\nVerse: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\nEvaluate on a scale of 1-10 based on:\n1. Fidelity to Hebrew/Aramaic/Greek source text\n2. Accuracy of vocabulary translation\n3. Preservation of grammatical structures where meaningful\n4. Handling of difficult or ambiguous terms\n5. Consistency with best manuscript evidence\n\nProvide:\n- Score (1-10)\n- Key Hebrew/Greek terms and their handling\n- Translation choices that enhance or diminish accuracy\n- Comparison with literal rendering\n- Notable departures from source text",
  "scoring_guide": {
    "1-3": "Poor - Significant mistranslations or paraphrasing that loses meaning",
    "4-5": "Below Average - Some accuracy issues affecting interpretation",
    "6-7": "Average - Generally accurate with some interpretive liberties",
    "8-9": "Good - High accuracy with appropriate handling of difficult terms",
    "10": "Excellent - Precise rendering faithful to original languages"
  },
  "key_indicators": ["word-for-word accuracy", "grammar preservation", "idiom handling", "textual basis", "translation philosophy"]
}'::jsonb
WHERE slug = 'accuracy_original_languages' AND category_id = benchmark_cat_id;

-- 3. Early Church (Acts-Based) Alignment
UPDATE category_items SET content_json = '{
  "test_prompt": "Analyze this Bible verse translation for Early Church (Acts-Based) Alignment.\n\nVerse: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\nEvaluate on a scale of 1-10 based on:\n1. Compatibility with apostolic church theology from Acts\n2. Support for Jewish roots of the faith\n3. Alignment with Spirit-led community practices\n4. Preservation of continuity with Torah observance\n5. Reflection of first-century believing community values\n\nProvide:\n- Score (1-10)\n- How this translation would be understood by Acts-era believers\n- Elements that support or contradict early church practice\n- Theological implications for understanding the apostolic faith\n- Alignment with Jerusalem Council decisions (Acts 15)",
  "scoring_guide": {
    "1-3": "Poor - Translation contradicts or obscures early church theology",
    "4-5": "Below Average - Some disconnect from apostolic understanding",
    "6-7": "Average - Neutral, neither strongly supports nor contradicts",
    "8-9": "Good - Well-aligned with early church reading",
    "10": "Excellent - Perfectly reflects apostolic church understanding"
  },
  "key_indicators": ["apostolic terminology", "Jewish context", "Spirit references", "community language", "Torah continuity"]
}'::jsonb
WHERE slug = 'early_church_alignment' AND category_id = benchmark_cat_id;

-- 4. Covenant & Kingdom Terminology Fidelity
UPDATE category_items SET content_json = '{
  "test_prompt": "Analyze this Bible verse translation for Covenant & Kingdom Terminology Fidelity.\n\nVerse: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\nEvaluate on a scale of 1-10 based on:\n1. Accuracy of covenant terms (berith, chesed, emunah)\n2. Kingdom vocabulary preservation (malkuth, memshalah)\n3. Theological weight of translated terms\n4. Consistency with covenant theology framework\n5. Avoidance of terms that diminish covenant significance\n\nProvide:\n- Score (1-10)\n- Covenant/Kingdom terms present and how rendered\n- Theological implications of word choices\n- Alternative translations that would be more faithful\n- Impact on covenant theology understanding",
  "scoring_guide": {
    "1-3": "Poor - Key covenant terms lost or mistranslated",
    "4-5": "Below Average - Some covenant language weakened",
    "6-7": "Average - Acceptable but could be strengthened",
    "8-9": "Good - Strong covenant terminology with minor gaps",
    "10": "Excellent - Full preservation of covenant and kingdom language"
  },
  "key_indicators": ["berith/covenant", "chesed/lovingkindness", "malkuth/kingdom", "emunah/faithfulness", "oath language"]
}'::jsonb
WHERE slug = 'covenant_kingdom_terminology' AND category_id = benchmark_cat_id;

-- 5. Sacred Names & Divine Title Integrity
UPDATE category_items SET content_json = '{
  "test_prompt": "Analyze this Bible verse translation for Sacred Names & Divine Title Integrity.\n\nVerse: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\nEvaluate on a scale of 1-10 based on:\n1. Handling of YHWH (Tetragrammaton)\n2. Distinction between names and titles (Elohim, Adonai, El Shaddai)\n3. Reverence preserved in divine nomenclature\n4. Consistency in rendering divine names\n5. Accuracy of Messianic titles (Mashiach, Ben Elohim)\n\nProvide:\n- Score (1-10)\n- Divine names/titles present and how rendered\n- Whether YHWH is distinguished from Adonai\n- Impact on theology of the Name\n- Recommendations for sacred name handling",
  "scoring_guide": {
    "1-3": "Poor - Divine names obscured or incorrectly rendered",
    "4-5": "Below Average - Inconsistent or generic name handling",
    "6-7": "Average - Standard LORD/God rendering without distinction",
    "8-9": "Good - Clear distinction with appropriate reverence",
    "10": "Excellent - Full preservation of sacred names with proper distinction"
  },
  "key_indicators": ["YHWH rendering", "Elohim vs El", "Adonai distinction", "title consistency", "Messianic names"]
}'::jsonb
WHERE slug = 'sacred_names_divine_titles' AND category_id = benchmark_cat_id;

-- 6. Proper Hebraic Ever-Present Tense Fidelity
UPDATE category_items SET content_json = '{
  "test_prompt": "Analyze this Bible verse translation for Proper Hebraic Ever-Present Tense Fidelity.\n\nVerse: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\nEvaluate on a scale of 1-10 based on:\n1. Handling of Hebrew verbal aspects (perfect, imperfect)\n2. Preservation of prophetic perfect tense\n3. Rendering of eternal present in divine declarations\n4. Timeless quality of covenantal statements\n5. Avoidance of forcing Western time concepts\n\nProvide:\n- Score (1-10)\n- Hebrew verb forms present and their rendering\n- Whether timeless/eternal quality is preserved\n- Impact on prophetic interpretation\n- Examples of tense choices and their implications",
  "scoring_guide": {
    "1-3": "Poor - Hebrew verbal aspects lost, forced into rigid tenses",
    "4-5": "Below Average - Some aspectual meaning lost",
    "6-7": "Average - Standard English tense rendering",
    "8-9": "Good - Thoughtful handling of Hebrew aspects",
    "10": "Excellent - Full preservation of Hebraic verbal nuance"
  },
  "key_indicators": ["prophetic perfect", "eternal present", "aspectual meaning", "timeless declarations", "verbal nuance"]
}'::jsonb
WHERE slug = 'hebraic_tense_fidelity' AND category_id = benchmark_cat_id;

-- 7. Modern English Clarity
UPDATE category_items SET content_json = '{
  "test_prompt": "Analyze this Bible verse translation for Modern English Clarity.\n\nVerse: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\nEvaluate on a scale of 1-10 based on:\n1. Readability for contemporary English speakers\n2. Natural sentence flow and structure\n3. Vocabulary accessibility without dumbing down\n4. Clarity of meaning on first reading\n5. Dignity of expression maintained\n\nProvide:\n- Score (1-10)\n- Reading level assessment\n- Phrases that aid or hinder comprehension\n- Balance between accuracy and readability\n- Suggestions for improved clarity without losing meaning",
  "scoring_guide": {
    "1-3": "Poor - Difficult to understand, awkward phrasing",
    "4-5": "Below Average - Requires multiple readings to grasp",
    "6-7": "Average - Understandable but could be clearer",
    "8-9": "Good - Clear and readable while maintaining accuracy",
    "10": "Excellent - Crystal clear, dignified, immediately understood"
  },
  "key_indicators": ["readability score", "sentence flow", "vocabulary level", "first-read comprehension", "natural expression"]
}'::jsonb
WHERE slug = 'modern_english_clarity' AND category_id = benchmark_cat_id;

-- 8. Avoidance of Archaic / Obscure Language
UPDATE category_items SET content_json = '{
  "test_prompt": "Analyze this Bible verse translation for Avoidance of Archaic/Obscure Language.\n\nVerse: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\nEvaluate on a scale of 1-10 based on:\n1. Freedom from archaic pronouns (thee, thou, ye)\n2. Absence of obsolete vocabulary\n3. Avoidance of unnecessarily obscure terms\n4. Modern equivalents used where appropriate\n5. Balance between contemporary language and biblical dignity\n\nProvide:\n- Score (1-10)\n- List of any archaic or obscure terms found\n- Whether archaic language serves a purpose or hinders\n- Modern alternatives that could be used\n- Overall accessibility assessment",
  "scoring_guide": {
    "1-3": "Poor - Heavily archaic, requires dictionary",
    "4-5": "Below Average - Several archaic terms that hinder understanding",
    "6-7": "Average - Mostly modern with occasional older terms",
    "8-9": "Good - Contemporary language with appropriate biblical dignity",
    "10": "Excellent - Fully accessible modern English throughout"
  },
  "key_indicators": ["archaic pronouns", "obsolete words", "Elizabethan forms", "accessibility", "contemporary vocabulary"]
}'::jsonb
WHERE slug = 'avoidance_archaic_language' AND category_id = benchmark_cat_id;

-- 9. Doctrinal Stability Under Pressure
UPDATE category_items SET content_json = '{
  "test_prompt": "Analyze this Bible verse translation for Doctrinal Stability Under Pressure.\n\nVerse: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\nEvaluate on a scale of 1-10 based on:\n1. Resistance to cultural pressure in word choices\n2. Maintenance of difficult or countercultural truths\n3. Avoidance of politically-motivated softening\n4. Preservation of challenging doctrinal content\n5. Integrity when facing controversial passages\n\nProvide:\n- Score (1-10)\n- Identification of potentially controversial content\n- How the translation handles sensitive material\n- Evidence of doctrinal compromise or faithfulness\n- Comparison with known pressure points in translation",
  "scoring_guide": {
    "1-3": "Poor - Clear evidence of doctrinal compromise",
    "4-5": "Below Average - Some softening of difficult truths",
    "6-7": "Average - Generally stable but some accommodation",
    "8-9": "Good - Strong doctrinal integrity with minor concerns",
    "10": "Excellent - Unwavering faithfulness to difficult truths"
  },
  "key_indicators": ["controversial passages", "cultural accommodation", "doctrinal clarity", "truth preservation", "countercultural content"]
}'::jsonb
WHERE slug = 'doctrinal_stability' AND category_id = benchmark_cat_id;

-- 10. Resistance to Replacement Theology
UPDATE category_items SET content_json = '{
  "test_prompt": "Analyze this Bible verse translation for Resistance to Replacement Theology.\n\nVerse: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\nEvaluate on a scale of 1-10 based on:\n1. Preservation of Israel''s ongoing covenant role\n2. Avoidance of supersessionist language\n3. Support for grafting-in theology (Romans 9-11)\n4. Distinction between Israel and the Church maintained\n5. Jewish identity of biblical figures preserved\n\nProvide:\n- Score (1-10)\n- Identification of Israel/Church related content\n- Whether translation choices support or undermine Israel''s role\n- Supersessionist implications of word choices\n- Alignment with Paul''s olive tree teaching",
  "scoring_guide": {
    "1-3": "Poor - Promotes replacement theology",
    "4-5": "Below Average - Some supersessionist implications",
    "6-7": "Average - Neutral on Israel''s ongoing role",
    "8-9": "Good - Supports Israel''s covenant position",
    "10": "Excellent - Clearly preserves Israel''s irrevocable calling"
  },
  "key_indicators": ["Israel references", "Church/Israel distinction", "covenant continuity", "Jewish identity", "grafting language"]
}'::jsonb
WHERE slug = 'resistance_replacement_theology' AND category_id = benchmark_cat_id;

-- 11. Faithfulness to Jewish Cultural Context
UPDATE category_items SET content_json = '{
  "test_prompt": "Analyze this Bible verse translation for Faithfulness to Jewish Cultural Context.\n\nVerse: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\nEvaluate on a scale of 1-10 based on:\n1. Preservation of Jewish feast and festival references\n2. Retention of Hebrew customs and practices\n3. Accurate rendering of Jewish idioms\n4. Cultural context clues maintained\n5. Avoidance of anachronistic interpretations\n\nProvide:\n- Score (1-10)\n- Jewish cultural elements present in the verse\n- How cultural references are handled\n- Whether context aids or hinders understanding\n- Suggestions for better cultural preservation",
  "scoring_guide": {
    "1-3": "Poor - Jewish cultural context lost or obscured",
    "4-5": "Below Average - Some cultural elements missing",
    "6-7": "Average - Basic cultural context preserved",
    "8-9": "Good - Rich cultural context maintained",
    "10": "Excellent - Full Jewish cultural immersion preserved"
  },
  "key_indicators": ["feast references", "customs", "idioms", "practices", "cultural markers"]
}'::jsonb
WHERE slug = 'jewish_cultural_context' AND category_id = benchmark_cat_id;

-- 12. Precision of Key Covenant Terms
UPDATE category_items SET content_json = '{
  "test_prompt": "Analyze this Bible verse translation for Precision of Key Covenant Terms.\n\nVerse: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\nEvaluate on a scale of 1-10 based on:\n1. Accuracy of ''torah'' (instruction vs law)\n2. Rendering of ''emunah'' (faithfulness)\n3. Translation of ''tzedakah'' (righteousness)\n4. Handling of ''shalom'' (peace/wholeness/completeness)\n5. Consistency of key term translation\n\nProvide:\n- Score (1-10)\n- Key covenant terms present and their rendering\n- Whether nuanced meanings are preserved\n- Impact of word choices on theology\n- Better alternatives where applicable",
  "scoring_guide": {
    "1-3": "Poor - Key terms mistranslated or flattened",
    "4-5": "Below Average - Some nuance lost in translation",
    "6-7": "Average - Standard rendering without special care",
    "8-9": "Good - Careful attention to covenant vocabulary",
    "10": "Excellent - Full precision in all covenant terms"
  },
  "key_indicators": ["torah rendering", "chesed translation", "emunah handling", "tzedakah accuracy", "shalom completeness"]
}'::jsonb
WHERE slug = 'precision_covenant_terms' AND category_id = benchmark_cat_id;

-- 13. Law-Grace Integration Accuracy
UPDATE category_items SET content_json = '{
  "test_prompt": "Analyze this Bible verse translation for Law-Grace Integration Accuracy.\n\nVerse: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\nEvaluate on a scale of 1-10 based on:\n1. Balance between Torah and grace presentation\n2. Avoidance of false law/grace dichotomy\n3. Support for biblical unity of instruction and mercy\n4. Resistance to antinomian implications\n5. Proper rendering of ''nomos'' and related terms\n\nProvide:\n- Score (1-10)\n- Law/grace related content identified\n- Whether translation creates or avoids false dichotomy\n- Theological implications of word choices\n- How Paul''s teaching would be understood from this translation",
  "scoring_guide": {
    "1-3": "Poor - Creates false law/grace opposition",
    "4-5": "Below Average - Some antinomian implications",
    "6-7": "Average - Neutral on law-grace relationship",
    "8-9": "Good - Supports unity of Torah and grace",
    "10": "Excellent - Perfect integration of law and grace"
  },
  "key_indicators": ["nomos rendering", "grace terminology", "works language", "faith expressions", "Torah positivity"]
}'::jsonb
WHERE slug = 'law_grace_integration' AND category_id = benchmark_cat_id;

-- 14. Risk of Misinterpretation (Score Inverted)
UPDATE category_items SET content_json = '{
  "test_prompt": "Analyze this Bible verse translation for Risk of Misinterpretation.\n\nVerse: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\nEvaluate RISK on a scale of 1-10 (1=HIGH RISK, 10=LOW RISK) based on:\n1. Clarity of difficult or ambiguous passages\n2. Avoidance of misleading word choices\n3. Handling of texts prone to misuse\n4. Context preservation that aids correct interpretation\n5. Safeguards against common misreadings\n\nProvide:\n- Risk Score (1-10, inverted: 10=lowest risk)\n- Potential misinterpretations this translation enables\n- Safeguards present in the translation\n- Comparison with problematic renderings\n- Recommendations for reducing misinterpretation risk",
  "scoring_guide": {
    "1-3": "HIGH RISK - Very likely to be misinterpreted",
    "4-5": "MODERATE-HIGH RISK - Several potential misreadings",
    "6-7": "MODERATE RISK - Some ambiguity present",
    "8-9": "LOW RISK - Clear with minor potential for confusion",
    "10": "MINIMAL RISK - Crystal clear, safeguarded against misuse"
  },
  "key_indicators": ["ambiguity level", "context clues", "common misreadings", "safeguard language", "clarity score"],
  "score_inverted": true
}'::jsonb
WHERE slug = 'risk_of_misinterpretation' AND category_id = benchmark_cat_id;

-- 15. Discipleship Suitability in Hebraic Frame
UPDATE category_items SET content_json = '{
  "test_prompt": "Analyze this Bible verse translation for Discipleship Suitability in Hebraic Frame.\n\nVerse: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\nEvaluate on a scale of 1-10 based on:\n1. Usefulness for Torah-observant discipleship teaching\n2. Support for Messiah-centered spiritual formation\n3. Memorability and quotability\n4. Application clarity for daily obedience\n5. Alignment with rabbi-talmid (teacher-disciple) model\n\nProvide:\n- Score (1-10)\n- How this translation serves discipleship purposes\n- Hebraic discipleship concepts preserved or lost\n- Practical application clarity\n- Effectiveness for teaching and training",
  "scoring_guide": {
    "1-3": "Poor - Unsuitable for Hebraic discipleship",
    "4-5": "Below Average - Limited discipleship utility",
    "6-7": "Average - Adequate for general teaching",
    "8-9": "Good - Strong discipleship tool",
    "10": "Excellent - Ideal for Torah-observant discipleship"
  },
  "key_indicators": ["teaching clarity", "obedience focus", "memorability", "application ease", "Hebraic formation"]
}'::jsonb
WHERE slug = 'discipleship_suitability' AND category_id = benchmark_cat_id;

-- 16. Narrative Coherence (Acts-Revelation)
UPDATE category_items SET content_json = '{
  "test_prompt": "Analyze this Bible verse translation for Narrative Coherence (Acts-Revelation).\n\nVerse: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\nEvaluate on a scale of 1-10 based on:\n1. Consistency with broader Acts-Revelation narrative\n2. Terminology alignment across New Testament books\n3. Thematic continuity preservation\n4. Story flow maintenance\n5. Character and community consistency\n\nProvide:\n- Score (1-10)\n- How this verse fits the larger narrative\n- Terminology consistency with parallel passages\n- Narrative threads supported or broken\n- Contribution to overall story coherence",
  "scoring_guide": {
    "1-3": "Poor - Disrupts narrative coherence",
    "4-5": "Below Average - Some narrative disconnect",
    "6-7": "Average - Adequate narrative fit",
    "8-9": "Good - Strong narrative continuity",
    "10": "Excellent - Perfect narrative coherence"
  },
  "key_indicators": ["terminology consistency", "theme continuity", "story flow", "character consistency", "cross-reference alignment"]
}'::jsonb
WHERE slug = 'narrative_coherence' AND category_id = benchmark_cat_id;

-- 17. Eschatological Clarity
UPDATE category_items SET content_json = '{
  "test_prompt": "Analyze this Bible verse translation for Eschatological Clarity.\n\nVerse: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\nEvaluate on a scale of 1-10 based on:\n1. Clarity of prophetic and end-times content\n2. Handling of apocalyptic language\n3. Preservation of future hope and promises\n4. Hebraic eschatological framework support\n5. Messiah''s return and kingdom clarity\n\nProvide:\n- Score (1-10)\n- Eschatological content present and its rendering\n- Clarity of prophetic elements\n- How translation affects end-times understanding\n- Alignment with Hebraic eschatology",
  "scoring_guide": {
    "1-3": "Poor - Eschatology obscured or confused",
    "4-5": "Below Average - Some prophetic clarity lost",
    "6-7": "Average - Standard eschatological rendering",
    "8-9": "Good - Clear prophetic content",
    "10": "Excellent - Crystal clear eschatological vision"
  },
  "key_indicators": ["prophetic clarity", "apocalyptic handling", "future hope", "kingdom references", "return of Messiah"]
}'::jsonb
WHERE slug = 'eschatological_clarity' AND category_id = benchmark_cat_id;

-- 18. Translation Consistency of Key Words
UPDATE category_items SET content_json = '{
  "test_prompt": "Analyze this Bible verse translation for Translation Consistency of Key Words.\n\nVerse: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\nEvaluate on a scale of 1-10 based on:\n1. Consistent rendering of repeated Hebrew/Greek terms\n2. Ability to trace word themes across Scripture\n3. Concordance usefulness\n4. Pattern recognition support\n5. Theological term stability\n\nProvide:\n- Score (1-10)\n- Key terms in this verse and their standard rendering\n- Consistency with how these terms appear elsewhere\n- Impact on word study and theme tracing\n- Recommendations for improved consistency",
  "scoring_guide": {
    "1-3": "Poor - Inconsistent, impossible to trace themes",
    "4-5": "Below Average - Significant inconsistencies",
    "6-7": "Average - Mostly consistent with some variation",
    "8-9": "Good - High consistency, easy theme tracing",
    "10": "Excellent - Perfect consistency throughout"
  },
  "key_indicators": ["term consistency", "concordance utility", "theme tracing", "pattern recognition", "vocabulary stability"]
}'::jsonb
WHERE slug = 'translation_consistency' AND category_id = benchmark_cat_id;

-- 19. Pastoral & Teaching Utility
UPDATE category_items SET content_json = '{
  "test_prompt": "Analyze this Bible verse translation for Pastoral & Teaching Utility.\n\nVerse: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\nEvaluate on a scale of 1-10 based on:\n1. Effectiveness for sermon exposition\n2. Memorization suitability\n3. Liturgical reading quality\n4. Congregational accessibility\n5. Teaching and explanation ease\n\nProvide:\n- Score (1-10)\n- Preaching and teaching strengths\n- Memorization potential\n- Public reading quality\n- Practical ministry utility assessment",
  "scoring_guide": {
    "1-3": "Poor - Difficult to use in ministry",
    "4-5": "Below Average - Limited pastoral utility",
    "6-7": "Average - Serviceable for ministry",
    "8-9": "Good - Strong ministry tool",
    "10": "Excellent - Ideal for all pastoral uses"
  },
  "key_indicators": ["preachability", "memorability", "liturgical quality", "congregational fit", "teaching clarity"]
}'::jsonb
WHERE slug = 'pastoral_teaching_utility' AND category_id = benchmark_cat_id;

-- 20. Doctrinal Drift Risk (Score Inverted)
UPDATE category_items SET content_json = '{
  "test_prompt": "Analyze this Bible verse translation for Doctrinal Drift Risk.\n\nVerse: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\nEvaluate RISK on a scale of 1-10 (1=HIGH RISK, 10=LOW RISK) based on:\n1. Translation philosophy stability indicators\n2. Resistance to progressive revision pressure\n3. Safeguards against ideological drift\n4. Historical track record of the translation\n5. Committee/publisher theological commitments\n\nProvide:\n- Risk Score (1-10, inverted: 10=lowest risk)\n- Indicators of drift vulnerability in this rendering\n- Safeguards present or absent\n- Historical drift patterns in this translation\n- Long-term reliability assessment",
  "scoring_guide": {
    "1-3": "HIGH RISK - Very vulnerable to doctrinal drift",
    "4-5": "MODERATE-HIGH RISK - Some drift vulnerability",
    "6-7": "MODERATE RISK - Average stability",
    "8-9": "LOW RISK - Strong resistance to drift",
    "10": "MINIMAL RISK - Highly stable, drift-resistant"
  },
  "key_indicators": ["translation philosophy", "revision history", "committee stability", "publisher commitment", "safeguard mechanisms"],
  "score_inverted": true
}'::jsonb
WHERE slug = 'doctrinal_drift_risk' AND category_id = benchmark_cat_id;

  -- Create a master evaluation prompt item
  INSERT INTO category_items (
      category_id, collection_id, slug, name, item_type, content, content_json, display_order, priority, is_active, version, created_at, updated_at
    )
    VALUES (
      benchmark_cat_id,
      scripture_coll_id,
  'master_benchmark_evaluation',
  'Master Benchmark Evaluation',
  'prompt',
  'Master prompt for comprehensive Bible verse benchmark evaluation across all 20 criteria.',
  '{
    "test_prompt": "COMPREHENSIVE BIBLE VERSE BENCHMARK EVALUATION\n\n=== VERSE UNDER EVALUATION ===\nVerse Text: {{verse_text}}\nReference: {{reference}}\nTranslation: {{translation}}\n\n=== EVALUATION INSTRUCTIONS ===\nEvaluate this verse translation against all 20 benchmark criteria. For each criterion, provide a score from 1-10 and brief justification.\n\nNote: Criteria 14 and 20 use INVERTED scoring (10 = lowest risk, 1 = highest risk).\n\n=== CRITERIA SCORES ===\n\n1. HEBRAIC WORLDVIEW & COVENANT FIDELITY\n   Score: [1-10]\n   Justification:\n\n2. ACCURACY TO ORIGINAL LANGUAGES\n   Score: [1-10]\n   Justification:\n\n3. EARLY CHURCH (ACTS-BASED) ALIGNMENT\n   Score: [1-10]\n   Justification:\n\n4. COVENANT & KINGDOM TERMINOLOGY FIDELITY\n   Score: [1-10]\n   Justification:\n\n5. SACRED NAMES & DIVINE TITLE INTEGRITY\n   Score: [1-10]\n   Justification:\n\n6. PROPER HEBRAIC EVER-PRESENT TENSE FIDELITY\n   Score: [1-10]\n   Justification:\n\n7. MODERN ENGLISH CLARITY\n   Score: [1-10]\n   Justification:\n\n8. AVOIDANCE OF ARCHAIC/OBSCURE LANGUAGE\n   Score: [1-10]\n   Justification:\n\n9. DOCTRINAL STABILITY UNDER PRESSURE\n   Score: [1-10]\n   Justification:\n\n10. RESISTANCE TO REPLACEMENT THEOLOGY\n    Score: [1-10]\n    Justification:\n\n11. FAITHFULNESS TO JEWISH CULTURAL CONTEXT\n    Score: [1-10]\n    Justification:\n\n12. PRECISION OF KEY COVENANT TERMS\n    Score: [1-10]\n    Justification:\n\n13. LAW-GRACE INTEGRATION ACCURACY\n    Score: [1-10]\n    Justification:\n\n14. RISK OF MISINTERPRETATION (INVERTED: 10=low risk)\n    Score: [1-10]\n    Justification:\n\n15. DISCIPLESHIP SUITABILITY IN HEBRAIC FRAME\n    Score: [1-10]\n    Justification:\n\n16. NARRATIVE COHERENCE (ACTS-REVELATION)\n    Score: [1-10]\n    Justification:\n\n17. ESCHATOLOGICAL CLARITY\n    Score: [1-10]\n    Justification:\n\n18. TRANSLATION CONSISTENCY OF KEY WORDS\n    Score: [1-10]\n    Justification:\n\n19. PASTORAL & TEACHING UTILITY\n    Score: [1-10]\n    Justification:\n\n20. DOCTRINAL DRIFT RISK (INVERTED: 10=low risk)\n    Score: [1-10]\n    Justification:\n\n=== SUMMARY ===\n\nTOTAL SCORE: [sum]/200\nPERCENTAGE: [percentage]%\nGRADE: [A/B/C/D/F based on percentage]\n\nTOP 3 STRENGTHS:\n1.\n2.\n3.\n\nTOP 3 AREAS FOR IMPROVEMENT:\n1.\n2.\n3.\n\nOVERALL ASSESSMENT:\n[2-3 sentence summary of translation quality for this verse]\n\nRECOMMENDATION:\n[Suitable for: study/devotional/liturgical/teaching/memorization]",
    "scoring_summary": {
      "total_possible": 200,
      "grade_scale": {
        "A": "180-200 (90-100%)",
        "B": "160-179 (80-89%)",
        "C": "140-159 (70-79%)",
        "D": "120-139 (60-69%)",
        "F": "Below 120 (<60%)"
      }
    },
    "inverted_criteria": [14, 20]
  }'::jsonb,
  0,
  1,
  true,
  1,
  NOW(),
  NOW()
  );
END $$;
