export let transcriptionData = {};

/**
 * Finds all instances of the query in the transcript's words array.
 * Returns an array of { index, proportion, word, start, end, length } for each match.
 */
export function findWordInstances(json, query) {
    if (!json || !json.words || !Array.isArray(json.words)) return [];
    const isValid = /^[a-zA-Zàâäéèêëîïôöùûüç' -]+$/i.test(query);
    if (!isValid) {
        throw new Error('Invalid characters used in query.');
    }
    // Helper to normalize words: lowercase and strip punctuation
    function normalizeWord(word) {
        return word.toLowerCase().replace(/^[^\wàâäéèêëîïôöùûüç']+|[^\wàâäéèêëîïôöùûüç']+$/g, '');
    }
    const trimmedQuery = query.replace(/\s+/g, ' ').trim().toLowerCase();
    const queryWords = trimmedQuery.split(' ').map(normalizeWord);
    const totalWords = json.words.length;
    if (!trimmedQuery || totalWords === 0) return [];
    const results = [];
    for (let i = 0; i <= totalWords - queryWords.length; i++) {
        let match = true;
        for (let j = 0; j < queryWords.length; j++) {
            const transcriptWord = json.words[i + j]?.word;
            if (!transcriptWord || normalizeWord(transcriptWord) !== queryWords[j]) {
                match = false;
                break;
            }
        }
        if (match) {
            results.push({
                index: i,
                proportion: (i + 1) / totalWords,
                word: json.words.slice(i, i + queryWords.length).map(w => w.word).join(' '),
                start: json.words[i].start,
                end: json.words[i + queryWords.length - 1].end,
                length: queryWords.length
            });
        }
    }
    return results;
}
