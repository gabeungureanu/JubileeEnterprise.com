-- ============================================
-- JubileeVerse Database Schema
-- Migration 080: Genesis Chapters 2-31 (ESV)
-- ============================================

-- Genesis Chapter 2
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, verse_preview, translation_code, section_heading)
VALUES
    ('Genesis', 'Genesis', 1, 2, 1, 'Thus the heavens and the earth were finished, and all the host of them.', 'Thus the heavens and th...', 'ESV', 'The Seventh Day, God Rests'),
    ('Genesis', 'Genesis', 1, 2, 2, 'And on the seventh day God finished his work that he had done, and he rested on the seventh day from all his work that he had done.', 'And on the seventh day G...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 3, 'So God blessed the seventh day and made it holy, because on it God rested from all his work that he had done in creation.', 'So God blessed the seven...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 4, 'These are the generations of the heavens and the earth when they were created, in the day that the LORD God made the earth and the heavens.', 'These are the generation...', 'ESV', 'The Creation of Man and Woman'),
    ('Genesis', 'Genesis', 1, 2, 5, 'When no bush of the field was yet in the land and no small plant of the field had yet sprung up—for the LORD God had not caused it to rain on the land, and there was no man to work the ground,', 'When no bush of the fiel...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 6, 'and a mist was going up from the land and was watering the whole face of the ground—', 'and a mist was going up ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 7, 'then the LORD God formed the man of dust from the ground and breathed into his nostrils the breath of life, and the man became a living creature.', 'then the LORD God formed...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 8, 'And the LORD God planted a garden in Eden, in the east, and there he put the man whom he had formed.', 'And the LORD God planted...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 9, 'And out of the ground the LORD God made to spring up every tree that is pleasant to the sight and good for food. The tree of life was in the midst of the garden, and the tree of the knowledge of good and evil.', 'And out of the ground th...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 10, 'A river flowed out of Eden to water the garden, and there it divided and became four rivers.', 'A river flowed out of Ed...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 11, 'The name of the first is the Pishon. It is the one that flowed around the whole land of Havilah, where there is gold.', 'The name of the first is...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 12, 'And the gold of that land is good; bdellium and onyx stone are there.', 'And the gold of that lan...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 13, 'The name of the second river is the Gihon. It is the one that flowed around the whole land of Cush.', 'The name of the second r...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 14, 'And the name of the third river is the Tigris, which flows east of Assyria. And the fourth river is the Euphrates.', 'And the name of the thir...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 15, 'The LORD God took the man and put him in the garden of Eden to work it and keep it.', 'The LORD God took the ma...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 16, 'And the LORD God commanded the man, saying, "You may surely eat of every tree of the garden,', 'And the LORD God command...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 17, 'but of the tree of the knowledge of good and evil you shall not eat, for in the day that you eat of it you shall surely die."', 'but of the tree of the k...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 18, 'Then the LORD God said, "It is not good that the man should be alone; I will make him a helper fit for him."', 'Then the LORD God said, ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 19, 'Now out of the ground the LORD God had formed every beast of the field and every bird of the heavens and brought them to the man to see what he would call them. And whatever the man called every living creature, that was its name.', 'Now out of the ground th...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 20, 'The man gave names to all livestock and to the birds of the heavens and to every beast of the field. But for Adam there was not found a helper fit for him.', 'The man gave names to al...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 21, 'So the LORD God caused a deep sleep to fall upon the man, and while he slept took one of his ribs and closed up its place with flesh.', 'So the LORD God caused a...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 22, 'And the rib that the LORD God had taken from the man he made into a woman and brought her to the man.', 'And the rib that the LOR...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 23, 'Then the man said, "This at last is bone of my bones and flesh of my flesh; she shall be called Woman, because she was taken out of Man."', 'Then the man said, "This...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 24, 'Therefore a man shall leave his father and his mother and hold fast to his wife, and they shall become one flesh.', 'Therefore a man shall le...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 2, 25, 'And the man and his wife were both naked and were not ashamed.', 'And the man and his wife...', 'ESV', NULL)
ON CONFLICT (book_id, chapter_number, verse_number, translation_code) DO UPDATE SET
    verse_text = EXCLUDED.verse_text,
    verse_preview = EXCLUDED.verse_preview,
    section_heading = EXCLUDED.section_heading,
    updated_at = NOW();

-- Genesis Chapter 3
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, verse_preview, translation_code, section_heading)
VALUES
    ('Genesis', 'Genesis', 1, 3, 1, 'Now the serpent was more crafty than any other beast of the field that the LORD God had made. He said to the woman, "Did God actually say, ''You shall not eat of any tree in the garden''?"', 'Now the serpent was more...', 'ESV', 'The Fall'),
    ('Genesis', 'Genesis', 1, 3, 2, 'And the woman said to the serpent, "We may eat of the fruit of the trees in the garden,', 'And the woman said to th...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 3, 'but God said, ''You shall not eat of the fruit of the tree that is in the midst of the garden, neither shall you touch it, lest you die.''"', 'but God said, ''You shall...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 4, 'But the serpent said to the woman, "You will not surely die.', 'But the serpent said to ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 5, 'For God knows that when you eat of it your eyes will be opened, and you will be like God, knowing good and evil."', 'For God knows that when ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 6, 'So when the woman saw that the tree was good for food, and that it was a delight to the eyes, and that the tree was to be desired to make one wise, she took of its fruit and ate, and she also gave some to her husband who was with her, and he ate.', 'So when the woman saw th...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 7, 'Then the eyes of both were opened, and they knew that they were naked. And they sewed fig leaves together and made themselves loincloths.', 'Then the eyes of both we...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 8, 'And they heard the sound of the LORD God walking in the garden in the cool of the day, and the man and his wife hid themselves from the presence of the LORD God among the trees of the garden.', 'And they heard the sound...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 9, 'But the LORD God called to the man and said to him, "Where are you?"', 'But the LORD God called ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 10, 'And he said, "I heard the sound of you in the garden, and I was afraid, because I was naked, and I hid myself."', 'And he said, "I heard th...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 11, 'He said, "Who told you that you were naked? Have you eaten of the tree of which I commanded you not to eat?"', 'He said, "Who told you t...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 12, 'The man said, "The woman whom you gave to be with me, she gave me fruit of the tree, and I ate."', 'The man said, "The woman...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 13, 'Then the LORD God said to the woman, "What is this that you have done?" The woman said, "The serpent deceived me, and I ate."', 'Then the LORD God said t...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 14, 'The LORD God said to the serpent, "Because you have done this, cursed are you above all livestock and above all beasts of the field; on your belly you shall go, and dust you shall eat all the days of your life.', 'The LORD God said to the...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 15, 'I will put enmity between you and the woman, and between your offspring and her offspring; he shall bruise your head, and you shall bruise his heel."', 'I will put enmity betwee...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 16, 'To the woman he said, "I will surely multiply your pain in childbearing; in pain you shall bring forth children. Your desire shall be for your husband, and he shall rule over you."', 'To the woman he said, "I...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 17, 'And to Adam he said, "Because you have listened to the voice of your wife and have eaten of the tree of which I commanded you, ''You shall not eat of it,'' cursed is the ground because of you; in pain you shall eat of it all the days of your life;', 'And to Adam he said, "Be...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 18, 'thorns and thistles it shall bring forth for you; and you shall eat the plants of the field.', 'thorns and thistles it s...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 19, 'By the sweat of your face you shall eat bread, till you return to the ground, for out of it you were taken; for you are dust, and to dust you shall return."', 'By the sweat of your fac...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 20, 'The man called his wife''s name Eve, because she was the mother of all living.', 'The man called his wife''...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 21, 'And the LORD God made for Adam and for his wife garments of skins and clothed them.', 'And the LORD God made fo...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 22, 'Then the LORD God said, "Behold, the man has become like one of us in knowing good and evil. Now, lest he reach out his hand and take also of the tree of life and eat, and live forever—"', 'Then the LORD God said, ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 23, 'therefore the LORD God sent him out from the garden of Eden to work the ground from which he was taken.', 'therefore the LORD God s...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 3, 24, 'He drove out the man, and at the east of the garden of Eden he placed the cherubim and a flaming sword that turned every way to guard the way to the tree of life.', 'He drove out the man, an...', 'ESV', NULL)
ON CONFLICT (book_id, chapter_number, verse_number, translation_code) DO UPDATE SET
    verse_text = EXCLUDED.verse_text,
    verse_preview = EXCLUDED.verse_preview,
    section_heading = EXCLUDED.section_heading,
    updated_at = NOW();

-- Genesis Chapter 4
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, verse_preview, translation_code, section_heading)
VALUES
    ('Genesis', 'Genesis', 1, 4, 1, 'Now Adam knew Eve his wife, and she conceived and bore Cain, saying, "I have gotten a man with the help of the LORD."', 'Now Adam knew Eve his wi...', 'ESV', 'Cain and Abel'),
    ('Genesis', 'Genesis', 1, 4, 2, 'And again, she bore his brother Abel. Now Abel was a keeper of sheep, and Cain a worker of the ground.', 'And again, she bore his ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 3, 'In the course of time Cain brought to the LORD an offering of the fruit of the ground,', 'In the course of time Ca...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 4, 'and Abel also brought of the firstborn of his flock and of their fat portions. And the LORD had regard for Abel and his offering,', 'and Abel also brought of...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 5, 'but for Cain and his offering he had no regard. So Cain was very angry, and his face fell.', 'but for Cain and his off...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 6, 'The LORD said to Cain, "Why are you angry, and why has your face fallen?', 'The LORD said to Cain, "...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 7, 'If you do well, will you not be accepted? And if you do not do well, sin is crouching at the door. Its desire is for you, but you must rule over it."', 'If you do well, will you...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 8, 'Cain spoke to Abel his brother. And when they were in the field, Cain rose up against his brother Abel and killed him.', 'Cain spoke to Abel his b...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 9, 'Then the LORD said to Cain, "Where is Abel your brother?" He said, "I do not know; am I my brother''s keeper?"', 'Then the LORD said to Ca...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 10, 'And the LORD said, "What have you done? The voice of your brother''s blood is crying to me from the ground.', 'And the LORD said, "What...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 11, 'And now you are cursed from the ground, which has opened its mouth to receive your brother''s blood from your hand.', 'And now you are cursed f...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 12, 'When you work the ground, it shall no longer yield to you its strength. You shall be a fugitive and a wanderer on the earth."', 'When you work the ground...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 13, 'Cain said to the LORD, "My punishment is greater than I can bear.', 'Cain said to the LORD, "...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 14, 'Behold, you have driven me today away from the ground, and from your face I shall be hidden. I shall be a fugitive and a wanderer on the earth, and whoever finds me will kill me."', 'Behold, you have driven ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 15, 'Then the LORD said to him, "Not so! If anyone kills Cain, vengeance shall be taken on him sevenfold." And the LORD put a mark on Cain, lest any who found him should attack him.', 'Then the LORD said to hi...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 16, 'Then Cain went away from the presence of the LORD and settled in the land of Nod, east of Eden.', 'Then Cain went away from...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 17, 'Cain knew his wife, and she conceived and bore Enoch. When he built a city, he called the name of the city after the name of his son, Enoch.', 'Cain knew his wife, and ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 18, 'To Enoch was born Irad, and Irad fathered Mehujael, and Mehujael fathered Methushael, and Methushael fathered Lamech.', 'To Enoch was born Irad, ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 19, 'And Lamech took two wives. The name of the one was Adah, and the name of the other Zillah.', 'And Lamech took two wive...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 20, 'Adah bore Jabal; he was the father of those who dwell in tents and have livestock.', 'Adah bore Jabal; he was ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 21, 'His brother''s name was Jubal; he was the father of all those who play the lyre and pipe.', 'His brother''s name was J...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 22, 'Zillah also bore Tubal-cain; he was the forger of all instruments of bronze and iron. The sister of Tubal-cain was Naamah.', 'Zillah also bore Tubal-c...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 23, 'Lamech said to his wives: "Adah and Zillah, hear my voice; you wives of Lamech, listen to what I say: I have killed a man for wounding me, a young man for striking me.', 'Lamech said to his wives...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 24, 'If Cain''s revenge is sevenfold, then Lamech''s is seventy-sevenfold."', 'If Cain''s revenge is sev...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 25, 'And Adam knew his wife again, and she bore a son and called his name Seth, for she said, "God has appointed for me another offspring instead of Abel, for Cain killed him."', 'And Adam knew his wife a...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 4, 26, 'To Seth also a son was born, and he called his name Enosh. At that time people began to call upon the name of the LORD.', 'To Seth also a son was b...', 'ESV', NULL)
