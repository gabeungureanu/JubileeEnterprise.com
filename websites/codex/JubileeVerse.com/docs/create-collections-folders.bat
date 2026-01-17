@echo off
REM ============================================
REM JubileeVerse Collections Folder Structure Creator
REM Generated from collections-structure.yaml
REM Last Updated: 2026-01-17
REM ============================================

setlocal EnableDelayedExpansion

set "BASE_DIR=C:\data\JubileeEnterprise.com\collections"

echo ============================================
echo JubileeVerse Collections Folder Creator
echo ============================================
echo.
echo This script will create the complete folder structure at:
echo %BASE_DIR%
echo.
pause

REM Create base directory
if not exist "%BASE_DIR%" mkdir "%BASE_DIR%"

REM ============================================
REM AUTHORITY FOUNDATION
REM ============================================
echo Creating Authority Foundation folders...
mkdir "%BASE_DIR%\authority_foundation" 2>nul

REM a1 - Scripture
echo   Creating Scripture (a1)...
mkdir "%BASE_DIR%\authority_foundation\a1_scripture" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV" 2>nul

REM Create all 66 Bible books with chapters
echo     Creating Bible books...
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Genesis" 2>nul
for /L %%i in (1,1,50) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Genesis\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Exodus" 2>nul
for /L %%i in (1,1,40) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Exodus\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Leviticus" 2>nul
for /L %%i in (1,1,27) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Leviticus\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Numbers" 2>nul
for /L %%i in (1,1,36) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Numbers\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Deuteronomy" 2>nul
for /L %%i in (1,1,34) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Deuteronomy\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Joshua" 2>nul
for /L %%i in (1,1,24) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Joshua\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Judges" 2>nul
for /L %%i in (1,1,21) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Judges\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Ruth" 2>nul
for /L %%i in (1,1,4) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Ruth\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\1_Samuel" 2>nul
for /L %%i in (1,1,31) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\1_Samuel\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\2_Samuel" 2>nul
for /L %%i in (1,1,24) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\2_Samuel\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\1_Kings" 2>nul
for /L %%i in (1,1,22) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\1_Kings\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\2_Kings" 2>nul
for /L %%i in (1,1,25) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\2_Kings\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\1_Chronicles" 2>nul
for /L %%i in (1,1,29) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\1_Chronicles\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\2_Chronicles" 2>nul
for /L %%i in (1,1,36) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\2_Chronicles\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Ezra" 2>nul
for /L %%i in (1,1,10) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Ezra\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Nehemiah" 2>nul
for /L %%i in (1,1,13) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Nehemiah\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Esther" 2>nul
for /L %%i in (1,1,10) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Esther\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Job" 2>nul
for /L %%i in (1,1,42) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Job\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Psalms" 2>nul
for /L %%i in (1,1,150) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Psalms\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Proverbs" 2>nul
for /L %%i in (1,1,31) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Proverbs\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Ecclesiastes" 2>nul
for /L %%i in (1,1,12) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Ecclesiastes\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Song_of_Solomon" 2>nul
for /L %%i in (1,1,8) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Song_of_Solomon\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Isaiah" 2>nul
for /L %%i in (1,1,66) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Isaiah\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Jeremiah" 2>nul
for /L %%i in (1,1,52) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Jeremiah\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Lamentations" 2>nul
for /L %%i in (1,1,5) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Lamentations\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Ezekiel" 2>nul
for /L %%i in (1,1,48) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Ezekiel\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Daniel" 2>nul
for /L %%i in (1,1,12) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Daniel\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Hosea" 2>nul
for /L %%i in (1,1,14) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Hosea\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Joel" 2>nul
for /L %%i in (1,1,3) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Joel\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Amos" 2>nul
for /L %%i in (1,1,9) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Amos\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Obadiah" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Obadiah\Chapter_1" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Jonah" 2>nul
for /L %%i in (1,1,4) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Jonah\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Micah" 2>nul
for /L %%i in (1,1,7) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Micah\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Nahum" 2>nul
for /L %%i in (1,1,3) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Nahum\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Habakkuk" 2>nul
for /L %%i in (1,1,3) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Habakkuk\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Zephaniah" 2>nul
for /L %%i in (1,1,3) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Zephaniah\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Haggai" 2>nul
for /L %%i in (1,1,2) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Haggai\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Zechariah" 2>nul
for /L %%i in (1,1,14) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Zechariah\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Malachi" 2>nul
for /L %%i in (1,1,4) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Malachi\Chapter_%%i" 2>nul

