-- ============================================
-- JubileeVerse Database Schema
-- Migration 082: Genesis Chapters 12-15 (ESV)
-- ============================================

-- Genesis Chapter 12
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, verse_preview, translation_code, section_heading)
VALUES
    ('Genesis', 'Genesis', 1, 12, 1, 'Now the LORD said to Abram, "Go from your country and your kindred and your father''s house to the land that I will show you.', 'Now the LORD said to Abr...', 'ESV', 'The Call of Abram'),
    ('Genesis', 'Genesis', 1, 12, 2, 'And I will make of you a great nation, and I will bless you and make your name great, so that you will be a blessing.', 'And I will make of you a...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 12, 3, 'I will bless those who bless you, and him who dishonors you I will curse, and in you all the families of the earth shall be blessed."', 'I will bless those who b...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 12, 4, 'So Abram went, as the LORD had told him, and Lot went with him. Abram was seventy-five years old when he departed from Haran.', 'So Abram went, as the LO...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 12, 5, 'And Abram took Sarai his wife, and Lot his brother''s son, and all their possessions that they had gathered, and the people that they had acquired in Haran, and they set out to go to the land of Canaan. When they came to the land of Canaan,', 'And Abram took Sarai his...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 12, 6, 'Abram passed through the land to the place at Shechem, to the oak of Moreh. At that time the Canaanites were in the land.', 'Abram passed through the...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 12, 7, 'Then the LORD appeared to Abram and said, "To your offspring I will give this land." So he built there an altar to the LORD, who had appeared to him.', 'Then the LORD appeared t...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 12, 8, 'From there he moved to the hill country on the east of Bethel and pitched his tent, with Bethel on the west and Ai on the east. And there he built an altar to the LORD and called upon the name of the LORD.', 'From there he moved to t...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 12, 9, 'And Abram journeyed on, still going toward the Negeb.', 'And Abram journeyed on, ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 12, 10, 'Now there was a famine in the land. So Abram went down to Egypt to sojourn there, for the famine was severe in the land.', 'Now there was a famine i...', 'ESV', 'Abram and Sarai in Egypt'),
    ('Genesis', 'Genesis', 1, 12, 11, 'When he was about to enter Egypt, he said to Sarai his wife, "I know that you are a woman beautiful in appearance,', 'When he was about to ent...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 12, 12, 'and when the Egyptians see you, they will say, ''This is his wife.'' Then they will kill me, but they will let you live.', 'and when the Egyptians s...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 12, 13, 'Say you are my sister, that it may go well with me because of you, and that my life may be spared for your sake."', 'Say you are my sister, t...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 12, 14, 'When Abram entered Egypt, the Egyptians saw that the woman was very beautiful.', 'When Abram entered Egypt...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 12, 15, 'And when the princes of Pharaoh saw her, they praised her to Pharaoh. And the woman was taken into Pharaoh''s house.', 'And when the princes of ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 12, 16, 'And for her sake he dealt well with Abram; and he had sheep, oxen, male donkeys, male servants, female servants, female donkeys, and camels.', 'And for her sake he deal...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 12, 17, 'But the LORD afflicted Pharaoh and his house with great plagues because of Sarai, Abram''s wife.', 'But the LORD afflicted P...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 12, 18, 'So Pharaoh called Abram and said, "What is this you have done to me? Why did you not tell me that she was your wife?', 'So Pharaoh called Abram ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 12, 19, 'Why did you say, ''She is my sister,'' so that I took her for my wife? Now then, here is your wife; take her, and go."', 'Why did you say, ''She is...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 12, 20, 'And Pharaoh gave men orders concerning him, and they sent him away with his wife and all that he had.', 'And Pharaoh gave men ord...', 'ESV', NULL)
ON CONFLICT (book_id, chapter_number, verse_number, translation_code) DO UPDATE SET
    verse_text = EXCLUDED.verse_text,
    verse_preview = EXCLUDED.verse_preview,
    section_heading = EXCLUDED.section_heading,
    updated_at = NOW();

-- Genesis Chapter 13
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, verse_preview, translation_code, section_heading)
VALUES
    ('Genesis', 'Genesis', 1, 13, 1, 'So Abram went up from Egypt, he and his wife and all that he had, and Lot with him, into the Negeb.', 'So Abram went up from Eg...', 'ESV', 'Abram and Lot Separate'),
    ('Genesis', 'Genesis', 1, 13, 2, 'Now Abram was very rich in livestock, in silver, and in gold.', 'Now Abram was very rich ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 13, 3, 'And he journeyed on from the Negeb as far as Bethel to the place where his tent had been at the beginning, between Bethel and Ai,', 'And he journeyed on from...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 13, 4, 'to the place where he had made an altar at the first. And there Abram called upon the name of the LORD.', 'to the place where he ha...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 13, 5, 'And Lot, who went with Abram, also had flocks and herds and tents,', 'And Lot, who went with A...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 13, 6, 'so that the land could not support both of them dwelling together; for their possessions were so great that they could not dwell together,', 'so that the land could n...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 13, 7, 'and there was strife between the herdsmen of Abram''s livestock and the herdsmen of Lot''s livestock. At that time the Canaanites and the Perizzites were dwelling in the land.', 'and there was strife bet...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 13, 8, 'Then Abram said to Lot, "Let there be no strife between you and me, and between your herdsmen and my herdsmen, for we are kinsmen.', 'Then Abram said to Lot, ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 13, 9, 'Is not the whole land before you? Separate yourself from me. If you take the left hand, then I will go to the right, or if you take the right hand, then I will go to the left."', 'Is not the whole land be...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 13, 10, 'And Lot lifted up his eyes and saw that the Jordan Valley was well watered everywhere like the garden of the LORD, like the land of Egypt, in the direction of Zoar. (This was before the LORD destroyed Sodom and Gomorrah.)', 'And Lot lifted up his ey...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 13, 11, 'So Lot chose for himself all the Jordan Valley, and Lot journeyed east. Thus they separated from each other.', 'So Lot chose for himself...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 13, 12, 'Abram settled in the land of Canaan, while Lot settled among the cities of the valley and moved his tent as far as Sodom.', 'Abram settled in the lan...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 13, 13, 'Now the men of Sodom were wicked, great sinners against the LORD.', 'Now the men of Sodom wer...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 13, 14, 'The LORD said to Abram, after Lot had separated from him, "Lift up your eyes and look from the place where you are, northward and southward and eastward and westward,', 'The LORD said to Abram, ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 13, 15, 'for all the land that you see I will give to you and to your offspring forever.', 'for all the land that yo...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 13, 16, 'I will make your offspring as the dust of the earth, so that if one can count the dust of the earth, your offspring also can be counted.', 'I will make your offspri...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 13, 17, 'Arise, walk through the length and the breadth of the land, for I will give it to you."', 'Arise, walk through the ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 13, 18, 'So Abram moved his tent and came and settled by the oaks of Mamre, which are at Hebron, and there he built an altar to the LORD.', 'So Abram moved his tent ...', 'ESV', NULL)
ON CONFLICT (book_id, chapter_number, verse_number, translation_code) DO UPDATE SET
    verse_text = EXCLUDED.verse_text,
    verse_preview = EXCLUDED.verse_preview,
    section_heading = EXCLUDED.section_heading,
    updated_at = NOW();

-- Genesis Chapter 14
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, verse_preview, translation_code, section_heading)
VALUES
    ('Genesis', 'Genesis', 1, 14, 1, 'In the days of Amraphel king of Shinar, Arioch king of Ellasar, Chedorlaomer king of Elam, and Tidal king of Goiim,', 'In the days of Amraphel ...', 'ESV', 'Abram Rescues Lot'),
    ('Genesis', 'Genesis', 1, 14, 2, 'these kings made war with Bera king of Sodom, Birsha king of Gomorrah, Shinab king of Admah, Shemeber king of Zeboiim, and the king of Bela (that is, Zoar).', 'these kings made war wit...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 3, 'And all these joined forces in the Valley of Siddim (that is, the Salt Sea).', 'And all these joined for...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 4, 'Twelve years they had served Chedorlaomer, but in the thirteenth year they rebelled.', 'Twelve years they had se...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 5, 'In the fourteenth year Chedorlaomer and the kings who were with him came and defeated the Rephaim in Ashteroth-karnaim, the Zuzim in Ham, the Emim in Shaveh-kiriathaim,', 'In the fourteenth year C...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 6, 'and the Horites in their hill country of Seir as far as El-paran on the border of the wilderness.', 'and the Horites in their...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 7, 'Then they turned back and came to En-mishpat (that is, Kadesh) and defeated all the country of the Amalekites, and also the Amorites who were dwelling in Hazazon-tamar.', 'Then they turned back an...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 8, 'Then the king of Sodom, the king of Gomorrah, the king of Admah, the king of Zeboiim, and the king of Bela (that is, Zoar) went out, and they joined battle in the Valley of Siddim', 'Then the king of Sodom, ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 9, 'with Chedorlaomer king of Elam, Tidal king of Goiim, Amraphel king of Shinar, and Arioch king of Ellasar, four kings against five.', 'with Chedorlaomer king o...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 10, 'Now the Valley of Siddim was full of bitumen pits, and as the kings of Sodom and Gomorrah fled, some fell into them, and the rest fled to the hill country.', 'Now the Valley of Siddim...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 11, 'So the enemy took all the possessions of Sodom and Gomorrah, and all their provisions, and went their way.', 'So the enemy took all th...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 12, 'They also took Lot, the son of Abram''s brother, who was dwelling in Sodom, and his possessions, and went their way.', 'They also took Lot, the ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 13, 'Then one who had escaped came and told Abram the Hebrew, who was living by the oaks of Mamre the Amorite, brother of Eshcol and of Aner. These were allies of Abram.', 'Then one who had escaped...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 14, 'When Abram heard that his kinsman had been taken captive, he led forth his trained men, born in his house, 318 of them, and went in pursuit as far as Dan.', 'When Abram heard that hi...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 15, 'And he divided his forces against them by night, he and his servants, and defeated them and pursued them to Hobah, north of Damascus.', 'And he divided his force...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 16, 'Then he brought back all the possessions, and also brought back his kinsman Lot with his possessions, and the women and the people.', 'Then he brought back all...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 17, 'After his return from the defeat of Chedorlaomer and the kings who were with him, the king of Sodom went out to meet him at the Valley of Shaveh (that is, the King''s Valley).', 'After his return from th...', 'ESV', 'Abram Blessed by Melchizedek'),
    ('Genesis', 'Genesis', 1, 14, 18, 'And Melchizedek king of Salem brought out bread and wine. (He was priest of God Most High.)', 'And Melchizedek king of ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 19, 'And he blessed him and said, "Blessed be Abram by God Most High, Possessor of heaven and earth;', 'And he blessed him and s...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 20, 'and blessed be God Most High, who has delivered your enemies into your hand!" And Abram gave him a tenth of everything.', 'and blessed be God Most ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 21, 'And the king of Sodom said to Abram, "Give me the persons, but take the goods for yourself."', 'And the king of Sodom sa...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 22, 'But Abram said to the king of Sodom, "I have lifted my hand to the LORD, God Most High, Possessor of heaven and earth,', 'But Abram said to the ki...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 23, 'that I would not take a thread or a sandal strap or anything that is yours, lest you should say, ''I have made Abram rich.''', 'that I would not take a ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 14, 24, 'I will take nothing but what the young men have eaten, and the share of the men who went with me. Let Aner, Eshcol, and Mamre take their share."', 'I will take nothing but ...', 'ESV', NULL)
ON CONFLICT (book_id, chapter_number, verse_number, translation_code) DO UPDATE SET
    verse_text = EXCLUDED.verse_text,
    verse_preview = EXCLUDED.verse_preview,
    section_heading = EXCLUDED.section_heading,
    updated_at = NOW();

-- Genesis Chapter 15
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, verse_preview, translation_code, section_heading)
VALUES
    ('Genesis', 'Genesis', 1, 15, 1, 'After these things the word of the LORD came to Abram in a vision: "Fear not, Abram, I am your shield; your reward shall be very great."', 'After these things the w...', 'ESV', 'God''s Covenant with Abram'),
    ('Genesis', 'Genesis', 1, 15, 2, 'But Abram said, "O Lord GOD, what will you give me, for I continue childless, and the heir of my house is Eliezer of Damascus?"', 'But Abram said, "O Lord ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 15, 3, 'And Abram said, "Behold, you have given me no offspring, and a member of my household will be my heir."', 'And Abram said, "Behold,...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 15, 4, 'And behold, the word of the LORD came to him: "This man shall not be your heir; your very own son shall be your heir."', 'And behold, the word of ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 15, 5, 'And he brought him outside and said, "Look toward heaven, and number the stars, if you are able to number them." Then he said to him, "So shall your offspring be."', 'And he brought him outsi...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 15, 6, 'And he believed the LORD, and he counted it to him as righteousness.', 'And he believed the LORD...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 15, 7, 'And he said to him, "I am the LORD who brought you out from Ur of the Chaldeans to give you this land to possess."', 'And he said to him, "I a...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 15, 8, 'But he said, "O Lord GOD, how am I to know that I shall possess it?"', 'But he said, "O Lord GOD...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 15, 9, 'He said to him, "Bring me a heifer three years old, a female goat three years old, a ram three years old, a turtledove, and a young pigeon."', 'He said to him, "Bring m...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 15, 10, 'And he brought him all these, cut them in half, and laid each half over against the other. But he did not cut the birds in half.', 'And he brought him all t...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 15, 11, 'And when birds of prey came down on the carcasses, Abram drove them away.', 'And when birds of prey c...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 15, 12, 'As the sun was going down, a deep sleep fell on Abram. And behold, dreadful and great darkness fell upon him.', 'As the sun was going dow...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 15, 13, 'Then the LORD said to Abram, "Know for certain that your offspring will be sojourners in a land that is not theirs and will be servants there, and they will be afflicted for four hundred years.', 'Then the LORD said to Ab...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 15, 14, 'But I will bring judgment on the nation that they serve, and afterward they shall come out with great possessions.', 'But I will bring judgmen...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 15, 15, 'As for yourself, you shall go to your fathers in peace; you shall be buried in a good old age.', 'As for yourself, you sha...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 15, 16, 'And they shall come back here in the fourth generation, for the iniquity of the Amorites is not yet complete."', 'And they shall come back...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 15, 17, 'When the sun had gone down and it was dark, behold, a smoking fire pot and a flaming torch passed between these pieces.', 'When the sun had gone do...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 15, 18, 'On that day the LORD made a covenant with Abram, saying, "To your offspring I give this land, from the river of Egypt to the great river, the river Euphrates,', 'On that day the LORD mad...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 15, 19, 'the land of the Kenites, the Kenizzites, the Kadmonites,', 'the land of the Kenites,...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 15, 20, 'the Hittites, the Perizzites, the Rephaim,', 'the Hittites, the Perizz...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 15, 21, 'the Amorites, the Canaanites, the Girgashites and the Jebusites."', 'the Amorites, the Canaan...', 'ESV', NULL)
ON CONFLICT (book_id, chapter_number, verse_number, translation_code) DO UPDATE SET
    verse_text = EXCLUDED.verse_text,
    verse_preview = EXCLUDED.verse_preview,
    section_heading = EXCLUDED.section_heading,
    updated_at = NOW();

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 082 complete: Genesis chapters 12-15 (ESV) inserted';
END $$;
