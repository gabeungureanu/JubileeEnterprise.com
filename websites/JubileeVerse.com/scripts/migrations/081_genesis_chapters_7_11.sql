-- ============================================
-- JubileeVerse Database Schema
-- Migration 081: Genesis Chapters 7-11 (ESV)
-- ============================================

-- Genesis Chapter 7
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, verse_preview, translation_code, section_heading)
VALUES
    ('Genesis', 'Genesis', 1, 7, 1, 'Then the LORD said to Noah, "Go into the ark, you and all your household, for I have seen that you are righteous before me in this generation.', 'Then the LORD said to No...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 2, 'Take with you seven pairs of all clean animals, the male and his mate, and a pair of the animals that are not clean, the male and his mate,', 'Take with you seven pair...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 3, 'and seven pairs of the birds of the heavens also, male and female, to keep their offspring alive on the face of all the earth.', 'and seven pairs of the b...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 4, 'For in seven days I will send rain on the earth forty days and forty nights, and every living thing that I have made I will blot out from the face of the ground."', 'For in seven days I will...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 5, 'And Noah did all that the LORD had commanded him.', 'And Noah did all that th...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 6, 'Noah was six hundred years old when the flood of waters came upon the earth.', 'Noah was six hundred yea...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 7, 'And Noah and his sons and his wife and his sons'' wives with him went into the ark to escape the waters of the flood.', 'And Noah and his sons an...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 8, 'Of clean animals, and of animals that are not clean, and of birds, and of everything that creeps on the ground,', 'Of clean animals, and of...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 9, 'two and two, male and female, went into the ark with Noah, as God had commanded Noah.', 'two and two, male and fe...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 10, 'And after seven days the waters of the flood came upon the earth.', 'And after seven days the...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 11, 'In the six hundredth year of Noah''s life, in the second month, on the seventeenth day of the month, on that day all the fountains of the great deep burst forth, and the windows of the heavens were opened.', 'In the six hundredth yea...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 12, 'And rain fell upon the earth forty days and forty nights.', 'And rain fell upon the e...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 13, 'On the very same day Noah and his sons, Shem and Ham and Japheth, and Noah''s wife and the three wives of his sons with them entered the ark,', 'On the very same day Noa...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 14, 'they and every beast, according to its kind, and all the livestock according to their kinds, and every creeping thing that creeps on the earth, according to its kind, and every bird, according to its kind, every winged creature.', 'they and every beast, ac...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 15, 'They went into the ark with Noah, two and two of all flesh in which there was the breath of life.', 'They went into the ark w...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 16, 'And those that entered, male and female of all flesh, went in as God had commanded him. And the LORD shut him in.', 'And those that entered, ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 17, 'The flood continued forty days on the earth. The waters increased and bore up the ark, and it rose high above the earth.', 'The flood continued fort...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 18, 'The waters prevailed and increased greatly on the earth, and the ark floated on the face of the waters.', 'The waters prevailed and...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 19, 'And the waters prevailed so mightily on the earth that all the high mountains under the whole heaven were covered.', 'And the waters prevailed...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 20, 'The waters prevailed above the mountains, covering them fifteen cubits deep.', 'The waters prevailed abo...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 21, 'And all flesh died that moved on the earth, birds, livestock, beasts, all swarming creatures that swarm on the earth, and all mankind.', 'And all flesh died that ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 22, 'Everything on the dry land in whose nostrils was the breath of life died.', 'Everything on the dry la...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 23, 'He blotted out every living thing that was on the face of the ground, man and animals and creeping things and birds of the heavens. They were blotted out from the earth. Only Noah was left, and those who were with him in the ark.', 'He blotted out every liv...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 7, 24, 'And the waters prevailed on the earth 150 days.', 'And the waters prevailed...', 'ESV', NULL)
ON CONFLICT (book_id, chapter_number, verse_number, translation_code) DO UPDATE SET
    verse_text = EXCLUDED.verse_text,
    verse_preview = EXCLUDED.verse_preview,
    section_heading = EXCLUDED.section_heading,
    updated_at = NOW();

-- Genesis Chapter 8
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, verse_preview, translation_code, section_heading)
VALUES
    ('Genesis', 'Genesis', 1, 8, 1, 'But God remembered Noah and all the beasts and all the livestock that were with him in the ark. And God made a wind blow over the earth, and the waters subsided.', 'But God remembered Noah ...', 'ESV', 'The Flood Subsides'),
    ('Genesis', 'Genesis', 1, 8, 2, 'The fountains of the deep and the windows of the heavens were closed, the rain from the heavens was restrained,', 'The fountains of the dee...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 8, 3, 'and the waters receded from the earth continually. At the end of 150 days the waters had abated,', 'and the waters receded f...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 8, 4, 'and in the seventh month, on the seventeenth day of the month, the ark came to rest on the mountains of Ararat.', 'and in the seventh month...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 8, 5, 'And the waters continued to abate until the tenth month; in the tenth month, on the first day of the month, the tops of the mountains were seen.', 'And the waters continued...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 8, 6, 'At the end of forty days Noah opened the window of the ark that he had made', 'At the end of forty days...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 8, 7, 'and sent forth a raven. It went to and fro until the waters were dried up from the earth.', 'and sent forth a raven. ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 8, 8, 'Then he sent forth a dove from him, to see if the waters had subsided from the face of the ground.', 'Then he sent forth a dov...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 8, 9, 'But the dove found no place to set her foot, and she returned to him to the ark, for the waters were still on the face of the whole earth. So he put out his hand and took her and brought her into the ark with him.', 'But the dove found no pl...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 8, 10, 'He waited another seven days, and again he sent forth the dove out of the ark.', 'He waited another seven ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 8, 11, 'And the dove came back to him in the evening, and behold, in her mouth was a freshly plucked olive leaf. So Noah knew that the waters had subsided from the earth.', 'And the dove came back t...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 8, 12, 'Then he waited another seven days and sent forth the dove, and she did not return to him anymore.', 'Then he waited another s...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 8, 13, 'In the six hundred and first year, in the first month, the first day of the month, the waters were dried from off the earth. And Noah removed the covering of the ark and looked, and behold, the face of the ground was dry.', 'In the six hundred and f...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 8, 14, 'In the second month, on the twenty-seventh day of the month, the earth had dried out.', 'In the second month, on ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 8, 15, 'Then God said to Noah,', 'Then God said to Noah,', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 8, 16, '"Go out from the ark, you and your wife, and your sons and your sons'' wives with you.', '"Go out from the ark, yo...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 8, 17, 'Bring out with you every living thing that is with you of all flesh—birds and animals and every creeping thing that creeps on the earth—that they may swarm on the earth, and be fruitful and multiply on the earth."', 'Bring out with you every...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 8, 18, 'So Noah went out, and his sons and his wife and his sons'' wives with him.', 'So Noah went out, and hi...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 8, 19, 'Every beast, every creeping thing, and every bird, everything that moves on the earth, went out by families from the ark.', 'Every beast, every creep...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 8, 20, 'Then Noah built an altar to the LORD and took some of every clean animal and some of every clean bird and offered burnt offerings on the altar.', 'Then Noah built an altar...', 'ESV', 'God''s Covenant with Noah'),
    ('Genesis', 'Genesis', 1, 8, 21, 'And when the LORD smelled the pleasing aroma, the LORD said in his heart, "I will never again curse the ground because of man, for the intention of man''s heart is evil from his youth. Neither will I ever again strike down every living creature as I have done.', 'And when the LORD smelle...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 8, 22, 'While the earth remains, seedtime and harvest, cold and heat, summer and winter, day and night, shall not cease."', 'While the earth remains,...', 'ESV', NULL)
ON CONFLICT (book_id, chapter_number, verse_number, translation_code) DO UPDATE SET
    verse_text = EXCLUDED.verse_text,
    verse_preview = EXCLUDED.verse_preview,
    section_heading = EXCLUDED.section_heading,
    updated_at = NOW();

-- Genesis Chapter 9
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, verse_preview, translation_code, section_heading)
VALUES
    ('Genesis', 'Genesis', 1, 9, 1, 'And God blessed Noah and his sons and said to them, "Be fruitful and multiply and fill the earth.', 'And God blessed Noah and...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 2, 'The fear of you and the dread of you shall be upon every beast of the earth and upon every bird of the heavens, upon everything that creeps on the ground and all the fish of the sea. Into your hand they are delivered.', 'The fear of you and the ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 3, 'Every moving thing that lives shall be food for you. And as I gave you the green plants, I give you everything.', 'Every moving thing that ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 4, 'But you shall not eat flesh with its life, that is, its blood.', 'But you shall not eat fl...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 5, 'And for your lifeblood I will require a reckoning: from every beast I will require it and from man. From his fellow man I will require a reckoning for the life of man.', 'And for your lifeblood I...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 6, '"Whoever sheds the blood of man, by man shall his blood be shed, for God made man in his own image.', '"Whoever sheds the blood...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 7, 'And you, be fruitful and multiply, teem on the earth and multiply in it."', 'And you, be fruitful and...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 8, 'Then God said to Noah and to his sons with him,', 'Then God said to Noah an...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 9, '"Behold, I establish my covenant with you and your offspring after you,', '"Behold, I establish my ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 10, 'and with every living creature that is with you, the birds, the livestock, and every beast of the earth with you, as many as came out of the ark; it is for every beast of the earth.', 'and with every living cr...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 11, 'I establish my covenant with you, that never again shall all flesh be cut off by the waters of the flood, and never again shall there be a flood to destroy the earth."', 'I establish my covenant ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 12, 'And God said, "This is the sign of the covenant that I make between me and you and every living creature that is with you, for all future generations:', 'And God said, "This is t...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 13, 'I have set my bow in the cloud, and it shall be a sign of the covenant between me and the earth.', 'I have set my bow in the...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 14, 'When I bring clouds over the earth and the bow is seen in the clouds,', 'When I bring clouds over...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 15, 'I will remember my covenant that is between me and you and every living creature of all flesh. And the waters shall never again become a flood to destroy all flesh.', 'I will remember my coven...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 16, 'When the bow is in the clouds, I will see it and remember the everlasting covenant between God and every living creature of all flesh that is on the earth."', 'When the bow is in the c...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 17, 'God said to Noah, "This is the sign of the covenant that I have established between me and all flesh that is on the earth."', 'God said to Noah, "This ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 18, 'The sons of Noah who went forth from the ark were Shem, Ham, and Japheth. (Ham was the father of Canaan.)', 'The sons of Noah who wen...', 'ESV', 'Noah''s Descendants'),
    ('Genesis', 'Genesis', 1, 9, 19, 'These three were the sons of Noah, and from these the people of the whole earth were dispersed.', 'These three were the son...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 20, 'Noah began to be a man of the soil, and he planted a vineyard.', 'Noah began to be a man o...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 21, 'He drank of the wine and became drunk and lay uncovered in his tent.', 'He drank of the wine and...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 22, 'And Ham, the father of Canaan, saw the nakedness of his father and told his two brothers outside.', 'And Ham, the father of C...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 23, 'Then Shem and Japheth took a garment, laid it on both their shoulders, and walked backward and covered the nakedness of their father. Their faces were turned backward, and they did not see their father''s nakedness.', 'Then Shem and Japheth to...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 24, 'When Noah awoke from his wine and knew what his youngest son had done to him,', 'When Noah awoke from his...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 25, 'he said, "Cursed be Canaan; a servant of servants shall he be to his brothers."', 'he said, "Cursed be Cana...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 26, 'He also said, "Blessed be the LORD, the God of Shem; and let Canaan be his servant.', 'He also said, "Blessed b...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 27, 'May God enlarge Japheth, and let him dwell in the tents of Shem, and let Canaan be his servant."', 'May God enlarge Japheth,...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 28, 'After the flood Noah lived 350 years.', 'After the flood Noah liv...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 9, 29, 'All the days of Noah were 950 years, and he died.', 'All the days of Noah wer...', 'ESV', NULL)
ON CONFLICT (book_id, chapter_number, verse_number, translation_code) DO UPDATE SET
    verse_text = EXCLUDED.verse_text,
    verse_preview = EXCLUDED.verse_preview,
    section_heading = EXCLUDED.section_heading,
    updated_at = NOW();

-- Genesis Chapter 10
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, verse_preview, translation_code, section_heading)
VALUES
    ('Genesis', 'Genesis', 1, 10, 1, 'These are the generations of the sons of Noah, Shem, Ham, and Japheth. Sons were born to them after the flood.', 'These are the generation...', 'ESV', 'Nations Descended from Noah'),
    ('Genesis', 'Genesis', 1, 10, 2, 'The sons of Japheth: Gomer, Magog, Madai, Javan, Tubal, Meshech, and Tiras.', 'The sons of Japheth: Gom...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 3, 'The sons of Gomer: Ashkenaz, Riphath, and Togarmah.', 'The sons of Gomer: Ashke...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 4, 'The sons of Javan: Elishah, Tarshish, Kittim, and Dodanim.', 'The sons of Javan: Elish...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 5, 'From these the coastland peoples spread in their lands, each with his own language, by their clans, in their nations.', 'From these the coastland...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 6, 'The sons of Ham: Cush, Egypt, Put, and Canaan.', 'The sons of Ham: Cush, E...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 7, 'The sons of Cush: Seba, Havilah, Sabtah, Raamah, and Sabteca. The sons of Raamah: Sheba and Dedan.', 'The sons of Cush: Seba, ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 8, 'Cush fathered Nimrod; he was the first on earth to be a mighty man.', 'Cush fathered Nimrod; he...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 9, 'He was a mighty hunter before the LORD. Therefore it is said, "Like Nimrod a mighty hunter before the LORD."', 'He was a mighty hunter b...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 10, 'The beginning of his kingdom was Babel, Erech, Accad, and Calneh, in the land of Shinar.', 'The beginning of his kin...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 11, 'From that land he went into Assyria and built Nineveh, Rehoboth-Ir, Calah, and', 'From that land he went i...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 12, 'Resen between Nineveh and Calah; that is the great city.', 'Resen between Nineveh an...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 13, 'Egypt fathered Ludim, Anamim, Lehabim, Naphtuhim,', 'Egypt fathered Ludim, An...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 14, 'Pathrusim, Casluhim (from whom the Philistines came), and Caphtorim.', 'Pathrusim, Casluhim (fro...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 15, 'Canaan fathered Sidon his firstborn and Heth,', 'Canaan fathered Sidon hi...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 16, 'and the Jebusites, the Amorites, the Girgashites,', 'and the Jebusites, the A...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 17, 'the Hivites, the Arkites, the Sinites,', 'the Hivites, the Arkites...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 18, 'the Arvadites, the Zemarites, and the Hamathites. Afterward the clans of the Canaanites dispersed.', 'the Arvadites, the Zemar...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 19, 'And the territory of the Canaanites extended from Sidon in the direction of Gerar as far as Gaza, and in the direction of Sodom, Gomorrah, Admah, and Zeboiim, as far as Lasha.', 'And the territory of the...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 20, 'These are the sons of Ham, by their clans, their languages, their lands, and their nations.', 'These are the sons of Ha...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 21, 'To Shem also, the father of all the children of Eber, the elder brother of Japheth, children were born.', 'To Shem also, the father...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 22, 'The sons of Shem: Elam, Asshur, Arpachshad, Lud, and Aram.', 'The sons of Shem: Elam, ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 23, 'The sons of Aram: Uz, Hul, Gether, and Mash.', 'The sons of Aram: Uz, Hu...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 24, 'Arpachshad fathered Shelah; and Shelah fathered Eber.', 'Arpachshad fathered Shel...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 25, 'To Eber were born two sons: the name of the one was Peleg, for in his days the earth was divided, and his brother''s name was Joktan.', 'To Eber were born two so...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 26, 'Joktan fathered Almodad, Sheleph, Hazarmaveth, Jerah,', 'Joktan fathered Almodad,...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 27, 'Hadoram, Uzal, Diklah,', 'Hadoram, Uzal, Diklah,', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 28, 'Obal, Abimael, Sheba,', 'Obal, Abimael, Sheba,', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 29, 'Ophir, Havilah, and Jobab; all these were the sons of Joktan.', 'Ophir, Havilah, and Joba...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 30, 'The territory in which they lived extended from Mesha in the direction of Sephar to the hill country of the east.', 'The territory in which t...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 31, 'These are the sons of Shem, by their clans, their languages, their lands, and their nations.', 'These are the sons of Sh...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 10, 32, 'These are the clans of the sons of Noah, according to their genealogies, in their nations, and from these the nations spread abroad on the earth after the flood.', 'These are the clans of t...', 'ESV', NULL)