ON CONFLICT (book_id, chapter_number, verse_number, translation_code) DO UPDATE SET
    verse_text = EXCLUDED.verse_text,
    verse_preview = EXCLUDED.verse_preview,
    section_heading = EXCLUDED.section_heading,
    updated_at = NOW();

-- Genesis Chapter 5
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, verse_preview, translation_code, section_heading)
VALUES
    ('Genesis', 'Genesis', 1, 5, 1, 'This is the book of the generations of Adam. When God created man, he made him in the likeness of God.', 'This is the book of the ...', 'ESV', 'Adam''s Descendants to Noah'),
    ('Genesis', 'Genesis', 1, 5, 2, 'Male and female he created them, and he blessed them and named them Man when they were created.', 'Male and female he creat...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 3, 'When Adam had lived 130 years, he fathered a son in his own likeness, after his image, and named him Seth.', 'When Adam had lived 130 ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 4, 'The days of Adam after he fathered Seth were 800 years; and he had other sons and daughters.', 'The days of Adam after h...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 5, 'Thus all the days that Adam lived were 930 years, and he died.', 'Thus all the days that A...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 6, 'When Seth had lived 105 years, he fathered Enosh.', 'When Seth had lived 105 ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 7, 'Seth lived after he fathered Enosh 807 years and had other sons and daughters.', 'Seth lived after he fath...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 8, 'Thus all the days of Seth were 912 years, and he died.', 'Thus all the days of Set...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 9, 'When Enosh had lived 90 years, he fathered Kenan.', 'When Enosh had lived 90 ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 10, 'Enosh lived after he fathered Kenan 815 years and had other sons and daughters.', 'Enosh lived after he fat...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 11, 'Thus all the days of Enosh were 905 years, and he died.', 'Thus all the days of Eno...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 12, 'When Kenan had lived 70 years, he fathered Mahalalel.', 'When Kenan had lived 70 ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 13, 'Kenan lived after he fathered Mahalalel 840 years and had other sons and daughters.', 'Kenan lived after he fat...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 14, 'Thus all the days of Kenan were 910 years, and he died.', 'Thus all the days of Ken...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 15, 'When Mahalalel had lived 65 years, he fathered Jared.', 'When Mahalalel had lived...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 16, 'Mahalalel lived after he fathered Jared 830 years and had other sons and daughters.', 'Mahalalel lived after he...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 17, 'Thus all the days of Mahalalel were 895 years, and he died.', 'Thus all the days of Mah...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 18, 'When Jared had lived 162 years he fathered Enoch.', 'When Jared had lived 162...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 19, 'Jared lived after he fathered Enoch 800 years and had other sons and daughters.', 'Jared lived after he fat...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 20, 'Thus all the days of Jared were 962 years, and he died.', 'Thus all the days of Jar...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 21, 'When Enoch had lived 65 years, he fathered Methuselah.', 'When Enoch had lived 65 ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 22, 'Enoch walked with God after he fathered Methuselah 300 years and had other sons and daughters.', 'Enoch walked with God af...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 23, 'Thus all the days of Enoch were 365 years.', 'Thus all the days of Eno...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 24, 'Enoch walked with God, and he was not, for God took him.', 'Enoch walked with God, a...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 25, 'When Methuselah had lived 187 years, he fathered Lamech.', 'When Methuselah had live...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 26, 'Methuselah lived after he fathered Lamech 782 years and had other sons and daughters.', 'Methuselah lived after h...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 27, 'Thus all the days of Methuselah were 969 years, and he died.', 'Thus all the days of Met...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 28, 'When Lamech had lived 182 years, he fathered a son', 'When Lamech had lived 18...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 29, 'and called his name Noah, saying, "Out of the ground that the LORD has cursed this one shall bring us relief from our work and from the painful toil of our hands."', 'and called his name Noah...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 30, 'Lamech lived after he fathered Noah 595 years and had other sons and daughters.', 'Lamech lived after he fa...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 31, 'Thus all the days of Lamech were 777 years, and he died.', 'Thus all the days of Lam...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 5, 32, 'After Noah was 500 years old, Noah fathered Shem, Ham, and Japheth.', 'After Noah was 500 years...', 'ESV', NULL)
