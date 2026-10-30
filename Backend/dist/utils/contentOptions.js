"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCorrectOption = isCorrectOption;
exports.sanitizeOption = sanitizeOption;
exports.sanitizeOptions = sanitizeOptions;
exports.getCorrectOptionIndex = getCorrectOptionIndex;
exports.getCorrectWordOrder = getCorrectWordOrder;
function isCorrectOption(option) {
    return option.is_correct === true || option.isCorrect === true;
}
function sanitizeOption(option) {
    const { is_correct: _snakeCorrect, isCorrect: _camelCorrect, correct_answer: _snakeAnswer, correctAnswer: _camelAnswer, correct_position: _snakePosition, correctPosition: _camelPosition, ...publicOption } = option;
    return publicOption;
}
function sanitizeOptions(options) {
    if (!Array.isArray(options))
        return [];
    return options
        .filter((option) => Boolean(option) && typeof option === 'object' && !Array.isArray(option))
        .map(sanitizeOption);
}
function getCorrectOptionIndex(options) {
    if (!Array.isArray(options))
        return -1;
    return options.findIndex((option) => Boolean(option) && typeof option === 'object' && isCorrectOption(option));
}
function getCorrectWordOrder(options) {
    if (!Array.isArray(options))
        return [];
    return options
        .filter((option) => {
        return Boolean(option)
            && typeof option === 'object'
            && !Array.isArray(option)
            && typeof option.chunk_text === 'string'
            && Number.isInteger(option.correct_position);
    })
        .sort((left, right) => Number(left.correct_position) - Number(right.correct_position))
        .map((option) => option.chunk_text);
}
//# sourceMappingURL=contentOptions.js.map