ON CONFLICT (book_id, chapter_number, verse_number, translation_code) DO UPDATE SET
    verse_text = EXCLUDED.verse_text,
    verse_preview = EXCLUDED.verse_preview,
    section_heading = EXCLUDED.section_heading,
    updated_at = NOW();

-- Genesis Chapter 11
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, verse_preview, translation_code, section_heading)
VALUES
    ('Genesis', 'Genesis', 1, 11, 1, 'Now the whole earth had one language and the same words.', 'Now the whole earth had ...', 'ESV', 'The Tower of Babel'),
    ('Genesis', 'Genesis', 1, 11, 2, 'And as people migrated from the east, they found a plain in the land of Shinar and settled there.', 'And as people migrated f...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 3, 'And they said to one another, "Come, let us make bricks, and burn them thoroughly." And they had brick for stone, and bitumen for mortar.', 'And they said to one ano...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 4, 'Then they said, "Come, let us build ourselves a city and a tower with its top in the heavens, and let us make a name for ourselves, lest we be dispersed over the face of the whole earth."', 'Then they said, "Come, l...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 5, 'And the LORD came down to see the city and the tower, which the children of man had built.', 'And the LORD came down t...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 6, 'And the LORD said, "Behold, they are one people, and they have all one language, and this is only the beginning of what they will do. And nothing that they propose to do will now be impossible for them.', 'And the LORD said, "Beho...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 7, 'Come, let us go down and there confuse their language, so that they may not understand one another''s speech."', 'Come, let us go down and...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 8, 'So the LORD dispersed them from there over the face of all the earth, and they left off building the city.', 'So the LORD dispersed th...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 9, 'Therefore its name was called Babel, because there the LORD confused the language of all the earth. And from there the LORD dispersed them over the face of all the earth.', 'Therefore its name was c...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 10, 'These are the generations of Shem. When Shem was 100 years old, he fathered Arpachshad two years after the flood.', 'These are the generation...', 'ESV', 'Shem''s Descendants'),
    ('Genesis', 'Genesis', 1, 11, 11, 'And Shem lived after he fathered Arpachshad 500 years and had other sons and daughters.', 'And Shem lived after he ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 12, 'When Arpachshad had lived 35 years, he fathered Shelah.', 'When Arpachshad had live...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 13, 'And Arpachshad lived after he fathered Shelah 403 years and had other sons and daughters.', 'And Arpachshad lived aft...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 14, 'When Shelah had lived 30 years, he fathered Eber.', 'When Shelah had lived 30...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 15, 'And Shelah lived after he fathered Eber 403 years and had other sons and daughters.', 'And Shelah lived after h...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 16, 'When Eber had lived 34 years, he fathered Peleg.', 'When Eber had lived 34 y...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 17, 'And Eber lived after he fathered Peleg 430 years and had other sons and daughters.', 'And Eber lived after he ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 18, 'When Peleg had lived 30 years, he fathered Reu.', 'When Peleg had lived 30 ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 19, 'And Peleg lived after he fathered Reu 209 years and had other sons and daughters.', 'And Peleg lived after he...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 20, 'When Reu had lived 32 years, he fathered Serug.', 'When Reu had lived 32 ye...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 21, 'And Reu lived after he fathered Serug 207 years and had other sons and daughters.', 'And Reu lived after he f...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 22, 'When Serug had lived 30 years, he fathered Nahor.', 'When Serug had lived 30 ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 23, 'And Serug lived after he fathered Nahor 200 years and had other sons and daughters.', 'And Serug lived after he...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 24, 'When Nahor had lived 29 years, he fathered Terah.', 'When Nahor had lived 29 ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 25, 'And Nahor lived after he fathered Terah 119 years and had other sons and daughters.', 'And Nahor lived after he...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 26, 'When Terah had lived 70 years, he fathered Abram, Nahor, and Haran.', 'When Terah had lived 70 ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 27, 'Now these are the generations of Terah. Terah fathered Abram, Nahor, and Haran; and Haran fathered Lot.', 'Now these are the genera...', 'ESV', 'Terah''s Descendants'),
    ('Genesis', 'Genesis', 1, 11, 28, 'Haran died in the presence of his father Terah in the land of his kindred, in Ur of the Chaldeans.', 'Haran died in the presen...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 29, 'And Abram and Nahor took wives. The name of Abram''s wife was Sarai, and the name of Nahor''s wife, Milcah, the daughter of Haran the father of Milcah and Iscah.', 'And Abram and Nahor took...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 30, 'Now Sarai was barren; she had no child.', 'Now Sarai was barren; sh...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 31, 'Terah took Abram his son and Lot the son of Haran, his grandson, and Sarai his daughter-in-law, his son Abram''s wife, and they went forth together from Ur of the Chaldeans to go into the land of Canaan, but when they came to Haran, they settled there.', 'Terah took Abram his son...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 11, 32, 'The days of Terah were 205 years, and Terah died in Haran.', 'The days of Terah were 2...', 'ESV', NULL)
ON CONFLICT (book_id, chapter_number, verse_number, translation_code) DO UPDATE SET
    verse_text = EXCLUDED.verse_text,
    verse_preview = EXCLUDED.verse_preview,
    section_heading = EXCLUDED.section_heading,
    updated_at = NOW();

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 081 complete: Genesis chapters 7-11 (ESV) inserted';
END $$;
