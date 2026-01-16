/**
 * SentimentAnalyzer.js
 *
 * Utility for analyzing sentiment of search results.
 * Uses a positive/negative word lexicon to score content.
 */

class SentimentAnalyzer {
    constructor() {
        // Positive words lexicon (faith-oriented and general positive terms)
        this.positiveWords = new Set([
            // Faith-related positive
            'blessed', 'blessing', 'blessings', 'grace', 'faith', 'hope', 'love',
            'peace', 'joy', 'salvation', 'redemption', 'forgiveness', 'mercy',
            'praise', 'worship', 'prayer', 'spiritual', 'heavenly', 'divine',
            'holy', 'sacred', 'righteous', 'eternal', 'everlasting', 'glory',
            'glorious', 'miracle', 'miraculous', 'anointed', 'consecrated',
            'devoted', 'devotion', 'faithful', 'gracious', 'harmonious',
            'inspiring', 'inspirational', 'uplifting', 'enlightening',
            'comforting', 'healing', 'restored', 'renewal', 'revival',
            'transforming', 'transformation', 'victorious', 'victory',
            'breakthrough', 'triumph', 'overcome', 'overcoming', 'conquer',
            'prosper', 'prosperity', 'abundant', 'abundance', 'provision',
            'promise', 'promises', 'covenant', 'anointing', 'empowerment',
            'empowered', 'strengthen', 'strengthened', 'encourage',
            'encouragement', 'encouraged', 'edify', 'edifying', 'edification',

            // General positive
            'good', 'great', 'excellent', 'amazing', 'wonderful', 'beautiful',
            'awesome', 'fantastic', 'incredible', 'outstanding', 'perfect',
            'best', 'better', 'positive', 'success', 'successful', 'achieve',
            'achievement', 'accomplish', 'accomplished', 'happy', 'happiness',
            'delight', 'delightful', 'pleasant', 'enjoyable', 'satisfying',
            'beneficial', 'helpful', 'useful', 'valuable', 'important',
            'meaningful', 'significant', 'rewarding', 'fulfilling', 'enriching',
            'growth', 'growing', 'progress', 'improvement', 'advance',
            'develop', 'development', 'learn', 'learning', 'wisdom',
            'understanding', 'knowledge', 'insight', 'clarity', 'truth',
            'honest', 'integrity', 'authentic', 'genuine', 'real', 'true',
            'free', 'freedom', 'liberate', 'liberation', 'release', 'relief',
            'safe', 'safety', 'secure', 'security', 'protect', 'protection',
            'care', 'caring', 'compassion', 'compassionate', 'kind', 'kindness',
            'generous', 'generosity', 'giving', 'share', 'sharing', 'community',
            'together', 'unity', 'united', 'harmony', 'balance', 'wholeness'
        ]);

        // Negative words lexicon (to deprioritize)
        this.negativeWords = new Set([
            // General negative
            'bad', 'worse', 'worst', 'terrible', 'horrible', 'awful', 'poor',
            'fail', 'failure', 'failed', 'error', 'mistake', 'wrong', 'false',
            'lie', 'lies', 'deceive', 'deception', 'scam', 'fraud', 'fake',
            'hate', 'hatred', 'angry', 'anger', 'rage', 'violent', 'violence',
            'harm', 'harmful', 'hurt', 'pain', 'painful', 'suffer', 'suffering',
            'death', 'dead', 'die', 'dying', 'kill', 'murder', 'destroy',
            'destruction', 'devastate', 'devastating', 'disaster', 'catastrophe',
            'crisis', 'problem', 'trouble', 'difficulty', 'struggle', 'conflict',
            'war', 'fight', 'battle', 'attack', 'assault', 'abuse', 'abusive',
            'fear', 'afraid', 'scared', 'terror', 'horrify', 'horrific',
            'anxiety', 'anxious', 'stress', 'stressed', 'worry', 'worried',
            'sad', 'sadness', 'depressed', 'depression', 'despair', 'hopeless',
            'helpless', 'weak', 'weakness', 'vulnerable', 'danger', 'dangerous',
            'risk', 'risky', 'threat', 'threaten', 'warning', 'caution',
            'negative', 'pessimistic', 'cynical', 'doubt', 'uncertain',
            'confuse', 'confused', 'confusion', 'chaos', 'mess', 'messy',
            'dirty', 'corrupt', 'corruption', 'evil', 'wicked', 'sin', 'sinful',
            'curse', 'cursed', 'condemn', 'condemnation', 'judge', 'judgment',
            'punishment', 'punish', 'penalty', 'guilt', 'guilty', 'shame',
            'shameful', 'disgrace', 'embarrass', 'embarrassing', 'humiliate',

            // Spam/low-quality indicators
            'spam', 'click', 'clickbait', 'subscribe', 'buy', 'purchase',
            'discount', 'cheap', 'free trial', 'limited time', 'act now',
            'urgent', 'hurry', 'don\'t miss', 'exclusive offer'
        ]);
    }