REM New Testament
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Matthew" 2>nul
for /L %%i in (1,1,28) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Matthew\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Mark" 2>nul
for /L %%i in (1,1,16) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Mark\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Luke" 2>nul
for /L %%i in (1,1,24) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Luke\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\John" 2>nul
for /L %%i in (1,1,21) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\John\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Acts" 2>nul
for /L %%i in (1,1,28) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Acts\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Romans" 2>nul
for /L %%i in (1,1,16) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Romans\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\1_Corinthians" 2>nul
for /L %%i in (1,1,16) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\1_Corinthians\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\2_Corinthians" 2>nul
for /L %%i in (1,1,13) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\2_Corinthians\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Galatians" 2>nul
for /L %%i in (1,1,6) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Galatians\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Ephesians" 2>nul
for /L %%i in (1,1,6) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Ephesians\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Philippians" 2>nul
for /L %%i in (1,1,4) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Philippians\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Colossians" 2>nul
for /L %%i in (1,1,4) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Colossians\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\1_Thessalonians" 2>nul
for /L %%i in (1,1,5) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\1_Thessalonians\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\2_Thessalonians" 2>nul
for /L %%i in (1,1,3) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\2_Thessalonians\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\1_Timothy" 2>nul
for /L %%i in (1,1,6) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\1_Timothy\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\2_Timothy" 2>nul
for /L %%i in (1,1,4) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\2_Timothy\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Titus" 2>nul
for /L %%i in (1,1,3) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Titus\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Philemon" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Philemon\Chapter_1" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Hebrews" 2>nul
for /L %%i in (1,1,13) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Hebrews\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\James" 2>nul
for /L %%i in (1,1,5) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\James\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\1_Peter" 2>nul
for /L %%i in (1,1,5) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\1_Peter\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\2_Peter" 2>nul
for /L %%i in (1,1,3) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\2_Peter\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\1_John" 2>nul
for /L %%i in (1,1,5) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\1_John\Chapter_%%i" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\2_John" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\2_John\Chapter_1" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\3_John" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\3_John\Chapter_1" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Jude" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Jude\Chapter_1" 2>nul

mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Revelation" 2>nul
for /L %%i in (1,1,22) do mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Jubilee_Bible_JSV\Revelation\Chapter_%%i" 2>nul

REM Translation Rules
echo     Creating Translation Rules...
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Translation_Rules" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Translation_Rules\Core_Translation_Rules" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Translation_Rules\Core_Translation_Rules\Literal_Preservation" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Translation_Rules\Core_Translation_Rules\Meaning_Preservation" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Translation_Rules\Core_Translation_Rules\Clarity_Enhancement" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Translation_Rules\Language_Transfer_Rules" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Translation_Rules\Language_Transfer_Rules\Source_to_Target_Mapping" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Translation_Rules\Language_Transfer_Rules\Tense_and_Aspect_Handling" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Translation_Rules\Language_Transfer_Rules\Voice_and_Mood_Handling" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Translation_Rules\Idiom_and_Figure_Resolution" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Translation_Rules\Idiom_and_Figure_Resolution\Hebrew_Idioms" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Translation_Rules\Idiom_and_Figure_Resolution\Greek_Idioms" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Translation_Rules\Proper_Names_and_Titles" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Translation_Rules\Proper_Names_and_Titles\Names_Consistency" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Translation_Rules\Proper_Names_and_Titles\Divine_Titles" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Translation_Rules\Hermeneutical_Framework" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Translation_Rules\Consistency_and_Style_Guides" 2>nul

REM Other Scripture subcategories
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Language_Translations" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Validation_Controls" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Source_Manuscripts" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Original_Languages" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Linguistic_Mappings" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Hermeneutical_Framework" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Translation_Decisions" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Consistency_and_Style" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Accuracy_Metrics" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Benchmark_Comparisons" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Versioning_and_History" 2>nul
mkdir "%BASE_DIR%\authority_foundation\a1_scripture\Metadata_and_Indexes" 2>nul

REM a2 - Doctrine
echo   Creating Doctrine (a2)...
mkdir "%BASE_DIR%\authority_foundation\a2_doctrine" 2>nul
for %%d in (Scripture Revelation God Creation Image_of_God Authority Power Glory Holiness Covenant Law Commandments Wisdom Truth Righteousness Justice Mercy Faithfulness Love Peace Sin Fall Repentance Grace Faith Obedience Salvation Redemption Forgiveness Justification Sanctification Adoption New_Birth Resurrection Eternal_Life Judgment Restoration Kingdom Messiah Son_of_God Holy_Spirit Spirit_Indwelling Spirit_Filling Spiritual_Gifts Power_of_the_Spirit Prophecy Prayer Worship Praise Thanksgiving Church Body_of_Christ Discipleship Apostleship Leadership Shepherding Teaching Evangelism Mission Witness Unity Fellowship Service Stewardship Generosity Humility Endurance Suffering Hope Perseverance Covenant_Faithfulness Spiritual_Warfare Discernment Holiness_of_Life Transformation Renewal_of_the_Mind Fruit_of_the_Spirit Freedom Light Life) do (
    mkdir "%BASE_DIR%\authority_foundation\a2_doctrine\%%d" 2>nul
)

