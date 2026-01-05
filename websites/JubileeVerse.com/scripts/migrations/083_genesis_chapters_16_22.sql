-- Migration: Insert Genesis chapters 16-22 (ESV)
-- Book: Genesis (book_id: genesis, book_order: 1)

-- Chapter 16: Sarai and Hagar
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, section_heading, translation_code)
VALUES
('genesis', 'Genesis', 1, 16, 1, 'Now Sarai, Abram''s wife, had borne him no children. She had a female Egyptian servant whose name was Hagar.', 'Sarai and Hagar', 'ESV'),
('genesis', 'Genesis', 1, 16, 2, 'And Sarai said to Abram, "Behold now, the LORD has prevented me from bearing children. Go in to my servant; it may be that I shall obtain children by her." And Abram listened to the voice of Sarai.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 16, 3, 'So, after Abram had lived ten years in the land of Canaan, Sarai, Abram''s wife, took Hagar the Egyptian, her servant, and gave her to Abram her husband as a wife.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 16, 4, 'And he went in to Hagar, and she conceived. And when she saw that she had conceived, she looked with contempt on her mistress.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 16, 5, 'And Sarai said to Abram, "May the wrong done to me be on you! I gave my servant to your embrace, and when she saw that she had conceived, she looked on me with contempt. May the LORD judge between you and me!"', NULL, 'ESV'),
('genesis', 'Genesis', 1, 16, 6, 'But Abram said to Sarai, "Behold, your servant is in your power; do to her as you please." Then Sarai dealt harshly with her, and she fled from her.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 16, 7, 'The angel of the LORD found her by a spring of water in the wilderness, the spring on the way to Shur.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 16, 8, 'And he said, "Hagar, servant of Sarai, where have you come from and where are you going?" She said, "I am fleeing from my mistress Sarai."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 16, 9, 'The angel of the LORD said to her, "Return to your mistress and submit to her."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 16, 10, 'The angel of the LORD also said to her, "I will surely multiply your offspring so that they cannot be numbered for multitude."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 16, 11, 'And the angel of the LORD said to her, "Behold, you are pregnant and shall bear a son. You shall call his name Ishmael, because the LORD has listened to your affliction.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 16, 12, 'He shall be a wild donkey of a man, his hand against everyone and everyone''s hand against him, and he shall dwell over against all his kinsmen."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 16, 13, 'So she called the name of the LORD who spoke to her, "You are a God of seeing," for she said, "Truly here I have seen him who looks after me."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 16, 14, 'Therefore the well was called Beer-lahai-roi; it lies between Kadesh and Bered.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 16, 15, 'And Hagar bore Abram a son, and Abram called the name of his son, whom Hagar bore, Ishmael.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 16, 16, 'Abram was eighty-six years old when Hagar bore Ishmael to Abram.', NULL, 'ESV')
ON CONFLICT (book_id, chapter_number, verse_number, translation_code)
DO UPDATE SET verse_text = EXCLUDED.verse_text, section_heading = EXCLUDED.section_heading;

-- Chapter 17: Abraham and the Covenant of Circumcision
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, section_heading, translation_code)
VALUES
('genesis', 'Genesis', 1, 17, 1, 'When Abram was ninety-nine years old the LORD appeared to Abram and said to him, "I am God Almighty; walk before me, and be blameless,', 'Abraham and the Covenant of Circumcision', 'ESV'),
('genesis', 'Genesis', 1, 17, 2, 'that I may make my covenant between me and you, and may multiply you greatly."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 3, 'Then Abram fell on his face. And God said to him,', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 4, '"Behold, my covenant is with you, and you shall be the father of a multitude of nations.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 5, 'No longer shall your name be called Abram, but your name shall be Abraham, for I have made you the father of a multitude of nations.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 6, 'I will make you exceedingly fruitful, and I will make you into nations, and kings shall come from you.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 7, 'And I will establish my covenant between me and you and your offspring after you throughout their generations for an everlasting covenant, to be God to you and to your offspring after you.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 8, 'And I will give to you and to your offspring after you the land of your sojournings, all the land of Canaan, for an everlasting possession, and I will be their God."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 9, 'And God said to Abraham, "As for you, you shall keep my covenant, you and your offspring after you throughout their generations.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 10, 'This is my covenant, which you shall keep, between me and you and your offspring after you: Every male among you shall be circumcised.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 11, 'You shall be circumcised in the flesh of your foreskins, and it shall be a sign of the covenant between me and you.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 12, 'He who is eight days old among you shall be circumcised. Every male throughout your generations, whether born in your house or bought with your money from any foreigner who is not of your offspring,', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 13, 'both he who is born in your house and he who is bought with your money, shall surely be circumcised. So shall my covenant be in your flesh an everlasting covenant.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 14, 'Any uncircumcised male who is not circumcised in the flesh of his foreskin shall be cut off from his people; he has broken my covenant."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 15, 'And God said to Abraham, "As for Sarai your wife, you shall not call her name Sarai, but Sarah shall be her name.', 'Isaac''s Birth Promised', 'ESV'),
('genesis', 'Genesis', 1, 17, 16, 'I will bless her, and moreover, I will give you a son by her. I will bless her, and she shall become nations; kings of peoples shall come from her."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 17, 'Then Abraham fell on his face and laughed and said to himself, "Shall a child be born to a man who is a hundred years old? Shall Sarah, who is ninety years old, bear a child?"', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 18, 'And Abraham said to God, "Oh that Ishmael might live before you!"', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 19, 'God said, "No, but Sarah your wife shall bear you a son, and you shall call his name Isaac. I will establish my covenant with him as an everlasting covenant for his offspring after him.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 20, 'As for Ishmael, I have heard you; behold, I have blessed him and will make him fruitful and multiply him greatly. He shall father twelve princes, and I will make him into a great nation.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 21, 'But I will establish my covenant with Isaac, whom Sarah shall bear to you at this time next year."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 22, 'When he had finished talking with him, God went up from Abraham.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 23, 'Then Abraham took Ishmael his son and all those born in his house or bought with his money, every male among the men of Abraham''s house, and he circumcised the flesh of their foreskins that very day, as God had said to him.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 24, 'Abraham was ninety-nine years old when he was circumcised in the flesh of his foreskin.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 25, 'And Ishmael his son was thirteen years old when he was circumcised in the flesh of his foreskin.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 26, 'That very day Abraham and his son Ishmael were circumcised.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 17, 27, 'And all the men of his house, those born in the house and those bought with money from a foreigner, were circumcised with him.', NULL, 'ESV')
ON CONFLICT (book_id, chapter_number, verse_number, translation_code)
DO UPDATE SET verse_text = EXCLUDED.verse_text, section_heading = EXCLUDED.section_heading;

-- Chapter 18: The LORD Visits Abraham
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, section_heading, translation_code)
VALUES
('genesis', 'Genesis', 1, 18, 1, 'And the LORD appeared to him by the oaks of Mamre, as he sat at the door of his tent in the heat of the day.', 'The Three Visitors', 'ESV'),
('genesis', 'Genesis', 1, 18, 2, 'He lifted up his eyes and looked, and behold, three men were standing in front of him. When he saw them, he ran from the tent door to meet them and bowed himself to the earth', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 3, 'and said, "O Lord, if I have found favor in your sight, do not pass by your servant.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 4, 'Let a little water be brought, and wash your feet, and rest yourselves under the tree,', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 5, 'while I bring a morsel of bread, that you may refresh yourselves, and after that you may pass on—since you have come to your servant." So they said, "Do as you have said."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 6, 'And Abraham went quickly into the tent to Sarah and said, "Quick! Three seahs of fine flour! Knead it, and make cakes."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 7, 'And Abraham ran to the herd and took a calf, tender and good, and gave it to a young man, who prepared it quickly.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 8, 'Then he took curds and milk and the calf that he had prepared, and set it before them. And he stood by them under the tree while they ate.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 9, 'They said to him, "Where is Sarah your wife?" And he said, "She is in the tent."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 10, 'The LORD said, "I will surely return to you about this time next year, and Sarah your wife shall have a son." And Sarah was listening at the tent door behind him.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 11, 'Now Abraham and Sarah were old, advanced in years. The way of women had ceased to be with Sarah.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 12, 'So Sarah laughed to herself, saying, "After I am worn out, and my lord is old, shall I have pleasure?"', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 13, 'The LORD said to Abraham, "Why did Sarah laugh and say, ''Shall I indeed bear a child, now that I am old?''', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 14, 'Is anything too hard for the LORD? At the appointed time I will return to you, about this time next year, and Sarah shall have a son."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 15, 'But Sarah denied it, saying, "I did not laugh," for she was afraid. He said, "No, but you did laugh."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 16, 'Then the men set out from there, and they looked down toward Sodom. And Abraham went with them to set them on their way.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 17, 'The LORD said, "Shall I hide from Abraham what I am about to do,', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 18, 'seeing that Abraham shall surely become a great and mighty nation, and all the nations of the earth shall be blessed in him?', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 19, 'For I have chosen him, that he may command his children and his household after him to keep the way of the LORD by doing righteousness and justice, so that the LORD may bring to Abraham what he has promised him."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 20, 'Then the LORD said, "Because the outcry against Sodom and Gomorrah is great and their sin is very grave,', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 21, 'I will go down to see whether they have done altogether according to the outcry that has come to me. And if not, I will know."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 22, 'So the men turned from there and went toward Sodom, but Abraham still stood before the LORD.', 'Abraham Intercedes for Sodom', 'ESV'),
('genesis', 'Genesis', 1, 18, 23, 'Then Abraham drew near and said, "Will you indeed sweep away the righteous with the wicked?', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 24, 'Suppose there are fifty righteous within the city. Will you then sweep away the place and not spare it for the fifty righteous who are in it?', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 25, 'Far be it from you to do such a thing, to put the righteous to death with the wicked, so that the righteous fare as the wicked! Far be that from you! Shall not the Judge of all the earth do what is just?"', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 26, 'And the LORD said, "If I find at Sodom fifty righteous in the city, I will spare the whole place for their sake."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 27, 'Abraham answered and said, "Behold, I have undertaken to speak to the Lord, I who am but dust and ashes.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 28, 'Suppose five of the fifty righteous are lacking. Will you destroy the whole city for lack of five?" And he said, "I will not destroy it if I find forty-five there."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 29, 'Again he spoke to him and said, "Suppose forty are found there." He answered, "For the sake of forty I will not do it."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 30, 'Then he said, "Oh let not the Lord be angry, and I will speak. Suppose thirty are found there." He answered, "I will not do it, if I find thirty there."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 31, 'He said, "Behold, I have undertaken to speak to the Lord. Suppose twenty are found there." He answered, "For the sake of twenty I will not destroy it."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 32, 'Then he said, "Oh let not the Lord be angry, and I will speak again but this once. Suppose ten are found there." He answered, "For the sake of ten I will not destroy it."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 18, 33, 'And the LORD went his way, when he had finished speaking to Abraham, and Abraham returned to his place.', NULL, 'ESV')
ON CONFLICT (book_id, chapter_number, verse_number, translation_code)
DO UPDATE SET verse_text = EXCLUDED.verse_text, section_heading = EXCLUDED.section_heading;

-- Chapter 19: God Rescues Lot
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, section_heading, translation_code)
VALUES
('genesis', 'Genesis', 1, 19, 1, 'The two angels came to Sodom in the evening, and Lot was sitting in the gate of Sodom. When Lot saw them, he rose to meet them and bowed himself with his face to the earth', 'God Rescues Lot', 'ESV'),
('genesis', 'Genesis', 1, 19, 2, 'and said, "My lords, please turn aside to your servant''s house and spend the night and wash your feet. Then you may rise up early and go on your way." They said, "No; we will spend the night in the town square."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 3, 'But he pressed them strongly; so they turned aside to him and entered his house. And he made them a feast and baked unleavened bread, and they ate.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 4, 'But before they lay down, the men of the city, the men of Sodom, both young and old, all the people to the last man, surrounded the house.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 5, 'And they called to Lot, "Where are the men who came to you tonight? Bring them out to us, that we may know them."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 6, 'Lot went out to the men at the entrance, shut the door after him,', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 7, 'and said, "I beg you, my brothers, do not act so wickedly.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 8, 'Behold, I have two daughters who have not known any man. Let me bring them out to you, and do to them as you please. Only do nothing to these men, for they have come under the shelter of my roof."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 9, 'But they said, "Stand back!" And they said, "This fellow came to sojourn, and he has become the judge! Now we will deal worse with you than with them." Then they pressed hard against the man Lot, and drew near to break the door down.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 10, 'But the men reached out their hands and brought Lot into the house with them and shut the door.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 11, 'And they struck with blindness the men who were at the entrance of the house, both small and great, so that they wore themselves out groping for the door.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 12, 'Then the men said to Lot, "Have you anyone else here? Sons-in-law, sons, daughters, or anyone you have in the city, bring them out of the place.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 13, 'For we are about to destroy this place, because the outcry against its people has become great before the LORD, and the LORD has sent us to destroy it."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 14, 'So Lot went out and said to his sons-in-law, who were to marry his daughters, "Up! Get out of this place, for the LORD is about to destroy the city." But he seemed to his sons-in-law to be jesting.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 15, 'As morning dawned, the angels urged Lot, saying, "Up! Take your wife and your two daughters who are here, lest you be swept away in the punishment of the city."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 16, 'But he lingered. So the men seized him and his wife and his two daughters by the hand, the LORD being merciful to him, and they brought him out and set him outside the city.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 17, 'And as they brought them out, one said, "Escape for your life. Do not look back or stop anywhere in the valley. Escape to the hills, lest you be swept away."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 18, 'And Lot said to them, "Oh, no, my lords.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 19, 'Behold, your servant has found favor in your sight, and you have shown me great kindness in saving my life. But I cannot escape to the hills, lest the disaster overtake me and I die.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 20, 'Behold, this city is near enough to flee to, and it is a little one. Let me escape there—is it not a little one?—and my life will be saved!"', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 21, 'He said to him, "Behold, I grant you this favor also, that I will not overthrow the city of which you have spoken.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 22, 'Escape there quickly, for I can do nothing till you arrive there." Therefore the name of the city was called Zoar.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 23, 'The sun had risen on the earth when Lot came to Zoar.', 'God Destroys Sodom', 'ESV'),
('genesis', 'Genesis', 1, 19, 24, 'Then the LORD rained on Sodom and Gomorrah sulfur and fire from the LORD out of heaven.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 25, 'And he overthrew those cities, and all the valley, and all the inhabitants of the cities, and what grew on the ground.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 26, 'But Lot''s wife, behind him, looked back, and she became a pillar of salt.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 27, 'And Abraham went early in the morning to the place where he had stood before the LORD.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 28, 'And he looked down toward Sodom and Gomorrah and toward all the land of the valley, and he looked and, behold, the smoke of the land went up like the smoke of a furnace.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 29, 'So it was that, when God destroyed the cities of the valley, God remembered Abraham and sent Lot out of the midst of the overthrow when he overthrew the cities in which Lot had lived.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 30, 'Now Lot went up out of Zoar and lived in the hills with his two daughters, for he was afraid to live in Zoar. So he lived in a cave with his two daughters.', 'Lot and His Daughters', 'ESV'),
('genesis', 'Genesis', 1, 19, 31, 'And the firstborn said to the younger, "Our father is old, and there is not a man on earth to come in to us after the manner of all the earth.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 32, 'Come, let us make our father drink wine, and we will lie with him, that we may preserve offspring from our father."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 33, 'So they made their father drink wine that night. And the firstborn went in and lay with her father. He did not know when she lay down or when she arose.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 34, 'The next day, the firstborn said to the younger, "Behold, I lay last night with my father. Let us make him drink wine tonight also. Then you go in and lie with him, that we may preserve offspring from our father."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 35, 'So they made their father drink wine that night also. And the younger arose and lay with him, and he did not know when she lay down or when she arose.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 36, 'Thus both the daughters of Lot became pregnant by their father.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 37, 'The firstborn bore a son and called his name Moab. He is the father of the Moabites to this day.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 19, 38, 'The younger also bore a son and called his name Ben-ammi. He is the father of the Ammonites to this day.', NULL, 'ESV')
ON CONFLICT (book_id, chapter_number, verse_number, translation_code)
DO UPDATE SET verse_text = EXCLUDED.verse_text, section_heading = EXCLUDED.section_heading;

-- Chapter 20: Abraham and Abimelech
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, section_heading, translation_code)
VALUES
('genesis', 'Genesis', 1, 20, 1, 'From there Abraham journeyed toward the territory of the Negeb and lived between Kadesh and Shur; and he sojourned in Gerar.', 'Abraham and Abimelech', 'ESV'),
('genesis', 'Genesis', 1, 20, 2, 'And Abraham said of Sarah his wife, "She is my sister." And Abimelech king of Gerar sent and took Sarah.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 20, 3, 'But God came to Abimelech in a dream by night and said to him, "Behold, you are a dead man because of the woman whom you have taken, for she is a man''s wife."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 20, 4, 'Now Abimelech had not approached her. So he said, "Lord, will you kill an innocent people?', NULL, 'ESV'),
('genesis', 'Genesis', 1, 20, 5, 'Did he not himself say to me, ''She is my sister''? And she herself said, ''He is my brother.'' In the integrity of my heart and the innocence of my hands I have done this."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 20, 6, 'Then God said to him in the dream, "Yes, I know that you have done this in the integrity of your heart, and it was I who kept you from sinning against me. Therefore I did not let you touch her.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 20, 7, 'Now then, return the man''s wife, for he is a prophet, so that he will pray for you, and you shall live. But if you do not return her, know that you shall surely die, you and all who are yours."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 20, 8, 'So Abimelech rose early in the morning and called all his servants and told them all these things. And the men were very much afraid.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 20, 9, 'Then Abimelech called Abraham and said to him, "What have you done to us? And how have I sinned against you, that you have brought on me and my kingdom a great sin? You have done to me things that ought not to be done."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 20, 10, 'And Abimelech said to Abraham, "What did you see, that you did this thing?"', NULL, 'ESV'),
('genesis', 'Genesis', 1, 20, 11, 'Abraham said, "I did it because I thought, There is no fear of God at all in this place, and they will kill me because of my wife.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 20, 12, 'Besides, she is indeed my sister, the daughter of my father though not the daughter of my mother, and she became my wife.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 20, 13, 'And when God caused me to wander from my father''s house, I said to her, ''This is the kindness you must do me: at every place to which we come, say of me, He is my brother.''"', NULL, 'ESV'),
('genesis', 'Genesis', 1, 20, 14, 'Then Abimelech took sheep and oxen, and male servants and female servants, and gave them to Abraham, and returned Sarah his wife to him.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 20, 15, 'And Abimelech said, "Behold, my land is before you; dwell where it pleases you."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 20, 16, 'To Sarah he said, "Behold, I have given your brother a thousand pieces of silver. It is a sign of your innocence in the eyes of all who are with you, and before everyone you are vindicated."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 20, 17, 'Then Abraham prayed to God, and God healed Abimelech, and also healed his wife and female slaves so that they bore children.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 20, 18, 'For the LORD had closed all the wombs of the house of Abimelech because of Sarah, Abraham''s wife.', NULL, 'ESV')
ON CONFLICT (book_id, chapter_number, verse_number, translation_code)
DO UPDATE SET verse_text = EXCLUDED.verse_text, section_heading = EXCLUDED.section_heading;

-- Chapter 21: The Birth of Isaac
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, section_heading, translation_code)
VALUES
('genesis', 'Genesis', 1, 21, 1, 'The LORD visited Sarah as he had said, and the LORD did to Sarah as he had promised.', 'The Birth of Isaac', 'ESV'),
('genesis', 'Genesis', 1, 21, 2, 'And Sarah conceived and bore Abraham a son in his old age at the time of which God had spoken to him.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 3, 'Abraham called the name of his son who was born to him, whom Sarah bore him, Isaac.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 4, 'And Abraham circumcised his son Isaac when he was eight days old, as God had commanded him.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 5, 'Abraham was a hundred years old when his son Isaac was born to him.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 6, 'And Sarah said, "God has made laughter for me; everyone who hears will laugh over me."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 7, 'And she said, "Who would have said to Abraham that Sarah would nurse children? Yet I have borne him a son in his old age."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 8, 'And the child grew and was weaned. And Abraham made a great feast on the day that Isaac was weaned.', 'God Protects Hagar and Ishmael', 'ESV'),
('genesis', 'Genesis', 1, 21, 9, 'But Sarah saw the son of Hagar the Egyptian, whom she had borne to Abraham, laughing.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 10, 'So she said to Abraham, "Cast out this slave woman with her son, for the son of this slave woman shall not be heir with my son Isaac."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 11, 'And the thing was very displeasing to Abraham on account of his son.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 12, 'But God said to Abraham, "Be not displeased because of the boy and because of your slave woman. Whatever Sarah says to you, do as she tells you, for through Isaac shall your offspring be named.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 13, 'And I will make a nation of the son of the slave woman also, because he is your offspring."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 14, 'So Abraham rose early in the morning and took bread and a skin of water and gave it to Hagar, putting it on her shoulder, along with the child, and sent her away. And she departed and wandered in the wilderness of Beersheba.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 15, 'When the water in the skin was gone, she put the child under one of the bushes.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 16, 'Then she went and sat down opposite him a good way off, about the distance of a bowshot, for she said, "Let me not look on the death of the child." And as she sat opposite him, she lifted up her voice and wept.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 17, 'And God heard the voice of the boy, and the angel of God called to Hagar from heaven and said to her, "What troubles you, Hagar? Fear not, for God has heard the voice of the boy where he is.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 18, 'Up! Lift up the boy, and hold him fast with your hand, for I will make him into a great nation."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 19, 'Then God opened her eyes, and she saw a well of water. And she went and filled the skin with water and gave the boy a drink.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 20, 'And God was with the boy, and he grew up. He lived in the wilderness and became an expert with the bow.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 21, 'He lived in the wilderness of Paran, and his mother took a wife for him from the land of Egypt.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 22, 'At that time Abimelech and Phicol the commander of his army said to Abraham, "God is with you in all that you do.', 'A Treaty with Abimelech', 'ESV'),
('genesis', 'Genesis', 1, 21, 23, 'Now therefore swear to me here by God that you will not deal falsely with me or with my descendants or with my posterity, but as I have dealt kindly with you, so you will deal with me and with the land where you have sojourned."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 24, 'And Abraham said, "I will swear."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 25, 'When Abraham reproved Abimelech about a well of water that Abimelech''s servants had seized,', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 26, 'Abimelech said, "I do not know who has done this thing; you did not tell me, and I have not heard of it until today."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 27, 'So Abraham took sheep and oxen and gave them to Abimelech, and the two men made a covenant.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 28, 'Abraham set seven ewe lambs of the flock apart.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 29, 'And Abimelech said to Abraham, "What is the meaning of these seven ewe lambs that you have set apart?"', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 30, 'He said, "These seven ewe lambs you will take from my hand, that this may be a witness for me that I dug this well."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 31, 'Therefore that place was called Beersheba, because there both of them swore an oath.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 32, 'So they made a covenant at Beersheba. Then Abimelech and Phicol the commander of his army rose up and returned to the land of the Philistines.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 33, 'Abraham planted a tamarisk tree in Beersheba and called there on the name of the LORD, the Everlasting God.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 21, 34, 'And Abraham sojourned many days in the land of the Philistines.', NULL, 'ESV')
ON CONFLICT (book_id, chapter_number, verse_number, translation_code)
DO UPDATE SET verse_text = EXCLUDED.verse_text, section_heading = EXCLUDED.section_heading;

-- Chapter 22: The Sacrifice of Isaac
INSERT INTO bible_verses (book_id, book_name, book_order, chapter_number, verse_number, verse_text, section_heading, translation_code)
VALUES
('genesis', 'Genesis', 1, 22, 1, 'After these things God tested Abraham and said to him, "Abraham!" And he said, "Here I am."', 'The Sacrifice of Isaac', 'ESV'),
('genesis', 'Genesis', 1, 22, 2, 'He said, "Take your son, your only son Isaac, whom you love, and go to the land of Moriah, and offer him there as a burnt offering on one of the mountains of which I shall tell you."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 3, 'So Abraham rose early in the morning, saddled his donkey, and took two of his young men with him, and his son Isaac. And he cut the wood for the burnt offering and arose and went to the place of which God had told him.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 4, 'On the third day Abraham lifted up his eyes and saw the place from afar.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 5, 'Then Abraham said to his young men, "Stay here with the donkey; I and the boy will go over there and worship and come again to you."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 6, 'And Abraham took the wood of the burnt offering and laid it on Isaac his son. And he took in his hand the fire and the knife. So they went both of them together.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 7, 'And Isaac said to his father Abraham, "My father!" And he said, "Here I am, my son." He said, "Behold, the fire and the wood, but where is the lamb for a burnt offering?"', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 8, 'Abraham said, "God will provide for himself the lamb for a burnt offering, my son." So they went both of them together.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 9, 'When they came to the place of which God had told him, Abraham built the altar there and laid the wood in order and bound Isaac his son and laid him on the altar, on top of the wood.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 10, 'Then Abraham reached out his hand and took the knife to slaughter his son.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 11, 'But the angel of the LORD called to him from heaven and said, "Abraham, Abraham!" And he said, "Here I am."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 12, 'He said, "Do not lay your hand on the boy or do anything to him, for now I know that you fear God, seeing you have not withheld your son, your only son, from me."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 13, 'And Abraham lifted up his eyes and looked, and behold, behind him was a ram, caught in a thicket by his horns. And Abraham went and took the ram and offered it up as a burnt offering instead of his son.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 14, 'So Abraham called the name of that place, "The LORD will provide"; as it is said to this day, "On the mount of the LORD it shall be provided."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 15, 'And the angel of the LORD called to Abraham a second time from heaven', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 16, 'and said, "By myself I have sworn, declares the LORD, because you have done this and have not withheld your son, your only son,', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 17, 'I will surely bless you, and I will surely multiply your offspring as the stars of heaven and as the sand that is on the seashore. And your offspring shall possess the gate of his enemies,', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 18, 'and in your offspring shall all the nations of the earth be blessed, because you have obeyed my voice."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 19, 'So Abraham returned to his young men, and they arose and went together to Beersheba. And Abraham lived at Beersheba.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 20, 'Now after these things it was told to Abraham, "Behold, Milcah also has borne children to your brother Nahor:', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 21, 'Uz his firstborn, Buz his brother, Kemuel the father of Aram,', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 22, 'Chesed, Hazo, Pildash, Jidlaph, and Bethuel."', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 23, '(Bethuel fathered Rebekah.) These eight Milcah bore to Nahor, Abraham''s brother.', NULL, 'ESV'),
('genesis', 'Genesis', 1, 22, 24, 'Moreover, his concubine, whose name was Reumah, bore Tebah, Gaham, Tahash, and Maacah.', NULL, 'ESV')
ON CONFLICT (book_id, chapter_number, verse_number, translation_code)
DO UPDATE SET verse_text = EXCLUDED.verse_text, section_heading = EXCLUDED.section_heading;