    /**
     * Tokenize text into words
     * @param {string} text - Text to tokenize
     * @returns {Array<string>} - Array of lowercase words
     */
    tokenize(text) {
        if (!text) return [];
        return text.toLowerCase()
            .replace(/[^\w\s'-]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2);
    }

    /**
     * Analyze sentiment of text
     * @param {string} text - Text to analyze
     * @returns {Object} - Sentiment analysis result
     */
    analyze(text) {
        const words = this.tokenize(text);

        if (words.length === 0) {
            return {
                score: 0.5, // Neutral
                positiveCount: 0,
                negativeCount: 0,
                totalWords: 0,
                positiveWords: [],
                negativeWords: []
            };
        }

        const foundPositive = [];
        const foundNegative = [];

        for (const word of words) {
            if (this.positiveWords.has(word)) {
                foundPositive.push(word);
            } else if (this.negativeWords.has(word)) {
                foundNegative.push(word);
            }
        }

        // Calculate sentiment score (0 to 1)
        // Weighted: positive words increase score, negative words decrease
        const positiveWeight = foundPositive.length * 2;
        const negativeWeight = foundNegative.length * 2;
        const neutralWeight = words.length - foundPositive.length - foundNegative.length;

        const totalWeight = positiveWeight + negativeWeight + neutralWeight;
        const rawScore = totalWeight > 0
            ? (positiveWeight + (neutralWeight * 0.5)) / totalWeight
            : 0.5;

        // Normalize to 0-1 range with slight bias toward positive
        const normalizedScore = Math.max(0, Math.min(1, rawScore));

        return {
            score: normalizedScore,
            positiveCount: foundPositive.length,
            negativeCount: foundNegative.length,
            totalWords: words.length,
            positiveWords: [...new Set(foundPositive)],
            negativeWords: [...new Set(foundNegative)]
        };
    }

    /**
     * Analyze a search result's sentiment
     * @param {Object} result - Search result with title and snippet
     * @returns {Object} - Sentiment analysis for the result
     */
    analyzeSearchResult(result) {
        const titleAnalysis = this.analyze(result.title || '');
        const snippetAnalysis = this.analyze(result.snippet || '');

        // Weighted combination: title has higher weight than snippet
        const combinedScore = (titleAnalysis.score * 0.4) + (snippetAnalysis.score * 0.6);

        return {
            score: combinedScore,
            titleSentiment: titleAnalysis,
            snippetSentiment: snippetAnalysis
        };
    }

    /**
     * Batch analyze multiple search results
     * @param {Array<Object>} results - Array of search results
     * @returns {Array<Object>} - Results with sentiment scores attached
     */
    analyzeResults(results) {
        return results.map(result => ({
            ...result,
            sentiment: this.analyzeSearchResult(result)
        }));
    }
}

export const sentimentAnalyzer = new SentimentAnalyzer();
export default sentimentAnalyzer;