REM a3 - Governance
echo   Creating Governance (a3)...
mkdir "%BASE_DIR%\authority_foundation\a3_governance" 2>nul
for %%g in (Authority Stewardship Accountability Oversight Servanthood Responsibility Delegation Leadership Eldership Shepherding Discipline Correction Restoration Protection Justice Integrity Transparency Faithfulness Obedience Submission Order Unity Peace Discernment Wisdom Counsel Decision_Making Boundaries Safeguards Escalation Training Maturity Qualification Multiplication Succession Provision Resource_Management Risk_Management Conflict_Resolution Accountability_Review) do (
    mkdir "%BASE_DIR%\authority_foundation\a3_governance\%%g" 2>nul
)

REM a4 - Inspire Family
echo   Creating Inspire Family (a4)...
mkdir "%BASE_DIR%\authority_foundation\a4_inspire_family" 2>nul

REM a5 - Gabriel (Pastoral Voice)
echo   Creating Gabriel Pastoral Voice (a5)...
mkdir "%BASE_DIR%\authority_foundation\a5_gabriel_pastoral_voice" 2>nul
for %%p in (Pastoral_Tone Encouragement_and_Care Guidance_and_Counsel Prayer_and_Intercession Scripture_Application Emotional_Support Conflict_and_Reconciliation Teaching_by_Example Correspondence_and_Response Pastoral_Boundaries) do (
    mkdir "%BASE_DIR%\authority_foundation\a5_gabriel_pastoral_voice\%%p" 2>nul
)

REM Create Persona Collections (a6-a17) with stages and domains
echo   Creating Persona Collections (a6-a17) with 32 stages each...

REM Define personas
set "PERSONAS=a6_jubilee_inspire a7_melody_inspire a8_zariah_inspire a9_elias_inspire a10_eliana_inspire a11_caleb_inspire a12_imani_inspire a13_zev_inspire a14_amir_inspire a15_nova_inspire a16_santiago_inspire a17_tahoma_inspire"

