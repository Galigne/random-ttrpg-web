const { MAX_AP } = require('./constants');

function characterEditError(translationKey, translationVariables = {}) {
	const error = new Error(translationKey);
	error.code = 'INVALID_CHARACTER_EDIT';
	error.translationKey = translationKey;
	error.translationVariables = translationVariables;
	return error;
}

function validateActionPointEdit(character, path, value) {
	if (
		path[0] !== 'resources'
		|| path[1] !== 'ap'
	) {
		return;
	}
	if (!Number.isSafeInteger(value) || value < 0 || value > (path[2] === 'current' ? Number.MAX_SAFE_INTEGER : MAX_AP)) {
		throw characterEditError('errors.apRange', {
			max: path[2] === 'current' ? Number.MAX_SAFE_INTEGER : MAX_AP,
		});
	}
}

function validateActionPointPair(current, maximum) {
	if (
		!Number.isSafeInteger(current)
		|| !Number.isInteger(maximum)
		|| current < 0
		|| maximum < 0
		|| current > Number.MAX_SAFE_INTEGER
		|| maximum > MAX_AP
	) {
		throw characterEditError('errors.apRange', {
			max: Number.MAX_SAFE_INTEGER,
		});
	}
}

module.exports = {
	characterEditError,
	validateActionPointEdit,
	validateActionPointPair,
};
