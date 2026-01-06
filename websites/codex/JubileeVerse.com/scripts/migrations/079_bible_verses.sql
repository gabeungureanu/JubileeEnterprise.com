-- ============================================
-- JubileeVerse Database Schema
-- Migration 079: Bible Verses Table
-- Stores scripture verses with translation support
-- ============================================

-- ============================================
-- PART 1: BIBLE VERSES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS bible_verses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Book identification
    book_id VARCHAR(50) NOT NULL,        -- e.g., 'Genesis', 'Exodus', '1_Samuel'
    book_name VARCHAR(100) NOT NULL,     -- Display name: 'Genesis', '1 Samuel'
    book_order INT NOT NULL,             -- Order in Bible (1-66)

    -- Chapter and verse
    chapter_number INT NOT NULL,
    verse_number INT NOT NULL,

    -- Content
    verse_text TEXT NOT NULL,
    verse_preview VARCHAR(27),           -- First 24 chars + "..."

    -- Translation info
    translation_code VARCHAR(10) NOT NULL DEFAULT 'ESV',  -- ESV, KJV, NIV, etc.
    translation_name VARCHAR(100) DEFAULT 'English Standard Version',

    -- Section headings (optional, for verse 1 of sections)
    section_heading VARCHAR(200),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint per translation
    CONSTRAINT uq_verse_reference UNIQUE (book_id, chapter_number, verse_number, translation_code)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_bible_verses_book ON bible_verses(book_id);
CREATE INDEX IF NOT EXISTS idx_bible_verses_chapter ON bible_verses(book_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_bible_verses_translation ON bible_verses(translation_code);
CREATE INDEX IF NOT EXISTS idx_bible_verses_book_order ON bible_verses(book_order);

-- Trigger for updated_at
CREATE TRIGGER update_bible_verses_updated_at
    BEFORE UPDATE ON bible_verses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PART 2: SEED GENESIS CHAPTER 1 (ESV)
-- ============================================

INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, verse_preview, translation_code, section_heading)
VALUES
    ('Genesis', 'Genesis', 1, 1, 1, 'In the beginning, God created the heavens and the earth.', 'In the beginning, God c...', 'ESV', 'The Creation of the World'),
    ('Genesis', 'Genesis', 1, 1, 2, 'The earth was without form and void, and darkness was over the face of the deep. And the Spirit of God was hovering over the face of the waters.', 'The earth was without fo...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 3, 'And God said, "Let there be light," and there was light.', 'And God said, "Let there...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 4, 'And God saw that the light was good. And God separated the light from the darkness.', 'And God saw that the lig...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 5, 'God called the light Day, and the darkness he called Night. And there was evening and there was morning, the first day.', 'God called the light Day...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 6, 'And God said, "Let there be an expanse in the midst of the waters, and let it separate the waters from the waters."', 'And God said, "Let there...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 7, 'And God made the expanse and separated the waters that were under the expanse from the waters that were above the expanse. And it was so.', 'And God made the expanse...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 8, 'And God called the expanse Heaven. And there was evening and there was morning, the second day.', 'And God called the expan...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 9, 'And God said, "Let the waters under the heavens be gathered together into one place, and let the dry land appear." And it was so.', 'And God said, "Let the w...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 10, 'God called the dry land Earth, and the waters that were gathered together he called Seas. And God saw that it was good.', 'God called the dry land ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 11, 'And God said, "Let the earth sprout vegetation, plants yielding seed, and fruit trees bearing fruit in which is their seed, each according to its kind, on the earth." And it was so.', 'And God said, "Let the e...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 12, 'The earth brought forth vegetation, plants yielding seed according to their own kinds, and trees bearing fruit in which is their seed, each according to its kind. And God saw that it was good.', 'The earth brought forth ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 13, 'And there was evening and there was morning, the third day.', 'And there was evening an...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 14, 'And God said, "Let there be lights in the expanse of the heavens to separate the day from the night. And let them be for signs and for seasons, and for days and years,"', 'And God said, "Let there...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 15, 'and let them be lights in the expanse of the heavens to give light upon the earth." And it was so.', 'and let them be lights i...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 16, 'And God made the two great lights—the greater light to rule the day and the lesser light to rule the night—and the stars.', 'And God made the two gre...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 17, 'And God set them in the expanse of the heavens to give light on the earth,', 'And God set them in the ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 18, 'to rule over the day and over the night, and to separate the light from the darkness. And God saw that it was good.', 'to rule over the day and...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 19, 'And there was evening and there was morning, the fourth day.', 'And there was evening an...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 20, 'And God said, "Let the waters swarm with swarms of living creatures, and let birds fly above the earth across the expanse of the heavens."', 'And God said, "Let the w...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 21, 'So God created the great sea creatures and every living creature that moves, with which the waters swarm, according to their kinds, and every winged bird according to its kind. And God saw that it was good.', 'So God created the great...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 22, 'And God blessed them, saying, "Be fruitful and multiply and fill the waters in the seas, and let birds multiply on the earth."', 'And God blessed them, sa...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 23, 'And there was evening and there was morning, the fifth day.', 'And there was evening an...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 24, 'And God said, "Let the earth bring forth living creatures according to their kinds—livestock and creeping things and beasts of the earth according to their kinds." And it was so.', 'And God said, "Let the e...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 25, 'And God made the beasts of the earth according to their kinds and the livestock according to their kinds, and everything that creeps on the ground according to its kind. And God saw that it was good.', 'And God made the beasts ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 26, 'Then God said, "Let us make man in our image, after our likeness. And let them have dominion over the fish of the sea and over the birds of the heavens and over the livestock and over all the earth and over every creeping thing that creeps on the earth."', 'Then God said, "Let us m...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 27, 'So God created man in his own image, in the image of God he created him; male and female he created them.', 'So God created man in hi...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 28, 'And God blessed them. And God said to them, "Be fruitful and multiply and fill the earth and subdue it and have dominion over the fish of the sea and over the birds of the heavens and over every living thing that moves on the earth."', 'And God blessed them. An...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 29, 'And God said, "Behold, I have given you every plant yielding seed that is on the face of all the earth, and every tree with seed in its fruit. You shall have them for food."', 'And God said, "Behold, I...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 30, 'And to every beast of the earth and to every bird of the heavens and to everything that creeps on the earth, everything that has the breath of life, I have given every green plant for food." And it was so.', 'And to every beast of th...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 1, 31, 'And God saw everything that he had made, and behold, it was very good. And there was evening and there was morning, the sixth day.', 'And God saw everything t...', 'ESV', NULL)
ON CONFLICT (book_id, chapter_number, verse_number, translation_code) DO UPDATE SET
    verse_text = EXCLUDED.verse_text,
    verse_preview = EXCLUDED.verse_preview,
    section_heading = EXCLUDED.section_heading,
    updated_at = NOW();

-- ============================================
-- PART 3: VIEW FOR VERSE DISPLAY
-- ============================================

CREATE OR REPLACE VIEW v_bible_verses_display AS
SELECT
    id,
    book_id,
    book_name,
    chapter_number,
    verse_number,
    verse_text,
    verse_preview,
    translation_code,
    section_heading,
    book_id || ' ' || chapter_number || ':' || verse_number AS reference
FROM bible_verses
ORDER BY book_order, chapter_number, verse_number;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 079 complete: Bible verses table created and Genesis 1 (ESV) seeded';
END $$;