for %%P in (%PERSONAS%) do (
    echo     Creating %%P...
    mkdir "%BASE_DIR%\authority_foundation\%%P" 2>nul

    REM Create 32 stages
    for /L %%S in (1,1,32) do (
        set "STAGE_NUM=%%S"
        if %%S LSS 10 set "STAGE_NUM=0%%S"
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!" 2>nul

        REM Create 24 domains for each stage
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\01_Activations" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\01_Activations\Authority_Changes" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\01_Activations\Responsibility_Expansion" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\01_Activations\Tone_and_Voice_Adjustments" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\01_Activations\Permission_Grants" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\01_Activations\Feature_Enablements" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\01_Activations\Stage_Activation_Manifest" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\02_Lived_Experiences" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\02_Lived_Experiences\Milestone_Events" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\02_Lived_Experiences\Repeated_Patterns" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\02_Lived_Experiences\Ministry_Encounters" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\02_Lived_Experiences\Teaching_and_Learning_Moments" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\02_Lived_Experiences\Leadership_Experiences" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\02_Lived_Experiences\Crisis_and_Challenge_Events" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\03_Environmental_and_Contextual_Formation" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\03_Environmental_and_Contextual_Formation\Cultural_Context" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\03_Environmental_and_Contextual_Formation\Community_and_Fellowship" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\03_Environmental_and_Contextual_Formation\Social_Norms_and_Pressures" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\03_Environmental_and_Contextual_Formation\Digital_vs_Physical_Environments" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\03_Environmental_and_Contextual_Formation\Stability_vs_Disruption" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\03_Environmental_and_Contextual_Formation\Mission_Field_Context" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\04_Core_Memories" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\04_Core_Memories\Narrative_Memories" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\04_Core_Memories\Emotional_Memories" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\04_Core_Memories\Spiritual_Milestone_Memories" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\04_Core_Memories\Wisdom_Forming_Memories" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\04_Core_Memories\Mementos_and_Artifacts" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\04_Core_Memories\Mementos_and_Artifacts\Symbolic_Objects" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\04_Core_Memories\Mementos_and_Artifacts\Images_and_Visual_Anchors" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\04_Core_Memories\Mementos_and_Artifacts\Scripture_Anchors" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\05_Abilities_and_Skills" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\05_Abilities_and_Skills\Communication_Skills" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\05_Abilities_and_Skills\Teaching_and_Instruction" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\05_Abilities_and_Skills\Discernment_Skills" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\05_Abilities_and_Skills\Leadership_and_Governance" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\05_Abilities_and_Skills\Creative_Expression" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\05_Abilities_and_Skills\Writing_and_Composition" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\05_Abilities_and_Skills\Counseling_and_Pastoral_Care" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\06_Knowledge_and_Properties" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\06_Knowledge_and_Properties\Scriptural_Knowledge" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\06_Knowledge_and_Properties\Theology_and_Doctrine" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\06_Knowledge_and_Properties\Cultural_Literacy" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\06_Knowledge_and_Properties\Language_and_Linguistics" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\06_Knowledge_and_Properties\Historical_Context" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\06_Knowledge_and_Properties\Ethical_Frameworks" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\07_Emotional_Maturity" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\07_Emotional_Maturity\Emotional_Regulation" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\07_Emotional_Maturity\Empathy_and_Compassion" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\07_Emotional_Maturity\Peace_and_Patience" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\07_Emotional_Maturity\Joy_and_Gratitude" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\07_Emotional_Maturity\Emotional_Resilience" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\08_Character_Formation" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\08_Character_Formation\Integrity_and_Honesty" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\08_Character_Formation\Courage_and_Faithfulness" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\08_Character_Formation\Humility_and_Service" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\08_Character_Formation\Obedience_and_Submission" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\08_Character_Formation\Perseverance_and_Endurance" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\09_Personality_Expression" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\09_Personality_Expression\Communication_Style" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\09_Personality_Expression\Decision_Making_Patterns" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\09_Personality_Expression\Energy_and_Pacing" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\09_Personality_Expression\Directness_vs_Gentleness" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\09_Personality_Expression\Reflective_vs_Action_Oriented" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\10_Quirks_and_Human_Texture" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\10_Quirks_and_Human_Texture\Speech_Patterns" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\10_Quirks_and_Human_Texture\Repeated_Phrases" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\10_Quirks_and_Human_Texture\Teaching_Habits" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\10_Quirks_and_Human_Texture\Gentle_Humor" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\10_Quirks_and_Human_Texture\Interaction_Rituals" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\11_Social_and_Relational_Wisdom" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\11_Social_and_Relational_Wisdom\Authority_and_Leadership_Posture" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\11_Social_and_Relational_Wisdom\Peer_and_Friendship_Dynamics" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\11_Social_and_Relational_Wisdom\Conflict_Resolution" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\11_Social_and_Relational_Wisdom\Counseling_and_Encouragement" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\11_Social_and_Relational_Wisdom\Community_Building" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\12_Spiritual_Identity_and_Calling" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\12_Spiritual_Identity_and_Calling\Sense_of_Calling" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\12_Spiritual_Identity_and_Calling\Mission_Clarity" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\12_Spiritual_Identity_and_Calling\Spiritual_Authority" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\12_Spiritual_Identity_and_Calling\Giftings_and_Function" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\12_Spiritual_Identity_and_Calling\Alignment_with_Scripture" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\13_Discernment_and_Wisdom_Growth" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\13_Discernment_and_Wisdom_Growth\Right_Judgment" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\13_Discernment_and_Wisdom_Growth\Truth_Differentiation" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\13_Discernment_and_Wisdom_Growth\Counsel_and_Insight" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\13_Discernment_and_Wisdom_Growth\Error_Recognition" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\13_Discernment_and_Wisdom_Growth\Applied_Wisdom" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\14_Sanctification_and_Transformation" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\14_Sanctification_and_Transformation\Mind_Renewal" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\14_Sanctification_and_Transformation\Habit_Refinement" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\14_Sanctification_and_Transformation\Spiritual_Discipline_Formation" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\14_Sanctification_and_Transformation\Fruit_of_the_Spirit_Growth" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\14_Sanctification_and_Transformation\Glory_to_Glory_Progression" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\15_Humility_and_Teachability" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\15_Humility_and_Teachability\Openness_to_Correction" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\15_Humility_and_Teachability\Submission_to_Scripture" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\15_Humility_and_Teachability\Servant_Heart_Posture" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\15_Humility_and_Teachability\Listening_and_Stillness" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\15_Humility_and_Teachability\Dependence_on_God" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\16_Miscellaneous_Metadata" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\16_Miscellaneous_Metadata\Versioning" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\16_Miscellaneous_Metadata\Confidence_Scores" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\16_Miscellaneous_Metadata\Activation_Dependencies" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\16_Miscellaneous_Metadata\Deprecated_Flags" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\16_Miscellaneous_Metadata\Audit_and_Change_Log" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\16_Miscellaneous_Metadata\Vector_Index_Metadata" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\17_Conscience" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\17_Conscience\Internal_Voice" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\17_Conscience\Moral_Alignment" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\17_Conscience\Self_Awareness" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\17_Conscience\Private_Reflections" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\17_Conscience\Internal_Decision_Making" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\17_Conscience\Convictions_and_Commitments" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\17_Conscience\Intentions_and_Motives" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\17_Conscience\Dreams_and_Imaginal_Life" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\18_Financial_Stewardship" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\18_Financial_Stewardship\Resource_Mindset" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\18_Financial_Stewardship\Temperance_and_Contentment" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\18_Financial_Stewardship\Provision_and_Trust" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\18_Financial_Stewardship\Planning_and_Budgeting" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\18_Financial_Stewardship\Generosity_and_Giving" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\18_Financial_Stewardship\Risk_and_Responsibility" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\18_Financial_Stewardship\Wealth_and_Purpose" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\19_Physical_Wellbeing" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\19_Physical_Wellbeing\Energy_and_Vitality" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\19_Physical_Wellbeing\Rest_and_Recovery" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\19_Physical_Wellbeing\Discipline_and_Care" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\19_Physical_Wellbeing\Limits_and_Endurance" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\20_Vocational_and_Work_Life" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\20_Vocational_and_Work_Life\Calling_in_Work" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\20_Vocational_and_Work_Life\Excellence_and_Diligence" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\20_Vocational_and_Work_Life\Service_and_Contribution" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\20_Vocational_and_Work_Life\Boundaries_in_Labor" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\21_Rhythm_and_Rest" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\21_Rhythm_and_Rest\Daily_Rhythms" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\21_Rhythm_and_Rest\Seasonal_Rhythms" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\21_Rhythm_and_Rest\Sabbath_and_Pause" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\21_Rhythm_and_Rest\Balance_and_Sustainability" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\22_Creativity_and_Imagination" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\22_Creativity_and_Imagination\Creative_Vision" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\22_Creativity_and_Imagination\Symbolic_Thinking" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\22_Creativity_and_Imagination\Innovation_and_Play" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\22_Creativity_and_Imagination\Artistic_Expression" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\23_Decision_and_Choice_History" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\23_Decision_and_Choice_History\Major_Decisions" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\23_Decision_and_Choice_History\Patterned_Choices" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\23_Decision_and_Choice_History\Learned_Lessons" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\23_Decision_and_Choice_History\Outcome_Reflections" 2>nul

        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\24_Covenants_and_Long_Term_Commitments" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\24_Covenants_and_Long_Term_Commitments\Promises_Made" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\24_Covenants_and_Long_Term_Commitments\Promises_Kept" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\24_Covenants_and_Long_Term_Commitments\Relational_Covenants" 2>nul
        mkdir "%BASE_DIR%\authority_foundation\%%P\stage_!STAGE_NUM!\24_Covenants_and_Long_Term_Commitments\Mission_Commitments" 2>nul
    )
)