ON CONFLICT (book_id, chapter_number, verse_number, translation_code) DO UPDATE SET
    verse_text = EXCLUDED.verse_text,
    verse_preview = EXCLUDED.verse_preview,
    section_heading = EXCLUDED.section_heading,
    updated_at = NOW();

-- Genesis Chapter 6
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, verse_preview, translation_code, section_heading)
VALUES
    ('Genesis', 'Genesis', 1, 6, 1, 'When man began to multiply on the face of the land and daughters were born to them,', 'When man began to multip...', 'ESV', 'Increasing Corruption on Earth'),
    ('Genesis', 'Genesis', 1, 6, 2, 'the sons of God saw that the daughters of man were attractive. And they took as their wives any they chose.', 'the sons of God saw that...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 6, 3, 'Then the LORD said, "My Spirit shall not abide in man forever, for he is flesh: his days shall be 120 years."', 'Then the LORD said, "My ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 6, 4, 'The Nephilim were on the earth in those days, and also afterward, when the sons of God came in to the daughters of man and they bore children to them. These were the mighty men who were of old, the men of renown.', 'The Nephilim were on the...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 6, 5, 'The LORD saw that the wickedness of man was great in the earth, and that every intention of the thoughts of his heart was only evil continually.', 'The LORD saw that the wi...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 6, 6, 'And the LORD was sorry that he had made man on the earth, and it grieved him to his heart.', 'And the LORD was sorry t...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 6, 7, 'So the LORD said, "I will blot out man whom I have created from the face of the land, man and animals and creeping things and birds of the heavens, for I am sorry that I have made them."', 'So the LORD said, "I wil...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 6, 8, 'But Noah found favor in the eyes of the LORD.', 'But Noah found favor in ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 6, 9, 'These are the generations of Noah. Noah was a righteous man, blameless in his generation. Noah walked with God.', 'These are the generation...', 'ESV', 'Noah and the Flood'),
    ('Genesis', 'Genesis', 1, 6, 10, 'And Noah had three sons, Shem, Ham, and Japheth.', 'And Noah had three sons,...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 6, 11, 'Now the earth was corrupt in God''s sight, and the earth was filled with violence.', 'Now the earth was corrup...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 6, 12, 'And God saw the earth, and behold, it was corrupt, for all flesh had corrupted their way on the earth.', 'And God saw the earth, a...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 6, 13, 'And God said to Noah, "I have determined to make an end of all flesh, for the earth is filled with violence through them. Behold, I will destroy them with the earth.', 'And God said to Noah, "I...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 6, 14, 'Make yourself an ark of gopher wood. Make rooms in the ark, and cover it inside and out with pitch.', 'Make yourself an ark of ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 6, 15, 'This is how you are to make it: the length of the ark 300 cubits, its breadth 50 cubits, and its height 30 cubits.', 'This is how you are to m...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 6, 16, 'Make a roof for the ark, and finish it to a cubit above, and set the door of the ark in its side. Make it with lower, second, and third decks.', 'Make a roof for the ark,...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 6, 17, 'For behold, I will bring a flood of waters upon the earth to destroy all flesh in which is the breath of life under heaven. Everything that is on the earth shall die.', 'For behold, I will bring...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 6, 18, 'But I will establish my covenant with you, and you shall come into the ark, you, your sons, your wife, and your sons'' wives with you.', 'But I will establish my ...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 6, 19, 'And of every living thing of all flesh, you shall bring two of every sort into the ark to keep them alive with you. They shall be male and female.', 'And of every living thin...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 6, 20, 'Of the birds according to their kinds, and of the animals according to their kinds, of every creeping thing of the ground, according to its kind, two of every sort shall come in to you to keep them alive.', 'Of the birds according t...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 6, 21, 'Also take with you every sort of food that is eaten, and store it up. It shall serve as food for you and for them."', 'Also take with you every...', 'ESV', NULL),
    ('Genesis', 'Genesis', 1, 6, 22, 'Noah did this; he did all that God commanded him.', 'Noah did this; he did al...', 'ESV', NULL)
ON CONFLICT (book_id, chapter_number, verse_number, translation_code) DO UPDATE SET
    verse_text = EXCLUDED.verse_text,
    verse_preview = EXCLUDED.verse_preview,
    section_heading = EXCLUDED.section_heading,
    updated_at = NOW();

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 080 complete: Genesis chapters 2-6 (ESV) inserted';
END $$;
