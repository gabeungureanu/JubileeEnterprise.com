-- Migration: Create tables for storing benchmark evaluation results
-- Supports verse-by-verse benchmark scoring

-- Table for storing benchmark evaluation results per verse
CREATE TABLE IF NOT EXISTS verse_benchmark_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verse_id UUID REFERENCES bible_verses(id) ON DELETE CASCADE,
  book_id VARCHAR(50) NOT NULL,
  chapter_number INTEGER NOT NULL,
  verse_number INTEGER NOT NULL,
  translation_code VARCHAR(10) NOT NULL DEFAULT 'ESV',

  -- Individual criterion scores (1-10 scale)
  hebraic_worldview_score DECIMAL(3,1),
  original_languages_score DECIMAL(3,1),
  early_church_alignment_score DECIMAL(3,1),
  covenant_terminology_score DECIMAL(3,1),
  sacred_names_score DECIMAL(3,1),
  hebraic_tense_score DECIMAL(3,1),
  modern_clarity_score DECIMAL(3,1),
  archaic_avoidance_score DECIMAL(3,1),
  doctrinal_stability_score DECIMAL(3,1),
  replacement_theology_score DECIMAL(3,1),
  jewish_context_score DECIMAL(3,1),
  covenant_terms_precision_score DECIMAL(3,1),
  law_grace_integration_score DECIMAL(3,1),
  misinterpretation_risk_score DECIMAL(3,1),  -- Inverted: 10=low risk
  discipleship_suitability_score DECIMAL(3,1),
  narrative_coherence_score DECIMAL(3,1),
  eschatological_clarity_score DECIMAL(3,1),
  translation_consistency_score DECIMAL(3,1),
  pastoral_utility_score DECIMAL(3,1),
  doctrinal_drift_risk_score DECIMAL(3,1),    -- Inverted: 10=low risk

  -- Aggregate scores
  total_score DECIMAL(5,1),
  percentage_score DECIMAL(5,2),
  grade VARCHAR(2),

  -- Detailed evaluation data
  evaluation_details JSONB,
  strengths TEXT[],
  improvements TEXT[],
  overall_assessment TEXT,
  recommendation TEXT,

  -- Metadata
  evaluated_by VARCHAR(100) DEFAULT 'system',
  evaluation_model VARCHAR(100),
  evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_verse_benchmark_lookup
ON verse_benchmark_results(book_id, chapter_number, verse_number, translation_code);

CREATE INDEX IF NOT EXISTS idx_verse_benchmark_verse_id
ON verse_benchmark_results(verse_id);

-- Table for tracking benchmark evaluation history
CREATE TABLE IF NOT EXISTS verse_benchmark_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  benchmark_result_id UUID REFERENCES verse_benchmark_results(id) ON DELETE CASCADE,
  previous_total_score DECIMAL(5,1),
  new_total_score DECIMAL(5,1),
  change_reason TEXT,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to calculate grade from percentage
CREATE OR REPLACE FUNCTION calculate_benchmark_grade(percentage DECIMAL)
RETURNS VARCHAR(2) AS $$
BEGIN
  IF percentage >= 90 THEN RETURN 'A';
  ELSIF percentage >= 80 THEN RETURN 'B';
  ELSIF percentage >= 70 THEN RETURN 'C';
  ELSIF percentage >= 60 THEN RETURN 'D';
  ELSE RETURN 'F';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-calculate totals on insert/update
CREATE OR REPLACE FUNCTION update_benchmark_totals()
RETURNS TRIGGER AS $$
DECLARE
  score_sum DECIMAL(5,1);
  score_count INTEGER;
BEGIN
  -- Calculate sum of all scores
  score_sum := COALESCE(NEW.hebraic_worldview_score, 0) +
               COALESCE(NEW.original_languages_score, 0) +
               COALESCE(NEW.early_church_alignment_score, 0) +
               COALESCE(NEW.covenant_terminology_score, 0) +
               COALESCE(NEW.sacred_names_score, 0) +
               COALESCE(NEW.hebraic_tense_score, 0) +
               COALESCE(NEW.modern_clarity_score, 0) +
               COALESCE(NEW.archaic_avoidance_score, 0) +
               COALESCE(NEW.doctrinal_stability_score, 0) +
               COALESCE(NEW.replacement_theology_score, 0) +
               COALESCE(NEW.jewish_context_score, 0) +
               COALESCE(NEW.covenant_terms_precision_score, 0) +
               COALESCE(NEW.law_grace_integration_score, 0) +
               COALESCE(NEW.misinterpretation_risk_score, 0) +
               COALESCE(NEW.discipleship_suitability_score, 0) +
               COALESCE(NEW.narrative_coherence_score, 0) +
               COALESCE(NEW.eschatological_clarity_score, 0) +
               COALESCE(NEW.translation_consistency_score, 0) +
               COALESCE(NEW.pastoral_utility_score, 0) +
               COALESCE(NEW.doctrinal_drift_risk_score, 0);

  NEW.total_score := score_sum;
  NEW.percentage_score := (score_sum / 200.0) * 100;
  NEW.grade := calculate_benchmark_grade(NEW.percentage_score);
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_benchmark_totals ON verse_benchmark_results;
CREATE TRIGGER trg_update_benchmark_totals
  BEFORE INSERT OR UPDATE ON verse_benchmark_results
  FOR EACH ROW
  EXECUTE FUNCTION update_benchmark_totals();