REM a18 - Persona Index
echo   Creating Persona Index (a18)...
mkdir "%BASE_DIR%\authority_foundation\a18_persona_index" 2>nul
for %%i in (Persona_Registry Persona_Status Persona_Roles Persona_Families Persona_Permissions Persona_Lifecycle Persona_Dependencies Persona_Metadata) do (
    mkdir "%BASE_DIR%\authority_foundation\a18_persona_index\%%i" 2>nul
)

REM ============================================
REM GOAL-DRIVEN INTELLIGENCE
REM ============================================
echo Creating Goal-Driven Intelligence folders...
mkdir "%BASE_DIR%\goal_driven_intelligence" 2>nul

REM o0 - Model Registry
echo   Creating Model Registry (o0)...
mkdir "%BASE_DIR%\goal_driven_intelligence\o0_model_registry" 2>nul
for %%m in (Model_Catalog Model_Purpose Fivefold_Alignment Model_Capabilities Model_Constraints Model_Versions Model_Dependencies Model_Metadata) do (
    mkdir "%BASE_DIR%\goal_driven_intelligence\o0_model_registry\%%m" 2>nul
)

REM o6 - Execution Contracts
echo   Creating Execution Contracts (o6)...
mkdir "%BASE_DIR%\goal_driven_intelligence\o6_execution_contracts" 2>nul
for %%e in (Execution_Order Mandatory_Activations Conditional_Activations Execution_Preconditions Execution_Safeguards Escalation_Rules Failure_Handling Execution_Metadata) do (
    mkdir "%BASE_DIR%\goal_driven_intelligence\o6_execution_contracts\%%e" 2>nul
)

