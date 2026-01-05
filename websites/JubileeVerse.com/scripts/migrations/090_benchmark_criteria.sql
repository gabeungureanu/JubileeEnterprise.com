-- Migration: Add Benchmark Criteria sub-category under Scripture | Translation Rules
-- Creates 20 benchmark criteria for evaluating Bible translations

-- First, create the Benchmark Criteria sub-category under Translation Rules in Scripture collection
DO $$
DECLARE
  scripture_coll_id UUID;
  translation_rules_cat_id UUID;
  benchmark_cat_id UUID;
BEGIN
  -- Get the Scripture collection ID
  SELECT id INTO scripture_coll_id FROM collections WHERE slug = 'scripture-jubilee-bible';

  -- Get the Translation Rules category ID
  SELECT id INTO translation_rules_cat_id FROM collection_categories
  WHERE collection_id = scripture_coll_id AND slug = 'Translation_Rules';

  -- Insert or update Benchmark Criteria category
  INSERT INTO collection_categories (
    collection_id, parent_category_id, slug, name, display_name, description,
    level, path, display_order, icon, icon_color, is_active, is_expandable, created_at, updated_at
  )
  VALUES (
    scripture_coll_id,
    translation_rules_cat_id,
    'benchmark_criteria',
    'Benchmark Criteria',
    'Benchmark Criteria',
    'Twenty criteria used to evaluate and benchmark Bible translations for doctrinal fidelity, linguistic accuracy, and pastoral utility.',
    1,
    '02.01',
    1,
    'checklist',
    '#FFD700',
    true,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (collection_id, slug) DO UPDATE SET
    name = EXCLUDED.name,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    updated_at = NOW()
  RETURNING id INTO benchmark_cat_id;

  -- Now insert the 20 benchmark criteria items
  INSERT INTO category_items (
    category_id, collection_id, slug, name, item_type, content, display_order, priority, is_active, version, created_at, updated_at
  )
  VALUES
    -- 1. Hebraic Worldview & Covenant Fidelity
    (
      benchmark_cat_id,
      scripture_coll_id,
    'hebraic_worldview_covenant_fidelity',
    'Hebraic Worldview & Covenant Fidelity',
    'reference',
    'Measures how well the translation preserves the Hebraic mindset and covenant-centered theology of Scripture. Evaluates retention of concepts like corporate identity, covenant faithfulness, Torah obedience, and the relational nature of YAHUAH with His people.',
    1, 1, true, 1, NOW(), NOW()
  ),
    -- 2. Accuracy to Original Languages
    (
      benchmark_cat_id,
      scripture_coll_id,
    'accuracy_original_languages',
    'Accuracy to Original Languages',
    'reference',
    'Assesses fidelity to Hebrew, Aramaic, and Greek source texts. Considers manuscript selection, textual criticism approach, and how faithfully the translation renders vocabulary, grammar, and syntax from the original languages.',
    2, 1, true, 1, NOW(), NOW()
  ),
  -- 3. Early Church (Acts-Based) Alignment
  (
      benchmark_cat_id,
      scripture_coll_id,
    'early_church_alignment',
    'Early Church (Acts-Based) Alignment',
    'reference',
    'Evaluates how well the translation supports the theology and practice of the early apostolic church as described in Acts. Considers alignment with Jewish roots, Spirit-led community, and the continuation of Torah observance among early believers.',
    3, 1, true, 1, NOW(), NOW()
  ),
  -- 4. Covenant & Kingdom Terminology Fidelity
  (
      benchmark_cat_id,
      scripture_coll_id,
    'covenant_kingdom_terminology',
    'Covenant & Kingdom Terminology Fidelity',
    'reference',
    'Measures accuracy in translating key covenant and kingdom terms such as berith (covenant), malkuth (kingdom), chesed (lovingkindness), and related concepts. Assesses whether the translation preserves the rich theological meaning of these foundational terms.',
    4, 1, true, 1, NOW(), NOW()
  ),
  -- 5. Sacred Names & Divine Title Integrity
  (
      benchmark_cat_id,
      scripture_coll_id,
    'sacred_names_divine_titles',
    'Sacred Names & Divine Title Integrity',
    'reference',
    'Evaluates the handling of divine names (YHWH, Elohim, Adonai) and titles. Considers whether the translation uses proper transliteration, maintains distinction between names and titles, and preserves the reverence and meaning of sacred nomenclature.',
    5, 1, true, 1, NOW(), NOW()
  ),
  -- 6. Proper Hebraic Ever-Present Tense Fidelity
  (
      benchmark_cat_id,
      scripture_coll_id,
    'hebraic_tense_fidelity',
    'Proper Hebraic Ever-Present Tense Fidelity',
    'reference',
    'Assesses how the translation handles Hebrew verbal aspects, particularly the concept of prophetic perfect and the eternal present nature of divine declarations. Evaluates preservation of the timeless quality of Hebrew verbs in prophetic and covenantal contexts.',
    6, 1, true, 1, NOW(), NOW()
  ),
  -- 7. Modern English Clarity
  (
      benchmark_cat_id,
      scripture_coll_id,
    'modern_english_clarity',
    'Modern English Clarity',
    'reference',
    'Measures readability and comprehension for contemporary English readers. Evaluates sentence structure, vocabulary accessibility, and overall flow while maintaining theological accuracy and dignity of expression.',
    7, 1, true, 1, NOW(), NOW()
  ),
  -- 8. Avoidance of Archaic / Obscure Language
  (
      benchmark_cat_id,
      scripture_coll_id,
    'avoidance_archaic_language',
    'Avoidance of Archaic / Obscure Language',
    'reference',
    'Assesses whether the translation avoids unnecessarily archaic terms, obsolete expressions, and obscure vocabulary that may hinder understanding. Considers balance between preserving biblical dignity and ensuring accessibility.',
    8, 1, true, 1, NOW(), NOW()
  ),
  -- 9. Doctrinal Stability Under Pressure
  (
      benchmark_cat_id,
      scripture_coll_id,
    'doctrinal_stability',
    'Doctrinal Stability Under Pressure',
    'reference',
    'Evaluates how well the translation maintains sound doctrine when facing cultural, political, or theological pressures. Assesses resistance to compromising core truths for contemporary acceptability or ideological agendas.',
    9, 1, true, 1, NOW(), NOW()
  ),
  -- 10. Resistance to Replacement Theology
  (
      benchmark_cat_id,
      scripture_coll_id,
    'resistance_replacement_theology',
    'Resistance to Replacement Theology',
    'reference',
    'Measures how well the translation avoids supersessionist interpretations that suggest the Church has replaced Israel. Evaluates preservation of Israel''s ongoing covenant role and the grafting-in theology of Romans 9-11.',
    10, 1, true, 1, NOW(), NOW()
  ),
  -- 11. Faithfulness to Jewish Cultural Context
  (
      benchmark_cat_id,
      scripture_coll_id,
    'jewish_cultural_context',
    'Faithfulness to Jewish Cultural Context',
    'reference',
    'Assesses retention of Jewish cultural elements including feast days, customs, idioms, and practices. Evaluates whether the translation helps readers understand the Jewish context of Scripture rather than obscuring it.',
    11, 1, true, 1, NOW(), NOW()
  ),
  -- 12. Precision of Key Covenant Terms
  (
      benchmark_cat_id,
      scripture_coll_id,
    'precision_covenant_terms',
    'Precision of Key Covenant Terms',
    'reference',
    'Evaluates consistency and accuracy in translating crucial covenant vocabulary such as torah (instruction), emunah (faithfulness), tzedakah (righteousness), and shalom (peace/wholeness). Measures whether nuanced meanings are preserved.',
    12, 1, true, 1, NOW(), NOW()
  ),
  -- 13. Law-Grace Integration Accuracy
  (
      benchmark_cat_id,
      scripture_coll_id,
    'law_grace_integration',
    'Law-Grace Integration Accuracy',
    'reference',
    'Assesses how the translation handles the relationship between Torah and grace. Evaluates whether it supports the biblical unity of law and grace rather than creating false dichotomies or antinomian interpretations.',
    13, 1, true, 1, NOW(), NOW()
  ),
  -- 14. Risk of Misinterpretation (Score Inverted)
  (
      benchmark_cat_id,
      scripture_coll_id,
    'risk_of_misinterpretation',
    'Risk of Misinterpretation (Score Inverted)',
    'reference',
    'Measures potential for readers to misunderstand key passages. Lower scores indicate higher risk. Evaluates clarity of difficult passages, handling of ambiguous texts, and whether translation choices minimize doctrinal confusion.',
    14, 1, true, 1, NOW(), NOW()
  ),
  -- 15. Discipleship Suitability in Hebraic Frame
  (
      benchmark_cat_id,
      scripture_coll_id,
    'discipleship_suitability',
    'Discipleship Suitability in Hebraic Frame',
    'reference',
    'Evaluates effectiveness for discipleship within a Hebraic understanding of faith. Assesses how well the translation supports teaching Torah-observant, Messiah-centered discipleship and spiritual formation.',
    15, 1, true, 1, NOW(), NOW()
  ),
  -- 16. Narrative Coherence (Acts-Revelation)
  (
      benchmark_cat_id,
      scripture_coll_id,
    'narrative_coherence',
    'Narrative Coherence (Acts-Revelation)',
    'reference',
    'Measures how well the translation maintains narrative and theological coherence from Acts through Revelation. Evaluates consistency in terminology, themes, and the unfolding story of the early believing community.',
    16, 1, true, 1, NOW(), NOW()
  ),
  -- 17. Eschatological Clarity
  (
      benchmark_cat_id,
      scripture_coll_id,
    'eschatological_clarity',
    'Eschatological Clarity',
    'reference',
    'Assesses how clearly the translation renders prophetic and eschatological passages. Evaluates handling of apocalyptic language, future promises, and the hope of Messiah''s return within a Hebraic eschatological framework.',
    17, 1, true, 1, NOW(), NOW()
  ),
  -- 18. Translation Consistency of Key Words
  (
      benchmark_cat_id,
      scripture_coll_id,
    'translation_consistency',
    'Translation Consistency of Key Words',
    'reference',
    'Measures consistency in translating the same Hebrew or Greek word throughout Scripture. Evaluates whether key terms are rendered uniformly to help readers trace themes and concepts across the biblical text.',
    18, 1, true, 1, NOW(), NOW()
  ),
  -- 19. Pastoral & Teaching Utility
  (
      benchmark_cat_id,
      scripture_coll_id,
    'pastoral_teaching_utility',
    'Pastoral & Teaching Utility',
    'reference',
    'Evaluates practical usefulness for pastoral ministry, teaching, and preaching. Considers how well the translation supports exposition, memorization, liturgical use, and congregational reading.',
    19, 1, true, 1, NOW(), NOW()
  ),
  -- 20. Doctrinal Drift Risk (Score Inverted)
  (
      benchmark_cat_id,
      scripture_coll_id,
    'doctrinal_drift_risk',
    'Doctrinal Drift Risk (Score Inverted)',
    'reference',
    'Measures the translation''s vulnerability to doctrinal drift over time. Lower scores indicate higher risk. Evaluates translation philosophy stability, committee composition safeguards, and resistance to revision pressures.',
      20, 1, true, 1, NOW(), NOW()
    );
END $$;