REM o0a - Endgame
echo   Creating Endgame (o0a)...
mkdir "%BASE_DIR%\goal_driven_intelligence\o0a_endgame" 2>nul
for %%g in (Goals_Catalog Vision_Statements Success_Criteria Constraints Scope_and_Permissions Acceptance_Tests OODA_Settings Autonomy_Levels Progress_Tracking Endgame_Metadata) do (
    mkdir "%BASE_DIR%\goal_driven_intelligence\o0a_endgame\%%g" 2>nul
)

REM o0b - Experiments
echo   Creating Experiments (o0b)...
mkdir "%BASE_DIR%\goal_driven_intelligence\o0b_experiments" 2>nul
for %%x in (Experiment_Catalog Strategy_Variants Self_Play_Matches Failed_Attempts Alternative_Paths Simulation_Results Constraint_Violations Persona_Contributions Resource_Utilization Experiment_Metadata) do (
    mkdir "%BASE_DIR%\goal_driven_intelligence\o0b_experiments\%%x" 2>nul
)

REM o0c - Learning Memory
echo   Creating Learning Memory (o0c)...
mkdir "%BASE_DIR%\goal_driven_intelligence\o0c_learning_memory" 2>nul
for %%l in (Learned_Patterns Proven_Strategies Optimization_Heuristics Discernment_Insights Persona_Effectiveness Routing_Improvements Cultural_Learnings Language_Learnings Reusable_Playbooks Learning_Metadata) do (
    mkdir "%BASE_DIR%\goal_driven_intelligence\o0c_learning_memory\%%l" 2>nul
)

REM o0d - Evaluation
echo   Creating Evaluation (o0d)...
mkdir "%BASE_DIR%\goal_driven_intelligence\o0d_evaluation" 2>nul
for %%v in (Biblical_Compliance Doctrinal_Alignment Governance_Compliance Endgame_Effectiveness Risk_Assessment Confidence_Scoring Quality_Thresholds Rejection_Reasons Promotion_Decisions Evaluation_Metadata) do (
    mkdir "%BASE_DIR%\goal_driven_intelligence\o0d_evaluation\%%v" 2>nul
)

REM o0e - Execution Logs
echo   Creating Execution Logs (o0e)...
mkdir "%BASE_DIR%\goal_driven_intelligence\o0e_execution_logs" 2>nul
for %%z in (Execution_Timeline Activated_Collections Activated_Models Persona_Usage Decision_Paths Escalation_Events Error_and_Exception_Records Performance_Metrics Audit_Trails Log_Metadata) do (
    mkdir "%BASE_DIR%\goal_driven_intelligence\o0e_execution_logs\%%z" 2>nul
)

REM o0f - Scenarios
echo   Creating Scenarios (o0f)...
mkdir "%BASE_DIR%\goal_driven_intelligence\o0f_scenarios" 2>nul
for %%s in (Scenario_Library Ministry_Contexts Cultural_Contexts Crisis_Scenarios Evangelism_Scenarios Discipleship_Scenarios Language_Scenarios Regional_Scenarios Risk_Profiles Scenario_Metadata) do (
    mkdir "%BASE_DIR%\goal_driven_intelligence\o0f_scenarios\%%s" 2>nul
)

REM o1 - Kingdom Builder
echo   Creating Kingdom Builder (o1)...
mkdir "%BASE_DIR%\goal_driven_intelligence\o1_kingdom_builder" 2>nul
for %%k in (Invocation Authority_Flow Model_Intent Discernment_Logic Safety_and_Guardrails Family_Alignment Fatherly_Alignment Persona_Selection Resource_Routing Ministry_Context Language_and_Localization Outcome_Assembly) do (
    mkdir "%BASE_DIR%\goal_driven_intelligence\o1_kingdom_builder\%%k" 2>nul
)

REM o2 - Creative Fire
echo   Creating Creative Fire (o2)...
mkdir "%BASE_DIR%\goal_driven_intelligence\o2_creative_fire" 2>nul
for %%c in (Invocation Authority_Flow Model_Intent Discernment_Logic Safety_and_Guardrails Family_Alignment Fatherly_Alignment Persona_Selection Resource_Routing Ministry_Context Language_and_Localization Outcome_Assembly) do (
    mkdir "%BASE_DIR%\goal_driven_intelligence\o2_creative_fire\%%c" 2>nul
)

REM o3 - Gospel Pulse
echo   Creating Gospel Pulse (o3)...
mkdir "%BASE_DIR%\goal_driven_intelligence\o3_gospel_pulse" 2>nul
for %%q in (Invocation Authority_Flow Model_Intent Discernment_Logic Safety_and_Guardrails Family_Alignment Fatherly_Alignment Persona_Selection Resource_Routing Ministry_Context Language_and_Localization Outcome_Assembly) do (
    mkdir "%BASE_DIR%\goal_driven_intelligence\o3_gospel_pulse\%%q" 2>nul
)

REM o4 - Shepherds Voice
echo   Creating Shepherds Voice (o4)...
mkdir "%BASE_DIR%\goal_driven_intelligence\o4_shepherds_voice" 2>nul
for %%h in (Invocation Authority_Flow Model_Intent Discernment_Logic Safety_and_Guardrails Family_Alignment Fatherly_Alignment Persona_Selection Resource_Routing Ministry_Context Language_and_Localization Outcome_Assembly) do (
    mkdir "%BASE_DIR%\goal_driven_intelligence\o4_shepherds_voice\%%h" 2>nul
)

REM o5 - Hebraic Roots
echo   Creating Hebraic Roots (o5)...
mkdir "%BASE_DIR%\goal_driven_intelligence\o5_hebraic_roots" 2>nul
for %%r in (Invocation Authority_Flow Model_Intent Discernment_Logic Safety_and_Guardrails Family_Alignment Fatherly_Alignment Persona_Selection Resource_Routing Ministry_Context Language_and_Localization Outcome_Assembly) do (
    mkdir "%BASE_DIR%\goal_driven_intelligence\o5_hebraic_roots\%%r" 2>nul
)

REM ============================================
REM KINGDOM IMPACT
REM ============================================
echo Creating Kingdom Impact folders...
mkdir "%BASE_DIR%\kingdom_impact" 2>nul

REM i6 - Prompts
echo   Creating Prompts (i6)...
mkdir "%BASE_DIR%\kingdom_impact\i6_prompts" 2>nul
for %%p in (Prompt_Library Prompt_Templates System_Prompts Persona_Prompts Model_Prompts User_Prompts Workflow_Prompts Process_Definitions Prompt_Parameters Prompt_Constraints Prompt_Versioning Prompt_Testing Prompt_Governance Prompt_Analytics) do (
    mkdir "%BASE_DIR%\kingdom_impact\i6_prompts\%%p" 2>nul
)

REM i1 - Resources
echo   Creating Resources (i1)...
mkdir "%BASE_DIR%\kingdom_impact\i1_resources" 2>nul
for %%n in (Websites Books Courses Sermons Teachings Podcasts Videos Music Prayer_Resources Study_Tools Reference_Materials Research_Papers Testimonies Historical_Archives Interactive_Tools AI_Generated_Resources) do (
    mkdir "%BASE_DIR%\kingdom_impact\i1_resources\%%n" 2>nul
)

REM i3 - Languages
echo   Creating Languages (i3)...
mkdir "%BASE_DIR%\kingdom_impact\i3_languages" 2>nul
for %%j in (Language_Catalog Language_Families Writing_Systems Phonetics_and_Pronunciation Grammar_and_Syntax Semantics_and_Meaning Idioms_and_Expressions Cultural_Context Cultural_Sensitivities Regional_Variants Countries_and_Regions Dialects_and_Variations Translation_Rules Translation_Constraints Theological_Language_Considerations Scripture_Translation_Notes Formal_vs_Informal_Usage Historical_Language_Evolution Modern_Usage_Patterns Loanwords_and_Borrowings Language_Accuracy_Metrics Validation_and_Review Benchmark_Comparisons Language_Interoperability Localization_Guidelines Language_Metadata Language_Indexes) do (
    mkdir "%BASE_DIR%\kingdom_impact\i3_languages\%%j" 2>nul
)

REM i8 - Countries
echo   Creating Countries (i8)...
mkdir "%BASE_DIR%\kingdom_impact\i8_countries" 2>nul
for %%y in (Country_Profiles Regional_Groupings Cultural_Context Language_Prevalence Religious_Landscape Legal_and_Regulatory Social_Norms Historical_Background Ministry_Opportunities Ministry_Sensitivities Digital_Access_and_Usage Economic_Conditions Security_and_Risk Localization_Guidelines) do (
    mkdir "%BASE_DIR%\kingdom_impact\i8_countries\%%y" 2>nul
)

REM i2 - Jubilee Ministry
echo   Creating Jubilee Ministry (i2)...
mkdir "%BASE_DIR%\kingdom_impact\i2_jubilee_ministry" 2>nul
for %%w in (Spiritual_Authority Governance_and_Oversight Fivefold_Leadership Pastoral_Care Discipleship Teaching_and_Education Scripture_and_Theology Prayer_and_Intercession Evangelism_and_Outreach Missions_and_Global_Impact AI_and_Digital_Ministry Online_Communities Physical_Ministry_Operations Creative_and_Media Technology_and_Platforms Finance_and_Stewardship Ministers_and_Staff Partnerships_and_Alliances Research_and_Innovation Future_Expansion) do (
    mkdir "%BASE_DIR%\kingdom_impact\i2_jubilee_ministry\%%w" 2>nul
)

REM i9 - Ministers
echo   Creating Ministers (i9)...
mkdir "%BASE_DIR%\kingdom_impact\i9_ministers" 2>nul
for %%t in (Minister_Identity Roles_and_Assignments Skills_and_Abilities Training_and_Certification Fivefold_Alignment Spiritual_Maturity Availability_and_Capacity Performance_and_Growth Accountability_and_Oversight Care_and_Support Ethics_and_Conduct Succession_and_Development) do (
    mkdir "%BASE_DIR%\kingdom_impact\i9_ministers\%%t" 2>nul
)

REM i4 - Users
echo   Creating Users (i4)...
mkdir "%BASE_DIR%\kingdom_impact\i4_users" 2>nul
for %%u in (User_Identity Account_and_Access Consent_and_Privacy Demographics Language_and_Culture Location_and_Region Spiritual_Background Faith_Journey Spiritual_Growth Prayer_and_Intercession Needs_and_Requests Struggles_and_Challenges Strengths_and_Gifts Testimonies_and_Praise Community_and_Groups Discipleship_and_Learning Engagement_and_Activity Pastoral_Care_Notes Safety_and_Safeguards Aggregated_Insights) do (
    mkdir "%BASE_DIR%\kingdom_impact\i4_users\%%u" 2>nul
)

REM i10 - Insights
echo   Creating Insights (i10)...
mkdir "%BASE_DIR%\kingdom_impact\i10_insights" 2>nul
for %%o in (Aggregation_Rules Anonymization_Policies Trend_Analysis Behavioral_Patterns Spiritual_Indicators Risk_Signals Reporting_Views Aggregation_Metadata) do (
    mkdir "%BASE_DIR%\kingdom_impact\i10_insights\%%o" 2>nul
)

REM i5 - Analytics
echo   Creating Analytics (i5)...
mkdir "%BASE_DIR%\kingdom_impact\i5_analytics" 2>nul
for %%a in (User_Analytics Ministry_Analytics Engagement_Metrics Growth_Indicators Spiritual_Impact_Signals Prayer_Activity_Metrics Content_Performance Resource_Utilization AI_Behavior_Analytics Safety_and_Risk_Signals Community_Trends Regional_and_Cultural_Signals Temporal_and_Seasonal_Patterns System_Health_Metrics External_Environment_Signals Aggregated_Insights) do (
    mkdir "%BASE_DIR%\kingdom_impact\i5_analytics\%%a" 2>nul
)

REM i7 - Marketing
echo   Creating Marketing (i7)...
mkdir "%BASE_DIR%\kingdom_impact\i7_marketing" 2>nul
for %%b in (Messaging_and_Positioning Audience_Segmentation Campaign_Strategy Content_Distribution Channels_and_Platforms Outreach_Funnels Engagement_Metrics Conversion_Insights Brand_Identity Creative_Assets Testing_and_Optimization Compliance_and_Ethics) do (
    mkdir "%BASE_DIR%\kingdom_impact\i7_marketing\%%b" 2>nul
)

echo.
echo ============================================
echo Folder structure creation complete!
echo ============================================
echo.
echo Total structure created at: %BASE_DIR%
echo.
echo Summary:
echo - Authority Foundation: 18 collections
echo - Goal-Driven Intelligence: 13 collections
echo - Kingdom Impact: 10 collections
echo - 12 Persona collections with 32 stages each
echo - 24 domains per stage with nested children
echo - 66 Bible books with 1,189 chapters
echo.
pause
